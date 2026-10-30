import React, { useState, useEffect, useRef } from 'react';
import {
  Volume2,
  Play,
  Pause,
  UploadCloud,
  Share2,
  Download,
  Heart,
  Trash2,
  Sparkles,
  Search,
  ExternalLink,
  Plus,
  RotateCcw,
  RotateCw,
  HardDrive,
  Check,
  X,
  VolumeX,
  ChevronDown,
  FileText,
  Copy,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { TtsMemo, TtsVoiceType } from '../../types/tts';
import {
  TTS_VOICES,
  TTS_TEMPLATES,
  fetchTtsMemos,
  generateTtsAudio,
  saveTtsMemo,
  deleteTtsMemo,
  toggleTtsFavorite,
  downloadTtsAudioFile,
  shareTtsMemo,
  uploadTtsMemoToDrive,
  DRIVE_FOLDER_NAME,
} from '../../services/ttsService';

export const TextToSpeechTab: React.FC = () => {
  const { user, googleAccessToken, isGoogleConnected, signInWithGoogleOAuth } = useApp();

  const [memos, setMemos] = useState<TtsMemo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterVoice, setFilterVoice] = useState<'all' | TtsVoiceType>('all');
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  // Form State
  const [textPrompt, setTextPrompt] = useState('');
  const [memoTitle, setMemoTitle] = useState('');
  const [selectedVoiceType, setSelectedVoiceType] = useState<TtsVoiceType>('female');

  // Audio Playback
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const [playingMemoId, setPlayingMemoId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Load memos
  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      setIsLoading(true);
      try {
        const list = await fetchTtsMemos(googleAccessToken, user?.email);
        if (isMounted) setMemos(list);
      } catch (err) {
        console.warn('Error loading TTS memos:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    void load();
    return () => {
      isMounted = false;
    };
  }, [googleAccessToken, user?.email]);

  // Audio Player Event Listeners
  useEffect(() => {
    const audio = audioPlayerRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => setDuration(audio.duration || 0);
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [playingMemoId]);

  // Native Web Speech fallback & live preview
  const speakWithNativeWebSpeech = (text: string, voiceType: TtsVoiceType) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);

    if (voiceType === 'child') {
      utterance.pitch = 1.6;
      utterance.rate = 1.05;
    } else if (voiceType === 'female') {
      utterance.pitch = 1.1;
      utterance.rate = 0.98;
    } else {
      utterance.pitch = 0.85;
      utterance.rate = 0.95;
    }

    const voices = window.speechSynthesis.getVoices();
    if (voiceType === 'female') {
      const fv = voices.find((v) => /female|zira|samantha|karen|victoria|moira|tessa/i.test(v.name));
      if (fv) utterance.voice = fv;
    } else if (voiceType === 'male') {
      const mv = voices.find((v) => /male|david|george|daniel|alex|fred/i.test(v.name));
      if (mv) utterance.voice = mv;
    }

    window.speechSynthesis.speak(utterance);
  };

  // Handle Play/Pause
  const handleTogglePlay = (memo: TtsMemo) => {
    const audio = audioPlayerRef.current;
    if (!audio) return;

    if (playingMemoId === memo.id) {
      if (isPlaying) {
        audio.pause();
        if (typeof window !== 'undefined' && window.speechSynthesis) {
          window.speechSynthesis.cancel();
        }
        setIsPlaying(false);
      } else {
        audio.play().catch(() => {
          speakWithNativeWebSpeech(memo.textPrompt, memo.voiceType);
        });
        setIsPlaying(true);
      }
      return;
    }

    // Switch to new memo
    let sourceUrl = '';
    if (memo.audioContentBase64) {
      const mime = memo.audioMimeType || 'audio/mpeg';
      sourceUrl = `data:${mime};base64,${memo.audioContentBase64}`;
    } else if (memo.audioUrl) {
      sourceUrl = memo.audioUrl;
    } else if (memo.driveFileId) {
      sourceUrl = `https://drive.google.com/uc?export=download&id=${memo.driveFileId}`;
    }

    if (!sourceUrl) {
      speakWithNativeWebSpeech(memo.textPrompt, memo.voiceType);
      setPlayingMemoId(memo.id);
      setIsPlaying(true);
      return;
    }

    audio.src = sourceUrl;
    audio.playbackRate = playbackSpeed;
    audio.load();
    audio.play().then(() => {
      setPlayingMemoId(memo.id);
      setIsPlaying(true);
    }).catch((err) => {
      console.warn('Audio playback error, falling back to Web Speech synthesis:', err);
      speakWithNativeWebSpeech(memo.textPrompt, memo.voiceType);
      setPlayingMemoId(memo.id);
      setIsPlaying(true);
    });
  };

  const handleSeek = (newTime: number) => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const handleCycleSpeed = () => {
    const speeds = [1, 1.25, 1.5, 2, 0.75];
    const nextIdx = (speeds.indexOf(playbackSpeed) + 1) % speeds.length;
    const nextSpeed = speeds[nextIdx];
    setPlaybackSpeed(nextSpeed);
    if (audioPlayerRef.current) {
      audioPlayerRef.current.playbackRate = nextSpeed;
    }
  };

  // Generate TTS
  const handleGenerateSpeech = async () => {
    if (!textPrompt.trim()) {
      showToast('Please type some text to convert to speech.');
      return;
    }

    setIsGenerating(true);
    try {
      const selectedVoiceObj = TTS_VOICES.find((v) => v.id === selectedVoiceType);
      const voiceName = selectedVoiceObj?.geminiVoice || 'Fenrir';

      const title = memoTitle.trim() || `${selectedVoiceType.toUpperCase()} Memo: ${textPrompt.slice(0, 24)}...`;

      // 1. Generate audio via Gemini
      const genResult = await generateTtsAudio(textPrompt, selectedVoiceType, voiceName);

      // 2. Convert base64 to Blob
      const byteChars = atob(genResult.audioBase64);
      const byteNums = new Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) {
        byteNums[i] = byteChars.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNums);
      const isMp3 = (genResult.mimeType || '').includes('mpeg') || (genResult.mimeType || '').includes('mp3');
      const audioBlob = new Blob([byteArray], { type: genResult.mimeType || (isMp3 ? 'audio/mpeg' : 'audio/wav') });

      // Estimate duration from file size (MP3 at 128kbps is ~16KB/s, PCM 24k 16-bit is 48KB/s)
      const estDuration = Math.max(2, Math.round(audioBlob.size / (isMp3 ? 16000 : 48000)));

      const newMemo: TtsMemo = {
        id: `tts_${Date.now()}`,
        userEmail: user?.email || 'chinna.tamil2000@gmail.com',
        title,
        textPrompt: textPrompt.trim(),
        voiceType: selectedVoiceType,
        voiceName,
        audioContentBase64: genResult.audioBase64,
        audioMimeType: genResult.mimeType,
        durationSeconds: estDuration,
        fileSizeBytes: audioBlob.size,
        driveSyncStatus: googleAccessToken ? 'uploading' : 'local_only',
        isFavorite: false,
        playCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // 3. Save to SQLite, Drive, and Local Cache
      const saved = await saveTtsMemo(newMemo, audioBlob, googleAccessToken);
      setMemos((prev) => [saved, ...prev.filter((m) => m.id !== saved.id)]);

      // Auto-play generated audio
      setTimeout(() => {
        handleTogglePlay(saved);
      }, 300);

      setTextPrompt('');
      setMemoTitle('');
      showToast(
        saved.driveFileId
          ? '✨ Voice generated & saved to Google Drive!'
          : '✨ Voice memo generated and saved locally!'
      );
    } catch (err: any) {
      console.error('TTS Generation error:', err);
      showToast(`Error: ${err.message || 'Generation failed'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // Upload to Drive
  const handleUploadToDrive = async (memo: TtsMemo) => {
    if (!googleAccessToken) {
      showToast('Please connect Google Account to upload to Drive.');
      if (signInWithGoogleOAuth) signInWithGoogleOAuth();
      return;
    }

    setUploadingId(memo.id);
    try {
      let audioBlob: Blob | null = null;
      if (memo.audioContentBase64) {
        const byteChars = atob(memo.audioContentBase64);
        const byteNums = new Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) {
          byteNums[i] = byteChars.charCodeAt(i);
        }
        const mime = memo.audioMimeType || 'audio/mpeg';
        audioBlob = new Blob([new Uint8Array(byteNums)], { type: mime });
      }

      if (!audioBlob) {
        showToast('Fetching memo audio from server...');
        const res = await fetch(memo.audioUrl || `/api/tts/memos/${memo.id}/audio`);
        if (res.ok) {
          audioBlob = await res.blob();
        }
      }

      if (!audioBlob) {
        throw new Error('Unable to retrieve audio data for upload');
      }

      const driveRes = await uploadTtsMemoToDrive(googleAccessToken, memo, audioBlob);
      const updated: TtsMemo = {
        ...memo,
        driveFileId: driveRes.driveFileId,
        driveWebViewLink: driveRes.webViewLink,
        driveSyncStatus: 'synced',
      };

      await saveTtsMemo(updated);
      setMemos((prev) => prev.map((m) => (m.id === memo.id ? updated : m)));
      showToast('☁️ Successfully uploaded to Family Circle / Text to Speech Memos!');
    } catch (err: any) {
      console.error('Drive upload error:', err);
      showToast(`Upload failed: ${err.message}`);
    } finally {
      setUploadingId(null);
    }
  };

  // Download
  const handleDownload = async (memo: TtsMemo) => {
    const res = await downloadTtsAudioFile(memo, googleAccessToken);
    if (res.success) {
      showToast(`💾 Downloaded ${res.filename}`);
    } else {
      showToast(`Download failed: ${res.error}`);
    }
  };

  // Share
  const handleShare = async (memo: TtsMemo) => {
    const res = await shareTtsMemo(memo);
    if (res.method === 'clipboard') {
      showToast('📋 Copied speech link and text to clipboard!');
    } else if (res.method === 'native') {
      showToast('Shared successfully!');
    }
  };

  // Favorite
  const handleToggleFavorite = async (memo: TtsMemo) => {
    const nextFav = !memo.isFavorite;
    await toggleTtsFavorite(memo.id, nextFav);
    setMemos((prev) => prev.map((m) => (m.id === memo.id ? { ...m, isFavorite: nextFav } : m)));
  };

  // Delete
  const handleDelete = async (memo: TtsMemo) => {
    if (!window.confirm(`Delete "${memo.title}"?`)) return;
    if (playingMemoId === memo.id) {
      audioPlayerRef.current?.pause();
      setPlayingMemoId(null);
      setIsPlaying(false);
    }
    await deleteTtsMemo(memo.id, user?.email);
    setMemos((prev) => prev.filter((m) => m.id !== memo.id));
    showToast('Deleted voice memo');
  };

  // Apply template
  const handleSelectTemplate = (template: (typeof TTS_TEMPLATES)[0]) => {
    setTextPrompt(template.text);
    setMemoTitle(template.title);
    setSelectedVoiceType(template.voiceType);
  };

  // Filter memos
  const filteredMemos = memos.filter((m) => {
    if (favoritesOnly && !m.isFavorite) return false;
    if (filterVoice !== 'all' && m.voiceType !== filterVoice) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        m.title.toLowerCase().includes(q) ||
        m.textPrompt.toLowerCase().includes(q) ||
        m.voiceType.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const activeMemo = memos.find((m) => m.id === playingMemoId);

  return (
    <div className="pb-32 px-4 pt-4 text-slate-100 max-w-4xl mx-auto">
      {/* Hidden Audio Player */}
      <audio ref={audioPlayerRef} className="hidden" preload="auto" />

      {/* Header */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-amber-500 to-rose-500 text-white shadow-lg shadow-amber-500/20">
              <Volume2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                Text-to-Speech Studio
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 font-medium">
                  Gemini 3.8 TTS
                </span>
              </h1>
              <p className="text-xs text-slate-400">
                Male, Female & Child voice synthesis stored in{' '}
                <span className="text-amber-400 font-medium">Family Circle / {DRIVE_FOLDER_NAME}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Google Drive Status Banner */}
        <div className="flex items-center gap-2">
          {isGoogleConnected ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs">
              <UploadCloud className="w-4 h-4 text-emerald-400" />
              <span>Google Drive Connected</span>
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

      {/* Voice Selection Cards */}
      <div className="mb-6">
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2.5">
          1. Select Persona & Voice (Male • Female • Child)
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {TTS_VOICES.map((v) => {
            const isSelected = selectedVoiceType === v.id;
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => setSelectedVoiceType(v.id)}
                className={`text-left p-3.5 rounded-2xl border transition-all duration-200 relative overflow-hidden flex flex-col justify-between ${
                  isSelected
                    ? 'bg-gradient-to-br from-amber-500/20 to-rose-500/10 border-amber-500/60 shadow-lg shadow-amber-500/10 ring-2 ring-amber-500/40'
                    : 'bg-slate-900/60 hover:bg-slate-800/60 border-slate-800/80 text-slate-300'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl p-1.5 rounded-xl bg-slate-800/80 border border-slate-700/60">
                      {v.icon}
                    </span>
                    <div>
                      <h4 className="text-sm font-bold text-white capitalize">{v.id} Voice</h4>
                      <p className="text-[11px] text-amber-400/90 font-medium">{v.label} ({v.accent})</p>
                    </div>
                  </div>
                  {isSelected && (
                    <span className="p-1 rounded-full bg-amber-500 text-slate-950">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 line-clamp-2 mt-1 mb-2.5">{v.styleDescription}</p>
                <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
                  <span className="text-[10px] text-slate-500">{v.sampleText.slice(0, 22)}...</span>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      speakWithNativeWebSpeech(v.sampleText, v.id);
                    }}
                    className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[10px] font-semibold text-amber-300 hover:text-white flex items-center gap-1 border border-slate-700/60 transition-colors"
                  >
                    <Volume2 className="w-3 h-3" />
                    <span>Sample Voice</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Preset Inspiration Templates */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Quick Family Presets
          </label>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1.5 scrollbar-thin scrollbar-thumb-slate-700">
          {TTS_TEMPLATES.map((tmpl) => (
            <button
              key={tmpl.id}
              onClick={() => handleSelectTemplate(tmpl)}
              className="shrink-0 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-xs text-slate-300 hover:text-white transition-all flex items-center gap-1.5"
            >
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>{tmpl.title}</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-900 text-slate-400 capitalize">
                {tmpl.voiceType}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Text Area & Generation Box */}
      <div className="mb-8 p-4 rounded-3xl bg-slate-900/80 border border-slate-800 backdrop-blur-xl shadow-xl">
        <div className="mb-3">
          <input
            type="text"
            value={memoTitle}
            onChange={(e) => setMemoTitle(e.target.value)}
            placeholder="Memo Title (e.g. Bedtime Story, Family Announcement, Morning Routine)"
            className="w-full px-3.5 py-2 text-sm bg-slate-950/70 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/40"
          />
        </div>

        <div className="relative mb-3">
          <textarea
            value={textPrompt}
            onChange={(e) => setTextPrompt(e.target.value)}
            rows={4}
            placeholder="Type or paste the message you want spoken out loud in a natural voice..."
            className="w-full p-3.5 text-sm bg-slate-950/70 border border-slate-800 rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/40 resize-none"
          />
          <div className="absolute right-3 bottom-3 text-[11px] text-slate-500">
            {textPrompt.length} chars
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <HardDrive className="w-3.5 h-3.5 text-slate-500" />
            <span>Output: Studio WAV 24kHz • Auto-saved to SQLite & Drive</span>
          </div>

          <button
            onClick={handleGenerateSpeech}
            disabled={isGenerating || !textPrompt.trim()}
            className="w-full sm:w-auto px-5 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-400 hover:to-rose-400 disabled:opacity-50 text-white font-semibold text-sm shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 transition-all active:scale-95"
          >
            {isGenerating ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Synthesizing Audio...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Generate Speech ({selectedVoiceType})</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Floating Active Player Bar */}
      {activeMemo && (
        <div className="sticky top-2 z-30 mb-8 p-3.5 rounded-2xl bg-gradient-to-r from-slate-900/95 via-slate-800/95 to-slate-900/95 border border-amber-500/40 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="flex items-center gap-3 overflow-hidden">
              <button
                onClick={() => handleTogglePlay(activeMemo)}
                className="w-10 h-10 rounded-full bg-gradient-to-tr from-amber-500 to-rose-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-amber-500/30"
              >
                {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
              </button>
              <div className="overflow-hidden">
                <h4 className="text-sm font-semibold text-white truncate">{activeMemo.title}</h4>
                <p className="text-[11px] text-amber-400/90 capitalize flex items-center gap-2">
                  <span>{activeMemo.voiceType} Voice ({activeMemo.voiceName})</span>
                  <span>•</span>
                  <span>{Math.round(duration || activeMemo.durationSeconds)}s</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={handleCycleSpeed}
                className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-bold text-amber-300 border border-slate-700"
                title="Playback Speed"
              >
                {playbackSpeed}x
              </button>

              <button
                onClick={() => handleDownload(activeMemo)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
                title="Download Audio"
              >
                <Download className="w-4 h-4" />
              </button>

              <button
                onClick={() => handleShare(activeMemo)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
                title="Share External"
              >
                <Share2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Scrubber Progress Bar */}
          <div className="flex items-center gap-2 text-[10px] text-slate-400">
            <span>{Math.floor(currentTime)}s</span>
            <input
              type="range"
              min={0}
              max={duration || activeMemo.durationSeconds || 10}
              step={0.1}
              value={currentTime}
              onChange={(e) => handleSeek(parseFloat(e.target.value))}
              className="flex-1 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
            <span>{Math.floor(duration || activeMemo.durationSeconds)}s</span>
          </div>
        </div>
      )}

      {/* List Filter & Search Bar */}
      <div className="mb-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search speech memos..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-900/80 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
          {(['all', 'male', 'female', 'child'] as const).map((vt) => (
            <button
              key={vt}
              onClick={() => setFilterVoice(vt)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium capitalize transition-all shrink-0 ${
                filterVoice === vt
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                  : 'bg-slate-900/80 hover:bg-slate-800 text-slate-400 border border-slate-800'
              }`}
            >
              {vt}
            </button>
          ))}

          <button
            onClick={() => setFavoritesOnly(!favoritesOnly)}
            className={`p-1.5 rounded-xl text-xs border transition-all ${
              favoritesOnly
                ? 'bg-rose-500/20 text-rose-400 border-rose-500/50'
                : 'bg-slate-900/80 text-slate-400 border-slate-800'
            }`}
            title="Favorites Only"
          >
            <Heart className={`w-4 h-4 ${favoritesOnly ? 'fill-current' : ''}`} />
          </button>
        </div>
      </div>

      {/* Memos List */}
      <div className="space-y-3">
        {isLoading && memos.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-xs">Loading speech memos...</div>
        ) : filteredMemos.length === 0 ? (
          <div className="text-center py-12 px-4 rounded-3xl bg-slate-900/40 border border-slate-800/60">
            <Volume2 className="w-10 h-10 text-slate-600 mx-auto mb-2" />
            <h4 className="text-sm font-semibold text-slate-400">No Speech Memos Found</h4>
            <p className="text-xs text-slate-500 mt-1">
              Select Male, Female or Child voice and type text to create your first speech audio memo!
            </p>
          </div>
        ) : (
          filteredMemos.map((memo) => {
            const isThisPlaying = playingMemoId === memo.id && isPlaying;
            const isUploading = uploadingId === memo.id;

            return (
              <div
                key={memo.id}
                className={`p-4 rounded-2xl border transition-all duration-200 ${
                  playingMemoId === memo.id
                    ? 'bg-slate-900/90 border-amber-500/50 shadow-lg shadow-amber-500/5'
                    : 'bg-slate-900/60 hover:bg-slate-900/90 border-slate-800/80'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <button
                      onClick={() => handleTogglePlay(memo)}
                      className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 transition-all ${
                        isThisPlaying
                          ? 'bg-gradient-to-tr from-amber-500 to-rose-500 text-white shadow-lg shadow-amber-500/25'
                          : 'bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700/60'
                      }`}
                    >
                      {isThisPlaying ? (
                        <Pause className="w-5 h-5 fill-current" />
                      ) : (
                        <Play className="w-5 h-5 fill-current ml-0.5" />
                      )}
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-xs font-bold text-white truncate">{memo.title}</span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-medium capitalize ${
                            memo.voiceType === 'female'
                              ? 'bg-pink-500/20 text-pink-300 border border-pink-500/30'
                              : memo.voiceType === 'child'
                              ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                              : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                          }`}
                        >
                          {memo.voiceType} • {memo.voiceName}
                        </span>

                        {memo.driveFileId ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center gap-1 font-medium">
                            <UploadCloud className="w-3 h-3" />
                            <span>Drive Synced</span>
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-400 font-medium">
                            Local Only
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-300 italic line-clamp-2 mb-2 bg-slate-950/40 p-2 rounded-xl border border-slate-800/40">
                        "{memo.textPrompt}"
                      </p>

                      <div className="flex items-center gap-3 text-[11px] text-slate-500">
                        <span>{new Date(memo.createdAt).toLocaleDateString()}</span>
                        <span>•</span>
                        <span>{Math.round(memo.durationSeconds)}s</span>
                        {memo.fileSizeBytes > 0 && (
                          <>
                            <span>•</span>
                            <span>{Math.round(memo.fileSizeBytes / 1024)} KB</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleToggleFavorite(memo)}
                      className={`p-2 rounded-xl hover:bg-slate-800 transition-colors ${
                        memo.isFavorite ? 'text-rose-500' : 'text-slate-500 hover:text-slate-300'
                      }`}
                      title={memo.isFavorite ? 'Unfavorite' : 'Favorite'}
                    >
                      <Heart className={`w-4 h-4 ${memo.isFavorite ? 'fill-current' : ''}`} />
                    </button>

                    <button
                      onClick={() => handleShare(memo)}
                      className="p-2 rounded-xl text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
                      title="Share External"
                    >
                      <Share2 className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleDownload(memo)}
                      className="p-2 rounded-xl text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
                      title="Download Audio (.wav)"
                    >
                      <Download className="w-4 h-4" />
                    </button>

                    {!memo.driveFileId ? (
                      <button
                        onClick={() => handleUploadToDrive(memo)}
                        disabled={isUploading}
                        className="p-2 rounded-xl text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 transition-colors"
                        title="Upload to Google Drive"
                      >
                        {isUploading ? (
                          <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <UploadCloud className="w-4 h-4" />
                        )}
                      </button>
                    ) : (
                      memo.driveWebViewLink && (
                        <a
                          href={memo.driveWebViewLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 rounded-xl text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors"
                          title="Open in Google Drive"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )
                    )}

                    <button
                      onClick={() => handleDelete(memo)}
                      className="p-2 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl bg-slate-900 border border-amber-500/60 text-white text-xs font-semibold shadow-2xl flex items-center gap-2 backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-200">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
