import React, { useState, useEffect, useRef } from 'react';
import {
  AlignLeft,
  Sparkles,
  Heart,
  Edit3,
  Check,
  RotateCcw,
  BookOpen,
  Volume2,
  Clock,
  Compass,
  Smile,
  Shield,
  Zap,
} from 'lucide-react';
import { MusicTrack } from '../../types/music';

export interface LyricLine {
  id: string;
  time: number; // In seconds
  text: string;
  reflectionNote?: string;
}

interface AppleMusicLyricsViewProps {
  track: MusicTrack;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  onSeek: (seconds: number) => void;
  onSaveLyrics?: (newLyrics: string) => Promise<void> | void;
}

export function parseLyricsIntoLines(rawLyrics: string | undefined, duration: number): LyricLine[] {
  const safeDuration = duration > 0 ? duration : 180;
  if (!rawLyrics || !rawLyrics.trim()) {
    // Generate sovereign default inspiring family reflection lines
    const defaultLines = [
      'Harmonies of lifelong love, generational wisdom, and steady guidance.',
      'Walking forward with clear vision, protecting and uplifting family together.',
      'Deep roots of culture, boundless courage for infinite tomorrow.',
      'Rest in peace, wake with purpose, lead with empathy and strength.',
      'Sovereign legacy that echoes across generations.',
    ];
    const step = (safeDuration - 12) / defaultLines.length;
    return defaultLines.map((text, idx) => ({
      id: `line-${idx}`,
      time: Math.round(4 + idx * step),
      text,
    }));
  }

  const rawLines = rawLyrics.split('\n').map((l) => l.trim()).filter(Boolean);
  const timestampRegex = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]\s*(.*)/;
  const hasTimestamps = rawLines.some((l) => timestampRegex.test(l));

  if (hasTimestamps) {
    const parsed: LyricLine[] = [];
    rawLines.forEach((l, idx) => {
      const match = l.match(timestampRegex);
      if (match) {
        const mins = parseInt(match[1], 10);
        const secs = parseInt(match[2], 10);
        const ms = match[3] ? parseInt(match[3].padEnd(3, '0').slice(0, 3), 10) / 1000 : 0;
        const time = mins * 60 + secs + ms;
        const text = match[4].trim();
        if (text) {
          parsed.push({
            id: `line-ts-${idx}-${time}`,
            time,
            text,
          });
        }
      } else if (l.trim()) {
        const prevTime = parsed.length > 0 ? parsed[parsed.length - 1].time + 5 : 5;
        parsed.push({
          id: `line-fallback-${idx}`,
          time: prevTime,
          text: l.trim(),
        });
      }
    });
    return parsed.sort((a, b) => a.time - b.time);
  }

  // If plain text (multi-line or sentences): intelligently split into lines and distribute across duration
  let textLines = rawLines;
  if (textLines.length === 1 && textLines[0].includes('.')) {
    textLines = textLines[0].split(/[.!?]+/).map((s) => s.trim()).filter((s) => s.length > 3);
  }

  if (textLines.length === 0) {
    return [{ id: 'line-0', time: 5, text: rawLyrics.trim() }];
  }

  const leadIn = 4;
  const usableDuration = Math.max(10, safeDuration - 10);
  const step = usableDuration / textLines.length;

  return textLines.map((text, idx) => ({
    id: `line-dist-${idx}`,
    time: Math.round(leadIn + idx * step),
    text,
  }));
}

