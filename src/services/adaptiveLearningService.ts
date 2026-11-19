// AI Adaptive Learning Engine Service ("Classroom Nervous System")
// Orchestrates:
// 1. Dynamic IRT difficulty calibration & concept mastery tracking
// 2. Live AI micro-lessons, dynamic quiz generation, voice blackboard solver & rubric grading
// 3. LocalStorage + SQLite (/api/adaptive-learning/records) + Google Drive persistence

import {
  AdaptiveQuestion,
  ConceptNode,
  DiagramStampType,
  DifficultyLevel,
  GradingResult,
  LearningStyle,
  RubricDimension,
  SubjectDefinition,
} from '../types/adaptiveLearning';
import { SUBJECT_CATALOG } from '../data/adaptiveCurriculumData';
import { sendMultiTurnChat } from './aiSuite';
import { getApiUrl } from './api';
import { syncAnyAiOutputToDrive } from './guidedLearningService';
import { getActiveAiModel, getActiveAiProvider } from './aiConfig';

const MASTERY_STORAGE_KEY = 'aura_adaptive_mastery_v1';
const GRADING_STORAGE_KEY = 'aura_adaptive_grades_v1';

// Safely strip markdown fences and parse JSON emitted by LLMs
function safeParseJson<T>(rawText: string): T | null {
  if (!rawText) return null;
  try {
    let cleaned = rawText.trim();
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      cleaned = cleaned.slice(firstBrace, lastBrace + 1);
    }
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}

export function buildDefaultMasteryMap(): Record<string, number> {
  const map: Record<string, number> = {};
  for (const subj of SUBJECT_CATALOG) {
    for (const c of subj.concepts) {
      map[c.id] = c.mastery;
    }
  }
  return map;
}

export function loadSubjectMasteryMap(): Record<string, number> {
  const defaults = buildDefaultMasteryMap();
  if (typeof window === 'undefined') return defaults;
  try {
    const raw = localStorage.getItem(MASTERY_STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    return { ...defaults, ...parsed };
  } catch {
    return defaults;
  }
}

export function saveSubjectMasteryMap(
  map: Record<string, number>,
  userEmail?: string,
  activeSubjectId?: string
): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(MASTERY_STORAGE_KEY, JSON.stringify(map));
    } catch {}
  }

  // Compute average mastery for SQLite snapshot
  const subjId = activeSubjectId || 'all';
  const targetSubj = SUBJECT_CATALOG.find((s) => s.id === subjId);
  let avgMastery = 70;
  if (targetSubj && targetSubj.concepts.length > 0) {
    const total = targetSubj.concepts.reduce((sum, c) => sum + (map[c.id] ?? c.mastery), 0);
    avgMastery = Math.round(total / targetSubj.concepts.length);
  }

  fetch(getApiUrl('/api/adaptive-learning/records'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: `mastery-snapshot-${subjId}`,
      userEmail: userEmail || (typeof window !== 'undefined' ? localStorage.getItem('userEmail') : null) || 'chinna.tamil2000@gmail.com',
      subjectId: subjId,
      recordType: 'mastery_snapshot',
      title: `${targetSubj ? targetSubj.name : 'All Subjects'} Mastery Matrix`,
      payload: map,
      masteryPercent: avgMastery,
    }),
  }).catch(() => {});
}

export function loadGradingHistory(): GradingResult[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(GRADING_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveGradingResult(
  result: GradingResult,
  userEmail?: string
): GradingResult[] {
  const existing = loadGradingHistory();
  const updated = [result, ...existing.filter((r) => r.id !== result.id)].slice(0, 40);
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(GRADING_STORAGE_KEY, JSON.stringify(updated));
    } catch {}
  }

  fetch(getApiUrl('/api/adaptive-learning/records'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: result.id,
      userEmail: userEmail || (typeof window !== 'undefined' ? localStorage.getItem('userEmail') : null) || 'chinna.tamil2000@gmail.com',
      subjectId: result.subjectId,
      recordType: 'graded_sheet',
      title: `${result.subjectId.toUpperCase()} Auto-Grade (${result.letterGrade} • ${result.overallScore}%)`,
      payload: result,
      score: result.overallScore,
    }),
  }).catch(() => {});

  return updated;
}

