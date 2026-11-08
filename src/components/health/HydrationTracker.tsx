import React, { useState, useEffect, useMemo } from 'react';
import {
  Droplets,
  Plus,
  Minus,
  CheckCircle,
  Cloud,
  Mic,
  Clock,
  Sparkles,
  Trash2,
  Users,
  Target,
  Flame,
  Award,
  ChevronRight,
  TrendingUp,
  X,
  Coffee,
  Check,
} from 'lucide-react';
import {
  HydrationLogEntry,
  BeverageType,
  FamilyHealthRecord,
} from '../../types/healthRecord';
import {
  getLocalHydrationLogs,
  logHydrationIntake,
  deleteHydrationLog,
  getTodayHydrationSummary,
  syncHydrationWithGoogleDrive,
  fetchHydrationLogsFromSqlite,
  DEFAULT_MEMBER_GOALS_ML,
  HYDRATION_FOLDER_PATH,
} from '../../services/hydrationDriveSync';
import {
  getLocalHealthRecords,
  getGoogleAccessToken,
} from '../../services/healthRecordDriveSync';

interface HydrationTrackerProps {
  initialMemberId?: string;
  onOpenVoiceAssistant?: () => void;
}

const PRESET_CONTAINERS = [
  { id: 'glass_250' as const, amountMl: 250, label: 'Glass', icon: '🥛', desc: 'Standard cup / tumbler' },
  { id: 'bottle_500' as const, amountMl: 500, label: 'Bottle', icon: '🍶', desc: 'Standard water bottle' },
  { id: 'sports_750' as const, amountMl: 750, label: 'Sports', icon: '🚴', desc: 'Active hydration flask' },
  { id: 'carafe_1000' as const, amountMl: 1000, label: 'Carafe', icon: '🫗', desc: 'Large jug / pitcher' },
];

