// Kids Math Practice Analytics, Mistake Bank, Sticker Trophy Book, Parent Weekly Report
// & AI Bilingual Story Word Problem Service (SQLite + Google Drive Synced)

import {
  ArithmeticProblem,
  ArithmeticTier,
  KidsMathAnalyticsState,
  MathMistakeRecord,
  MathStickerBadge,
} from '../types/adaptiveLearning';
import { getApiUrl } from './api';
import { getActiveAiModel, getActiveAiProvider } from './aiConfig';
import { sendMultiTurnChat } from './aiSuite';
import { syncAnyAiOutputToDrive } from './guidedLearningService';
import { getEffectiveGoogleToken } from './visualTopicStorageService';

const ANALYTICS_STORAGE_KEY = 'aura_kids_math_analytics_v1';

export const MATH_TOPIC_LABELS: Record<string, string> = {
  add: 'Addition (+)',
  sub: 'Subtraction (−)',
  mul: 'Multiplication (×)',
  div: 'Division (÷)',
  mixed: 'Mixed Arithmetic',
  tables_quiz: 'Tables 1–10 Quiz',
  word_story: 'Story Word Problems',
  clock: 'Clock Reading',
  fractions: 'Fractions Pizza/Bar',
  money: '₹ Money & Change',
  compare_pattern: 'Compare & Patterns',
  mistake_bank: 'Mistake Recovery',
};

function todayKey(): string {
  return new Date().toISOString().split('T')[0];
}

export function buildDefaultKidsMathAnalytics(): KidsMathAnalyticsState {
  return {
    totalStars: 0,
    bestStreak: 0,
    dailyChallengesCompleted: 0,
    lastPracticeDate: todayKey(),
    dailySolvedToday: 0,
    topicStats: {},
    mistakeBank: [],
    recentSessions: [],
  };
}

export function loadKidsMathAnalytics(): KidsMathAnalyticsState {
  const defaults = buildDefaultKidsMathAnalytics();
  if (typeof window === 'undefined') return defaults;
  try {
    const raw = localStorage.getItem(ANALYTICS_STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    const merged: KidsMathAnalyticsState = {
      ...defaults,
      ...parsed,
      topicStats: parsed?.topicStats || {},
      mistakeBank: Array.isArray(parsed?.mistakeBank) ? parsed.mistakeBank : [],
      recentSessions: Array.isArray(parsed?.recentSessions) ? parsed.recentSessions : [],
    };
    if (merged.lastPracticeDate !== todayKey()) {
      merged.lastPracticeDate = todayKey();
      merged.dailySolvedToday = 0;
    }
    return merged;
  } catch {
    return defaults;
  }
}

export function saveKidsMathAnalytics(
  state: KidsMathAnalyticsState,
  userEmail?: string
): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(ANALYTICS_STORAGE_KEY, JSON.stringify(state));
    } catch {}
  }

  const email = (
    userEmail ||
    (typeof window !== 'undefined' ? localStorage.getItem('userEmail') : '') ||
    'chinna.tamil2000@gmail.com'
  )
    .toLowerCase()
    .trim();

  const totalAttempted = Object.values(state.topicStats).reduce((s, t) => s + t.attempted, 0);
  const totalCorrect = Object.values(state.topicStats).reduce((s, t) => s + t.correct, 0);
  const mastery = totalAttempted > 0 ? Math.round((totalCorrect / totalAttempted) * 100) : 0;

  // Non-blocking SQLite mirror
  fetch(getApiUrl('/api/adaptive-learning/records'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: `kids-math-analytics-${email}`,
      userEmail: email,
      subjectId: 'maths',
      recordType: 'kids_math_analytics',
      title: `Kids Math Weekly Analytics (${state.totalStars} Stars)`,
      payload: state,
      score: state.totalStars,
      masteryPercent: mastery,
    }),
  }).catch(() => {});
}

