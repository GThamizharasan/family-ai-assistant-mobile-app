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
} from 'lucide-react';
import {
  BlackboardSnapshot,
  ConceptNode,
  DiagramStampType,
  SubjectDefinition,
} from '../../types/adaptiveLearning';
import { solveVoiceQueryOnBlackboard } from '../../services/adaptiveLearningService';
import { speechEngine } from '../../services/speech';

interface SmartBlackboardViewProps {
  subject: SubjectDefinition;
  activeConcept: ConceptNode;
  onBlackboardActivity: (type: 'draw' | 'voice' | 'ai_solve', summary: string) => void;
  onExportToGrader: (snapshot: BlackboardSnapshot) => void;
  onSyncToDrive: (title: string, content: string) => void;
}

type BoardBgStyle = 'slate' | 'grid' | 'lined' | 'dots';

const BOARD_WIDTH = 1200;
const BOARD_HEIGHT = 680;

const CHALK_COLORS = [
  { name: 'Chalk White', hex: '#f8fafc' },
  { name: 'Neon Cyan', hex: '#22d3ee' },
  { name: 'Saffron Amber', hex: '#fbbf24' },
  { name: 'Plasma Magenta', hex: '#f472b6' },
  { name: 'Chlorophyll Green', hex: '#34d399' },
  { name: 'Electric Violet', hex: '#c084fc' },
];

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

  // Brush & Board Controls
  const [chalkColor, setChalkColor] = useState<string>('#22d3ee');
  const [brushSize, setBrushSize] = useState<number>(4);
  const [isEraser, setIsEraser] = useState<boolean>(false);
  const [neonGlow, setNeonGlow] = useState<boolean>(true);
  const [bgStyle, setBgStyle] = useState<BoardBgStyle>('grid');

  // Undo / Redo ImageData stack
  const historyRef = useRef<ImageData[]>([]);
  const historyIdxRef = useRef<number>(-1);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Local Independent Speech Recognition State (never mutates global speechEngine callbacks)
  const [isListening, setIsListening] = useState(false);
  const [speechLang, setSpeechLang] = useState<'en-IN' | 'en-US' | 'ta-IN'>(
    subject.defaultLanguage === 'ta-IN' ? 'ta-IN' : 'en-IN'
  );
  const [liveTranscript, setLiveTranscript] = useState('');
  const [chalkNotesLog, setChalkNotesLog] = useState<string[]>([]);
  const [spokenInputQuery, setSpokenInputQuery] = useState('');
  const [isSolvingAi, setIsSolvingAi] = useState(false);
  const [speakAiAnswer, setSpeakAiAnswer] = useState(true);
  const [micNotice, setMicNotice] = useState<string | null>(null);

  const webRecognitionRef = useRef<any>(null);
  const nativeActiveRef = useRef(false);
  const chalkCursorYRef = useRef<number>(95);

  // Update default dictation language when switching subjects (Tamil -> ta-IN)
  useEffect(() => {
    setSpeechLang(subject.defaultLanguage === 'ta-IN' ? 'ta-IN' : 'en-IN');
  }, [subject]);

  // Draw crisp background pattern onto blackboard canvas
  const paintBackground = useCallback(
    (ctx: CanvasRenderingContext2D, style: BoardBgStyle) => {
      const grad = ctx.createLinearGradient(0, 0, BOARD_WIDTH, BOARD_HEIGHT);
      grad.addColorStop(0, '#0a111e');
      grad.addColorStop(1, '#060a12');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

      if (style === 'grid') {
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
        ctx.lineWidth = 1;
        for (let x = 0; x <= BOARD_WIDTH; x += 40) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, BOARD_HEIGHT);
          ctx.stroke();
        }
        for (let y = 0; y <= BOARD_HEIGHT; y += 40) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(BOARD_WIDTH, y);
          ctx.stroke();
        }
      } else if (style === 'lined') {
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)';
        ctx.lineWidth = 1;
        for (let y = 60; y < BOARD_HEIGHT; y += 44) {
          ctx.beginPath();
          ctx.moveTo(30, y);
          ctx.lineTo(BOARD_WIDTH - 30, y);
          ctx.stroke();
        }
      } else if (style === 'dots') {
        ctx.fillStyle = 'rgba(148, 163, 184, 0.2)';
        for (let x = 30; x < BOARD_WIDTH; x += 36) {
          for (let y = 30; y < BOARD_HEIGHT; y += 36) {
            ctx.beginPath();
            ctx.arc(x, y, 1.3, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // Header watermark on board
      ctx.save();
      ctx.font = 'bold 18px monospace';
      ctx.fillStyle = 'rgba(148, 163, 184, 0.35)';
      ctx.fillText(
        `AURA SMART BLACKBOARD • ${subject.name.toUpperCase()} • ${activeConcept.title.toUpperCase()}`,
        28,
        34
      );
      ctx.restore();
    },
    [subject.name, activeConcept.title]
  );

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

  // Stamp any of the 12 subject educational diagrams in glowing neon chalk
  const drawDiagramStampOnCanvas = useCallback(
    (stamp: DiagramStampType) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.save();
      ctx.shadowColor = subject.accentHex;
      ctx.shadowBlur = 10;
      ctx.lineWidth = 3;
      ctx.font = 'bold 20px sans-serif';

      // Right-hand side dedicated diagram stage so left side holds chalk notes cleanly
      const ox = 740;
      const oy = 110;
      const w = 420;
      const h = 440;

      // Translucent diagram frame
      ctx.fillStyle = 'rgba(15, 23, 42, 0.55)';
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(ox, oy, w, h, 18);
      ctx.fill();
      ctx.stroke();

      const cx = ox + w / 2;
      const cy = oy + h / 2 + 12;

      if (stamp === 'parabola') {
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(ox + 35, cy + 80);
        ctx.lineTo(ox + w - 35, cy + 80);
        ctx.moveTo(cx, oy + 65);
        ctx.lineTo(cx, oy + h - 30);
        ctx.stroke();

        ctx.strokeStyle = '#c084fc';
        ctx.lineWidth = 4;
        ctx.beginPath();
        for (let dx = -140; dx <= 140; dx += 4) {
          const px = cx + dx;
          const py = cy + 60 - (dx * dx) / 72;
          const actualY = cy + 80 - (dx * dx) / 75;
          if (dx === -140) ctx.moveTo(px, actualY);
          else ctx.lineTo(px, actualY);
          void py;
        }
        ctx.stroke();
        ctx.fillStyle = '#fbbf24';
        ctx.fillText('Parabola: y = -ax² + k', ox + 28, oy + 38);
        ctx.font = '15px monospace';
        ctx.fillText('Vertex Max (0, k) • Roots x₁, x₂', ox + 65, oy + h - 18);
      } else if (stamp === 'sine_wave') {
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(ox + 30, cy);
        ctx.lineTo(ox + w - 30, cy);
        ctx.moveTo(ox + 60, oy + 60);
        ctx.lineTo(ox + 60, oy + h - 40);
        ctx.stroke();

        ctx.strokeStyle = '#22d3ee';
        ctx.lineWidth = 4;
        ctx.beginPath();
        for (let t = 0; t <= 330; t += 4) {
          const px = ox + 60 + t;
          const py = cy - Math.sin((t / 330) * Math.PI * 3) * 95;
          if (t === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
        ctx.fillStyle = '#22d3ee';
        ctx.fillText('Harmonic Wave: y = A·sin(ωx)', ox + 28, oy + 38);
        ctx.fillStyle = '#fbbf24';
        ctx.font = '15px monospace';
        ctx.fillText('Amplitude A   |   Wavelength λ = 2π/ω', ox + 45, oy + h - 18);
      } else if (stamp === 'free_body') {
        // Inclined plane triangle
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.moveTo(ox + 50, oy + h - 60);
        ctx.lineTo(ox + w - 45, oy + h - 60);
        ctx.lineTo(ox + w - 45, oy + 120);
        ctx.closePath();
        ctx.stroke();

        // Block on incline
        ctx.save();
        ctx.translate(cx + 10, cy + 12);
        ctx.rotate(-0.62);
        ctx.fillStyle = 'rgba(251, 191, 36, 0.25)';
        ctx.strokeStyle = '#fbbf24';
        ctx.fillRect(-35, -24, 70, 48);
        ctx.strokeRect(-35, -24, 70, 48);
        ctx.restore();

        // Gravity downward vector
        ctx.strokeStyle = '#f43f5e';
        ctx.beginPath();
        ctx.moveTo(cx + 10, cy + 12);
        ctx.lineTo(cx + 10, cy + 115);
        ctx.stroke();

        ctx.fillStyle = '#22d3ee';
        ctx.fillText('Free-Body Diagram (FBD)', ox + 28, oy + 38);
        ctx.fillStyle = '#f43f5e';
        ctx.font = '15px monospace';
        ctx.fillText('mg↓  |  N ⊥ Surface  |  F∥ = mg·sinθ', ox + 45, oy + h - 18);
      } else if (stamp === 'ray_optics') {
        // Optical axis
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(ox + 25, cy);
        ctx.lineTo(ox + w - 25, cy);
        ctx.stroke();

        // Convex lens
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(cx, cy, 18, 115, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Parallel incident rays -> focus
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 2.5;
        [-70, -35, 35, 70].forEach((offset) => {
          ctx.beginPath();
          ctx.moveTo(ox + 35, cy + offset);
          ctx.lineTo(cx, cy + offset);
          ctx.lineTo(ox + w - 55, cy);
          ctx.stroke();
        });
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(ox + w - 55, cy, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillText('F', ox + w - 62, cy + 28);
        ctx.fillStyle = '#38bdf8';
        ctx.fillText('Convex Lens Converging Rays', ox + 28, oy + 38);
      } else if (stamp === 'bohr_atom') {
        ctx.fillStyle = '#f43f5e';
        ctx.beginPath();
        ctx.arc(cx, cy, 16, 0, Math.PI * 2);
        ctx.fill();

        [52, 92, 134].forEach((r, idx) => {
          ctx.strokeStyle = idx === 0 ? '#34d399' : idx === 1 ? '#22d3ee' : '#a855f7';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.stroke();

          // Electrons on orbit
          const eCount = idx === 0 ? 2 : idx === 1 ? 6 : 4;
          for (let k = 0; k < eCount; k++) {
            const ang = (k / eCount) * Math.PI * 2 + idx;
            const ex = cx + Math.cos(ang) * r;
            const ey = cy + Math.sin(ang) * r;
            ctx.fillStyle = '#fbbf24';
            ctx.beginPath();
            ctx.arc(ex, ey, 5, 0, Math.PI * 2);
            ctx.fill();
          }
        });
        ctx.fillStyle = '#34d399';
        ctx.fillText('Bohr Quantized Shells (2n²)', ox + 28, oy + 38);
      } else if (stamp === 'benzene_ring') {
        const R = 105;
        ctx.strokeStyle = '#34d399';
        ctx.lineWidth = 4;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const ang = (i * Math.PI) / 3 - Math.PI / 2;
          const px = cx + Math.cos(ang) * R;
          const py = cy + Math.sin(ang) * R;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();

        // Delocalized pi ring
        ctx.strokeStyle = '#fbbf24';
        ctx.setLineDash([8, 6]);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(cx, cy, 62, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = '#34d399';
        ctx.fillText('Benzene C₆H₆ (6π Aromatic Ring)', ox + 28, oy + 38);
        ctx.fillStyle = '#fbbf24';
        ctx.font = '15px monospace';
        ctx.fillText('sp² Planar • 120° • Hückel (4n+2)', ox + 55, oy + h - 18);
      } else if (stamp === 'plant_cell') {
        // Cell wall & membrane
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 6;
        ctx.strokeRect(cx - 140, cy - 110, 280, 220);
        ctx.strokeStyle = '#34d399';
        ctx.lineWidth = 2;
        ctx.strokeRect(cx - 130, cy - 100, 260, 200);

        // Large central vacuole
        ctx.fillStyle = 'rgba(56, 189, 248, 0.22)';
        ctx.strokeStyle = '#38bdf8';
        ctx.beginPath();
        ctx.ellipse(cx - 20, cy + 5, 72, 58, 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Nucleus
        ctx.fillStyle = 'rgba(192, 132, 252, 0.35)';
        ctx.strokeStyle = '#c084fc';
        ctx.beginPath();
        ctx.arc(cx + 80, cy - 45, 28, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Chloroplasts
        [
          [cx - 95, cy - 70],
          [cx + 80, cy + 62],
          [cx - 88, cy + 70],
        ].forEach(([lx, ly]) => {
          ctx.fillStyle = '#22c55e';
          ctx.beginPath();
          ctx.ellipse(lx, ly, 20, 10, 0.4, 0, Math.PI * 2);
          ctx.fill();
        });

        ctx.fillStyle = '#22c55e';
        ctx.fillText('Plant Cell Ultrastructure', ox + 28, oy + 38);
        ctx.fillStyle = '#cbd5e1';
        ctx.font = '14px monospace';
        ctx.fillText('Cell Wall • Vacuole • Chloroplasts', ox + 55, oy + h - 18);
      } else if (stamp === 'photosynthesis') {
        // Sun rays
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(ox + 95, oy + 125, 30, 0, Math.PI * 2);
        ctx.fill();

        // Glowing Leaf oval
        ctx.fillStyle = 'rgba(34, 197, 94, 0.28)';
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.ellipse(cx, cy + 20, 115, 58, -0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 18px monospace';
        ctx.fillText('6CO₂ + 6H₂O + Light', ox + 95, oy + h - 85);
        ctx.fillStyle = '#34d399';
        ctx.fillText('→ C₆H₁₂O₆ + 6O₂ ↑', ox + 100, oy + h - 55);
        ctx.fillStyle = '#22c55e';
        ctx.font = 'bold 20px sans-serif';
        ctx.fillText('Photosynthesis Bio-Reactor', ox + 28, oy + 38);
      } else if (stamp === 'neuron_synapse') {
        // Soma star
        ctx.fillStyle = 'rgba(244, 63, 94, 0.28)';
        ctx.strokeStyle = '#f43f5e';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(ox + 105, cy, 42, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Axon & Myelin sheaths
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(ox + 147, cy);
        ctx.lineTo(ox + w - 80, cy);
        ctx.stroke();

        [170, 225, 280].forEach((mx) => {
          ctx.fillStyle = 'rgba(56, 189, 248, 0.35)';
          ctx.strokeStyle = '#38bdf8';
          ctx.beginPath();
          ctx.roundRect(ox + mx, cy - 16, 42, 32, 8);
          ctx.fill();
          ctx.stroke();
        });

        // Synaptic terminal
        ctx.strokeStyle = '#c084fc';
        ctx.beginPath();
        ctx.moveTo(ox + w - 80, cy);
        ctx.lineTo(ox + w - 42, cy - 34);
        ctx.moveTo(ox + w - 80, cy);
        ctx.lineTo(ox + w - 42, cy + 34);
        ctx.stroke();

        ctx.fillStyle = '#f43f5e';
        ctx.fillText('Neuron & Saltatory Synapse', ox + 28, oy + 38);
        ctx.fillStyle = '#cbd5e1';
        ctx.font = '14px monospace';
        ctx.fillText('Soma → Myelin Nodes → Neurotransmitters', ox + 36, oy + h - 18);
      } else if (stamp === 'heart_chambers') {
        ctx.strokeStyle = '#f43f5e';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.roundRect(cx - 105, cy - 95, 210, 190, 32);
        ctx.stroke();

        // Septum cross
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy - 95);
        ctx.lineTo(cx, cy + 95);
        ctx.moveTo(cx - 105, cy - 8);
        ctx.lineTo(cx + 105, cy - 8);
        ctx.stroke();

        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 16px monospace';
        ctx.fillText('RA', cx - 65, cy - 45);
        ctx.fillText('RV', cx - 65, cy + 45);
        ctx.fillStyle = '#f43f5e';
        ctx.fillText('LA', cx + 40, cy - 45);
        ctx.fillText('LV (Thick)', cx + 16, cy + 45);

        ctx.fillStyle = '#f43f5e';
        ctx.font = 'bold 20px sans-serif';
        ctx.fillText('4-Chamber Double Circulation', ox + 28, oy + 38);
      } else if (stamp === 'thirukkural_frame') {
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 4;
        ctx.strokeRect(ox + 28, oy + 70, w - 56, h - 130);
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.45)';
        ctx.lineWidth = 2;
        ctx.strokeRect(ox + 38, oy + 80, w - 76, h - 150);

        ctx.fillStyle = '#fbbf24';
        ctx.font = 'bold 20px sans-serif';
        ctx.fillText('திருக்குறள் — குறள் வெண்பா', ox + 28, oy + 38);

        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 21px sans-serif';
        ctx.fillText('கற்க கசடறக் கற்பவை', ox + 65, cy - 35);
        ctx.fillText('கற்றபின் நிற்க அதற்குத் தக.', ox + 65, cy + 12);

        ctx.fillStyle = '#38bdf8';
        ctx.font = '15px sans-serif';
        ctx.fillText('அடி 1: 4 சீர்  |  அடி 2: 3 சீர் (குறள் 391)', ox + 60, oy + h - 85);
      } else {
        // story_arc
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(ox + 35, oy + h - 65);
        ctx.lineTo(ox + 125, oy + h - 65);
        ctx.lineTo(cx, oy + 95);
        ctx.lineTo(ox + w - 105, oy + h - 65);
        ctx.lineTo(ox + w - 35, oy + h - 65);
        ctx.stroke();

        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(cx, oy + 95, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillText('Climax', cx - 32, oy + 82);
        ctx.fillStyle = '#38bdf8';
        ctx.fillText('Freytag Narrative Story Arc', ox + 28, oy + 38);
        ctx.fillStyle = '#cbd5e1';
        ctx.font = '13px monospace';
        ctx.fillText('Exposition → Rising → Climax → Resolution', ox + 42, oy + h - 22);
      }

      ctx.restore();
      pushHistory();
      onBlackboardActivity('draw', `Stamped ${stamp.replace('_', ' ')} diagram on blackboard`);
    },
    [subject.accentHex, pushHistory, onBlackboardActivity]
  );

  // Initialize board and stamp the active concept's diagram automatically
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = BOARD_WIDTH;
    canvas.height = BOARD_HEIGHT;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    paintBackground(ctx, bgStyle);
    chalkCursorYRef.current = 95;
    historyRef.current = [ctx.getImageData(0, 0, BOARD_WIDTH, BOARD_HEIGHT)];
    historyIdxRef.current = 0;
    setCanUndo(false);
    setCanRedo(false);
    drawDiagramStampOnCanvas(activeConcept.diagramStamp);
  }, [subject.id, activeConcept.id]);

  // Write chalk text neatly in the left column of the blackboard
  const writeChalkTextToCanvas = useCallback(
    (text: string, color = '#f8fafc', fontSize = 22, isHeading = false) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.save();
      ctx.fillStyle = color;
      ctx.font = `${isHeading ? 'bold ' : ''}${fontSize}px "Plus Jakarta Sans", sans-serif`;
      if (neonGlow) {
        ctx.shadowColor = color;
        ctx.shadowBlur = 8;
      }

      const maxWidth = 680;
      const words = text.split(/\s+/);
      let line = '';
      let y = chalkCursorYRef.current;

      for (let i = 0; i < words.length; i++) {
        const testLine = line ? `${line} ${words[i]}` : words[i];
        if (ctx.measureText(testLine).width > maxWidth && line) {
          ctx.fillText(line, 34, y);
          line = words[i];
          y += fontSize + 10;
        } else {
          line = testLine;
        }
      }
      if (line) {
        ctx.fillText(line, 34, y);
        y += fontSize + 16;
      }

      chalkCursorYRef.current = y > BOARD_HEIGHT - 60 ? 95 : y;
      ctx.restore();
      pushHistory();
    },
    [neonGlow, pushHistory]
  );

  // Coordinate mapping with fixed internal canvas resolution
  const getCanvasCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    isDrawingRef.current = true;
    lastPtRef.current = getCanvasCoords(e);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !lastPtRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pt = getCanvasCoords(e);
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (isEraser) {
      ctx.strokeStyle = '#080e18';
      ctx.lineWidth = brushSize * 5;
      ctx.shadowBlur = 0;
    } else {
      ctx.strokeStyle = chalkColor;
      ctx.lineWidth = brushSize;
      if (neonGlow) {
        ctx.shadowColor = chalkColor;
        ctx.shadowBlur = 10;
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
    pushHistory();
    onBlackboardActivity('draw', `Annotated Smart Blackboard (${subject.name})`);
  };

  const handleClearBoard = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    paintBackground(ctx, bgStyle);
    chalkCursorYRef.current = 95;
    setChalkNotesLog([]);
    pushHistory();
  }, [bgStyle, paintBackground, pushHistory]);

  const handleUndo = () => {
    if (historyIdxRef.current <= 0) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;
    historyIdxRef.current -= 1;
    ctx.putImageData(historyRef.current[historyIdxRef.current], 0, 0);
    setCanUndo(historyIdxRef.current > 0);
    setCanRedo(historyIdxRef.current < historyRef.current.length - 1);
  };

  const handleRedo = () => {
    if (historyIdxRef.current >= historyRef.current.length - 1) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;
    historyIdxRef.current += 1;
    ctx.putImageData(historyRef.current[historyIdxRef.current], 0, 0);
    setCanUndo(historyIdxRef.current > 0);
    setCanRedo(historyIdxRef.current < historyRef.current.length - 1);
  };

  // Handle AI Chalk Solve (either via voice command or typed query)
  const handleAiSolveOnBoard = useCallback(
    async (queryText: string) => {
      const cleaned = queryText.trim();
      if (!cleaned) return;
      setIsSolvingAi(true);
      try {
        const solution = await solveVoiceQueryOnBlackboard(
          subject,
          cleaned,
          chalkNotesLog.join('\n')
        );

        // Stamp recommended diagram first so chalk steps sit cleanly beside it
        if (solution.recommendedDiagram) {
          drawDiagramStampOnCanvas(solution.recommendedDiagram);
        }

        writeChalkTextToCanvas(`⚡ ${solution.headline}`, '#22d3ee', 25, true);
        for (const step of solution.chalkSteps) {
          writeChalkTextToCanvas(step, '#f8fafc', 19, false);
        }
        writeChalkTextToCanvas(`★ ${solution.keyFormula}`, '#fbbf24', 21, true);

        setChalkNotesLog((prev) => [
          ...prev,
          `Q: ${cleaned}`,
          solution.headline,
          ...solution.chalkSteps,
          `Formula: ${solution.keyFormula}`,
        ]);
        onBlackboardActivity('ai_solve', `Solved "${solution.headline}" on Smart Blackboard`);

        if (speakAiAnswer) {
          speechEngine.speak(solution.spokenSummary);
        }
      } finally {
        setIsSolvingAi(false);
      }
    },
    [subject, chalkNotesLog, drawDiagramStampOnCanvas, writeChalkTextToCanvas, onBlackboardActivity, speakAiAnswer]
  );

  // Process final spoken voice segment on the Smart Blackboard
  const processFinalBlackboardSpeech = useCallback(
    (spokenText: string) => {
      const clean = spokenText.trim();
      if (!clean) return;
      const lower = clean.toLowerCase();

      // Voice Command 1: Clear board
      if (lower.includes('clear board') || lower.includes('erase board') || lower.includes('அழி')) {
        handleClearBoard();
        setLiveTranscript('');
        return;
      }

      // Voice Command 2: Instant Draw Diagram
      const diagramMatch: Array<[string[], DiagramStampType]> = [
        [['parabola', 'quadratic'], 'parabola'],
        [['sine wave', 'wave'], 'sine_wave'],
        [['lens', 'optics'], 'ray_optics'],
        [['free body', 'incline', 'ramp'], 'free_body'],
        [['bohr atom', 'atom'], 'bohr_atom'],
        [['benzene', 'aromatic'], 'benzene_ring'],
        [['plant cell'], 'plant_cell'],
        [['photosynthesis'], 'photosynthesis'],
        [['neuron', 'synapse'], 'neuron_synapse'],
        [['heart'], 'heart_chambers'],
        [['kural', 'திருக்குறள்'], 'thirukkural_frame'],
        [['story arc', 'pyramid'], 'story_arc'],
      ];

      if (lower.includes('draw ') || lower.includes('show ') || lower.includes('வரை')) {
        for (const [keywords, stamp] of diagramMatch) {
          if (keywords.some((kw) => lower.includes(kw))) {
            drawDiagramStampOnCanvas(stamp);
            writeChalkTextToCanvas(`🎨 ${clean}`, '#34d399', 22, true);
            setChalkNotesLog((prev) => [...prev, clean]);
            setLiveTranscript('');
            return;
          }
        }
      }

      // Voice Command 3: "Solve ..." or "Explain ..." -> full AI Chalk derivation!
      if (
        lower.startsWith('solve ') ||
        lower.startsWith('explain ') ||
        lower.startsWith('derive ') ||
        lower.startsWith('what is ') ||
        lower.startsWith('how does ') ||
        lower.includes('விளக்கு')
      ) {
        setLiveTranscript('');
        void handleAiSolveOnBoard(clean);
        return;
      }

      // Default: Dictate spoken speech directly onto blackboard in glowing chalk!
      writeChalkTextToCanvas(`🎙️ ${clean}`, chalkColor, 22, false);
      setChalkNotesLog((prev) => [...prev, clean]);
      onBlackboardActivity('voice', `Dictated "${clean.slice(0, 32)}" via Voice Blackboard`);
      setLiveTranscript('');
    },
    [handleClearBoard, drawDiagramStampOnCanvas, writeChalkTextToCanvas, handleAiSolveOnBoard, chalkColor, onBlackboardActivity]
  );

  // Stop local Speech Recognition cleanly on unmount
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

  const toggleBlackboardVoice = async () => {
    if (isListening) {
      stopLocalVoiceRecognition();
      return;
    }
    setMicNotice(null);

    if (Capacitor.isNativePlatform()) {
      try {
        const perm = await SpeechRecognition.requestPermissions();
        if (perm.speechRecognition !== 'granted') {
          setMicNotice('Microphone permission needed for native speech recognition.');
          return;
        }
        nativeActiveRef.current = true;
        setIsListening(true);

        await SpeechRecognition.removeAllListeners();
        await SpeechRecognition.addListener('partialResults', (data: { matches?: string[] }) => {
          if (data.matches?.[0]) {
            setLiveTranscript(data.matches[0]);
          }
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
        if (finalText) {
          processFinalBlackboardSpeech(finalText);
        }
      } catch (err: any) {
        nativeActiveRef.current = false;
        setIsListening(false);
        setMicNotice(err?.message || 'Native speech engine could not start.');
      }
      return;
    }

    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      setMicNotice('Speech Recognition not supported in this browser; type below for AI Chalk Solve.');
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
          if (event.results[i].isFinal) {
            finalSeg += text + ' ';
          } else {
            interim += text;
          }
        }
        if (interim) setLiveTranscript(interim.trim());
        if (finalSeg.trim()) {
          processFinalBlackboardSpeech(finalSeg.trim());
        }
      };

      rec.onerror = (ev: any) => {
        if (ev.error === 'not-allowed') {
          setMicNotice('Microphone permission blocked. Allow mic access or type below.');
        }
        setIsListening(false);
      };

      rec.onend = () => {
        setIsListening(false);
      };

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
      transcriptNotes: chalkNotesLog.join('\n'),
      subjectId: subject.id,
      createdAt: new Date().toISOString(),
    });
  };

  const handleDownloadPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `aura-blackboard-${subject.id}-${Date.now()}.png`;
    a.click();
  };

  const handleSaveToDrive = () => {
    const content = `# Smart Blackboard Notes — ${subject.name}\nConcept: ${activeConcept.title}\n\n## Chalk Notes & Derivations\n${
      chalkNotesLog.length > 0 ? chalkNotesLog.map((l) => `- ${l}`).join('\n') : '- Visual chalkboard sketches'
    }`;
    onSyncToDrive(`Blackboard - ${subject.name} - ${activeConcept.title}`, content);
  };

  return (
    <div className="space-y-3">
      {/* Top Toolbar: Colors, Eraser, Surface, Diagram Stamps, Actions */}
      <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-3 shadow-xl space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Chalk Color Palette */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {CHALK_COLORS.map((c) => (
              <button
                key={c.hex}
                type="button"
                aria-label={`Select ${c.name}`}
                onClick={() => {
                  setChalkColor(c.hex);
                  setIsEraser(false);
                }}
                className={`w-6 h-6 rounded-full transition-transform cursor-pointer border-2 ${
                  !isEraser && chalkColor === c.hex ? 'scale-125 border-white shadow-lg' : 'border-slate-700'
                }`}
                style={{ backgroundColor: c.hex, boxShadow: !isEraser && chalkColor === c.hex ? `0 0 10px ${c.hex}` : undefined }}
                title={c.name}
              />
            ))}

            <button
              type="button"
              onClick={() => setIsEraser(!isEraser)}
              className={`px-2 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1 border cursor-pointer transition-all ${
                isEraser
                  ? 'bg-rose-500/25 text-rose-200 border-rose-400'
                  : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800'
              }`}
              aria-label="Toggle Eraser"
            >
              <Eraser className="w-3.5 h-3.5" />
              <span>Eraser</span>
            </button>

            <label className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400 px-1.5">
              <span>Size</span>
              <input
                type="range"
                min={2}
                max={12}
                value={brushSize}
                onChange={(e) => setBrushSize(Number(e.target.value))}
                className="w-16 accent-cyan-400"
                aria-label="Brush Size"
              />
            </label>

            <button
              type="button"
              onClick={() => setNeonGlow(!neonGlow)}
              className={`px-2 py-1 rounded-xl text-[10px] font-mono font-bold border cursor-pointer ${
                neonGlow
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                  : 'bg-slate-950 text-slate-400 border-slate-800'
              }`}
            >
              ✨ Neon {neonGlow ? 'ON' : 'OFF'}
            </button>
          </div>

          {/* Undo / Redo / Clear / Export */}
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
              title="Clear Blackboard"
              aria-label="Clear Blackboard"
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
              title="Save Blackboard Notes to Google Drive"
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

        {/* Diagram Auto-Stamps + Surface Selector */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-mono uppercase text-slate-400 flex items-center gap-1">
              <Wand2 className="w-3 h-3 text-purple-400" />
              Auto-Draw:
            </span>
            {subject.defaultDiagrams.map((d) => (
              <button
                key={d.type}
                type="button"
                onClick={() => drawDiagramStampOnCanvas(d.type)}
                className="px-2 py-1 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700/80 text-xs text-slate-200 flex items-center gap-1 transition-all cursor-pointer"
              >
                <span>{d.emoji}</span>
                <span className="text-[11px] font-semibold">{d.label}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 text-[10px] font-mono">
            <Grid className="w-3 h-3 text-slate-400 mr-0.5" />
            {(['grid', 'slate', 'lined', 'dots'] as BoardBgStyle[]).map((style) => (
              <button
                key={style}
                type="button"
                onClick={() => {
                  setBgStyle(style);
                  const ctx = canvasRef.current?.getContext('2d');
                  if (ctx) {
                    paintBackground(ctx, style);
                    pushHistory();
                  }
                }}
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
          INTERACTIVE NEON CHALKBOARD CANVAS
          ===================================================================== */}
      <div className="relative rounded-3xl overflow-hidden border-2 border-slate-800 shadow-2xl chalk-board-surface">
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="w-full aspect-[16/10] sm:aspect-[16/9] touch-none cursor-crosshair block"
        />

        {/* Floating Live Speech Caption Chalk Strip */}
        {(isListening || liveTranscript) && (
          <div className="absolute bottom-3 left-3 right-3 px-3.5 py-2 rounded-2xl bg-slate-950/90 border border-cyan-500/50 backdrop-blur-md flex items-center justify-between gap-3 shadow-2xl">
            <div className="flex items-center gap-2 min-w-0">
              {/* Live Waveform Visualizer */}
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
                {liveTranscript || `Listening in ${speechLang === 'ta-IN' ? 'தமிழ்' : 'English'}… Say "Solve …", "Draw …", or dictate notes`}
              </span>
            </div>
            <span className="text-[10px] font-mono text-cyan-400 shrink-0 uppercase font-bold">
              LIVE VOICE
            </span>
          </div>
        )}
      </div>

      {/* =====================================================================
          VOICE-TO-CHALK & AI CHALK SOLVER CONTROL STRIP
          ===================================================================== */}
      <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-3 shadow-xl space-y-2">
        {micNotice && (
          <div className="px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-xs text-amber-200">
            {micNotice}
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {/* Mic Trigger + Language Pill */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={toggleBlackboardVoice}
              className={`px-3.5 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-lg ${
                isListening
                  ? 'bg-rose-600 hover:bg-rose-500 text-white animate-pulse'
                  : 'bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white'
              }`}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              <span>{isListening ? 'Stop Chalk Mic' : 'Voice to Chalk'}</span>
            </button>

            <button
              type="button"
              onClick={() =>
                setSpeechLang((prev) => (prev === 'ta-IN' ? 'en-IN' : 'ta-IN'))
              }
              className="px-2.5 py-2.5 rounded-2xl bg-slate-950 border border-slate-700 text-xs font-bold text-amber-300 hover:bg-slate-800 cursor-pointer"
              title="Toggle Speech Recognition Language (English / Tamil)"
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
              title="Toggle Voice Readout of AI Chalk Solutions"
              aria-label="Toggle Voice Readout"
            >
              <Volume2 className="w-4 h-4" />
            </button>
          </div>

          {/* Direct Type-or-Voice AI Solve Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const q = spokenInputQuery;
              setSpokenInputQuery('');
              void handleAiSolveOnBoard(q);
            }}
            className="flex-1 flex items-center gap-2"
          >
            <input
              type="text"
              value={spokenInputQuery}
              onChange={(e) => setSpokenInputQuery(e.target.value)}
              placeholder={`Ask AI to chalk-solve in ${subject.name} (e.g. "Solve quadratic x²-5x+6=0" or "Explain photosynthesis")`}
              className="flex-1 px-3 py-2.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
            />
            <button
              type="submit"
              disabled={isSolvingAi || !spokenInputQuery.trim()}
              className="px-3.5 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 disabled:opacity-45 text-slate-950 text-xs font-bold flex items-center gap-1.5 shrink-0 cursor-pointer shadow-lg"
            >
              {isSolvingAi ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Zap className="w-4 h-4" />
              )}
              <span>AI Solve</span>
              <Send className="w-3 h-3 hidden sm:inline" />
            </button>
          </form>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono text-slate-400 pt-0.5">
          <Sparkles className="w-3 h-3 text-cyan-400" />
          <span>Voice Tips:</span>
          <span className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-300">
            "Solve …"
          </span>
          <span className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-300">
            "Draw parabola / atom / neuron"
          </span>
          <span className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-300">
            "Clear board"
          </span>
        </div>
      </div>
    </div>
  );
};
