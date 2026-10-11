import React, { useState } from 'react';
import { AppProvider } from './context/AppContext';
import { MobileFrame } from './components/MobileFrame';
import { BottomNav, TabKey } from './components/BottomNav';
import { BiometricLock } from './components/BiometricLock';
import { VoiceAssistantModal } from './components/VoiceAssistantModal';

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
import { DocsAndDemoTab } from './components/tabs/DocsAndDemoTab';

const AppContent: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<TabKey>('home');
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);

  const renderActiveTab = () => {
    switch (currentTab) {
      case 'home':
        return (
          <HomeHubTab
            onNavigate={(tab) => setCurrentTab(tab)}
            onOpenVoice={() => setIsVoiceOpen(true)}
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
      case 'docs':
        return <DocsAndDemoTab />;
      default:
        return (
          <HomeHubTab
            onNavigate={(tab) => setCurrentTab(tab)}
            onOpenVoice={() => setIsVoiceOpen(true)}
          />
        );
    }
  };

  return (
    <MobileFrame onOpenVoice={() => setIsVoiceOpen(true)}>
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
