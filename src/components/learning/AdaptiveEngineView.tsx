import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles,
  Volume2,
  VolumeX,
  HelpCircle,
  CheckCircle2,
  XCircle,
  Flame,
  Zap,
  ArrowRight,
  Compass,
  PenTool,
  ClipboardCheck,
  Loader2,
  Lightbulb,
} from 'lucide-react';
import {
  AdaptiveQuestion,
  ConceptNode,
  DifficultyLevel,
  LearningStyle,
  SubjectDefinition,
} from '../../types/adaptiveLearning';
import {
  AdaptiveLessonContent,
  computeMasteryDelta,
  computeNextDifficulty,
  generateAdaptiveLesson,
  generateDynamicAdaptiveQuestion,
} from '../../services/adaptiveLearningService';
import { speechEngine } from '../../services/speech';
import { CelebrationBurst } from './NeuralCanvasBackdrop';

interface AdaptiveEngineViewProps {
  subject: SubjectDefinition;
  masteryMap: Record<string, number>;
  selectedConceptId: string;
  onSelectConcept: (conceptId: string) => void;
  difficulty: DifficultyLevel;
  onChangeDifficulty: (level: DifficultyLevel) => void;
  learningStyle: LearningStyle;
  onChangeLearningStyle: (style: LearningStyle) => void;
  onMasteryUpdate: (
    conceptId: string,
    delta: number,
    isCorrect: boolean,
    responseTimeSec: number,
    calibrationNote: string
  ) => void;
  onSendConceptToBlackboard: (concept: ConceptNode) => void;
  onSendToGrader: (concept: ConceptNode) => void;
}

const DIFFICULTIES: Array<{ id: DifficultyLevel; label: string; color: string }> = [
  { id: 'foundation', label: 'Foundation', color: 'text-emerald-300 border-emerald-500/40 bg-emerald-500/15' },
  { id: 'core', label: 'Core', color: 'text-sky-300 border-sky-500/40 bg-sky-500/15' },
  { id: 'honors', label: 'Honors', color: 'text-purple-300 border-purple-500/40 bg-purple-500/15' },
  { id: 'olympiad', label: 'Olympiad', color: 'text-amber-300 border-amber-500/40 bg-amber-500/15' },
];

const LEARNING_STYLES: Array<{ id: LearningStyle; label: string; emoji: string }> = [
  { id: 'visual', label: 'Visual', emoji: '🎨' },
  { id: 'socratic', label: 'Socratic', emoji: '🧠' },
  { id: 'hands_on', label: 'Hands-On', emoji: '⚡' },
  { id: 'exam_prep', label: 'Exam Prep', emoji: '🎯' },
];

