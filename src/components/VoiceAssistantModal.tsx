import React, { useState, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  X,
  Sparkles,
  Send,
  Heart,
  ShieldCheck,
  Compass,
  DollarSign,
  Users,
  HelpCircle,
  AlertCircle,
  CheckCircle,
  MessageSquare,
  PhoneCall,
  Brain,
  Bookmark,
  Trash2,
  Plus,
  Smartphone,
  FileText,
  HardDrive,
  Home,
  Paperclip,
  UploadCloud,
  Check,
  Eye,
  Camera,
  Image as ImageIcon,
  Scan,
  Copy,
  ExternalLink,
  Cpu,
  Settings,
  Terminal,
  ArrowRight,
  Play,
  CheckCircle2,
  CloudSun,
  BookOpen,
} from 'lucide-react';
import { syncAnyAiOutputToDrive } from '../services/guidedLearningService';
import { useApp } from '../context/AppContext';
import { AVAILABLE_GEMINI_MODELS, AVAILABLE_NVIDIA_MODELS } from '../types';
import { AiModelConfigModal } from './AiModelConfigModal';
import { WindowsSystemInstallerModal } from './WindowsSystemInstallerModal';
import { openWindowsTerminalWindow } from '../services/windowsSystemService';
import { getCachedWeatherData, getCurrentCoordinates, fetchWeatherForecast } from '../services/weatherService';
import { AI_MODEL_CHANGED_EVENT } from '../services/aiConfig';
import { speechEngine, isIOSChrome, isMobileDevice, SUPPORTED_VOICE_LANGUAGES } from '../services/speech';
import { sendChatMessage, getApiBaseUrl } from '../services/api';
import { TabKey } from './BottomNav';
import { uploadBookToDrive } from '../services/appleBooksDrive';
import { parsePdfFileToBook, syncBookToSqlite } from '../utils/pdfHelper';
import { saveBookToSqliteStore } from '../services/offlineSyncService';
import { parsePhoneAppVoiceIntent, launchPhoneApp } from '../services/phoneControlService';
import { Book } from '../types/book';
import {
  createReminder,
  getLocalReminders,
  saveLocalReminders,
  syncRemindersWithGoogleDrive,
} from '../services/reminderDriveSync';
import {
  getLocalHealthRecords,
  addVitalSignToMember,
  addAllergyToMember,
  addMedicationToMember,
  uploadHealthDocument,
  getGoogleAccessToken,
} from '../services/healthRecordDriveSync';
import {
  recordFeverTemperature,
  getLocalFeverLogs,
  calculateFeverSeverity,
  celsiusToFahrenheit,
} from '../services/feverDriveSync';
import {
  logMedicationDose,
  getTodayDoseStatusForMember,
} from '../services/medicationDriveSync';
import {
  logHydrationIntake,
  getTodayHydrationSummary,
} from '../services/hydrationDriveSync';
import {
  logWalkingSteps,
  getTodayStepsSummary,
} from '../services/walkingStepsDriveSync';
import { TransportMode } from '../types/mapNavigation';

interface VoiceAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenVision?: () => void;
  onGoHome?: () => void;
  onNavigateTab?: (tab: TabKey, subTab?: string) => void;
  onOpenMusicPlayer?: () => void;
  onOpenOfflineSync?: () => void;
  onOpenCustomMap?: (options?: { destination?: string; origin?: string; mode?: TransportMode; autoStart?: boolean }) => void;
  onOpenFeverTracker?: (options?: { memberId?: string; memberName?: string; temperatureF?: number; autoLog?: boolean; autoPrint?: boolean }) => void;
}

