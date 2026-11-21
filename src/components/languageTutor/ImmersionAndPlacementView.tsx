import React, { useMemo, useState } from 'react';
import {
  Target,
  Brain,
  Sun,
  Volume2,
  CheckCircle2,
  XCircle,
  Sparkles,
  RotateCcw,
  Calendar,
} from 'lucide-react';
import {
  ProficiencyLevel,
  SrsVocabItem,
  TutorLanguage,
} from '../../types/languageTutor';
import {
  DAILY_IMMERSION_FEED,
  PLACEMENT_DIAGNOSTIC_QUESTIONS,
} from '../../data/languageTutorAdvancedData';
import { scheduleSrsCardReview } from '../../services/languageTutorService';
import { speakTutorUtterance } from './tutorSpeechHelper';

interface ImmersionAndPlacementViewProps {
  language: TutorLanguage;
  srsDeck: SrsVocabItem[];
  lastPlacement?: { level: ProficiencyLevel; score: number; completedAt: string };
  onCompletePlacement: (level: ProficiencyLevel, scorePercent: number) => void;
  onUpdateSrsCard: (updated: SrsVocabItem) => void;
  onAwardXp: (xp: number) => void;
}

export const ImmersionAndPlacementView: React.FC<ImmersionAndPlacementViewProps> = ({
  language,
  srsDeck,
  lastPlacement,
  onCompletePlacement,
  onUpdateSrsCard,
  onAwardXp,
}) => {
  const [subTab, setSubTab] = useState<'immersion' | 'srs' | 'placement'>('immersion');
  const isTamil = language === 'tamil';

  // ---- Daily Immersion State ----
  const immersionItems = useMemo(
    () => DAILY_IMMERSION_FEED.filter((item) => item.language === language),
    [language]
  );
  const [selectedWordPopup, setSelectedWordPopup] = useState<{
    word: string;
    meaning: string;
    transliteration?: string;
  } | null>(null);

  // ---- SM-2 Spaced Repetition Queue ----
  const today = new Date().toISOString().split('T')[0];
  const langDeck = useMemo(
    () => srsDeck.filter((c) => c.language === language),
    [srsDeck, language]
  );
  const dueCards = useMemo(
    () => langDeck.filter((c) => c.nextReviewDate <= today),
    [langDeck, today]
  );
  const activeSrsCard = dueCards[0] || langDeck[0] || null;
  const [srsFlipped, setSrsFlipped] = useState(false);

  const handleGradeSrs = (quality: 'again' | 'good' | 'easy') => {
    if (!activeSrsCard) return;
    const updated = scheduleSrsCardReview(activeSrsCard, quality);
    onUpdateSrsCard(updated);
    onAwardXp(quality === 'easy' ? 20 : quality === 'good' ? 15 : 8);
    setSrsFlipped(false);
  };

  // ---- 5-Minute AI Placement & Level-Up Exam ----
  const examQuestions = useMemo(
    () => PLACEMENT_DIAGNOSTIC_QUESTIONS.filter((q) => q.language === language),
    [language]
  );
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const handleSubmitPlacement = () => {
    let correct = 0;
    let highestStagePassed = 1;
    examQuestions.forEach((q) => {
      if (answers[q.id] === q.correctAnswer) {
        correct++;
        highestStagePassed = Math.max(highestStagePassed, q.stageNumber);
      }
    });
    const pct = Math.round((correct / Math.max(1, examQuestions.length)) * 100);
    const levelMap: ProficiencyLevel[] = [
      'beginner',
      'elementary',
      'intermediate',
      'upper_intermediate',
      'advanced',
      'mastery',
    ];
    const determinedLevel =
      correct === 0 ? 'beginner' : levelMap[Math.min(5, Math.max(0, highestStagePassed - 1))];
    setSubmitted(true);
    onCompletePlacement(determinedLevel, pct);
  };

  return (
    <div className="space-y-4">
      {/* Sub-Tab Selector */}
      <div className="grid grid-cols-3 gap-2 bg-slate-900/85 p-1.5 rounded-2xl border border-white/10">
        {[
          {
            id: 'immersion' as const,
            label: isTamil ? '☀️ Daily திருக்குறள் & Story' : '☀️ Daily Story & Idioms',
            icon: Sun,
          },
          {
            id: 'srs' as const,
            label: `🧠 Smart Review (${dueCards.length} Due)`,
            icon: Brain,
          },
          { id: 'placement' as const, label: '🎯 A1–C2 Placement Exam', icon: Target },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = subTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setSubTab(tab.id)}
              className={`py-2.5 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                active
                  ? 'bg-gradient-to-r from-amber-500 to-rose-500 text-white shadow-md'
                  : 'text-slate-300 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* PANEL 1: DAILY 3-MINUTE IMMERSION FEED */}
      {subTab === 'immersion' && (
        <div className="space-y-4">
          {selectedWordPopup && (
            <div className="rounded-2xl bg-gradient-to-r from-cyan-950/90 to-indigo-950/90 border border-cyan-400/50 p-3.5 flex flex-wrap items-center justify-between gap-2 shadow-xl">
              <div>
                <div className="text-sm font-black text-white">
                  {selectedWordPopup.word}{' '}
                  {selectedWordPopup.transliteration && (
                    <span className="text-amber-300 font-semibold text-xs">
                      ({selectedWordPopup.transliteration})
                    </span>
                  )}
                </div>
                <p className="text-xs text-cyan-200">{selectedWordPopup.meaning}</p>
              </div>
              <button
                onClick={() => speakTutorUtterance(selectedWordPopup.word, { language, slow: true })}
                className="px-3 py-1.5 rounded-xl bg-emerald-500/25 text-emerald-100 text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <Volume2 className="w-3.5 h-3.5" /> Speak Word
              </button>
            </div>
          )}

          {immersionItems.map((item) => (
            <div
              key={item.id}
              className="rounded-3xl bg-slate-900/90 border border-amber-400/30 p-4 sm:p-5 space-y-3 shadow-xl"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-200 border border-amber-400/40">
                    {item.category} · 3-Min Daily Immersion
                  </span>
                  <h4 className="text-base sm:text-lg font-extrabold text-white mt-1">
                    {item.title}
                  </h4>
                  {item.nativeTitle && (
                    <p className="text-xs text-slate-400">{item.nativeTitle}</p>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => speakTutorUtterance(item.body, { language, slow: false })}
                    className="px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-200 border border-emerald-400/35 text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Volume2 className="w-3.5 h-3.5" /> Listen
                  </button>
                  <button
                    onClick={() => speakTutorUtterance(item.body, { language, slow: true })}
                    className="px-2.5 py-1.5 rounded-xl bg-white/10 text-amber-200 text-xs font-bold cursor-pointer"
                  >
                    0.75×
                  </button>
                </div>
              </div>

              <p className="text-sm text-white leading-relaxed font-medium bg-slate-950/65 p-3.5 rounded-2xl border border-white/10">
                {item.body}
              </p>

              {item.transliteration && (
                <p className="text-xs text-amber-200/90 italic">{item.transliteration}</p>
              )}
              <p className="text-xs text-sky-200">
                <strong>Meaning:</strong> {item.translation}
              </p>

              {/* Tap-Any-Word Interactive Glossary */}
              <div className="space-y-1.5 pt-1">
                <span className="text-[10px] font-bold uppercase text-slate-400">
                  Tap any key word for instant meaning & voice:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {item.wordGlossary.map((gw) => (
                    <button
                      key={gw.word}
                      onClick={() => {
                        setSelectedWordPopup(gw);
                        speakTutorUtterance(gw.word, { language, slow: true });
                      }}
                      className="px-3 py-1.5 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/35 text-indigo-100 border border-indigo-400/35 text-xs font-bold cursor-pointer transition-all"
                    >
                      ✨ {gw.word}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-xl bg-amber-500/10 border border-amber-400/25 px-3 py-2 text-xs text-amber-100">
                💬 <strong>Daily Reflection:</strong> {item.reflectionPrompt}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* PANEL 2: SM-2 SPACED-REPETITION SMART VOCABULARY QUEUE */}
      {subTab === 'srs' && (
        <div className="rounded-3xl bg-slate-900/90 border border-cyan-400/30 p-5 space-y-4 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <Brain className="w-5 h-5 text-cyan-400" />
                <span>SM-2 Spaced-Repetition Smart Vocabulary Deck</span>
              </h3>
              <p className="text-xs text-slate-300">
                Scientifically schedules reviews at 1d → 3d → 7d → 21d intervals and syncs every review to SQLite & Google Drive.
              </p>
            </div>
            <span className="px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-200 border border-cyan-400/40 text-xs font-extrabold">
              {dueCards.length} Due Today · {langDeck.length} Total Cards
            </span>
          </div>

          {activeSrsCard ? (
            <div className="space-y-4">
              <div
                onClick={() => setSrsFlipped((v) => !v)}
                className="rounded-3xl p-6 bg-gradient-to-br from-indigo-950/90 via-slate-950 to-purple-950/80 border border-white/15 text-center cursor-pointer space-y-3 shadow-2xl min-h-[200px] flex flex-col justify-center"
              >
                <div className="text-[10px] font-mono uppercase text-slate-400 flex items-center justify-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-amber-300" />
                  <span>
                    Interval: {activeSrsCard.intervalDays}d · Next Review: {activeSrsCard.nextReviewDate}
                  </span>
                </div>

                <div className="text-3xl font-black text-white">{activeSrsCard.term}</div>
                {activeSrsCard.transliteration && (
                  <div className="text-sm font-bold text-amber-300 italic">
                    {activeSrsCard.transliteration}
                  </div>
                )}
                {activeSrsCard.phonetic && (
                  <div className="text-xs font-mono text-cyan-300">{activeSrsCard.phonetic}</div>
                )}

                <div className="flex justify-center">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      speakTutorUtterance(activeSrsCard.term, { language, slow: true });
                    }}
                    className="px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-200 text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Volume2 className="w-3.5 h-3.5" /> Speak
                  </button>
                </div>

                {srsFlipped ? (
                  <div className="pt-3 border-t border-white/10 space-y-1.5">
                    <div className="text-base font-extrabold text-emerald-300">
                      {activeSrsCard.meaning}
                    </div>
                    {activeSrsCard.exampleSentence && (
                      <p className="text-xs text-slate-200 italic">
                        “{activeSrsCard.exampleSentence}”
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">Tap card to reveal meaning & schedule review</p>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <button
                  onClick={() => handleGradeSrs('again')}
                  className="py-2.5 rounded-2xl bg-rose-500/20 hover:bg-rose-500/35 border border-rose-400/40 text-rose-200 text-xs font-extrabold cursor-pointer"
                >
                  🔁 Again (1 Day)
                </button>
                <button
                  onClick={() => handleGradeSrs('good')}
                  className="py-2.5 rounded-2xl bg-amber-500/20 hover:bg-amber-500/35 border border-amber-400/40 text-amber-200 text-xs font-extrabold cursor-pointer"
                >
                  👍 Good ({activeSrsCard.repetitions === 0 ? '1d' : activeSrsCard.repetitions === 1 ? '3d' : `${Math.round(activeSrsCard.intervalDays * activeSrsCard.easeFactor)}d`})
                </button>
                <button
                  onClick={() => handleGradeSrs('easy')}
                  className="py-2.5 rounded-2xl bg-emerald-500/20 hover:bg-emerald-500/35 border border-emerald-400/40 text-emerald-200 text-xs font-extrabold cursor-pointer"
                >
                  🚀 Easy (+20 XP)
                </button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-400 text-center py-6">
              All caught up! Master flashcards in any Lesson Lab to grow your smart review queue.
            </p>
          )}
        </div>
      )}

      {/* PANEL 3: 5-MINUTE AI PLACEMENT & LEVEL-UP EXAM (A1 -> C2) */}
      {subTab === 'placement' && (
        <div className="rounded-3xl bg-slate-900/90 border border-indigo-400/35 p-4 sm:p-5 space-y-4 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <Target className="w-5 h-5 text-amber-400" />
                <span>
                  5-Minute {isTamil ? 'தமிழ்' : 'English'} Placement & Level-Up Exam (A1 → C2)
                </span>
              </h3>
              <p className="text-xs text-slate-300">
                Answer 6 progressive diagnostic questions to calibrate your exact CEFR level and unlock your 30-day study plan.
              </p>
            </div>
            {lastPlacement && (
              <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-200 border border-emerald-400/35 text-xs font-bold">
                Current Verified Level: {lastPlacement.level.replace('_', ' ').toUpperCase()} ({lastPlacement.score}%)
              </span>
            )}
          </div>

          <div className="space-y-3">
            {examQuestions.map((q, idx) => {
              const picked = answers[q.id];
              const isRight = picked === q.correctAnswer;
              return (
                <div
                  key={q.id}
                  className="rounded-2xl bg-slate-950/80 border border-white/10 p-3.5 space-y-2.5"
                >
                  <div className="flex items-center justify-between text-[10px] font-bold uppercase text-cyan-300">
                    <span>Stage {q.stageNumber} Diagnostic</span>
                    <span>Target: {q.targetLevel.replace('_', ' ')}</span>
                  </div>
                  <p className="text-xs sm:text-sm font-bold text-white">
                    {idx + 1}. {q.prompt}
                  </p>
                  {q.nativePrompt && (
                    <p className="text-xs text-amber-200">{q.nativePrompt}</p>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {q.options.map((opt) => {
                      const active = picked === opt;
                      const correctOpt = opt === q.correctAnswer;
                      let cls = 'bg-slate-900 border-white/10 text-slate-200 hover:border-cyan-400/50';
                      if (submitted) {
                        if (correctOpt) cls = 'bg-emerald-500/25 border-emerald-400 text-emerald-100';
                        else if (active) cls = 'bg-rose-500/25 border-rose-400 text-rose-100';
                      } else if (active) {
                        cls = 'bg-indigo-500/35 border-indigo-400 text-white';
                      }
                      return (
                        <button
                          key={opt}
                          onClick={() => !submitted && setAnswers((p) => ({ ...p, [q.id]: opt }))}
                          className={`p-2.5 rounded-xl border text-left text-xs font-semibold cursor-pointer flex items-center justify-between gap-2 ${cls}`}
                        >
                          <span>{opt}</span>
                          {submitted && correctOpt && <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />}
                          {submitted && active && !correctOpt && <XCircle className="w-4 h-4 text-rose-300 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                  {submitted && (
                    <p className={`text-xs rounded-xl px-3 py-1.5 ${isRight ? 'bg-emerald-500/15 text-emerald-200' : 'bg-amber-500/15 text-amber-200'}`}>
                      💡 {q.explanation}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {!submitted ? (
            <button
              onClick={handleSubmitPlacement}
              disabled={Object.keys(answers).length < examQuestions.length}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-500 via-rose-500 to-indigo-600 disabled:opacity-45 text-white font-extrabold text-sm shadow-lg cursor-pointer flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>Calculate My CEFR Level & Save 30-Day Plan</span>
            </button>
          ) : (
            <div className="rounded-2xl bg-emerald-950/50 border border-emerald-400/40 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-black text-emerald-200">
                  🎉 Placement Complete & Synced to SQLite + Google Drive!
                </h4>
                <button
                  onClick={() => {
                    setSubmitted(false);
                    setAnswers({});
                  }}
                  className="px-3 py-1 rounded-xl bg-white/10 text-xs font-bold text-white flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Retake
                </button>
              </div>
              <p className="text-xs text-slate-200">
                Your 30-Day Plan: Week 1 — Daily 3-Min Immersion + 5 SM-2 Cards · Week 2 — 3 Live Hands-Free Calls · Week 3 — 2 AI Essay Clinics · Week 4 — Stage Certificate Capstone!
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
