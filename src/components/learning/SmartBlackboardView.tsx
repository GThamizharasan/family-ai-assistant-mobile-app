import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';
import {
  Mic,
  MicOff,
  Eraser,
  Trash2,
  Undo2,
  Redo2,
  Download,
  Sparkles,
  Volume2,
  ClipboardCheck,
  CloudUpload,
  Grid,
  Loader2,
  Send,
  Zap,
  Wand2,
  Sun,
  Moon,
  Sliders,
  Brain,
  X,
  CheckCircle2,
  Lightbulb,
  Eye,
  ArrowRight,
  Shuffle,
  Star,
  Flame,
  Trophy,
} from 'lucide-react';
import {
  ArithmeticFilter,
  ArithmeticLayout,
  ArithmeticProblem,
  ArithmeticTier,
  BlackboardSnapshot,
  BoardTheme,
  ConceptNode,
  InkRecognitionResult,
  InkStroke,
  InteractiveControlConfig,
  MathAnswerCheckResult,
  SubjectDefinition,
  SubjectId,
  WhiteboardVisualScene,
} from '../../types/adaptiveLearning';
import { generateTopicVisualScene } from '../../services/adaptiveLearningService';
import { recognizeAndTranslateFreehandInk } from '../../services/inkRecognitionEngine';
import {
  buildTableRecitationText,
  checkHandwrittenMathAnswer,
  generateWorksheetBatch,
  isStrokeInAnswerBox,
  isStrokeInRoughWork,
  paintMathPracticeWorksheet,
  paintMultiplicationTablesChart,
  repaintPracticeZoneOnly,
} from '../../services/mathPracticeEngine';
import {
  buildCircleScene,
  buildCurveGraphScene,
  buildLinearSlopeGraphScene,
  buildRectangleScene,
  buildSceneForDiagramStamp,
  buildSquareScene,
  buildTriangleScene,
  paintBoardSurface,
  renderWhiteboardSceneToCanvas,
} from '../../services/whiteboardVisualEngine';
import { speechEngine } from '../../services/speech';

interface SmartBlackboardViewProps {
  subject: SubjectDefinition;
  activeConcept: ConceptNode;
  onBlackboardActivity: (type: 'draw' | 'voice' | 'ai_solve', summary: string) => void;
  onExportToGrader: (snapshot: BlackboardSnapshot) => void;
  onSyncToDrive: (title: string, content: string) => void;
  initialMode?: 'free' | 'math_practice';
  modeNonce?: number;
}

type BoardBgStyle = 'grid' | 'plain' | 'lined' | 'dots';

const BOARD_WIDTH = 1200;
const BOARD_HEIGHT = 680;

const WHITEBOARD_INKS = [
  { name: 'Jet Marker', hex: '#0f172a' },
  { name: 'Royal Blue', hex: '#2563eb' },
  { name: 'Crimson Red', hex: '#dc2626' },
  { name: 'Emerald Green', hex: '#059669' },
  { name: 'Violet Marker', hex: '#7c3aed' },
  { name: 'Amber Marker', hex: '#d97706' },
];

const BLACKBOARD_CHALKS = [
  { name: 'Chalk White', hex: '#f8fafc' },
  { name: 'Neon Cyan', hex: '#22d3ee' },
  { name: 'Saffron Amber', hex: '#fbbf24' },
  { name: 'Plasma Magenta', hex: '#f472b6' },
  { name: 'Chlorophyll Green', hex: '#34d399' },
  { name: 'Electric Violet', hex: '#c084fc' },
];

const SUBJECT_ADVANCED_CHIPS: Record<
  SubjectId,
  Array<{ label: string; emoji: string; query: string }>
> = {
  maths: [
    { label: 'Parabola y=x²-4', emoji: '📐', query: 'graph y = x^2 - 4' },
    { label: 'Sine Wave', emoji: '〰️', query: 'plot sin(x)' },
  ],
  physics: [
    { label: 'Projectile Arc', emoji: '🚀', query: 'projectile motion trajectory' },
    { label: 'Ohm’s Circuit', emoji: '⚡', query: 'electric circuit ohms law' },
    { label: 'Lens Optics', emoji: '🔍', query: 'convex lens ray optics' },
  ],
  chemistry: [
    { label: 'Bohr Atom', emoji: '⚛️', query: 'bohr atom orbitals' },
    { label: 'pH Titration', emoji: '🧪', query: 'titration pH curve' },
    { label: 'Benzene Ring', emoji: '⬡', query: 'benzene aromatic ring' },
  ],
  botany: [
    { label: 'Punnett Square', emoji: '🧬', query: 'punnett square Tt x Tt' },
    { label: 'Plant Cell', emoji: '🌿', query: 'plant cell chloroplast' },
    { label: 'Photosynthesis', emoji: '☀️', query: 'photosynthesis flow' },
  ],
  zoology: [
    { label: 'DNA Helix', emoji: '🧬', query: 'dna double helix' },
    { label: 'Action Potential', emoji: '⚡', query: 'action potential -70 mv' },
    { label: 'Heart Chambers', emoji: '🫀', query: '4 chamber heart circulation' },
  ],
  tamil: [
    { label: 'திருக்குறள்', emoji: '📜', query: 'thirukkural frame' },
    { label: 'கதை வளைவு', emoji: '🎭', query: 'story arc climax' },
  ],
  english: [
    { label: 'Story Arc', emoji: '📈', query: 'story arc pyramid' },
    { label: 'Triangle Logic', emoji: '🔺', query: 'equilateral triangle' },
  ],
};

