import React from 'react';
import {
  Home,
  Users,
  TrendingUp,
  Wallet,
  CheckSquare,
  HeartPulse,
  Lock,
  FileText,
  Mic,
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export type TabKey =
  | 'home'
  | 'family'
  | 'billionaire'
  | 'finance'
  | 'productivity'
  | 'wellness'
  | 'mood'
  | 'writing'
  | 'vault'
  | 'google'
  | 'docs';

interface BottomNavProps {
  currentTab: TabKey;
  onSelectTab: (tab: TabKey) => void;
  onOpenVoice: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ currentTab, onSelectTab, onOpenVoice }) => {
  const { tasks, familyMembers } = useApp();

  const emergencyAlertCount = familyMembers.filter((m) => m.emergencySosActive).length;
  const pendingTasksCount = tasks.filter((t) => !t.completed).length;

  const mainTabs: { key: TabKey; label: string; icon: React.FC<{ className?: string }>; badge?: number }[] = [
    { key: 'home', label: 'Hub', icon: Home },
    { key: 'family', label: 'Family', icon: Users, badge: emergencyAlertCount },
    { key: 'billionaire', label: 'Billionaire', icon: TrendingUp },
    { key: 'finance', label: 'Wealth', icon: Wallet },
    { key: 'productivity', label: 'Tasks', icon: CheckSquare, badge: pendingTasksCount },
    { key: 'wellness', label: 'Health', icon: HeartPulse },
    { key: 'vault', label: 'Vault', icon: Lock },
    { key: 'docs', label: 'PRD & Tour', icon: FileText },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-slate-950/90 backdrop-blur-xl border-t border-slate-800/80 px-2 py-2 max-w-lg mx-auto sm:max-w-2xl md:max-w-4xl">
      <div className="flex items-center justify-around gap-1 relative">
        {mainTabs.slice(0, 4).map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => onSelectTab(tab.key)}
              className={`flex-1 flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all relative ${
                isActive ? 'text-indigo-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110' : ''}`} />
                {!!tab.badge && tab.badge > 0 && (
                  <span className="absolute -top-1 -right-1.5 min-w-[14px] h-3.5 px-0.5 rounded-full bg-rose-500 text-[9px] font-bold text-white flex items-center justify-center animate-pulse">
                    {tab.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] mt-1 tracking-tight">{tab.label}</span>
              {isActive && (
                <span className="w-1 h-1 rounded-full bg-indigo-500 absolute bottom-0.5" />
              )}
            </button>
          );
        })}

        {/* Floating Center Voice Mic Button */}
        <div className="relative -top-5 px-1">
          <button
            onClick={onOpenVoice}
            className="w-12 h-12 rounded-full bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 text-white flex items-center justify-center shadow-lg shadow-indigo-500/40 hover:scale-105 active:scale-95 transition-all ring-4 ring-slate-950"
            title="Open Real-Time Voice Assistant"
          >
            <Mic className="w-6 h-6 animate-pulse" />
          </button>
        </div>

        {mainTabs.slice(4).map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => onSelectTab(tab.key)}
              className={`flex-1 flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all relative ${
                isActive ? 'text-indigo-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110' : ''}`} />
                {!!tab.badge && tab.badge > 0 && (
                  <span className="absolute -top-1 -right-1.5 min-w-[14px] h-3.5 px-0.5 rounded-full bg-indigo-500 text-[9px] font-bold text-white flex items-center justify-center">
                    {tab.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] mt-1 tracking-tight">{tab.label}</span>
              {isActive && (
                <span className="w-1 h-1 rounded-full bg-indigo-500 absolute bottom-0.5" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
