// Types & Data Contracts for the AI Adaptive Learning Engine ("Rewiring the Classroom's Nervous System")

export type SubjectId =
  | 'english'
  | 'tamil'
  | 'maths'
  | 'physics'
  | 'chemistry'
  | 'botany'
  | 'zoology';

export type PillarTab = 'adaptive' | 'blackboard' | 'grader' | 'engagement';

export type DifficultyLevel = 'foundation' | 'core' | 'honors' | 'olympiad';

export type LearningStyle = 'visual' | 'socratic' | 'hands_on' | 'exam_prep';

export type DiagramStampType =
  | 'parabola'
  | 'sine_wave'
  | 'ray_optics'
  | 'free_body'
  | 'bohr_atom'
  | 'benzene_ring'
  | 'plant_cell'
  | 'photosynthesis'
  | 'neuron_synapse'
  | 'heart_chambers'
  | 'thirukkural_frame'
  | 'story_arc';

export interface ConceptNode {
  id: string;
  title: string;
  nativeTitle?: string;
  x: number; // 0-100 SVG coordinate
  y: number; // 0-58 SVG coordinate
  prerequisites: string[];
  mastery: number; // 0-100 default initial mastery
  difficulty: DifficultyLevel;
  summary: string;
  keyFormulaOrQuote: string;
  diagramStamp: DiagramStampType;
  estimatedMins: number;
}

export interface AdaptiveQuestion {
  id: string;
  subjectId: SubjectId;
  conceptId: string;
  difficulty: DifficultyLevel;
  prompt: string;
  nativePrompt?: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  hint: string;
  rubricKeywords: string[];
}

export interface GradingPromptPreset {
  id: string;
  title: string;
  prompt: string;
  rubricKeywords: string[];
  sampleIdealAnswer: string;
}

export interface SubjectDefinition {
  id: SubjectId;
  name: string;
  nativeName: string;
  shortTag: string;
  tagline: string;
  accentHex: string;
  secondaryHex: string;
  gradientClass: string;
  borderClass: string;
  badgeClass: string;
  iconName:
    | 'BookOpen'
    | 'Languages'
    | 'Calculator'
    | 'Atom'
    | 'FlaskConical'
    | 'Leaf'
    | 'Dna';
  defaultLanguage: 'en-US' | 'ta-IN';
  concepts: ConceptNode[];
  questions: AdaptiveQuestion[];
  gradingPrompts: GradingPromptPreset[];
  defaultDiagrams: Array<{
    type: DiagramStampType;
    label: string;
    emoji: string;
  }>;
}

export interface RubricDimension {
  name: string;
  score: number;
  maxScore: number;
  feedback: string;
}

export interface GradingResult {
  id: string;
  subjectId: SubjectId;
  questionPrompt: string;
  studentAnswer: string;
  inputMode: 'written' | 'voice' | 'blackboard';
  overallScore: number; // 0-100
  letterGrade: string;
  rubric: RubricDimension[];
  strengths: string[];
  misconceptions: string[];
  modelAnswer: string;
  adaptiveRecommendation: string;
  modelUsed?: string;
  gradedAt: string;
}

export interface StudentEngagementPod {
  id: string;
  name: string;
  avatar: string;
  role: 'You (Lead)' | 'Peer';
  focusScore: number;
  status: 'deep_flow' | 'engaged' | 'needs_nudge' | 'fatigued';
  currentConcept: string;
  responseSpeedSec: number;
  lastNudge?: string;
}

export interface EngagementWavePoint {
  timeLabel: string;
  focus: number;
  cognitiveFlow: number;
  voiceActivity: number;
}

export interface SynapticAlert {
  id: string;
  severity: 'insight' | 'nudge' | 'breakthrough';
  title: string;
  message: string;
  subjectId: SubjectId;
  targetPillar: PillarTab;
  targetConceptId?: string;
  actionLabel: string;
  timestamp: string;
}

export interface BlackboardSnapshot {
  dataUrl: string;
  transcriptNotes: string;
  subjectId: SubjectId;
  createdAt: string;
}

