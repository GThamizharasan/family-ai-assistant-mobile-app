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

export type TutorStudioView = 'live' | 'roadmap' | 'lesson' | 'vault';

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
  recordType: 'course_lesson' | 'live_session' | 'progress_snapshot';
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
}

