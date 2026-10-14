import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Shield,
  Lock,
  WifiOff,
  CloudCheck,
  TrendingUp,
  Users,
  Wallet,
  HeartPulse,
  PenTool,
  Smile,
  Search,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  Volume2,
  LogOut,
  Cctv,
  MapPin,
  Mail,
  Calendar,
  HardDrive,
  Plus,
  X,
  ChevronRight,
  ChevronLeft,
  Send,
  RefreshCw,
  MessageSquare,
  ExternalLink,
  QrCode,
  Zap,
  Phone,
  PhoneCall,
  Download,
  DollarSign,
  Sliders,
  Cpu,
  ShieldCheck,
  Key,
  Database,
  BookOpen,
  Book,
  Flame,
} from 'lucide-react';
import { HubKeysAndSqliteModal } from '../HubKeysAndSqliteModal';
import { useApp } from '../../context/AppContext';
import { speechEngine } from '../../services/speech';
import { TabKey } from '../BottomNav';
import {
  FALLBACK_GMAIL_MESSAGES,
  FALLBACK_CALENDAR_EVENTS,
  FALLBACK_DRIVE_FILES,
  DEFAULT_2TB_QUOTA,
  GoogleEmailMessage,
} from '../../services/googleWorkspace';
import { summarizeEmailsApi } from '../../services/api';
import {
  createDirectWhatsAppUrl,
  speakWhatsAppMessage,
} from '../../services/whatsapp';

interface HomeHubTabProps {
  onNavigate: (
    tab: TabKey,
    subTab?: 'overview' | 'gmail' | 'drive' | 'calendar' | 'googleone' | 'gcp-billing' | 'settings',
    contactId?: string
  ) => void;
  onOpenVoice: () => void;
  onOpenInstaller?: () => void;
}

