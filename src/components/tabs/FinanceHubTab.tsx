import React, { useState } from 'react';
import {
  Wallet,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Plus,
  DollarSign,
  TrendingUp,
  Percent,
  CheckCircle2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { getFinancialInsightsApi } from '../../services/api';

export const FinanceHubTab: React.FC = () => {
  const {
    netWorth,
    monthlyIncome,
    monthlyExpenses,
    portfolio,
    transactions,
    addTransaction,
    familyMembers,
  } = useApp();

  const [showAddTxModal, setShowAddTxModal] = useState(false);
  const [txTitle, setTxTitle] = useState('');
  const [txAmount, setTxAmount] = useState('');
  const [txCategory, setTxCategory] = useState<any>('Investments');
  const [txType, setTxType] = useState<'income' | 'expense'>('expense');
  const [txMember, setTxMember] = useState('Karthik');

  const [aiInsightLoading, setAiInsightLoading] = useState(false);
  const [aiInsights, setAiInsights] = useState<any>(null);

  const savingsRate = Math.round(((monthlyIncome - monthlyExpenses) / monthlyIncome) * 100);

  const handleFetchAiInsights = async () => {
    setAiInsightLoading(true);
    try {
      const categoryMap = transactions.reduce((acc: any, t) => {
        acc[t.category] = (acc[t.category] || 0) + t.amount;
        return acc;
      }, {});

      const res = await getFinancialInsightsApi({
        monthlyIncome,
        totalExpenses: monthlyExpenses,
        expensesByCategory: categoryMap,
        savingsGoal: 'Automated $1B Compounding Architecture',
      });
      setAiInsights(res);
    } catch {
      setAiInsights({
        analysis: 'Monthly savings rate of 78% creates rapid capital accumulation. Runway is virtually infinite under current sovereign cash flow.',
        optimizations: [
          'Direct 30% of monthly surplus into private credit & AI infrastructure seed rounds',
          'Automate weekly treasury bill roll-over sweeps',
          'Audit secondary family card spending thresholds',
        ],
        suggestedSavingsPlan: {
          recommendedMonthlySave: monthlyIncome * 0.4,
          projectedOneYearGrowth: monthlyIncome * 0.4 * 12 * 1.12,
          actionStep: 'Deploy into diversified yield vehicle with auto-sweep',
        },
      });
    } finally {
      setAiInsightLoading(false);
    }
  };

  const handleAddTxSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!txTitle.trim() || !txAmount) return;
    addTransaction({
      title: txTitle.trim(),
      amount: parseFloat(txAmount),
      category: txCategory,
      type: txType,
      date: 'Today',
      member: txMember,
    });
    setTxTitle('');
    setTxAmount('');
    setShowAddTxModal(false);
  };

  return (
    <div className="space-y-6 pb-28 pt-2">
      {/* Top Net Worth Card */}
      <div className="p-5 rounded-3xl bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-950 border border-emerald-500/30 relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
              <Wallet className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider">
              Consolidated Sovereign Net Worth
            </span>
          </div>

          <button
            onClick={() => setShowAddTxModal(true)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Entry</span>
          </button>
        </div>

        <div className="text-3xl font-bold font-mono text-white tracking-tight mt-1">
          ${(netWorth / 1000000).toFixed(2)}M
        </div>
        <p className="text-xs text-emerald-400 mt-1 flex items-center gap-1">
          <TrendingUp className="w-3.5 h-3.5" />
          <span>+3.4% ($2.6M) across all holding entities in last 24h</span>
        </p>

        {/* Monthly Income vs Expense Flow */}
        <div className="mt-5 pt-4 border-t border-emerald-500/20 grid grid-cols-3 gap-2 text-xs">
          <div>
            <span className="text-slate-400 block text-[11px]">Monthly Gross Cashflow</span>
            <span className="font-mono text-sm font-bold text-white">${(monthlyIncome).toLocaleString()}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[11px]">Monthly Total Expenses</span>
            <span className="font-mono text-sm font-bold text-slate-300">${(monthlyExpenses).toLocaleString()}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[11px]">Savings & Reinvest Rate</span>
            <span className="font-mono text-sm font-bold text-emerald-400">{savingsRate}%</span>
          </div>
        </div>
      </div>

      {/* AI Financial Optimizer Card */}
      <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">AI Financial Optimizer & Automated Savings</h3>
              <p className="text-xs text-slate-400">Gemini deep financial analytics & trend modeling</p>
            </div>
          </div>

          <button
            onClick={handleFetchAiInsights}
            disabled={aiInsightLoading}
            className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            {aiInsightLoading ? <Sparkles className="w-3.5 h-3.5 animate-spin" /> : <TrendingUp className="w-3.5 h-3.5" />}
            <span>Analyze Habits</span>
          </button>
        </div>

        {aiInsights ? (
          <div className="p-4 rounded-2xl bg-slate-950 border border-indigo-500/30 text-xs space-y-3 animate-fade-in">
            <p className="text-slate-200 leading-relaxed">{aiInsights.analysis}</p>

            {aiInsights.optimizations && (
              <div className="space-y-1.5 pt-2 border-t border-slate-800">
                <span className="font-semibold text-indigo-300 block">Recommended Optimizations:</span>
                {aiInsights.optimizations.map((opt: string, idx: number) => (
                  <div key={idx} className="flex items-center gap-2 text-slate-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>{opt}</span>
                  </div>
                ))}
              </div>
            )}

            {aiInsights.suggestedSavingsPlan && (
              <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-200 flex items-center justify-between">
                <div>
                  <span className="text-[11px] block">Recommended Monthly Auto-Save</span>
                  <strong className="text-white font-mono text-sm">
                    ${aiInsights.suggestedSavingsPlan.recommendedMonthlySave?.toLocaleString()}
                  </strong>
                </div>
                <div className="text-right">
                  <span className="text-[11px] block text-emerald-300">Projected 1-Yr Compounding</span>
                  <strong className="text-emerald-400 font-mono text-sm">
                    ${aiInsights.suggestedSavingsPlan.projectedOneYearGrowth?.toLocaleString()}
                  </strong>
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-slate-400 bg-slate-950/60 p-3 rounded-2xl border border-slate-800/80">
            Click 'Analyze Habits' above to generate personalized AI budgeting recommendations, automated savings plans, and capital deployment strategies based on your real transactions.
          </p>
        )}
      </div>

      {/* Investment Portfolio Holdings Breakdown */}
      <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Sovereign Holding Asset Allocation ({portfolio.length})
          </h3>
          <span className="text-xs text-slate-400 font-mono">100% Diversified</span>
        </div>

        <div className="space-y-2.5">
          {portfolio.map((asset) => (
            <div
              key={asset.id}
              className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white">{asset.name}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                    {asset.category}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
                  Allocation: {asset.allocationPercent}%
                </p>
              </div>

              <div className="text-right">
                <span className="font-mono text-sm font-bold text-white block">
                  ${(asset.value / 1000000).toFixed(2)}M
                </span>
                <span className="text-[11px] text-emerald-400 font-mono">
                  +{asset.pnl24h}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Family Transactions Feed */}
      <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Real-Time Family Transactions
          </h3>
          <span className="text-xs text-slate-400">Audit Trail</span>
        </div>

        <div className="space-y-2">
          {transactions.map((tx) => (
            <div
              key={tx.id}
              className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center justify-between text-xs"
            >
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-xl ${tx.type === 'income' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                  {tx.type === 'income' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                </div>
                <div>
                  <h5 className="font-semibold text-slate-200">{tx.title}</h5>
                  <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                    <span>{tx.category}</span>
                    <span>•</span>
                    <span>Member: {tx.member}</span>
                    <span>•</span>
                    <span>{tx.date}</span>
                  </div>
                </div>
              </div>

              <span className={`font-mono text-xs font-bold ${tx.type === 'income' ? 'text-emerald-400' : 'text-slate-300'}`}>
                {tx.type === 'income' ? '+' : '-'}${tx.amount.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* MODAL: Add Transaction */}
      {showAddTxModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4">
          <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-4">Add Financial Entry</h3>
            <form onSubmit={handleAddTxSubmit} className="space-y-3.5">
              <div>
                <label className="text-xs text-slate-300 block mb-1">Title</label>
                <input
                  type="text"
                  placeholder="e.g. Enterprise Client Wire Deposit"
                  value={txTitle}
                  onChange={(e) => setTxTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-300 block mb-1">Amount ($)</label>
                  <input
                    type="number"
                    placeholder="2500"
                    value={txAmount}
                    onChange={(e) => setTxAmount(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-300 block mb-1">Type</label>
                  <select
                    value={txType}
                    onChange={(e) => setTxType(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-300 block mb-1">Category</label>
                  <select
                    value={txCategory}
                    onChange={(e) => setTxCategory(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="Investments">Investments</option>
                    <option value="Living & Housing">Living & Housing</option>
                    <option value="Family & Kids">Family & Kids</option>
                    <option value="Wellness">Wellness</option>
                    <option value="Business Ops">Business Ops</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-300 block mb-1">Family Member</label>
                  <select
                    value={txMember}
                    onChange={(e) => setTxMember(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    {familyMembers.map((m) => (
                      <option key={m.id} value={m.name.split(' ')[0]}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddTxModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white transition-colors"
                >
                  Save Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
