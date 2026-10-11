import React, { useState } from 'react';
import {
  Smile,
  Heart,
  Sparkles,
  Plus,
  TrendingUp,
  Sun,
  ShieldCheck,
  CheckCircle2,
  Calendar,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const MoodJournalTab: React.FC = () => {
  const { moodEntries, addMoodEntry } = useApp();

  const [score, setScore] = useState(8);
  const [emotionLabel, setEmotionLabel] = useState('Focused & Confident');
  const [journalNote, setJournalNote] = useState('');
  const [gratitude, setGratitude] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const emotionPresets = [
    { label: 'Laser Focused & Confident', icon: '⚡', score: 9 },
    { label: 'Deeply Grateful & Peaceful', icon: '✨', score: 10 },
    { label: 'Energized & Motivated', icon: '🚀', score: 8 },
    { label: 'Balanced & Steady', icon: '🌿', score: 7 },
    { label: 'High Cognitive Load / Fatigued', icon: '🧠', score: 5 },
    { label: 'Under Pressure / Seeking Calm', icon: '🛡️', score: 4 },
  ];

  const handleSaveMood = (e: React.FormEvent) => {
    e.preventDefault();
    if (!journalNote.trim()) return;

    setIsSubmitting(true);

    // AI Cognitive Reframing Simulation
    const reframingTemplates = [
      'Your mental fortitude during high-stake execution reinforces resilience across your family lineage.',
      'Acknowledge the effort you exerted today; rest is not the absence of progress, but its biological multiplier.',
      'By anchoring in daily gratitude, you transform stress into clean strategic fuel.',
    ];
    const pickedReframing = reframingTemplates[Math.floor(Math.random() * reframingTemplates.length)];

    setTimeout(() => {
      addMoodEntry({
        date: new Date().toISOString().split('T')[0],
        moodScore: score,
        emotionName: emotionLabel,
        sentimentTrend: score >= 7 ? 'uplifted' : 'stable',
        journalNote: journalNote.trim(),
        gratitudeReflection: gratitude.trim() || 'Grateful for life, health, and family harmony.',
        aiCognitiveReframing: pickedReframing,
      });

      setJournalNote('');
      setGratitude('');
      setIsSubmitting(false);
    }, 600);
  };

  const averageMood = Math.round(
    (moodEntries.reduce((acc, m) => acc + m.moodScore, 0) / (moodEntries.length || 1)) * 10
  ) / 10;

  return (
    <div className="space-y-6 pb-28 pt-2">
      {/* Mood Header */}
      <div className="p-5 rounded-3xl bg-gradient-to-br from-purple-950/40 via-slate-900 to-rose-950/40 border border-purple-500/30 relative overflow-hidden shadow-xl">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400">
              <Smile className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-purple-300 uppercase tracking-wider">
              Mental Health & Emotional Well-Being Journal
            </span>
          </div>

          <span className="px-2.5 py-1 rounded-full text-xs font-bold font-mono bg-purple-500/20 text-purple-300 border border-purple-500/30">
            {averageMood} / 10 Avg
          </span>
        </div>

        <h3 className="text-lg font-bold text-white mt-1">Holistic Mind & Cognitive Health</h3>
        <p className="text-xs text-slate-300 mt-1 leading-relaxed">
          Daily reflections, gratitude tracking, and empathetic AI cognitive reframing to maintain equanimity under high responsibility.
        </p>
      </div>

      {/* New Mood Check-In Form */}
      <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400">
            <Heart className="w-4 h-4" />
          </div>
          <h4 className="text-sm font-bold text-white">Daily Emotional Check-In</h4>
        </div>

        {/* Emotion Preset Chips */}
        <div>
          <label className="text-xs text-slate-400 block mb-2">How are you feeling right now?</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {emotionPresets.map((preset, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setEmotionLabel(preset.label);
                  setScore(preset.score);
                }}
                className={`p-2.5 rounded-2xl text-left border text-xs transition-all flex items-center gap-2 ${
                  emotionLabel === preset.label
                    ? 'bg-purple-600/20 border-purple-500 text-purple-200'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <span className="text-base">{preset.icon}</span>
                <span className="truncate">{preset.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Score Slider */}
        <div>
          <div className="flex items-center justify-between text-xs text-slate-300 mb-1.5">
            <span>Energy & Optimism Rating</span>
            <span className="font-mono font-bold text-purple-400 text-sm">{score} / 10</span>
          </div>
          <input
            type="range"
            min="1"
            max="10"
            value={score}
            onChange={(e) => setScore(parseInt(e.target.value))}
            className="w-full accent-purple-500 bg-slate-950 rounded-lg cursor-pointer"
          />
        </div>

        <form onSubmit={handleSaveMood} className="space-y-3 pt-1">
          <div>
            <label className="text-xs text-slate-400 block mb-1">
              Stream of Consciousness / Daily Reflections
            </label>
            <textarea
              rows={3}
              value={journalNote}
              onChange={(e) => setJournalNote(e.target.value)}
              placeholder="What occupied your mind today? What victories or friction did you encounter?"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-purple-500 resize-none leading-relaxed"
            />
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1">
              Gratitude Pillar (3 things or 1 core blessing)
            </label>
            <input
              type="text"
              value={gratitude}
              onChange={(e) => setGratitude(e.target.value)}
              placeholder="e.g. Grateful for family laughter at dinner, sharp focus on roadmap..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !journalNote.trim()}
            className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-xs font-semibold text-white flex items-center justify-center gap-1.5 transition-colors shadow-md shadow-purple-600/30"
          >
            {isSubmitting ? <Sparkles className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            <span>Log Mood & Generate Cognitive Reframing</span>
          </button>
        </form>
      </div>

      {/* Historical Journal Entries */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
          Reflective Timeline ({moodEntries.length})
        </h4>

        {moodEntries.map((entry) => (
          <div key={entry.id} className="p-4 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-bold text-white">{entry.emotionName}</span>
                <span className="px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300 font-mono text-[10px]">
                  {entry.moodScore}/10
                </span>
              </div>
              <span className="text-slate-500 font-mono text-[11px]">{entry.date}</span>
            </div>

            <p className="text-slate-300 leading-relaxed bg-slate-950/60 p-3 rounded-2xl border border-slate-800/80">
              "{entry.journalNote}"
            </p>

            {entry.gratitudeReflection && (
              <div className="flex items-start gap-1.5 text-amber-300/90 text-[11px]">
                <Sun className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>Gratitude: {entry.gratitudeReflection}</span>
              </div>
            )}

            {entry.aiCognitiveReframing && (
              <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-200">
                <span className="font-semibold block mb-0.5 text-indigo-300 text-[11px]">Aura Empathetic Reframing:</span>
                <p className="leading-relaxed">{entry.aiCognitiveReframing}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
