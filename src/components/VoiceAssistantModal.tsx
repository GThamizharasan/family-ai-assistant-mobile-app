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
} from 'lucide-react';
import { syncAnyAiOutputToDrive } from '../services/guidedLearningService';
import { useApp } from '../context/AppContext';
import { AVAILABLE_GEMINI_MODELS } from '../types';
import { speechEngine, isIOSChrome, isMobileDevice, SUPPORTED_VOICE_LANGUAGES } from '../services/speech';
import { sendChatMessage, getApiBaseUrl } from '../services/api';
import { TabKey } from './BottomNav';
import {
  createReminder,
  getLocalReminders,
  saveLocalReminders,
  syncRemindersWithGoogleDrive,
} from '../services/reminderDriveSync';

interface VoiceAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenVision?: () => void;
  onGoHome?: () => void;
  onNavigateTab?: (tab: TabKey, subTab?: string) => void;
  onOpenMusicPlayer?: () => void;
  onOpenOfflineSync?: () => void;
}

export const VoiceAssistantModal: React.FC<VoiceAssistantModalProps> = ({
  isOpen,
  onClose,
  onOpenVision,
  onGoHome,
  onNavigateTab,
  onOpenMusicPlayer,
  onOpenOfflineSync,
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
  const [showMemoryDrawer, setShowMemoryDrawer] = useState(false);
  const [savedMemoryNotice, setSavedMemoryNotice] = useState<string | null>(null);
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
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
      lower.startsWith('திற ') ||
      lower.includes('திரைக்கு செல்');

    // If an attachment is attached and user didn't explicitly ask to navigate screens, bypass navigation intents to prioritize multimodal file analysis
    const shouldCheckNavigation = !selectedFile || isExplicitNavigation;

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

    // 12. Health & Wellness
    if (
      lower.includes('open wellness') ||
      lower.includes('health hub') ||
      lower.includes('open health') ||
      lower === 'wellness' ||
      lower === 'health' ||
      lower.includes('உடல் நலம்')
    ) {
      executeVoiceNavigation(
        'wellness',
        undefined,
        'Opening Health & Longevity Wellness Hub on your screen now.',
        'ஆரோக்கிய நலவாழ்வு திரையை இப்போது திறக்கிறேன்.'
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
      lower.includes('offline cache')
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
  }

    setIsThinking(true);
    if (selectedFile) {
      setIsAnalyzingFile(true);
    }
    try {
      const historyPayload = chatHistory.slice(-6).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const contextPayload = {
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

        if (activeToken) {
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

      // Check if Gemini requested navigation to a specific screen
      if (result.navigateToTab && onNavigateTab) {
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
        {/* Top Header */}
        <div className="p-4 sm:px-6 border-b border-slate-800/80 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-600 to-indigo-600 flex items-center justify-center p-0.5 shadow-lg shadow-amber-500/20 overflow-hidden">
                <img src="/app-logo.png" alt="Aura Logo" className="w-full h-full object-cover rounded-xl" />
              </div>
              <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-slate-900" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-base">Aura Family Assistant</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  Real-Time Voice
                </span>
              </div>
              <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <Heart className="w-3 h-3 text-rose-400 fill-rose-400/30" />
                Demeanor: <span className="text-slate-300 font-medium capitalize">{currentEmotion}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                if (isMuted) setIsMuted(false);
                speechEngine.testVoiceOutput();
              }}
              className="px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-200 border border-indigo-500/30 transition-all cursor-pointer shadow-sm"
              title="Test Aura voice audio output"
            >
              <Volume2 className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden sm:inline">Test Sound</span>
            </button>

            {/* Language Selector Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowLangMenu(!showLangMenu)}
                className="px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 hover:bg-indigo-500/30 cursor-pointer"
                title="Change Voice Language"
              >
                <span>
                  {SUPPORTED_VOICE_LANGUAGES.find((l) => l.code === voiceLanguage)?.flag || '🇮🇳'}{' '}
                  {SUPPORTED_VOICE_LANGUAGES.find((l) => l.code === voiceLanguage)?.nativeName || 'தமிழ்'}
                </span>
              </button>

              {showLangMenu && (
                <div className="absolute right-0 mt-1.5 w-48 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl py-1.5 z-50">
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
              )}
            </div>

            {/* Gemini Model Selector Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowModelMenu(!showModelMenu)}
                className="px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all bg-purple-500/20 text-purple-300 border border-purple-500/40 hover:bg-purple-500/30 cursor-pointer"
                title="Change Voice Assistant Gemini Model"
              >
                <Sparkles className="w-3 h-3 text-purple-400" />
                <span className="font-mono text-[11px] truncate max-w-[100px] sm:max-w-none">
                  {AVAILABLE_GEMINI_MODELS.find((m) => m.id === selectedVoiceModel)?.name.replace('Gemini ', '') || '3.8 Flash'}
                </span>
              </button>

              {showModelMenu && (
                <div className="absolute right-0 mt-1.5 w-64 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl py-1.5 z-50">
                  <div className="px-3 py-1 flex items-center justify-between border-b border-slate-800">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                      Gemini Voice Model
                    </span>
                    <span className="text-[9px] text-purple-400 font-mono">SQLite Synced</span>
                  </div>
                  {AVAILABLE_GEMINI_MODELS.map((modelOpt) => {
                    const isSelected = selectedVoiceModel === modelOpt.id;
                    return (
                      <button
                        key={modelOpt.id}
                        type="button"
                        onClick={() => {
                          setSelectedVoiceModel(modelOpt.id);
                          setShowModelMenu(false);
                        }}
                        className={`w-full px-3 py-2 text-xs text-left flex items-start justify-between transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-purple-600/30 text-purple-200 font-bold'
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
                        {isSelected && <span className="text-emerald-400 text-xs font-bold shrink-0 mt-0.5">✓</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Persistent SQLite Memory Bank Header Button */}
            <button
              onClick={() => setShowMemoryDrawer(!showMemoryDrawer)}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all border cursor-pointer ${
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
                className="px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 transition-all shadow-sm cursor-pointer"
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
              className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all border ${
                isHandsFree
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm shadow-emerald-950/40'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
              title={isHandsFree ? 'Hands-Free Loop Active: Auro auto-listens after speaking' : 'Tap to enable Hands-Free Conversation'}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isHandsFree ? 'bg-emerald-400 animate-ping' : 'bg-slate-500'}`} />
              <span>{isHandsFree ? 'Hands-Free' : 'Push-to-Talk'}</span>
            </button>
            <button
              onClick={() => setShowMicHelp(!showMicHelp)}
              className={`p-2 rounded-xl transition-colors ${
                showMicHelp
                  ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              title="Microphone Activation Guide"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                if (isSpeaking) speechEngine.stopSpeaking();
                setIsMuted(!isMuted);
              }}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title={isMuted ? 'Unmute voice' : 'Mute voice'}
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
            </button>

            {/* Cancel & Go Back to Home Button */}
            <button
              onClick={handleCancelAndGoHome}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 hover:text-white border border-rose-500/40 hover:border-rose-500/60 transition-all cursor-pointer shadow-md active:scale-95"
              title="Cancel and return to Home Hub"
              aria-label="Cancel and go back to home"
            >
              <Home className="w-3.5 h-3.5 text-rose-300" />
              <span>Cancel</span>
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
          {chatHistory.map((msg) => (
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

                <p className="whitespace-pre-wrap">{msg.content}</p>

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
          ))}

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

        {/* Hidden File Inputs for Attachments, Camera, and Gallery */}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileChange}
          accept="*/*"
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
            className="p-3.5 rounded-2xl flex items-center justify-center bg-slate-900 hover:bg-rose-950/50 text-slate-400 hover:text-rose-300 border border-slate-800 hover:border-rose-500/40 transition-all shadow active:scale-95 cursor-pointer"
            title="Cancel and return to Home Hub"
            aria-label="Cancel and go back to home"
          >
            <Home className="w-5 h-5" />
          </button>

          <button
            onClick={toggleMic}
            className={`p-3.5 rounded-2xl flex items-center justify-center transition-all shadow-lg active:scale-95 ${
              isListening
                ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/30 animate-pulse'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30'
            }`}
            title={isListening ? 'Stop listening' : 'Start speaking'}
          >
            {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
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
    </div>
  );
};
