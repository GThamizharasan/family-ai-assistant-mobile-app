import React, { useRef, useState, useEffect } from 'react';
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
  Mail,
  Cctv,
  MessageSquare,
  Phone,
  Sparkles,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Layers,
  X,
  Search,
  ArrowUpRight,
  Shield,
  Smile,
  PenTool,
  HardDrive,
  CreditCard,
  Grid,
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export type TabKey =
  | 'home'
  | 'ibooks'
  | 'ai-studio'
  | 'phone'
  | 'family'
  | 'billionaire'
  | 'finance'
  | 'productivity'
  | 'wellness'
  | 'mood'
  | 'writing'
  | 'vault'
  | 'google'
  | 'devices'
  | 'whatsapp'
  | 'billing'
  | 'docs';

interface BottomNavProps {
  currentTab: TabKey;
  onSelectTab: (tab: TabKey) => void;
  onOpenVoice: () => void;
}

interface TabItem {
  key: TabKey;
  label: string;
  category: 'Core' | 'Intelligence' | 'Family & Safety' | 'Wealth' | 'Lifestyle';
  icon: React.FC<{ className?: string }>;
  badge?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({ currentTab, onSelectTab, onOpenVoice }) => {
  const { tasks, familyMembers, whatsAppContacts } = useApp();
  const leftScrollRef = useRef<HTMLDivElement>(null);
  const rightScrollRef = useRef<HTMLDivElement>(null);

  const [isAllFeaturesSheetOpen, setIsAllFeaturesSheetOpen] = useState(false);
  const [featureSearchQuery, setFeatureSearchQuery] = useState('');

  const emergencyAlertCount = familyMembers.filter((m) => m.emergencySosActive).length;
  const pendingTasksCount = tasks.filter((t) => !t.completed).length;
  const totalUnreadWhatsApp = (whatsAppContacts || []).reduce((sum, c) => sum + c.unreadCount, 0);

  // All 17 Features categorized
  const allTabs: TabItem[] = [
    { key: 'home', label: 'Hub', category: 'Core', icon: Home },
    { key: 'ibooks', label: 'Apple Books', category: 'Intelligence', icon: BookOpen },
    { key: 'ai-studio', label: 'AI Studio', category: 'Intelligence', icon: Sparkles },
    { key: 'whatsapp', label: 'WhatsApp', category: 'Core', icon: MessageSquare, badge: totalUnreadWhatsApp },
    { key: 'family', label: 'Family Radar', category: 'Family & Safety', icon: Users, badge: emergencyAlertCount },
    { key: 'phone', label: 'Phone', category: 'Core', icon: Phone },
    { key: 'google', label: 'Google Suite', category: 'Core', icon: Mail, badge: 3 },
    { key: 'finance', label: 'Wealth', category: 'Wealth', icon: Wallet },
    { key: 'billionaire', label: 'Blueprint', category: 'Wealth', icon: TrendingUp },
    { key: 'productivity', label: 'Tasks', category: 'Lifestyle', icon: CheckSquare, badge: pendingTasksCount },
    { key: 'wellness', label: 'Longevity', category: 'Lifestyle', icon: HeartPulse },
    { key: 'mood', label: 'Mood Journal', category: 'Lifestyle', icon: Smile },
    { key: 'writing', label: 'Writing Coach', category: 'Intelligence', icon: PenTool },
    { key: 'vault', label: 'Memory Vault', category: 'Family & Safety', icon: HardDrive },
    { key: 'devices', label: 'Smart IoT', category: 'Family & Safety', icon: Cctv },
    { key: 'billing', label: 'GCP Billing', category: 'Wealth', icon: CreditCard },
    { key: 'docs', label: 'Docs & Demo', category: 'Core', icon: FileText },
  ];

  // Important features on the LEFT of the Active Realtime Voice Assistant
  const leftTabs: TabItem[] = [
    { key: 'home', label: 'Hub', category: 'Core', icon: Home },
    { key: 'ibooks', label: 'Apple Books', category: 'Intelligence', icon: BookOpen },
    { key: 'ai-studio', label: 'AI Studio', category: 'Intelligence', icon: Sparkles },
    { key: 'whatsapp', label: 'WhatsApp', category: 'Core', icon: MessageSquare, badge: totalUnreadWhatsApp },
    { key: 'phone', label: 'Phone', category: 'Core', icon: Phone },
    { key: 'family', label: 'Family Radar', category: 'Family & Safety', icon: Users, badge: emergencyAlertCount },
  ];

  // Important features on the RIGHT of the Active Realtime Voice Assistant
  const rightTabs: TabItem[] = [
    { key: 'finance', label: 'Wealth', category: 'Wealth', icon: Wallet },
    { key: 'billionaire', label: 'Blueprint', category: 'Wealth', icon: TrendingUp },
    { key: 'google', label: 'Google Suite', category: 'Core', icon: Mail, badge: 3 },
    { key: 'productivity', label: 'Tasks', category: 'Lifestyle', icon: CheckSquare, badge: pendingTasksCount },
    { key: 'wellness', label: 'Longevity', category: 'Lifestyle', icon: HeartPulse },
    { key: 'devices', label: 'Smart IoT', category: 'Family & Safety', icon: Cctv },
  ];

  // Auto-scroll the active tab into view when changed
  useEffect(() => {
    const leftEl = leftScrollRef.current?.querySelector(`[data-tab="${currentTab}"]`) as HTMLElement;
    if (leftEl) {
      leftEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      return;
    }
    const rightEl = rightScrollRef.current?.querySelector(`[data-tab="${currentTab}"]`) as HTMLElement;
    if (rightEl) {
      rightEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [currentTab]);

  const filteredFeatures = allTabs.filter(
    (t) =>
      t.label.toLowerCase().includes(featureSearchQuery.toLowerCase()) ||
      t.category.toLowerCase().includes(featureSearchQuery.toLowerCase())
  );

  const renderTabButton = (tab: TabItem) => {
    const Icon = tab.icon;
    const isActive = currentTab === tab.key;
    return (
      <button
        key={tab.key}
        data-tab={tab.key}
        onClick={() => onSelectTab(tab.key)}
        className={`flex flex-col items-center justify-center min-w-[56px] sm:min-w-[64px] py-1 px-1 rounded-2xl transition-all relative shrink-0 ${
          isActive
            ? 'bg-indigo-600/20 text-indigo-300 font-bold border border-indigo-500/40 shadow-md shadow-indigo-950'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
        }`}
      >
        <div className="relative">
          <Icon className={`w-4 h-4 sm:w-4.5 sm:h-4.5 transition-transform ${isActive ? 'scale-110 text-indigo-400' : ''}`} />
          {!!tab.badge && tab.badge > 0 && (
            <span className="absolute -top-1.5 -right-2 min-w-[14px] h-3.5 px-0.5 rounded-full bg-rose-500 text-[9px] font-bold text-white flex items-center justify-center animate-pulse">
              {tab.badge}
            </span>
          )}
        </div>
        <span className="text-[10px] mt-1 tracking-tight truncate max-w-[56px] sm:max-w-[62px]">
          {tab.label}
        </span>
        {isActive && (
          <span className="w-1.5 h-1 rounded-full bg-indigo-400 absolute bottom-0.5" />
        )}
      </button>
    );
  };

  return (
    <>
      {/* =========================================================================
          SLIDING BOTTOM NAVIGATION DOCK
          1. Important Features on Left
          2. Active Realtime Voice Assistant Always in the Exact Centre
          3. Important Features on Right
          4. All Feature Grid at the Last
          ========================================================================= */}
      <nav
        aria-label="Application Navigation"
        className="fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-2xl border-t border-slate-800/80 px-1 sm:px-3 py-1.5 max-w-lg mx-auto sm:max-w-2xl md:max-w-4xl shadow-2xl transition-all"
      >
        <div className="relative flex items-center h-14 w-full">
          {/* LEFT WING: Important Features Sliding Track */}
          <div
            ref={leftScrollRef}
            className="w-[calc(50%-36px)] flex items-center justify-end gap-1 overflow-x-auto no-scrollbar scroll-smooth py-1 pr-1.5"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {leftTabs.map((tab) => renderTabButton(tab))}
          </div>

          {/* EXACT CENTRE: Active Real-Time Voice Assistant (Always centered) */}
          <div className="w-[72px] shrink-0 flex flex-col items-center justify-center relative z-30">
            <button
              onClick={onOpenVoice}
              className="w-12 h-12 sm:w-13 sm:h-13 -translate-y-3.5 rounded-full bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 text-white flex items-center justify-center shadow-xl shadow-purple-600/40 hover:scale-105 active:scale-95 transition-all ring-4 ring-slate-950 group relative"
              title="Activate Active Real-Time Voice Assistant (AURO)"
            >
              {/* Outer pulsing radar ring */}
              <span className="absolute inset-0 rounded-full bg-pink-500/30 animate-ping pointer-events-none" />
              <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 border-2 border-slate-950" />
              <Mic className="w-5 h-5 sm:w-6 sm:h-6 text-white group-hover:scale-110 transition-transform" />
            </button>
            <span className="text-[9px] font-mono font-bold text-indigo-300 -mt-2.5 tracking-tight uppercase">
              AURO Voice
            </span>
          </div>

          {/* RIGHT WING: Important Features Sliding Track & ALL FEATURE GRID AT THE LAST */}
          <div className="w-[calc(50%-36px)] flex items-center justify-between gap-1 pl-1.5 min-w-0">
            <div
              ref={rightScrollRef}
              className="flex-1 flex items-center justify-start gap-1 overflow-x-auto no-scrollbar scroll-smooth py-1"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              {rightTabs.map((tab) => renderTabButton(tab))}
            </div>

            {/* AT THE LAST: All Feature Grid Button */}
            <div className="shrink-0 pl-1 border-l border-slate-800/80">
              <button
                onClick={() => setIsAllFeaturesSheetOpen(true)}
                className="flex flex-col items-center justify-center py-1 px-1.5 sm:px-2 rounded-2xl text-slate-300 hover:text-white hover:bg-slate-900 border border-slate-800/80 transition-colors"
                title="All 17 Features Grid"
              >
                <Grid className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-indigo-400" />
                <span className="text-[9px] mt-0.5 font-bold tracking-tight text-slate-400 whitespace-nowrap">All Apps</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* =========================================================================
          SLIDE-UP ALL FEATURES DRAWER (CLEAN ORGANIZED APP LAUNCHER)
          Shows all 17 capabilities categorized with quick search
          ========================================================================= */}
      {isAllFeaturesSheetOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-3xl p-5 w-full max-w-xl max-h-[85vh] flex flex-col shadow-2xl relative text-white animate-in slide-in-from-bottom duration-300">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400">
                  <Grid className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">All Features & Applications</h3>
                  <span className="text-[10px] text-slate-400 font-mono">17 Sovereign Modules Available</span>
                </div>
              </div>
              <button
                onClick={() => setIsAllFeaturesSheetOpen(false)}
                className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Search inside features */}
            <div className="relative mb-3">
              <input
                type="text"
                value={featureSearchQuery}
                onChange={(e) => setFeatureSearchQuery(e.target.value)}
                placeholder="Search any feature, book, tool, or command..."
                className="w-full pl-9 pr-4 py-2 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            </div>

            {/* Features Grid categorized */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {['Core', 'Intelligence', 'Family & Safety', 'Wealth', 'Lifestyle'].map((cat) => {
                const categoryTabs = filteredFeatures.filter((t) => t.category === cat);
                if (categoryTabs.length === 0) return null;

                return (
                  <div key={cat} className="space-y-2">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block px-1">
                      {cat}
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {categoryTabs.map((t) => {
                        const Icon = t.icon;
                        const isActive = currentTab === t.key;
                        return (
                          <button
                            key={t.key}
                            onClick={() => {
                              onSelectTab(t.key);
                              setIsAllFeaturesSheetOpen(false);
                            }}
                            className={`p-3 rounded-2xl text-left flex items-start gap-2.5 transition-all ${
                              isActive
                                ? 'bg-indigo-600/20 border border-indigo-500/50 text-white'
                                : 'bg-slate-950/70 hover:bg-slate-850 border border-slate-800/80 text-slate-300 hover:text-white'
                            }`}
                          >
                            <div className={`p-2 rounded-xl shrink-0 ${
                              isActive ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-400'
                            }`}>
                              <Icon className="w-4 h-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <span className="text-xs font-bold block truncate">{t.label}</span>
                              <span className="text-[10px] text-slate-500 truncate block">Launch tab</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