export const AppleMusicLyricsView: React.FC<AppleMusicLyricsViewProps> = ({
  track,
  currentTime,
  duration,
  isPlaying,
  onSeek,
  onSaveLyrics,
}) => {
  const [activeTab, setActiveTab] = useState<'lyrics' | 'reflection'>('lyrics');
  const [isEditing, setIsEditing] = useState(false);
  const [lyricsDraft, setLyricsDraft] = useState(track.lyrics || '');
  const [isSaving, setIsSaving] = useState(false);
  const [userIsScrolling, setUserIsScrolling] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const activeLineRef = useRef<HTMLDivElement | null>(null);
  const userScrollTimeoutRef = useRef<number | null>(null);

  const lines = parseLyricsIntoLines(track.lyrics, duration);

  // Determine active lyric line index
  let activeIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (currentTime >= lines[i].time) {
      activeIndex = i;
    } else {
      break;
    }
  }

  // Smooth auto-scroll to keep active line centered
  useEffect(() => {
    if (userIsScrolling || activeTab !== 'lyrics') return;
    if (activeLineRef.current && containerRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeIndex, userIsScrolling, activeTab]);

  const handleContainerScroll = () => {
    setUserIsScrolling(true);
    if (userScrollTimeoutRef.current) {
      window.clearTimeout(userScrollTimeoutRef.current);
    }
    userScrollTimeoutRef.current = window.setTimeout(() => {
      setUserIsScrolling(false);
    }, 3500);
  };

  const handleSaveLyrics = async () => {
    setIsSaving(true);
    try {
      if (onSaveLyrics) {
        await onSaveLyrics(lyricsDraft);
      }
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerateFamilyReflection = () => {
    const reflectionsByGenre: Record<string, string> = {
      'Classical & Wellness': `[00:05] Peaceful morning serenity fills our home\n[00:25] Harmony of timeless love and steady guidance\n[00:50] Breathing in calm wellness, gratitude, and clarity\n[01:18] Cherishing every shared milestone together\n[01:45] Standing united, surrounded by warmth and peace`,
      'Ambient & Study': `[00:04] Deep focus and laser-sharp momentum begin\n[00:22] Distractions dissolve into clear visionary architecture\n[00:46] Mastering new disciplines with curiosity and grit\n[01:12] Daily dedication creating sovereign success\n[01:38] High-leverage execution in steady, effortless flow`,
      'Family Lullaby': `[00:05] Under gentle starlight, the evening grows still\n[00:28] Sleep peacefully Maaran, sweet dreams Kavinmozhi\n[00:55] Tomorrow brings infinite wonder and joyful play\n[01:25] Wrapped in eternal love and tender embrace\n[01:55] Safe and blessed through the quiet night`,
      'Tamil Melodies & Tradition': `[00:06] பண்பாட்டு நல்மரபும் உள்ளத்தின் இனிமையும்\n[00:30] தலைமுறை தலைமுறையாய் ஒளிரும் அன்பு அறம்\n[00:58] வீணை நாதமும் புல்லாங்குழல் இசையும் தரும் அமைதி\n[01:28] குடும்பத்தின் வலிமை நமது கூட்டுப் பண்பாடு\n[01:58] என்றென்றும் செழிக்கும் நல்வாழ்வு`,
      'Cinematic': `[00:06] Rising with purpose at the dawn of greatness\n[00:28] Visionary ambitions built on honor and integrity\n[00:56] Overcoming storms to empower generations\n[01:26] Writing our family's bold sovereign legacy\n[01:54] Unstoppable courage leading the way forward`,
    };

    const generated =
      reflectionsByGenre[track.genre] ||
      `[00:05] Melodies of joy and peace flowing freely\n[00:30] Life lived with purpose, compassion, and courage\n[00:55] Guiding our next generation toward boundless heights\n[01:25] United as one sovereign family forever\n[01:55] Every heartbeat celebrating our journey`;

    setLyricsDraft(generated);
  };

  return (
    <div className="flex flex-col h-72 sm:h-80 rounded-3xl bg-slate-950/80 border border-slate-800/90 shadow-inner overflow-hidden">
      {/* Top Bar: Mode Toggle & Edit Action */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/60 border-b border-slate-800/60 shrink-0">
        <div className="flex items-center gap-1.5 p-0.5 rounded-xl bg-slate-950/80 border border-slate-800 text-[11px] font-semibold">
          <button
            onClick={() => {
              setActiveTab('lyrics');
              setIsEditing(false);
            }}
            className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'lyrics'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <AlignLeft className="w-3 h-3" />
            <span>Synced Lyrics</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('reflection');
              setIsEditing(false);
            }}
            className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'reflection'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span>Reflection & Meaning</span>
          </button>
        </div>

        <button
          onClick={() => {
            setIsEditing(!isEditing);
            setLyricsDraft(track.lyrics || '');
          }}
          className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-800/60 hover:bg-slate-700/70 text-slate-300 hover:text-white text-[11px] font-medium transition-colors"
          title="Edit Lyrics or Reflection"
        >
          <Edit3 className="w-3 h-3 text-indigo-400" />
          <span>{isEditing ? 'Cancel' : 'Edit'}</span>
        </button>
      </div>

      {/* Main Content Area */}
      {isEditing ? (
        <div className="p-4 flex flex-col justify-between flex-1 space-y-2 overflow-y-auto">
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-white">Edit Track Lyrics & Timestamp Reflection</span>
              <button
                type="button"
                onClick={handleGenerateFamilyReflection}
                className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold underline"
              >
                <Sparkles className="w-3 h-3" />
                <span>Auto-Format Family Reflection</span>
              </button>
            </div>
            <p className="text-[10px] text-slate-400">
              Format with timestamps like <span className="font-mono text-indigo-300">[00:15] Verse</span> for karaoke sync, or paste plain poetry/notes.
            </p>
          </div>

          <textarea
            value={lyricsDraft}
            onChange={(e) => setLyricsDraft(e.target.value)}
            rows={5}
            placeholder="[00:10] First lyric line&#10;[00:35] Second reflection line..."
            className="w-full flex-1 bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-indigo-500"
          />

          <div className="flex justify-end gap-2 pt-1 shrink-0">
            <button
              onClick={() => setIsEditing(false)}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-300"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveLyrics}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white shadow-md shadow-indigo-600/30"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Saving...' : 'Save Lyrics'}</span>
            </button>
          </div>
        </div>
      ) : activeTab === 'lyrics' ? (
        <div
          ref={containerRef}
          onScroll={handleContainerScroll}
          className="flex-1 overflow-y-auto px-4 py-6 space-y-4 scroll-smooth"
        >
          {lines.map((line, idx) => {
            const isActive = idx === activeIndex;
            const isPast = activeIndex !== -1 && idx < activeIndex;

            const formatTimestamp = (s: number) => {
              const m = Math.floor(s / 60);
              const sec = s % 60;
              return `${m}:${sec < 10 ? '0' : ''}${sec}`;
            };

            return (
              <div
                key={line.id}
                ref={isActive ? activeLineRef : null}
                onClick={() => onSeek(line.time)}
                className={`group cursor-pointer select-none transition-all duration-300 rounded-xl p-2.5 flex items-start gap-2.5 ${
                  isActive
                    ? 'bg-gradient-to-r from-indigo-950/80 via-purple-950/40 to-transparent border-l-4 border-indigo-400 pl-3 scale-[1.02] shadow-lg shadow-indigo-950/40'
                    : isPast
                    ? 'opacity-40 hover:opacity-85 hover:bg-slate-900/40'
                    : 'opacity-30 hover:opacity-80 hover:bg-slate-900/40'
                }`}
              >
                <span
                  className={`text-[10px] font-mono shrink-0 mt-0.5 px-1.5 py-0.5 rounded transition-colors ${
                    isActive
                      ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-bold'
                      : 'text-slate-500 group-hover:text-slate-300'
                  }`}
                >
                  {formatTimestamp(line.time)}
                </span>

                <div className="flex-1 min-w-0">
                  <p
                    className={`leading-relaxed transition-all ${
                      isActive
                        ? 'text-white font-extrabold text-base sm:text-lg drop-shadow-[0_0_20px_rgba(168,85,247,0.7)]'
                        : 'text-slate-300 font-medium text-xs sm:text-sm font-serif italic'
                    }`}
                  >
                    {line.text}
                  </p>
                </div>
              </div>
            );
          })}

          <div className="pt-4 text-center">
            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">
              ✦ End of Synced Reflection ✦
            </span>
          </div>
        </div>
      ) : (
        /* Family Reflection & Mindset Guide View */
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
          <div className="p-3.5 rounded-2xl bg-gradient-to-br from-indigo-950/60 via-slate-900 to-slate-950 border border-indigo-500/25 space-y-2">
            <div className="flex items-center gap-2">
              <Compass className="w-4 h-4 text-indigo-400" />
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                Sovereign Mindset & Family Legacy Note
              </h4>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed font-serif italic">
              "{track.lyrics || 'Harmonies of lifelong love, generational wisdom, and steady guidance. Walking forward with clear vision, protecting and uplifting family together.'}"
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
              <div className="flex items-center gap-1.5 text-emerald-400 font-semibold text-[11px]">
                <Shield className="w-3.5 h-3.5" />
                <span>Family Pillar</span>
              </div>
              <p className="text-[10px] text-slate-400 leading-tight">
                Thamizh & Selvapriya Guidance • Maaran & Kavinmozhi Inspiration
              </p>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
              <div className="flex items-center gap-1.5 text-amber-400 font-semibold text-[11px]">
                <Zap className="w-3.5 h-3.5" />
                <span>Audio Energy</span>
              </div>
              <p className="text-[10px] text-slate-400 leading-tight">
                {track.genre} • Restorative frequencies for focus and peace
              </p>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-900/50 border border-slate-800/80 text-[10px] text-slate-400 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3 h-3 text-indigo-400" />
              <span>Drive Synchronized Track</span>
            </span>
            <span className="text-emerald-300 font-mono font-semibold">
              {track.driveFolderPath || 'Family Circle / Apple Music'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
