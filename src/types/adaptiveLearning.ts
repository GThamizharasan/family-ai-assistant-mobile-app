// Types & Data Contracts for the AI Adaptive Learning Engine ("Rewiring the Classroom's Nervous System")

export type SubjectId =
  | 'english'
  | 'tamil'
  | 'maths'
  | 'physics'
  | 'chemistry'
  | 'botany'
  | 'zoology'
  | 'python'
  | 'custom';

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
  | 'story_arc'
  | 'python_flowchart'
  | 'custom_mindmap';

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
    | 'Dna'
    | 'Terminal'
    | 'Sparkles';
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

export type BoardTheme = 'whiteboard' | 'blackboard';

export type WhiteboardPrimitive =
  | {
      type: 'coordinate_graph';
      title?: string;
      xMin: number;
      xMax: number;
      yMin: number;
      yMax: number;
      xLabel?: string;
      yLabel?: string;
      curves?: Array<{ expression: string; label?: string; color?: string; dashed?: boolean }>;
      slopeSegment?: {
        x1: number;
        y1: number;
        x2: number;
        y2: number;
        label?: string;
        showTriangle?: boolean;
      };
      tangentAtX?: { expression: string; x0: number; label?: string };
      points?: Array<{ x: number; y: number; label?: string; color?: string }>;
      vectors?: Array<{ x1: number; y1: number; x2: number; y2: number; label?: string; color?: string }>;
    }
  | {
      type: 'circle';
      cx: number;
      cy: number;
      r: number;
      label?: string;
      radiusLabel?: string;
      showCenter?: boolean;
      showDiameter?: boolean;
      fill?: string;
      stroke?: string;
      dashed?: boolean;
    }
  | {
      type: 'ellipse';
      cx: number;
      cy: number;
      rx: number;
      ry: number;
      rotationDeg?: number;
      label?: string;
      fill?: string;
      stroke?: string;
      dashed?: boolean;
    }
  | {
      type: 'rect';
      x: number;
      y: number;
      width: number;
      height: number;
      label?: string;
      widthLabel?: string;
      heightLabel?: string;
      showDiagonal?: boolean;
      fill?: string;
      stroke?: string;
      rounded?: number;
    }
  | {
      type: 'polygon';
      points: Array<{ x: number; y: number; vertexLabel?: string }>;
      edgeLabels?: string[];
      rightAngleAtVertex?: number;
      angleLabels?: Array<{ vertexIndex: number; text: string }>;
      label?: string;
      fill?: string;
      stroke?: string;
    }
  | {
      type: 'line';
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      label?: string;
      stroke?: string;
      dashed?: boolean;
      arrowEnd?: boolean;
      arrowStart?: boolean;
      lineWidth?: number;
    }
  | {
      type: 'curve_path';
      points: Array<{ x: number; y: number }>;
      closed?: boolean;
      smooth?: boolean;
      stroke?: string;
      fill?: string;
      dashed?: boolean;
      lineWidth?: number;
      label?: string;
    }
  | {
      type: 'bar_chart';
      title?: string;
      bars: Array<{ label: string; value: number; color?: string }>;
      yLabel?: string;
    }
  | {
      type: 'text';
      x: number;
      y: number;
      text: string;
      fontSize?: number;
      bold?: boolean;
      color?: string;
      align?: 'left' | 'center' | 'right';
      boxed?: boolean;
    };

export type InteractiveControlConfig =
  | { kind: 'circle'; radius: number; unit: string }
  | { kind: 'rectangle'; length: number; width: number; unit: string }
  | { kind: 'square'; side: number; unit: string }
  | {
      kind: 'triangle';
      base: number;
      height: number;
      triangleType: 'right' | 'equilateral' | 'isosceles';
      unit: string;
    }
  | { kind: 'linear_graph'; slope: number; intercept: number }
  | { kind: 'curve_graph'; expression: string; tangentX: number };

export interface WhiteboardVisualScene {
  title: string;
  subtitle?: string;
  formulaBox?: string;
  steps: string[];
  primitives: WhiteboardPrimitive[];
  spokenSummary: string;
  interactiveControl?: InteractiveControlConfig;
  modelUsed?: string;
  visualSource?: 'sqlite' | 'google_drive' | 'parametric' | 'ai_model' | 'offline_map';
}

export interface InkStroke {
  points: Array<{ x: number; y: number }>;
  color: string;
  size: number;
  isEraser: boolean;
}

export interface InkBoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

export type InkDetectedCategory =
  | 'equation_solve'
  | 'text_characters'
  | 'geometry_diagram'
  | 'graph_plot'
  | 'science_diagram'
  | 'straight_line'
  | 'mixed_scene';

export interface InkRecognitionResult {
  detectedCategory: InkDetectedCategory;
  recognizedText: string;
  detectedPurpose: string;
  solvedAnswer?: string;
  boundingBox: InkBoundingBox;
  visualQuery?: string;
  inlineLine?: { x1: number; y1: number; x2: number; y2: number; angleDeg: number };
  scene?: WhiteboardVisualScene;
  confidence: number;
  spokenFeedback: string;
  modelUsed: string;
}

export type ArithmeticOp = 'add' | 'sub' | 'mul' | 'div';
export type ArithmeticFilter = ArithmeticOp | 'mixed';
export type ArithmeticTier = 'starter' | 'builder' | 'champion';
export type ArithmeticLayout = 'column' | 'horizontal';

export interface ArithmeticProblem {
  id: string;
  op: ArithmeticOp;
  symbol: '+' | '−' | '×' | '÷';
  operandA: number;
  operandB: number;
  correctAnswer: number;
  tier: ArithmeticTier;
  displayHorizontal: string;
  hintSteps: string[];
  visualHintKind: 'dots_add' | 'dots_sub' | 'array_mul' | 'groups_div' | 'place_value';
  status: 'pending' | 'correct' | 'tried';
  attempts: number;
  studentAnswer?: number;
}

export interface MathAnswerCheckResult {
  recognizedNumber: number | null;
  rawRecognizedText: string;
  isCorrect: boolean;
  expectedAnswer: number;
  feedbackMessage: string;
  spokenFeedback: string;
  confidence: number;
  usedOfflineFallback: boolean;
  modelUsed: string;
}

export interface SavedVisualTopicRecord {
  id: string;
  query: string;
  title: string;
  subjectId: SubjectId;
  scene: WhiteboardVisualScene;
  source: 'sqlite' | 'google_drive' | 'local';
  driveFileId?: string;
  driveWebViewLink?: string;
  savedAt: string;
  updatedAt: string;
}

export interface CustomSubjectConfig {
  name: string;
  nativeName: string;
  shortTag: string;
  tagline: string;
  accentHex: string;
  secondaryHex: string;
  defaultLanguage: 'en-US' | 'ta-IN';
  topics: string[];
  updatedAt: string;
}



