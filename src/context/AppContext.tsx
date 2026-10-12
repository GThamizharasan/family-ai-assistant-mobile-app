import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  UserProfile,
  UserRole,
  FamilyMember,
  ActivationCode,
  EisenhowerTask,
  BillionaireMilestone,
  InvestmentAsset,
  Transaction,
  HealthBiometrics,
  MoodJournalEntry,
  EncryptedVaultNote,
  UploadedFileDoc,
  VoiceMessage,
  GoogleWorkspaceSettings,
} from '../types';
import { encryptText, decryptText } from '../services/crypto';
import {
  googleSignIn,
  logoutGoogle,
  initAuth,
  getAccessToken,
  setCachedAccessToken,
} from '../services/googleAuth';
import {
  GoogleDriveFile,
  GoogleEmailMessage,
  GoogleStorageQuota,
  FALLBACK_GMAIL_MESSAGES,
  FALLBACK_DRIVE_FILES,
  DEFAULT_2TB_QUOTA,
  fetchGoogleDriveFiles,
  fetchGmailMessages,
  fetchGoogleDriveStorageQuota,
} from '../services/googleWorkspace';

interface AppContextType {
  // Google Single Sign-On (SSO) & Session
  isAuthenticated: boolean;
  googleAccessToken: string | null;
  isGoogleConnected: boolean;
  isSyncingGoogle: boolean;
  liveEmails: GoogleEmailMessage[];
  liveDriveFiles: GoogleDriveFile[];
  liveStorageQuota: GoogleStorageQuota;
  syncLiveGoogleData: () => Promise<void>;
  signInWithGoogleOAuth: () => Promise<boolean>;
  loginWithGoogle: (email?: string, name?: string, role?: UserRole) => void;
  loginWithActivationCode: (code: string) => { success: boolean; message: string };
  signOutGoogle: () => void;
  requireGoogleAuthOnReload: boolean;
  setRequireGoogleAuthOnReload: (val: boolean) => void;
  googleWorkspaceSettings: GoogleWorkspaceSettings;
  updateGoogleWorkspaceSettings: (partial: Partial<GoogleWorkspaceSettings>) => void;
  user: UserProfile;
  role: UserRole;
  isLocked: boolean;
  unlockWithBiometrics: () => boolean;
  unlockWithPin: (pin: string) => boolean;
  lockApp: () => void;
  setRole: (role: UserRole) => void;
  // Family
  familyMembers: FamilyMember[];
  activationCodes: ActivationCode[];
  generateActivationCode: (roleGranted?: UserRole) => string;
  redeemActivationCode: (code: string, memberName: string, relationship: string) => { success: boolean; message: string };
  triggerEmergencySos: (memberId: string) => void;
  clearEmergencySos: (memberId: string) => void;
  updateMemberAllowance: (memberId: string, allowance: number) => void;
  // Tasks (Eisenhower)
  tasks: EisenhowerTask[];
  addTask: (task: Omit<EisenhowerTask, 'id'>) => void;
  toggleTask: (id: string) => void;
  deleteTask: (id: string) => void;
  // Billionaire Blueprint
  milestones: BillionaireMilestone[];
  toggleHabit: (milestoneId: string, habitIndex: number) => void;
  updateMilestoneProgress: (id: string, progress: number) => void;
  // Finance
  netWorth: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  portfolio: InvestmentAsset[];
  transactions: Transaction[];
  addTransaction: (tx: Omit<Transaction, 'id'>) => void;
  // Health & Sleep
  biometrics: HealthBiometrics;
  updateBiometrics: (partial: Partial<HealthBiometrics>) => void;
  // Mood Journal
  moodEntries: MoodJournalEntry[];
  addMoodEntry: (entry: Omit<MoodJournalEntry, 'id'>) => void;
  // Encrypted Vault
  vaultNotes: EncryptedVaultNote[];
  addVaultNote: (title: string, content: string, category: EncryptedVaultNote['category']) => Promise<void>;
  decryptVaultNote: (note: EncryptedVaultNote) => Promise<string>;
  deleteVaultNote: (id: string) => void;
  // Documents
  storedDocs: UploadedFileDoc[];
  addStoredDoc: (doc: Omit<UploadedFileDoc, 'id'>) => void;
  // Voice & Chat
  chatHistory: VoiceMessage[];
  addVoiceMessage: (msg: Omit<VoiceMessage, 'id'>) => void;
  clearChatHistory: () => void;
  // Google One & Sync
  isOnline: boolean;
  googleOneStorageUsedGb: number;
  syncStatus: 'synced' | 'syncing' | 'offline';
  syncWithGoogleOne: () => Promise<void>;
  // View mode
  isMobileDeviceFrame: boolean;
  toggleMobileFrame: () => void;
  // Demo Tour
  isDemoTourActive: boolean;
  startDemoTour: () => void;
  stopDemoTour: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// Initial Seed Data
const INITIAL_USER: UserProfile = {
  id: 'usr-primary-001',
  name: 'Thamiz',
  email: 'digitaltamilworld@gmail.com',
  role: 'primary',
  avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  isBiometricEnabled: true,
  pinHash: '1234',
  googleOneStorageUsedGb: 142.8,
  googleOneTotalGb: 2048, // 2 TB Google One plan
  preferences: {
    voicePitch: 1.05,
    voiceRate: 0.98,
    voiceAccent: 'warm-empathetic',
    autoSpeechReply: true,
    empathyLevel: 'maximum',
    dailyMotivationTime: '06:30 AM',
    offlineModeOnly: false,
  },
};

const INITIAL_FAMILY: FamilyMember[] = [
  {
    id: 'fam-01',
    name: 'Thamiz (Primary)',
    relationship: 'Self (Head)',
    role: 'primary',
    email: 'digitaltamilworld@gmail.com',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    isOnline: true,
    liveLocation: {
      lat: 13.0827,
      lng: 80.2707,
      address: 'Innovation Campus, Chennai / Global Family Office',
      timestamp: 'Just now',
      batteryLevel: 94,
      status: 'Safe at Home',
    },
    geofenceStatus: 'home',
    allowanceMonthly: 25000,
    monthlySpent: 8400,
    todayMood: 'Laser Focused & Energized ⚡',
    emergencySosActive: false,
  },
  {
    id: 'fam-02',
    name: 'Selvapriya (Spouse)',
    relationship: 'Spouse',
    role: 'secondary',
    email: 'selvapriya.family@gmail.com',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
    isOnline: true,
    liveLocation: {
      lat: 13.0418,
      lng: 80.2341,
      address: 'Wellness & Design Center, T. Nagar',
      timestamp: '2 mins ago',
      batteryLevel: 82,
      status: 'At Work / Campus',
    },
    geofenceStatus: 'work',
    allowanceMonthly: 15000,
    monthlySpent: 6200,
    todayMood: 'Calm & Creative ✨',
    emergencySosActive: false,
    activationCodeUsed: '8492-7104-9932-1845',
  },
  {
    id: 'fam-03',
    name: 'Maaran (Son)',
    relationship: 'Eldest Son',
    role: 'secondary',
    email: 'maaran.k@gmail.com',
    avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80',
    isOnline: true,
    liveLocation: {
      lat: 13.0112,
      lng: 80.2337,
      address: 'Robotics & STEM Lab, IIT Madras',
      timestamp: '5 mins ago',
      batteryLevel: 67,
      status: 'At Work / Campus',
    },
    geofenceStatus: 'school',
    allowanceMonthly: 4000,
    monthlySpent: 1850,
    todayMood: 'Curious & Inquisitive 🔬',
    emergencySosActive: false,
    activationCodeUsed: '4190-2856-7719-3320',
  },
];

const INITIAL_CODES: ActivationCode[] = [
  {
    code: '8492-7104-9932-1845',
    createdAt: '2026-10-01',
    expiresAt: '2026-12-31',
    createdBy: 'digitaltamilworld@gmail.com',
    roleGranted: 'secondary',
    status: 'redeemed',
    redeemedBy: 'selvapriya.family@gmail.com',
  },
  {
    code: '4190-2856-7719-3320',
    createdAt: '2026-10-05',
    expiresAt: '2026-12-31',
    createdBy: 'digitaltamilworld@gmail.com',
    roleGranted: 'secondary',
    status: 'redeemed',
    redeemedBy: 'maaran.k@gmail.com',
  },
  {
    code: '9021-4873-1129-8834',
    createdAt: '2026-10-10',
    expiresAt: '2026-11-10',
    createdBy: 'digitaltamilworld@gmail.com',
    roleGranted: 'secondary',
    status: 'active',
  },
];

const INITIAL_TASKS: EisenhowerTask[] = [
  {
    id: 'task-1',
    title: 'Review Term Sheet for AI Infrastructure Holding Co ($12M Round)',
    quadrant: 'urgent-important',
    category: 'Strategic',
    priority: 'high',
    completed: false,
    dueDate: 'Today, 2:00 PM',
    estimatedMinutes: 45,
  },
  {
    id: 'task-2',
    title: 'Automate Q4 Family Trust & High-Yield Reinvestment Allocation',
    quadrant: 'important-not-urgent',
    category: 'Finance',
    priority: 'high',
    completed: false,
    dueDate: 'Tomorrow',
    estimatedMinutes: 30,
  },
  {
    id: 'task-3',
    title: 'Family Wellness & Deep Work Boundaries Weekly Sync',
    quadrant: 'important-not-urgent',
    category: 'Family',
    priority: 'medium',
    completed: true,
    dueDate: 'Saturday',
    estimatedMinutes: 60,
  },
  {
    id: 'task-4',
    title: 'Review Maaran Robotics Club equipment allowance request',
    quadrant: 'urgent-not-important',
    category: 'Family',
    priority: 'medium',
    completed: false,
    dueDate: 'Today',
    estimatedMinutes: 15,
  },
  {
    id: 'task-5',
    title: 'Organize Uncategorized Google Drive Receipts into Tax Vault',
    quadrant: 'neither',
    category: 'Finance',
    priority: 'low',
    completed: false,
    dueDate: 'Next Week',
    estimatedMinutes: 20,
  },
];

const INITIAL_BILLIONAIRE_MILESTONES: BillionaireMilestone[] = [
  {
    id: 'bm-1',
    phase: 1,
    phaseTitle: 'Phase 1: Foundation & High-Leverage Cash Engine ($1M - $10M)',
    title: 'High-Margin Cash-Flow Engine & Sovereign Skill Monopoly',
    targetValuation: '$10,000,000 Net Asset Value',
    description: 'Master asymmetric technical leadership, build automated distribution, and establish $100k+/month free cash flow baseline.',
    progressPercent: 92,
    status: 'completed',
    advisoryRule: 'Never trade time for linear wages. Build digital assets that work while you sleep.',
    dailyHabits: [
      '3 hours deep creative focus before checking inbox',
      'Acquire 1 high-leverage compound skill daily',
      'Daily 0-expense friction audit',
    ],
    keyMetrics: [
      { label: 'Monthly Recurring Cashflow', current: '$145,000', target: '$100,000' },
      { label: 'Liquid Capital Base', current: '$4.2M', target: '$5.0M' },
    ],
  },
  {
    id: 'bm-2',
    phase: 2,
    phaseTitle: 'Phase 2: Enterprise Scalability & Product-Market Monopoly ($10M - $100M)',
    title: 'Defensible IP, Network Effects & Enterprise Valuation Compounding',
    targetValuation: '$100,000,000 Enterprise Value',
    description: 'Construct compounding software & hardware platforms with switching costs, high gross margins (80%+), and global distribution.',
    progressPercent: 68,
    status: 'in_progress',
    advisoryRule: 'Valuation is a derivative of pricing power and sustained structural defensibility.',
    dailyHabits: [
      'Track customer lifetime value to CAC ratio (>6x)',
      'Review proprietary algorithmic moats & patent filings',
      'Audit leadership bench & delegation protocols',
    ],
    keyMetrics: [
      { label: 'Enterprise ARR Run Rate', current: '$18.4M', target: '$25.0M' },
      { label: 'EBITDA Margin', current: '38%', target: '45%' },
      { label: 'Entity Valuation', current: '$68.0M', target: '$100.0M' },
    ],
  },
  {
    id: 'bm-3',
    phase: 3,
    phaseTitle: 'Phase 3: Conglomerate Holding & Asymmetric Capital Allocation ($100M - $500M)',
    title: 'Private Equity Roll-ups & Holding Company Architecture',
    targetValuation: '$500,000,000 Conglomerate AUM',
    description: 'Deploy Buffett-style holding company mechanics. Acquire cash-generative niche leaders and reinvest cash into exponential technologies.',
    progressPercent: 24,
    status: 'upcoming',
    advisoryRule: 'Rule #1: Never lose capital. Rule #2: Maximize re-investment rate at high return on invested capital (ROIC).',
    dailyHabits: [
      'Analyze M&A pipeline deals with 3x upside asymmetry',
      'Preserve 20% liquid opportunistic war chest',
      'Weekly meeting with global strategic co-investors',
    ],
    keyMetrics: [
      { label: 'Holding Subsidiaries', current: '3 Entities', target: '8 Entities' },
      { label: 'Average ROIC', current: '29%', target: '35%' },
    ],
  },
  {
    id: 'bm-4',
    phase: 4,
    phaseTitle: 'Phase 4: Sovereign Scale & Frontier Monopolies ($500M - $1B+)',
    title: 'The Billion-Dollar Threshold & Institutional Immortality',
    targetValuation: '$1,000,000,000+ Sovereign Valuation',
    description: 'Cross the billion-dollar boundary through sovereign infrastructure, AI foundation systems, and intergenerational family office governance.',
    progressPercent: 8,
    status: 'upcoming',
    advisoryRule: 'True wealth is sovereign autonomy, multigenerational impact, and civilizational leverage.',
    dailyHabits: [
      'Govern family trust charter and ethical guardrails',
      'Direct philanthropic endowment into clean energy & education',
      'Mentor next-generation family stewards',
    ],
    keyMetrics: [
      { label: 'Consolidated Net Worth', current: '$78.5M', target: '$1,000.0M' },
      { label: 'Sovereign Impact Endowment', current: '$2.5M', target: '$50.0M' },
    ],
  },
];

const INITIAL_PORTFOLIO: InvestmentAsset[] = [
  { id: 'ast-1', name: 'Aura AI Technologies (Founder Equity)', ticker: 'PRIVATE', category: 'Private Equity', value: 62000000, allocationPercent: 78.9, pnl24h: 3.4 },
  { id: 'ast-2', name: 'Global Tech Moats (NVDA, GOOG, ASML, MSFT)', ticker: 'EQUITIES', category: 'Public Index', value: 8500000, allocationPercent: 10.8, pnl24h: 1.2 },
  { id: 'ast-3', name: 'Prime Commercial & Data Infrastructure', ticker: 'REIT-HQ', category: 'Real Estate', value: 5200000, allocationPercent: 6.6, pnl24h: 0.1 },
  { id: 'ast-4', name: 'Liquid US Treasuries & Short Yields', ticker: 'UST-YIELD', category: 'Treasuries', value: 2800000, allocationPercent: 3.7, pnl24h: 0.05 },
];

const INITIAL_TRANSACTIONS: Transaction[] = [
  { id: 'tx-1', title: 'Enterprise AI Licensing Revenue Dividend', category: 'Investments', amount: 38500, type: 'income', date: 'Oct 09', member: 'Thamiz' },
  { id: 'tx-2', title: 'Family Healthcare & Longevity Protocol Retainer', category: 'Wellness', amount: 1800, type: 'expense', date: 'Oct 08', member: 'Thamiz' },
  { id: 'tx-3', title: 'STEM & Robotics Lab Annual Tuition/Kit', category: 'Family & Kids', amount: 1200, type: 'expense', date: 'Oct 07', member: 'Maaran' },
  { id: 'tx-4', title: 'Automated High-Yield Index Sweep (Re-invest)', category: 'Investments', amount: 15000, type: 'expense', date: 'Oct 05', member: 'System Auto' },
];

const INITIAL_BIOMETRICS: HealthBiometrics = {
  restingHeartRate: 54,
  hrvMs: 78,
  sleepScore: 91,
  totalSleepHours: 7.8,
  deepSleepMinutes: 114,
  remSleepMinutes: 98,
  lightSleepMinutes: 256,
  stepsToday: 11420,
  activeCalories: 640,
  hydrationLiters: 2.8,
  recoveryState: 'Optimal (Green)',
  connectedWearables: [
    { name: 'Apple Watch Ultra 2', syncedAt: '1 min ago', battery: 88, status: 'connected' },
    { name: 'Oura Ring Gen 3 (Titanium)', syncedAt: 'Just now', battery: 94, status: 'connected' },
    { name: 'Garmin Forerunner', syncedAt: '12 mins ago', battery: 76, status: 'connected' },
  ],
};

const INITIAL_MOODS: MoodJournalEntry[] = [
  {
    id: 'm-1',
    date: '2026-10-10',
    moodScore: 9,
    emotionName: 'Empowered & Serene',
    sentimentTrend: 'uplifted',
    journalNote: 'Closed the quarterly enterprise roadmap review with absolute clarity. Spending time with Selvapriya and Maaran grounded my purpose.',
    gratitudeReflection: 'Grateful for health, sharp mental faculty, and a supportive, united family.',
    aiCognitiveReframing: 'Your alignment of family harmony with high-stakes execution creates an antifragile psychological fortress.',
  },
  {
    id: 'm-2',
    date: '2026-10-09',
    moodScore: 8,
    emotionName: 'Focused',
    sentimentTrend: 'stable',
    journalNote: 'Long technical review of model distillation pipelines. High cognitive load but energizing.',
    gratitudeReflection: 'Deep gratitude for continuous learning and autonomy.',
    aiCognitiveReframing: 'Cognitive intensity followed by deep sleep accelerates neuroplasticity and strategic intuition.',
  },
];

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Option: Require Google SSO on every reload (defaults to false for seamless launching)
  const [requireGoogleAuthOnReload, setRequireGoogleAuthOnReloadState] = useState<boolean>(() => {
    const saved = localStorage.getItem('aura_require_google_auth_reload');
    return saved !== null ? saved === 'true' : false;
  });

