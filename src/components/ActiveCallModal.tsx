import React, { useState } from 'react';
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Pause,
  Play,
  Grid,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  FileText,
  Check,
  Send,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { playDtmfTone, makeNativeDirectCall } from '../services/phoneService';

export const ActiveCallModal: React.FC = () => {
  const {
    activeCall,
    endActiveCall,
    toggleCallMute,
    toggleCallSpeaker,
    toggleCallHold,
    toggleCallAiCoPilot,
  } = useApp();

  const [showKeypad, setShowKeypad] = useState(false);
  const [callNotesInput, setCallNotesInput] = useState('');
  const [notesSubmitted, setNotesSubmitted] = useState(false);

  if (!activeCall) return null;

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleKeyPress = (digit: string) => {
    playDtmfTone(digit);
  };

  const handleCellularSwitch = () => {
    makeNativeDirectCall(activeCall.phone);
  };

  const handleEndCall = () => {
    endActiveCall(callNotesInput || undefined);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-2xl flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-sm sm:max-w-md rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden flex flex-col relative text-white">
        {/* Top Sovereign Security Status Bar */}
        <div className="p-3.5 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-emerald-400">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span className="font-semibold text-[11px] uppercase tracking-wider">
              Sovereign Direct Voice
            </span>
          </div>

          <button
            onClick={handleCellularSwitch}
            className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] border border-slate-700 transition-colors"
            title="Switch immediately to Native Cellular / Carrier Call"
          >
            <Phone className="w-3 h-3 text-emerald-400" />
            <span>Switch to Cellular</span>
            <ExternalLink className="w-2.5 h-2.5 text-slate-400" />
          </button>
        </div>

        {/* Caller Center Display */}
        <div className="py-8 px-6 flex flex-col items-center text-center space-y-3 relative overflow-hidden">
          {/* Animated Radial Waves */}
          <div className="relative">
            {activeCall.status === 'connected' && !activeCall.isOnHold && (
              <span className="absolute -inset-2.5 rounded-full bg-emerald-500/20 animate-ping" />
            )}
            {activeCall.status === 'ringing' && (
              <span className="absolute -inset-2.5 rounded-full bg-indigo-500/20 animate-pulse" />
            )}
            <img
              src={activeCall.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(activeCall.contactName)}&background=0D9488&color=fff`}
              alt={activeCall.contactName}
              className="w-24 h-24 rounded-full object-cover border-4 border-slate-800 shadow-xl relative z-10"
            />
          </div>

          <div>
            <h3 className="text-xl font-bold text-white tracking-tight">
              {activeCall.contactName}
            </h3>
            {activeCall.relationship && (
              <p className="text-xs text-indigo-400 font-medium">
                {activeCall.relationship}
              </p>
            )}
            <p className="font-mono text-xs text-slate-400 mt-0.5">
              {activeCall.phone}
            </p>
          </div>

          {/* Status & Timer */}
          <div className="pt-1">
            {activeCall.status === 'ringing' && (
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold animate-pulse">
                <span>Ringing Line...</span>
              </div>
            )}
            {activeCall.status === 'connected' && (
              <div className="flex flex-col items-center gap-1">
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>{formatDuration(activeCall.durationSeconds)}</span>
                  {activeCall.isMuted && <span className="text-rose-400 font-sans text-[10px]">• Muted</span>}
                  {activeCall.isOnHold && <span className="text-amber-400 font-sans text-[10px]">• On Hold</span>}
                </div>
              </div>
            )}
            {activeCall.status === 'ended' && (
              <div className="px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-semibold">
                <span>Call Ended</span>
              </div>
            )}
          </div>
        </div>

        {/* Auro Assistant In-Call Co-pilot Stream */}
        {activeCall.aiCoPilotEnabled && (
          <div className="mx-4 mb-3 p-3 rounded-2xl bg-slate-950/80 border border-slate-800 text-xs space-y-2">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1 font-semibold text-indigo-300">
                <Sparkles className="w-3 h-3 text-indigo-400" />
                <span>Auro Call Assistant Active</span>
              </span>
              <span className="text-[10px] text-slate-500">Live Briefing</span>
            </div>

            <div className="text-[11px] text-slate-300 space-y-1">
              <p className="line-clamp-2 italic text-slate-400">
                {activeCall.relationship?.includes('Spouse')
                  ? 'Key context: 8:30 PM dinner coordination, Maaran robotics algorithm milestone.'
                  : activeCall.relationship?.includes('Partner')
                  ? 'Key context: Series B escrow confirmation, wire synchronization with counsel.'
                  : 'Call notes will be automatically summarized and converted to follow-up tasks.'}
              </p>
            </div>

            {/* Quick Live Note Input */}
            <div className="flex items-center gap-1.5 pt-1 border-t border-slate-800/80">
              <input
                type="text"
                placeholder="Type in-call notes (saved to AI summary)..."
                value={callNotesInput}
                onChange={(e) => setCallNotesInput(e.target.value)}
                className="flex-1 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700/60 text-[11px] text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
              <button
                type="button"
                onClick={() => {
                  setNotesSubmitted(true);
                  setTimeout(() => setNotesSubmitted(false), 2000);
                }}
                disabled={!callNotesInput.trim()}
                className="px-2 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-[10px] font-semibold flex items-center gap-1 transition-colors"
              >
                {notesSubmitted ? <Check className="w-3 h-3 text-emerald-300" /> : <Send className="w-3 h-3" />}
              </button>
            </div>
          </div>
        )}

        {/* Interactive In-Call DTMF Keypad (Collapsible) */}
        {showKeypad && (
          <div className="mx-4 mb-3 p-3 rounded-2xl bg-slate-950 border border-slate-800">
            <div className="grid grid-cols-3 gap-2 max-w-[240px] mx-auto text-center font-semibold">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map((key) => (
                <button
                  key={key}
                  onClick={() => handleKeyPress(key)}
                  className="py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-indigo-600 text-white text-base font-mono transition-colors shadow-sm"
                >
                  {key}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Controls Grid */}
        <div className="p-4 bg-slate-950/70 border-t border-slate-800 space-y-4">
          <div className="grid grid-cols-4 gap-2 text-center text-[10px] text-slate-300">
            {/* Mute */}
            <button
              onClick={toggleCallMute}
              className={`p-3 rounded-2xl flex flex-col items-center gap-1.5 transition-colors ${
                activeCall.isMuted
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              }`}
            >
              {activeCall.isMuted ? <MicOff className="w-5 h-5 text-rose-400" /> : <Mic className="w-5 h-5" />}
              <span>{activeCall.isMuted ? 'Muted' : 'Mute'}</span>
            </button>

            {/* Keypad */}
            <button
              onClick={() => setShowKeypad(!showKeypad)}
              className={`p-3 rounded-2xl flex flex-col items-center gap-1.5 transition-colors ${
                showKeypad
                  ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              }`}
            >
              <Grid className="w-5 h-5" />
              <span>Keypad</span>
            </button>

            {/* Speaker */}
            <button
              onClick={toggleCallSpeaker}
              className={`p-3 rounded-2xl flex flex-col items-center gap-1.5 transition-colors ${
                activeCall.isSpeakerOn
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              }`}
            >
              {activeCall.isSpeakerOn ? <Volume2 className="w-5 h-5 text-emerald-400" /> : <VolumeX className="w-5 h-5" />}
              <span>Speaker</span>
            </button>

            {/* Hold */}
            <button
              onClick={toggleCallHold}
              className={`p-3 rounded-2xl flex flex-col items-center gap-1.5 transition-colors ${
                activeCall.isOnHold
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              }`}
            >
              {activeCall.isOnHold ? <Play className="w-5 h-5 text-amber-400" /> : <Pause className="w-5 h-5" />}
              <span>{activeCall.isOnHold ? 'Resume' : 'Hold'}</span>
            </button>
          </div>

          {/* End Call Button */}
          <div className="flex items-center justify-center pt-2">
            <button
              onClick={handleEndCall}
              className="w-16 h-16 rounded-full bg-rose-600 hover:bg-rose-500 active:scale-95 text-white flex items-center justify-center shadow-lg shadow-rose-900/50 transition-all"
              title="End call and generate AI briefing"
            >
              <PhoneOff className="w-7 h-7" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
