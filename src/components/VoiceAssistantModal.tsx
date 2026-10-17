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
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { speechEngine, isIOSChrome } from '../services/speech';
import { sendChatMessage, getApiBaseUrl } from '../services/api';


interface VoiceAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const VoiceAssistantModal: React.FC<VoiceAssistantModalProps> = ({ isOpen, onClose }) => {
  const {
    user,
    chatHistory,
    addVoiceMessage,
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
    liveDriveFiles,
    liveStorageQuota,
    googleWorkspaceSettings,
    isGoogleConnected,
    syncLiveGoogleData,
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
  const chatEndRef = useRef<HTMLDivElement>(null);
  const handleUserSpeechRef = useRef<(spokenText: string) => void>(() => {});
  const isLocalVoiceMode = Capacitor.isNativePlatform() && !getApiBaseUrl();

  const isHandsFreeRef = useRef(isHandsFree);
  const isOpenRef = useRef(isOpen);
  const isSpeakingRef = useRef(isSpeaking);
  const isThinkingRef = useRef(isThinking);

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
          }, 650);
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
      if (error === 'not-allowed' || error === 'permission-denied') {
        setMicStatusMessage(
          Capacitor.isNativePlatform()
            ? 'Microphone access is blocked. Open Android Settings > Apps > AuraFamily > Permissions > Microphone and allow access.'
            : 'Microphone access blocked. Click the lock 🔒 or tune 🎛️ icon next to the URL in your browser bar and choose "Allow" for Microphone.'
        );
      } else if (error === 'no-speech') {
        // Silent timeout: ignore during conversational turns
      } else if (error === 'audio-capture') {
        setMicStatusMessage('No microphone detected. Please connect or enable your microphone.');
      } else if (error === 'device-busy') {
        setMicStatusMessage('The microphone is being initialized. Please wait a moment.');
      } else {
        setMicStatusMessage(`Microphone notice: ${error}. You can also type your message below.`);
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
      // Automatically activate speech listening for real-time conversation
      const startTimer = setTimeout(() => {
        if (isOpenRef.current && !isSpeakingRef.current && !isThinkingRef.current) {
          speechEngine.startListening();
        }
      }, 400);
      return () => clearTimeout(startTimer);
    } else {
      speechEngine.setContinuousMode(false);
      speechEngine.stopListening(true);
      speechEngine.stopSpeaking();
      setMicStatusMessage(null);
      setShowMicHelp(false);
    }
  }, [isOpen]);

  const handleUserSpeech = async (spokenText: string) => {
    if (!spokenText || !spokenText.trim()) return;
    speechEngine.unlockAudio();
    setLiveTranscript('');
    speechEngine.stopListening(false);

    const userMsg = {
      role: 'user' as const,
      content: spokenText.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    addVoiceMessage(userMsg);

    // Direct Voice-to-Call intent detection
    const lower = spokenText.toLowerCase();
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

    // Direct Gmail / Email check and readout intent
    const isMailQuery =
      lower.includes('email') ||
      lower.includes('gmail') ||
      lower.includes('inbox') ||
      lower.includes('messages from google') ||
      lower.includes('mail');

    const isDirectMailCheck =
      isMailQuery &&
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

    setIsThinking(true);
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
        recentDriveFilesSummary: (liveDriveFiles || []).slice(0, 5).map((f) => ({
          name: f.name,
          mimeType: f.mimeType,
          size: f.size,
          modifiedTime: f.modifiedTime,
        })),
        googleStorageQuota: liveStorageQuota,
        isGoogleConnected,
      };

      const result = await sendChatMessage({
        message: spokenText,
        history: historyPayload,
        context: contextPayload,
        userProfile: user,
        currentMood: currentEmotion,
        includeSpeechAudio: !isMuted,
      });

      setIsThinking(false);
      const replyText = result.reply || "I'm right here with you.";
      const emotionText = result.emotion || 'supportive';
      setCurrentEmotion(emotionText);

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
    } catch (err) {
      console.error('Voice assistant chat request failed:', err);
      setIsThinking(false);
      const fallbackReply =
        Capacitor.isNativePlatform() &&
        err instanceof Error &&
        err.message.includes('Mobile AI backend is not configured')
          ? 'Voice recognition worked, but the AI backend is not configured for this APK. Configure VITE_API_BASE_URL to a public HTTPS backend and rebuild the app.'
          : "I couldn't connect to the AI assistant service just now. Please check your connection and try again, or type your message below.";
      addVoiceMessage({
        role: 'assistant',
        content: fallbackReply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        emotion: 'comforting',
      });
      speakWithAuro(fallbackReply);
    }
  };

  const toggleMic = async () => {
    if (isSpeaking) {
      // Barge-in: User tapped mic while Auro is speaking -> stop speech and start listening
      speechEngine.stopSpeaking();
      speechEngine.unlockAudio();
      speechEngine.setContinuousMode(isHandsFreeRef.current);
      speechEngine.startListening();
      return;
    }

    if (isListening) {
      speechEngine.stopListening(true);
    } else {
      speechEngine.unlockAudio();
      setMicStatusMessage(null);
      speechEngine.stopSpeaking();
      speechEngine.setContinuousMode(isHandsFreeRef.current);
      if (isIOSChrome()) {
        setMicStatusMessage('Apple iOS WebKit restricts speech recognition in Chrome. On iPhone, please use Safari for voice dictation, or type your message below.');
        return;
      }
      const started = speechEngine.startListening();
      if (!started) {
        setMicStatusMessage('Speech recognition could not be started in this browser. Please use Chrome on Desktop/Android, or Safari on iPhone, or type below.');
      }
    }
  };

  const handleManualSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim()) return;
    const msg = textInput.trim();
    setTextInput('');
    handleUserSpeech(msg);
  };

  handleUserSpeechRef.current = handleUserSpeech;

  const quickPrompts = [
    { label: 'Check Gmail', text: 'Look through my connected Gmail messages.' },
    { label: 'Drive & Storage', text: 'Check my Google Drive files and storage.' },
    { label: 'Check WhatsApp', text: 'Read out my latest WhatsApp messages.' },
    { label: 'Reply via Auro', text: 'Send reply' },
    { label: 'Call Selvapriya', text: 'Call Selvapriya.' },
    { label: 'Cloud Spend & Billing', text: 'Check my Google Cloud usage and billing spend.' },
    { label: 'Set GCP Budget $250', text: 'Set Google Cloud budget to 250.' },
    { label: 'Import Phone Contacts', text: 'Show me my synced phone contacts and how to import more from my phone.' },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-xl p-2 sm:p-4">
      <div className="w-full max-w-xl h-[92vh] max-h-[820px] rounded-3xl border border-slate-800 bg-slate-900/95 flex flex-col shadow-2xl relative overflow-hidden">
        {/* Top Header */}
        <div className="p-4 sm:px-6 border-b border-slate-800/80 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25">
                <Sparkles className="w-5 h-5 animate-pulse" />
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
              title={isHandsFree ? 'Hands-Free Loop Active: Aura auto-listens after speaking' : 'Tap to enable Hands-Free Conversation'}
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
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

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
            <div
              className={`w-20 h-20 rounded-full flex items-center justify-center shadow-2xl transition-all duration-500 z-10 ${
                isSpeaking
                  ? 'bg-gradient-to-tr from-purple-600 via-indigo-500 to-pink-500 shadow-purple-500/40 scale-105'
                  : isListening
                  ? 'bg-gradient-to-tr from-emerald-600 to-teal-500 shadow-emerald-500/40 scale-105 ring-4 ring-emerald-500/30'
                  : isThinking
                  ? 'bg-gradient-to-tr from-amber-600 to-orange-500 shadow-amber-500/40'
                  : 'bg-gradient-to-tr from-indigo-900 to-slate-800 shadow-indigo-950/50'
              }`}
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
            </div>
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
                <p className="whitespace-pre-wrap">{msg.content}</p>

                {msg.actionSuggestion && (
                  <div className="mt-2.5 pt-2 border-t border-slate-700/60 flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                    <Compass className="w-3.5 h-3.5 shrink-0" />
                    <span>Suggested: {msg.actionSuggestion}</span>
                  </div>
                )}
              </div>
              <span className="text-[10px] text-slate-500 mt-1 px-1">{msg.timestamp}</span>
            </div>
          ))}

          {isThinking && (
            <div className="flex items-center gap-2 text-slate-400 text-xs p-2">
              <Sparkles className="w-4 h-4 animate-spin text-indigo-400" />
              <span>Aura is reflecting on your personal memory and goals...</span>
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

        {/* Input Dock & Big Mic Trigger */}
        <div className="p-3 sm:p-4 bg-slate-950 border-t border-slate-800 flex items-center gap-2">
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

          <form onSubmit={handleManualSend} className="flex-1 flex items-center gap-2">
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder={isLocalVoiceMode ? 'Speak to transcribe, or edit transcript...' : 'Talk or type with Aura...'}
              className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500"
            />
            <button
              type="submit"
              disabled={!textInput.trim() || isLocalVoiceMode}
              title={isLocalVoiceMode ? 'AI replies require a configured backend' : 'Send message'}
              className="p-3 rounded-xl bg-slate-800 hover:bg-indigo-600 disabled:opacity-40 text-white transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
