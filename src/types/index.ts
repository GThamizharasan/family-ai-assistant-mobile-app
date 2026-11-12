export type UserRole = 'primary' | 'secondary';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone?: string;
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
  relationship: string;
  role: UserRole;
  email: string;
  phone?: string;
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
  bloodGroup?: string;
  medicalNotes?: string;
  emergencyContact?: string;
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

export interface WeatherCardData {
  location: string;
  temperature: number;
  apparentTemperature?: number;
  condition: string;
  high: number;
  low: number;
  rainChance: number;
  humidity: number;
  wind?: string;
  uvIndex?: number;
  coordinates?: { latitude: number; longitude: number };
}

export interface AppleBookCardData {
  id: string;
  title: string;
  author?: string;
  totalPages?: number;
  coverGradient?: string;
  driveFolderPath?: string;
  category?: string;
}

export interface VoiceMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  emotion?: string;
  actionSuggestion?: string;
  modelUsed?: string;
  providerUsed?: string;
  attachment?: {
    name: string;
    mimeType: string;
    size: string;
    previewUrl?: string;
    isImage?: boolean;
    isPdf?: boolean;
    textContent?: string;
  };
  systemAction?: WindowsSystemAction;
  systemExecutionResult?: WindowsSystemExecutionResult;
  weatherCard?: WeatherCardData;
  bookCard?: AppleBookCardData;
}

export interface GoogleWorkspaceSettings {
  gmailEnabled: boolean;
  driveEnabled: boolean;
  calendarEnabled: boolean;
  googleOneBackupEnabled: boolean;
  autoSyncCalendarToTasks: boolean;
  autoSummarizeUnreadEmails: boolean;
  driveDefaultFolder?: string;
  autoCategorizeDriveFiles?: boolean;
}

export interface WhatsAppMessage {
  id: string;
  contactId: string;
  contactName: string;
  contactPhone: string;
  contactAvatar?: string;
  relationship?: string;
  text: string;
  timestamp: string;
  isOutgoing: boolean;
  status: 'sent' | 'delivered' | 'read';
  suggestedReplies?: string[];
  urgency?: 'urgent' | 'normal' | 'info';
  category?: 'family' | 'business' | 'groups' | 'urgent';
  apiMessageId?: string;
  channel?: string;
}

export interface WhatsAppContact {
  id: string;
  name: string;
  phone: string;
  avatar: string;
  relationship: string;
  lastMessageTime: string;
  unreadCount: number;
  isOnline: boolean;
  category: 'family' | 'business' | 'groups';
  lastMessagePreview?: string;
}

export interface WhatsAppAccountConfig {
  isConnected: boolean;
  linkedPhone: string;
  accountName: string;
  pairedAt: string;
  autoDraftWithAura: boolean;
  autoVoiceRead: boolean;
  pairingCode: string;
  connectionMethod?: 'direct_number' | 'web_pairing' | 'meta_cloud_api';
  countryCode?: string;
  metaCloudApiConfig?: {
    phoneNumberId?: string;
    wabaId?: string;
    accessToken?: string;
  };
}

export interface PhoneContact {
  id: string;
  name: string;
  phone: string;
  email?: string;
  avatar?: string;
  relationship?: string;
  category: 'family' | 'business' | 'medical' | 'security' | 'personal';
  source: 'device' | 'google' | 'manual';
  isFavorite?: boolean;
  notes?: string;
}

export interface CallLogItem {
  id: string;
  contactName: string;
  phone: string;
  avatar?: string;
  relationship?: string;
  timestamp: string;
  durationSeconds: number;
  type: 'outgoing' | 'incoming' | 'missed';
  notes?: string;
  aiSummary?: string;
  actionItems?: string[];
  sentiment?: string;
}

export interface ActiveCallState {
  isActive: boolean;
  contactName: string;
  phone: string;
  avatar?: string;
  relationship?: string;
  startTime: number;
  durationSeconds: number;
  status: 'dialing' | 'ringing' | 'connected' | 'ended';
  isMuted: boolean;
  isSpeakerOn: boolean;
  isOnHold: boolean;
  aiCoPilotEnabled: boolean;
  liveTranscription: string[];
}