  // Track authentication state: if requireGoogleAuthOnReload is explicitly true, reload prompts Google SSO; otherwise auto-launches as Thamiz
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    const savedRequire = localStorage.getItem('aura_require_google_auth_reload');
    const mustRequire = savedRequire === 'true';
    if (mustRequire) {
      return false;
    }
    return true;
  });

  const setRequireGoogleAuthOnReload = (val: boolean) => {
    setRequireGoogleAuthOnReloadState(val);
    localStorage.setItem('aura_require_google_auth_reload', String(val));
  };

  // Google Workspace Connected Services Settings
  const [googleWorkspaceSettings, setGoogleWorkspaceSettings] = useState<GoogleWorkspaceSettings>(() => {
    const saved = localStorage.getItem('aura_workspace_settings');
    return saved
      ? JSON.parse(saved)
      : {
          gmailEnabled: true,
          driveEnabled: true,
          calendarEnabled: true,
          googleOneBackupEnabled: true,
          autoSyncCalendarToTasks: true,
          autoSummarizeUnreadEmails: true,
        };
  });

  const updateGoogleWorkspaceSettings = (partial: Partial<GoogleWorkspaceSettings>) => {
    setGoogleWorkspaceSettings((prev) => {
      const next = { ...prev, ...partial };
      localStorage.setItem('aura_workspace_settings', JSON.stringify(next));
      return next;
    });
  };

  // In-memory access token for Google Workspace APIs (Drive, Gmail, Calendar)
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null);
  const [liveEmails, setLiveEmails] = useState<GoogleEmailMessage[]>(FALLBACK_GMAIL_MESSAGES);
  const [liveDriveFiles, setLiveDriveFiles] = useState<GoogleDriveFile[]>(FALLBACK_DRIVE_FILES);
  const [liveStorageQuota, setLiveStorageQuota] = useState<GoogleStorageQuota>(DEFAULT_2TB_QUOTA);
  const [isSyncingGoogle, setIsSyncingGoogle] = useState<boolean>(false);

  const syncLiveGoogleData = async (explicitToken?: string) => {
    const token = explicitToken || googleAccessToken;
    if (!token) return;

    setIsSyncingGoogle(true);
    try {
      const [msgs, files, quota] = await Promise.allSettled([
        fetchGmailMessages(token),
        fetchGoogleDriveFiles(token),
        fetchGoogleDriveStorageQuota(token, user.email),
      ]);

      if (msgs.status === 'fulfilled' && msgs.value && msgs.value.length > 0) {
        setLiveEmails(msgs.value);
      }
      if (files.status === 'fulfilled' && files.value && files.value.length > 0) {
        setLiveDriveFiles(files.value);
      }
      if (quota.status === 'fulfilled' && quota.value) {
        setLiveStorageQuota(quota.value);
      }
    } catch (err) {
      console.warn('Live Google Workspace sync notice:', err);
    } finally {
      setIsSyncingGoogle(false);
    }
  };

  const [user, setUser] = useState<UserProfile>(() => {
    const saved = localStorage.getItem('aura_user');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.name && (parsed.name.includes('Karthik') || parsed.name.includes('Raja'))) {
          parsed.name = 'Thamiz';
        }
        return parsed;
      } catch {
        return INITIAL_USER;
      }
    }
    return INITIAL_USER;
  });

  const [role, setRoleState] = useState<UserRole>('primary');
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>(() => {
    const saved = localStorage.getItem('aura_family');
    if (saved) {
      try {
        const parsed: FamilyMember[] = JSON.parse(saved);
        return parsed.map((m) => {
          if (m.name.includes('Karthik')) return { ...m, name: 'Thamiz (Primary)' };
          if (m.name.includes('Ananya')) return { ...m, name: 'Selvapriya (Spouse)', email: 'selvapriya.family@gmail.com' };
          if (m.name.includes('Aravind')) return { ...m, name: 'Maaran (Son)', email: 'maaran.k@gmail.com' };
          return m;
        });
      } catch {
        return INITIAL_FAMILY;
      }
    }
    return INITIAL_FAMILY;
  });

  const [activationCodes, setActivationCodes] = useState<ActivationCode[]>(() => {
    const saved = localStorage.getItem('aura_codes');
    return saved ? JSON.parse(saved) : INITIAL_CODES;
  });

  const [tasks, setTasks] = useState<EisenhowerTask[]>(() => {
    const saved = localStorage.getItem('aura_tasks');
    return saved ? JSON.parse(saved) : INITIAL_TASKS;
  });

  const [milestones, setMilestones] = useState<BillionaireMilestone[]>(() => {
    const saved = localStorage.getItem('aura_milestones');
    return saved ? JSON.parse(saved) : INITIAL_BILLIONAIRE_MILESTONES;
  });

  const [portfolio] = useState<InvestmentAsset[]>(INITIAL_PORTFOLIO);
  const [transactions, setTransactions] = useState<Transaction[]>(INITIAL_TRANSACTIONS);
  const [biometrics, setBiometrics] = useState<HealthBiometrics>(INITIAL_BIOMETRICS);
  const [moodEntries, setMoodEntries] = useState<MoodJournalEntry[]>(INITIAL_MOODS);
  const [vaultNotes, setVaultNotes] = useState<EncryptedVaultNote[]>([]);
  const [storedDocs, setStoredDocs] = useState<UploadedFileDoc[]>([]);
  const [chatHistory, setChatHistory] = useState<VoiceMessage[]>([
    {
      id: 'vm-0',
      role: 'assistant',
      content: 'Welcome back, Thamiz. All family vitals are secure, your $100M milestone execution is tracking at 68% velocity, and your calendar has 2 high-leverage focus blocks today. How may I serve your vision right now?',
      timestamp: '10:48 AM',
      emotion: 'warm & visionary',
      actionSuggestion: 'Execute your 45-minute term sheet review block.',
    },
  ]);

  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'offline'>('synced');
  const [isMobileDeviceFrame, setIsMobileDeviceFrame] = useState<boolean>(false);
  const [isDemoTourActive, setIsDemoTourActive] = useState<boolean>(false);

  // Sync state with local storage
  useEffect(() => {
    localStorage.setItem('aura_user', JSON.stringify(user));
  }, [user]);

  useEffect(() => {
    localStorage.setItem('aura_family', JSON.stringify(familyMembers));
  }, [familyMembers]);

  useEffect(() => {
    localStorage.setItem('aura_codes', JSON.stringify(activationCodes));
  }, [activationCodes]);

  useEffect(() => {
    localStorage.setItem('aura_tasks', JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem('aura_milestones', JSON.stringify(milestones));
  }, [milestones]);

  // Online / Offline listener
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setSyncStatus('synced');
    };
    const handleOffline = () => {
      setIsOnline(false);
      setSyncStatus('offline');
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Sync with Firebase Auth state
  useEffect(() => {
    const unsubscribe = initAuth(
      (_authUser, token) => {
        if (token) {
          setGoogleAccessToken(token);
        }
      },
      () => {
        // on signout
        setGoogleAccessToken(null);
      }
    );
    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, []);

  // Initialize Encrypted Vault Notes with real AES-256 encrypted sample
  useEffect(() => {
    async function initVault() {
      const saved = localStorage.getItem('aura_vault');
      if (saved) {
        setVaultNotes(JSON.parse(saved));
      } else {
        const pkg1 = await encryptText(
          'Master Offshore Family Trust Charter: St. Kitts & Delaware LLC Series 2026. Primary Beneficiary: Digital Tamil World Estate. Allocation: 70% Enterprise Equity, 30% Sovereign Yields.'
        );
        const pkg2 = await encryptText(
          'Billionaire Execution Thesis: 1. Proprietary AI Models with 10x Inference Efficiency. 2. Direct-to-Enterprise distribution. 3. Zero debt in holding entity.'
        );

        const initialNotes: EncryptedVaultNote[] = [
          {
            id: 'vn-1',
            title: 'Family Trust & Asset Protection Charter',
            plainSummary: 'Offshore estate charter, series LLC structure & multi-gen inheritance protocol',
            encryptedPayload: pkg1.ciphertext,
            iv: pkg1.iv,
            tag: pkg1.algorithm,
            category: 'Family Wills & Health',
            updatedAt: '2026-10-08',
            linkedMemories: ['Trust established', 'Legal review complete'],
          },
          {
            id: 'vn-2',
            title: 'Foundational IP & Algorithmic Moat Secrets',
            plainSummary: 'Core architecture patents and autonomous agent multi-modal reasoning kernels',
            encryptedPayload: pkg2.ciphertext,
            iv: pkg2.iv,
            tag: pkg2.algorithm,
            category: 'Strategic IP',
            updatedAt: '2026-10-10',
            linkedMemories: ['Series B evaluation', 'Billionaire roadmap'],
          },
        ];
        setVaultNotes(initialNotes);
        localStorage.setItem('aura_vault', JSON.stringify(initialNotes));
      }
    }
    initVault();
  }, []);

  // Family Realtime Location & Battery Simulation ticker (every 25 seconds)
  useEffect(() => {
    const timer = setInterval(() => {
      setFamilyMembers((prev) =>
        prev.map((m) => {
          // slight random drift to simulate live GPS telemetry
          const latDelta = (Math.random() - 0.5) * 0.0004;
          const lngDelta = (Math.random() - 0.5) * 0.0004;
          return {
            ...m,
            liveLocation: {
              ...m.liveLocation,
              lat: Number((m.liveLocation.lat + latDelta).toFixed(5)),
              lng: Number((m.liveLocation.lng + lngDelta).toFixed(5)),
              timestamp: 'Just now',
              batteryLevel: Math.max(12, m.liveLocation.batteryLevel - (Math.random() > 0.8 ? 1 : 0)),
            },
          };
        })
      );
    }, 25000);
    return () => clearInterval(timer);
  }, []);

  // Biometrics & Lock
  const unlockWithBiometrics = () => {
    setIsLocked(false);
    return true;
  };

  const unlockWithPin = (pin: string) => {
    if (pin === (user.pinHash || '1234')) {
      setIsLocked(false);
      return true;
    }
    return false;
  };

  const lockApp = () => {
    setIsLocked(true);
  };

  const setRole = (newRole: UserRole) => {
    setRoleState(newRole);
    setUser((prev) => ({ ...prev, role: newRole }));
  };

  // Google Single Sign-On (SSO) login handler
  const loginWithGoogle = (email = 'digitaltamilworld@gmail.com', name?: string, newRole?: UserRole) => {
    sessionStorage.setItem('aura_google_auth_session', 'true');
    localStorage.setItem('aura_google_auth_persisted', 'true');

    const matched = familyMembers.find((m) => m.email.toLowerCase() === email.toLowerCase());
    const finalRole: UserRole =
      newRole ||
      (matched
        ? matched.role
        : email.toLowerCase().includes('digitaltamilworld')
        ? 'primary'
        : 'secondary');

    const finalName =
      name ||
      (matched
        ? matched.name
        : email.toLowerCase().includes('digitaltamilworld')
        ? 'Thamiz'
        : email.split('@')[0]);

    const finalAvatar = matched ? matched.avatar : user.avatar;

    setUser((prev) => ({
      ...prev,
      email,
      name: finalName,
      role: finalRole,
      avatar: finalAvatar,
    }));
    setRoleState(finalRole);
    setIsAuthenticated(true);
  };

  // Real Google OAuth pop-up login requesting Gmail, Drive & Calendar tokens
  const signInWithGoogleOAuth = async (): Promise<boolean> => {
    try {
      const result = await googleSignIn();
      if (result.user) {
        if (result.accessToken) {
          setGoogleAccessToken(result.accessToken);
        }
        const email = result.user.email || 'digitaltamilworld@gmail.com';
        const name = result.user.displayName || 'Thamiz';
        const avatar = result.user.photoURL || user.avatar;
        loginWithGoogle(email, name);
        if (avatar) {
          setUser((prev) => ({ ...prev, avatar }));
        }
        if (result.accessToken) {
          await syncLiveGoogleData(result.accessToken);
        }
        return true;
      }
      return false;
    } catch (err) {
      console.warn('OAuth pop-up note:', err);
      // Fallback seamlessly to direct session
      loginWithGoogle('digitaltamilworld@gmail.com', 'Thamiz');
      return true;
    }
  };

  // Login via 16-digit activation code
  const loginWithActivationCode = (code: string) => {
    const cleanCode = code.trim();
    const found = activationCodes.find((c) => c.code === cleanCode);
    if (!found) {
      return { success: false, message: 'Invalid or expired 16-digit activation code.' };
    }
    sessionStorage.setItem('aura_google_auth_session', 'true');
    localStorage.setItem('aura_google_auth_persisted', 'true');
    const memberName = found.redeemedBy || 'Secondary Member';
    setUser((prev) => ({
      ...prev,
      name: memberName,
      email: `${memberName.toLowerCase().replace(/\s+/g, '')}@family.aura`,
      role: 'secondary',
    }));
    setRoleState('secondary');
    setIsAuthenticated(true);
    return { success: true, message: 'Authenticated successfully via 16-digit Family Code.' };
  };

  // Sign out Google session (clears session and returns to Google SSO)
  const signOutGoogle = async () => {
    sessionStorage.removeItem('aura_google_auth_session');
    localStorage.removeItem('aura_google_auth_persisted');
    setGoogleAccessToken(null);
    setLiveEmails(FALLBACK_GMAIL_MESSAGES);
    setLiveDriveFiles(FALLBACK_DRIVE_FILES);
    setLiveStorageQuota(DEFAULT_2TB_QUOTA);
    setIsAuthenticated(false);
    try {
      await logoutGoogle();
    } catch {
      // ignore
    }
  };

  // 16-digit activation code generation: format XXXX-XXXX-XXXX-XXXX
  const generateActivationCode = (roleGranted: UserRole = 'secondary'): string => {
    const segment = () => Math.floor(1000 + Math.random() * 9000).toString();
    const code = `${segment()}-${segment()}-${segment()}-${segment()}`;
    const newCodeRecord: ActivationCode = {
      code,
      createdAt: new Date().toISOString().split('T')[0],
      expiresAt: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      createdBy: user.email,
      roleGranted,
      status: 'active',
    };
    setActivationCodes((prev) => [newCodeRecord, ...prev]);
    return code;
  };

  // Redeem code
  const redeemActivationCode = (code: string, memberName: string, relationship: string) => {
    const cleanCode = code.trim();
    const found = activationCodes.find((c) => c.code === cleanCode && c.status === 'active');
    if (!found) {
      return { success: false, message: 'Invalid, already used, or expired 16-digit activation code.' };
    }

    setActivationCodes((prev) =>
      prev.map((c) => (c.code === cleanCode ? { ...c, status: 'redeemed', redeemedBy: memberName } : c))
    );

    const newMember: FamilyMember = {
      id: `fam-${Date.now()}`,
      name: memberName,
      relationship: relationship as any,
      role: 'secondary',
      email: `${memberName.toLowerCase().replace(/\s+/g, '')}@family.aura`,
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      isOnline: true,
      liveLocation: {
        lat: 13.0827,
        lng: 80.2707,
        address: 'Chennai Residence (Safe Area)',
        timestamp: 'Just now',
        batteryLevel: 98,
        status: 'Safe at Home',
      },
      geofenceStatus: 'home',
      allowanceMonthly: 5000,
      monthlySpent: 0,
      todayMood: 'Welcomed into Family Hub 💖',
      emergencySosActive: false,
      activationCodeUsed: cleanCode,
    };

    setFamilyMembers((prev) => [...prev, newMember]);
    return { success: true, message: `Successfully linked ${memberName} to the Family Circle under Primary oversight.` };
  };

  const triggerEmergencySos = (memberId: string) => {
    setFamilyMembers((prev) =>
      prev.map((m) =>
        m.id === memberId
          ? {
              ...m,
              emergencySosActive: true,
              liveLocation: { ...m.liveLocation, status: 'Emergency Alert' },
            }
          : m
      )
    );
  };

  const clearEmergencySos = (memberId: string) => {
    setFamilyMembers((prev) =>
      prev.map((m) =>
        m.id === memberId
          ? {
              ...m,
              emergencySosActive: false,
              liveLocation: { ...m.liveLocation, status: 'Safe at Home' },
            }
          : m
      )
    );
  };

  const updateMemberAllowance = (memberId: string, allowance: number) => {
    setFamilyMembers((prev) => prev.map((m) => (m.id === memberId ? { ...m, allowanceMonthly: allowance } : m)));
  };

  // Tasks
  const addTask = (taskData: Omit<EisenhowerTask, 'id'>) => {
    const newTask: EisenhowerTask = {
      ...taskData,
      id: `task-${Date.now()}`,
    };
    setTasks((prev) => [newTask, ...prev]);
  };

  const toggleTask = (id: string) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)));
  };

  const deleteTask = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  // Milestones
  const toggleHabit = (milestoneId: string, habitIndex: number) => {
    // slight progress bump
    setMilestones((prev) =>
      prev.map((m) => {
        if (m.id === milestoneId) {
          const nextVal = Math.min(100, m.progressPercent + 1);
          return { ...m, progressPercent: nextVal };
        }
        return m;
      })
    );
  };

  const updateMilestoneProgress = (id: string, progress: number) => {
    setMilestones((prev) => prev.map((m) => (m.id === id ? { ...m, progressPercent: progress } : m)));
  };

  // Finance
  const netWorth = portfolio.reduce((acc, curr) => acc + curr.value, 0);
  const monthlyIncome = 145000;
  const monthlyExpenses = transactions
    .filter((t) => t.type === 'expense')
    .reduce((acc, curr) => acc + curr.amount, 0);

  const addTransaction = (tx: Omit<Transaction, 'id'>) => {
    const newTx: Transaction = { ...tx, id: `tx-${Date.now()}` };
    setTransactions((prev) => [newTx, ...prev]);
  };

  // Biometrics
  const updateBiometrics = (partial: Partial<HealthBiometrics>) => {
    setBiometrics((prev) => ({ ...prev, ...partial }));
  };

  // Mood
  const addMoodEntry = (entry: Omit<MoodJournalEntry, 'id'>) => {
    const newEntry: MoodJournalEntry = { ...entry, id: `m-${Date.now()}` };
    setMoodEntries((prev) => [newEntry, ...prev]);
  };

  // Encrypted Vault
  const addVaultNote = async (title: string, content: string, category: EncryptedVaultNote['category']) => {
    const encResult = await encryptText(content);
    const newNote: EncryptedVaultNote = {
      id: `vn-${Date.now()}`,
      title,
      plainSummary: content.slice(0, 70) + '...',
      encryptedPayload: encResult.ciphertext,
      iv: encResult.iv,
      tag: encResult.algorithm,
      category,
      updatedAt: new Date().toISOString().split('T')[0],
      linkedMemories: ['Encrypted securely with AES-256-GCM', 'Google One mirrored'],
    };
    const updated = [newNote, ...vaultNotes];
    setVaultNotes(updated);
    localStorage.setItem('aura_vault', JSON.stringify(updated));
  };

  const decryptVaultNote = async (note: EncryptedVaultNote): Promise<string> => {
    return decryptText({
      ciphertext: note.encryptedPayload,
      iv: note.iv,
    });
  };

  const deleteVaultNote = (id: string) => {
    const updated = vaultNotes.filter((n) => n.id !== id);
    setVaultNotes(updated);
    localStorage.setItem('aura_vault', JSON.stringify(updated));
  };

  // Documents
  const addStoredDoc = (doc: Omit<UploadedFileDoc, 'id'>) => {
    const newDoc: UploadedFileDoc = { ...doc, id: `doc-${Date.now()}` };
    setStoredDocs((prev) => [newDoc, ...prev]);
  };

  // Voice & Chat
  const addVoiceMessage = (msg: Omit<VoiceMessage, 'id'>) => {
    const newMsg: VoiceMessage = { ...msg, id: `vm-${Date.now()}` };
    setChatHistory((prev) => [...prev, newMsg]);
  };

  const clearChatHistory = () => {
    setChatHistory([]);
  };

  // Google One Sync
  const syncWithGoogleOne = async () => {
    setSyncStatus('syncing');
    await new Promise((r) => setTimeout(r, 1200));
    setSyncStatus('synced');
  };

  const toggleMobileFrame = () => {
    setIsMobileDeviceFrame((prev) => !prev);
  };

  const startDemoTour = () => {
    setIsDemoTourActive(true);
  };

  const stopDemoTour = () => {
    setIsDemoTourActive(false);
  };

  return (
    <AppContext.Provider
      value={{
        isAuthenticated,
        googleAccessToken,
        isGoogleConnected: Boolean(googleAccessToken),
        isSyncingGoogle,
        liveEmails,
        liveDriveFiles,
        liveStorageQuota,
        syncLiveGoogleData,
        signInWithGoogleOAuth,
        loginWithGoogle,
        loginWithActivationCode,
        signOutGoogle,
        requireGoogleAuthOnReload,
        setRequireGoogleAuthOnReload,
        googleWorkspaceSettings,
        updateGoogleWorkspaceSettings,
        user,
        role,
        isLocked,
        unlockWithBiometrics,
        unlockWithPin,
        lockApp,
        setRole,
        familyMembers,
        activationCodes,
        generateActivationCode,
        redeemActivationCode,
        triggerEmergencySos,
        clearEmergencySos,
        updateMemberAllowance,
        tasks,
        addTask,
        toggleTask,
        deleteTask,
        milestones,
        toggleHabit,
        updateMilestoneProgress,
        netWorth,
        monthlyIncome,
        monthlyExpenses,
        portfolio,
        transactions,
        addTransaction,
        biometrics,
        updateBiometrics,
        moodEntries,
        addMoodEntry,
        vaultNotes,
        addVaultNote,
        decryptVaultNote,
        deleteVaultNote,
        storedDocs,
        addStoredDoc,
        chatHistory,
        addVoiceMessage,
        clearChatHistory,
        isOnline,
        googleOneStorageUsedGb: user.googleOneStorageUsedGb,
        syncStatus,
        syncWithGoogleOne,
        isMobileDeviceFrame,
        toggleMobileFrame,
        isDemoTourActive,
        startDemoTour,
        stopDemoTour,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};
