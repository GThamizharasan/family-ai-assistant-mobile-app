import React, { useEffect, useRef, useState } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Repeat,
  Shuffle,
  Clock,
  Heart,
  ChevronDown,
  Cloud,
  CheckCircle2,
  Share2,
  Download,
  ExternalLink,
  Sparkles,
  Sliders,
  AlignLeft,
  X,
  Radio,
  Database,
} from 'lucide-react';
import { MusicTrack, AudioPlaybackState, EqualizerPreset } from '../../types/music';
import { musicAudioEngine } from '../../services/musicAudioEngine';
import { toggleTrackFavorite, saveMusicTrack, downloadTrackAudio } from '../../services/musicLibraryService';
import { AppleMusicLyricsView } from './AppleMusicLyricsView';

interface AppleMusicPlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  track?: MusicTrack | null;
  onNext?: () => void;
  onPrevious?: () => void;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export const AppleMusicPlayerModal: React.FC<AppleMusicPlayerModalProps> = ({
  isOpen,
  onClose,
  track,
  onNext,
  onPrevious,
}) => {
  const [playbackState, setPlaybackState] = useState<AudioPlaybackState>(musicAudioEngine.getState());
  const activeTrack = track || playbackState.currentTrack;
  const [showLyrics, setShowLyrics] = useState(false);
  const [showTimerMenu, setShowTimerMenu] = useState(false);
  const [showEqMenu, setShowEqMenu] = useState(false);
  const [isFavorite, setIsFavorite] = useState(activeTrack?.isFavorite || false);
  const [shareNotice, setShareNotice] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const unsub = musicAudioEngine.subscribe((s) => {
      setPlaybackState(s);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (activeTrack) {
      setIsFavorite(activeTrack.isFavorite);
    }
  }, [activeTrack]);

  // Real-Time Canvas Waveform Visualizer
  useEffect(() => {
    if (!isOpen) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const renderWaveform = () => {
      const data = musicAudioEngine.getVisualizerData();
      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);

      const barCount = 32;
      const barWidth = (width / barCount) - 3;
      const step = Math.floor(data.length / barCount) || 1;

      for (let i = 0; i < barCount; i++) {
        const val = data[i * step] || 0;
        const barHeight = playbackState.isPlaying ? Math.max(4, (val / 255) * height * 0.9) : 4;
        const x = i * (barWidth + 3);
        const y = height - barHeight;

        const grad = ctx.createLinearGradient(0, y, 0, height);
        grad.addColorStop(0, '#a855f7'); // Purple / Neon Violet
        grad.addColorStop(0.5, '#ec4899'); // Pink
        grad.addColorStop(1, '#6366f1'); // Indigo

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 3);
        ctx.fill();
      }

      animFrameRef.current = requestAnimationFrame(renderWaveform);
    };

    renderWaveform();

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isOpen, playbackState.isPlaying]);

  if (!isOpen || !activeTrack) return null;

  const handleTogglePlay = () => {
    musicAudioEngine.togglePlay();
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    musicAudioEngine.seek(time);
  };

  const handleToggleFavorite = async () => {
    const next = !isFavorite;
    setIsFavorite(next);
    await toggleTrackFavorite(activeTrack.id, next);
  };

  const handleShareTrack = async () => {
    if (!activeTrack) return;
    const shareUrl = activeTrack.driveWebViewLink || activeTrack.audioUrl || window.location.href;
    const shareText = `🎵 ${activeTrack.title} by ${activeTrack.artist}${activeTrack.album ? ` (${activeTrack.album})` : ''} • Apple Music`;

    const shareData = {
      title: activeTrack.title,
      text: shareText,
      url: shareUrl,
    };

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share(shareData);
        setShareNotice(`✓ Shared "${activeTrack.title}"!`);
        setTimeout(() => setShareNotice(null), 3500);
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
        setShareNotice(`✓ Link copied to clipboard!`);
        setTimeout(() => setShareNotice(null), 3500);
        return;
      }
    } catch (clipErr) {
      console.warn('Clipboard write failed:', clipErr);
    }

    if (shareUrl && shareUrl !== window.location.href) {
      window.open(shareUrl, '_blank');
    }
  };

  const handleDownloadTrack = async () => {
    if (!activeTrack) return;
    setShareNotice(`Downloading "${activeTrack.title}"...`);
    const res = await downloadTrackAudio(activeTrack);
    if (res.success) {
      setShareNotice(`✓ Downloaded "${activeTrack.title}"!`);
    } else {
      setShareNotice(`⚠️ ${res.error || 'Download failed'}`);
    }
    setTimeout(() => setShareNotice(null), 3500);
  };

  const handleNext = () => {
    if (onNext) {
      onNext();
    } else {
      musicAudioEngine.nextTrack();
    }
  };

  const handlePrevious = () => {
    if (onPrevious) {
      onPrevious();
    } else {
      musicAudioEngine.previousTrack();
    }
  };

  const handleSaveLyrics = async (newLyrics: string) => {
    activeTrack.lyrics = newLyrics;
    try {
      await saveMusicTrack(activeTrack, null, activeTrack.userEmail);
    } catch (e) {
      console.warn('Failed to save updated lyrics:', e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-2xl transition-all animate-in fade-in duration-200">
      {/* Background ambient album artwork glow */}
      <div
        className="absolute inset-0 opacity-25 filter blur-3xl pointer-events-none scale-125"
        style={{
          backgroundImage: `url(${activeTrack.artworkUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80'})`,
          backgroundPosition: 'center',
          backgroundSize: 'cover',
        }}
      />

      <div className="relative w-full max-w-md bg-gradient-to-b from-slate-900/95 via-slate-900/90 to-slate-950/95 border border-slate-800/80 rounded-[36px] shadow-2xl p-5 sm:p-7 flex flex-col justify-between max-h-[92vh] overflow-y-auto">
        {/* Top Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800/60">
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-slate-800/60 hover:bg-slate-700/80 text-slate-300 hover:text-white transition-colors"
            title="Minimize Player"
          >
            <ChevronDown className="w-5 h-5" />
          </button>

          <div className="text-center">
            <span className="text-[10px] font-bold tracking-widest text-indigo-400 uppercase">
              Apple Music • Family Circle
            </span>
            <div className="text-xs font-medium text-slate-300 truncate max-w-[200px]">
              {activeTrack.album || 'Family Music Collection'}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleToggleFavorite}
              className={`p-2 rounded-full transition-colors ${
                isFavorite
                  ? 'text-rose-400 bg-rose-500/15'
                  : 'text-slate-400 hover:text-white bg-slate-800/60'
              }`}
              title="Favorite Track"
            >
              <Heart className={`w-4 h-4 ${isFavorite ? 'fill-rose-500' : ''}`} />
            </button>
            <button
              onClick={handleShareTrack}
              className="p-2 rounded-full text-slate-400 hover:text-indigo-300 hover:bg-slate-800/80 bg-slate-800/60 transition-colors"
              title="Share Track Externally"
            >
              <Share2 className="w-4 h-4" />
            </button>
            <button
              onClick={handleDownloadTrack}
              className="p-2 rounded-full text-slate-400 hover:text-emerald-300 hover:bg-slate-800/80 bg-slate-800/60 transition-colors"
              title="Download Track (MP3)"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Share Feedback Toast */}
        {shareNotice && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 px-3.5 py-1.5 rounded-full bg-indigo-600/95 text-white text-xs font-medium shadow-xl backdrop-blur-md flex items-center gap-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{shareNotice}</span>
          </div>
        )}

        {/* Center: Album Artwork or Lyrics View */}
        <div className="py-4 my-auto">
          {!showLyrics ? (
            <div className="flex flex-col items-center">
              <div className="relative w-64 h-64 sm:w-72 sm:h-72 rounded-3xl overflow-hidden shadow-2xl border border-slate-700/60 group">
                <img
                  src={activeTrack.artworkUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80'}
                  alt={activeTrack.title}
                  className={`w-full h-full object-cover transition-transform duration-700 ${
                    playbackState.isPlaying ? 'scale-105' : 'scale-100'
                  }`}
                />

                {/* Vinyl Ring Overlay Accent */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent pointer-events-none" />

                {/* Genre Pill */}
                <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-slate-900/80 backdrop-blur-md text-[10px] font-semibold text-slate-200 border border-slate-700/60">
                  {activeTrack.genre}
                </span>

                {/* Drive Path & Offline Status Badge */}
                <div className="absolute bottom-3 left-3 right-3 px-3 py-1.5 rounded-xl bg-slate-900/85 backdrop-blur-md border border-slate-700/60 flex items-center justify-between text-[10px]">
                  <span className="flex items-center gap-1.5 text-emerald-300 font-medium">
                    {activeTrack.localCached ? (
                      <>
                        <Database className="w-3.5 h-3.5 text-emerald-400" />
                        <span>3GB Offline Ready</span>
                      </>
                    ) : (
                      <>
                        <Cloud className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Family Circle Drive</span>
                      </>
                    )}
                  </span>
                  <span className="text-slate-400 font-mono text-[9px] truncate max-w-[130px]">
                    {activeTrack.driveFolderPath || 'Family Circle / Apple Music'}
                  </span>
                </div>
              </div>

              {/* Dynamic Waveform Visualizer */}
              <div className="w-full mt-4 flex justify-center">
                <canvas
                  ref={canvasRef}
                  width={260}
                  height={32}
                  className="rounded-lg opacity-90"
                />
              </div>
            </div>
          ) : (
            /* Apple Music Grade Interactive Line-by-Line Synchronized Lyrics & Reflection */
            <AppleMusicLyricsView
              track={activeTrack}
              currentTime={playbackState.currentTime}
              duration={playbackState.duration || activeTrack.durationSeconds || 180}
              isPlaying={playbackState.isPlaying}
              onSeek={(time) => musicAudioEngine.seek(time)}
              onSaveLyrics={handleSaveLyrics}
            />
          )}
        </div>

        {/* Track Title, Artist & Controls */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="pr-2">
              <h3 className="text-lg font-bold text-white tracking-tight leading-tight line-clamp-1">
                {activeTrack.title}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{activeTrack.artist}</p>
            </div>

            <button
              onClick={() => setShowLyrics(!showLyrics)}
              className={`p-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                showLyrics
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-600/30'
                  : 'bg-slate-800/70 hover:bg-slate-700 text-slate-300'
              }`}
              title="Toggle Synchronized Lyrics & Reflections"
            >
              <AlignLeft className="w-4 h-4" />
              <span className="text-[11px] font-semibold">{showLyrics ? 'Artwork' : 'Lyrics'}</span>
            </button>
          </div>

          {/* Progress Bar & Timestamps */}
          <div className="space-y-1">
            <input
              type="range"
              min={0}
              max={playbackState.duration || 180}
              value={playbackState.currentTime}
              onChange={handleSeek}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 focus:outline-none"
            />
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
              <span>{formatTime(playbackState.currentTime)}</span>
              <span>{formatTime(playbackState.duration || activeTrack.durationSeconds || 180)}</span>
            </div>
          </div>

          {/* Core Player Actions: Shuffle, Prev, Play/Pause, Next, Repeat */}
          <div className="flex items-center justify-between px-2">
            {/* Shuffle Button */}
            <button
              onClick={() => musicAudioEngine.toggleShuffle()}
              className={`relative p-2.5 rounded-full transition-all active:scale-95 ${
                playbackState.shuffle
                  ? 'text-indigo-400 bg-indigo-500/20 shadow-lg shadow-indigo-500/20 font-bold'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
              title={playbackState.shuffle ? 'Shuffle On (Active)' : 'Shuffle Off'}
            >
              <Shuffle className="w-4 h-4" />
              {playbackState.shuffle && (
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-indigo-400 rounded-full shadow-sm" />
              )}
            </button>

            {/* Previous Track */}
            <button
              onClick={handlePrevious}
              className="p-3 rounded-full hover:bg-slate-800/80 text-slate-300 hover:text-white transition-all active:scale-90"
              title="Previous Track / Back to Start"
            >
              <SkipBack className="w-6 h-6 fill-current" />
            </button>

            {/* Large Play/Pause Button */}
            <button
              onClick={handleTogglePlay}
              className="p-5 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-xl shadow-indigo-600/30 transition-all hover:scale-105 active:scale-95"
              title={playbackState.isPlaying ? 'Pause' : 'Play'}
            >
              {playbackState.isPlaying ? (
                <Pause className="w-7 h-7 fill-white" />
              ) : (
                <Play className="w-7 h-7 fill-white translate-x-0.5" />
              )}
            </button>

            {/* Next Track */}
            <button
              onClick={handleNext}
              className="p-3 rounded-full hover:bg-slate-800/80 text-slate-300 hover:text-white transition-all active:scale-90"
              title="Next Track"
            >
              <SkipForward className="w-6 h-6 fill-current" />
            </button>

            {/* Repeat Button (Off / All / One) */}
            <button
              onClick={() => musicAudioEngine.toggleRepeat()}
              className={`relative p-2.5 rounded-full transition-all active:scale-95 ${
                playbackState.repeatMode !== 'off'
                  ? 'text-indigo-400 bg-indigo-500/20 shadow-lg shadow-indigo-500/20 font-bold'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
              title={
                playbackState.repeatMode === 'one'
                  ? 'Repeat: Current Track (One)'
                  : playbackState.repeatMode === 'all'
                  ? 'Repeat: All Tracks (Looping)'
                  : 'Repeat: Off'
              }
            >
              <Repeat className="w-4 h-4" />
              {playbackState.repeatMode === 'one' && (
                <span className="absolute -top-1 -right-1 px-1 bg-indigo-600 text-white text-[8px] font-extrabold rounded-full border border-indigo-400 shadow-sm leading-tight">
                  1
                </span>
              )}
              {playbackState.repeatMode === 'all' && (
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-indigo-400 rounded-full shadow-sm" />
              )}
            </button>
          </div>

          {/* Bottom Utility Controls: Equalizer, Speed, Sleep Timer, Volume */}
          <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-400 gap-2">
            {/* Equalizer Presets */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowEqMenu(!showEqMenu);
                  setShowTimerMenu(false);
                }}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-medium transition-colors ${
                  playbackState.equalizerPreset && playbackState.equalizerPreset !== 'lossless'
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                    : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
                title="Studio Equalizer (Lossless, Bass Boost, Vocal, etc.)"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span className="capitalize">{playbackState.equalizerPreset || 'Hi-Fi'}</span>
              </button>

              {showEqMenu && (
                <div className="absolute left-0 bottom-full mb-2 w-44 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-1 z-30 space-y-0.5">
                  <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase">
                    Studio Equalizer
                  </div>
                  {[
                    { id: 'lossless', label: 'Lossless Hi-Fi (Flat)' },
                    { id: 'bass_boost', label: 'Bass Boost (+6dB)' },
                    { id: 'vocal', label: 'Vocal Clarity (+5dB)' },
                    { id: 'acoustic', label: 'Acoustic Warmth' },
                    { id: 'ambient', label: 'Ambient & Restorative' },
                  ].map((eq) => (
                    <button
                      key={eq.id}
                      onClick={() => {
                        musicAudioEngine.setEqualizerPreset(eq.id as EqualizerPreset);
                        setShowEqMenu(false);
                      }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors flex items-center justify-between ${
                        playbackState.equalizerPreset === eq.id
                          ? 'bg-indigo-600 text-white font-bold'
                          : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <span>{eq.label}</span>
                      {playbackState.equalizerPreset === eq.id && <CheckCircle2 className="w-3 h-3 text-white" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Playback Speed */}
            <div className="flex items-center gap-0.5">
              {[0.75, 1.0, 1.25, 1.5].map((rate) => (
                <button
                  key={rate}
                  onClick={() => musicAudioEngine.setPlaybackRate(rate)}
                  className={`px-1.5 py-0.5 rounded-lg text-[10px] font-semibold transition-colors ${
                    playbackState.playbackRate === rate
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {rate}x
                </button>
              ))}
            </div>

            {/* Sleep Timer */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowTimerMenu(!showTimerMenu);
                  setShowEqMenu(false);
                }}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-medium transition-colors ${
                  playbackState.sleepTimerMinutes
                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                    : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>
                  {playbackState.sleepTimerRemainingSeconds
                    ? `${Math.ceil(playbackState.sleepTimerRemainingSeconds / 60)}m`
                    : 'Timer'}
                </span>
              </button>

              {showTimerMenu && (
                <div className="absolute right-0 bottom-full mb-2 w-36 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-1 z-30 space-y-0.5">
                  <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase">Sleep Timer</div>
                  {[15, 30, 45, 60].map((mins) => (
                    <button
                      key={mins}
                      onClick={() => {
                        musicAudioEngine.setSleepTimer(mins);
                        setShowTimerMenu(false);
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-slate-200 hover:bg-indigo-600 hover:text-white transition-colors"
                    >
                      {mins} minutes
                    </button>
                  ))}
                  {playbackState.sleepTimerMinutes && (
                    <button
                      onClick={() => {
                        musicAudioEngine.setSleepTimer(null);
                        setShowTimerMenu(false);
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-rose-400 hover:bg-rose-500/20 transition-colors"
                    >
                      Turn Off Timer
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Volume Slider */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => musicAudioEngine.toggleMute()}
                className="text-slate-400 hover:text-slate-200 transition-colors"
              >
                {playbackState.isMuted || playbackState.volume === 0 ? (
                  <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                ) : (
                  <Volume2 className="w-3.5 h-3.5" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={playbackState.isMuted ? 0 : playbackState.volume}
                onChange={(e) => musicAudioEngine.setVolume(Number(e.target.value))}
                className="w-14 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
