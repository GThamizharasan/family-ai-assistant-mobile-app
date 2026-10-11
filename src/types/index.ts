export type UserRole = 'primary' | 'secondary';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar: string;
  pinHash?: string;
  isBiometricEnabled: boolean;
  googleOneStorageUsedGb: number;
  googleOneTotalGb: number;
  preferences: {
    voicePitch: number;
    voiceRate: number;
    voiceAccent: string;
    autoSpeechReply: boolean;
    empathyLevel: 'maximum' | 'balanced' | 'pragmatic';
    dailyMotivationTime: string;
    offlineModeOnly: boolean;
  };
}

export interface FamilyMember {
  id: string;
  name: string;
  relationship: 'Self (Head)' | 'Spouse' | 'Eldest Son' | 'Daughter' | 'Parent';
  role: UserRole;
  email: string;
  avatar: string;
  isOnline: boolean;
  liveLocation: {
    lat: number;
    lng: number;
    address: string;
    timestamp: string;
    batteryLevel: number;
    status: 'Safe at Home' | 'At Work / Campus' | 'In Transit' | 'Emergency Alert';
  };
  geofenceStatus: 'home' | 'work' | 'school' | 'transit';
  allowanceMonthly: number;
  monthlySpent: number;
  todayMood: string;
  emergencySosActive: boolean;
  activationCodeUsed?: string;
}

export interface ActivationCode {
  code: string; // 16-digit format XXXX-XXXX-XXXX-XXXX
  createdAt: string;
  expiresAt: string;
  createdBy: string;
  roleGranted: UserRole;
  status: 'active' | 'redeemed' | 'expired';
  redeemedBy?: string;
}

export type EisenhowerQuadrant = 
  | 'urgent-important' 
  | 'important-not-urgent' 
  | 'urgent-not-important' 
  | 'neither';

export interface EisenhowerTask {
  id: string;
  title: string;
  quadrant: EisenhowerQuadrant;
  category: 'Strategic' | 'Finance' | 'Family' | 'Health' | 'Career';
  priority: 'high' | 'medium' | 'low';
  completed: boolean;
  dueDate: string;
  estimatedMinutes: number;
  assignedTo?: string;
}

export interface BillionaireMilestone {
  id: string;
  phase: number;
  phaseTitle: string;
  title: string;
  targetValuation: string;
  description: string;
  progressPercent: number;
  status: 'completed' | 'in_progress' | 'upcoming';
  dailyHabits: string[];
  advisoryRule: string;
  keyMetrics: {
    label: string;
    current: string;
    target: string;
  }[];
}

export interface InvestmentAsset {
  id: string;
  name: string;
  ticker: string;
  category: 'Private Equity' | 'Public Index' | 'Venture Tech' | 'Real Estate' | 'Treasuries';
  value: number;
  allocationPercent: number;
  pnl24h: number;
}

export interface Transaction {
  id: string;
  title: string;
  category: 'Investments' | 'Living & Housing' | 'Family & Kids' | 'Wellness' | 'Business Ops';
  amount: number;
  type: 'income' | 'expense';
  date: string;
  member: string;
}

export interface HealthBiometrics {
  restingHeartRate: number;
  hrvMs: number;
  sleepScore: number;
  totalSleepHours: number;
  deepSleepMinutes: number;
  remSleepMinutes: number;
  lightSleepMinutes: number;
  stepsToday: number;
  activeCalories: number;
  hydrationLiters: number;
  recoveryState: 'Optimal (Green)' | 'Moderate (Yellow)' | 'Rest Required (Orange)';
  connectedWearables: {
    name: string;
    syncedAt: string;
    battery: number;
    status: 'connected' | 'syncing';
  }[];
}

export interface MoodJournalEntry {
  id: string;
  date: string;
  moodScore: number; // 1-10
  emotionName: string;
  sentimentTrend: 'uplifted' | 'stable' | 'stressed' | 'rejuvenated';
  journalNote: string;
  gratitudeReflection: string;
  aiCognitiveReframing: string;
}

export interface EncryptedVaultNote {
  id: string;
  title: string;
  plainSummary: string; // Searchable metadata only
  encryptedPayload: string; // Base64 ciphertext
  iv: string; // Base64 IV
  tag: string; // AES-GCM auth tag or integrated
  category: 'Financial Keys' | 'Family Wills & Health' | 'Strategic IP' | 'Personal Reflections';
  updatedAt: string;
  linkedMemories: string[];
}

export interface UploadedFileDoc {
  id: string;
  name: string;
  sizeKb: number;
  type: string;
  uploadedAt: string;
  summary: string;
  keyTakeaways: string[];
  actionItems: string[];
  extractedEventsCount: number;
}

export interface VoiceMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  emotion?: string;
  actionSuggestion?: string;
}