const BEVERAGE_TYPES: { id: BeverageType; label: string; icon: string; color: string }[] = [
  { id: 'water', label: 'Pure Water', icon: '💧', color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' },
  { id: 'electrolyte', label: 'Electrolytes', icon: '⚡', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
  { id: 'lemon_water', label: 'Lemon Water', icon: '🍋', color: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
  { id: 'coconut_water', label: 'Coconut Water', icon: '🥥', color: 'bg-teal-500/20 text-teal-300 border-teal-500/40' },
  { id: 'herbal_tea', label: 'Herbal Infusion', icon: '🍵', color: 'bg-purple-500/20 text-purple-300 border-purple-500/40' },
  { id: 'soup_broth', label: 'Warm Broth', icon: '🥣', color: 'bg-orange-500/20 text-orange-300 border-orange-500/40' },
];

export const HydrationTracker: React.FC<HydrationTrackerProps> = ({
  initialMemberId,
  onOpenVoiceAssistant,
}) => {
  const [members, setMembers] = useState<FamilyHealthRecord[]>(() => getLocalHealthRecords());
  const [selectedMemberId, setSelectedMemberId] = useState<string>(
    initialMemberId || members[0]?.memberId || 'member_chinnathambi'
  );
  const [logs, setLogs] = useState<HydrationLogEntry[]>(() => getLocalHydrationLogs());
  const [isSyncingDrive, setIsSyncingDrive] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  // Custom Intake Form Modal
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const [customAmountMl, setCustomAmountMl] = useState<number>(300);
  const [customBeverage, setCustomBeverage] = useState<BeverageType>('water');
  const [customNotes, setCustomNotes] = useState('');

  // Daily Goal setting modal
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [editingGoalMl, setEditingGoalMl] = useState<number>(2500);

  const activeMember = useMemo(() => {
    return (
      members.find((m) => m.memberId === selectedMemberId || m.id === selectedMemberId) ||
      members[0] ||
      null
    );
  }, [members, selectedMemberId]);

  // Reactive updates
  useEffect(() => {
    const handleLogsChange = () => setLogs(getLocalHydrationLogs());
    const handleRecordsChange = () => setMembers(getLocalHealthRecords());

    window.addEventListener('aura_hydration_logs_changed', handleLogsChange);
    window.addEventListener('aura_health_records_changed', handleRecordsChange);
    window.addEventListener('storage', handleLogsChange);

    fetchHydrationLogsFromSqlite().then((dbLogs) => {
      if (dbLogs && dbLogs.length > 0) setLogs(dbLogs);
    });

    return () => {
      window.removeEventListener('aura_hydration_logs_changed', handleLogsChange);
      window.removeEventListener('aura_health_records_changed', handleRecordsChange);
      window.removeEventListener('storage', handleLogsChange);
    };
  }, []);

  // Summary for active member
  const summary = useMemo(() => {
    if (!activeMember) return null;
    return getTodayHydrationSummary(activeMember.memberId);
  }, [activeMember, logs]);

  // Set editing goal initial value
  useEffect(() => {
    if (summary?.dailyGoalMl) {
      setEditingGoalMl(summary.dailyGoalMl);
    }
  }, [summary?.dailyGoalMl]);

  // Handle Quick Intake
  const handleQuickLog = async (
    amountMl: number,
    container: HydrationLogEntry['container'],
    beverageType: BeverageType = 'water',
    notes?: string
  ) => {
    if (!activeMember) return;
    try {
      await logHydrationIntake({
        memberId: activeMember.memberId,
        memberName: activeMember.memberName,
        amountMl,
        beverageType,
        container,
        dailyGoalMl: summary?.dailyGoalMl || 2500,
        notes: notes || `Quick logged ${amountMl} mL via Hydration Tracker`,
        loggedBy: 'Manual Check',
      });
      setLogs(getLocalHydrationLogs());
    } catch (err) {
      console.warn('Error logging hydration:', err);
    }
  };

  // Handle Delete
  const handleDelete = async (id: string) => {
    await deleteHydrationLog(id);
    setLogs(getLocalHydrationLogs());
  };

  // Handle Manual Drive Sync
  const handleDriveSync = async () => {
    setIsSyncingDrive(true);
    setSyncNotice(null);
    try {
      const res = await syncHydrationWithGoogleDrive();
      if (res.success) {
        setSyncNotice(`Synced ${res.syncedCount} hydration entries with Google Drive & SQLite!`);
      } else {
        const token = getGoogleAccessToken();
        if (!token) {
          setSyncNotice('Local SQLite store synced. Connect Google Drive in Settings for cloud backup.');
        } else {
          setSyncNotice('Synchronized with local SQLite store.');
        }
      }
    } catch {
      setSyncNotice('Synced with SQLite database.');
    } finally {
      setIsSyncingDrive(false);
      setTimeout(() => setSyncNotice(null), 4000);
    }
  };

  // Circular Progress Ring Math
  const radius = 80;
  const strokeWidth = 14;
  const normalizedRadius = radius - strokeWidth * 0.5;
  const circumference = normalizedRadius * 2 * Math.PI;
  const progressClamped = Math.min(100, summary?.progressPercent || 0);
  const strokeDashoffset = circumference - (progressClamped / 100) * circumference;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header & Drive Location Banner */}
      <div className="p-4 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/30">
            <Droplets className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white tracking-wide">
                Smart Hydration & Cellular Water Balance
              </h2>
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-mono">
                AURO Voice Ready
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Daily electrolyte tracking, circular hydration rings, and Google Drive vault sync
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto">
          {onOpenVoiceAssistant && (
            <button
              onClick={onOpenVoiceAssistant}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/40 transition"
              title="Speak with Auro Voice Assistant"
            >
              <Mic className="w-3.5 h-3.5 text-cyan-400" />
              <span>Voice Log</span>
            </button>
          )}

          <button
            onClick={handleDriveSync}
            disabled={isSyncingDrive}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
          >
            <Cloud className={`w-3.5 h-3.5 ${isSyncingDrive ? 'animate-spin text-cyan-400' : 'text-slate-400'}`} />
            <span>{isSyncingDrive ? 'Syncing...' : 'Drive & SQLite'}</span>
          </button>

          <button
            onClick={() => setIsCustomModalOpen(true)}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-md shadow-cyan-600/30 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Custom Log</span>
          </button>
        </div>
      </div>

      {/* Sync Status Notice */}
      {syncNotice && (
        <div className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs px-4 py-2 rounded-2xl flex items-center gap-2 animate-fade-in">
          <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>{syncNotice}</span>
        </div>
      )}

      {/* Voice Assistant Speech Prompts Strip */}
      <div className="bg-gradient-to-r from-cyan-950/40 via-blue-950/40 to-slate-950/40 border border-cyan-500/30 rounded-2xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-cyan-200">
          <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
          <span className="font-semibold">Auro Voice Prompts:</span>
          <span className="text-slate-300 hidden md:inline">
            "Log 500ml water for Chinnathambi" • "I drank a glass of water" • "How much water did I drink today?"
          </span>
        </div>
        {onOpenVoiceAssistant && (
          <button
            onClick={onOpenVoiceAssistant}
            className="text-[11px] font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
          >
            <span>Ask Auro Now</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Family Member Carousel Switcher */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="font-bold uppercase tracking-wider flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-cyan-400" />
            Family Member Hydration ({members.length})
          </span>
          <span className="text-[11px] font-mono text-slate-500">
            Target: {summary?.dailyGoalMl} mL
          </span>
        </div>

        <div className="flex items-center gap-2.5 overflow-x-auto pb-1 scrollbar-none">
          {members.map((m) => {
            const isSelected = m.memberId === selectedMemberId || m.id === selectedMemberId;
            const mSummary = getTodayHydrationSummary(m.memberId);
            return (
              <button
                key={m.id}
                onClick={() => setSelectedMemberId(m.memberId)}
                className={`p-3 rounded-2xl border transition-all flex items-center gap-3 min-w-[170px] text-left shrink-0 ${
                  isSelected
                    ? 'bg-gradient-to-br from-cyan-950/80 to-blue-950/80 border-cyan-500/60 shadow-lg shadow-cyan-950/40'
                    : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                }`}
              >
                {m.avatar ? (
                  <img
                    src={m.avatar}
                    alt={m.memberName}
                    className="w-10 h-10 rounded-xl object-cover border border-slate-700 shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-cyan-950 border border-cyan-500/40 flex items-center justify-center font-bold text-cyan-300 text-sm shrink-0">
                    {m.memberName.slice(0, 2)}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="font-bold text-sm text-white truncate">{m.memberName}</div>
                  <div className="text-[11px] text-cyan-300 font-mono mt-0.5">
                    {mSummary.totalDrankMl} / {mSummary.dailyGoalMl} mL
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* CIRCULAR PROGRESS RING & INTAKE DASHBOARD */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
          {/* Main Circular Ring Card */}
          <div className="md:col-span-5 p-6 rounded-3xl bg-slate-900/90 border border-slate-800 flex flex-col items-center justify-center text-center shadow-xl relative overflow-hidden">
            <div className="w-full flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Target className="w-4 h-4 text-cyan-400" />
                Daily Target Progress
              </span>
              <button
                onClick={() => setIsGoalModalOpen(true)}
                className="text-[11px] font-semibold text-cyan-400 hover:underline flex items-center gap-1"
              >
                <span>Edit Goal ({summary.dailyGoalMl} mL)</span>
              </button>
            </div>

            {/* SVG Circular Ring with Wave Glow */}
            <div className="relative w-56 h-56 flex items-center justify-center my-2">
              <svg height={radius * 2} width={radius * 2} className="rotate-[-90deg]">
                <defs>
                  <linearGradient id="hydration-ring-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#22d3ee" />
                    <stop offset="50%" stopColor="#06b6d4" />
                    <stop offset="100%" stopColor="#2563eb" />
                  </linearGradient>
                </defs>
                {/* Background Ring */}
                <circle
                  stroke="rgba(30, 41, 59, 0.8)"
                  fill="transparent"
                  strokeWidth={strokeWidth}
                  r={normalizedRadius}
                  cx={radius}
                  cy={radius}
                />
                {/* Progress Ring */}
                <circle
                  stroke="url(#hydration-ring-gradient)"
                  fill="transparent"
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${circumference} ${circumference}`}
                  style={{ strokeDashoffset, transition: 'stroke-dashoffset 0.6s ease' }}
                  strokeLinecap="round"
                  r={normalizedRadius}
                  cx={radius}
                  cy={radius}
                />
              </svg>

              {/* Inside Center Details */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                <div className="p-2 rounded-full bg-cyan-500/10 text-cyan-400 mb-1">
                  <Droplets className="w-5 h-5 animate-bounce" />
                </div>
                <div className="text-4xl font-black text-white tracking-tight">
                  {summary.progressPercent}%
                </div>
                <div className="text-xs font-bold text-cyan-300 font-mono mt-0.5">
                  {summary.totalDrankMl.toLocaleString()} mL
                </div>
                <div className="text-[10px] text-slate-400">
                  of {summary.dailyGoalMl.toLocaleString()} mL Goal
                </div>
              </div>
            </div>

            {/* Status Footer */}
            <div className="mt-4 pt-4 border-t border-slate-800 w-full flex items-center justify-between text-xs">
              <span className="text-slate-400">
                {summary.remainingMl > 0 ? (
                  <span>
                    Need <strong className="text-cyan-300">{summary.remainingMl} mL</strong> more
                  </span>
                ) : (
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" /> Goal Exceeded!
                  </span>
                )}
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  summary.progressPercent >= 100
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : summary.progressPercent >= 60
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                }`}
              >
                {summary.progressPercent >= 100
                  ? 'SUPER HYDRATED'
                  : summary.progressPercent >= 60
                  ? 'ON TRACK'
                  : 'NEEDS WATER'}
              </span>
            </div>
          </div>

          {/* Quick-Log Actions & Hourly Distribution */}
          <div className="md:col-span-7 space-y-4">
            {/* Quick Container Buttons */}
            <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-3 shadow-xl">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <Plus className="w-4 h-4 text-cyan-400" />
                <span>One-Tap Quick Hydration Log</span>
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {PRESET_CONTAINERS.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => handleQuickLog(c.amountMl, c.id, 'water')}
                    className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 hover:border-cyan-500/60 hover:bg-slate-950/80 transition-all flex flex-col items-center justify-center text-center group"
                  >
                    <span className="text-2xl mb-1 group-hover:scale-110 transition-transform">
                      {c.icon}
                    </span>
                    <span className="font-bold text-xs text-white group-hover:text-cyan-300">
                      +{c.amountMl} mL
                    </span>
                    <span className="text-[10px] text-slate-400 mt-0.5">{c.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Hourly Distribution Bar Chart */}
            <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-3 shadow-xl">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-cyan-400" />
                  <span>Diurnal Intake Rhythm (mL)</span>
                </h3>
                <span className="text-[10px] text-slate-500 font-mono">Today's Timeline</span>
              </div>

              <div className="grid grid-cols-6 gap-2 items-end h-28 pt-4">
                {summary.timeBuckets.map((bucket, i) => {
                  const maxBucket = Math.max(1000, ...summary.timeBuckets.map((b) => b.amountMl));
                  const heightPercent = Math.max(10, Math.round((bucket.amountMl / maxBucket) * 100));
                  return (
                    <div key={i} className="flex flex-col items-center justify-end h-full gap-1.5">
                      <span className="text-[10px] font-mono text-cyan-300 font-bold">
                        {bucket.amountMl > 0 ? bucket.amountMl : ''}
                      </span>
                      <div className="w-full bg-slate-950 rounded-xl overflow-hidden h-16 flex items-end">
                        <div
                          style={{ height: `${heightPercent}%` }}
                          className={`w-full rounded-xl transition-all duration-500 ${
                            bucket.amountMl > 0
                              ? 'bg-gradient-to-t from-cyan-600 to-blue-500 shadow-md shadow-cyan-500/20'
                              : 'bg-slate-800/40'
                          }`}
                        />
                      </div>
                      <span className="text-[9px] font-semibold text-slate-400 text-center whitespace-nowrap">
                        {bucket.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TODAY'S DETAILED LOG HISTORY */}
      <div className="bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span>Today's Intake Log ({summary?.todayLogs.length || 0} Entries)</span>
          </h3>
          <span className="text-[11px] text-slate-400">
            Synced with SQLite & Google Drive
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/50 text-slate-400">
                <th className="py-2.5 px-4 font-semibold">Time</th>
                <th className="py-2.5 px-4 font-semibold">Amount</th>
                <th className="py-2.5 px-4 font-semibold">Beverage</th>
                <th className="py-2.5 px-4 font-semibold">Notes</th>
                <th className="py-2.5 px-4 font-semibold">Logged By</th>
                <th className="py-2.5 px-4 font-semibold text-right">Delete</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {summary?.todayLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-6 text-slate-500 italic">
                    No hydration logged yet for today. Use the buttons above or say "Auro, log 500ml water".
                  </td>
                </tr>
              ) : (
                summary?.todayLogs
                  .slice()
                  .reverse()
                  .map((log) => {
                    const beverageInfo =
                      BEVERAGE_TYPES.find((b) => b.id === log.beverageType) || BEVERAGE_TYPES[0];
                    return (
                      <tr key={log.id} className="hover:bg-slate-800/40 transition">
                        <td className="py-2.5 px-4 font-mono text-slate-300 whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="py-2.5 px-4 font-bold text-cyan-300 text-sm">
                          +{log.amountMl} mL
                        </td>
                        <td className="py-2.5 px-4">
                          <span
                            className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-md border ${beverageInfo.color}`}
                          >
                            <span>{beverageInfo.icon}</span>
                            <span>{beverageInfo.label}</span>
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-slate-300 max-w-xs truncate">
                          {log.notes || '—'}
                        </td>
                        <td className="py-2.5 px-4 text-slate-400 text-[11px]">
                          {log.loggedBy}
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <button
                            onClick={() => handleDelete(log.id)}
                            className="p-1 rounded text-slate-500 hover:text-rose-400 transition"
                            title="Delete entry"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CUSTOM LOG MODAL */}
      {isCustomModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Droplets className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white">
                  Log Water Intake for {activeMember?.memberName}
                </h3>
              </div>
              <button
                onClick={() => setIsCustomModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await handleQuickLog(customAmountMl, 'custom', customBeverage, customNotes);
                setIsCustomModalOpen(false);
                setCustomNotes('');
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Intake Volume (mL) *
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="20"
                    max="3000"
                    step="10"
                    required
                    value={customAmountMl}
                    onChange={(e) => setCustomAmountMl(parseInt(e.target.value, 10) || 250)}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xl font-bold text-white focus:outline-none focus:border-cyan-500 font-mono"
                  />
                  <span className="text-sm font-bold text-slate-400">mL</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Beverage Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {BEVERAGE_TYPES.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setCustomBeverage(b.id)}
                      className={`p-2 rounded-xl border text-xs font-semibold text-left flex items-center gap-2 transition ${
                        customBeverage === b.id
                          ? 'bg-cyan-600/30 text-white border-cyan-500'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800'
                      }`}
                    >
                      <span>{b.icon}</span>
                      <span>{b.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Notes / Context (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Post-lunch hydration, gym water bottle"
                  value={customNotes}
                  onChange={(e) => setCustomNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCustomModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-600/30 transition flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Log Intake</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT GOAL MODAL */}
      {isGoalModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Target className="w-4 h-4 text-cyan-400" />
                Adjust Daily Goal: {activeMember?.memberName}
              </h3>
              <button
                onClick={() => setIsGoalModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {[1500, 2000, 2500, 3000].map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setEditingGoalMl(g)}
                    className={`p-2 rounded-xl border text-xs font-bold ${
                      editingGoalMl === g
                        ? 'bg-cyan-600 text-white border-cyan-500'
                        : 'bg-slate-950 text-slate-300 border-slate-800'
                    }`}
                  >
                    {g} mL
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Custom Goal (mL):</label>
                <input
                  type="number"
                  min="500"
                  max="5000"
                  step="100"
                  value={editingGoalMl}
                  onChange={(e) => setEditingGoalMl(parseInt(e.target.value, 10) || 2500)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setIsGoalModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300"
              >
                Close
              </button>
              <button
                onClick={async () => {
                  DEFAULT_MEMBER_GOALS_ML[activeMember?.memberId || ''] = editingGoalMl;
                  // Log small update or refresh summary
                  setIsGoalModalOpen(false);
                  setLogs([...getLocalHydrationLogs()]);
                }}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-cyan-600 text-white"
              >
                Save Target
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
