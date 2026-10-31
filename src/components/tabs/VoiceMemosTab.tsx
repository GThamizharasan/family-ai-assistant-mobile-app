import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  Square,
  Play,
  Pause,
  UploadCloud,
  Share2,
  Download,
  Heart,
  Trash2,
  Sparkles,
  FileText,
  Search,
  RotateCcw,
  RotateCw,
  HardDrive,
  ExternalLink,
  Plus,
  Volume2,
  Clock,
  Check,
  ChevronDown,
  X,
  Radio,
  Database,
  DownloadCloud,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { VoiceRecording, RecordingCategory } from '../../types/voiceRecording';
import {
  fetchVoiceRecordings,
  saveVoiceRecording,
  deleteVoiceRecording,
  toggleRecordingFavorite,
  downloadVoiceRecordingFile,
  shareVoiceRecording,
  transcribeVoiceRecording,
  VOICE_RECORDING_CATEGORIES,
} from '../../services/voiceRecordingDrive';
import { getApiUrl } from '../../services/api';
import { getAudioFromStorage, saveAudioToStorage, getAllCachedTrackIds } from '../../utils/audioStorage';
import { saveVoiceRecordingToSqliteStore, cacheAllVoiceRecordingsToSqlite, isAppOffline } from '../../services/offlineSyncService';

