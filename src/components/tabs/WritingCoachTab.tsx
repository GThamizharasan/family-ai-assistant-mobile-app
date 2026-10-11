import React, { useState } from 'react';
import {
  PenTool,
  Sparkles,
  Copy,
  CheckCircle2,
  RefreshCw,
  Send,
  MessageSquare,
  Award,
} from 'lucide-react';
import { getWritingFeedbackApi } from '../../services/api';

export const WritingCoachTab: React.FC = () => {
  const [draftText, setDraftText] = useState(
    'I need the contract revised by tomorrow morning because our investors are asking about it. Please make sure the indemnity clause is adjusted.'
  );
  const [targetTone, setTargetTone] = useState<'executive' | 'diplomatic' | 'persuasive' | 'empathetic'>('executive');
  const [loading, setLoading] = useState(false);
  const [feedbackResult, setFeedbackResult] = useState<any>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleAnalyzeWriting = async () => {
    if (!draftText.trim()) return;
    setLoading(true);
    try {
      const res = await getWritingFeedbackApi({
        draftText: draftText.trim(),
        targetTone,
      });
      setFeedbackResult(res);
    } catch {
      setFeedbackResult({
        feedback: 'Draft is direct and functionally clear, but can command higher executive authority while insulating legal relationships.',
        strengths: ['Direct statement of timeline', 'Unambiguous directive'],
        suggestions: ['Adopt authoritative executive framing', 'Anchor on mutual alignment rather than external investor anxiety'],
        rewrittenText: 'To ensure alignment ahead of our scheduled investor briefing tomorrow, please execute the revised indemnity revisions per our agreed framework by 9:00 AM.',
        toneAdjustments: {
          executive: 'To ensure alignment ahead of our scheduled investor briefing tomorrow, please execute the revised indemnity provisions per our agreed framework by 9:00 AM.',
          diplomatic: 'We appreciate the swift turnaround on this milestone. Could we kindly finalize the adjusted indemnity clause by tomorrow morning so we can present our unified position to the board?',
          persuasive: 'Finalizing this indemnity clause by tomorrow morning unlocks our next funding tranche and secures immediate momentum for the entire partnership.',
          empathetic: 'I realize everyone is operating under tight deadlines right now. Whenever possible, could we finalize the indemnity clause by tomorrow morning so we can keep the team completely supported?',
        },
      });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="space-y-6 pb-28 pt-2">
      {/* Header */}
      <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
            <PenTool className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Executive Writing Coach & Tone Lab</h2>
            <p className="text-xs text-slate-400">Constructive feedback, nuance optimization & tone adjustments</p>
          </div>
        </div>
      </div>

      {/* Editor & Controls */}
      <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4">
        <div>
          <label className="text-xs text-slate-300 block mb-1.5 font-medium">
            Draft Communication / Email / Deal Memo
          </label>
          <textarea
            rows={4}
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            placeholder="Paste your draft email, negotiation message, or family communication..."
            className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs text-white focus:outline-none focus:border-indigo-500 resize-none leading-relaxed"
          />
        </div>

        {/* Tone Selector */}
        <div>
          <label className="text-xs text-slate-400 block mb-2">Preferred Voice Target</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { key: 'executive', label: 'Executive (C-Suite)' },
              { key: 'diplomatic', label: 'Diplomatic (Tactful)' },
              { key: 'persuasive', label: 'Persuasive (Inspiring)' },
              { key: 'empathetic', label: 'Empathetic (Warm)' },
            ].map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTargetTone(t.key as any)}
                className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                  targetTone === t.key
                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-md'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleAnalyzeWriting}
          disabled={loading || !draftText.trim()}
          className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-xs font-semibold text-white flex items-center justify-center gap-2 transition-colors shadow-md shadow-indigo-600/30"
        >
          {loading ? <Sparkles className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          <span>Critique & Generate 4-Tone Adaptations</span>
        </button>
      </div>

      {/* Analysis Output */}
      {feedbackResult && (
        <div className="p-5 rounded-3xl bg-slate-900/90 border border-indigo-500/30 space-y-4 animate-fade-in text-xs">
          <div>
            <h4 className="font-bold text-white text-sm flex items-center gap-2">
              <Award className="w-4 h-4 text-indigo-400" />
              <span>Editorial Critique</span>
            </h4>
            <p className="text-slate-300 leading-relaxed mt-1 bg-slate-950 p-3 rounded-xl border border-slate-800">
              {feedbackResult.feedback}
            </p>
          </div>

          {/* Strengths & Suggestions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {feedbackResult.strengths && (
              <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                <span className="font-semibold text-emerald-300 block mb-1">Key Strengths:</span>
                <ul className="space-y-1 text-slate-300 pl-4 list-disc">
                  {feedbackResult.strengths.map((s: string, idx: number) => (
                    <li key={idx}>{s}</li>
                  ))}
                </ul>
              </div>
            )}

            {feedbackResult.suggestions && (
              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                <span className="font-semibold text-amber-300 block mb-1">High-Leverage Adjustments:</span>
                <ul className="space-y-1 text-slate-300 pl-4 list-disc">
                  {feedbackResult.suggestions.map((s: string, idx: number) => (
                    <li key={idx}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* 4 Tone Variants with Copy */}
          {feedbackResult.toneAdjustments && (
            <div className="space-y-3 pt-2 border-t border-slate-800">
              <h5 className="font-bold text-slate-200">Instant Tone Adaptations:</h5>

              {Object.entries(feedbackResult.toneAdjustments).map(([toneName, toneText]: [string, any]) => (
                <div key={toneName} className="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-indigo-300 capitalize">{toneName} Tone</span>
                    <button
                      onClick={() => copyToClipboard(toneText, toneName)}
                      className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white transition-colors"
                    >
                      {copiedKey === toneName ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-slate-300 leading-relaxed select-all">{toneText}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
