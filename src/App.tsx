import React, { Suspense, useEffect, useState } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { AppProvider, useApp } from './context/AppContext';
import { MobileFrame } from './components/MobileFrame';
import { BottomNav, TabKey } from './components/BottomNav';
import { BiometricLock } from './components/BiometricLock';
import { GoogleSSOScreen } from './components/GoogleSSOScreen';
import { HomeHubTab } from './components/tabs/HomeHubTab';
import { MusicPlayerBar } from './components/music/MusicPlayerBar';
import { ActiveCallModal } from './components/ActiveCallModal';
import { ActiveAlarmModal } from './components/clock/ActiveAlarmModal';
import { ActiveReminderModal } from './components/clock/ActiveReminderModal';
import type { ActiveServiceTab } from './components/tabs/GoogleOneTab';
import { Alarm, ClockReminder } from './types/clock';
import {
  checkDueReminders,
  triggerReminderNotification,
  completeReminder,
  snoozeReminder,
} from './services/reminderDriveSync';
import { TransportMode } from './types/mapNavigation';

// Helper for clean code-split React.lazy named exports (drastically shrinks Android & Web startup bundle)
function lazyNamed<T extends React.ComponentType<any>>(
  loader: () => Promise<Record<string, any>>,
  exportName: string
) {
  return React.lazy(() => loader().then((mod) => ({ default: mod[exportName] as T })));
}

// Lazy-loaded Tabs (on-demand async chunks)
const FamilyTrackerTab = lazyNamed(() => import('./components/tabs/FamilyTrackerTab'), 'FamilyTrackerTab');
const BillionaireBlueprintTab = lazyNamed(() => import('./components/tabs/BillionaireBlueprintTab'), 'BillionaireBlueprintTab');
const FinanceHubTab = lazyNamed(() => import('./components/tabs/FinanceHubTab'), 'FinanceHubTab');
const ProductivityTab = lazyNamed(() => import('./components/tabs/ProductivityTab'), 'ProductivityTab');
const HealthWellnessTab = lazyNamed(() => import('./components/tabs/HealthWellnessTab'), 'HealthWellnessTab');
const MoodJournalTab = lazyNamed(() => import('./components/tabs/MoodJournalTab'), 'MoodJournalTab');
const WritingCoachTab = lazyNamed(() => import('./components/tabs/WritingCoachTab'), 'WritingCoachTab');
const MemoryVaultTab = lazyNamed(() => import('./components/tabs/MemoryVaultTab'), 'MemoryVaultTab');
const GoogleOneTab = lazyNamed(() => import('./components/tabs/GoogleOneTab'), 'GoogleOneTab');
const SmartDevicesTab = lazyNamed(() => import('./components/tabs/SmartDevicesTab'), 'SmartDevicesTab');
const DocsAndDemoTab = lazyNamed(() => import('./components/tabs/DocsAndDemoTab'), 'DocsAndDemoTab');
const WhatsAppTab = lazyNamed(() => import('./components/tabs/WhatsAppTab'), 'WhatsAppTab');
const PhoneDialerTab = lazyNamed(() => import('./components/tabs/PhoneDialerTab'), 'PhoneDialerTab');
const GcpBillingDashboard = lazyNamed(() => import('./components/tabs/GcpBillingDashboard'), 'GcpBillingDashboard');
const AiStudioTab = lazyNamed(() => import('./components/tabs/AiStudioTab'), 'AiStudioTab');
const IBooksLibraryTab = lazyNamed(() => import('./components/tabs/IBooksLibraryTab'), 'IBooksLibraryTab');
const MusicLibraryTab = lazyNamed(() => import('./components/tabs/MusicLibraryTab'), 'MusicLibraryTab');
const VoiceMemosTab = lazyNamed(() => import('./components/tabs/VoiceMemosTab'), 'VoiceMemosTab');
const TextToSpeechTab = lazyNamed(() => import('./components/tabs/TextToSpeechTab'), 'TextToSpeechTab');
const RealtimeSttTab = lazyNamed(() => import('./components/tabs/RealtimeSttTab'), 'RealtimeSttTab');
const RealtimeTranslatorTab = lazyNamed(() => import('./components/tabs/RealtimeTranslatorTab'), 'RealtimeTranslatorTab');
const AdobeScannerTab = lazyNamed(() => import('./components/tabs/AdobeScannerTab'), 'AdobeScannerTab');
const ClockTab = lazyNamed(() => import('./components/tabs/ClockTab'), 'ClockTab');
const NavigationTab = lazyNamed(() => import('./components/tabs/NavigationTab'), 'NavigationTab');
const WeatherForecastTab = lazyNamed(() => import('./components/tabs/WeatherForecastTab'), 'WeatherForecastTab');
const AdaptiveLearningTab = lazyNamed(() => import('./components/tabs/AdaptiveLearningTab'), 'AdaptiveLearningTab');
const LanguageTutorTab = lazyNamed(() => import('./components/tabs/LanguageTutorTab'), 'LanguageTutorTab');
const MediaLibraryTab = lazyNamed(() => import('./components/tabs/MediaLibraryTab'), 'MediaLibraryTab');