export interface GcpServiceCost {
  serviceId: string;
  name: string;
  category: 'compute' | 'ai' | 'database' | 'storage' | 'network';
  currentSpend: number;
  projectedSpend: number;
  percentage: number;
  usageMetric: string;
  changePercent: number;
  color: string;
}

export interface GcpBillingInvoice {
  invoiceId: string;
  period: string;
  amount: number;
  status: 'paid' | 'open' | 'processing';
  pdfUrl?: string;
  paymentMethod: string;
}

export interface GcpBillingAlertThresholds {
  at50Percent: boolean;
  at80Percent: boolean;
  at90Percent: boolean;
  at100Percent: boolean;
  notifyEmail: boolean;
  notifyWhatsApp: boolean;
  notifyPush: boolean;
}

export interface GcpBillingControlGuardrails {
  autoScaleDownOnCap: boolean;
  throttleAiModelsAt90: boolean;
  pauseIdleDevEnvironments: boolean;
  maxCloudRunInstances: number;
  apiRateLimitPerMinute: number;
  hardSpendCapEnforced: boolean;
}

export interface GcpBillingConfig {
  projectId: string;
  projectNumber: string;
  billingAccountId: string;
  billingAccountName: string;
  currency: string;
  monthlyBudgetLimit: number;
  currentMtdSpend: number;
  projectedSpend: number;
  lastUpdated: string;
  paymentMethod: {
    type: string;
    last4: string;
    expiry: string;
    status: string;
  };
  alertThresholds: GcpBillingAlertThresholds;
  controlGuardrails: GcpBillingControlGuardrails;
  services: GcpServiceCost[];
  invoices: GcpBillingInvoice[];
  isLiveSynced?: boolean;
  liveSyncStatus?: 'idle' | 'syncing' | 'synced' | 'error' | 'not_authorized';
  liveSyncError?: string | null;
  detectedLiveProjects?: {
    projectId: string;
    projectNumber: string;
    name: string;
    lifecycleState: string;
  }[];
  detectedLiveBillingAccounts?: {
    name: string;
    displayName: string;
    open: boolean;
  }[];
  authenticatedGoogleEmail?: string;
  billingEnabled?: boolean;
}

export interface GeminiModelOption {
  id: string;
  name: string;
  badge: string;
  tagline: string;
  speed: string;
  color: string;
  recommendedFor?: string;
}

export const AVAILABLE_GEMINI_MODELS: GeminiModelOption[] = [
  {
    id: 'gemini-3.8-flash',
    name: 'Gemini 3.8 Flash',
    badge: 'DEFAULT',
    tagline: 'Ultra-fast multimodal conversational AI with low latency',
    speed: 'Ultra-Fast',
    color: 'emerald',
    recommendedFor: 'Voice Assistant Default',
  },
  {
    id: 'gemini-3.5-flash',
    name: 'Gemini 3.5 Flash',
    badge: 'BALANCED',
    tagline: 'High reliability conversational flash with broad quotas',
    speed: 'Fast',
    color: 'indigo',
    recommendedFor: 'Everyday Voice & Chat',
  },
  {
    id: 'gemini-3.1-flash-lite',
    name: 'Gemini 3.1 Flash-Lite',
    badge: 'LITE',
    tagline: 'Lowest latency & lowest quota consumption for rapid turns',
    speed: 'Lightest',
    color: 'cyan',
    recommendedFor: 'Low Quota / Fast Turns',
  },
  {
    id: 'gemini-3.7-flash',
    name: 'Gemini 3.7 Flash',
    badge: 'HYBRID',
    tagline: 'Hybrid adaptive reasoning with thinking token capability',
    speed: 'Deep Reasoning',
    color: 'purple',
    recommendedFor: 'Complex Advisory',
  },
  {
    id: 'gemini-4-argon',
    name: 'Gemini 4 Argon',
    badge: 'FRONTIER',
    tagline: 'Deep strategic reasoning, wealth roadmap & executive planning',
    speed: 'Frontier AI',
    color: 'amber',
    recommendedFor: 'Billionaire Roadmap Analysis',
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    badge: 'LEGACY',
    tagline: 'Standard free-tier & Google OAuth fallback model',
    speed: 'Reliable',
    color: 'blue',
    recommendedFor: 'OAuth Token Fallback',
  },
];