export async function syncAdaptiveLearningFromSqlite(
  userEmail?: string
): Promise<{ masteryMap: Record<string, number>; grades: GradingResult[] }> {
  const localMastery = loadSubjectMasteryMap();
  const localGrades = loadGradingHistory();

  try {
    const effectiveEmail =
      userEmail ||
      (typeof window !== 'undefined' ? localStorage.getItem('userEmail') : null) ||
      '';
    const qs = effectiveEmail ? `?userEmail=${encodeURIComponent(effectiveEmail)}` : '';
    const res = await fetch(getApiUrl(`/api/adaptive-learning/records${qs}`));
    if (!res.ok) {
      return { masteryMap: localMastery, grades: localGrades };
    }
    const data = await res.json();
    if (!data.success || !Array.isArray(data.records)) {
      return { masteryMap: localMastery, grades: localGrades };
    }

    const mergedMastery = { ...localMastery };
    const gradeMap = new Map<string, GradingResult>();
    localGrades.forEach((g) => gradeMap.set(g.id, g));

    for (const row of data.records) {
      if (row.recordType === 'mastery_snapshot' && row.payload && typeof row.payload === 'object') {
        for (const [k, v] of Object.entries(row.payload)) {
          if (typeof v === 'number') {
            mergedMastery[k] = Math.max(mergedMastery[k] ?? 0, v);
          }
        }
      } else if (row.recordType === 'graded_sheet' && row.payload?.id) {
        if (!gradeMap.has(row.payload.id)) {
          gradeMap.set(row.payload.id, row.payload as GradingResult);
        }
      }
    }

    const mergedGrades = Array.from(gradeMap.values())
      .sort((a, b) => (b.gradedAt || '').localeCompare(a.gradedAt || ''))
      .slice(0, 40);

    if (typeof window !== 'undefined') {
      localStorage.setItem(MASTERY_STORAGE_KEY, JSON.stringify(mergedMastery));
      localStorage.setItem(GRADING_STORAGE_KEY, JSON.stringify(mergedGrades));
    }

    return { masteryMap: mergedMastery, grades: mergedGrades };
  } catch {
    return { masteryMap: localMastery, grades: localGrades };
  }
}

export async function exportAdaptiveArtifactToDrive(
  title: string,
  markdownContent: string,
  subjectName: string,
  accessToken?: string | null,
  userEmail?: string
): Promise<{ driveFileId: string; driveWebViewLink: string; folderPath: string }> {
  const effectiveToken =
    accessToken ||
    (typeof window !== 'undefined'
      ? localStorage.getItem('aura_google_access_token') ||
        localStorage.getItem('google_access_token')
      : null) ||
    '';

  const result = await syncAnyAiOutputToDrive(title, markdownContent, effectiveToken, {
    folderName: `Adaptive Learning - ${subjectName}`,
    category: `Adaptive Learning (${subjectName})`,
    userEmail,
  });

  if (!result) {
    throw new Error('Unable to sync adaptive learning artifact to Google Drive.');
  }

  return result;
}

// ---------------------------------------------------------------------------
// Adaptive IRT Calibration Engine
// ---------------------------------------------------------------------------
const DIFFICULTY_LADDER: DifficultyLevel[] = ['foundation', 'core', 'honors', 'olympiad'];

export function computeNextDifficulty(
  current: DifficultyLevel,
  isCorrect: boolean,
  streak: number,
  responseTimeSec: number
): { nextDifficulty: DifficultyLevel; reason: string } {
  const idx = DIFFICULTY_LADDER.indexOf(current);
  if (isCorrect && (streak >= 2 || (responseTimeSec > 0 && responseTimeSec <= 8 && idx < 2))) {
    const nextIdx = Math.min(DIFFICULTY_LADDER.length - 1, idx + 1);
    if (nextIdx !== idx) {
      return {
        nextDifficulty: DIFFICULTY_LADDER[nextIdx],
        reason: `⬆️ Escalated to ${DIFFICULTY_LADDER[nextIdx].toUpperCase()} (${streak >= 2 ? `${streak}x accuracy streak` : 'fast high-confidence mastery'})`,
      };
    }
    return { nextDifficulty: current, reason: '🔥 Peak Olympiad mastery maintained!' };
  }

  if (!isCorrect && idx > 0) {
    const prevIdx = Math.max(0, idx - 1);
    return {
      nextDifficulty: DIFFICULTY_LADDER[prevIdx],
      reason: `🧭 Calibrated to ${DIFFICULTY_LADDER[prevIdx].toUpperCase()} to reinforce core intuition`,
    };
  }

  return {
    nextDifficulty: current,
    reason: isCorrect
      ? `✅ Solid response (+mastery at ${current.toUpperCase()})`
      : '💡 Hint scaffolding unlocked to strengthen understanding',
  };
}

