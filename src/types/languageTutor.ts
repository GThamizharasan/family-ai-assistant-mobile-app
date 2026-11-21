// Types for the Professional Human-Like Live Language Tutor (English & Tamil / தமிழ்)

export type TutorLanguage = 'english' | 'tamil';

export type ProficiencyLevel =
  | 'beginner'
  | 'elementary'
  | 'intermediate'
  | 'upper_intermediate'
  | 'advanced'
  | 'mastery';

export type TutorEmotion =
  | 'welcoming'
  | 'explaining'
  | 'encouraging'
  | 'celebrating'
  | 'listening'
  | 'coaching';

export type TutorStudioView =
  | 'live'
  | 'roadmap'
  | 'lesson'
  | 'writing'
  | 'immersion'
  | 'analytics'
  | 'vault';

export interface TutorPersona {
  language: TutorLanguage;
  name: string;
  nativeName: string;
  title: string;
  tagline: string;
  greeting: string;
  greetingTransliteration?: string;
  greetingMeaning?: string;
  accentGradient: string;
  badgeColor: string;
  voiceLang: string;
  defaultRate: number;
}

export interface LanguageStageInfo {
  stageNumber: number;
  level: ProficiencyLevel;
  cefrCode: string;
  englishLabel: string;
  tamilLabel: string;
  description: string;
  gradient: string;
  badgeClass: string;
}

export interface LanguageModuleSummary {
  id: string;
  language: TutorLanguage;
  stageNumber: number;
  level: ProficiencyLevel;
  levelLabel: string;
  title: string;
  nativeTitle: string;
  subtitle: string;
  estimatedMinutes: number;
  keyTopics: string[];
  xpReward: number;
  colorGradient: string;
}

export interface LessonConceptExample {
  phrase: string;
  transliteration?: string;
  meaning: string;
  usageNote?: string;
}

export interface LessonConceptPillar {
  id: string;
  title: string;
  nativeTitle?: string;
  explanation: string;
  nativeExplanation?: string;
  ruleFormula?: string;
  examples: LessonConceptExample[];
  commonMistake?: {
    wrong: string;
    right: string;
    why: string;
  };
}

export interface LessonVocabCard {
  id: string;
  term: string;
  phonetic: string;
  transliteration?: string;
  meaning: string;
  partOfSpeech: string;
  register: 'casual' | 'formal' | 'literary';
  exampleSentence: string;
  exampleMeaning: string;
  memoryHook: string;
}

export interface LessonDialogueLine {
  speaker: 'tutor' | 'learner';
  speakerName: string;
  line: string;
  transliteration?: string;
  meaning: string;
  coachingTip?: string;
}

