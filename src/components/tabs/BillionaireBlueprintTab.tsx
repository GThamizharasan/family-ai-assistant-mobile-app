import React, { useState } from 'react';
import {
  TrendingUp,
  Target,
  Sparkles,
  ShieldCheck,
  Award,
  ChevronRight,
  CheckCircle2,
  DollarSign,
  Compass,
  Briefcase,
  Layers,
  Send,
  HelpCircle,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { getBillionaireAdvisoryApi } from '../../services/api';

export const BillionaireBlueprintTab: React.FC = () => {
  const { milestones, toggleHabit, updateMilestoneProgress } = useApp();
  const [selectedPhaseId, setSelectedPhaseId] = useState<string>(milestones[1]?.id || milestones[0]?.id);
  const [advisoryQuestion, setAdvisoryQuestion] = useState('');
  const [advisoryLoading, setAdvisoryLoading] = useState(false);
  const [advisoryResponse, setAdvisoryResponse] = useState<any>(null);

  const activeMilestone = milestones.find((m) => m.id === selectedPhaseId) || milestones[0];

  const handleAskAdvisory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!advisoryQuestion.trim()) return;

    setAdvisoryLoading(true);
    try {
      const res = await getBillionaireAdvisoryApi({
        currentPhase: activeMilestone.phaseTitle,
        focusIndustry: 'AI Software, Deep Automation & Proprietary Infrastructure',
        questions: advisoryQuestion.trim(),
      });
      setAdvisoryResponse(res);
    } catch (err) {
      setAdvisoryResponse({
        strategicAdvice: 'Focus relentlessly on building asymmetric enterprise distribution and locking in proprietary data pipelines.',
        highLeverageDailyAction: 'Dedicate your 90-minute block to high-ticket partner enterprise agreements.',
        riskMitigation: 'Avoid premature dilution; fund initial expansions from gross operational profit.',
      });
    } finally {
      setAdvisoryLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-28 pt-2">
      {/* Blueprint Header */}
      <div className="p-5 rounded-3xl bg-gradient-to-br from-amber-950/40 via-slate-900 to-slate-950 border border-amber-500/30 relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-300 border border-amber-500/30">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">The Ethical Billionaire Blueprint</h2>
              <p className="text-xs text-amber-300/80">From Scratch to Sovereign Enterprise Holding ($1,000,000,000+)</p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
            Phase 2: In Progress
          </span>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed mt-2">
          A step-by-step master execution roadmap built on ethical value creation, mathematical leverage, non-linear enterprise valuation, and disciplined capital reinvestment.
        </p>

        {/* Aggregate Progress Bar */}
        <div className="mt-4 pt-3 border-t border-amber-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <span className="text-slate-400">
            Total Path Velocity: <strong className="text-white font-mono">Phase 2 (68% Complete)</strong>
          </span>
          <span className="text-amber-400 font-mono font-semibold">
            Next Milestone: $100M Enterprise Valuation
          </span>
        </div>
      </div>

      {/* Phase Navigator Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {milestones.map((m) => (
          <button
            key={m.id}
            onClick={() => setSelectedPhaseId(m.id)}
            className={`shrink-0 px-3.5 py-2 rounded-2xl text-xs font-semibold transition-all border ${
              selectedPhaseId === m.id
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-200 shadow-md'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            Phase {m.phase}: {m.targetValuation.split(' ')[0]}
          </button>
        ))}
      </div>

      {/* Active Phase Deep Dive Card */}
      <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <span className="text-[11px] font-mono text-amber-400 uppercase tracking-wider">
              {activeMilestone.phaseTitle}
            </span>
            <h3 className="text-base font-bold text-white mt-0.5">{activeMilestone.title}</h3>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm font-mono font-bold text-amber-400">
              {activeMilestone.progressPercent}%
            </span>
            <button
              onClick={() => updateMilestoneProgress(activeMilestone.id, Math.min(100, activeMilestone.progressPercent + 5))}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 border border-slate-700"
            >
              +5% Sprint
            </button>
          </div>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800/80">
          {activeMilestone.description}
        </p>

        {/* Milestone Target Rule */}
        <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-start gap-2.5 text-xs text-indigo-200">
          <Award className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
          <div>
            <strong className="text-white block mb-0.5">Core Axiom for this Phase:</strong>
            {activeMilestone.advisoryRule}
          </div>
        </div>

        {/* Key Metrics Trackers */}
        <div>
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
            Phase Key Metric Targets
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {activeMilestone.keyMetrics.map((km, idx) => (
              <div key={idx} className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
                <span className="text-[11px] text-slate-400 block">{km.label}</span>
                <div className="flex items-baseline justify-between mt-1">
                  <span className="font-mono text-sm font-bold text-white">{km.current}</span>
                  <span className="text-[10px] text-slate-500">Target: {km.target}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* High-Leverage Daily Habits & Execution Protocols */}
        <div>
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
            Daily High-Leverage Execution Habits (Check to Advance)
          </h4>
          <div className="space-y-2">
            {activeMilestone.dailyHabits.map((habit, idx) => (
              <div
                key={idx}
                onClick={() => toggleHabit(activeMilestone.id, idx)}
                className="cursor-pointer flex items-center justify-between p-3 rounded-2xl bg-slate-950/80 hover:bg-slate-950 border border-slate-800 transition-all text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-amber-400" />
                  <span className="text-slate-200">{habit}</span>
                </div>
                <span className="text-[10px] text-amber-400/80 font-mono">+1%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* AI Billionaire Advisory & Private Family Office Coach */}
      <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Direct AI Strategic Advisory & Deal Counsel</h3>
            <p className="text-xs text-slate-400">Ask strategic questions regarding equity, dilution, M&A, or leverage</p>
          </div>
        </div>

        <form onSubmit={handleAskAdvisory} className="flex gap-2">
          <input
            type="text"
            value={advisoryQuestion}
            onChange={(e) => setAdvisoryQuestion(e.target.value)}
            placeholder="e.g. How should I structure secondary liquidation without losing board control?"
            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
          />
          <button
            type="submit"
            disabled={advisoryLoading || !advisoryQuestion.trim()}
            className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            {advisoryLoading ? <Sparkles className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            <span>Consult</span>
          </button>
        </form>

        {advisoryResponse && (
          <div className="p-4 rounded-2xl bg-slate-950 border border-amber-500/30 space-y-3 text-xs animate-fade-in">
            <div>
              <strong className="text-amber-300 block mb-1">Strategic Advisory Directive:</strong>
              <p className="text-slate-200 leading-relaxed">{advisoryResponse.strategicAdvice}</p>
            </div>

            {advisoryResponse.highLeverageDailyAction && (
              <div className="pt-2 border-t border-slate-800">
                <span className="text-emerald-400 font-semibold block mb-0.5">High-Leverage Daily Action:</span>
                <p className="text-slate-300">{advisoryResponse.highLeverageDailyAction}</p>
              </div>
            )}

            {advisoryResponse.riskMitigation && (
              <div className="pt-2 border-t border-slate-800">
                <span className="text-rose-400 font-semibold block mb-0.5">Risk & Blindspot Mitigation:</span>
                <p className="text-slate-300">{advisoryResponse.riskMitigation}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 5-Phase Full Master Architecture Reference */}
      <div className="p-5 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-3">
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          Complete 5-Phase Execution Methodology
        </h4>

        <div className="space-y-2 text-xs">
          <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800/80">
            <span className="font-bold text-amber-400">Phase 1 ($1M - $10M): Sovereign Cash Mastery</span>
            <p className="text-slate-400 mt-1">Master direct customer acquisition, automate recurring high-gross-margin cash flow, and eliminate lifestyle inflation.</p>
          </div>

          <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800/80">
            <span className="font-bold text-amber-400">Phase 2 ($10M - $100M): Enterprise Scalability & IP Moats</span>
            <p className="text-slate-400 mt-1">Build structural lock-in with proprietary AI models, enterprise contracts, negative net churn, and 80%+ gross margin unit economics.</p>
          </div>

          <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800/80">
            <span className="font-bold text-amber-400">Phase 3 ($100M - $500M): Conglomerate Holding & Reinvestment</span>
            <p className="text-slate-400 mt-1">Establish family holding corporation. Allocate retained earnings into bolt-on acquisitions and asymmetric venture tech.</p>
          </div>

          <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800/80">
            <span className="font-bold text-amber-400">Phase 4 ($500M - $1B): Sovereign Scale & Frontier Monopolies</span>
            <p className="text-slate-400 mt-1">Cross $1B enterprise value threshold through mission-critical infrastructure, global distributions, and intergenerational trust governance.</p>
          </div>

          <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800/80">
            <span className="font-bold text-amber-400">Phase 5 ($1B+): Civilizational Impact & Endowments</span>
            <p className="text-slate-400 mt-1">Endow global research institutes, clean infrastructure, ethical governance, and immortal sovereign legacy.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