export function computeMasteryDelta(
  difficulty: DifficultyLevel,
  isCorrect: boolean,
  usedHint: boolean
): number {
  const baseByLevel: Record<DifficultyLevel, number> = {
    foundation: 6,
    core: 8,
    honors: 11,
    olympiad: 14,
  };
  if (isCorrect) {
    const gain = baseByLevel[difficulty];
    return usedHint ? Math.max(3, Math.round(gain * 0.65)) : gain;
  }
  return -3;
}

// ---------------------------------------------------------------------------
// 1. Live AI Adaptive Micro-Lesson Generator
// ---------------------------------------------------------------------------
export interface AdaptiveLessonContent {
  title: string;
  explanation: string;
  keyPoints: string[];
  analogy: string;
  quickChallenge: string;
  modelUsed: string;
}

export async function generateAdaptiveLesson(
  subject: SubjectDefinition,
  concept: ConceptNode,
  difficulty: DifficultyLevel,
  style: LearningStyle
): Promise<AdaptiveLessonContent> {
  const provider = getActiveAiProvider();
  const model = getActiveAiModel(provider);

  const stylePromptMap: Record<LearningStyle, string> = {
    visual: 'Use vivid mental imagery, spatial geometry metaphors, and blackboard-ready visual cues.',
    socratic: 'Lead with probing curiosity questions and intuition builders before stating laws.',
    hands_on: 'Frame around a real-world experiment, calculation, or everyday observation.',
    exam_prep: 'Highlight high-yield exam pitfalls, scoring keywords, and exact definitions.',
  };

  const langNote =
    subject.id === 'tamil'
      ? 'Provide crisp bilingual explanations (rich Tamil script + concise English clarity notes so learners master both).'
      : 'Use crystal-clear inspiring English appropriate to the difficulty level.';

  const prompt = `Generate a compact, high-impact adaptive micro-lesson as STRICT JSON (no markdown fences) for:
Subject: ${subject.name} (${subject.nativeName})
Concept: ${concept.title} ${concept.nativeTitle ? `(${concept.nativeTitle})` : ''}
Core Formula/Quote: ${concept.keyFormulaOrQuote}
Target Difficulty: ${difficulty.toUpperCase()}
Learning Style: ${style.toUpperCase()} — ${stylePromptMap[style]}
${langNote}

Return JSON strictly with keys:
{
  "title": "Engaging lesson headline",
  "explanation": "2-3 sentence deeply illuminating explanation calibrated to ${difficulty}",
  "keyPoints": ["3 concise bullet takeaways including exact formula or literary example"],
  "analogy": "1 memorable real-world analogy or intuitive mental hook",
  "quickChallenge": "1 quick 15-second reflection prompt for the student"
}`;

  try {
    const res = await sendMultiTurnChat([{ role: 'user', text: prompt }], {
      role: 'adaptive_learning_tutor',
      taskComplexity: difficulty === 'olympiad' || difficulty === 'honors' ? 'complex' : 'general',
      provider,
      modelOverride: model,
    });

    const parsed = safeParseJson<Omit<AdaptiveLessonContent, 'modelUsed'>>(res.reply);
    if (parsed && parsed.explanation && Array.isArray(parsed.keyPoints)) {
      return {
        title: parsed.title || concept.title,
        explanation: parsed.explanation,
        keyPoints: parsed.keyPoints.slice(0, 4),
        analogy: parsed.analogy || concept.keyFormulaOrQuote,
        quickChallenge: parsed.quickChallenge || `How does "${concept.title}" connect to everyday life?`,
        modelUsed: res.modelUsed || model,
      };
    }
  } catch (err) {
    console.warn('[AdaptiveLearning] Falling back to offline adaptive lesson:', err);
  }

  // Instant resilient offline fallback
  return {
    title: `${concept.title} (${difficulty.toUpperCase()} Mode)`,
    explanation: `${concept.summary} Anchored through a ${style.replace('_', ' ')} lens: focus first on the structural core — ${concept.keyFormulaOrQuote} — and trace how each variable shifts the outcome.`,
    keyPoints: [
      `Core Anchor: ${concept.keyFormulaOrQuote}`,
      `Mastery Calibration: Tailored for ${difficulty} depth (${concept.estimatedMins} min focus sprint)`,
      `Visual Diagram Ready: Tap "Teach on Blackboard" to inspect the interactive ${concept.diagramStamp.replace('_', ' ')} schematic`,
    ],
    analogy:
      style === 'visual'
        ? `Picture "${concept.title}" as a glowing neural circuit on a live smart chalkboard: every input pulse travels predictably to its result node.`
        : `Think of "${concept.title}" like tuning a precision musical instrument—small adjustments at the foundation keep higher concepts in harmony.`,
    quickChallenge: `Can you explain "${concept.title}" in your own words in 2 sentences inside the Auto-Grader?`,
    modelUsed: 'Aura Adaptive Core (Offline Safe)',
  };
}

