import React, { useState, useEffect, useMemo } from 'react';
import {
  Footprints,
  Flame,
  Clock,
  Compass,
  TrendingUp,
  RefreshCw,
  Plus,
  Trash2,
  Calendar,
  CheckCircle2,
  Sparkles,
  ExternalLink,
  ChevronRight,
  User,
  Activity,
  Play,
  Square,
  BarChart3,
  MapPin,
  Heart,
  X,
} from 'lucide-react';
import {
  WalkingStepLogEntry,
  StepWalkType,
  FamilyHealthRecord,
} from '../../types/healthRecord';
import {
  getLocalWalkingStepLogs,
  fetchWalkingStepLogsFromSqlite,
  logWalkingSteps,
  deleteWalkingStepLog,
  getTodayStepsSummary,
  syncWalkingStepsWithGoogleDrive,
  STEPS_FOLDER_PATH,
  DEFAULT_MEMBER_STEP_GOALS,
  estimateDistanceMeters,
  estimateCalories,
  estimateDurationMinutes,
} from '../../services/walkingStepsDriveSync';
import { getLocalHealthRecords, getGoogleAccessToken } from '../../services/healthRecordDriveSync';
import {
  mobilePedometer,
  StepTickData,
  PedometerState,
} from '../../services/mobilePedometerService';

interface WalkingStepsTrackerProps {
  initialMemberId?: string;
  onOpenVoiceAssistant?: () => void;
}

