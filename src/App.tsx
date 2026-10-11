import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { MobileFrame } from './components/MobileFrame';
import { BottomNav, TabKey } from './components/BottomNav';
import { BiometricLock } from './components/BiometricLock';
import { VoiceAssistantModal } from './components/VoiceAssistantModal';
import { AndroidInstallerModal } from './components/AndroidInstallerModal';
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
import { GoogleOneTab } from './components/tabs/GoogleOneTab';
import { SmartDevicesTab } from './components/tabs/SmartDevicesTab';
import { DocsAndDemoTab } from './components/tabs/DocsAndDemoTab';

const AppContent: React.FC = () => {
  const { isAuthenticated } = useApp();
  const [currentTab, setCurrentTab] = useState<TabKey>('home');
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [isInstallerOpen, setIsInstallerOpen] = useState(false);

  // When not authenticated (such as on initial application load/reload), present Google Single Sign-On
  if (!isAuthenticated) {
    return <GoogleSSOScreen />;
  }

  const renderActiveTab = () => {
    switch (currentTab) {
      case 'home':
        return (
          <HomeHubTab
            onNavigate={(tab) => setCurrentTab(tab)}
            onOpenVoice={() => setIsVoiceOpen(true)}
            onOpenInstaller={() => setIsInstallerOpen(true)}
          />
        );
      case 'family':
        return <FamilyTrackerTab />;
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
        return <GoogleOneTab />;
      case 'devices':
        return <SmartDevicesTab />;
      case 'docs':
        return <DocsAndDemoTab onOpenInstaller={() => setIsInstallerOpen(true)} />;
      default:
        return (
          <HomeHubTab
            onNavigate={(tab) => setCurrentTab(tab)}
            onOpenVoice={() => setIsVoiceOpen(true)}
            onOpenInstaller={() => setIsInstallerOpen(true)}
          />
        );
    }
  };

  return (
    <MobileFrame
      onOpenVoice={() => setIsVoiceOpen(true)}
      onOpenInstallerHub={() => setIsInstallerOpen(true)}
    >
      {renderActiveTab()}

      <BottomNav
        currentTab={currentTab}
        onSelectTab={(tab) => setCurrentTab(tab)}
        onOpenVoice={() => setIsVoiceOpen(true)}
      />

      <VoiceAssistantModal
        isOpen={isVoiceOpen}
        onClose={() => setIsVoiceOpen(false)}
      />

      <AndroidInstallerModal
        isOpen={isInstallerOpen}
        onClose={() => setIsInstallerOpen(false)}
      />

      <BiometricLock />
    </MobileFrame>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
