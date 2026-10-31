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
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { PWAInstallButton } from './PWAInstallButton';
import { isOfflineModeSimulated } from '../services/offlineSyncService';

interface MobileFrameProps {
  children: ReactNode;
  onOpenVoice: () => void;
  onOpenVision?: () => void;
  onOpenInstallerHub: () => void;
  onOpenOfflineSyncCenter?: () => void;
  onGoHome: () => void;
}

export const MobileFrame: React.FC<MobileFrameProps> = ({
  children,
  onOpenVoice,
  onOpenVision,
  onOpenInstallerHub,
  onOpenOfflineSyncCenter,
  onGoHome,
}) => {
  const { isMobileDeviceFrame, toggleMobileFrame, isOnline, lockApp, signOutGoogle } = useApp();
  const [offlineSimulated, setOfflineSimulated] = useState(() => isOfflineModeSimulated());

  useEffect(() => {
    const handleOfflineChanged = (e: any) => {
      setOfflineSimulated(!!e.detail?.active);
    };
    window.addEventListener('aura_offline_mode_changed', handleOfflineChanged);
    return () => window.removeEventListener('aura_offline_mode_changed', handleOfflineChanged);
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
            <div
              onClick={onOpenVoice}
              className="cursor-pointer group px-3.5 py-1 rounded-full bg-black border border-slate-800 text-[11px] font-medium text-slate-300 flex items-center gap-1.5 hover:border-indigo-500/50 transition-colors shadow-inner"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] text-indigo-300 font-mono">Aura AI</span>
              <Mic className="w-3 h-3 text-indigo-400 group-hover:scale-110 transition-transform" />
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
    </div>
  );
};