export const WalkingStepsTracker: React.FC<WalkingStepsTrackerProps> = ({
  initialMemberId = 'member_chinnathambi',
  onOpenVoiceAssistant,
}) => {
  const [healthRecords] = useState<FamilyHealthRecord[]>(() => getLocalHealthRecords());
  const [selectedMemberId, setSelectedMemberId] = useState<string>(initialMemberId);
  const [logs, setLogs] = useState<WalkingStepLogEntry[]>(() =>
    getLocalWalkingStepLogs(initialMemberId)
  );
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);
  const [driveFolderLink, setDriveFolderLink] = useState<string | null>(null);

  // Real-time Mobile Pedometer State
  const [pedometerState, setPedometerState] = useState<PedometerState>(() =>
    mobilePedometer.getState()
  );
  const [isRealtimeActive, setIsRealtimeActive] = useState(() => mobilePedometer.getState().isActive);
  const [liveSessionSteps, setLiveSessionSteps] = useState(() => mobilePedometer.getState().sessionSteps);
  const [liveCadence, setLiveCadence] = useState(() => mobilePedometer.getState().currentCadence);
  const [isActivelyWalking, setIsActivelyWalking] = useState(() => mobilePedometer.getState().isWalking);
  const [selectedCadencePreset, setSelectedCadencePreset] = useState<number>(105);

  // Custom Add Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [inputSteps, setInputSteps] = useState(1500);
  const [inputWalkType, setInputWalkType] = useState<StepWalkType>('brisk_walking');
  const [inputDuration, setInputDuration] = useState(15);
  const [inputNotes, setInputNotes] = useState('');
  const [customGoal, setCustomGoal] = useState<number>(10000);

  // Refresh reactive logs
  const reloadData = () => {
    const updated = getLocalWalkingStepLogs(selectedMemberId);
    setLogs(updated);
  };

  useEffect(() => {
    reloadData();
    fetchWalkingStepLogsFromSqlite(selectedMemberId).then((sqliteLogs) => {
      setLogs(sqliteLogs);
    });

    const handleLogsChange = () => reloadData();

    // Listen to real-time step ticks from mobile accelerometer / cadence engine
    const handleStepTick = (e: any) => {
      const data: StepTickData = e.detail;
      if (data) {
        setLiveSessionSteps(data.sessionSteps);
        setLiveCadence(data.currentCadence);
        setIsActivelyWalking(data.isWalking);
        setPedometerState(mobilePedometer.getState());
        reloadData();
      }
    };

    window.addEventListener('aura_steps_logs_changed', handleLogsChange);
    window.addEventListener('aura_realtime_step_tick', handleStepTick);
    window.addEventListener('storage', handleLogsChange);

    return () => {
      window.removeEventListener('aura_steps_logs_changed', handleLogsChange);
      window.removeEventListener('aura_realtime_step_tick', handleStepTick);
      window.removeEventListener('storage', handleLogsChange);
    };
  }, [selectedMemberId]);

  // Active family member
  const currentMember = useMemo(() => {
    return (
      healthRecords.find(
        (r) =>
          r.memberId === selectedMemberId ||
          r.id === selectedMemberId ||
          r.memberName.toLowerCase() === selectedMemberId.toLowerCase()
      ) || healthRecords[0]
    );
  }, [healthRecords, selectedMemberId]);

  // Today Summary Metrics
  const summary = useMemo(() => {
    return getTodayStepsSummary(currentMember?.memberId || selectedMemberId);
  }, [currentMember, logs, selectedMemberId]);

  // Toggle Real-Time Mobile Pedometer
  const handleToggleRealtimePedometer = async () => {
    if (isRealtimeActive) {
      await mobilePedometer.stop();
      setIsRealtimeActive(false);
      setIsActivelyWalking(false);
      setLiveCadence(0);
    } else {
      await mobilePedometer.start(currentMember.memberId, currentMember.memberName);
      setIsRealtimeActive(true);
      setPedometerState(mobilePedometer.getState());
    }
  };

  const handleSetCadence = (spm: number) => {
    setSelectedCadencePreset(spm);
    if (isRealtimeActive) {
      mobilePedometer.enableCadenceEngine(spm);
    }
  };

  // Two-way Google Drive & SQLite synchronization handler
  const handleTwoWaySync = async () => {
    setIsSyncing(true);
    setSyncStatusMsg(null);
    try {
      const res = await syncWalkingStepsWithGoogleDrive();
      reloadData();
      if (res.success) {
        setDriveFolderLink(res.folderLink || `https://drive.google.com`);
        const pullMsg = res.pulledCount > 0 ? `Pulled ${res.pulledCount} updates from Drive. ` : '';
        setSyncStatusMsg(
          `Bidirectional sync complete! ${pullMsg}Unified SQLite + Google Drive (${res.syncedCount} member reports generated).`
        );
      } else {
        const token = getGoogleAccessToken();
        if (!token) {
          setSyncStatusMsg('SQLite records active. Connect Google Workspace to enable Google Drive 2-way sync.');
        } else {
          setSyncStatusMsg('Sync encountered an issue. Local SQLite records preserved.');
        }
      }
    } catch (err: any) {
      setSyncStatusMsg(`Sync notice: ${err?.message || 'Sync queued'}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // Quick Log One-Tap
  const handleQuickAdd = async (stepsToAdd: number, label: string, type: StepWalkType = 'brisk_walking') => {
    if (!currentMember) return;
    await logWalkingSteps({
      memberId: currentMember.memberId,
      memberName: currentMember.memberName,
      steps: stepsToAdd,
      walkType: type,
      notes: `Quick log: ${label}`,
      loggedBy: 'Quick Tap',
    });
    reloadData();
  };

  // Custom log submission
  const handleSaveCustomLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentMember || inputSteps <= 0) return;

    await logWalkingSteps({
      memberId: currentMember.memberId,
      memberName: currentMember.memberName,
      steps: inputSteps,
      walkType: inputWalkType,
      durationMinutes: inputDuration,
      notes: inputNotes.trim(),
      dailyStepGoal: customGoal,
      loggedBy: 'Manual Entry',
    });

    setIsAddModalOpen(false);
    setInputNotes('');
    reloadData();
  };

  // Delete Log
  const handleDelete = async (id: string) => {
    await deleteWalkingStepLog(id);
    reloadData();
  };

  // Circular progress calculations
  const radius = 64;
  const circumference = 2 * Math.PI * radius;
  const progressRatio = Math.min(1, summary.totalSteps / Math.max(1, summary.dailyStepGoal));
  const strokeDashoffset = circumference - progressRatio * circumference;

  const walkTypeLabels: Record<StepWalkType, string> = {
    brisk_walking: 'Brisk Walking',
    casual_stroll: 'Casual Stroll',
    power_walk: 'Power Walk',
    treadmill: 'Treadmill',
    hiking: 'Outdoor Trail / Hike',
    interval: 'Aerobic Interval',
  };

  return (
    <div className="space-y-6 animate-fade-in text-slate-100">
      {/* 1. Header & Member Selector Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl backdrop-blur-md">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-emerald-600/30">
            <Footprints className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white tracking-tight">Smart Walking Steps Tracker</h2>
              <span className="text-[11px] font-medium text-emerald-400">
                Pedometer & Longevity
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Live biometric step counting, diurnal cadence charts & two-way SQLite/Drive synchronization
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white shadow-md shadow-emerald-600/25 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Log Steps</span>
          </button>

          <button
            onClick={handleTwoWaySync}
            disabled={isSyncing}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition-all disabled:opacity-50"
            title="Two-way sync: Pull latest steps from Drive + push local records to Drive"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Drive & SQLite Sync'}</span>
          </button>
        </div>
      </div>

      {/* Sync Status Banner */}
      {syncStatusMsg && (
        <div className="p-3.5 rounded-2xl bg-slate-900 border border-emerald-500/30 text-xs flex items-center justify-between text-emerald-200 animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{syncStatusMsg}</span>
          </div>
          {driveFolderLink && (
            <a
              href={driveFolderLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 hover:underline shrink-0 ml-2"
            >
              <span>View Folder</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      )}

      {/* 2. Family Member Carousel Selection */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {healthRecords.map((m) => {
          const isSelected = m.memberId === selectedMemberId || m.id === selectedMemberId;
          const memberGoal = DEFAULT_MEMBER_STEP_GOALS[m.memberId] || 10000;
          return (
            <button
              key={m.memberId || m.id}
              onClick={() => setSelectedMemberId(m.memberId || m.id)}
              className={`flex items-center gap-2.5 px-4 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap transition-all border ${
                isSelected
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-700 text-white border-emerald-500/50 shadow-md shadow-emerald-600/30'
                  : 'bg-slate-900/80 text-slate-400 hover:text-white border-slate-800'
              }`}
            >
              <div className="w-6 h-6 rounded-full bg-slate-800 border border-white/20 flex items-center justify-center text-[10px] font-bold text-white overflow-hidden">
                {m.avatar ? (
                  <img src={m.avatar} alt={m.memberName} className="w-full h-full object-cover" />
                ) : (
                  m.memberName.charAt(0)
                )}
              </div>
              <span>{m.memberName}</span>
              <span className="text-[10px] font-normal opacity-80 tabular-nums">
                · {memberGoal.toLocaleString()} goal
              </span>
            </button>
          );
        })}
      </div>

      {/* 3. Primary Dashboard: Radial Progress Ring + Top 4 KPI Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Left: Big Circular Progress Ring Hero Card */}
        <div className="lg:col-span-5 p-6 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col items-center justify-center relative overflow-hidden shadow-xl">
          <div className="w-full flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Today's Step Target
            </span>
            <span className="text-xs font-bold text-emerald-400">
              {summary.progressPercent}% Achieved
            </span>
          </div>

          {/* SVG Circular Ring */}
          <div className="relative w-48 h-48 my-3 flex items-center justify-center">
            <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 160 160">
              {/* Background Ring */}
              <circle
                cx="80"
                cy="80"
                r={radius}
                className="stroke-slate-800"
                strokeWidth="12"
                fill="transparent"
              />
              {/* Animated Progress Gradient Ring */}
              <circle
                cx="80"
                cy="80"
                r={radius}
                className="stroke-emerald-400 transition-all duration-1000 ease-out"
                strokeWidth="12"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="transparent"
              />
            </svg>

            {/* Centered Numbers */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <Footprints className="w-6 h-6 text-emerald-400 mb-1" />
              <span className="text-3xl font-extrabold text-white tracking-tight tabular-nums font-mono">
                {summary.totalSteps.toLocaleString()}
              </span>
              <span className="text-xs text-slate-400 tabular-nums">
                of {summary.dailyStepGoal.toLocaleString()} steps
              </span>
            </div>
          </div>

          <div className="w-full mt-2 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span>
              {summary.remainingSteps > 0
                ? `${summary.remainingSteps.toLocaleString()} steps remaining`
                : 'Daily goal exceeded!'}
            </span>
            <span className="font-semibold text-slate-300">
              {currentMember.memberName}
            </span>
          </div>
        </div>

        {/* Right: 4 Health & Movement KPI Metric Cards */}
        <div className="lg:col-span-7 grid grid-cols-2 gap-3.5">
          {/* Card 1: Distance */}
          <div className="p-4 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col justify-between shadow-lg">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-medium">Distance Traveled</span>
              <div className="w-7 h-7 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
                <Compass className="w-4 h-4" />
              </div>
            </div>
            <div className="my-2">
              <div className="text-2xl font-bold text-white tabular-nums font-mono">
                {summary.totalDistanceKm} <span className="text-xs font-normal text-slate-400">km</span>
              </div>
              <div className="text-[11px] text-slate-400 tabular-nums">
                {summary.totalDistanceMiles} miles · {(summary.totalDistanceMeters).toLocaleString()} m
              </div>
            </div>
            <div className="text-[11px] text-slate-500">
              Based on 0.76m standard adult stride
            </div>
          </div>

          {/* Card 2: Active Duration */}
          <div className="p-4 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col justify-between shadow-lg">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-medium">Walking Duration</span>
              <div className="w-7 h-7 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="my-2">
              <div className="text-2xl font-bold text-white tabular-nums font-mono">
                {summary.totalDurationMinutes} <span className="text-xs font-normal text-slate-400">mins</span>
              </div>
              <div className="text-[11px] text-slate-400">
                {(summary.totalDurationMinutes / 60).toFixed(1)} hrs active movement
              </div>
            </div>
            <div className="text-[11px] text-slate-500">
              WHO cardio goal: 30+ mins/day
            </div>
          </div>

          {/* Card 3: Energy Burned */}
          <div className="p-4 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col justify-between shadow-lg">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-medium">Active Calories</span>
              <div className="w-7 h-7 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center">
                <Flame className="w-4 h-4" />
              </div>
            </div>
            <div className="my-2">
              <div className="text-2xl font-bold text-white tabular-nums font-mono">
                {summary.totalCaloriesBurned} <span className="text-xs font-normal text-slate-400">kcal</span>
              </div>
              <div className="text-[11px] text-slate-400 tabular-nums">
                ~{(summary.totalCaloriesBurned * 4.184).toFixed(0)} kJ metabolic energy
              </div>
            </div>
            <div className="text-[11px] text-slate-500">
              Aerobic expenditure
            </div>
          </div>

          {/* Card 4: Average Cadence */}
          <div className="p-4 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col justify-between shadow-lg">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-medium">Average Cadence</span>
              <div className="w-7 h-7 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <Activity className="w-4 h-4" />
              </div>
            </div>
            <div className="my-2">
              <div className="text-2xl font-bold text-white tabular-nums font-mono">
                {summary.averageCadence} <span className="text-xs font-normal text-slate-400">SPM</span>
              </div>
              <div className="text-[11px] text-emerald-400 font-semibold">
                Aerobic Brisk Pace
              </div>
            </div>
            <div className="text-[11px] text-slate-500">
              100–120 SPM stimulates cardiovascular flow
            </div>
          </div>
        </div>
      </div>

      {/* 4. One-Tap Quick Log Strip & Live Pedometer Simulator */}
      <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-300">
            One-Tap Quick Step Add
          </span>
          <span className="text-[11px] text-slate-400">
            Immediate SQLite persistence & background Drive sync
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <button
            onClick={() => handleQuickAdd(500, 'Desk break stretch', 'casual_stroll')}
            className="p-3 rounded-2xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/40 text-left transition-all group"
          >
            <div className="text-base font-bold text-white group-hover:text-emerald-400 font-mono">
              +500
            </div>
            <div className="text-xs text-slate-400">Desk Break Stroll</div>
            <div className="text-[10px] text-slate-500 mt-1">~5 mins · 20 kcal</div>
          </button>

          <button
            onClick={() => handleQuickAdd(1500, 'Brisk neighborhood loop', 'brisk_walking')}
            className="p-3 rounded-2xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/40 text-left transition-all group"
          >
            <div className="text-base font-bold text-white group-hover:text-emerald-400 font-mono">
              +1,500
            </div>
            <div className="text-xs text-slate-400">Brisk Walking Loop</div>
            <div className="text-[10px] text-slate-500 mt-1">~15 mins · 60 kcal</div>
          </button>

          <button
            onClick={() => handleQuickAdd(3000, 'Park & Lake Cardio', 'power_walk')}
            className="p-3 rounded-2xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/40 text-left transition-all group"
          >
            <div className="text-base font-bold text-white group-hover:text-emerald-400 font-mono">
              +3,000
            </div>
            <div className="text-xs text-slate-400">Lake Cardio Walk</div>
            <div className="text-[10px] text-slate-500 mt-1">~28 mins · 165 kcal</div>
          </button>

          <button
            onClick={() => handleQuickAdd(5000, 'Weekend Nature Hike', 'hiking')}
            className="p-3 rounded-2xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/40 text-left transition-all group"
          >
            <div className="text-base font-bold text-white group-hover:text-emerald-400 font-mono">
              +5,000
            </div>
            <div className="text-xs text-slate-400">Outdoor Trail Hike</div>
            <div className="text-[10px] text-slate-500 mt-1">~50 mins · 300 kcal</div>
          </button>
        </div>

        {/* Real-time Mobile Device Motion Pedometer Center */}
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950/30 border border-emerald-500/30 space-y-4 shadow-inner">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
                  isRealtimeActive
                    ? isActivelyWalking
                      ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/40 animate-pulse'
                      : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                <Footprints className={`w-6 h-6 ${isActivelyWalking ? 'animate-bounce' : ''}`} />
              </div>
              <div>
                <div className="text-sm font-bold text-white flex items-center gap-2 flex-wrap">
                  <span>Real-Time Mobile Pedometer</span>
                  <span
                    className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border ${
                      isRealtimeActive
                        ? pedometerState.sensorType === 'hardware_motion'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    {isRealtimeActive
                      ? pedometerState.sensorType === 'hardware_motion'
                        ? 'Phone Accelerometer Active'
                        : 'Real-Time Cadence Engine'
                      : 'Sensor Inactive'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  {isRealtimeActive
                    ? isActivelyWalking
                      ? `Walking detected · Cadence: ${liveCadence || 105} SPM · Session steps: +${liveSessionSteps}`
                      : 'Pedometer tracking active · Walk with phone in pocket or hand'
                    : 'Track live steps via physical smartphone accelerometer & motion sensors'}
                </p>
              </div>
            </div>

            {/* Main Start / Pause Motion Tracking Toggle */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleToggleRealtimePedometer}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs shadow-lg transition-all ${
                  isRealtimeActive
                    ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
                }`}
              >
                {isRealtimeActive ? (
                  <>
                    <Square className="w-3.5 h-3.5" />
                    <span>Pause Live Tracking</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" />
                    <span>Start Mobile Tracking</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Real-time Movement Telemetry & Cadence Presets */}
          {isRealtimeActive && (
            <div className="pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {/* Cadence Tempo Presets */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] font-semibold text-slate-400 mr-1">
                  Target Tempo:
                </span>
                {[
                  { label: 'Stroll (85 SPM)', spm: 85 },
                  { label: 'Brisk (105 SPM)', spm: 105 },
                  { label: 'Power (125 SPM)', spm: 125 },
                  { label: 'Trail (95 SPM)', spm: 95 },
                ].map((item) => (
                  <button
                    key={item.spm}
                    onClick={() => handleSetCadence(item.spm)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold font-mono transition-all border ${
                      selectedCadencePreset === item.spm
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* Live Session Counter */}
              <div className="flex items-center gap-3 text-xs text-slate-300 font-mono">
                <span>
                  Session: <b className="text-emerald-400 text-sm font-bold tabular-nums">+{liveSessionSteps}</b> steps
                </span>
                <span>·</span>
                <span>
                  ~{(estimateDistanceMeters(liveSessionSteps) / 1000).toFixed(2)} km
                </span>
                <span>·</span>
                <span>
                  ~{estimateCalories(liveSessionSteps)} kcal
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 5. 7-Day Trend Chart & Diurnal Hourly Cadence */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left: 7-Day Trend Chart */}
        <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold text-white">7-Day Step Progression</span>
            </div>
            <span className="text-[11px] text-slate-400">
              Daily Goal: {summary.dailyStepGoal.toLocaleString()}
            </span>
          </div>

          <div className="h-44 pt-4 flex items-end justify-between gap-2 border-b border-slate-800 pb-2">
            {summary.last7Days.map((day) => {
              const maxSteps = Math.max(14000, summary.dailyStepGoal * 1.3);
              const heightPercent = Math.min(100, Math.max(8, Math.round((day.steps / maxSteps) * 100)));
              return (
                <div key={day.dateStr} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group">
                  <span className="text-[10px] font-mono text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity tabular-nums">
                    {day.steps > 0 ? (day.steps > 1000 ? `${(day.steps / 1000).toFixed(1)}k` : day.steps) : '0'}
                  </span>
                  <div
                    style={{ height: `${heightPercent}%` }}
                    className={`w-full max-w-[28px] rounded-t-lg transition-all duration-500 ${
                      day.achieved
                        ? 'bg-gradient-to-t from-emerald-600 to-teal-400 shadow-sm shadow-emerald-500/20'
                        : 'bg-slate-800 group-hover:bg-slate-700'
                    }`}
                  />
                  <span className={`text-[10px] font-medium ${day.dayLabel === 'Today' ? 'text-emerald-400 font-bold' : 'text-slate-400'}`}>
                    {day.dayLabel}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" />
              <span>Goal Met ({summary.dailyStepGoal.toLocaleString()}+ steps)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-sm bg-slate-800 inline-block" />
              <span>Under Target</span>
            </div>
          </div>
        </div>

        {/* Right: Diurnal Cadence Hourly Distribution */}
        <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-bold text-white">Today's Hourly Distribution</span>
            </div>
            <span className="text-[11px] text-slate-400">Pacing Rhythm</span>
          </div>

          <div className="space-y-2.5 pt-2">
            {summary.timeBuckets.map((bucket) => {
              const maxBucket = Math.max(3000, ...summary.timeBuckets.map((b) => b.steps));
              const fillPercent = Math.min(100, Math.round((bucket.steps / maxBucket) * 100));
              return (
                <div key={bucket.label} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">{bucket.label}</span>
                    <span className="text-white font-mono font-semibold tabular-nums">
                      {bucket.steps.toLocaleString()} steps
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-950 overflow-hidden">
                    <div
                      style={{ width: `${fillPercent}%` }}
                      className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full transition-all duration-700"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 6. Step Logs Timeline & Records Table */}
      <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-bold text-white">
              Walking Step Logs ({logs.length} entries for {currentMember.memberName})
            </h3>
          </div>
          <div className="text-xs text-slate-400">
            Synced with SQLite & Google Drive
          </div>
        </div>

        {logs.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs">
            No walking steps recorded yet for this family member. Use the one-tap buttons above to log steps.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-[11px]">
                  <th className="py-3 px-3 font-semibold">Time & Date</th>
                  <th className="py-3 px-3 font-semibold">Activity Type</th>
                  <th className="py-3 px-3 font-semibold">Steps</th>
                  <th className="py-3 px-3 font-semibold">Distance</th>
                  <th className="py-3 px-3 font-semibold">Duration</th>
                  <th className="py-3 px-3 font-semibold">Calories</th>
                  <th className="py-3 px-3 font-semibold">Cadence</th>
                  <th className="py-3 px-3 font-semibold">Source</th>
                  <th className="py-3 px-3 font-semibold">Drive</th>
                  <th className="py-3 px-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {logs.map((log) => {
                  const d = new Date(log.timestamp);
                  const timeFormatted = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  const dateFormatted = d.toLocaleDateString([], { month: 'short', day: 'numeric' });

                  return (
                    <tr key={log.id} className="hover:bg-slate-800/40 transition-colors group">
                      <td className="py-3 px-3 whitespace-nowrap text-slate-300 font-sans">
                        <div className="font-semibold text-white">{timeFormatted}</div>
                        <div className="text-[10px] text-slate-500">{dateFormatted}</div>
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap font-sans">
                        <span className="font-medium text-slate-200">
                          {walkTypeLabels[log.walkType] || log.walkType}
                        </span>
                        {log.notes && (
                          <div className="text-[10px] text-slate-400 truncate max-w-[140px]">
                            {log.notes}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap font-bold text-emerald-400 tabular-nums">
                        {log.steps.toLocaleString()}
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap text-slate-300 tabular-nums">
                        {(log.distanceMeters / 1000).toFixed(2)} km
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap text-slate-300 tabular-nums">
                        {log.durationMinutes} min
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap text-slate-300 tabular-nums">
                        {log.caloriesBurned} kcal
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap text-slate-400 tabular-nums text-[11px]">
                        {log.cadenceAvg || 100} SPM
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap font-sans text-[11px] text-slate-400">
                        {log.loggedBy}
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap text-[11px]">
                        {log.driveWebViewLink ? (
                          <a
                            href={log.driveWebViewLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-emerald-400 hover:underline flex items-center gap-1"
                          >
                            <span>Drive</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        ) : (
                          <span className="text-slate-500">Local SQLite</span>
                        )}
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap text-right">
                        <button
                          onClick={() => handleDelete(log.id)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                          title="Delete entry"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 7. Modal: Custom Step Log Form */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 border border-emerald-500/30 rounded-3xl w-full max-w-md p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Footprints className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">Log Walking Activity</h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomLog} className="space-y-4 pt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Family Member
                </label>
                <div className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white font-medium">
                  {currentMember.memberName} ({currentMember.relationship})
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Step Count
                </label>
                <input
                  type="number"
                  min="1"
                  max="100000"
                  value={inputSteps}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 0;
                    setInputSteps(val);
                    setInputDuration(estimateDurationMinutes(val));
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-emerald-500 text-sm text-white font-mono focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Activity Type
                  </label>
                  <select
                    value={inputWalkType}
                    onChange={(e) => setInputWalkType(e.target.value as StepWalkType)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none"
                  >
                    <option value="brisk_walking">Brisk Walking</option>
                    <option value="casual_stroll">Casual Stroll</option>
                    <option value="power_walk">Power Walk</option>
                    <option value="treadmill">Treadmill</option>
                    <option value="hiking">Trail Hike</option>
                    <option value="interval">Aerobic Interval</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Duration (Minutes)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="600"
                    value={inputDuration}
                    onChange={(e) => setInputDuration(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white font-mono focus:outline-none"
                  />
                </div>
              </div>

              {/* Calculated estimates pill */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] flex items-center justify-between text-slate-400">
                <span>Est. Distance: <b className="text-white font-mono">{(estimateDistanceMeters(inputSteps) / 1000).toFixed(2)} km</b></span>
                <span>Est. Calories: <b className="text-emerald-400 font-mono">{estimateCalories(inputSteps, inputWalkType)} kcal</b></span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Park walk with family, brisk pace"
                  value={inputNotes}
                  onChange={(e) => setInputNotes(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white shadow-md shadow-emerald-600/30 transition-all"
                >
                  Save Log Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating Mobile Sticky Real-Time Pedometer Bar */}
      {isRealtimeActive && (
        <div className="fixed bottom-20 left-4 right-4 max-w-md mx-auto z-40 p-3 rounded-2xl bg-slate-900/95 border border-emerald-500/40 backdrop-blur-xl shadow-2xl flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center ${isActivelyWalking ? 'animate-bounce' : ''}`}>
              <Footprints className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                <span>Real-Time Pedometer</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              </div>
              <div className="text-[10px] text-slate-400 font-mono">
                {isActivelyWalking ? `${liveCadence || 105} SPM active pace` : 'Tracking motion in pocket'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="text-right">
              <div className="text-sm font-bold text-emerald-400 font-mono tabular-nums">
                {summary.totalSteps.toLocaleString()}
              </div>
              <div className="text-[10px] text-slate-400">
                {summary.progressPercent}% Goal
              </div>
            </div>
            <button
              onClick={handleToggleRealtimePedometer}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-rose-400 hover:text-white transition-colors"
              title="Pause tracking"
            >
              <Square className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