export const VoiceMemosTab: React.FC = () => {
  const { user, googleAccessToken, isGoogleConnected, signInWithGoogleOAuth } = useApp();
  const [recordings, setRecordings] = useState<VoiceRecording[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [activeRecordingId, setActiveRecordingId] = useState<string | null>(null);

  // -------------------------------------------------------------
  // RECORDING STATE
  // -------------------------------------------------------------
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordingTitle, setRecordingTitle] = useState('');
  const [recordingCategory, setRecordingCategory] = useState<RecordingCategory>('Personal Memo');
  const [audioVolume, setAudioVolume] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // -------------------------------------------------------------
  // PLAYBACK STATE
  // -------------------------------------------------------------
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const audioBlobUrlsRef = useRef<Map<string, string>>(new Map());
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioLoadingId, setAudioLoadingId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  // Clean up any generated blob URLs on unmount
  useEffect(() => {
    return () => {
      audioBlobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      audioBlobUrlsRef.current.clear();
    };
  }, []);

  // -------------------------------------------------------------
  // TRANSCRIPTION & TOAST STATE
  // -------------------------------------------------------------
  const [transcribingId, setTranscribingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [expandedTranscriptId, setExpandedTranscriptId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // -------------------------------------------------------------
  // 3GB SQLITE OFFLINE VAULT STATE
  // -------------------------------------------------------------
  const [cachedVoiceIds, setCachedVoiceIds] = useState<Set<string>>(new Set());
  const [isCachingAll, setIsCachingAll] = useState(false);
  const [cachingProgress, setCachingProgress] = useState<{ current: number; total: number; title: string } | null>(null);

  const refreshCachedIds = async () => {
    try {
      const ids = await getAllCachedTrackIds();
      setCachedVoiceIds(new Set(ids));
    } catch {}
  };

  useEffect(() => {
    refreshCachedIds();
    window.addEventListener('aura_sqlite_synced', refreshCachedIds);
    return () => window.removeEventListener('aura_sqlite_synced', refreshCachedIds);
  }, []);

  const handleCacheVoiceRecording = async (rec: VoiceRecording, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    showToast(`Caching "${rec.title}" into 3GB SQLite store...`);
    try {
      const ok = await saveVoiceRecordingToSqliteStore(rec);
      if (ok) {
        setCachedVoiceIds((prev) => new Set([...prev, rec.id]));
        showToast(`✓ "${rec.title}" cached offline!`);
      } else {
        showToast(`⚠️ Could not cache "${rec.title}"`);
      }
    } catch (err: any) {
      showToast(`Cache error: ${err.message}`);
    }
  };

  const handleCacheAllVoiceRecordings = async () => {
    if (isCachingAll || recordings.length === 0) return;
    setIsCachingAll(true);
    setCachingProgress({ current: 0, total: recordings.length, title: 'Starting...' });
    showToast('Caching all voice memos into 3GB SQLite store...');
    try {
      const res = await cacheAllVoiceRecordingsToSqlite(recordings, (current, total, title) => {
        setCachingProgress({ current, total, title });
      });
      await refreshCachedIds();
      showToast(`✓ All ${res.cachedCount} voice memos cached for 100% offline playback!`);
    } catch (err: any) {
      showToast(`Batch caching notice: ${err.message}`);
    } finally {
      setIsCachingAll(false);
      setCachingProgress(null);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Load recordings
  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      setIsLoading(true);
      try {
        const list = await fetchVoiceRecordings(googleAccessToken, user?.email);
        if (isMounted) setRecordings(list);
      } catch (err) {
        console.warn('Load voice recordings error:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    void load();

    return () => {
      isMounted = false;
    };
  }, [googleAccessToken, user?.email]);

  // Audio recording timer & volume visualizer
  const startVolumeVisualizer = (stream: MediaStream) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      src.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        setAudioVolume(Math.min(100, Math.round((avg / 255) * 100)));
        animFrameRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {}
  };

  const stopVolumeVisualizer = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setAudioVolume(0);
  };

  // -------------------------------------------------------------
  // START RECORDING
  // -------------------------------------------------------------
  const handleStartRecording = async () => {
    try {
      if (playingId && audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        setIsPlaying(false);
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : 'audio/webm';

      const mr = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mr;

      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mr.start(250);
      setIsRecording(true);
      setIsPaused(false);
      setRecordingSeconds(0);
      setRecordingTitle(
        `Memo ${new Date().toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
      );

      startVolumeVisualizer(stream);

      recordTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Start recording error:', err);
      showToast('⚠️ Microphone access denied or unavailable.');
    }
  };

  const handlePauseRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    }
  };

  const handleResumeRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      recordTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    }
  };

  const handleCancelRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
      mediaRecorderRef.current = null;
    }
    stopVolumeVisualizer();
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    setIsRecording(false);
    setIsPaused(false);
    setRecordingSeconds(0);
    audioChunksRef.current = [];
  };

  const handleFinishRecording = async () => {
    if (!mediaRecorderRef.current) return;

    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    stopVolumeVisualizer();

    const mr = mediaRecorderRef.current;
    mr.stream.getTracks().forEach((t) => t.stop());

    const finalMime = mr.mimeType || 'audio/webm';
    setIsRecording(false);
    setIsPaused(false);

    showToast('Saving and syncing voice recording...');

    // Wait a brief moment for final chunks
    setTimeout(async () => {
      const audioBlob = new Blob(audioChunksRef.current, { type: finalMime });
      const durationSec = recordingSeconds || 1;

      const newRec: VoiceRecording = {
        id: `voice_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        userEmail: user?.email || 'chinna.tamil2000@gmail.com',
        title: recordingTitle || 'Voice Memo',
        category: recordingCategory,
        audioMimeType: finalMime,
        durationSeconds: durationSec,
        fileSizeBytes: audioBlob.size,
        driveFolderPath: 'Family Circle/Voice Recordings',
        driveSyncStatus: 'pending',
        isFavorite: false,
        playCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      try {
        const saved = await saveVoiceRecording(newRec, audioBlob, googleAccessToken);
        setRecordings((prev) => [saved, ...prev.filter((r) => r.id !== saved.id)]);
        showToast(
          saved.driveSyncStatus === 'synced'
            ? '✓ Saved & Uploaded to Google Drive!'
            : '✓ Saved locally in SQLite!'
        );

        // Auto-transcribe in background
        void handleTranscribe(saved);
      } catch (saveErr: any) {
        console.error('Save voice recording error:', saveErr);
        showToast(`⚠️ Save notice: ${saveErr.message || 'Saved locally'}`);
      }
    }, 200);
  };

  // -------------------------------------------------------------
  // IMPORT EXTERNAL AUDIO FILE
  // -------------------------------------------------------------
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    showToast(`Importing "${file.name}"...`);
    const cleanName = file.name.replace(/\.[a-zA-Z0-9]+$/, '');

    const newRec: VoiceRecording = {
      id: `voice_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      userEmail: user?.email || 'chinna.tamil2000@gmail.com',
      title: cleanName,
      category: 'Meeting & Work',
      audioMimeType: file.type || 'audio/mpeg',
      durationSeconds: 120,
      fileSizeBytes: file.size,
      driveFolderPath: 'Family Circle/Voice Recordings',
      driveSyncStatus: 'pending',
      isFavorite: false,
      playCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      const saved = await saveVoiceRecording(newRec, file, googleAccessToken);
      setRecordings((prev) => [saved, ...prev]);
      showToast('✓ Audio imported and saved!');
      void handleTranscribe(saved);
    } catch (err: any) {
      showToast(`⚠️ Import failed: ${err.message}`);
    }
  };

  // -------------------------------------------------------------
  // AUDIO PLAYBACK HANDLERS
  // -------------------------------------------------------------
  const getEffectiveAccessToken = () => {
    return (
      googleAccessToken ||
      (typeof localStorage !== 'undefined'
        ? localStorage.getItem('aura_google_access_token') ||
          localStorage.getItem('google_access_token')
        : null) ||
      null
    );
  };

  const getAudioSourceUrl = (rec: VoiceRecording) => {
    if (rec.audioContentBase64) {
      return `data:${rec.audioMimeType || 'audio/webm'};base64,${rec.audioContentBase64}`;
    }
    const token = getEffectiveAccessToken();
    const tokenParam = token ? `?accessToken=${encodeURIComponent(token)}` : '';
    const driveId = rec.driveFileId || (rec.id.startsWith('drive_') ? rec.id.replace(/^drive_/, '') : '');
    const driveParam = driveId ? `${tokenParam ? '&' : '?'}driveFileId=${encodeURIComponent(driveId)}` : '';
    return getApiUrl(`/api/voice-recordings/${rec.id}/audio${tokenParam}${driveParam}`);
  };

  const handlePlayToggle = async (rec: VoiceRecording) => {
    // 1. If currently playing this recording, toggle pause / resume
    if (playingId === rec.id) {
      if (isPlaying) {
        audioPlayerRef.current?.pause();
        setIsPlaying(false);
      } else {
        audioPlayerRef.current?.play().then(() => {
          setIsPlaying(true);
        }).catch((err) => {
          console.warn('[VoicePlayer] Resume error:', err);
        });
      }
      return;
    }

    // 2. Stop any existing audio
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current = null;
    }

    setIsPlaying(false);
    setPlayingId(rec.id);
    setCurrentTime(0);
    setDuration(rec.durationSeconds || 0);

    const effectiveToken = getEffectiveAccessToken();
    const driveFileId = rec.driveFileId || (rec.id.startsWith('drive_') ? rec.id.replace(/^drive_/, '') : null);

    const setupAndPlayAudio = (src: string) => {
      const audio = new Audio(src);
      audioPlayerRef.current = audio;
      audio.playbackRate = playbackSpeed;

      audio.ontimeupdate = () => {
        setCurrentTime(audio.currentTime);
        setDuration(audio.duration || rec.durationSeconds || 0);
      };

      audio.onended = () => {
        setIsPlaying(false);
        setCurrentTime(0);
      };

      audio.onerror = async () => {
        console.warn('[VoicePlayer] Stream error on audio source. Trying direct Google Drive fallback in-app...');
        setAudioLoadingId(rec.id);

        // Fallback: Fetch directly from Google Drive API if driveFileId and token are available
        if (driveFileId && effectiveToken) {
          try {
            showToast('Loading audio stream from Google Drive...');
            const driveRes = await fetch(
              `https://www.googleapis.com/drive/v3/files/${driveFileId}?alt=media`,
              { headers: { Authorization: `Bearer ${effectiveToken}` } }
            );
            if (driveRes.ok) {
              const blob = await driveRes.blob();
              if (blob.size > 100) {
                // Cache into IndexedDB for offline access
                await saveAudioToStorage(rec.id, blob, rec.audioMimeType || 'audio/webm').catch(() => {});
                setCachedVoiceIds((prev) => new Set([...prev, rec.id]));

                const objectUrl = URL.createObjectURL(blob);
                audioBlobUrlsRef.current.set(rec.id, objectUrl);

                const directAudio = new Audio(objectUrl);
                audioPlayerRef.current = directAudio;
                directAudio.playbackRate = playbackSpeed;
                directAudio.ontimeupdate = () => {
                  setCurrentTime(directAudio.currentTime);
                  setDuration(directAudio.duration || rec.durationSeconds || 0);
                };
                directAudio.onended = () => {
                  setIsPlaying(false);
                  setCurrentTime(0);
                };
                directAudio.onerror = () => {
                  showToast('⚠️ Could not play audio stream.');
                  setIsPlaying(false);
                  setPlayingId(null);
                  setAudioLoadingId(null);
                };

                await directAudio.play();
                setIsPlaying(true);
                setAudioLoadingId(null);
                return;
              }
            }
          } catch (driveErr) {
            console.error('[VoicePlayer] Direct Drive fetch error:', driveErr);
          }
        }

        setAudioLoadingId(null);
        setIsPlaying(false);
        setPlayingId(null);
        showToast('⚠️ Could not play audio. File may be unavailable or deleted from Drive.');
      };

      audio.play().then(() => {
        setIsPlaying(true);
      }).catch((playErr) => {
        console.warn('[VoicePlayer] Audio play failed:', playErr);
      });
    };

    // Priority #1: Client SQLite / IndexedDB Local Storage Vault
    try {
      const storedAudio = await getAudioFromStorage(rec.id);
      if (storedAudio) {
        setupAndPlayAudio(storedAudio);
        return;
      }
    } catch (e) {
      console.warn('[VoicePlayer] Client SQLite lookup notice:', e);
    }

    // Fast-path: Check if we have an already cached blob URL
    if (audioBlobUrlsRef.current.has(rec.id)) {
      setupAndPlayAudio(audioBlobUrlsRef.current.get(rec.id)!);
      return;
    }

    // Fast-path: Check base64
    if (rec.audioContentBase64) {
      setupAndPlayAudio(`data:${rec.audioMimeType || 'audio/webm'};base64,${rec.audioContentBase64}`);
      return;
    }

    // Stream from server endpoint
    const streamUrl = getAudioSourceUrl(rec);
    setupAndPlayAudio(streamUrl);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    if (audioPlayerRef.current) {
      audioPlayerRef.current.currentTime = val;
      setCurrentTime(val);
    }
  };

  const handleSkip = (seconds: number) => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.currentTime = Math.max(
        0,
        Math.min(audioPlayerRef.current.duration || 9999, audioPlayerRef.current.currentTime + seconds)
      );
    }
  };

  const handleCycleSpeed = () => {
    const speeds = [0.75, 1, 1.25, 1.5, 2];
    const nextIdx = (speeds.indexOf(playbackSpeed) + 1) % speeds.length;
    const nextSpeed = speeds[nextIdx];
    setPlaybackSpeed(nextSpeed);
    if (audioPlayerRef.current) {
      audioPlayerRef.current.playbackRate = nextSpeed;
    }
  };

  // -------------------------------------------------------------
  // ACTIONS: FAVORITE, TRANSCRIBE, SHARE, DOWNLOAD, DELETE
  // -------------------------------------------------------------
  const handleToggleFavorite = async (rec: VoiceRecording, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = !rec.isFavorite;
    setRecordings((prev) => prev.map((r) => (r.id === rec.id ? { ...r, isFavorite: next } : r)));
    await toggleRecordingFavorite(rec.id, next);
  };

  const handleTranscribe = async (rec: VoiceRecording, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setTranscribingId(rec.id);
    showToast(`Transcribing "${rec.title}" with Gemini AI...`);

    try {
      const res = await transcribeVoiceRecording(rec, undefined, getEffectiveAccessToken());
      setRecordings((prev) =>
        prev.map((r) =>
          r.id === rec.id
            ? {
                ...r,
                transcription: res.transcription,
                transcriptionSummary: res.summary,
                detectedLanguage: res.detectedLanguage,
              }
            : r
        )
      );
      setExpandedTranscriptId(rec.id);
      showToast('✓ Transcription complete & saved to SQLite!');
    } catch (err: any) {
      showToast(`⚠️ Transcription notice: ${err.message || 'Failed'}`);
    } finally {
      setTranscribingId(null);
    }
  };

  const handleShare = async (rec: VoiceRecording, e: React.MouseEvent) => {
    e.stopPropagation();
    const res = await shareVoiceRecording(rec);
    if (res.method === 'clipboard') {
      showToast('✓ Share link copied to clipboard!');
    } else if (res.method === 'native') {
      showToast('✓ Shared voice memo!');
    }
  };

  const handleDownload = async (rec: VoiceRecording, e: React.MouseEvent) => {
    e.stopPropagation();
    showToast(`Downloading "${rec.title}"...`);
    const res = await downloadVoiceRecordingFile(rec, googleAccessToken);
    if (res.success) {
      showToast(`✓ Downloaded "${res.filename}"!`);
    } else {
      showToast(`⚠️ Download notice: ${res.error || 'Failed'}`);
    }
  };

  const handleDelete = async (rec: VoiceRecording, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete voice memo "${rec.title}"?`)) return;
    if (playingId === rec.id && audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      setIsPlaying(false);
    }
    setRecordings((prev) => prev.filter((r) => r.id !== rec.id));
    await deleteVoiceRecording(rec.id, user?.email);
    showToast('Voice memo deleted.');
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const filteredRecordings = recordings.filter((r) => {
    if (favoritesOnly && !r.isFavorite) return false;
    if (selectedCategory !== 'all' && r.category !== selectedCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const inTitle = r.title.toLowerCase().includes(q);
      const inCat = r.category.toLowerCase().includes(q);
      const inTrans = (r.transcription || '').toLowerCase().includes(q);
      const inSummary = (r.transcriptionSummary || '').toLowerCase().includes(q);
      return inTitle || inCat || inTrans || inSummary;
    }
    return true;
  });

  return (
    <div className="space-y-6 pb-28 pt-2">
      {/* Hidden File Input for Importing External Audio */}
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,.mp3,.wav,.m4a,.webm,.ogg,.aac"
        onChange={handleImportFile}
        className="hidden"
      />

      {/* Toast Notice */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 max-w-sm w-[90%] px-4 py-2.5 rounded-2xl bg-slate-900/95 border border-amber-500/40 backdrop-blur-xl text-white text-xs shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
          <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="truncate flex-1 font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/80 border border-slate-800 p-4 rounded-3xl shadow-xl backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-rose-500 to-amber-500 flex items-center justify-center text-white font-bold shadow-lg shadow-rose-500/20">
            <Mic className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold tracking-tight text-white">Voice Memos</h1>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/30 font-semibold">
                Google Drive Synced
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Record, synchronize to Google Drive, share, download & AI transcribe
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {/* Cache All Offline Button */}
          <button
            onClick={handleCacheAllVoiceRecordings}
            disabled={isCachingAll || recordings.length === 0}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all ${
              isCachingAll
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse'
                : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border-emerald-500/30'
            }`}
            title="Cache all voice memos into 3GB SQLite store for 100% offline playback"
          >
            <Database className={`w-3.5 h-3.5 text-emerald-400 ${isCachingAll ? 'animate-spin' : ''}`} />
            <span>{isCachingAll ? 'Caching All...' : 'Cache All Offline'}</span>
          </button>

          {/* Import External Audio Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-colors"
            title="Import Audio File"
          >
            <UploadCloud className="w-3.5 h-3.5 text-indigo-400" />
            <span>Import</span>
          </button>

          {/* Drive status indicator */}
          {isGoogleConnected ? (
            <div className="px-2.5 py-1 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-1">
              <HardDrive className="w-3.5 h-3.5" />
              <span>Drive Active</span>
            </div>
          ) : (
            <button
              onClick={() => signInWithGoogleOAuth?.()}
              className="px-2.5 py-1 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-semibold hover:bg-amber-500/25 transition-colors"
            >
              Connect Drive
            </button>
          )}
        </div>
      </div>

      {/* =========================================================================
          LIVE RECORDING STUDIO CONSOLE
      ========================================================================= */}
      <div className="p-5 rounded-3xl bg-gradient-to-br from-slate-900/95 via-slate-900/80 to-slate-950 border border-slate-800 shadow-2xl relative overflow-hidden">
        {!isRecording ? (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-1 text-center sm:text-left">
              <div className="text-base font-bold text-white">Capture Voice Memo</div>
              <p className="text-xs text-slate-400">
                Microphone with live audio waveform analysis and automatic Drive upload
              </p>
            </div>

            <button
              onClick={handleStartRecording}
              className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-600 text-white font-bold text-sm flex items-center gap-2.5 shadow-xl shadow-rose-600/30 transition-all active:scale-95 group"
            >
              <div className="w-4 h-4 rounded-full bg-white animate-ping group-hover:animate-none" />
              <span>Record Voice Memo</span>
            </button>
          </div>
        ) : (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Recording Active Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-rose-500 animate-pulse" />
                <span className="text-xs font-bold text-rose-400 uppercase tracking-wider">
                  {isPaused ? 'Recording Paused' : 'Live Recording'}
                </span>
              </div>
              <div className="text-2xl font-extrabold text-white font-mono">
                {formatSeconds(recordingSeconds)}
              </div>
            </div>

            {/* Live Audio Waveform Simulation Bar */}
            <div className="h-10 bg-slate-950 rounded-2xl p-2 flex items-center justify-center gap-1 overflow-hidden border border-slate-800">
              {[...Array(24)].map((_, i) => {
                const heightPercent = isPaused
                  ? 10
                  : Math.max(15, Math.min(100, Math.sin(i * 0.4 + Date.now() * 0.005) * 40 + audioVolume));
                return (
                  <div
                    key={i}
                    className="flex-1 bg-gradient-to-t from-rose-500 to-amber-400 rounded-full transition-all duration-75"
                    style={{ height: `${heightPercent}%` }}
                  />
                );
              })}
            </div>

            {/* Title & Category inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="text"
                value={recordingTitle}
                onChange={(e) => setRecordingTitle(e.target.value)}
                placeholder="Memo Title..."
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
              />
              <select
                value={recordingCategory}
                onChange={(e) => setRecordingCategory(e.target.value as RecordingCategory)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
              >
                {VOICE_RECORDING_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Recording Controls */}
            <div className="flex items-center justify-between pt-1">
              <button
                onClick={handleCancelRecording}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white text-xs font-semibold transition-colors"
              >
                Cancel
              </button>

              <div className="flex items-center gap-2">
                {isPaused ? (
                  <button
                    onClick={handleResumeRecording}
                    className="p-3 rounded-2xl bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors"
                    title="Resume"
                  >
                    <Play className="w-5 h-5 fill-current" />
                  </button>
                ) : (
                  <button
                    onClick={handlePauseRecording}
                    className="p-3 rounded-2xl bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors"
                    title="Pause"
                  >
                    <Pause className="w-5 h-5" />
                  </button>
                )}

                <button
                  onClick={handleFinishRecording}
                  className="px-5 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-rose-600/30 transition-all active:scale-95"
                >
                  <Square className="w-4 h-4 fill-current" />
                  <span>Done & Save</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* =========================================================================
          AUDIO PLAYER DOCK (When audio is active)
      ========================================================================= */}
      {playingId && (
        <div className="p-4 rounded-3xl bg-slate-900 border border-rose-500/30 shadow-2xl space-y-3 sticky top-4 z-30 backdrop-blur-xl animate-in slide-in-from-top-2 duration-200">
          {(() => {
            const activeRec = recordings.find((r) => r.id === playingId);
            if (!activeRec) return null;

            return (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5 truncate">
                    <div className="w-8 h-8 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                      <Volume2 className="w-4 h-4" />
                    </div>
                    <div className="truncate">
                      <div className="font-bold text-white text-xs truncate">{activeRec.title}</div>
                      <div className="text-[10px] text-slate-400">{activeRec.category}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCycleSpeed}
                      className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-amber-400 transition-colors"
                      title="Playback Speed"
                    >
                      {playbackSpeed}x
                    </button>
                    <button
                      onClick={() => {
                        audioPlayerRef.current?.pause();
                        setIsPlaying(false);
                        setPlayingId(null);
                      }}
                      className="p-1 rounded-lg text-slate-400 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Scrubber slider */}
                <div className="space-y-1">
                  <input
                    type="range"
                    min="0"
                    max={duration || activeRec.durationSeconds || 1}
                    value={currentTime}
                    onChange={handleSeek}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-rose-500"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                    <span>{formatSeconds(currentTime)}</span>
                    <span>{formatSeconds(duration || activeRec.durationSeconds || 0)}</span>
                  </div>
                </div>

                {/* Controls */}
                <div className="flex items-center justify-center gap-4">
                  <button
                    onClick={() => handleSkip(-15)}
                    className="p-2 rounded-xl text-slate-400 hover:text-white transition-colors"
                    title="Skip backward 15s"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handlePlayToggle(activeRec)}
                    className="p-3 rounded-2xl bg-rose-500 text-white hover:bg-rose-400 shadow-lg shadow-rose-500/30 transition-transform active:scale-95"
                  >
                    {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-current" />}
                  </button>

                  <button
                    onClick={() => handleSkip(15)}
                    className="p-2 rounded-xl text-slate-400 hover:text-white transition-colors"
                    title="Skip forward 15s"
                  >
                    <RotateCw className="w-4 h-4" />
                  </button>
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* =========================================================================
          FILTER & SEARCH BAR
      ========================================================================= */}
      <div className="space-y-2">
        <div className="flex flex-col sm:flex-row gap-2">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search recordings, transcripts, summaries..."
              className="w-full bg-slate-900/80 border border-slate-800 rounded-2xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
            />
          </div>

          {/* Favorites toggle */}
          <button
            onClick={() => setFavoritesOnly(!favoritesOnly)}
            className={`px-3 py-2 rounded-2xl border text-xs font-bold flex items-center gap-1.5 transition-colors shrink-0 ${
              favoritesOnly
                ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <Heart className={`w-3.5 h-3.5 ${favoritesOnly ? 'fill-current' : ''}`} />
            <span>Favorites</span>
          </button>
        </div>

        {/* Categories Strip */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
              selectedCategory === 'all'
                ? 'bg-rose-500 text-white'
                : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            All Categories
          </button>
          {VOICE_RECORDING_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                selectedCategory === cat
                  ? 'bg-rose-500 text-white'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* =========================================================================
          RECORDINGS LIST
      ========================================================================= */}
      <div className="space-y-3">
        {isLoading && recordings.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-xs">Loading voice memos...</div>
        ) : filteredRecordings.length === 0 ? (
          <div className="p-8 rounded-3xl bg-slate-900/50 border border-dashed border-slate-800 text-center space-y-2">
            <Mic className="w-10 h-10 text-slate-600 mx-auto" />
            <div className="text-sm font-bold text-slate-300">No Voice Memos Found</div>
            <p className="text-xs text-slate-500 max-w-xs mx-auto">
              Tap &quot;Record Voice Memo&quot; above to capture notes, family discussions, or ideas.
            </p>
          </div>
        ) : (
          filteredRecordings.map((rec) => {
            const isRecPlaying = playingId === rec.id && isPlaying;
            const isTranscribing = transcribingId === rec.id;
            const isExpanded = expandedTranscriptId === rec.id;

            return (
              <div
                key={rec.id}
                className={`p-4 rounded-3xl border transition-all space-y-3 ${
                  playingId === rec.id
                    ? 'bg-slate-900/90 border-rose-500/40 shadow-xl'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* Header Row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 truncate">
                    <button
                      onClick={() => handlePlayToggle(rec)}
                      className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 transition-all ${
                        isRecPlaying
                          ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                      }`}
                      title={isRecPlaying ? 'Pause' : 'Play Audio'}
                    >
                      {audioLoadingId === rec.id ? (
                        <RotateCcw className="w-5 h-5 animate-spin text-amber-400" />
                      ) : isRecPlaying ? (
                        <Pause className="w-5 h-5" />
                      ) : (
                        <Play className="w-5 h-5 fill-current ml-0.5" />
                      )}
                    </button>

                    <div className="truncate">
                      <div className="font-bold text-white text-sm truncate">{rec.title}</div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                        <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-medium">
                          {rec.category}
                        </span>
                        <span>{formatSeconds(rec.durationSeconds)}</span>
                        <span>•</span>
                        <span>
                          {new Date(rec.createdAt).toLocaleDateString([], {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Badges & Favorite */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* 3GB SQLite Offline Badge / Cache Button */}
                    {cachedVoiceIds.has(rec.id) ? (
                      <span
                        className="px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 font-bold text-[10px] flex items-center gap-1 border border-emerald-500/30"
                        title="Cached in 3GB SQLite store for 100% offline playback"
                      >
                        <Database className="w-3 h-3 text-emerald-400" />
                        <span>Offline</span>
                      </span>
                    ) : (
                      <button
                        onClick={(e) => handleCacheVoiceRecording(rec, e)}
                        className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-semibold flex items-center gap-1 border border-slate-700 transition-colors"
                        title="Cache into 3GB SQLite store for offline playback"
                      >
                        <DownloadCloud className="w-3 h-3 text-indigo-400" />
                        <span>Cache</span>
                      </button>
                    )}

                    {/* Drive sync badge */}
                    {rec.driveFileId ? (
                      <span
                        className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs"
                        title="Synced to Google Drive"
                      >
                        <HardDrive className="w-3.5 h-3.5" />
                      </span>
                    ) : (
                      <span
                        className="p-1.5 rounded-lg bg-slate-800 text-slate-500 text-xs"
                        title="Stored locally"
                      >
                        <HardDrive className="w-3.5 h-3.5" />
                      </span>
                    )}

                    {/* Favorite */}
                    <button
                      onClick={(e) => handleToggleFavorite(rec, e)}
                      className={`p-1.5 rounded-lg transition-colors ${
                        rec.isFavorite ? 'text-rose-400' : 'text-slate-500 hover:text-slate-300'
                      }`}
                      title={rec.isFavorite ? 'Remove Favorite' : 'Add to Favorites'}
                    >
                      <Heart className={`w-4 h-4 ${rec.isFavorite ? 'fill-current' : ''}`} />
                    </button>
                  </div>
                </div>

                {/* AI Executive Summary if available */}
                {rec.transcriptionSummary && (
                  <div className="p-2.5 rounded-2xl bg-slate-950/70 border border-slate-800/80 text-xs text-slate-300 flex items-start gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <span className="font-bold text-amber-300 mr-1">AI Summary:</span>
                      <span>{rec.transcriptionSummary}</span>
                    </div>
                  </div>
                )}

                {/* Expanded Verbatim Transcript */}
                {isExpanded && rec.transcription && (
                  <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-400">
                      <span>Verbatim Transcript:</span>
                      <button
                        onClick={async () => {
                          await navigator.clipboard.writeText(rec.transcription || '');
                          showToast('✓ Transcript copied to clipboard');
                        }}
                        className="text-amber-400 hover:underline"
                      >
                        Copy Transcript
                      </button>
                    </div>
                    <p className="text-slate-200 leading-relaxed font-sans select-text">
                      {rec.transcription}
                    </p>
                  </div>
                )}

                {/* Bottom Action Strip */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 text-xs text-slate-400">
                  <div className="flex items-center gap-2">
                    {/* Transcribe Button */}
                    <button
                      onClick={(e) => handleTranscribe(rec, e)}
                      disabled={isTranscribing}
                      className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center gap-1 font-semibold transition-colors disabled:opacity-50"
                      title="Transcribe Voice with Gemini AI"
                    >
                      <Sparkles className="w-3 h-3 text-amber-400" />
                      <span>{isTranscribing ? 'Transcribing...' : rec.transcription ? 'Re-Transcribe' : 'Transcribe'}</span>
                    </button>

                    {/* Show/Hide Transcript Toggle */}
                    {rec.transcription && (
                      <button
                        onClick={() =>
                          setExpandedTranscriptId(isExpanded ? null : rec.id)
                        }
                        className="px-2 py-1 rounded-xl text-slate-400 hover:text-white transition-colors"
                      >
                        {isExpanded ? 'Hide Text' : 'View Text'}
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    {/* External Share */}
                    <button
                      onClick={(e) => handleShare(rec, e)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-slate-800 transition-colors"
                      title="Share voice memo"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                    </button>

                    {/* Download */}
                    <button
                      onClick={(e) => handleDownload(rec, e)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-slate-800 transition-colors"
                      title="Download audio file"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>

                    {/* Open in Drive */}
                    {rec.driveWebViewLink && (
                      <a
                        href={rec.driveWebViewLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-slate-800 transition-colors"
                        title="Open in Google Drive"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}

                    {/* Delete */}
                    <button
                      onClick={(e) => handleDelete(rec, e)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                      title="Delete recording"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