// ---------------------------------------------------------------------------
// 2. Dynamic AI Adaptive Question Generator
// ---------------------------------------------------------------------------
export async function generateDynamicAdaptiveQuestion(
  subject: SubjectDefinition,
  concept: ConceptNode,
  difficulty: DifficultyLevel
): Promise<AdaptiveQuestion> {
  const provider = getActiveAiProvider();
  const model = getActiveAiModel(provider);

  const prompt = `Create ONE brand-new multiple-choice question (STRICT JSON only, no markdown fences) for:
Subject: ${subject.name}
Concept: ${concept.title} (${concept.summary})
Difficulty: ${difficulty}
${subject.id === 'tamil' ? 'Write the question primarily in Tamil Unicode script with helpful English terminology in parentheses if useful.' : ''}

Return strictly:
{
  "prompt": "Clear single question text",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "correctIndex": 0,
  "explanation": "Concise 1-2 sentence explanation of why the correct option wins",
  "hint": "Gentle 1-sentence Socratic hint without giving away the letter",
  "rubricKeywords": ["keyword1", "keyword2", "keyword3"]
}`;

  try {
    const res = await sendMultiTurnChat([{ role: 'user', text: prompt }], {
      role: 'adaptive_learning_tutor',
      taskComplexity: 'fast',
      provider,
      modelOverride: model,
    });
    const parsed = safeParseJson<{
      prompt: string;
      options: string[];
      correctIndex: number;
      explanation: string;
      hint: string;
      rubricKeywords?: string[];
    }>(res.reply);

    if (
      parsed &&
      parsed.prompt &&
      Array.isArray(parsed.options) &&
      parsed.options.length === 4 &&
      typeof parsed.correctIndex === 'number'
    ) {
      return {
        id: `ai-q-${subject.id}-${Date.now()}`,
        subjectId: subject.id,
        conceptId: concept.id,
        difficulty,
        prompt: parsed.prompt,
        options: parsed.options,
        correctIndex: Math.min(3, Math.max(0, parsed.correctIndex)),
        explanation: parsed.explanation || 'Evaluated dynamically by the Aura Adaptive Learning Engine.',
        hint: parsed.hint || `Reflect on: ${concept.keyFormulaOrQuote}`,
        rubricKeywords: parsed.rubricKeywords || [concept.title],
      };
    }
  } catch (err) {
    console.warn('[AdaptiveLearning] Dynamic question fallback:', err);
  }

  // Fallback to best matching curated question
  const exact = subject.questions.find((q) => q.conceptId === concept.id);
  const byDiff = subject.questions.find((q) => q.difficulty === difficulty);
  return {
    ...(exact || byDiff || subject.questions[0]),
    id: `curated-${Date.now()}`,
  };
}

