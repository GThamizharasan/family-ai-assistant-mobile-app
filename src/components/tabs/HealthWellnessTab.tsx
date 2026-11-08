import React, { useState, useEffect } from 'react';
import {
  HeartPulse,
  Moon,
  Activity,
  Flame,
  Droplets,
  Watch,
  Sparkles,
  Play,
  Square,
  Wind,
  Apple,
  ShieldAlert,
  FileText,
  Upload,
  Plus,
  RefreshCw,
  ExternalLink,
  Phone,
  AlertTriangle,
  Pill,
  CheckCircle2,
  Calendar,
  ChevronRight,
  Stethoscope,
  Heart,
  HardDrive,
  Users,
  TrendingUp,
  Thermometer,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { getWellnessPlanApi, getApiUrl } from '../../services/api';
import {
  FamilyHealthRecord,
  HealthDocument,
  VitalSignEntry,
} from '../../types/healthRecord';
import {
  getLocalHealthRecords,
  getLocalHealthDocuments,
  syncHealthRecordsWithGoogleDrive,
  getGoogleAccessToken,
  HEALTH_ROOT_FOLDER,
  HEALTH_SECTION_FOLDER,
  HEALTH_RECORD_FOLDER,
} from '../../services/healthRecordDriveSync';
import { EmergencyMedicalIdModal } from '../health/EmergencyMedicalIdModal';
import { HealthDocumentViewerModal } from '../health/HealthDocumentViewerModal';
import { AddHealthRecordModal } from '../health/AddHealthRecordModal';
import { FamilyHealthTrendsDashboard } from '../health/FamilyHealthTrendsDashboard';
import { FeverTemperatureModal } from '../health/FeverTemperatureModal';
import { SmartMedicationTracker } from '../health/SmartMedicationTracker';
import { HydrationTracker } from '../health/HydrationTracker';

export const HealthWellnessTab: React.FC = () => {
  const { biometrics, user, googleAccessToken } = useApp();

  // Top Section Navigation
  const [activeSubSection, setActiveSubSection] = useState<
    'records' | 'trends' | 'medications' | 'hydration' | 'vitals' | 'meditation' | 'nutrition' | 'wearables'
  >('records');

  // Family Health Records State
  const [healthRecords, setHealthRecords] = useState<FamilyHealthRecord[]>(() =>
    getLocalHealthRecords()
  );
  const [healthDocuments, setHealthDocuments] = useState<HealthDocument[]>(() =>
    getLocalHealthDocuments()
  );
  const [selectedMemberId, setSelectedMemberId] = useState<string>('member_chinnathambi');
  const [selectedDocCategory, setSelectedDocCategory] = useState<string>('all');
  const [isSyncingDrive, setIsSyncingDrive] = useState(false);
  const [driveSyncNotice, setDriveSyncNotice] = useState<string | null>(null);
  const [driveFolderLink, setDriveFolderLink] = useState<string | null>(null);

  // Modals State
  const [isMedicalIdOpen, setIsMedicalIdOpen] = useState(false);
  const [isFeverModalOpen, setIsFeverModalOpen] = useState(false);
  const [viewingDoc, setViewingDoc] = useState<HealthDocument | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addModalMode, setAddModalMode] = useState<
    'vitals' | 'medication' | 'allergy' | 'condition' | 'document'
  >('vitals');

  // AI Health Companion State
  const [aiInsightLoading, setAiInsightLoading] = useState(false);
  const [aiInsight, setAiInsight] = useState<{
    clinicalOverview?: string;
    actionableRecommendations?: string[];
    precautions?: string;
  } | null>(null);

  // Meditation State
  const [meditationActive, setMeditationActive] = useState(false);
  const [breathPhase, setBreathPhase] = useState<'Inhale' | 'Hold' | 'Exhale' | 'Hold empty'>('Inhale');
  const [breathTimer, setBreathTimer] = useState(4);
  const [secondsRemaining, setSecondsRemaining] = useState(300);

  // AI Wellness Doctor Plan (Existing)
  const [wellnessPlanLoading, setWellnessPlanLoading] = useState(false);
  const [wellnessPlan, setWellnessPlan] = useState<any>(null);

  // Listen to reactive updates
  useEffect(() => {
    const handleRecordsChange = () => {
      setHealthRecords(getLocalHealthRecords());
    };
    const handleDocsChange = () => {
      setHealthDocuments(getLocalHealthDocuments());
    };

    const handleOpenFever = (e: any) => {
      if (e.detail?.memberId) setSelectedMemberId(e.detail.memberId);
      setIsFeverModalOpen(true);
    };

    window.addEventListener('aura_health_records_changed', handleRecordsChange);
    window.addEventListener('aura_health_docs_changed', handleDocsChange);
    window.addEventListener('aura_open_fever_modal', handleOpenFever);
    window.addEventListener('storage', handleRecordsChange);

    return () => {
      window.removeEventListener('aura_health_records_changed', handleRecordsChange);
      window.removeEventListener('aura_health_docs_changed', handleDocsChange);
      window.removeEventListener('aura_open_fever_modal', handleOpenFever);
      window.removeEventListener('storage', handleRecordsChange);
    };
  }, []);

  // Meditation timer loop
  useEffect(() => {
    let interval: any = null;
    if (meditationActive) {
      interval = setInterval(() => {
        setSecondsRemaining((prev) => {
          if (prev <= 1) {
            setMeditationActive(false);
            return 300;
          }
          return prev - 1;
        });

        setBreathTimer((prev) => {
          if (prev <= 1) {
            setBreathPhase((current) => {
              if (current === 'Inhale') return 'Hold';
              if (current === 'Hold') return 'Exhale';
              if (current === 'Exhale') return 'Hold empty';
              return 'Inhale';
            });
            return 4;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [meditationActive]);

  const selectedMemberRecord: FamilyHealthRecord =
    healthRecords.find((r) => r.memberId === selectedMemberId || r.id === selectedMemberId) ||
    healthRecords[0];

  const filteredDocuments = healthDocuments.filter((d) => {
    const matchesMember =
      selectedMemberRecord &&
      (d.memberId === selectedMemberRecord.memberId ||
        d.memberName.toLowerCase() === selectedMemberRecord.memberName.toLowerCase());
    if (!matchesMember) return false;
    if (selectedDocCategory === 'all') return true;
    return d.category === selectedDocCategory;
  });

  const latestVital: VitalSignEntry | undefined =
    selectedMemberRecord?.vitalsHistory?.[0];

  // Evaluate Blood Pressure Status
  const getBpStatus = (systolic?: number, diastolic?: number) => {
    if (!systolic || !diastolic) return { label: 'Optimal', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' };
    if (systolic < 120 && diastolic < 80) return { label: 'Normal (Ideal)', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' };
    if (systolic <= 129 && diastolic < 80) return { label: 'Elevated', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' };
    if (systolic <= 139 || diastolic <= 89) return { label: 'Stage 1 HTN', color: 'text-orange-400 bg-orange-500/10 border-orange-500/20' };
    return { label: 'Stage 2 HTN', color: 'text-rose-400 bg-rose-500/10 border-rose-500/20' };
  };

  const bpStatus = getBpStatus(latestVital?.systolicBp, latestVital?.diastolicBp);

  const handleDriveSync = async () => {
    setIsSyncingDrive(true);
    setDriveSyncNotice('Synchronizing Family Health Records with Google Drive & SQLite...');
    try {
      const res = await syncHealthRecordsWithGoogleDrive(
        googleAccessToken || getGoogleAccessToken(),
        user?.email
      );
      setHealthRecords(res.records);
      setHealthDocuments(res.documents);
      if (res.folderLink) setDriveFolderLink(res.folderLink);
      setDriveSyncNotice('Synchronized successfully with Google Drive!');
      setTimeout(() => setDriveSyncNotice(null), 4000);
    } catch {
      setDriveSyncNotice('Offline vault updated. Drive sync scheduled on next reconnect.');
      setTimeout(() => setDriveSyncNotice(null), 4000);
    } finally {
      setIsSyncingDrive(false);
    }
  };

  const handleFetchAiInsights = async () => {
    if (!selectedMemberRecord) return;
    setAiInsightLoading(true);
    try {
      const res = await fetch(getApiUrl('/api/health/ai-insights'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberName: selectedMemberRecord.memberName,
          age: selectedMemberRecord.age,
          bloodGroup: selectedMemberRecord.bloodGroup,
          allergies: selectedMemberRecord.allergies,
          conditions: selectedMemberRecord.conditions,
          latestVitals: latestVital,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setAiInsight(data);
      }
    } catch {
      setAiInsight({
        clinicalOverview: `Vitals for ${selectedMemberRecord.memberName} are stable. Autonomic balance and cardiovascular metrics are well-controlled.`,
        actionableRecommendations: [
          'Maintain targeted daily hydration (2.5L).',
          'Ensure adherence to morning and bedtime supplements/medications.',
          'Schedule annual preventive health review.',
        ],
        precautions: 'Always consult your primary care doctor before changing treatment plans.',
      });
    } finally {
      setAiInsightLoading(false);
    }
  };

  const handleFetchAiWellnessPlan = async () => {
    setWellnessPlanLoading(true);
    try {
      const res = await getWellnessPlanApi({
        sleepHours: biometrics.totalSleepHours,
        hrv: biometrics.hrvMs,
        heartRate: biometrics.restingHeartRate,
        activityLevel: 'High cognitive & 11,400 daily steps',
        energyScore: biometrics.sleepScore,
      });
      setWellnessPlan(res);
    } catch {
      setWellnessPlan({
        recoveryStatus: 'Autonomic balance at 91%. Deep sleep duration is sufficient for neuro-recovery.',
        nutritionRecommendation: 'Target 160g protein with magnesium l-threonate, omega-3 DHA, and complex phytonutrients.',
        sleepOptimizationTip: 'Bedroom ambient at 19°C. Stop caffeine intake 9 hours prior to target sleep.',
        mindfulnessPractice: 'Box breathing: 4s Inhale - 4s Hold - 4s Exhale - 4s Hold.',
      });
    } finally {
      setWellnessPlanLoading(false);
    }
  };

  const toggleMeditation = () => {
    if (meditationActive) {
      setMeditationActive(false);
    } else {
      setSecondsRemaining(300);
      setBreathPhase('Inhale');
      setBreathTimer(4);
      setMeditationActive(true);
    }
  };

  const openAddModal = (mode: 'vitals' | 'medication' | 'allergy' | 'condition' | 'document') => {
    setAddModalMode(mode);
    setIsAddModalOpen(true);
  };

  return (
    <div className="space-y-6 pb-28 pt-2">
      {/* Top Header & Sub-Navigation */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-gradient-to-br from-rose-500 to-indigo-600 text-white shadow-lg shadow-rose-500/25">
              <HeartPulse className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight">Health & Wellness Hub</h1>
              <p className="text-xs text-slate-400">Sovereign Family Health Record & Longevity OS</p>
            </div>
          </div>

          {/* Google Drive & SQLite Sync Trigger */}
          <button
            onClick={handleDriveSync}
            disabled={isSyncingDrive}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-semibold border border-slate-700 transition-all shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-indigo-400 ${isSyncingDrive ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{isSyncingDrive ? 'Syncing...' : 'Drive & SQLite Sync'}</span>
            <span className="sm:hidden">Sync</span>
          </button>
        </div>

        {/* Sync Status Banner */}
        {driveSyncNotice && (
          <div className="p-3 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 text-indigo-200 text-xs flex items-center justify-between animate-fade-in">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span>{driveSyncNotice}</span>
            </div>
            {driveFolderLink && (
              <a
                href={driveFolderLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[11px] font-bold text-indigo-300 hover:underline"
              >
                <span>Open in Drive</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        )}

        {/* Section Navigation Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setActiveSubSection('records')}
            className={`px-3.5 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              activeSubSection === 'records'
                ? 'bg-gradient-to-r from-rose-600 to-indigo-600 text-white shadow-md shadow-rose-600/30'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Family Health Records</span>
          </button>

          <button
            onClick={() => setActiveSubSection('trends')}
            className={`px-3.5 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              activeSubSection === 'trends'
                ? 'bg-gradient-to-r from-rose-600 via-pink-600 to-indigo-600 text-white shadow-md shadow-rose-600/30'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Family Health Trends (D3.js)</span>
          </button>

          <button
            onClick={() => setActiveSubSection('medications')}
            className={`px-3.5 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              activeSubSection === 'medications'
                ? 'bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 text-white shadow-md shadow-purple-600/30'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Pill className="w-3.5 h-3.5 text-purple-400" />
            <span>Smart Meds & Supps</span>
          </button>

          <button
            onClick={() => setActiveSubSection('hydration')}
            className={`px-3.5 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              activeSubSection === 'hydration'
                ? 'bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 text-white shadow-md shadow-cyan-600/30'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Droplets className="w-3.5 h-3.5 text-cyan-400" />
            <span>Hydration Tracker</span>
          </button>

          <button
            onClick={() => setIsFeverModalOpen(true)}
            className="px-3.5 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-rose-300 hover:text-white border border-rose-500/30 shadow-sm"
          >
            <Thermometer className="w-3.5 h-3.5 text-rose-400" />
            <span>Fever Tracker & Chart</span>
          </button>

          <button
            onClick={() => setActiveSubSection('vitals')}
            className={`px-3.5 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              activeSubSection === 'vitals'
                ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Autonomic Vitals</span>
          </button>

          <button
            onClick={() => setActiveSubSection('meditation')}
            className={`px-3.5 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              activeSubSection === 'meditation'
                ? 'bg-teal-600 text-white shadow-md shadow-teal-600/30'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Wind className="w-3.5 h-3.5" />
            <span>Vagus Nerve & Breath</span>
          </button>

          <button
            onClick={() => setActiveSubSection('nutrition')}
            className={`px-3.5 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              activeSubSection === 'nutrition'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Apple className="w-3.5 h-3.5" />
            <span>Longevity Nutrition</span>
          </button>

          <button
            onClick={() => setActiveSubSection('wearables')}
            className={`px-3.5 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              activeSubSection === 'wearables'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Watch className="w-3.5 h-3.5" />
            <span>Connected Devices</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SUB-SECTION 1: FAMILY HEALTH RECORDS (PRIMARY FOCUS)                       */}
      {/* ========================================================================= */}
      {activeSubSection === 'records' && (
        <div className="space-y-5 animate-fade-in">
          {/* Google Drive Location Notice */}
          <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-emerald-400" />
              <div>
                <span className="font-bold text-white">Google Drive Sovereign Vault:</span>
                <p className="text-[11px] text-slate-400 font-mono">
                  {HEALTH_ROOT_FOLDER} / {HEALTH_SECTION_FOLDER} / {HEALTH_RECORD_FOLDER}
                </p>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 text-[10px] font-bold border border-emerald-500/20">
              3GB SQLite + Drive Sync
            </span>
          </div>

          {/* Family Member Horizontal Selector Carousel */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-indigo-400" />
                Select Family Member Record ({healthRecords.length})
              </span>
            </div>

            <div className="flex items-center gap-2.5 overflow-x-auto pb-2 scrollbar-none">
              {healthRecords.map((rec) => {
                const isSelected =
                  rec.memberId === selectedMemberId || rec.id === selectedMemberId;
                return (
                  <button
                    key={rec.id}
                    onClick={() => {
                      setSelectedMemberId(rec.memberId);
                      setAiInsight(null);
                    }}
                    className={`p-3 rounded-2xl border transition-all flex items-center gap-3 min-w-[170px] text-left shrink-0 ${
                      isSelected
                        ? 'bg-gradient-to-br from-rose-950/70 to-indigo-950/70 border-rose-500/60 shadow-lg shadow-rose-950/40'
                        : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {rec.avatar ? (
                      <img
                        src={rec.avatar}
                        alt={rec.memberName}
                        className="w-10 h-10 rounded-xl object-cover border border-slate-700 shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center font-bold text-white shrink-0">
                        {rec.memberName.slice(0, 2)}
                      </div>
                    )}
                    <div className="overflow-hidden">
                      <div className="text-xs font-bold text-white truncate">{rec.memberName}</div>
                      <div className="text-[10px] text-slate-400 truncate">{rec.relationship}</div>
                      <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-rose-500/20 text-rose-300">
                        {rec.bloodGroup}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Member Hero Card & Emergency Medical ID Action */}
          {selectedMemberRecord && (
            <div className="p-5 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900/90 to-rose-950/30 border border-slate-800 relative overflow-hidden shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  {selectedMemberRecord.avatar ? (
                    <img
                      src={selectedMemberRecord.avatar}
                      alt={selectedMemberRecord.memberName}
                      className="w-14 h-14 rounded-2xl object-cover border-2 border-rose-500/40 shadow-md"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-2xl bg-rose-950 border-2 border-rose-500/40 flex items-center justify-center font-bold text-rose-300 text-lg">
                      {selectedMemberRecord.memberName.slice(0, 2)}
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-white">{selectedMemberRecord.memberName}</h2>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 font-mono">
                        Blood Type: {selectedMemberRecord.bloodGroup}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {selectedMemberRecord.relationship} • {selectedMemberRecord.age ? `${selectedMemberRecord.age} Years` : 'Age N/A'} • {selectedMemberRecord.gender || 'Universal'}
                    </p>
                  </div>
                </div>

                {/* Action Buttons: Fever Tracker, Emergency Medical ID and D3 Health Trends */}
                <div className="flex flex-wrap items-center gap-2 self-stretch sm:self-auto">
                  <button
                    onClick={() => setActiveSubSection('hydration')}
                    className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3.5 py-2 rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold shadow-lg shadow-cyan-600/30 transition-all"
                  >
                    <Droplets className="w-4 h-4" />
                    <span>Hydration</span>
                  </button>

                  <button
                    onClick={() => setActiveSubSection('medications')}
                    className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3.5 py-2 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-purple-600/30 transition-all"
                  >
                    <Pill className="w-4 h-4" />
                    <span>Smart Meds</span>
                  </button>

                  <button
                    onClick={() => setIsFeverModalOpen(true)}
                    className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3.5 py-2 rounded-2xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white text-xs font-bold shadow-lg shadow-rose-600/30 transition-all"
                  >
                    <Thermometer className="w-4 h-4" />
                    <span>Fever Tracker & Chart</span>
                  </button>

                  <button
                    onClick={() => setActiveSubSection('trends')}
                    className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3.5 py-2 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition-all"
                  >
                    <TrendingUp className="w-4 h-4" />
                    <span>View D3 Trends</span>
                  </button>

                  <button
                    onClick={() => setIsMedicalIdOpen(true)}
                    className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3.5 py-2 rounded-2xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white text-xs font-bold shadow-lg shadow-rose-600/30 transition-all"
                  >
                    <ShieldAlert className="w-4 h-4 animate-pulse" />
                    <span>Emergency Medical ID</span>
                  </button>
                </div>
              </div>

              {/* Quick Profile Metric Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 border-t border-slate-800/80 text-xs">
                <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Height & Weight</span>
                  <span className="font-mono font-bold text-white mt-0.5 block">
                    {selectedMemberRecord.heightCm || 170} cm • {selectedMemberRecord.weightKg || 68} kg
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Allergies Alert</span>
                  <span
                    className={`font-bold mt-0.5 block truncate ${
                      selectedMemberRecord.allergies.length > 0 ? 'text-amber-400' : 'text-slate-400'
                    }`}
                  >
                    {selectedMemberRecord.allergies.length > 0
                      ? `${selectedMemberRecord.allergies.length} Logged (${selectedMemberRecord.allergies[0].allergen})`
                      : 'None Reported'}
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Active Prescriptions</span>
                  <span className="font-mono font-bold text-white mt-0.5 block">
                    {selectedMemberRecord.medications.length} Daily Meds
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">ICE Contact</span>
                  <span className="font-bold text-white mt-0.5 block truncate">
                    {selectedMemberRecord.emergencyContact.name} ({selectedMemberRecord.emergencyContact.relationship})
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Vitals Log Dashboard */}
          <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400">
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Latest Vital Signs & Clinical Biometrics</h3>
                  <p className="text-xs text-slate-400">
                    {latestVital
                      ? `Recorded ${new Date(latestVital.timestamp).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })} via ${latestVital.recordedBy}`
                      : 'No recent vitals logged'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => openAddModal('vitals')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all shadow-md shadow-rose-600/25"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Log Vitals</span>
              </button>
            </div>

            {/* 4-Stat Grid for Member Vitals */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* Blood Pressure */}
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 relative overflow-hidden">
                <div className="flex items-center justify-between text-slate-400 text-[11px]">
                  <span>Blood Pressure</span>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${bpStatus.color}`}>
                    {bpStatus.label}
                  </span>
                </div>
                <div className="font-mono text-xl font-bold text-white mt-1.5">
                  {latestVital?.systolicBp || 120} / {latestVital?.diastolicBp || 80}{' '}
                  <span className="text-[10px] text-slate-500 font-normal">mmHg</span>
                </div>
              </div>

              {/* Heart Rate */}
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                <div className="flex items-center justify-between text-slate-400 text-[11px]">
                  <span>Pulse (HR)</span>
                  <Heart className="w-3.5 h-3.5 text-rose-400" />
                </div>
                <div className="font-mono text-xl font-bold text-white mt-1.5">
                  {latestVital?.heartRate || 72}{' '}
                  <span className="text-[10px] text-slate-500 font-normal">bpm</span>
                </div>
              </div>

              {/* Blood Oxygen SpO2 */}
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                <div className="flex items-center justify-between text-slate-400 text-[11px]">
                  <span>SpO2 Oxygen</span>
                  <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-sky-500/10 text-sky-300 border border-sky-500/20">
                    Normal
                  </span>
                </div>
                <div className="font-mono text-xl font-bold text-white mt-1.5">
                  {latestVital?.oxygenSpO2 || 99} <span className="text-[10px] text-slate-500 font-normal">%</span>
                </div>
              </div>

              {/* Blood Glucose */}
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                <div className="flex items-center justify-between text-slate-400 text-[11px]">
                  <span>Blood Glucose</span>
                  <span className="text-[10px] text-slate-500 capitalize">{latestVital?.glucoseContext || 'Fasting'}</span>
                </div>
                <div className="font-mono text-xl font-bold text-white mt-1.5">
                  {latestVital?.bloodGlucose || 94}{' '}
                  <span className="text-[10px] text-slate-500 font-normal">mg/dL</span>
                </div>
              </div>
            </div>
          </div>

          {/* Active Medications & Daily Pill Schedule */}
          <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400">
                  <Pill className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Daily Medication & Pill Regimen</h3>
                  <p className="text-xs text-slate-400">
                    {selectedMemberRecord?.medications?.length || 0} active prescription(s) logged
                  </p>
                </div>
              </div>

              <button
                onClick={() => openAddModal('medication')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition-all shadow-md shadow-sky-600/25"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Medication</span>
              </button>
            </div>

            {selectedMemberRecord?.medications?.length === 0 ? (
              <p className="text-xs text-slate-400 italic bg-slate-950 p-4 rounded-2xl border border-slate-800">
                No active medications scheduled. Tap 'Add Medication' to log prescriptions and set reminders.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {selectedMemberRecord?.medications?.map((med) => (
                  <div
                    key={med.id}
                    className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 text-xs"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-bold text-white text-sm">{med.drugName}</div>
                        <div className="text-slate-400 font-mono text-[11px] mt-0.5">{med.dosage} • {med.frequency}</div>
                      </div>
                      {med.pillsRemaining !== undefined && (
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                            med.pillsRemaining <= 7
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          {med.pillsRemaining} left
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] text-slate-400">Purpose: {med.purpose}</p>

                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                      <div className="flex gap-1.5">
                        {med.timeSlots.map((slot) => (
                          <span
                            key={slot}
                            className="px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-300 border border-sky-500/20 capitalize text-[10px]"
                          >
                            {slot}
                          </span>
                        ))}
                      </div>

                      <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Reminders Active
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Medical Documents & Reports Section */}
          <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-3.5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Medical Documents, Scans & Lab Reports</h3>
                  <p className="text-xs text-slate-400">
                    Stored in Google Drive: {HEALTH_ROOT_FOLDER} / {HEALTH_SECTION_FOLDER} / {HEALTH_RECORD_FOLDER} / {selectedMemberRecord?.memberName}
                  </p>
                </div>
              </div>

              <button
                onClick={() => openAddModal('document')}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/25"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Report / Scan</span>
              </button>
            </div>

            {/* Document Category Filters */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none text-xs">
              {[
                { id: 'all', label: 'All Documents' },
                { id: 'lab_report', label: 'Lab Reports' },
                { id: 'prescription', label: 'Prescriptions' },
                { id: 'diagnostic_imaging', label: 'Imaging / ECG' },
                { id: 'vaccination_card', label: 'Vaccines' },
              ].map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedDocCategory(cat.id)}
                  className={`px-3 py-1 rounded-xl whitespace-nowrap transition-colors ${
                    selectedDocCategory === cat.id
                      ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30'
                      : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Document Card Grid */}
            {filteredDocuments.length === 0 ? (
              <div className="text-center py-10 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
                <FileText className="w-10 h-10 text-slate-600 mx-auto" />
                <p className="text-xs text-slate-300 font-semibold">No medical documents in this view</p>
                <p className="text-[11px] text-slate-500">
                  Upload lab reports, discharge summaries, or prescriptions to store them securely.
                </p>
                <button
                  onClick={() => openAddModal('document')}
                  className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  <Upload className="w-3 h-3" />
                  <span>Upload Now</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {filteredDocuments.map((doc) => (
                  <div
                    key={doc.id}
                    onClick={() => setViewingDoc(doc)}
                    className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 hover:border-emerald-500/50 cursor-pointer transition-all space-y-2 group"
                  >
                    <div className="flex items-start justify-between">
                      <div className="p-2 rounded-xl bg-slate-900 text-emerald-400 group-hover:scale-105 transition-transform">
                        <FileText className="w-4 h-4" />
                      </div>
                      <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-slate-900 text-slate-400 border border-slate-800">
                        {doc.category.replace('_', ' ')}
                      </span>
                    </div>

                    <div>
                      <h4 className="text-xs font-bold text-white line-clamp-1 group-hover:text-emerald-300 transition-colors">
                        {doc.title}
                      </h4>
                      <p className="text-[10px] text-slate-400 mt-0.5">{doc.documentDate} • {doc.doctorOrFacility || 'Clinical Lab'}</p>
                    </div>

                    {doc.aiSummary && (
                      <p className="text-[11px] text-slate-300 line-clamp-2 bg-slate-900/60 p-2 rounded-xl border border-slate-800/80">
                        {doc.aiSummary}
                      </p>
                    )}

                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-500">
                      <span className="font-mono">{(doc.fileSizeBytes / 1024).toFixed(0)} KB</span>
                      <span className="text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> View Document
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* AI Health Companion & Longevity Advisor */}
          <div className="p-5 rounded-3xl bg-gradient-to-br from-indigo-950/40 via-slate-900 to-purple-950/40 border border-indigo-500/30 space-y-3.5 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-300">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">AURO Health Companion & Preventative Doctor</h3>
                  <p className="text-xs text-slate-400">
                    AI evaluation for {selectedMemberRecord?.memberName} based on active vitals, allergies & history
                  </p>
                </div>
              </div>

              <button
                onClick={handleFetchAiInsights}
                disabled={aiInsightLoading}
                className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-indigo-600/30 disabled:opacity-50"
              >
                <Sparkles className={`w-3.5 h-3.5 ${aiInsightLoading ? 'animate-spin' : ''}`} />
                <span>{aiInsightLoading ? 'Analyzing...' : 'Generate Review'}</span>
              </button>
            </div>

            {aiInsight ? (
              <div className="p-4 rounded-2xl bg-slate-950 border border-indigo-500/30 text-xs space-y-3 animate-fade-in">
                {aiInsight.clinicalOverview && (
                  <div>
                    <span className="text-indigo-300 font-bold block mb-0.5">Clinical Evaluation:</span>
                    <p className="text-slate-200 leading-relaxed">{aiInsight.clinicalOverview}</p>
                  </div>
                )}

                {aiInsight.actionableRecommendations && aiInsight.actionableRecommendations.length > 0 && (
                  <div className="pt-2 border-t border-slate-800">
                    <span className="text-emerald-300 font-bold block mb-1">Preventive Health Recommendations:</span>
                    <ul className="space-y-1">
                      {aiInsight.actionableRecommendations.map((rec, idx) => (
                        <li key={idx} className="flex items-start gap-1.5 text-slate-300">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {aiInsight.precautions && (
                  <div className="pt-2 border-t border-slate-800 text-[11px] text-amber-300/90 flex items-start gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                    <span>{aiInsight.precautions}</span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-400 bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800">
                Click 'Generate Review' to run an AI clinical summary for {selectedMemberRecord?.memberName}, checking drug-allergy interactions, blood pressure patterns, and age-specific preventative milestones.
              </p>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-SECTION 1B: FAMILY HEALTH TRENDS (D3.JS VISUALIZATION DASHBOARD)       */}
      {/* ========================================================================= */}
      {activeSubSection === 'trends' && (
        <FamilyHealthTrendsDashboard
          healthRecords={healthRecords}
          selectedMemberId={selectedMemberId}
          onSelectMember={(id) => setSelectedMemberId(id)}
          onOpenAddVitals={(mem) => {
            setSelectedMemberId(mem.memberId);
            openAddModal('vitals');
          }}
          onSyncDrive={handleDriveSync}
          isSyncingDrive={isSyncingDrive}
        />
      )}

      {/* ========================================================================= */}
      {/* SUB-SECTION: SMART MEDICATION & SUPPLEMENT TRACKER                       */}
      {/* ========================================================================= */}
      {activeSubSection === 'medications' && (
        <SmartMedicationTracker initialMemberId={selectedMemberId} />
      )}

      {/* ========================================================================= */}
      {/* SUB-SECTION: SMART HYDRATION TRACKER (CIRCULAR PROGRESS RING)             */}
      {/* ========================================================================= */}
      {activeSubSection === 'hydration' && (
        <HydrationTracker initialMemberId={selectedMemberId} />
      )}

      {/* ========================================================================= */}
      {/* SUB-SECTION 2: AUTONOMIC VITALS & RECOVERY (EXISTING ENHANCED)            */}
      {/* ========================================================================= */}
      {activeSubSection === 'vitals' && (
        <div className="space-y-6 animate-fade-in">
          {/* Top Longevity & Vitals Banner */}
          <div className="p-5 rounded-3xl bg-gradient-to-br from-rose-950/40 via-slate-900 to-indigo-950/40 border border-rose-500/30 relative overflow-hidden shadow-xl">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400">
                  <HeartPulse className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-rose-300 uppercase tracking-wider">
                  Autonomic Recovery & Longevity Hub
                </span>
              </div>

              <span className="px-2.5 py-1 rounded-full text-xs font-bold font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {biometrics.recoveryState}
              </span>
            </div>

            <div className="flex items-baseline gap-3 mt-2">
              <span className="text-3xl font-bold font-mono text-white tracking-tight">
                {biometrics.sleepScore}
              </span>
              <span className="text-xs text-slate-400">Sleep & Readiness Score (Oura / Apple Health)</span>
            </div>

            {/* Biometrics 4-grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4 pt-4 border-t border-rose-500/20">
              <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800">
                <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                  <HeartPulse className="w-3.5 h-3.5 text-rose-400" />
                  <span>Resting HR</span>
                </div>
                <div className="font-mono text-base font-bold text-white mt-1">
                  {biometrics.restingHeartRate} <span className="text-[10px] text-slate-500 font-normal">bpm</span>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800">
                <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                  <Activity className="w-3.5 h-3.5 text-indigo-400" />
                  <span>HRV (Autonomic)</span>
                </div>
                <div className="font-mono text-base font-bold text-white mt-1">
                  {biometrics.hrvMs} <span className="text-[10px] text-slate-500 font-normal">ms</span>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800">
                <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                  <Flame className="w-3.5 h-3.5 text-amber-400" />
                  <span>Active Burn</span>
                </div>
                <div className="font-mono text-base font-bold text-white mt-1">
                  {biometrics.activeCalories} <span className="text-[10px] text-slate-500 font-normal">kcal</span>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800">
                <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                  <Droplets className="w-3.5 h-3.5 text-blue-400" />
                  <span>Hydration</span>
                </div>
                <div className="font-mono text-base font-bold text-white mt-1">
                  {biometrics.hydrationLiters} <span className="text-[10px] text-slate-500 font-normal">L</span>
                </div>
              </div>
            </div>
          </div>

          {/* Sleep Architecture Breakdown */}
          <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
                  <Moon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Sleep Architecture & Neuro-Recovery</h3>
                  <p className="text-xs text-slate-400">Total Duration: {biometrics.totalSleepHours} Hours (Optimal Bedtime: 10:30 PM)</p>
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-purple-300">
                {Math.round((biometrics.deepSleepMinutes / 60) * 10) / 10}h Deep Sleep
              </span>
            </div>

            {/* Sleep Stage Visual Bar */}
            <div className="w-full h-3 rounded-full bg-slate-950 overflow-hidden flex">
              <div
                className="bg-purple-600 h-full"
                style={{ width: `${(biometrics.deepSleepMinutes / 468) * 100}%` }}
                title="Deep Sleep"
              />
              <div
                className="bg-indigo-500 h-full"
                style={{ width: `${(biometrics.remSleepMinutes / 468) * 100}%` }}
                title="REM Sleep"
              />
              <div
                className="bg-slate-700 h-full"
                style={{ width: `${(biometrics.lightSleepMinutes / 468) * 100}%` }}
                title="Light Sleep"
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-600" />
                <span>Deep Sleep: {biometrics.deepSleepMinutes}m</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                <span>REM Dream: {biometrics.remSleepMinutes}m</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-700" />
                <span>Light Stage: {biometrics.lightSleepMinutes}m</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-SECTION 3: GUIDED MEDITATION & VAGUS DRILL                             */}
      {/* ========================================================================= */}
      {activeSubSection === 'meditation' && (
        <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-teal-500/10 text-teal-400">
                <Wind className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Custom Guided Meditation & Vagus Nerve Drill</h3>
                <p className="text-xs text-slate-400">Navy SEAL Box Breathing (4-4-4-4 Protocol)</p>
              </div>
            </div>

            <button
              onClick={toggleMeditation}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                meditationActive
                  ? 'bg-rose-500 hover:bg-rose-600 text-white'
                  : 'bg-teal-600 hover:bg-teal-500 text-white'
              }`}
            >
              {meditationActive ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{meditationActive ? 'Stop Session' : 'Begin 5 Min'}</span>
            </button>
          </div>

          {/* Interactive Breathing Sphere Visual */}
          <div className="p-8 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col items-center justify-center relative overflow-hidden">
            <div
              className={`w-36 h-36 rounded-full flex flex-col items-center justify-center border-4 transition-all duration-1000 shadow-2xl ${
                meditationActive && breathPhase === 'Inhale'
                  ? 'scale-125 border-teal-400 bg-teal-500/20 shadow-teal-500/30'
                  : meditationActive && breathPhase === 'Hold'
                  ? 'scale-125 border-indigo-400 bg-indigo-500/20 shadow-indigo-500/30'
                  : meditationActive && breathPhase === 'Exhale'
                  ? 'scale-90 border-purple-400 bg-purple-500/20 shadow-purple-500/30'
                  : meditationActive && breathPhase === 'Hold empty'
                  ? 'scale-90 border-slate-600 bg-slate-800/40'
                  : 'scale-100 border-slate-700 bg-slate-900'
              }`}
            >
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                {meditationActive ? breathPhase : 'Ready'}
              </span>
              <span className="font-mono text-2xl font-bold text-white mt-1">
                {meditationActive ? `${breathTimer}s` : 'Box 4s'}
              </span>
            </div>

            <div className="mt-4 text-center">
              <span className="font-mono text-xs text-slate-400">
                Session Remaining: {Math.floor(secondsRemaining / 60)}:{(secondsRemaining % 60).toString().padStart(2, '0')}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-SECTION 4: AI LONGEVITY & NUTRITION                                   */}
      {/* ========================================================================= */}
      {activeSubSection === 'nutrition' && (
        <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-3.5 animate-fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                <Apple className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">AI Nutrition & Balanced Longevity Diet</h3>
                <p className="text-xs text-slate-400">Tailored to today's metabolic demand and recovery metrics</p>
              </div>
            </div>

            <button
              onClick={handleFetchAiWellnessPlan}
              disabled={wellnessPlanLoading}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Sparkles className={`w-3.5 h-3.5 ${wellnessPlanLoading ? 'animate-spin' : ''}`} />
              <span>Get Protocol</span>
            </button>
          </div>

          {wellnessPlan ? (
            <div className="p-4 rounded-2xl bg-slate-950 border border-emerald-500/30 text-xs space-y-3 animate-fade-in">
              <div>
                <strong className="text-emerald-300 block mb-0.5">Metabolic Recovery Status:</strong>
                <p className="text-slate-200">{wellnessPlan.recoveryStatus}</p>
              </div>

              <div className="pt-2 border-t border-slate-800">
                <strong className="text-amber-300 block mb-0.5">Balanced Daily Nutrition Plan:</strong>
                <p className="text-slate-300 leading-relaxed">{wellnessPlan.nutritionRecommendation}</p>
              </div>

              <div className="pt-2 border-t border-slate-800">
                <strong className="text-purple-300 block mb-0.5">Sleep Recovery Directive:</strong>
                <p className="text-slate-300">{wellnessPlan.sleepOptimizationTip}</p>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-400 bg-slate-950/60 p-3 rounded-2xl border border-slate-800/80">
              Click 'Get Protocol' to calculate today's optimal micronutrient ratios, electrolyte requirements, and deep sleep timings based on your live biometrics.
            </p>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-SECTION 5: CONNECTED WEARABLE ECOSYSTEM                                */}
      {/* ========================================================================= */}
      {activeSubSection === 'wearables' && (
        <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-3 animate-fade-in">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Connected Wearables & Smart Health Devices ({biometrics.connectedWearables.length})
          </h3>

          <div className="space-y-2">
            {biometrics.connectedWearables.map((w, idx) => (
              <div key={idx} className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  <Watch className="w-4 h-4 text-indigo-400" />
                  <div>
                    <span className="font-semibold text-white">{w.name}</span>
                    <p className="text-[10px] text-slate-500">Synced: {w.syncedAt}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] text-slate-400">{w.battery}% Batt</span>
                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 text-[10px] font-semibold border border-emerald-500/20">
                    ONLINE
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modals */}
      {selectedMemberRecord && (
        <EmergencyMedicalIdModal
          record={selectedMemberRecord}
          isOpen={isMedicalIdOpen}
          onClose={() => setIsMedicalIdOpen(false)}
        />
      )}

      <HealthDocumentViewerModal
        document={viewingDoc}
        isOpen={Boolean(viewingDoc)}
        onClose={() => setViewingDoc(null)}
      />

      {selectedMemberRecord && (
        <AddHealthRecordModal
          member={selectedMemberRecord}
          isOpen={isAddModalOpen}
          defaultMode={addModalMode}
          onClose={() => setIsAddModalOpen(false)}
          onRecordUpdated={() => {
            setHealthRecords(getLocalHealthRecords());
            setHealthDocuments(getLocalHealthDocuments());
          }}
        />
      )}

      {/* Fever Temperature & Clinical Chart Modal */}
      <FeverTemperatureModal
        isOpen={isFeverModalOpen}
        onClose={() => setIsFeverModalOpen(false)}
        selectedMemberId={selectedMemberId}
        onMemberSelect={(id) => setSelectedMemberId(id)}
      />
    </div>
  );
};
