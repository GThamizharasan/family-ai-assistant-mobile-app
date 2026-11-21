import React, { useState } from 'react';
import {
  X,
  Trophy,
  RotateCcw,
  BarChart3,
  Star,
  Flame,
  Clock,
  CloudUpload,
  CheckCircle2,
  Sparkles,
  Play,
  ExternalLink,
  AlertCircle,
} from 'lucide-react';
import { KidsMathAnalyticsState } from '../../types/adaptiveLearning';
import {
  computeKidsMathStickers,
  exportParentMathReportToDrive,
} from '../../services/kidsMathAnalyticsService';

interface KidsMathInsightsModalProps {
  isOpen: boolean;
  initialTab?: 'stickers' | 'mistakes' | 'report';
  analytics: KidsMathAnalyticsState;
  googleAccessToken?: string | null;
  userEmail?: string;
  onClose: () => void;
  onLaunchMistakeBank: () => void;
  onLaunchFiveMinChallenge: () => void;
}

export const KidsMathInsightsModal: React.FC<KidsMathInsightsModalProps> = ({
  isOpen,
  initialTab = 'stickers',
  analytics,
  googleAccessToken,
  userEmail,
  onClose,
  onLaunchMistakeBank,
  onLaunchFiveMinChallenge,
}) => {
  const [activeTab, setActiveTab] = useState<'stickers' | 'mistakes' | 'report'>(initialTab);
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<{
    ok: boolean;
    message: string;
    webViewLink?: string;
  } | null>(null);

  if (!isOpen) return null;

  const stickers = computeKidsMathStickers(analytics);
  const unlockedCount = stickers.filter((s) => s.unlocked).length;
  const activeMistakes = analytics.mistakeBank.filter((m) => !m.resolved);
  const resolvedMistakes = analytics.mistakeBank.filter((m) => m.resolved);

  const topicRows = Object.values(analytics.topicStats).sort((a, b) => b.attempted - a.attempted);
  const totalAttempted = topicRows.reduce((s, r) => s + r.attempted, 0);
  const totalCorrect = topicRows.reduce((s, r) => s + r.correct, 0);
  const overallAccuracy = totalAttempted > 0 ? Math.round((totalCorrect / totalAttempted) * 100) : 0;
  const totalSeconds = topicRows.reduce((s, r) => s + r.totalSeconds, 0);
  const avgSolveSec = totalAttempted > 0 ? Math.round(totalSeconds / totalAttempted) : 0;

  const handleExportDrive = async () => {
    setIsExporting(true);
    setExportStatus(null);
    try {
      const res = await exportParentMathReportToDrive(analytics, googleAccessToken, userEmail);
      setExportStatus(res);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5">
      <div className="w-full max-w-3xl max-h-[88vh] rounded-3xl bg-slate-900 border border-white/15 shadow-2xl overflow-hidden flex flex-col">
        {/* Vivid Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-indigo-950 via-purple-950/85 to-amber-950/75 border-b border-white/10 flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-400/20 text-amber-200 border border-amber-400/40">
                Ages 6–10 · SQLite + Google Drive
              </span>
            </div>
            <h3 className="text-lg sm:text-xl font-black text-white mt-1">
              Kids Math Trophy Book, Mistake Bank & Parent Report
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-2xl bg-white/10 hover:bg-white/20 text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 3 Sub-Tabs */}
        <div className="px-4 pt-3 pb-2 bg-slate-950/60 border-b border-white/10 flex flex-wrap gap-2">
          {[
            {
              id: 'stickers' as const,
              label: `🏆 Stickers (${unlockedCount}/${stickers.length})`,
              icon: Trophy,
              activeCls: 'from-amber-400 to-orange-500 text-slate-950',
            },
            {
              id: 'mistakes' as const,
              label: `🔁 Mistake Bank (${activeMistakes.length})`,
              icon: RotateCcw,
              activeCls: 'from-rose-500 to-pink-600 text-white',
            },
            {
              id: 'report' as const,
              label: '📊 Parent Weekly Report',
              icon: BarChart3,
              activeCls: 'from-cyan-500 to-indigo-600 text-white',
            },
          ].map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-3.5 py-2 rounded-2xl text-xs font-extrabold cursor-pointer transition-all ${
                  active
                    ? `bg-gradient-to-r ${tab.activeCls} shadow-lg`
                    : 'bg-slate-900 text-slate-300 border border-white/10 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* TAB 1: STICKERS & 5-MINUTE CHALLENGE */}
          {activeTab === 'stickers' && (
            <div className="space-y-4">
              <div className="rounded-3xl p-4 bg-gradient-to-r from-amber-500/20 via-orange-500/15 to-rose-500/20 border border-amber-400/35 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="text-xs font-black uppercase text-amber-300 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4" /> Daily 5-Minute Star Challenge
                  </div>
                  <p className="text-sm font-bold text-white">
                    Solve 10 fun problems in 5 minutes to earn +30 Bonus Stars & unlock the Speed Legend sticker!
                  </p>
                  <p className="text-[11px] text-slate-300">
                    Solved today: <strong className="text-emerald-300">{analytics.dailySolvedToday}</strong> · Challenges completed:{' '}
                    <strong className="text-amber-300">{analytics.dailyChallengesCompleted}</strong>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onLaunchFiveMinChallenge();
                  }}
                  className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 hover:brightness-110 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-lg shrink-0 cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-slate-950" />
                  <span>Start 5-Min Quest</span>
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {stickers.map((st) => {
                  const pct = Math.min(100, Math.round((st.progress / st.target) * 100));
                  return (
                    <div
                      key={st.id}
                      className={`rounded-2xl p-3.5 border text-center space-y-2 transition-all ${
                        st.unlocked
                          ? `bg-gradient-to-br ${st.gradient} text-white border-white/40 shadow-xl`
                          : 'bg-slate-950/80 border-white/10 text-slate-300'
                      }`}
                    >
                      <div className={`text-3xl ${st.unlocked ? 'scale-110' : 'opacity-45 grayscale'}`}>
                        {st.emoji}
                      </div>
                      <div className="text-xs font-black leading-tight">{st.title}</div>
                      <p className={`text-[10px] leading-snug ${st.unlocked ? 'text-white/90' : 'text-slate-400'}`}>
                        {st.description}
                      </p>
                      <div className="w-full h-1.5 rounded-full bg-black/30 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${st.unlocked ? 'bg-white' : 'bg-amber-400'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="text-[10px] font-mono font-bold">
                        {st.unlocked ? 'UNLOCKED ✓' : `${st.progress}/${st.target}`}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: MISTAKE BANK */}
          {activeTab === 'mistakes' && (
            <div className="space-y-4">
              <div className="rounded-2xl bg-rose-950/35 border border-rose-500/35 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-extrabold text-white flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400" />
                    <span>Smart Mistake Bank ({activeMistakes.length} to Retry)</span>
                  </h4>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Every missed problem is saved gently so your child can retry it on the paperless board and turn red mistakes into green stars!
                  </p>
                </div>
                <button
                  type="button"
                  disabled={activeMistakes.length === 0}
                  onClick={() => {
                    onClose();
                    onLaunchMistakeBank();
                  }}
                  className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-rose-500 to-pink-600 disabled:opacity-40 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-lg cursor-pointer shrink-0"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Practice Mistakes on Board</span>
                </button>
              </div>

              {activeMistakes.length === 0 ? (
                <div className="rounded-2xl bg-emerald-950/30 border border-emerald-500/30 p-6 text-center space-y-1.5">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                  <p className="text-sm font-extrabold text-white">Zero pending mistakes!</p>
                  <p className="text-xs text-slate-300">
                    {resolvedMistakes.length > 0
                      ? `Your child already fixed ${resolvedMistakes.length} past mistake(s) — amazing progress!`
                      : 'Keep practicing on the board; any tricky sums will appear here automatically.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {activeMistakes.map((m) => (
                    <div
                      key={m.id}
                      className="rounded-2xl bg-slate-950/80 border border-white/10 p-3 flex flex-wrap items-center justify-between gap-2 text-xs"
                    >
                      <div>
                        <div className="font-extrabold text-white">{m.problem.displayHorizontal}</div>
                        <div className="text-[11px] text-slate-400">
                          Child wrote:{' '}
                          <span className="text-rose-300 font-bold">{m.wrongAnswer || '—'}</span> · Expected:{' '}
                          <span className="text-emerald-300 font-bold">
                            {m.problem.expectedText || m.problem.correctAnswer}
                          </span>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-lg bg-slate-800 text-[10px] font-mono text-amber-300">
                        {m.problem.topicCategory || m.problem.op}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: PARENT WEEKLY REPORT */}
          {activeTab === 'report' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {[
                  { label: 'Total Stars', val: `${analytics.totalStars} ⭐`, icon: Star, cls: 'text-amber-300' },
                  { label: 'Overall Accuracy', val: `${overallAccuracy}%`, icon: CheckCircle2, cls: 'text-emerald-300' },
                  { label: 'Avg Solve Speed', val: `${avgSolveSec}s`, icon: Clock, cls: 'text-cyan-300' },
                  { label: 'Best Streak', val: `${analytics.bestStreak}`, icon: Flame, cls: 'text-orange-300' },
                ].map((card) => {
                  const Icon = card.icon;
                  return (
                    <div
                      key={card.label}
                      className="rounded-2xl bg-slate-950/80 border border-white/10 p-3 text-center space-y-1"
                    >
                      <Icon className={`w-4 h-4 mx-auto ${card.cls}`} />
                      <div className={`text-lg font-black ${card.cls}`}>{card.val}</div>
                      <div className="text-[10px] font-bold uppercase text-slate-400">{card.label}</div>
                    </div>
                  );
                })}
              </div>

              <div className="rounded-2xl bg-slate-950/75 border border-white/10 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-cyan-300">
                    Accuracy by Skill & Visual Lab
                  </h4>
                  <button
                    type="button"
                    onClick={() => void handleExportDrive()}
                    disabled={isExporting}
                    className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:brightness-110 disabled:opacity-50 text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer shadow-md"
                  >
                    <CloudUpload className="w-3.5 h-3.5" />
                    <span>{isExporting ? 'Exporting...' : 'Export Weekly Report to Drive'}</span>
                  </button>
                </div>

                {exportStatus && (
                  <div
                    className={`rounded-xl px-3 py-2 text-xs font-semibold flex flex-wrap items-center justify-between gap-2 border ${
                      exportStatus.ok
                        ? 'bg-emerald-500/15 text-emerald-200 border-emerald-400/35'
                        : 'bg-amber-500/15 text-amber-200 border-amber-400/35'
                    }`}
                  >
                    <span>{exportStatus.message}</span>
                    {exportStatus.webViewLink && (
                      <a
                        href={exportStatus.webViewLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 underline font-bold text-white"
                      >
                        Open in Drive <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                )}

                {topicRows.length === 0 ? (
                  <p className="text-xs text-slate-400 py-4 text-center">
                    Solve a few problems on the board and your child’s topic-by-topic accuracy chart will populate automatically!
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {topicRows.map((row) => {
                      const acc = row.attempted > 0 ? Math.round((row.correct / row.attempted) * 100) : 0;
                      const avgS = row.attempted > 0 ? Math.round(row.totalSeconds / row.attempted) : 0;
                      return (
                        <div key={row.topic} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-white">{row.label}</span>
                            <span className="font-mono text-slate-300">
                              {row.correct}/{row.attempted} ({acc}%) · ~{avgS}s
                            </span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                acc >= 80
                                  ? 'bg-gradient-to-r from-emerald-400 to-teal-500'
                                  : acc >= 50
                                  ? 'bg-gradient-to-r from-amber-400 to-orange-500'
                                  : 'bg-gradient-to-r from-rose-500 to-pink-500'
                              }`}
                              style={{ width: `${Math.max(4, acc)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