// ---------------------------------------------------------------------------
// 3. Smart Blackboard Voice AI Solver
// ---------------------------------------------------------------------------
export interface BlackboardSolution {
  headline: string;
  chalkSteps: string[];
  keyFormula: string;
  recommendedDiagram: DiagramStampType | null;
  spokenSummary: string;
  modelUsed: string;
}

export async function solveVoiceQueryOnBlackboard(
  subject: SubjectDefinition,
  spokenQuery: string,
  existingBoardText: string
): Promise<BlackboardSolution> {
  const provider = getActiveAiProvider();
  const model = getActiveAiModel(provider);

  const availableStamps: DiagramStampType[] = [
    'parabola',
    'sine_wave',
    'ray_optics',
    'free_body',
    'bohr_atom',
    'benzene_ring',
    'plant_cell',
    'photosynthesis',
    'neuron_synapse',
    'heart_chambers',
    'thirukkural_frame',
    'story_arc',
  ];

  const prompt = `You are teaching live on a Smart Blackboard for ${subject.name} (${subject.nativeName}).
Student/Teacher spoke or asked: "${spokenQuery}"
Existing notes on blackboard: "${existingBoardText.slice(0, 300)}"

Respond with STRICT JSON (no markdown fences) containing concise chalk-friendly board lines:
{
  "headline": "Short 3-6 word blackboard header",
  "chalkSteps": ["Step 1: concise chalk line (max 70 chars)", "Step 2: ...", "Step 3: ...", "Step 4: Result/Conclusion"],
  "keyFormula": "Key formula, couplet, or equation to box in gold chalk",
  "recommendedDiagram": "one of [${availableStamps.join(', ')}] or null",
  "spokenSummary": "Warm 1-2 sentence spoken explanation for text-to-speech readout"
}`;

  try {
    const res = await sendMultiTurnChat([{ role: 'user', text: prompt }], {
      role: 'adaptive_learning_tutor',
      taskComplexity: 'general',
      provider,
      modelOverride: model,
    });

    const parsed = safeParseJson<Omit<BlackboardSolution, 'modelUsed'>>(res.reply);
    if (parsed && parsed.headline && Array.isArray(parsed.chalkSteps)) {
      const validStamp =
        parsed.recommendedDiagram && availableStamps.includes(parsed.recommendedDiagram)
          ? parsed.recommendedDiagram
          : null;
      return {
        headline: parsed.headline,
        chalkSteps: parsed.chalkSteps.slice(0, 5),
        keyFormula: parsed.keyFormula || subject.concepts[0].keyFormulaOrQuote,
        recommendedDiagram: validStamp,
        spokenSummary: parsed.spokenSummary || `${parsed.headline}. ${parsed.chalkSteps.join(' ')}`,
        modelUsed: res.modelUsed || model,
      };
    }
  } catch (err) {
    console.warn('[SmartBlackboard] Offline chalk solver fallback:', err);
  }

  // Intelligent subject-aware offline chalk solver
  const lower = spokenQuery.toLowerCase();
  const matchedConcept =
    subject.concepts.find(
      (c) =>
        lower.includes(c.title.toLowerCase().split(' ')[0]) ||
        (c.nativeTitle && lower.includes(c.nativeTitle.split(' ')[0]))
    ) || subject.concepts[0];

  const stampGuess: DiagramStampType = lower.includes('parabola') || lower.includes('quadratic')
    ? 'parabola'
    : lower.includes('wave') || lower.includes('sine')
    ? 'sine_wave'
    : lower.includes('lens') || lower.includes('optic') || lower.includes('light')
    ? 'ray_optics'
    : lower.includes('force') || lower.includes('newton') || lower.includes('ramp')
    ? 'free_body'
    : lower.includes('atom') || lower.includes('bohr') || lower.includes('electron')
    ? 'bohr_atom'
    : lower.includes('benzene') || lower.includes('organic') || lower.includes('ring')
    ? 'benzene_ring'
    : lower.includes('cell') && subject.id === 'botany'
    ? 'plant_cell'
    : lower.includes('photo')
    ? 'photosynthesis'
    : lower.includes('neuron') || lower.includes('brain') || lower.includes('synapse')
    ? 'neuron_synapse'
    : lower.includes('heart') || lower.includes('blood')
    ? 'heart_chambers'
    : lower.includes('kural') || lower.includes('குறள்') || subject.id === 'tamil'
    ? 'thirukkural_frame'
    : matchedConcept.diagramStamp;

  return {
    headline: `${subject.name}: ${matchedConcept.title}`,
    chalkSteps: [
      `1. Query: ${spokenQuery.slice(0, 58)}`,
      `2. Core Concept: ${matchedConcept.title}`,
      `3. Rule: ${matchedConcept.keyFormulaOrQuote.slice(0, 62)}`,
      `4. Insight: ${matchedConcept.summary.slice(0, 62)}`,
    ],
    keyFormula: matchedConcept.keyFormulaOrQuote,
    recommendedDiagram: stampGuess,
    spokenSummary:
      subject.id === 'tamil'
        ? `கரும்பலகையில் ${matchedConcept.nativeTitle || matchedConcept.title} பற்றிய விளக்கமும் வரைபடமும் வரையப்பட்டுள்ளது.`
        : `I have drawn the ${matchedConcept.title} breakdown and annotated the visual diagram on your Smart Blackboard.`,
    modelUsed: 'Aura Blackboard Chalk Engine (Offline Safe)',
  };
}

