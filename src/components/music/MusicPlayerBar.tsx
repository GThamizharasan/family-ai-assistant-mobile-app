import React, { useEffect, useState } from 'react';
import { Play, Pause, SkipForward, Maximize2, Music, Cloud } from 'lucide-react';
import { MusicTrack, AudioPlaybackState } from '../../types/music';
import { musicAudioEngine } from '../../services/musicAudioEngine';

interface MusicPlayerBarProps {
  onOpenFullPlayer: () => void;
  onNext?: () => void;
}

export const MusicPlayerBar: React.FC<MusicPlayerBarProps> = ({ onOpenFullPlayer, onNext }) => {
  const [playbackState, setPlaybackState] = useState<AudioPlaybackState>(musicAudioEngine.getState());

  useEffect(() => {
    const unsub = musicAudioEngine.subscribe((s) => {
      setPlaybackState(s);
    });
    return unsub;
  }, []);

  const track = playbackState.currentTrack;
  if (!track) return null;

  const progressPercent =
    playbackState.duration > 0 ? (playbackState.currentTime / playbackState.duration) * 100 : 0;

  return (
    <div className="fixed bottom-20 left-0 right-0 z-40 px-3 sm:px-6 pointer-events-none">
      <div className="max-w-md mx-auto pointer-events-auto">
        <div className="relative overflow-hidden rounded-2xl bg-slate-900/95 backdrop-blur-xl border border-indigo-500/30 shadow-2xl p-2.5 flex items-center justify-between gap-3 group transition-all hover:border-indigo-500/60">
          {/* Progress thin bar at top of player card */}
          <div
            className="absolute top-0 left-0 h-0.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />

          {/* Left: Thumbnail & Title (Tapping expands to full modal) */}
          <button
            onClick={onOpenFullPlayer}
            className="flex items-center gap-2.5 min-w-0 text-left flex-1 group"
          >
            <div className="relative w-10 h-10 rounded-xl overflow-hidden shrink-0 border border-slate-700/80 shadow-md">
              <img
                src={track.artworkUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80'}
                alt={track.title}
                className="w-full h-full object-cover"
              />
              {playbackState.isPlaying && (
                <div className="absolute inset-0 bg-slate-950/40 flex items-center justify-center">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-white truncate">{track.title}</span>
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-medium shrink-0">
                  {track.genre}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-slate-400 truncate">
                <span>{track.artist}</span>
                <span>•</span>
                <span className="text-emerald-400 font-mono text-[9px] flex items-center gap-0.5">
                  <Cloud className="w-2.5 h-2.5" /> Drive
                </span>
              </div>
            </div>
          </button>

          {/* Right Controls */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => musicAudioEngine.togglePlay()}
              className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30 transition-all active:scale-90"
              title={playbackState.isPlaying ? 'Pause' : 'Play'}
            >
              {playbackState.isPlaying ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white translate-x-0.5" />}
            </button>

            {onNext && (
              <button
                onClick={onNext}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title="Next Track"
              >
                <SkipForward className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={onOpenFullPlayer}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Expand Fullscreen Player"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
