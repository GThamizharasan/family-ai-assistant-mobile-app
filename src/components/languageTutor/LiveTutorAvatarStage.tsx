import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  Volume2,
  VolumeX,
  Gauge,
  RotateCcw,
  Sparkles,
  HeartHandshake,
  Ear,
  Award,
  MessageCircleHeart,
} from 'lucide-react';
import { TutorEmotion, TutorLanguage, TutorPersona } from '../../types/languageTutor';

interface LiveTutorAvatarStageProps {
  language: TutorLanguage;
  persona: TutorPersona;
  emotion: TutorEmotion;
  isSpeaking: boolean;
  isListening: boolean;
  autoSpeak: boolean;
  slowMode: boolean;
  showTransliteration: boolean;
  activeCaption?: string;
  activeCaptionTranslit?: string;
  activeCaptionMeaning?: string;
  onToggleAutoSpeak: () => void;
  onToggleSlowMode: () => void;
  onToggleTransliteration: () => void;
  onReplayLast: () => void;
}

const EMOTION_META: Record<
  TutorEmotion,
  { label: string; tamilLabel: string; badgeClass: string; haloColor: string }
> = {
  welcoming: {
    label: 'Warmly Welcoming',
    tamilLabel: 'அன்புடன் வரவேற்கிறார்',
    badgeClass: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40',
    haloColor: 'from-emerald-400/35 via-teal-400/25 to-cyan-400/35',
  },
  explaining: {
    label: 'Guiding Concept',
    tamilLabel: 'தெளிவாக விளக்குகிறார்',
    badgeClass: 'bg-sky-500/20 text-sky-200 border-sky-400/40',
    haloColor: 'from-sky-400/35 via-indigo-400/25 to-purple-400/35',
  },
  encouraging: {
    label: 'Cheering You On',
    tamilLabel: 'ஊக்கமளிக்கிறார்',
    badgeClass: 'bg-amber-500/20 text-amber-200 border-amber-400/40',
    haloColor: 'from-amber-400/35 via-orange-400/25 to-pink-400/35',
  },
  celebrating: {
    label: 'Celebrating Mastery!',
    tamilLabel: 'சிறப்பு! பாராட்டுகிறார்',
    badgeClass: 'bg-fuchsia-500/25 text-fuchsia-200 border-fuchsia-400/50',
    haloColor: 'from-fuchsia-400/40 via-amber-400/30 to-rose-400/40',
  },
  listening: {
    label: 'Listening Attentively...',
    tamilLabel: 'கவனமாகக் கேட்கிறார்...',
    badgeClass: 'bg-rose-500/25 text-rose-200 border-rose-400/50',
    haloColor: 'from-rose-400/40 via-pink-400/25 to-amber-400/35',
  },
  coaching: {
    label: 'Refining Pronunciation',
    tamilLabel: 'உச்சரிப்புப் பயிற்சி',
    badgeClass: 'bg-violet-500/20 text-violet-200 border-violet-400/40',
    haloColor: 'from-violet-400/35 via-purple-400/25 to-indigo-400/35',
  },
};

