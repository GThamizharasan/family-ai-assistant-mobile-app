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
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  ConstructedLanguageLesson,
  LanguageModuleSummary,
  LiveTutorMessage,
  ProficiencyLevel,
  SavedLanguageTutorRecord,
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
  constructLanguageLessonWithAi,
  deleteTutorRecordEverywhere,
  loadAllSavedTutorRecords,
  loadTutorProgress,
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
  const [progress, setProgress] = useState<TutorProgressState>(() => loadTutorProgress());
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
      if (['live', 'roadmap', 'lesson', 'vault'].includes(detail.view)) {
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

        // Restore latest progress snapshot if newer
        const snap = merged.find((r) => r.recordType === 'progress_snapshot' && r.payload?.xp);
        if (snap && snap.payload.xp > progress.xp) {
          setProgress((prev) => ({ ...prev, ...snap.payload }));
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
    setProgress((prev) => {
      const next = updater(prev);
      void saveTutorProgress(next, effectiveEmail, effectiveToken);
      return next;
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

          {/* Tactile Language Toggle Pill */}
          <div className="flex items-center gap-1.5 bg-slate-950/80 p-1.5 rounded-2xl border border-white/15 self-start lg:self-center shrink-0">
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

      {/* 4 Studio Navigation Views */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          {
            id: 'live' as TutorStudioView,
            label: 'Live Human Tutor',
            sub: 'Voice & Role-Play',
            icon: Mic,
            grad: 'from-rose-500 to-amber-500',
          },
          {
            id: 'roadmap' as TutorStudioView,
            label: 'Course Roadmap',
            sub: '18 Stages + AI Builder',
            icon: Map,
            grad: 'from-violet-500 to-fuchsia-600',
          },
          {
            id: 'lesson' as TutorStudioView,
            label: 'Lesson & Script Lab',
            sub: isTamil ? 'உயிர்மெய் + Drills' : '12-Tense + Drills',
            icon: BookOpen,
            grad: 'from-cyan-500 to-indigo-600',
          },
          {
            id: 'vault' as TutorStudioView,
            label: 'SQLite + Drive Vault',
            sub: `${savedRecords.filter((r) => r.recordType !== 'progress_snapshot').length} Saved Items`,
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
              className={`rounded-2xl p-3 border text-left transition-all cursor-pointer flex items-center gap-2.5 ${
                isActive
                  ? `bg-gradient-to-r ${item.grad} text-white border-white/30 shadow-lg`
                  : 'bg-slate-900/80 border-white/10 text-slate-300 hover:border-white/25 hover:text-white'
              }`}
            >
              <div
                className={`p-2 rounded-xl shrink-0 ${
                  isActive ? 'bg-white/20' : 'bg-slate-950/80'
                }`}
              >
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-extrabold truncate">{item.label}</div>
                <div
                  className={`text-[10px] truncate ${
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
            updateAndPersistProgress((prev) => ({
              ...prev,
              xp: prev.xp + xp,
              totalLiveTurns: prev.totalLiveTurns + 1,
              averageFluency:
                typeof fluencyScore === 'number'
                  ? Math.round((prev.averageFluency * 3 + fluencyScore) / 4)
                  : prev.averageFluency,
            }));
          }}
          onSaveSessionRecord={handleSaveSessionRecord}
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

