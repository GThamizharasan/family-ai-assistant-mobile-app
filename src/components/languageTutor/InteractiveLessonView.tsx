import React, { useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  Volume2,
  Sparkles,
  CheckCircle2,
  XCircle,
  Mic,
  MicOff,
  Trophy,
  Award,
  Layers,
  MessageSquare,
  CloudUpload,
  RefreshCw,
  FlaskConical,
  FlipHorizontal,
} from 'lucide-react';
import {
  ConstructedLanguageLesson,
  SpeakingEvaluationResult,
} from '../../types/languageTutor';
import {
  ENGLISH_TENSE_MATRIX,
  ENGLISH_TONE_SHIFTER_EXAMPLES,
  TAMIL_MEI_CONSONANTS,
  TAMIL_TRICKY_SOUND_GROUPS,
  TAMIL_UYIR_LETTERS,
  combineTamilUyirMei,
} from '../../data/languageTutorCurriculum';
import { evaluateSpeakingPractice } from '../../services/languageTutorService';
import { speechEngine } from '../../services/speech';
import {
  SpeechCaptureHandle,
  speakTutorUtterance,
  startTutorSpeechCapture,
} from './tutorSpeechHelper';

type LessonSubTab = 'walkthrough' | 'flashcards' | 'lab' | 'speaking' | 'quiz';

interface InteractiveLessonViewProps {
  lesson: ConstructedLanguageLesson;
  masteredVocabIds: string[];
  isConstructing: boolean;
  onReconstructFresh: () => Promise<void>;
  onExportToDrive: () => Promise<void>;
  onPracticeLiveWithTutor: () => void;
  onMarkVocabMastered: (vocabId: string) => void;
  onCompleteLessonQuiz: (moduleId: string, masteryPercent: number, xpEarned: number) => void;
}

