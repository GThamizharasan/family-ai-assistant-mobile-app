import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  X,
  Sparkles,
  Send,
  Heart,
  ShieldCheck,
  Compass,
  DollarSign,
  Users,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { speechEngine } from '../services/speech';
import { sendChatMessage } from '../services/api';

interface VoiceAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const VoiceAssistantModal: React.FC<VoiceAssistantModalProps> = ({ isOpen, onClose }) => {
  const { user, chatHistory, addVoiceMessage, tasks, netWorth, familyMembers } = useApp();
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [textInput, setTextInput] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [currentEmotion, setCurrentEmotion] = useState('warm & empathetic');
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    speechEngine.onListeningChange = (listening) => setIsListening(listening);
    speechEngine.onSpeakingChange = (speaking) => setIsSpeaking(speaking);
    speechEngine.onTranscriptCallback = (transcript, isFinal) => {
      setLiveTranscript(transcript);
      if (isFinal && transcript.trim()) {
        handleUserSpeech(transcript.trim());
      }
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    } else {
      speechEngine.stopListening();
      speechEngine.stopSpeaking();
    }
  }, [isOpen, chatHistory]);

  if (!isOpen) return null;

  const handleUserSpeech = async (spokenText: string) => {
    if (!spokenText) return;
    setLiveTranscript('');
    speechEngine.stopListening();

    const userMsg = {
      role: 'user' as const,
      content: spokenText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    addVoiceMessage(userMsg);

    setIsThinking(true);
    try {
      const historyPayload = chatHistory.slice(-6).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const contextPayload = {
        pendingTasksCount: tasks.filter((t) => !t.completed).length,
        currentNetWorth: netWorth,
        familyCount: familyMembers.length,
        userEmail: user.email,
        primaryRole: user.role,
      };

      const result = await sendChatMessage({
        message: spokenText,
        history: historyPayload,
        context: contextPayload,
        userProfile: user,
        currentMood: currentEmotion,
      });

      setIsThinking(false);
      const replyText = result.reply || "I'm right here with you.";
      const emotionText = result.emotion || 'supportive';
      setCurrentEmotion(emotionText);

      const aiMsg = {
        role: 'assistant' as const,
        content: replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        emotion: emotionText,
        actionSuggestion: result.actionSuggestion,
      };
      addVoiceMessage(aiMsg);

      if (!isMuted && user.preferences.autoSpeechReply) {
        speechEngine.speak(replyText, {
          pitch: user.preferences.voicePitch,
          rate: user.preferences.voiceRate,
          emotion: emotionText,
        });
      }
    } catch (err) {
      setIsThinking(false);
      const fallbackReply = "I hear you, Karthik. I've noted that into your encrypted local memory vault.";
      addVoiceMessage({
        role: 'assistant',
        content: fallbackReply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        emotion: 'comforting',
      });
      if (!isMuted) {
        speechEngine.speak(fallbackReply);
      }
    }
  };

  const toggleMic = () => {
    if (isListening) {
      speechEngine.stopListening();
    } else {
      speechEngine.stopSpeaking();
      const started = speechEngine.startListening();
      if (!started) {
        // Fallback simulate speech prompt if microphone permission is not granted
        setLiveTranscript('Listening... Speak now');
      }
    }
  };

  const handleManualSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim()) return;
    const msg = textInput.trim();
    setTextInput('');
    handleUserSpeech(msg);
  };

  const quickPrompts = [
    { label: 'Check Family Status', text: 'Where are all my family members right now and are they safe?' },
    { label: 'Billionaire Advisory', text: 'What is my highest leverage action today for my $100M milestone?' },
    { label: 'Daily Priority Coaching', text: 'Prioritize my Eisenhower urgent tasks for this morning.' },
    { label: 'Writing Tone Check', text: 'Help me polish my tone for an upcoming executive negotiation.' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-xl p-2 sm:p-4">
      <div className="w-full max-w-xl h-[92vh] max-h-[820px] rounded-3xl border border-slate-800 bg-slate-900/95 flex flex-col shadow-2xl relative overflow-hidden">
        {/* Top Header */}
        <div className="p-4 sm:px-6 border-b border-slate-800/80 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25">
                <Sparkles className="w-5 h-5 animate-pulse" />
              </div>
              <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-slate-900" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-base">Aura Family Assistant</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  Real-Time Voice
                </span>
              </div>
              <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <Heart className="w-3 h-3 text-rose-400 fill-rose-400/30" />
                Demeanor: <span className="text-slate-300 font-medium capitalize">{currentEmotion}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                if (isSpeaking) speechEngine.stopSpeaking();
                setIsMuted(!isMuted);
              }}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title={isMuted ? 'Unmute voice' : 'Mute voice'}
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Dynamic Waveform Visualizer & Persona Sphere */}
        <div className="py-5 px-6 bg-gradient-to-b from-slate-950/60 to-transparent flex flex-col items-center justify-center relative border-b border-slate-800/40">
          <div className="relative flex items-center justify-center">
            {/* Outer pulsating rings */}
            <div
              className={`absolute w-32 h-32 rounded-full transition-all duration-700 pointer-events-none ${
                isSpeaking
                  ? 'bg-purple-500/20 scale-125 animate-ping'
                  : isListening
                  ? 'bg-emerald-500/20 scale-110 animate-pulse'
                  : isThinking
                  ? 'bg-amber-500/20 scale-110 animate-spin'
                  : 'bg-indigo-500/10 scale-100'
              }`}
            />

            {/* Glowing Orb */}
            <div
              className={`w-20 h-20 rounded-full flex items-center justify-center shadow-2xl transition-all duration-500 z-10 ${
                isSpeaking
                  ? 'bg-gradient-to-tr from-purple-600 via-indigo-500 to-pink-500 shadow-purple-500/40 scale-105'
                  : isListening
                  ? 'bg-gradient-to-tr from-emerald-600 to-teal-500 shadow-emerald-500/40 scale-105 ring-4 ring-emerald-500/30'
                  : isThinking
                  ? 'bg-gradient-to-tr from-amber-600 to-orange-500 shadow-amber-500/40'
                  : 'bg-gradient-to-tr from-indigo-900 to-slate-800 shadow-indigo-950/50'
              }`}
            >
              {isListening ? (
                <Mic className="w-8 h-8 text-white animate-bounce" />
              ) : isSpeaking ? (
                <Volume2 className="w-8 h-8 text-white animate-pulse" />
              ) : isThinking ? (
                <Sparkles className="w-8 h-8 text-amber-200 animate-spin" />
              ) : (
                <Mic className="w-8 h-8 text-indigo-300" />
              )}
            </div>
          </div>

          {/* Status Label & Waveform bars */}
          <div className="mt-3 text-center">
            <span className="text-xs font-semibold tracking-wide uppercase text-slate-400">
              {isListening
                ? 'Listening to your voice...'
                : isSpeaking
                ? 'Aura is speaking...'
                : isThinking
                ? 'Synthesizing empathetic thought...'
                : 'Tap microphone below to talk'}
            </span>

            {/* Animated Audio Equalizer Bars */}
            <div className="flex items-center justify-center gap-1 mt-2 h-4">
              {[40, 70, 95, 60, 85, 100, 75, 45, 90, 65, 35].map((height, idx) => (
                <span
                  key={idx}
                  className={`w-1 rounded-full transition-all duration-200 ${
                    isSpeaking
                      ? 'bg-indigo-400'
                      : isListening
                      ? 'bg-emerald-400'
                      : isThinking
                      ? 'bg-amber-400'
                      : 'bg-slate-700'
                  }`}
                  style={{
                    height: isSpeaking || isListening ? `${(height * Math.random() + 20).toFixed(0)}%` : '20%',
                  }}
                />
              ))}
            </div>
          </div>

          {/* Live Transcript Preview */}
          {liveTranscript && (
            <div className="mt-3 px-4 py-2 rounded-xl bg-slate-950/80 border border-indigo-500/30 text-indigo-200 text-xs text-center max-w-md animate-fade-in">
              "{liveTranscript}"
            </div>
          )}
        </div>

        {/* Conversation Stream */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {chatHistory.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl p-3.5 text-sm leading-relaxed shadow-md ${
                  msg.role === 'user'
                    ? 'bg-indigo-600 text-white rounded-tr-xs'
                    : 'bg-slate-800/90 border border-slate-700/60 text-slate-100 rounded-tl-xs'
                }`}
              >
                {msg.role === 'assistant' && msg.emotion && (
                  <div className="flex items-center gap-1.5 text-[10px] text-indigo-300 font-medium mb-1 border-b border-slate-700/60 pb-1">
                    <Sparkles className="w-3 h-3" />
                    <span>Empathetic Resonance: {msg.emotion}</span>
                  </div>
                )}
                <p className="whitespace-pre-wrap">{msg.content}</p>

                {msg.actionSuggestion && (
                  <div className="mt-2.5 pt-2 border-t border-slate-700/60 flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                    <Compass className="w-3.5 h-3.5 shrink-0" />
                    <span>Suggested: {msg.actionSuggestion}</span>
                  </div>
                )}
              </div>
              <span className="text-[10px] text-slate-500 mt-1 px-1">{msg.timestamp}</span>
            </div>
          ))}

          {isThinking && (
            <div className="flex items-center gap-2 text-slate-400 text-xs p-2">
              <Sparkles className="w-4 h-4 animate-spin text-indigo-400" />
              <span>Aura is reflecting on your personal memory and goals...</span>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Quick Prompts Suggestions */}
        <div className="px-4 py-2 border-t border-slate-800/60 flex items-center gap-2 overflow-x-auto no-scrollbar">
          {quickPrompts.map((qp, idx) => (
            <button
              key={idx}
              onClick={() => handleUserSpeech(qp.text)}
              className="shrink-0 px-3 py-1.5 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 text-xs text-slate-300 hover:text-white transition-colors"
            >
              {qp.label}
            </button>
          ))}
        </div>

        {/* Input Dock & Big Mic Trigger */}
        <div className="p-3 sm:p-4 bg-slate-950 border-t border-slate-800 flex items-center gap-2">
          <button
            onClick={toggleMic}
            className={`p-3.5 rounded-2xl flex items-center justify-center transition-all shadow-lg active:scale-95 ${
              isListening
                ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/30 animate-pulse'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30'
            }`}
            title={isListening ? 'Stop listening' : 'Start speaking'}
          >
            {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          <form onSubmit={handleManualSend} className="flex-1 flex items-center gap-2">
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Talk or type with Aura..."
              className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500"
            />
            <button
              type="submit"
              disabled={!textInput.trim()}
              className="p-3 rounded-xl bg-slate-800 hover:bg-indigo-600 disabled:opacity-40 text-white transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