export type AiProvider = 'gemini' | 'nvidia' | 'openai' | 'anthropic' | 'custom';

export interface CustomAiModelConfig {
  endpointUrl: string;
  modelId: string;
  modelName: string;
  apiKey?: string;
  providerType?: 'openai-compatible' | 'ollama' | 'vllm' | 'lmstudio';
}

export interface AiModelOption {
  id: string;
  name: string;
  provider: AiProvider;
  badge: string;
  tagline: string;
  speed: string;
  color: string;
  recommendedFor?: string;
  supportsImageGen?: boolean;
  supportsVideoGen?: boolean;
  supportsMusicGen?: boolean;
}

export const AVAILABLE_OPENAI_MODELS: AiModelOption[] = [
  {
    id: 'gpt-4o',
    name: 'OpenAI GPT-4o',
    provider: 'openai',
    badge: 'OMNI FLAGSHIP',
    tagline: 'High-intelligence flagship multimodal model across text, audio, and vision',
    speed: 'Fast & Versatile',
    color: 'emerald',
    recommendedFor: 'Complex Planning & Conversational AI',
  },
  {
    id: 'gpt-4o-mini',
    name: 'OpenAI GPT-4o Mini',
    provider: 'openai',
    badge: 'FAST & AFFORDABLE',
    tagline: 'Cost-efficient intelligence with sub-second response times',
    speed: 'Ultra-Fast',
    color: 'emerald',
    recommendedFor: 'Voice turns & Real-time Tasks',
  },
  {
    id: 'o3-mini',
    name: 'OpenAI o3-mini',
    provider: 'openai',
    badge: 'REASONING',
    tagline: 'Advanced chain-of-thought mathematical and algorithmic reasoning',
    speed: 'Deep Thinking',
    color: 'indigo',
    recommendedFor: 'Financial Roadmap & Technical Problem Solving',
  },
];

export const AVAILABLE_ANTHROPIC_MODELS: AiModelOption[] = [
  {
    id: 'claude-3-7-sonnet-20250219',
    name: 'Claude 3.7 Sonnet',
    provider: 'anthropic',
    badge: 'HYBRID REASONING',
    tagline: 'State-of-the-art hybrid reasoning with adaptive thinking tokens',
    speed: 'Adaptive / Fast',
    color: 'purple',
    recommendedFor: 'Executive Writing, Coding & Complex Guidance',
  },
  {
    id: 'claude-3-5-haiku-20241022',
    name: 'Claude 3.5 Haiku',
    provider: 'anthropic',
    badge: 'LIGHTNING FAST',
    tagline: 'High speed, compact model for immediate voice and chat execution',
    speed: 'Lightning Fast',
    color: 'cyan',
    recommendedFor: 'Everyday Assistant Turns & Quick Summary',
  },
];

export const DEFAULT_CUSTOM_MODELS: AiModelOption[] = [
  {
    id: 'custom-ollama-llama3',
    name: 'Local Ollama (Llama 3.2 / DeepSeek)',
    provider: 'custom',
    badge: 'LOCAL / AIR-GAPPED',
    tagline: 'Self-hosted inference on your local GPU/machine via Ollama or vLLM',
    speed: 'Local Latency',
    color: 'amber',
    recommendedFor: '100% Private Offline AI',
  },
  {
    id: 'custom-openai-compatible',
    name: 'Custom OpenAI-Compatible API',
    provider: 'custom',
    badge: 'EXTENSIBLE',
    tagline: 'Connect any OpenAI-compatible API endpoint (Groq, DeepSeek, Together, LM Studio)',
    speed: 'Custom API',
    color: 'blue',
    recommendedFor: 'Third-party AI Endpoints',
  },
];