export const AdaptiveEngineView: React.FC<AdaptiveEngineViewProps> = ({
  subject,
  masteryMap,
  selectedConceptId,
  onSelectConcept,
  difficulty,
  onChangeDifficulty,
  learningStyle,
  onChangeLearningStyle,
  onMasteryUpdate,
  onSendConceptToBlackboard,
  onSendToGrader,
}) => {
  const selectedConcept =
    subject.concepts.find((c) => c.id === selectedConceptId) || subject.concepts[0];

  // AI Micro-Lesson State
  const [lesson, setLesson] = useState<AdaptiveLessonContent | null>(null);
  const [isGeneratingLesson, setIsGeneratingLesson] = useState(false);
  const [isSpeakingLesson, setIsSpeakingLesson] = useState(false);

  // Adaptive Quiz State
  const [questionPool, setQuestionPool] = useState<AdaptiveQuestion[]>(subject.questions);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [streak, setStreak] = useState(0);
  const [calibrationBanner, setCalibrationBanner] = useState<string | null>(null);
  const [isGeneratingQuestion, setIsGeneratingQuestion] = useState(false);
  const [celebrateKey, setCelebrateKey] = useState(0);
  const questionStartRef = useRef<number>(Date.now());

  // Sync question pool when subject switches
  useEffect(() => {
    setQuestionPool(subject.questions);
    setQuestionIndex(0);
    setSelectedOption(null);
    setShowHint(false);
    setLesson(null);
    setCalibrationBanner(null);
    questionStartRef.current = Date.now();
  }, [subject]);

  // Reset quiz selection on concept click (focus matching question if available)
  const handleSelectConceptNode = (concept: ConceptNode) => {
    onSelectConcept(concept.id);
    setLesson(null);
    const matchingIdx = questionPool.findIndex((q) => q.conceptId === concept.id);
    if (matchingIdx !== -1) {
      setQuestionIndex(matchingIdx);
      setSelectedOption(null);
      setShowHint(false);
      questionStartRef.current = Date.now();
    }
  };

  const handleGenerateLesson = async () => {
    setIsGeneratingLesson(true);
    try {
      const content = await generateAdaptiveLesson(
        subject,
        selectedConcept,
        difficulty,
        learningStyle
      );
      setLesson(content);
    } finally {
      setIsGeneratingLesson(false);
    }
  };

  const handleReadConceptAloud = () => {
    if (isSpeakingLesson) {
      speechEngine.stopSpeaking();
      setIsSpeakingLesson(false);
      return;
    }
    const textToSpeak = lesson
      ? `${lesson.title}. ${lesson.explanation} ${lesson.analogy}`
      : `${selectedConcept.nativeTitle || selectedConcept.title}. ${selectedConcept.summary}. ${selectedConcept.keyFormulaOrQuote}`;
    setIsSpeakingLesson(true);
    speechEngine.speak(textToSpeak, {
      onEnd: () => setIsSpeakingLesson(false),
    });
  };

  const currentQuestion = questionPool[questionIndex] || subject.questions[0];

  const handleAnswerOption = (optIdx: number) => {
    if (selectedOption !== null) return;
    setSelectedOption(optIdx);

    const responseTimeSec = Math.max(1, Math.round((Date.now() - questionStartRef.current) / 1000));
    const isCorrect = optIdx === currentQuestion.correctIndex;
    const nextStreak = isCorrect ? streak + 1 : 0;
    setStreak(nextStreak);

    const { nextDifficulty, reason } = computeNextDifficulty(
      difficulty,
      isCorrect,
      nextStreak,
      responseTimeSec
    );
    const delta = computeMasteryDelta(difficulty, isCorrect, showHint);

    if (nextDifficulty !== difficulty) {
      onChangeDifficulty(nextDifficulty);
    }
    setCalibrationBanner(reason);
    if (isCorrect) {
      setCelebrateKey((k) => k + 1);
    }

    onMasteryUpdate(
      currentQuestion.conceptId || selectedConcept.id,
      delta,
      isCorrect,
      responseTimeSec,
      reason
    );
  };

  const handleNextCuratedQuestion = () => {
    const nextIdx = (questionIndex + 1) % questionPool.length;
    setQuestionIndex(nextIdx);
    setSelectedOption(null);
    setShowHint(false);
    questionStartRef.current = Date.now();
  };

  const handleGenerateFreshAiQuestion = async () => {
    setIsGeneratingQuestion(true);
    try {
      const freshQ = await generateDynamicAdaptiveQuestion(subject, selectedConcept, difficulty);
      setQuestionPool((prev) => [freshQ, ...prev]);
      setQuestionIndex(0);
      setSelectedOption(null);
      setShowHint(false);
      questionStartRef.current = Date.now();
    } finally {
      setIsGeneratingQuestion(false);
    }
  };

  const selectedMastery = Math.min(
    100,
    Math.max(0, masteryMap[selectedConcept.id] ?? selectedConcept.mastery)
  );

  return (
    <div className="space-y-4">
      <CelebrationBurst triggerKey={celebrateKey} color={subject.accentHex} />

      {/* =====================================================================
          1. INTERACTIVE NEURAL CONCEPT KNOWLEDGE GRAPH
          ===================================================================== */}
      <div className="rounded-3xl bg-slate-900/85 border border-slate-800/90 p-3.5 sm:p-4 shadow-2xl backdrop-blur-xl relative overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div>
            <div className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full animate-pulse"
                style={{ backgroundColor: subject.accentHex, boxShadow: `0 0 12px ${subject.accentHex}` }}
              />
              <h3 className="text-xs sm:text-sm font-bold text-white tracking-tight">
                Synaptic Concept Graph — {subject.name}
              </h3>
            </div>
            <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5">
              Tap any neural node to inspect mastery, calibrate difficulty, or launch AI teaching.
            </p>
          </div>

          <div className="flex items-center gap-1.5 text-[10px] font-mono">
            <span className="px-2 py-1 rounded-xl bg-slate-950/90 border border-slate-800 text-slate-300">
              {subject.concepts.length} Nodes Linked
            </span>
          </div>
        </div>

        {/* SVG Neural Knowledge Graph */}
        <div className="w-full rounded-2xl bg-slate-950/90 border border-slate-800/80 p-2 relative overflow-hidden">
          <svg
            viewBox="0 0 100 58"
            className="w-full h-44 sm:h-52 select-none"
            role="img"
            aria-label={`${subject.name} concept prerequisite neural graph`}
          >
            <defs>
              <filter id="neuralGlow" x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation="1.4" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Prerequisite Axons */}
            {subject.concepts.map((node) =>
              node.prerequisites.map((preId) => {
                const parent = subject.concepts.find((c) => c.id === preId);
                if (!parent) return null;
                const parentMastery = masteryMap[parent.id] ?? parent.mastery;
                const isFlowing = parentMastery >= 60;
                const isHighlighted =
                  node.id === selectedConcept.id || parent.id === selectedConcept.id;
                return (
                  <g key={`${parent.id}->${node.id}`}>
                    <line
                      x1={parent.x}
                      y1={parent.y}
                      x2={node.x}
                      y2={node.y}
                      stroke={isHighlighted ? subject.accentHex : '#334155'}
                      strokeOpacity={isHighlighted ? 0.85 : 0.55}
                      strokeWidth={isHighlighted ? 0.9 : 0.55}
                    />
                    {isFlowing && (
                      <line
                        x1={parent.x}
                        y1={parent.y}
                        x2={node.x}
                        y2={node.y}
                        stroke={subject.secondaryHex}
                        strokeWidth={0.7}
                        strokeDasharray="2.5 3.5"
                        className="animate-synaptic-dash"
                      />
                    )}
                  </g>
                );
              })
            )}

            {/* Concept Soma Nodes */}
            {subject.concepts.map((node) => {
              const m = Math.min(100, Math.max(0, masteryMap[node.id] ?? node.mastery));
              const isSelected = node.id === selectedConcept.id;
              const radius = isSelected ? 5.8 : 4.6;
              const circumference = 2 * Math.PI * (radius + 1.2);
              const dashOffset = circumference - (m / 100) * circumference;

              return (
                <g
                  key={node.id}
                  className="cursor-pointer group"
                  onClick={() => handleSelectConceptNode(node)}
                >
                  {/* Selection Pulse Halo */}
                  {isSelected && (
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={radius + 3.2}
                      fill={subject.accentHex}
                      fillOpacity={0.18}
                      filter="url(#neuralGlow)"
                    />
                  )}

                  {/* Background Ring */}
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={radius + 1.2}
                    fill="none"
                    stroke="#1e293b"
                    strokeWidth={0.9}
                  />

                  {/* Mastery Ring */}
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={radius + 1.2}
                    fill="none"
                    stroke={m >= 80 ? '#10b981' : m >= 60 ? subject.accentHex : '#f59e0b'}
                    strokeWidth={1.0}
                    strokeDasharray={circumference}
                    strokeDashoffset={dashOffset}
                    strokeLinecap="round"
                    transform={`rotate(-90 ${node.x} ${node.y})`}
                  />

                  {/* Node Core */}
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={radius}
                    fill={isSelected ? subject.accentHex : '#0f172a'}
                    stroke={subject.accentHex}
                    strokeWidth={isSelected ? 0.8 : 0.45}
                    filter={isSelected ? 'url(#neuralGlow)' : undefined}
                  />

                  {/* Percentage inside node */}
                  <text
                    x={node.x}
                    y={node.y + 1.0}
                    textAnchor="middle"
                    fontSize="2.7"
                    fontWeight="bold"
                    fill={isSelected ? '#020617' : '#f8fafc'}
                  >
                    {m}%
                  </text>

                  {/* Node Caption */}
                  <text
                    x={node.x}
                    y={node.y + radius + 5.0}
                    textAnchor="middle"
                    fontSize="2.55"
                    fontWeight={isSelected ? 'bold' : 'normal'}
                    fill={isSelected ? '#ffffff' : '#94a3b8'}
                  >
                    {(node.nativeTitle || node.title).slice(0, 18)}
                    {(node.nativeTitle || node.title).length > 18 ? '…' : ''}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* =====================================================================
            2. CALIBRATION BAR (DIFFICULTY LADDER & LEARNING STYLE)
            ===================================================================== */}
        <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 border-t border-slate-800/80">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-mono uppercase text-slate-400 mr-1 flex items-center gap-1">
              <Compass className="w-3 h-3 text-cyan-400" />
              Difficulty:
            </span>
            {DIFFICULTIES.map((lvl) => (
              <button
                key={lvl.id}
                type="button"
                onClick={() => onChangeDifficulty(lvl.id)}
                className={`px-2 py-1 rounded-xl text-[10px] font-bold border transition-all cursor-pointer ${
                  difficulty === lvl.id
                    ? `${lvl.color} scale-105 shadow-md`
                    : 'bg-slate-950/70 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                {lvl.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 flex-wrap">
            {LEARNING_STYLES.map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => onChangeLearningStyle(st.id)}
                className={`px-2 py-1 rounded-xl text-[10px] font-semibold border transition-all cursor-pointer flex items-center gap-1 ${
                  learningStyle === st.id
                    ? 'bg-indigo-600/30 text-indigo-200 border-indigo-400/50 shadow-sm'
                    : 'bg-slate-950/70 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                <span>{st.emoji}</span>
                <span>{st.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* =====================================================================
          3. SELECTED CONCEPT DEEP-DIVE + AI ADAPTIVE MICRO-LESSON
          ===================================================================== */}
      <motion.div
        key={selectedConcept.id}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className={`rounded-3xl bg-gradient-to-br ${subject.gradientClass} border ${subject.borderClass} p-4 shadow-xl`}
      >
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${subject.badgeClass}`}>
                {selectedMastery}% MASTERY
              </span>
              <span className="px-2 py-0.5 rounded-full bg-slate-950/70 border border-slate-800 text-[10px] text-slate-300 font-mono uppercase">
                ~{selectedConcept.estimatedMins}m Focus
              </span>
            </div>

            <h4 className="text-base sm:text-lg font-bold text-white tracking-tight">
              {selectedConcept.title}
              {selectedConcept.nativeTitle && (
                <span className="block text-sm text-amber-300 font-semibold mt-0.5">
                  {selectedConcept.nativeTitle}
                </span>
              )}
            </h4>

            <p className="text-xs sm:text-sm text-slate-200/90 leading-relaxed">
              {selectedConcept.summary}
            </p>

            <div className="mt-2 px-3 py-2 rounded-2xl bg-slate-950/80 border border-slate-800/90 font-mono text-[11px] sm:text-xs text-amber-200 shadow-inner">
              {selectedConcept.keyFormulaOrQuote}
            </div>
          </div>

          {/* Quick Cross-Pillar Action Buttons */}
          <div className="flex sm:flex-col gap-2 shrink-0 flex-wrap">
            <button
              type="button"
              onClick={handleGenerateLesson}
              disabled={isGeneratingLesson}
              className="px-3 py-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-60 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-lg transition-all cursor-pointer active:scale-95"
            >
              {isGeneratingLesson ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              <span>{isGeneratingLesson ? 'Adapting...' : 'AI Adaptive Explain'}</span>
            </button>

            <button
              type="button"
              onClick={handleReadConceptAloud}
              className={`px-3 py-2 rounded-2xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                isSpeakingLesson
                  ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
                  : 'bg-slate-950/80 hover:bg-slate-900 text-slate-200 border-slate-700'
              }`}
            >
              {isSpeakingLesson ? (
                <VolumeX className="w-3.5 h-3.5" />
              ) : (
                <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
              )}
              <span>{isSpeakingLesson ? 'Stop Audio' : 'Read Aloud'}</span>
            </button>

            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => onSendConceptToBlackboard(selectedConcept)}
                className="flex-1 px-2.5 py-1.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 text-cyan-200 text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer"
                title="Open this concept on the Smart Blackboard with its diagram"
              >
                <PenTool className="w-3 h-3" />
                <span>Board</span>
              </button>
              <button
                type="button"
                onClick={() => onSendToGrader(selectedConcept)}
                className="flex-1 px-2.5 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-200 text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer"
                title="Test and grade yourself on this concept"
              >
                <ClipboardCheck className="w-3 h-3" />
                <span>Grade</span>
              </button>
            </div>
          </div>
        </div>

        {/* Live Generated Adaptive Lesson Expandable Panel */}
        <AnimatePresence>
          {lesson && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3.5 pt-3.5 border-t border-white/15 space-y-2.5 overflow-hidden"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  {lesson.title}
                </span>
                <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-slate-950/70 text-slate-300 border border-slate-700">
                  {lesson.modelUsed}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-white/95 leading-relaxed">
                {lesson.explanation}
              </p>
              <ul className="space-y-1 text-xs text-slate-200">
                {lesson.keyPoints.map((pt, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-emerald-400 font-bold mt-0.5">✦</span>
                    <span>{pt}</span>
                  </li>
                ))}
              </ul>
              <div className="p-2.5 rounded-2xl bg-slate-950/75 border border-indigo-500/30 text-xs text-indigo-200 flex items-start gap-2">
                <Lightbulb className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-amber-300">Mental Hook: </strong>
                  {lesson.analogy}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* =====================================================================
          4. ADAPTIVE CHALLENGE QUIZ ARENA (AUTO-CALIBRATING DIFFICULTY)
          ===================================================================== */}
      <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-4 shadow-2xl space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            <h4 className="text-xs sm:text-sm font-bold text-white">
              Live Adaptive Assessment
            </h4>
            <span className="px-2 py-0.5 rounded-full bg-slate-950 border border-slate-700 text-[10px] font-mono uppercase text-cyan-300">
              {currentQuestion.difficulty}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-2 py-1 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-mono font-bold flex items-center gap-1">
              <Flame className="w-3 h-3" />
              {streak} Streak
            </span>
            <button
              type="button"
              onClick={handleGenerateFreshAiQuestion}
              disabled={isGeneratingQuestion}
              className="px-2.5 py-1 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/40 text-indigo-200 text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer disabled:opacity-60"
            >
              {isGeneratingQuestion ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Sparkles className="w-3 h-3" />
              )}
              <span>Fresh AI Question</span>
            </button>
          </div>
        </div>

        {/* Calibration Feedback Banner */}
        {calibrationBanner && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="px-3 py-2 rounded-2xl bg-slate-950/90 border border-cyan-500/40 text-xs text-cyan-200 font-medium"
          >
            {calibrationBanner}
          </motion.div>
        )}

        <p className="text-sm sm:text-base font-semibold text-white leading-snug">
          {currentQuestion.prompt}
        </p>

        {/* Options Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {currentQuestion.options.map((opt, idx) => {
            const isChosen = selectedOption === idx;
            const isCorrectOpt = idx === currentQuestion.correctIndex;
            const showOutcome = selectedOption !== null;

            let optionClasses =
              'bg-slate-950/80 hover:bg-slate-800/90 border-slate-800 text-slate-200';
            if (showOutcome) {
              if (isCorrectOpt) {
                optionClasses =
                  'bg-emerald-500/20 border-emerald-400 text-emerald-100 font-semibold shadow-md shadow-emerald-950/50';
              } else if (isChosen && !isCorrectOpt) {
                optionClasses =
                  'bg-rose-500/20 border-rose-400 text-rose-100';
              } else {
                optionClasses = 'bg-slate-950/50 border-slate-800/60 text-slate-500';
              }
            }

            return (
              <button
                key={idx}
                type="button"
                disabled={selectedOption !== null}
                onClick={() => handleAnswerOption(idx)}
                className={`p-3 rounded-2xl border text-left text-xs sm:text-sm transition-all flex items-start justify-between gap-2 cursor-pointer disabled:cursor-default ${optionClasses}`}
              >
                <div className="flex items-start gap-2">
                  <span className="font-mono text-[11px] font-bold opacity-75 mt-0.5">
                    {String.fromCharCode(65 + idx)}.
                  </span>
                  <span>{opt}</span>
                </div>
                {showOutcome && isCorrectOpt && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                )}
                {showOutcome && isChosen && !isCorrectOpt && (
                  <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                )}
              </button>
            );
          })}
        </div>

        {/* Hint & Explanation Footer */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <button
            type="button"
            onClick={() => setShowHint(!showHint)}
            className="px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-amber-500/40 text-amber-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>{showHint ? 'Hide Hint' : 'Need a Socratic Hint?'}</span>
          </button>

          <button
            type="button"
            onClick={handleNextCuratedQuestion}
            className="px-3.5 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 shadow-lg cursor-pointer transition-all active:scale-95"
          >
            <span>Next Challenge</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {showHint && (
          <div className="p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200">
            <strong>Hint:</strong> {currentQuestion.hint}
          </div>
        )}

        {selectedOption !== null && (
          <div className="p-3 rounded-2xl bg-slate-950/90 border border-slate-800 text-xs text-slate-200 leading-relaxed">
            <strong className="text-emerald-300">Why this matters: </strong>
            {currentQuestion.explanation}
          </div>
        )}
      </div>
    </div>
  );
};
