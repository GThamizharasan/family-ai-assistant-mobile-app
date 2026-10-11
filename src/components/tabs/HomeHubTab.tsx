import React, { useState } from 'react';
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
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { speechEngine } from '../../services/speech';
import { TabKey } from '../BottomNav';

interface HomeHubTabProps {
  onNavigate: (tab: TabKey) => void;
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
  } = useApp();

  const [dailyQuoteSpoken, setDailyQuoteSpoken] = useState(false);

  const activeMilestone = milestones.find((m) => m.status === 'in_progress') || milestones[0];
  const urgentTasks = tasks.filter((t) => t.quadrant === 'urgent-important');
  const familySafeCount = familyMembers.filter((m) => !m.emergencySosActive).length;

  const dailyMotivation = `“Karthik, real wealth is not merely accumulated capital—it is sovereign time, cognitive freedom, and deep harmony across your family lineage. Build your enterprise with relentless precision today, but stay rooted in what truly endures.”`;

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

      {/* Google One Cloud Integration Pill */}
      <div className="flex items-center justify-between text-xs px-1 text-slate-400">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Google One Single Sign-On Active</span>
        </div>
        <div
          onClick={() => onNavigate('google')}
          className="cursor-pointer hover:text-indigo-300 transition-colors flex items-center gap-1"
        >
          <span>{(googleOneStorageUsedGb / 1024).toFixed(1)} TB of 2 TB used</span>
          <ArrowUpRight className="w-3 h-3" />
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

      {/* Quick Launchpad to Companion Features */}
      <div className="grid grid-cols-4 gap-2">
        <button
          onClick={() => onNavigate('writing')}
          className="flex flex-col items-center justify-center p-3 rounded-2xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 transition-all text-center group"
        >
          <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 group-hover:scale-105 transition-transform mb-1.5">
            <PenTool className="w-4 h-4" />
          </div>
          <span className="text-[11px] font-medium text-slate-200">Writing Lab</span>
          <span className="text-[9px] text-slate-500">Tone Coach</span>
        </button>

        <button
          onClick={() => onNavigate('mood')}
          className="flex flex-col items-center justify-center p-3 rounded-2xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 transition-all text-center group"
        >
          <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400 group-hover:scale-105 transition-transform mb-1.5">
            <Smile className="w-4 h-4" />
          </div>
          <span className="text-[11px] font-medium text-slate-200">Mood Log</span>
          <span className="text-[9px] text-slate-500">Mental Health</span>
        </button>

        <button
          onClick={() => onNavigate('productivity')}
          className="flex flex-col items-center justify-center p-3 rounded-2xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 transition-all text-center group"
        >
          <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 group-hover:scale-105 transition-transform mb-1.5">
            <Clock className="w-4 h-4" />
          </div>
          <span className="text-[11px] font-medium text-slate-200">Doc AI</span>
          <span className="text-[9px] text-slate-500">Summarizer</span>
        </button>

        <button
          onClick={() => onNavigate('google')}
          className="flex flex-col items-center justify-center p-3 rounded-2xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 transition-all text-center group"
        >
          <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 group-hover:scale-105 transition-transform mb-1.5">
            <Search className="w-4 h-4" />
          </div>
          <span className="text-[11px] font-medium text-slate-200">Google One</span>
          <span className="text-[9px] text-slate-500">Unified Sync</span>
        </button>
      </div>

      {/* Core Life Pillars Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {/* 1. Billionaire Blueprint Status */}
        <div
          onClick={() => onNavigate('billionaire')}
          className="cursor-pointer group p-4 rounded-3xl bg-slate-900/80 hover:bg-slate-800/80 border border-slate-800 transition-all shadow-md relative overflow-hidden"
        >
          <div className="flex items-center justify-between mb-2.5">
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
          <p className="text-xs text-slate-400 mt-0.5">{activeMilestone.targetValuation}</p>

          <div className="w-full bg-slate-800 rounded-full h-2 mt-3 overflow-hidden">
            <div
              className="bg-gradient-to-r from-amber-500 to-yellow-400 h-2 rounded-full transition-all duration-500"
              style={{ width: `${activeMilestone.progressPercent}%` }}
            />
          </div>
        </div>

        {/* 2. Family Real-Time Radar Snapshot */}
        <div
          onClick={() => onNavigate('family')}
          className="cursor-pointer group p-4 rounded-3xl bg-slate-900/80 hover:bg-slate-800/80 border border-slate-800 transition-all shadow-md"
        >
          <div className="flex items-center justify-between mb-2.5">
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

          <div className="flex items-center gap-2 mt-2">
            <div className="flex -space-x-2">
              {familyMembers.map((m) => (
                <img
                  key={m.id}
                  src={m.avatar}
                  alt={m.name}
                  className="w-8 h-8 rounded-full border-2 border-slate-900 object-cover"
                />
              ))}
            </div>
            <div className="text-xs text-slate-300">
              <span className="font-medium text-white">{familyMembers[1]?.name || 'Family'}</span> is at{' '}
              <span className="text-slate-400">{familyMembers[1]?.liveLocation?.status}</span>
            </div>
          </div>
        </div>

        {/* 3. Financial Net Worth Snapshot */}
        <div
          onClick={() => onNavigate('finance')}
          className="cursor-pointer group p-4 rounded-3xl bg-slate-900/80 hover:bg-slate-800/80 border border-slate-800 transition-all shadow-md"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                <Wallet className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-white">Total Sovereign Net Worth</span>
            </div>
            <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 transition-colors" />
          </div>

          <div className="text-xl font-bold font-mono text-white tracking-tight">
            ${(netWorth / 1000000).toFixed(1)}M
          </div>
          <p className="text-xs text-emerald-400 mt-0.5">+3.4% trailing 24h portfolio gain</p>
        </div>

        {/* 4. Longevity & Sleep Biometrics */}
        <div
          onClick={() => onNavigate('wellness')}
          className="cursor-pointer group p-4 rounded-3xl bg-slate-900/80 hover:bg-slate-800/80 border border-slate-800 transition-all shadow-md"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400">
                <HeartPulse className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-white">Sleep & Longevity Hub</span>
            </div>
            <span className="text-xs font-bold font-mono text-emerald-400">{biometrics.sleepScore} Score</span>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-300 mt-2">
            <span>Resting HR: <strong className="text-white">{biometrics.restingHeartRate} bpm</strong></span>
            <span>HRV: <strong className="text-white">{biometrics.hrvMs} ms</strong></span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Apple Watch Ultra & Oura Ring Synced</p>
        </div>
      </div>

      {/* Eisenhower Urgent Priorities Coach */}
      <div className="p-4 sm:p-5 rounded-3xl bg-slate-900/80 border border-slate-800">
        <div className="flex items-center justify-between mb-3.5">
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
            className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
          >
            All Tasks
          </button>
        </div>

        <div className="space-y-2.5">
          {urgentTasks.length === 0 ? (
            <p className="text-xs text-slate-400 py-2">No urgent tasks remaining. High-leverage execution complete!</p>
          ) : (
            urgentTasks.map((t) => (
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
    </div>
  );
};