export const AVAILABLE_NVIDIA_MODELS: AiModelOption[] = [
  {
    id: 'nvidia/nemotron-3.5-lightning-30b-a3b',
    name: 'NVIDIA Nemotron 3.5 Lightning 30B',
    provider: 'nvidia',
    badge: 'VERIFIED & ACTIVE',
    tagline: 'Ultra-fast 30B MoE model with native thinking & high-throughput GPU inference',
    speed: 'Lightning Fast (Hopper)',
    color: 'emerald',
    recommendedFor: 'Voice Assistant & Conversational Reasoning',
  },
  {
    id: 'nvidia/llama-3.1-nemotron-70b-instruct',
    name: 'NVIDIA Llama 3.1 Nemotron 70B',
    provider: 'nvidia',
    badge: 'FLAGSHIP 70B',
    tagline: 'High-capability 70B conversational intelligence trained by NVIDIA',
    speed: 'High Throughput',
    color: 'emerald',
    recommendedFor: 'Complex Problem Solving & Strategy',
  },
  {
    id: 'nvidia/riva-translate-4b-instruct-v2',
    name: 'NVIDIA Riva Translate 4B',
    provider: 'nvidia',
    badge: 'TRANSLATOR',
    tagline: 'Specialized multilingual translation neural model for instant language conversion',
    speed: 'Ultra Fast',
    color: 'teal',
    recommendedFor: 'Real-time Multilingual Translation',
  },
  {
    id: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning',
    name: 'NVIDIA Nemotron 3 Nano Omni 30B',
    provider: 'nvidia',
    badge: 'REASONING & AUDIO',
    tagline: 'Multimodal audio comprehension, deep chain-of-thought, and speech reasoning',
    speed: 'Deep Thinking',
    color: 'cyan',
    recommendedFor: 'Voice Speech-to-Text & Reasoning',
  },
  {
    id: 'nvidia/nemotron-3-ultra-550b-a55b',
    name: 'NVIDIA Nemotron 3 Ultra 550B',
    provider: 'nvidia',
    badge: 'FRONTIER 550B',
    tagline: 'Massive 550B frontier model running on large-scale NVIDIA DGX superclusters',
    speed: 'Frontier Scale',
    color: 'amber',
    recommendedFor: 'Billionaire Roadmap & Venture Capital',
  },
  {
    id: 'meta/llama-3.2-90b-vision-instruct',
    name: 'Meta Llama 3.2 90B Vision',
    provider: 'nvidia',
    badge: 'VISION 90B',
    tagline: 'Multimodal vision and text comprehension on NVIDIA TensorRT-LLM',
    speed: 'High Throughput',
    color: 'indigo',
    recommendedFor: 'Document & Image Analysis',
  },
  {
    id: 'deepseek-ai/deepseek-v4.1-flash',
    name: 'DeepSeek V4.1 Flash',
    provider: 'nvidia',
    badge: 'FLASH',
    tagline: 'High-speed open model optimized for rapid response times',
    speed: 'Ultra Fast',
    color: 'blue',
    recommendedFor: 'Low-latency Family Chat',
  },
  {
    id: 'black-forest-labs/flux.1-schnell',
    name: 'FLUX.1 Schnell',
    provider: 'nvidia',
    badge: 'FLUX.1 SCHNELL',
    tagline: '12B parameter state-of-the-art visual generation model on NVIDIA NIM',
    speed: 'Lightning 4-Step',
    color: 'amber',
    recommendedFor: 'Ultra-Fast High Detail Artwork',
    supportsImageGen: true,
  },
  {
    id: 'black-forest-labs/flux.1-dev',
    name: 'FLUX.1 Dev',
    provider: 'nvidia',
    badge: 'FLUX.1 DEV',
    tagline: 'Frontier 12B guidance-distilled visual foundation model on NVIDIA NIM',
    speed: 'Production Quality',
    color: 'emerald',
    recommendedFor: 'Maximum Prompt Adherence & Artistry',
    supportsImageGen: true,
  },
  {
    id: 'stabilityai/stable-diffusion-3.5-large',
    name: 'Stable Diffusion 3.5 Large',
    provider: 'nvidia',
    badge: 'SD 3.5 LARGE',
    tagline: 'Photorealistic high-fidelity image generation via NVIDIA NIM',
    speed: 'Photorealistic',
    color: 'rose',
    recommendedFor: 'AI Studio Image Generation',
    supportsImageGen: true,
  },
  {
    id: 'stabilityai/sdxl-turbo',
    name: 'SDXL Turbo',
    provider: 'nvidia',
    badge: 'REAL-TIME SDXL',
    tagline: 'Adversarial diffusion distillation for instant single-step generation on NVIDIA GPUs',
    speed: 'Instant (1-step)',
    color: 'teal',
    recommendedFor: 'Rapid Prototyping & Thumbnails',
    supportsImageGen: true,
  },
  {
    id: 'stabilityai/stable-diffusion-xl',
    name: 'Stable Diffusion XL',
    provider: 'nvidia',
    badge: 'SDXL BASE',
    tagline: 'Flagship open visual synthesis model with dedicated refiner pipeline on NVIDIA NIM',
    speed: 'High Definition',
    color: 'indigo',
    recommendedFor: 'Portraits & Landscape Composition',
    supportsImageGen: true,
  },
  {
    id: 'nvidia/cosmos-1.0-diffusion-7b',
    name: 'NVIDIA Cosmos 1.0 Diffusion',
    provider: 'nvidia',
    badge: 'COSMOS VIDEO',
    tagline: 'World-foundation generative video model trained on physical dynamics & photorealism',
    speed: 'High-Throughput Video',
    color: 'emerald',
    recommendedFor: 'AI Studio Video & Motion Synthesis',
    supportsVideoGen: true,
  },
  {
    id: 'stabilityai/stable-video-diffusion-img2vid-xt',
    name: 'Stable Video Diffusion XT',
    provider: 'nvidia',
    badge: 'SVD-XT',
    tagline: 'State-of-the-art image-to-video foundation model on NVIDIA NIM for cinematic camera animation',
    speed: 'Cinematic Motion',
    color: 'purple',
    recommendedFor: 'Animate Photos to Motion Video',
    supportsVideoGen: true,
  },
  {
    id: 'nvidia/nemotron-video-director-30b',
    name: 'NVIDIA Nemotron Video Director 30B',
    provider: 'nvidia',
    badge: 'DIRECTOR 30B',
    tagline: 'Intelligent cinematic director orchestrating camera pan, orbital rotation, and lighting transport',
    speed: 'Ultra Fast',
    color: 'indigo',
    recommendedFor: 'Text to Video & Motion Storyboarding',
    supportsVideoGen: true,
  },
];

export interface WindowsSystemAction {
  shouldExecute?: boolean;
  title?: string;
  command?: string;
  shell?: 'powershell' | 'cmd';
  manager?: 'winget' | 'choco' | 'npm' | 'pip' | 'powershell';
  packageId?: string;
  stepNumber?: number;
  totalSteps?: number;
  stepDescription?: string;
  nextStep?: string;
  autoExecute?: boolean;
}

export interface WindowsSystemExecutionResult {
  success: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  command: string;
  manager?: string;
  stepTitle?: string;
  stepDescription?: string;
  nextStep?: string;
}

export interface WindowsHostInfo {
  platform: string;
  type: string;
  release: string;
  arch: string;
  hostname: string;
  username: string;
  uptimeSeconds: number;
  totalMemGb: string;
  freeMemGb: string;
  cpuModel: string;
  cpuCores: number;
}

export interface WindowsToolStatus {
  id: string;
  name: string;
  installed: boolean;
  path?: string;
  version?: string;
}

