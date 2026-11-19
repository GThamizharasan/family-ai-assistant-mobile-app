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
} from 'lucide-react';
import {
  BlackboardSnapshot,
  BoardTheme,
  ConceptNode,
  InkRecognitionResult,
  InkStroke,
  InteractiveControlConfig,
  SubjectDefinition,
  SubjectId,
  WhiteboardVisualScene,
} from '../../types/adaptiveLearning';
import { generateTopicVisualScene } from '../../services/adaptiveLearningService';
import { recognizeAndTranslateFreehandInk } from '../../services/inkRecognitionEngine';
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
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const lastPtRef = useRef<{ x: number; y: number } | null>(null);
  const cancelAnimRef = useRef<(() => void) | null>(null);

  // Whiteboard vs Blackboard Theme + Drawing State
  const [boardTheme, setBoardTheme] = useState<BoardTheme>('whiteboard');
  const [inkColor, setInkColor] = useState<string>('#2563eb');
  const [brushSize, setBrushSize] = useState<number>(4);
  const [isEraser, setIsEraser] = useState<boolean>(false);
  const [neonGlow, setNeonGlow] = useState<boolean>(false);
  const [bgStyle, setBgStyle] = useState<BoardBgStyle>('grid');

  // Undo / Redo ImageData Stack
  const historyRef = useRef<ImageData[]>([]);
  const historyIdxRef = useRef<number>(-1);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

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
    if (sliced.length > 20) sliced.shift();
    historyRef.current = sliced;
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

  // Initialize board and render current concept's visual scene
  useEffect(() => {
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
  }, [subject.id, activeConcept.id]);

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

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (ctx && freehandStrokesRef.current.length === 0 && !isEraser) {
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
  }, [boardTheme, bgStyle, subject.name, pushHistory]);

  const handleToggleTheme = (newTheme: BoardTheme) => {
    setBoardTheme(newTheme);
    setInkColor(newTheme === 'whiteboard' ? '#2563eb' : '#22d3ee');
    setIsEraser(false);
    setNeonGlow(newTheme === 'blackboard');

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
    freehandStrokesRef.current = [];
    preInkBoardSnapshotRef.current = null;
    setPendingStrokeCount(0);

    if (historyIdxRef.current <= 0) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    historyIdxRef.current -= 1;
    ctx.putImageData(historyRef.current[historyIdxRef.current], 0, 0);
    setCanUndo(historyIdxRef.current > 0);
    setCanRedo(historyIdxRef.current < historyRef.current.length - 1);
  };

  const handleRedo = () => {
    if (autoInkTimerRef.current) clearTimeout(autoInkTimerRef.current);
    freehandStrokesRef.current = [];
    preInkBoardSnapshotRef.current = null;
    setPendingStrokeCount(0);

    if (historyIdxRef.current >= historyRef.current.length - 1) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    historyIdxRef.current += 1;
    ctx.putImageData(historyRef.current[historyIdxRef.current], 0, 0);
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
    [handleClearBoard, handleVisualizeTopic, writeNoteTextToBoard, onBlackboardActivity]
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

  return (
    <div className="space-y-3">
      {/* =====================================================================
          TOP STUDIO BAR: THEME SWITCHER + INK PALETTE + ACTIONS
          ===================================================================== */}
      <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-3 shadow-xl space-y-2.5">
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
              title="Clear Board"
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
              onClick={handleSaveToDrive}
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

        {/* Universal Geometry, Coordinate Graphs & Subject Advanced Visual Chips */}
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

        {(isRenderingVisual || isRecognizingInk) && (
          <div className="absolute top-3 right-3 px-3 py-1.5 rounded-full bg-slate-950/90 border border-cyan-400/60 text-cyan-300 text-xs font-mono font-bold flex items-center gap-1.5 shadow-xl">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>
              {isRecognizingInk
                ? '🧠 Understanding ink & context...'
                : 'Rendering Visual Scene...'}
            </span>
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
                  `Listening (${speechLang === 'ta-IN' ? 'தமிழ்' : 'English'})… Try "Generate circle radius 8" or "Draw graph with slope 2"`}
              </span>
            </div>
            <span className="text-[10px] font-mono text-cyan-400 shrink-0 uppercase font-bold">
              LIVE VOICE
            </span>
          </div>
        )}
      </div>

      {/* =====================================================================
          SMART INK CONTEXT RECOGNITION SUMMARY CARD
          ===================================================================== */}
      {lastInkResult && (
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
      {interactiveControl && (
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
    </div>
  );
};