export async function syncKidsMathAnalyticsFromSqlite(
  userEmail?: string
): Promise<KidsMathAnalyticsState> {
  const local = loadKidsMathAnalytics();
  try {
    const email = (
      userEmail ||
      (typeof window !== 'undefined' ? localStorage.getItem('userEmail') : '') ||
      'chinna.tamil2000@gmail.com'
    )
      .toLowerCase()
      .trim();

    const res = await fetch(
      getApiUrl(
        `/api/adaptive-learning/records?userEmail=${encodeURIComponent(email)}&subjectId=maths`
      )
    );
    if (!res.ok) return local;
    const data = await res.json();
    if (!data.success || !Array.isArray(data.records)) return local;

    const match = data.records.find((r: any) => r.recordType === 'kids_math_analytics');
    if (match && match.payload && typeof match.payload === 'object') {
      const remote = match.payload as KidsMathAnalyticsState;
      const merged: KidsMathAnalyticsState = {
        ...local,
        totalStars: Math.max(local.totalStars, remote.totalStars || 0),
        bestStreak: Math.max(local.bestStreak, remote.bestStreak || 0),
        dailyChallengesCompleted: Math.max(
          local.dailyChallengesCompleted,
          remote.dailyChallengesCompleted || 0
        ),
        dailySolvedToday:
          local.lastPracticeDate === remote.lastPracticeDate
            ? Math.max(local.dailySolvedToday, remote.dailySolvedToday || 0)
            : local.dailySolvedToday,
        topicStats:
          Object.keys(local.topicStats).length >= Object.keys(remote.topicStats || {}).length
            ? local.topicStats
            : remote.topicStats || {},
        mistakeBank:
          local.mistakeBank.length >= (remote.mistakeBank || []).length
            ? local.mistakeBank
            : remote.mistakeBank || [],
        recentSessions:
          local.recentSessions.length >= (remote.recentSessions || []).length
            ? local.recentSessions
            : remote.recentSessions || [],
      };
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(ANALYTICS_STORAGE_KEY, JSON.stringify(merged));
        } catch {}
      }
      return merged;
    }
  } catch {}
  return local;
}

