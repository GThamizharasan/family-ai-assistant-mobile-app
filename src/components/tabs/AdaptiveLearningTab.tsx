import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BookOpen,
  Languages,
  Calculator,
  Atom,
  FlaskConical,
  Leaf,
  Dna,
  Brain,
  PenTool,
  ClipboardCheck,
  Activity,
  Sparkles,
  CheckCircle2,
  Zap,
  Database,
  Terminal,
  Settings2,
  X,
  Wand2,
  Loader2,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useApp } from '../../context/AppContext';
import {
  BlackboardSnapshot,
  ConceptNode,
  CustomSubjectConfig,
  DifficultyLevel,
  EngagementWavePoint,
  GradingResult,
  LearningStyle,
  PillarTab,
  StudentEngagementPod,
  SubjectDefinition,
  SubjectId,
  SynapticAlert,
} from '../../types/adaptiveLearning';
import {
  buildCustomSubjectDefinition,
  CUSTOM_SUBJECT_THEME_PRESETS,
  DEFAULT_CLASSROOM_ROSTER,
  SUBJECT_CATALOG,
} from '../../data/adaptiveCurriculumData';
import {
  exportAdaptiveArtifactToDrive,
  generateCustomSubjectTopicsWithAi,
  loadCustomSubjectConfig,
  loadGradingHistory,
  loadSubjectMasteryMap,
  saveCustomSubjectConfig,
  saveGradingResult,
  saveSubjectMasteryMap,
  syncAdaptiveLearningFromSqlite,
} from '../../services/adaptiveLearningService';
import { NeuralCanvasBackdrop } from '../learning/NeuralCanvasBackdrop';
import { AdaptiveEngineView } from '../learning/AdaptiveEngineView';
import { SmartBlackboardView } from '../learning/SmartBlackboardView';
import { AutoGraderView } from '../learning/AutoGraderView';
import { ClassroomEngagementView } from '../learning/ClassroomEngagementView';

const ICON_MAP: Record<SubjectDefinition['iconName'], React.FC<{ className?: string }>> = {
  BookOpen,
  Languages,
  Calculator,
  Atom,
  FlaskConical,
  Leaf,
  Dna,
  Terminal,
  Sparkles,
};

const QUICK_CUSTOM_TEMPLATES: Array<{
  label: string;
  emoji: string;
  name: string;
  shortTag: string;
  tagline: string;
  topics: string[];
}> = [
  {
    label: 'Robotics',
    emoji: '🤖',
    name: 'Robotics & Automation',
    shortTag: 'ROBO',
    tagline: 'Sensors, actuators, PID control loops, kinematics & embedded AI autonomy',
    topics: [
      'Sensors, Motors & Microcontrollers',
      'Actuators, Gears & Mechanical Linkages',
      'Feedback Control & PID Stabilization',
      'Forward & Inverse Kinematics',
      'Autonomous Navigation & Computer Vision',
    ],
  },
  {
    label: 'World History',
    emoji: '🌍',
    name: 'World History',
    shortTag: 'HIST',
    tagline: 'Ancient civilizations, trade routes, scientific revolutions & modern geopolitics',
    topics: [
      'River Valley & Classical Civilizations',
      'Silk Road Trade & Cultural Exchanges',
      'Renaissance & Scientific Revolution',
      'Industrialization & Nation-States',
      '20th Century Global Transformations',
    ],
  },
  {
    label: 'Economics',
    emoji: '💹',
    name: 'Economics & Finance',
    shortTag: 'ECON',
    tagline: 'Supply & demand, market equilibrium, monetary policy, compounding & global trade',
    topics: [
      'Scarcity, Opportunity Cost & Incentives',
      'Supply, Demand & Market Equilibrium',
      'Elasticity & Market Structures',
      'Inflation, GDP & Central Bank Policy',
      'Compounding, Portfolios & Trade Balance',
    ],
  },
  {
    label: 'Cybersecurity',
    emoji: '🛡️',
    name: 'Cybersecurity',
    shortTag: 'SEC',
    tagline: 'CIA triad, TLS cryptography, authentication hardening & ethical threat defense',
    topics: [
      'CIA Triad & Security Threat Models',
      'Symmetric, Asymmetric & TLS Encryption',
      'AuthN/AuthZ, MFA & Zero-Trust Identity',
      'OWASP Web & API Defense Patterns',
      'Incident Response & Network Forensics',
    ],
  },
  {
    label: 'Music Theory',
    emoji: '🎵',
    name: 'Music Theory & Rhythm',
    shortTag: 'MUS',
    tagline: 'Scales, intervals, chord progressions, time signatures & melodic composition',
    topics: [
      'Notes, Pitch Staff & Rhythm Subdivision',
      'Major/Minor Scales & Key Signatures',
      'Intervals & Triad/Seventh Chord Harmony',
      'Cadences, Voice Leading & Progressions',
      'Form, Ear Training & Song Arrangement',
    ],
  },
  {
    label: 'Civics & Law',
    emoji: '⚖️',
    name: 'Civics & Constitutional Law',
    shortTag: 'LAW',
    tagline: 'Constitutional rights, separation of powers, jurisprudence & civic governance',
    topics: [
      'Foundations of Constitutional Governance',
      'Separation of Powers & Checks',
      'Fundamental Rights & Civil Liberties',
      'Statutory Interpretation & Precedent',
      'Public Policy Analysis & Global Law',
    ],
  },
];