// Lazy-loaded Heavy Modals (loaded only when opened)
const VoiceAssistantModal = lazyNamed(() => import('./components/VoiceAssistantModal'), 'VoiceAssistantModal');
const AndroidInstallerModal = lazyNamed(() => import('./components/AndroidInstallerModal'), 'AndroidInstallerModal');
const WindowsSystemInstallerModal = lazyNamed(() => import('./components/WindowsSystemInstallerModal'), 'WindowsSystemInstallerModal');
const AppleMusicPlayerModal = lazyNamed(() => import('./components/music/AppleMusicPlayerModal'), 'AppleMusicPlayerModal');
const AuroVisionModal = lazyNamed(() => import('./components/vision/AuroVisionModal'), 'AuroVisionModal');
const OfflineSyncCenterModal = lazyNamed(() => import('./components/OfflineSyncCenterModal'), 'OfflineSyncCenterModal');
const CustomGoogleMapModal = lazyNamed(() => import('./components/maps/CustomGoogleMapModal'), 'CustomGoogleMapModal');
const FeverTemperatureModal = lazyNamed(() => import('./components/health/FeverTemperatureModal'), 'FeverTemperatureModal');
const GlobalUniversalSearchModal = lazyNamed(() => import('./components/GlobalUniversalSearchModal'), 'GlobalUniversalSearchModal');
const SmartAiDocumentHubModal = lazyNamed(() => import('./components/SmartAiDocumentHubModal'), 'SmartAiDocumentHubModal');

const TabLoadingFallback: React.FC = () => (
  <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-300">
    <div className="w-9 h-9 rounded-full border-2 border-cyan-400/30 border-t-cyan-400 animate-spin" />
    <span className="text-xs font-mono text-slate-400">Loading studio module...</span>
  </div>
);