export function recordMathAttemptOutcome(
  prev: KidsMathAnalyticsState,
  params: {
    problem: ArithmeticProblem;
    isCorrect: boolean;
    wrongAnswer?: string;
    solveSeconds?: number;
    starsDelta?: number;
    currentStreak?: number;
  }
): KidsMathAnalyticsState {
  const { problem, isCorrect, wrongAnswer = '', solveSeconds = 8, starsDelta = 0, currentStreak = 0 } = params;
  const topicKey = problem.topicCategory || problem.op || 'mixed';
  const existingTopic = prev.topicStats[topicKey] || {
    topic: topicKey,
    label: MATH_TOPIC_LABELS[topicKey] || topicKey,
    attempted: 0,
    correct: 0,
    totalSeconds: 0,
  };

  const nextTopicStats = {
    ...prev.topicStats,
    [topicKey]: {
      ...existingTopic,
      attempted: existingTopic.attempted + 1,
      correct: existingTopic.correct + (isCorrect ? 1 : 0),
      totalSeconds: existingTopic.totalSeconds + Math.min(180, Math.max(1, Math.round(solveSeconds))),
    },
  };

  let nextMistakes = [...prev.mistakeBank];
  const signature = `${problem.topicCategory || problem.op}:${problem.displayHorizontal}`;

  if (isCorrect) {
    // Resolve matching item in Mistake Bank if present
    nextMistakes = nextMistakes.map((m) =>
      `${m.problem.topicCategory || m.problem.op}:${m.problem.displayHorizontal}` === signature ||
      m.problem.id === problem.id
        ? { ...m, resolved: true, retryCount: m.retryCount + 1 }
        : m
    );
  } else {
    const existingIdx = nextMistakes.findIndex(
      (m) =>
        `${m.problem.topicCategory || m.problem.op}:${m.problem.displayHorizontal}` === signature
    );
    if (existingIdx >= 0) {
      nextMistakes[existingIdx] = {
        ...nextMistakes[existingIdx],
        wrongAnswer,
        missedAt: new Date().toISOString(),
        resolved: false,
      };
    } else {
      const rec: MathMistakeRecord = {
        id: `mk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        problem: { ...problem, status: 'pending', attempts: 0 },
        wrongAnswer,
        missedAt: new Date().toISOString(),
        retryCount: 0,
        resolved: false,
      };
      nextMistakes = [rec, ...nextMistakes].slice(0, 35);
    }
  }

  return {
    ...prev,
    lastPracticeDate: todayKey(),
    totalStars: prev.totalStars + Math.max(0, starsDelta),
    bestStreak: Math.max(prev.bestStreak, currentStreak),
    dailySolvedToday: prev.dailySolvedToday + (isCorrect ? 1 : 0),
    topicStats: nextTopicStats,
    mistakeBank: nextMistakes,
  };
}

export function recordCompletedMathSession(
  prev: KidsMathAnalyticsState,
  session: {
    topic: string;
    tier: ArithmeticTier;
    solved: number;
    total: number;
    starsEarned: number;
    avgSeconds: number;
    isFiveMinChallenge?: boolean;
  }
): KidsMathAnalyticsState {
  const entry = {
    id: `ms-${Date.now()}`,
    ...session,
    completedAt: new Date().toISOString(),
  };
  return {
    ...prev,
    dailyChallengesCompleted:
      prev.dailyChallengesCompleted + (session.isFiveMinChallenge ? 1 : 0),
    recentSessions: [entry, ...prev.recentSessions].slice(0, 20),
  };
}

export function computeKidsMathStickers(state: KidsMathAnalyticsState): MathStickerBadge[] {
  const getCorrect = (k: string) => state.topicStats[k]?.correct || 0;

  const specs: Array<{
    id: string;
    title: string;
    emoji: string;
    description: string;
    progress: number;
    target: number;
    gradient: string;
  }> = [
    {
      id: 'first-stars',
      title: 'Rising Star',
      emoji: '⭐',
      description: 'Earn 30 total stars on the paperless board',
      progress: state.totalStars,
      target: 30,
      gradient: 'from-amber-400 to-orange-500',
    },
    {
      id: 'table-master',
      title: 'Tables Champion',
      emoji: '🔢',
      description: 'Solve 10 Multiplication Tables Quiz questions',
      progress: getCorrect('tables_quiz') + getCorrect('mul'),
      target: 10,
      gradient: 'from-indigo-400 to-purple-600',
    },
    {
      id: 'clock-wizard',
      title: 'Time Wizard',
      emoji: '🕐',
      description: 'Read 5 analog clocks accurately',
      progress: getCorrect('clock'),
      target: 5,
      gradient: 'from-sky-400 to-cyan-600',
    },
    {
      id: 'pizza-chef',
      title: 'Fraction Pizza Chef',
      emoji: '🍕',
      description: 'Master 5 pizza & chocolate bar fractions',
      progress: getCorrect('fractions'),
      target: 5,
      gradient: 'from-rose-400 to-pink-600',
    },
    {
      id: 'rupee-shop',
      title: 'Smart Shopkeeper',
      emoji: '💰',
      description: 'Solve 5 ₹ Rupee shop & change challenges',
      progress: getCorrect('money'),
      target: 5,
      gradient: 'from-emerald-400 to-teal-600',
    },
    {
      id: 'alligator-champ',
      title: 'Alligator & Pattern Pro',
      emoji: '🐊',
      description: 'Conquer 5 compare (< > =) & pattern puzzles',
      progress: getCorrect('compare_pattern'),
      target: 5,
      gradient: 'from-lime-400 to-emerald-600',
    },
    {
      id: 'story-solver',
      title: 'Story Math Hero',
      emoji: '📖',
      description: 'Solve 5 English / Tamil story word problems',
      progress: getCorrect('word_story'),
      target: 5,
      gradient: 'from-fuchsia-400 to-violet-600',
    },
    {
      id: 'five-min-hero',
      title: '5-Min Speed Legend',
      emoji: '⚡',
      description: 'Complete a Daily 5-Minute Star Challenge',
      progress: state.dailyChallengesCompleted,
      target: 1,
      gradient: 'from-yellow-400 to-red-500',
    },
  ];

  return specs.map((s) => ({
    ...s,
    progress: Math.min(s.target, s.progress),
    unlocked: s.progress >= s.target,
  }));
}

export function formatParentWeeklyReportMarkdown(state: KidsMathAnalyticsState): string {
  const stats = Object.values(state.topicStats);
  const totalAttempted = stats.reduce((a, b) => a + b.attempted, 0);
  const totalCorrect = stats.reduce((a, b) => a + b.correct, 0);
  const overallAcc = totalAttempted > 0 ? Math.round((totalCorrect / totalAttempted) * 100) : 0;
  const totalSecs = stats.reduce((a, b) => a + b.totalSeconds, 0);
  const avgSec = totalAttempted > 0 ? Math.round(totalSecs / totalAttempted) : 0;
  const unresolvedMistakes = state.mistakeBank.filter((m) => !m.resolved);
  const unlockedStickers = computeKidsMathStickers(state).filter((s) => s.unlocked);

  const lines: string[] = [
    '# Kids Math Practice — Parent Weekly Progress Report (Ages 6–10)',
    `**Generated:** ${new Date().toLocaleString()}`,
    '',
    '## Summary Metrics',
    `- **Total Stars Earned:** ${state.totalStars} ⭐`,
    `- **Overall Accuracy:** ${overallAcc}% (${totalCorrect}/${totalAttempted} solved)`,
    `- **Average Solving Time:** ${avgSec} seconds per question`,
    `- **Best Winning Streak:** ${state.bestStreak}`,
    `- **Daily 5-Minute Challenges Completed:** ${state.dailyChallengesCompleted}`,
    `- **Stickers Unlocked:** ${unlockedStickers.length}/8 (${unlockedStickers.map((s) => s.title).join(', ') || 'Keep practicing!'})`,
    '',
    '## Accuracy Breakdown by Topic',
    '| Topic | Attempted | Correct | Accuracy | Avg Time |',
    '|---|---:|---:|---:|---:|',
  ];

  if (stats.length === 0) {
    lines.push('| No attempts recorded yet | 0 | 0 | 0% | 0s |');
  } else {
    stats.forEach((st) => {
      const acc = st.attempted > 0 ? Math.round((st.correct / st.attempted) * 100) : 0;
      const avg = st.attempted > 0 ? Math.round(st.totalSeconds / st.attempted) : 0;
      lines.push(`| ${st.label} | ${st.attempted} | ${st.correct} | ${acc}% | ${avg}s |`);
    });
  }

  lines.push('', '## Active Mistake Bank (Needs Gentle Practice)');
  if (unresolvedMistakes.length === 0) {
    lines.push('- Zero pending mistakes! Fantastic mastery!');
  } else {
    unresolvedMistakes.slice(0, 12).forEach((m, idx) => {
      lines.push(
        `${idx + 1}. **${m.problem.displayHorizontal}** — Expected: \`${m.problem.expectedText || m.problem.correctAnswer}\` (Child wrote: \`${m.wrongAnswer || '—'}\`)`
      );
    });
  }

  return lines.join('\n');
}