export const InteractiveLessonView: React.FC<InteractiveLessonViewProps> = ({
  lesson,
  masteredVocabIds,
  isConstructing,
  onReconstructFresh,
  onExportToDrive,
  onPracticeLiveWithTutor,
  onMarkVocabMastered,
  onCompleteLessonQuiz,
}) => {
  const [subTab, setSubTab] = useState<LessonSubTab>('walkthrough');
  const [flippedCards, setFlippedCards] = useState<Record<string, boolean>>({});
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);

  // Tamil Interactive Uyir-Mei Lab state
  const [selectedMeiIdx, setSelectedMeiIdx] = useState(0);
  const [selectedUyirIdx, setSelectedUyirIdx] = useState(0);

  // English Interactive 12-Tense Matrix state
  const [selectedTenseIdx, setSelectedTenseIdx] = useState(7); // Present Perfect highlight default

  // Speaking drill & capstone live Mic evaluation
  const [activeDrillId, setActiveDrillId] = useState<string | null>(null);
  const [drillTranscripts, setDrillTranscripts] = useState<Record<string, string>>({});
  const [drillEvaluations, setDrillEvaluations] = useState<Record<string, SpeakingEvaluationResult>>({});
  const [capstoneInput, setCapstoneInput] = useState('');
  const [capstoneEval, setCapstoneEval] = useState<SpeakingEvaluationResult | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [micNotice, setMicNotice] = useState<string | null>(null);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  const micHandleRef = useRef<SpeechCaptureHandle | null>(null);

  const isTamil = lesson.language === 'tamil';

  // Reset local interactive state when switching lesson
  useEffect(() => {
    setSelectedAnswers({});
    setQuizSubmitted(false);
    setCapstoneEval(null);
    setCapstoneInput('');
    setActiveDrillId(null);
    setMicNotice(null);
    micHandleRef.current?.stop();
  }, [lesson.id]);

  useEffect(() => {
    return () => {
      micHandleRef.current?.stop();
      speechEngine.stopSpeaking();
    };
  }, []);

  const speakText = (text: string, slow = false) => {
    speakTutorUtterance(text, { language: lesson.language, slow });
  };

  const toggleDrillMic = async (drillId: string, targetPhrase: string) => {
    if (activeDrillId === drillId) {
      micHandleRef.current?.stop();
      micHandleRef.current = null;
      setActiveDrillId(null);
      return;
    }

    micHandleRef.current?.stop();
    setActiveDrillId(drillId);

    micHandleRef.current = await startTutorSpeechCapture({
      speechLang: isTamil ? 'ta-IN' : 'en-IN',
      onInterim: (interim) => {
        setDrillTranscripts((prev) => ({ ...prev, [drillId]: interim }));
      },
      onFinal: async (finalText) => {
        setActiveDrillId(null);
        setDrillTranscripts((prev) => ({ ...prev, [drillId]: finalText }));
        setIsEvaluating(true);
        try {
          const ev = await evaluateSpeakingPractice({
            language: lesson.language,
            level: lesson.level,
            targetPhrase,
            learnerResponse: finalText,
            taskType: drillId === 'capstone' ? 'capstone' : 'pronunciation_drill',
          });
          if (drillId === 'capstone') {
            setCapstoneInput(finalText);
            setCapstoneEval(ev);
          } else {
            setDrillEvaluations((prev) => ({ ...prev, [drillId]: ev }));
          }
          speakText(ev.coachFeedback);
        } finally {
          setIsEvaluating(false);
        }
      },
      onListeningChange: (listening) => {
        if (!listening && activeDrillId === drillId) {
          setActiveDrillId(null);
        }
      },
      onNotice: (n) => setMicNotice(n),
    });
  };

  const evaluateTypedResponse = async (
    id: string,
    targetPhrase: string,
    typedText: string,
    taskType: 'pronunciation_drill' | 'capstone'
  ) => {
    if (!typedText.trim()) return;
    setIsEvaluating(true);
    try {
      const ev = await evaluateSpeakingPractice({
        language: lesson.language,
        level: lesson.level,
        targetPhrase,
        learnerResponse: typedText.trim(),
        taskType,
      });
      if (taskType === 'capstone') {
        setCapstoneEval(ev);
      } else {
        setDrillEvaluations((prev) => ({ ...prev, [id]: ev }));
      }
    } finally {
      setIsEvaluating(false);
    }
  };

  const gradableExercises = lesson.interactiveExercises.filter((e) => e.options && e.options.length > 0);
  const correctQuizCount = gradableExercises.filter(
    (e) => selectedAnswers[e.id] === e.correctAnswer
  ).length;
  const quizMastery =
    gradableExercises.length > 0
      ? Math.round((correctQuizCount / gradableExercises.length) * 100)
      : 85;

  const handleSubmitQuiz = () => {
    setQuizSubmitted(true);
    const totalXp = gradableExercises.reduce(
      (sum, e) => sum + (selectedAnswers[e.id] === e.correctAnswer ? e.xp : 10),
      0
    );
    onCompleteLessonQuiz(lesson.moduleId, Math.max(40, quizMastery), totalXp);
  };

  const combinedTamil = combineTamilUyirMei(selectedMeiIdx, selectedUyirIdx);

  return (
    <div className="space-y-4">
      {/* Vivid Lesson Header Banner */}
      <div
        className={`rounded-3xl p-4 sm:p-5 border shadow-xl relative overflow-hidden ${
          isTamil
            ? 'bg-gradient-to-r from-amber-950/80 via-rose-950/70 to-teal-950/70 border-amber-400/35'
            : 'bg-gradient-to-r from-sky-950/85 via-indigo-950/75 to-fuchsia-950/65 border-sky-400/35'
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold">
              <span className="px-2.5 py-0.5 rounded-full bg-white/15 text-white border border-white/20 uppercase">
                Stage {lesson.stageNumber} · {lesson.level.replace('_', ' ')}
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-200 border border-emerald-400/35">
                {lesson.generatedByModel}
              </span>
            </div>
            <h3 className="text-lg sm:text-xl font-black text-white tracking-tight">
              {lesson.title}
            </h3>
            {lesson.nativeTitle && (
              <p className="text-xs text-amber-200/95 font-medium">{lesson.nativeTitle}</p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={() => speakText(lesson.teacherOpeningScript)}
              className="px-3 py-2 rounded-xl bg-emerald-500/25 hover:bg-emerald-500/35 text-emerald-100 border border-emerald-400/40 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>Listen Intro</span>
            </button>

            <button
              onClick={onPracticeLiveWithTutor}
              className="px-3 py-2 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 hover:brightness-110 text-white text-xs font-bold flex items-center gap-1.5 shadow-md cursor-pointer"
            >
              <Mic className="w-3.5 h-3.5" />
              <span>Practice Live</span>
            </button>

            <button
              onClick={() => {
                void onExportToDrive().then(() => {
                  setExportNotice('Exported Coursebook to SQLite & Google Drive!');
                  setTimeout(() => setExportNotice(null), 3500);
                });
              }}
              className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/15 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <CloudUpload className="w-3.5 h-3.5" />
              <span>Export Coursebook</span>
            </button>

            <button
              onClick={() => void onReconstructFresh()}
              disabled={isConstructing}
              className="px-3 py-2 rounded-xl bg-indigo-500/25 hover:bg-indigo-500/40 disabled:opacity-50 text-indigo-100 border border-indigo-400/40 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isConstructing ? 'animate-spin' : ''}`} />
              <span>AI Regenerate</span>
            </button>
          </div>
        </div>

        {exportNotice && (
          <div className="mt-3 text-xs font-semibold text-emerald-200 bg-emerald-500/20 border border-emerald-400/35 rounded-xl px-3 py-1.5 inline-flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{exportNotice}</span>
          </div>
        )}
      </div>

      {/* 5 Interactive Lesson Sub-Tabs */}
      <div className="flex flex-wrap gap-1.5 bg-slate-900/80 p-1.5 rounded-2xl border border-white/10">
        {[
          { id: 'walkthrough' as LessonSubTab, label: 'Tutor Walkthrough', icon: BookOpen },
          { id: 'flashcards' as LessonSubTab, label: `Flip Cards (${lesson.vocabularyDeck.length})`, icon: FlipHorizontal },
          {
            id: 'lab' as LessonSubTab,
            label: isTamil ? 'உயிர்மெய் & ழ/ள/ல Lab' : '12-Tense & Tone Lab',
            icon: FlaskConical,
          },
          { id: 'speaking' as LessonSubTab, label: 'Dialogue & Mic Drills', icon: Mic },
          { id: 'quiz' as LessonSubTab, label: 'Quiz & Capstone', icon: Trophy },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = subTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setSubTab(tab.id)}
              className={`flex-1 min-w-[130px] px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                active
                  ? 'bg-gradient-to-r from-amber-500 to-rose-500 text-white shadow-md'
                  : 'text-slate-300 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {micNotice && (
        <div className="text-xs text-amber-200 bg-amber-500/15 border border-amber-500/35 rounded-xl px-3 py-2">
          {micNotice}
        </div>
      )}

      {/* SUB-TAB 1: TUTOR WALKTHROUGH */}
      {subTab === 'walkthrough' && (
        <div className="space-y-4">
          {/* Teacher Opening Script Card */}
          <div className="rounded-3xl bg-slate-900/80 border border-white/10 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-extrabold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" />
                {isTamil ? 'ஆசிரியர் கலைவாணியின் அறிமுகம்' : 'Prof. Clara’s Personal Opening'}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => speakText(lesson.teacherOpeningScript, false)}
                  className="px-2.5 py-1 rounded-xl bg-emerald-500/20 text-emerald-200 border border-emerald-400/35 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Volume2 className="w-3.5 h-3.5" /> Play Voice
                </button>
                <button
                  onClick={() => speakText(lesson.teacherOpeningScript, true)}
                  className="px-2 py-1 rounded-xl bg-white/10 text-amber-200 text-[11px] font-bold cursor-pointer"
                >
                  0.75× Slow
                </button>
              </div>
            </div>
            <p className="text-sm text-white leading-relaxed font-medium">
              {lesson.teacherOpeningScript}
            </p>
            {lesson.teacherOpeningTransliteration && (
              <p className="text-xs text-amber-200/90 italic">
                {lesson.teacherOpeningTransliteration}
              </p>
            )}
            {lesson.teacherOpeningMeaning && (
              <p className="text-xs text-cyan-200/85">{lesson.teacherOpeningMeaning}</p>
            )}

            <div className="pt-2 border-t border-white/10">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                What You Will Master in This Lesson
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {lesson.learningObjectives.map((obj, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl bg-slate-950/70 border border-white/10 p-2.5 text-xs text-slate-200 flex items-start gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{obj}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Concept Pillars */}
          <div className="space-y-3">
            {lesson.conceptPillars.map((pillar, idx) => (
              <div
                key={pillar.id}
                className="rounded-3xl bg-slate-900/80 border border-indigo-400/25 p-4 space-y-3 shadow-lg"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-cyan-300">
                      Concept Pillar {idx + 1}
                    </span>
                    <h4 className="text-base font-extrabold text-white">{pillar.title}</h4>
                    {pillar.nativeTitle && (
                      <p className="text-xs text-amber-200">{pillar.nativeTitle}</p>
                    )}
                  </div>
                  <button
                    onClick={() => speakText(`${pillar.title}. ${pillar.explanation}`)}
                    className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs text-white font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Volume2 className="w-3.5 h-3.5" /> Explain Aloud
                  </button>
                </div>

                <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                  {pillar.explanation}
                </p>
                {pillar.nativeExplanation && (
                  <p className="text-xs text-amber-100/90 bg-amber-500/10 border border-amber-500/20 rounded-xl p-2.5">
                    {pillar.nativeExplanation}
                  </p>
                )}

                {pillar.ruleFormula && (
                  <div className="rounded-xl bg-slate-950/85 border border-cyan-500/30 px-3 py-2 font-mono text-xs text-cyan-200">
                    <strong className="text-cyan-400 mr-1.5">Formula:</strong>
                    {pillar.ruleFormula}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {pillar.examples.map((ex, eIdx) => (
                    <div
                      key={eIdx}
                      className="rounded-2xl bg-slate-950/70 border border-white/10 p-3 flex flex-col justify-between gap-1.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs sm:text-sm font-bold text-white leading-snug">
                          {ex.phrase}
                        </p>
                        <button
                          onClick={() => speakText(ex.phrase)}
                          className="p-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-200 shrink-0 cursor-pointer"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {ex.transliteration && (
                        <p className="text-[11px] text-amber-200/90 italic">{ex.transliteration}</p>
                      )}
                      <p className="text-[11px] text-sky-200">{ex.meaning}</p>
                      {ex.usageNote && (
                        <p className="text-[10px] text-slate-400 border-t border-white/5 pt-1">
                          💡 {ex.usageNote}
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                {pillar.commonMistake && (
                  <div className="rounded-2xl bg-rose-950/35 border border-rose-500/30 p-3 text-xs space-y-1">
                    <p className="text-rose-200">
                      <strong className="text-rose-400">❌ Avoid:</strong> {pillar.commonMistake.wrong}
                    </p>
                    <p className="text-emerald-200">
                      <strong className="text-emerald-400">✅ Natural Mastery:</strong>{' '}
                      {pillar.commonMistake.right}
                    </p>
                    <p className="text-slate-300 text-[11px]">Why: {pillar.commonMistake.why}</p>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Cultural / திருக்குறள் Spotlight */}
          <div className="rounded-3xl bg-gradient-to-br from-amber-950/65 via-purple-950/60 to-slate-900 border border-amber-400/35 p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-extrabold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                <Award className="w-4 h-4" />
                {lesson.culturalSpotlight.title}
              </span>
              <button
                onClick={() => speakText(lesson.culturalSpotlight.quote, true)}
                className="px-2.5 py-1 rounded-xl bg-amber-500/20 text-amber-200 border border-amber-400/35 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
              >
                <Volume2 className="w-3.5 h-3.5" /> Speak Quote
              </button>
            </div>
            <blockquote className="text-sm sm:text-base font-bold text-white italic border-l-4 border-amber-400 pl-3">
              “{lesson.culturalSpotlight.quote}”
            </blockquote>
            {lesson.culturalSpotlight.transliteration && (
              <p className="text-xs text-amber-200 italic pl-3">
                {lesson.culturalSpotlight.transliteration}
              </p>
            )}
            <p className="text-xs text-cyan-200">{lesson.culturalSpotlight.meaning}</p>
            <p className="text-xs text-slate-300">{lesson.culturalSpotlight.insight}</p>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: TACTILE FLIP FLASHCARDS */}
      {subTab === 'flashcards' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {lesson.vocabularyDeck.map((card) => {
            const isFlipped = Boolean(flippedCards[card.id]);
            const isMastered = masteredVocabIds.includes(card.id);
            return (
              <div
                key={card.id}
                onClick={() =>
                  setFlippedCards((prev) => ({ ...prev, [card.id]: !prev[card.id] }))
                }
                className={`rounded-3xl p-4 border cursor-pointer transition-all min-h-[195px] flex flex-col justify-between shadow-lg ${
                  isFlipped
                    ? 'bg-gradient-to-br from-indigo-950/90 to-purple-950/80 border-fuchsia-400/45'
                    : 'bg-gradient-to-br from-slate-900 to-slate-950 border-white/15 hover:border-cyan-400/50'
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-[10px]">
                  <span className="px-2 py-0.5 rounded-full bg-white/10 text-slate-200 font-bold uppercase">
                    {card.partOfSpeech} · {card.register}
                  </span>
                  <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => speakText(card.term, true)}
                      className="p-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-200 cursor-pointer"
                      title="Listen slowly"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onMarkVocabMastered(card.id)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold border cursor-pointer ${
                        isMastered
                          ? 'bg-emerald-500/30 text-emerald-100 border-emerald-400/50'
                          : 'bg-white/10 text-slate-200 border-white/15 hover:bg-white/20'
                      }`}
                    >
                      {isMastered ? 'Mastered ✓' : '+15 XP'}
                    </button>
                  </div>
                </div>

                {!isFlipped ? (
                  <div className="my-3 text-center space-y-1.5">
                    <div className="text-2xl font-black text-white">{card.term}</div>
                    {card.transliteration && (
                      <div className="text-xs text-amber-300 font-semibold">
                        {card.transliteration}
                      </div>
                    )}
                    <div className="text-xs font-mono text-cyan-300">{card.phonetic}</div>
                  </div>
                ) : (
                  <div className="my-2 space-y-2 text-xs">
                    <div className="text-sm font-extrabold text-amber-200">{card.meaning}</div>
                    <div className="rounded-xl bg-black/35 p-2.5 space-y-1 border border-white/10">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-white font-semibold">{card.exampleSentence}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            speakText(card.exampleSentence);
                          }}
                          className="p-1 rounded-md bg-white/15 text-white shrink-0 cursor-pointer"
                        >
                          <Volume2 className="w-3 h-3" />
                        </button>
                      </div>
                      <p className="text-cyan-200 text-[11px]">{card.exampleMeaning}</p>
                    </div>
                    <p className="text-[11px] text-emerald-200">
                      🧠 <strong>Hook:</strong> {card.memoryHook}
                    </p>
                  </div>
                )}

                <div className="text-[10px] text-slate-400 text-center">
                  Tap card to flip {isFlipped ? 'to front' : 'for meaning & example'}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* SUB-TAB 3: INTERACTIVE SCRIPT & GRAMMAR LAB */}
      {subTab === 'lab' && isTamil && (
        <div className="space-y-4">
          {/* Interactive Uyir (12) + Mei (18) = 216 Uyirmei Live Synthesizer */}
          <div className="rounded-3xl bg-slate-900/85 border border-amber-400/35 p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="text-base font-extrabold text-white">
                  உயிர்மெய் எழுத்து உருவாக்கி (216-Letter Live Synthesizer)
                </h4>
                <p className="text-xs text-slate-300">
                  Tap any consonant (மெய்) + vowel (உயிர்) to build and hear authentic Tamil syllables live.
                </p>
              </div>
              <button
                onClick={() => speakText(combinedTamil.syllable, true)}
                className="px-4 py-2 rounded-2xl bg-gradient-to-r from-amber-500 to-rose-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg cursor-pointer"
              >
                <Volume2 className="w-4 h-4" />
                <span>Speak “{combinedTamil.syllable}” ({combinedTamil.transliteration})</span>
              </button>
            </div>

            {/* Large Equation Preview */}
            <div className="rounded-2xl bg-gradient-to-r from-amber-950/80 via-rose-950/70 to-teal-950/75 border border-white/15 p-4 flex flex-wrap items-center justify-center gap-4 text-center">
              <div>
                <div className="text-[10px] text-slate-300 font-bold uppercase">மெய் (Consonant)</div>
                <div className="text-3xl font-black text-cyan-300 mt-1">
                  {TAMIL_MEI_CONSONANTS[selectedMeiIdx].char}
                </div>
                <div className="text-[11px] text-slate-300">
                  {TAMIL_MEI_CONSONANTS[selectedMeiIdx].category}
                </div>
              </div>
              <span className="text-2xl font-black text-amber-300">+</span>
              <div>
                <div className="text-[10px] text-slate-300 font-bold uppercase">உயிர் (Vowel)</div>
                <div className="text-3xl font-black text-fuchsia-300 mt-1">
                  {TAMIL_UYIR_LETTERS[selectedUyirIdx].char}
                </div>
                <div className="text-[11px] text-slate-300">
                  {TAMIL_UYIR_LETTERS[selectedUyirIdx].phonetic}
                </div>
              </div>
              <span className="text-2xl font-black text-emerald-300">=</span>
              <button
                onClick={() => speakText(combinedTamil.syllable, true)}
                className="px-6 py-3 rounded-2xl bg-white/15 hover:bg-white/25 border border-amber-300/50 shadow-xl cursor-pointer transition-all"
              >
                <div className="text-[10px] text-amber-200 font-bold uppercase">உயிர்மெய் (Tap to Hear)</div>
                <div className="text-4xl font-black text-white mt-0.5">
                  {combinedTamil.syllable}
                </div>
                <div className="text-xs font-bold text-emerald-300">
                  /{combinedTamil.transliteration}/
                </div>
              </button>
            </div>

            <div className="space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-amber-200">
                1. Choose மெய் (18 Consonants)
              </div>
              <div className="grid grid-cols-6 sm:grid-cols-9 gap-1.5">
                {TAMIL_MEI_CONSONANTS.map((m, idx) => (
                  <button
                    key={m.char}
                    onClick={() => {
                      setSelectedMeiIdx(idx);
                      speakText(combineTamilUyirMei(idx, selectedUyirIdx).syllable, true);
                    }}
                    className={`py-2 rounded-xl border text-center cursor-pointer transition-all ${
                      selectedMeiIdx === idx
                        ? 'bg-cyan-500/30 border-cyan-300 text-white font-black shadow-md'
                        : 'bg-slate-950/75 border-white/10 text-slate-200 hover:border-white/30'
                    }`}
                  >
                    <div className="text-base font-bold">{m.char}</div>
                    <div className="text-[9px] text-slate-400">{m.sound}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-fuchsia-200">
                2. Choose உயிர் (12 Vowels)
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
                {TAMIL_UYIR_LETTERS.map((u, idx) => (
                  <button
                    key={u.char}
                    onClick={() => {
                      setSelectedUyirIdx(idx);
                      speakText(combineTamilUyirMei(selectedMeiIdx, idx).syllable, true);
                    }}
                    className={`py-2 px-2 rounded-xl border text-center cursor-pointer transition-all ${
                      selectedUyirIdx === idx
                        ? 'bg-fuchsia-500/30 border-fuchsia-300 text-white font-black shadow-md'
                        : 'bg-slate-950/75 border-white/10 text-slate-200 hover:border-white/30'
                    }`}
                  >
                    <div className="text-base font-bold">{u.char}</div>
                    <div className="text-[9px] text-slate-300">{u.phonetic}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Signature Tricky Minimal Pairs Lab */}
          <div className="space-y-3">
            {TAMIL_TRICKY_SOUND_GROUPS.map((grp) => (
              <div
                key={grp.id}
                className="rounded-3xl bg-slate-900/80 border border-teal-400/30 p-4 space-y-2.5"
              >
                <h5 className="text-sm font-extrabold text-white">{grp.title}</h5>
                <p className="text-xs text-cyan-200/90 bg-slate-950/60 p-2.5 rounded-xl border border-white/5">
                  👄 {grp.tip}
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {grp.pairs.map((pair) => (
                    <button
                      key={pair.tamil}
                      onClick={() => speakText(pair.tamil, true)}
                      className="rounded-2xl bg-slate-950/80 hover:bg-teal-950/60 border border-white/10 hover:border-teal-400/40 p-2.5 text-left cursor-pointer transition-all flex items-center justify-between gap-2"
                    >
                      <div>
                        <div className="text-sm font-extrabold text-white">{pair.tamil}</div>
                        <div className="text-[11px] text-amber-200 italic">{pair.translit}</div>
                        <div className="text-[10px] text-slate-400">{pair.meaning}</div>
                      </div>
                      <Volume2 className="w-4 h-4 text-teal-300 shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {subTab === 'lab' && !isTamil && (
        <div className="space-y-4">
          {/* English 12-Tense Interactive Matrix */}
          <div className="rounded-3xl bg-slate-900/85 border border-sky-400/35 p-4 space-y-3">
            <div>
              <h4 className="text-base font-extrabold text-white">
                Interactive 12-Tense Visual Architecture
              </h4>
              <p className="text-xs text-slate-300">
                Click any tense cell to inspect its live formula, nuance, and hear Prof. Clara model it naturally.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {ENGLISH_TENSE_MATRIX.map((t, idx) => (
                <button
                  key={t.name}
                  onClick={() => {
                    setSelectedTenseIdx(idx);
                    speakText(t.example);
                  }}
                  className={`p-2.5 rounded-2xl border text-left cursor-pointer transition-all ${
                    selectedTenseIdx === idx
                      ? 'bg-gradient-to-br from-sky-500/35 to-indigo-600/35 border-sky-300 shadow-md'
                      : 'bg-slate-950/75 border-white/10 hover:border-white/25'
                  }`}
                >
                  <div className="text-[10px] font-bold uppercase text-cyan-300">
                    {t.timeframe} · {t.aspect}
                  </div>
                  <div className="text-xs font-extrabold text-white mt-0.5">{t.name}</div>
                  <div className="text-[10px] font-mono text-amber-200 mt-0.5">{t.formula}</div>
                </button>
              ))}
            </div>

            {ENGLISH_TENSE_MATRIX[selectedTenseIdx] && (
              <div className="rounded-2xl bg-slate-950/85 border border-cyan-400/35 p-3.5 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-extrabold text-white">
                    {ENGLISH_TENSE_MATRIX[selectedTenseIdx].name} —{' '}
                    <span className="text-cyan-300 font-mono">
                      {ENGLISH_TENSE_MATRIX[selectedTenseIdx].formula}
                    </span>
                  </span>
                  <button
                    onClick={() => speakText(ENGLISH_TENSE_MATRIX[selectedTenseIdx].example)}
                    className="px-2.5 py-1 rounded-xl bg-emerald-500/20 text-emerald-200 text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Volume2 className="w-3.5 h-3.5" /> Speak
                  </button>
                </div>
                <p className="text-xs sm:text-sm text-amber-100 font-semibold">
                  “{ENGLISH_TENSE_MATRIX[selectedTenseIdx].example}”
                </p>
                <p className="text-xs text-slate-300">
                  When to use: {ENGLISH_TENSE_MATRIX[selectedTenseIdx].nuance}
                </p>
              </div>
            )}
          </div>

          {/* Casual -> Professional -> Executive C2 Tone Shifter */}
          <div className="rounded-3xl bg-slate-900/80 border border-fuchsia-400/30 p-4 space-y-3">
            <h4 className="text-sm font-extrabold text-white">
              Register & Tone Elevator (Casual → Professional → Executive C2)
            </h4>
            <div className="space-y-2.5">
              {ENGLISH_TONE_SHIFTER_EXAMPLES.map((row) => (
                <div
                  key={row.intent}
                  className="rounded-2xl bg-slate-950/75 border border-white/10 p-3 space-y-2"
                >
                  <div className="text-xs font-extrabold text-amber-300">{row.intent}</div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                    {[
                      { label: 'Casual', text: row.casual, cls: 'border-slate-700 bg-slate-900/80' },
                      { label: 'Professional', text: row.professional, cls: 'border-sky-500/35 bg-sky-950/40' },
                      { label: 'Executive C2', text: row.executive, cls: 'border-fuchsia-500/40 bg-fuchsia-950/40' },
                    ].map((tier) => (
                      <button
                        key={tier.label}
                        onClick={() => speakText(tier.text)}
                        className={`p-2.5 rounded-xl border text-left cursor-pointer hover:brightness-110 transition-all space-y-1 ${tier.cls}`}
                      >
                        <div className="flex items-center justify-between text-[10px] font-bold text-slate-300 uppercase">
                          <span>{tier.label}</span>
                          <Volume2 className="w-3 h-3 text-cyan-300" />
                        </div>
                        <p className="text-white leading-snug">{tier.text}</p>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 4: ROLE-PLAY DIALOGUE & LIVE MIC PRONUNCIATION MIRROR */}
      {subTab === 'speaking' && (
        <div className="space-y-4">
          {/* Interactive Scripted Dialogue */}
          <div className="rounded-3xl bg-slate-900/80 border border-white/10 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-sm sm:text-base font-extrabold text-white flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-cyan-400" />
                <span>Guided Role-Play Model Dialogue</span>
              </h4>
              <span className="text-[11px] text-slate-400">Tap any bubble to hear pacing</span>
            </div>

            <div className="space-y-2.5">
              {lesson.liveDialogueScript.map((turn, idx) => (
                <div
                  key={idx}
                  onClick={() => speakText(turn.line)}
                  className={`rounded-2xl p-3 border cursor-pointer transition-all hover:brightness-110 space-y-1 ${
                    turn.speaker === 'tutor'
                      ? 'bg-indigo-950/55 border-indigo-400/30'
                      : 'bg-emerald-950/45 border-emerald-400/30 ml-4'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] font-bold uppercase text-slate-300">
                    <span>{turn.speakerName}</span>
                    <Volume2 className="w-3.5 h-3.5 text-cyan-300" />
                  </div>
                  <p className="text-xs sm:text-sm font-semibold text-white">{turn.line}</p>
                  {turn.transliteration && (
                    <p className="text-[11px] text-amber-200 italic">{turn.transliteration}</p>
                  )}
                  <p className="text-[11px] text-sky-200">{turn.meaning}</p>
                  {turn.coachingTip && (
                    <p className="text-[10px] text-emerald-300">💡 Coach Tip: {turn.coachingTip}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Pronunciation Mirror with Live Mic Evaluation */}
          <div className="rounded-3xl bg-slate-900/85 border border-rose-400/30 p-4 space-y-3">
            <h4 className="text-sm sm:text-base font-extrabold text-white flex items-center gap-2">
              <Mic className="w-4 h-4 text-rose-400" />
              <span>Pronunciation & Clarity Mirror (Live Mic Scoring)</span>
            </h4>

            <div className="space-y-3">
              {lesson.pronunciationDrills.map((drill) => {
                const isListeningHere = activeDrillId === drill.id;
                const transcript = drillTranscripts[drill.id] || '';
                const ev = drillEvaluations[drill.id];
                return (
                  <div
                    key={drill.id}
                    className="rounded-2xl bg-slate-950/80 border border-white/10 p-3.5 space-y-2.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] font-extrabold text-amber-300 uppercase">
                        Focus: {drill.focusSound} · {drill.difficulty}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => speakText(drill.targetPhrase, true)}
                          className="px-2.5 py-1 rounded-xl bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Volume2 className="w-3.5 h-3.5" /> Hear Model (0.75×)
                        </button>
                        <button
                          onClick={() => void toggleDrillMic(drill.id, drill.targetPhrase)}
                          className={`px-3 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1 cursor-pointer ${
                            isListeningHere
                              ? 'bg-rose-600 text-white animate-pulse'
                              : 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white'
                          }`}
                        >
                          {isListeningHere ? (
                            <>
                              <MicOff className="w-3.5 h-3.5" /> Stop
                            </>
                          ) : (
                            <>
                              <Mic className="w-3.5 h-3.5" /> Speak & Score
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    <p className="text-sm sm:text-base font-bold text-white">{drill.targetPhrase}</p>
                    {drill.transliteration && (
                      <p className="text-xs text-amber-200 italic">{drill.transliteration}</p>
                    )}
                    <p className="text-xs text-slate-300">
                      Meaning: {drill.meaning} · 👄 <em>{drill.mouthTip}</em>
                    </p>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={transcript}
                        onChange={(e) =>
                          setDrillTranscripts((prev) => ({ ...prev, [drill.id]: e.target.value }))
                        }
                        placeholder="Speak with mic above or type your attempt to evaluate..."
                        className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white outline-none"
                      />
                      <button
                        onClick={() =>
                          void evaluateTypedResponse(
                            drill.id,
                            drill.targetPhrase,
                            transcript,
                            'pronunciation_drill'
                          )
                        }
                        disabled={isEvaluating || !transcript.trim()}
                        className="px-3 py-1.5 rounded-xl bg-indigo-500/30 hover:bg-indigo-500/50 disabled:opacity-40 text-xs font-bold text-white cursor-pointer"
                      >
                        Check
                      </button>
                    </div>

                    {ev && (
                      <div className="rounded-xl bg-emerald-950/45 border border-emerald-400/35 p-2.5 text-xs space-y-1">
                        <div className="flex flex-wrap items-center gap-2 font-bold">
                          <span className="text-emerald-300">Overall {ev.overallScore}%</span>
                          <span className="text-cyan-300">Pronunciation {ev.pronunciationScore}%</span>
                          <span className="text-amber-300">+{ev.xpEarned} XP</span>
                        </div>
                        <p className="text-white">{ev.coachFeedback}</p>
                        <p className="text-cyan-200 text-[11px]">👄 {ev.phoneticTip}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 5: INTERACTIVE QUIZ & CAPSTONE CHALLENGE */}
      {subTab === 'quiz' && (
        <div className="space-y-4">
          <div className="rounded-3xl bg-slate-900/80 border border-white/10 p-4 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-base font-extrabold text-white flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-400" />
                <span>Interactive Knowledge Check</span>
              </h4>
              {quizSubmitted && (
                <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-200 border border-emerald-400/40 text-xs font-extrabold">
                  Score: {correctQuizCount}/{gradableExercises.length} ({quizMastery}%)
                </span>
              )}
            </div>

            <div className="space-y-3">
              {lesson.interactiveExercises.map((ex, idx) => {
                const chosen = selectedAnswers[ex.id];
                const isCorrect = chosen === ex.correctAnswer;

                if (ex.type === 'speaking' || !ex.options || ex.options.length === 0) {
                  return (
                    <div
                      key={ex.id}
                      className="rounded-2xl bg-indigo-950/40 border border-indigo-400/30 p-3.5 space-y-2"
                    >
                      <div className="text-xs font-bold text-cyan-300 uppercase">
                        Speaking Practice Prompt {idx + 1}
                      </div>
                      <p className="text-sm font-bold text-white">{ex.prompt}</p>
                      {ex.nativePrompt && (
                        <p className="text-xs text-amber-200">{ex.nativePrompt}</p>
                      )}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => speakText(ex.correctAnswer, true)}
                          className="px-3 py-1.5 rounded-xl bg-white/10 text-xs font-bold text-white flex items-center gap-1 cursor-pointer"
                        >
                          <Volume2 className="w-3.5 h-3.5" /> Hear Model
                        </button>
                        <button
                          onClick={() => setSubTab('speaking')}
                          className="px-3 py-1.5 rounded-xl bg-rose-500/25 text-xs font-bold text-rose-100 border border-rose-400/35 cursor-pointer"
                        >
                          Open Mic Drills →
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={ex.id}
                    className="rounded-2xl bg-slate-950/75 border border-white/10 p-3.5 space-y-2.5"
                  >
                    <p className="text-xs sm:text-sm font-bold text-white">
                      {idx + 1}. {ex.prompt}
                    </p>
                    {ex.nativePrompt && (
                      <p className="text-xs text-amber-200/90">{ex.nativePrompt}</p>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {ex.options.map((opt) => {
                        const picked = chosen === opt;
                        const rightOpt = opt === ex.correctAnswer;
                        let style =
                          'bg-slate-900 border-white/10 text-slate-200 hover:border-cyan-400/50';
                        if (quizSubmitted) {
                          if (rightOpt) {
                            style = 'bg-emerald-500/25 border-emerald-400 text-emerald-100';
                          } else if (picked && !rightOpt) {
                            style = 'bg-rose-500/25 border-rose-400 text-rose-100';
                          }
                        } else if (picked) {
                          style = 'bg-indigo-500/35 border-indigo-400 text-white';
                        }

                        return (
                          <button
                            key={opt}
                            onClick={() =>
                              !quizSubmitted &&
                              setSelectedAnswers((prev) => ({ ...prev, [ex.id]: opt }))
                            }
                            className={`p-2.5 rounded-xl border text-left text-xs font-semibold cursor-pointer transition-all flex items-center justify-between gap-2 ${style}`}
                          >
                            <span>{opt}</span>
                            {quizSubmitted && rightOpt && (
                              <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
                            )}
                            {quizSubmitted && picked && !rightOpt && (
                              <XCircle className="w-4 h-4 text-rose-300 shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {quizSubmitted && (
                      <p
                        className={`text-xs rounded-xl px-3 py-2 ${
                          isCorrect
                            ? 'bg-emerald-500/15 text-emerald-200'
                            : 'bg-amber-500/15 text-amber-200'
                        }`}
                      >
                        💡 {ex.explanation}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {!quizSubmitted ? (
              <button
                onClick={handleSubmitQuiz}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-600 hover:brightness-110 text-white font-extrabold text-sm shadow-lg cursor-pointer"
              >
                Grade Quiz & Save Mastery to SQLite + Drive
              </button>
            ) : (
              <button
                onClick={() => {
                  setQuizSubmitted(false);
                  setSelectedAnswers({});
                }}
                className="w-full py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs cursor-pointer"
              >
                Retake Quiz
              </button>
            )}
          </div>

          {/* Capstone Challenge */}
          <div className="rounded-3xl bg-gradient-to-br from-fuchsia-950/65 via-indigo-950/70 to-slate-900 border border-fuchsia-400/35 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm sm:text-base font-extrabold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-fuchsia-300" />
                <span>{lesson.capstoneChallenge.title}</span>
              </h4>
              <button
                onClick={() => void toggleDrillMic('capstone', lesson.capstoneChallenge.prompt)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                  activeDrillId === 'capstone'
                    ? 'bg-rose-600 text-white animate-pulse'
                    : 'bg-white/15 hover:bg-white/25 text-white'
                }`}
              >
                <Mic className="w-3.5 h-3.5" />
                <span>{activeDrillId === 'capstone' ? 'Listening...' : 'Speak Response'}</span>
              </button>
            </div>

            <p className="text-xs sm:text-sm text-slate-200">{lesson.capstoneChallenge.prompt}</p>

            <div className="flex flex-wrap gap-1.5">
              {lesson.capstoneChallenge.targetSkills.map((sk) => (
                <span
                  key={sk}
                  className="px-2.5 py-0.5 rounded-full bg-fuchsia-500/20 text-fuchsia-200 border border-fuchsia-400/30 text-[10px] font-bold"
                >
                  🎯 {sk}
                </span>
              ))}
            </div>

            <textarea
              rows={3}
              value={capstoneInput}
              onChange={(e) => setCapstoneInput(e.target.value)}
              placeholder={
                isTamil
                  ? 'உங்கள் 3 வாக்கிய தமிழ் விடையை இங்கே பேசுங்கள் அல்லது தட்டச்சு செய்யுங்கள்...'
                  : 'Speak or compose your capstone response here...'
              }
              className="w-full rounded-2xl bg-slate-950/85 border border-white/15 p-3 text-xs sm:text-sm text-white outline-none focus:border-fuchsia-400"
            />

            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                onClick={() => speakText(lesson.capstoneChallenge.sampleMasteryResponse, true)}
                className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-amber-200 flex items-center gap-1.5 cursor-pointer"
              >
                <Volume2 className="w-3.5 h-3.5" /> Hear Model Mastery Response
              </button>

              <button
                onClick={() =>
                  void evaluateTypedResponse(
                    'capstone',
                    lesson.capstoneChallenge.prompt,
                    capstoneInput,
                    'capstone'
                  )
                }
                disabled={isEvaluating || !capstoneInput.trim()}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-fuchsia-600 disabled:opacity-45 text-white text-xs font-extrabold cursor-pointer"
              >
                {isEvaluating ? 'Grading with AI Tutor...' : 'Submit Capstone for Human Feedback'}
              </button>
            </div>

            {capstoneEval && (
              <div className="rounded-2xl bg-slate-950/85 border border-emerald-400/40 p-3.5 space-y-1.5 text-xs">
                <div className="flex flex-wrap items-center gap-3 font-extrabold">
                  <span className="text-emerald-300">Score: {capstoneEval.overallScore}%</span>
                  <span className="text-cyan-300">Grammar: {capstoneEval.grammarScore}%</span>
                  <span className="text-amber-300">Naturalness: {capstoneEval.naturalnessScore}%</span>
                </div>
                <p className="text-white leading-relaxed">{capstoneEval.coachFeedback}</p>
                <p className="text-violet-200">
                  <strong>Polished Version:</strong> {capstoneEval.correctedVersion}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

