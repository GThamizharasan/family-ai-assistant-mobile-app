import React, { ReactNode } from 'react';
import {
  Smartphone,
  Maximize2,
  Lock,
  Wifi,
  WifiOff,
  Battery,
  Mic,
  Download,
  LogOut,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { PWAInstallButton } from './PWAInstallButton';

interface MobileFrameProps {
  children: ReactNode;
  onOpenVoice: () => void;
  onOpenInstallerHub: () => void;
}

export const MobileFrame: React.FC<MobileFrameProps> = ({
  children,
  onOpenVoice,
  onOpenInstallerHub,
}) => {
  const { isMobileDeviceFrame, toggleMobileFrame, isOnline, lockApp, signOutGoogle } = useApp();

  const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-start p-0 sm:py-6 selection:bg-indigo-500/30">
      {/* Top Floating Utility Control Bar */}
      <header className="w-full max-w-lg mb-3 px-3 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span className="font-semibold text-slate-200">AuraFamily Life OS</span>
          <span className="text-[10px] text-slate-500 font-mono">v2.4 Sovereign</span>
        </div>

        <div className="flex items-center gap-2">
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
            : 'max-w-2xl px-3 sm:px-0'
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
              {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5 text-rose-400" />}
              <span className="text-[11px] font-mono">5G</span>
              <div className="flex items-center text-[11px] font-mono">
                <span>94%</span>
                <Battery className="w-3.5 h-3.5 ml-0.5 text-emerald-400" />
              </div>
            </div>
          </div>
        )}

        {/* Content Body */}
        <main className={`w-full ${isMobileDeviceFrame ? 'px-4' : ''}`}>
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