export const LiveTutorAvatarStage: React.FC<LiveTutorAvatarStageProps> = ({
  language,
  persona,
  emotion,
  isSpeaking,
  isListening,
  autoSpeak,
  slowMode,
  showTransliteration,
  activeCaption,
  activeCaptionTranslit,
  activeCaptionMeaning,
  onToggleAutoSpeak,
  onToggleSlowMode,
  onToggleTransliteration,
  onReplayLast,
}) => {
  const [mouthPhase, setMouthPhase] = useState(0);
  const [isBlinking, setIsBlinking] = useState(false);

  const effectiveEmotion: TutorEmotion = isListening ? 'listening' : emotion;
  const meta = EMOTION_META[effectiveEmotion] || EMOTION_META.welcoming;

  // Natural mouth animation synced while tutor speaks aloud
  useEffect(() => {
    if (!isSpeaking) {
      setMouthPhase(0);
      return;
    }
    const id = setInterval(() => {
      setMouthPhase((p) => (p + 1) % 4);
    }, 150);
    return () => clearInterval(id);
  }, [isSpeaking]);

  // Subtle lifelike eye blink every few seconds
  useEffect(() => {
    const blinkLoop = setInterval(() => {
      setIsBlinking(true);
      setTimeout(() => setIsBlinking(false), 140);
    }, 3600);
    return () => clearInterval(blinkLoop);
  }, []);

  const isTamil = language === 'tamil';

  const getMouthPath = () => {
    if (!isSpeaking) {
      if (effectiveEmotion === 'celebrating' || effectiveEmotion === 'encouraging') {
        return 'M 86 112 Q 100 124 114 112';
      }
      if (effectiveEmotion === 'listening') {
        return 'M 89 113 Q 100 119 111 113';
      }
      return 'M 87 112 Q 100 121 113 112';
    }
    switch (mouthPhase) {
      case 0:
        return 'M 87 112 Q 100 120 113 112 Q 100 118 87 112 Z';
      case 1:
        return 'M 88 110 Q 100 126 112 110 Q 100 116 88 110 Z';
      case 2:
        return 'M 91 111 Q 100 122 109 111 Q 100 113 91 111 Z';
      default:
        return 'M 86 111 Q 100 124 114 111 Q 100 115 86 111 Z';
    }
  };

  return (
    <div
      className={`rounded-3xl p-4 sm:p-5 border shadow-2xl relative overflow-hidden transition-all ${
        isTamil
          ? 'bg-gradient-to-br from-amber-950/75 via-rose-950/60 to-slate-900 border-amber-500/35'
          : 'bg-gradient-to-br from-indigo-950/80 via-slate-900 to-fuchsia-950/55 border-sky-500/35'
      }`}
    >
      {/* Ambient Animated Aurora Glow */}
      <div
        className={`pointer-events-none absolute -top-16 -right-16 w-56 h-56 rounded-full blur-3xl bg-gradient-to-br ${meta.haloColor} opacity-65`}
      />

      <div className="relative flex flex-col sm:flex-row items-center sm:items-start gap-4">
        {/* Expressive Animated Human Tutor Portrait */}
        <div className="relative shrink-0 flex flex-col items-center">
          <motion.div
            animate={
              isSpeaking
                ? { y: [0, -3, 0], rotate: [0, 1.2, -1.2, 0] }
                : isListening
                ? { scale: [1, 1.03, 1], rotate: [0, -1.5, 0] }
                : { y: [0, -1.5, 0] }
            }
            transition={{
              repeat: Infinity,
              duration: isSpeaking ? 1.4 : isListening ? 1.8 : 3.2,
              ease: 'easeInOut',
            }}
            className="relative w-32 h-32 sm:w-36 sm:h-36 rounded-full p-1 bg-gradient-to-tr from-white/25 via-amber-400/50 to-cyan-400/50 shadow-xl"
          >
            {/* Outer Pulse Halo while speaking or listening */}
            {(isSpeaking || isListening) && (
              <motion.div
                animate={{ scale: [1, 1.14, 1], opacity: [0.55, 0.15, 0.55] }}
                transition={{ repeat: Infinity, duration: 1.3 }}
                className={`absolute inset-0 rounded-full blur-md bg-gradient-to-r ${meta.haloColor}`}
              />
            )}

            <div className="relative w-full h-full rounded-full overflow-hidden bg-slate-950/90 border border-white/15">
              <svg viewBox="0 0 200 200" className="w-full h-full">
                <defs>
                  <linearGradient id={`bg-${language}`} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor={isTamil ? '#78350f' : '#1e1b4b'} />
                    <stop offset="55%" stopColor={isTamil ? '#9f1239' : '#1e3a8a'} />
                    <stop offset="100%" stopColor={isTamil ? '#134e4a' : '#3b0764'} />
                  </linearGradient>
                  <linearGradient id={`skin-${language}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={isTamil ? '#d6976c' : '#f3c6a5'} />
                    <stop offset="100%" stopColor={isTamil ? '#b9774d' : '#dfa47e'} />
                  </linearGradient>
                </defs>

                {/* Studio Backdrop */}
                <rect width="200" height="200" fill={`url(#bg-${language})`} />
                <circle cx="100" cy="76" r="56" fill="rgba(255,255,255,0.08)" />

                {/* Shoulders & Attire */}
                {isTamil ? (
                  <>
                    {/* Deep Peacock Teal Silk Saree & Marigold Gold Pallu */}
                    <path d="M 28 200 C 38 152, 66 144, 100 144 C 134 144, 162 152, 172 200 Z" fill="#0f766e" />
                    <path d="M 48 200 L 116 145 L 142 152 L 94 200 Z" fill="#f59e0b" opacity="0.92" />
                    <path d="M 56 200 L 122 148" stroke="#fde68a" strokeWidth="2.5" strokeDasharray="4 4" />
                    {/* Delicate Necklace */}
                    <path d="M 79 146 Q 100 162 121 146" fill="none" stroke="#fbbf24" strokeWidth="3.2" />
                    <circle cx="100" cy="156" r="3.5" fill="#f43f5e" />
                  </>
                ) : (
                  <>
                    {/* Crisp Slate-Navy Blazer & Coral Silk Blouse */}
                    <path d="M 28 200 C 38 152, 66 144, 100 144 C 134 144, 162 152, 172 200 Z" fill="#1e293b" />
                    <path d="M 78 145 L 100 185 L 122 145 Z" fill="#f472b6" opacity="0.9" />
                    <path d="M 62 150 L 82 200 L 95 178 L 78 145 Z" fill="#334155" />
                    <path d="M 138 150 L 118 200 L 105 178 L 122 145 Z" fill="#334155" />
                  </>
                )}

                {/* Neck */}
                <rect x="86" y="124" width="28" height="28" rx="12" fill={`url(#skin-${language})`} />

                {/* Hair Back */}
                {isTamil ? (
                  <>
                    <ellipse cx="100" cy="82" rx="46" ry="50" fill="#18181b" />
                    {/* Jasmine (மல்லிகை) Garland Hint on Bun */}
                    <circle cx="136" cy="94" r="11" fill="#18181b" />
                    <path d="M 132 82 Q 148 92 142 108" fill="none" stroke="#fefce8" strokeWidth="5" strokeLinecap="round" strokeDasharray="3 5" />
                  </>
                ) : (
                  <path
                    d="M 48 88 C 46 38, 154 38, 152 88 C 154 126, 142 142, 130 142 L 70 142 C 58 142, 46 126, 48 88 Z"
                    fill="#451a03"
                  />
                )}

                {/* Ears & Earrings */}
                <circle cx="62" cy="92" r="7" fill={`url(#skin-${language})`} />
                <circle cx="138" cy="92" r="7" fill={`url(#skin-${language})`} />
                <circle cx="62" cy="100" r="3" fill={isTamil ? '#fbbf24' : '#e2e8f0'} />
                <circle cx="138" cy="100" r="3" fill={isTamil ? '#fbbf24' : '#e2e8f0'} />

                {/* Face */}
                <path
                  d="M 64 76 C 64 46, 136 46, 136 76 C 136 112, 120 132, 100 134 C 80 132, 64 112, 64 76 Z"
                  fill={`url(#skin-${language})`}
                />

                {/* Hair Front Styling */}
                {isTamil ? (
                  <path d="M 60 76 C 64 44, 136 44, 140 76 C 122 58, 108 56, 100 62 C 92 56, 78 58, 60 76 Z" fill="#18181b" />
                ) : (
                  <path d="M 60 78 C 64 42, 138 42, 140 76 C 125 56, 104 54, 86 64 C 74 62, 66 70, 60 78 Z" fill="#5c2808" />
                )}

                {/* Traditional Bindi for Prof. Kalaivani */}
                {isTamil && <circle cx="100" cy="73" r="3" fill="#e11d48" />}

                {/* Eyebrows (subtle lift when encouraging/celebrating/listening) */}
                <path
                  d={
                    effectiveEmotion === 'celebrating' || effectiveEmotion === 'encouraging'
                      ? 'M 75 78 Q 84 72 93 77'
                      : effectiveEmotion === 'listening'
                      ? 'M 75 77 Q 84 73 93 78'
                      : 'M 75 80 Q 84 76 93 80'
                  }
                  fill="none"
                  stroke="#1f2937"
                  strokeWidth="2.8"
                  strokeLinecap="round"
                />
                <path
                  d={
                    effectiveEmotion === 'celebrating' || effectiveEmotion === 'encouraging'
                      ? 'M 107 77 Q 116 72 125 78'
                      : effectiveEmotion === 'listening'
                      ? 'M 107 78 Q 116 73 125 77'
                      : 'M 107 80 Q 116 76 125 80'
                  }
                  fill="none"
                  stroke="#1f2937"
                  strokeWidth="2.8"
                  strokeLinecap="round"
                />

                {/* Eyes with natural blink */}
                {isBlinking ? (
                  <>
                    <path d="M 78 89 Q 84 93 90 89" fill="none" stroke="#1e293b" strokeWidth="2.5" strokeLinecap="round" />
                    <path d="M 110 89 Q 116 93 122 89" fill="none" stroke="#1e293b" strokeWidth="2.5" strokeLinecap="round" />
                  </>
                ) : (
                  <>
                    <ellipse cx="84" cy="89" rx="6" ry="5" fill="#ffffff" />
                    <circle cx="84.5" cy="89" r="3.4" fill="#1e293b" />
                    <circle cx="85.8" cy="87.6" r="1.2" fill="#ffffff" />

                    <ellipse cx="116" cy="89" rx="6" ry="5" fill="#ffffff" />
                    <circle cx="115.5" cy="89" r="3.4" fill="#1e293b" />
                    <circle cx="116.8" cy="87.6" r="1.2" fill="#ffffff" />
                  </>
                )}

                {/* Glasses for Prof. Clara */}
                {!isTamil && (
                  <g opacity="0.88" stroke="#f8fafc" strokeWidth="1.8" fill="none">
                    <rect x="73" y="82" width="22" height="14" rx="5" />
                    <rect x="105" y="82" width="22" height="14" rx="5" />
                    <line x1="95" y1="88" x2="105" y2="88" />
                  </g>
                )}

                {/* Warm Blush */}
                <ellipse cx="75" cy="102" rx="6" ry="3.2" fill="#fb7185" opacity="0.28" />
                <ellipse cx="125" cy="102" rx="6" ry="3.2" fill="#fb7185" opacity="0.28" />

                {/* Nose */}
                <path d="M 100 88 L 97 101 Q 100 104 103 101" fill="none" stroke="rgba(120,53,15,0.45)" strokeWidth="2" strokeLinecap="round" />

                {/* Animated Expressive Mouth */}
                <path
                  d={getMouthPath()}
                  fill={isSpeaking ? '#be123c' : 'none'}
                  stroke="#9f1239"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </motion.div>

          {/* Animated Live Audio Equalizer Bars */}
          <div className="mt-2.5 flex items-end justify-center gap-1 h-4">
            {[0, 1, 2, 3, 4, 5, 6].map((idx) => (
              <motion.span
                key={idx}
                animate={
                  isSpeaking
                    ? { height: ['4px', `${10 + ((idx * 5) % 8)}px`, '5px'] }
                    : isListening
                    ? { height: ['4px', `${8 + ((idx * 3) % 7)}px`, '4px'] }
                    : { height: '4px' }
                }
                transition={{
                  repeat: Infinity,
                  duration: 0.45 + idx * 0.06,
                  ease: 'easeInOut',
                }}
                className={`w-1 rounded-full ${
                  isSpeaking
                    ? 'bg-emerald-400'
                    : isListening
                    ? 'bg-rose-400'
                    : 'bg-slate-600'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Persona Details, Emotion Status & Live Subtitles */}
        <div className="flex-1 min-w-0 space-y-2.5 w-full">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base sm:text-lg font-extrabold text-white tracking-tight">
                  {persona.name}
                </h3>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 ${meta.badgeClass}`}
                >
                  {isListening ? (
                    <Ear className="w-3 h-3 animate-pulse" />
                  ) : effectiveEmotion === 'celebrating' ? (
                    <Award className="w-3 h-3" />
                  ) : effectiveEmotion === 'encouraging' ? (
                    <HeartHandshake className="w-3 h-3" />
                  ) : (
                    <Sparkles className="w-3 h-3" />
                  )}
                  <span>{isTamil ? meta.tamilLabel : meta.label}</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-300 mt-0.5">{persona.title}</p>
            </div>
          </div>

          {/* Live Teleprompter / Subtitle Bubble */}
          {activeCaption && (
            <div className="rounded-2xl bg-slate-950/75 border border-white/10 p-3 space-y-1.5 backdrop-blur-md">
              <div className="flex items-center justify-between gap-2 text-[10px] text-slate-400 font-semibold">
                <span className="inline-flex items-center gap-1 text-emerald-300">
                  <MessageCircleHeart className="w-3 h-3" />
                  {isSpeaking
                    ? isTamil
                      ? 'ஆசிரியர் இப்போது பேசுகிறார்...'
                      : 'Tutor speaking live...'
                    : isListening
                    ? isTamil
                      ? 'உங்கள் குரலைக் கேட்கிறார்...'
                      : 'Listening to your voice...'
                    : isTamil
                    ? 'சமீபத்திய ஆசிரியர் வழிகாட்டல்'
                    : 'Latest Tutor Coaching'}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-white leading-relaxed font-medium">
                {activeCaption}
              </p>
              {showTransliteration && activeCaptionTranslit && (
                <p className="text-[11px] text-amber-200/90 italic leading-snug">
                  {activeCaptionTranslit}
                </p>
              )}
              {showTransliteration && activeCaptionMeaning && (
                <p className="text-[11px] text-cyan-200/85 leading-snug">
                  Meaning: {activeCaptionMeaning}
                </p>
              )}
            </div>
          )}

          {/* Voice & Teaching Controls Toolbar */}
          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            <button
              onClick={onToggleAutoSpeak}
              className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                autoSpeak
                  ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40'
                  : 'bg-slate-800/80 text-slate-300 border-slate-700'
              }`}
            >
              {autoSpeak ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              <span>{autoSpeak ? 'Auto-Voice On' : 'Voice Muted'}</span>
            </button>

            <button
              onClick={onToggleSlowMode}
              className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                slowMode
                  ? 'bg-amber-500/25 text-amber-200 border-amber-400/45'
                  : 'bg-slate-800/80 text-slate-300 border-slate-700'
              }`}
            >
              <Gauge className="w-3.5 h-3.5" />
              <span>{slowMode ? '0.75x Slow Clear' : '1.0x Natural Pace'}</span>
            </button>

            {isTamil && (
              <button
                onClick={onToggleTransliteration}
                className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                  showTransliteration
                    ? 'bg-indigo-500/25 text-indigo-200 border-indigo-400/40'
                    : 'bg-slate-800/80 text-slate-300 border-slate-700'
                }`}
              >
                {showTransliteration ? 'Tanglish + Meaning ✓' : 'Show Tanglish & Meaning'}
              </button>
            )}

            <button
              onClick={onReplayLast}
              className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold bg-white/10 hover:bg-white/20 text-white border border-white/15 flex items-center gap-1 cursor-pointer transition-all"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Replay Voice</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

