import React, { useState, useEffect, useRef } from 'react';
import {
  Languages,
  ArrowRightLeft,
  Mic,
  MicOff,
  Volume2,
  Copy,
  Check,
  UploadCloud,
  Share2,
  Download,
  Heart,
  Trash2,
  Sparkles,
  ExternalLink,
  Search,
  BookOpen,
  RotateCcw,
  Globe,
  Radio,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  LanguageTranslation,
  SUPPORTED_LANGUAGES,
  SupportedLanguage,
} from '../../types/translation';
import {
  POPULAR_LANGUAGE_PRESETS,
  QUICK_FAMILY_PHRASES,
  fetchTranslations,
  executeTranslation,
  saveTranslation,
  deleteTranslation,
  toggleTranslationFavorite,
  speakText,
  downloadTranslationFile,
  shareTranslation,
  DRIVE_FOLDER_NAME,
} from '../../services/translationService';
import { transcribeAudioApi } from '../../services/api';

export const RealtimeTranslatorTab: React.FC = () => {
  const { user, googleAccessToken, isGoogleConnected, signInWithGoogleOAuth } = useApp();

  const [sourceLang, setSourceLang] = useState<string>('en');
  const [targetLang, setTargetLang] = useState<string>('ta'); // Default English to Tamil
  const [sourceText, setSourceText] = useState<string>('');
  const [translatedText, setTranslatedText] = useState<string>('');
  const [phonetics, setPhonetics] = useState<string>('');
  const [linguisticNotes, setLinguisticNotes] = useState<string>('');

  const [isTranslating, setIsTranslating] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [copied, setCopied] = useState(false);
  const [uploadingDrive, setUploadingDrive] = useState(false);

  // History & Storage
  const [translations, setTranslations] = useState<LanguageTranslation[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  // Speech Recognition & MediaRecorder Fallback Refs
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const micStreamRef = useRef<MediaStream | null>(null);
  const latestVoiceTextRef = useRef<string>('');
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Helper to convert audio blob to base64 for fallback transcription
  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  // Clean up any active microphone/speech recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch {}
      }
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // Stop active speech recognition or media recording
  const stopListening = () => {
    setIsListening(false);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
  };

  // MediaRecorder + Gemini Speech Transcription Fallback (when Web Speech API is blocked or unavailable)
  const startMediaRecorderFallback = async (stream: MediaStream) => {
    try {
      micStreamRef.current = stream;
      audioChunksRef.current = [];
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : '';

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstart = () => {
        setIsListening(true);
        const currentLangObj = SUPPORTED_LANGUAGES.find((l) => l.code === sourceLang);
        showToast(`🎙️ Recording voice in ${currentLangObj?.name || 'English'}... Speak now!`);
      };

      recorder.onstop = async () => {
        setIsListening(false);
        if (micStreamRef.current) {
          micStreamRef.current.getTracks().forEach((t) => t.stop());
          micStreamRef.current = null;
        }

        if (audioChunksRef.current.length === 0) return;
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        audioChunksRef.current = [];

        if (blob.size < 1000) return;

        showToast('✨ Transcribing voice with Gemini AI...');
        try {
          const base64 = await blobToBase64(blob);
          const result = await transcribeAudioApi(base64, blob.type);
          if (result && result.text && result.text.trim()) {
            const cleanText = result.text.trim();
            latestVoiceTextRef.current = cleanText;
            setSourceText(cleanText);
            void handleTranslate(cleanText);
          } else {
            showToast('No speech was detected. Please try again.');
          }
        } catch (err: any) {
          console.warn('Fallback transcription failed:', err);
          showToast(`Voice transcription failed: ${err.message || 'Please try again'}`);
        }
      };

      recorder.start();
    } catch (err: any) {
      console.warn('MediaRecorder fallback init failed:', err);
      setIsListening(false);
      showToast('Could not record voice input.');
    }
  };

  // Toggle Live Voice Input
  const handleToggleListening = async () => {
    if (isListening) {
      stopListening();
      // If we already have accumulated live text from this session, translate it now
      if (latestVoiceTextRef.current.trim().length > 1) {
        void handleTranslate(latestVoiceTextRef.current.trim());
      }
      return;
    }

    const currentLangObj = SUPPORTED_LANGUAGES.find((l) => l.code === sourceLang);
    const speechCode = currentLangObj?.speechCode || 'en-US';

    // 1. Request microphone permission explicitly
    let stream: MediaStream | null = null;
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (permErr: any) {
        console.warn('Microphone permission request failed:', permErr);
        showToast('⚠️ Microphone permission required. Please allow microphone in browser settings.');
        setIsListening(false);
        return;
      }
    }

    // 2. Check for Web Speech API (SpeechRecognition / webkitSpeechRecognition)
    const SpeechRecognitionClass =
      typeof window !== 'undefined'
        ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        : null;

    if (SpeechRecognitionClass) {
      // Release temporary permission stream so SpeechRecognition has full audio focus
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }

      // Stop previous instance if still running
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }

      try {
        const recognition = new SpeechRecognitionClass();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;
        recognition.lang = speechCode;

        latestVoiceTextRef.current = '';

        recognition.onstart = () => {
          setIsListening(true);
          showToast(`🎙️ Listening in ${currentLangObj?.name || 'English'}... Speak now!`);
        };

        // Real-Time Streaming Speech Output directly into the input textarea
        recognition.onresult = (event: any) => {
          let finalTranscript = '';
          let interimTranscript = '';

          for (let i = 0; i < event.results.length; ++i) {
            const chunk = event.results[i][0]?.transcript || '';
            if (event.results[i].isFinal) {
              finalTranscript += chunk + ' ';
            } else {
              interimTranscript += chunk;
            }
          }

          const combined = (finalTranscript + interimTranscript).trim();
          if (combined) {
            latestVoiceTextRef.current = combined;
            setSourceText(combined); // <-- Live words immediately display in text box
          }
        };

        recognition.onerror = (err: any) => {
          console.warn('Speech recognition error:', err);
          if (err.error === 'no-speech' || err.error === 'aborted') {
            return;
          }

          if (err.error === 'not-allowed' || err.error === 'service-not-allowed') {
            // Attempt MediaRecorder + Gemini Transcribe fallback
            if (navigator.mediaDevices?.getUserMedia) {
              navigator.mediaDevices
                .getUserMedia({ audio: true })
                .then((newStream) => startMediaRecorderFallback(newStream))
                .catch(() => {
                  setIsListening(false);
                  showToast('Microphone access denied in browser.');
                });
              return;
            }
          }

          setIsListening(false);
        };

        recognition.onend = () => {
          setIsListening(false);
          // Auto-trigger translation if new text was spoken
          if (latestVoiceTextRef.current.trim().length > 1) {
            void handleTranslate(latestVoiceTextRef.current.trim());
          }
        };

        recognitionRef.current = recognition;
        recognition.start();
      } catch (startErr: any) {
        console.warn('SpeechRecognition start failed, switching to MediaRecorder fallback:', startErr);
        if (stream) {
          void startMediaRecorderFallback(stream);
        } else if (navigator.mediaDevices?.getUserMedia) {
          navigator.mediaDevices
            .getUserMedia({ audio: true })
            .then((newStream) => startMediaRecorderFallback(newStream))
            .catch(() => setIsListening(false));
        }
      }
    } else if (stream) {
      // Browser does not support Web Speech API (e.g. Firefox, Safari iOS) -> MediaRecorder fallback
      void startMediaRecorderFallback(stream);
    } else {
      showToast('Speech recognition not supported in this browser.');
      setIsListening(false);
    }
  };

  // Swap Source and Target Languages
  const handleSwapLanguages = () => {
    const prevSource = sourceLang;
    const prevTarget = targetLang;
    setSourceLang(prevTarget);
    setTargetLang(prevSource);

    // Also swap text if translated
    if (translatedText) {
      setSourceText(translatedText);
      setTranslatedText(sourceText);
      setPhonetics('');
    }
  };

  // Perform Translation
  const handleTranslate = async (textToTranslate?: string) => {
    const text = textToTranslate || sourceText;
    if (!text.trim()) {
      showToast('Please enter text to translate.');
      return;
    }

    setIsTranslating(true);
    try {
      const res = await executeTranslation(text, sourceLang, targetLang);
      setTranslatedText(res.translatedText);
      setPhonetics(res.phonetics || '');
      setLinguisticNotes(res.notes || '');

      // Automatically construct and save record
      const newRecord: LanguageTranslation = {
        id: `trans_${Date.now()}`,
        userEmail: user?.email || 'chinna.tamil2000@gmail.com',
        sourceText: text.trim(),
        translatedText: res.translatedText,
        sourceLang,
        targetLang,
        phonetics: res.phonetics,
        notes: res.notes,
        driveSyncStatus: googleAccessToken ? 'uploading' : 'local_only',
        isFavorite: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const saved = await saveTranslation(newRecord, googleAccessToken);
      setTranslations((prev) => [saved, ...prev.filter((t) => t.id !== saved.id)]);

      showToast(
        saved.driveFileId
          ? '✨ Translated & synchronized to Google Drive!'
          : '✨ Real-time translation ready!'
      );
    } catch (err: any) {
      console.error('Translation error:', err);
      showToast(`Translation error: ${err.message || 'Failed'}`);
    } finally {
      setIsTranslating(false);
    }
  };

  // Auto-translate with debounce when typing
  const handleSourceChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setSourceText(val);

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    if (val.trim().length > 3) {
      debounceTimerRef.current = setTimeout(() => {
        handleTranslate(val);
      }, 1200);
    }
  };

  // Copy to Clipboard
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    showToast('Copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  // Spoken Pronunciation
  const handleSpeak = (text: string, langCode: string) => {
    speakText(text, langCode);
  };

  // Upload current translation to Drive
  const handleUploadCurrentToDrive = async () => {
    if (!translatedText || !sourceText) {
      showToast('Please translate text first before uploading.');
      return;
    }
    if (!googleAccessToken) {
      showToast('Please connect Google Account to upload to Drive.');
      if (signInWithGoogleOAuth) signInWithGoogleOAuth();
      return;
    }

    setUploadingDrive(true);
    try {
      const activeTrans = translations.find(
        (t) => t.sourceText === sourceText && t.targetLang === targetLang
      ) || {
        id: `trans_${Date.now()}`,
        userEmail: user?.email || 'chinna.tamil2000@gmail.com',
        sourceText,
        translatedText,
        sourceLang,
        targetLang,
        phonetics,
        notes: linguisticNotes,
        driveSyncStatus: 'uploading' as const,
        isFavorite: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const saved = await saveTranslation(activeTrans, googleAccessToken);
      setTranslations((prev) => [saved, ...prev.filter((t) => t.id !== saved.id)]);
      showToast('☁️ Saved to Family Circle / Language Translations in Google Drive!');
    } catch (err: any) {
      showToast(`Drive upload failed: ${err.message}`);
    } finally {
      setUploadingDrive(false);
    }
  };

  // Share current translation
  const handleShareCurrent = async () => {
    if (!translatedText) return;
    const item: LanguageTranslation = {
      id: 'temp',
      userEmail: user?.email || '',
      sourceText,
      translatedText,
      sourceLang,
      targetLang,
      phonetics,
      driveSyncStatus: 'local_only',
      isFavorite: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const res = await shareTranslation(item);
    if (res.method === 'clipboard') {
      showToast('📋 Copied formatted translation to clipboard!');
    } else if (res.method === 'native') {
      showToast('Shared successfully!');
    }
  };

  // Toggle Favorite
  const handleToggleFavorite = async (item: LanguageTranslation) => {
    const nextFav = !item.isFavorite;
    await toggleTranslationFavorite(item.id, nextFav);
    setTranslations((prev) =>
      prev.map((t) => (t.id === item.id ? { ...t, isFavorite: nextFav } : t))
    );
  };

  // Delete
  const handleDelete = async (item: LanguageTranslation) => {
    if (!window.confirm(`Delete translation record?`)) return;
    await deleteTranslation(item.id, user?.email);
    setTranslations((prev) => prev.filter((t) => t.id !== item.id));
    showToast('Deleted translation record');
  };

  // Select Quick Phrase
  const handleApplyQuickPhrase = (phrase: (typeof QUICK_FAMILY_PHRASES)[0]) => {
    setSourceLang('en');
    setTargetLang(phrase.targetLangCode);
    setSourceText(phrase.english);
    handleTranslate(phrase.english);
  };

  // Filtered translations
  const filteredTranslations = translations.filter((t) => {
    if (favoritesOnly && !t.isFavorite) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        t.sourceText.toLowerCase().includes(q) ||
        t.translatedText.toLowerCase().includes(q) ||
        t.sourceLang.toLowerCase().includes(q) ||
        t.targetLang.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const sourceLangObj = SUPPORTED_LANGUAGES.find((l) => l.code === sourceLang);
  const targetLangObj = SUPPORTED_LANGUAGES.find((l) => l.code === targetLang);

  return (
    <div className="pb-32 px-4 pt-4 text-slate-100 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20">
              <Languages className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                Real-Time Polyglot Translator
                <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 font-medium">
                  Gemini 3.8 Live
                </span>
              </h1>
              <p className="text-xs text-slate-400">
                English ⇄ Tamil, Hindi, Malayalam, Telugu, Kannada, Chinese, French, Spanish & Drive Backup in{' '}
                <span className="text-cyan-400 font-medium">Family Circle / {DRIVE_FOLDER_NAME}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Google Drive Status */}
        <div className="flex items-center gap-2">
          {isGoogleConnected ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs">
              <UploadCloud className="w-4 h-4 text-emerald-400" />
              <span>Drive Connected</span>
            </div>
          ) : (
            <button
              onClick={signInWithGoogleOAuth}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium shadow-md transition-all"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Connect Drive</span>
            </button>
          )}
        </div>
      </div>

      {/* Language Selector Bar & Swap Button */}
      <div className="mb-4 p-3 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-lg backdrop-blur-md flex items-center justify-between gap-2">
        {/* Source Language Select */}
        <div className="flex-1 min-w-0">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
            From (Source)
          </label>
          <select
            value={sourceLang}
            onChange={(e) => setSourceLang(e.target.value)}
            className="w-full px-3 py-2 text-xs font-semibold bg-slate-950/80 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <option key={`src-${lang.code}`} value={lang.code}>
                {lang.flag} {lang.name} ({lang.nativeName})
              </option>
            ))}
          </select>
        </div>

        {/* Bidirectional Swap Button */}
        <div className="flex flex-col items-center justify-center pt-4">
          <button
            onClick={handleSwapLanguages}
            className="p-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-cyan-400 hover:text-cyan-300 border border-slate-700/80 shadow-md transition-all"
            title="Swap Source and Target Languages"
          >
            <ArrowRightLeft className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>

        {/* Target Language Select */}
        <div className="flex-1 min-w-0">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
            To (Target)
          </label>
          <select
            value={targetLang}
            onChange={(e) => setTargetLang(e.target.value)}
            className="w-full px-3 py-2 text-xs font-semibold bg-slate-950/80 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <option key={`tgt-${lang.code}`} value={lang.code}>
                {lang.flag} {lang.name} ({lang.nativeName})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Quick Language Target Chips */}
      <div className="mb-4 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-slate-800">
        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider shrink-0 mr-1">
          Target:
        </span>
        {POPULAR_LANGUAGE_PRESETS.map((p) => (
          <button
            key={p.code}
            onClick={() => {
              if (sourceLang === p.code) setSourceLang('en');
              setTargetLang(p.code);
            }}
            className={`px-2.5 py-1 rounded-xl text-xs font-medium flex items-center gap-1 shrink-0 transition-all ${
              targetLang === p.code
                ? 'bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20'
                : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-800'
            }`}
          >
            <span>{p.flag}</span>
            <span>{p.name}</span>
          </button>
        ))}
      </div>

      {/* Translation Dual-Card Container */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Source Text Card */}
        <div className="p-4 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <span>{sourceLangObj?.flag}</span>
                <span>{sourceLangObj?.name}</span>
              </span>
              <div className="flex items-center gap-1">
                {sourceText && (
                  <button
                    onClick={() => handleSpeak(sourceText, sourceLang)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                    title="Speak Source Text"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                  </button>
                )}
                {sourceText && (
                  <button
                    onClick={() => setSourceText('')}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800"
                    title="Clear"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {isListening && (
              <div className="flex items-center justify-between px-3 py-1.5 mb-2 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold animate-pulse">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                  </span>
                  <span>🎙️ Listening in {sourceLangObj?.name} ({sourceLangObj?.nativeName})... Speak now</span>
                </div>
                <span className="text-[10px] text-rose-400/80 font-mono">Live audio</span>
              </div>
            )}

            <textarea
              value={sourceText}
              onChange={handleSourceChange}
              rows={5}
              placeholder={
                isListening
                  ? `Listening... speak now in ${sourceLangObj?.name || 'English'}`
                  : `Type or speak anything in ${sourceLangObj?.name || 'English'}...`
              }
              className={`w-full p-3 text-sm bg-slate-950/70 border rounded-2xl text-white placeholder-slate-500 focus:outline-none resize-none leading-relaxed transition-all ${
                isListening
                  ? 'border-rose-500/80 ring-2 ring-rose-500/20 shadow-lg shadow-rose-500/10'
                  : 'border-slate-800/80 focus:border-cyan-500'
              }`}
            />
          </div>

          <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-800/60">
            {/* Live Mic Voice-to-Text Button */}
            <button
              onClick={handleToggleListening}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                isListening
                  ? 'bg-rose-500 text-white animate-pulse shadow-md shadow-rose-500/30'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              }`}
            >
              {isListening ? (
                <>
                  <MicOff className="w-3.5 h-3.5" />
                  <span>Stop Recording</span>
                </>
              ) : (
                <>
                  <Mic className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Live Voice Input</span>
                </>
              )}
            </button>

            <button
              onClick={() => handleTranslate()}
              disabled={isTranslating || !sourceText.trim()}
              className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 text-white font-semibold text-xs shadow-md shadow-cyan-500/20 flex items-center gap-1.5 active:scale-95 transition-all"
            >
              {isTranslating ? (
                <>
                  <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Translating...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Translate</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Target Translated Card */}
        <div className="p-4 rounded-3xl bg-slate-900/80 border border-cyan-500/40 shadow-xl shadow-cyan-500/5 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-2xl pointer-events-none" />

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                <span>{targetLangObj?.flag}</span>
                <span>{targetLangObj?.name}</span>
                <span className="text-[11px] font-normal text-slate-400">({targetLangObj?.nativeName})</span>
              </span>

              {translatedText && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleSpeak(translatedText, targetLang)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300"
                    title="Listen to Native Pronunciation"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleCopy(translatedText)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                    title="Copy Translation"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              )}
            </div>

            <div className="min-h-[120px] p-3 rounded-2xl bg-slate-950/70 border border-slate-800/80 flex flex-col justify-between">
              {isTranslating ? (
                <div className="flex flex-col items-center justify-center py-8 text-cyan-400 text-xs gap-2">
                  <div className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                  <span>Generating natural translation...</span>
                </div>
              ) : translatedText ? (
                <div>
                  <p className="text-base font-semibold text-white leading-relaxed select-text">
                    {translatedText}
                  </p>

                  {/* Phonetic Pronunciation Guide */}
                  {phonetics && (
                    <div className="mt-2.5 pt-2 border-t border-slate-800/80">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-amber-400/90 mb-0.5">
                        Phonetics / How to Pronounce:
                      </p>
                      <p className="text-xs text-amber-200/90 font-medium italic">
                        "{phonetics}"
                      </p>
                    </div>
                  )}

                  {linguisticNotes && (
                    <p className="mt-2 text-[11px] text-slate-400 italic">
                      💡 {linguisticNotes}
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-slate-500 text-xs text-center">
                  <Languages className="w-8 h-8 text-slate-700 mb-1" />
                  <span>Translation will appear here in real-time</span>
                </div>
              )}
            </div>
          </div>

          {/* Action Suite for Current Translation */}
          {translatedText && (
            <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-800/60">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleUploadCurrentToDrive}
                  disabled={uploadingDrive}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-cyan-300 flex items-center gap-1.5 transition-all"
                  title="Upload formatted translation to Google Drive"
                >
                  {uploadingDrive ? (
                    <div className="w-3.5 h-3.5 border-2 border-cyan-300 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <UploadCloud className="w-3.5 h-3.5" />
                  )}
                  <span>Store in Drive</span>
                </button>

                <button
                  onClick={handleShareCurrent}
                  className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
                  title="Share External"
                >
                  <Share2 className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() =>
                    downloadTranslationFile({
                      id: 'temp',
                      userEmail: user?.email || '',
                      sourceText,
                      translatedText,
                      sourceLang,
                      targetLang,
                      phonetics,
                      notes: linguisticNotes,
                      driveSyncStatus: 'local_only',
                      isFavorite: false,
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString(),
                    })
                  }
                  className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
                  title="Download File (.txt)"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
              </div>

              <span className="text-[10px] text-slate-500">
                Folder: Family Circle / {DRIVE_FOLDER_NAME}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Quick Family Common Phrases */}
      <div className="mb-6">
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
          Everyday Family Common Phrases
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
          {QUICK_FAMILY_PHRASES.map((qp) => (
            <button
              key={qp.id}
              onClick={() => handleApplyQuickPhrase(qp)}
              className="text-left p-2.5 rounded-2xl bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800/80 hover:border-slate-700 transition-all flex items-start gap-2"
            >
              <Globe className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] text-slate-400 uppercase font-bold">{qp.category}</p>
                <p className="text-xs text-slate-200 line-clamp-1">{qp.english}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Translation History Section */}
      <div className="mb-4 flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-800/80">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <span>Saved Translations & Drive Sync</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
              {translations.length}
            </span>
          </h3>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-56">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search history..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-900 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <button
            onClick={() => setFavoritesOnly(!favoritesOnly)}
            className={`p-2 rounded-xl text-xs border transition-all ${
              favoritesOnly
                ? 'bg-rose-500/20 text-rose-400 border-rose-500/50'
                : 'bg-slate-900 text-slate-400 border-slate-800'
            }`}
            title="Favorites Only"
          >
            <Heart className={`w-3.5 h-3.5 ${favoritesOnly ? 'fill-current' : ''}`} />
          </button>
        </div>
      </div>

      {/* Saved Translations List */}
      <div className="space-y-3">
        {isLoadingHistory && translations.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-500">Loading history...</div>
        ) : filteredTranslations.length === 0 ? (
          <div className="text-center py-10 px-4 rounded-3xl bg-slate-900/40 border border-slate-800/60 text-slate-500 text-xs">
            No saved translations found. Any translation you perform is automatically saved!
          </div>
        ) : (
          filteredTranslations.map((item) => (
            <div
              key={item.id}
              className="p-3.5 rounded-2xl bg-slate-900/60 hover:bg-slate-900/90 border border-slate-800/80 transition-all"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-800 text-cyan-300 uppercase">
                      {item.sourceLang} ➔ {item.targetLang}
                    </span>

                    {item.driveFileId ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center gap-1 font-medium">
                        <UploadCloud className="w-3 h-3" />
                        <span>Drive Synced</span>
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                        Local
                      </span>
                    )}

                    <span className="text-[10px] text-slate-500">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 mb-1">{item.sourceText}</p>
                  <p className="text-sm font-semibold text-white">{item.translatedText}</p>

                  {item.phonetics && (
                    <p className="text-xs text-amber-300/80 italic mt-1">
                      🗣️ {item.phonetics}
                    </p>
                  )}
                </div>

                {/* Item Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => speakText(item.translatedText, item.targetLang)}
                    className="p-1.5 rounded-xl hover:bg-slate-800 text-cyan-400"
                    title="Speak Translation"
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleToggleFavorite(item)}
                    className={`p-1.5 rounded-xl hover:bg-slate-800 ${
                      item.isFavorite ? 'text-rose-500' : 'text-slate-500 hover:text-slate-300'
                    }`}
                    title="Favorite"
                  >
                    <Heart className={`w-4 h-4 ${item.isFavorite ? 'fill-current' : ''}`} />
                  </button>

                  <button
                    onClick={() => shareTranslation(item)}
                    className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white"
                    title="Share"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => downloadTranslationFile(item)}
                    className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white"
                    title="Download (.txt)"
                  >
                    <Download className="w-4 h-4" />
                  </button>

                  {item.driveWebViewLink && (
                    <a
                      href={item.driveWebViewLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-xl hover:bg-slate-800 text-emerald-400"
                      title="Open in Drive"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}

                  <button
                    onClick={() => handleDelete(item)}
                    className="p-1.5 rounded-xl hover:bg-rose-500/10 text-slate-500 hover:text-rose-400"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl bg-slate-900 border border-cyan-500/60 text-white text-xs font-semibold shadow-2xl flex items-center gap-2 backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-200">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
