import React, { useEffect, useState } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { AppProvider, useApp } from './context/AppContext';
import { MobileFrame } from './components/MobileFrame';
import { BottomNav, TabKey } from './components/BottomNav';
import { BiometricLock } from './components/BiometricLock';
import { VoiceAssistantModal } from './components/VoiceAssistantModal';
import { AndroidInstallerModal } from './components/AndroidInstallerModal';
import { WindowsSystemInstallerModal } from './components/WindowsSystemInstallerModal';
import { GoogleSSOScreen } from './components/GoogleSSOScreen';

// Tabs
import { HomeHubTab } from './components/tabs/HomeHubTab';
import { FamilyTrackerTab } from './components/tabs/FamilyTrackerTab';
import { BillionaireBlueprintTab } from './components/tabs/BillionaireBlueprintTab';
import { FinanceHubTab } from './components/tabs/FinanceHubTab';
import { ProductivityTab } from './components/tabs/ProductivityTab';
import { HealthWellnessTab } from './components/tabs/HealthWellnessTab';
import { MoodJournalTab } from './components/tabs/MoodJournalTab';
import { WritingCoachTab } from './components/tabs/WritingCoachTab';
import { MemoryVaultTab } from './components/tabs/MemoryVaultTab';
import { GoogleOneTab, ActiveServiceTab } from './components/tabs/GoogleOneTab';
import { SmartDevicesTab } from './components/tabs/SmartDevicesTab';
import { DocsAndDemoTab } from './components/tabs/DocsAndDemoTab';
import { WhatsAppTab } from './components/tabs/WhatsAppTab';
import { PhoneDialerTab } from './components/tabs/PhoneDialerTab';
import { GcpBillingDashboard } from './components/tabs/GcpBillingDashboard';
import { AiStudioTab } from './components/tabs/AiStudioTab';
import { IBooksLibraryTab } from './components/tabs/IBooksLibraryTab';
import { MusicLibraryTab } from './components/tabs/MusicLibraryTab';
import { VoiceMemosTab } from './components/tabs/VoiceMemosTab';
import { TextToSpeechTab } from './components/tabs/TextToSpeechTab';
import { RealtimeSttTab } from './components/tabs/RealtimeSttTab';
import { RealtimeTranslatorTab } from './components/tabs/RealtimeTranslatorTab';
import { AdobeScannerTab } from './components/tabs/AdobeScannerTab';
import { ClockTab } from './components/tabs/ClockTab';
import { NavigationTab } from './components/tabs/NavigationTab';
import { WeatherForecastTab } from './components/tabs/WeatherForecastTab';
import { MusicPlayerBar } from './components/music/MusicPlayerBar';
import { AppleMusicPlayerModal } from './components/music/AppleMusicPlayerModal';
import { ActiveCallModal } from './components/ActiveCallModal';
import { AuroVisionModal } from './components/vision/AuroVisionModal';
import { ActiveAlarmModal } from './components/clock/ActiveAlarmModal';
import { ActiveReminderModal } from './components/clock/ActiveReminderModal';
import { OfflineSyncCenterModal } from './components/OfflineSyncCenterModal';
import { Alarm, ClockReminder } from './types/clock';
import {
  checkDueReminders,
  triggerReminderNotification,
  completeReminder,
  snoozeReminder,
} from './services/reminderDriveSync';
import { CustomGoogleMapModal } from './components/maps/CustomGoogleMapModal';
import { FeverTemperatureModal } from './components/health/FeverTemperatureModal';
import { TransportMode } from './types/mapNavigation';

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
  const [ringingAlarm, setRingingAlarm] = useState<Alarm | null>(null);
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
            onSelectSubTab={(st) => setGoogleSubTab(st)}
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
      onOpenVoice={() => setIsVoiceOpen(true)}
      onOpenVision={() => setIsVisionOpen(true)}
      onOpenInstallerHub={() => setIsInstallerOpen(true)}
      onOpenWindowsInstaller={() => setIsWindowsInstallerOpen(true)}
      onOpenOfflineSyncCenter={() => setIsOfflineSyncCenterOpen(true)}
      onOpenWalkingSteps={() => setCurrentTab('wellness')}
      onOpenWeather={() => setCurrentTab('weather')}
      onGoHome={() => setCurrentTab('home')}
    >
      {renderActiveTab()}

      {/* Floating Mini Player Bar across all tabs */}
      <MusicPlayerBar onOpenFullPlayer={() => setIsMusicPlayerOpen(true)} />

      <BottomNav
        currentTab={currentTab}
        onSelectTab={(tab) => setCurrentTab(tab)}
        onOpenVoice={() => setIsVoiceOpen(true)}
        onOpenVision={() => setIsVisionOpen(true)}
        onOpenOfflineSyncCenter={() => setIsOfflineSyncCenterOpen(true)}
      />

      {/* Apple Music Full Screen Modal */}
      <AppleMusicPlayerModal
        isOpen={isMusicPlayerOpen}
        onClose={() => setIsMusicPlayerOpen(false)}
      />

      {/* Auro Voice Assistant Modal */}
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
        onNavigateTab={(tab, subTab) => {
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
        onOpenCustomMap={(opts) => {
          setIsVoiceOpen(false);
          setCustomMapOptions({
            destination: opts?.destination ? { name: opts.destination, lat: 13.0823, lng: 80.2755 } : undefined,
            origin: opts?.origin ? { name: opts.origin, lat: 13.0827, lng: 80.2707 } : undefined,
            mode: opts?.mode,
            autoStart: opts?.autoStart,
          });
          setIsCustomMapOpen(true);
        }}
        onOpenFeverTracker={(opts) => {
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

      {/* Clinical Fever Temperature & Doctor Report Modal */}
      <FeverTemperatureModal
        isOpen={isFeverModalOpen}
        onClose={() => setIsFeverModalOpen(false)}
        selectedMemberId={feverModalOptions.memberId}
        initialTempF={feverModalOptions.temperatureF}
        autoLogOpen={feverModalOptions.autoLogOpen}
        autoPrint={feverModalOptions.autoPrint}
      />

      {/* Custom Google Maps & Multi-Modal Offline Navigation Modal */}
      <CustomGoogleMapModal
        isOpen={isCustomMapOpen}
        onClose={() => setIsCustomMapOpen(false)}
        initialOrigin={customMapOptions.origin}
        initialDestination={customMapOptions.destination}
        initialMode={customMapOptions.mode}
        autoStartNavigation={customMapOptions.autoStart}
      />

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

      {/* Auro Computer Vision Modal for Blind & Low-Vision Users */}
      <AuroVisionModal
        isOpen={isVisionOpen}
        onClose={() => setIsVisionOpen(false)}
      />

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

      <AndroidInstallerModal
        isOpen={isInstallerOpen}
        onClose={() => setIsInstallerOpen(false)}
        onGoHome={() => {
          setIsInstallerOpen(false);
          setCurrentTab('home');
        }}
      />

      {/* Auro Windows Host System & Software Installer Modal */}
      <WindowsSystemInstallerModal
        isOpen={isWindowsInstallerOpen}
        onClose={() => setIsWindowsInstallerOpen(false)}
      />

      {/* 3GB SQLite Offline Store & Unified Sync Center */}
      <OfflineSyncCenterModal
        isOpen={isOfflineSyncCenterOpen}
        onClose={() => setIsOfflineSyncCenterOpen(false)}
        onNavigateTab={handleNavigate}
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
