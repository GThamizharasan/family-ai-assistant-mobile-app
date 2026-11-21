import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Mic,
  Map,
  BookOpen,
  Cloud,
  Sparkles,
  Flame,
  Trophy,
  Database,
  CheckCircle2,
  X,
  MessageSquare,
  PenTool,
  Sun,
  Award,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  ConstructedLanguageLesson,
  FamilyTutorSuiteState,
  LanguageModuleSummary,
  LearnerAgeGroup,
  LiveTutorMessage,
  ProficiencyLevel,
  SavedLanguageTutorRecord,
  SrsVocabItem,
  StageCompletionCertificate,
  TutorLanguage,
  TutorProgressState,
  TutorStudioView,
} from '../../types/languageTutor';
import {
  ENGLISH_CURRICULUM_MODULES,
  LANGUAGE_STAGES,
  TAMIL_CURRICULUM_MODULES,
  TUTOR_PERSONAS,
  buildFallbackLanguageLesson,
} from '../../data/languageTutorCurriculum';
import {
  buildDefaultProgressForLearner,
  constructLanguageLessonWithAi,
  deleteTutorRecordEverywhere,
  loadAllSavedTutorRecords,
  loadFamilyTutorSuite,
  saveFamilyTutorSuite,
  saveTutorProgress,
  saveTutorRecordEverywhere,
  syncAllLocalRecordsToSqliteAndDrive,
} from '../../services/languageTutorService';
import { getEffectiveGoogleToken } from '../../services/visualTopicStorageService';
import { speechEngine } from '../../services/speech';
import { LiveTutorSessionView } from '../languageTutor/LiveTutorSessionView';
import { CourseRoadmapStudioView } from '../languageTutor/CourseRoadmapStudioView';
import { InteractiveLessonView } from '../languageTutor/InteractiveLessonView';
import { TutorCourseVaultView } from '../languageTutor/TutorCourseVaultView';
import { WritingAndTracingLabView } from '../languageTutor/WritingAndTracingLabView';
import { ImmersionAndPlacementView } from '../languageTutor/ImmersionAndPlacementView';
import { FamilyAnalyticsAndCertificatesView } from '../languageTutor/FamilyAnalyticsAndCertificatesView';

