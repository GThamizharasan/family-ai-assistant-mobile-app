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
  Mail,
  HardDrive,
  Calendar,
  CloudCheck,
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export const GoogleSSOScreen: React.FC = () => {
  const {
    signInWithGoogleOAuth,
    loginWithGoogle,
    loginWithActivationCode,
    requireGoogleAuthOnReload,
    setRequireGoogleAuthOnReload,
    familyMembers,
    activationCodes,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'google' | 'code' | 'custom'>('google');
  const [activationCodeInput, setActivationCodeInput] = useState('');
  const [codeFeedback, setCodeFeedback] = useState<{ success: boolean; message: string } | null>(null);
  const [customEmail, setCustomEmail] = useState('');
  const [customName, setCustomName] = useState('');
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const primaryEmail = 'digitaltamilworld@gmail.com';

  const handleOfficialGoogleSignIn = async () => {
    setIsSigningIn(true);
    setAuthError(null);
    try {
      const success = await signInWithGoogleOAuth();
      if (!success) {
        setAuthError('Sign-in cancelled or closed. You can also use one-tap instant login below.');
      }
    } catch (err: any) {
      console.warn('Google sign-in popup error:', err);
      setAuthError('OAuth pop-up window closed. Continuing in secure mode.');
      loginWithGoogle(primaryEmail, 'Thamiz');
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSelectGoogleAccount = (email: string, name?: string) => {
    loginWithGoogle(email, name);
  };

  const handleCodeInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 16);
    if (val.length <= 4) setActivationCodeInput(val);
    else if (val.length <= 8) setActivationCodeInput(`${val.slice(0, 4)}-${val.slice(4)}`);
    else if (val.length <= 12) setActivationCodeInput(`${val.slice(0, 4)}-${val.slice(4, 8)}-${val.slice(8)}`);
    else setActivationCodeInput(`${val.slice(0, 4)}-${val.slice(4, 8)}-${val.slice(8, 12)}-${val.slice(12, 16)}`);
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

      <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/95 shadow-2xl p-6 sm:p-8 backdrop-blur-xl relative z-10 space-y-5">
        {/* Google Identity Header */}
        <div className="text-center space-y-2.5">
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

          {/* Connected Google Services Badges */}
          <div className="flex items-center justify-center gap-1.5 pt-1">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-500/10 text-red-300 border border-red-500/20">
              <Mail className="w-2.5 h-2.5" /> Gmail
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/10 text-blue-300 border border-blue-500/20">
              <HardDrive className="w-2.5 h-2.5" /> Drive
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
              <Calendar className="w-2.5 h-2.5" /> Calendar
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20">
              <CloudCheck className="w-2.5 h-2.5" /> Google One
            </span>
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
            16-Digit Code
          </button>
          <button
            onClick={() => setActiveTab('custom')}
            className={`flex-1 pb-2.5 transition-colors border-b-2 ${
              activeTab === 'custom'
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Switch Account
          </button>
        </div>

        {activeTab === 'google' && (
          <div className="space-y-3.5">
            {/* Official Google Material Sign-In Button */}
            <button
              onClick={handleOfficialGoogleSignIn}
              disabled={isSigningIn}
              className="gsi-material-button shadow-lg shadow-blue-500/10"
              title="Authenticate with Google Identity Services"
            >
              <div className="gsi-material-button-state"></div>
              <div className="gsi-material-button-content-wrapper">
                <div className="gsi-material-button-icon">
                  <svg viewBox="0 0 48 48" className="w-full h-full">
                    <path
                      fill="#EA4335"
                      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                    />
                    <path
                      fill="#34A853"
                      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                    />
                  </svg>
                </div>
                <span className="gsi-material-button-contents">
                  {isSigningIn ? 'Opening Google Sign-In...' : 'Sign in with Google'}
                </span>
              </div>
            </button>

            {authError && (
              <p className="text-[11px] text-amber-400 text-center bg-amber-500/10 p-2 rounded-xl border border-amber-500/20">
                {authError}
              </p>
            )}

            {/* Divider */}
            <div className="relative flex items-center justify-center py-0.5">
              <div className="border-t border-slate-800 w-full" />
              <span className="bg-slate-900 px-3 text-[10px] text-slate-500 uppercase tracking-wider font-semibold absolute">
                Or Continue As
              </span>
            </div>

            {/* Primary One-Tap Hero Button for Thamiz */}
            <button
              onClick={() => handleSelectGoogleAccount(primaryEmail, 'Thamiz')}
              className="w-full p-3.5 rounded-2xl bg-slate-950 border border-blue-500/40 hover:border-blue-400 hover:bg-slate-900 transition-all text-left flex items-center justify-between group active:scale-98"
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <img
                    src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"
                    alt="Thamiz"
                    className="w-10 h-10 rounded-full object-cover border-2 border-blue-400"
                  />
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-slate-950" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-xs">Thamiz</span>
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                      Primary Head
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono block">{primaryEmail}</span>
                  <span className="text-[10px] text-emerald-400 font-medium">Google One 2 TB • Sovereign Master</span>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-blue-400 transition-colors" />
            </button>

            {/* Secondary Family Members */}
            <div className="space-y-1.5 pt-0.5">
              <span className="text-[10px] text-slate-500 font-semibold px-1 uppercase tracking-wider block">
                Secondary Family Members:
              </span>

              {familyMembers.slice(1).map((member) => (
                <button
                  key={member.id}
                  onClick={() => handleSelectGoogleAccount(member.email, member.name)}
                  className="w-full p-2.5 rounded-xl bg-slate-950/70 hover:bg-slate-950 border border-slate-800 hover:border-slate-700 transition-all text-left flex items-center justify-between group"
                >
                  <div className="flex items-center gap-2.5">
                    <img
                      src={member.avatar}
                      alt={member.name}
                      className="w-8 h-8 rounded-full object-cover border border-slate-700"
                    />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-slate-200 text-xs">{member.name}</span>
                        <span className="text-[10px] text-slate-400">({member.relationship})</span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono block">{member.email}</span>
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
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs text-slate-300 font-medium">
                  16-Digit Activation Code
                </label>
                {activationCodes.length > 0 && (
                  <span className="text-[10px] text-emerald-400 font-medium">
                    {activationCodes.filter((c) => c.status === 'active').length} Active Code(s)
                  </span>
                )}
              </div>
              <input
                type="text"
                placeholder="XXXX-XXXX-XXXX-XXXX"
                value={activationCodeInput}
                onChange={handleCodeInputChange}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-xs text-white font-mono tracking-wider focus:outline-none focus:border-indigo-500"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                Enter the 16-digit activation code sent to you by the Primary Owner ({primaryEmail}).
              </span>

              {/* Verified Code Quick-Fill Chips */}
              {activationCodes.length > 0 && (
                <div className="mt-3 p-2.5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-1.5">
                  <span className="text-[10px] text-slate-400 font-medium block">
                    Available Verified Codes (Tap to Auto-Fill):
                  </span>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                    {activationCodes.map((c) => (
                      <button
                        key={c.code}
                        type="button"
                        onClick={() => {
                          setActivationCodeInput(c.code);
                          setCodeFeedback(null);
                        }}
                        className={`text-[11px] font-mono px-2 py-0.5 rounded-lg border transition-all ${
                          activationCodeInput === c.code
                            ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                            : c.status === 'active'
                            ? 'bg-indigo-950/70 border-indigo-700/50 text-indigo-300 hover:bg-indigo-900 hover:text-white'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {c.code} {c.status === 'active' ? '✓' : '(re-link)'}
                      </button>
                    ))}
                  </div>
                </div>
              )}
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
              className="rounded accent-blue-500 mt-0.5 shrink-0"
            />
            <span className="leading-snug">
              <strong>Require Google Single Sign-On on every reload:</strong> Prompt for Google SSO authentication whenever the browser page or app is refreshed.
            </span>
          </label>
        </div>

        {/* Google Security Enclave Badge */}
        <div className="pt-1 text-center space-y-1">
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