const AppContent: React.FC = () => {
  const { isAuthenticated } = useApp();
  const [currentTab, setCurrentTab] = useState<TabKey>('home');
  const [googleSubTab, setGoogleSubTab] = useState<ActiveServiceTab>('overview');
  const [activeWhatsAppContactId, setActiveWhatsAppContactId] = useState<string | undefined>(undefined);
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [isVisionOpen, setIsVisionOpen] = useState(false);
  const [isInstallerOpen, setIsInstallerOpen] = useState(false);
  const [isWindowsInstallerOpen, setIsWindowsInstallerOpen] = useState(false);
  const [isMusicPlayerOpen, setIsMusicPlayerOpen] = useState(false);
  const [isOfflineSyncCenterOpen, setIsOfflineSyncCenterOpen] = useState(false);
  const [isUniversalSearchOpen, setIsUniversalSearchOpen] = useState(false);
  const [isSmartDocHubOpen, setIsSmartDocHubOpen] = useState(false);
  const [smartDocInitialType, setSmartDocInitialType] = useState<
    'receipt_warranty' | 'prescription_lab'
  >('receipt_warranty');
  const [ringingAlarm, setRingingAlarm] = useState<Alarm | null>(null);

  // Global Ctrl+K / Cmd+K shortcut + custom event hooks for Search & Smart AI Document Hub
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsUniversalSearchOpen((prev) => !prev);
      }
    };
    const onOpenSmartDocEvent = (ev: Event) => {
      const docType = (ev as CustomEvent)?.detail?.docType;
      if (docType === 'prescription_lab' || docType === 'receipt_warranty') {
        setSmartDocInitialType(docType);
      }
      setIsSmartDocHubOpen(true);
    };
    const onOpenSearchEvent = () => setIsUniversalSearchOpen(true);

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('aura_open_smart_doc_hub', onOpenSmartDocEvent);
    window.addEventListener('aura_open_universal_search', onOpenSearchEvent);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('aura_open_smart_doc_hub', onOpenSmartDocEvent);
      window.removeEventListener('aura_open_universal_search', onOpenSearchEvent);
    };
  }, []);
  const [activeDueReminder, setActiveDueReminder] = useState<ClockReminder | null>(null);

  // Custom Google Maps & Offline Navigation Modal State
  const [isCustomMapOpen, setIsCustomMapOpen] = useState(false);
  const [customMapOptions, setCustomMapOptions] = useState<{
    origin?: { name: string; lat: number; lng: number };
    destination?: { name: string; lat: number; lng: number };
    mode?: TransportMode;
    autoStart?: boolean;
  }>({});
  const [gmpQuotaNotice, setGmpQuotaNotice] = useState<string | null>(null);

  // Fever Temperature Tracker & Doctor Report Modal State
  const [isFeverModalOpen, setIsFeverModalOpen] = useState(false);
  const [feverModalOptions, setFeverModalOptions] = useState<{
    memberId?: string;
    temperatureF?: number;
    autoLogOpen?: boolean;
    autoPrint?: boolean;
  }>({});

  // Google Maps Platform Quota Defense Listener
  useEffect(() => {
    const handleQuotaExceeded = (e: any) => {
      console.warn('[GMP] Quota or Auth Notice:', e?.detail);
      setGmpQuotaNotice(
        e?.detail?.message || 'Google Maps Platform daily quota reached. Offline simulation mode active.'
      );
    };
    window.addEventListener('gmp-quota-exceeded', handleQuotaExceeded);
    return () => window.removeEventListener('gmp-quota-exceeded', handleQuotaExceeded);
  }, []);

  // Global Alarm & Due Reminder Tick Check
  useEffect(() => {
    let lastCheckedMinute = '';
    const interval = setInterval(() => {
      try {
        const now = new Date();
        const currentMinute = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        const currentDay = now.getDay(); // 0-6

        // 1. Check Due Reminders
        const dueReminders = checkDueReminders();
        if (dueReminders.length > 0 && !activeDueReminder) {
          const firstDue = dueReminders[0];
          triggerReminderNotification(firstDue);
          setActiveDueReminder(firstDue);
        }

        if (currentMinute === lastCheckedMinute) return;

        // 2. Check Alarms
        const raw = localStorage.getItem('aura_alarms_v1');
        if (!raw) return;
        const alarms: Alarm[] = JSON.parse(raw);

        for (const a of alarms) {
          if (!a.enabled) continue;
          if (a.time === currentMinute) {
            const matchesDay = a.repeatDays.length === 0 || a.repeatDays.includes(currentDay);
            if (matchesDay) {
              lastCheckedMinute = currentMinute;
              setRingingAlarm(a);
              break;
            }
          }
        }
      } catch {}
    }, 1000);

    return () => clearInterval(interval);
  }, [activeDueReminder]);

  const handleStopAlarm = () => {
    setRingingAlarm(null);
  };

  const handleSnoozeAlarm = (alarm: Alarm) => {
    setRingingAlarm(null);
    const snoozeMins = alarm.snoozeMinutes || 9;
    setTimeout(() => {
      setRingingAlarm(alarm);
    }, snoozeMins * 60 * 1000);
  };

  const handleCompleteReminder = (rem: ClockReminder) => {
    setActiveDueReminder(null);
    void completeReminder(rem.id);
  };

  const handleSnoozeReminder = (rem: ClockReminder, mins = 10) => {
    setActiveDueReminder(null);
    void snoozeReminder(rem.id, mins);
  };

  const handleDismissReminder = () => {
    setActiveDueReminder(null);
  };

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    void StatusBar.setOverlaysWebView({ overlay: false });
    void StatusBar.setBackgroundColor({ color: '#090d16' });
    void StatusBar.setStyle({ style: Style.Light });
    void StatusBar.show();
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let listener: { remove: () => Promise<void> } | undefined;
    let disposed = false;

    void CapacitorApp.addListener('backButton', () => {
      if (isVoiceOpen) {
        setIsVoiceOpen(false);
      } else if (isInstallerOpen) {
        setIsInstallerOpen(false);
      } else if (currentTab !== 'home') {
        setCurrentTab('home');
      } else {
        void CapacitorApp.exitApp();
      }
    }).then((handle) => {
      if (disposed) {
        void handle.remove();
      } else {
        listener = handle;
      }
    });

    return () => {
      disposed = true;
      void listener?.remove();
    };
  }, [currentTab, isInstallerOpen, isVoiceOpen]);

  // When not authenticated (such as on initial application load/reload), present Google Single Sign-On
  if (!isAuthenticated) {
    return <GoogleSSOScreen />;
  }

  const handleNavigate = (
    tab: TabKey,
    subTab?: 'overview' | 'gmail' | 'drive' | 'calendar' | 'googleone' | 'gcp-billing' | 'settings',
    contactId?: string
  ) => {
    if (subTab) {
      setGoogleSubTab(subTab);
    }
    if (contactId) {
      setActiveWhatsAppContactId(contactId);
    }
    setCurrentTab(tab);
  };

  const renderActiveTab = () => {
    switch (currentTab) {
      case 'home':
        return (
          <HomeHubTab
            onNavigate={handleNavigate}
            onOpenVoice={() => setIsVoiceOpen(true)}
            onOpenVision={() => setIsVisionOpen(true)}
            onOpenInstaller={() => setIsInstallerOpen(true)}
          />
        );
      case 'adaptive-learning':
        return <AdaptiveLearningTab />;
      case 'language-tutor':
        return <LanguageTutorTab />;
      case 'media-library':
        return <MediaLibraryTab />;
      case 'weather':
        return (
          <WeatherForecastTab
            onNavigateHome={() => setCurrentTab('home')}
            onNavigateMap={() => setCurrentTab('navigation')}
            onNavigateWellness={() => setCurrentTab('wellness')}
          />
        );
      case 'navigation':
        return <NavigationTab onNavigateHome={() => setCurrentTab('home')} />;
      case 'ibooks':
        return <IBooksLibraryTab />;
      case 'music':
        return <MusicLibraryTab onOpenPlayer={() => setIsMusicPlayerOpen(true)} />;
      case 'memos':
        return <VoiceMemosTab />;
      case 'tts':
        return <TextToSpeechTab />;
      case 'stt':
        return <RealtimeSttTab />;
      case 'scanner':
        return <AdobeScannerTab />;
      case 'translate':
        return <RealtimeTranslatorTab />;
      case 'clock':
        return <ClockTab />;
      case 'ai-studio':
        return <AiStudioTab onOpenVoiceAssistant={() => setIsVoiceOpen(true)} />;
      case 'family':
        return <FamilyTrackerTab />;
      case 'phone':
        return <PhoneDialerTab />;
      case 'whatsapp':
        return (
          <WhatsAppTab
            initialContactId={activeWhatsAppContactId}
            onOpenVoice={() => setIsVoiceOpen(true)}
          />
        );
      case 'billionaire':
        return <BillionaireBlueprintTab />;
      case 'finance':
        return <FinanceHubTab />;
      case 'productivity':
        return <ProductivityTab />;
      case 'wellness':
        return <HealthWellnessTab />;
      case 'mood':
        return <MoodJournalTab />;
      case 'writing':
        return <WritingCoachTab />;
      case 'vault':
        return <MemoryVaultTab />;
      case 'google':
        return (
          <GoogleOneTab
            initialSubTab={googleSubTab}
            onSelectSubTab={(st: ActiveServiceTab) => setGoogleSubTab(st)}
          />
        );
      case 'devices':
        return <SmartDevicesTab />;
      case 'billing':
        return <GcpBillingDashboard />;
      case 'docs':
        return <DocsAndDemoTab onOpenInstaller={() => setIsInstallerOpen(true)} />;
      default:
        return (
          <HomeHubTab
            onNavigate={handleNavigate}
            onOpenVoice={() => setIsVoiceOpen(true)}
            onOpenVision={() => setIsVisionOpen(true)}
            onOpenInstaller={() => setIsInstallerOpen(true)}
          />
        );
    }
  };

  return (
    <MobileFrame
      currentTab={currentTab}
      onOpenVoice={() => setIsVoiceOpen(true)}
      onOpenVision={() => setIsVisionOpen(true)}
      onOpenInstallerHub={() => setIsInstallerOpen(true)}
      onOpenWindowsInstaller={() => setIsWindowsInstallerOpen(true)}
      onOpenOfflineSyncCenter={() => setIsOfflineSyncCenterOpen(true)}
      onOpenUniversalSearch={() => setIsUniversalSearchOpen(true)}
      onOpenSmartDocs={(docType) => {
        setSmartDocInitialType(docType || 'receipt_warranty');
        setIsSmartDocHubOpen(true);
      }}
      onOpenWalkingSteps={() => setCurrentTab('wellness')}
      onOpenWeather={() => setCurrentTab('weather')}
      onGoHome={() => setCurrentTab('home')}
    >
      <Suspense fallback={<TabLoadingFallback />}>{renderActiveTab()}</Suspense>

      {/* Floating Mini Player Bar across all tabs */}
      <MusicPlayerBar onOpenFullPlayer={() => setIsMusicPlayerOpen(true)} />

      <BottomNav
        currentTab={currentTab}
        onSelectTab={(tab) => setCurrentTab(tab)}
        onOpenVoice={() => setIsVoiceOpen(true)}
        onOpenVision={() => setIsVisionOpen(true)}
        onOpenOfflineSyncCenter={() => setIsOfflineSyncCenterOpen(true)}
      />

      {/* Lazy-Loaded Modals — chunks are fetched ONLY when opened! */}
      <Suspense fallback={null}>
        {isMusicPlayerOpen && (
          <AppleMusicPlayerModal
            isOpen={isMusicPlayerOpen}
            onClose={() => setIsMusicPlayerOpen(false)}
          />
        )}

        {isVoiceOpen && (
          <VoiceAssistantModal
            isOpen={isVoiceOpen}
            onClose={() => setIsVoiceOpen(false)}
            onOpenVision={() => {
              setIsVoiceOpen(false);
              setIsVisionOpen(true);
            }}
            onGoHome={() => {
              setIsVoiceOpen(false);
              setCurrentTab('home');
            }}
            onNavigateTab={(tab: TabKey, subTab?: string) => {
              setIsVoiceOpen(false);
              handleNavigate(tab, subTab as any);
            }}
            onOpenMusicPlayer={() => {
              setIsVoiceOpen(false);
              setIsMusicPlayerOpen(true);
            }}
            onOpenOfflineSync={() => {
              setIsVoiceOpen(false);
              setIsOfflineSyncCenterOpen(true);
            }}
            onOpenCustomMap={(opts?: any) => {
              setIsVoiceOpen(false);
              setCustomMapOptions({
                destination: opts?.destination ? { name: opts.destination, lat: 13.0823, lng: 80.2755 } : undefined,
                origin: opts?.origin ? { name: opts.origin, lat: 13.0827, lng: 80.2707 } : undefined,
                mode: opts?.mode,
                autoStart: opts?.autoStart,
              });
              setIsCustomMapOpen(true);
            }}
            onOpenFeverTracker={(opts?: any) => {
              setIsVoiceOpen(false);
              setFeverModalOptions({
                memberId: opts?.memberId,
                temperatureF: opts?.temperatureF,
                autoLogOpen: opts?.autoLog,
                autoPrint: opts?.autoPrint,
              });
              setIsFeverModalOpen(true);
            }}
          />
        )}

        {isFeverModalOpen && (
          <FeverTemperatureModal
            isOpen={isFeverModalOpen}
            onClose={() => setIsFeverModalOpen(false)}
            selectedMemberId={feverModalOptions.memberId}
            initialTempF={feverModalOptions.temperatureF}
            autoLogOpen={feverModalOptions.autoLogOpen}
            autoPrint={feverModalOptions.autoPrint}
          />
        )}

        {isCustomMapOpen && (
          <CustomGoogleMapModal
            isOpen={isCustomMapOpen}
            onClose={() => setIsCustomMapOpen(false)}
            initialOrigin={customMapOptions.origin}
            initialDestination={customMapOptions.destination}
            initialMode={customMapOptions.mode}
            autoStartNavigation={customMapOptions.autoStart}
          />
        )}

        {isVisionOpen && (
          <AuroVisionModal
            isOpen={isVisionOpen}
            onClose={() => setIsVisionOpen(false)}
          />
        )}

        {isInstallerOpen && (
          <AndroidInstallerModal
            isOpen={isInstallerOpen}
            onClose={() => setIsInstallerOpen(false)}
            onGoHome={() => {
              setIsInstallerOpen(false);
              setCurrentTab('home');
            }}
          />
        )}

        {isWindowsInstallerOpen && (
          <WindowsSystemInstallerModal
            isOpen={isWindowsInstallerOpen}
            onClose={() => setIsWindowsInstallerOpen(false)}
          />
        )}

        {isOfflineSyncCenterOpen && (
          <OfflineSyncCenterModal
            isOpen={isOfflineSyncCenterOpen}
            onClose={() => setIsOfflineSyncCenterOpen(false)}
            onNavigateTab={handleNavigate}
          />
        )}

        {isUniversalSearchOpen && (
          <GlobalUniversalSearchModal
            isOpen={isUniversalSearchOpen}
            onClose={() => setIsUniversalSearchOpen(false)}
            onNavigateTab={(tab: TabKey, subTab?: any) => handleNavigate(tab, subTab)}
            onOpenSmartDocModal={(docType: 'receipt_warranty' | 'prescription_lab') => {
              setSmartDocInitialType(docType);
              setIsSmartDocHubOpen(true);
            }}
          />
        )}

        {isSmartDocHubOpen && (
          <SmartAiDocumentHubModal
            isOpen={isSmartDocHubOpen}
            initialDocType={smartDocInitialType}
            onClose={() => setIsSmartDocHubOpen(false)}
          />
        )}
      </Suspense>

      {/* Google Maps Platform Quota Notice Banner */}
      {gmpQuotaNotice && (
        <div className="fixed top-4 left-4 right-4 z-50 max-w-md mx-auto p-3 rounded-2xl bg-amber-950/90 border border-amber-600/50 text-amber-200 text-xs shadow-2xl backdrop-blur-md flex items-center justify-between gap-2 animate-in fade-in slide-in-from-top-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping shrink-0" />
            <span className="font-medium">{gmpQuotaNotice}</span>
          </div>
          <button
            onClick={() => setGmpQuotaNotice(null)}
            className="text-amber-400 hover:text-white font-bold text-sm px-1.5 py-0.5 rounded-lg hover:bg-amber-900/40"
          >
            ✕
          </button>
        </div>
      )}

      {/* Global Ringing Active Alarm Modal */}
      <ActiveAlarmModal
        ringingAlarm={ringingAlarm}
        onStop={handleStopAlarm}
        onSnooze={handleSnoozeAlarm}
      />

      {/* Global On-Time Ringing Active Reminder Modal */}
      <ActiveReminderModal
        reminder={activeDueReminder}
        onComplete={handleCompleteReminder}
        onSnooze={handleSnoozeReminder}
        onDismiss={handleDismissReminder}
      />

      <ActiveCallModal />

      <BiometricLock />
    </MobileFrame>
  );
};

import { GoogleOAuthProvider } from '@react-oauth/google';

export default function App() {
  const googleClientId =
    (typeof window !== 'undefined' ? localStorage.getItem('aura_google_client_id') : null) ||
    (import.meta.env.VITE_GOOGLE_CLIENT_ID as string) ||
    '600050762948-bqe3traltdnne31fmu99p1hn9n1ubgb8.apps.googleusercontent.com';

  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </GoogleOAuthProvider>
  );
}