function buildInitialWave(): EngagementWavePoint[] {
  return [
    { timeLabel: '-25s', focus: 76, cognitiveFlow: 71, voiceActivity: 60 },
    { timeLabel: '-20s', focus: 79, cognitiveFlow: 74, voiceActivity: 65 },
    { timeLabel: '-15s', focus: 82, cognitiveFlow: 78, voiceActivity: 72 },
    { timeLabel: '-10s', focus: 80, cognitiveFlow: 81, voiceActivity: 70 },
    { timeLabel: '-5s', focus: 85, cognitiveFlow: 83, voiceActivity: 78 },
    { timeLabel: 'Now', focus: 88, cognitiveFlow: 86, voiceActivity: 82 },
  ];
}

export const AdaptiveLearningTab: React.FC = () => {
  const { user, googleAccessToken } = useApp();

  // Read any deep-link launch payload from Home Hub or Voice Assistant
  const consumeInitialLaunch = (): { subject?: SubjectId; pillar?: PillarTab } => {
    try {
      const raw = sessionStorage.getItem('aura_adaptive_launch');
      if (raw) {
        sessionStorage.removeItem('aura_adaptive_launch');
        return JSON.parse(raw);
      }
    } catch {}
    return {};
  };

  const initialLaunch = consumeInitialLaunch();

  const [activeSubjectId, setActiveSubjectId] = useState<SubjectId>(
    initialLaunch.subject || 'physics'
  );
  const [activePillar, setActivePillar] = useState<PillarTab>(
    initialLaunch.pillar || 'adaptive'
  );

  // Configurable On-Demand Custom Subject State (LocalStorage + SQLite + Drive Synced)
  const [customSubjectConfig, setCustomSubjectConfig] = useState<CustomSubjectConfig>(() =>
    loadCustomSubjectConfig()
  );
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [draftCustomConfig, setDraftCustomConfig] = useState<CustomSubjectConfig>(() =>
    loadCustomSubjectConfig()
  );
  const [isGeneratingCustomTopics, setIsGeneratingCustomTopics] = useState(false);

  const allSubjects = useMemo(
    () =>
      SUBJECT_CATALOG.map((s) =>
        s.id === 'custom' ? buildCustomSubjectDefinition(customSubjectConfig) : s
      ),
    [customSubjectConfig]
  );

  const activeSubject =
    allSubjects.find((s) => s.id === activeSubjectId) || allSubjects[3] || allSubjects[0];

  const [selectedConceptId, setSelectedConceptId] = useState<string>(
    activeSubject.concepts[0].id
  );
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('core');
  const [learningStyle, setLearningStyle] = useState<LearningStyle>('visual');

  // Shared SQLite + Drive Backed State
  const [masteryMap, setMasteryMap] = useState<Record<string, number>>(() =>
    loadSubjectMasteryMap()
  );
  const [gradingHistory, setGradingHistory] = useState<GradingResult[]>(() =>
    loadGradingHistory()
  );
  const [pendingBoardSnapshot, setPendingBoardSnapshot] =
    useState<BlackboardSnapshot | null>(null);
  const [blackboardModeRequest, setBlackboardModeRequest] = useState<{
    mode: 'free' | 'math_practice';
    nonce: number;
  }>({ mode: 'free', nonce: 0 });

  // Live Classroom Nervous System Telemetry
  const [isTelemetryLive, setIsTelemetryLive] = useState(true);
  const [engagementWave, setEngagementWave] = useState<EngagementWavePoint[]>(
    buildInitialWave
  );
  const [classroomPods, setClassroomPods] = useState<StudentEngagementPod[]>(
    DEFAULT_CLASSROOM_ROSTER
  );
  const [synapticAlerts, setSynapticAlerts] = useState<SynapticAlert[]>([
    {
      id: 'alert-quantum',
      severity: 'insight',
      title: 'Quantum Concept Opportunity',
      message:
        'Quantum Photoelectric Effect has lower baseline mastery (42%) — launch interactive diagrams on the Smart Blackboard!',
      subjectId: 'physics',
      targetPillar: 'blackboard',
      targetConceptId: 'phy-quantum',
      actionLabel: 'Open Board',
      timestamp: new Date().toLocaleTimeString(),
    },
    {
      id: 'alert-tamil',
      severity: 'nudge',
      title: 'Tamil & Bilingual Oratory',
      message:
        'Practicing Thirukkural voice explanation on the Smart Blackboard boosts class engagement +11%.',
      subjectId: 'tamil',
      targetPillar: 'blackboard',
      targetConceptId: 'tam-kural',
      actionLabel: 'Try தமிழ் Board',
      timestamp: new Date().toLocaleTimeString(),
    },
    {
      id: 'alert-organic',
      severity: 'breakthrough',
      title: 'Deep Flow Streak Ready',
      message:
        'Jump into Chemistry Aromatic Benzene ring Auto-Grader for an instant Honors promotion check.',
      subjectId: 'chemistry',
      targetPillar: 'grader',
      targetConceptId: 'chem-organic',
      actionLabel: 'Auto-Grade',
      timestamp: new Date().toLocaleTimeString(),
    },
  ]);

  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3600);
  }, []);

  // Hydrate from SQLite on mount
  useEffect(() => {
    syncAdaptiveLearningFromSqlite(user?.email).then(
      ({ masteryMap: m, grades, customSubjectConfig: syncedCustom }) => {
        setMasteryMap(m);
        setGradingHistory(grades);
        setCustomSubjectConfig(syncedCustom);
      }
    );
  }, [user?.email]);

  // Listen to live launch events if tab is already mounted
  useEffect(() => {
    const handleLaunchEvent = (e: any) => {
      const detail = e?.detail || {};
      if (detail.subject && allSubjects.some((s) => s.id === detail.subject)) {
        setActiveSubjectId(detail.subject);
        const subj = allSubjects.find((s) => s.id === detail.subject);
        if (subj) setSelectedConceptId(subj.concepts[0].id);
      }
      if (
        detail.pillar &&
        ['adaptive', 'blackboard', 'grader', 'engagement'].includes(detail.pillar)
      ) {
        setActivePillar(detail.pillar);
      }
    };
    window.addEventListener('aura_adaptive_learning_launch', handleLaunchEvent);
    return () =>
      window.removeEventListener('aura_adaptive_learning_launch', handleLaunchEvent);
  }, [allSubjects]);

  // Keep selected concept aligned when switching subject
  const handleSelectSubject = (subjId: SubjectId) => {
    setActiveSubjectId(subjId);
    const found = allSubjects.find((s) => s.id === subjId);
    if (found && found.concepts[0]) {
      setSelectedConceptId(found.concepts[0].id);
    }
  };

  const openCustomSubjectModal = () => {
    setDraftCustomConfig({
      ...customSubjectConfig,
      topics: [...customSubjectConfig.topics],
    });
    setShowCustomModal(true);
  };

  const handleGenerateCustomTopics = async () => {
    if (!draftCustomConfig.name.trim()) return;
    setIsGeneratingCustomTopics(true);
    try {
      const generated = await generateCustomSubjectTopicsWithAi(
        draftCustomConfig.name,
        draftCustomConfig.tagline
      );
      setDraftCustomConfig((prev) => ({
        ...prev,
        tagline: generated.tagline,
        shortTag: generated.shortTag,
        topics: generated.topics,
      }));
      showToast(`✨ Generated 5 AI adaptive topics for "${draftCustomConfig.name}"!`);
    } finally {
      setIsGeneratingCustomTopics(false);
    }
  };

  const handleSaveCustomSubject = (e: React.FormEvent) => {
    e.preventDefault();
    const saved = saveCustomSubjectConfig(draftCustomConfig, user?.email, googleAccessToken);
    setCustomSubjectConfig(saved);
    setActiveSubjectId('custom');
    setSelectedConceptId('custom-c1');
    setShowCustomModal(false);
    showToast(`✅ Configured "${saved.name}" & synced to SQLite / Drive!`);
  };

  // Realtime telemetry heartbeat (every 2.5s when live)
  useEffect(() => {
    if (!isTelemetryLive) return;
    const timer = setInterval(() => {
      setEngagementWave((prev) => {
        const last = prev[prev.length - 1] || {
          focus: 84,
          cognitiveFlow: 80,
          voiceActivity: 74,
        };
        const jitter = () => Math.round((Math.random() - 0.46) * 5);
        const nextFocus = Math.min(99, Math.max(58, last.focus + jitter()));
        const nextFlow = Math.min(99, Math.max(55, last.cognitiveFlow + jitter()));
        const nextVoice = Math.min(99, Math.max(45, last.voiceActivity + jitter()));
        const nowStr = new Date().toLocaleTimeString([], {
          minute: '2-digit',
          second: '2-digit',
        });
        return [
          ...prev.slice(-11),
          {
            timeLabel: nowStr,
            focus: nextFocus,
            cognitiveFlow: nextFlow,
            voiceActivity: nextVoice,
          },
        ];
      });

      setClassroomPods((prev) =>
        prev.map((pod) => {
          if (pod.role === 'You (Lead)') return pod;
          const delta = Math.round((Math.random() - 0.48) * 3);
          const nextScore = Math.min(98, Math.max(48, pod.focusScore + delta));
          const nextStatus: StudentEngagementPod['status'] =
            nextScore >= 85
              ? 'deep_flow'
              : nextScore >= 70
              ? 'engaged'
              : nextScore >= 58
              ? 'needs_nudge'
              : 'fatigued';
          return {
            ...pod,
            focusScore: nextScore,
            status: nextStatus,
          };
        })
      );
    }, 2500);

    return () => clearInterval(timer);
  }, [isTelemetryLive]);

  // Update You (Lead) pod + Engagement Wave whenever user interacts across pillars
  const pushUserPulse = (focusBoost: number, voiceBoost: number, note: string) => {
    setClassroomPods((prev) =>
      prev.map((pod) => {
        if (pod.role !== 'You (Lead)') return pod;
        const nextScore = Math.min(99, Math.max(60, pod.focusScore + focusBoost));
        return {
          ...pod,
          focusScore: nextScore,
          status: nextScore >= 85 ? 'deep_flow' : 'engaged',
          currentConcept: note,
        };
      })
    );

    setEngagementWave((prev) => {
      const last = prev[prev.length - 1] || {
        focus: 85,
        cognitiveFlow: 82,
        voiceActivity: 75,
      };
      return [
        ...prev.slice(-11),
        {
          timeLabel: 'Pulse',
          focus: Math.min(99, Math.max(60, last.focus + focusBoost)),
          cognitiveFlow: Math.min(99, Math.max(60, last.cognitiveFlow + focusBoost + 2)),
          voiceActivity: Math.min(99, Math.max(50, last.voiceActivity + voiceBoost)),
        },
      ];
    });
  };

  // Callback from Pillar 1: Adaptive Quiz Answer
  const handleMasteryUpdate = (
    conceptId: string,
    delta: number,
    isCorrect: boolean,
    responseTimeSec: number,
    calibrationNote: string
  ) => {
    setMasteryMap((prev) => {
      const currentVal = prev[conceptId] ?? 65;
      const nextVal = Math.min(100, Math.max(15, currentVal + delta));
      const updated = { ...prev, [conceptId]: nextVal };
      saveSubjectMasteryMap(updated, user?.email, activeSubject.id);
      return updated;
    });

    pushUserPulse(
      isCorrect ? 4 : -1,
      2,
      `${activeSubject.name} (${responseTimeSec}s)`
    );

    if (!isCorrect) {
      const conceptObj = activeSubject.concepts.find((c) => c.id === conceptId);
      setSynapticAlerts((prev) => [
        {
          id: `alert-${Date.now()}`,
          severity: 'nudge',
          title: `Scaffold Triggered: ${conceptObj?.title || activeSubject.name}`,
          message: `Missed question — launch visual diagram walkthrough on Smart Blackboard?`,
          subjectId: activeSubject.id,
          targetPillar: 'blackboard',
          targetConceptId: conceptId,
          actionLabel: 'Visualize',
          timestamp: new Date().toLocaleTimeString(),
        },
        ...prev.slice(0, 3),
      ]);
    } else {
      showToast(calibrationNote);
    }
  };

  // Callback from Pillar 2: Blackboard Drawing / Voice Activity
  const handleBlackboardActivity = useCallback(
    (type: 'draw' | 'voice' | 'ai_solve', summary: string) => {
      pushUserPulse(
        type === 'ai_solve' ? 5 : 2,
        type === 'voice' || type === 'ai_solve' ? 12 : 2,
        summary
      );
    },
    []
  );

  // Callback from Pillar 3: Auto-Grader evaluated submission
  const handleGradedSubmission = (result: GradingResult) => {
    const updatedList = saveGradingResult(result, user?.email);
    setGradingHistory(updatedList);

    // Reward mastery on lead concept if score >= 75
    const masteryDelta = result.overallScore >= 85 ? 9 : result.overallScore >= 70 ? 5 : 1;
    setMasteryMap((prev) => {
      const targetId = selectedConceptId || activeSubject.concepts[0].id;
      const nextVal = Math.min(100, (prev[targetId] ?? 68) + masteryDelta);
      const updated = { ...prev, [targetId]: nextVal };
      saveSubjectMasteryMap(updated, user?.email, activeSubject.id);
      return updated;
    });

    pushUserPulse(5, result.inputMode === 'voice' ? 10 : 4, `Graded ${result.overallScore}%`);
    showToast(`Saved ${result.letterGrade} (${result.overallScore}%) to SQLite Mastery Vault!`);
  };

  // Callback for Google Drive Cloud Backup
  const handleSyncToDrive = async (title: string, content: string) => {
    showToast(`Syncing "${title}" to Google Drive...`);
    try {
      const res = await exportAdaptiveArtifactToDrive(
        title,
        content,
        activeSubject.name,
        googleAccessToken,
        user?.email
      );
      showToast(`✅ Synced to Drive: ${res.folderPath}`);
    } catch (err: any) {
      showToast(`Saved locally in SQLite (Connect Google Drive for cloud mirror)`);
    }
  };

  // Nudge peer student from Engagement Monitor
  const handleNudgeStudent = (podId: string, actionLabel: string) => {
    setClassroomPods((prev) =>
      prev.map((pod) => {
        if (pod.id !== podId) return pod;
        const boosted = Math.min(97, pod.focusScore + 14);
        return {
          ...pod,
          focusScore: boosted,
          status: boosted >= 85 ? 'deep_flow' : 'engaged',
          lastNudge: `Boosted: ${actionLabel}`,
        };
      })
    );
    showToast(`⚡ Sent "${actionLabel}" — learner rejoined classroom flow!`);
  };

  const handleExecuteAlert = (alert: SynapticAlert) => {
    handleSelectSubject(alert.subjectId);
    if (alert.targetConceptId) {
      setSelectedConceptId(alert.targetConceptId);
    }
    setActivePillar(alert.targetPillar);
    showToast(`Routed to ${alert.subjectId.toUpperCase()} → ${alert.targetPillar.toUpperCase()}`);
  };

  const handleTriggerLiveDemo = () => {
    pushUserPulse(6, 12, 'Live Synaptic Classroom Burst');
    setActivePillar('engagement');
    showToast('⚡ Live Classroom Nervous System telemetry boosted across all 8 learner pods!');
  };

  const activeConceptObj =
    activeSubject.concepts.find((c) => c.id === selectedConceptId) ||
    activeSubject.concepts[0];

  const subjectAvgMastery = Math.round(
    activeSubject.concepts.reduce(
      (sum, c) => sum + (masteryMap[c.id] ?? c.mastery),
      0
    ) / Math.max(1, activeSubject.concepts.length)
  );

  return (
    <div className="relative min-h-[75vh] space-y-4 pb-8">
      {/* Live Animated Neural Synaptic Backdrop */}
      <NeuralCanvasBackdrop
        accentHex={activeSubject.accentHex}
        secondaryHex={activeSubject.secondaryHex}
      />

      {/* Toast Notification Banner */}
      {toastMsg && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-2xl bg-slate-950/95 border border-cyan-400/60 text-cyan-200 text-xs font-bold shadow-2xl backdrop-blur-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-3 max-w-[92vw]">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="truncate">{toastMsg}</span>
        </div>
      )}

      {/* =====================================================================
          HERO HEADER — "REWIRING THE CLASSROOM'S NERVOUS SYSTEM"
          ===================================================================== */}
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        className={`relative z-10 rounded-3xl bg-gradient-to-br ${activeSubject.gradientClass} border ${activeSubject.borderClass} p-4 sm:p-5 shadow-2xl overflow-hidden backdrop-blur-xl`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full bg-slate-950/80 border border-cyan-500/40 text-[10px] font-mono font-bold text-cyan-300 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                NERVOUS SYSTEM LIVE
              </span>
              <span className="px-2 py-0.5 rounded-full bg-slate-950/70 border border-slate-700 text-[10px] font-mono text-slate-300 flex items-center gap-1">
                <Database className="w-3 h-3 text-amber-400" />
                SQLite + Drive Synced
              </span>
            </div>

            <h2 className="text-lg sm:text-2xl font-extrabold text-white tracking-tight animate-chalk-shimmer">
              AI Adaptive Learning Engine
            </h2>
            <p className="text-xs sm:text-sm text-slate-200/90 max-w-2xl">
              Rewiring the classroom’s nervous system across {allSubjects.length} subjects (including Python & your on-demand Custom Subject) — uniting adaptive mastery paths, speech-powered neon blackboards, automated grading, and live focus telemetry.
            </p>
          </div>

          <div className="flex sm:flex-col items-center sm:items-end gap-2 shrink-0">
            <div className="px-3.5 py-2 rounded-2xl bg-slate-950/80 border border-white/15 text-center">
              <span className="text-[10px] font-mono uppercase text-slate-400 block">
                {activeSubject.name} Mastery
              </span>
              <span
                className="text-xl font-extrabold tabular-nums"
                style={{ color: activeSubject.accentHex }}
              >
                {subjectAvgMastery}%
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap justify-end">
              {activeSubjectId === 'custom' && (
                <button
                  type="button"
                  onClick={openCustomSubjectModal}
                  className="px-3 py-1.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 text-[11px] font-extrabold flex items-center gap-1.5 shadow-lg cursor-pointer transition-all active:scale-95"
                >
                  <Settings2 className="w-3.5 h-3.5" />
                  <span>Configure Custom Subject</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  handleSelectSubject('maths');
                  setBlackboardModeRequest({ mode: 'math_practice', nonce: Date.now() });
                  setActivePillar('blackboard');
                  showToast('✏️ Paperless Kids Math Practice (+ − × ÷) Ready!');
                }}
                className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 text-slate-950 text-[11px] font-extrabold flex items-center gap-1.5 shadow-lg cursor-pointer transition-all active:scale-95"
              >
                <PenTool className="w-3.5 h-3.5" />
                <span>✏️ Kids Math Practice (+ − × ÷)</span>
              </button>

              <button
                type="button"
                onClick={handleTriggerLiveDemo}
                className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-bold flex items-center gap-1.5 shadow-lg cursor-pointer transition-all active:scale-95"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Pulse Telemetry</span>
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* =====================================================================
          INTERACTIVE SUBJECT SPECTRUM DOCK (8 CORE + PYTHON + CUSTOM ON-DEMAND)
          ===================================================================== */}
      <div
        className="relative z-10 flex items-center gap-2 overflow-x-auto no-scrollbar py-1 px-0.5 scroll-smooth"
        style={{ WebkitOverflowScrolling: 'touch' }}
        role="tablist"
        aria-label="Subjects"
      >
        {allSubjects.map((subj) => {
          const Icon = ICON_MAP[subj.iconName];
          const isSelected = subj.id === activeSubjectId;
          const avg = Math.round(
            subj.concepts.reduce((s, c) => s + (masteryMap[c.id] ?? c.mastery), 0) /
              Math.max(1, subj.concepts.length)
          );

          return (
            <button
              key={subj.id}
              type="button"
              role="tab"
              aria-selected={isSelected}
              onClick={() => handleSelectSubject(subj.id)}
              className={`shrink-0 px-3 py-2 rounded-2xl border transition-all flex items-center gap-2 cursor-pointer ${
                isSelected
                  ? 'bg-slate-900 border-white/50 text-white shadow-xl scale-[1.03]'
                  : 'bg-slate-900/65 hover:bg-slate-900 border-slate-800 text-slate-300'
              }`}
              style={
                isSelected
                  ? { boxShadow: `0 0 18px ${subj.accentHex}35` }
                  : undefined
              }
            >
              <div
                className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  backgroundColor: `${subj.accentHex}22`,
                  color: subj.accentHex,
                }}
              >
                <Icon className="w-4 h-4" />
              </div>
              <div className="text-left">
                <div className="text-xs font-bold leading-tight flex items-center gap-1.5">
                  <span>{subj.name}</span>
                  {subj.id === 'tamil' && (
                    <span className="text-[10px] text-amber-300">தமிழ்</span>
                  )}
                  {subj.id === 'custom' && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectSubject('custom');
                        openCustomSubjectModal();
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          e.stopPropagation();
                          handleSelectSubject('custom');
                          openCustomSubjectModal();
                        }
                      }}
                      title="Configure Custom Subject Name, Topics & Theme"
                      className="p-0.5 rounded-md bg-slate-800 hover:bg-teal-500 hover:text-slate-950 text-teal-300 transition-colors"
                    >
                      <Settings2 className="w-3 h-3" />
                    </span>
                  )}
                </div>
                <div className="text-[10px] font-mono text-slate-400">
                  {avg}% mastery
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* =====================================================================
          4-PILLAR COMMAND SWITCHER
          ===================================================================== */}
      <div
        className="relative z-10 grid grid-cols-2 sm:grid-cols-4 gap-2"
        role="tablist"
        aria-label="Adaptive Classroom Pillars"
      >
        {(
          [
            {
              id: 'adaptive',
              label: 'Adaptive Engine',
              sub: 'Neural Graph & Quiz',
              icon: Brain,
              color: 'text-cyan-400',
            },
            {
              id: 'blackboard',
              label: 'Smart Whiteboard',
              sub: 'Graph, Shapes & Voice',
              icon: PenTool,
              color: 'text-amber-400',
            },
            {
              id: 'grader',
              label: 'Auto-Grader AI',
              sub: 'Instant 4-Axis Rubric',
              icon: ClipboardCheck,
              color: 'text-emerald-400',
            },
            {
              id: 'engagement',
              label: 'Class Telemetry',
              sub: 'Live Focus Heatmap',
              icon: Activity,
              color: 'text-purple-400',
            },
          ] as const
        ).map((pillar) => {
          const Icon = pillar.icon;
          const isCurrent = activePillar === pillar.id;
          return (
            <button
              key={pillar.id}
              type="button"
              role="tab"
              aria-selected={isCurrent}
              onClick={() => setActivePillar(pillar.id)}
              className={`p-2.5 sm:p-3 rounded-2xl border text-left transition-all flex items-center gap-2.5 cursor-pointer ${
                isCurrent
                  ? 'bg-slate-900 border-cyan-400/60 shadow-lg shadow-cyan-950/40'
                  : 'bg-slate-950/75 hover:bg-slate-900/90 border-slate-800/90'
              }`}
            >
              <div className="w-8 h-8 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center shrink-0">
                <Icon className={`w-4 h-4 ${pillar.color}`} />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-white truncate">
                  {pillar.label}
                </div>
                <div className="text-[10px] text-slate-400 truncate">
                  {pillar.sub}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* =====================================================================
          ACTIVE PILLAR WORKSPACE
          ===================================================================== */}
      <div className="relative z-10">
        {activePillar === 'adaptive' && (
          <AdaptiveEngineView
            subject={activeSubject}
            masteryMap={masteryMap}
            selectedConceptId={selectedConceptId}
            onSelectConcept={setSelectedConceptId}
            difficulty={difficulty}
            onChangeDifficulty={setDifficulty}
            learningStyle={learningStyle}
            onChangeLearningStyle={setLearningStyle}
            onMasteryUpdate={handleMasteryUpdate}
            onSendConceptToBlackboard={(concept) => {
              setSelectedConceptId(concept.id);
              setBlackboardModeRequest({ mode: 'free', nonce: Date.now() });
              setActivePillar('blackboard');
              showToast(`Loaded "${concept.title}" onto Smart Blackboard`);
            }}
            onSendToGrader={(concept) => {
              setSelectedConceptId(concept.id);
              setActivePillar('grader');
            }}
          />
        )}

        {activePillar === 'blackboard' && (
          <SmartBlackboardView
            subject={activeSubject}
            activeConcept={activeConceptObj}
            initialMode={blackboardModeRequest.mode}
            modeNonce={blackboardModeRequest.nonce}
            userEmail={user?.email}
            googleAccessToken={googleAccessToken}
            onBlackboardActivity={handleBlackboardActivity}
            onExportToGrader={(snapshot) => {
              setPendingBoardSnapshot(snapshot);
              setActivePillar('grader');
              showToast('Blackboard snapshot attached to Auto-Grader!');
            }}
            onSyncToDrive={handleSyncToDrive}
          />
        )}

        {activePillar === 'grader' && (
          <AutoGraderView
            subject={activeSubject}
            pendingBlackboardSnapshot={pendingBoardSnapshot}
            onClearBlackboardSnapshot={() => setPendingBoardSnapshot(null)}
            gradingHistory={gradingHistory}
            onGraded={handleGradedSubmission}
            onJumpToAdaptive={() => setActivePillar('adaptive')}
            onSyncToDrive={handleSyncToDrive}
          />
        )}

        {activePillar === 'engagement' && (
          <ClassroomEngagementView
            subject={activeSubject}
            allSubjects={allSubjects}
            masteryMap={masteryMap}
            gradingHistory={gradingHistory}
            engagementWave={engagementWave}
            classroomPods={classroomPods}
            synapticAlerts={synapticAlerts}
            isTelemetryLive={isTelemetryLive}
            onToggleTelemetryLive={() => setIsTelemetryLive((v) => !v)}
            onNudgeStudent={handleNudgeStudent}
            onExecuteAlert={handleExecuteAlert}
            onSelectSubject={handleSelectSubject}
          />
        )}
      </div>

      {/* Subtle Bottom Attribution */}
      <div className="relative z-10 flex items-center justify-center gap-2 text-[10px] font-mono text-slate-500 pt-2">
        <Sparkles className="w-3 h-3 text-cyan-400" />
        <span>
          Aura Adaptive Nervous System • {allSubjects.length} Subjects (incl. Python & Custom) • Neon Chalk Speech Engine • SQLite & Drive Sync
        </span>
      </div>

      {/* =====================================================================
          ON-DEMAND CUSTOM SUBJECT CONFIGURATOR MODAL
          ===================================================================== */}
      {showCustomModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-xl rounded-3xl bg-slate-900 border border-teal-500/40 shadow-2xl overflow-hidden my-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/60">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-300">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-white">
                    Configure Custom Subject On Demand
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Customize name, 5 adaptive topics & theme — saved to SQLite & Google Drive
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCustomModal(false)}
                className="p-2 rounded-xl bg-slate-800/80 text-slate-400 hover:text-white cursor-pointer"
                aria-label="Close Custom Subject Configurator"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomSubject} className="p-4 sm:p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              {/* 1-Click Starter Templates */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">
                  Quick Starter Presets
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_CUSTOM_TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.label}
                      type="button"
                      onClick={() =>
                        setDraftCustomConfig((prev) => ({
                          ...prev,
                          name: tpl.name,
                          nativeName: `${tpl.name} Studio`,
                          shortTag: tpl.shortTag,
                          tagline: tpl.tagline,
                          topics: [...tpl.topics],
                        }))
                      }
                      className="px-2.5 py-1 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 text-xs text-slate-200 flex items-center gap-1 cursor-pointer transition-all"
                    >
                      <span>{tpl.emoji}</span>
                      <span className="font-semibold">{tpl.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Subject Name + AI Auto-Generate Syllabus Button */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-200 block">
                  Subject Name
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    required
                    value={draftCustomConfig.name}
                    onChange={(e) =>
                      setDraftCustomConfig((prev) => ({
                        ...prev,
                        name: e.target.value,
                        nativeName: `${e.target.value} Track`,
                      }))
                    }
                    placeholder="e.g., Robotics, World History, Economics, Sanskrit..."
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-teal-400"
                  />
                  <button
                    type="button"
                    onClick={() => void handleGenerateCustomTopics()}
                    disabled={isGeneratingCustomTopics || !draftCustomConfig.name.trim()}
                    className="px-3 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow cursor-pointer shrink-0"
                  >
                    {isGeneratingCustomTopics ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Wand2 className="w-3.5 h-3.5" />
                    )}
                    <span>Auto-Generate 5 Topics with AI</span>
                  </button>
                </div>
              </div>

              {/* Focus Tagline + Short Tag + Language */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                <div className="sm:col-span-6 space-y-1">
                  <label className="text-xs font-bold text-slate-300 block">
                    Subtitle / Learning Goal
                  </label>
                  <input
                    type="text"
                    value={draftCustomConfig.tagline}
                    onChange={(e) =>
                      setDraftCustomConfig((prev) => ({ ...prev, tagline: e.target.value }))
                    }
                    placeholder="Core concepts, projects & exam mastery"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-teal-400"
                  />
                </div>
                <div className="sm:col-span-3 space-y-1">
                  <label className="text-xs font-bold text-slate-300 block">
                    Short Tag
                  </label>
                  <input
                    type="text"
                    maxLength={5}
                    value={draftCustomConfig.shortTag}
                    onChange={(e) =>
                      setDraftCustomConfig((prev) => ({
                        ...prev,
                        shortTag: e.target.value.toUpperCase(),
                      }))
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs font-mono text-white focus:outline-none focus:border-teal-400"
                  />
                </div>
                <div className="sm:col-span-3 space-y-1">
                  <label className="text-xs font-bold text-slate-300 block">
                    Language
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setDraftCustomConfig((prev) => ({
                        ...prev,
                        defaultLanguage: prev.defaultLanguage === 'ta-IN' ? 'en-US' : 'ta-IN',
                      }))
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs font-bold text-amber-300 hover:bg-slate-800 cursor-pointer"
                  >
                    {draftCustomConfig.defaultLanguage === 'ta-IN' ? '🇮🇳 தமிழ்' : '🇺🇸 ENG'}
                  </button>
                </div>
              </div>

              {/* Color Theme Swatches */}
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-slate-300 block">
                  Theme Color Accent
                </span>
                <div className="flex flex-wrap gap-2">
                  {CUSTOM_SUBJECT_THEME_PRESETS.map((preset) => {
                    const isPicked = draftCustomConfig.accentHex === preset.accentHex;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() =>
                          setDraftCustomConfig((prev) => ({
                            ...prev,
                            accentHex: preset.accentHex,
                            secondaryHex: preset.secondaryHex,
                          }))
                        }
                        className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-bold flex items-center gap-1.5 cursor-pointer ${
                          isPicked
                            ? 'bg-slate-800 border-white text-white shadow'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: preset.accentHex }}
                        />
                        <span>{preset.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 5 Editable Syllabus Topics */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-200 block">
                  5 Concept Mastery Units (Foundation → Olympiad)
                </span>
                {[0, 1, 2, 3, 4].map((idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="w-16 text-[10px] font-mono text-slate-400 shrink-0">
                      Unit {idx + 1}
                    </span>
                    <input
                      type="text"
                      required={idx < 3}
                      value={draftCustomConfig.topics[idx] || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setDraftCustomConfig((prev) => {
                          const next = [...prev.topics];
                          next[idx] = val;
                          return { ...prev, topics: next };
                        });
                      }}
                      placeholder={`Concept Unit ${idx + 1}`}
                      className="flex-1 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-teal-400"
                    />
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCustomModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs font-bold text-slate-300 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-teal-400 to-cyan-400 hover:from-teal-300 hover:to-cyan-300 text-slate-950 text-xs font-extrabold flex items-center gap-1.5 shadow-lg cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Save & Sync (SQLite + Drive)</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

