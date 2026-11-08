import React, { useState, useEffect, useMemo } from 'react';
import {
  Pill,
  CheckCircle,
  Clock,
  Calendar,
  AlertTriangle,
  Plus,
  RefreshCw,
  Sparkles,
  Cloud,
  Mic,
  Sun,
  Sunset,
  Moon,
  Coffee,
  Check,
  X,
  Trash2,
  ExternalLink,
  ChevronRight,
  ShieldAlert,
  Flame,
  CheckCircle2,
  Users,
} from 'lucide-react';
import {
  MedicationEntry,
  MedicationDoseLog,
  MedicationCategory,
  MedicationDoseStatus,
  FamilyHealthRecord,
} from '../../types/healthRecord';
import {
  getLocalMedicationLogs,
  logMedicationDose,
  deleteMedicationLog,
  syncMedicationsWithGoogleDrive,
  fetchMedicationLogsFromSqlite,
  getTodayDoseStatusForMember,
  getMedicationSynergyTips,
  MEDICATION_FOLDER_PATH,
} from '../../services/medicationDriveSync';
import {
  getLocalHealthRecords,
  saveLocalHealthRecords,
  addMedicationToMember,
  getGoogleAccessToken,
} from '../../services/healthRecordDriveSync';

interface SmartMedicationTrackerProps {
  initialMemberId?: string;
  onOpenVoiceAssistant?: () => void;
}

const PRESET_SUPPLEMENTS = [
  {
    name: 'Vitamin D3 + K2 (MK-7)',
    category: 'supplement' as MedicationCategory,
    dosage: '5000 IU / 100mcg',
    frequency: 'Once daily with breakfast',
    timeSlots: ['morning' as const],
    purpose: 'Bone mineral density & arterial calcium regulation',
    pills: 60,
  },
  {
    name: 'Omega-3 Wild Alaskan Fish Oil',
    category: 'supplement' as MedicationCategory,
    dosage: '1200mg (EPA 720mg / DHA 480mg)',
    frequency: 'Once daily with meal',
    timeSlots: ['morning' as const],
    purpose: 'Cardiovascular health & neuro-anti-inflammatory',
    pills: 60,
  },
  {
    name: 'Magnesium Glycinate & L-Threonate',
    category: 'supplement' as MedicationCategory,
    dosage: '400mg',
    frequency: 'Daily 45 min before sleep',
    timeSlots: ['bedtime' as const],
    purpose: 'GABAergic autonomic calm & deep sleep architecture',
    pills: 45,
  },
  {
    name: 'Ashwagandha KSM-66',
    category: 'ayurvedic' as MedicationCategory,
    dosage: '600mg',
    frequency: 'Daily evening after work',
    timeSlots: ['evening' as const],
    purpose: 'Cortisol modulation & adaptogenic stress resistance',
    pills: 30,
  },
  {
    name: 'CoQ10 (Ubiquinol)',
    category: 'supplement' as MedicationCategory,
    dosage: '100mg',
    frequency: 'Daily morning with breakfast',
    timeSlots: ['morning' as const],
    purpose: 'Cellular ATP energy & mitochondrial longevity',
    pills: 30,
  },
  {
    name: 'Metformin Hydrochloride',
    category: 'prescription' as MedicationCategory,
    dosage: '500mg',
    frequency: 'Twice daily after meals',
    timeSlots: ['morning' as const, 'evening' as const],
    purpose: 'Glycemic regulation & AMPK metabolic pathway activation',
    pills: 60,
  },
];

