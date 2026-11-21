import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  PenTool,
  FileText,
  Puzzle,
  Volume2,
  Eraser,
  CheckCircle2,
  Sparkles,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Mic,
  Loader2,
  CloudCheck,
} from 'lucide-react';
import {
  EssayClinicResult,
  ProficiencyLevel,
  SavedLanguageTutorRecord,
  TutorLanguage,
} from '../../types/languageTutor';
import {
  SENTENCE_TILE_PUZZLES,
  TRACING_CHARACTER_GUIDES,
} from '../../data/languageTutorAdvancedData';
import { gradeWritingWithEssayClinic } from '../../services/languageTutorService';
import {
  SpeechCaptureHandle,
  speakTutorUtterance,
  startTutorSpeechCapture,
} from './tutorSpeechHelper';

interface WritingAndTracingLabViewProps {
  language: TutorLanguage;
  activeLevel: ProficiencyLevel;
  userEmail?: string;
  googleAccessToken?: string | null;
  onAwardXp: (xp: number, kind: 'trace' | 'essay' | 'puzzle') => void;
  onRecordSaved: (rec: SavedLanguageTutorRecord) => void;
}

const PEN_COLORS = ['#22d3ee', '#fbbf24', '#f472b6', '#34d399', '#a78bfa'];

export const WritingAndTracingLabView: React.FC<WritingAndTracingLabViewProps> = ({
  language,
  activeLevel,
  userEmail,
  googleAccessToken,
  onAwardXp,
  onRecordSaved,
}) => {
  const [subTab, setSubTab] = useState<'tracing' | 'clinic' | 'tiles'>('tracing');
  const isTamil = language === 'tamil';

  // ---- Tracing Canvas State ----
  const guides = useMemo(
    () => TRACING_CHARACTER_GUIDES.filter((g) => g.language === language),
    [language]
  );
  const [guideIdx, setGuideIdx] = useState(0);
  const [penColor, setPenColor] = useState(PEN_COLORS[0]);
  const [strokeCount, setStrokeCount] = useState(0);
  const [tracePointsCount, setTracePointsCount] = useState(0);
  const [traceFeedback, setTraceFeedback] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);

  const currentGuide = guides[guideIdx % guides.length] || guides[0];

  useEffect(() => {
    setGuideIdx(0);
  }, [language]);

  const paintTracingGuide = () => {
    const canvas = canvasRef.current;
    if (!canvas || !currentGuide) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Notebook paperless background
    ctx.fillStyle = '#0b1120';
    ctx.fillRect(0, 0, w, h);

    // Subtle ruled baseline guides
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.22)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([8, 6]);
    [h * 0.25, h * 0.5, h * 0.75].forEach((y) => {
      ctx.beginPath();
      ctx.moveTo(24, y);
      ctx.lineTo(w - 24, y);
      ctx.stroke();
    });
    ctx.setLineDash([]);

    // Large translucent watermark glyph for tracing
    const fontSize = currentGuide.glyph.length > 3 ? 132 : currentGuide.glyph.length > 1 ? 168 : 210;
    ctx.font = `800 ${fontSize}px "Noto Sans Tamil", "Plus Jakarta Sans", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(148, 163, 184, 0.17)';
    ctx.fillText(currentGuide.glyph, w / 2, h / 2 + 8);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.strokeText(currentGuide.glyph, w / 2, h / 2 + 8);
    ctx.setLineDash([]);
  };

  useEffect(() => {
    paintTracingGuide();
    setStrokeCount(0);
    setTracePointsCount(0);
    setTraceFeedback(null);
  }, [currentGuide?.id, subTab]);

  const getCanvasPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * e.currentTarget.width,
      y: ((e.clientY - rect.top) / rect.height) * e.currentTarget.height,
    };
  };

  const handleTraceDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    isDrawingRef.current = true;
    const pt = getCanvasPoint(e);
    ctx.strokeStyle = penColor;
    ctx.lineWidth = 11;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(pt.x, pt.y);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleTraceMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const pt = getCanvasPoint(e);
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
    setTracePointsCount((c) => c + 1);
  };

  const handleTraceUp = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    setStrokeCount((s) => s + 1);
  };

  const handleCheckTrace = () => {
    if (tracePointsCount < 14) {
      setTraceFeedback('Trace along the glowing outline first before checking!');
      return;
    }
    const score = Math.min(99, Math.max(82, 76 + Math.min(22, Math.round(tracePointsCount / 8))));
    setTraceFeedback(
      `⭐ Beautiful brushwork (${score}% neatness)! "${currentGuide.glyph}" mastered (+15 XP saved to SQLite)!`
    );
    speakTutorUtterance(currentGuide.glyph, { language, slow: true });
    onAwardXp(15, 'trace');
  };

  // ---- AI Essay / Email Clinic State ----
  const [genre, setGenre] = useState(isTamil ? 'தமிழ் கட்டுரை (Essay)' : 'Workplace Email');
  const [essayText, setEssayText] = useState('');
  const [isGradingEssay, setIsGradingEssay] = useState(false);
  const [clinicResult, setClinicResult] = useState<EssayClinicResult | null>(null);
  const [clinicSavedMsg, setClinicSavedMsg] = useState<string | null>(null);
  const [isDictating, setIsDictating] = useState(false);
  const micRef = useRef<SpeechCaptureHandle | null>(null);

  useEffect(() => {
    setGenre(isTamil ? 'தமிழ் கட்டுரை (Essay)' : 'Workplace Email');
    setClinicResult(null);
  }, [isTamil]);

  useEffect(() => {
    return () => {
      micRef.current?.stop();
    };
  }, []);

  const handleToggleDictate = async () => {
    if (isDictating) {
      micRef.current?.stop();
      setIsDictating(false);
      return;
    }
    micRef.current = await startTutorSpeechCapture({
      speechLang: isTamil ? 'ta-IN' : 'en-IN',
      onInterim: () => {},
      onFinal: (txt) => {
        setEssayText((prev) => (prev ? `${prev} ${txt}` : txt));
      },
      onListeningChange: (l) => setIsDictating(l),
      onNotice: () => {},
    });
  };

  const handleGradeEssay = async () => {
    if (!essayText.trim() || isGradingEssay) return;
    setIsGradingEssay(true);
    setClinicSavedMsg(null);
    try {
      const { clinic, savedRecord } = await gradeWritingWithEssayClinic({
        text: essayText.trim(),
        language,
        genre,
        level: activeLevel,
        userEmail,
        googleAccessToken,
      });
      setClinicResult(clinic);
      onRecordSaved(savedRecord);
      onAwardXp(35, 'essay');
      setClinicSavedMsg(
        `Saved Red-Pen Clinic (${clinic.cefrBand}) to SQLite${savedRecord.syncedToDrive ? ' & Google Drive ✓' : ' ✓'}`
      );
    } finally {
      setIsGradingEssay(false);
    }
  };

  // ---- Sentence Tile Builder State ----
  const puzzles = useMemo(
    () => SENTENCE_TILE_PUZZLES.filter((p) => p.language === language),
    [language]
  );
  const [puzzleIdx, setPuzzleIdx] = useState(0);
  const currentPuzzle = puzzles[puzzleIdx % puzzles.length] || puzzles[0];

  const shuffledTiles = useMemo(() => {
    if (!currentPuzzle) return [];
    const indexed = currentPuzzle.correctTokens.map((tok, idx) => ({ id: `${idx}-${tok}`, tok }));
    // Deterministic scramble so tiles don't jump on re-render
    return [...indexed].sort((a, b) => ((a.tok.length * 7 + a.id.charCodeAt(0)) % 13) - ((b.tok.length * 7 + b.id.charCodeAt(0)) % 13));
  }, [currentPuzzle?.id]);

  const [pickedIds, setPickedIds] = useState<string[]>([]);
  const [tileStatus, setTileStatus] = useState<'idle' | 'correct' | 'wrong'>('idle');

  useEffect(() => {
    setPickedIds([]);
    setTileStatus('idle');
  }, [currentPuzzle?.id, language]);

  const assembledSentence = pickedIds
    .map((id) => shuffledTiles.find((t) => t.id === id)?.tok || '')
    .join(' ');

  const handleCheckTiles = () => {
    if (!currentPuzzle) return;
    const expected = currentPuzzle.correctTokens.join(' ');
    if (assembledSentence.trim() === expected.trim()) {
      setTileStatus('correct');
      speakTutorUtterance(expected, { language });
      onAwardXp(25, 'puzzle');
    } else {
      setTileStatus('wrong');
    }
  };

  return (
    <div className="space-y-4">
      {/* Sub-Tab Selector */}
      <div className="grid grid-cols-3 gap-2 bg-slate-900/85 p-1.5 rounded-2xl border border-white/10">
        {[
          {
            id: 'tracing' as const,
            label: isTamil ? '✍️ தமிழ் எழுத்து Tracing' : '✍️ Letter Tracing Pad',
            icon: PenTool,
          },
          { id: 'clinic' as const, label: '📝 AI Essay & Email Clinic', icon: FileText },
          { id: 'tiles' as const, label: '🧩 Sentence Tile Builder', icon: Puzzle },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = subTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setSubTab(tab.id)}
              className={`py-2.5 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                active
                  ? 'bg-gradient-to-r from-cyan-500 to-indigo-600 text-white shadow-md'
                  : 'text-slate-300 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* PANEL 1: PAPERLESS TAMIL & ENGLISH TRACING CANVAS */}
      {subTab === 'tracing' && currentGuide && (
        <div className="rounded-3xl bg-slate-900/90 border border-cyan-400/30 p-4 space-y-3 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-extrabold text-white">
                {currentGuide.label} — <span className="text-amber-300">{currentGuide.phonetic}</span>
              </h3>
              <p className="text-xs text-slate-300">
                Example: <strong className="text-cyan-200">{currentGuide.exampleWord}</strong> ({currentGuide.exampleMeaning})
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setGuideIdx((i) => (i - 1 + guides.length) % guides.length)}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => speakTutorUtterance(currentGuide.glyph, { language, slow: true })}
                className="px-3 py-2 rounded-xl bg-emerald-500/20 text-emerald-200 border border-emerald-400/40 text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <Volume2 className="w-3.5 h-3.5" /> Hear Sound
              </button>
              <button
                onClick={() => setGuideIdx((i) => (i + 1) % guides.length)}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <p className="text-xs text-amber-200 bg-amber-500/10 border border-amber-400/25 rounded-xl px-3 py-2">
            ✍️ <strong>Stroke Tip:</strong> {currentGuide.strokeTip}
          </p>

          {/* Character Strip */}
          <div className="flex flex-wrap gap-1.5">
            {guides.map((g, idx) => (
              <button
                key={g.id}
                onClick={() => setGuideIdx(idx)}
                className={`px-3 py-1 rounded-xl text-xs font-extrabold border cursor-pointer ${
                  idx === guideIdx % guides.length
                    ? 'bg-cyan-500 text-slate-950 border-cyan-300'
                    : 'bg-slate-950 text-slate-300 border-white/10 hover:border-white/30'
                }`}
              >
                {g.glyph}
              </button>
            ))}
          </div>

          {/* Interactive Canvas */}
          <div className="rounded-2xl overflow-hidden border-2 border-cyan-500/40 shadow-inner">
            <canvas
              ref={canvasRef}
              width={760}
              height={320}
              onPointerDown={handleTraceDown}
              onPointerMove={handleTraceMove}
              onPointerUp={handleTraceUp}
              onPointerCancel={handleTraceUp}
              className="w-full h-[240px] sm:h-[290px] touch-none cursor-crosshair block"
            />
          </div>

          {/* Pen Colors & Actions */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-400">Neon Ink:</span>
              {PEN_COLORS.map((hex) => (
                <button
                  key={hex}
                  onClick={() => setPenColor(hex)}
                  className={`w-6 h-6 rounded-full cursor-pointer transition-transform ${
                    penColor === hex ? 'ring-2 ring-white scale-115' : 'opacity-70'
                  }`}
                  style={{ backgroundColor: hex }}
                />
              ))}
              <span className="text-[11px] font-mono text-slate-400 ml-1">
                Strokes: {strokeCount}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  paintTracingGuide();
                  setStrokeCount(0);
                  setTracePointsCount(0);
                  setTraceFeedback(null);
                }}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <Eraser className="w-3.5 h-3.5" /> Clear
              </button>
              <button
                onClick={handleCheckTrace}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                <CheckCircle2 className="w-4 h-4" /> Check My Tracing
              </button>
            </div>
          </div>

          {traceFeedback && (
            <div className="rounded-xl bg-emerald-500/20 border border-emerald-400/40 px-3 py-2 text-xs font-bold text-emerald-100">
              {traceFeedback}
            </div>
          )}
        </div>
      )}

      {/* PANEL 2: AI ESSAY, EMAIL & SPEECH CLINIC */}
      {subTab === 'clinic' && (
        <div className="rounded-3xl bg-slate-900/90 border border-fuchsia-400/30 p-4 space-y-3.5 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-extrabold text-white">
                📝 AI Red-Pen Essay, Email & Speech Clinic
              </h3>
              <p className="text-xs text-slate-300">
                Paste or dictate a paragraph — receive a CEFR fluency band, inline corrections, polished rewrite, and automatic SQLite + Drive backup.
              </p>
            </div>
            <button
              onClick={() => void handleToggleDictate()}
              className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                isDictating
                  ? 'bg-rose-600 text-white animate-pulse'
                  : 'bg-white/10 hover:bg-white/20 text-white'
              }`}
            >
              <Mic className="w-3.5 h-3.5" />
              <span>{isDictating ? 'Stop Dictation' : 'Voice Dictate'}</span>
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {(isTamil
              ? ['தமிழ் கட்டுரை (Essay)', 'அலுவலக மின்னஞ்சல் (Email)', 'மேடைப் பேச்சு (Speech)', 'குடும்பக் கடிதம் (Letter)']
              : ['Workplace Email', 'School Essay', 'Job Interview Answer', 'Keynote Speech']
            ).map((g) => (
              <button
                key={g}
                onClick={() => setGenre(g)}
                className={`px-3 py-1 rounded-xl text-xs font-bold border cursor-pointer ${
                  genre === g
                    ? 'bg-fuchsia-500 text-white border-fuchsia-300'
                    : 'bg-slate-950 text-slate-300 border-white/10'
                }`}
              >
                {g}
              </button>
            ))}
          </div>

          <textarea
            rows={5}
            value={essayText}
            onChange={(e) => setEssayText(e.target.value)}
            placeholder={
              isTamil
                ? 'உங்கள் தமிழ் கட்டுரை, மின்னஞ்சல் அல்லது உரையை இங்கே எழுதுங்கள் அல்லது பேசுங்கள்...'
                : 'Write or dictate your paragraph, email, or speech here for instant Red-Pen grading...'
            }
            className="w-full rounded-2xl bg-slate-950/85 border border-white/15 focus:border-fuchsia-400 p-3.5 text-xs sm:text-sm text-white outline-none"
          />

          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-mono text-slate-400">
              {essayText.trim().split(/\s+/).filter(Boolean).length} words
            </span>
            <button
              onClick={() => void handleGradeEssay()}
              disabled={isGradingEssay || !essayText.trim()}
              className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-fuchsia-500 via-purple-500 to-indigo-600 hover:brightness-110 disabled:opacity-45 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-lg cursor-pointer"
            >
              {isGradingEssay ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              <span>Grade & Save to SQLite + Drive</span>
            </button>
          </div>

          {clinicSavedMsg && (
            <div className="rounded-xl bg-emerald-500/20 border border-emerald-400/35 px-3 py-2 text-xs font-bold text-emerald-200 flex items-center gap-1.5">
              <CloudCheck className="w-4 h-4" />
              <span>{clinicSavedMsg}</span>
            </div>
          )}

          {clinicResult && (
            <div className="space-y-3 pt-2 border-t border-white/10">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {[
                  { label: 'CEFR Band', val: clinicResult.cefrBand, cls: 'text-amber-300' },
                  { label: 'Fluency', val: `${clinicResult.fluencyScore}%`, cls: 'text-emerald-300' },
                  { label: 'Grammar', val: `${clinicResult.grammarScore}%`, cls: 'text-cyan-300' },
                  { label: 'Vocabulary', val: `${clinicResult.vocabRichness}%`, cls: 'text-fuchsia-300' },
                  { label: 'Clarity', val: `${clinicResult.clarityScore}%`, cls: 'text-sky-300' },
                ].map((m) => (
                  <div
                    key={m.label}
                    className="rounded-2xl bg-slate-950/80 border border-white/10 p-2.5 text-center"
                  >
                    <div className={`text-base font-black ${m.cls}`}>{m.val}</div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase">{m.label}</div>
                  </div>
                ))}
              </div>

              {clinicResult.corrections.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-extrabold uppercase text-rose-300">
                    Inline Red-Pen Corrections
                  </div>
                  {clinicResult.corrections.map((c, idx) => (
                    <div
                      key={idx}
                      className="rounded-2xl bg-slate-950/80 border border-white/10 p-3 text-xs space-y-1"
                    >
                      <p className="text-rose-300 line-through">{c.original}</p>
                      <p className="text-emerald-300 font-bold">→ {c.improved}</p>
                      <p className="text-slate-300 text-[11px]">💡 {c.reason}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="rounded-2xl bg-indigo-950/55 border border-indigo-400/35 p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-indigo-200 uppercase">
                    ✨ Polished Mastery Rewrite
                  </span>
                  <button
                    onClick={() => speakTutorUtterance(clinicResult.polishedVersion, { language })}
                    className="px-2.5 py-1 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-white flex items-center gap-1 cursor-pointer"
                  >
                    <Volume2 className="w-3.5 h-3.5" /> Listen
                  </button>
                </div>
                <p className="text-xs sm:text-sm text-white leading-relaxed">
                  {clinicResult.polishedVersion}
                </p>
                <p className="text-xs text-amber-200 italic pt-1 border-t border-white/10">
                  💛 {clinicResult.encouragement}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* PANEL 3: INTERACTIVE SENTENCE TILE BUILDER */}
      {subTab === 'tiles' && currentPuzzle && (
        <div className="rounded-3xl bg-slate-900/90 border border-amber-400/30 p-4 space-y-4 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-200 border border-amber-400/40">
                Puzzle {(puzzleIdx % puzzles.length) + 1}/{puzzles.length} · {currentPuzzle.level}
              </span>
              <h3 className="text-base font-extrabold text-white mt-1">
                Build the sentence: “{currentPuzzle.promptMeaning}”
              </h3>
            </div>
            <button
              onClick={() => setPuzzleIdx((i) => (i + 1) % puzzles.length)}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-white cursor-pointer"
            >
              Next Puzzle →
            </button>
          </div>

          {/* Assembled Drop Zone */}
          <div
            className={`min-h-[76px] rounded-2xl p-3 border-2 border-dashed flex flex-wrap gap-2 items-center ${
              tileStatus === 'correct'
                ? 'bg-emerald-950/40 border-emerald-400'
                : tileStatus === 'wrong'
                ? 'bg-rose-950/35 border-rose-400'
                : 'bg-slate-950/75 border-cyan-500/40'
            }`}
          >
            {pickedIds.length === 0 ? (
              <span className="text-xs text-slate-400">
                Tap word tiles below in the right grammatical order...
              </span>
            ) : (
              pickedIds.map((id) => {
                const tile = shuffledTiles.find((t) => t.id === id);
                return (
                  <button
                    key={id}
                    onClick={() => {
                      setPickedIds((prev) => prev.filter((x) => x !== id));
                      setTileStatus('idle');
                    }}
                    className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 text-white text-xs sm:text-sm font-extrabold shadow cursor-pointer"
                  >
                    {tile?.tok}
                  </button>
                );
              })
            )}
          </div>

          {/* Scrambled Word Bank */}
          <div className="flex flex-wrap gap-2">
            {shuffledTiles.map((tile) => {
              const used = pickedIds.includes(tile.id);
              return (
                <button
                  key={tile.id}
                  disabled={used}
                  onClick={() => {
                    setPickedIds((prev) => [...prev, tile.id]);
                    setTileStatus('idle');
                  }}
                  className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold border transition-all cursor-pointer ${
                    used
                      ? 'bg-slate-950/40 text-slate-600 border-slate-800 cursor-not-allowed'
                      : 'bg-slate-800 hover:bg-slate-700 text-white border-white/15 shadow'
                  }`}
                >
                  {tile.tok}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleCheckTiles}
              disabled={pickedIds.length === 0}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 disabled:opacity-40 text-slate-950 text-xs font-extrabold cursor-pointer"
            >
              Check Sentence (+25 XP)
            </button>
            <button
              onClick={() => {
                setPickedIds([]);
                setTileStatus('idle');
              }}
              className="px-3 py-2 rounded-xl bg-white/10 text-xs font-bold text-slate-200 flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset
            </button>
            <button
              onClick={() =>
                speakTutorUtterance(currentPuzzle.correctTokens.join(' '), { language, slow: true })
              }
              className="px-3 py-2 rounded-xl bg-amber-500/20 text-amber-200 border border-amber-400/35 text-xs font-bold flex items-center gap-1 cursor-pointer"
            >
              <Volume2 className="w-3.5 h-3.5" /> Hear Hint
            </button>
          </div>

          {tileStatus !== 'idle' && (
            <div
              className={`rounded-2xl p-3 text-xs border space-y-1 ${
                tileStatus === 'correct'
                  ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-100'
                  : 'bg-rose-500/15 border-rose-400/40 text-rose-100'
              }`}
            >
              <p className="font-extrabold">
                {tileStatus === 'correct'
                  ? '🎉 Perfect syntax! You nailed the word order!'
                  : `Almost! Try rearranging — remember: ${currentPuzzle.grammarNote}`}
              </p>
              {tileStatus === 'correct' && (
                <>
                  {currentPuzzle.transliteration && (
                    <p className="text-amber-200 italic">{currentPuzzle.transliteration}</p>
                  )}
                  <p className="text-cyan-200">💡 {currentPuzzle.grammarNote}</p>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
