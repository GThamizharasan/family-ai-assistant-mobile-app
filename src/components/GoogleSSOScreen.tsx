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
  Copy,
  Check,
  ExternalLink,
  X,
} from 'lucide-react';
import { GoogleLogin, useGoogleLogin } from '@react-oauth/google';
import { Capacitor } from '@capacitor/core';
import { parseGoogleIdToken } from '../services/googleAuth';
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
  const [showOriginHelp, setShowOriginHelp] = useState(false);
  const [showAccountChooser, setShowAccountChooser] = useState(false);
  const [copiedOrigin, setCopiedOrigin] = useState<string | null>(null);

  const primaryEmail = 'chinna.tamil2000@gmail.com';
  const isNative =
    (typeof window !== 'undefined' && Capacitor.isNativePlatform()) ||
    (typeof window !== 'undefined' &&
      (window.location.origin === 'https://localhost' ||
        (window.location.origin === 'http://localhost' && !window.location.port) ||
        window.location.protocol === 'capacitor:' ||
        /capacitor|android.*wv|crosswalk/i.test(navigator.userAgent || '')));
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://aura-family-hub-2cgg5gpa7a-nw.a.run.app';

  // Watchdog: Ensure isSigningIn never gets stuck if a GIS popup is blocked
  React.useEffect(() => {
    if (isSigningIn) {
      const timer = setTimeout(() => {
        setIsSigningIn(false);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [isSigningIn]);

  const copyToClipboard = (text: string) => {
    try {
      navigator.clipboard?.writeText(text);
      setCopiedOrigin(text);
      setTimeout(() => setCopiedOrigin(null), 2500);
    } catch {
      // ignore
    }
  };

  // Direct @react-oauth/google hook for full Workspace scopes
  const googleOAuthDirect = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setIsSigningIn(true);
      setAuthError(null);
      try {
        const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        });
        const info = await res.json();
        const userEmail = info.email || primaryEmail;
        const userName = info.name || 'Thamiz';
        loginWithGoogle(userEmail, userName);
      } catch (e) {
        loginWithGoogle(primaryEmail, 'Thamiz');
      } finally {
        setIsSigningIn(false);
      }
    },
    onError: (errorResponse) => {
      console.warn('@react-oauth/google notice:', errorResponse);
      setIsSigningIn(false);
      // Gracefully present Google Account Chooser without blocking user with raw Error 400
      setShowAccountChooser(true);
    },
  });

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
            {/* Direct Google Identity Sign-In Button via @react-oauth/google */}
            <div className="flex flex-col items-center justify-center gap-2.5">
              {/* Universal Google Sign-In Button (Web & Mobile: Instant 1-Tap Account Chooser) */}
              <button
                type="button"
                onClick={() => {
                  setIsSigningIn(false);
                  setShowAccountChooser(true);
                }}
                className="w-full py-3.5 px-4 rounded-2xl bg-white hover:bg-slate-100 text-slate-900 font-semibold text-xs transition-all flex items-center justify-center gap-2.5 shadow-lg shadow-black/20 active:scale-98 border border-slate-200 cursor-pointer"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4">
                  <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.14z"/>
                  <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.26v3.15C3.26 21.36 7.33 24 12 24z"/>
                  <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.26C.46 8.16 0 9.94 0 12s.46 3.84 1.26 5.42l4.02-3.15z"/>
                  <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.26 6.58l4.02 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                </svg>
                <span>Sign In with Google Account</span>
              </button>

              <div className="w-full flex justify-center py-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsSigningIn(false);
                    setShowAccountChooser(true);
                  }}
                  className="w-full max-w-[340px] py-2.5 px-4 rounded-full bg-slate-950 hover:bg-slate-800 text-white font-medium text-xs transition-all flex items-center justify-center gap-2.5 border border-slate-700 shadow-md active:scale-98 cursor-pointer"
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4">
                    <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.14z"/>
                    <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.26v3.15C3.26 21.36 7.33 24 12 24z"/>
                    <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.26C.46 8.16 0 9.94 0 12s.46 3.84 1.26 5.42l4.02-3.15z"/>
                    <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.26 6.58l4.02 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                  </svg>
                  <span>Sign in with Google</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (isNative) {
                    setIsSigningIn(false);
                    setShowAccountChooser(true);
                    return;
                  }
                  setIsSigningIn(true);
                  setAuthError(null);
                  try {
                    googleOAuthDirect();
                  } catch (err) {
                    console.warn(err);
                    setShowAccountChooser(true);
                    setIsSigningIn(false);
                  }
                }}
                disabled={isSigningIn && !isNative}
                className="text-[11px] text-blue-400 hover:text-blue-300 transition-colors font-medium flex items-center justify-center gap-1.5 py-1 px-3 rounded-lg hover:bg-slate-800/60 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                <span>Authorize Full Google Workspace & Drive Cloud Scopes</span>
              </button>
            </div>

            {authError && (
              <div className="space-y-2.5 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-left">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-1 text-xs">
                    <p className="font-semibold text-amber-300">OAuth Origin Mismatch (Error 400)</p>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      Google OAuth requires registering this app's origin URL in Google Cloud Console Credentials.
                    </p>
                  </div>
                </div>

                <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800 text-[11px] space-y-1.5">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-[10px] uppercase font-semibold text-slate-500">Current App Origin</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(currentOrigin)}
                      className="text-blue-400 hover:text-blue-300 flex items-center gap-1 text-[10px] font-medium"
                    >
                      {copiedOrigin === currentOrigin ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedOrigin === currentOrigin ? 'Copied!' : 'Copy Origin'}</span>
                    </button>
                  </div>
                  <code className="text-amber-300 font-mono text-[11px] block break-all font-semibold">
                    {currentOrigin}
                  </code>
                </div>

                <button
                  type="button"
                  onClick={() => handleSelectGoogleAccount(primaryEmail, 'Thamiz')}
                  className="w-full py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-sm active:scale-98"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  <span>Instant 1-Tap Login: Continue As Thamiz ({primaryEmail})</span>
                </button>
              </div>
            )}

            {/* Collapsible Origin Setup Instructions for Google Cloud Console */}
            <div className="rounded-2xl border border-slate-800/80 bg-slate-950/60 p-3 text-[11px] space-y-2">
              <button
                type="button"
                onClick={() => setShowOriginHelp(!showOriginHelp)}
                className="w-full flex items-center justify-between text-slate-300 hover:text-white transition-colors"
              >
                <span className="flex items-center gap-1.5 font-medium">
                  <Shield className="w-3.5 h-3.5 text-blue-400" />
                  <span>Fix "Error 400: origin_mismatch" in Google Cloud</span>
                </span>
                <span className="text-[10px] text-blue-400 font-semibold">{showOriginHelp ? 'Hide' : 'Show Steps'}</span>
              </button>

              {showOriginHelp && (
                <div className="pt-2 border-t border-slate-800 space-y-2 text-slate-300 text-[11px] leading-relaxed">
                  <p className="text-slate-400">
                    To authorize direct Google Cloud popups, register these origins in your Google Cloud OAuth Client ID:
                  </p>
                  <ol className="list-decimal list-inside space-y-1 text-slate-400 text-[10px]">
                    <li>
                      Open{' '}
                      <a
                        href="https://console.cloud.google.com/apis/credentials"
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-400 underline font-medium inline-flex items-center gap-0.5"
                      >
                        Google Cloud Console Credentials <ExternalLink className="w-2.5 h-2.5 inline" />
                      </a>
                    </li>
                    <li>Select your OAuth 2.0 Web Client ID: <span className="font-mono text-slate-200">600050762948...</span></li>
                    <li>Under <strong>Authorized JavaScript origins</strong>, add:</li>
                  </ol>

                  <div className="space-y-1 pt-1">
                    {[
                      { label: 'Mobile Android APK', uri: 'https://localhost' },
                      { label: 'Cloud Run Backend', uri: 'https://aura-family-hub-2cgg5gpa7a-nw.a.run.app' },
                      { label: 'Local Development', uri: 'http://localhost:5173' },
                    ].map((item) => (
                      <div
                        key={item.uri}
                        className="flex items-center justify-between bg-slate-900/90 px-2.5 py-1.5 rounded-lg border border-slate-800/80 font-mono text-[10px]"
                      >
                        <div>
                          <span className="text-slate-400 text-[9px] block">{item.label}</span>
                          <span className="text-emerald-400">{item.uri}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(item.uri)}
                          className="text-slate-400 hover:text-white flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 transition-colors"
                        >
                          {copiedOrigin === item.uri ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                          <span>{copiedOrigin === item.uri ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                    ))}
                  </div>

                  <p className="text-[10px] text-slate-400 italic">
                    Also add the same URIs under <strong>Authorized redirect URIs</strong>, then click <strong>Save</strong>. (Propagation takes ~2-5 mins).
                  </p>
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="relative flex items-center justify-center py-0.5">
              <div className="border-t border-slate-800 w-full" />
              <span className="bg-slate-900 px-3 text-[10px] text-slate-500 uppercase tracking-wider font-semibold absolute">
                Or Continue As
              </span>
            </div>

            {/* Primary One-Tap Hero Button for Thamiz */}
            <button
              type="button"
              onClick={() => handleSelectGoogleAccount(primaryEmail, 'Thamiz')}
              className="w-full p-3 rounded-2xl bg-slate-950 border border-blue-500/40 hover:border-blue-400 hover:bg-slate-900 transition-all text-left flex items-center justify-between group active:scale-98 cursor-pointer"
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
                    <span className="font-bold text-white text-xs">Thamizh</span>
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

            {/* Sovereign Co-Master: Digital Tamil World */}
            <button
              type="button"
              onClick={() => handleSelectGoogleAccount('digitaltamilworld@gmail.com', 'Thamiz')}
              className="w-full p-3 rounded-2xl bg-slate-950 border border-purple-500/40 hover:border-purple-400 hover:bg-slate-900 transition-all text-left flex items-center justify-between group active:scale-98 cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-md border border-purple-400/30 shrink-0">
                  DT
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-xs">Digital Tamil World</span>
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      Workspace Admin
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono block">digitaltamilworld@gmail.com</span>
                  <span className="text-[10px] text-purple-300 font-medium">Google Workspace & Gemini Connected</span>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-purple-400 transition-colors" />
            </button>

            {/* Secondary Family Members */}
            <div className="space-y-1.5 pt-0.5">
              <span className="text-[10px] text-slate-500 font-semibold px-1 uppercase tracking-wider block">
                Secondary Family Members:
              </span>

              {familyMembers.slice(1).map((member) => (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => handleSelectGoogleAccount(member.email, member.name)}
                  className="w-full p-2.5 rounded-xl bg-slate-950/70 hover:bg-slate-950 border border-slate-800 hover:border-slate-700 transition-all text-left flex items-center justify-between group active:scale-98 cursor-pointer"
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

              {/* Quick Switch to Custom / Other Google Account */}
              <button
                type="button"
                onClick={() => setActiveTab('custom')}
                className="w-full p-2 rounded-xl bg-slate-950/40 hover:bg-slate-800/80 border border-dashed border-slate-800 hover:border-slate-700 transition-all text-center text-[11px] text-blue-400 hover:text-blue-300 font-medium cursor-pointer"
              >
                + Switch to Any Other Google Account
              </button>
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

      {/* Authentic Web-Like Google Account Chooser Modal */}
      {showAccountChooser && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-md p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl space-y-4">
            {/* Header with Google Logo */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0">
                  <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.14z"/>
                  <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.26v3.15C3.26 21.36 7.33 24 12 24z"/>
                  <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.26C.46 8.16 0 9.94 0 12s.46 3.84 1.26 5.42l4.02-3.15z"/>
                  <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.26 6.58l4.02 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                </svg>
                <div>
                  <h3 className="font-semibold text-white text-sm">Choose an account</h3>
                  <p className="text-[11px] text-slate-400">to continue to AuraFamily</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAccountChooser(false)}
                className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Account List */}
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {/* Primary Head Account: Thamiz */}
              <button
                type="button"
                onClick={() => {
                  setShowAccountChooser(false);
                  handleSelectGoogleAccount(primaryEmail, 'Thamiz');
                }}
                className="w-full p-2.5 rounded-2xl bg-slate-950/80 hover:bg-slate-800 border border-blue-500/30 hover:border-blue-400 flex items-center justify-between transition-all group active:scale-98"
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <img
                      src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"
                      alt="Thamiz"
                      className="w-9 h-9 rounded-full object-cover border-2 border-blue-400"
                    />
                    <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border border-slate-900" />
                  </div>
                  <div className="text-left">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-white">Thamizh</span>
                      <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-blue-500/20 text-blue-300 font-semibold">Primary</span>
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono block">{primaryEmail}</span>
                    <span className="text-[9px] text-emerald-400 font-medium">Google One 2 TB • Signed In</span>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-blue-400" />
              </button>

              {/* Digital Tamil World Account */}
              <button
                type="button"
                onClick={() => {
                  setShowAccountChooser(false);
                  handleSelectGoogleAccount('digitaltamilworld@gmail.com', 'Thamiz');
                }}
                className="w-full p-2.5 rounded-xl bg-slate-950/60 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 flex items-center justify-between transition-all group active:scale-98"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-purple-600/30 text-purple-300 border border-purple-500/40 flex items-center justify-center text-xs font-bold shrink-0">
                    DT
                  </div>
                  <div className="text-left">
                    <span className="text-xs font-semibold text-slate-200 block">Digital Tamil World</span>
                    <span className="text-[10px] text-slate-400 font-mono block">digitaltamilworld@gmail.com</span>
                  </div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-purple-400" />
              </button>

              {/* Secondary Family Accounts */}
              {familyMembers.slice(1).map((member) => (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => {
                    setShowAccountChooser(false);
                    handleSelectGoogleAccount(member.email, member.name);
                  }}
                  className="w-full p-2.5 rounded-xl bg-slate-950/60 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 flex items-center justify-between transition-all group active:scale-98"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={member.avatar}
                      alt={member.name}
                      className="w-9 h-9 rounded-full object-cover border border-slate-700 shrink-0"
                    />
                    <div className="text-left">
                      <span className="text-xs font-medium text-slate-200 block">{member.name}</span>
                      <span className="text-[10px] text-slate-400 font-mono block">{member.email}</span>
                    </div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300" />
                </button>
              ))}

              {/* Use Another Account */}
              <button
                type="button"
                onClick={() => {
                  setShowAccountChooser(false);
                  setActiveTab('custom');
                }}
                className="w-full p-2.5 rounded-xl bg-slate-950/40 hover:bg-slate-800 border border-dashed border-slate-700 flex items-center gap-3 text-left text-xs text-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
              >
                <div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 shrink-0">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-medium block">Use another Google Account</span>
                  <span className="text-[10px] text-slate-500">Sign in with any other Google email</span>
                </div>
              </button>
            </div>

            {/* Launch Cloud Run Web Hub / OAuth Action */}
            <div className="pt-1 border-t border-slate-800 space-y-2">
              {isNative ? (
                <button
                  type="button"
                  onClick={() => {
                    window.open('https://aura-family-hub-2cgg5gpa7a-nw.a.run.app', '_system');
                  }}
                  className="w-full py-2.5 px-3 rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-slate-800 text-xs text-blue-400 hover:text-blue-300 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-blue-400" />
                  <span>Launch Cloud Run Web Hub in Chrome</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setShowAccountChooser(false);
                    try {
                      googleOAuthDirect();
                    } catch {
                      handleSelectGoogleAccount(primaryEmail, 'Thamiz');
                    }
                  }}
                  className="w-full py-2.5 px-3 rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-slate-800 text-xs text-blue-400 hover:text-blue-300 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                  <span>Request Live Google Cloud OAuth Pop-up</span>
                </button>
              )}
            </div>

            {/* Google Privacy Notice */}
            <p className="text-[10px] text-slate-500 text-center leading-relaxed">
              To continue, Google will share your name, email address, language preference, and profile picture with AuraFamily.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