export async function exportParentMathReportToDrive(
  state: KidsMathAnalyticsState,
  accessToken?: string | null,
  userEmail?: string
): Promise<{ ok: boolean; webViewLink?: string; message: string }> {
  const token = getEffectiveGoogleToken(accessToken);
  const md = formatParentWeeklyReportMarkdown(state);

  if (!token) {
    return {
      ok: false,
      message: 'Report saved to SQLite! Sign in with Google to also export to Google Drive.',
    };
  }

  try {
    const res = await syncAnyAiOutputToDrive(
      `Kids_Math_Weekly_Report_${todayKey()}`,
      md,
      token,
      {
        folderName: 'Kids Math Reports',
        category: 'kids-math-report',
        userEmail,
        promptContext: 'Parent Weekly Progress Report (Ages 6-10)',
      }
    );
    if (res) {
      return {
        ok: true,
        webViewLink: res.driveWebViewLink,
        message: 'Weekly Parent Report exported to Google Drive (Family Circle / Kids Math Reports)!',
      };
    }
    return { ok: false, message: 'Could not upload to Google Drive right now.' };
  } catch (err: any) {
    return {
      ok: false,
      message: err?.message || 'Google Drive upload encountered an error.',
    };
  }
}

// ============================================================================
// AI KID-FRIENDLY STORY WORD PROBLEMS (ENGLISH & TAMIL, AGES 6–10)
// ============================================================================

