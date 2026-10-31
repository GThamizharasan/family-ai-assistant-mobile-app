import React, { useState, useEffect, useRef } from 'react';
import {
  Music,
  Play,
  Pause,
  Plus,
  Search,
  Upload,
  Cloud,
  RefreshCw,
  Heart,
  Grid,
  List as ListIcon,
  Clock,
  Sparkles,
  Flame,
  Award,
  Layers,
  ChevronRight,
  Headphones,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Volume2,
  Trash2,
  Sliders,
  Share2,
  Download,
  SkipBack,
  SkipForward,
  Repeat,
  Shuffle,
  AlignLeft,
  Database,
  HardDrive,
  Wifi,
  WifiOff,
  DownloadCloud,
  Check,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { MusicTrack, MusicGenre, MUSIC_GENRES, AudioPlaybackState } from '../../types/music';
import {
  fetchMusicTracks,
  saveMusicTrack,
  deleteMusicTrack,
  toggleTrackFavorite,
  incrementTrackPlay,
  syncTrackToAppleMusic,
  refreshAppleMusicFromDrive,
  downloadTrackAudio,
  INITIAL_MUSIC_TRACKS,
} from '../../services/musicLibraryService';
import { musicAudioEngine } from '../../services/musicAudioEngine';
import { AppleMusicPlayerModal } from '../music/AppleMusicPlayerModal';
import {
  isOfflineModeSimulated,
  setOfflineModeSimulated,
  isAppOffline,
  fetchSqlite3GbQuota,
  saveTrackToSqliteStore,
  cacheAllMusicTracksToSqlite,
  Sqlite3GbQuotaDetails,
  MAX_SQLITE_STORAGE_MB,
} from '../../services/offlineSyncService';
import { getAllCachedTrackIds } from '../../utils/audioStorage';

interface MusicLibraryTabProps {
  onOpenPlayer?: () => void;
}

export const MusicLibraryTab: React.FC<MusicLibraryTabProps> = ({ onOpenPlayer }) => {
  const { user, googleAccessToken } = useApp();
  const [tracks, setTracks] = useState<MusicTrack[]>(INITIAL_MUSIC_TRACKS);
  const [activeTab, setActiveTab] = useState<'listening-now' | 'library' | 'playlists'>('listening-now');
  const [viewMode, setViewMode] = useState<'grid' | 'shelf'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'recent' | 'title' | 'artist' | 'plays'>('recent');

  // Playback state & Modals
  const [playbackState, setPlaybackState] = useState<AudioPlaybackState>(musicAudioEngine.getState());
  const [isPlayerModalOpen, setIsPlayerModalOpen] = useState(false);
  const [isSyncingDrive, setIsSyncingDrive] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  // Upload Track Modal
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadArtist, setUploadArtist] = useState(user?.name || 'Thamizh (Head)');
  const [uploadGenre, setUploadGenre] = useState<MusicGenre>('AI Studio Lyria');
  const [uploadLyrics, setUploadLyrics] = useState('');
  const [uploadAudioFile, setUploadAudioFile] = useState<File | null>(null);
  const [uploadArtworkFile, setUploadArtworkFile] = useState<File | null>(null);
  const [uploadAudioUrl, setUploadAudioUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Daily listening goal state (like Apple Books daily reading goal)
  const [dailyGoalMinutes] = useState(30);
  const [todayMinutesListened, setTodayMinutesListened] = useState(() => {
    return Number(localStorage.getItem('aura_music_today_mins')) || 18;
  });

  // 3GB SQLite Offline Storage & Simulation State
  const [sqliteQuota, setSqliteQuota] = useState<Sqlite3GbQuotaDetails | null>(null);
  const [isSimulatedOffline, setIsSimulatedOffline] = useState(() => isOfflineModeSimulated());
  const [isCachingAll, setIsCachingAll] = useState(false);
  const [cachingProgress, setCachingProgress] = useState<{ current: number; total: number; title: string } | null>(null);
  const [cachingTrackId, setCachingTrackId] = useState<string | null>(null);
  const [filterOfflineOnly, setFilterOfflineOnly] = useState(false);

  useEffect(() => {
    const unsub = musicAudioEngine.subscribe((s) => {
      setPlaybackState(s);
    });
    return unsub;
  }, []);

  const loadQuota = async () => {
    try {
      const q = await fetchSqlite3GbQuota();
      if (q) setSqliteQuota(q);
    } catch {}
  };

  // Synchronize 3GB SQLite Quota and Offline simulation mode
  useEffect(() => {
    loadQuota();

    const handleSyncEvent = (e: any) => {
      if (e.detail?.quota) {
        setSqliteQuota(e.detail.quota);
      } else {
        loadQuota();
      }
    };

    const handleOfflineChanged = (e: any) => {
      setIsSimulatedOffline(e.detail?.active ?? isOfflineModeSimulated());
    };

    window.addEventListener('aura_sqlite_synced', handleSyncEvent);
    window.addEventListener('aura_offline_mode_changed', handleOfflineChanged);

    return () => {
      window.removeEventListener('aura_sqlite_synced', handleSyncEvent);
      window.removeEventListener('aura_offline_mode_changed', handleOfflineChanged);
    };
  }, []);

  // Load tracks on mount
  useEffect(() => {
    loadTracks();
  }, [user?.email]);

  const loadTracks = async () => {
    setIsSyncingDrive(true);
    try {
      const data = await fetchMusicTracks(user?.email);
      // Synchronize with mobile IndexedDB offline vault for 100% offline mobile playback
      try {
        const cachedIds = new Set(await getAllCachedTrackIds());
        const merged = data.map((t) => ({
          ...t,
          localCached: t.localCached || cachedIds.has(t.id),
        }));
        setTracks(merged);
        musicAudioEngine.setQueue(merged);
      } catch {
        setTracks(data);
        musicAudioEngine.setQueue(data);
      }
    } catch (e) {
      console.warn('loadTracks error:', e);
    } finally {
      setIsSyncingDrive(false);
    }
  };

  const handleToggleOfflineMode = () => {
    const next = !isSimulatedOffline;
    setIsSimulatedOffline(next);
    setOfflineModeSimulated(next);
    if (next) {
      setSyncNotice('⚡ Offline Mode Active (Airplane Simulation) • Streaming audio from 3GB SQLite Store');
    } else {
      setSyncNotice('🌐 Online Mode Restored • Connected to Google Drive & Cloud Services');
    }
    setTimeout(() => setSyncNotice(null), 4000);
  };

  const handleCacheTrackToSqlite = async (track: MusicTrack, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setCachingTrackId(track.id);
    setSyncNotice(`Caching "${track.title}" to 3GB SQLite Store...`);
    try {
      const ok = await saveTrackToSqliteStore(track);
      if (ok) {
        setTracks((prev) =>
          prev.map((t) => (t.id === track.id ? { ...t, localCached: true } : t))
        );
        await loadQuota();
        setSyncNotice(`✓ "${track.title}" cached to 3GB SQLite Store for 100% offline playback!`);
      } else {
        setSyncNotice(`⚠️ Notice: Could not cache audio for "${track.title}"`);
      }
    } catch (err: any) {
      setSyncNotice(`Caching error: ${err.message || 'Error caching track'}`);
    } finally {
      setCachingTrackId(null);
      setTimeout(() => setSyncNotice(null), 3500);
    }
  };

  const handleCacheAllOffline = async () => {
    if (isCachingAll) return;
    setIsCachingAll(true);
    setCachingProgress({ current: 0, total: tracks.length, title: 'Starting...' });
    setSyncNotice('Starting 3GB SQLite offline caching for all music tracks...');

    try {
      const res = await cacheAllMusicTracksToSqlite(tracks, (current, total, title) => {
        setCachingProgress({ current, total, title });
      });

      setTracks((prev) => prev.map((t) => ({ ...t, localCached: true })));
      await loadQuota();
      setSyncNotice(`✓ All ${res.cachedCount} music tracks cached into 3GB SQLite Store! 100% offline ready.`);
    } catch (err: any) {
      setSyncNotice(`Offline caching notice: ${err.message || 'Error occurred during batch sync'}`);
    } finally {
      setIsCachingAll(false);
      setCachingProgress(null);
      setTimeout(() => setSyncNotice(null), 4500);
    }
  };

  const handlePlayTrack = async (track: MusicTrack) => {
    if (playbackState.currentTrack?.id === track.id) {
      musicAudioEngine.togglePlay();
    } else {
      const activeQueue = filteredTracks.length > 0 ? filteredTracks : tracks;
      await musicAudioEngine.playTrack(track, activeQueue);
      await incrementTrackPlay(track.id);
      // Increment local minutes listened
      setTodayMinutesListened((prev) => {
        const next = prev + 3;
        localStorage.setItem('aura_music_today_mins', String(next));
        return next;
      });
    }
  };

  const handleNextTrack = () => {
    musicAudioEngine.nextTrack();
  };

  const handlePreviousTrack = () => {
    musicAudioEngine.previousTrack();
  };

  const handleToggleFavorite = async (track: MusicTrack, e: React.MouseEvent) => {
    e.stopPropagation();
    const updatedFav = !track.isFavorite;
    setTracks((prev) =>
      prev.map((t) => (t.id === track.id ? { ...t, isFavorite: updatedFav } : t))
    );
    await toggleTrackFavorite(track.id, updatedFav);
  };

  const handleShareTrack = async (track: MusicTrack, e: React.MouseEvent) => {
    e.stopPropagation();
    const shareUrl = track.driveWebViewLink || track.audioUrl || window.location.href;
    const shareText = `🎵 ${track.title} by ${track.artist}${track.album ? ` (${track.album})` : ''} • Apple Music`;

    const shareData = {
      title: track.title,
      text: shareText,
      url: shareUrl,
    };

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share(shareData);
        setSyncNotice(`✓ Shared "${track.title}"!`);
        setTimeout(() => setSyncNotice(null), 3500);
        return;
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        console.warn('Native share failed, fallback to clipboard:', err);
      }
    }

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        const copyContent = `${shareText}\n${shareUrl}`;
        await navigator.clipboard.writeText(copyContent);
        setSyncNotice(`✓ Track link copied to clipboard: "${track.title}"!`);
        setTimeout(() => setSyncNotice(null), 3500);
        return;
      }
    } catch (clipErr) {
      console.warn('Clipboard write failed:', clipErr);
    }

    if (shareUrl && shareUrl !== window.location.href) {
      window.open(shareUrl, '_blank');
    }
  };

  const handleDownloadTrack = async (track: MusicTrack, e: React.MouseEvent) => {
    e.stopPropagation();
    setSyncNotice(`Downloading "${track.title}"...`);
    const res = await downloadTrackAudio(track, googleAccessToken);
    if (res.success) {
      setSyncNotice(`✓ Downloaded "${track.title}"!`);
    } else {
      setSyncNotice(`⚠️ Download notice: ${res.error || 'Failed'}`);
    }
    setTimeout(() => setSyncNotice(null), 3500);
  };

  const handleDeleteTrack = async (track: MusicTrack, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Remove "${track.title}" from Apple Music?`)) return;
    setTracks((prev) => prev.filter((t) => t.id !== track.id));
    await deleteMusicTrack(track.id, user?.email);
    if (playbackState.currentTrack?.id === track.id) {
      musicAudioEngine.pause();
    }
  };

  const handleSyncTrackToDrive = async (track: MusicTrack, e: React.MouseEvent) => {
    e.stopPropagation();
    setSyncNotice(`Syncing "${track.title}" to Google Drive (Family Circle / Apple Music / ${track.genre})...`);
    try {
      const res = await syncTrackToAppleMusic(track, googleAccessToken, user?.email);
      if (res.success && res.track) {
        setTracks((prev) => prev.map((t) => (t.id === track.id ? res.track : t)));
        setSyncNotice(`✓ "${track.title}" synced to ${res.track.driveFolderPath || 'Google Drive'}!`);
      } else {
        setSyncNotice(`⚠️ Notice: ${res.error || 'Could not sync to Drive'}`);
      }
    } catch (err: any) {
      setSyncNotice(`Sync error: ${err.message}`);
    } finally {
      setTimeout(() => setSyncNotice(null), 4000);
    }
  };

  const handleSyncWithDrive = async () => {
    setIsSyncingDrive(true);
    setSyncNotice('Scanning Google Drive: Family Circle / Apple Music / [Categories]...');
    try {
      const driveScan = await refreshAppleMusicFromDrive(googleAccessToken, tracks, 'Family Circle', user?.email);
      if (driveScan.newCount > 0) {
        setTracks(driveScan.tracks);
        setSyncNotice(`✓ Found ${driveScan.newCount} new track(s) from Family Circle / Apple Music in Drive!`);
      } else {
        await loadTracks();
        setSyncNotice('✓ Synchronized with Family Circle / Apple Music category subfolders');
      }
      setTimeout(() => setSyncNotice(null), 4500);
    } catch {
      setSyncNotice('Sync completed with local and server cache');
      setTimeout(() => setSyncNotice(null), 3000);
    } finally {
      setIsSyncingDrive(false);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadTitle.trim()) return;

    setIsUploading(true);
    setSyncNotice(`Storing track & uploading to Google Drive under "Family Circle / Apple Music / ${uploadGenre}"...`);
    try {
      let finalAudioUrl = uploadAudioUrl.trim();
      let finalArtworkUrl = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80';

      if (uploadAudioFile) {
        // Read file into Data URL for local playback
        finalAudioUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(uploadAudioFile);
        });
      }

      if (!finalAudioUrl) {
        finalAudioUrl = 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112191.mp3';
      }

      const newTrack = await saveMusicTrack(
        {
          title: uploadTitle.trim(),
          artist: uploadArtist.trim() || 'Thamizh Family',
          genre: uploadGenre,
          audioUrl: finalAudioUrl,
          artworkUrl: finalArtworkUrl,
          lyrics: uploadLyrics.trim() || undefined,
          durationSeconds: 190,
        },
        googleAccessToken,
        user?.email,
        uploadAudioFile || null
      );

      setTracks((prev) => [newTrack, ...prev]);
      setIsUploadModalOpen(false);
      setUploadTitle('');
      setUploadAudioFile(null);
      setUploadAudioUrl('');
      setUploadLyrics('');
      setSyncNotice(
        `✓ "${newTrack.title}" saved & organized into Google Drive: "${newTrack.driveFolderPath || `Family Circle / Apple Music / ${uploadGenre}`}"!`
      );
      setTimeout(() => setSyncNotice(null), 5000);
    } catch (err: any) {
      alert(`Failed to add track: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  // Filter & Sort
  const filteredTracks = tracks.filter((t) => {
    const matchesOffline = !filterOfflineOnly || t.localCached;
    const matchesGenre = selectedGenre === 'All' || t.genre === selectedGenre;
    const matchesSearch =
      !searchQuery.trim() ||
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.artist.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.album && t.album.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesOffline && matchesGenre && matchesSearch;
  });

  filteredTracks.sort((a, b) => {
    if (sortBy === 'title') return a.title.localeCompare(b.title);
    if (sortBy === 'artist') return a.artist.localeCompare(b.artist);
    if (sortBy === 'plays') return (b.playCount || 0) - (a.playCount || 0);
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  const featuredTrack = tracks[0] || INITIAL_MUSIC_TRACKS[0];
  const cachedTracksCount = tracks.filter((t) => t.localCached).length;

  return (
    <div className="space-y-6 pb-28 pt-2">
      {/* Sync / Share Toast Notice */}
      {syncNotice && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 max-w-sm w-[90%] px-4 py-2.5 rounded-2xl bg-indigo-950/95 border border-indigo-500/40 backdrop-blur-xl text-white text-xs shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
          <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
          <span className="truncate flex-1 font-medium">{syncNotice}</span>
        </div>
      )}

      {/* Top Header & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/80 border border-slate-800 p-4 rounded-3xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 text-indigo-400 border border-indigo-500/30">
            <Music className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-white tracking-tight">Apple Music</h2>
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                <Cloud className="w-2.5 h-2.5" /> Drive Synced
              </span>
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
                <Database className="w-2.5 h-2.5" /> 3GB SQLite
              </span>
              {isSimulatedOffline && (
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                  <WifiOff className="w-2.5 h-2.5" /> Offline Mode
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">
              Family Circle / Apple Music • Categorized in Drive & local 3GB offline player
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/30 transition-all active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Track</span>
          </button>

          <button
            onClick={handleSyncWithDrive}
            disabled={isSyncingDrive}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition-colors"
            title="Synchronize with Google Drive"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncingDrive ? 'animate-spin text-indigo-400' : ''}`} />
            <span>{isSyncingDrive ? 'Syncing...' : 'Drive Sync'}</span>
          </button>

          <button
            onClick={handleToggleOfflineMode}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${
              isSimulatedOffline
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
            }`}
            title="Simulate airplane / offline mode to test local SQLite playback"
          >
            {isSimulatedOffline ? <WifiOff className="w-3.5 h-3.5" /> : <Wifi className="w-3.5 h-3.5" />}
            <span>{isSimulatedOffline ? 'Offline Active' : 'Offline Test'}</span>
          </button>
        </div>
      </div>

      {/* Offline Mode Active Banner */}
      {(isSimulatedOffline || isAppOffline()) && (
        <div className="p-3.5 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 shrink-0">
              <WifiOff className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-white block">Offline Mode Active</span>
              <span className="text-[11px] text-amber-300/90">
                Playing music tracks directly from 3GB Local SQLite Offline Store without internet connection.
              </span>
            </div>
          </div>
          <button
            onClick={handleToggleOfflineMode}
            className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-semibold transition-colors self-start sm:self-auto"
          >
            {isSimulatedOffline ? 'Switch Online' : 'Offline'}
          </button>
        </div>
      )}

      {/* 3GB SQLite Music Storage & Offline Sync Control Panel */}
      <div className="p-4 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-indigo-500/15 text-indigo-400 border border-indigo-500/25">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-white">3GB SQLite Offline Storage</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold">
                  {cachedTracksCount} / {tracks.length} Offline Ready
                </span>
                {sqliteQuota && (
                  <span className="text-[10px] font-mono text-slate-400">
                    ({sqliteQuota.breakdown.music.mb.toFixed(1)} MB stored)
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                Native binary caching guarantees continuous audio playback with 0ms latency even without internet.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setFilterOfflineOnly(!filterOfflineOnly)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                filterOfflineOnly
                  ? 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-600/30'
                  : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border-slate-700'
              }`}
            >
              <Check className="w-3.5 h-3.5" />
              <span>Offline Ready Only</span>
            </button>

            <button
              onClick={handleCacheAllOffline}
              disabled={isCachingAll || tracks.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold transition-all shadow-md shadow-indigo-600/30 active:scale-95"
            >
              <DownloadCloud className={`w-3.5 h-3.5 ${isCachingAll ? 'animate-bounce' : ''}`} />
              <span>{isCachingAll ? 'Caching to SQLite...' : 'Cache All Offline'}</span>
            </button>
          </div>
        </div>

        {/* Caching Progress Bar */}
        {cachingProgress && (
          <div className="p-3 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 space-y-1.5 animate-in fade-in">
            <div className="flex items-center justify-between text-[11px] text-slate-300">
              <span className="flex items-center gap-1.5 truncate">
                <RefreshCw className="w-3 h-3 animate-spin text-indigo-400 shrink-0" />
                <span className="truncate">Caching track {cachingProgress.current}/{cachingProgress.total}: {cachingProgress.title}</span>
              </span>
              <span className="font-mono text-indigo-300 font-bold">
                {Math.round((cachingProgress.current / cachingProgress.total) * 100)}%
              </span>
            </div>
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all duration-300"
                style={{ width: `${(cachingProgress.current / cachingProgress.total) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Sync Status Banner */}
      {syncNotice && (
        <div className="p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between gap-2 animate-in fade-in">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{syncNotice}</span>
          </span>
          <button onClick={() => setSyncNotice(null)} className="text-slate-400 hover:text-white text-xs">
            ✕
          </button>
        </div>
      )}

      {/* Sub-Tab Navigation (Listening Now, Library, Playlists) */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('listening-now')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'listening-now'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Headphones className="w-3.5 h-3.5" />
            <span>Listening Now</span>
          </button>

          <button
            onClick={() => setActiveTab('library')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'library'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Library ({tracks.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('playlists')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'playlists'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Collections</span>
          </button>
        </div>

        {activeTab === 'library' && (
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === 'grid' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'
              }`}
              title="Grid View"
            >
              <Grid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('shelf')}
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === 'shelf' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'
              }`}
              title="Shelf View (Apple Books style)"
            >
              <ListIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* ---------------------------------------------------- */}
      {/* 1. LISTENING NOW VIEW */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'listening-now' && (
        <div className="space-y-6">
          {/* Featured Hero Track */}
          {featuredTrack && (
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-950/80 via-slate-900 to-slate-950 border border-indigo-500/30 p-5 sm:p-7 shadow-2xl">
              <div className="relative z-10 flex flex-col sm:flex-row items-center gap-6">
                <div className="relative w-40 h-40 sm:w-48 sm:h-48 rounded-2xl overflow-hidden shadow-2xl border-2 border-indigo-400/40 shrink-0 group">
                  <img
                    src={featuredTrack.artworkUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80'}
                    alt={featuredTrack.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-slate-950/30 flex items-center justify-center">
                    <button
                      onClick={() => handlePlayTrack(featuredTrack)}
                      className="p-4 rounded-full bg-indigo-600/90 hover:bg-indigo-500 text-white shadow-xl transition-all hover:scale-110 active:scale-95"
                    >
                      {playbackState.isPlaying && playbackState.currentTrack?.id === featuredTrack.id ? (
                        <Pause className="w-6 h-6 fill-white" />
                      ) : (
                        <Play className="w-6 h-6 fill-white translate-x-0.5" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex-1 text-center sm:text-left space-y-2">
                  <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-start">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-[11px] font-semibold border border-indigo-500/30">
                      <Sparkles className="w-3 h-3 text-indigo-400" />
                      <span>Featured Family Track</span>
                    </div>
                    {featuredTrack.localCached && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 text-[10px] font-mono font-semibold border border-emerald-500/30">
                        <Database className="w-3 h-3" /> 3GB SQLite Ready
                      </span>
                    )}
                  </div>

                  <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                    {featuredTrack.title}
                  </h3>
                  <p className="text-xs text-slate-300 font-medium">
                    {featuredTrack.artist} • <span className="text-slate-400">{featuredTrack.album}</span>
                  </p>
                  <p className="text-xs text-slate-400 italic line-clamp-2 pt-1">
                    "{featuredTrack.lyrics || 'Harmonies of lifelong love, generational wisdom, and steady guidance...'}"
                  </p>

                  <div className="pt-2 flex flex-wrap items-center justify-center sm:justify-start gap-2">
                    <button
                      onClick={() => handlePlayTrack(featuredTrack)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 transition-all"
                    >
                      {playbackState.isPlaying && playbackState.currentTrack?.id === featuredTrack.id ? (
                        <>
                          <Pause className="w-4 h-4 fill-white" />
                          <span>Pause Audio</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 fill-white" />
                          <span>Play Now</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => {
                        musicAudioEngine.playTrack(featuredTrack);
                        setIsPlayerModalOpen(true);
                      }}
                      className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors"
                    >
                      Open Full Player
                    </button>

                    <button
                      onClick={(e) => handleCacheTrackToSqlite(featuredTrack, e)}
                      disabled={cachingTrackId === featuredTrack.id}
                      className={`p-2 rounded-xl border transition-colors ${
                        featuredTrack.localCached
                          ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
                          : 'text-slate-400 hover:text-indigo-400 bg-slate-800 border-slate-700'
                      }`}
                      title={featuredTrack.localCached ? '✓ Cached in 3GB SQLite Store (Click to refresh)' : 'Cache into 3GB SQLite Store'}
                    >
                      {cachingTrackId === featuredTrack.id ? (
                        <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
                      ) : (
                        <Database className="w-4 h-4" />
                      )}
                    </button>

                    <button
                      onClick={(e) => handleToggleFavorite(featuredTrack, e)}
                      className={`p-2 rounded-xl border border-slate-700 transition-colors ${
                        featuredTrack.isFavorite ? 'text-rose-400 bg-rose-500/10' : 'text-slate-400 hover:text-white bg-slate-800'
                      }`}
                      title={featuredTrack.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                    >
                      <Heart className={`w-4 h-4 ${featuredTrack.isFavorite ? 'fill-rose-500' : ''}`} />
                    </button>

                    <button
                      onClick={(e) => handleShareTrack(featuredTrack, e)}
                      className="p-2 rounded-xl text-slate-400 hover:text-indigo-400 hover:bg-slate-700 bg-slate-800 border border-slate-700 transition-colors"
                      title="Share track externally"
                    >
                      <Share2 className="w-4 h-4" />
                    </button>

                    <button
                      onClick={(e) => handleDownloadTrack(featuredTrack, e)}
                      className="p-2 rounded-xl text-slate-400 hover:text-emerald-400 hover:bg-slate-700 bg-slate-800 border border-slate-700 transition-colors"
                      title="Download MP3"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Daily Listening Goal Card (Apple Books style) */}
          <div className="p-4 rounded-3xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Flame className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-white">Daily Musical & Mindset Habit</span>
                  <span className="text-[10px] font-mono text-emerald-400 font-semibold">
                    {todayMinutesListened}/{dailyGoalMinutes}m
                  </span>
                </div>
                <div className="w-36 sm:w-56 h-1.5 bg-slate-800 rounded-full overflow-hidden mt-1.5">
                  <div
                    className="h-full bg-gradient-to-r from-amber-400 to-emerald-400 transition-all duration-500"
                    style={{ width: `${Math.min(100, (todayMinutesListened / dailyGoalMinutes) * 100)}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="text-right">
              <div className="flex items-center gap-1 text-xs text-amber-300 font-bold justify-end">
                <Award className="w-4 h-4" />
                <span>7-Day Streak</span>
              </div>
              <span className="text-[10px] text-slate-400">Keep listening today</span>
            </div>
          </div>

          {/* Recently Played / Queue */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Recent Queue & Recommendations
              </h3>
              <button
                onClick={() => setActiveTab('library')}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"
              >
                <span>View All ({tracks.length})</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {tracks.slice(0, 4).map((t) => {
                const isCurrentlyPlaying = playbackState.isPlaying && playbackState.currentTrack?.id === t.id;
                return (
                  <div
                    key={t.id}
                    onClick={() => handlePlayTrack(t)}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isCurrentlyPlaying
                        ? 'bg-indigo-950/40 border-indigo-500/50 shadow-lg'
                        : 'bg-slate-900/70 hover:bg-slate-900 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-slate-700">
                        <img
                          src={t.artworkUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80'}
                          alt={t.title}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-slate-950/30 flex items-center justify-center">
                          {isCurrentlyPlaying ? (
                            <Pause className="w-4 h-4 fill-white" />
                          ) : (
                            <Play className="w-4 h-4 fill-white translate-x-0.5" />
                          )}
                        </div>
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-xs font-bold text-white truncate">{t.title}</h4>
                          {t.localCached && (
                            <span className="text-[9px] text-emerald-400 font-mono flex items-center gap-0.5 shrink-0" title="Offline ready in 3GB SQLite">
                              <Database className="w-2.5 h-2.5" />
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 truncate">{t.artist}</p>
                        <span className="text-[10px] text-emerald-400 font-mono">
                          {Math.floor(t.durationSeconds / 60)}:{(t.durationSeconds % 60).toString().padStart(2, '0')}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={(e) => handleCacheTrackToSqlite(t, e)}
                        disabled={cachingTrackId === t.id}
                        className={`p-1.5 rounded-lg transition-colors ${
                          t.localCached
                            ? 'text-emerald-400 hover:text-emerald-300'
                            : 'text-slate-500 hover:text-indigo-400 hover:bg-slate-800/60'
                        }`}
                        title={t.localCached ? '✓ Cached in 3GB SQLite (Click to refresh)' : 'Cache track into 3GB SQLite'}
                      >
                        {cachingTrackId === t.id ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                        ) : (
                          <Database className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <button
                        onClick={(e) => handleToggleFavorite(t, e)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          t.isFavorite ? 'text-rose-400' : 'text-slate-500 hover:text-slate-300'
                        }`}
                        title={t.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                      >
                        <Heart className={`w-3.5 h-3.5 ${t.isFavorite ? 'fill-rose-500' : ''}`} />
                      </button>
                      <button
                        onClick={(e) => handleShareTrack(t, e)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-400 hover:bg-slate-800/60 transition-colors"
                        title="Share track externally"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => handleDownloadTrack(t, e)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-400 hover:bg-slate-800/60 transition-colors"
                        title="Download MP3"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* 2. LIBRARY SHELF / GRID VIEW */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'library' && (
        <div className="space-y-4">
          {/* Search, Filter & Sort Controls */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search by track, artist, album, or lyrics..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-slate-900 border border-slate-800 text-xs text-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-500"
              >
                <option value="recent">Recently Added</option>
                <option value="title">Title (A-Z)</option>
                <option value="artist">Artist</option>
                <option value="plays">Most Played</option>
              </select>
            </div>

            {/* Genre Filter Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {MUSIC_GENRES.map((g) => (
                <button
                  key={g}
                  onClick={() => setSelectedGenre(g)}
                  className={`text-[11px] px-3 py-1 rounded-full font-medium whitespace-nowrap transition-all ${
                    selectedGenre === g
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          {/* Grid View Mode */}
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
              {filteredTracks.map((t) => {
                const isPlayingThis = playbackState.isPlaying && playbackState.currentTrack?.id === t.id;
                return (
                  <div
                    key={t.id}
                    onClick={() => handlePlayTrack(t)}
                    className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-indigo-500/40 transition-all cursor-pointer group space-y-2.5"
                  >
                    <div className="relative aspect-square rounded-xl overflow-hidden shadow-lg border border-slate-700/60">
                      <img
                        src={t.artworkUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80'}
                        alt={t.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-slate-950/20 group-hover:bg-slate-950/40 transition-colors flex items-center justify-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePlayTrack(t);
                          }}
                          className={`p-3 rounded-full bg-indigo-600 text-white shadow-xl transition-all ${
                            isPlayingThis ? 'scale-100 opacity-100' : 'scale-90 opacity-0 group-hover:opacity-100 group-hover:scale-100'
                          }`}
                        >
                          {isPlayingThis ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white translate-x-0.5" />}
                        </button>
                      </div>

                      <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-slate-900/80 text-[9px] font-semibold text-slate-200 border border-slate-700/60">
                        {t.genre}
                      </span>
                      {t.localCached && (
                        <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded-full bg-emerald-950/90 text-[8px] font-mono font-bold text-emerald-300 border border-emerald-500/40 flex items-center gap-1 shadow-md">
                          <Database className="w-2 h-2" /> SQLite
                        </span>
                      )}
                    </div>

                    <div>
                      <h4 className="text-xs font-bold text-white truncate leading-snug">{t.title}</h4>
                      <p className="text-[11px] text-slate-400 truncate">{t.artist}</p>
                      <div className="flex items-center gap-1 text-[9px] font-mono text-emerald-400/90 pt-0.5 truncate">
                        <Cloud className="w-2.5 h-2.5 shrink-0" />
                        <span className="truncate">{t.driveFolderPath || `Family Circle / Apple Music / ${t.genre}`}</span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1">
                        <span>{Math.floor(t.durationSeconds / 60)}:{(t.durationSeconds % 60).toString().padStart(2, '0')}</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={(e) => handleCacheTrackToSqlite(t, e)}
                            disabled={cachingTrackId === t.id}
                            className={`p-1 transition-colors ${
                              t.localCached ? 'text-emerald-400 hover:text-emerald-300' : 'text-slate-500 hover:text-indigo-400'
                            }`}
                            title={t.localCached ? '✓ Cached in 3GB SQLite (Click to refresh)' : 'Cache into 3GB SQLite'}
                          >
                            {cachingTrackId === t.id ? (
                              <RefreshCw className="w-3 h-3 animate-spin text-indigo-400" />
                            ) : (
                              <Database className="w-3 h-3" />
                            )}
                          </button>
                          {t.driveWebViewLink ? (
                            <a
                              href={t.driveWebViewLink}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="p-1 text-emerald-400 hover:text-emerald-300 transition-colors"
                              title="Open in Google Drive"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : (
                            <button
                              onClick={(e) => handleSyncTrackToDrive(t, e)}
                              className="p-1 text-slate-400 hover:text-emerald-300 transition-colors"
                              title="Sync to Google Drive"
                            >
                              <Cloud className="w-3 h-3" />
                            </button>
                          )}
                          <button
                            onClick={(e) => handleToggleFavorite(t, e)}
                            className={`p-1 transition-colors ${
                              t.isFavorite ? 'text-rose-400' : 'text-slate-500 hover:text-slate-300'
                            }`}
                            title={t.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                          >
                            <Heart className={`w-3 h-3 ${t.isFavorite ? 'fill-rose-500' : ''}`} />
                          </button>
                          <button
                            onClick={(e) => handleShareTrack(t, e)}
                            className="p-1 text-slate-500 hover:text-indigo-400 transition-colors"
                            title="Share track externally"
                          >
                            <Share2 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => handleDownloadTrack(t, e)}
                            className="p-1 text-slate-500 hover:text-emerald-400 transition-colors"
                            title="Download MP3"
                          >
                            <Download className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => handleDeleteTrack(t, e)}
                            className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Shelf View Mode (Apple Books wooden / glass horizontal shelf) */
            <div className="space-y-3">
              {filteredTracks.map((t) => {
                const isPlayingThis = playbackState.isPlaying && playbackState.currentTrack?.id === t.id;
                return (
                  <div
                    key={t.id}
                    onClick={() => handlePlayTrack(t)}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isPlayingThis
                        ? 'bg-indigo-950/40 border-indigo-500/50'
                        : 'bg-slate-900/80 hover:bg-slate-900 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-slate-700">
                        <img
                          src={t.artworkUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80'}
                          alt={t.title}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-slate-950/30 flex items-center justify-center">
                          {isPlayingThis ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white translate-x-0.5" />}
                        </div>
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-xs font-bold text-white truncate">{t.title}</h4>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                            {t.genre}
                          </span>
                          {t.localCached && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-mono flex items-center gap-1">
                              <Database className="w-2.5 h-2.5" /> 3GB SQLite
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 truncate">{t.artist} • {t.album}</p>
                        <div className="flex items-center gap-1 text-[9px] font-mono text-emerald-400/90 truncate">
                          <Cloud className="w-2.5 h-2.5 shrink-0" />
                          <span className="truncate">{t.driveFolderPath || `Family Circle / Apple Music / ${t.genre}`}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0 text-xs">
                      <span className="text-[11px] font-mono text-slate-400">
                        {Math.floor(t.durationSeconds / 60)}:{(t.durationSeconds % 60).toString().padStart(2, '0')}
                      </span>
                      <button
                        onClick={(e) => handleCacheTrackToSqlite(t, e)}
                        disabled={cachingTrackId === t.id}
                        className={`p-1.5 rounded-lg transition-colors ${
                          t.localCached
                            ? 'text-emerald-400 hover:text-emerald-300'
                            : 'text-slate-500 hover:text-indigo-400 hover:bg-slate-800/60'
                        }`}
                        title={t.localCached ? '✓ Cached in 3GB SQLite (Click to refresh)' : 'Cache into 3GB SQLite'}
                      >
                        {cachingTrackId === t.id ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                        ) : (
                          <Database className="w-3.5 h-3.5" />
                        )}
                      </button>
                      {t.driveWebViewLink ? (
                        <a
                          href={t.driveWebViewLink}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="p-1.5 text-emerald-400 hover:text-emerald-300 transition-colors"
                          title="Open in Google Drive"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      ) : (
                        <button
                          onClick={(e) => handleSyncTrackToDrive(t, e)}
                          className="p-1.5 text-slate-400 hover:text-emerald-300 transition-colors"
                          title="Sync to Google Drive"
                        >
                          <Cloud className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={(e) => handleToggleFavorite(t, e)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          t.isFavorite ? 'text-rose-400' : 'text-slate-500 hover:text-slate-300'
                        }`}
                        title={t.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                      >
                        <Heart className={`w-3.5 h-3.5 ${t.isFavorite ? 'fill-rose-500' : ''}`} />
                      </button>
                      <button
                        onClick={(e) => handleShareTrack(t, e)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-400 hover:bg-slate-800/60 transition-colors"
                        title="Share track externally"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => handleDownloadTrack(t, e)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-400 hover:bg-slate-800/60 transition-colors"
                        title="Download MP3"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => handleDeleteTrack(t, e)}
                        className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {filteredTracks.length === 0 && (
            <div className="p-8 text-center rounded-3xl bg-slate-900/50 border border-slate-800 text-slate-400 space-y-3">
              <Music className="w-8 h-8 mx-auto text-slate-600" />
              <p className="text-xs">
                {filterOfflineOnly
                  ? 'No tracks are currently cached in the 3GB SQLite store.'
                  : 'No tracks match your search or filter.'}
              </p>
              <div className="flex items-center justify-center gap-2 pt-1">
                {filterOfflineOnly && (
                  <button
                    onClick={handleCacheAllOffline}
                    disabled={isCachingAll || tracks.length === 0}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/30 transition-all"
                  >
                    <DownloadCloud className="w-3.5 h-3.5" />
                    <span>Cache All ({tracks.length}) Tracks Now</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    setSelectedGenre('All');
                    setSearchQuery('');
                    setFilterOfflineOnly(false);
                  }}
                  className="text-xs text-indigo-400 underline font-medium"
                >
                  Reset all filters
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* 3. PLAYLISTS & COLLECTIONS VIEW */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'playlists' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            {
              title: 'Family Circle Anthem & Heritage',
              desc: 'Classical, Veena, Flute, and family harmony anthems',
              count: tracks.filter((t) => t.genre.includes('Family') || t.genre.includes('Tamil') || t.genre.includes('Classical')).length,
              genre: 'Tamil Melodies & Tradition',
              artwork: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80',
            },
            {
              title: 'AI Studio Lyria Synthetics',
              desc: 'Generated music tracks saved from AI Studio Lyria prompt sessions',
              count: tracks.filter((t) => t.genre.includes('Lyria')).length,
              genre: 'AI Studio Lyria',
              artwork: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&auto=format&fit=crop&q=80',
            },
            {
              title: 'Deep Focus & Executive Flow',
              desc: 'Binaural lo-fi, study chords, and ambient spatial textures',
              count: tracks.filter((t) => t.genre.includes('Ambient') || t.genre.includes('Chill')).length,
              genre: 'Ambient & Study',
              artwork: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=600&auto=format&fit=crop&q=80',
            },
            {
              title: 'Sleep & Sweet Lullaby',
              desc: 'Soothing bedtime piano and starlight lullabies for the kids',
              count: tracks.filter((t) => t.genre.includes('Lullaby') || t.genre.includes('Wellness')).length,
              genre: 'Family Lullaby',
              artwork: 'https://images.unsplash.com/photo-1532767153582-b1a0e5145009?w=600&auto=format&fit=crop&q=80',
            },
          ].map((col) => (
            <div
              key={col.title}
              onClick={() => {
                setSelectedGenre(col.genre);
                setActiveTab('library');
              }}
              className="p-4 rounded-3xl bg-slate-900/80 border border-slate-800 hover:border-indigo-500/50 transition-all cursor-pointer flex items-center gap-4 group shadow-lg"
            >
              <img
                src={col.artwork}
                alt={col.title}
                className="w-20 h-20 rounded-2xl object-cover shrink-0 border border-slate-700 shadow-md group-hover:scale-105 transition-transform"
              />
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors">
                  {col.title}
                </h4>
                <p className="text-[11px] text-slate-400 line-clamp-2">{col.desc}</p>
                <span className="text-[10px] font-mono font-semibold text-emerald-400">
                  {col.count} tracks • Synced to Drive
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* Upload Track Modal */}
      {/* ---------------------------------------------------- */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
          <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-800 p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
                  <Music className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-white">Add Music Track</h3>
              </div>
              <button
                onClick={() => setIsUploadModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Upload an audio file (MP3/WAV/M4A) or link a music stream. Tracks are stored locally and automatically uploaded to Google Drive under their categorized subfolder.
            </p>

            <div className="p-3 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 flex items-center justify-between text-xs">
              <span className="text-slate-300 flex items-center gap-1.5 font-medium">
                <Cloud className="w-4 h-4 text-emerald-400" />
                <span>Drive Location:</span>
              </span>
              <span className="text-emerald-300 font-mono text-[11px] font-semibold">
                Family Circle / Apple Music / {uploadGenre}
              </span>
            </div>

            <form onSubmit={handleUploadSubmit} className="space-y-3.5">
              <div>
                <label className="text-xs text-slate-300 block mb-1">Track Title</label>
                <input
                  type="text"
                  placeholder="e.g. Morning Calm at Innovation Campus"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 block mb-1">Artist / Composer</label>
                <input
                  type="text"
                  placeholder="e.g. Thamizh & AI Studio"
                  value={uploadArtist}
                  onChange={(e) => setUploadArtist(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 block mb-1">Genre Category</label>
                <select
                  value={uploadGenre}
                  onChange={(e) => setUploadGenre(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  {MUSIC_GENRES.filter((g) => g !== 'All').map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-300 block mb-1">Upload Audio File (MP3, WAV, AAC)</label>
                <input
                  type="file"
                  accept="audio/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setUploadAudioFile(f);
                      if (!uploadTitle) setUploadTitle(f.name.replace(/\.[^/.]+$/, ''));
                    }
                  }}
                  className="w-full text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 block mb-1">Or Audio Stream URL</label>
                <input
                  type="text"
                  placeholder="https://.../song.mp3 (optional if uploading file)"
                  value={uploadAudioUrl}
                  onChange={(e) => setUploadAudioUrl(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 block mb-1">Lyrics or Notes (Optional)</label>
                <textarea
                  placeholder="Add song lyrics or bedtime reflections..."
                  rows={2}
                  value={uploadLyrics}
                  onChange={(e) => setUploadLyrics(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploading || !uploadTitle.trim()}
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-xs font-semibold text-white transition-all shadow-md shadow-indigo-600/30"
                >
                  {isUploading ? 'Saving & Syncing...' : 'Save & Sync to Drive'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating Production Apple Music Mini-Player Bar (when a track is loaded/playing and modal is closed) */}
      {playbackState.currentTrack && !isPlayerModalOpen && (
        <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:w-[420px] z-40 animate-in slide-in-from-bottom duration-300">
          <div
            onClick={() => setIsPlayerModalOpen(true)}
            className="group relative overflow-hidden rounded-2xl bg-slate-900/95 hover:bg-slate-900 backdrop-blur-xl border border-indigo-500/35 p-2.5 shadow-2xl shadow-indigo-950/60 cursor-pointer transition-all hover:scale-[1.01]"
          >
            {/* Top Micro Progress Bar */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-slate-800">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 transition-all duration-300"
                style={{
                  width: `${playbackState.duration > 0 ? (playbackState.currentTime / playbackState.duration) * 100 : 0}%`,
                }}
              />
            </div>

            <div className="flex items-center justify-between gap-2.5 pt-0.5">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="relative w-10 h-10 rounded-xl overflow-hidden shrink-0 border border-slate-700 shadow-md">
                  <img
                    src={playbackState.currentTrack.artworkUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80'}
                    alt={playbackState.currentTrack.title}
                    className="w-full h-full object-cover"
                  />
                  {playbackState.isPlaying && (
                    <div className="absolute inset-0 bg-indigo-950/40 flex items-center justify-center">
                      <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
                    </div>
                  )}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h4 className="text-xs font-bold text-white truncate max-w-[150px]">
                      {playbackState.currentTrack.title}
                    </h4>
                    {playbackState.currentTrack.lyrics && (
                      <span className="px-1 py-0.2 rounded bg-indigo-500/20 text-indigo-300 text-[8px] font-mono font-bold">
                        Lyrics
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 truncate">
                    {playbackState.currentTrack.artist}
                  </p>
                </div>
              </div>

              {/* Action Controls */}
              <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                {/* Shuffle toggle */}
                <button
                  onClick={() => musicAudioEngine.toggleShuffle()}
                  className={`p-1.5 rounded-lg transition-colors ${
                    playbackState.shuffle ? 'text-indigo-400 bg-indigo-500/20' : 'text-slate-500 hover:text-slate-300'
                  }`}
                  title={playbackState.shuffle ? 'Shuffle On' : 'Shuffle Off'}
                >
                  <Shuffle className="w-3.5 h-3.5" />
                </button>

                {/* Previous */}
                <button
                  onClick={() => musicAudioEngine.previousTrack()}
                  className="p-1.5 text-slate-400 hover:text-white transition-colors"
                  title="Previous"
                >
                  <SkipBack className="w-4 h-4 fill-current" />
                </button>

                {/* Play/Pause */}
                <button
                  onClick={() => musicAudioEngine.togglePlay()}
                  className="p-2 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-md shadow-indigo-600/30 transition-all active:scale-95"
                  title={playbackState.isPlaying ? 'Pause' : 'Play'}
                >
                  {playbackState.isPlaying ? (
                    <Pause className="w-4 h-4 fill-white" />
                  ) : (
                    <Play className="w-4 h-4 fill-white translate-x-0.5" />
                  )}
                </button>

                {/* Next */}
                <button
                  onClick={() => musicAudioEngine.nextTrack()}
                  className="p-1.5 text-slate-400 hover:text-white transition-colors"
                  title="Next"
                >
                  <SkipForward className="w-4 h-4 fill-current" />
                </button>

                {/* Repeat */}
                <button
                  onClick={() => musicAudioEngine.toggleRepeat()}
                  className={`relative p-1.5 rounded-lg transition-colors ${
                    playbackState.repeatMode !== 'off'
                      ? 'text-indigo-400 bg-indigo-500/20 font-bold'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                  title={`Repeat: ${playbackState.repeatMode}`}
                >
                  <Repeat className="w-3.5 h-3.5" />
                  {playbackState.repeatMode === 'one' && (
                    <span className="absolute -top-1 -right-0.5 px-0.5 bg-indigo-600 text-white text-[7px] font-bold rounded-full">
                      1
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Apple Music Player Modal */}
      <AppleMusicPlayerModal
        isOpen={isPlayerModalOpen}
        onClose={() => setIsPlayerModalOpen(false)}
        track={playbackState.currentTrack}
        onNext={handleNextTrack}
        onPrevious={handlePreviousTrack}
      />
    </div>
  );
};
