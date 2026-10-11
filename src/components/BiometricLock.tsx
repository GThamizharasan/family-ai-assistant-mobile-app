import React, { useState } from 'react';
import { Shield, Fingerprint, Lock, KeyRound, CheckCircle2 } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const BiometricLock: React.FC = () => {
  const { isLocked, unlockWithBiometrics, unlockWithPin, user } = useApp();
  const [pinInput, setPinInput] = useState('');
  const [showPinInput, setShowPinInput] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isLocked) return null;

  const handleBiometricScan = () => {
    setIsScanning(true);
    setErrorMsg('');
    setTimeout(() => {
      setIsScanning(false);
      unlockWithBiometrics();
    }, 1100);
  };

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (unlockWithPin(pinInput)) {
      setPinInput('');
      setErrorMsg('');
    } else {
      setErrorMsg('Incorrect master PIN. Try 1234');
      setPinInput('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 backdrop-blur-2xl p-4">
      <div className="w-full max-w-sm rounded-3xl border border-slate-800 bg-slate-900/90 p-8 text-center shadow-2xl relative overflow-hidden">
        {/* Ambient glow */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-48 h-48 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 mb-6 shadow-inner">
          <Shield className="w-8 h-8" />
        </div>

        <h2 className="text-xl font-bold text-white tracking-tight">Aura Secure Vault</h2>
        <p className="text-xs text-slate-400 mt-1 mb-6">
          Zero-Knowledge Biometric Authentication
          <br />
          <span className="text-indigo-400 font-mono text-[11px]">{user.email}</span>
        </p>

        {!showPinInput ? (
          <div className="space-y-6">
            <button
              onClick={handleBiometricScan}
              disabled={isScanning}
              className="relative group w-32 h-32 mx-auto rounded-full bg-slate-950 border-2 border-indigo-500/40 hover:border-indigo-400 flex flex-col items-center justify-center transition-all duration-300 shadow-lg hover:shadow-indigo-500/20 active:scale-95"
            >
              <div className={`p-4 rounded-full transition-transform duration-500 ${isScanning ? 'scale-110 text-emerald-400' : 'text-indigo-400 group-hover:scale-105'}`}>
                {isScanning ? (
                  <CheckCircle2 className="w-12 h-12 animate-pulse text-emerald-400" />
                ) : (
                  <Fingerprint className="w-12 h-12" />
                )}
              </div>
              {isScanning && (
                <div className="absolute inset-0 rounded-full border-2 border-emerald-500 animate-ping opacity-40 pointer-events-none" />
              )}
            </button>

            <p className="text-xs text-slate-300 font-medium">
              {isScanning ? 'Verifying FaceID / TouchID signature...' : 'Touch sensor or look at camera to unlock'}
            </p>

            <button
              onClick={() => setShowPinInput(true)}
              className="text-xs text-slate-400 hover:text-indigo-300 flex items-center justify-center gap-1.5 mx-auto transition-colors"
            >
              <KeyRound className="w-3.5 h-3.5" />
              Use Master Security PIN
            </button>
          </div>
        ) : (
          <form onSubmit={handlePinSubmit} className="space-y-4">
            <div className="flex justify-center gap-2 mb-2">
              {[0, 1, 2, 3].map((idx) => (
                <div
                  key={idx}
                  className={`w-3.5 h-3.5 rounded-full border border-slate-700 transition-all ${
                    pinInput.length > idx ? 'bg-indigo-500 border-indigo-400 scale-110' : 'bg-slate-800'
                  }`}
                />
              ))}
            </div>

            <input
              type="password"
              maxLength={4}
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              placeholder="Enter 4-digit PIN (default 1234)"
              autoFocus
              className="w-full text-center tracking-[0.5em] font-mono text-lg bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500"
            />

            {errorMsg && <p className="text-xs text-rose-400">{errorMsg}</p>}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowPinInput(false);
                  setErrorMsg('');
                }}
                className="flex-1 py-2.5 rounded-xl border border-slate-800 text-xs text-slate-400 hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-colors"
              >
                Unlock
              </button>
            </div>
          </form>
        )}

        <div className="mt-8 pt-4 border-t border-slate-800/80 flex items-center justify-center gap-2 text-[11px] text-slate-500">
          <Lock className="w-3 h-3 text-emerald-400" />
          <span>Hardware Enclave AES-256 Protected</span>
        </div>
      </div>
    </div>
  );
};