export const VoiceAssistantModal: React.FC<VoiceAssistantModalProps> = ({
  isOpen,
  onClose,
  onOpenVision,
  onGoHome,
  onNavigateTab,
  onOpenMusicPlayer,
  onOpenOfflineSync,
  onOpenCustomMap,
  onOpenFeverTracker,
}) => {
  const {
    user,
    chatHistory,
    addVoiceMessage,
    assistantMemories,
    loadAssistantMemories,
    saveAssistantMemory,
    deleteAssistantMemory,
    liveKeepNotes,
    addGoogleKeepNote,
    internalStorageDetails,
    refreshInternalPhoneStorage,
    tasks,
    netWorth,
    familyMembers,
    whatsAppMessages,
    whatsAppContacts,
    sendWhatsAppMessage,
    markWhatsAppAsRead,
    phoneContacts,
    startCall,
    gcpBillingConfig,
    updateGcpBudgetLimit,
    toggleGcpControlGuardrail,
    liveEmails,
    liveSentEmails,
    sendGoogleEmail,
    refreshGoogleEmails,
    liveDriveFiles,
    liveStorageQuota,
    uploadGoogleDriveFile,
    googleWorkspaceSettings,
    isGoogleConnected,
    googleAccessToken,
    signInWithGoogleOAuth,
    syncLiveGoogleData,
    selectedVoiceModel,
    setSelectedVoiceModel,
    clearChatHistory,
  } = useApp();
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [liveVolume, setLiveVolume] = useState(0);
  const [isHandsFree, setIsHandsFree] = useState(true);
  const [textInput, setTextInput] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [currentEmotion, setCurrentEmotion] = useState('warm & empathetic');
  const [micStatusMessage, setMicStatusMessage] = useState<string | null>(null);
  const [showMicHelp, setShowMicHelp] = useState(false);
  const [voiceLanguage, setVoiceLanguage] = useState<string>(() => speechEngine.getLanguage());
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [showModelMenu, setShowModelMenu] = useState(false);

  // AI Provider Switcher (Google Gemini vs NVIDIA NIM)
  const [aiProvider, setAiProvider] = useState<'gemini' | 'nvidia'>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('aura_ai_provider');
      if (stored === 'nvidia' || stored === 'gemini') return stored;
    }
    return selectedVoiceModel.startsWith('nvidia/') ||
      selectedVoiceModel.startsWith('meta/') ||
      selectedVoiceModel.startsWith('deepseek-ai/')
      ? 'nvidia'
      : 'gemini';
  });

  const handleToggleProvider = (newProvider: 'gemini' | 'nvidia') => {
    setAiProvider(newProvider);
    if (typeof window !== 'undefined') {
      localStorage.setItem('aura_ai_provider', newProvider);
    }
    if (newProvider === 'nvidia') {
      const storedNvidia =
        (typeof window !== 'undefined' ? localStorage.getItem('aura_nvidia_model') : null) ||
        'nvidia/nemotron-3.5-lightning-30b-a3b';
      setSelectedVoiceModel(storedNvidia);
    } else {
      const storedGemini =
        (typeof window !== 'undefined' ? localStorage.getItem('aura_voice_model') : null) ||
        'gemini-3.8-flash';
      const cleanGemini =
        storedGemini.startsWith('nvidia/') ||
        storedGemini.startsWith('meta/') ||
        storedGemini.startsWith('deepseek')
          ? 'gemini-3.8-flash'
          : storedGemini;
      setSelectedVoiceModel(cleanGemini);
    }
  };

  // Automatically purge any repetitive corrupted phrases from chat history
  useEffect(() => {
    if (chatHistory.some((m) => m.content.includes('கருத்துக்களை மறவில்லை') || m.content.includes('விளக்க முடியும்\n\nநீங்கள் என்ன'))) {
      console.log('[VoiceAssistant] Purging repetitive conversation history loop...');
      clearChatHistory();
    }
  }, [chatHistory, clearChatHistory]);
  const [showMemoryDrawer, setShowMemoryDrawer] = useState(false);
  const [showGlobalAiModal, setShowGlobalAiModal] = useState(false);
  const [showWindowsInstallerModal, setShowWindowsInstallerModal] = useState(false);
  const [savedMemoryNotice, setSavedMemoryNotice] = useState<string | null>(null);

  // Synchronize with global AI model changes
  useEffect(() => {
    const handleGlobalModelChanged = (e: any) => {
      if (e.detail?.provider) {
        setAiProvider(e.detail.provider);
        setSelectedVoiceModel(e.detail.model);
      }
    };
    window.addEventListener(AI_MODEL_CHANGED_EVENT, handleGlobalModelChanged);
    return () => window.removeEventListener(AI_MODEL_CHANGED_EVENT, handleGlobalModelChanged);
  }, []);
  const [savedKeepNoteNotice, setSavedKeepNoteNotice] = useState<string | null>(null);
  const [savedReminderNotice, setSavedReminderNotice] = useState<string | null>(null);
  const [driveUploadNotice, setDriveUploadNotice] = useState<string | null>(null);
  const [showDeviceStorageNotice, setShowDeviceStorageNotice] = useState(false);
  const [newMemTopic, setNewMemTopic] = useState('');
  const [newMemContent, setNewMemContent] = useState('');
  const [isAddingMem, setIsAddingMem] = useState(false);

  // Drive sync for Assistant messages on demand
  const [syncingDriveMsgId, setSyncingDriveMsgId] = useState<string | null>(null);
  const [syncedDriveMsgIds, setSyncedDriveMsgIds] = useState<Set<string>>(new Set());
  const [syncedDriveMsgLinks, setSyncedDriveMsgLinks] = useState<Record<string, string>>({});
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);

  const handleSyncAssistantMessageToDrive = async (msg: any) => {
    let token = googleAccessToken || (typeof localStorage !== 'undefined' ? localStorage.getItem('aura_google_access_token') : null);
    if (!token) {
      setDriveUploadNotice('Connecting Google Account for Drive sync...');
      const authed = await signInWithGoogleOAuth();
      if (authed) {
        token = (typeof localStorage !== 'undefined' ? localStorage.getItem('aura_google_access_token') : null) || googleAccessToken;
      }
    }
    if (!token) {
      setDriveUploadNotice('Please connect your Google Account in Settings/Google One to sync with Drive.');
      setTimeout(() => setDriveUploadNotice(null), 5000);
      return;
    }
    setSyncingDriveMsgId(msg.id);
    try {
      const idx = chatHistory.findIndex((m) => m.id === msg.id);
      const prevUserMsg = idx > 0 ? chatHistory[idx - 1] : null;
      const userPrompt = prevUserMsg?.role === 'user' ? prevUserMsg.content : '';
      const title = userPrompt ? userPrompt.slice(0, 45) : 'Auro AI Assistant Output';

      const isLearning = /learn|course|lesson|tutor|stem|robot|code|python|math|science/i.test(msg.content + ' ' + userPrompt);
      const subfolder = isLearning ? 'Guided Learning' : 'AI Assistant Outputs';

      let res;
      try {
        res = await syncAnyAiOutputToDrive(
          title,
          msg.content,
          token,
          {
            folderName: subfolder,
            category: isLearning ? 'Guided Learning' : 'Voice Assistant',
            userEmail: user?.email,
            promptContext: userPrompt,
          }
        );
      } catch (firstErr: any) {
        if (firstErr?.message?.includes('401') || firstErr?.message?.includes('expired')) {
          setDriveUploadNotice('Refreshing Google authorization...');
          const reauthed = await signInWithGoogleOAuth();
          if (reauthed) {
            token = (typeof localStorage !== 'undefined' ? localStorage.getItem('aura_google_access_token') : null) || googleAccessToken;
            if (token) {
              res = await syncAnyAiOutputToDrive(
                title,
                msg.content,
                token,
                {
                  folderName: subfolder,
                  category: isLearning ? 'Guided Learning' : 'Voice Assistant',
                  userEmail: user?.email,
                  promptContext: userPrompt,
                }
              );
            }
          }
        }
        if (!res) throw firstErr;
      }

      if (res) {
        setSyncedDriveMsgIds((prev) => new Set(prev).add(msg.id));
        if (res.driveWebViewLink) {
          setSyncedDriveMsgLinks((prev) => ({ ...prev, [msg.id]: res.driveWebViewLink }));
        }
        setDriveUploadNotice(`✓ Saved to Google Drive under "${res.folderPath}"!`);
        setTimeout(() => setDriveUploadNotice(null), 6000);
      }
    } catch (err: any) {
      console.warn('Voice message drive sync error:', err);
      setDriveUploadNotice(`Drive sync notice: ${err?.message || 'Could not sync file'}`);
      setTimeout(() => setDriveUploadNotice(null), 5000);
    } finally {
      setSyncingDriveMsgId(null);
    }
  };

  // Attachment & Multimodal Plus Menu state for real-time analysis, camera, and Drive sync
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileSnippet, setFileSnippet] = useState<string>('');
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [isAnalyzingFile, setIsAnalyzingFile] = useState(false);
  const [isUploadingToDrive, setIsUploadingToDrive] = useState(false);
  const [isUploadingToAppleBooks, setIsUploadingToAppleBooks] = useState(false);
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const appleBooksInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const plusMenuRef = useRef<HTMLDivElement>(null);

  // Close Plus (+) action menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (plusMenuRef.current && !plusMenuRef.current.contains(e.target as Node)) {
        setShowPlusMenu(false);
      }
    };
    if (showPlusMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showPlusMenu]);

  const handleSelectLanguage = (code: string) => {
    speechEngine.setLanguage(code);
    setVoiceLanguage(code);
    setShowLangMenu(false);
    // Restart listening with the new language if currently listening
    if (isOpen && !isSpeaking && !isThinking) {
      speechEngine.stopListening(false);
      setTimeout(() => {
        speechEngine.startListening();
      }, 350);
    }
  };

  const chatEndRef = useRef<HTMLDivElement>(null);
  const handleUserSpeechRef = useRef<(spokenText: string) => void>(() => {});
  const isLocalVoiceMode = Capacitor.isNativePlatform() && !getApiBaseUrl();

  const isHandsFreeRef = useRef(isHandsFree);
  const isOpenRef = useRef(isOpen);
  const isSpeakingRef = useRef(isSpeaking);
  const isThinkingRef = useRef(isThinking);
  const isNavigatingRef = useRef(false);

  useEffect(() => {
    isHandsFreeRef.current = isHandsFree;
    speechEngine.setContinuousMode(isHandsFree && isOpen);
  }, [isHandsFree, isOpen]);

  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    isSpeakingRef.current = isSpeaking;
  }, [isSpeaking]);

  useEffect(() => {
    isThinkingRef.current = isThinking;
    speechEngine.setThinkingState(isThinking);
  }, [isThinking]);

  const speakWithAuro = (
    text: string,
    options: {
      pitch?: number;
      rate?: number;
      emotion?: string;
      audioBase64?: string | null;
    } = {}
  ) => {
    if (isMuted) {
      if (isHandsFreeRef.current && isOpenRef.current) {
        setTimeout(() => {
          if (isHandsFreeRef.current && isOpenRef.current && !isSpeakingRef.current && !isThinkingRef.current) {
            speechEngine.startListening();
          }
        }, 500);
      }
      return;
    }

    speechEngine.unlockAudio();
    speechEngine.speak(text, {
      pitch: options.pitch ?? user.preferences?.voicePitch ?? 1.04,
      rate: options.rate ?? user.preferences?.voiceRate ?? 1.0,
      emotion: options.emotion,
      audioBase64: options.audioBase64,
      onEnd: () => {
        // Continuous hands-free loop: automatically restart listening after Auro speaks
        if (isHandsFreeRef.current && isOpenRef.current) {
          setTimeout(() => {
            if (isHandsFreeRef.current && isOpenRef.current && !isSpeakingRef.current && !isThinkingRef.current) {
              speechEngine.startListening();
            }
          }, 850);
        }
      },
    });
  };

  useEffect(() => {
    speechEngine.onListeningChange = (listening) => {
      setIsListening(listening);
      if (listening) {
        setMicStatusMessage(null);
      }
    };
    speechEngine.onSpeakingChange = (speaking) => setIsSpeaking(speaking);
    speechEngine.onAudioVolume = (vol) => setLiveVolume(vol);
    speechEngine.onTranscriptCallback = (transcript, isFinal) => {
      setLiveTranscript(transcript);
      if (isFinal && transcript.trim()) {
        if (isLocalVoiceMode) {
          setTextInput(transcript.trim());
          setMicStatusMessage('Voice transcribed on this device. AI replies are off because no backend is configured.');
        } else {
          handleUserSpeechRef.current?.(transcript.trim());
        }
      }
    };
    speechEngine.onErrorCallback = (error) => {
      if (error === 'no-speech' || error === 'aborted') {
        // Silent timeout or benign abort: ignore during conversational turns, auto-restart is active
        return;
      }
      if (error === 'not-allowed' || error === 'permission-denied') {
        setMicStatusMessage(
          Capacitor.isNativePlatform()
            ? 'Microphone access is blocked. Open Android Settings > Apps > AuraFamily > Permissions > Microphone and allow access.'
            : 'Microphone access blocked. Click the lock 🔒 or tune 🎛️ icon next to the URL in your browser bar and choose "Allow" for Microphone.'
        );
      } else if (error === 'audio-capture') {
        setMicStatusMessage('No microphone detected. Please connect or enable your microphone.');
      } else if (error === 'device-busy') {
        setMicStatusMessage('Microphone calibrating...');
        if (isHandsFreeRef.current && isOpenRef.current) {
          setTimeout(() => {
            if (isHandsFreeRef.current && isOpenRef.current && !isSpeakingRef.current && !isThinkingRef.current) {
              speechEngine.startListening();
            }
          }, 850);
        }
      } else {
        setMicStatusMessage(`Microphone notice: ${error}. You can also type your message below.`);
        if (isHandsFreeRef.current && isOpenRef.current) {
          setTimeout(() => {
            if (isHandsFreeRef.current && isOpenRef.current && !isSpeakingRef.current && !isThinkingRef.current) {
              speechEngine.startListening();
            }
          }, 1200);
        }
      }
    };

    return () => {
      speechEngine.onListeningChange = undefined;
      speechEngine.onSpeakingChange = undefined;
      speechEngine.onAudioVolume = undefined;
      speechEngine.onTranscriptCallback = undefined;
      speechEngine.onErrorCallback = undefined;
    };
  }, [isLocalVoiceMode]);

  useEffect(() => {
    isOpenRef.current = isOpen;
    if (isOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      speechEngine.unlockAudio();
      speechEngine.setContinuousMode(isHandsFreeRef.current);
      loadAssistantMemories();
      // On native Android/iOS app or desktop, auto-activate speech listening.
      // On mobile web browsers, wait for explicit user tap on mic or persona orb to preserve active User Activation token.
      const isMobileWeb = !Capacitor.isNativePlatform() && isMobileDevice();
      if (!isMobileWeb) {
        const startTimer = setTimeout(() => {
          if (isOpenRef.current && !isSpeakingRef.current && !isThinkingRef.current) {
            speechEngine.startListening();
          }
        }, 400);
        return () => clearTimeout(startTimer);
      }
    } else {
      speechEngine.setContinuousMode(false);
      speechEngine.stopListening(true);
      if (!isNavigatingRef.current) {
        speechEngine.stopSpeaking();
      }
      isNavigatingRef.current = false;
      setMicStatusMessage(null);
      setShowMicHelp(false);
    }
  }, [isOpen]);

  const handleCancelAndGoHome = () => {
    speechEngine.stopSpeaking();
    speechEngine.stopListening(true);
    setMicStatusMessage(null);
    setShowMicHelp(false);
    if (onGoHome) {
      onGoHome();
    } else {
      onClose();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setMicStatusMessage(null);
      setShowPlusMenu(false);
      if (file.type.startsWith('image/')) {
        setFilePreviewUrl(URL.createObjectURL(file));
      } else {
        setFilePreviewUrl(null);
      }
      if (
        file.type.startsWith('text/') ||
        file.name.endsWith('.txt') ||
        file.name.endsWith('.csv') ||
        file.name.endsWith('.json') ||
        file.name.endsWith('.md')
      ) {
        try {
          const text = await file.slice(0, 3000).text();
          setFileSnippet(text);
        } catch {
          setFileSnippet('');
        }
      } else {
        setFileSnippet('');
      }
    }
    if (e.target) {
      e.target.value = '';
    }
  };

  const handleCameraCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setMicStatusMessage(null);
      setShowPlusMenu(false);
      setFilePreviewUrl(URL.createObjectURL(file));
      setFileSnippet('');
      if (!textInput.trim()) {
        const isTamil = voiceLanguage.startsWith('ta');
        setTextInput(
          isTamil
            ? 'இந்த கேமரா புகைப்படத்தை நிகழ்நேரத்தில் ஆய்வு செய்து விளக்குங்கள்.'
            : 'Please analyze this camera photo in real time and explain what you see.'
        );
      }
    }
    if (e.target) {
      e.target.value = '';
    }
  };

  const handleUploadAttachmentToDrive = async (fileToUpload?: File) => {
    const file = fileToUpload || selectedFile;
    if (!file) return;

    let activeToken = googleAccessToken || (typeof window !== 'undefined' ? localStorage.getItem('aura_google_access_token') : null);

    // If not authenticated with Google, proactively prompt and launch Google OAuth
    if (!activeToken) {
      const isTamil = voiceLanguage.startsWith('ta');
      const authNotice = isTamil
        ? 'கூகுள் டிரைவில் (drive.google.com) பதிவேற்ற, உங்கள் கூகுள் கணக்கை இணைப்பது அவசியம். கூகுள் உள்நுழைவை துவக்குகிறேன்...'
        : 'Google account authorization is required to upload directly to drive.google.com. Opening Google sign-in now...';

      addVoiceMessage({
        role: 'assistant',
        content: authNotice,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        emotion: 'helpful & attentive',
        actionSuggestion: 'Sign in with Google',
      });
      speakWithAuro(authNotice);

      const ok = await signInWithGoogleOAuth();
      if (!ok) {
        const cancelMsg = isTamil
          ? 'கூகுள் உள்நுழைவு ரத்து செய்யப்பட்டது. கோப்பைப் பதிவேற்ற கூகுள் கணக்குடன் இணைக்கவும்.'
          : 'Google sign-in was cancelled. Please connect your Google account to upload files to Google Drive.';
        addVoiceMessage({
          role: 'assistant',
          content: cancelMsg,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          emotion: 'comforting',
        });
        speakWithAuro(cancelMsg);
        return;
      }
      activeToken = localStorage.getItem('aura_google_access_token');
    }

    setIsUploadingToDrive(true);
    try {
      const defaultFolder = googleWorkspaceSettings?.driveDefaultFolder || 'Family Circle';
      const autoCat = googleWorkspaceSettings?.autoCategorizeDriveFiles ?? true;

      const uploaded = await uploadGoogleDriveFile(file, {
        folderName: defaultFolder,
        autoCategorize: autoCat,
        textSnippet: fileSnippet || undefined,
      });
      setIsUploadingToDrive(false);
      setSelectedFile(null);
      setFilePreviewUrl(null);
      setFileSnippet('');
      setDriveUploadNotice(uploaded.name);
      setTimeout(() => setDriveUploadNotice(null), 6000);

      const isTamil = voiceLanguage.startsWith('ta');
      const destinationFolder = uploaded.folderName || defaultFolder;
      const categoryLabel = uploaded.category ? ` (${uploaded.category})` : '';

      const confirmText = isTamil
        ? `உங்கள் "${uploaded.name}" கூகுள் டிரைவில் உள்ள "${destinationFolder}" கோப்புறையில் வெற்றிகரமாக பதிவேற்றப்பட்டது!`
        : `I have uploaded "${uploaded.name}" into your Google Drive under folder "${destinationFolder}"${categoryLabel}! It is securely organized in drive.google.com.`;

      addVoiceMessage({
        role: 'assistant',
        content: confirmText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        emotion: 'organized & protective',
        actionSuggestion: `Google Drive: "${uploaded.name}" (${destinationFolder})`,
      });

      speakWithAuro(confirmText, { emotion: 'supportive' });
      return uploaded;
    } catch (err: any) {
      setIsUploadingToDrive(false);
      console.error('Google Drive upload error:', err);
      const isTamil = voiceLanguage.startsWith('ta');
      const errMsg = err?.message || '';

      if (errMsg.includes('401') || errMsg.includes('expired') || errMsg.includes('403') || errMsg.includes('permission') || errMsg.includes('NO_GOOGLE_AUTH')) {
        const authErrText = isTamil
          ? `கூகுள் டிரைவ் பதிவேற்ற அனுமதி தேவை அல்லது காலாவதியானது. தயவுசெய்து உங்கள் கூகுள் கணக்கை மீண்டும் இணைக்கவும்.`
          : `Google Drive upload permission is required or expired. Please re-authenticate your Google account.`;
        addVoiceMessage({
          role: 'assistant',
          content: authErrText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          emotion: 'comforting',
          actionSuggestion: 'Re-authenticate Google Drive',
        });
        speakWithAuro(authErrText);
        void signInWithGoogleOAuth();
      } else {
        const errText = isTamil
          ? `கூகுள் டிரைவில் பதிவேற்ற முடியவில்லை: ${errMsg || 'தயவுசெய்து உங்கள் இணைய இணைப்பை சரிபார்த்து மீண்டும் முயற்சிக்கவும்.'}`
          : `Could not upload to Google Drive: ${errMsg || 'Please verify your connection and try again.'}`;
        addVoiceMessage({
          role: 'assistant',
          content: errText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          emotion: 'comforting',
        });
        speakWithAuro(errText);
      }
    }
  };

  const handleAppleBooksFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setMicStatusMessage(null);
      setShowPlusMenu(false);
      setFilePreviewUrl(null);
      setFileSnippet('');
      await handleUploadAttachmentToAppleBooks(file);
    }
    if (e.target) {
      e.target.value = '';
    }
  };

  const handleUploadAttachmentToAppleBooks = async (fileToUpload?: File) => {
    const file = fileToUpload || selectedFile;
    if (!file) return;

    let activeToken = googleAccessToken || (typeof window !== 'undefined' ? localStorage.getItem('aura_google_access_token') : null);

    // If not authenticated with Google, proactively prompt and launch Google OAuth
    if (!activeToken) {
      const isTamil = voiceLanguage.startsWith('ta');
      const authNotice = isTamil
        ? 'ஆப்பிள் புக்ஸ் நூலகத்தை கூகுள் டிரைவில் (Family Circle / Apple Books) ஒத்திசைக்க, கூகுள் கணக்கு இணைப்பு தேவைப்படுகிறது. உள்நுழைவை துவக்குகிறேன்...'
        : 'Google authorization is required to sync Apple Books into your Google Drive under "Family Circle / Apple Books". Opening Google sign-in now...';

      addVoiceMessage({
        role: 'assistant',
        content: authNotice,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        emotion: 'helpful & attentive',
        actionSuggestion: 'Sign in with Google',
      });
      speakWithAuro(authNotice);

      const ok = await signInWithGoogleOAuth();
      if (!ok) {
        const cancelMsg = isTamil
          ? 'கூகுள் உள்நுழைவு ரத்து செய்யப்பட்டது. ஆப்பிள் புக்ஸ் நூலகத்தில் சேமிக்க கூகுள் கணக்கை இணைக்கவும்.'
          : 'Google sign-in was cancelled. Please connect your Google account to upload books to Google Drive.';
        addVoiceMessage({
          role: 'assistant',
          content: cancelMsg,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          emotion: 'comforting',
        });
        speakWithAuro(cancelMsg);
        return;
      }
      activeToken = localStorage.getItem('aura_google_access_token');
    }

    setIsUploadingToAppleBooks(true);
    try {
      const defaultFolder = googleWorkspaceSettings?.driveDefaultFolder || 'Family Circle';

      // 1. Parse PDF/eBook file into structured Book model and cache binary in IndexedDB
      let parsedBook = await parsePdfFileToBook(file);

      // 2. Upload to Google Drive under Family Circle / Apple Books / {Category}
      let driveRes: {
        driveFileId: string;
        driveFolderId: string;
        driveFolderPath: string;
        driveCategory: string;
        driveWebViewLink: string;
      } | null = null;

      if (activeToken) {
        try {
          driveRes = await uploadBookToDrive(
            activeToken,
            parsedBook,
            file,
            defaultFolder,
            user?.email
          );
          parsedBook = {
            ...parsedBook,
            driveFileId: driveRes.driveFileId,
            driveFolderId: driveRes.driveFolderId,
            driveFolderPath: driveRes.driveFolderPath,
            driveCategory: driveRes.driveCategory,
            driveWebViewLink: driveRes.driveWebViewLink,
            isLocalCached: true,
          };
        } catch (driveErr) {
          console.warn('[AURO Apple Books Drive Upload] Drive API notice:', driveErr);
        }
      }

      // 3. Persist into local library localStorage safely
      try {
        const existingSaved = localStorage.getItem('aura_ibooks_library');
        let currentBooks: Book[] = existingSaved ? JSON.parse(existingSaved) : [];
        const filtered = currentBooks.filter((b) => b.id !== parsedBook.id && b.title !== parsedBook.title);
        const updatedLibrary = [parsedBook, ...filtered];
        const lightweightBooks = updatedLibrary.map((b) => {
          if (b.pdfUrl && b.pdfUrl.length > 500) {
            const { pdfUrl, ...rest } = b;
            return rest;
          }
          return b;
        });
        localStorage.setItem('aura_ibooks_library', JSON.stringify(lightweightBooks));
      } catch (storageErr) {
        console.warn('LocalStorage save error:', storageErr);
      }

      // 4. Mirror to backend SQLite endpoints
      try {
        syncBookToSqlite(parsedBook);
        await saveBookToSqliteStore(parsedBook);
      } catch (sqlErr) {
        console.warn('SQLite store book error:', sqlErr);
      }

      // 5. Notify the rest of the application reactive listeners
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('aura_ibooks_updated', { detail: parsedBook }));
        window.dispatchEvent(new CustomEvent('aura_sqlite_synced'));
      }

      setIsUploadingToAppleBooks(false);
      setSelectedFile(null);
      setFilePreviewUrl(null);
      setFileSnippet('');
      setDriveUploadNotice(parsedBook.title);
      setTimeout(() => setDriveUploadNotice(null), 6000);

      const isTamil = voiceLanguage.startsWith('ta');
      const folderPathDisplay = driveRes?.driveFolderPath || `${defaultFolder} / Apple Books / ${parsedBook.genre || 'General'}`;

      const confirmText = isTamil
        ? `உங்கள் "${parsedBook.title}" புத்தகம் வெற்றிகரமாக கூகுள் டிரைவில் உள்ள "${folderPathDisplay}" கோப்புறையில் பதிவேற்றப்பட்டு, உங்கள் ஆப்பிள் புக்ஸ் லைப்ரரியில் (${parsedBook.totalPages || 1} பக்கங்கள்) சேர்க்கப்பட்டது!`
        : `I have uploaded "${parsedBook.title}" into Google Drive under "${folderPathDisplay}" and added it directly to your Apple Books library (${parsedBook.totalPages || 1} pages)! It is indexed in SQLite and ready to read.`;

      addVoiceMessage({
        role: 'assistant',
        content: confirmText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        emotion: 'organized & protective',
        actionSuggestion: 'Open Apple Books Library',
        bookCard: {
          id: parsedBook.id,
          title: parsedBook.title,
          author: parsedBook.author,
          totalPages: parsedBook.totalPages,
          coverGradient: parsedBook.coverGradient,
          driveFolderPath: folderPathDisplay,
          category: parsedBook.genre,
        },
      });

      speakWithAuro(confirmText, { emotion: 'supportive' });
      return parsedBook;
    } catch (err: any) {
      setIsUploadingToAppleBooks(false);
      console.error('Apple Books Drive upload error:', err);
      const isTamil = voiceLanguage.startsWith('ta');
      const errMsg = err?.message || '';

      const errText = isTamil
        ? `ஆப்பிள் புக்ஸ் லைப்ரரியில் பதிவேற்ற முடியவில்லை: ${errMsg || 'தயவுசெய்து கோப்பை சரிபார்த்து மீண்டும் முயற்சிக்கவும்.'}`
        : `Could not upload to Apple Books library: ${errMsg || 'Please verify the PDF file and try again.'}`;

      addVoiceMessage({
        role: 'assistant',
        content: errText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        emotion: 'comforting',
      });
      speakWithAuro(errText);
    }
  };

  // Helper to execute instant voice navigation to any sovereign app feature
  const executeVoiceNavigation = (
    tab: TabKey,
    subTab?: string,
    speechReply?: string,
    tamilReply?: string
  ) => {
    setIsThinking(false);
    isNavigatingRef.current = true;
    const isTamil = voiceLanguage.startsWith('ta');
    const spoken = isTamil
      ? (tamilReply || speechReply || 'திரையைத் திறக்கிறேன்.')
      : (speechReply || 'Opening screen now.');

    addVoiceMessage({
      role: 'assistant',
      content: spoken,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      emotion: 'attentive & organized',
      actionSuggestion: `Navigate to ${tab}`,
    });

    speakWithAuro(spoken);

    if (onNavigateTab) {
      onNavigateTab(tab, subTab);
    } else {
      onClose();
    }
  };

  const handleUserSpeech = async (spokenText: string) => {
    if (!spokenText || !spokenText.trim()) return;
    speechEngine.unlockAudio();
    setLiveTranscript('');
    speechEngine.stopListening(false);

    const currentAttachment = selectedFile
      ? {
          name: selectedFile.name,
          mimeType: selectedFile.type || 'application/octet-stream',
          size:
            selectedFile.size > 1024 * 1024
              ? `${(selectedFile.size / (1024 * 1024)).toFixed(1)} MB`
              : `${Math.max(1, Math.round(selectedFile.size / 1024))} KB`,
          previewUrl: filePreviewUrl || undefined,
          isImage: selectedFile.type.startsWith('image/'),
          isPdf: selectedFile.type === 'application/pdf' || selectedFile.name.endsWith('.pdf'),
        }
      : undefined;

    const userMsg = {
      role: 'user' as const,
      content: spokenText.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      attachment: currentAttachment,
    };
    addVoiceMessage(userMsg);

    const lower = spokenText.toLowerCase().trim();

    // Voice Intent: On-demand sync latest response to Google Drive
    if (
      lower === 'sync to drive' ||
      lower === 'save to drive' ||
      lower === 'sync this to drive' ||
      lower === 'save this to drive' ||
      lower === 'sync with drive' ||
      lower === 'save to google drive' ||
      lower === 'drive sync' ||
      lower.includes('sync this output to drive') ||
      lower.includes('sync to google drive') ||
      lower.includes('save to drive') ||
      lower === 'கூகுள் டிரைவில் சேமி' ||
      lower === 'டிரைவில் ஏற்று'
    ) {
      const lastAssistantMsg = [...chatHistory].reverse().find((m) => m.role === 'assistant');
      if (lastAssistantMsg) {
        speakWithAuro(voiceLanguage.startsWith('ta') ? 'சமீபத்திய பதிலை கூகுள் டிரைவில் சேமிக்கிறேன்.' : 'Synchronizing latest response to Google Drive Family Circle now.');
        await handleSyncAssistantMessageToDrive(lastAssistantMsg);
        return;
      }
    }

    const isExplicitNavigation =
      lower.startsWith('open ') ||
      lower.startsWith('go to ') ||
      lower.startsWith('navigate to ') ||
      lower.startsWith('switch to ') ||
      lower.startsWith('launch ') ||
      lower.startsWith('show tab ') ||
      lower.startsWith('take me to ') ||
      lower.startsWith('திற ') ||
      lower.includes('திரைக்கு செல்') ||
      lower.endsWith(' திற') ||
      lower === 'home' ||
      lower === 'home hub' ||
      lower === 'go home';

    // =========================================================================
    // AURO VOICE INTENT: PHONE ACCESS & EXTERNAL APP CONTROL
    // Controls phone access on voice command: "open whatsapp", "open facebook",
    // "open youtube", "open instagram", "open camera", "open spotify", etc.
    // =========================================================================
    const phoneAppIntent = parsePhoneAppVoiceIntent(spokenText);
    if (phoneAppIntent && !selectedFile && !lower.includes('on screen') && !lower.includes('in app')) {
      const { app, isTamil } = phoneAppIntent;
      setIsThinking(false);

      const rep = isTamil
        ? `உங்கள் மொபைலில் ${app.tamilName} செயலியை இப்போது திறக்கிறேன்.`
        : `Opening ${app.name} on your device now.`;

      addVoiceMessage({
        role: 'assistant',
        content: rep,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        emotion: 'attentive & responsive',
        actionSuggestion: `Phone Access: ${app.name} (${app.icon})`,
      });

      speakWithAuro(rep);
      launchPhoneApp(app);
      return;
    }

    // Screen navigation intents should ONLY run when the user explicitly commands navigation and no file is being analyzed
    const shouldCheckNavigation = isExplicitNavigation && !selectedFile;

    if (shouldCheckNavigation) {
      // =========================================================================
      // AURO VOICE INTENT: FEATURE & SCREEN NAVIGATION
      // =========================================================================

    // 1. Voice Memo / Voice Memos
    if (
      lower.includes('voice memo') ||
      lower.includes('voice memos') ||
      lower.includes('audio memo') ||
      lower.includes('audio memos') ||
      lower.includes('record memo') ||
      lower.includes('record audio') ||
      lower.includes('voice note') ||
      lower.includes('voice recording') ||
      lower.includes('open memo') ||
      lower.includes('open memos') ||
      lower === 'memos' ||
      lower === 'memo' ||
      lower.includes('வாய்ஸ் மெமோ') ||
      lower.includes('மெமோ')
    ) {
      executeVoiceNavigation(
        'memos',
        undefined,
        'Opening Voice Memos on your sovereign screen now.',
        'வாய்ஸ் மெமோவை இப்போது உங்கள் திரையில் திறக்கிறேன்.'
      );
      return;
    }

    // 2. Apple Music / Music Library
    if (
      lower.includes('apple music') ||
      lower.includes('music library') ||
      lower.includes('open music') ||
      lower.includes('play music') ||
      lower.includes('open songs') ||
      lower.includes('song library') ||
      lower.includes('songs library') ||
      lower === 'music' ||
      lower === 'apple music' ||
      lower.includes('ஆப்பிள் மியூசிக்') ||
      lower.includes('மியூசிக்') ||
      lower.includes('பாடல்கள்')
    ) {
      if (lower.includes('full player') || (lower.includes('music player') && onOpenMusicPlayer)) {
        setIsThinking(false);
        isNavigatingRef.current = true;
        const rep = voiceLanguage.startsWith('ta') ? 'ஆப்பிள் மியூசிக் பிளேயரை திறக்கிறேன்.' : 'Opening Apple Music Player on your screen now.';
        speakWithAuro(rep);
        onOpenMusicPlayer?.();
        onClose();
        return;
      }
      executeVoiceNavigation(
        'music',
        undefined,
        'Opening Apple Music on your sovereign screen now.',
        'ஆப்பிள் மியூசிக் லைப்ரரியை இப்போது உங்கள் திரையில் திறக்கிறேன்.'
      );
      return;
    }

    // 3. Apple Book / iBooks
    if (
      lower.includes('apple book') ||
      lower.includes('apple books') ||
      lower.includes('ibooks') ||
      lower.includes('open book') ||
      lower.includes('open books') ||
      lower.includes('book library') ||
      lower.includes('books library') ||
      lower.includes('reading library') ||
      lower === 'books' ||
      lower === 'book' ||
      lower === 'ibook' ||
      lower.includes('ஆப்பிள் புக்') ||
      lower.includes('புத்தகம்') ||
      lower.includes('நூலகம்')
    ) {
      executeVoiceNavigation(
        'ibooks',
        undefined,
        'Opening Apple Books library on your sovereign screen now.',
        'ஆப்பிள் புக்ஸ் லைப்ரரியை இப்போது உங்கள் திரையில் திறக்கிறேன்.'
      );
      return;
    }

    // 4. Adobe Document Scanner (with A4 Edge Detection)
    if (
      lower.includes('document scanner') ||
      lower.includes('adobe scanner') ||
      lower.includes('adobe document scanner') ||
      lower.includes('scan document') ||
      lower.includes('scan a document') ||
      lower.includes('open scanner') ||
      lower.includes('scan pdf') ||
      lower.includes('camera scanner') ||
      lower.includes('scan receipt') ||
      lower.includes('scanner') ||
      lower.includes('டாக்குமெண்ட் ஸ்கேனர்') ||
      lower.includes('ஸ்கேனர்') ||
      lower.includes('ஸ்கேன் பண்ணு')
    ) {
      executeVoiceNavigation(
        'scanner',
        undefined,
        'Opening Adobe Document Scanner with A4 edge detection on your screen now.',
        'அடோப் டாக்குமெண்ட் ஸ்கேனரை இப்போது உங்கள் திரையில் திறக்கிறேன்.'
      );
      return;
    }

    // 5. WhatsApp
    if (
      (lower.startsWith('open whatsapp') || lower === 'whatsapp' || lower === 'open messages' || lower.includes('வாட்ஸ்அப் திற')) &&
      !lower.startsWith('reply') && !lower.startsWith('send whatsapp')
    ) {
      executeVoiceNavigation(
        'whatsapp',
        undefined,
        'Opening WhatsApp on your sovereign screen now.',
        'வாட்ஸ்அப் உரையாடல்களை இப்போது திறக்கிறேன்.'
      );
      return;
    }

    // 6. Family GPS Tracker
    if (
      lower.includes('family tracker') ||
      lower.includes('family gps') ||
      lower.includes('track family') ||
      lower.includes('where is my family') ||
      lower.includes('family location') ||
      lower.includes('open family') ||
      lower.includes('குடும்ப வரைபடம்')
    ) {
      executeVoiceNavigation(
        'family',
        undefined,
        'Opening Family Circle GPS Tracker on your screen now.',
        'குடும்ப இருப்பிட வரைபடத்தை இப்போது திறக்கிறேன்.'
      );
      return;
    }

    // 6a. Google Navigation & Offline Maps Tab
    if (
      lower === 'open navigation' ||
      lower === 'open google navigation' ||
      lower === 'navigation' ||
      lower === 'google navigation' ||
      lower === 'open maps' ||
      lower === 'நேவிகேஷன்'
    ) {
      executeVoiceNavigation(
        'navigation',
        undefined,
        'Opening Google Navigation with live GPS and offline maps.',
        'கூகுள் நேவிகேஷன் மற்றும் வழிகாட்டி திரைக்கு செல்கிறேன்.'
      );
      return;
    }

    // 6b. Custom Google Maps & Multi-Modal Offline Navigation (Bus, Train, Cycle, Car, Walk, Two-Wheeler)
    if (
      lower.includes('custom google map') ||
      lower.includes('google map') ||
      lower.includes('custom map') ||
      lower.includes('offline navigation') ||
      lower.includes('offline map') ||
      lower.includes('bus route') ||
      lower.includes('train route') ||
      lower.includes('metro route') ||
      lower.includes('cycle route') ||
      lower.includes('navigate to') ||
      lower.includes('directions to') ||
      lower.includes('route to') ||
      lower.includes('வரைபடம்') ||
      lower.includes('வழிகாட்டி')
    ) {
      // Determine transport mode
      let detectedMode: TransportMode = 'drive';
      if (lower.includes('bus') || lower.includes('பேருந்து')) detectedMode = 'transit_bus';
      else if (lower.includes('train') || lower.includes('metro') || lower.includes('rail') || lower.includes('ரயில்')) detectedMode = 'transit_train';
      else if (lower.includes('cycle') || lower.includes('bike') || lower.includes('சைக்கிள்')) detectedMode = 'bicycle';
      else if (lower.includes('walk') || lower.includes('foot') || lower.includes('நடந்து')) detectedMode = 'walk';
      else if (lower.includes('scooter') || lower.includes('two wheeler') || lower.includes('மோட்டார்')) detectedMode = 'two_wheeler';

      // Parse destination
      let destinationName = '';
      const destMatch = lower.match(/(?:navigate to|route to|directions to|go to|show route to)\s+([^by]+?)(?:\s+by|\s+via|$)/i);
      if (destMatch && destMatch[1]) {
        destinationName = destMatch[1].trim();
      }

      setIsThinking(false);
      isNavigatingRef.current = true;
      const isTamil = voiceLanguage.startsWith('ta');
      const modeLabel = detectedMode === 'transit_bus' ? 'City Bus' : detectedMode === 'transit_train' ? 'Metro / Train' : detectedMode === 'bicycle' ? 'Bicycle' : detectedMode === 'walk' ? 'Walking' : 'Car Drive';
      const rep = isTamil
        ? `கூகுள் மேப்ஸ் வழிகாட்டியை ${destinationName ? destinationName + ' நோக்கி ' : ''}${modeLabel} பாதையுடன் திறக்கிறேன்.`
        : `Opening Custom Google Maps with ${modeLabel} navigation ${destinationName ? `to ${destinationName}` : ''} and offline SQLite/Drive sync.`;

      addVoiceMessage({
        role: 'assistant',
        content: rep,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        emotion: 'attentive & organized',
        actionSuggestion: `Google Maps: ${modeLabel} ${destinationName ? `➔ ${destinationName}` : ''}`,
      });
      speakWithAuro(rep);

      if (onOpenCustomMap) {
        onOpenCustomMap({
          destination: destinationName,
          mode: detectedMode,
          autoStart: lower.includes('start') || lower.includes('navigate'),
        });
        onClose();
        return;
      }
    }

    // 7. Phone / Keypad
    if (
      lower === 'open phone' ||
      lower === 'open dialer' ||
      lower === 'keypad' ||
      lower === 'phone' ||
      lower.includes('phone dialer')
    ) {
      executeVoiceNavigation(
        'phone',
        undefined,
        'Opening Phone Dialer on your screen now.',
        'ஃபோன் டயலரை இப்போது திறக்கிறேன்.'
      );
      return;
    }

    // 8. Google Drive / Gmail / Google One
    if (lower.startsWith('open gmail') || lower === 'gmail' || lower.includes('go to gmail') || lower.includes('ஜிமெயில்')) {
      executeVoiceNavigation(
        'google',
        'gmail',
        'Opening your Gmail on screen now.',
        'ஜிமெயில் திரையை இப்போது திறக்கிறேன்.'
      );
      return;
    }
    if (lower.startsWith('open google drive') || lower.startsWith('open drive') || lower === 'google drive' || lower === 'drive' || lower.includes('டிரைவ் திற')) {
      executeVoiceNavigation(
        'google',
        'drive',
        'Opening Google Drive on screen now.',
        'கூகுள் டிரைவ் திரையை இப்போது திறக்கிறேன்.'
      );
      return;
    }
    if (lower.startsWith('open calendar') || lower === 'calendar' || lower.includes('காலண்டர்')) {
      executeVoiceNavigation(
        'google',
        'calendar',
        'Opening Google Calendar on screen now.',
        'காலண்டர் திரையை இப்போது திறக்கிறேன்.'
      );
      return;
    }
    if (lower.startsWith('open google one') || lower === 'google one') {
      executeVoiceNavigation(
        'google',
        'googleone',
        'Opening Google One Storage on screen now.',
        'கூகுள் ஒன் சேமிப்பக திரையை இப்போது திறக்கிறேன்.'
      );
      return;
    }

    // 9. Memory Vault (Zero-Knowledge)
    if (
      lower.includes('memory vault') ||
      lower.includes('open vault') ||
      lower === 'vault' ||
      lower.includes('zero knowledge vault') ||
      lower.includes('நினைவகம்')
    ) {
      executeVoiceNavigation(
        'vault',
        undefined,
        'Opening Zero-Knowledge Memory Vault on your screen now.',
        'ஜீரோ-நாலெட்ஜ் மெமரி வால்ட் திரையை இப்போது திறக்கிறேன்.'
      );
      return;
    }

    // 10. Finance Hub
    if (
      lower.includes('finance hub') ||
      lower.includes('open finance') ||
      lower === 'finance' ||
      lower.includes('financial hub') ||
      lower.includes('நிதி மையம்')
    ) {
      executeVoiceNavigation(
        'finance',
        undefined,
        'Opening Sovereign Finance Hub on your screen now.',
        'நிதி மேலாண்மை திரையை இப்போது திறக்கிறேன்.'
      );
      return;
    }

    // 11. The Billionaire Blueprint
    if (
      lower.includes('billionaire blueprint') ||
      lower.includes('billionaire') ||
      lower.includes('wealth blueprint') ||
      lower.includes('செல்வ மேலாண்மை')
    ) {
      executeVoiceNavigation(
        'billionaire',
        undefined,
        'Opening The Billionaire Blueprint wealth engine now.',
        'பில்லியனர் ப்ளூபிரிண்ட் செல்வ இயந்திரத்தை இப்போது திறக்கிறேன்.'
      );
      return;
    }

    // 12. Health & Wellness / Family Health Records
    if (
      lower.includes('open wellness') ||
      lower.includes('health hub') ||
      lower.includes('open health') ||
      lower.includes('health record') ||
      lower.includes('health records') ||
      lower.includes('medical record') ||
      lower.includes('medical records') ||
      lower.includes('medical id') ||
      lower.includes('family health') ||
      lower === 'wellness' ||
      lower === 'health' ||
      lower.includes('உடல் நலம்') ||
      lower.includes('மருத்துவ பதிவு')
    ) {
      executeVoiceNavigation(
        'wellness',
        undefined,
        'Opening Family Health Records and Wellness Hub on your sovereign screen now.',
        'குடும்ப மருத்துவ பதிவுகள் மற்றும் ஆரோக்கிய திரையை இப்போது திறக்கிறேன்.'
      );
      return;
    }

    // 13. Mood Journal
    if (
      lower.includes('mood journal') ||
      lower.includes('open mood') ||
      lower.includes('open journal') ||
      lower === 'mood' ||
      lower.includes('மனநிலை நாட்குறிப்பு')
    ) {
      executeVoiceNavigation(
        'mood',
        undefined,
        'Opening Mood Journal on your screen now.',
        'மனநிலை நாட்குறிப்பு திரையை இப்போது திறக்கிறேன்.'
      );
      return;
    }

    // 14. Writing Coach
    if (
      lower.includes('writing coach') ||
      lower.includes('open writing') ||
      lower === 'writing' ||
      lower.includes('எழுத்துப் பயிற்சி')
    ) {
      executeVoiceNavigation(
        'writing',
        undefined,
        'Opening Executive Writing Coach on your screen now.',
        'எழுத்துப் பயிற்சி திரையை இப்போது திறக்கிறேன்.'
      );
      return;
    }

    // 15. Productivity & Tasks
    if (
      lower.includes('open productivity') ||
      lower.includes('open tasks') ||
      lower === 'productivity' ||
      lower === 'tasks' ||
      lower.includes('todo list') ||
      lower.includes('பணிகள்')
    ) {
      executeVoiceNavigation(
        'productivity',
        undefined,
        'Opening Productivity & Tasks on your screen now.',
        'பணிகள் மற்றும் உற்பத்தித்திறன் திரையை இப்போது திறக்கிறேன்.'
      );
      return;
    }

    // 16. Smart Devices / RTSP Cameras
    if (
      lower.includes('smart devices') ||
      lower.includes('open devices') ||
      lower.includes('security cameras') ||
      lower.includes('rtsp') ||
      lower.includes('open cameras') ||
      lower.includes('ஸ்மார்ட் சாதனங்கள்')
    ) {
      executeVoiceNavigation(
        'devices',
        undefined,
        'Opening Smart Devices and Security Cameras on your screen now.',
        'ஸ்மார்ட் சாதனங்கள் திரையை இப்போது திறக்கிறேன்.'
      );
      return;
    }

    // 17. Text to Speech Studio
    if (
      lower.includes('text to speech') ||
      lower.includes('open tts') ||
      lower === 'tts' ||
      lower.includes('எழுத்தை ஒலியாக்கு')
    ) {
      executeVoiceNavigation(
        'tts',
        undefined,
        'Opening Text-to-Speech Studio on your screen now.',
        'டெக்ஸ்ட் டு ஸ்பீச் ஸ்டுடியோவை இப்போது திறக்கிறேன்.'
      );
      return;
    }

    // 17b. Realtime Speech to Text Studio
    if (
      lower.includes('speech to text') ||
      lower.includes('speech-to-text') ||
      lower.includes('open stt') ||
      lower.includes('realtime stt') ||
      lower.includes('dictation') ||
      lower === 'stt' ||
      lower.includes('ஸ்பீச் டு டெக்ஸ்ட்') ||
      lower.includes('குரலை எழுத்தாக்கு') ||
      lower.includes('டிரான்ஸ்கிரிப்ட்')
    ) {
      executeVoiceNavigation(
        'stt',
        undefined,
        'Opening Realtime Speech to Text Dictation Studio on your screen now.',
        'ரியல்டைம் ஸ்பீச் டு டெக்ஸ்ட் ஸ்டுடியோவை இப்போது உங்கள் திரையில் திறக்கிறேன்.'
      );
      return;
    }

    // 18. Realtime Translator
    if (
      lower.includes('open translator') ||
      lower.includes('open translation') ||
      lower === 'translator' ||
      lower === 'translate' ||
      lower.includes('மொழிபெயர்ப்பு')
    ) {
      executeVoiceNavigation(
        'translate',
        undefined,
        'Opening Realtime Sovereign Translator on your screen now.',
        'நேரலை மொழிபெயர்ப்பு திரையை இப்போது திறக்கிறேன்.'
      );
      return;
    }

    // 19. World Clock & Alarms
    if (
      lower.includes('open clock') ||
      lower.includes('open alarms') ||
      lower === 'clock' ||
      lower === 'alarms' ||
      lower.includes('கடிகாரம்')
    ) {
      executeVoiceNavigation(
        'clock',
        undefined,
        'Opening World Clock & Alarms on your screen now.',
        'கடிகாரம் மற்றும் அலாரங்கள் திரையை இப்போது திறக்கிறேன்.'
      );
      return;
    }

    // 20. Sovereign AI Studio
    if (
      lower.includes('open ai studio') ||
      lower.includes('ai studio') ||
      lower.includes('gemini studio')
    ) {
      executeVoiceNavigation(
        'ai-studio',
        undefined,
        'Opening Sovereign AI Studio on your screen now.',
        'ஏஐ ஸ்டுடியோவை இப்போது திறக்கிறேன்.'
      );
      return;
    }

    // 20b. Weather Forecast & Live GPS Radar
    if (
      lower.includes('open weather') ||
      lower.includes('weather forecast') ||
      lower.includes('weather radar') ||
      lower.includes('weather tab') ||
      lower.includes('weather screen') ||
      lower === 'weather' ||
      lower.includes('வானிலை திரை') ||
      lower.includes('வானிலை திற')
    ) {
      executeVoiceNavigation(
        'weather',
        undefined,
        'Opening Weather Forecast and Radar on your screen now.',
        'வானிலை முன்னறிவிப்பு திரையை இப்போது உங்கள் திரையில் திறக்கிறேன்.'
      );
      return;
    }

    // 20c. AI Studio Feature Sub-Tabs (Veo Video, Lyria Music, Banana/NVIDIA Image, Guided Learning, Transcribe)
    if (
      lower.includes('open video generator') ||
      lower.includes('generate video') ||
      lower.includes('create video') ||
      lower.includes('veo video') ||
      lower.includes('video studio') ||
      lower.includes('வீடியோ உருவாக்கு')
    ) {
      executeVoiceNavigation(
        'ai-studio',
        'veo-video',
        'Opening AI Video Generator powered by NVIDIA NIM & Veo 3 in AI Studio now.',
        'வீடியோ ஜெனரேட்டரை இப்போது ஏஐ ஸ்டுடியோவில் திறக்கிறேன்.'
      );
      return;
    }

    if (
      lower.includes('animate photo') ||
      lower.includes('animate image') ||
      lower.includes('photo to video') ||
      lower.includes('image to video') ||
      lower.includes('photo motion') ||
      lower.includes('புகைப்பட அசைவு')
    ) {
      executeVoiceNavigation(
        'ai-studio',
        'veo-animate',
        'Opening Photo to Video Animation Studio in AI Studio now.',
        'புகைப்பட வீடியோ அனிமேஷன் ஸ்டுடியோவை இப்போது திறக்கிறேன்.'
      );
      return;
    }

    if (
      lower.includes('open music generator') ||
      lower.includes('generate music') ||
      lower.includes('create music') ||
      lower.includes('lyria music') ||
      lower.includes('music studio') ||
      lower.includes('மியூசிக் உருவாக்கு')
    ) {
      executeVoiceNavigation(
        'ai-studio',
        'music',
        'Opening AI Music Studio powered by NVIDIA NIM and Lyria in AI Studio now.',
        'என்விடியா மற்றும் லிரியா மியூசிக் ஸ்டுடியோவை இப்போது ஏஐ ஸ்டுடியோவில் திறக்கிறேன்.'
      );
      return;
    }

    if (
      lower.includes('open image generator') ||
      lower.includes('generate image') ||
      lower.includes('create image') ||
      lower.includes('image studio') ||
      lower.includes('artwork generator') ||
      lower.includes('nvidia image') ||
      lower.includes('படம் உருவாக்கு')
    ) {
      executeVoiceNavigation(
        'ai-studio',
        'images',
        'Opening Photorealistic Image Studio in AI Studio now.',
        'இமேஜ் ஸ்டுடியோவை இப்போது திறக்கிறேன்.'
      );
      return;
    }

    if (
      lower.includes('guided learning') ||
      lower.includes('learning studio') ||
      lower.includes('learn with ai') ||
      lower.includes('வழிகாட்டப்பட்ட கற்றல்')
    ) {
      executeVoiceNavigation(
        'ai-studio',
        'guided-learning',
        'Opening Guided Learning Studio now.',
        'வழிகாட்டப்பட்ட கற்றல் திரையை இப்போது திறக்கிறேன்.'
      );
      return;
    }

    if (
      lower.includes('audio transcriber') ||
      lower.includes('transcribe audio') ||
      lower.includes('ஆடியோ டிரான்ஸ்கிரைப்')
    ) {
      executeVoiceNavigation(
        'ai-studio',
        'transcribe',
        'Opening Audio Transcriber in AI Studio now.',
        'ஆடியோ டிரான்ஸ்கிரைபரை இப்போது திறக்கிறேன்.'
      );
      return;
    }

    // 21. Cloud Billing Dashboard
    if (
      (lower.includes('open billing') || lower.includes('open cloud billing') || lower === 'billing') &&
      !lower.includes('billionaire')
    ) {
      executeVoiceNavigation(
        'billing',
        undefined,
        'Opening Google Cloud Billing Dashboard on your screen now.',
        'கிளவுட் பில்லிங் டாஷ்போர்டை இப்போது திறக்கிறேன்.'
      );
      return;
    }

    // 22. Documentation & System Guide
    if (
      lower.includes('open docs') ||
      lower.includes('open documentation') ||
      lower === 'docs'
    ) {
      executeVoiceNavigation(
        'docs',
        undefined,
        'Opening System Documentation & Architecture Guide on your screen now.',
        'ஆவணங்கள் திரையை இப்போது திறக்கிறேன்.'
      );
      return;
    }

    // 23. Home Hub
    if (
      lower === 'open home' ||
      lower === 'go home' ||
      lower === 'go to home' ||
      lower === 'home hub' ||
      lower === 'home' ||
      lower.includes('முகப்பு')
    ) {
      if (onGoHome) {
        setIsThinking(false);
        isNavigatingRef.current = true;
        const rep = voiceLanguage.startsWith('ta') ? 'முகப்புத் திரைக்குத் திரும்புகிறேன்.' : 'Returning to Home Hub now.';
        speakWithAuro(rep);
        onGoHome();
        return;
      }
      executeVoiceNavigation(
        'home',
        undefined,
        'Returning to Home Hub now.',
        'முகப்புத் திரைக்குத் திரும்புகிறேன்.'
      );
      return;
    }

    // 24. Auro Computer Vision
    if (
      lower.includes('open vision') ||
      lower.includes('auro vision') ||
      lower.includes('computer vision') ||
      lower.includes('visual assist')
    ) {
      if (onOpenVision) {
        setIsThinking(false);
        isNavigatingRef.current = true;
        const rep = voiceLanguage.startsWith('ta') ? 'ஆரோ கம்ப்யூட்டர் விஷன் திரையை திறக்கிறேன்.' : 'Opening Auro Computer Vision now.';
        speakWithAuro(rep);
        onOpenVision();
        return;
      }
    }

    // 25. Offline Sync Center
    if (
      lower.includes('open sync center') ||
      lower.includes('open offline sync') ||
      lower.includes('sync center') ||
      lower.includes('offline cache') ||
      lower.includes('ஆஃப்லைன் சின்க்')
    ) {
      if (onOpenOfflineSync) {
        setIsThinking(false);
        isNavigatingRef.current = true;
        const rep = voiceLanguage.startsWith('ta') ? 'ஆஃப்லைன் சின்க் சென்டரை திறக்கிறேன்.' : 'Opening Offline Sync Center now.';
        speakWithAuro(rep);
        onOpenOfflineSync();
        return;
      }
    }

    // 26. Global AI Engine & Model Architecture Configurator
    if (
      lower.includes('open ai engine') ||
      lower.includes('ai engine') ||
      lower.includes('model architecture') ||
      lower.includes('ai models') ||
      lower.includes('configure ai') ||
      lower.includes('nvidia model') ||
      lower.includes('gemini model') ||
      lower.includes('மாதிரி கட்டமைப்பு')
    ) {
      setIsThinking(false);
      isNavigatingRef.current = true;
      setShowGlobalAiModal(true);
      const rep = voiceLanguage.startsWith('ta')
        ? 'AI என்ஜின் மற்றும் மாடல் ஆர்க்கிடெக்சர் திரையை திறக்கிறேன்.'
        : 'Opening AI Engine and Model Architecture configuration on your screen now.';
      addVoiceMessage({
        role: 'assistant',
        content: rep,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        emotion: 'attentive & organized',
        actionSuggestion: 'Configure AI Models & Keys',
      });
      speakWithAuro(rep);
      return;
    }

    // 27. Windows Host System Assistant & Software Installer
    if (
      lower.includes('open windows assistant') ||
      lower.includes('windows assistant') ||
      lower.includes('software installer') ||
      lower.includes('install software') ||
      lower.includes('windows terminal') ||
      lower.includes('windows console') ||
      lower.includes('powershell console') ||
      lower.includes('விண்டோஸ் அசிஸ்டண்ட்')
    ) {
      setIsThinking(false);
      isNavigatingRef.current = true;
      setShowWindowsInstallerModal(true);
      const rep = voiceLanguage.startsWith('ta')
        ? 'விண்டோஸ் சிஸ்டம் அசிஸ்டண்ட் மற்றும் மென்பொருள் நிறுவி திரையை திறக்கிறேன்.'
        : 'Opening Windows System Assistant and Software Installer console on your screen now.';
      addVoiceMessage({
        role: 'assistant',
        content: rep,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        emotion: 'attentive & organized',
        actionSuggestion: 'Launch Windows System Installer',
      });
      speakWithAuro(rep);
      return;
    }
  }

    // Direct Voice-to-Call intent detection
    if (lower.startsWith('call ') || lower.includes('place a call to ') || lower.includes('make a call to ') || lower.startsWith('dial ')) {
      const targetContact = phoneContacts.find((c) =>
        lower.includes(c.name.toLowerCase().split(' ')[0]) ||
        lower.includes(c.relationship?.toLowerCase() || '___')
      );
      if (targetContact) {
        setIsThinking(false);
        speechEngine.speak(`Calling ${targetContact.name} on sovereign line now.`);
        onClose();
        startCall(targetContact, false);
        return;
      }
    }

    // Direct Apple Books library upload intent (via Google Drive & SQLite)
    const isAppleBooksUploadIntent =
      (
        lower.includes('apple book') ||
        lower.includes('apple books') ||
        lower.includes('book library') ||
        lower.includes('ibooks') ||
        lower.includes('புத்தகம்') ||
        lower.includes('புக் லைப்ரரி') ||
        (selectedFile &&
          (selectedFile.type === 'application/pdf' ||
            selectedFile.name.toLowerCase().endsWith('.pdf') ||
            selectedFile.name.toLowerCase().endsWith('.epub')) &&
          (lower.includes('book') || lower.includes('library') || lower.includes('புத்தகம்') || lower.includes('புக்')))
      ) &&
      (
        lower.includes('upload') ||
        lower.includes('save') ||
        lower.includes('add') ||
        lower.includes('store') ||
        lower.includes('put') ||
        lower.includes('சேமி') ||
        lower.includes('பதிவேற்ற') ||
        lower.includes('அப்லோட்') ||
        lower.includes('போடு') ||
        lower.includes('drive') ||
        lower.includes('டிரைவ்') ||
        lower.includes('unable to upload') ||
        lower.includes('can not upload') ||
        lower.includes('cannot upload')
      );

    if (isAppleBooksUploadIntent) {
      if (selectedFile) {
        setIsThinking(true);
        await handleUploadAttachmentToAppleBooks(selectedFile);
        setIsThinking(false);
        return;
      } else {
        appleBooksInputRef.current?.click();
        const promptMsg = voiceLanguage.startsWith('ta')
          ? 'ஆப்பிள் புக்ஸ் நூலகத்தில் பதிவேற்ற வேண்டிய PDF அல்லது புத்தகம் கோப்பைத் தேர்ந்தெடுக்கவும். நான் அதனை கூகுள் டிரைவில் (Family Circle / Apple Books) வகைப்படுத்தி உங்கள் நூலகத்தில் சேர்க்கிறேன்.'
          : 'Please select the PDF or eBook you want to upload into your Apple Books library. I will organize it in Google Drive under "Family Circle / Apple Books / [Category]" and index it in your sovereign library.';
        addVoiceMessage({
          role: 'assistant',
          content: promptMsg,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          emotion: 'helpful & attentive',
          actionSuggestion: 'Select PDF for Apple Books Library',
        });
        speakWithAuro(promptMsg);
        return;
      }
    }

    // Direct Google Drive upload attachment intent
    if (
      (lower.includes('upload') || lower.includes('save') || lower.includes('store') || lower.includes('சேமி') || lower.includes('அப்லோட்') || lower.includes('பதிவேற்ற')) &&
      (lower.includes('drive') || lower.includes('google drive') || lower.includes('டிரைவ்') || lower.includes('டிரைவில்'))
    ) {
      if (selectedFile) {
        setIsThinking(true);
        await handleUploadAttachmentToDrive(selectedFile);
        setIsThinking(false);
        return;
      } else {
        fileInputRef.current?.click();
        const promptMsg = voiceLanguage.startsWith('ta')
          ? 'உங்கள் கூகுள் டிரைவில் பதிவேற்ற விரும்பும் கோப்பை தேர்ந்தெடுக்கவும். கீழே உள்ள Paperclip பொத்தானையும் தட்டலாம்.'
          : 'Please select the file you want to upload into your Google Drive. You can tap the paperclip icon below.';
        addVoiceMessage({
          role: 'assistant',
          content: promptMsg,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          emotion: 'helpful & attentive',
          actionSuggestion: 'Attach file for Google Drive upload',
        });
        speakWithAuro(promptMsg);
        return;
      }
    }

    // =========================================================================
    // AURO VOICE INTENT: QUERY / LIST REMINDERS
    // =========================================================================
    const isQueryReminderIntent =
      /\b(my reminders|what.*reminders|check.*reminders|list.*reminders|show.*reminders|check my reminders|view.*reminders|any.*reminders)\b/i.test(lower) ||
      /(நினைவூட்டல்கள்|ரிமைண்டர்கள்)/i.test(lower);

    if (isQueryReminderIntent) {
      setIsThinking(false);
      const activeReminders = getLocalReminders().filter((r) => r.enabled && !r.completed);
      const isTamil = voiceLanguage.startsWith('ta');

      if (activeReminders.length === 0) {
        const emptyMsg = isTamil
          ? 'உங்கள் குடும்ப வட்டத்தில் நிலுவையில் உள்ள நினைவூட்டல்கள் எதுவும் இல்லை. அனைத்தும் ஒழுங்கமைக்கப்பட்டுள்ளது.'
          : 'You have no pending reminders scheduled in your Family Circle right now. Everything is clean and organized.';
        addVoiceMessage({
          role: 'assistant',
          content: emptyMsg,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          emotion: 'warm & clear',
          actionSuggestion: 'Create a reminder',
        });
        speakWithAuro(emptyMsg);
        return;
      }

      const topReminders = activeReminders.slice(0, 3);
      const listItems = topReminders
        .map((r) => `"${r.title}" at ${r.dueTime} (${r.familyMember || 'Family'})`)
        .join(', ');
      const replyText = isTamil
        ? `உங்கள் குடும்ப வட்டத்தில் ${activeReminders.length} நினைவூட்டல்கள் உள்ளன. முதலாவதாக: ${listItems}.`
        : `You have ${activeReminders.length} active reminder${
            activeReminders.length === 1 ? '' : 's'
          } in your Family Circle. Scheduled: ${listItems}.`;

      addVoiceMessage({
        role: 'assistant',
        content: replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        emotion: 'attentive & organized',
        actionSuggestion: 'Open Clock & Reminders',
      });
      speakWithAuro(replyText);
      return;
    }

    // =========================================================================
    // AURO VOICE INTENT: CREATE / SET REMINDER (FAMILY CIRCLE & DRIVE SYNC)
    // =========================================================================
    const isCreateReminderIntent =
      /\b(remind\s+(me|us|my|selvi|maaran|kavinmozhi|grandma|grandparents|chinna|chinnathambi)?\s*(to|about)?|set\s+a?\s*reminder|add\s+a?\s*reminder|create\s+a?\s*reminder|new\s+reminder|put\s+a?\s*reminder|make\s+a?\s*reminder|schedule\s+a?\s*reminder)\b/i.test(lower) ||
      /(நினைவூட்டல்\s*(அமை|வை|செய்|உருவாக்கு|போடு)?|நினைவூட்டு|ரிமைண்டர்\s*(வை|செட்|போடு)?)/i.test(lower);

    if (isCreateReminderIntent) {
      setIsThinking(false);

      const now = new Date();
      let dueDate = now.toISOString().split('T')[0];
      let hours = now.getHours();
      let minutes = now.getMinutes();

      // Check tomorrow
      if (lower.includes('tomorrow') || lower.includes('நாளை')) {
        const tmrw = new Date();
        tmrw.setDate(tmrw.getDate() + 1);
        dueDate = tmrw.toISOString().split('T')[0];
      }

      // Check target family member
      let familyMember = 'All Family Circle';
      if (
        lower.includes('grandma') ||
        lower.includes('grandparent') ||
        lower.includes('பாட்டி') ||
        lower.includes('தாத்தா')
      ) {
        familyMember = 'Grandparents';
      } else if (lower.includes('selvi') || lower.includes('செல்வி')) {
        familyMember = 'Selvi';
      } else if (lower.includes('maaran') || lower.includes('மாறன்')) {
        familyMember = 'Maaran';
      } else if (lower.includes('kavinmozhi') || lower.includes('கவின்மொழி')) {
        familyMember = 'Kavinmozhi';
      } else if (
        lower.includes('chinna') ||
        lower.includes('chinnathambi') ||
        lower.includes('சின்னத்தம்பி')
      ) {
        familyMember = 'Chinnathambi';
      }

      // Parse time: e.g. "at 5 pm", "at 6:30", "at 18:00", "at 9 am"
      const timeMatch = lower.match(/(?:at\s+|நேரம்\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm|காலை|மாலை)?/i);
      if (timeMatch) {
        let h = parseInt(timeMatch[1], 10);
        const m = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
        const meridian = timeMatch[3] ? timeMatch[3].toLowerCase() : '';

        if ((meridian === 'pm' || meridian === 'மாலை') && h < 12) h += 12;
        if ((meridian === 'am' || meridian === 'காலை') && h === 12) h = 0;

        hours = h;
        minutes = m;
      } else {
        // Default to next hour
        hours = (hours + 1) % 24;
        minutes = 0;
      }

      const dueTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

      // Clean title
      let title = spokenText
        .replace(
          /^(hey auro|auro|please|கட்டளையிடு|can you|could you|i want to|i need to)?\s*(remind\s+(me|us|my|selvi|maaran|kavinmozhi|grandma|grandparents|chinna|chinnathambi)?\s*(to|about)?|set\s+a?\s*reminder\s*(for|to)?|add\s+a?\s*reminder\s*(for|to)?|create\s+a?\s*reminder\s*(for|to)?|new\s+reminder\s*(for|to)?|schedule\s+a?\s*reminder\s*(for|to)?|put\s+a?\s*reminder\s*(for|to)?|make\s+a?\s*reminder\s*(for|to)?|நினைவூட்டல்\s*(அமை|வை|செய்|உருவாக்கு|போடு)?|நினைவூட்டு|ரிமைண்டர்\s*(வை|செட்|போடு)?)\s*/i,
          ''
        )
        .replace(/(?:at\s+|நேரம்\s+)?\d{1,2}(?::\d{2})?\s*(?:am|pm|காலை|மாலை)?/gi, '')
        .replace(/\b(tomorrow|today|tonight|this evening|this morning|நாளை|இன்று)\b/gi, '')
        .replace(/\b(for\s+(grandma|grandparents|selvi|maaran|kavinmozhi|chinnathambi|all family))\b/gi, '')
        .trim();

      if (!title) {
        title = 'Family Circle Reminder';
      }

      const activeToken =
        googleAccessToken ||
        (typeof window !== 'undefined'
          ? localStorage.getItem('aura_google_access_token') || localStorage.getItem('google_access_token')
          : null);

      try {
        const created = await createReminder(
          {
            title,
            dueDate,
            dueTime,
            familyMember,
            targetFamilyMember: familyMember,
            category: familyMember !== 'All Family Circle' ? 'family' : 'personal',
            voiceAlert: true,
            sound: 'gentle',
          },
          activeToken,
          user.email || 'chinna.tamil2000@gmail.com'
        );

        // Instant reactive UI update
        window.dispatchEvent(new CustomEvent('aura_reminders_changed', { detail: getLocalReminders() }));

        const isTamil = voiceLanguage.startsWith('ta');
        const replyText = isTamil
          ? `உங்கள் நினைவூட்டல் "${title}" ${dueTime} மணிக்கு அமைக்கப்பட்டு ஆப் நினைவூட்டல் மற்றும் கூகுள் டிரைவ் குடும்ப வட்டத்தில் (Family Circle/Reminders) ஒத்திசைக்கப்பட்டது.`
          : `I have scheduled your reminder for "${title}" on ${
              dueDate === new Date().toISOString().split('T')[0] ? 'today' : 'tomorrow'
            } at ${dueTime} for ${familyMember}, and stored it locally in SQLite and synchronized it with your Family Circle Google Drive.`;

        addVoiceMessage({
          role: 'assistant',
          content: replyText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          emotion: 'attentive & organized',
          actionSuggestion: `View Reminder: "${title}"`,
        });
        speakWithAuro(replyText);
        return;
      } catch (remErr) {
        console.warn('Voice reminder create error:', remErr);
      }
    }

    // =========================================================================
    // AURO VOICE INTENT: HEALTH RECORD QUERY (VITALS, BLOOD TYPE, ALLERGIES)
    // =========================================================================
    const isHealthQueryIntent =
      /\b(blood\s+(type|group)|what.*blood|my\s+blood|latest\s+vitals|check.*vitals|check.*blood\s+pressure|what.*blood\s+pressure|check.*bp|what.*allerg|any.*allerg|medical\s+id|health\s+record|medical\s+record)\b/i.test(lower) ||
      /(இரத்த\s*வகை|இரத்த\s*அழுத்தம்|உடல்\s*நலம்|மருத்துவ\s*பதிவு|அலர்ஜி)/i.test(lower);

    if (isHealthQueryIntent) {
      setIsThinking(false);
      const isTamil = voiceLanguage.startsWith('ta');
      const healthRecords = getLocalHealthRecords();

      // Identify member
      let targetMember = healthRecords[0];
      if (lower.includes('grandma') || lower.includes('grandparent') || lower.includes('பாட்டி') || lower.includes('தாத்தா')) {
        targetMember = healthRecords.find((r) => r.memberName.toLowerCase().includes('grandparent')) || healthRecords[4] || healthRecords[0];
      } else if (lower.includes('selvi') || lower.includes('செல்வி') || lower.includes('wife') || lower.includes('spouse')) {
        targetMember = healthRecords.find((r) => r.memberName.toLowerCase().includes('selvi')) || healthRecords[1] || healthRecords[0];
      } else if (lower.includes('maaran') || lower.includes('மாறன்') || lower.includes('son')) {
        targetMember = healthRecords.find((r) => r.memberName.toLowerCase().includes('maaran')) || healthRecords[2] || healthRecords[0];
      } else if (lower.includes('kavinmozhi') || lower.includes('கவின்மொழி') || lower.includes('daughter')) {
        targetMember = healthRecords.find((r) => r.memberName.toLowerCase().includes('kavinmozhi')) || healthRecords[3] || healthRecords[0];
      }

      // 1. Blood group query
      if (lower.includes('blood') || lower.includes('இரத்த')) {
        const reply = isTamil
          ? `${targetMember.memberName} அவர்களின் இரத்த வகை ${targetMember.bloodGroup} ஆகும். இது குடும்ப மருத்துவ பதிவேட்டில் பதிவு செய்யப்பட்டுள்ளது.`
          : `${targetMember.memberName}'s blood group is ${targetMember.bloodGroup}. This is verified in your Family Health Vault and Google Drive.`;
        addVoiceMessage({
          role: 'assistant',
          content: reply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          emotion: 'helpful & attentive',
          actionSuggestion: 'Open Family Health Records',
        });
        speakWithAuro(reply);
        return;
      }

      // 2. Allergies query
      if (lower.includes('allerg') || lower.includes('அலர்ஜி')) {
        const allergyList = targetMember.allergies.map((a) => `${a.allergen} (${a.severity})`).join(', ');
        const reply = isTamil
          ? `${targetMember.memberName} அவர்களின் அலர்ஜி பதிவுகள்: ${allergyList || 'எந்த ஒவ்வாமையும் பதிவாகவில்லை'}.`
          : `${targetMember.memberName} has ${targetMember.allergies.length} recorded allergies: ${allergyList || 'None known'}.`;
        addVoiceMessage({
          role: 'assistant',
          content: reply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          emotion: 'helpful & attentive',
          actionSuggestion: 'Open Medical ID',
        });
        speakWithAuro(reply);
        return;
      }

      // 3. Vitals query
      const latestV = targetMember.vitalsHistory?.[0];
      if (latestV) {
        const bpText = latestV.systolicBp && latestV.diastolicBp ? `${latestV.systolicBp}/${latestV.diastolicBp} mmHg` : 'Not recorded';
        const hrText = latestV.heartRate ? `${latestV.heartRate} bpm` : 'Normal';
        const reply = isTamil
          ? `${targetMember.memberName} அவர்களின் சமீபத்திய ரத்த அழுத்தம் ${bpText}, இதயத் துடிப்பு ${hrText} ஆகும்.`
          : `${targetMember.memberName}'s latest recorded vitals: Blood Pressure is ${bpText}, Pulse is ${hrText}, SpO2 is ${latestV.oxygenSpO2 || 99}%. Everything is stable in your Family Health Vault.`;
        addVoiceMessage({
          role: 'assistant',
          content: reply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          emotion: 'warm & clear',
          actionSuggestion: 'View Vitals in Health Hub',
        });
        speakWithAuro(reply);
        return;
      }
    }

    // =========================================================================
    // AURO VOICE INTENT: RECORD VITALS (BP, PULSE, GLUCOSE)
    // =========================================================================
    const isRecordVitalsIntent =
      /\b(record\s+blood\s+pressure|log\s+blood\s+pressure|add\s+blood\s+pressure|record\s+bp|log\s+bp|add\s+bp|record\s+vitals|log\s+vitals)\b/i.test(lower) ||
      /(இரத்த\s*அழுத்தம்\s*(பதிவு|சேர்)|பிபி\s*பதிவு)/i.test(lower);

    if (isRecordVitalsIntent) {
      setIsThinking(false);
      const isTamil = voiceLanguage.startsWith('ta');
      const healthRecords = getLocalHealthRecords();

      let targetMember = healthRecords[0];
      if (lower.includes('grandma') || lower.includes('grandparent') || lower.includes('பாட்டி') || lower.includes('தாத்தா')) {
        targetMember = healthRecords.find((r) => r.memberName.toLowerCase().includes('grandparent')) || healthRecords[4] || healthRecords[0];
      } else if (lower.includes('selvi') || lower.includes('செல்வி')) {
        targetMember = healthRecords.find((r) => r.memberName.toLowerCase().includes('selvi')) || healthRecords[1] || healthRecords[0];
      } else if (lower.includes('maaran') || lower.includes('மாறன்')) {
        targetMember = healthRecords.find((r) => r.memberName.toLowerCase().includes('maaran')) || healthRecords[2] || healthRecords[0];
      }

      // Extract numbers: e.g. "120 over 80", "120/80", "130 by 85", "125 and 82"
      const bpMatch = lower.match(/(\d{2,3})\s*(?:over|\/|by|and|,)\s*(\d{2,3})/i);
      const systolic = bpMatch ? parseInt(bpMatch[1], 10) : 120;
      const diastolic = bpMatch ? parseInt(bpMatch[2], 10) : 80;

      // Extract heart rate if present: e.g. "pulse 72", "heart rate 74"
      const hrMatch = lower.match(/(?:pulse|heart rate|துடிப்பு)\s*(\d{2,3})/i);
      const pulse = hrMatch ? parseInt(hrMatch[1], 10) : 72;

      void addVitalSignToMember(
        targetMember.memberId,
        {
          recordedBy: 'AURO Voice Assistant',
          systolicBp: systolic,
          diastolicBp: diastolic,
          heartRate: pulse,
          oxygenSpO2: 99,
          notes: `Spoken log via AURO: BP ${systolic}/${diastolic} mmHg`,
        },
        user?.email
      );

      const reply = isTamil
        ? `${targetMember.memberName} அவர்களுக்கு இரத்த அழுத்தம் ${systolic}/${diastolic} mmHg வெற்றிகரமாக பதிவு செய்யப்பட்டு Google Drive மற்றும் SQLite-ல் சேமிக்கப்பட்டது.`
        : `Recorded blood pressure ${systolic}/${diastolic} mmHg (Pulse: ${pulse} bpm) for ${targetMember.memberName}. Saved into local SQLite and synchronized with Google Drive under Family Circle/Health And Wellness/Family Heath Record.`;

      addVoiceMessage({
        role: 'assistant',
        content: reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        emotion: 'attentive & organized',
        actionSuggestion: 'Open Health & Wellness Hub',
      });
      speakWithAuro(reply);
      return;
    }

    // =========================================================================
    // AURO VOICE INTENT: PRINT FEVER REPORT & CLINICAL CHART
    // =========================================================================
    const isPrintFeverIntent =
      /\b(print\s+(fever|temperature|medical|health)\s+(report|chart|graph|sheet|summary)|print.*fever|print.*temperature)\b/i.test(lower) ||
      /(காய்ச்சல்\s*(அறிக்கை|விவரம்)\s*பிரிண்ட்|பிரிண்ட்\s*காய்ச்சல்)/i.test(lower);

    if (isPrintFeverIntent) {
      setIsThinking(false);
      const isTamil = voiceLanguage.startsWith('ta');
      const healthRecords = getLocalHealthRecords();

      let targetMember = healthRecords[0];
      if (lower.includes('mithran') || lower.includes('மித்ரன்')) {
        targetMember = healthRecords.find((r) => r.memberName.toLowerCase().includes('mithran')) || targetMember;
      } else if (lower.includes('maaran') || lower.includes('மாறன்') || lower.includes('son')) {
        targetMember = healthRecords.find((r) => r.memberName.toLowerCase().includes('maaran')) || targetMember;
      } else if (lower.includes('sangeetha') || lower.includes('சங்கீதா') || lower.includes('wife')) {
        targetMember = healthRecords.find((r) => r.memberName.toLowerCase().includes('sangeetha')) || targetMember;
      } else if (lower.includes('selvi') || lower.includes('செல்வி')) {
        targetMember = healthRecords.find((r) => r.memberName.toLowerCase().includes('selvi')) || targetMember;
      }

      const reply = isTamil
        ? `${targetMember.memberName} அவர்களின் காய்ச்சல் அறிக்கை மற்றும் வெப்பநிலை வரைபடம் அச்சுப்பொறிக்கு (Print) தயாராகிறது.`
        : `Opening printable clinical fever report and temperature chart for ${targetMember.memberName} for your doctor consultation.`;

      addVoiceMessage({
        role: 'assistant',
        content: reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        emotion: 'attentive & organized',
        actionSuggestion: 'Print Clinical Fever Sheet',
      });
      speakWithAuro(reply);

      if (onOpenFeverTracker) {
        onOpenFeverTracker({
          memberId: targetMember.memberId,
          memberName: targetMember.memberName,
          autoPrint: true,
        });
      }
      return;
    }

    // =========================================================================
    // AURO VOICE INTENT: FEVER GRAPH / TEMPERATURE TREND QUERY
    // =========================================================================
    const isFeverGraphIntent =
      /\b(show\s+(fever|temperature)\s*(graph|chart|trend|history)|view\s+(fever|temperature)\s*(graph|chart)|check\s+fever|how\s+is.*fever|fever\s+status|temperature\s+chart|fever\s+tracker)\b/i.test(lower) ||
      /(காய்ச்சல்\s*(வரைபடம்|விவரம்|நிலை)|வெப்பநிலை\s*வரைபடம்)/i.test(lower);

    if (isFeverGraphIntent) {
      setIsThinking(false);
      const isTamil = voiceLanguage.startsWith('ta');
      const healthRecords = getLocalHealthRecords();

      let targetMember = healthRecords.find((r) => r.memberName.toLowerCase().includes('mithran')) || healthRecords[0];
      if (lower.includes('mithran') || lower.includes('மித்ரன்')) {
        targetMember = healthRecords.find((r) => r.memberName.toLowerCase().includes('mithran')) || targetMember;
      } else if (lower.includes('maaran') || lower.includes('மாறன்') || lower.includes('son')) {
        targetMember = healthRecords.find((r) => r.memberName.toLowerCase().includes('maaran')) || targetMember;
      } else if (lower.includes('sangeetha') || lower.includes('சங்கீதா')) {
        targetMember = healthRecords.find((r) => r.memberName.toLowerCase().includes('sangeetha')) || targetMember;
      } else if (lower.includes('selvi') || lower.includes('செல்வி')) {
        targetMember = healthRecords.find((r) => r.memberName.toLowerCase().includes('selvi')) || targetMember;
      } else if (lower.includes('chinnathambi') || lower.includes('சின்னத்தம்பி') || lower.includes('my')) {
        targetMember = healthRecords.find((r) => r.memberName.toLowerCase().includes('chinnathambi')) || targetMember;
      }

      const memberLogs = getLocalFeverLogs(targetMember.memberId);
      const latest = memberLogs[0];
      const peak = memberLogs.length > 0 ? Math.max(...memberLogs.map((l) => l.temperatureF)) : null;

      let summaryText = latest
        ? `Latest temperature is ${latest.temperatureF}°F (${latest.temperatureC}°C, ${latest.severity} severity). Peak recorded was ${peak}°F.`
        : 'No fever recorded recently.';

      const reply = isTamil
        ? `${targetMember.memberName} அவர்களின் காய்ச்சல் வரைபடம் திறக்கப்படுகிறது. ${latest ? `சமீபத்திய வெப்பநிலை ${latest.temperatureF}°F ஆகும்.` : ''}`
        : `Opening interactive fever curve for ${targetMember.memberName}. ${summaryText} Stored in Google Drive and local SQLite.`;

      addVoiceMessage({
        role: 'assistant',
        content: reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        emotion: 'caring & diagnostic',
        actionSuggestion: 'View Interactive Fever Graph',
      });
      speakWithAuro(reply);

      if (onOpenFeverTracker) {
        onOpenFeverTracker({
          memberId: targetMember.memberId,
          memberName: targetMember.memberName,
        });
      }
      return;
    }

    // =========================================================================
    // AURO VOICE INTENT: RECORD FEVER TEMPERATURE (°F / °C)
    // =========================================================================
    const isRecordFeverIntent =
      /\b(record\s+(fever|temperature)|log\s+(fever|temperature)|add\s+(fever|temperature)|fever\s+(is|was|of|record)|temperature\s+(is|was|of|recorded)|take\s+temperature|logged\s+fever)\b/i.test(lower) ||
      /(காய்ச்சல்\s*(பதிவு|அளவு|சேர்)|வெப்பநிலை\s*(பதிவு|சேர்))/i.test(lower);

    if (isRecordFeverIntent) {
      setIsThinking(false);
      const isTamil = voiceLanguage.startsWith('ta');
      const healthRecords = getLocalHealthRecords();

      let targetMember = healthRecords[0];
      if (lower.includes('mithran') || lower.includes('மித்ரன்')) {
        targetMember = healthRecords.find((r) => r.memberName.toLowerCase().includes('mithran')) || targetMember;
      } else if (lower.includes('maaran') || lower.includes('மாறன்') || lower.includes('son')) {
        targetMember = healthRecords.find((r) => r.memberName.toLowerCase().includes('maaran')) || targetMember;
      } else if (lower.includes('sangeetha') || lower.includes('சங்கீதா') || lower.includes('wife')) {
        targetMember = healthRecords.find((r) => r.memberName.toLowerCase().includes('sangeetha')) || targetMember;
      } else if (lower.includes('selvi') || lower.includes('செல்வி')) {
        targetMember = healthRecords.find((r) => r.memberName.toLowerCase().includes('selvi')) || targetMember;
      } else if (lower.includes('chinnathambi') || lower.includes('சின்னத்தம்பி')) {
        targetMember = healthRecords.find((r) => r.memberName.toLowerCase().includes('chinnathambi')) || targetMember;
      }

      let tempF = 100.4;
      const celsiusMatch = lower.match(/(\d{2}(?:\.\d)?)\s*(?:c|celsius|சென்டிகிரேட்)/i);
      const fahrMatch = lower.match(/(\d{2,3}(?:\.\d)?)\s*(?:f|fahrenheit|degrees|டிகிரி)?/i);

      if (celsiusMatch) {
        const valC = parseFloat(celsiusMatch[1]);
        tempF = celsiusToFahrenheit(valC);
      } else if (fahrMatch) {
        const valF = parseFloat(fahrMatch[1]);
        if (valF > 50) {
          tempF = valF;
        } else if (valF >= 35 && valF <= 43) {
          tempF = celsiusToFahrenheit(valF);
        }
      }

      const symptoms: string[] = [];
      if (lower.includes('chill') || lower.includes('shiver') || lower.includes('குளிர்')) symptoms.push('Chills & Shivering');
      if (lower.includes('headache') || lower.includes('தலைவலி')) symptoms.push('Headache');
      if (lower.includes('body ache') || lower.includes('உடல் வலி')) symptoms.push('Body Ache');
      if (lower.includes('cough') || lower.includes('இருமல்')) symptoms.push('Cough');

      let medicationGiven: { name: string; dose: string; givenAt: string } | undefined;
      if (lower.includes('paracetamol') || lower.includes('crocin') || lower.includes('calpol')) {
        medicationGiven = {
          name: 'Paracetamol',
          dose: '1 standard dose',
          givenAt: new Date().toISOString(),
        };
      } else if (lower.includes('ibuprofen') || lower.includes('ibugesic')) {
        medicationGiven = {
          name: 'Ibuprofen',
          dose: '1 standard dose',
          givenAt: new Date().toISOString(),
        };
      }

      void recordFeverTemperature({
        memberId: targetMember.memberId,
        memberName: targetMember.memberName,
        temperatureF: tempF,
        measurementMethod: 'forehead',
        symptoms,
        medicationGiven,
        recordedBy: 'AURO Voice Assistant',
        notes: `Spoken entry recorded via AURO Assistant: "${lower}"`,
      });

      const severity = calculateFeverSeverity(tempF);
      const reply = isTamil
        ? `${targetMember.memberName} அவர்களுக்கு காய்ச்சல் வெப்பநிலை ${tempF}°F வெற்றிகரமாக பதிவு செய்யப்பட்டது. நிலைமை: ${severity}. விவரங்கள் Google Drive மற்றும் SQLite-ல் ஒத்திசைக்கப்பட்டது.`
        : `Recorded fever temperature of ${tempF}°F for ${targetMember.memberName} (${severity.toUpperCase()} category). Stored in local SQLite and synced to Google Drive under Family Circle/Health And Wellness/Family Heath Record/Fever Logs.`;

      addVoiceMessage({
        role: 'assistant',
        content: reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        emotion: 'diagnostic & warm',
        actionSuggestion: 'View Fever Graph & Chart',
      });
      speakWithAuro(reply);

      if (onOpenFeverTracker) {
        onOpenFeverTracker({
          memberId: targetMember.memberId,
          memberName: targetMember.memberName,
          temperatureF: tempF,
        });
      }
      return;
    }

    // =========================================================================
    // AURO VOICE INTENT: SMART MEDICATION & SUPPLEMENT STATUS / DUE REMINDER
    // =========================================================================
    const isMedicationQueryIntent =
      /\b(medication\s+(due|status|schedule|reminder|list)|what.*(medicine|medication|pill|supplement|tablet)|check.*(medicine|medication|pill|supplement)|any.*(medicine|pill|supplement)|pills.*today|supplement.*today)\b/i.test(lower) ||
      /(மருந்து\s*நினைவூட்டல்|இன்றைய\s*மாத்திரைகள்|மருந்துகள்\s*என்ன)/i.test(lower);

    if (isMedicationQueryIntent) {
      setIsThinking(false);
      const isTamil = voiceLanguage.startsWith('ta');
      const healthRecords = getLocalHealthRecords();

      let targetMember = healthRecords[0];
      if (lower.includes('mithran') || lower.includes('மித்ரன்')) {
        targetMember = healthRecords.find((r) => r.memberName.toLowerCase().includes('mithran')) || targetMember;
      } else if (lower.includes('maaran') || lower.includes('மாறன்') || lower.includes('son')) {
        targetMember = healthRecords.find((r) => r.memberName.toLowerCase().includes('maaran')) || targetMember;
      } else if (lower.includes('selvi') || lower.includes('செல்வி') || lower.includes('wife')) {
        targetMember = healthRecords.find((r) => r.memberName.toLowerCase().includes('selvi')) || targetMember;
      } else if (lower.includes('sangeetha') || lower.includes('சங்கீதா')) {
        targetMember = healthRecords.find((r) => r.memberName.toLowerCase().includes('sangeetha')) || targetMember;
      }

      const status = getTodayDoseStatusForMember(targetMember.memberId);
      const memberMeds = targetMember.medications || [];

      let reply = '';
      if (memberMeds.length === 0) {
        reply = isTamil
          ? `${targetMember.memberName} அவர்களுக்கு தற்போது மாத்திரைகள் எதுவும் பதிவு செய்யப்படவில்லை.`
          : `No active medications or supplements scheduled for ${targetMember.memberName}. You can add supplements in the Smart Meds Tracker.`;
      } else {
        const pendingItems: string[] = [];
        const takenItems: string[] = [];

        (['morning', 'afternoon', 'evening', 'bedtime'] as const).forEach((slot) => {
          status.slots[slot].forEach((item) => {
            if (item.status === 'taken') {
              takenItems.push(`${item.med.drugName} (${slot})`);
            } else {
              pendingItems.push(`${item.med.drugName} (${slot})`);
            }
          });
        });

        if (isTamil) {
          reply = `${targetMember.memberName} அவர்களின் இன்றைய மருந்து நிலவரம்: ${takenItems.length} மாத்திரைகள் எடுக்கப்பட்டுள்ளன. இன்னும் ${pendingItems.length} மாத்திரைகள் (${pendingItems.join(', ') || 'எதுவுமில்லை'}) எடுக்க வேண்டியுள்ளது. இன்றைய பின்பற்றுதல் வீதம் ${status.adherenceRate}% ஆகும்.`;
        } else {
          reply = `For ${targetMember.memberName}, today's adherence is ${status.adherenceRate}%. ${
            takenItems.length > 0 ? `Completed: ${takenItems.join(', ')}. ` : 'No doses taken yet. '
          }${
            pendingItems.length > 0
              ? `Pending: ${pendingItems.join(', ')}. Say "Auro, log that I took my pill" after taking it.`
              : 'All scheduled doses for today have been completed!'
          }`;
        }
      }

      addVoiceMessage({
        role: 'assistant',
        content: reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        emotion: 'attentive & encouraging',
        actionSuggestion: 'Open Smart Meds & Supplements',
      });
      speakWithAuro(reply);
      return;
    }

    // =========================================================================
    // AURO VOICE INTENT: LOG TAKEN MEDICATION / SUPPLEMENT DOSE
    // =========================================================================
    const isLogMedDoseIntent =
      /\b(took|taken|log.*(medicine|medication|pill|supplement|dose|tablet|vitamin|omega|magnesium)|mark.*(taken|done)|swallowed|administered)\b/i.test(lower) ||
      /(மாத்திரை\s*எடுத்தாச்சு|வைட்டமின்\s*எடுத்தாச்சு|மருந்து\s*சாப்பிட்டாச்சு)/i.test(lower);

    if (isLogMedDoseIntent) {
      setIsThinking(false);
      const isTamil = voiceLanguage.startsWith('ta');
      const healthRecords = getLocalHealthRecords();

      let targetMember = healthRecords[0];
      if (lower.includes('mithran') || lower.includes('மித்ரன்')) {
        targetMember = healthRecords.find((r) => r.memberName.toLowerCase().includes('mithran')) || targetMember;
      } else if (lower.includes('maaran') || lower.includes('மாறன்') || lower.includes('son')) {
        targetMember = healthRecords.find((r) => r.memberName.toLowerCase().includes('maaran')) || targetMember;
      } else if (lower.includes('selvi') || lower.includes('செல்வி') || lower.includes('wife')) {
        targetMember = healthRecords.find((r) => r.memberName.toLowerCase().includes('selvi')) || targetMember;
      } else if (lower.includes('sangeetha') || lower.includes('சங்கீதா')) {
        targetMember = healthRecords.find((r) => r.memberName.toLowerCase().includes('sangeetha')) || targetMember;
      }

      const meds = targetMember.medications || [];
      // Match drug name in utterance
      let matchedMed = meds.find((m) =>
        lower.includes(m.drugName.toLowerCase()) ||
        (m.drugName.toLowerCase().includes('vitamin d') && lower.includes('vitamin')) ||
        (m.drugName.toLowerCase().includes('omega') && lower.includes('omega')) ||
        (m.drugName.toLowerCase().includes('magnesium') && lower.includes('magnesium')) ||
        (m.drugName.toLowerCase().includes('metformin') && lower.includes('metformin')) ||
        (m.drugName.toLowerCase().includes('multivitamin') && lower.includes('multi'))
      );

      // Determine timeSlot
      const currentHour = new Date().getHours();
      let slot: 'morning' | 'afternoon' | 'evening' | 'bedtime' = 'morning';
      if (lower.includes('bedtime') || lower.includes('night') || currentHour >= 21) {
        slot = 'bedtime';
      } else if (lower.includes('evening') || lower.includes('dinner') || currentHour >= 17) {
        slot = 'evening';
      } else if (lower.includes('afternoon') || lower.includes('lunch') || currentHour >= 12) {
        slot = 'afternoon';
      }

      // If no specific med named, pick first pending med for this slot or first med
      if (!matchedMed && meds.length > 0) {
        matchedMed = meds.find((m) => m.timeSlots.includes(slot)) || meds[0];
      }

      if (matchedMed) {
        void logMedicationDose({
          memberId: targetMember.memberId,
          memberName: targetMember.memberName,
          medicationId: matchedMed.id,
          drugName: matchedMed.drugName,
          category: matchedMed.category,
          dosage: matchedMed.dosage,
          timeSlot: slot,
          scheduledTime: matchedMed.scheduledTime,
          status: 'taken',
          loggedBy: 'Auro Voice Assistant',
          notes: `Confirmed via Auro voice command: "${lower}"`,
        });

        const remainingText =
          matchedMed.pillsRemaining !== undefined
            ? ` (${Math.max(0, matchedMed.pillsRemaining - 1)} doses remaining in bottle)`
            : '';

        const reply = isTamil
          ? `${targetMember.memberName} அவர்களுக்கு ${matchedMed.drugName} (${matchedMed.dosage}) மருந்து வெற்றிகரமாக பதிவு செய்யப்பட்டது${remainingText}. Google Drive மற்றும் SQLite-ல் சேமிக்கப்பட்டது.`
          : `Logged ${matchedMed.drugName} (${matchedMed.dosage}) as taken for ${targetMember.memberName}${remainingText}. Synced to local SQLite and Google Drive. Great job staying consistent with your health routine!`;

        addVoiceMessage({
          role: 'assistant',
          content: reply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          emotion: 'warm & motivating',
          actionSuggestion: 'View Smart Meds Tracker',
        });
        speakWithAuro(reply);
        return;
      }
    }

    // =========================================================================
    // AURO VOICE INTENT: HYDRATION INTAKE QUERY
    // =========================================================================
    const isHydrationQueryIntent =
      /\b(how\s+much\s+water|water\s+(intake|drank|goal|status)|check.*hydration|hydration\s+status|water.*today)\b/i.test(lower) ||
      /(தண்ணீர்\s*அளவு|ஹைட்ரேஷன்\s*நிலை|எவ்வளவு\s*தண்ணீர்)/i.test(lower);

    if (isHydrationQueryIntent) {
      setIsThinking(false);
      const isTamil = voiceLanguage.startsWith('ta');
      const healthRecords = getLocalHealthRecords();

      let targetMember = healthRecords[0];
      if (lower.includes('mithran') || lower.includes('மித்ரன்')) {
        targetMember = healthRecords.find((r) => r.memberName.toLowerCase().includes('mithran')) || targetMember;
      } else if (lower.includes('maaran') || lower.includes('மாறன்') || lower.includes('son')) {
        targetMember = healthRecords.find((r) => r.memberName.toLowerCase().includes('maaran')) || targetMember;
      } else if (lower.includes('selvi') || lower.includes('செல்வி') || lower.includes('wife')) {
        targetMember = healthRecords.find((r) => r.memberName.toLowerCase().includes('selvi')) || targetMember;
      } else if (lower.includes('sangeetha') || lower.includes('சங்கீதா')) {
        targetMember = healthRecords.find((r) => r.memberName.toLowerCase().includes('sangeetha')) || targetMember;
      }

      const summary = getTodayHydrationSummary(targetMember.memberId);
      const reply = isTamil
        ? `${targetMember.memberName} அவர்களின் இன்றைய தண்ணீர் உட்கொள்ளல்: ${summary.totalDrankMl} mL / ${summary.dailyGoalMl} mL (${summary.progressPercent}%). இன்னும் ${summary.remainingMl} mL தண்ணீர் குடிக்க வேண்டும்.`
        : `For ${targetMember.memberName}, you have consumed ${summary.totalDrankMl} mL of fluids today towards your ${summary.dailyGoalMl} mL target (${summary.progressPercent}%). You need ${summary.remainingMl} mL more to reach 100%.`;

      addVoiceMessage({
        role: 'assistant',
        content: reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        emotion: 'refreshing & attentive',
        actionSuggestion: 'Open Hydration Tracker',
      });
      speakWithAuro(reply);
      return;
    }

    // =========================================================================
    // AURO VOICE INTENT: LOG HYDRATION WATER INTAKE VIA VOICE
    // =========================================================================
    const isLogHydrationIntent =
      /\b(log.*(water|hydration|fluid)|drank.*(water|fluid|glass|bottle|coconut|electrolyte)|drink.*water|add.*(water|hydration))\b/i.test(lower) ||
      /(தண்ணீர்\s*குடித்தேன்|தண்ணீர்\s*(பதிவு|சேர்))/i.test(lower);

    if (isLogHydrationIntent) {
      setIsThinking(false);
      const isTamil = voiceLanguage.startsWith('ta');
      const healthRecords = getLocalHealthRecords();

      let targetMember = healthRecords[0];
      if (lower.includes('mithran') || lower.includes('மித்ரன்')) {
        targetMember = healthRecords.find((r) => r.memberName.toLowerCase().includes('mithran')) || targetMember;
      } else if (lower.includes('maaran') || lower.includes('மாறன்') || lower.includes('son')) {
        targetMember = healthRecords.find((r) => r.memberName.toLowerCase().includes('maaran')) || targetMember;
      } else if (lower.includes('selvi') || lower.includes('செல்வி') || lower.includes('wife')) {
        targetMember = healthRecords.find((r) => r.memberName.toLowerCase().includes('selvi')) || targetMember;
      } else if (lower.includes('sangeetha') || lower.includes('சங்கீதா')) {
        targetMember = healthRecords.find((r) => r.memberName.toLowerCase().includes('sangeetha')) || targetMember;
      }

      // Parse amount in mL
      let amountMl = 250;
      const mlMatch = lower.match(/(\d{2,4})\s*(?:ml|மில்லி)/i);
      const literMatch = lower.match(/(\d(?:\.\d)?)\s*(?:l|liter|liters|லிட்டர்)/i);

      if (mlMatch) {
        amountMl = parseInt(mlMatch[1], 10);
      } else if (literMatch) {
        amountMl = Math.round(parseFloat(literMatch[1]) * 1000);
      } else if (lower.includes('bottle') || lower.includes('பாட்டில்')) {
        amountMl = 500;
      } else if (lower.includes('sports') || lower.includes('flask')) {
        amountMl = 750;
      } else if (lower.includes('jug') || lower.includes('carafe') || lower.includes('pitcher')) {
        amountMl = 1000;
      } else if (lower.includes('glass') || lower.includes('cup') || lower.includes('டம்ளர்') || lower.includes('கிளாஸ்')) {
        amountMl = 250;
      }

      // Detect beverage type
      let beverageType: 'water' | 'electrolyte' | 'lemon_water' | 'coconut_water' | 'herbal_tea' = 'water';
      if (lower.includes('coconut') || lower.includes('இளநீர்')) beverageType = 'coconut_water';
      else if (lower.includes('electrolyte') || lower.includes('ors')) beverageType = 'electrolyte';
      else if (lower.includes('lemon') || lower.includes('எலுமிச்சை')) beverageType = 'lemon_water';
      else if (lower.includes('tea') || lower.includes('herbal') || lower.includes('தேநீர்')) beverageType = 'herbal_tea';

      void logHydrationIntake({
        memberId: targetMember.memberId,
        memberName: targetMember.memberName,
        amountMl,
        beverageType,
        loggedBy: 'Auro AI Voice',
        notes: `Logged via Auro voice command: "${lower}"`,
      });

      const updatedSummary = getTodayHydrationSummary(targetMember.memberId);
      const newTotal = updatedSummary.totalDrankMl + amountMl;
      const newPercent = Math.min(100, Math.round((newTotal / updatedSummary.dailyGoalMl) * 100));

      const reply = isTamil
        ? `${targetMember.memberName} அவர்களுக்கு ${amountMl} mL தண்ணீர் வெற்றிகரமாக பதிவு செய்யப்பட்டது. இன்றைய மொத்த அளவு: ${newTotal} mL (${newPercent}%). Google Drive மற்றும் SQLite-ல் சேமிக்கப்பட்டது.`
        : `Logged ${amountMl} mL of ${beverageType.replace('_', ' ')} for ${targetMember.memberName}. Today's total is now ${newTotal} mL (${newPercent}% of ${updatedSummary.dailyGoalMl} mL target). Synced with local SQLite and Google Drive.`;

      addVoiceMessage({
        role: 'assistant',
        content: reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        emotion: 'refreshing & encouraging',
        actionSuggestion: 'View Circular Hydration Ring',
      });
      speakWithAuro(reply);
      return;
    }

    // =========================================================================
    // AURO VOICE INTENT: WALKING STEPS QUERY
    // =========================================================================
    const isStepsQueryIntent =
      /\b(how\s+many\s+steps|step\s+(count|goal|status|tracking)|check.*(steps|walking)|walking.*(steps|today|distance))\b/i.test(lower) ||
      /(நடந்த\s*அடிகள்|எத்தனை\s*அடிகள்|ஸ்டெப்ஸ்\s*எண்ணிக்கை)/i.test(lower);

    if (isStepsQueryIntent) {
      setIsThinking(false);
      const isTamil = voiceLanguage.startsWith('ta');
      const healthRecords = getLocalHealthRecords();

      let targetMember = healthRecords[0];
      if (lower.includes('mithran') || lower.includes('மித்ரன்')) {
        targetMember = healthRecords.find((r) => r.memberName.toLowerCase().includes('mithran')) || targetMember;
      } else if (lower.includes('maaran') || lower.includes('மாறன்') || lower.includes('son')) {
        targetMember = healthRecords.find((r) => r.memberName.toLowerCase().includes('maaran')) || targetMember;
      } else if (lower.includes('selvi') || lower.includes('செல்வி') || lower.includes('wife')) {
        targetMember = healthRecords.find((r) => r.memberName.toLowerCase().includes('selvi')) || targetMember;
      }

      const summary = getTodayStepsSummary(targetMember.memberId);
      const reply = isTamil
        ? `${targetMember.memberName} அவர்கள் இன்று ${summary.totalSteps.toLocaleString()} அடிகள் நடந்துள்ளார்கள். இலக்கு: ${summary.dailyStepGoal.toLocaleString()} (${summary.progressPercent}%). தூரம்: ${summary.totalDistanceKm} கி.மீ, எரிந்த கலோரிகள்: ${summary.totalCaloriesBurned} kcal.`
        : `For ${targetMember.memberName}, you have logged ${summary.totalSteps.toLocaleString()} steps today toward your ${summary.dailyStepGoal.toLocaleString()} goal (${summary.progressPercent}%). Distance covered is ${summary.totalDistanceKm} km with ${summary.totalCaloriesBurned} kcal burned.`;

      addVoiceMessage({
        role: 'assistant',
        content: reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        emotion: 'active & encouraging',
        actionSuggestion: 'Open Steps Tracker',
      });
      speakWithAuro(reply);
      return;
    }

    // =========================================================================
    // AURO VOICE INTENT: LOG WALKING STEPS VIA VOICE
    // =========================================================================
    const isLogStepsIntent =
      /\b(log.*(steps|walk|walking)|walked.*(steps|km|miles)|add.*(steps|walk))\b/i.test(lower) ||
      /(அடிகள்\s*நடந்தேன்|அடிகள்\s*(பதிவு|சேர்)|ஸ்டெப்ஸ்\s*பதிவு)/i.test(lower);

    if (isLogStepsIntent) {
      setIsThinking(false);
      const isTamil = voiceLanguage.startsWith('ta');
      const healthRecords = getLocalHealthRecords();

      let targetMember = healthRecords[0];
      if (lower.includes('mithran') || lower.includes('மித்ரன்')) {
        targetMember = healthRecords.find((r) => r.memberName.toLowerCase().includes('mithran')) || targetMember;
      } else if (lower.includes('maaran') || lower.includes('மாறன்') || lower.includes('son')) {
        targetMember = healthRecords.find((r) => r.memberName.toLowerCase().includes('maaran')) || targetMember;
      } else if (lower.includes('selvi') || lower.includes('செல்வி') || lower.includes('wife')) {
        targetMember = healthRecords.find((r) => r.memberName.toLowerCase().includes('selvi')) || targetMember;
      }

      // Parse step count
      let stepsToAdd = 2000;
      const stepMatch = lower.match(/(\d{2,6})\s*(?:steps|அடிகள்|ஸ்டெப்ஸ்)/i);
      const kMatch = lower.match(/(\d(?:\.\d)?)\s*k\s*(?:steps|walk)?/i);

      if (stepMatch) {
        stepsToAdd = parseInt(stepMatch[1], 10);
      } else if (kMatch) {
        stepsToAdd = Math.round(parseFloat(kMatch[1]) * 1000);
      } else {
        // Look for any 3-5 digit number in the string
        const anyNumberMatch = lower.match(/\b(\d{3,5})\b/);
        if (anyNumberMatch) {
          stepsToAdd = parseInt(anyNumberMatch[1], 10);
        }
      }

      // Detect walk type
      let walkType: any = 'brisk_walking';
      if (lower.includes('stroll') || lower.includes('slow')) walkType = 'casual_stroll';
      else if (lower.includes('power') || lower.includes('fast')) walkType = 'power_walk';
      else if (lower.includes('hike') || lower.includes('trail')) walkType = 'hiking';
      else if (lower.includes('treadmill')) walkType = 'treadmill';

      // Log steps
      logWalkingSteps({
        memberId: targetMember.memberId,
        memberName: targetMember.memberName,
        steps: stepsToAdd,
        walkType,
        loggedBy: 'Auro AI Voice',
      });

      const updatedSummary = getTodayStepsSummary(targetMember.memberId);
      const reply = isTamil
        ? `${targetMember.memberName} அவர்களுக்கு ${stepsToAdd.toLocaleString()} அடிகள் வெற்றிகரமாக பதிவு செய்யப்பட்டது. இன்றைய மொத்த அடிகள்: ${updatedSummary.totalSteps.toLocaleString()} (${updatedSummary.progressPercent}%). தூரம்: ${updatedSummary.totalDistanceKm} கி.மீ. SQLite மற்றும் Google Drive-ல் சேமிக்கப்பட்டது.`
        : `Logged ${stepsToAdd.toLocaleString()} walking steps for ${targetMember.memberName}! Today's cumulative total is now ${updatedSummary.totalSteps.toLocaleString()} steps (${updatedSummary.progressPercent}% of ${updatedSummary.dailyStepGoal.toLocaleString()} goal), covering ${updatedSummary.totalDistanceKm} km. Saved to SQLite and synchronized to Google Drive.`;

      addVoiceMessage({
        role: 'assistant',
        content: reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        emotion: 'invigorating & supportive',
        actionSuggestion: 'View Steps Dashboard',
      });
      speakWithAuro(reply);
      return;
    }

    // =========================================================================
    // AURO VOICE INTENT: UPLOAD MEDICAL DOCUMENT / LAB REPORT TO DRIVE
    // =========================================================================
    const isUploadHealthDocIntent =
      /\b(upload\s+(health|medical|lab|prescription|doctor|hospital|report|scan)|save\s+(health|medical|lab|prescription)\s+(document|report|file)|attach\s+(medical|health|report))\b/i.test(lower) ||
      /(மருத்துவ\s*(ஆவணம்|அறிக்கை|ரிப்போர்ட்)\s*(பதிவேற்று|சேமி))/i.test(lower);

    if (isUploadHealthDocIntent) {
      const isTamil = voiceLanguage.startsWith('ta');
      const healthRecords = getLocalHealthRecords();

      let targetMember = healthRecords[0];
      if (lower.includes('grandma') || lower.includes('grandparent') || lower.includes('பாட்டி') || lower.includes('தாத்தா')) {
        targetMember = healthRecords.find((r) => r.memberName.toLowerCase().includes('grandparent')) || healthRecords[4] || healthRecords[0];
      } else if (lower.includes('selvi') || lower.includes('செல்வி')) {
        targetMember = healthRecords.find((r) => r.memberName.toLowerCase().includes('selvi')) || healthRecords[1] || healthRecords[0];
      } else if (lower.includes('maaran') || lower.includes('மாறன்')) {
        targetMember = healthRecords.find((r) => r.memberName.toLowerCase().includes('maaran')) || healthRecords[2] || healthRecords[0];
      }

      if (selectedFile) {
        setIsThinking(true);
        try {
          const reader = new FileReader();
          const base64Data = await new Promise<string>((resolve) => {
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(selectedFile);
          });

          const doc = await uploadHealthDocument(
            {
              memberId: targetMember.memberId,
              memberName: targetMember.memberName,
              title: selectedFile.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' '),
              category: 'lab_report',
              documentDate: new Date().toISOString().split('T')[0],
              fileName: selectedFile.name,
              mimeType: selectedFile.type || 'application/pdf',
              fileSizeBytes: selectedFile.size,
              fileContentBase64: base64Data,
              notes: `Uploaded via AURO Voice Assistant for ${targetMember.memberName}`,
            },
            googleAccessToken || getGoogleAccessToken(),
            user?.email
          );

          setSelectedFile(null);
          setFilePreviewUrl(null);
          setIsThinking(false);

          const reply = isTamil
            ? `உங்கள் மருத்துவ ஆவணம் "${doc.title}" ${targetMember.memberName} அவர்களின் கூகுள் டிரைவ் கோப்புறையில் (Family Circle/Health And Wellness/Family Heath Record/${targetMember.memberName}/Documents) மற்றும் உள்ளூர் SQLite-ல் பாதுகாப்பாக சேமிக்கப்பட்டது.`
            : `Uploaded and stored "${doc.title}" for ${targetMember.memberName} in Google Drive under Family Circle/Health And Wellness/Family Heath Record/${targetMember.memberName}/Documents and secured in local SQLite vault.`;

          addVoiceMessage({
            role: 'assistant',
            content: reply,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            emotion: 'helpful & attentive',
            actionSuggestion: 'View Document in Health Hub',
          });
          speakWithAuro(reply);
          return;
        } catch (uploadErr) {
          setIsThinking(false);
          console.warn('[VoiceAssistant] Health document upload error:', uploadErr);
        }
      } else {
        fileInputRef.current?.click();
        const prompt = isTamil
          ? `${targetMember.memberName} அவர்களின் மருத்துவ ஆவணத்தை தேர்ந்தெடுக்கவும். கீழே உள்ள Paperclip பொத்தானையும் தட்டலாம்.`
          : `Please select the lab report or medical document for ${targetMember.memberName}. It will be stored in Google Drive under Family Circle/Health And Wellness/Family Heath Record/${targetMember.memberName}/Documents and local SQLite.`;
        addVoiceMessage({
          role: 'assistant',
          content: prompt,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          emotion: 'attentive & organized',
          actionSuggestion: 'Attach Medical Document',
        });
        speakWithAuro(prompt);
        return;
      }
    }

    // Direct WhatsApp message check / read out intent
    if (
      lower.includes('whatsapp') &&
      (lower.includes('read') ||
        lower.includes('check') ||
        lower.includes('latest') ||
        lower.includes('message') ||
        lower.includes('list') ||
        lower.includes('recent') ||
        lower.includes('new'))
    ) {
      setIsThinking(false);
      const incomingMsgs = (whatsAppMessages || []).filter((m) => !m.isOutgoing);
      const latestMsg = incomingMsgs[incomingMsgs.length - 1];
      if (latestMsg) {
        const topReply = (latestMsg.suggestedReplies && latestMsg.suggestedReplies[0]) || 'Understood, on it!';
        const readout = `Your latest WhatsApp message is from ${latestMsg.contactName} (${latestMsg.relationship || 'Contact'}), received at ${latestMsg.timestamp}: "${latestMsg.text}". Auro's suggested reply is: "${topReply}". Say "Send reply" or tap below to send immediately.`;
        addVoiceMessage({
          role: 'assistant',
          content: readout,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          emotion: 'helpful & attentive',
          actionSuggestion: `Reply to ${latestMsg.contactName}: "${topReply}"`,
        });
        speakWithAuro(readout);
        return;
      }
    }

    // Direct WhatsApp reply intent via Auro
    if (
      lower.startsWith('reply to ') ||
      lower.startsWith('reply on whatsapp') ||
      lower.startsWith('send whatsapp to') ||
      lower.startsWith('whatsapp ') ||
      lower.startsWith('send reply ') ||
      lower === 'send reply' ||
      lower.includes('reply via auro')
    ) {
      setIsThinking(false);
      const incomingMsgs = (whatsAppMessages || []).filter((m) => !m.isOutgoing);
      const latestMsg = incomingMsgs[incomingMsgs.length - 1];

      let targetContact = whatsAppContacts.find((c) =>
        lower.includes(c.name.toLowerCase().split(' ')[0]) ||
        lower.includes(c.relationship?.toLowerCase() || '___')
      );

      if (!targetContact && latestMsg) {
        targetContact = whatsAppContacts.find((c) => c.id === latestMsg.contactId);
      }

      if (targetContact) {
        let replyText = '';
        const hasSuggested = Boolean(latestMsg?.suggestedReplies && latestMsg.suggestedReplies.length > 0);
        if (lower === 'send reply' && hasSuggested && latestMsg?.suggestedReplies?.[0]) {
          replyText = latestMsg.suggestedReplies[0];
        } else {
          const colonIdx = spokenText.indexOf(':');
          if (colonIdx !== -1) {
            replyText = spokenText.slice(colonIdx + 1).trim();
          } else {
            replyText = spokenText
              .replace(/^(reply to|send whatsapp to|whatsapp|reply via auro|send reply)\s+/i, '')
              .replace(new RegExp(`^(on whatsapp to|to)?\\s*${targetContact.name}\\s*`, 'i'), '')
              .replace(/^on whatsapp\s+/i, '')
              .trim();
          }
        }

        if (!replyText && hasSuggested && latestMsg?.suggestedReplies?.[0]) {
          replyText = latestMsg.suggestedReplies[0];
        }

        if (replyText) {
          sendWhatsAppMessage(targetContact.id, replyText);
          markWhatsAppAsRead(targetContact.id);
          const confirmText = `Sent your WhatsApp reply to ${targetContact.name}: "${replyText}". Delivery confirmed via Auro bridge.`;
          addVoiceMessage({
            role: 'assistant',
            content: confirmText,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            emotion: 'efficient & protective',
            actionSuggestion: `Chat open with ${targetContact.name}`,
          });
          speakWithAuro(confirmText);
          return;
        }
      }
    }

    // Direct Google Cloud usage & billing query / control intent
    if (
      lower.includes('google cloud') ||
      lower.includes('gcp') ||
      lower.includes('cloud billing') ||
      lower.includes('cloud spend') ||
      lower.includes('cloud usage') ||
      lower.includes('cloud budget') ||
      (lower.includes('billing') && !lower.includes('billionaire'))
    ) {
      // Check if user is asking to SET or UPDATE budget
      const budgetMatch = spokenText.match(/(?:set|change|update|make|adjust)\s+(?:the\s+)?(?:gcp\s+|google\s+cloud\s+|cloud\s+)?budget\s+(?:to\s+)?\$?(\d+(?:\.\d+)?)/i);
      if (budgetMatch) {
        const newBudget = parseFloat(budgetMatch[1]);
        if (!isNaN(newBudget) && newBudget > 0) {
          setIsThinking(false);
          updateGcpBudgetLimit(newBudget);
          const confirmBudget = `I have updated your Google Cloud monthly budget ceiling to $${newBudget.toFixed(2)} USD. Active FinOps alert thresholds and auto scale-down guardrails are now synced with this limit.`;
          addVoiceMessage({
            role: 'assistant',
            content: confirmBudget,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            emotion: 'authoritative & disciplined',
            actionSuggestion: `Budget set to $${newBudget.toFixed(2)} USD`,
          });
          speakWithAuro(confirmBudget);
          return;
        }
      }

      // Readout current usage & billing
      setIsThinking(false);
      const usedPct = Math.round((gcpBillingConfig.currentMtdSpend / gcpBillingConfig.monthlyBudgetLimit) * 100);
      const billingReport = `Your Google Cloud account (${gcpBillingConfig.projectId}) has spent $${gcpBillingConfig.currentMtdSpend.toFixed(2)} MTD out of your $${gcpBillingConfig.monthlyBudgetLimit.toFixed(2)} monthly ceiling, which is ${usedPct}% utilized. Active guardrails: Auto Scale-Down on 100% budget cap is ${gcpBillingConfig.controlGuardrails.autoScaleDownOnCap ? 'Active' : 'Disabled'}, and AI Model Throttling at 90% is ${gcpBillingConfig.controlGuardrails.throttleAiModelsAt90 ? 'Active' : 'Disabled'}. Your workloads are operating safely.`;
      addVoiceMessage({
        role: 'assistant',
        content: billingReport,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        emotion: 'analytical & vigilant',
        actionSuggestion: 'Review GCP services breakdown',
      });
      speakWithAuro(billingReport);
      return;
    }

    // Direct Google Drive / Cloud Files check intent
    if (
      (lower.includes('drive') || lower.includes('google drive') || lower.includes('cloud files') || lower.includes('documents in drive')) &&
      (lower.includes('check') || lower.includes('look through') || lower.includes('read') || lower.includes('list') || lower.includes('show') || lower.includes('files') || lower.includes('storage'))
    ) {
      setIsThinking(false);
      const filesList = liveDriveFiles || [];
      if (filesList.length === 0) {
        const noFilesMsg = `Your connected Google Drive (${user.email || 'chinna.tamil2000@gmail.com'}) has no recent files indexed yet. Your cloud sync is active.`;
        addVoiceMessage({
          role: 'assistant',
          content: noFilesMsg,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          emotion: 'warm & clear',
          actionSuggestion: 'Upload files to Drive',
        });
        speakWithAuro(noFilesMsg);
        return;
      }

      const topFile = filesList[0];
      const driveMsg = `In your connected Google Drive, you have ${filesList.length} indexed files. The latest is "${topFile.name}" (${topFile.mimeType.split('/').pop() || 'document'}, ${topFile.size || 'synced'}). Your Google One storage is ${liveStorageQuota.usageGb} GB used of ${liveStorageQuota.limitGb} GB.`;
      addVoiceMessage({
        role: 'assistant',
        content: driveMsg,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        emotion: 'attentive & organized',
        actionSuggestion: `View Drive: "${topFile.name}"`,
      });
      speakWithAuro(driveMsg);
      return;
    }

    // Direct Google Keep notes check / read out / add intent
    const isKeepQuery =
      lower.includes('keep') ||
      lower.includes('google keep') ||
      lower.includes('keep note') ||
      lower.includes('keep-ல');

    if (isKeepQuery) {
      // Check if user is asking to CREATE / ADD a note in Keep
      const isCreateKeep =
        lower.startsWith('add note to keep') ||
        lower.startsWith('add to keep') ||
        lower.startsWith('create keep note') ||
        lower.startsWith('take a note in keep') ||
        lower.startsWith('note down in keep') ||
        lower.includes('keep-ல note பண்ணு') ||
        lower.includes('keep-ல ஒரு note எழுது');

      if (isCreateKeep) {
        setIsThinking(false);
        const noteBody = spokenText
          .replace(/^(add note to keep|add to keep|create keep note|take a note in keep|note down in keep|keep-ல note பண்ணு|keep-ல ஒரு note எழுது):?\s*/i, '')
          .trim();
        const noteTitle = noteBody.split('\n')[0].slice(0, 35) || 'Voice Keep Note';
        if (noteBody) {
          addGoogleKeepNote(noteTitle, noteBody, ['voice-note', 'keep']);
          const confirmKeep = `I have added your note "${noteTitle}" to Google Keep notes. It is synchronized with your Google account.`;
          addVoiceMessage({
            role: 'assistant',
            content: confirmKeep,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            emotion: 'organized & helpful',
            actionSuggestion: `Google Keep: "${noteTitle}"`,
          });
          speakWithAuro(confirmKeep);
          return;
        }
      }

      // Check / Readout Google Keep notes
      if (
        lower.includes('check') ||
        lower.includes('read') ||
        lower.includes('what are') ||
        lower.includes('list') ||
        lower.includes('show') ||
        lower.includes('grocery') ||
        lower.includes('notes')
      ) {
        setIsThinking(false);
        const notesList = liveKeepNotes || [];
        if (notesList.length === 0) {
          const noKeepMsg = `Your connected Google Keep notes (${user.email || 'chinna.tamil2000@gmail.com'}) has no active notes yet. Say "Add to Keep: buy groceries" to create one.`;
          addVoiceMessage({
            role: 'assistant',
            content: noKeepMsg,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            emotion: 'warm & clear',
            actionSuggestion: 'Create first Keep note',
          });
          speakWithAuro(noKeepMsg);
          return;
        }

        const topNote = notesList[0];
        const keepReport = `In your Google Keep, you have ${notesList.length} notes. The top note is "${topNote.title}": "${topNote.body.slice(0, 160)}". Say "Add to Keep" anytime to record a new note.`;
        addVoiceMessage({
          role: 'assistant',
          content: keepReport,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          emotion: 'attentive & clear',
          actionSuggestion: `View Keep: "${topNote.title}"`,
        });
        speakWithAuro(keepReport);
        return;
      }
    }

    // Direct Internal Phone Storage & Device Health intent
    if (
      lower.includes('internal storage') ||
      lower.includes('phone storage') ||
      lower.includes('device storage') ||
      lower.includes('storage on my phone') ||
      lower.includes('how much free storage') ||
      lower.includes('storage left') ||
      lower.includes('phone memory') ||
      lower.includes('போன் storage') ||
      lower.includes('storage check பண்ணு')
    ) {
      setIsThinking(false);
      const st = internalStorageDetails || (await refreshInternalPhoneStorage());
      const storageMsg = `Your phone has ${st.freeStorageGb} GB of free internal storage remaining out of ${st.totalStorageGb} GB (${st.usedStorageGb} GB used, which is ${st.percentUsed}% utilized). Memory: ${st.deviceRamGb} GB RAM. Battery: ${st.batteryLevel}% (${st.isCharging ? 'Charging' : 'Discharging'}). Storage breakdown: Apps use ${st.breakdown.appsGb} GB, Media uses ${st.breakdown.mediaGb} GB, and System uses ${st.breakdown.systemGb} GB. Your phone internal storage health is optimal.`;
      addVoiceMessage({
        role: 'assistant',
        content: storageMsg,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        emotion: 'analytical & disciplined',
        actionSuggestion: `${st.freeStorageGb} GB free of ${st.totalStorageGb} GB`,
      });
      speakWithAuro(storageMsg);
      return;
    }

    // Direct Gmail / Email check and readout intent
    const isMailQuery =
      lower.includes('email') ||
      lower.includes('gmail') ||
      lower.includes('inbox') ||
      lower.includes('messages from google') ||
      lower.includes('mail');

    const isSentMailCheck =
      isMailQuery &&
      (lower.includes('sent') || lower.includes('outgoing') || lower.includes('outbox'));

    const isDirectMailCheck =
      isMailQuery &&
      !isSentMailCheck &&
      (lower.includes('check') ||
        lower.includes('read') ||
        lower.includes('look through') ||
        lower.includes('unread') ||
        lower.includes('any new') ||
        lower.includes('new message') ||
        lower === 'gmail' ||
        lower === 'check mail' ||
        lower === 'check email');

    const isSpecificEmailQuery =
      lower.includes('summar') ||
      lower.includes('what did') ||
      lower.includes('draft') ||
      lower.includes('reply') ||
      lower.includes('write') ||
      lower.includes('search') ||
      lower.includes('find') ||
      lower.includes('tell me about');

    if (isSentMailCheck && !isSpecificEmailQuery) {
      setIsThinking(false);
      const sentList = liveSentEmails || [];
      if (sentList.length === 0) {
        const noSentMsg = `You haven't sent any emails yet from your connected Gmail account (${user.email || 'chinna.tamil2000@gmail.com'}). You can compose one now or ask me to draft one.`;
        addVoiceMessage({
          role: 'assistant',
          content: noSentMsg,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          emotion: 'warm & clear',
          actionSuggestion: 'Compose an email',
        });
        speakWithAuro(noSentMsg);
        return;
      }

      const topSent = sentList[0];
      const sentSummary = `You have ${sentList.length} sent email${sentList.length === 1 ? '' : 's'} recorded in your Gmail mailbox. The latest was sent to ${topSent.to || 'recipient'} regarding "${topSent.subject}": "${topSent.snippet}". Would you like me to open your Gmail tab or send a follow-up?`;
      addVoiceMessage({
        role: 'assistant',
        content: sentSummary,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        emotion: 'attentive & organized',
        actionSuggestion: 'Open Gmail Sent Mail',
      });
      speakWithAuro(sentSummary);
      return;
    }

    if (isDirectMailCheck && !isSpecificEmailQuery) {
      setIsThinking(false);
      const emailList = liveEmails || [];
      const unreadList = emailList.filter((e) => e.unread);
      const count = unreadList.length;

      if (emailList.length === 0) {
        const noMailMsg = `Your connected Gmail account (${user.email || 'chinna.tamil2000@gmail.com'}) has no recent messages in the inbox. Everything is clean and organized.`;
        addVoiceMessage({
          role: 'assistant',
          content: noMailMsg,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          emotion: 'warm & clear',
          actionSuggestion: 'Check Google Drive files',
        });
        speakWithAuro(noMailMsg);
        return;
      }

      const topEmail = unreadList[0] || emailList[0];
      const summaryText = count > 0
        ? `You have ${count} unread email${count === 1 ? '' : 's'} in your connected Gmail (${user.email || 'chinna.tamil2000@gmail.com'}). The latest is from ${topEmail.from} regarding "${topEmail.subject}": "${topEmail.snippet}". Would you like me to open your Gmail tab or summarize details?`
        : `Your Gmail inbox has ${emailList.length} recent messages, with no unread emails. The most recent is from ${topEmail.from} regarding "${topEmail.subject}": "${topEmail.snippet}".`;

      addVoiceMessage({
        role: 'assistant',
        content: summaryText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        emotion: 'attentive & organized',
        actionSuggestion: `View Gmail: "${topEmail.subject}"`,
      });
      speakWithAuro(summaryText);
      return;
    }

    // -------------------------------------------------------------------------
    // Direct Live Weather Query Interception
    // -------------------------------------------------------------------------
    const isDirectWeatherCheck =
      /^(what('s| is| are)? (the )?(weather|temperature|forecast|rain)|weather report|today('s)? weather|check weather|வானிலை|இன்றைய வானிலை|மழை பெய்யுமா|மழை வருமா|வெயில் எப்படி)/i.test(lower) ||
      (lower.includes('weather') && (lower.includes('today') || lower.includes('now') || lower.includes('outside') || lower.includes('current')));

    if (isDirectWeatherCheck && !selectedFile) {
      setIsThinking(true);
      try {
        let weatherData = getCachedWeatherData();
        try {
          const { coords } = await getCurrentCoordinates();
          weatherData = await fetchWeatherForecast(coords.latitude, coords.longitude);
        } catch {}

        if (weatherData) {
          setIsThinking(false);
          const isTamil = voiceLanguage.startsWith('ta') || /[\u0B80-\u0BFF]/.test(spokenText);
          const loc = weatherData.locationName || 'your current location';
          const tempC = weatherData.current.temperature;
          const condition = weatherData.current.weatherDescription;
          const humidity = weatherData.current.relativeHumidity;
          const rainChance = weatherData.daily[0]?.precipitationProbabilityMax ?? 0;
          const highC = weatherData.daily[0]?.tempMax ?? tempC;
          const lowC = weatherData.daily[0]?.tempMin ?? tempC - 5;

          const spokenReport = isTamil
            ? `தற்போது ${loc}-ல் வெப்பநிலை ${tempC}°C ஆகவும், ${condition} நிலையிலும் உள்ளது. இன்றைய அதிகபட்சம் ${highC}°C, குறைந்தபட்சம் ${lowC}°C, மழை வாய்ப்பு ${rainChance}% ஆகும்.`
            : `Currently in ${loc}, it's ${tempC}°C with ${condition.toLowerCase()}. Today's high is ${highC}°C and low is ${lowC}°C with a ${rainChance}% chance of rain.`;

          const weatherCardData = {
            location: loc,
            temperature: tempC,
            apparentTemperature: weatherData.current.apparentTemperature,
            condition: condition,
            high: highC,
            low: lowC,
            rainChance: rainChance,
            humidity: humidity,
            wind: `${weatherData.current.windSpeed} km/h ${weatherData.current.windDirectionCompass || ''}`.trim(),
            uvIndex: weatherData.current.uvIndex,
            coordinates: weatherData.coordinates,
          };

          addVoiceMessage({
            role: 'assistant',
            content: spokenReport,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            emotion: 'fresh & informative',
            actionSuggestion: 'Open Weather Forecast Tab',
            weatherCard: weatherCardData,
          });

          speakWithAuro(spokenReport);
          return;
        }
      } catch (wErr) {
        console.warn('Direct weather check exception:', wErr);
      }
    }

    setIsThinking(true);
    if (selectedFile) {
      setIsAnalyzingFile(true);
    }
    try {
      // Gather live weather metrics for Auro
      let liveWeatherContext = getCachedWeatherData();
      if (!liveWeatherContext || /weather|temperature|rain|climate|forecast|வானிலை|மழை/i.test(spokenText)) {
        try {
          const { coords } = await getCurrentCoordinates();
          liveWeatherContext = await fetchWeatherForecast(coords.latitude, coords.longitude);
        } catch {}
      }

      const historyPayload = chatHistory.slice(-6).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const contextPayload = {
        liveWeatherSummary: liveWeatherContext ? {
          locationName: liveWeatherContext.locationName,
          coordinates: liveWeatherContext.coordinates,
          temperatureC: liveWeatherContext.current.temperature,
          temperatureF: Math.round((liveWeatherContext.current.temperature * 9) / 5 + 32),
          apparentTemperatureC: liveWeatherContext.current.apparentTemperature,
          apparentTemperatureF: Math.round((liveWeatherContext.current.apparentTemperature * 9) / 5 + 32),
          condition: liveWeatherContext.current.weatherDescription,
          isDay: liveWeatherContext.current.isDay,
          humidityPercent: liveWeatherContext.current.relativeHumidity,
          windSpeedKmH: liveWeatherContext.current.windSpeed,
          windDirectionCompass: liveWeatherContext.current.windDirectionCompass,
          precipitationMm: liveWeatherContext.current.precipitation,
          rainChancePercent: liveWeatherContext.daily[0]?.precipitationProbabilityMax ?? 0,
          todayHighC: liveWeatherContext.daily[0]?.tempMax ?? liveWeatherContext.current.temperature,
          todayLowC: liveWeatherContext.daily[0]?.tempMin ?? liveWeatherContext.current.temperature - 5,
          uvIndex: liveWeatherContext.current.uvIndex,
          sunrise: liveWeatherContext.daily[0]?.sunrise,
          sunset: liveWeatherContext.daily[0]?.sunset,
          hourlyOutlook: (liveWeatherContext.hourly || []).slice(0, 6).map((h) => `${h.formattedTime}: ${h.temperature}°C, ${h.weatherDescription} (${h.precipitationProbability}% rain)`).join('; '),
          sevenDayOutlook: (liveWeatherContext.daily || []).slice(0, 5).map((d) => `${d.dayName}: High ${d.tempMax}°C / Low ${d.tempMin}°C, ${d.weatherDescription} (${d.precipitationProbabilityMax}% rain)`).join('; '),
          lastUpdated: liveWeatherContext.fetchedAt,
        } : null,
        pendingTasksCount: tasks.filter((t) => !t.completed).length,
        currentNetWorth: netWorth,
        familyCount: familyMembers.length,
        userEmail: user.email,
        primaryRole: user.role,
        phoneContactsSummary: (phoneContacts || []).map((c) => ({
          name: c.name,
          phone: c.phone,
          relationship: c.relationship,
        })),
        latestWhatsAppMessages: (whatsAppMessages || []).slice(-5).map((m) => ({
          from: m.contactName,
          relationship: m.relationship,
          text: m.text,
          time: m.timestamp,
          isOutgoing: m.isOutgoing,
          suggestedReplies: m.suggestedReplies,
        })),
        gcpBillingSummary: {
          currentMtdSpend: gcpBillingConfig.currentMtdSpend,
          monthlyBudgetLimit: gcpBillingConfig.monthlyBudgetLimit,
          projectId: gcpBillingConfig.projectId,
          autoScaleDownEnabled: gcpBillingConfig.controlGuardrails.autoScaleDownOnCap,
        },
        recentEmailsSummary: (liveEmails || []).slice(0, 6).map((e) => ({
          from: e.from,
          subject: e.subject,
          snippet: e.snippet,
          date: e.date,
          unread: e.unread,
        })),
        recentSentEmailsSummary: (liveSentEmails || []).slice(0, 6).map((e) => ({
          to: e.to,
          subject: e.subject,
          snippet: e.snippet,
          date: e.date,
          status: e.status,
        })),
        familyRemindersSummary: getLocalReminders()
          .filter((r) => r.enabled && !r.completed)
          .slice(0, 10)
          .map((r) => ({
            title: r.title,
            dueDate: r.dueDate,
            dueTime: r.dueTime,
            familyMember: r.familyMember,
            category: r.category,
            priority: r.priority,
          })),
        recentDriveFilesSummary: (liveDriveFiles || []).slice(0, 5).map((f) => ({
          name: f.name,
          mimeType: f.mimeType,
          size: f.size,
          modifiedTime: f.modifiedTime,
        })),
        googleStorageQuota: liveStorageQuota,
        googleKeepNotesSummary: (liveKeepNotes || []).slice(0, 8).map((k) => ({
          title: k.title,
          body: k.body,
          labels: k.labels,
        })),
        internalPhoneStorageSummary: internalStorageDetails,
        isGoogleConnected,
      };

      // If an attachment is selected, process and auto-upload it to Google Drive
      let attachmentPayload = null;
      if (selectedFile) {
        let uploadedToDrive = false;
        let driveFileId = '';
        let driveWebLink = '';
        let uploadError = '';

        const activeToken = googleAccessToken || (typeof window !== 'undefined' ? localStorage.getItem('aura_google_access_token') : null);

        // If this is a book/eBook and user asked about Apple Books library
        const isTargetingAppleBooks =
          (selectedFile.type === 'application/pdf' || selectedFile.name.toLowerCase().endsWith('.pdf') || selectedFile.name.toLowerCase().endsWith('.epub')) &&
          (lower.includes('apple book') || lower.includes('apple books') || lower.includes('ibooks') || lower.includes('book library') || lower.includes('புத்தகம்') || lower.includes('book'));

        if (isTargetingAppleBooks) {
          const uploadedBook = await handleUploadAttachmentToAppleBooks(selectedFile);
          if (uploadedBook) {
            uploadedToDrive = Boolean(uploadedBook.driveFileId);
            driveFileId = uploadedBook.driveFileId || '';
            driveWebLink = uploadedBook.driveWebViewLink || '';
          }
        } else if (activeToken) {
          try {
            const uploaded = await uploadGoogleDriveFile(selectedFile);
            uploadedToDrive = true;
            driveFileId = uploaded.id;
            driveWebLink = uploaded.webViewLink || '';
            setDriveUploadNotice(uploaded.name);
            setTimeout(() => setDriveUploadNotice(null), 5000);
          } catch (upErr: any) {
            console.warn('Voice chat auto-upload to Google Drive notice:', upErr);
            uploadError = upErr?.message || 'Google Drive API error';
          }
        } else {
          uploadError = 'Google account is not connected yet. Authorization required to upload to drive.google.com.';
        }

        let textSnippet = '';
        if (selectedFile.type.startsWith('text/') || selectedFile.name.endsWith('.txt') || selectedFile.name.endsWith('.json') || selectedFile.name.endsWith('.md')) {
          try {
            textSnippet = await selectedFile.text();
          } catch {}
        }

        const base64Data = await new Promise<string>((resolve) => {
          try {
            const reader = new FileReader();
            reader.onloadend = () => {
              const res = reader.result;
              if (typeof res === 'string') {
                const comma = res.indexOf(',');
                resolve(comma !== -1 ? res.slice(comma + 1) : res);
              } else {
                resolve('');
              }
            };
            reader.onerror = () => resolve('');
            reader.readAsDataURL(selectedFile);
          } catch {
            resolve('');
          }
        });

        const sizeFormatted = selectedFile.size > 1024 * 1024
          ? `${(selectedFile.size / (1024 * 1024)).toFixed(1)} MB`
          : `${Math.max(1, Math.round(selectedFile.size / 1024))} KB`;

        attachmentPayload = {
          name: selectedFile.name,
          mimeType: selectedFile.type || 'application/octet-stream',
          size: sizeFormatted,
          sizeBytes: selectedFile.size,
          contentBase64: base64Data,
          textContent: textSnippet.slice(0, 3000),
          uploadedToGoogleDrive: uploadedToDrive,
          googleDriveFileId: driveFileId,
          webViewLink: driveWebLink,
          uploadError,
        };

        setSelectedFile(null);
        setFilePreviewUrl(null);
        setFileSnippet('');
      }

      const result = await sendChatMessage({
        message: spokenText,
        history: historyPayload,
        context: contextPayload,
        userProfile: user,
        currentMood: currentEmotion,
        includeSpeechAudio: !isMuted,
        currentLanguage: voiceLanguage.startsWith('ta') ? 'ta' : 'en',
        model: selectedVoiceModel,
        provider: aiProvider,
        attachment: attachmentPayload,
      });

      setIsThinking(false);
      setIsAnalyzingFile(false);
      const replyText = result.reply || "I'm right here with you.";
      const emotionText = result.emotion || 'supportive';
      setCurrentEmotion(emotionText);

      // Check if Auro extracted and stored an explicit memory in SQLite
      if (result.savedMemory) {
        const memTopic = result.savedMemory.topic || 'New note';
        setSavedMemoryNotice(memTopic);
        setTimeout(() => setSavedMemoryNotice(null), 5000);
        loadAssistantMemories();
      }

      // Check if a Google Keep note was saved
      if (result.savedKeepNote) {
        const keepTitle = result.savedKeepNote.title || 'Note';
        setSavedKeepNoteNotice(keepTitle);
        setTimeout(() => setSavedKeepNoteNotice(null), 5000);
      }

      // Check if a Family Reminder was saved
      if (result.savedReminder) {
        const remRecord = result.savedReminder;
        const remTitle = remRecord.title || 'Reminder';
        setSavedReminderNotice(remTitle);
        setTimeout(() => setSavedReminderNotice(null), 5000);

        const newRem = {
          id: remRecord.id,
          userEmail: remRecord.userEmail,
          title: remRecord.title,
          notes: remRecord.notes || '',
          dueDate: remRecord.dueDate,
          dueTime: remRecord.dueTime,
          category: remRecord.category || 'family',
          priority: remRecord.priority || 'normal',
          familyMember: remRecord.targetFamilyMember || 'All Family Circle',
          targetFamilyMember: remRecord.targetFamilyMember || 'All Family Circle',
          enabled: Boolean(remRecord.enabled),
          completed: Boolean(remRecord.completed),
          notified: Boolean(remRecord.notified),
          sound: 'gentle' as const,
          voiceAlert: true,
          createdAt: remRecord.createdAt,
          updatedAt: remRecord.updatedAt,
          driveSyncStatus: remRecord.driveSyncStatus || 'local_only',
          driveFileId: remRecord.driveFileId,
        };

        const currentLocal = getLocalReminders();
        const updatedLocal = [newRem, ...currentLocal.filter((r) => r.id !== newRem.id)];
        saveLocalReminders(updatedLocal);

        // Immediate reactive UI update
        window.dispatchEvent(new CustomEvent('aura_reminders_changed', { detail: updatedLocal }));

        // Background Google Drive sync
        const activeToken =
          googleAccessToken ||
          (typeof window !== 'undefined'
            ? localStorage.getItem('aura_google_access_token') || localStorage.getItem('google_access_token')
            : null);

        if (activeToken) {
          syncRemindersWithGoogleDrive(activeToken, user.email || undefined).catch((e: any) =>
            console.warn('[VoiceAssistant] Drive sync reminder error:', e)
          );
        }
      }

      // Check if a Google Drive file was indexed/saved
      if (result.savedDriveFile) {
        const driveName = result.savedDriveFile.name || 'File';
        setDriveUploadNotice(driveName);
        setTimeout(() => setDriveUploadNotice(null), 5000);
      }

      // Only execute screen navigation if the user explicitly commanded to open or switch to a screen
      const userAskedToNavigate =
        /^(open|go to|navigate to|switch to|show tab|launch|take me to|திரைக்கு செல்|திற)\b/i.test(spokenText.trim()) ||
        /\b(open (the |this )?(screen|tab|feature|app)|show (the |this )?(screen|tab))\b/i.test(spokenText);

      if (
        result.navigateToTab &&
        result.navigateToTab !== 'none' &&
        result.navigateToTab !== 'null' &&
        result.navigateToTab !== 'chat' &&
        userAskedToNavigate &&
        onNavigateTab
      ) {
        isNavigatingRef.current = true;
        setTimeout(() => {
          onNavigateTab(result.navigateToTab as TabKey, result.navigateSubTab);
        }, 1200);
      }

      const aiMsg = {
        role: 'assistant' as const,
        content: replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        emotion: emotionText,
        actionSuggestion: result.actionSuggestion,
        systemExecutionResult: result.systemExecutionResult,
        systemAction: result.systemAction,
        weatherCard: result.weatherCard,
      };
      addVoiceMessage(aiMsg);

      speakWithAuro(replyText, {
        emotion: emotionText,
        audioBase64: result.audioBase64 || null,
      });
    } catch (err: any) {
      console.error('Voice assistant chat request failed:', err);
      setIsThinking(false);
      setIsAnalyzingFile(false);
      const errMsg = err?.message || (typeof err === 'string' ? err : JSON.stringify(err || {}));
      let fallbackReply = "I couldn't connect to the AI assistant service just now. Please check your connection and try again, or type your message below.";

      if (err?.status === 402 || errMsg.includes('402') || errMsg.includes('prepayment') || errMsg.includes('credits are depleted')) {
        fallbackReply = "Google Gemini Notice: Your API key credits are depleted or require billing on Google AI Studio. Please generate a new key on a free project at aistudio.google.com and update it in Hub Keys & SQLite.";
      } else if (err?.status === 401 || err?.status === 403 || errMsg.includes('401') || errMsg.includes('403') || errMsg.includes('API key not valid')) {
        fallbackReply = "Google Gemini Notice: Your Gemini API key is invalid or unauthorized. Please verify your GEMINI_API_KEY in Hub Keys.";
      } else if (err?.status === 429 || errMsg.includes('429') || errMsg.includes('quota') || errMsg.includes('rate limit')) {
        fallbackReply = "Google Gemini Notice: Model rate limit reached. Please wait a moment and try again.";
      } else if (
        Capacitor.isNativePlatform() &&
        errMsg.includes('Mobile AI backend is not configured')
      ) {
        fallbackReply = 'Voice recognition worked, but the AI backend is not configured for this APK. Configure VITE_API_BASE_URL to a public HTTPS backend and rebuild the app.';
      }

      addVoiceMessage({
        role: 'assistant',
        content: fallbackReply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        emotion: 'comforting',
      });
      speakWithAuro(fallbackReply);
    }
  };

  const toggleMic = () => {
    if (isSpeaking) {
      // Barge-in: User tapped mic while Auro is speaking -> stop speech and start listening
      speechEngine.stopSpeaking();
      speechEngine.unlockAudio();
      speechEngine.setContinuousMode(isHandsFreeRef.current);
      speechEngine.startListening();
      return;
    }

    if (isListening) {
      if (liveTranscript.trim()) {
        speechEngine.commitCurrentSpeech();
      } else {
        speechEngine.stopListening(true);
      }
    } else {
      speechEngine.unlockAudio();
      setMicStatusMessage(null);
      speechEngine.stopSpeaking();
      speechEngine.setContinuousMode(isHandsFreeRef.current);

      if (typeof window !== 'undefined' && !window.isSecureContext) {
        setMicStatusMessage('Microphone access requires a secure connection (HTTPS or localhost). If connecting from mobile over Wi-Fi IP, access via HTTPS or use USB forwarding (adb reverse tcp:3000 tcp:3000 to open http://localhost:3000).');
        return;
      }

      // Start listening SYNCHRONOUSLY within this user tap gesture!
      // This preserves the active User Activation token on iOS Safari and Android Chrome,
      // allowing the browser to immediately display the native mic permission prompt without expiring.
      const started = speechEngine.startListening();
      if (!started) {
        setMicStatusMessage('Speech recognition could not be started in this browser. Please check your browser microphone settings, or type below.');
      }
    }
  };

  const handleManualSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim() && !selectedFile) return;
    const msg =
      textInput.trim() ||
      (selectedFile
        ? (voiceLanguage.startsWith('ta')
            ? `இந்த இணைக்கப்பட்ட கோப்பை ("${selectedFile.name}") நிகழ்நேரத்தில் ஆய்வு செய்து என்னவென்று விளக்குங்கள்.`
            : `Please analyze this attached file "${selectedFile.name}" in real time, extract key facts, and tell me what it is about.`)
        : '');
    setTextInput('');
    handleUserSpeech(msg);
  };

  handleUserSpeechRef.current = handleUserSpeech;

  const quickPrompts = [
    { label: '💬 Open WhatsApp', text: 'Open WhatsApp' },
    { label: '📘 Open Facebook', text: 'Open Facebook' },
    { label: '▶️ Open YouTube', text: 'Open YouTube' },
    { label: '📷 Open Instagram', text: 'Open Instagram' },
    { label: '📸 Open Camera', text: 'Open Camera' },
    { label: '🎙️ Open Voice Memo', text: 'Open voice memo' },
    { label: '🗣️ Speech to Text', text: 'Open speech to text' },
    { label: '🎵 Open Apple Music', text: 'Open Apple Music' },
    { label: '📚 Open Apple Books', text: 'Open Apple Book' },
    { label: '📄 Open Document Scanner', text: 'Open Document Scanner' },
    { label: '🎙️ வாய்ஸ் மெமோ', text: 'வாய்ஸ் மெமோ திற' },
    { label: '🗣️ ஸ்பீச் டு டெக்ஸ்ட்', text: 'ஸ்பீச் டு டெக்ஸ்ட் திற' },
    { label: '🎵 ஆப்பிள் மியூசிக்', text: 'ஆப்பிள் மியூசிக் திற' },
    { label: '📚 ஆப்பிள் புக்ஸ்', text: 'ஆப்பிள் புக் திற' },
    { label: '📄 டாக்குமெண்ட் ஸ்கேனர்', text: 'டாக்குமெண்ட் ஸ்கேனர் திற' },
    { label: '📎 Upload to Drive', text: 'Upload this attachment to my Google Drive.' },
    { label: '📎 டிரைவில் அப்லோட்', text: 'என் attachment-ஐ கூகுள் டிரைவில் அப்லோட் பண்ணு.' },
    { label: '📝 Google Keep Notes', text: 'Check my Google Keep notes and read my grocery list.' },
    { label: '📝 Add Keep Note', text: 'Add note to Google Keep: Organic apples, oat milk, and cold brew coffee.' },
    { label: '📱 Phone Storage Status', text: 'How much free internal storage do I have on my phone?' },
    { label: '📱 போன் Storage', text: 'போன் storage எவ்ளோ இருக்கு, free space சொல்லு.' },
    { label: '🧠 Remember house PIN', text: 'Auro, please remember that our house gate PIN is 4920 and trash pickup is on Tuesday morning.' },
    { label: '🧠 What do you remember?', text: 'What notes or details have you saved in memory for my account?' },
    { label: 'Check Gmail', text: 'Look through my connected Gmail messages.' },
    { label: 'Drive & Storage', text: 'Check my Google Drive files and storage.' },
    { label: 'Check WhatsApp', text: 'Read out my latest WhatsApp messages.' },
    { label: 'Reply via Auro', text: 'Send reply' },
    { label: 'Call Selvapriya', text: 'Call Selvapriya.' },
    { label: 'Cloud Spend & Billing', text: 'Check my Google Cloud usage and billing spend.' },
    { label: 'Set GCP Budget $250', text: 'Set Google Cloud budget to 250.' },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-xl p-2 sm:p-4">
      <div className="w-full max-w-xl h-[92vh] max-h-[820px] rounded-3xl border border-slate-800 bg-slate-900/95 flex flex-col shadow-2xl relative overflow-hidden">
        {/* Tier 1: Top Header Bar (Navigation & Controls) */}
        <div className="p-3 sm:px-6 border-b border-slate-800/80 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-tr from-amber-600 to-indigo-600 flex items-center justify-center p-0.5 shadow-lg shadow-amber-500/20 overflow-hidden">
                <img src="/app-logo.png" alt="Aura Logo" className="w-full h-full object-cover rounded-xl" />
              </div>
              <span className="absolute -bottom-1 -right-1 w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full bg-emerald-500 border-2 border-slate-900" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-sm sm:text-base">Aura Family Assistant</h3>
                <span className="px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  Real-Time Voice
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-400 flex items-center gap-1.5">
                <Heart className="w-3 h-3 text-rose-400 fill-rose-400/30" />
                Demeanor: <span className="text-slate-300 font-medium capitalize">{currentEmotion}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            {/* Test Sound */}
            <button
              onClick={() => {
                if (isMuted) setIsMuted(false);
                speechEngine.testVoiceOutput();
              }}
              className="px-2 py-1.5 sm:px-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-200 border border-indigo-500/30 transition-all cursor-pointer shadow-sm"
              title="Test voice audio"
            >
              <Volume2 className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden sm:inline">Test Sound</span>
            </button>

            {/* Language Selector Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowLangMenu(!showLangMenu)}
                className="px-2 py-1.5 sm:px-2.5 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 hover:bg-indigo-500/30 cursor-pointer"
                title="Change Voice Language"
              >
                <span>
                  {SUPPORTED_VOICE_LANGUAGES.find((l) => l.code === voiceLanguage)?.flag || '🇮🇳'}{' '}
                  {SUPPORTED_VOICE_LANGUAGES.find((l) => l.code === voiceLanguage)?.nativeName || 'தமிழ்'}
                </span>
                <span className="text-[9px]">▾</span>
              </button>

              {showLangMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowLangMenu(false)}
                  />
                  <div className="absolute right-0 top-full mt-1.5 w-48 rounded-2xl bg-slate-900/98 backdrop-blur-xl border border-slate-700 shadow-2xl py-1.5 z-50 ring-1 ring-white/10 animate-in fade-in zoom-in-95 duration-150">
                    <span className="text-[10px] text-slate-400 font-semibold px-3 py-1 block uppercase tracking-wider">
                      Voice Language
                    </span>
                    {SUPPORTED_VOICE_LANGUAGES.map((lang) => {
                      const isSelected = voiceLanguage === lang.code;
                      return (
                        <button
                          key={lang.code}
                          type="button"
                          onClick={() => handleSelectLanguage(lang.code)}
                          className={`w-full px-3 py-1.5 text-xs text-left flex items-center justify-between transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-600/30 text-indigo-200 font-bold'
                              : 'text-slate-300 hover:bg-slate-800'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <span>{lang.flag}</span>
                            <span>{lang.label}</span>
                          </span>
                          {isSelected && <span className="text-emerald-400 text-xs">✓</span>}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Mute Voice Toggle */}
            <button
              onClick={() => {
                if (isSpeaking) speechEngine.stopSpeaking();
                setIsMuted(!isMuted);
              }}
              className="p-1.5 sm:p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title={isMuted ? 'Unmute voice' : 'Mute voice'}
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
            </button>

            {/* Cancel & Go Back to Home Button */}
            <button
              onClick={handleCancelAndGoHome}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 hover:text-white border border-rose-500/40 hover:border-rose-500/60 transition-all cursor-pointer shadow-md active:scale-95"
              title="Cancel and return to Home Hub"
              aria-label="Cancel and go back to home"
            >
              <Home className="w-3.5 h-3.5 text-rose-300" />
              <span>Cancel</span>
            </button>
          </div>
        </div>

        {/* Tier 2: Dedicated AI Engine, Model Switcher & Tool Ribbon */}
        <div className="px-3 sm:px-6 py-2 bg-slate-950 border-b border-slate-800/80 flex items-center justify-between gap-1.5 sm:gap-2 relative z-30 flex-wrap sm:flex-nowrap">
          {/* Left: AI Provider Toggle & Active Model Dropdown */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* AI Provider Switcher (Gemini vs NVIDIA) */}
            <div className="flex items-center bg-slate-900 p-0.5 rounded-xl border border-slate-700/80 shadow-inner">
              <button
                type="button"
                onClick={() => handleToggleProvider('gemini')}
                className={`px-2 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  aiProvider === 'gemini'
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/25 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Switch to Google Gemini Multimodal Engine (Flash, Pro, Lite)"
              >
                <Sparkles className="w-3 h-3 text-purple-200" />
                <span className="text-[11px]">Gemini</span>
              </button>
              <button
                type="button"
                onClick={() => handleToggleProvider('nvidia')}
                className={`px-2 py-1 rounded-lg text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                  aiProvider === 'nvidia'
                    ? 'bg-[#76B900] text-slate-950 shadow-md shadow-[#76B900]/30 font-extrabold'
                    : 'text-slate-400 hover:text-[#76B900]'
                }`}
                title="Switch to NVIDIA AI NIM GPU Engine (Nemotron, Llama, Riva)"
              >
                <Cpu className={`w-3 h-3 ${aiProvider === 'nvidia' ? 'text-slate-950' : 'text-[#76B900]'}`} />
                <span className="text-[11px] font-bold">NVIDIA</span>
              </button>
            </div>

            {/* AI Model Selector Dropdown */}
            <div className="relative">
              {(() => {
                const isNvidia = aiProvider === 'nvidia';
                const currentGemini = AVAILABLE_GEMINI_MODELS.find((m) => m.id === selectedVoiceModel);
                const currentNvidia = AVAILABLE_NVIDIA_MODELS.find((m) => m.id === selectedVoiceModel);
                const displayName = isNvidia
                  ? (currentNvidia ? currentNvidia.name.replace('NVIDIA ', '') : selectedVoiceModel.replace('nvidia/', ''))
                  : (currentGemini ? currentGemini.name.replace('Gemini ', '') : selectedVoiceModel);

                return (
                  <button
                    type="button"
                    onClick={() => setShowModelMenu(!showModelMenu)}
                    className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border ${
                      isNvidia
                        ? 'bg-[#76B900]/15 text-[#76B900] border-[#76B900]/40 hover:bg-[#76B900]/25 shadow-sm shadow-[#76B900]/20'
                        : 'bg-purple-500/20 text-purple-300 border border-purple-500/40 hover:bg-purple-500/30'
                    }`}
                    title={`Active Model: ${selectedVoiceModel} (Tap to change)`}
                  >
                    {isNvidia ? (
                      <Cpu className="w-3 h-3 text-[#76B900]" />
                    ) : (
                      <Sparkles className="w-3 h-3 text-purple-400" />
                    )}
                    <span className="font-mono text-[11px] truncate max-w-[85px] sm:max-w-none">
                      {displayName}
                    </span>
                    <span className="text-[9px]">▾</span>
                  </button>
                );
              })()}

              {showModelMenu && (
                <>
                  {/* Backdrop dismiss listener */}
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowModelMenu(false)}
                  />
                  <div className="absolute left-1/2 -translate-x-1/2 sm:translate-x-0 sm:left-0 top-full mt-1.5 w-72 max-w-[calc(100vw-2.5rem)] rounded-2xl bg-slate-900/98 backdrop-blur-xl border border-slate-700 shadow-2xl py-2 z-50 max-h-[440px] overflow-y-auto ring-1 ring-white/10 animate-in fade-in zoom-in-95 duration-150">
                    {aiProvider === 'nvidia' ? (
                      <>
                        {/* NVIDIA AI Foundation Models */}
                        <div className="px-3 py-1 flex items-center justify-between border-b border-slate-800 bg-slate-950/60">
                          <span className="text-[10px] text-[#76B900] font-bold uppercase tracking-wider flex items-center gap-1">
                            <Cpu className="w-3 h-3" />
                            NVIDIA NIM GPU Models
                          </span>
                          <span className="text-[8px] px-1.5 py-0.2 rounded bg-[#76B900]/20 text-[#76B900] font-mono font-bold">
                            ACTIVE
                          </span>
                        </div>
                        {AVAILABLE_NVIDIA_MODELS.filter((m) => !m.supportsImageGen).map((modelOpt) => {
                          const isSelected = selectedVoiceModel === modelOpt.id;
                          return (
                            <button
                              key={modelOpt.id}
                              type="button"
                              onClick={() => {
                                setSelectedVoiceModel(modelOpt.id);
                                setAiProvider('nvidia');
                                localStorage.setItem('aura_ai_provider', 'nvidia');
                                localStorage.setItem('aura_nvidia_model', modelOpt.id);
                                setShowModelMenu(false);
                              }}
                              className={`w-full px-3 py-2 text-xs text-left flex items-start justify-between transition-colors cursor-pointer ${
                                isSelected
                                  ? 'bg-[#76B900]/20 text-emerald-200 font-bold border-l-2 border-[#76B900]'
                                  : 'text-slate-300 hover:bg-slate-800'
                              }`}
                            >
                              <div className="min-w-0 pr-2">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-white text-xs">{modelOpt.name}</span>
                                  <span className="px-1.5 py-0.2 rounded bg-[#76B900]/20 text-[#76B900] text-[9px] font-mono font-bold">
                                    {modelOpt.badge}
                                  </span>
                                </div>
                                <p className="text-[10px] text-slate-400 truncate mt-0.5">{modelOpt.tagline}</p>
                              </div>
                              {isSelected && <span className="text-[#76B900] text-xs font-bold shrink-0 mt-0.5">✓</span>}
                            </button>
                          );
                        })}

                        {/* Quick Switch to Gemini footer option */}
                        <div className="p-2 mt-2 border-t border-slate-800 bg-slate-950/40">
                          <button
                            type="button"
                            onClick={() => {
                              handleToggleProvider('gemini');
                              setShowModelMenu(false);
                            }}
                            className="w-full py-1.5 px-2 rounded-xl text-xs font-semibold text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                          >
                            <Sparkles className="w-3 h-3 text-purple-400" />
                            <span>Switch to Google Gemini Engine</span>
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        {/* Google Gemini Models */}
                        <div className="px-3 py-1.5 flex items-center justify-between border-b border-slate-800 bg-slate-950/60">
                          <span className="text-[10px] text-purple-400 font-semibold uppercase tracking-wider flex items-center gap-1">
                            <Sparkles className="w-3 h-3" />
                            Google Gemini Models
                          </span>
                          <span className="text-[8px] px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 font-mono">
                            ACTIVE
                          </span>
                        </div>
                        {AVAILABLE_GEMINI_MODELS.map((modelOpt) => {
                          const isSelected = selectedVoiceModel === modelOpt.id;
                          return (
                            <button
                              key={modelOpt.id}
                              type="button"
                              onClick={() => {
                                setSelectedVoiceModel(modelOpt.id);
                                setAiProvider('gemini');
                                localStorage.setItem('aura_ai_provider', 'gemini');
                                localStorage.setItem('aura_voice_model', modelOpt.id);
                                setShowModelMenu(false);
                              }}
                              className={`w-full px-3 py-2 text-xs text-left flex items-start justify-between transition-colors cursor-pointer ${
                                isSelected
                                  ? 'bg-purple-600/30 text-purple-200 font-bold border-l-2 border-purple-400'
                                  : 'text-slate-300 hover:bg-slate-800'
                              }`}
                            >
                              <div className="min-w-0 pr-2">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-white text-xs">{modelOpt.name}</span>
                                  <span className="px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 text-[9px] font-mono font-bold">
                                    {modelOpt.badge}
                                  </span>
                                </div>
                                <p className="text-[10px] text-slate-400 truncate mt-0.5">{modelOpt.tagline}</p>
                              </div>
                              {isSelected && <span className="text-purple-400 text-xs font-bold shrink-0 mt-0.5">✓</span>}
                            </button>
                          );
                        })}

                        {/* Quick Switch to NVIDIA footer option */}
                        <div className="p-2 mt-2 border-t border-slate-800 bg-slate-950/40">
                          <button
                            type="button"
                            onClick={() => {
                              handleToggleProvider('nvidia');
                              setShowModelMenu(false);
                            }}
                            className="w-full py-1.5 px-2 rounded-xl text-xs font-semibold text-[#76B900] bg-[#76B900]/10 hover:bg-[#76B900]/20 border border-[#76B900]/30 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                          >
                            <Cpu className="w-3 h-3 text-[#76B900]" />
                            <span>Switch to NVIDIA NIM Engine</span>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Config All Models Button (OpenAI, Claude, Custom Ollama) */}
            <button
              type="button"
              onClick={() => setShowGlobalAiModal(true)}
              className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-850 text-slate-400 hover:text-white border border-slate-800 transition-colors"
              title="Configure & Extensible AI Architecture (OpenAI, Claude, Custom Ollama)"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>

            {/* Windows Host System & Installer Assistant Button */}
            <button
              type="button"
              onClick={() => setShowWindowsInstallerModal(true)}
              className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-850 text-cyan-400 hover:text-cyan-300 border border-slate-800 transition-colors flex items-center gap-1 cursor-pointer"
              title="Auro Windows Host System Assistant & Software Installer (Winget, Choco, PowerShell)"
            >
              <Terminal className="w-3.5 h-3.5" />
              <span className="hidden sm:inline text-[10px] font-bold font-mono">Windows Host</span>
            </button>
          </div>

          {/* Right: Memory, Hands-Free, Help */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Persistent SQLite Memory Bank Header Button */}
            <button
              onClick={() => setShowMemoryDrawer(!showMemoryDrawer)}
              className={`px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all border cursor-pointer ${
                showMemoryDrawer
                  ? 'bg-purple-600/30 text-purple-200 border-purple-500/50 shadow-md shadow-purple-950/40'
                  : 'bg-purple-500/10 text-purple-300 border-purple-500/20 hover:bg-purple-500/20'
              }`}
              title="View & manage persistent SQLite memories stored for your account"
            >
              <Brain className="w-3.5 h-3.5 text-purple-400" />
              <span className="hidden sm:inline">Memory</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-purple-500/30 text-purple-200 font-bold font-mono">
                {assistantMemories.length}
              </span>
            </button>

            {/* Auro Vision for Blind / Low-Vision Guide */}
            {onOpenVision && (
              <button
                onClick={onOpenVision}
                className="px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 transition-all shadow-sm cursor-pointer"
                title="Auro Computer Vision Guide for Blind and Low-Vision Assistance"
                aria-label="Auro Vision for Blind and Low-Vision Assistance"
              >
                <Eye className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Auro Vision</span>
                <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/25 text-amber-200 font-bold">
                  Blind
                </span>
              </button>
            )}

            {/* Hands-Free Button */}
            <button
              onClick={() => {
                const next = !isHandsFree;
                setIsHandsFree(next);
                isHandsFreeRef.current = next;
                speechEngine.setContinuousMode(next);
                if (next && !isListening && !isSpeaking && !isThinking) {
                  speechEngine.startListening();
                } else if (!next && isListening) {
                  speechEngine.stopListening(true);
                }
              }}
              className={`px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all border ${
                isHandsFree
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm shadow-emerald-950/40'
                  : 'bg-slate-900 text-slate-400 border-slate-800'
              }`}
              title={isHandsFree ? 'Hands-Free Loop Active: Auro auto-listens after speaking' : 'Tap to enable Hands-Free Conversation'}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isHandsFree ? 'bg-emerald-400 animate-ping' : 'bg-slate-500'}`} />
              <span className="text-[11px]">{isHandsFree ? 'Hands-Free' : 'Push-to-Talk'}</span>
            </button>

            {/* Microphone Guide Help */}
            <button
              onClick={() => setShowMicHelp(!showMicHelp)}
              className={`p-1.5 rounded-xl transition-colors ${
                showMicHelp
                  ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
              title="Microphone Activation Guide"
            >
              <HelpCircle className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Saved Memory Notice Banner */}
        {savedMemoryNotice && (
          <div className="px-4 py-2.5 bg-gradient-to-r from-purple-950/80 via-slate-900 to-purple-950/80 border-b border-purple-500/40 text-purple-200 text-xs flex items-center justify-between gap-2 animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-purple-300 shrink-0 animate-bounce" />
              <span>
                <strong className="text-white">Stored in SQLite Memory Bank:</strong> {savedMemoryNotice}
              </span>
            </div>
            <button
              onClick={() => setSavedMemoryNotice(null)}
              className="text-purple-300 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Saved Keep Note Notice Banner */}
        {savedKeepNoteNotice && (
          <div className="px-4 py-2.5 bg-gradient-to-r from-amber-950/80 via-slate-900 to-amber-950/80 border-b border-amber-500/40 text-amber-200 text-xs flex items-center justify-between gap-2 animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <Bookmark className="w-4 h-4 text-amber-400 shrink-0 animate-bounce" />
              <span>
                <strong className="text-white">Saved to Google Keep:</strong> {savedKeepNoteNotice}
              </span>
            </div>
            <button
              onClick={() => setSavedKeepNoteNotice(null)}
              className="text-amber-300 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Saved Reminder Notice Banner */}
        {savedReminderNotice && (
          <div className="px-4 py-2.5 bg-gradient-to-r from-teal-950/80 via-slate-900 to-teal-950/80 border-b border-teal-500/40 text-teal-200 text-xs flex items-center justify-between gap-2 animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-teal-400 shrink-0 animate-bounce" />
              <span>
                <strong className="text-white">Saved to Reminders, SQLite & Google Drive:</strong> {savedReminderNotice}
              </span>
            </div>
            <button
              onClick={() => setSavedReminderNotice(null)}
              className="text-teal-300 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Saved Google Drive Upload Notice Banner */}
        {driveUploadNotice && (
          <div className="px-4 py-2.5 bg-gradient-to-r from-emerald-950/80 via-slate-900 to-emerald-950/80 border-b border-emerald-500/40 text-emerald-200 text-xs flex items-center justify-between gap-2 animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <UploadCloud className="w-4 h-4 text-emerald-400 shrink-0 animate-bounce" />
              <span>
                <strong className="text-white">Uploaded to Google Drive:</strong> {driveUploadNotice} (Saved & available in Google One tab)
              </span>
            </div>
            <button
              onClick={() => setDriveUploadNotice(null)}
              className="text-emerald-300 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Device Internal Storage Drawer */}
        {showDeviceStorageNotice && (
          <div className="p-4 bg-slate-900 border-b border-emerald-500/30 text-xs text-slate-300 space-y-3 max-h-72 overflow-y-auto animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-emerald-400" />
                <span className="font-bold text-white text-xs">Internal Phone Storage & Health</span>
                {internalStorageDetails && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono">
                    {internalStorageDetails.percentUsed}% Used
                  </span>
                )}
              </div>
              <button
                onClick={() => setShowDeviceStorageNotice(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            {internalStorageDetails && (
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Total ROM: {internalStorageDetails.totalStorageGb} GB</span>
                  <span className="text-emerald-300 font-bold font-mono">{internalStorageDetails.freeStorageGb} GB Free</span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${internalStorageDetails.percentUsed}%` }}
                  />
                </div>
                <div className="grid grid-cols-3 gap-2 text-[11px] pt-1">
                  <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                    <span className="text-slate-400 block">System</span>
                    <strong className="text-white">{internalStorageDetails.breakdown.systemGb} GB</strong>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                    <span className="text-slate-400 block">Apps</span>
                    <strong className="text-white">{internalStorageDetails.breakdown.appsGb} GB</strong>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                    <span className="text-slate-400 block">Media</span>
                    <strong className="text-white">{internalStorageDetails.breakdown.mediaGb} GB</strong>
                  </div>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                  <span>RAM: <strong className="text-slate-200">{internalStorageDetails.deviceRamGb} GB</strong></span>
                  <span>Battery: <strong className="text-slate-200">{internalStorageDetails.batteryLevel}% {internalStorageDetails.isCharging ? '⚡' : ''}</strong></span>
                  <button
                    onClick={() => handleUserSpeech('Analyze my internal phone storage and recommend clean-up options.')}
                    className="text-emerald-400 hover:underline font-semibold"
                  >
                    Ask Auro &rarr;
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Persistent Memory Bank Drawer */}
        {showMemoryDrawer && (
          <div className="p-4 bg-slate-900 border-b border-purple-500/30 text-xs text-slate-300 space-y-3 max-h-72 overflow-y-auto animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-purple-400" />
                <span className="font-bold text-white text-xs">Persistent Account Memory (SQLite)</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-mono">
                  {user.email || 'chinna.tamil2000@gmail.com'}
                </span>
              </div>
              <button
                onClick={() => setShowMemoryDrawer(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-[11px] text-slate-400">
              Details saved to Auro's memory during voice discussions. Auro automatically recalls these notes in every conversation.
            </p>

            {/* Quick Add Memory Form */}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!newMemTopic.trim() || !newMemContent.trim()) return;
                setIsAddingMem(true);
                await saveAssistantMemory(newMemTopic.trim(), newMemContent.trim(), ['voice-manual-entry']);
                setNewMemTopic('');
                setNewMemContent('');
                setIsAddingMem(false);
              }}
              className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2"
            >
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Topic / Keyword (e.g. Wi-Fi PIN)"
                  value={newMemTopic}
                  onChange={(e) => setNewMemTopic(e.target.value)}
                  className="w-1/2 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-purple-400"
                />
                <input
                  type="text"
                  placeholder="Memory details to remember..."
                  value={newMemContent}
                  onChange={(e) => setNewMemContent(e.target.value)}
                  className="w-1/2 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-purple-400"
                />
              </div>
              <button
                type="submit"
                disabled={isAddingMem || !newMemTopic.trim() || !newMemContent.trim()}
                className="w-full py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-medium text-[11px] flex items-center justify-center gap-1 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isAddingMem ? 'Saving to SQLite...' : 'Save Note to Memory Bank'}</span>
              </button>
            </form>

            {/* Stored Memory Items List */}
            <div className="space-y-1.5">
              {assistantMemories.length === 0 ? (
                <div className="p-3 text-center text-slate-500 text-[11px] rounded-xl bg-slate-950 border border-slate-800">
                  No memories saved yet. Say <em>"Auro, remember that..."</em> or <em>"Auro, இதை memory-ல store பண்ணு..."</em> to save items here!
                </div>
              ) : (
                assistantMemories.map((mem) => (
                  <div
                    key={mem.id}
                    className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 flex items-start justify-between gap-2"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-purple-300 text-xs">{mem.topic}</span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">
                          {mem.source || 'voice-assistant'}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {new Date(mem.timestamp).toLocaleDateString()} {new Date(mem.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-slate-200 text-xs leading-relaxed">{mem.memoryContent}</p>
                    </div>
                    <button
                      onClick={() => deleteAssistantMemory(mem.id)}
                      className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors shrink-0"
                      title="Delete this memory"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Microphone Help & Permission Guide Dropdown */}
        {showMicHelp && (
          <div className="p-4 bg-slate-900 border-b border-indigo-500/30 text-xs text-slate-300 space-y-2.5 animate-fade-in">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2 font-semibold text-white">
                <Mic className="w-4 h-4 text-indigo-400" />
                <span>How to Activate & Allow Microphone in Your Browser</span>
              </div>
              <button
                onClick={() => setShowMicHelp(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <ol className="list-decimal list-inside space-y-1 text-slate-300 text-[11px] leading-relaxed">
              <li>
                <strong className="text-white">Tap the big Mic button</strong> below or the floating mic button in the bottom navigation.
              </li>
              <li>
                When your browser shows the popup <strong className="text-indigo-300">"ais-dev-... wants to use your microphone"</strong>, click <strong className="text-emerald-400">"Allow"</strong>.
              </li>
              <li>
                <strong className="text-white">If permission was blocked:</strong> Click the <strong className="text-indigo-300">🔒 lock or 🎛️ tune icon</strong> on the left side of the browser URL bar, toggle <strong className="text-emerald-400">Microphone to Allow</strong>, and reload.
              </li>
              <li>
                <strong className="text-white">On Mobile / Android:</strong> Tap Chrome's ⋮ menu &rarr; Settings &rarr; Site settings &rarr; Microphone &rarr; toggle on.
              </li>
            </ol>
            <div className="pt-1 flex items-center gap-2">
              <button
                onClick={async () => {
                  setMicStatusMessage(null);
                  const ok = await speechEngine.requestMicPermission();
                  if (ok) {
                    setMicStatusMessage('Microphone access granted! Tap the mic button to start speaking.');
                  } else {
                    setMicStatusMessage('Microphone access blocked. Please check site permissions in your browser URL bar.');
                  }
                }}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-[11px] flex items-center gap-1.5 transition-colors"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Test & Request Microphone Access</span>
              </button>
            </div>
          </div>
        )}

        {/* Inline Mic Status or Warning Alert */}
        {micStatusMessage && (
          <div className="px-4 py-2.5 bg-amber-500/15 border-b border-amber-500/30 text-amber-200 text-xs flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{micStatusMessage}</span>
            </div>
            <button
              onClick={() => setMicStatusMessage(null)}
              className="text-amber-400/80 hover:text-amber-200 shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Dynamic Waveform Visualizer & Persona Sphere */}
        <div className="py-5 px-6 bg-gradient-to-b from-slate-950/60 to-transparent flex flex-col items-center justify-center relative border-b border-slate-800/40">
          <div className="relative flex items-center justify-center">
            {/* Outer pulsating rings */}
            <div
              className={`absolute w-32 h-32 rounded-full transition-all duration-700 pointer-events-none ${
                isSpeaking
                  ? 'bg-purple-500/20 scale-125 animate-ping'
                  : isListening
                  ? 'bg-emerald-500/20 scale-110 animate-pulse'
                  : isThinking
                  ? 'bg-amber-500/20 scale-110 animate-spin'
                  : 'bg-indigo-500/10 scale-100'
              }`}
            />

            {/* Glowing Orb */}
            <button
              type="button"
              onClick={toggleMic}
              className={`w-20 h-20 rounded-full flex items-center justify-center shadow-2xl transition-all duration-500 z-10 cursor-pointer active:scale-95 ${
                isSpeaking
                  ? 'bg-gradient-to-tr from-purple-600 via-indigo-500 to-pink-500 shadow-purple-500/40 scale-105 ring-4 ring-purple-500/40'
                  : isListening
                  ? 'bg-gradient-to-tr from-emerald-600 to-teal-500 shadow-emerald-500/40 scale-105 ring-4 ring-emerald-500/30'
                  : isThinking
                  ? 'bg-gradient-to-tr from-amber-600 to-orange-500 shadow-amber-500/40'
                  : 'bg-gradient-to-tr from-indigo-900 to-slate-800 shadow-indigo-950/50 hover:ring-4 hover:ring-indigo-500/30'
              }`}
              title={isListening ? 'Tap to pause/commit speech' : 'Tap to speak with Auro'}
              aria-label={isListening ? 'Stop listening' : 'Start speaking'}
            >
              {isListening ? (
                <Mic className="w-8 h-8 text-white animate-bounce" />
              ) : isSpeaking ? (
                <Volume2 className="w-8 h-8 text-white animate-pulse" />
              ) : isThinking ? (
                <Sparkles className="w-8 h-8 text-amber-200 animate-spin" />
              ) : (
                <Mic className="w-8 h-8 text-indigo-300" />
              )}
            </button>
          </div>

          {/* Status Label & Waveform bars */}
          <div className="mt-3 text-center">
            <span className="text-xs font-semibold tracking-wide uppercase text-slate-400">
              {isListening
                ? 'Listening to your voice... (Pause or tap Answer)'
                : isSpeaking
                ? 'Aura is speaking...'
                : isThinking
                ? 'Synthesizing real-time voice response...'
                : isLocalVoiceMode
                ? 'Tap microphone to transcribe on this device'
                : 'Tap microphone below to talk'}
            </span>

            {/* Animated Audio Equalizer Bars */}
            <div className="flex items-center justify-center gap-1 mt-2 h-4">
              {[40, 70, 95, 60, 85, 100, 75, 45, 90, 65, 35].map((height, idx) => {
                let barHeight = '20%';
                if (isSpeaking) {
                  barHeight = `${Math.min(100, height * 0.7 + Math.random() * 30)}%`;
                } else if (isListening) {
                  const dynamicHeight = Math.max(18, Math.min(100, liveVolume > 5 ? liveVolume * (height / 50) : height * 0.25));
                  barHeight = `${dynamicHeight.toFixed(0)}%`;
                } else if (isThinking) {
                  barHeight = '45%';
                }
                return (
                  <span
                    key={idx}
                    className={`w-1 rounded-full transition-all duration-150 ${
                      isSpeaking
                        ? 'bg-indigo-400'
                        : isListening
                        ? 'bg-emerald-400'
                        : isThinking
                        ? 'bg-amber-400'
                        : 'bg-slate-700'
                    }`}
                    style={{ height: barHeight }}
                  />
                );
              })}
            </div>

            {/* Active AI Engine Indicator Pill */}
            <div className="flex items-center justify-center mt-2">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[10.5px] font-semibold border ${
                  aiProvider === 'nvidia'
                    ? 'bg-[#76B900]/15 text-[#76B900] border-[#76B900]/30 shadow-sm shadow-[#76B900]/10'
                    : 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                }`}
              >
                {aiProvider === 'nvidia' ? (
                  <>
                    <Cpu className="w-3 h-3 text-[#76B900]" />
                    <span>NVIDIA NIM: <strong className="font-mono">{selectedVoiceModel.replace('nvidia/', '')}</strong> • Speech & Transcribe Active</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3 h-3 text-purple-400" />
                    <span>Google Gemini: <strong className="font-mono">{selectedVoiceModel}</strong> • Speech & Transcribe Active</span>
                  </>
                )}
              </span>
            </div>

            {/* Quick Language Switcher Bar */}
            <div className="flex items-center justify-center gap-1.5 mt-2.5">
              {SUPPORTED_VOICE_LANGUAGES.map((lang) => {
                const isActive = voiceLanguage === lang.code;
                return (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => handleSelectLanguage(lang.code)}
                    className={`text-[10.5px] px-2.5 py-1 rounded-full font-medium transition-all flex items-center gap-1 cursor-pointer active:scale-95 ${
                      isActive
                        ? 'bg-indigo-600 text-white font-bold shadow-md shadow-indigo-600/30 ring-1 ring-indigo-400'
                        : 'bg-slate-900/90 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800'
                    }`}
                  >
                    <span>{lang.flag}</span>
                    <span>{lang.nativeName}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Live Transcript Preview */}
          {liveTranscript && (
            <div className="mt-3 px-4 py-2.5 rounded-2xl bg-slate-950/95 border border-indigo-500/50 text-indigo-200 text-xs flex items-center justify-between gap-3 shadow-xl max-w-lg w-full animate-fade-in">
              <div className="flex flex-col min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-semibold mb-0.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
                  <span>
                    {isLocalVoiceMode
                      ? 'Device voice transcript:'
                      : 'Hearing voice • Auto-answering on pause:'}
                  </span>
                </div>
                <div className="truncate text-white font-medium italic text-xs">
                  "{liveTranscript}"
                </div>
              </div>
              {!isLocalVoiceMode && <button
                type="button"
                onClick={() => {
                  speechEngine.unlockAudio();
                  speechEngine.commitCurrentSpeech();
                }}
                className="shrink-0 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/30 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                title="Send spoken words immediately"
              >
                <span>Answer Now</span>
                <Send className="w-3.5 h-3.5" />
              </button>}
            </div>
          )}
        </div>

        {/* Conversation Stream */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {chatHistory.length > 0 && (
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800/80 text-xs text-slate-400">
              <span className="font-mono text-[11px]">{chatHistory.length} messages</span>
              <button
                type="button"
                onClick={() => clearChatHistory()}
                className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 transition-colors px-2 py-0.5 rounded-lg hover:bg-rose-500/10 cursor-pointer"
                title="Clear conversation history"
              >
                <Trash2 className="w-3 h-3" />
                <span>Clear Chat</span>
              </button>
            </div>
          )}
          {chatHistory.map((msg) => {
            const displayContent = (() => {
              const lines = String(msg.content || '').split('\n').map((l) => l.trim()).filter(Boolean);
              const deduped = [...new Set(lines)];
              return deduped.join('\n\n') || msg.content;
            })();
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl p-3.5 text-sm leading-relaxed shadow-md ${
                    msg.role === 'user'
                      ? 'bg-indigo-600 text-white rounded-tr-xs'
                      : 'bg-slate-800/90 border border-slate-700/60 text-slate-100 rounded-tl-xs'
                  }`}
                >
                  {msg.role === 'assistant' && msg.emotion && (
                    <div className="flex items-center gap-1.5 text-[10px] text-indigo-300 font-medium mb-1 border-b border-slate-700/60 pb-1">
                      <Sparkles className="w-3 h-3" />
                      <span>Empathetic Resonance: {msg.emotion}</span>
                    </div>
                  )}

                  {msg.attachment && (
                    <div className="mb-2.5 p-2 rounded-xl bg-indigo-700/60 border border-indigo-400/30 flex items-center gap-2">
                      {msg.attachment.previewUrl ? (
                        <img
                          src={msg.attachment.previewUrl}
                          alt={msg.attachment.name}
                          className="w-11 h-11 object-cover rounded-lg border border-indigo-300/40 shrink-0"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-lg bg-indigo-800/90 flex items-center justify-center shrink-0 text-white shadow-inner">
                          <Paperclip className="w-4 h-4" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-white truncate">{msg.attachment.name}</p>
                        <p className="text-[10px] text-indigo-200">{msg.attachment.size}</p>
                      </div>
                    </div>
                  )}

                  <p className="whitespace-pre-wrap">{displayContent}</p>

                  {/* Interactive Windows System Step Execution Card */}
                  {msg.systemExecutionResult && (
                    <div className="mt-3 p-3 rounded-2xl bg-slate-950/95 border border-cyan-500/40 font-mono text-xs space-y-2.5 shadow-lg">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                        <div className="flex items-center gap-1.5 text-cyan-400 font-bold">
                          <Terminal className="w-3.5 h-3.5" />
                          <span>{msg.systemExecutionResult.stepTitle || 'Windows Host Execution'}</span>
                        </div>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            msg.systemExecutionResult.success
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                              : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                          }`}
                        >
                          {msg.systemExecutionResult.success
                            ? '✓ EXECUTED'
                            : `EXIT ${msg.systemExecutionResult.exitCode}`}
                        </span>
                      </div>

                      {msg.systemExecutionResult.stepDescription && (
                        <p className="text-[11px] text-slate-300 font-sans leading-relaxed">
                          {msg.systemExecutionResult.stepDescription}
                        </p>
                      )}

                      <div className="bg-slate-900/90 p-2 rounded-xl border border-slate-800 text-[11px] text-cyan-300 overflow-x-auto flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-slate-500 font-bold">PS&gt;</span>
                          <span className="truncate">{msg.systemExecutionResult.command}</span>
                        </div>
                        <span className="text-[9px] text-slate-500 font-mono shrink-0">
                          {msg.systemExecutionResult.durationMs}ms
                        </span>
                      </div>

                      {msg.systemExecutionResult.stdout && (
                        <pre className="text-slate-200 text-[11px] whitespace-pre-wrap max-h-36 overflow-y-auto leading-relaxed bg-slate-950 p-2.5 rounded-xl border border-slate-900">
                          {msg.systemExecutionResult.stdout}
                        </pre>
                      )}

                      {msg.systemExecutionResult.stderr && (
                        <pre className="text-rose-300 text-[11px] whitespace-pre-wrap max-h-36 overflow-y-auto leading-relaxed bg-rose-950/40 p-2.5 rounded-xl border border-rose-900/40">
                          {msg.systemExecutionResult.stderr}
                        </pre>
                      )}

                      <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
                        {msg.systemExecutionResult.nextStep ? (
                          <div className="flex items-center gap-1 text-[10px] text-indigo-300">
                            <ArrowRight className="w-3 h-3 text-cyan-400" />
                            <span>Next: {msg.systemExecutionResult.nextStep}</span>
                          </div>
                        ) : (
                          <div />
                        )}

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (msg.systemExecutionResult?.command) {
                                openWindowsTerminalWindow(msg.systemExecutionResult.command);
                              }
                            }}
                            className="text-[10px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors cursor-pointer bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-500/30"
                            title="Open a visible PowerShell window on your Windows desktop running this command"
                          >
                            <Terminal className="w-3 h-3" />
                            <span>Open PowerShell Window</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setShowWindowsInstallerModal(true)}
                            className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <span>Open Windows Console</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Interactive Live Weather Report Card */}
                  {msg.weatherCard && (
                    <div className="mt-3 p-3 rounded-2xl bg-gradient-to-r from-sky-950/70 via-slate-900 to-indigo-950/70 border border-sky-500/40 shadow-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <CloudSun className="w-4 h-4 text-sky-400 shrink-0" />
                          <span className="text-xs font-bold text-white truncate">
                            {msg.weatherCard.location}
                          </span>
                        </div>
                        <span className="text-sm font-mono font-bold text-sky-300 shrink-0">
                          {msg.weatherCard.temperature}°C
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-300 pt-1 border-t border-slate-800/80">
                        <span className="text-sky-200">{msg.weatherCard.condition}</span>
                        <span className="font-mono text-slate-400 text-[10px]">
                          H: {msg.weatherCard.high}°C / L: {msg.weatherCard.low}°C
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-1.5 pt-1 text-[10px] text-slate-400 font-mono">
                        <div className="bg-slate-950/60 p-1.5 rounded-lg border border-slate-800 text-center">
                          <span className="text-slate-500 block text-[9px]">HUMIDITY</span>
                          <span className="text-white font-bold">{msg.weatherCard.humidity}%</span>
                        </div>
                        <div className="bg-slate-950/60 p-1.5 rounded-lg border border-slate-800 text-center">
                          <span className="text-slate-500 block text-[9px]">RAIN CHANCE</span>
                          <span className="text-white font-bold">{msg.weatherCard.rainChance}%</span>
                        </div>
                        <div className="bg-slate-950/60 p-1.5 rounded-lg border border-slate-800 text-center">
                          <span className="text-slate-500 block text-[9px]">WIND</span>
                          <span className="text-white font-bold truncate">{msg.weatherCard.wind || '12 km/h'}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
                        {msg.weatherCard.coordinates && (
                          <span className="text-[10px] text-slate-500 font-mono">
                            {msg.weatherCard.coordinates.latitude.toFixed(2)}°N, {msg.weatherCard.coordinates.longitude.toFixed(2)}°E
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            if (onNavigateTab) {
                              onNavigateTab('weather');
                            }
                          }}
                          className="text-[10px] text-sky-400 hover:text-sky-300 flex items-center gap-1 transition-colors cursor-pointer ml-auto font-semibold"
                        >
                          <span>Open Weather Tab</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Apple Books Sovereign Library Card */}
                  {msg.bookCard && (
                    <div className="mt-3 p-3 rounded-2xl bg-gradient-to-r from-amber-950/70 via-slate-900 to-orange-950/70 border border-amber-500/40 shadow-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <BookOpen className="w-4 h-4 text-amber-400 shrink-0" />
                          <span className="text-xs font-bold text-white truncate">
                            {msg.bookCard.title}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          {msg.bookCard.totalPages ? `${msg.bookCard.totalPages} pages` : 'Apple Books'}
                        </span>
                      </div>

                      {msg.bookCard.author && (
                        <p className="text-[11px] text-slate-300">
                          Author: <span className="text-white font-medium">{msg.bookCard.author}</span>
                        </p>
                      )}

                      {msg.bookCard.driveFolderPath && (
                        <p className="text-[10px] text-slate-400 font-mono truncate">
                          Drive: {msg.bookCard.driveFolderPath}
                        </p>
                      )}

                      <div className="flex items-center justify-end pt-1 border-t border-slate-800/80">
                        <button
                          type="button"
                          onClick={() => {
                            if (onNavigateTab) {
                              onNavigateTab('ibooks');
                            }
                          }}
                          className="text-[10px] text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors cursor-pointer font-semibold"
                        >
                          <span>Open Apple Books Library</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  )}

                {msg.actionSuggestion && (
                  <div className="mt-2.5 pt-2 border-t border-slate-700/60 flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                    <Compass className="w-3.5 h-3.5 shrink-0" />
                    <span>Suggested: {msg.actionSuggestion}</span>
                  </div>
                )}

                {msg.role === 'assistant' && (
                  <div className="mt-2.5 pt-2 border-t border-slate-700/60 flex items-center justify-between text-xs gap-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleSyncAssistantMessageToDrive(msg)}
                        disabled={syncingDriveMsgId === msg.id}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all text-[11px] font-medium cursor-pointer ${
                          syncedDriveMsgIds.has(msg.id)
                            ? 'bg-teal-500/20 text-teal-300 border-teal-500/40'
                            : 'bg-indigo-950/80 hover:bg-indigo-900/90 text-indigo-300 hover:text-white border-indigo-500/30'
                        }`}
                        title="Sync this response to Google Drive under Family Circle"
                      >
                        <HardDrive className={`w-3.5 h-3.5 ${syncedDriveMsgIds.has(msg.id) ? 'text-teal-400' : 'text-indigo-400'}`} />
                        <span>
                          {syncedDriveMsgIds.has(msg.id)
                            ? '✓ Synced in Drive'
                            : syncingDriveMsgId === msg.id
                            ? 'Syncing to Drive...'
                            : 'Sync to Drive'}
                        </span>
                      </button>

                      {syncedDriveMsgLinks[msg.id] && (
                        <a
                          href={syncedDriveMsgLinks[msg.id]}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 text-[10px] font-semibold border border-teal-500/30"
                          title="Open this file in Google Drive"
                        >
                          <span>Open</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(msg.content);
                          setCopiedMsgId(msg.id);
                          setTimeout(() => setCopiedMsgId(null), 2000);
                        }}
                        className="p-1.5 rounded-lg bg-slate-900/60 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
                        title="Copy message"
                      >
                        {copiedMsgId === msg.id ? (
                          <Check className="w-3.5 h-3.5 text-teal-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <button
                        onClick={() => speakWithAuro(msg.content)}
                        className="p-1.5 rounded-lg bg-slate-900/60 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
                        title="Listen with voice"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <span className="text-[10px] text-slate-500 mt-1 px-1">{msg.timestamp}</span>
            </div>
          );
        })}

          {isThinking && (
            <div className="flex items-center gap-2 text-slate-400 text-xs p-2">
              <Sparkles className="w-4 h-4 animate-spin text-indigo-400" />
              <span>
                {isAnalyzingFile
                  ? 'Auro is analyzing your attached file in real time...'
                  : 'Aura is reflecting on your personal memory and goals...'}
              </span>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Live Auro Intelligence Quick Bar: WhatsApp Latest & GCP Live Spend */}
        <div className="px-4 py-2 bg-slate-950/80 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
          {(() => {
            const incomingMsgs = (whatsAppMessages || []).filter((m) => !m.isOutgoing);
            const latest = incomingMsgs[incomingMsgs.length - 1];
            if (!latest) return null;
            return (
              <div className="w-full sm:w-auto flex items-center justify-between sm:justify-start gap-2 bg-emerald-950/40 border border-emerald-500/30 px-2.5 py-1.5 rounded-xl text-emerald-300">
                <div className="flex items-center gap-1.5 truncate max-w-[220px]">
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="font-semibold">{latest.contactName}:</span>
                  <span className="text-[11px] truncate text-slate-300">"{latest.text}"</span>
                </div>
                {Boolean(latest.suggestedReplies && latest.suggestedReplies.length > 0 && latest.suggestedReplies[0]) && (
                  <button
                    onClick={() => handleUserSpeech(`Reply to ${latest.contactName} on WhatsApp: ${latest.suggestedReplies?.[0] || ''}`)}
                    className="shrink-0 px-2 py-0.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] shadow transition-colors flex items-center gap-1"
                    title={`Send Auro suggested reply to ${latest.contactName}`}
                  >
                    <span>Reply</span>
                    <Sparkles className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
            );
          })()}

          <div className="w-full sm:w-auto flex items-center justify-between sm:justify-start gap-2 bg-indigo-950/40 border border-indigo-500/30 px-2.5 py-1.5 rounded-xl text-indigo-300">
            <div className="flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span className="font-semibold">GCP Spend:</span>
              <span className="font-mono text-white">${gcpBillingConfig.currentMtdSpend.toFixed(2)}</span>
              <span className="text-[10px] text-slate-400 font-mono">/ ${gcpBillingConfig.monthlyBudgetLimit.toFixed(2)}</span>
            </div>
            <button
              onClick={() => handleUserSpeech('Check my Google Cloud usage and billing spend.')}
              className="shrink-0 px-2 py-0.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] shadow transition-colors"
            >
              Audit
            </button>
          </div>
        </div>

        {/* Quick Prompts Suggestions */}
        <div className="px-4 py-2 border-t border-slate-800/60 flex items-center gap-2 overflow-x-auto no-scrollbar">
          {quickPrompts.map((qp, idx) => (
            <button
              key={idx}
              onClick={() => handleUserSpeech(qp.text)}
              className="shrink-0 px-3 py-1.5 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 text-xs text-slate-300 hover:text-white transition-colors"
            >
              {qp.label}
            </button>
          ))}
        </div>

        {/* Selected Attachment Preview & Upload to Drive Bar */}
        {selectedFile && (
          <div className="px-4 py-2.5 bg-gradient-to-r from-indigo-950/90 via-slate-900 to-indigo-950/90 border-t border-indigo-500/40 flex items-center justify-between gap-3 animate-fade-in shadow-lg">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              {filePreviewUrl ? (
                <img
                  src={filePreviewUrl}
                  alt={selectedFile.name}
                  className="w-10 h-10 rounded-xl object-cover border border-indigo-400/50 shrink-0 shadow-md"
                />
              ) : (
                <div className="w-8 h-8 rounded-xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center shrink-0 text-indigo-300">
                  <Paperclip className="w-4 h-4" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-white truncate max-w-[200px] sm:max-w-xs">{selectedFile.name}</span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    ({(selectedFile.size / (1024 * 1024)).toFixed(1) === '0.0' ? `${Math.round(selectedFile.size / 1024)} KB` : `${(selectedFile.size / (1024 * 1024)).toFixed(1)} MB`})
                  </span>
                </div>
                <div className="text-[10.5px] text-indigo-300 flex items-center gap-1">
                  <HardDrive className={`w-3 h-3 ${isGoogleConnected ? 'text-emerald-400' : 'text-amber-400'} shrink-0`} />
                  <span>
                    {isGoogleConnected
                      ? 'Ready for real-time Auro multimodal analysis & Google Drive sync'
                      : 'Attach to analyze in real time with Auro, or connect Drive'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() =>
                  handleUserSpeech(
                    voiceLanguage.startsWith('ta')
                      ? `இந்த இணைக்கப்பட்ட கோப்பை ("${selectedFile.name}") நிகழ்நேரத்தில் ஆய்வு செய்து என்னவென்று விளக்குங்கள்.`
                      : `Please analyze this attached file "${selectedFile.name}" in real time, extract key facts, and tell me what it is about.`
                  )
                }
                className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs shadow-md shadow-indigo-600/30 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                title="Ask Auro to analyze this file in real-time"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-spin" />
                <span>Analyze with Auro</span>
              </button>

              <button
                type="button"
                disabled={isUploadingToDrive}
                onClick={() => handleUploadAttachmentToDrive()}
                className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-md shadow-emerald-600/30 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
                title="Upload immediately to Google Drive"
              >
                {isUploadingToDrive ? (
                  <>
                    <Sparkles className="w-3.5 h-3.5 animate-spin" />
                    <span>Uploading...</span>
                  </>
                ) : isGoogleConnected ? (
                  <>
                    <UploadCloud className="w-3.5 h-3.5" />
                    <span>Upload to Drive</span>
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-3.5 h-3.5 text-amber-300" />
                    <span>Connect & Upload</span>
                  </>
                )}
              </button>

              {(selectedFile.type === 'application/pdf' ||
                selectedFile.name.toLowerCase().endsWith('.pdf') ||
                selectedFile.name.toLowerCase().endsWith('.epub')) && (
                <button
                  type="button"
                  disabled={isUploadingToAppleBooks}
                  onClick={() => handleUploadAttachmentToAppleBooks()}
                  className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold text-xs shadow-md shadow-amber-600/30 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
                  title="Upload book into Apple Books library via Google Drive"
                >
                  {isUploadingToAppleBooks ? (
                    <>
                      <Sparkles className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving Book...</span>
                    </>
                  ) : (
                    <>
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>Apple Books (Drive)</span>
                    </>
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setSelectedFile(null);
                  setFilePreviewUrl(null);
                  setFileSnippet('');
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-300 hover:bg-slate-800 transition-colors cursor-pointer"
                title="Remove attachment"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Hidden File Inputs for Attachments, Camera, Gallery, and Apple Books */}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileChange}
          accept="*/*"
        />

        <input
          ref={appleBooksInputRef}
          type="file"
          className="hidden"
          accept=".pdf,.epub,application/pdf"
          onChange={handleAppleBooksFileChange}
        />

        <input
          ref={cameraInputRef}
          type="file"
          className="hidden"
          accept="image/*"
          capture="environment"
          onChange={handleCameraCapture}
        />

        <input
          ref={galleryInputRef}
          type="file"
          className="hidden"
          accept="image/*"
          onChange={handleFileChange}
        />

        {/* Input Dock & Big Mic Trigger */}
        <div className="p-3 sm:p-4 bg-slate-950 border-t border-slate-800 flex items-center gap-2">
          <button
            onClick={handleCancelAndGoHome}
            className="p-3.5 rounded-2xl flex items-center justify-center bg-slate-900 hover:bg-rose-950/50 text-slate-400 hover:text-rose-300 border border-slate-800 hover:border-rose-500/40 transition-all shadow active:scale-95 cursor-pointer shrink-0"
            title="Cancel and return to Home Hub"
            aria-label="Cancel and go back to home"
          >
            <Home className="w-5 h-5" />
          </button>

          {/* Action Hub / Plus (+) Button & Options Menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowPlusMenu((prev) => !prev)}
              className={`p-3.5 rounded-2xl flex items-center justify-center transition-all shadow border cursor-pointer active:scale-95 ${
                showPlusMenu
                  ? 'bg-indigo-600 text-white border-indigo-400 ring-2 ring-indigo-400/40'
                  : selectedFile
                  ? 'bg-indigo-600 text-white border-indigo-400 ring-2 ring-indigo-400/30'
                  : 'bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border-slate-800 hover:border-indigo-500/40'
              }`}
              title="Add attachment, open camera, or analyze media"
              aria-label="Add options: camera, files, documents"
            >
              <Plus className={`w-5 h-5 transition-transform duration-200 ${showPlusMenu ? 'rotate-45' : ''}`} />
            </button>

            {/* Popup Menu for Plus (+) Options */}
            {showPlusMenu && (
              <div
                ref={plusMenuRef}
                className="absolute bottom-full left-0 mb-3 w-72 sm:w-80 bg-slate-900/95 backdrop-blur-xl border border-indigo-500/30 rounded-2xl p-2 shadow-2xl shadow-black/80 z-50 animate-fade-in"
              >
                <div className="px-3 py-2 border-b border-slate-800/80 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Auro Multimodal Tools</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowPlusMenu(false)}
                    className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="p-1 space-y-1">
                  {/* Option 1: Open Camera to take an image */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowPlusMenu(false);
                      cameraInputRef.current?.click();
                    }}
                    className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-indigo-600/20 hover:border-indigo-500/30 border border-transparent transition-all text-left group cursor-pointer"
                  >
                    <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center shrink-0 text-indigo-400 group-hover:scale-105 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm">
                      <Camera className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-white group-hover:text-indigo-200 flex items-center gap-1.5">
                        <span>Open Camera</span>
                        <span className="text-[10px] font-normal px-1.5 py-0.5 bg-indigo-500/20 text-indigo-300 rounded-full border border-indigo-500/30">Live Snap</span>
                      </p>
                      <p className="text-[11px] text-slate-400 truncate">Take a photo to analyze in real time with Auro</p>
                    </div>
                  </button>

                  {/* Option 2: Attach File / Document */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowPlusMenu(false);
                      fileInputRef.current?.click();
                    }}
                    className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-emerald-600/20 hover:border-emerald-500/30 border border-transparent transition-all text-left group cursor-pointer"
                  >
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0 text-emerald-400 group-hover:scale-105 group-hover:bg-emerald-600 group-hover:text-white transition-all shadow-sm">
                      <Paperclip className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-white group-hover:text-emerald-200">Attach File / Document</p>
                      <p className="text-[11px] text-slate-400 truncate">PDF, Word, Excel, text notes, or reports</p>
                    </div>
                  </button>

                  {/* Option 3: Photo Gallery */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowPlusMenu(false);
                      galleryInputRef.current?.click();
                    }}
                    className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-purple-600/20 hover:border-purple-500/30 border border-transparent transition-all text-left group cursor-pointer"
                  >
                    <div className="w-9 h-9 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center shrink-0 text-purple-400 group-hover:scale-105 group-hover:bg-purple-600 group-hover:text-white transition-all shadow-sm">
                      <ImageIcon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-white group-hover:text-purple-200">Photo Library</p>
                      <p className="text-[11px] text-slate-400 truncate">Upload photos and screenshots from gallery</p>
                    </div>
                  </button>

                  {/* Option 4: Auro Vision Assist */}
                  {onOpenVision && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowPlusMenu(false);
                        onOpenVision();
                      }}
                      className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-sky-600/20 hover:border-sky-500/30 border border-transparent transition-all text-left group cursor-pointer"
                    >
                      <div className="w-9 h-9 rounded-xl bg-sky-500/20 border border-sky-500/40 flex items-center justify-center shrink-0 text-sky-400 group-hover:scale-105 group-hover:bg-sky-600 group-hover:text-white transition-all shadow-sm">
                        <Eye className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-white group-hover:text-sky-200">Auro Computer Vision</p>
                        <p className="text-[11px] text-slate-400 truncate">Live camera guidance for objects & text</p>
                      </div>
                    </button>
                  )}

                  {/* Option 5: Document Scanner */}
                  {onNavigateTab && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowPlusMenu(false);
                        onNavigateTab('scanner');
                      }}
                      className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-amber-600/20 hover:border-amber-500/30 border border-transparent transition-all text-left group cursor-pointer"
                    >
                      <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0 text-amber-400 group-hover:scale-105 group-hover:bg-amber-600 group-hover:text-white transition-all shadow-sm">
                        <Scan className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-white group-hover:text-amber-200">Scan Physical Document</p>
                        <p className="text-[11px] text-slate-400 truncate">Auto edge crop for receipts & IDs</p>
                      </div>
                    </button>
                  )}

                  {/* Option 6: Upload Book to Apple Books Library */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowPlusMenu(false);
                      appleBooksInputRef.current?.click();
                    }}
                    className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-orange-600/20 hover:border-orange-500/30 border border-transparent transition-all text-left group cursor-pointer"
                  >
                    <div className="w-9 h-9 rounded-xl bg-orange-500/20 border border-orange-500/40 flex items-center justify-center shrink-0 text-orange-400 group-hover:scale-105 group-hover:bg-orange-600 group-hover:text-white transition-all shadow-sm">
                      <BookOpen className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-white group-hover:text-orange-200 flex items-center gap-1.5">
                        <span>Apple Books Library</span>
                        <span className="text-[10px] font-normal px-1.5 py-0.5 bg-orange-500/20 text-orange-300 rounded-full border border-orange-500/30">Drive Sync</span>
                      </p>
                      <p className="text-[11px] text-slate-400 truncate">Upload PDF/eBook directly to Apple Books & Drive</p>
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>

          <form onSubmit={handleManualSend} className="flex-1 flex items-center gap-2">
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder={
                selectedFile
                  ? `Attached: ${selectedFile.name} (Tap Send or Upload to Drive)`
                  : isLocalVoiceMode
                  ? 'Speak to transcribe, or edit transcript...'
                  : 'Talk or type with Aura...'
              }
              className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500"
            />
            <button
              type="submit"
              disabled={(!textInput.trim() && !selectedFile) || isLocalVoiceMode}
              title={isLocalVoiceMode ? 'AI replies require a configured backend' : 'Send message'}
              className="p-3 rounded-xl bg-slate-800 hover:bg-indigo-600 disabled:opacity-40 text-white transition-colors cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>

      {/* Global Extensible AI Model Configurator Modal */}
      <AiModelConfigModal
        isOpen={showGlobalAiModal}
        onClose={() => setShowGlobalAiModal(false)}
      />

      {/* Auro Windows Host System Assistant & Software Installer Modal */}
      <WindowsSystemInstallerModal
        isOpen={showWindowsInstallerModal}
        onClose={() => setShowWindowsInstallerModal(false)}
      />
    </div>
  );
};