const CURATED_STORY_TEMPLATES: Record<
  ArithmeticTier,
  Array<{
    op: 'add' | 'sub' | 'mul' | 'div';
    symbol: '+' | '−' | '×' | '÷';
    a: number;
    b: number;
    ans: number;
    en: string;
    ta: string;
    hint: string[];
  }>
> = {
  starter: [
    {
      op: 'add',
      symbol: '+',
      a: 7,
      b: 5,
      ans: 12,
      en: 'Aarav picked 7 sweet mangoes from the garden and his sister gave him 5 more. How many mangoes does Aarav have now?',
      ta: 'ஆரவ் தோட்டத்தில் 7 மாம்பழங்கள் பறித்தான். அவன் தங்கை மேலும் 5 மாம்பழங்கள் கொடுத்தாள். இப்போது ஆரவிடம் மொத்தம் எத்தனை மாம்பழங்கள் உள்ளன?',
      hint: ['Count on 5 steps from 7.', '7 + 5 = 12 mangoes!'],
    },
    {
      op: 'sub',
      symbol: '−',
      a: 14,
      b: 6,
      ans: 8,
      en: 'There were 14 colorful balloons at a birthday party. 6 balloons popped! How many balloons are still floating?',
      ta: 'பிறந்தநாள் விழாவில் 14 வண்ண பலூன்கள் இருந்தன. அவற்றில் 6 பலூன்கள் வெடித்துவிட்டன! மீதம் எத்தனை பலூன்கள் உள்ளன?',
      hint: ['Start at 14 and take away 6.', '14 − 6 = 8 balloons left!'],
    },
    {
      op: 'add',
      symbol: '+',
      a: 9,
      b: 8,
      ans: 17,
      en: 'A space rocket carried 9 glowing stars in the front cabin and 8 stars in the back. How many stars in total?',
      ta: 'ஒரு விண்கலத்தில் முன்பக்கம் 9 நட்சத்திரங்களும் பின்பக்கம் 8 நட்சத்திரங்களும் இருந்தன. மொத்தம் எத்தனை நட்சத்திரங்கள்?',
      hint: ['Make 10 first: 9 + 1 = 10, then add 7.', '9 + 8 = 17!'],
    },
    {
      op: 'sub',
      symbol: '−',
      a: 15,
      b: 7,
      ans: 8,
      en: 'Meera had 15 crayons in her box. She lent 7 crayons to her friend. How many crayons are left in her box?',
      ta: 'மீராவின் பெட்டியில் 15 வண்ணப் பென்சில்கள் இருந்தன. அவள் 7 பென்சில்களை நண்பனுக்குக் கொடுத்தாள். மீதம் எத்தனை உள்ளன?',
      hint: ['Subtract 7 from 15: 15 − 5 = 10, then 10 − 2 = 8.'],
    },
  ],
  builder: [
    {
      op: 'mul',
      symbol: '×',
      a: 6,
      b: 4,
      ans: 24,
      en: 'In a cricket tournament, 6 teams each brought 4 spare cricket balls. How many cricket balls are there altogether?',
      ta: 'ஒரு கிரிக்கெட் போட்டியில் 6 அணிகள் ஒவ்வொன்றும் 4 பந்துகளைக் கொண்டு வந்தன. மொத்தம் எத்தனை கிரிக்கெட் பந்துகள் உள்ளன?',
      hint: ['Multiply 6 groups of 4: 4 + 4 + 4 + 4 + 4 + 4.', '6 × 4 = 24!'],
    },
    {
      op: 'div',
      symbol: '÷',
      a: 32,
      b: 4,
      ans: 8,
      en: 'Grandma baked 32 laddoos and packed them equally into 4 gift boxes. How many laddoos are inside each box?',
      ta: 'பாட்டி 32 லட்டுகள் செய்து 4 பெட்டிகளில் சமமாகப் பிரித்து வைத்தார். ஒவ்வொரு பெட்டியிலும் எத்தனை லட்டுகள் இருக்கும்?',
      hint: ['Ask: 4 times what number equals 32?', '4 × 8 = 32, so 8 laddoos!'],
    },
    {
      op: 'add',
      symbol: '+',
      a: 46,
      b: 28,
      ans: 74,
      en: 'A train traveled 46 km before lunch and 28 km after lunch. How many kilometers did the train travel in total?',
      ta: 'ஒரு ரயில் மதிய உணவுக்கு முன் 46 கி.மீ. தூரமும், பின்பு 28 கி.மீ. தூரமும் சென்றது. மொத்தம் எத்தனை கி.மீ. சென்றது?',
      hint: ['Add Ones: 6 + 8 = 14 (write 4, carry 1).', 'Add Tens: 4 + 2 + 1 = 7 -> 74!'],
    },
    {
      op: 'sub',
      symbol: '−',
      a: 63,
      b: 27,
      ans: 36,
      en: 'The school library shelf held 63 storybooks. Students borrowed 27 books this morning. How many books remain on the shelf?',
      ta: 'பள்ளி நூலக அலமாரியில் 63 கதைப் புத்தகங்கள் இருந்தன. மாணவர்கள் 27 புத்தகங்களை எடுத்துச் சென்றனர். மீதம் எத்தனை உள்ளன?',
      hint: ['Borrow 1 ten from 6 -> 13 − 7 = 6.', '5 − 2 = 3 -> 36 books!'],
    },
  ],
  champion: [
    {
      op: 'mul',
      symbol: '×',
      a: 12,
      b: 8,
      ans: 96,
      en: 'A science museum has 12 display tables with 8 dinosaur models on every table. How many dinosaur models are on display?',
      ta: 'அறிவியல் அருங்காட்சியகத்தில் 12 மேசைகள் உள்ளன. ஒவ்வொரு மேசையிலும் 8 டைனோசர் மாதிரிகள் இருந்தால், மொத்தம் எத்தனை?',
      hint: ['Break 12 into 10 + 2: (10 × 8) + (2 × 8).', '80 + 16 = 96!'],
    },
    {
      op: 'div',
      symbol: '÷',
      a: 72,
      b: 9,
      ans: 8,
      en: '72 students went on a nature picnic and sat equally in 9 mini-vans. How many students rode in each van?',
      ta: '72 மாணவர்கள் சுற்றுலா சென்றனர். அவர்கள் 9 சிற்றுந்துகளில் சமமாக அமர்ந்தால், ஒரு வண்டியில் எத்தனை மாணவர்கள்?',
      hint: ['Recall Table of 9: 9 × 8 = 72!'],
    },
    {
      op: 'add',
      symbol: '+',
      a: 148,
      b: 85,
      ans: 233,
      en: 'During a reading week, Grade 4 read 148 pages on Monday and 85 pages on Tuesday. How many pages did they read altogether?',
      ta: 'வாசிப்பு வாரத்தில் 4-ஆம் வகுப்பு மாணவர்கள் திங்கள் 148 பக்கங்களும் செவ்வாய் 85 பக்கங்களும் படித்தனர். மொத்தம் எத்தனை பக்கங்கள்?',
      hint: ['Ones: 8 + 5 = 13 (carry 1).', 'Tens: 4 + 8 + 1 = 13 (carry 1). Hundreds: 1 + 1 = 2 -> 233!'],
    },
    {
      op: 'sub',
      symbol: '−',
      a: 150,
      b: 64,
      ans: 86,
      en: 'An orchard harvested 150 coconuts. 64 coconuts were delivered to the morning market. How many coconuts remain?',
      ta: 'ஒரு தோப்பில் 150 தேங்காய்கள் பறிக்கப்பட்டன. காலை சந்தைக்கு 64 தேங்காய்கள் அனுப்பப்பட்டன. மீதம் எத்தனை தேங்காய்கள் உள்ளன?',
      hint: ['150 − 60 = 90, then 90 − 4 = 86!'],
    },
  ],
};

