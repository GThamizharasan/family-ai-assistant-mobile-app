import React, { useState, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';
import { motion, AnimatePresence } from 'motion/react';
import {
  ClipboardCheck,
  Mic,
  MicOff,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  BookOpen,
  CloudUpload,
  Compass,
  PenTool,
  FileText,
  X,
  Loader2,
  Award,
} from 'lucide-react';
import {
  BlackboardSnapshot,
  GradingResult,
  SubjectDefinition,
} from '../../types/adaptiveLearning';
import { gradeStudentSubmission } from '../../services/adaptiveLearningService';
import { CelebrationBurst } from './NeuralCanvasBackdrop';

interface AutoGraderViewProps {
  subject: SubjectDefinition;
  pendingBlackboardSnapshot: BlackboardSnapshot | null;
  onClearBlackboardSnapshot: () => void;
  gradingHistory: GradingResult[];
  onGraded: (result: GradingResult) => void;
  onJumpToAdaptive: () => void;
  onSyncToDrive: (title: string, content: string) => void;
}

export const AutoGraderView: React.FC<AutoGraderViewProps> = ({
  subject,
  pendingBlackboardSnapshot,
  onClearBlackboardSnapshot,
  gradingHistory,
  onGraded,
  onJumpToAdaptive,
  onSyncToDrive,
}) => {
  const [inputMode, setInputMode] = useState<'written' | 'voice' | 'blackboard'>(
    pendingBlackboardSnapshot ? 'blackboard' : 'written'
  );
  const [selectedPresetId, setSelectedPresetId] = useState<string>(
    subject.gradingPrompts[0]?.id || ''
  );
  const [questionPrompt, setQuestionPrompt] = useState<string>(
    subject.gradingPrompts[0]?.prompt || ''
  );
  const [rubricKeywords, setRubricKeywords] = useState<string[]>(
    subject.gradingPrompts[0]?.rubricKeywords || []
  );
  const [sampleIdealAnswer, setSampleIdealAnswer] = useState<string>(
    subject.gradingPrompts[0]?.sampleIdealAnswer || ''
  );
  const [studentAnswer, setStudentAnswer] = useState<string>('');
  const [isGrading, setIsGrading] = useState<boolean>(false);
  const [latestResult, setLatestResult] = useState<GradingResult | null>(null);
  const [celebrateKey, setCelebrateKey] = useState<number>(0);

  // Local Voice Dictation State for Oral Exam mode
  const [isRecording, setIsRecording] = useState(false);
  const [voiceLang, setVoiceLang] = useState<'en-IN' | 'ta-IN'>(
    subject.defaultLanguage === 'ta-IN' ? 'ta-IN' : 'en-IN'
  );
  const webRecRef = useRef<any>(null);

  useEffect(() => {
    const first = subject.gradingPrompts[0];
    setSelectedPresetId(first?.id || '');
    setQuestionPrompt(first?.prompt || '');
    setRubricKeywords(first?.rubricKeywords || []);
    setSampleIdealAnswer(first?.sampleIdealAnswer || '');
    setVoiceLang(subject.defaultLanguage === 'ta-IN' ? 'ta-IN' : 'en-IN');
    setLatestResult(null);
  }, [subject]);

  useEffect(() => {
    if (pendingBlackboardSnapshot) {
      setInputMode('blackboard');
      if (pendingBlackboardSnapshot.transcriptNotes.trim()) {
        setStudentAnswer(pendingBlackboardSnapshot.transcriptNotes);
      }
    }
  }, [pendingBlackboardSnapshot]);

  useEffect(() => {
    return () => {
      if (webRecRef.current) {
        try {
          webRecRef.current.stop();
        } catch {}
      }
      SpeechRecognition.stop().catch(() => {});
    };
  }, []);

  const handleSelectPreset = (presetId: string) => {
    const preset = subject.gradingPrompts.find((p) => p.id === presetId);
    if (!preset) return;
    setSelectedPresetId(preset.id);
    setQuestionPrompt(preset.prompt);
    setRubricKeywords(preset.rubricKeywords);
    setSampleIdealAnswer(preset.sampleIdealAnswer);
  };

  const handleLoadSampleAnswer = () => {
    setStudentAnswer(sampleIdealAnswer);
  };

  const toggleOralDictation = async () => {
    if (isRecording) {
      setIsRecording(false);
      if (webRecRef.current) {
        try {
          webRecRef.current.stop();
        } catch {}
        webRecRef.current = null;
      }
      SpeechRecognition.stop().catch(() => {});
      return;
    }

    if (Capacitor.isNativePlatform()) {
      try {
        const perm = await SpeechRecognition.requestPermissions();
        if (perm.speechRecognition !== 'granted') return;
        setIsRecording(true);
        const res = await SpeechRecognition.start({
          language: voiceLang,
          maxResults: 3,
          partialResults: false,
          popup: false,
        });
        setIsRecording(false);
        if (res?.matches?.[0]) {
          setStudentAnswer((prev) => (prev ? `${prev} ${res.matches![0]}` : res.matches![0]));
          setInputMode('voice');
        }
      } catch {
        setIsRecording(false);
      }
      return;
    }

    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) return;

    try {
      const rec = new SpeechRec();
      rec.lang = voiceLang;
      rec.continuous = true;
      rec.interimResults = false;
      rec.onresult = (event: any) => {
        let finalSeg = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            finalSeg += (event.results[i][0]?.transcript || '') + ' ';
          }
        }
        if (finalSeg.trim()) {
          setStudentAnswer((prev) => (prev ? `${prev} ${finalSeg.trim()}` : finalSeg.trim()));
          setInputMode('voice');
        }
      };
      rec.onerror = () => setIsRecording(false);
      rec.onend = () => setIsRecording(false);
      rec.start();
      webRecRef.current = rec;
      setIsRecording(true);
      setInputMode('voice');
    } catch {
      setIsRecording(false);
    }
  };

  const handleRunAutoGrade = async () => {
    const effectiveAnswer =
      studentAnswer.trim() ||
      (inputMode === 'blackboard' && pendingBlackboardSnapshot
        ? `Blackboard Visual & Derivation Snapshot captured for ${subject.name} (${pendingBlackboardSnapshot.transcriptNotes || 'Hand-drawn chalk derivation and diagram'})`
        : '');

    if (!effectiveAnswer) return;
    setIsGrading(true);

    try {
      const result = await gradeStudentSubmission(
        subject,
        questionPrompt,
        effectiveAnswer,
        inputMode,
        rubricKeywords,
        sampleIdealAnswer
      );
      setLatestResult(result);
      onGraded(result);
      if (result.overallScore >= 80) {
        setCelebrateKey((k) => k + 1);
      }
    } finally {
      setIsGrading(false);
    }
  };

  const handleExportReportToDrive = () => {
    if (!latestResult) return;
    const md = `# Automated AI Grading Report — ${subject.name}
**Date:** ${new Date(latestResult.gradedAt).toLocaleString()}
**Score:** ${latestResult.overallScore}% (${latestResult.letterGrade})
**Submission Mode:** ${latestResult.inputMode.toUpperCase()}

## Prompt
${latestResult.questionPrompt}

## Student Response
${latestResult.studentAnswer}

## Rubric Breakdown
${latestResult.rubric.map((r) => `- **${r.name}:** ${r.score}/${r.maxScore} — ${r.feedback}`).join('\n')}

## Strengths
${latestResult.strengths.map((s) => `- ${s}`).join('\n')}

## Areas to Refine
${latestResult.misconceptions.length ? latestResult.misconceptions.map((m) => `- ${m}`).join('\n') : '- None detected!'}

## Model Ideal Answer
${latestResult.modelAnswer}

## Adaptive Next Step
${latestResult.adaptiveRecommendation}
`;
    onSyncToDrive(`Graded Report - ${subject.name} (${latestResult.letterGrade})`, md);
  };

  const subjectHistory = gradingHistory.filter((g) => g.subjectId === subject.id);
  const ringRadius = 38;
  const ringCirc = 2 * Math.PI * ringRadius;
  const ringOffset = latestResult
    ? ringCirc - (latestResult.overallScore / 100) * ringCirc
    : ringCirc;

  return (
    <div className="space-y-4">
      <CelebrationBurst triggerKey={celebrateKey} color={subject.accentHex} />

      {/* =====================================================================
          1. SUBMISSION WORKSPACE CARD
          ===================================================================== */}
      <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-4 shadow-2xl space-y-3.5 relative overflow-hidden">
        {/* Holographic Scanning Beam while Grading */}
        {isGrading && (
          <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-transparent via-cyan-400/25 to-transparent animate-scan-beam z-20" />
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs sm:text-sm font-bold text-white">
              Automated AI Rubric Grader — {subject.name}
            </h3>
          </div>

          {/* Input Mode Switcher */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-2xl border border-slate-800 text-[11px]">
            {(
              [
                { id: 'written', label: 'Written', icon: FileText },
                { id: 'voice', label: 'Voice Oral', icon: Mic },
                { id: 'blackboard', label: 'Board Snap', icon: PenTool },
              ] as const
            ).map((mode) => {
              const Icon = mode.icon;
              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setInputMode(mode.id)}
                  className={`px-2.5 py-1 rounded-xl font-bold flex items-center gap-1 transition-all cursor-pointer ${
                    inputMode === mode.id
                      ? 'bg-emerald-500 text-slate-950 shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  <span>{mode.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Prompt Presets + Question Box */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            {subject.gradingPrompts.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleSelectPreset(p.id)}
                className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold border transition-all cursor-pointer ${
                  selectedPresetId === p.id
                    ? 'bg-indigo-600/30 text-indigo-200 border-indigo-400/50'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                {p.title}
              </button>
            ))}
          </div>

          <div className="p-3 rounded-2xl bg-slate-950/90 border border-slate-800 text-xs sm:text-sm text-slate-100 leading-relaxed">
            <span className="text-[10px] font-mono uppercase text-cyan-400 block mb-1">
              Assessment Prompt:
            </span>
            {questionPrompt}
          </div>
        </div>

        {/* Pending Blackboard Snapshot Preview */}
        {inputMode === 'blackboard' && pendingBlackboardSnapshot && (
          <div className="rounded-2xl bg-slate-950 border border-cyan-500/40 p-2.5 flex items-center gap-3 relative">
            <img
              src={pendingBlackboardSnapshot.dataUrl}
              alt="Blackboard work snapshot"
              className="w-28 h-16 object-cover rounded-xl border border-slate-700 shrink-0"
            />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-cyan-300 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                Smart Blackboard Snapshot Attached
              </div>
              <p className="text-[11px] text-slate-400 truncate mt-0.5">
                {pendingBlackboardSnapshot.transcriptNotes || 'Hand-drawn chalk diagram & derivation ready for evaluation'}
              </p>
            </div>
            <button
              type="button"
              onClick={onClearBlackboardSnapshot}
              className="p-1 rounded-lg bg-slate-900 text-slate-400 hover:text-white cursor-pointer"
              aria-label="Remove blackboard snapshot"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Answer Textarea + Voice Controls */}
        <div className="space-y-2">
          <textarea
            value={studentAnswer}
            onChange={(e) => setStudentAnswer(e.target.value)}
            rows={4}
            placeholder={
              subject.id === 'tamil'
                ? 'உங்கள் விடையை இங்கே தட்டச்சு செய்யுங்கள் அல்லது Voice Oral மூலம் பேசுங்கள்...'
                : 'Type your explanation, formula steps, or tap Oral Mic to speak your answer...'
            }
            className="w-full px-3.5 py-3 rounded-2xl bg-slate-950 border border-slate-800 text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 resize-none"
          />

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={toggleOralDictation}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
                  isRecording
                    ? 'bg-rose-600 text-white animate-pulse'
                    : 'bg-slate-950 hover:bg-slate-800 border border-slate-700 text-cyan-300'
                }`}
              >
                {isRecording ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                <span>{isRecording ? 'Listening...' : `Speak Answer (${voiceLang === 'ta-IN' ? 'தமிழ்' : 'ENG'})`}</span>
              </button>

              <button
                type="button"
                onClick={handleLoadSampleAnswer}
                className="px-2.5 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-[11px] font-semibold text-amber-300 cursor-pointer"
              >
                ✨ Load Example Response
              </button>
            </div>

            <button
              type="button"
              onClick={handleRunAutoGrade}
              disabled={isGrading || (!studentAnswer.trim() && !(inputMode === 'blackboard' && pendingBlackboardSnapshot))}
              className="px-4 py-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 disabled:opacity-45 text-slate-950 text-xs font-bold flex items-center gap-1.5 shadow-lg cursor-pointer transition-all active:scale-95"
            >
              {isGrading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              <span>{isGrading ? 'AI Evaluating Rubric...' : 'Auto-Grade Now'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* =====================================================================
          2. INTERACTIVE AI REPORT CARD
          ===================================================================== */}
      <AnimatePresence>
        {latestResult && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-3xl bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950/60 border border-emerald-500/40 p-4 shadow-2xl space-y-4"
          >
            {/* Header Gauge + Grade */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="relative w-24 h-24 shrink-0 flex items-center justify-center">
                  <svg viewBox="0 0 96 96" className="w-24 h-24 -rotate-90">
                    <circle
                      cx="48"
                      cy="48"
                      r={ringRadius}
                      fill="none"
                      stroke="#1e293b"
                      strokeWidth="8"
                    />
                    <circle
                      cx="48"
                      cy="48"
                      r={ringRadius}
                      fill="none"
                      stroke={latestResult.overallScore >= 80 ? '#10b981' : '#f59e0b'}
                      strokeWidth="8"
                      strokeDasharray={ringCirc}
                      strokeDashoffset={ringOffset}
                      strokeLinecap="round"
                      className="transition-all duration-700"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-lg font-extrabold text-white">
                      {latestResult.overallScore}%
                    </span>
                    <span className="text-[10px] font-mono font-bold text-emerald-400">
                      {latestResult.letterGrade}
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Award className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-mono uppercase tracking-wider text-emerald-300 font-bold">
                      AI Rubric Evaluation Complete
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-200 font-medium">
                    {latestResult.adaptiveRecommendation}
                  </p>
                  <span className="inline-block text-[10px] font-mono text-slate-400">
                    Evaluated via {latestResult.modelUsed || 'Aura AI Engine'}
                  </span>
                </div>
              </div>

              <div className="flex sm:flex-col gap-2 shrink-0">
                <button
                  type="button"
                  onClick={onJumpToAdaptive}
                  className="px-3 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Compass className="w-3.5 h-3.5" />
                  <span>Adaptive Path</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportReportToDrive}
                  className="px-3 py-1.5 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/40 text-indigo-200 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <CloudUpload className="w-3.5 h-3.5" />
                  <span>Save to Drive</span>
                </button>
              </div>
            </div>

            {/* 4 Rubric Bars */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {latestResult.rubric.map((dim) => {
                const pct = Math.round((dim.score / dim.maxScore) * 100);
                return (
                  <div
                    key={dim.name}
                    className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-white">{dim.name}</span>
                      <span className="font-mono text-emerald-300">
                        {dim.score}/{dim.maxScore}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-all duration-700"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-slate-400 leading-snug">{dim.feedback}</p>
                  </div>
                );
              })}
            </div>

            {/* Strengths, Misconceptions, Gold Model Answer */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              <div className="p-3 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 space-y-1.5">
                <div className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Strengths</span>
                </div>
                <ul className="space-y-1 text-xs text-emerald-100/90">
                  {latestResult.strengths.map((s, idx) => (
                    <li key={idx}>• {s}</li>
                  ))}
                </ul>
              </div>

              <div className="p-3 rounded-2xl bg-amber-950/30 border border-amber-500/30 space-y-1.5">
                <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Precision Tips & Concepts to Add</span>
                </div>
                <ul className="space-y-1 text-xs text-amber-100/90">
                  {latestResult.misconceptions.length > 0 ? (
                    latestResult.misconceptions.map((m, idx) => <li key={idx}>• {m}</li>)
                  ) : (
                    <li>• Zero misconceptions spotted — top-tier mastery!</li>
                  )}
                </ul>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 text-xs text-indigo-100 space-y-1">
              <div className="font-bold text-indigo-300 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5" />
                <span>Gold-Standard Reference Answer</span>
              </div>
              <p className="leading-relaxed">{latestResult.modelAnswer}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recent Graded History */}
      {subjectHistory.length > 0 && (
        <div className="rounded-3xl bg-slate-900/75 border border-slate-800 p-3.5 space-y-2">
          <div className="text-xs font-bold text-slate-300 flex items-center justify-between">
            <span>Recent Graded Assessments ({subject.name})</span>
            <span className="text-[10px] font-mono text-slate-400">SQLite Synced</span>
          </div>
          <div className="space-y-1.5">
            {subjectHistory.slice(0, 4).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setLatestResult(item)}
                className="w-full p-2.5 rounded-2xl bg-slate-950/80 hover:bg-slate-800/80 border border-slate-800 flex items-center justify-between gap-2 text-left cursor-pointer transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white truncate">
                    {item.questionPrompt}
                  </p>
                  <p className="text-[10px] text-slate-400 font-mono">
                    {item.inputMode.toUpperCase()} • {new Date(item.gradedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-mono font-bold shrink-0">
                  {item.overallScore}% ({item.letterGrade})
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

