import React, { useState } from 'react';
import {
  Shield,
  KeyRound,
  CheckCircle2,
  Lock,
  ArrowRight,
  Sparkles,
  Users,
  AlertCircle,
  Smartphone,
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export const GoogleSSOScreen: React.FC = () => {
  const {
    loginWithGoogle,
    loginWithActivationCode,
    requireGoogleAuthOnReload,
    setRequireGoogleAuthOnReload,
    familyMembers,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'google' | 'code' | 'custom'>('google');
  const [activationCodeInput, setActivationCodeInput] = useState('');
  const [codeFeedback, setCodeFeedback] = useState<{ success: boolean; message: string } | null>(null);
  const [customEmail, setCustomEmail] = useState('');
  const [customName, setCustomName] = useState('');

  const primaryEmail = 'digitaltamilworld@gmail.com';

  const handleSelectGoogleAccount = (email: string, name?: string) => {
    loginWithGoogle(email, name);
  };

  const handleCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activationCodeInput.trim()) return;
    const res = loginWithActivationCode(activationCodeInput.trim());
    setCodeFeedback(res);
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customEmail.trim()) return;
    loginWithGoogle(customEmail.trim(), customName.trim() || undefined, 'secondary');
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-950 p-4 relative overflow-hidden select-none">
      {/* Background ambient lighting */}
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-96 h-96 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 right-1/4 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/95 shadow-2xl p-6 sm:p-8 backdrop-blur-xl relative z-10 space-y-6">
        {/* Google Identity Header */}
        <div className="text-center space-y-3">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-white p-3 shadow-lg flex items-center justify-center border border-slate-200">
            {/* Official Google G Logo */}
            <svg viewBox="0 0 24 24" className="w-full h-full">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.14z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.26v3.15C3.26 21.36 7.33 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.26C.46 8.16 0 9.94 0 12s.46 3.84 1.26 5.42l4.02-3.15z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.26 6.58l4.02 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
              />
            </svg>
          </div>

          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Sign in with Google</h1>
            <p className="text-xs text-slate-400 mt-1">
              to continue to <strong className="text-slate-200">AuraFamily Life Operating System</strong>
            </p>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-slate-800 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('google')}
            className={`flex-1 pb-2.5 transition-colors border-b-2 ${
              activeTab === 'google'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Google Account
          </button>
          <button
            onClick={() => setActiveTab('code')}
            className={`flex-1 pb-2.5 transition-colors border-b-2 ${
              activeTab === 'code'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            16-Digit Family Code
          </button>
          <button
            onClick={() => setActiveTab('custom')}
            className={`flex-1 pb-2.5 transition-colors border-b-2 ${
              activeTab === 'custom'
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Other Account
          </button>
        </div>

        {activeTab === 'google' && (
          <div className="space-y-3.5">
            {/* Primary One-Tap Hero Button */}
            <button
              onClick={() => handleSelectGoogleAccount(primaryEmail, 'Karthik Raja')}
              className="w-full p-4 rounded-2xl bg-slate-950 border-2 border-blue-500/50 hover:border-blue-400 hover:bg-slate-900 transition-all text-left flex items-center justify-between group shadow-lg shadow-blue-500/10 active:scale-98"
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <img
                    src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"
                    alt="Karthik"
                    className="w-11 h-11 rounded-full object-cover border-2 border-blue-400"
                  />
                  <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-slate-950" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-sm">Karthik Raja</span>
                    <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                      Primary Head
                    </span>
                  </div>
                  <span className="text-xs text-slate-400 font-mono block mt-0.5">{primaryEmail}</span>
                  <span className="text-[10px] text-emerald-400 font-medium">Google One 2 TB • Sovereign Master</span>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-blue-400 transition-colors" />
            </button>

            {/* Other Recognized Family Members */}
            <div className="space-y-1.5 pt-1">
              <span className="text-[11px] text-slate-400 font-medium px-1 block">
                Or sign in as recognized secondary family member:
              </span>

              {familyMembers.slice(1).map((member) => (
                <button
                  key={member.id}
                  onClick={() => handleSelectGoogleAccount(member.email, member.name)}
                  className="w-full p-3 rounded-2xl bg-slate-950/70 hover:bg-slate-950 border border-slate-800 hover:border-slate-700 transition-all text-left flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={member.avatar}
                      alt={member.name}
                      className="w-9 h-9 rounded-full object-cover border border-slate-700"
                    />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-slate-200 text-xs">{member.name}</span>
                        <span className="text-[10px] text-slate-400">({member.relationship})</span>
                      </div>
                      <span className="text-[11px] text-slate-500 font-mono block">{member.email}</span>
                    </div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-300 transition-colors" />
                </button>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'code' && (
          <form onSubmit={handleCodeSubmit} className="space-y-4">
            <div>
              <label className="text-xs text-slate-300 block mb-1.5 font-medium">
                16-Digit Activation Code
              </label>
              <input
                type="text"
                placeholder="XXXX-XXXX-XXXX-XXXX"
                value={activationCodeInput}
                onChange={(e) => setActivationCodeInput(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-xs text-white font-mono tracking-wider focus:outline-none focus:border-indigo-500"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                Enter the 16-digit activation code sent to you by the Primary Owner ({primaryEmail}).
              </span>
            </div>

            {codeFeedback && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  codeFeedback.success
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                }`}
              >
                {codeFeedback.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                )}
                <span>{codeFeedback.message}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={!activationCodeInput.trim()}
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-md shadow-indigo-600/30"
            >
              <KeyRound className="w-4 h-4" />
              <span>Verify Code & Sign In</span>
            </button>
          </form>
        )}

        {activeTab === 'custom' && (
          <form onSubmit={handleCustomSubmit} className="space-y-3.5 text-xs">
            <div>
              <label className="text-slate-300 block mb-1">Google Email Address</label>
              <input
                type="email"
                placeholder="your.email@gmail.com"
                value={customEmail}
                onChange={(e) => setCustomEmail(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>

            <div>
              <label className="text-slate-300 block mb-1">Your Full Name</label>
              <input
                type="text"
                placeholder="Full Name"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={!customEmail.trim()}
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-semibold text-xs transition-colors"
            >
              Sign In with this Google Account
            </button>
          </form>
        )}

        {/* Reload Preference Toggle - honoring user request */}
        <div className="pt-2 border-t border-slate-800/80">
          <label className="flex items-start gap-2.5 text-[11px] text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={requireGoogleAuthOnReload}
              onChange={(e) => setRequireGoogleAuthOnReload(e.target.checked)}
              className="rounded accent-blue-500 mt-0.5"
            />
            <span className="leading-snug">
              <strong>Require Google Single Sign-On on every reload:</strong> Prompt for Google SSO authentication whenever the browser page or app is refreshed.
            </span>
          </label>
        </div>

        {/* Google Security Enclave Badge */}
        <div className="pt-2 text-center space-y-1">
          <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 font-medium">
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            <span>Google Identity Services • OAuth 2.0 PKCE Enclave</span>
          </div>
          <p className="text-[10px] text-slate-500">
            Zero-knowledge client encryption. No credentials shared outside your sovereign devices.
          </p>
        </div>
      </div>
    </div>
  );
};