export const LanguageTutorTab: React.FC = () => {
  const { user, googleAccessToken } = useApp();
  const effectiveToken = getEffectiveGoogleToken(googleAccessToken);
  const effectiveEmail = user?.email || 'chinna.tamil2000@gmail.com';

  const consumeInitialLaunch = (): { language?: TutorLanguage; view?: TutorStudioView } => {
    try {
      const raw = sessionStorage.getItem('aura_language_tutor_launch');
      if (raw) {
        sessionStorage.removeItem('aura_language_tutor_launch');
        return JSON.parse(raw);
      }
    } catch {}
    return {};
  };

  const initialLaunch = consumeInitialLaunch();

  const [language, setLanguage] = useState<TutorLanguage>(initialLaunch.language || 'tamil');
  const [activeView, setActiveView] = useState<TutorStudioView>(initialLaunch.view || 'live');
  const [familySuite, setFamilySuite] = useState<FamilyTutorSuiteState>(() =>
    loadFamilyTutorSuite()
  );
  const activeLearner =
    familySuite.learners.find((l) => l.id === familySuite.activeLearnerId) ||
    familySuite.learners[0];
  const progress: TutorProgressState =
    familySuite.progressByLearner[activeLearner.id] ||
    buildDefaultProgressForLearner(activeLearner.ageGroup === 'kids_6_10');

  const [savedRecords, setSavedRecords] = useState<SavedLanguageTutorRecord[]>([]);
  const [activeLessonByLang, setActiveLessonByLang] = useState<
    Record<TutorLanguage, ConstructedLanguageLesson | null>
  >({
    english: null,
    tamil: null,
  });

  const [isConstructing, setIsConstructing] = useState(false);
  const [constructionStatus, setConstructionStatus] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const [sessionPreviewRecord, setSessionPreviewRecord] =
    useState<SavedLanguageTutorRecord | null>(null);

  const persona = TUTOR_PERSONAS[language];
  const currentLevel: ProficiencyLevel =
    language === 'tamil' ? progress.tamilLevel : progress.englishLevel;

  const activeLesson = useMemo(() => {
    if (activeLessonByLang[language]) return activeLessonByLang[language];
    // Look up latest constructed lesson from Vault for this language
    const savedCourse = savedRecords.find(
      (r) =>
        r.language === language &&
        r.recordType === 'course_lesson' &&
        r.payload &&
        Array.isArray(r.payload.conceptPillars)
    );
    if (savedCourse) return savedCourse.payload as ConstructedLanguageLesson;

    const firstModule =
      language === 'tamil' ? TAMIL_CURRICULUM_MODULES[0] : ENGLISH_CURRICULUM_MODULES[0];
    return buildFallbackLanguageLesson(language, firstModule);
  }, [activeLessonByLang, language, savedRecords]);

  // Listen to Home Hub / Voice Assistant launch events while mounted
  useEffect(() => {
    const handleLaunch = (ev: Event) => {
      const detail = (ev as CustomEvent)?.detail || {};
      if (detail.language === 'english' || detail.language === 'tamil') {
        setLanguage(detail.language);
      }
      if (['live', 'roadmap', 'lesson', 'writing', 'immersion', 'analytics', 'vault'].includes(detail.view)) {
        setActiveView(detail.view);
      }
    };
    window.addEventListener('aura_language_tutor_launch', handleLaunch);
    return () => window.removeEventListener('aura_language_tutor_launch', handleLaunch);
  }, []);

  // Load saved records from Local + SQLite + Google Drive on mount & when token changes
  const refreshVault = useCallback(
    async (forceDrive = false) => {
      setIsSyncing(true);
      try {
        const merged = await loadAllSavedTutorRecords(effectiveEmail, effectiveToken, forceDrive);
        setSavedRecords(merged);

        // Restore family suite state from SQLite/Drive if available
        const suiteRec = merged.find(
          (r) => r.recordType === 'family_suite_state' && Array.isArray(r.payload?.learners)
        );
        if (suiteRec && suiteRec.payload.learners.length > 0) {
          setFamilySuite((prev) => {
            const remote = suiteRec.payload as FamilyTutorSuiteState;
            const prevXp = prev.progressByLearner[prev.activeLearnerId]?.xp || 0;
            const remXp = remote.progressByLearner?.[remote.activeLearnerId]?.xp || 0;
            return remXp > prevXp || remote.learners.length > prev.learners.length ? remote : prev;
          });
        }
      } finally {
        setIsSyncing(false);
      }
    },
    [effectiveEmail, effectiveToken]
  );

  useEffect(() => {
    void refreshVault(false);
  }, [refreshVault]);

  // Ensure audio stops cleanly when leaving tab
  useEffect(() => {
    return () => {
      speechEngine.stopSpeaking();
    };
  }, []);

  const flashBanner = (msg: string) => {
    setStatusBanner(msg);
    setTimeout(() => setStatusBanner(null), 4000);
  };

  const updateAndPersistProgress = (updater: (prev: TutorProgressState) => TutorProgressState) => {
    setFamilySuite((prevSuite) => {
      const learnerId = prevSuite.activeLearnerId;
      const curProg =
        prevSuite.progressByLearner[learnerId] || buildDefaultProgressForLearner(false);
      const nextProg = updater(curProg);
      const nextSuite: FamilyTutorSuiteState = {
        ...prevSuite,
        progressByLearner: {
          ...prevSuite.progressByLearner,
          [learnerId]: nextProg,
        },
      };
      void saveFamilyTutorSuite(nextSuite, effectiveEmail, effectiveToken);
      void saveTutorProgress(nextProg, effectiveEmail, effectiveToken);
      return nextSuite;
    });
  };

  const handleConstructModule = async (mod: LanguageModuleSummary, openView: TutorStudioView = 'lesson') => {
    setIsConstructing(true);
    setConstructionStatus(`Constructing "${mod.title}" with AI...`);
    try {
      const { lesson, savedRecord, usedAi } = await constructLanguageLessonWithAi({
        language: mod.language,
        moduleSummary: mod,
        userEmail: effectiveEmail,
        googleAccessToken: effectiveToken,
        onStageProgress: (st) => setConstructionStatus(st),
      });

      setLanguage(mod.language);
      setActiveLessonByLang((prev) => ({ ...prev, [mod.language]: lesson }));
      setSavedRecords((prev) => [savedRecord, ...prev.filter((r) => r.id !== savedRecord.id)]);
      setActiveView(openView);
      flashBanner(
        usedAi
          ? `✨ AI constructed "${lesson.title}" and saved to SQLite${savedRecord.syncedToDrive ? ' & Google Drive' : ''}!`
          : `📘 Built "${lesson.title}" offline & saved to SQLite${savedRecord.syncedToDrive ? ' & Google Drive' : ''}!`
      );
    } finally {
      setIsConstructing(false);
      setConstructionStatus('');
    }
  };

  const handleConstructCustomCourse = async (goal: string, level: ProficiencyLevel) => {
    setIsConstructing(true);
    setConstructionStatus(`Building bespoke ${language === 'tamil' ? 'Tamil' : 'English'} course "${goal}"...`);
    try {
      const { lesson, savedRecord, usedAi } = await constructLanguageLessonWithAi({
        language,
        customGoal: goal,
        level,
        userEmail: effectiveEmail,
        googleAccessToken: effectiveToken,
        onStageProgress: (st) => setConstructionStatus(st),
      });

      setActiveLessonByLang((prev) => ({ ...prev, [language]: lesson }));
      setSavedRecords((prev) => [savedRecord, ...prev.filter((r) => r.id !== savedRecord.id)]);
      setActiveView('lesson');
      flashBanner(
        usedAi
          ? `✨ Custom AI course "${lesson.title}" created & synced to SQLite + Drive!`
          : `📘 Custom course "${lesson.title}" created & saved!`
      );
    } finally {
      setIsConstructing(false);
      setConstructionStatus('');
    }
  };

  const handlePracticeModuleLive = async (mod: LanguageModuleSummary) => {
    const existing = savedRecords.find(
      (r) =>
        r.recordType === 'course_lesson' &&
        (r.moduleId === mod.id || r.id === `course-${mod.id}`) &&
        r.payload?.conceptPillars
    );
    if (existing) {
      setLanguage(mod.language);
      setActiveLessonByLang((prev) => ({
        ...prev,
        [mod.language]: existing.payload as ConstructedLanguageLesson,
      }));
      setActiveView('live');
    } else {
      await handleConstructModule(mod, 'live');
    }
  };

  const handleReconstructFresh = async () => {
    if (!activeLesson) return;
    const catalog = language === 'tamil' ? TAMIL_CURRICULUM_MODULES : ENGLISH_CURRICULUM_MODULES;
    const mod = catalog.find((m) => m.id === activeLesson.moduleId);
    if (mod) {
      await handleConstructModule(mod, 'lesson');
    } else {
      await handleConstructCustomCourse(activeLesson.title, activeLesson.level);
    }
  };

  const handleExportActiveLessonToDrive = async () => {
    if (!activeLesson) return;
    const saved = await saveTutorRecordEverywhere(
      {
        id: activeLesson.isCustomCourse
          ? `course-${activeLesson.id}`
          : `course-${activeLesson.moduleId}`,
        language: activeLesson.language,
        level: activeLesson.level,
        recordType: 'course_lesson',
        moduleId: activeLesson.moduleId,
        title: activeLesson.title,
        payload: activeLesson,
        masteryPercent: progress.completedModules[activeLesson.moduleId] || 0,
      },
      {
        userEmail: effectiveEmail,
        googleAccessToken: effectiveToken,
        exportMarkdownToDrive: true,
      }
    );
    setSavedRecords((prev) => [saved, ...prev.filter((r) => r.id !== saved.id)]);
  };

  const handleSaveSessionRecord = async (params: {
    title: string;
    language: TutorLanguage;
    level: ProficiencyLevel;
    messages: LiveTutorMessage[];
  }) => {
    const avgFluency =
      params.messages
        .filter((m) => typeof m.fluencyScore === 'number')
        .reduce((acc, m, _i, arr) => acc + (m.fluencyScore || 85) / arr.length, 0) || 85;

    const saved = await saveTutorRecordEverywhere(
      {
        id: `session-${params.language}-${Date.now().toString(36)}`,
        language: params.language,
        level: params.level,
        recordType: 'live_session',
        title: params.title,
        payload: {
          messages: params.messages,
          recordedAt: new Date().toISOString(),
        },
        masteryPercent: Math.round(avgFluency),
      },
      {
        userEmail: effectiveEmail,
        googleAccessToken: effectiveToken,
        exportMarkdownToDrive: true,
      }
    );

    setSavedRecords((prev) => [saved, ...prev.filter((r) => r.id !== saved.id)]);
  };

  const handleOpenSavedRecord = (rec: SavedLanguageTutorRecord) => {
    if (rec.recordType === 'course_lesson' && rec.payload?.conceptPillars) {
      setLanguage(rec.language);
      setActiveLessonByLang((prev) => ({
        ...prev,
        [rec.language]: rec.payload as ConstructedLanguageLesson,
      }));
      setActiveView('lesson');
    } else if (rec.recordType === 'live_session') {
      setSessionPreviewRecord(rec);
    }
  };

  const handleSyncAllVault = async () => {
    setIsSyncing(true);
    try {
      const res = await syncAllLocalRecordsToSqliteAndDrive(effectiveEmail, effectiveToken);
      await refreshVault(true);
      flashBanner(
        `Synced ${res.sqliteCount}/${res.totalSynced} records to SQLite${res.driveSynced ? ' & Google Drive ✓' : ' (sign in with Google for Drive backup)'}`
      );
    } finally {
      setIsSyncing(false);
    }
  };

  const currentStageObj =
    LANGUAGE_STAGES.find((s) => s.level === currentLevel) || LANGUAGE_STAGES[0];

  const isTamil = language === 'tamil';

  return (
    <div className="space-y-4 pb-24">
      {/* Vivid Hero Header & Dual Language Switcher */}
      <div
        className={`rounded-3xl p-4 sm:p-5 border shadow-2xl relative overflow-hidden transition-all ${
          isTamil
            ? 'bg-gradient-to-br from-amber-950/90 via-rose-950/75 to-slate-900 border-amber-400/40'
            : 'bg-gradient-to-br from-sky-950/90 via-indigo-950/80 to-fuchsia-950/70 border-sky-400/40'
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/15 text-white border border-white/20 inline-flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-300" />
                Live Human Language Mentor · AI + SQLite + Drive
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-200 border border-emerald-400/35 inline-flex items-center gap-1">
                <Database className="w-3 h-3" />
                {effectiveToken ? 'SQLite + Drive Synced' : 'SQLite Active'}
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              {isTamil
                ? 'தமிழ் & English Live Tutor Studio'
                : 'English & தமிழ் Live Tutor Studio'}
            </h2>
            <p className="text-xs text-slate-200/90 max-w-2xl">
              {persona.tagline}
            </p>
          </div>

          {/* Tactile Language Toggle + Family Learner Quick Switcher */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 shrink-0">
            <select
              value={familySuite.activeLearnerId}
              onChange={(e) => {
                const nextId = e.target.value;
                setFamilySuite((prev) => {
                  const next = { ...prev, activeLearnerId: nextId };
                  void saveFamilyTutorSuite(next, effectiveEmail, effectiveToken);
                  return next;
                });
              }}
              className="px-3 py-2 rounded-2xl bg-slate-950/85 border border-amber-400/35 text-xs font-extrabold text-amber-200 outline-none cursor-pointer"
              title="Switch active family learner profile"
            >
              {familySuite.learners.map((l) => (
                <option key={l.id} value={l.id} className="bg-slate-900 text-white">
                  {l.avatar} {l.name}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-1.5 bg-slate-950/80 p-1.5 rounded-2xl border border-white/15">
              <button
                onClick={() => {
                  speechEngine.stopSpeaking();
                  setLanguage('english');
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 ${
                  language === 'english'
                    ? 'bg-gradient-to-r from-sky-500 to-indigo-600 text-white shadow-lg shadow-sky-500/30'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <span>🇬🇧</span>
                <span>English (Clara)</span>
              </button>
              <button
                onClick={() => {
                  speechEngine.stopSpeaking();
                  setLanguage('tamil');
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 ${
                  language === 'tamil'
                    ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-rose-600 text-white shadow-lg shadow-amber-500/30'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <span>🪔</span>
                <span>தமிழ் (கலைவாணி)</span>
              </button>
            </div>
          </div>
        </div>

        {/* Learner Progress HUD */}
        <div className="mt-4 pt-3 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="rounded-2xl bg-slate-950/65 border border-white/10 px-3 py-2 flex items-center gap-2.5">
            <Trophy className="w-4 h-4 text-amber-400 shrink-0" />
            <div>
              <div className="text-xs font-black text-white">{progress.xp} XP</div>
              <div className="text-[10px] text-slate-400">Mastery Points</div>
            </div>
          </div>

          <div className="rounded-2xl bg-slate-950/65 border border-white/10 px-3 py-2 flex items-center gap-2.5">
            <Flame className="w-4 h-4 text-rose-400 shrink-0" />
            <div>
              <div className="text-xs font-black text-white">{progress.streakDays} Day Streak</div>
              <div className="text-[10px] text-slate-400">{progress.totalLiveTurns} Live Turns</div>
            </div>
          </div>

          <div className="rounded-2xl bg-slate-950/65 border border-white/10 px-3 py-2 flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
            <div>
              <div className="text-xs font-black text-white">{progress.averageFluency}% Fluency</div>
              <div className="text-[10px] text-slate-400">Live Voice Avg</div>
            </div>
          </div>

          <div className="rounded-2xl bg-slate-950/65 border border-white/10 px-3 py-2">
            <div className="text-[10px] text-slate-400 font-bold uppercase">Target Level</div>
            <select
              value={currentLevel}
              onChange={(e) => {
                const newLvl = e.target.value as ProficiencyLevel;
                updateAndPersistProgress((prev) => ({
                  ...prev,
                  ...(language === 'tamil' ? { tamilLevel: newLvl } : { englishLevel: newLvl }),
                }));
              }}
              className="w-full bg-transparent text-xs font-extrabold text-amber-200 outline-none cursor-pointer"
            >
              {LANGUAGE_STAGES.map((st) => (
                <option key={st.level} value={st.level} className="bg-slate-900 text-white">
                  {st.cefrCode} · {isTamil ? st.tamilLabel : st.englishLabel}
                </option>
              ))}
            </select>
            <div className="text-[10px] text-emerald-300 font-semibold truncate">
              {currentStageObj.cefrCode} Active Path
            </div>
          </div>
        </div>
      </div>

      {/* Status Toast */}
      {statusBanner && (
        <div className="rounded-2xl bg-emerald-500/20 border border-emerald-400/45 px-4 py-2.5 text-xs font-bold text-emerald-100 flex items-center gap-2 shadow-lg">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{statusBanner}</span>
        </div>
      )}

      {/* 7 Studio Navigation Views (All 4 Production Bundles) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        {[
          {
            id: 'live' as TutorStudioView,
            label: 'Live Call Tutor',
            sub: 'Hands-Free + Heatmap',
            icon: Mic,
            grad: 'from-rose-500 to-amber-500',
          },
          {
            id: 'roadmap' as TutorStudioView,
            label: 'Course Roadmap',
            sub: '18 Stages + AI',
            icon: Map,
            grad: 'from-violet-500 to-fuchsia-600',
          },
          {
            id: 'lesson' as TutorStudioView,
            label: 'Lesson & Lab',
            sub: isTamil ? 'உயிர்மெய் + Drills' : '12-Tense + Drills',
            icon: BookOpen,
            grad: 'from-cyan-500 to-indigo-600',
          },
          {
            id: 'writing' as TutorStudioView,
            label: 'Writing & Trace',
            sub: 'Tracing + Clinic + Tiles',
            icon: PenTool,
            grad: 'from-fuchsia-500 to-pink-600',
          },
          {
            id: 'immersion' as TutorStudioView,
            label: 'Daily & Exam',
            sub: 'SRS + A1–C2 Test',
            icon: Sun,
            grad: 'from-amber-500 to-orange-600',
          },
          {
            id: 'analytics' as TutorStudioView,
            label: 'Family & Certs',
            sub: `${(progress.certificates || []).length} Certs · Analytics`,
            icon: Award,
            grad: 'from-indigo-500 to-sky-500',
          },
          {
            id: 'vault' as TutorStudioView,
            label: 'SQLite + Drive',
            sub: `${savedRecords.filter((r) => !['progress_snapshot', 'family_suite_state'].includes(r.recordType)).length} Saved`,
            icon: Cloud,
            grad: 'from-emerald-500 to-teal-600',
          },
        ].map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              className={`rounded-2xl p-2.5 border text-left transition-all cursor-pointer flex items-center gap-2 ${
                isActive
                  ? `bg-gradient-to-r ${item.grad} text-white border-white/30 shadow-lg`
                  : 'bg-slate-900/80 border-white/10 text-slate-300 hover:border-white/25 hover:text-white'
              }`}
            >
              <div
                className={`p-1.5 rounded-xl shrink-0 ${
                  isActive ? 'bg-white/20' : 'bg-slate-950/80'
                }`}
              >
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-extrabold truncate">{item.label}</div>
                <div
                  className={`text-[9.5px] truncate ${
                    isActive ? 'text-white/85' : 'text-slate-400'
                  }`}
                >
                  {item.sub}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Active Studio View */}
      {activeView === 'live' && (
        <LiveTutorSessionView
          language={language}
          persona={persona}
          activeLevel={currentLevel}
          activeLesson={activeLesson}
          onTurnAwardXp={(xp, fluencyScore) => {
            const today = new Date().toISOString().split('T')[0];
            updateAndPersistProgress((prev) => {
              const nextFluency =
                typeof fluencyScore === 'number'
                  ? Math.round((prev.averageFluency * 3 + fluencyScore) / 4)
                  : prev.averageFluency;
              const history = [...(prev.fluencyHistory || [])];
              const last = history[history.length - 1];
              if (last && last.date === today && last.language === language) {
                history[history.length - 1] = {
                  ...last,
                  fluencyScore: nextFluency,
                  speakingMinutes: last.speakingMinutes + 1,
                  xpEarned: last.xpEarned + xp,
                };
              } else {
                history.push({
                  date: today,
                  language,
                  fluencyScore: nextFluency,
                  speakingMinutes: 1,
                  xpEarned: xp,
                });
              }
              return {
                ...prev,
                xp: prev.xp + xp,
                totalLiveTurns: prev.totalLiveTurns + 1,
                speakingMinutes: (prev.speakingMinutes || 0) + 1,
                averageFluency: nextFluency,
                fluencyHistory: history.slice(-14),
              };
            });
          }}
          onSaveSessionRecord={handleSaveSessionRecord}
        />
      )}

      {activeView === 'writing' && (
        <WritingAndTracingLabView
          language={language}
          activeLevel={currentLevel}
          userEmail={effectiveEmail}
          googleAccessToken={effectiveToken}
          onAwardXp={(xp, kind) => {
            updateAndPersistProgress((prev) => ({
              ...prev,
              xp: prev.xp + xp,
              tracedLettersCount: (prev.tracedLettersCount || 0) + (kind === 'trace' ? 1 : 0),
              essaysGradedCount: (prev.essaysGradedCount || 0) + (kind === 'essay' ? 1 : 0),
              sentencePuzzlesSolved: (prev.sentencePuzzlesSolved || 0) + (kind === 'puzzle' ? 1 : 0),
            }));
          }}
          onRecordSaved={(rec) => {
            setSavedRecords((prev) => [rec, ...prev.filter((r) => r.id !== rec.id)]);
          }}
        />
      )}

      {activeView === 'immersion' && (
        <ImmersionAndPlacementView
          language={language}
          srsDeck={progress.srsDeck || []}
          lastPlacement={progress.placementResult?.[language]}
          onCompletePlacement={(newLevel, scorePercent) => {
            updateAndPersistProgress((prev) => ({
              ...prev,
              xp: prev.xp + 60,
              ...(language === 'tamil' ? { tamilLevel: newLevel } : { englishLevel: newLevel }),
              placementResult: {
                ...(prev.placementResult || {}),
                [language]: {
                  level: newLevel,
                  score: scorePercent,
                  completedAt: new Date().toISOString(),
                },
              },
            }));
            flashBanner(
              `🎯 Placement Verified: ${newLevel.replace('_', ' ').toUpperCase()} (${scorePercent}%) — Saved to SQLite & Drive!`
            );
          }}
          onUpdateSrsCard={(updated: SrsVocabItem) => {
            updateAndPersistProgress((prev) => ({
              ...prev,
              srsDeck: (prev.srsDeck || []).map((c) => (c.id === updated.id ? updated : c)),
            }));
          }}
          onAwardXp={(xp) => {
            updateAndPersistProgress((prev) => ({ ...prev, xp: prev.xp + xp }));
          }}
        />
      )}

      {activeView === 'analytics' && (
        <FamilyAnalyticsAndCertificatesView
          language={language}
          learners={familySuite.learners}
          activeLearner={activeLearner}
          progress={progress}
          userEmail={effectiveEmail}
          googleAccessToken={effectiveToken}
          onSelectLearner={(learnerId) => {
            setFamilySuite((prev) => {
              const next = { ...prev, activeLearnerId: learnerId };
              void saveFamilyTutorSuite(next, effectiveEmail, effectiveToken);
              return next;
            });
          }}
          onAddLearner={({ name, avatar, ageGroup }: { name: string; avatar: string; ageGroup: LearnerAgeGroup }) => {
            const roleMap: Record<LearnerAgeGroup, string> = {
              kids_6_10: 'Playful Kids Track (Age 6–10)',
              teens: 'School & Debate Track',
              adult: 'Executive & Classical Track',
              elder: 'Heritage & Leisure Track',
            };
            const newId = `learner-${Date.now().toString(36)}`;
            setFamilySuite((prev) => {
              const next: FamilyTutorSuiteState = {
                activeLearnerId: newId,
                learners: [
                  ...prev.learners,
                  {
                    id: newId,
                    name,
                    avatar,
                    ageGroup,
                    roleLabel: roleMap[ageGroup],
                    createdAt: new Date().toISOString(),
                  },
                ],
                progressByLearner: {
                  ...prev.progressByLearner,
                  [newId]: buildDefaultProgressForLearner(ageGroup === 'kids_6_10'),
                },
              };
              void saveFamilyTutorSuite(next, effectiveEmail, effectiveToken);
              return next;
            });
            flashBanner(`👨‍👩‍👧‍👦 Added family learner "${name}" & synced to SQLite + Drive!`);
          }}
          onCertificateIssued={(cert: StageCompletionCertificate) => {
            updateAndPersistProgress((prev) => ({
              ...prev,
              xp: prev.xp + 100,
              certificates: [
                cert,
                ...(prev.certificates || []).filter((c) => c.id !== cert.id),
              ],
            }));
            flashBanner(`🎓 Stage ${cert.stageNumber} (${cert.cefrCode}) Certificate issued & archived to SQLite + Drive!`);
          }}
        />
      )}

      {activeView === 'roadmap' && (
        <CourseRoadmapStudioView
          language={language}
          completedModules={progress.completedModules}
          savedRecords={savedRecords}
          isConstructing={isConstructing}
          constructionStatus={constructionStatus}
          onConstructModule={(m) => handleConstructModule(m, 'lesson')}
          onConstructCustomCourse={handleConstructCustomCourse}
          onPracticeModuleLive={handlePracticeModuleLive}
          onOpenSavedCourse={handleOpenSavedRecord}
        />
      )}

      {activeView === 'lesson' && activeLesson && (
        <InteractiveLessonView
          lesson={activeLesson}
          masteredVocabIds={progress.masteredVocabIds}
          isConstructing={isConstructing}
          onReconstructFresh={handleReconstructFresh}
          onExportToDrive={handleExportActiveLessonToDrive}
          onPracticeLiveWithTutor={() => setActiveView('live')}
          onMarkVocabMastered={(vocabId) => {
            updateAndPersistProgress((prev) => {
              if (prev.masteredVocabIds.includes(vocabId)) return prev;
              return {
                ...prev,
                xp: prev.xp + 15,
                masteredVocabIds: [...prev.masteredVocabIds, vocabId],
              };
            });
          }}
          onCompleteLessonQuiz={(moduleId, masteryPercent, xpEarned) => {
            updateAndPersistProgress((prev) => ({
              ...prev,
              xp: prev.xp + xpEarned,
              completedModules: {
                ...prev.completedModules,
                [moduleId]: Math.max(prev.completedModules[moduleId] || 0, masteryPercent),
              },
            }));
            void saveTutorRecordEverywhere(
              {
                id: activeLesson.isCustomCourse ? `course-${activeLesson.id}` : `course-${moduleId}`,
                language: activeLesson.language,
                level: activeLesson.level,
                recordType: 'course_lesson',
                moduleId,
                title: activeLesson.title,
                payload: activeLesson,
                masteryPercent,
              },
              {
                userEmail: effectiveEmail,
                googleAccessToken: effectiveToken,
                exportMarkdownToDrive: false,
              }
            );
            flashBanner(`🏆 Saved ${masteryPercent}% Quiz Mastery (+${xpEarned} XP) to SQLite & Drive!`);
          }}
        />
      )}

      {activeView === 'vault' && (
        <TutorCourseVaultView
          records={savedRecords}
          isSyncing={isSyncing}
          hasGoogleToken={Boolean(effectiveToken)}
          onSyncAll={handleSyncAllVault}
          onRefreshFromCloud={() => refreshVault(true)}
          onOpenRecord={handleOpenSavedRecord}
          onDeleteRecord={async (id) => {
            await deleteTutorRecordEverywhere(id, effectiveEmail, effectiveToken);
            setSavedRecords((prev) => prev.filter((r) => r.id !== id));
          }}
        />
      )}

      {/* Session Transcript Preview Modal */}
      {sessionPreviewRecord && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-3xl bg-slate-900 border border-white/15 shadow-2xl overflow-hidden flex flex-col max-h-[82vh]">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-fuchsia-400" />
                <h4 className="text-sm font-extrabold text-white">{sessionPreviewRecord.title}</h4>
              </div>
              <button
                onClick={() => setSessionPreviewRecord(null)}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto space-y-2.5">
              {Array.isArray(sessionPreviewRecord.payload?.messages) &&
                sessionPreviewRecord.payload.messages.map((m: LiveTutorMessage, idx: number) => (
                  <div
                    key={idx}
                    className={`rounded-2xl p-3 text-xs border ${
                      m.role === 'tutor'
                        ? 'bg-indigo-950/60 border-indigo-400/30 text-white'
                        : 'bg-emerald-950/50 border-emerald-400/30 text-emerald-50 ml-6'
                    }`}
                  >
                    <div className="font-bold text-[10px] uppercase text-slate-300 mb-1">
                      {m.role === 'tutor' ? 'Tutor' : 'Learner'}
                    </div>
                    <p>{m.text}</p>
                    {m.betterPhrasing && (
                      <p className="mt-1 text-violet-200">✨ Upgrade: {m.betterPhrasing}</p>
                    )}
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