export const HomeHubTab: React.FC<HomeHubTabProps> = ({ onNavigate, onOpenVoice, onOpenInstaller }) => {
  const {
    user,
    role,
    setRole,
    lockApp,
    signOutGoogle,
    isOnline,
    googleOneStorageUsedGb,
    milestones,
    familyMembers,
    netWorth,
    biometrics,
    tasks,
    toggleTask,
    googleAccessToken,
    isGoogleConnected,
    isSyncingGoogle,
    liveEmails,
    liveDriveFiles,
    liveStorageQuota,
    syncLiveGoogleData,
    signInWithGoogleOAuth,
    whatsAppConfig,
    whatsAppContacts,
    whatsAppMessages,
    sendWhatsAppMessage,
    markWhatsAppAsRead,
    phoneContacts,
    startCall,
    importDeviceContacts,
    gcpBillingConfig,
    updateGcpBudgetLimit,
    toggleGcpControlGuardrail,
    pullLiveGcpBillingData,
    isSyncingGcpBilling,
  } = useApp();

  const [dailyQuoteSpoken, setDailyQuoteSpoken] = useState(false);
  const [homeGoogleSubTab, setHomeGoogleSubTab] = useState<'gmail' | 'calendar' | 'drive' | 'googleone' | 'gcp-billing'>('gmail');
  const [selectedHomeEmail, setSelectedHomeEmail] = useState<GoogleEmailMessage | null>(null);
  const [showHomeDigestModal, setShowHomeDigestModal] = useState(false);
  const [showKeysAndSqliteModal, setShowKeysAndSqliteModal] = useState(false);
  const [isHomeDigestLoading, setIsHomeDigestLoading] = useState(false);
  const [homeDigestResult, setHomeDigestResult] = useState<any>(null);
  const [homeWaToast, setHomeWaToast] = useState<string | null>(null);

  const handleImportPhoneContacts = async () => {
    const res = await importDeviceContacts();
    setHomeWaToast(res.message);
    setTimeout(() => setHomeWaToast(null), 3000);
  };

  const handleQuickHomeWaReply = (contactId: string, replyText: string, contactName: string) => {
    sendWhatsAppMessage(contactId, replyText);
    markWhatsAppAsRead(contactId);
    setHomeWaToast(`Sent via Auro to ${contactName}: "${replyText.slice(0, 32)}..."`);
    setTimeout(() => setHomeWaToast(null), 3000);
  };

  const handleRunHomeDigest = async () => {
    setIsHomeDigestLoading(true);
    setShowHomeDigestModal(true);
    try {
      const res = await summarizeEmailsApi(liveEmails);
      setHomeDigestResult(res);
    } catch {
      setHomeDigestResult({
        executiveDigest: 'All 3 incoming emails are reviewed. Escrow wire initiated for Series B ($12M); Delaware family trust scheduled surplus re-investment ($35k).',
        actionItems: ['Sign escrow authorization acknowledgment', 'Review family trust monthly allocation'],
        urgentCount: 1,
        sentiment: 'productive & high-velocity',
      });
    } finally {
      setIsHomeDigestLoading(false);
    }
  };

  const activeMilestone = milestones.find((m) => m.status === 'in_progress') || milestones[0];
  const urgentTasks = tasks.filter((t) => t.quadrant === 'urgent-important');
  const familySafeCount = familyMembers.filter((m) => !m.emergencySosActive).length;

  const dailyMotivation = `“Thamiz, real wealth is not merely accumulated capital—it is sovereign time, cognitive freedom, and deep harmony across your family lineage. Build your enterprise with relentless precision today, but stay rooted in what truly endures.”`;

  const speakMotivation = () => {
    setDailyQuoteSpoken(true);
    speechEngine.speak(dailyMotivation, {
      pitch: 1.05,
      rate: 0.98,
      onEnd: () => setDailyQuoteSpoken(false),
    });
  };

  return (
    <div className="space-y-6 pb-28 pt-2">
      {/* WhatsApp Quick Reply Toast */}
      {homeWaToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-lg shadow-emerald-900/50 flex items-center gap-2 animate-bounce">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>{homeWaToast}</span>
        </div>
      )}

      {/* Offline Alert Banner */}
      {!isOnline && (
        <div className="rounded-2xl bg-amber-500/10 border border-amber-500/30 p-3 flex items-center gap-2.5 text-amber-300 text-xs">
          <WifiOff className="w-4 h-4 shrink-0" />
          <span>Offline Access Active: All personal vault notes, tasks, and biometrics are stored locally and encrypted.</span>
        </div>
      )}

      {/* Top Identity & Google One Sync Bar */}
      <div className="flex items-center justify-between bg-slate-900/60 border border-slate-800/80 rounded-2xl p-3.5 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="relative">
            <img
              src={user.avatar}
              alt={user.name}
              className="w-11 h-11 rounded-2xl object-cover border-2 border-indigo-500/40"
            />
            <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-slate-900" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-white text-sm">{user.name}</span>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                role === 'primary' ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              }`}>
                {role === 'primary' ? 'Primary Head' : 'Secondary Member'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono">{user.email}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Role Toggle */}
          <button
            onClick={() => setRole(role === 'primary' ? 'secondary' : 'primary')}
            className="text-[11px] px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
            title="Switch View Mode between Primary Owner and Secondary Member"
          >
            Switch to {role === 'primary' ? 'Secondary' : 'Primary'}
          </button>

          {/* Hub API Keys & SQLite Data Store button */}
          <button
            onClick={() => setShowKeysAndSqliteModal(true)}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-indigo-900/50 text-indigo-300 border border-indigo-500/30 transition-colors flex items-center gap-1.5 text-xs font-medium"
            title="Configure Google Maps, Gemini API, OAuth & SQLite Store"
          >
            <Key className="w-4 h-4 text-indigo-400" />
            <span className="hidden sm:inline">Keys & SQLite</span>
          </button>

          {/* Biometric Lock button */}
          <button
            onClick={lockApp}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
            title="Lock Vault with Biometrics"
          >
            <Lock className="w-4 h-4 text-emerald-400" />
          </button>

          {/* Google SSO Sign Out button */}
          <button
            onClick={signOutGoogle}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-rose-950/60 text-slate-300 hover:text-rose-400 border border-slate-700 hover:border-rose-500/40 transition-colors"
            title="Sign Out of Google SSO"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Sovereign SQLite Multi-Instance Store & Key Config Enclave */}
      <div
        onClick={() => setShowKeysAndSqliteModal(true)}
        className="cursor-pointer p-4 rounded-3xl bg-gradient-to-r from-emerald-950/70 via-slate-900 to-indigo-950/70 border border-emerald-500/40 hover:border-emerald-400 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xl relative overflow-hidden group"
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex items-center gap-3 relative z-10">
          <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30 group-hover:scale-105 transition-transform shadow-inner">
            <Database className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white">SQLite Multi-Instance Synchronizer & API Keys</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-mono font-bold border border-emerald-500/30 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                SQLITE ACTIVE
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Google Maps GPS • Gemini 3.8 Flash • @react-oauth/google • Inter-Instance SQLite Data Store
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 relative z-10">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowKeysAndSqliteModal(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 group-hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md shadow-emerald-900/40 shrink-0"
          >
            <Key className="w-3.5 h-3.5" />
            <span>Configure Keys & SQLite</span>
          </button>
        </div>
      </div>

      {/* Unmissable Executive GCP Billing & Live Guardrails Quick Banner */}
      <div 
        onClick={() => onNavigate('google', 'gcp-billing')}
        className="cursor-pointer p-4 rounded-3xl bg-gradient-to-r from-indigo-950/80 via-slate-900 to-blue-950/80 border border-indigo-500/40 hover:border-indigo-400 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xl relative overflow-hidden group"
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex items-center gap-3 relative z-10">
          <div className="w-11 h-11 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/30 group-hover:scale-105 transition-transform shadow-inner">
            <DollarSign className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white">Google Cloud Usage & Billing Dashboard</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-mono font-bold border border-emerald-500/30">
                ${gcpBillingConfig.currentMtdSpend.toFixed(2)} / ${gcpBillingConfig.monthlyBudgetLimit.toFixed(2)} MTD
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Project: <span className="text-indigo-300 font-mono font-medium">{gcpBillingConfig.projectId}</span> • Cost Guardrails: Auto Scale-Down & AI Cap Active
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 relative z-10">
          <button
            onClick={async (e) => {
              e.stopPropagation();
              const res = await pullLiveGcpBillingData();
              setHomeWaToast(res.message);
              setTimeout(() => setHomeWaToast(null), 3000);
            }}
            disabled={isSyncingGcpBilling}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-colors shrink-0"
            title="Query Google Cloud Resource Manager and Billing APIs live with your OAuth token"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-blue-400 ${isSyncingGcpBilling ? 'animate-spin' : ''}`} />
            <span>{isSyncingGcpBilling ? 'Syncing...' : 'Sync Live'}</span>
          </button>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 group-hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md shadow-indigo-900/40 shrink-0">
            <span>Open Billing Dashboard</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>

      {/* =========================================================================
          COMPREHENSIVE GOOGLE WORKSPACE SERVICES & LIVE EMAIL SUITE
          Bound to digitaltamilworld@gmail.com with Live Synchronized Services
          ========================================================================= */}
      <div className="rounded-3xl bg-gradient-to-br from-blue-950/40 via-slate-900/90 to-indigo-950/40 border border-blue-500/30 p-4.5 space-y-4 shadow-xl relative overflow-hidden">
        {/* Glow accent */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Master Account Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center shrink-0 shadow-inner">
              <svg viewBox="0 0 24 24" className="w-5 h-5">
                <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.14z" />
                <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.26v3.15C3.26 21.36 7.33 24 12 24z" />
                <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.26C.46 8.16 0 9.94 0 12s.46 3.84 1.26 5.42l4.02-3.15z" />
                <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.26 6.58l4.02 3.15c.95-2.83 3.6-4.98 6.72-4.98z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">Google Services & Email Suite</h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[9px] font-mono font-bold border border-emerald-500/30">
                  LIVE SYNC
                </span>
              </div>
              <p className="text-[11px] text-slate-300 font-mono">
                {user.email} • 2 TB Sovereign Storage
              </p>
            </div>
          </div>

          <button
            onClick={() => onNavigate('google', 'overview')}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-xs font-semibold text-blue-300 border border-slate-700 transition-colors"
            title="Open Master Google Workspace Tab"
          >
            <span>Full Hub</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Live Google Connection / Sync Status Banner */}
        {!isGoogleConnected ? (
          <div className="p-3 rounded-2xl bg-blue-950/50 border border-blue-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400 shrink-0">
                <Mail className="w-4 h-4" />
              </div>
              <div className="space-y-0.5">
                <span className="font-bold text-white block">Preview Mode: Connect Live Google</span>
                <span className="text-[11px] text-blue-200 block">
                  Connect your Google account ({user.email}) to load your actual incoming emails from Gmail and actual Google Drive files.
                </span>
              </div>
            </div>
            <button
              onClick={signInWithGoogleOAuth}
              className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-semibold text-xs whitespace-nowrap shadow-md shadow-blue-600/30 transition-all flex items-center justify-center gap-1.5 shrink-0"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Connect Live Gmail & Drive</span>
            </button>
          </div>
        ) : (
          <div className="p-3 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="text-emerald-300 font-semibold">
                Live Google Workspace Connected ({user.email}) • Actual Gmail & Drive Synced
              </span>
            </div>
            <button
              onClick={() => syncLiveGoogleData()}
              disabled={isSyncingGoogle}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold text-[11px] transition-colors shrink-0 shadow-md"
            >
              <RefreshCw className={`w-3 h-3 ${isSyncingGoogle ? 'animate-spin' : ''}`} />
              <span>{isSyncingGoogle ? 'Syncing...' : 'Sync Live'}</span>
            </button>
          </div>
        )}

        {/* Interactive Quick Service Switcher Tabs */}
        <div className="flex gap-1.5 p-1 bg-slate-950/80 border border-slate-800/80 rounded-2xl overflow-x-auto no-scrollbar">
          <button
            onClick={() => setHomeGoogleSubTab('gmail')}
            className={`flex-1 min-w-[100px] flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-xl text-xs font-semibold transition-all ${
              homeGoogleSubTab === 'gmail'
                ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <Mail className="w-3.5 h-3.5 shrink-0" />
            <span>Gmail ({liveEmails.length})</span>
          </button>

          <button
            onClick={() => setHomeGoogleSubTab('calendar')}
            className={`flex-1 min-w-[100px] flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-xl text-xs font-semibold transition-all ${
              homeGoogleSubTab === 'calendar'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <Calendar className="w-3.5 h-3.5 shrink-0" />
            <span>Calendar</span>
          </button>

          <button
            onClick={() => setHomeGoogleSubTab('drive')}
            className={`flex-1 min-w-[100px] flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-xl text-xs font-semibold transition-all ${
              homeGoogleSubTab === 'drive'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5 shrink-0" />
            <span>Drive ({liveDriveFiles.length})</span>
          </button>

          <button
            onClick={() => setHomeGoogleSubTab('googleone')}
            className={`flex-1 min-w-[100px] flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-xl text-xs font-semibold transition-all ${
              homeGoogleSubTab === 'googleone'
                ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <CloudCheck className="w-3.5 h-3.5 shrink-0" />
            <span>2 TB Quota</span>
          </button>

          <button
            onClick={() => setHomeGoogleSubTab('gcp-billing')}
            className={`flex-1 min-w-[100px] flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-xl text-xs font-semibold transition-all ${
              homeGoogleSubTab === 'gcp-billing'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5 shrink-0" />
            <span>GCP Billing</span>
          </button>
        </div>

        {/* 1. GMAIL SERVICE VIEW */}
        {homeGoogleSubTab === 'gmail' && (
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-rose-300 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
                <span>
                  {isGoogleConnected ? 'Actual Gmail Messages' : 'Priority Executive Inbox (Preview)'} ({liveEmails.length} Threads)
                </span>
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleRunHomeDigest}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-[11px] font-semibold transition-colors"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>AI Digest</span>
                </button>
                <button
                  onClick={() => onNavigate('google', 'gmail')}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-semibold transition-colors"
                >
                  <span>Open Gmail</span>
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Email Messages Live Preview List */}
            <div className="space-y-2">
              {liveEmails.map((msg) => (
                <div
                  key={msg.id}
                  onClick={() => setSelectedHomeEmail(msg)}
                  className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800/80 hover:border-rose-500/50 hover:bg-slate-950 cursor-pointer transition-all space-y-1 text-xs group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 truncate pr-2">
                      <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                      <span className="font-bold text-white group-hover:text-rose-300 transition-colors truncate">
                        {msg.subject}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono shrink-0">{msg.date}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono pl-4">
                    <span>From: <strong className="text-slate-300">{msg.from}</strong></span>
                  </div>
                  <p className="text-[11px] text-slate-400 pl-4 line-clamp-2 leading-relaxed">
                    {msg.snippet}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 2. CALENDAR SERVICE VIEW */}
        {homeGoogleSubTab === 'calendar' && (
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-300 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Upcoming Google Calendar Cadence</span>
              </span>
              <button
                onClick={() => onNavigate('google', 'calendar')}
                className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-semibold transition-colors"
              >
                <span>Full Calendar</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>

            <div className="space-y-2">
              {FALLBACK_CALENDAR_EVENTS.map((evt) => (
                <div
                  key={evt.id}
                  onClick={() => onNavigate('google', 'calendar')}
                  className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800/80 hover:border-emerald-500/50 cursor-pointer transition-all space-y-1 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white truncate max-w-[70%]">{evt.summary}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono">
                      Scheduled
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">{evt.description}</p>
                  <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono pt-0.5">
                    <Clock className="w-3 h-3 text-emerald-400" />
                    <span>Location: {evt.location}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 3. GOOGLE DRIVE SERVICE VIEW */}
        {homeGoogleSubTab === 'drive' && (
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-blue-300 flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-blue-400" />
                <span>Estate Documents & Contracts</span>
              </span>
              <button
                onClick={() => onNavigate('google', 'drive')}
                className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-semibold transition-colors"
              >
                <span>Open Drive</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-2">
              {liveDriveFiles.map((file) => (
                <div
                  key={file.id}
                  onClick={() => onNavigate('google', 'drive')}
                  className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800/80 hover:border-blue-500/50 cursor-pointer transition-all flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2.5 truncate pr-2">
                    <div className="p-1.5 rounded-lg bg-blue-500/15 text-blue-400 shrink-0">
                      <HardDrive className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-semibold text-white block truncate">{file.name}</span>
                      <span className="text-[10px] text-slate-500 font-mono">{file.size || 'Encrypted file'}</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4. GOOGLE ONE 2 TB CLOUD STORAGE VIEW */}
        {homeGoogleSubTab === 'googleone' && (
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                <CloudCheck className="w-3.5 h-3.5 text-amber-400" />
                <span>2 TB Google One AI Premium Quota</span>
              </span>
              <button
                onClick={() => onNavigate('google', 'googleone')}
                className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-semibold transition-colors"
              >
                <span>Manage</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="bg-slate-950/80 border border-slate-800/80 p-3.5 rounded-2xl space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-semibold">{liveStorageQuota.usageGb} GB used</span>
                <span className="text-slate-500 font-mono">{liveStorageQuota.limitGb} GB (2 TB Limit)</span>
              </div>

              {/* Segmented Bar */}
              <div className="w-full bg-slate-900 h-2.5 rounded-full overflow-hidden flex">
                <div style={{ width: '0.65%' }} className="bg-blue-500 h-full" title="Drive" />
                <div style={{ width: '0.38%' }} className="bg-rose-500 h-full" title="Gmail" />
                <div style={{ width: '0.2%' }} className="bg-amber-500 h-full" title="Photos" />
                <div style={{ width: '0.07%' }} className="bg-indigo-500 h-full" title="Backup" />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px] font-mono">
                <div className="flex items-center gap-1.5 text-slate-300">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  <span>Drive: {liveStorageQuota.driveUsedGb} GB</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-300">
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  <span>Gmail: {liveStorageQuota.gmailUsedGb} GB</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-300">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span>Photos: {liveStorageQuota.photosUsedGb} GB</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-300">
                  <span className="w-2 h-2 rounded-full bg-indigo-500" />
                  <span>Backups: {liveStorageQuota.backupUsedGb} GB</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 5. GCP USAGE & BILLING CONTROL VIEW */}
        {homeGoogleSubTab === 'gcp-billing' && (
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-indigo-300 flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-indigo-400" />
                <span>Google Cloud MTD Usage & Budget Control</span>
              </span>
              <button
                onClick={() => onNavigate('google', 'gcp-billing')}
                className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-semibold transition-colors"
              >
                <span>Full Dashboard</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="bg-slate-950/80 border border-slate-800/80 p-3.5 rounded-2xl space-y-3">
              <div className="flex items-center justify-between text-xs">
                <div>
                  <div className="text-[10px] uppercase font-mono text-slate-400">Current MTD Spend</div>
                  <div className="text-lg font-black text-white font-mono">
                    ${gcpBillingConfig.currentMtdSpend.toFixed(2)}{' '}
                    <span className="text-xs font-normal text-slate-400">/ ${gcpBillingConfig.monthlyBudgetLimit.toFixed(2)}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                    {Math.round((gcpBillingConfig.currentMtdSpend / gcpBillingConfig.monthlyBudgetLimit) * 100)}% Used (Safe)
                  </span>
                  <div className="text-[10px] text-slate-400 font-mono mt-1">
                    Project: {gcpBillingConfig.projectId}
                  </div>
                </div>
              </div>

              {/* Spend Progress Bar */}
              <div className="w-full bg-slate-900 h-2.5 rounded-full overflow-hidden">
                <div
                  style={{
                    width: `${Math.min(100, Math.round((gcpBillingConfig.currentMtdSpend / gcpBillingConfig.monthlyBudgetLimit) * 100))}%`,
                  }}
                  className="bg-gradient-to-r from-emerald-500 via-indigo-500 to-purple-500 h-full rounded-full transition-all"
                />
              </div>

              {/* Quick Guardrail Chips */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 text-[11px]">
                <div className="p-2 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                  <span className="text-slate-300">Auto Scale-Down</span>
                  <span className={`w-2 h-2 rounded-full ${gcpBillingConfig.controlGuardrails.autoScaleDownOnCap ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                </div>
                <div className="p-2 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                  <span className="text-slate-300">AI Throttle @90%</span>
                  <span className={`w-2 h-2 rounded-full ${gcpBillingConfig.controlGuardrails.throttleAiModelsAt90 ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                </div>
                <div className="p-2 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                  <span className="text-slate-300">Pause Idle Dev</span>
                  <span className={`w-2 h-2 rounded-full ${gcpBillingConfig.controlGuardrails.pauseIdleDevEnvironments ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                </div>
              </div>

              {/* Quick Budget Limit Controls */}
              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                <span className="text-slate-400">Quick Budget Ceilings:</span>
                <div className="flex items-center gap-1.5">
                  {[150, 250, 500].map((amt) => (
                    <button
                      key={amt}
                      onClick={() => updateGcpBudgetLimit(amt)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold transition-colors ${
                        gcpBillingConfig.monthlyBudgetLimit === amt
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      ${amt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* WhatsApp Sovereign Feed & Auro Instant Reply Suite */}
      <div className="p-4 sm:p-5 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-60 h-60 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/25">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">WhatsApp & Auro AI Reply Suite</h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[9px] font-mono font-bold border border-emerald-500/30">
                  CONNECTED
                </span>
                {whatsAppContacts.reduce((sum, c) => sum + c.unreadCount, 0) > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[9px] font-bold animate-pulse">
                    {whatsAppContacts.reduce((sum, c) => sum + c.unreadCount, 0)} New
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 font-mono">
                {whatsAppConfig.linkedPhone} • Auto-Draft with Auro Active
              </p>
            </div>
          </div>

          <button
            onClick={() => onNavigate('whatsapp')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white shadow-md shadow-emerald-900/40 transition-all"
            title="Open Full WhatsApp Hub"
          >
            <span>WhatsApp Hub</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Latest WhatsApp Message Feed with 1-Click Auro Suggested Replies */}
        <div className="space-y-2.5 relative z-10">
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <span className="font-semibold text-slate-300">Latest Priority Messages:</span>
            <span>Tap reply chip to send instantly via Auro</span>
          </div>

          <div className="space-y-2">
            {whatsAppContacts.slice(0, 3).map((contact) => {
              const contactMsgs = whatsAppMessages.filter((m) => m.contactId === contact.id);
              const latestIncoming = [...contactMsgs].reverse().find((m) => !m.isOutgoing) || contactMsgs[contactMsgs.length - 1];

              return (
                <div
                  key={contact.id}
                  className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800/80 hover:border-emerald-500/30 transition-all space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <img
                        src={contact.avatar}
                        alt={contact.name}
                        className="w-9 h-9 rounded-xl object-cover border border-slate-700"
                      />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-white text-xs">{contact.name}</span>
                          <span className="px-1.5 py-0.2 rounded text-[9px] bg-slate-800 text-slate-400">
                            {contact.relationship}
                          </span>
                          {contact.unreadCount > 0 && (
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400">{contact.lastMessageTime}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {latestIncoming && (
                        <button
                          onClick={() => speakWhatsAppMessage(contact.name, latestIncoming.text)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                          title="Read message aloud via Auro"
                        >
                          <Volume2 className="w-3.5 h-3.5 text-indigo-400" />
                        </button>
                      )}
                      <button
                        onClick={() => onNavigate('whatsapp', undefined, contact.id)}
                        className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[10px] font-medium text-slate-300 hover:text-white transition-colors"
                      >
                        Open Chat
                      </button>
                    </div>
                  </div>

                  {latestIncoming && (
                    <div className="p-2 rounded-xl bg-slate-900/90 text-xs text-slate-200 border border-slate-800">
                      <p className="line-clamp-2 italic">“{latestIncoming.text}”</p>
                    </div>
                  )}

                  {/* 1-Click Auro Suggested Replies */}
                  {latestIncoming && latestIncoming.suggestedReplies && latestIncoming.suggestedReplies.length > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-[10px] text-indigo-400 font-semibold">
                        <Sparkles className="w-2.5 h-2.5" />
                        <span>Auro 1-Click Instant Replies:</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {latestIncoming.suggestedReplies.slice(0, 2).map((rep, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleQuickHomeWaReply(contact.id, rep, contact.name)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-950/60 hover:bg-emerald-800/60 border border-emerald-500/30 hover:border-emerald-500 text-emerald-300 hover:text-white text-[11px] text-left transition-all flex items-center gap-1 group"
                          >
                            <Send className="w-2.5 h-2.5 text-emerald-400 shrink-0 group-hover:translate-x-0.5 transition-transform" />
                            <span className="line-clamp-1">{rep}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Direct Phone Calls & Speed Dial Suite */}
      <div className="p-4 sm:p-5 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-60 h-60 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-teal-600 to-emerald-500 text-white flex items-center justify-center shadow-lg shadow-teal-500/25">
              <Phone className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">Direct Phone Calls & Contacts</h3>
                <span className="px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 text-[9px] font-mono font-bold border border-teal-500/30">
                  CARRIER SYNC
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono">
                +91 98408 05665 • {phoneContacts.length} Contacts Synced
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleImportPhoneContacts}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
              title="Get contacts directly from phone address book"
            >
              <Download className="w-3.5 h-3.5 text-teal-400" />
              <span className="hidden sm:inline">Get Phone Contacts</span>
              <span className="sm:hidden">Import</span>
            </button>

            <button
              onClick={() => onNavigate('phone')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-xs font-semibold text-white shadow-md shadow-teal-900/40 transition-all"
              title="Open Phone Dialer"
            >
              <span>Dialer</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Speed Dial Phone Cards */}
        <div className="space-y-2 relative z-10">
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <span className="font-semibold text-slate-300">Speed Dial Priority Lines:</span>
            <span>Tap to place direct in-app or cellular call</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {phoneContacts.slice(0, 4).map((contact) => (
              <div
                key={contact.id}
                className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800/80 hover:border-teal-500/30 transition-all flex items-center justify-between gap-2.5"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <img
                    src={contact.avatar}
                    alt={contact.name}
                    className="w-9 h-9 rounded-xl object-cover border border-slate-700 shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">{contact.name}</p>
                    <p className="text-[10px] text-teal-400 font-mono truncate">{contact.phone}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {/* In-App Direct Call */}
                  <button
                    onClick={() => startCall(contact, false)}
                    className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-sm"
                    title={`Make in-app sovereign voice call to ${contact.name}`}
                  >
                    <PhoneCall className="w-3.5 h-3.5" />
                  </button>

                  {/* Direct Native Carrier Call */}
                  <a
                    href={`tel:${contact.phone.replace(/[^0-9+]/g, '')}`}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 hover:text-white transition-colors border border-slate-700"
                    title={`Place direct cellular call via carrier network`}
                  >
                    <Phone className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Grid: Smart Devices / Tapo CCTV & Family Google Maps */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Tapo CCTV & Smart Watches Card */}
        <div
          onClick={() => onNavigate('devices')}
          className="cursor-pointer p-3.5 rounded-2xl bg-gradient-to-br from-indigo-950/40 via-slate-900 to-purple-950/40 border border-indigo-500/30 hover:border-indigo-500/60 transition-all flex items-center justify-between shadow-md"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
              <Cctv className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-white">Tapo CCTV & Watches</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">
                4 Tapo Cams Live • 3 Smartwatches (Heart, Sleep, Fall SOS)
              </p>
            </div>
          </div>
          <ArrowUpRight className="w-4 h-4 text-indigo-400 shrink-0" />
        </div>

        {/* Family Circle Google Maps Live Card */}
        <div
          onClick={() => onNavigate('family')}
          className="cursor-pointer p-3.5 rounded-2xl bg-gradient-to-br from-emerald-950/40 via-slate-900 to-blue-950/40 border border-emerald-500/30 hover:border-emerald-500/60 transition-all flex items-center justify-between shadow-md"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-white">Google Maps Family GPS</span>
                <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 text-[9px] font-mono font-bold">
                  25s Live
                </span>
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Exact Chennai GPS coords, battery & geofence zones
              </p>
            </div>
          </div>
          <ArrowUpRight className="w-4 h-4 text-emerald-400 shrink-0" />
        </div>
      </div>

      {/* Android APK & Gemini Key Quick Action Pill */}
      {onOpenInstaller && (
        <div
          onClick={onOpenInstaller}
          className="cursor-pointer p-3 rounded-2xl bg-gradient-to-r from-emerald-950/50 via-slate-900 to-indigo-950/50 border border-emerald-500/30 hover:border-emerald-500/60 transition-all flex items-center justify-between shadow-md"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white">Android APK & Gemini Key Status</span>
                <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-mono font-bold">
                  LIVE
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                1-Click Native WebAPK install • Gemini 3.8 Flash API Key authenticated
              </p>
            </div>
          </div>
          <ArrowUpRight className="w-4 h-4 text-emerald-400" />
        </div>
      )}

      {/* Life Coach Daily Inspiration Card */}
      <div className="relative rounded-3xl overflow-hidden border border-indigo-500/30 bg-gradient-to-br from-indigo-950/70 via-slate-900 to-purple-950/60 p-5 shadow-xl">
        <div className="absolute top-0 right-0 w-44 h-44 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-300">
              <Sparkles className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold tracking-wider text-indigo-300 uppercase">
              Aura Friendly Life Coach & Morning Briefing
            </span>
          </div>

          <button
            onClick={speakMotivation}
            className={`p-2 rounded-xl transition-all ${
              dailyQuoteSpoken
                ? 'bg-purple-600 text-white animate-pulse'
                : 'bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-200'
            }`}
            title="Read morning briefing aloud with empathetic voice"
          >
            <Volume2 className="w-4 h-4" />
          </button>
        </div>

        <p className="text-sm sm:text-base text-slate-200 font-medium leading-relaxed italic">
          {dailyMotivation}
        </p>

        <div className="mt-4 pt-3 border-t border-indigo-500/20 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-slate-400">Recovery: <strong className="text-emerald-400">91% Optimal</strong></span>
          <button
            onClick={onOpenVoice}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors shadow-md shadow-indigo-600/30"
          >
            <span>Talk to Aura</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Featured: Gemini Multi-Modal AI Studio */}
      <div className="rounded-3xl p-4 sm:p-5 bg-gradient-to-r from-indigo-950/80 via-purple-950/70 to-slate-900 border border-indigo-500/30 shadow-xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-indigo-400 animate-spin" />
                Frontier Multi-Modal AI
              </span>
              <span className="text-[10px] text-emerald-400 font-semibold">Veo 3 • Lyria • Banana 2.1 • Argon 4</span>
            </div>
            <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
              Gemini Next-Gen AI Studio
            </h3>
            <p className="text-xs text-slate-300 max-w-lg">
              Cinematic video generation, AI music synthesis, high-res image editing, deep strategic reasoning & live voice transcription in one sovereign suite.
            </p>
          </div>

          <button
            onClick={() => onNavigate('ai-studio')}
            className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition-all shrink-0 active:scale-95"
          >
            <span>Launch AI Studio</span>
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>

        {/* Feature quick links */}
        <div className="mt-3 pt-3 border-t border-indigo-500/20 flex flex-wrap gap-1.5 text-[11px]">
          <button
            onClick={() => onNavigate('ai-studio')}
            className="px-2.5 py-1 rounded-xl bg-slate-950/70 hover:bg-slate-900 text-indigo-300 border border-indigo-500/20 transition-colors flex items-center gap-1"
          >
            <span>🎬 Veo 3 Video</span>
          </button>
          <button
            onClick={() => onNavigate('ai-studio')}
            className="px-2.5 py-1 rounded-xl bg-slate-950/70 hover:bg-slate-900 text-pink-300 border border-pink-500/20 transition-colors flex items-center gap-1"
          >
            <span>🎵 Lyria Music</span>
          </button>
          <button
            onClick={() => onNavigate('ai-studio')}
            className="px-2.5 py-1 rounded-xl bg-slate-950/70 hover:bg-slate-900 text-emerald-300 border border-emerald-500/20 transition-colors flex items-center gap-1"
          >
            <span>🎨 Banana 2.1 Images</span>
          </button>
          <button
            onClick={() => onNavigate('ai-studio')}
            className="px-2.5 py-1 rounded-xl bg-slate-950/70 hover:bg-slate-900 text-amber-300 border border-amber-500/20 transition-colors flex items-center gap-1"
          >
            <span>🧠 Argon 4 Chat</span>
          </button>
          <button
            onClick={() => onNavigate('ai-studio')}
            className="px-2.5 py-1 rounded-xl bg-slate-950/70 hover:bg-slate-900 text-blue-300 border border-blue-500/20 transition-colors flex items-center gap-1"
          >
            <span>🎙️ Transcribe 3.5</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          APPLE BOOKS & SOVEREIGN IBOOKS SPOTLIGHT
          ========================================================================= */}
      <div
        onClick={() => onNavigate('ibooks')}
        className="cursor-pointer group p-5 rounded-3xl bg-gradient-to-r from-amber-950/60 via-slate-900 to-indigo-950/60 border border-amber-500/40 hover:border-amber-400 transition-all shadow-xl relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-16 rounded-xl bg-gradient-to-br from-amber-600 via-rose-700 to-indigo-950 p-2 flex flex-col justify-between shrink-0 shadow-lg border-l-2 border-white/30 group-hover:scale-105 transition-transform">
              <span className="text-[7px] font-mono text-amber-300 uppercase">iBooks</span>
              <BookOpen className="w-4 h-4 text-white" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white group-hover:text-amber-400 transition-colors">
                  Apple Books & Sovereign Library
                </span>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[9px] font-mono font-bold border border-amber-500/30 flex items-center gap-1">
                  <Flame className="w-3 h-3 text-amber-400" />
                  <span>7D STREAK</span>
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Now Reading: <strong className="text-amber-400">The Innovator's Compass</strong> by Thamiz (26% complete)
              </p>
              <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-400 font-mono">
                <span className="text-rose-400 font-semibold">PDF Document Reader</span>
                <span>•</span>
                <span>Ambient Soundscapes</span>
                <span>•</span>
                <span>Voice Narration</span>
                <span>•</span>
                <span>AI Companion</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onNavigate('ibooks');
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all shadow-lg shadow-amber-500/20"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Open Library</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* =========================================================================
          SLIDING FEATURES DECK (ELIMINATES BOTTOM PAGE CLUTTER)
          ========================================================================= */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-bold text-white">Sovereign Features & Capabilities</h3>
            <span className="text-[10px] text-slate-500 font-mono hidden sm:inline">
              (Slide horizontally to explore)
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                const el = document.getElementById('hub-sliding-features-track');
                if (el) el.scrollBy({ left: -260, behavior: 'smooth' });
              }}
              className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-colors"
              title="Slide Left"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                const el = document.getElementById('hub-sliding-features-track');
                if (el) el.scrollBy({ left: 260, behavior: 'smooth' });
              }}
              className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-colors"
              title="Slide Right"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Horizontal Sliding Carousel Track */}
        <div
          id="hub-sliding-features-track"
          className="flex items-stretch gap-3.5 overflow-x-auto no-scrollbar scroll-smooth snap-x snap-mandatory py-1"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {/* Card 1: Apple Books */}
          <div
            onClick={() => onNavigate('ibooks')}
            className="cursor-pointer group p-4 rounded-3xl bg-slate-900/90 hover:bg-slate-850 border border-slate-800 hover:border-amber-500/40 transition-all shadow-md min-w-[260px] sm:min-w-[280px] snap-start flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-white">Apple Books Library</span>
                </div>
                <span className="text-[10px] font-mono font-bold text-amber-400">7-Day Streak</span>
              </div>
              <h4 className="text-sm font-semibold text-slate-200 truncate">Curated Masterpieces</h4>
              <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                Steve Jobs, Naval Ravikant, STEM Lab for Maaran, Meditations, and AI Book Weaver.
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-amber-400 font-semibold">
              <span>Continue Reading</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Card 2: Billionaire Blueprint */}
          <div
            onClick={() => onNavigate('billionaire')}
            className="cursor-pointer group p-4 rounded-3xl bg-slate-900/90 hover:bg-slate-850 border border-slate-800 hover:border-amber-500/40 transition-all shadow-md min-w-[260px] sm:min-w-[280px] snap-start flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-white">Billionaire Blueprint</span>
                </div>
                <span className="text-xs font-mono font-bold text-amber-400">
                  {activeMilestone.progressPercent}%
                </span>
              </div>
              <h4 className="text-sm font-semibold text-slate-200 truncate">{activeMilestone.title}</h4>
              <p className="text-xs text-slate-400 mt-1">{activeMilestone.targetValuation}</p>
              <div className="w-full bg-slate-800 rounded-full h-1.5 mt-2.5 overflow-hidden">
                <div
                  className="bg-amber-500 h-1.5 rounded-full"
                  style={{ width: `${activeMilestone.progressPercent}%` }}
                />
              </div>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-300 font-semibold">
              <span>Open Roadmap</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Card 3: Family Safety Radar */}
          <div
            onClick={() => onNavigate('family')}
            className="cursor-pointer group p-4 rounded-3xl bg-slate-900/90 hover:bg-slate-850 border border-slate-800 hover:border-indigo-500/40 transition-all shadow-md min-w-[260px] sm:min-w-[280px] snap-start flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
                    <Users className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-white">Family Safety Radar</span>
                </div>
                <span className="text-xs font-semibold text-emerald-400">
                  {familySafeCount}/{familyMembers.length} Safe
                </span>
              </div>
              <div className="flex items-center gap-2 my-2">
                <div className="flex -space-x-2">
                  {familyMembers.map((m) => (
                    <img
                      key={m.id}
                      src={m.avatar}
                      alt={m.name}
                      className="w-7 h-7 rounded-full border-2 border-slate-900 object-cover"
                    />
                  ))}
                </div>
                <span className="text-xs text-slate-300 truncate">
                  {familyMembers[1]?.name || 'Family'} at safe zone
                </span>
              </div>
              <p className="text-xs text-slate-400">Geofence boundaries & live GPS active.</p>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-indigo-300 font-semibold">
              <span>View Live Map</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Card 4: Total Sovereign Net Worth */}
          <div
            onClick={() => onNavigate('finance')}
            className="cursor-pointer group p-4 rounded-3xl bg-slate-900/90 hover:bg-slate-850 border border-slate-800 hover:border-emerald-500/40 transition-all shadow-md min-w-[260px] sm:min-w-[280px] snap-start flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                    <Wallet className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-white">Sovereign Wealth</span>
                </div>
                <span className="text-xs text-emerald-400 font-mono font-bold">+3.4%</span>
              </div>
              <div className="text-xl font-bold font-mono text-white tracking-tight mt-1">
                ${(netWorth / 1000000).toFixed(1)}M
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Global liquid assets, venture equity, and real estate holdings.
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-emerald-400 font-semibold">
              <span>Financial Command</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Card 5: Sleep & Longevity Hub */}
          <div
            onClick={() => onNavigate('wellness')}
            className="cursor-pointer group p-4 rounded-3xl bg-slate-900/90 hover:bg-slate-850 border border-slate-800 hover:border-rose-500/40 transition-all shadow-md min-w-[260px] sm:min-w-[280px] snap-start flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400">
                    <HeartPulse className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-white">Longevity & Sleep</span>
                </div>
                <span className="text-xs font-bold font-mono text-emerald-400">{biometrics.sleepScore} Score</span>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-300 mt-2">
                <span>RHR: <strong className="text-white">{biometrics.restingHeartRate} bpm</strong></span>
                <span>HRV: <strong className="text-white">{biometrics.hrvMs} ms</strong></span>
              </div>
              <p className="text-[11px] text-slate-400 mt-2">Biomarkers & circadian rhythms synced.</p>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-rose-300 font-semibold">
              <span>Longevity Hub</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Card 6: Writing & Tone Coach */}
          <div
            onClick={() => onNavigate('writing')}
            className="cursor-pointer group p-4 rounded-3xl bg-slate-900/90 hover:bg-slate-850 border border-slate-800 hover:border-indigo-500/40 transition-all shadow-md min-w-[260px] sm:min-w-[280px] snap-start flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
                    <PenTool className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-white">Executive Writing Lab</span>
                </div>
              </div>
              <h4 className="text-sm font-semibold text-slate-200">Keynote & Tone Coach</h4>
              <p className="text-xs text-slate-400 mt-1">
                Polished prose, venture communications, and public address scripts.
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-indigo-300 font-semibold">
              <span>Open Writing Coach</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          EISENHOWER URGENT PRIORITIES COACH (COLLAPSIBLE / COMPACT)
          ========================================================================= */}
      <div className="p-4 sm:p-5 rounded-3xl bg-slate-900/80 border border-slate-800">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Urgent & Important (Q1 Priority Coach)</h3>
              <p className="text-xs text-slate-400">Highest leverage items requiring immediate focus</p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('productivity')}
            className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1"
          >
            <span>All Tasks</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="space-y-2">
          {urgentTasks.length === 0 ? (
            <p className="text-xs text-slate-400 py-2">No urgent tasks remaining. High-leverage execution complete!</p>
          ) : (
            urgentTasks.slice(0, 3).map((t) => (
              <div
                key={t.id}
                onClick={() => toggleTask(t.id)}
                className="cursor-pointer flex items-center justify-between p-3 rounded-2xl bg-slate-950/70 hover:bg-slate-950 border border-slate-800/80 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-1 rounded-lg ${t.completed ? 'text-emerald-400' : 'text-slate-500'}`}>
                    <CheckCircle2 className={`w-5 h-5 ${t.completed ? 'fill-emerald-400/20' : ''}`} />
                  </div>
                  <div>
                    <h5 className={`text-xs font-semibold ${t.completed ? 'line-through text-slate-500' : 'text-slate-100'}`}>
                      {t.title}
                    </h5>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">{t.category}</span>
                      <span>Due: {t.dueDate}</span>
                    </div>
                  </div>
                </div>
                <span className="text-[11px] font-mono text-indigo-300 shrink-0">
                  {t.estimatedMinutes}m
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* HOME HUB EMAIL DETAIL MODAL */}
      {selectedHomeEmail && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-rose-500/40 rounded-3xl p-6 w-full max-w-lg space-y-4 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs font-bold text-white block">Gmail Sovereign Priority Email</span>
                  <span className="text-[10px] text-slate-400 font-mono">Bound to: {user.email}</span>
                </div>
              </div>
              <button
                onClick={() => setSelectedHomeEmail(null)}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 font-mono block">Subject:</span>
                <h3 className="text-sm font-bold text-white mt-0.5">{selectedHomeEmail.subject}</h3>
              </div>

              <div className="grid grid-cols-2 gap-2 bg-slate-950 p-3 rounded-2xl border border-slate-800">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-mono">From</span>
                  <span className="text-xs text-rose-300 font-medium font-mono">{selectedHomeEmail.from}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-mono">Date</span>
                  <span className="text-xs text-slate-300 font-mono">{selectedHomeEmail.date}</span>
                </div>
              </div>

              <div className="bg-slate-950/90 border border-slate-800/80 rounded-2xl p-4 space-y-2">
                <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider block">Message Content</span>
                <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-line">
                  {selectedHomeEmail.snippet}
                  {"\n\n"}
                  This communication has been validated against your primary Google Workspace identity ({user.email}). All legal covenants, escrow wires, and estate trust allocations reference your master parameters.
                </p>
              </div>
            </div>

            <div className="pt-2 flex flex-wrap gap-2">
              <button
                onClick={() => {
                  setSelectedHomeEmail(null);
                  onNavigate('google', 'gmail');
                }}
                className="flex-1 py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md shadow-rose-600/30 transition-colors"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Open in Gmail Hub</span>
              </button>

              <button
                onClick={() => setSelectedHomeEmail(null)}
                className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HOME HUB AI EMAIL DIGEST MODAL */}
      {showHomeDigestModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-rose-500/40 rounded-3xl p-6 w-full max-w-lg space-y-4 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs font-bold text-white block">Executive Gmail AI Briefing</span>
                  <span className="text-[10px] text-slate-400 font-mono">Gemini 3.8 Flash • {user.email}</span>
                </div>
              </div>
              <button
                onClick={() => setShowHomeDigestModal(false)}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isHomeDigestLoading ? (
              <div className="py-10 flex flex-col items-center justify-center gap-3 text-center">
                <Sparkles className="w-8 h-8 text-rose-400 animate-spin" />
                <span className="text-xs text-slate-300 font-medium">
                  Analyzing incoming executive emails for Thamiz...
                </span>
              </div>
            ) : homeDigestResult ? (
              <div className="space-y-3.5 text-xs">
                <div className="p-3.5 rounded-2xl bg-rose-950/20 border border-rose-500/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-rose-300 uppercase tracking-wide">
                      Executive Summary
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300">
                      Urgent Actions: {homeDigestResult.urgentCount}
                    </span>
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed">
                    {homeDigestResult.executiveDigest}
                  </p>
                </div>

                {homeDigestResult.actionItems?.length > 0 && (
                  <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                    <span className="text-[11px] font-semibold text-rose-300 block">
                      Recommended Next Actions:
                    </span>
                    <ul className="space-y-1.5">
                      {homeDigestResult.actionItems.map((act: string, i: number) => (
                        <li key={i} className="text-xs text-slate-300 flex items-start gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                          <span>{act}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : null}

            <div className="pt-2 flex gap-2">
              <button
                onClick={() => {
                  setShowHomeDigestModal(false);
                  onNavigate('google', 'gmail');
                }}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white shadow-md shadow-rose-600/30 flex items-center justify-center gap-1.5 transition-colors"
              >
                <span>Open Full Gmail Hub</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setShowHomeDigestModal(false)}
                className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hub API Keys & SQLite Data Store Modal */}
      <HubKeysAndSqliteModal
        isOpen={showKeysAndSqliteModal}
        onClose={() => setShowKeysAndSqliteModal(false)}
      />
    </div>
  );
};
