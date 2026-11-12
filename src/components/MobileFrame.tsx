import React, { ReactNode, useState, useEffect } from 'react';
import {
  Home,
  Smartphone,
  Maximize2,
  Lock,
  Wifi,
  WifiOff,
  Battery,
  Mic,
  Download,
  LogOut,
  Eye,
  Database,
  Footprints,
  Cpu,
  Sparkles,
  Zap,
  Terminal,
  CloudSun,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { PWAInstallButton } from './PWAInstallButton';
import { isOfflineModeSimulated } from '../services/offlineSyncService';
import { getLocalWalkingStepLogs } from '../services/walkingStepsDriveSync';
import { getCachedWeatherData } from '../services/weatherService';
import { AiProvider } from '../types';
import {
  getActiveAiProvider,
  getActiveAiModel,
  getModelDisplayName,
  SUPPORTED_AI_PROVIDERS,
  AI_MODEL_CHANGED_EVENT,
} from '../services/aiConfig';
import { AiModelConfigModal } from './AiModelConfigModal';

interface MobileFrameProps {
  children: ReactNode;
  onOpenVoice: () => void;
  onOpenVision?: () => void;
  onOpenInstallerHub: () => void;
  onOpenWindowsInstaller?: () => void;
  onOpenOfflineSyncCenter?: () => void;
  onOpenWalkingSteps?: () => void;
  onOpenWeather?: () => void;
  onGoHome: () => void;
}

export const MobileFrame: React.FC<MobileFrameProps> = ({
  children,
  onOpenVoice,
  onOpenVision,
  onOpenInstallerHub,
  onOpenWindowsInstaller,
  onOpenOfflineSyncCenter,
  onOpenWalkingSteps,
  onOpenWeather,
  onGoHome,
}) => {
  const { isMobileDeviceFrame, toggleMobileFrame, isOnline, lockApp, signOutGoogle } = useApp();
  const [offlineSimulated, setOfflineSimulated] = useState(() => isOfflineModeSimulated());
  const [liveStepsToday, setLiveStepsToday] = useState<number>(() => {
    const logs = getLocalWalkingStepLogs();
    const todayStr = new Date().toISOString().split('T')[0];
    const todayLogs = logs.filter((l) => l.timestamp.startsWith(todayStr));
    return todayLogs.reduce((acc, l) => acc + l.steps, 0);
  });
  const [isActivelyWalking, setIsActivelyWalking] = useState(false);
  const [isBackgroundActive, setIsBackgroundActive] = useState(false);

  // Global AI Model & Provider state for the Main Top Bar
  const [activeProvider, setActiveProvider] = useState<AiProvider>(() => getActiveAiProvider());
  const [activeModel, setActiveModel] = useState<string>(() => getActiveAiModel());
  const [showAiModelModal, setShowAiModelModal] = useState(false);
  const [topWeather, setTopWeather] = useState(() => getCachedWeatherData());

  useEffect(() => {
    const handleOfflineChanged = (e: any) => {
      setOfflineSimulated(!!e.detail?.active);
    };

    const handleModelChanged = (e: any) => {
      if (e.detail?.provider) {
        setActiveProvider(e.detail.provider);
        setActiveModel(e.detail.model);
      }
    };

    const handleStepTick = (e: any) => {
      if (e.detail?.totalTodaySteps !== undefined) {
        setLiveStepsToday(e.detail.totalTodaySteps);
        setIsActivelyWalking(!!e.detail.isWalking);
        if (e.detail.isBackgroundActive !== undefined) {
          setIsBackgroundActive(!!e.detail.isBackgroundActive);
        }
      }
    };

    const handleLogsChanged = () => {
      const logs = getLocalWalkingStepLogs();
      const todayStr = new Date().toISOString().split('T')[0];
      const todayLogs = logs.filter((l) => l.timestamp.startsWith(todayStr));
      setLiveStepsToday(todayLogs.reduce((acc, l) => acc + l.steps, 0));
    };

    window.addEventListener('aura_offline_mode_changed', handleOfflineChanged);
    window.addEventListener('aura_realtime_step_tick', handleStepTick);
    window.addEventListener('aura_steps_logs_changed', handleLogsChanged);
    window.addEventListener(AI_MODEL_CHANGED_EVENT, handleModelChanged);

    return () => {
      window.removeEventListener('aura_offline_mode_changed', handleOfflineChanged);
      window.removeEventListener('aura_realtime_step_tick', handleStepTick);
      window.removeEventListener('aura_steps_logs_changed', handleLogsChanged);
      window.removeEventListener(AI_MODEL_CHANGED_EVENT, handleModelChanged);
    };
  }, []);

  const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-start p-0 sm:py-6 selection:bg-indigo-500/30">
      {/* Top Floating Utility Control Bar */}
      <header className="sticky top-0 z-40 w-full max-w-lg mb-3 px-3 pt-[env(safe-area-inset-top)] flex items-center justify-between text-xs text-slate-400 bg-slate-950/95 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <img
            src="/app-logo.png"
            alt="Aura Logo"
            className="w-5 h-5 rounded-full object-cover border border-amber-500/40 shadow-sm"
          />
          <span className="font-semibold text-slate-200">AuraFamily Life OS</span>
          <span className="text-[10px] text-slate-500 font-mono">v2.4 Sovereign</span>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={onGoHome}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-800 transition-colors cursor-pointer shadow-sm active:scale-95"
            title="Go to Home Hub"
            aria-label="Go to Home"
          >
            <Home className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-[11px] font-semibold">Home</span>
          </button>

          {/* Main Top Bar AI Model Switcher / Indicator Pill */}
          <button
            onClick={() => setShowAiModelModal(true)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border transition-all cursor-pointer shadow-sm active:scale-95 font-semibold text-[11px] ${
              activeProvider === 'nvidia'
                ? 'bg-[#76B900]/15 text-[#76B900] border-[#76B900]/40 hover:bg-[#76B900]/25'
                : activeProvider === 'openai'
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/25'
                : activeProvider === 'anthropic'
                ? 'bg-amber-500/15 text-amber-300 border-amber-500/40 hover:bg-amber-500/25'
                : activeProvider === 'custom'
                ? 'bg-sky-500/15 text-sky-300 border-sky-500/40 hover:bg-sky-500/25'
                : 'bg-indigo-500/15 text-indigo-300 border-indigo-500/40 hover:bg-indigo-500/25'
            }`}
            title={`Active AI Model: ${activeProvider.toUpperCase()} - ${getModelDisplayName(activeProvider, activeModel)} (Tap to configure any AI model)`}
            aria-label="Active AI Model Switcher"
          >
            <span className="text-xs">{SUPPORTED_AI_PROVIDERS.find((p) => p.id === activeProvider)?.icon || '✦'}</span>
            <span className="font-mono truncate max-w-[70px] sm:max-w-[110px]">
              {getModelDisplayName(activeProvider, activeModel)}
            </span>
            <span className="text-[9px] opacity-70">▾</span>
          </button>

          {/* Quick Weather Forecast Button */}
          {onOpenWeather && (
            <button
              onClick={onOpenWeather}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 hover:text-white border border-sky-500/40 transition-all cursor-pointer shadow-sm active:scale-95 font-semibold text-[11px]"
              title={`Live Weather Forecast: ${topWeather ? `${topWeather.current.temperature}°C (${topWeather.locationName})` : 'Check Forecast'}`}
              aria-label="Open Weather Forecast"
            >
              <CloudSun className="w-3.5 h-3.5 text-sky-400" />
              <span>{topWeather ? `${topWeather.current.temperature}°C` : 'Weather'}</span>
            </button>
          )}

          {/* Windows Host System & Installer Assistant */}
          {onOpenWindowsInstaller && (
            <button
              onClick={onOpenWindowsInstaller}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 hover:text-white border border-cyan-500/40 transition-all cursor-pointer shadow-sm active:scale-95 font-semibold text-[11px]"
              title="Auro Windows Host System Assistant & Software Installer (Winget, Choco, PowerShell)"
              aria-label="Open Windows System Assistant"
            >
              <Terminal className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">Windows Host</span>
            </button>
          )}

          {/* 3GB SQLite Offline Store Sync Center */}
          {onOpenOfflineSyncCenter && (
            <button
              onClick={onOpenOfflineSyncCenter}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 hover:text-white border border-amber-500/40 transition-all cursor-pointer shadow-sm active:scale-95 font-semibold text-[11px]"
              title="3GB SQLite Offline Store & Unified Sync Center"
              aria-label="Open 3GB SQLite Offline Store"
            >
              <Database className="w-3.5 h-3.5 text-amber-400" />
              <span>3GB Store</span>
            </button>
          )}

          {/* Real-time Mobile Walking Steps Pedometer */}
          {onOpenWalkingSteps && (
            <button
              onClick={onOpenWalkingSteps}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 hover:text-white border border-emerald-500/40 transition-all cursor-pointer shadow-sm active:scale-95 font-semibold text-[11px]"
              title="Realtime Walking Steps (Device Motion Pedometer & SQLite/Drive Sync)"
              aria-label="Open Realtime Walking Steps"
            >
              <Footprints className={`w-3.5 h-3.5 text-emerald-400 ${isActivelyWalking ? 'animate-bounce' : ''}`} />
              <span className="tabular-nums font-mono">{liveStepsToday.toLocaleString()}</span>
            </button>
          )}

          {/* Auro Vision Launcher Button for Blind / Low-Vision Guide */}
          {onOpenVision && (
            <button
              onClick={onOpenVision}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 hover:text-white border border-amber-500/40 transition-all cursor-pointer shadow-sm active:scale-95 font-semibold text-[11px]"
              title="Auro Computer Vision Guide for Blind and Low-Vision Assistance"
              aria-label="Open Auro Vision Assistant"
            >
              <Eye className="w-3.5 h-3.5 text-amber-400" />
              <span>Vision</span>
            </button>
          )}

          {/* Install Android APK Button */}
          <PWAInstallButton onOpenInstallerHub={onOpenInstallerHub} />

          {/* Toggle Device Frame */}
          <button
            onClick={toggleMobileFrame}
            className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors"
            title="Toggle between Native Phone Frame and Full Screen"
          >
            {isMobileDeviceFrame ? <Maximize2 className="w-3.5 h-3.5" /> : <Smartphone className="w-3.5 h-3.5" />}
            <span className="text-[11px]">{isMobileDeviceFrame ? 'Full Screen' : 'Phone Frame'}</span>
          </button>

          {/* Quick Lock */}
          <button
            onClick={lockApp}
            className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors"
            title="Lock with Biometrics"
          >
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
          </button>

          {/* Google Sign Out */}
          <button
            onClick={signOutGoogle}
            className="p-1.5 rounded-xl bg-slate-900 hover:bg-rose-950/60 text-slate-300 hover:text-rose-400 border border-slate-800 hover:border-rose-500/40 transition-colors"
            title="Sign Out of Google SSO"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Main Container: Mobile Frame or Responsive Layout */}
      <div
        className={`w-full transition-all duration-300 ${
          isMobileDeviceFrame
            ? 'max-w-[430px] rounded-[52px] border-[10px] border-slate-800/90 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] bg-slate-950 overflow-hidden relative min-h-[890px] ring-1 ring-slate-700/50'
            : 'max-w-2xl px-3 sm:px-0 relative min-h-[850px]'
        }`}
      >
        {/* Native Mobile Status Bar (Visible in phone frame) */}
        {isMobileDeviceFrame && (
          <div className="pt-3 px-7 pb-2 flex items-center justify-between text-[13px] font-semibold text-slate-200 select-none bg-slate-950/90 sticky top-0 z-30">
            <span>{currentTime}</span>

            {/* Dynamic Island Pill */}
            <div className="flex items-center gap-1.5">
              <div
                onClick={onOpenVoice}
                className="cursor-pointer group px-3.5 py-1 rounded-full bg-black border border-slate-800 text-[11px] font-medium text-slate-300 flex items-center gap-1.5 hover:border-indigo-500/50 transition-colors shadow-inner"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] text-indigo-300 font-mono">Aura AI</span>
                <Mic className="w-3 h-3 text-indigo-400 group-hover:scale-110 transition-transform" />
              </div>

              {/* Real-Time Live Steps Pill */}
              <div
                onClick={onOpenWalkingSteps}
                className="cursor-pointer px-2.5 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-500/30 text-[10px] font-mono text-emerald-300 flex items-center gap-1 hover:border-emerald-400 transition-colors shadow-inner"
                title={`Real-Time Mobile Pedometer (Tap to View)${isBackgroundActive ? ' · Pocket Mode Active Behind the Scenes' : ''}`}
              >
                {isBackgroundActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" title="Tracking behind the scenes" />
                )}
                <Footprints className={`w-3 h-3 text-emerald-400 ${isActivelyWalking ? 'animate-bounce' : ''}`} />
                <span className="tabular-nums font-semibold">{liveStepsToday.toLocaleString()}</span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-slate-400">
              {offlineSimulated ? (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30">
                  OFFLINE
                </span>
              ) : isOnline ? (
                <Wifi className="w-3.5 h-3.5" />
              ) : (
                <WifiOff className="w-3.5 h-3.5 text-rose-400" />
              )}
              <span className="text-[11px] font-mono">5G</span>
              <div className="flex items-center text-[11px] font-mono">
                <span>94%</span>
                <Battery className="w-3.5 h-3.5 ml-0.5 text-emerald-400" />
              </div>
            </div>
          </div>
        )}

        {/* Content Body */}
        <main className={`w-full app-content ${isMobileDeviceFrame ? 'px-4' : ''}`}>
          {children}
        </main>

        {/* Mobile Home Bar Indicator (Visible in phone frame) */}
        {isMobileDeviceFrame && (
          <div className="h-4 bg-slate-950 flex items-center justify-center sticky bottom-0 z-40">
            <div className="w-32 h-1 rounded-full bg-slate-700" />
          </div>
        )}
      </div>

      {/* Global AI Model Selector & Configuration Modal */}
      <AiModelConfigModal
        isOpen={showAiModelModal}
        onClose={() => setShowAiModelModal(false)}
      />
    </div>
  );
};