// ---------------------------------------------------------------------------
// 4. Automated AI Grading Engine
// ---------------------------------------------------------------------------
function scoreToLetterGrade(score: number): string {
  if (score >= 95) return 'A+';
  if (score >= 90) return 'A';
  if (score >= 85) return 'A-';
  if (score >= 80) return 'B+';
  if (score >= 74) return 'B';
  if (score >= 68) return 'C+';
  if (score >= 60) return 'C';
  return 'Needs Review';
}

export async function gradeStudentSubmission(
  subject: SubjectDefinition,
  questionPrompt: string,
  studentAnswer: string,
  inputMode: 'written' | 'voice' | 'blackboard',
  rubricKeywords: string[],
  sampleIdealAnswer?: string
): Promise<GradingResult> {
  const provider = getActiveAiProvider();
  const model = getActiveAiModel(provider);

  const prompt = `You are an encouraging, razor-sharp Automated AI Examiner for ${subject.name} (${subject.nativeName}).
Grade this ${inputMode.toUpperCase()} student response fairly and constructively using 4 rubric dimensions (each 0 to 25, totaling 0 to 100).

Question: "${questionPrompt}"
Key Expected Concepts/Keywords: ${rubricKeywords.join(', ')}
Student Submission: "${studentAnswer.trim()}"

Return STRICT JSON only (no markdown fences):
{
  "overallScore": 86,
  "rubric": [
    { "name": "Conceptual Accuracy", "score": 22, "maxScore": 25, "feedback": "..." },
    { "name": "Methodology & Evidence", "score": 21, "maxScore": 25, "feedback": "..." },
    { "name": "Domain Terminology", "score": 22, "maxScore": 25, "feedback": "..." },
    { "name": "Clarity & Synthesis", "score": 21, "maxScore": 25, "feedback": "..." }
  ],
  "strengths": ["specific strength 1", "specific strength 2"],
  "misconceptions": ["specific gap or missing detail if any"],
  "modelAnswer": "Concise gold-standard 2-3 sentence model response",
  "adaptiveRecommendation": "Concrete next study action in the Adaptive Engine"
}`;

  try {
    const res = await sendMultiTurnChat([{ role: 'user', text: prompt }], {
      role: 'adaptive_learning_tutor',
      taskComplexity: 'complex',
      provider,
      modelOverride: model,
    });

    const parsed = safeParseJson<{
      overallScore: number;
      rubric: RubricDimension[];
      strengths: string[];
      misconceptions: string[];
      modelAnswer: string;
      adaptiveRecommendation: string;
    }>(res.reply);

    if (parsed && typeof parsed.overallScore === 'number' && Array.isArray(parsed.rubric)) {
      const clamped = Math.min(100, Math.max(15, Math.round(parsed.overallScore)));
      return {
        id: `grade-${subject.id}-${Date.now()}`,
        subjectId: subject.id,
        questionPrompt,
        studentAnswer,
        inputMode,
        overallScore: clamped,
        letterGrade: scoreToLetterGrade(clamped),
        rubric: parsed.rubric.slice(0, 4),
        strengths: parsed.strengths?.length ? parsed.strengths : ['Clear effort and structured response'],
        misconceptions: parsed.misconceptions || [],
        modelAnswer: parsed.modelAnswer || sampleIdealAnswer || subject.concepts[0].summary,
        adaptiveRecommendation:
          parsed.adaptiveRecommendation ||
          `Practice an Honors challenge in ${subject.name} to cement mastery above 90%.`,
        modelUsed: res.modelUsed || model,
        gradedAt: new Date().toISOString(),
      };
    }
  } catch (err) {
    console.warn('[AutoGrader] Using heuristic rubric evaluator:', err);
  }

  // Deterministic, informative heuristic rubric fallback when offline
  const lower = studentAnswer.toLowerCase();
  const matchedKeywords = rubricKeywords.filter((kw) => lower.includes(kw.toLowerCase()));
  const missingKeywords = rubricKeywords.filter((kw) => !lower.includes(kw.toLowerCase()));
  const keywordRatio = rubricKeywords.length > 0 ? matchedKeywords.length / rubricKeywords.length : 0.65;
  const wordCount = studentAnswer.trim().split(/\s+/).filter(Boolean).length;
  const depthFactor = Math.min(1, wordCount / 28);

  const accuracyScore = Math.round(11 + keywordRatio * 14);
  const methodScore = Math.round(12 + depthFactor * 12);
  const terminologyScore = Math.round(10 + keywordRatio * 14);
  const clarityScore = Math.min(25, Math.round(13 + (wordCount >= 12 ? 9 : wordCount * 0.6)));
  const overall = Math.min(98, accuracyScore + methodScore + terminologyScore + clarityScore);

  return {
    id: `grade-${subject.id}-${Date.now()}`,
    subjectId: subject.id,
    questionPrompt,
    studentAnswer,
    inputMode,
    overallScore: overall,
    letterGrade: scoreToLetterGrade(overall),
    rubric: [
      {
        name: 'Conceptual Accuracy',
        score: accuracyScore,
        maxScore: 25,
        feedback:
          matchedKeywords.length > 0
            ? `Accurately connected ${matchedKeywords.slice(0, 3).join(', ')}.`
            : 'Attempted core idea; anchor answer explicitly to domain laws.',
      },
      {
        name: 'Methodology & Evidence',
        score: methodScore,
        maxScore: 25,
        feedback:
          wordCount >= 18
            ? 'Good logical progression and explanatory depth.'
            : 'Expand reasoning step-by-step with concrete mechanisms or formulas.',
      },
      {
        name: 'Domain Terminology',
        score: terminologyScore,
        maxScore: 25,
        feedback:
          missingKeywords.length > 0
            ? `Try integrating exact key terms: ${missingKeywords.slice(0, 3).join(', ')}.`
            : 'Strong scientific & subject-specific vocabulary!',
      },
      {
        name: 'Clarity & Synthesis',
        score: clarityScore,
        maxScore: 25,
        feedback: `Captured clearly via ${inputMode} submission mode.`,
      },
    ],
    strengths: [
      matchedKeywords.length > 0
        ? `Strong grasp of key concepts: ${matchedKeywords.join(', ')}`
        : `Clear ${inputMode} articulation of the topic`,
      wordCount >= 20 ? 'Complete, well-paced explanation length' : 'Concise focus on core takeaway',
    ],
    misconceptions:
      missingKeywords.length > 0
        ? [`Consider explicitly weaving in: ${missingKeywords.slice(0, 3).join(', ')}`]
        : [],
    modelAnswer:
      sampleIdealAnswer ||
      `${subject.concepts[0].summary} Key Anchor: ${subject.concepts[0].keyFormulaOrQuote}`,
    adaptiveRecommendation:
      overall >= 85
        ? `Promote to ${subject.name} Honors/Olympiad Adaptive Quiz and test another derivation on Smart Blackboard!`
        : `Review ${subject.concepts[0].title} interactive node in Adaptive Engine, focusing on ${missingKeywords.slice(0, 2).join(' & ') || 'core principles'}.`,
    modelUsed: 'Aura Rubric Evaluator (Local Engine)',
    gradedAt: new Date().toISOString(),
  };
}