export async function generateAiStoryWordProblem(
  tier: ArithmeticTier,
  language = 'en-IN'
): Promise<ArithmeticProblem> {
  const ageDesc =
    tier === 'starter'
      ? 'age 6 to 7 (simple addition or subtraction up to 20)'
      : tier === 'builder'
      ? 'age 7 to 9 (2-digit addition/subtraction or times tables 2-9)'
      : 'age 9 to 10 (3-digit addition/subtraction or multiplication/division up to 12x9)';

  try {
    const provider = getActiveAiProvider();
    const model = getActiveAiModel(provider);
    const prompt = `Create ONE fun, cheerful kid-friendly math story word problem for ${ageDesc}.
Themes: mangoes, cricket, space rockets, family trips, puppies, or balloons.
Return STRICT JSON only:
{
  "op": "add" | "sub" | "mul" | "div",
  "operandA": 12,
  "operandB": 5,
  "correctAnswer": 17,
  "storyEn": "Short clear 2-sentence story ending with a question.",
  "storyTa": "Natural kid-friendly Tamil translation of the exact same story.",
  "hint1": "Helpful step 1",
  "hint2": "Helpful step 2"
}`;

    const res = await sendMultiTurnChat(
      [{ role: 'user', text: prompt }],
      {
        provider,
        model,
        jsonMode: true,
        customSystemInstruction:
          'You are a joyful elementary school math storyteller for ages 6-10. Always verify your arithmetic is 100% exact and return valid JSON only.',
      }
    );

    if (res?.reply) {
      let cleaned = res.reply
        .trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim();
      const sIdx = cleaned.indexOf('{');
      const eIdx = cleaned.lastIndexOf('}');
      if (sIdx !== -1 && eIdx > sIdx) cleaned = cleaned.slice(sIdx, eIdx + 1);
      const parsed = JSON.parse(cleaned);
      const op: 'add' | 'sub' | 'mul' | 'div' = ['add', 'sub', 'mul', 'div'].includes(parsed.op)
        ? parsed.op
        : 'add';
      const a = Number(parsed.operandA);
      const b = Number(parsed.operandB);
      const exactAns =
        op === 'add' ? a + b : op === 'sub' ? a - b : op === 'mul' ? a * b : b !== 0 ? Math.round(a / b) : a;

      if (Number.isFinite(a) && Number.isFinite(b) && Number.isFinite(exactAns) && parsed.storyEn) {
        const symMap = { add: '+', sub: '−', mul: '×', div: '÷' } as const;
        return {
          id: `story-ai-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          op,
          symbol: symMap[op],
          operandA: a,
          operandB: b,
          correctAnswer: exactAns,
          answerKind: 'number',
          expectedText: String(exactAns),
          topicCategory: 'word_story',
          tier,
          displayHorizontal: `${a} ${symMap[op]} ${b} = ?`,
          storyText: String(parsed.storyEn),
          storyTamil: parsed.storyTa ? String(parsed.storyTa) : undefined,
          hintSteps: [
            String(parsed.hint1 || `Find the two numbers in the story: ${a} and ${b}.`),
            String(parsed.hint2 || `Compute ${a} ${symMap[op]} ${b} neatly!`),
          ],
          visualHintKind: 'story_visual',
          status: 'pending',
          attempts: 0,
        };
      }
    }
  } catch {}

  // Curated bilingual fallback
  const pool = CURATED_STORY_TEMPLATES[tier] || CURATED_STORY_TEMPLATES.starter;
  const pick = pool[Math.floor(Math.random() * pool.length)];
  void language;
  return {
    id: `story-curated-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    op: pick.op,
    symbol: pick.symbol,
    operandA: pick.a,
    operandB: pick.b,
    correctAnswer: pick.ans,
    answerKind: 'number',
    expectedText: String(pick.ans),
    topicCategory: 'word_story',
    tier,
    displayHorizontal: `${pick.a} ${pick.symbol} ${pick.b} = ?`,
    storyText: pick.en,
    storyTamil: pick.ta,
    hintSteps: pick.hint,
    visualHintKind: 'story_visual',
    status: 'pending',
    attempts: 0,
  };
}