export const SmartBlackboardView: React.FC<SmartBlackboardViewProps> = ({
  subject,
  activeConcept,
  onBlackboardActivity,
  onExportToGrader,
  onSyncToDrive,
  initialMode,
  modeNonce,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const lastPtRef = useRef<{ x: number; y: number } | null>(null);
  const cancelAnimRef = useRef<(() => void) | null>(null);

  // Whiteboard vs Blackboard Theme + Drawing State
  const [boardMode, setBoardMode] = useState<'free' | 'math_practice'>(
    initialMode || 'free'
  );
  const [boardTheme, setBoardTheme] = useState<BoardTheme>('whiteboard');
  const [inkColor, setInkColor] = useState<string>('#2563eb');
  const [brushSize, setBrushSize] = useState<number>(4);
  const [isEraser, setIsEraser] = useState<boolean>(false);
  const [neonGlow, setNeonGlow] = useState<boolean>(false);
  const [bgStyle, setBgStyle] = useState<BoardBgStyle>('grid');

  // Undo / Redo ImageData Stack (+ mirrored practice strokes stack)
  const historyRef = useRef<ImageData[]>([]);
  const practiceStrokeHistoryRef = useRef<InkStroke[][]>([]);
  const historyIdxRef = useRef<number>(-1);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Paperless Math Practice State & Refs (+ − × ÷)
  const [practiceSubView, setPracticeSubView] = useState<'problems' | 'tables'>('problems');
  const [highlightedTable, setHighlightedTable] = useState<number | null>(null);
  const [hideTableAnswers, setHideTableAnswers] = useState<boolean>(false);
  const [practiceFilter, setPracticeFilter] = useState<ArithmeticFilter>('mixed');
  const [practiceTier, setPracticeTier] = useState<ArithmeticTier>('starter');
  const [practiceLayout, setPracticeLayout] = useState<ArithmeticLayout>('horizontal');
  const [worksheet, setWorksheet] = useState<ArithmeticProblem[]>(() =>
    generateWorksheetBatch('mixed', 'starter', 10)
  );
  const [currentIdx, setCurrentIdx] = useState<number>(0);
  const [showPracticeHint, setShowPracticeHint] = useState<boolean>(false);
  const [autoCheckPractice, setAutoCheckPractice] = useState<boolean>(false);
  const [isCheckingAnswer, setIsCheckingAnswer] = useState<boolean>(false);
  const [practiceResult, setPracticeResult] = useState<MathAnswerCheckResult | null>(null);
  const [manualCorrectionInput, setManualCorrectionInput] = useState<string>('');
  const [streak, setStreak] = useState<number>(0);
  const [stars, setStars] = useState<number>(0);
  const [showCelebration, setShowCelebration] = useState<boolean>(false);
  const [isAnswerRevealed, setIsAnswerRevealed] = useState<boolean>(false);

  const practiceStrokesRef = useRef<InkStroke[]>([]);
  const autoCheckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const celebrationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentProblem = worksheet[currentIdx] || worksheet[0];

  useEffect(() => {
    if (initialMode) {
      setBoardMode(initialMode);
    }
  }, [initialMode, modeNonce]);

  // Visual Scene & Live Interactive Controls
  const [activeScene, setActiveScene] = useState<WhiteboardVisualScene | null>(null);
  const [interactiveControl, setInteractiveControl] =
    useState<InteractiveControlConfig | null>(null);

  // Real-Time Freehand Smart Ink Translation State & Refs
  const freehandStrokesRef = useRef<InkStroke[]>([]);
  const currentStrokeRef = useRef<InkStroke | null>(null);
  const preInkBoardSnapshotRef = useRef<ImageData | null>(null);
  const autoInkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [smartInkEnabled, setSmartInkEnabled] = useState<boolean>(true);
  const [pendingStrokeCount, setPendingStrokeCount] = useState<number>(0);
  const [isRecognizingInk, setIsRecognizingInk] = useState<boolean>(false);
  const [lastInkResult, setLastInkResult] = useState<InkRecognitionResult | null>(null);

  // Local Independent Speech Recognition State (never mutates global speechEngine callbacks)
  const [isListening, setIsListening] = useState(false);
  const [speechLang, setSpeechLang] = useState<'en-IN' | 'en-US' | 'ta-IN'>(
    subject.defaultLanguage === 'ta-IN' ? 'ta-IN' : 'en-IN'
  );
  const [liveTranscript, setLiveTranscript] = useState('');
  const [chalkNotesLog, setChalkNotesLog] = useState<string[]>([]);
  const [topicQuery, setTopicQuery] = useState('');
  const [isRenderingVisual, setIsRenderingVisual] = useState(false);
  const [speakAiAnswer, setSpeakAiAnswer] = useState(true);
  const [micNotice, setMicNotice] = useState<string | null>(null);

  const webRecognitionRef = useRef<any>(null);
  const nativeActiveRef = useRef(false);
  const textCursorYRef = useRef<number>(92);

  useEffect(() => {
    setSpeechLang(subject.defaultLanguage === 'ta-IN' ? 'ta-IN' : 'en-IN');
  }, [subject]);

  const pushHistory = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const snap = ctx.getImageData(0, 0, BOARD_WIDTH, BOARD_HEIGHT);
    const sliced = historyRef.current.slice(0, historyIdxRef.current + 1);
    sliced.push(snap);

    const strokeCopy = [...practiceStrokesRef.current];
    const slicedStrokes = practiceStrokeHistoryRef.current.slice(0, historyIdxRef.current + 1);
    slicedStrokes.push(strokeCopy);

    if (sliced.length > 20) {
      sliced.shift();
      slicedStrokes.shift();
    }
    historyRef.current = sliced;
    practiceStrokeHistoryRef.current = slicedStrokes;
    historyIdxRef.current = sliced.length - 1;
    setCanUndo(historyIdxRef.current > 0);
    setCanRedo(false);
  }, []);

  // Draw any WhiteboardVisualScene onto the canvas cleanly
  const renderSceneToBoard = useCallback(
    (
      scene: WhiteboardVisualScene,
      opts?: { animate?: boolean; overrideTheme?: BoardTheme; overrideBg?: BoardBgStyle }
    ) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      cancelAnimRef.current?.();
      const targetTheme = opts?.overrideTheme || boardTheme;
      const targetBg = opts?.overrideBg || bgStyle;

      setActiveScene(scene);
      if (scene.interactiveControl !== undefined) {
        setInteractiveControl(scene.interactiveControl);
      } else {
        setInteractiveControl(null);
      }

      cancelAnimRef.current = renderWhiteboardSceneToCanvas(ctx, scene, {
        theme: targetTheme,
        bgStyle: targetBg,
        boardWidth: BOARD_WIDTH,
        boardHeight: BOARD_HEIGHT,
        subjectName: subject.name,
        animate: opts?.animate ?? true,
        onComplete: () => {
          pushHistory();
        },
      });
    },
    [boardTheme, bgStyle, subject.name, pushHistory]
  );

  // Translate pending freehand strokes into clean characters, solved numbers, lines, or diagrams
  const handleTranslateFreehandInk = useCallback(async () => {
    if (autoInkTimerRef.current) {
      clearTimeout(autoInkTimerRef.current);
      autoInkTimerRef.current = null;
    }

    const strokes = [...freehandStrokesRef.current];
    if (strokes.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    setIsRecognizingInk(true);
    try {
      const result = await recognizeAndTranslateFreehandInk(
        strokes,
        subject,
        activeConcept,
        speechLang
      );

      // Ensure raw hand-drawn ink snapshot sits at the top of Undo history so "Keep Raw Sketch" restores it!
      pushHistory();

      // Clear pending ink queue now that strokes are processed
      freehandStrokesRef.current = [];
      setPendingStrokeCount(0);

      if (result.detectedCategory === 'straight_line' && result.inlineLine) {
        if (preInkBoardSnapshotRef.current) {
          ctx.putImageData(preInkBoardSnapshotRef.current, 0, 0);
        }
        const { x1, y1, x2, y2, angleDeg } = result.inlineLine;
        const lineColor = boardTheme === 'whiteboard' ? '#2563eb' : '#22d3ee';
        ctx.save();
        ctx.strokeStyle = lineColor;
        ctx.lineWidth = Math.max(3.5, brushSize);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.fillStyle = lineColor;
        ctx.font = 'bold 14px monospace';
        ctx.fillText(`${angleDeg}°`, (x1 + x2) / 2 + 8, (y1 + y2) / 2 - 10);
        ctx.restore();
        pushHistory();
      } else if (
        (result.detectedCategory === 'geometry_diagram' ||
          result.detectedCategory === 'graph_plot' ||
          result.detectedCategory === 'science_diagram' ||
          result.detectedCategory === 'mixed_scene') &&
        result.scene
      ) {
        renderSceneToBoard(result.scene, { animate: true });
      } else {
        // 'text_characters' or 'equation_solve': replace raw ink with crisp typeset card right at bbox
        if (preInkBoardSnapshotRef.current) {
          ctx.putImageData(preInkBoardSnapshotRef.current, 0, 0);
        }
        const bbox = result.boundingBox;
        const displayStr = result.solvedAnswer
          ? `${result.recognizedText}  ⇒  ${result.solvedAnswer}`
          : result.recognizedText;

        ctx.save();
        const fontSize = Math.min(34, Math.max(22, Math.round(bbox.height * 0.45)));
        ctx.font = `bold ${fontSize}px "Plus Jakarta Sans", sans-serif`;
        const metrics = ctx.measureText(displayStr);
        const pillW = Math.min(BOARD_WIDTH - 48, metrics.width + 32);
        const pillH = fontSize + 24;
        const pillX = Math.max(24, Math.min(BOARD_WIDTH - pillW - 24, bbox.minX));
        const pillY = Math.max(48, Math.min(BOARD_HEIGHT - pillH - 24, bbox.minY));

        ctx.fillStyle =
          boardTheme === 'whiteboard'
            ? 'rgba(255, 255, 255, 0.94)'
            : 'rgba(15, 23, 42, 0.92)';
        ctx.strokeStyle =
          result.solvedAnswer
            ? '#10b981'
            : boardTheme === 'whiteboard'
            ? '#2563eb'
            : '#22d3ee';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.roundRect(pillX, pillY, pillW, pillH, 12);
        ctx.fill();
        ctx.stroke();

        // Draw recognized base text
        const baseText = result.recognizedText;
        const baseMetrics = ctx.measureText(baseText);
        ctx.fillStyle = boardTheme === 'whiteboard' ? '#0f172a' : '#f8fafc';
        ctx.fillText(baseText, pillX + 16, pillY + fontSize + 6);

        // Highlight solved equation answer in emerald
        if (result.solvedAnswer) {
          ctx.fillStyle = boardTheme === 'whiteboard' ? '#059669' : '#34d399';
          ctx.fillText(
            ` = ${result.solvedAnswer}`,
            pillX + 16 + baseMetrics.width,
            pillY + fontSize + 6
          );
        }
        ctx.restore();
        pushHistory();
      }

      preInkBoardSnapshotRef.current = null;
      setLastInkResult(result);
      setChalkNotesLog((prev) => [
        ...prev,
        result.solvedAnswer
          ? `${result.recognizedText} = ${result.solvedAnswer}`
          : result.recognizedText,
      ]);
      onBlackboardActivity('ai_solve', `Smart Ink: ${result.recognizedText.slice(0, 34)}`);

      if (speakAiAnswer && result.spokenFeedback) {
        speechEngine.speak(result.spokenFeedback);
      }
    } finally {
      setIsRecognizingInk(false);
    }
  }, [
    subject,
    activeConcept,
    speechLang,
    boardTheme,
    brushSize,
    pushHistory,
    renderSceneToBoard,
    onBlackboardActivity,
    speakAiAnswer,
  ]);

  // Initialize board and render current concept's visual scene (only in free whiteboard mode)
  useEffect(() => {
    if (boardMode !== 'free') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = BOARD_WIDTH;
    canvas.height = BOARD_HEIGHT;
    const initialScene = buildSceneForDiagramStamp(
      activeConcept.diagramStamp,
      subject,
      activeConcept
    );
    renderSceneToBoard(initialScene, { animate: true });
    return () => {
      cancelAnimRef.current?.();
      if (autoInkTimerRef.current) clearTimeout(autoInkTimerRef.current);
    };
  }, [subject.id, activeConcept.id, boardMode]);

  // Paint Paperless Math Practice Worksheet or Tables 1-10 Chart whenever view/problem/theme changes
  useEffect(() => {
    if (boardMode !== 'math_practice') return;
    cancelAnimRef.current?.();
    if (autoInkTimerRef.current) clearTimeout(autoInkTimerRef.current);
    if (autoCheckTimerRef.current) clearTimeout(autoCheckTimerRef.current);

    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = BOARD_WIDTH;
    canvas.height = BOARD_HEIGHT;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    freehandStrokesRef.current = [];
    preInkBoardSnapshotRef.current = null;
    setPendingStrokeCount(0);
    practiceStrokesRef.current = [];
    setActiveScene(null);
    setInteractiveControl(null);

    if (practiceSubView === 'tables') {
      paintMultiplicationTablesChart(ctx, {
        theme: boardTheme,
        bgStyle,
        boardWidth: BOARD_WIDTH,
        boardHeight: BOARD_HEIGHT,
        highlightedTable,
        hideAnswers: hideTableAnswers,
      });
    } else {
      if (!currentProblem) return;
      setShowPracticeHint(false);
      setPracticeResult(null);
      setIsAnswerRevealed(false);
      setManualCorrectionInput('');

      paintMathPracticeWorksheet(ctx, currentProblem, {
        theme: boardTheme,
        bgStyle,
        boardWidth: BOARD_WIDTH,
        boardHeight: BOARD_HEIGHT,
        questionIndex: currentIdx,
        totalQuestions: worksheet.length,
        layout: practiceLayout,
        showHint: false,
        checkState:
          currentProblem.status === 'correct' && currentProblem.studentAnswer !== undefined
            ? { status: 'correct', recognized: currentProblem.studentAnswer }
            : undefined,
      });
    }

    const initialSnap = ctx.getImageData(0, 0, BOARD_WIDTH, BOARD_HEIGHT);
    historyRef.current = [initialSnap];
    practiceStrokeHistoryRef.current = [[]];
    historyIdxRef.current = 0;
    setCanUndo(false);
    setCanRedo(false);

    return () => {
      if (autoCheckTimerRef.current) clearTimeout(autoCheckTimerRef.current);
      if (celebrationTimerRef.current) clearTimeout(celebrationTimerRef.current);
    };
  }, [
    boardMode,
    practiceSubView,
    highlightedTable,
    hideTableAnswers,
    currentProblem?.id,
    practiceLayout,
    boardTheme,
    bgStyle,
  ]);

  // Paperless Math Practice Helpers
  const handleStartNewWorksheet = useCallback(
    (nextFilter?: ArithmeticFilter, nextTier?: ArithmeticTier) => {
      setPracticeSubView('problems');
      const targetFilter = nextFilter ?? practiceFilter;
      const targetTier = nextTier ?? practiceTier;
      if (nextFilter) setPracticeFilter(targetFilter);
      if (nextTier) {
        setPracticeTier(targetTier);
        setPracticeLayout(targetTier === 'starter' ? 'horizontal' : 'column');
      }
      if (autoCheckTimerRef.current) clearTimeout(autoCheckTimerRef.current);
      const fresh = generateWorksheetBatch(targetFilter, targetTier, 10);
      setWorksheet(fresh);
      setCurrentIdx(0);
      setPracticeResult(null);
      setShowPracticeHint(false);
      setIsAnswerRevealed(false);
      setManualCorrectionInput('');
    },
    [practiceFilter, practiceTier]
  );

  const handleCheckPracticeAnswer = useCallback(
    async (overrideNumber?: number) => {
      if (!currentProblem) return;
      if (autoCheckTimerRef.current) {
        clearTimeout(autoCheckTimerRef.current);
        autoCheckTimerRef.current = null;
      }

      setIsCheckingAnswer(true);
      try {
        let result: MathAnswerCheckResult;
        if (typeof overrideNumber === 'number' && Number.isFinite(overrideNumber)) {
          const isCorrect = overrideNumber === currentProblem.correctAnswer;
          result = {
            recognizedNumber: overrideNumber,
            rawRecognizedText: String(overrideNumber),
            isCorrect,
            expectedAnswer: currentProblem.correctAnswer,
            feedbackMessage: isCorrect
              ? `Awesome! ${currentProblem.operandA} ${currentProblem.symbol} ${currentProblem.operandB} = ${currentProblem.correctAnswer} is spot on! ⭐`
              : `Good try! Checked ${overrideNumber}. Try adjusting or peek at 💡 Step Hint!`,
            spokenFeedback: isCorrect
              ? `Awesome! Equals ${currentProblem.correctAnswer}.`
              : `Good try! ${overrideNumber} is not quite right yet.`,
            confidence: 1,
            usedOfflineFallback: false,
            modelUsed: 'Direct Quick Check',
          };
        } else {
          result = await checkHandwrittenMathAnswer(
            practiceStrokesRef.current,
            currentProblem,
            speechLang
          );
        }

        const wasAlreadyCorrect = currentProblem.status === 'correct';
        const attemptsBefore = currentProblem.attempts;

        setPracticeResult(result);

        if (result.recognizedNumber !== null) {
          setWorksheet((prev) =>
            prev.map((q, idx) =>
              idx !== currentIdx
                ? q
                : {
                    ...q,
                    attempts: q.attempts + 1,
                    status: result.isCorrect
                      ? 'correct'
                      : q.status === 'correct'
                      ? 'correct'
                      : 'tried',
                    studentAnswer: result.recognizedNumber ?? q.studentAnswer,
                  }
            )
          );
        }

        if (result.isCorrect) {
          if (!wasAlreadyCorrect) {
            setStreak((s) => s + 1);
            setStars((st) => st + (attemptsBefore === 0 ? 10 : 5));
            setShowCelebration(true);
            if (celebrationTimerRef.current) clearTimeout(celebrationTimerRef.current);
            celebrationTimerRef.current = setTimeout(() => setShowCelebration(false), 2400);
          }

          const ctx = canvasRef.current?.getContext('2d');
          if (ctx) {
            repaintPracticeZoneOnly(ctx, 'answerBox', currentProblem, {
              theme: boardTheme,
              bgStyle,
              boardWidth: BOARD_WIDTH,
              boardHeight: BOARD_HEIGHT,
              questionIndex: currentIdx,
              totalQuestions: worksheet.length,
              layout: practiceLayout,
              showHint: showPracticeHint,
              checkState: {
                status: 'correct',
                recognized: result.recognizedNumber ?? currentProblem.correctAnswer,
              },
            });
            pushHistory();
          }

          onBlackboardActivity(
            'ai_solve',
            `Solved ${currentProblem.operandA} ${currentProblem.symbol} ${currentProblem.operandB} = ${currentProblem.correctAnswer}`
          );
        } else if (result.recognizedNumber !== null) {
          setStreak(0);
        }

        if (speakAiAnswer && result.spokenFeedback) {
          speechEngine.speak(result.spokenFeedback);
        }
      } finally {
        setIsCheckingAnswer(false);
      }
    },
    [
      currentProblem,
      currentIdx,
      worksheet.length,
      speechLang,
      boardTheme,
      bgStyle,
      practiceLayout,
      showPracticeHint,
      pushHistory,
      onBlackboardActivity,
      speakAiAnswer,
    ]
  );

  const handleClearAnswerBox = useCallback(() => {
    if (!currentProblem) return;
    if (autoCheckTimerRef.current) clearTimeout(autoCheckTimerRef.current);
    practiceStrokesRef.current = practiceStrokesRef.current.filter(
      (s) => !isStrokeInAnswerBox(s)
    );
    setPracticeResult(null);
    setIsAnswerRevealed(false);
    setManualCorrectionInput('');
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      repaintPracticeZoneOnly(ctx, 'answerBox', currentProblem, {
        theme: boardTheme,
        bgStyle,
        boardWidth: BOARD_WIDTH,
        boardHeight: BOARD_HEIGHT,
        questionIndex: currentIdx,
        totalQuestions: worksheet.length,
        layout: practiceLayout,
        showHint: showPracticeHint,
      });
      pushHistory();
    }
  }, [
    currentProblem,
    boardTheme,
    bgStyle,
    currentIdx,
    worksheet.length,
    practiceLayout,
    showPracticeHint,
    pushHistory,
  ]);

  const handleClearRoughWork = useCallback(() => {
    if (!currentProblem) return;
    practiceStrokesRef.current = practiceStrokesRef.current.filter(
      (s) => !isStrokeInRoughWork(s)
    );
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      repaintPracticeZoneOnly(ctx, 'roughWork', currentProblem, {
        theme: boardTheme,
        bgStyle,
        boardWidth: BOARD_WIDTH,
        boardHeight: BOARD_HEIGHT,
        questionIndex: currentIdx,
        totalQuestions: worksheet.length,
        layout: practiceLayout,
        showHint: showPracticeHint,
        checkState: isAnswerRevealed
          ? { status: 'wrong', revealed: true }
          : practiceResult?.isCorrect && practiceResult.recognizedNumber !== null
          ? { status: 'correct', recognized: practiceResult.recognizedNumber }
          : undefined,
      });
      pushHistory();
    }
  }, [
    currentProblem,
    boardTheme,
    bgStyle,
    currentIdx,
    worksheet.length,
    practiceLayout,
    showPracticeHint,
    isAnswerRevealed,
    practiceResult,
    pushHistory,
  ]);

  const handleTogglePracticeHint = useCallback(() => {
    if (!currentProblem) return;
    const nextHint = !showPracticeHint;
    setShowPracticeHint(nextHint);
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      repaintPracticeZoneOnly(ctx, 'roughWork', currentProblem, {
        theme: boardTheme,
        bgStyle,
        boardWidth: BOARD_WIDTH,
        boardHeight: BOARD_HEIGHT,
        questionIndex: currentIdx,
        totalQuestions: worksheet.length,
        layout: practiceLayout,
        showHint: nextHint,
        checkState: isAnswerRevealed
          ? { status: 'wrong', revealed: true }
          : practiceResult?.isCorrect && practiceResult.recognizedNumber !== null
          ? { status: 'correct', recognized: practiceResult.recognizedNumber }
          : undefined,
      });
      pushHistory();
    }
    if (nextHint && speakAiAnswer && currentProblem.hintSteps[0]) {
      speechEngine.speak(currentProblem.hintSteps[0]);
    }
  }, [
    currentProblem,
    showPracticeHint,
    boardTheme,
    bgStyle,
    currentIdx,
    worksheet.length,
    practiceLayout,
    isAnswerRevealed,
    practiceResult,
    pushHistory,
    speakAiAnswer,
  ]);

  const handleRevealPracticeAnswer = useCallback(() => {
    if (!currentProblem) return;
    if (autoCheckTimerRef.current) clearTimeout(autoCheckTimerRef.current);
    setIsAnswerRevealed(true);
    setStreak(0);
    setWorksheet((prev) =>
      prev.map((q, idx) =>
        idx === currentIdx && q.status !== 'correct' ? { ...q, status: 'tried' } : q
      )
    );
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      repaintPracticeZoneOnly(ctx, 'answerBox', currentProblem, {
        theme: boardTheme,
        bgStyle,
        boardWidth: BOARD_WIDTH,
        boardHeight: BOARD_HEIGHT,
        questionIndex: currentIdx,
        totalQuestions: worksheet.length,
        layout: practiceLayout,
        showHint: showPracticeHint,
        checkState: { status: 'wrong', revealed: true },
      });
      pushHistory();
    }
    setPracticeResult({
      recognizedNumber: null,
      rawRecognizedText: '',
      isCorrect: false,
      expectedAnswer: currentProblem.correctAnswer,
      feedbackMessage: `${currentProblem.operandA} ${currentProblem.symbol} ${currentProblem.operandB} = ${currentProblem.correctAnswer}. ${currentProblem.hintSteps[0] || ''}`,
      spokenFeedback: `${currentProblem.operandA} ${currentProblem.symbol} ${currentProblem.operandB} equals ${currentProblem.correctAnswer}.`,
      confidence: 1,
      usedOfflineFallback: false,
      modelUsed: 'Step-by-Step Guide',
    });
    if (speakAiAnswer) {
      speechEngine.speak(
        `${currentProblem.operandA} and ${currentProblem.operandB} equals ${currentProblem.correctAnswer}. ${currentProblem.hintSteps[0] || ''}`
      );
    }
  }, [
    currentProblem,
    currentIdx,
    boardTheme,
    bgStyle,
    worksheet.length,
    practiceLayout,
    showPracticeHint,
    pushHistory,
    speakAiAnswer,
  ]);

  const handleNextPracticeQuestion = useCallback(() => {
    setCurrentIdx((idx) => (idx + 1 < worksheet.length ? idx + 1 : 0));
  }, [worksheet.length]);

  const handleSavePracticeToDrive = useCallback(() => {
    if (practiceSubView === 'tables') {
      const sections: string[] = [];
      for (let t = 1; t <= 10; t++) {
        const rows = Array.from({ length: 10 }, (_, k) => `${t} × ${k + 1} = ${t * (k + 1)}`).join('\n');
        sections.push(`## Table of ${t}\n${rows}`);
      }
      const report = `# Standard Multiplication Tables (1 to 10)\n\n${sections.join('\n\n')}`;
      onSyncToDrive('Standard Multiplication Tables (1 to 10)', report);
      return;
    }

    const solved = worksheet.filter((q) => q.status === 'correct').length;
    const lines = worksheet.map(
      (q, i) =>
        `${i + 1}. ${q.operandA} ${q.symbol} ${q.operandB} = ${q.correctAnswer} | Status: ${q.status.toUpperCase()} | Attempts: ${q.attempts}`
    );
    const report = `# Paperless Math Practice Worksheet Report\n\n- **Filter:** ${practiceFilter.toUpperCase()}\n- **Level:** ${practiceTier.toUpperCase()}\n- **Score:** ${solved}/${worksheet.length}\n- **Stars Earned:** ${stars}\n- **Current Streak:** ${streak}\n\n## Problems\n${lines.join('\n')}`;
    onSyncToDrive(`Math Practice Report (${practiceFilter.toUpperCase()} - ${solved}/${worksheet.length})`, report);
  }, [practiceSubView, worksheet, practiceFilter, practiceTier, stars, streak, onSyncToDrive]);

  // Write freeform dictated text onto left column when user dictates notes directly
  const writeNoteTextToBoard = useCallback(
    (text: string) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const textColor =
        boardTheme === 'whiteboard' ? '#0f172a' : '#f8fafc';
      ctx.save();
      ctx.fillStyle = textColor;
      ctx.font = 'bold 20px "Plus Jakarta Sans", sans-serif';
      const maxWidth = 410;
      const words = text.split(/\s+/);
      let line = '';
      let y = textCursorYRef.current;

      for (let i = 0; i < words.length; i++) {
        const test = line ? `${line} ${words[i]}` : words[i];
        if (ctx.measureText(test).width > maxWidth && line) {
          ctx.fillText(line, 36, y);
          line = words[i];
          y += 28;
        } else {
          line = test;
        }
      }
      if (line) {
        ctx.fillText(line, 36, y);
        y += 32;
      }

      textCursorYRef.current = y > BOARD_HEIGHT - 60 ? 92 : y;
      ctx.restore();
      pushHistory();
    },
    [boardTheme, pushHistory]
  );

  // Pointer Freehand Drawing Handlers (touch-none safe)
  const getCanvasCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    cancelAnimRef.current?.();
    if (autoInkTimerRef.current) {
      clearTimeout(autoInkTimerRef.current);
      autoInkTimerRef.current = null;
    }
    if (autoCheckTimerRef.current) {
      clearTimeout(autoCheckTimerRef.current);
      autoCheckTimerRef.current = null;
    }

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (boardMode === 'free' && ctx && freehandStrokesRef.current.length === 0 && !isEraser) {
      preInkBoardSnapshotRef.current = ctx.getImageData(0, 0, BOARD_WIDTH, BOARD_HEIGHT);
    }

    e.currentTarget.setPointerCapture(e.pointerId);
    isDrawingRef.current = true;
    const startPt = getCanvasCoords(e);
    lastPtRef.current = startPt;
    currentStrokeRef.current = {
      points: [startPt],
      color: inkColor,
      size: brushSize,
      isEraser,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !lastPtRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pt = getCanvasCoords(e);
    if (currentStrokeRef.current) {
      currentStrokeRef.current.points.push(pt);
    }

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (isEraser) {
      ctx.strokeStyle = boardTheme === 'whiteboard' ? '#ffffff' : '#080e18';
      ctx.lineWidth = brushSize * 5;
      ctx.shadowBlur = 0;
    } else {
      ctx.strokeStyle = inkColor;
      ctx.lineWidth = brushSize;
      if (neonGlow || boardTheme === 'blackboard') {
        ctx.shadowColor = inkColor;
        ctx.shadowBlur = boardTheme === 'blackboard' ? 9 : 4;
      }
    }

    ctx.beginPath();
    ctx.moveTo(lastPtRef.current.x, lastPtRef.current.y);
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
    ctx.restore();

    lastPtRef.current = pt;
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    lastPtRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}

    const finished = currentStrokeRef.current;
    currentStrokeRef.current = null;

    if (boardMode === 'math_practice') {
      if (finished && finished.points.length >= 2) {
        practiceStrokesRef.current.push(finished);
      }
      pushHistory();

      if (
        practiceSubView === 'problems' &&
        autoCheckPractice &&
        finished &&
        !finished.isEraser &&
        finished.points.length >= 2 &&
        isStrokeInAnswerBox(finished)
      ) {
        if (autoCheckTimerRef.current) clearTimeout(autoCheckTimerRef.current);
        autoCheckTimerRef.current = setTimeout(() => {
          void handleCheckPracticeAnswer();
        }, 2500);
      }
      onBlackboardActivity(
        'draw',
        practiceSubView === 'tables'
          ? 'Annotated Multiplication Tables (1 to 10)'
          : 'Annotated Math Practice Board'
      );
      return;
    }

    pushHistory();

    if (finished && !finished.isEraser && finished.points.length >= 2) {
      freehandStrokesRef.current.push(finished);
      setPendingStrokeCount(freehandStrokesRef.current.length);

      if (smartInkEnabled) {
        if (autoInkTimerRef.current) clearTimeout(autoInkTimerRef.current);
        autoInkTimerRef.current = setTimeout(() => {
          void handleTranslateFreehandInk();
        }, 1200);
      }
    }

    onBlackboardActivity('draw', `Annotated Smart ${boardTheme === 'whiteboard' ? 'Whiteboard' : 'Blackboard'}`);
  };

  const handleClearBoard = useCallback(() => {
    cancelAnimRef.current?.();
    if (autoInkTimerRef.current) clearTimeout(autoInkTimerRef.current);
    if (autoCheckTimerRef.current) clearTimeout(autoCheckTimerRef.current);

    if (boardMode === 'math_practice' && practiceSubView === 'tables') {
      practiceStrokesRef.current = [];
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) {
        paintMultiplicationTablesChart(ctx, {
          theme: boardTheme,
          bgStyle,
          boardWidth: BOARD_WIDTH,
          boardHeight: BOARD_HEIGHT,
          highlightedTable,
          hideAnswers: hideTableAnswers,
        });
        pushHistory();
      }
      return;
    }

    if (boardMode === 'math_practice' && currentProblem) {
      practiceStrokesRef.current = [];
      setPracticeResult(null);
      setIsAnswerRevealed(false);
      setManualCorrectionInput('');
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) {
        paintMathPracticeWorksheet(ctx, currentProblem, {
          theme: boardTheme,
          bgStyle,
          boardWidth: BOARD_WIDTH,
          boardHeight: BOARD_HEIGHT,
          questionIndex: currentIdx,
          totalQuestions: worksheet.length,
          layout: practiceLayout,
          showHint: showPracticeHint,
        });
        pushHistory();
      }
      return;
    }

    freehandStrokesRef.current = [];
    preInkBoardSnapshotRef.current = null;
    setPendingStrokeCount(0);
    setLastInkResult(null);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    paintBoardSurface(ctx, boardTheme, bgStyle, BOARD_WIDTH, BOARD_HEIGHT, subject.name);
    textCursorYRef.current = 92;
    setActiveScene(null);
    setInteractiveControl(null);
    setChalkNotesLog([]);
    pushHistory();
  }, [
    boardMode,
    practiceSubView,
    highlightedTable,
    hideTableAnswers,
    currentProblem,
    currentIdx,
    worksheet.length,
    practiceLayout,
    showPracticeHint,
    boardTheme,
    bgStyle,
    subject.name,
    pushHistory,
  ]);

  const handleToggleTheme = (newTheme: BoardTheme) => {
    setBoardTheme(newTheme);
    setInkColor(newTheme === 'whiteboard' ? '#2563eb' : '#22d3ee');
    setIsEraser(false);
    setNeonGlow(newTheme === 'blackboard');

    if (boardMode === 'math_practice') {
      return;
    }

    if (activeScene) {
      renderSceneToBoard(activeScene, { animate: false, overrideTheme: newTheme });
    } else {
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) {
        paintBoardSurface(ctx, newTheme, bgStyle, BOARD_WIDTH, BOARD_HEIGHT, subject.name);
        pushHistory();
      }
    }
  };

  const handleChangeBgStyle = (newStyle: BoardBgStyle) => {
    setBgStyle(newStyle);
    if (boardMode === 'math_practice') {
      return;
    }
    if (activeScene) {
      renderSceneToBoard(activeScene, { animate: false, overrideBg: newStyle });
    } else {
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) {
        paintBoardSurface(ctx, boardTheme, newStyle, BOARD_WIDTH, BOARD_HEIGHT, subject.name);
        pushHistory();
      }
    }
  };

  const handleUndo = () => {
    if (autoInkTimerRef.current) clearTimeout(autoInkTimerRef.current);
    if (autoCheckTimerRef.current) clearTimeout(autoCheckTimerRef.current);
    freehandStrokesRef.current = [];
    preInkBoardSnapshotRef.current = null;
    setPendingStrokeCount(0);

    if (historyIdxRef.current <= 0) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    historyIdxRef.current -= 1;
    ctx.putImageData(historyRef.current[historyIdxRef.current], 0, 0);
    if (boardMode === 'math_practice') {
      practiceStrokesRef.current = [
        ...(practiceStrokeHistoryRef.current[historyIdxRef.current] || []),
      ];
    }
    setCanUndo(historyIdxRef.current > 0);
    setCanRedo(historyIdxRef.current < historyRef.current.length - 1);
  };

  const handleRedo = () => {
    if (autoInkTimerRef.current) clearTimeout(autoInkTimerRef.current);
    if (autoCheckTimerRef.current) clearTimeout(autoCheckTimerRef.current);
    freehandStrokesRef.current = [];
    preInkBoardSnapshotRef.current = null;
    setPendingStrokeCount(0);

    if (historyIdxRef.current >= historyRef.current.length - 1) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    historyIdxRef.current += 1;
    ctx.putImageData(historyRef.current[historyIdxRef.current], 0, 0);
    if (boardMode === 'math_practice') {
      practiceStrokesRef.current = [
        ...(practiceStrokeHistoryRef.current[historyIdxRef.current] || []),
      ];
    }
    setCanUndo(historyIdxRef.current > 0);
    setCanRedo(historyIdxRef.current < historyRef.current.length - 1);
  };

  // Visualize any topic (Geometry, Graphs, Slopes, Equations, or Advanced AI Scenes)
  const handleVisualizeTopic = useCallback(
    async (queryText: string) => {
      const cleaned = queryText.trim();
      if (!cleaned) return;
      setIsRenderingVisual(true);
      try {
        const scene = await generateTopicVisualScene(
          subject,
          cleaned,
          chalkNotesLog.join('\n')
        );
        renderSceneToBoard(scene, { animate: true });
        setChalkNotesLog((prev) => [
          ...prev,
          `Topic: ${cleaned}`,
          scene.title,
          ...scene.steps,
          scene.formulaBox ? `Formula: ${scene.formulaBox}` : '',
        ].filter(Boolean));
        onBlackboardActivity('ai_solve', `Visualized "${scene.title}"`);

        if (speakAiAnswer && scene.spokenSummary) {
          speechEngine.speak(scene.spokenSummary);
        }
      } finally {
        setIsRenderingVisual(false);
      }
    },
    [subject, chalkNotesLog, renderSceneToBoard, onBlackboardActivity, speakAiAnswer]
  );

  // Interactive Live Parameter Slider Updates (60fps synchronous canvas updates!)
  const handleInteractiveUpdate = (nextCtrl: InteractiveControlConfig) => {
    let nextScene: WhiteboardVisualScene;
    if (nextCtrl.kind === 'circle') {
      nextScene = buildCircleScene(nextCtrl.radius, nextCtrl.unit);
    } else if (nextCtrl.kind === 'square') {
      nextScene = buildSquareScene(nextCtrl.side, nextCtrl.unit);
    } else if (nextCtrl.kind === 'rectangle') {
      nextScene = buildRectangleScene(nextCtrl.length, nextCtrl.width, nextCtrl.unit);
    } else if (nextCtrl.kind === 'triangle') {
      nextScene = buildTriangleScene(
        nextCtrl.base,
        nextCtrl.height,
        nextCtrl.triangleType,
        nextCtrl.unit
      );
    } else if (nextCtrl.kind === 'linear_graph') {
      nextScene = buildLinearSlopeGraphScene(nextCtrl.slope, nextCtrl.intercept);
    } else {
      nextScene = buildCurveGraphScene(nextCtrl.expression, nextCtrl.tangentX);
    }
    setInteractiveControl(nextCtrl);
    renderSceneToBoard(nextScene, { animate: false });
  };

  // Process final spoken utterance on the Whiteboard
  const processFinalSpeech = useCallback(
    (spokenText: string) => {
      const clean = spokenText.trim();
      if (!clean) return;
      const lower = clean.toLowerCase();

      if (lower.includes('clear board') || lower.includes('erase board') || lower.includes('அழி')) {
        handleClearBoard();
        setLiveTranscript('');
        return;
      }

      if (
        lower.includes('multiplication table') ||
        lower.includes('10th table') ||
        lower.includes('tables')
      ) {
        setLiveTranscript('');
        setBoardMode('math_practice');
        setPracticeSubView('tables');
        onBlackboardActivity('voice', 'Opened Multiplication Tables (1 to 10)');
        return;
      }

      if (
        lower.includes('math practice') ||
        lower.includes('practice math') ||
        lower.includes('addition practice') ||
        lower.includes('subtraction practice') ||
        lower.includes('multiplication practice') ||
        lower.includes('division practice') ||
        (boardMode === 'math_practice' &&
          (lower.includes('addition') ||
            lower.includes('subtraction') ||
            lower.includes('multiplication') ||
            lower.includes('division')))
      ) {
        const nextOp: ArithmeticFilter = lower.includes('addition')
          ? 'add'
          : lower.includes('subtraction')
          ? 'sub'
          : lower.includes('multiplication')
          ? 'mul'
          : lower.includes('division')
          ? 'div'
          : 'mixed';
        setLiveTranscript('');
        setBoardMode('math_practice');
        handleStartNewWorksheet(nextOp, practiceTier);
        onBlackboardActivity('voice', `Launched Math Practice (${nextOp})`);
        return;
      }

      if (boardMode === 'math_practice') {
        setLiveTranscript('');
        if (lower.includes('check')) {
          void handleCheckPracticeAnswer();
          return;
        }
        if (lower.includes('hint')) {
          handleTogglePracticeHint();
          return;
        }
        if (lower.includes('clear answer')) {
          handleClearAnswerBox();
          return;
        }
        if (lower.includes('next')) {
          handleNextPracticeQuestion();
          return;
        }
      }

      // Route visual/draw/generate/graph/shape/explain/solve commands to Topic Visual Renderer
      const isVisualCommand =
        lower.includes('draw') ||
        lower.includes('generate') ||
        lower.includes('plot') ||
        lower.includes('graph') ||
        lower.includes('circle') ||
        lower.includes('triangle') ||
        lower.includes('rectangle') ||
        lower.includes('square') ||
        lower.includes('slope') ||
        lower.includes('solve') ||
        lower.includes('explain') ||
        lower.includes('show') ||
        lower.includes('helix') ||
        lower.includes('punnett') ||
        lower.includes('circuit') ||
        lower.includes('projectile') ||
        lower.includes('வரை') ||
        lower.includes('விளக்கு');

      setLiveTranscript('');
      if (isVisualCommand) {
        void handleVisualizeTopic(clean);
        return;
      }

      // Otherwise write note cleanly onto the board
      writeNoteTextToBoard(`🎙️ ${clean}`);
      setChalkNotesLog((prev) => [...prev, clean]);
      onBlackboardActivity('voice', `Dictated "${clean.slice(0, 32)}" onto Whiteboard`);
    },
    [
      boardMode,
      practiceTier,
      handleClearBoard,
      handleStartNewWorksheet,
      handleCheckPracticeAnswer,
      handleTogglePracticeHint,
      handleClearAnswerBox,
      handleNextPracticeQuestion,
      handleVisualizeTopic,
      writeNoteTextToBoard,
      onBlackboardActivity,
    ]
  );

  // Stop local Speech Recognition cleanly
  const stopLocalVoiceRecognition = useCallback(() => {
    setIsListening(false);
    if (webRecognitionRef.current) {
      try {
        webRecognitionRef.current.stop();
      } catch {}
      webRecognitionRef.current = null;
    }
    if (nativeActiveRef.current) {
      nativeActiveRef.current = false;
      SpeechRecognition.stop().catch(() => {});
      SpeechRecognition.removeAllListeners().catch(() => {});
    }
  }, []);

  useEffect(() => {
    return () => {
      stopLocalVoiceRecognition();
    };
  }, [stopLocalVoiceRecognition]);

  const toggleVoiceRecognition = async () => {
    if (isListening) {
      stopLocalVoiceRecognition();
      return;
    }
    setMicNotice(null);

    if (Capacitor.isNativePlatform()) {
      try {
        const perm = await SpeechRecognition.requestPermissions();
        if (perm.speechRecognition !== 'granted') {
          setMicNotice('Microphone permission needed for speech recognition.');
          return;
        }
        nativeActiveRef.current = true;
        setIsListening(true);

        await SpeechRecognition.removeAllListeners();
        await SpeechRecognition.addListener('partialResults', (data: { matches?: string[] }) => {
          if (data.matches?.[0]) setLiveTranscript(data.matches[0]);
        });
        const res = await SpeechRecognition.start({
          language: speechLang,
          maxResults: 3,
          partialResults: true,
          popup: false,
        });
        nativeActiveRef.current = false;
        setIsListening(false);
        const finalText = res?.matches?.[0] || liveTranscript;
        if (finalText) processFinalSpeech(finalText);
      } catch (err: any) {
        nativeActiveRef.current = false;
        setIsListening(false);
        setMicNotice(err?.message || 'Native speech engine could not start.');
      }
      return;
    }

    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      setMicNotice('Speech Recognition unavailable in this browser; type any topic below to visualize!');
      return;
    }

    try {
      const rec = new SpeechRec();
      rec.lang = speechLang;
      rec.continuous = true;
      rec.interimResults = true;

      rec.onresult = (event: any) => {
        let interim = '';
        let finalSeg = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const text = event.results[i][0]?.transcript || '';
          if (event.results[i].isFinal) finalSeg += text + ' ';
          else interim += text;
        }
        if (interim) setLiveTranscript(interim.trim());
        if (finalSeg.trim()) processFinalSpeech(finalSeg.trim());
      };

      rec.onerror = (ev: any) => {
        if (ev.error === 'not-allowed') {
          setMicNotice('Microphone permission blocked. Allow mic access or type below.');
        }
        setIsListening(false);
      };
      rec.onend = () => setIsListening(false);

      rec.start();
      webRecognitionRef.current = rec;
      setIsListening(true);
    } catch (err: any) {
      setMicNotice(err?.message || 'Could not start speech recognition.');
      setIsListening(false);
    }
  };

  const handleSnapshotToGrader = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onExportToGrader({
      dataUrl: canvas.toDataURL('image/png'),
      transcriptNotes: chalkNotesLog.join('\n') || activeScene?.steps.join('\n') || '',
      subjectId: subject.id,
      createdAt: new Date().toISOString(),
    });
  };

  const handleDownloadPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `aura-whiteboard-${subject.id}-${Date.now()}.png`;
    a.click();
  };

  const handleSaveToDrive = () => {
    const content = `# Smart Whiteboard Visual Scene — ${activeScene?.title || subject.name}\n\n${
      activeScene?.steps.map((s) => `- ${s}`).join('\n') ||
      chalkNotesLog.map((l) => `- ${l}`).join('\n')
    }\n\n${activeScene?.formulaBox ? `**Key Formula:** \`${activeScene.formulaBox}\`` : ''}`;
    onSyncToDrive(`Whiteboard - ${activeScene?.title || subject.name}`, content);
  };

  const paletteSwatches = boardTheme === 'whiteboard' ? WHITEBOARD_INKS : BLACKBOARD_CHALKS;
  const subjectChips = SUBJECT_ADVANCED_CHIPS[subject.id] || [];
  const solvedCount = worksheet.filter((q) => q.status === 'correct').length;
  const totalAttempts = worksheet.reduce((sum, q) => sum + q.attempts, 0);

  return (
    <div className="space-y-3">
      {/* =====================================================================
          TOP STUDIO BAR: MODE SWITCHER + THEME SWITCHER + INK PALETTE + ACTIONS
          ===================================================================== */}
      <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-3 shadow-xl space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800/80">
          {/* Free Whiteboard vs Paperless Math Practice Mode Toggle */}
          <div className="flex bg-slate-950 p-1 rounded-2xl border border-slate-800 text-xs font-bold gap-1">
            <button
              type="button"
              onClick={() => setBoardMode('free')}
              className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 cursor-pointer transition-all ${
                boardMode === 'free'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>🎨</span>
              <span>Free Whiteboard</span>
            </button>
            <button
              type="button"
              onClick={() => setBoardMode('math_practice')}
              className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 cursor-pointer transition-all ${
                boardMode === 'math_practice'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 shadow-md'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <span>✏️</span>
              <span>Math Practice (+ − × ÷)</span>
            </button>
          </div>

          <div className="flex items-center gap-1 text-[10px] font-mono">
            <Grid className="w-3 h-3 text-slate-400 mr-0.5" />
            {(['grid', 'plain', 'lined', 'dots'] as BoardBgStyle[]).map((style) => (
              <button
                key={style}
                type="button"
                onClick={() => handleChangeBgStyle(style)}
                className={`px-2 py-0.5 rounded-lg capitalize border cursor-pointer ${
                  bgStyle === style
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 font-bold'
                    : 'bg-slate-950 text-slate-400 border-slate-800'
                }`}
              >
                {style}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Theme Switcher + Marker Palette */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Whiteboard / Blackboard Toggle */}
            <div className="flex bg-slate-950 p-0.5 rounded-xl border border-slate-800 text-[11px] font-bold">
              <button
                type="button"
                onClick={() => handleToggleTheme('whiteboard')}
                className={`px-2 py-1 rounded-lg flex items-center gap-1 cursor-pointer transition-all ${
                  boardTheme === 'whiteboard'
                    ? 'bg-white text-slate-950 shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Sun className="w-3 h-3 text-amber-500" />
                <span>Whiteboard</span>
              </button>
              <button
                type="button"
                onClick={() => handleToggleTheme('blackboard')}
                className={`px-2 py-1 rounded-lg flex items-center gap-1 cursor-pointer transition-all ${
                  boardTheme === 'blackboard'
                    ? 'bg-cyan-500 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Moon className="w-3 h-3" />
                <span>Blackboard</span>
              </button>
            </div>

            {/* Swatches */}
            <div className="flex items-center gap-1.5">
              {paletteSwatches.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  aria-label={`Select ${c.name}`}
                  onClick={() => {
                    setInkColor(c.hex);
                    setIsEraser(false);
                  }}
                  className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full transition-transform cursor-pointer border-2 ${
                    !isEraser && inkColor === c.hex ? 'scale-125 border-cyan-400 shadow-lg' : 'border-slate-600'
                  }`}
                  style={{ backgroundColor: c.hex }}
                  title={c.name}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={() => setIsEraser(!isEraser)}
              className={`px-2 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1 border cursor-pointer ${
                isEraser
                  ? 'bg-rose-500/25 text-rose-200 border-rose-400'
                  : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800'
              }`}
              aria-label="Toggle Eraser"
            >
              <Eraser className="w-3.5 h-3.5" />
              <span>Eraser</span>
            </button>

            <label className="flex items-center gap-1 text-[10px] font-mono text-slate-400">
              <span>Size</span>
              <input
                type="range"
                min={2}
                max={12}
                value={brushSize}
                onChange={(e) => setBrushSize(Number(e.target.value))}
                className="w-14 accent-cyan-400"
                aria-label="Brush Size"
              />
            </label>

            {boardMode === 'free' && (
              <>
                <button
                  type="button"
                  onClick={() => setSmartInkEnabled(!smartInkEnabled)}
                  className={`px-2 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1 border cursor-pointer transition-all ${
                    smartInkEnabled
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-sm'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                  title="Automatically translate handwritten characters, numbers, equations, and sketches"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Smart Ink: {smartInkEnabled ? 'ON' : 'OFF'}</span>
                </button>

                {pendingStrokeCount > 0 && (
                  <button
                    type="button"
                    onClick={() => void handleTranslateFreehandInk()}
                    disabled={isRecognizingInk}
                    className="px-2.5 py-1 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-bold flex items-center gap-1 shadow-md cursor-pointer animate-pulse"
                    title="Convert pending freehand ink right now"
                  >
                    <Wand2 className="w-3 h-3" />
                    <span>Convert Ink ({pendingStrokeCount})</span>
                  </button>
                )}
              </>
            )}
          </div>

          {/* Undo / Redo / Clear / Export / Grade */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={handleUndo}
              disabled={!canUndo}
              className="p-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 disabled:opacity-35 hover:bg-slate-800 cursor-pointer"
              title="Undo"
              aria-label="Undo Stroke"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleRedo}
              disabled={!canRedo}
              className="p-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 disabled:opacity-35 hover:bg-slate-800 cursor-pointer"
              title="Redo"
              aria-label="Redo Stroke"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleClearBoard}
              className="p-1.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 hover:bg-rose-500/25 cursor-pointer"
              title={boardMode === 'math_practice' ? 'Clear All Ink' : 'Clear Board'}
              aria-label="Clear Board"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleDownloadPng}
              className="p-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 hover:bg-slate-800 cursor-pointer"
              title="Download PNG"
              aria-label="Download PNG"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={boardMode === 'math_practice' ? handleSavePracticeToDrive : handleSaveToDrive}
              className="px-2 py-1 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/40 text-indigo-200 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
              title="Save Visual Notes to Google Drive"
            >
              <CloudUpload className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Drive</span>
            </button>
            <button
              type="button"
              onClick={handleSnapshotToGrader}
              className="px-2.5 py-1 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[11px] font-bold flex items-center gap-1 shadow-md cursor-pointer"
            >
              <ClipboardCheck className="w-3.5 h-3.5" />
              <span>Grade Board</span>
            </button>
          </div>
        </div>

        {/* Universal Geometry, Coordinate Graphs & Subject Advanced Visual Chips (Free Whiteboard Only) */}
        {boardMode === 'free' && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-mono uppercase text-slate-400 flex items-center gap-1">
                <Wand2 className="w-3 h-3 text-purple-400" />
                Instant Visuals:
              </span>
              {[
                { emoji: '⭕', label: 'Circle r=7', query: 'generate circle with radius 7 cm' },
                { emoji: '📐', label: 'Triangle', query: 'draw right triangle base 8 height 6' },
                { emoji: '⬜', label: 'Rectangle', query: 'draw rectangle 10 by 6 cm' },
                { emoji: '⬛', label: 'Square', query: 'draw square side 6 cm' },
                { emoji: '📈', label: 'Graph + Slope', query: 'generate graph and draw a slope' },
                { emoji: '〰️', label: 'Curve + Tangent', query: 'graph y = x^2 - 3 tangent at 1.5' },
                ...subjectChips,
              ].map((chip, idx) => (
                <button
                  key={`${chip.label}-${idx}`}
                  type="button"
                  onClick={() => void handleVisualizeTopic(chip.query)}
                  className="px-2 py-1 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700/80 text-xs text-slate-200 flex items-center gap-1 transition-all cursor-pointer active:scale-95"
                >
                  <span>{chip.emoji}</span>
                  <span className="text-[11px] font-semibold">{chip.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* KID PRACTICE CONTROL BAR (Paperless Math Practice Mode Only) */}
        {boardMode === 'math_practice' && (
          <div className="pt-2 border-t border-slate-800/80 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              {/* Operation Selector Pills + Tables 1-10 Right After Div */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {(
                  [
                    { id: 'mixed', label: '🎲 Mixed' },
                    { id: 'add', label: '➕ Add' },
                    { id: 'sub', label: '➖ Sub' },
                    { id: 'mul', label: '✖️ Mul' },
                    { id: 'div', label: '➗ Div' },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleStartNewWorksheet(item.id, practiceTier)}
                    className={`px-2.5 py-1 rounded-xl text-xs font-bold border cursor-pointer transition-all ${
                      practiceSubView === 'problems' && practiceFilter === item.id
                        ? 'bg-cyan-500 text-slate-950 border-cyan-300 shadow'
                        : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => setPracticeSubView('tables')}
                  className={`px-2.5 py-1 rounded-xl text-xs font-bold border cursor-pointer transition-all ${
                    practiceSubView === 'tables'
                      ? 'bg-gradient-to-r from-amber-400 to-orange-400 text-slate-950 border-amber-300 shadow'
                      : 'bg-slate-950 text-amber-300 border-amber-500/40 hover:bg-slate-800'
                  }`}
                  title="Display all Standard Multiplication Tables (1 to 10) for daily memorization"
                >
                  🔢 Tables 1–10
                </button>
              </div>

              {/* Tier Pills + Column/Horizontal Toggle (Practice Problems Only) */}
              {practiceSubView === 'problems' ? (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {(
                    [
                      { id: 'starter', label: '⭐ Starter' },
                      { id: 'builder', label: '⭐⭐ Builder' },
                      { id: 'champion', label: '⭐⭐⭐ Champion' },
                    ] as const
                  ).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => handleStartNewWorksheet(practiceFilter, t.id)}
                      className={`px-2 py-1 rounded-xl text-[11px] font-bold border cursor-pointer transition-all ${
                        practiceTier === t.id
                          ? 'bg-amber-400 text-slate-950 border-amber-300 shadow'
                          : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}

                  <div className="flex bg-slate-950 p-0.5 rounded-xl border border-slate-800 text-[10px] font-bold">
                    {(['column', 'horizontal'] as ArithmeticLayout[]).map((lay) => (
                      <button
                        key={lay}
                        type="button"
                        onClick={() => setPracticeLayout(lay)}
                        className={`px-2 py-0.5 rounded-lg capitalize cursor-pointer ${
                          practiceLayout === lay
                            ? 'bg-indigo-500 text-white'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {lay}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-[11px] font-mono font-bold text-amber-300">
                  🌟 Daily Wall Chart • Focus Any Table Below
                </div>
              )}
            </div>

            {practiceSubView === 'problems' ? (
              /* Live Progress Counters + 1..10 Question Navigator Pills */
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1 flex-wrap">
                  {worksheet.map((q, idx) => (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => setCurrentIdx(idx)}
                      className={`w-7 h-7 rounded-xl text-xs font-mono font-bold border cursor-pointer transition-all ${
                        idx === currentIdx
                          ? 'ring-2 ring-cyan-400 scale-105 bg-cyan-500 text-slate-950 border-cyan-300'
                          : q.status === 'correct'
                          ? 'bg-emerald-500/25 text-emerald-300 border-emerald-500/50'
                          : q.status === 'tried'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                      title={`${q.operandA} ${q.symbol} ${q.operandB}`}
                    >
                      {idx + 1}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => handleStartNewWorksheet()}
                    className="ml-1 px-2.5 py-1 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 text-purple-200 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                    title="Generate 10 fresh random problems"
                  >
                    <Shuffle className="w-3 h-3" />
                    <span>New 10</span>
                  </button>
                </div>

                <div className="flex items-center gap-2 text-xs font-mono font-bold">
                  <span className="px-2 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                    ✅ {solvedCount}/{worksheet.length}
                  </span>
                  <span className="px-2 py-0.5 rounded-lg bg-orange-500/15 text-orange-300 border border-orange-500/30 flex items-center gap-1">
                    <Flame className="w-3 h-3" />
                    {streak}
                  </span>
                  <span className="px-2 py-0.5 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                    <Star className="w-3 h-3 fill-amber-300" />
                    {stars}
                  </span>
                </div>
              </div>
            ) : (
              /* Tables Daily Study Bar: Highlight All or 1..10 */
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-[10px] font-mono uppercase text-slate-400 mr-1">
                    Highlight Table:
                  </span>
                  <button
                    type="button"
                    onClick={() => setHighlightedTable(null)}
                    className={`px-2.5 py-1 rounded-xl text-xs font-bold border cursor-pointer transition-all ${
                      highlightedTable === null
                        ? 'bg-cyan-500 text-slate-950 border-cyan-300 shadow'
                        : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800'
                    }`}
                  >
                    All
                  </button>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setHighlightedTable(num)}
                      className={`w-7 h-7 rounded-xl text-xs font-mono font-bold border cursor-pointer transition-all ${
                        highlightedTable === num
                          ? 'ring-2 ring-amber-300 scale-105 bg-amber-400 text-slate-950 border-amber-300 shadow'
                          : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800'
                      }`}
                      title={`Highlight Table of ${num}`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
                <span className="text-[11px] font-mono text-slate-400">
                  Tip: Draw over blanks in Memory Test mode!
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* =====================================================================
          INTERACTIVE WHITEBOARD / BLACKBOARD CANVAS
          ===================================================================== */}
      <div
        className={`relative rounded-3xl overflow-hidden border-2 shadow-2xl ${
          boardTheme === 'whiteboard'
            ? 'border-slate-300 bg-white'
            : 'border-slate-800 chalk-board-surface'
        }`}
      >
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="w-full aspect-[16/10] sm:aspect-[16/9] touch-none cursor-crosshair block"
        />

        {(isRenderingVisual || isRecognizingInk || isCheckingAnswer) && (
          <div className="absolute top-3 right-3 px-3 py-1.5 rounded-full bg-slate-950/90 border border-cyan-400/60 text-cyan-300 text-xs font-mono font-bold flex items-center gap-1.5 shadow-xl">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>
              {isCheckingAnswer
                ? '🔍 Checking your handwriting...'
                : isRecognizingInk
                ? '🧠 Understanding ink & context...'
                : 'Rendering Visual Scene...'}
            </span>
          </div>
        )}

        {showCelebration && (
          <div className="pointer-events-none absolute top-4 left-1/2 -translate-x-1/2 px-5 py-2 rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-amber-400 text-slate-950 text-sm font-extrabold shadow-2xl animate-bounce flex items-center gap-2">
            <span>🎉</span>
            <span>Awesome Job! +Stars Earned!</span>
            <span>⭐</span>
          </div>
        )}

        {/* Live Speech Caption Overlay */}
        {(isListening || liveTranscript) && (
          <div className="absolute bottom-3 left-3 right-3 px-3.5 py-2 rounded-2xl bg-slate-950/90 border border-cyan-500/50 backdrop-blur-md flex items-center justify-between gap-3 shadow-2xl">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex items-end gap-0.5 h-4 shrink-0">
                {[10, 16, 12, 18, 9].map((h, idx) => (
                  <span
                    key={idx}
                    className="w-1 bg-cyan-400 rounded-full animate-pulse"
                    style={{ height: `${h}px`, animationDelay: `${idx * 90}ms` }}
                  />
                ))}
              </div>
              <span className="text-xs sm:text-sm text-cyan-100 font-medium truncate">
                {liveTranscript ||
                  `Listening (${speechLang === 'ta-IN' ? 'தமிழ்' : 'English'})… Try "Generate circle radius 8" or "Math Practice"`}
              </span>
            </div>
            <span className="text-[10px] font-mono text-cyan-400 shrink-0 uppercase font-bold">
              LIVE VOICE
            </span>
          </div>
        )}
      </div>

      {/* =====================================================================
          TABLES 1–10 DAILY MEMORIZATION ACTION BAR (When Tables Tab Active)
          ===================================================================== */}
      {boardMode === 'math_practice' && practiceSubView === 'tables' && (
        <div className="rounded-3xl bg-slate-900/95 border border-amber-500/40 p-3 shadow-xl flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() =>
                speechEngine.speak(buildTableRecitationText(highlightedTable ?? 1, speechLang))
              }
              className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-300 hover:to-orange-300 text-slate-950 text-xs sm:text-sm font-extrabold flex items-center gap-1.5 shadow-lg cursor-pointer active:scale-95"
            >
              <Volume2 className="w-4 h-4" />
              <span>🔊 Read Table {highlightedTable ?? 1} Aloud</span>
            </button>

            <button
              type="button"
              onClick={() => setHideTableAnswers((v) => !v)}
              className={`px-3.5 py-2.5 rounded-2xl text-xs font-bold border flex items-center gap-1.5 cursor-pointer transition-all ${
                hideTableAnswers
                  ? 'bg-purple-500 text-white border-purple-400 shadow'
                  : 'bg-slate-950 text-purple-200 border-slate-700 hover:bg-slate-800'
              }`}
              title="Blank out the answers so your child can write them freehand on the board to self-test"
            >
              <span>
                {hideTableAnswers ? '👁️ Show All Answers' : '🙈 Hide Answers (Memory Test)'}
              </span>
            </button>

            <button
              type="button"
              onClick={handleClearBoard}
              className="px-3 py-2.5 rounded-2xl bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Eraser className="w-3.5 h-3.5 text-cyan-400" />
              <span>🧹 Clear Board Ink</span>
            </button>

            <button
              type="button"
              onClick={() => setPracticeSubView('problems')}
              className="px-3.5 py-2.5 rounded-2xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/50 text-emerald-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <span>✏️ Practice Problems (+ − × ÷)</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setSpeechLang((prev) => (prev === 'ta-IN' ? 'en-IN' : 'ta-IN'))}
            className="px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs font-bold text-amber-300 hover:bg-slate-800 cursor-pointer"
            title="Toggle Recitation Language (English / Tamil)"
          >
            {speechLang === 'ta-IN' ? '🇮🇳 தமிழ்' : '🇬🇧 ENG'}
          </button>
        </div>
      )}

      {/* =====================================================================
          PAPERLESS MATH PRACTICE ACTION BAR, RESULT FEEDBACK & COMPLETE CARD
          ===================================================================== */}
      {boardMode === 'math_practice' && practiceSubView === 'problems' && (
        <div className="space-y-3">
          {/* Kid-Friendly Big Action Buttons */}
          <div className="rounded-3xl bg-slate-900/95 border border-slate-800 p-3 shadow-xl flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void handleCheckPracticeAnswer()}
                disabled={isCheckingAnswer}
                className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-50 text-slate-950 text-xs sm:text-sm font-extrabold flex items-center gap-1.5 shadow-lg cursor-pointer active:scale-95"
              >
                {isCheckingAnswer ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                <span>Check My Answer</span>
              </button>

              <button
                type="button"
                onClick={handleTogglePracticeHint}
                className={`px-3 py-2.5 rounded-2xl text-xs font-bold border flex items-center gap-1.5 cursor-pointer transition-all ${
                  showPracticeHint
                    ? 'bg-amber-400 text-slate-950 border-amber-300 shadow'
                    : 'bg-slate-950 text-amber-300 border-slate-700 hover:bg-slate-800'
                }`}
              >
                <Lightbulb className="w-4 h-4" />
                <span>{showPracticeHint ? 'Hide Hint' : 'Step Hint'}</span>
              </button>

              <button
                type="button"
                onClick={handleClearAnswerBox}
                className="px-3 py-2.5 rounded-2xl bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Eraser className="w-3.5 h-3.5 text-rose-400" />
                <span>Clear Answer</span>
              </button>

              <button
                type="button"
                onClick={handleClearRoughWork}
                className="px-3 py-2.5 rounded-2xl bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 text-cyan-400" />
                <span>Clear Rough Work</span>
              </button>

              <button
                type="button"
                onClick={handleRevealPracticeAnswer}
                className="px-3 py-2.5 rounded-2xl bg-slate-950 hover:bg-slate-800 border border-slate-700 text-indigo-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Show Answer</span>
              </button>

              <button
                type="button"
                onClick={handleNextPracticeQuestion}
                className="px-3.5 py-2.5 rounded-2xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/50 text-cyan-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <span>Next Question</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setAutoCheckPractice((v) => !v)}
                className={`px-2.5 py-1.5 rounded-xl text-[11px] font-mono font-bold border cursor-pointer ${
                  autoCheckPractice
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-slate-950 text-slate-400 border-slate-800'
                }`}
                title="Automatically check 2.5s after writing in the Answer Box"
              >
                Auto-Check: {autoCheckPractice ? 'ON' : 'OFF'}
              </button>

              <button
                type="button"
                onClick={() => setSpeakAiAnswer(!speakAiAnswer)}
                className={`p-2 rounded-xl border cursor-pointer ${
                  speakAiAnswer
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}
                title="Toggle Encouraging Spoken Voice Feedback"
                aria-label="Toggle Voice Feedback"
              >
                <Volume2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Encouraging Result Feedback Card */}
          {practiceResult && (
            <div
              className={`rounded-3xl border p-3.5 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                practiceResult.isCorrect
                  ? 'bg-emerald-950/60 border-emerald-500/50'
                  : 'bg-amber-950/40 border-amber-500/45'
              }`}
            >
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold ${
                      practiceResult.isCorrect
                        ? 'bg-emerald-500 text-slate-950'
                        : 'bg-amber-400 text-slate-950'
                    }`}
                  >
                    {practiceResult.isCorrect ? '⭐ Correct!' : '💡 Keep Going!'}
                  </span>
                  {practiceResult.recognizedNumber !== null && (
                    <span className="text-xs font-mono text-slate-200 bg-slate-950/70 px-2 py-0.5 rounded-lg border border-slate-700">
                      I read: <strong>{practiceResult.recognizedNumber}</strong>
                    </span>
                  )}
                  <span className="text-[10px] font-mono text-slate-400">
                    via {practiceResult.modelUsed}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-white font-semibold">
                  {practiceResult.feedbackMessage}
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap shrink-0">
                {practiceResult.isCorrect ? (
                  <button
                    type="button"
                    onClick={handleNextPracticeQuestion}
                    className="px-4 py-2 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold flex items-center gap-1.5 shadow-md cursor-pointer"
                  >
                    <span>Next Problem</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const parsed = parseInt(manualCorrectionInput.trim(), 10);
                        if (Number.isFinite(parsed)) {
                          void handleCheckPracticeAnswer(parsed);
                          setManualCorrectionInput('');
                        }
                      }}
                      className="flex items-center gap-1"
                    >
                      <input
                        type="number"
                        value={manualCorrectionInput}
                        onChange={(e) => setManualCorrectionInput(e.target.value)}
                        placeholder="Misread? Type #"
                        className="w-32 px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-cyan-400"
                      />
                      <button
                        type="submit"
                        disabled={!manualCorrectionInput.trim()}
                        className="px-2.5 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-slate-950 text-xs font-bold cursor-pointer"
                      >
                        Re-check
                      </button>
                    </form>
                    <button
                      type="button"
                      onClick={handleClearAnswerBox}
                      className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-200 text-xs font-bold cursor-pointer"
                    >
                      Try Again (Clear Answer)
                    </button>
                    {!showPracticeHint && (
                      <button
                        type="button"
                        onClick={handleTogglePracticeHint}
                        className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 text-xs font-bold cursor-pointer"
                      >
                        💡 Show Visual Hint
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Worksheet Complete Celebration Card */}
          {solvedCount === worksheet.length && (
            <div className="rounded-3xl bg-gradient-to-r from-indigo-950 via-emerald-950 to-slate-900 border border-emerald-400/60 p-4 shadow-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-amber-400/20 border border-amber-400/50 flex items-center justify-center text-amber-300 shrink-0">
                  <Trophy className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-white">
                    🎉 Worksheet Complete! ({solvedCount}/{worksheet.length} Solved!)
                  </h3>
                  <p className="text-xs text-emerald-200">
                    Total Stars Earned: <strong>{stars} ⭐</strong> • Total Checks:{' '}
                    <strong>{totalAttempts}</strong> — Zero paper wasted!
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap shrink-0">
                <button
                  type="button"
                  onClick={() => handleStartNewWorksheet()}
                  className="px-3.5 py-2 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-extrabold flex items-center gap-1.5 shadow cursor-pointer"
                >
                  <Shuffle className="w-4 h-4" />
                  <span>New Random Worksheet</span>
                </button>
                <button
                  type="button"
                  onClick={handleSavePracticeToDrive}
                  className="px-3.5 py-2 rounded-2xl bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold flex items-center gap-1.5 shadow cursor-pointer"
                >
                  <CloudUpload className="w-4 h-4" />
                  <span>Save Practice Report to Drive</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          SMART INK CONTEXT RECOGNITION SUMMARY CARD (Free Whiteboard Only)
          ===================================================================== */}
      {boardMode === 'free' && lastInkResult && (
        <div className="rounded-3xl bg-slate-900/95 border border-emerald-500/40 p-3 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="min-w-0 space-y-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-mono font-bold uppercase flex items-center gap-1">
                <Brain className="w-3 h-3" />
                {lastInkResult.detectedCategory.replace('_', ' ')}
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                via {lastInkResult.modelUsed}
              </span>
            </div>
            <div className="text-xs sm:text-sm font-bold text-white flex items-center gap-2 flex-wrap">
              <span>{lastInkResult.recognizedText}</span>
              {lastInkResult.solvedAnswer && (
                <span className="px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 font-mono">
                  ⇒ {lastInkResult.solvedAnswer}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-300">
              Intent: {lastInkResult.detectedPurpose}
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
            {!lastInkResult.scene && (lastInkResult.visualQuery || lastInkResult.recognizedText) && (
              <button
                type="button"
                onClick={() =>
                  void handleVisualizeTopic(
                    lastInkResult.visualQuery || lastInkResult.recognizedText
                  )
                }
                className="px-2.5 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-200 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
              >
                <Sparkles className="w-3 h-3" />
                <span>Visualize Topic</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                handleUndo();
                setLastInkResult(null);
              }}
              className="px-2.5 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-200 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
              title="Revert back to your raw hand-drawn sketch"
            >
              <Undo2 className="w-3 h-3" />
              <span>Keep Raw Sketch</span>
            </button>
            <button
              type="button"
              onClick={() => setLastInkResult(null)}
              className="p-1.5 rounded-xl bg-slate-950 text-slate-400 hover:text-white cursor-pointer"
              aria-label="Dismiss Smart Ink Card"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* =====================================================================
          LIVE INTERACTIVE PARAMETER TUNING BAR (SHAPES, SLOPES & CURVES)
          ===================================================================== */}
      {boardMode === 'free' && interactiveControl && (
        <div className="rounded-3xl bg-slate-900/95 border border-cyan-500/40 p-3 shadow-xl flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-cyan-300 shrink-0">
            <Sliders className="w-4 h-4" />
            <span>Interactive Tuning:</span>
          </div>

          {interactiveControl.kind === 'circle' && (
            <label className="flex-1 min-w-[200px] flex items-center gap-3 text-xs text-white font-mono">
              <span>Radius r = {interactiveControl.radius} {interactiveControl.unit}</span>
              <input
                type="range"
                min={1}
                max={30}
                step={0.5}
                value={interactiveControl.radius}
                onChange={(e) =>
                  handleInteractiveUpdate({
                    ...interactiveControl,
                    radius: Number(e.target.value),
                  })
                }
                className="flex-1 accent-cyan-400"
              />
            </label>
          )}

          {interactiveControl.kind === 'square' && (
            <label className="flex-1 min-w-[200px] flex items-center gap-3 text-xs text-white font-mono">
              <span>Side a = {interactiveControl.side} {interactiveControl.unit}</span>
              <input
                type="range"
                min={1}
                max={30}
                step={0.5}
                value={interactiveControl.side}
                onChange={(e) =>
                  handleInteractiveUpdate({
                    ...interactiveControl,
                    side: Number(e.target.value),
                  })
                }
                className="flex-1 accent-violet-400"
              />
            </label>
          )}

          {interactiveControl.kind === 'rectangle' && (
            <div className="flex-1 flex flex-wrap items-center gap-4 text-xs text-white font-mono">
              <label className="flex items-center gap-2 flex-1 min-w-[150px]">
                <span>L={interactiveControl.length}</span>
                <input
                  type="range"
                  min={2}
                  max={30}
                  step={0.5}
                  value={interactiveControl.length}
                  onChange={(e) =>
                    handleInteractiveUpdate({
                      ...interactiveControl,
                      length: Number(e.target.value),
                    })
                  }
                  className="flex-1 accent-emerald-400"
                />
              </label>
              <label className="flex items-center gap-2 flex-1 min-w-[150px]">
                <span>W={interactiveControl.width}</span>
                <input
                  type="range"
                  min={2}
                  max={30}
                  step={0.5}
                  value={interactiveControl.width}
                  onChange={(e) =>
                    handleInteractiveUpdate({
                      ...interactiveControl,
                      width: Number(e.target.value),
                    })
                  }
                  className="flex-1 accent-emerald-400"
                />
              </label>
            </div>
          )}

          {interactiveControl.kind === 'triangle' && (
            <div className="flex-1 flex flex-wrap items-center gap-3 text-xs text-white font-mono">
              <div className="flex bg-slate-950 p-0.5 rounded-xl border border-slate-800 text-[10px]">
                {(['right', 'equilateral', 'isosceles'] as const).map((tp) => (
                  <button
                    key={tp}
                    type="button"
                    onClick={() =>
                      handleInteractiveUpdate({
                        ...interactiveControl,
                        triangleType: tp,
                      })
                    }
                    className={`px-2 py-0.5 rounded-lg capitalize cursor-pointer ${
                      interactiveControl.triangleType === tp
                        ? 'bg-rose-500 text-white font-bold'
                        : 'text-slate-400'
                    }`}
                  >
                    {tp}
                  </button>
                ))}
              </div>
              <label className="flex items-center gap-1.5 flex-1 min-w-[120px]">
                <span>b={interactiveControl.base}</span>
                <input
                  type="range"
                  min={2}
                  max={24}
                  step={0.5}
                  value={interactiveControl.base}
                  onChange={(e) =>
                    handleInteractiveUpdate({
                      ...interactiveControl,
                      base: Number(e.target.value),
                    })
                  }
                  className="flex-1 accent-rose-400"
                />
              </label>
              {interactiveControl.triangleType !== 'equilateral' && (
                <label className="flex items-center gap-1.5 flex-1 min-w-[120px]">
                  <span>h={interactiveControl.height}</span>
                  <input
                    type="range"
                    min={2}
                    max={24}
                    step={0.5}
                    value={interactiveControl.height}
                    onChange={(e) =>
                      handleInteractiveUpdate({
                        ...interactiveControl,
                        height: Number(e.target.value),
                      })
                    }
                    className="flex-1 accent-rose-400"
                  />
                </label>
              )}
            </div>
          )}

          {interactiveControl.kind === 'linear_graph' && (
            <div className="flex-1 flex flex-wrap items-center gap-4 text-xs text-white font-mono">
              <label className="flex items-center gap-2 flex-1 min-w-[160px]">
                <span className="text-emerald-300 font-bold">Slope m = {interactiveControl.slope}</span>
                <input
                  type="range"
                  min={-5}
                  max={5}
                  step={0.5}
                  value={interactiveControl.slope}
                  onChange={(e) =>
                    handleInteractiveUpdate({
                      ...interactiveControl,
                      slope: Number(e.target.value),
                    })
                  }
                  className="flex-1 accent-emerald-400"
                />
              </label>
              <label className="flex items-center gap-2 flex-1 min-w-[160px]">
                <span className="text-amber-300 font-bold">Intercept c = {interactiveControl.intercept}</span>
                <input
                  type="range"
                  min={-6}
                  max={6}
                  step={0.5}
                  value={interactiveControl.intercept}
                  onChange={(e) =>
                    handleInteractiveUpdate({
                      ...interactiveControl,
                      intercept: Number(e.target.value),
                    })
                  }
                  className="flex-1 accent-amber-400"
                />
              </label>
            </div>
          )}

          {interactiveControl.kind === 'curve_graph' && (
            <div className="flex-1 flex flex-wrap items-center gap-3 text-xs text-white font-mono">
              <div className="flex items-center gap-1.5">
                <span className="text-purple-300 font-bold">y =</span>
                <input
                  type="text"
                  value={interactiveControl.expression}
                  onChange={(e) =>
                    handleInteractiveUpdate({
                      ...interactiveControl,
                      expression: e.target.value,
                    })
                  }
                  className="w-32 px-2 py-1 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-purple-400"
                />
              </div>
              <label className="flex items-center gap-2 flex-1 min-w-[170px]">
                <span className="text-amber-300 font-bold">Tangent x₀ = {interactiveControl.tangentX}</span>
                <input
                  type="range"
                  min={-4.5}
                  max={4.5}
                  step={0.25}
                  value={interactiveControl.tangentX}
                  onChange={(e) =>
                    handleInteractiveUpdate({
                      ...interactiveControl,
                      tangentX: Number(e.target.value),
                    })
                  }
                  className="flex-1 accent-amber-400"
                />
              </label>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          VOICE-TO-WHITEBOARD & AI TOPIC VISUAL GENERATOR PROMPT BAR
          ===================================================================== */}
      {boardMode === 'free' && (
      <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-3 shadow-xl space-y-2">
        {micNotice && (
          <div className="px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-xs text-amber-200">
            {micNotice}
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={toggleVoiceRecognition}
              className={`px-3.5 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-lg ${
                isListening
                  ? 'bg-rose-600 hover:bg-rose-500 text-white animate-pulse'
                  : 'bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white'
              }`}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              <span>{isListening ? 'Stop Mic' : 'Speak Visual'}</span>
            </button>

            <button
              type="button"
              onClick={() => setSpeechLang((prev) => (prev === 'ta-IN' ? 'en-IN' : 'ta-IN'))}
              className="px-2.5 py-2.5 rounded-2xl bg-slate-950 border border-slate-700 text-xs font-bold text-amber-300 hover:bg-slate-800 cursor-pointer"
              title="Toggle Speech Language (English / Tamil)"
            >
              {speechLang === 'ta-IN' ? '🇮🇳 தமிழ்' : '🇬🇧 ENG'}
            </button>

            <button
              type="button"
              onClick={() => setSpeakAiAnswer(!speakAiAnswer)}
              className={`p-2.5 rounded-2xl border cursor-pointer ${
                speakAiAnswer
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                  : 'bg-slate-950 border-slate-800 text-slate-400'
              }`}
              title="Toggle Spoken Narration of Rendered Visuals"
              aria-label="Toggle Spoken Narration"
            >
              <Volume2 className="w-4 h-4" />
            </button>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const q = topicQuery;
              setTopicQuery('');
              void handleVisualizeTopic(q);
            }}
            className="flex-1 flex items-center gap-2"
          >
            <input
              type="text"
              value={topicQuery}
              onChange={(e) => setTopicQuery(e.target.value)}
              placeholder='Try: "circle radius 8 cm", "triangle 3 4 5", "graph and draw a slope", "y = x^2 - 3", or any topic!'
              className="flex-1 px-3 py-2.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
            />
            <button
              type="submit"
              disabled={isRenderingVisual || !topicQuery.trim()}
              className="px-3.5 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 disabled:opacity-45 text-slate-950 text-xs font-bold flex items-center gap-1.5 shrink-0 cursor-pointer shadow-lg"
            >
              {isRenderingVisual ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Zap className="w-4 h-4" />
              )}
              <span>Visualize</span>
              <Send className="w-3 h-3 hidden sm:inline" />
            </button>
          </form>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono text-slate-400 pt-0.5">
          <Sparkles className="w-3 h-3 text-cyan-400" />
          <span>Try asking:</span>
          {[
            'Circle radius 9',
            'Rectangle 14 by 8',
            'Graph straight line y=2x-1',
            'Draw DNA helix',
          ].map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => void handleVisualizeTopic(ex)}
              className="px-1.5 py-0.5 rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 cursor-pointer"
            >
              "{ex}"
            </button>
          ))}
        </div>
      </div>
      )}
    </div>
  );
};