export interface PronunciationDrill {
  id: string;
  focusSound: string;
  targetPhrase: string;
  transliteration?: string;
  meaning: string;
  mouthTip: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface LessonExercise {
  id: string;
  type: 'mcq' | 'fill_blank' | 'speaking';
  prompt: string;
  nativePrompt?: string;
  options?: string[];
  correctAnswer: string;
  explanation: string;
  xp: number;
}

export interface ConstructedLanguageLesson {
  id: string;
  moduleId: string;
  language: TutorLanguage;
  level: ProficiencyLevel;
  stageNumber: number;
  title: string;
  nativeTitle: string;
  isCustomCourse?: boolean;
  teacherOpeningScript: string;
  teacherOpeningTransliteration?: string;
  teacherOpeningMeaning?: string;
  learningObjectives: string[];
  conceptPillars: LessonConceptPillar[];
  vocabularyDeck: LessonVocabCard[];
  liveDialogueScript: LessonDialogueLine[];
  pronunciationDrills: PronunciationDrill[];
  interactiveExercises: LessonExercise[];
  culturalSpotlight: {
    title: string;
    quote: string;
    transliteration?: string;
    meaning: string;
    insight: string;
  };
  capstoneChallenge: {
    title: string;
    prompt: string;
    targetSkills: string[];
    sampleMasteryResponse: string;
  };
  generatedByModel: string;
  createdAt: string;
  updatedAt: string;
}

export interface LiveTutorMessage {
  id: string;
  role: 'tutor' | 'learner';
  text: string;
  transliteration?: string;
  englishMeaning?: string;
  emotion?: TutorEmotion;
  praiseNote?: string;
  grammarFeedback?: string;
  betterPhrasing?: string;
  pronunciationTip?: string;
  fluencyScore?: number;
  xpEarned?: number;
  followUpSuggestions?: string[];
  timestamp: string;
}

export interface SpeakingEvaluationResult {
  overallScore: number;
  pronunciationScore: number;
  grammarScore: number;
  naturalnessScore: number;
  emotion: TutorEmotion;
  coachFeedback: string;
  correctedVersion: string;
  phoneticTip: string;
  xpEarned: number;
}

export interface TutorRoleplayScenario {
  id: string;
  language: TutorLanguage;
  title: string;
  nativeTitle: string;
  level: ProficiencyLevel;
  iconEmoji: string;
  description: string;
  starterTutorLine: string;
  starterTransliteration?: string;
  starterMeaning?: string;
  learnerGoal: string;
}

export interface SavedLanguageTutorRecord {
  id: string;
  language: TutorLanguage;
  level: ProficiencyLevel;
  recordType:
    | 'course_lesson'
    | 'live_session'
    | 'progress_snapshot'
    | 'essay_clinic'
    | 'certificate'
    | 'family_suite_state';
  moduleId?: string;
  title: string;
  payload: any;
  masteryPercent?: number;
  source: 'local' | 'sqlite' | 'google_drive';
  syncedToSqlite?: boolean;
  syncedToDrive?: boolean;
  driveFileId?: string;
  driveWebViewLink?: string;
  createdAt: string;
  updatedAt: string;
}

// Bundle 1: Pronunciation Heatmap & 3-Register Live Rewriter
export interface WordHeatmapToken {
  word: string;
  status: 'clear' | 'drift' | 'missed';
  tip?: string;
}

export interface PronunciationHeatmapResult {
  overallAccuracy: number;
  tokens: WordHeatmapToken[];
  coachSummary: string;
}

export interface RegisterRewriteResult {
  input: string;
  language: TutorLanguage;
  casual: string;
  casualTranslit?: string;
  formal: string;
  formalTranslit?: string;
  literary: string;
  literaryTranslit?: string;
  coachingNote: string;
  modelUsed: string;
}

// Bundle 2: AI Essay/Email Clinic & Sentence Tile Builder
export interface EssayClinicResult {
  cefrBand: string;
  fluencyScore: number;
  grammarScore: number;
  vocabRichness: number;
  clarityScore: number;
  corrections: Array<{
    original: string;
    improved: string;
    reason: string;
  }>;
  polishedVersion: string;
  encouragement: string;
  modelUsed: string;
}

export interface SentenceTilePuzzle {
  id: string;
  language: TutorLanguage;
  level: ProficiencyLevel;
  promptMeaning: string;
  correctTokens: string[];
  grammarNote: string;
  transliteration?: string;
}

// Bundle 3: Placement Diagnostic, SM-2 Spaced Repetition & Daily Immersion
export interface PlacementQuestion {
  id: string;
  language: TutorLanguage;
  stageNumber: number;
  targetLevel: ProficiencyLevel;
  prompt: string;
  nativePrompt?: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

export interface SrsVocabItem {
  id: string;
  language: TutorLanguage;
  term: string;
  transliteration?: string;
  phonetic?: string;
  meaning: string;
  exampleSentence?: string;
  intervalDays: number;
  easeFactor: number;
  repetitions: number;
  nextReviewDate: string; // YYYY-MM-DD
  lastReviewedAt?: string;
}

export interface DailyImmersionItem {
  id: string;
  language: TutorLanguage;
  category: 'story' | 'tirukkural' | 'idiom';
  title: string;
  nativeTitle?: string;
  body: string;
  transliteration?: string;
  translation: string;
  wordGlossary: Array<{
    word: string;
    meaning: string;
    transliteration?: string;
  }>;
  reflectionPrompt: string;
}

// Bundle 4: Family Learner Profiles, Certificates & Fluency Analytics
export type LearnerAgeGroup = 'kids_6_10' | 'teens' | 'adult' | 'elder';

export interface TutorFamilyLearnerProfile {
  id: string;
  name: string;
  avatar: string;
  ageGroup: LearnerAgeGroup;
  roleLabel: string;
  createdAt: string;
}

export interface StageCompletionCertificate {
  id: string;
  learnerId: string;
  learnerName: string;
  language: TutorLanguage;
  stageNumber: number;
  cefrCode: string;
  stageTitle: string;
  scorePercent: number;
  signedBy: string;
  issuedAt: string;
  driveWebViewLink?: string;
}

export interface FluencyHistoryPoint {
  date: string; // YYYY-MM-DD
  language: TutorLanguage;
  fluencyScore: number;
  speakingMinutes: number;
  xpEarned: number;
}

export interface TutorProgressState {
  xp: number;
  streakDays: number;
  lastActiveDate: string;
  completedModules: Record<string, number>;
  masteredVocabIds: string[];
  totalLiveTurns: number;
  averageFluency: number;
  englishLevel: ProficiencyLevel;
  tamilLevel: ProficiencyLevel;
  speakingMinutes?: number;
  tracedLettersCount?: number;
  essaysGradedCount?: number;
  sentencePuzzlesSolved?: number;
  srsDeck?: SrsVocabItem[];
  certificates?: StageCompletionCertificate[];
  fluencyHistory?: FluencyHistoryPoint[];
  placementResult?: Partial<Record<TutorLanguage, { level: ProficiencyLevel; score: number; completedAt: string }>>;
}

export interface FamilyTutorSuiteState {
  activeLearnerId: string;
  learners: TutorFamilyLearnerProfile[];
  progressByLearner: Record<string, TutorProgressState>;
}