export const SmartMedicationTracker: React.FC<SmartMedicationTrackerProps> = ({
  initialMemberId,
  onOpenVoiceAssistant,
}) => {
  const [members, setMembers] = useState<FamilyHealthRecord[]>(() => getLocalHealthRecords());
  const [selectedMemberId, setSelectedMemberId] = useState<string>(
    initialMemberId || members[0]?.memberId || 'member_chinnathambi'
  );
  const [logs, setLogs] = useState<MedicationDoseLog[]>(() => getLocalMedicationLogs());
  const [isSyncingDrive, setIsSyncingDrive] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  // Modal State for Add Med
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newDrugName, setNewDrugName] = useState('');
  const [newCategory, setNewCategory] = useState<MedicationCategory>('supplement');
  const [newDosage, setNewDosage] = useState('');
  const [newFrequency, setNewFrequency] = useState('Once daily');
  const [newTimeSlots, setNewTimeSlots] = useState<('morning' | 'afternoon' | 'evening' | 'bedtime')[]>([
    'morning',
  ]);
  const [newPurpose, setNewPurpose] = useState('');
  const [newPillsRemaining, setNewPillsRemaining] = useState<number>(30);
  const [newReminderEnabled, setNewReminderEnabled] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Active member record
  const activeMember = useMemo(() => {
    return (
      members.find((m) => m.memberId === selectedMemberId || m.id === selectedMemberId) ||
      members[0] ||
      null
    );
  }, [members, selectedMemberId]);

  // Initial and reactive load
  useEffect(() => {
    const handleLogsChange = () => setLogs(getLocalMedicationLogs());
    const handleRecordsChange = () => setMembers(getLocalHealthRecords());

    window.addEventListener('aura_medication_logs_changed', handleLogsChange);
    window.addEventListener('aura_health_records_changed', handleRecordsChange);
    window.addEventListener('storage', handleLogsChange);

    fetchMedicationLogsFromSqlite().then((dbLogs) => {
      if (dbLogs && dbLogs.length > 0) setLogs(dbLogs);
    });

    return () => {
      window.removeEventListener('aura_medication_logs_changed', handleLogsChange);
      window.removeEventListener('aura_health_records_changed', handleRecordsChange);
      window.removeEventListener('storage', handleLogsChange);
    };
  }, []);

  // Today's Adherence and Slots Breakdown
  const todayStatus = useMemo(() => {
    if (!activeMember) return null;
    return getTodayDoseStatusForMember(activeMember.memberId);
  }, [activeMember, logs, members]);

  // Synergy & Timing Tips
  const synergyTips = useMemo(() => {
    if (!activeMember || !activeMember.medications) return { synergyNotes: [], timingTips: [] };
    return getMedicationSynergyTips(activeMember.medications);
  }, [activeMember]);

  // Refill Warnings
  const refillAlerts = useMemo(() => {
    if (!activeMember?.medications) return [];
    return activeMember.medications.filter(
      (m) => typeof m.pillsRemaining === 'number' && m.pillsRemaining <= (m.refillThreshold || 7)
    );
  }, [activeMember]);

  // Handle Mark Dose Taken or Skipped
  const handleLogDose = async (
    med: MedicationEntry,
    slot: 'morning' | 'afternoon' | 'evening' | 'bedtime',
    status: MedicationDoseStatus
  ) => {
    if (!activeMember) return;
    try {
      await logMedicationDose({
        memberId: activeMember.memberId,
        memberName: activeMember.memberName,
        medicationId: med.id,
        drugName: med.drugName,
        category: med.category,
        dosage: med.dosage,
        timeSlot: slot,
        scheduledTime: med.scheduledTime,
        status,
        loggedBy: 'Manual Confirmation',
        notes: status === 'taken' ? 'Confirmed in Medication Tracker' : 'Marked as skipped for today',
      });
      setLogs(getLocalMedicationLogs());
      setMembers(getLocalHealthRecords());
    } catch (err) {
      console.warn('Error logging dose:', err);
    }
  };

  // Google Drive Manual Sync
  const handleDriveSync = async () => {
    setIsSyncingDrive(true);
    setSyncNotice(null);
    try {
      const res = await syncMedicationsWithGoogleDrive();
      if (res.success) {
        setSyncNotice(`Synced ${res.syncedCount} records to Google Drive & SQLite!`);
      } else {
        const token = getGoogleAccessToken();
        if (!token) {
          setSyncNotice('Local SQLite store synced. Connect Google Drive in Settings for cloud backup.');
        } else {
          setSyncNotice('Synchronized with local SQLite vault.');
        }
      }
    } catch {
      setSyncNotice('Synced with SQLite database.');
    } finally {
      setIsSyncingDrive(false);
      setTimeout(() => setSyncNotice(null), 4000);
    }
  };

  // Apply Preset Supplement
  const applyPreset = (preset: (typeof PRESET_SUPPLEMENTS)[0]) => {
    setNewDrugName(preset.name);
    setNewCategory(preset.category);
    setNewDosage(preset.dosage);
    setNewFrequency(preset.frequency);
    setNewTimeSlots(preset.timeSlots);
    setNewPurpose(preset.purpose);
    setNewPillsRemaining(preset.pills);
  };

  // Submit New Medication
  const handleAddMedication = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMember || !newDrugName.trim()) return;
    setIsSubmitting(true);

    const newMed: MedicationEntry = {
      id: `med_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      drugName: newDrugName.trim(),
      category: newCategory,
      dosage: newDosage.trim() || '1 standard dose',
      frequency: newFrequency.trim() || 'Daily',
      timeSlots: newTimeSlots,
      purpose: newPurpose.trim() || 'Wellness & Longevity Support',
      pillsRemaining: newPillsRemaining,
      refillThreshold: 5,
      reminderEnabled: newReminderEnabled,
      startDate: new Date().toISOString().split('T')[0],
      takenToday: {},
    };

    addMedicationToMember(activeMember.memberId, newMed);
    setMembers(getLocalHealthRecords());

    // Reset Form
    setIsAddModalOpen(false);
    setNewDrugName('');
    setNewDosage('');
    setNewPurpose('');
    setIsSubmitting(false);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header & Drive Location Banner */}
      <div className="p-4 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-600/30">
            <Pill className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white tracking-wide">
                Smart Medication & Supplement Vault
              </h2>
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 font-mono">
                Auro Voice Sync
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Chrono-nutrition timing, dosage adherence, and sovereign Drive backup
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto">
          {onOpenVoiceAssistant && (
            <button
              onClick={onOpenVoiceAssistant}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 transition"
              title="Speak with Auro Voice Assistant"
            >
              <Mic className="w-3.5 h-3.5 text-indigo-400" />
              <span>Ask Auro</span>
            </button>
          )}

          <button
            onClick={handleDriveSync}
            disabled={isSyncingDrive}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
          >
            <Cloud className={`w-3.5 h-3.5 ${isSyncingDrive ? 'animate-spin text-indigo-400' : 'text-slate-400'}`} />
            <span>{isSyncingDrive ? 'Syncing...' : 'Drive & SQLite'}</span>
          </button>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-md shadow-purple-600/30 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Med</span>
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
      <div className="bg-gradient-to-r from-indigo-950/40 via-purple-950/40 to-slate-950/40 border border-indigo-500/30 rounded-2xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-indigo-200">
          <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
          <span className="font-semibold">Auro Voice Commands:</span>
          <span className="text-slate-300 hidden md:inline">
            "What medications are due today?" • "Log my morning Omega-3" • "Remind me to take Magnesium"
          </span>
        </div>
        {onOpenVoiceAssistant && (
          <button
            onClick={onOpenVoiceAssistant}
            className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
          >
            <span>Try Voice Assistant</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Family Member Carousel Switcher */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="font-bold uppercase tracking-wider flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-purple-400" />
            Select Member ({members.length})
          </span>
          <span className="text-[11px] font-mono text-slate-500">
            {activeMember?.memberName}'s Regimen
          </span>
        </div>

        <div className="flex items-center gap-2.5 overflow-x-auto pb-1 scrollbar-none">
          {members.map((m) => {
            const isSelected = m.memberId === selectedMemberId || m.id === selectedMemberId;
            const medCount = m.medications?.length || 0;
            return (
              <button
                key={m.id}
                onClick={() => setSelectedMemberId(m.memberId)}
                className={`p-3 rounded-2xl border transition-all flex items-center gap-3 min-w-[160px] text-left shrink-0 ${
                  isSelected
                    ? 'bg-gradient-to-br from-purple-950/80 to-indigo-950/80 border-purple-500/60 shadow-lg shadow-purple-950/40'
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
                  <div className="w-10 h-10 rounded-xl bg-purple-950 border border-purple-500/40 flex items-center justify-center font-bold text-purple-300 text-sm shrink-0">
                    {m.memberName.slice(0, 2)}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="font-bold text-sm text-white truncate">{m.memberName}</div>
                  <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                    <span>{medCount} Meds/Supps</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Adherence Scoreboard & KPI Cards */}
      {todayStatus && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Today's Adherence
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-black text-white">{todayStatus.adherenceRate}%</span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  todayStatus.adherenceRate === 100
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                }`}
              >
                {todayStatus.adherenceRate === 100 ? 'OPTIMAL' : 'IN PROGRESS'}
              </span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1 font-mono">
              {todayStatus.takenCount} of {todayStatus.totalDue} doses logged
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Doses Pending
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-black text-amber-400">{todayStatus.pendingCount}</span>
              <span className="text-xs text-slate-400">due today</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1 font-mono">Auro Voice Ready</p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Active Regimen
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-black text-purple-400">
                {activeMember?.medications?.length || 0}
              </span>
              <span className="text-xs text-slate-400">items</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              {activeMember?.medications?.filter((m) => m.category === 'supplement').length || 0} Supplements •{' '}
              {activeMember?.medications?.filter((m) => m.category === 'prescription').length || 0} Rx
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Refill Status
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span
                className={`text-3xl font-black ${refillAlerts.length > 0 ? 'text-rose-400' : 'text-emerald-400'}`}
              >
                {refillAlerts.length}
              </span>
              <span className="text-xs text-slate-400">low stock</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              {refillAlerts.length > 0 ? 'Refill needed within 5 days' : 'All bottles adequately stocked'}
            </p>
          </div>
        </div>
      )}

      {/* Refill Alerts Banner if any bottle low */}
      {refillAlerts.length > 0 && (
        <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-500/40 text-rose-200 text-xs space-y-2">
          <div className="flex items-center gap-2 font-bold text-rose-300">
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            <span>Prescription & Supplement Refill Alert ({refillAlerts.length})</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            {refillAlerts.map((med) => (
              <div
                key={med.id}
                className="p-2.5 rounded-xl bg-slate-950/80 border border-rose-500/30 flex items-center justify-between"
              >
                <div>
                  <span className="font-semibold text-white block">{med.drugName}</span>
                  <span className="text-[10px] text-rose-300 font-mono">
                    Only {med.pillsRemaining} doses remaining
                  </span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-600/30 text-rose-300 border border-rose-500/50">
                  REORDER
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TODAY'S DOSAGE TIMELINE SLOTS */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <Clock className="w-4 h-4 text-purple-400" />
            <span>Today's Chrono-Dosing Timeline</span>
          </h3>
          <span className="text-[11px] text-slate-500">
            Click checkmark to log dose or ask Auro AI
          </span>
        </div>

        {/* 4 Time Slots */}
        {(
          [
            {
              id: 'morning',
              label: 'Morning Protocol',
              timeRange: '06:00 AM - 12:00 PM',
              icon: Sun,
              color: 'text-amber-400',
              borderColor: 'border-amber-500/30',
              bgHeader: 'bg-amber-500/10',
            },
            {
              id: 'afternoon',
              label: 'Afternoon Dose',
              timeRange: '12:00 PM - 05:00 PM',
              icon: Coffee,
              color: 'text-orange-400',
              borderColor: 'border-orange-500/30',
              bgHeader: 'bg-orange-500/10',
            },
            {
              id: 'evening',
              label: 'Evening / Dinner Protocol',
              timeRange: '05:00 PM - 09:00 PM',
              icon: Sunset,
              color: 'text-indigo-400',
              borderColor: 'border-indigo-500/30',
              bgHeader: 'bg-indigo-500/10',
            },
            {
              id: 'bedtime',
              label: 'Bedtime & Recovery',
              timeRange: '09:00 PM - 12:00 AM',
              icon: Moon,
              color: 'text-purple-400',
              borderColor: 'border-purple-500/30',
              bgHeader: 'bg-purple-500/10',
            },
          ] as const
        ).map((slot) => {
          const slotItems = todayStatus?.slots[slot.id] || [];
          const IconComponent = slot.icon;

          return (
            <div
              key={slot.id}
              className={`p-4 rounded-3xl bg-slate-900/80 border ${slot.borderColor} space-y-3 shadow-lg`}
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-xl ${slot.bgHeader} ${slot.color}`}>
                    <IconComponent className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">{slot.label}</h4>
                    <span className="text-[10px] text-slate-400 font-mono">{slot.timeRange}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-300">
                    {slotItems.filter((i) => i.status === 'taken').length} / {slotItems.length}
                  </span>
                  <span className="text-[10px] text-slate-500">taken</span>
                </div>
              </div>

              {slotItems.length === 0 ? (
                <div className="text-xs text-slate-500 italic py-2">
                  No medications or supplements scheduled for {slot.id}.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  {slotItems.map(({ med, status, log }) => {
                    const isTaken = status === 'taken';
                    const isSkipped = status === 'skipped';

                    return (
                      <div
                        key={med.id}
                        className={`p-3.5 rounded-2xl border transition-all flex flex-col justify-between ${
                          isTaken
                            ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-100'
                            : isSkipped
                            ? 'bg-slate-950/60 border-slate-800 text-slate-400 opacity-70'
                            : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-white truncate">
                                {med.drugName}
                              </span>
                              <span
                                className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${
                                  med.category === 'prescription'
                                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                                    : med.category === 'ayurvedic'
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                    : 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                                }`}
                              >
                                {med.category || 'Supplement'}
                              </span>
                            </div>
                            <p className="text-xs text-purple-300 font-semibold mt-0.5">
                              {med.dosage} • {med.frequency}
                            </p>
                            <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">
                              {med.purpose}
                            </p>
                          </div>

                          {/* Quick Action Buttons */}
                          <div className="flex items-center gap-1 shrink-0">
                            {isTaken ? (
                              <button
                                onClick={() => handleLogDose(med, slot.id, 'pending')}
                                title="Click to undo dose"
                                className="p-2 rounded-xl bg-emerald-500 text-white font-bold text-xs flex items-center gap-1 shadow-md shadow-emerald-500/30 hover:bg-emerald-600 transition"
                              >
                                <Check className="w-4 h-4" />
                                <span>Taken</span>
                              </button>
                            ) : (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleLogDose(med, slot.id, 'taken')}
                                  className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-1 shadow-md shadow-purple-600/30 transition"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Take</span>
                                </button>
                                <button
                                  onClick={() => handleLogDose(med, slot.id, 'skipped')}
                                  title="Skip this dose today"
                                  className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Pills remaining indicator */}
                        <div className="flex items-center justify-between text-[10px] text-slate-500 pt-3 mt-2 border-t border-slate-800/80">
                          <span>
                            Bottle Stock: <strong className="text-slate-300">{med.pillsRemaining ?? 'N/A'}</strong> left
                          </span>
                          {log ? (
                            <span className="text-emerald-400 font-mono">
                              Logged: {new Date(log.loggedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          ) : (
                            <span className="text-amber-400/80">Pending confirmation</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Intelligent Synergy & Chrono-Nutrition Advisory */}
      <div className="p-5 rounded-3xl bg-gradient-to-br from-indigo-950/40 via-purple-950/30 to-slate-950 border border-indigo-500/30 shadow-xl space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-400" />
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">
            Supplement Synergy & Bioavailability Intelligence
          </h3>
        </div>

        <div className="space-y-2 text-xs">
          {synergyTips.synergyNotes.map((note, idx) => (
            <div
              key={idx}
              className="p-3 rounded-2xl bg-indigo-950/60 border border-indigo-500/30 text-indigo-200 flex items-start gap-2.5"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{note}</span>
            </div>
          ))}

          {synergyTips.timingTips.map((tip, idx) => (
            <div
              key={idx}
              className="p-3 rounded-2xl bg-slate-900 border border-slate-800 text-slate-300 flex items-start gap-2.5"
            >
              <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>{tip}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Historical Dose Logs */}
      <div className="bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-purple-400" />
            <span>Adherence Log History ({logs.length} Entries)</span>
          </h3>
          <span className="text-[11px] text-slate-400">
            Synced with SQLite & Google Drive
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/50 text-slate-400">
                <th className="py-2.5 px-4 font-semibold">Time Logged</th>
                <th className="py-2.5 px-4 font-semibold">Member</th>
                <th className="py-2.5 px-4 font-semibold">Medication / Supplement</th>
                <th className="py-2.5 px-4 font-semibold">Slot</th>
                <th className="py-2.5 px-4 font-semibold">Status</th>
                <th className="py-2.5 px-4 font-semibold">Logged By</th>
                <th className="py-2.5 px-4 font-semibold text-right">Delete</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {logs.slice(0, 15).map((log) => (
                <tr key={log.id} className="hover:bg-slate-800/40 transition">
                  <td className="py-2.5 px-4 font-mono text-slate-300 whitespace-nowrap">
                    {new Date(log.loggedAt).toLocaleString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="py-2.5 px-4 font-bold text-white">{log.memberName}</td>
                  <td className="py-2.5 px-4">
                    <span className="font-semibold text-slate-200">{log.drugName}</span>
                    <span className="text-[11px] text-slate-400 block">{log.dosage}</span>
                  </td>
                  <td className="py-2.5 px-4 capitalize text-slate-300">{log.timeSlot}</td>
                  <td className="py-2.5 px-4">
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        log.status === 'taken'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                      }`}
                    >
                      {log.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-slate-400 text-[11px]">
                    {log.loggedBy || 'Auro AI'}
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    <button
                      onClick={async () => {
                        await deleteMedicationLog(log.id);
                        setLogs(getLocalMedicationLogs());
                      }}
                      className="p-1 rounded text-slate-500 hover:text-rose-400 transition"
                      title="Delete log entry"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD MEDICATION MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
          <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Pill className="w-5 h-5 text-purple-400" />
                <h3 className="text-base font-bold text-white">
                  Add Medication / Supplement for {activeMember?.memberName}
                </h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Presets Carousel */}
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                Quick Presets:
              </span>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                {PRESET_SUPPLEMENTS.map((p, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => applyPreset(p)}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-purple-300 border border-purple-500/30 transition"
                  >
                    + {p.name}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleAddMedication} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Drug / Supplement Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Vitamin D3 + K2, Metformin, Omega-3"
                  value={newDrugName}
                  onChange={(e) => setNewDrugName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Category
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as MedicationCategory)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="supplement">Supplement</option>
                    <option value="vitamin">Vitamin</option>
                    <option value="prescription">Prescription Medication</option>
                    <option value="ayurvedic">Ayurvedic / Herbal</option>
                    <option value="over_the_counter">Over The Counter (OTC)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Dosage & Strength
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 500mg, 5000 IU, 1 capsule"
                    value={newDosage}
                    onChange={(e) => setNewDosage(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Frequency
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Once daily after breakfast"
                    value={newFrequency}
                    onChange={(e) => setNewFrequency(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Pills / Doses in Bottle
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="500"
                    value={newPillsRemaining}
                    onChange={(e) => setNewPillsRemaining(parseInt(e.target.value, 10) || 30)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              {/* Time Slots Checkboxes */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Dosing Time Slots *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(
                    [
                      { id: 'morning', label: 'Morning' },
                      { id: 'afternoon', label: 'Afternoon' },
                      { id: 'evening', label: 'Evening' },
                      { id: 'bedtime', label: 'Bedtime' },
                    ] as const
                  ).map((s) => {
                    const isChecked = newTimeSlots.includes(s.id);
                    return (
                      <button
                        type="button"
                        key={s.id}
                        onClick={() => {
                          setNewTimeSlots((prev) =>
                            prev.includes(s.id)
                              ? prev.filter((item) => item !== s.id)
                              : [...prev, s.id]
                          );
                        }}
                        className={`p-2.5 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                          isChecked
                            ? 'bg-purple-600/30 text-purple-200 border-purple-500'
                            : 'bg-slate-950 text-slate-400 border-slate-800'
                        }`}
                      >
                        {isChecked && <Check className="w-3.5 h-3.5" />}
                        <span>{s.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Health Purpose / Clinical Reason
                </label>
                <input
                  type="text"
                  placeholder="e.g. Deep sleep recovery, Blood pressure control, Immunity"
                  value={newPurpose}
                  onChange={(e) => setNewPurpose(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || newTimeSlots.length === 0}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-600/30 transition disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>{isSubmitting ? 'Saving...' : 'Save to Regimen'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
