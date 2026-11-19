import React, { useEffect, useRef, useState } from 'react';
import {
  Mic,
  MicOff,
  Send,
  Volume2,
  Sparkles,
  CheckCircle2,
  BookmarkCheck,
  Wand2,
  Heart,
  Ear,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import {
  ConstructedLanguageLesson,
  LiveTutorMessage,
  ProficiencyLevel,
  TutorEmotion,
  TutorLanguage,
  TutorPersona,
  TutorRoleplayScenario,
} from '../../types/languageTutor';
import { TUTOR_ROLEPLAY_SCENARIOS } from '../../data/languageTutorCurriculum';
import { sendLiveTutorTurn } from '../../services/languageTutorService';
import { speechEngine } from '../../services/speech';
import { LiveTutorAvatarStage } from './LiveTutorAvatarStage';
import {
  SpeechCaptureHandle,
  speakTutorUtterance,
  startTutorSpeechCapture,
} from './tutorSpeechHelper';

interface LiveTutorSessionViewProps {
  language: TutorLanguage;
  persona: TutorPersona;
  activeLevel: ProficiencyLevel;
  activeLesson: ConstructedLanguageLesson | null;
  onTurnAwardXp: (xp: number, fluencyScore?: number) => void;
  onSaveSessionRecord: (params: {
    title: string;
    language: TutorLanguage;
    level: ProficiencyLevel;
    messages: LiveTutorMessage[];
  }) => Promise<void>;
}

export const LiveTutorSessionView: React.FC<LiveTutorSessionViewProps> = ({
  language,
  persona,
  activeLevel,
  activeLesson,
  onTurnAwardXp,
  onSaveSessionRecord,
}) => {
  const languageScenarios = TUTOR_ROLEPLAY_SCENARIOS.filter((s) => s.language === language);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>(
    activeLesson ? 'active-module' : languageScenarios[0]?.id || ''
  );

  const [messages, setMessages] = useState<LiveTutorMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [micNotice, setMicNotice] = useState<string | null>(null);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [slowMode, setSlowMode] = useState(false);
  const [showTransliteration, setShowTransliteration] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveToast, setSaveToast] = useState<string | null>(null);
  const [usedAiModelBadge, setUsedAiModelBadge] = useState<boolean>(true);

  const micHandleRef = useRef<SpeechCaptureHandle | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const currentScenario: TutorRoleplayScenario | null =
    selectedScenarioId === 'active-module'
      ? null
      : languageScenarios.find((s) => s.id === selectedScenarioId) || languageScenarios[0] || null;

  const scenarioTitle =
    selectedScenarioId === 'active-module' && activeLesson
      ? `Guided Coaching: ${activeLesson.title}`
      : currentScenario?.title || 'Open Live Coaching';

  const learnerGoal =
    selectedScenarioId === 'active-module' && activeLesson
      ? activeLesson.capstoneChallenge.prompt
      : currentScenario?.learnerGoal || 'Speak warmly and naturally in conversation.';

  // Initialize / reset conversation warmly when language, active module, or scenario changes
  useEffect(() => {
    speechEngine.stopSpeaking();
    micHandleRef.current?.stop();

    const starterText =
      selectedScenarioId === 'active-module' && activeLesson
        ? activeLesson.teacherOpeningScript
        : currentScenario?.starterTutorLine || persona.greeting;

    const starterTranslit =
      selectedScenarioId === 'active-module' && activeLesson
        ? activeLesson.teacherOpeningTransliteration
        : currentScenario?.starterTransliteration || persona.greetingTransliteration;

    const starterMeaning =
      selectedScenarioId === 'active-module' && activeLesson
        ? activeLesson.teacherOpeningMeaning
        : currentScenario?.starterMeaning || persona.greetingMeaning;

    const initialSuggestions =
      language === 'tamil'
        ? [
            'வணக்கம் ஆசிரியர்! இன்று நான் நன்றாகப் பேசப் பழக ஆர்வமாக இருக்கிறேன்.',
            'தயவுசெய்து ஒரு உதாரணத்துடன் விளக்க முடியுமா?',
          ]
        : [
            'Hello! Let us practice speaking naturally right now.',
            'Could you challenge me with a realistic follow-up question?',
          ];

    const greetingMsg: LiveTutorMessage = {
      id: `init-${language}-${Date.now()}`,
      role: 'tutor',
      text: starterText,
      transliteration: starterTranslit,
      englishMeaning: starterMeaning,
      emotion: 'welcoming',
      praiseNote:
        language === 'tamil'
          ? 'தயக்கமின்றித் தொடங்குங்கள் — தவறுகள் கற்றலின் படிக்கட்டுகள்!'
          : 'Speak freely — warmth and momentum come before perfection!',
      followUpSuggestions: initialSuggestions,
      timestamp: new Date().toISOString(),
    };

    setMessages([greetingMsg]);
    setMicNotice(null);
    setInterimTranscript('');
  }, [language, selectedScenarioId, activeLesson?.id]);

  // If a new activeLesson arrives and was just launched, focus guided scenario
  useEffect(() => {
    if (activeLesson && activeLesson.language === language) {
      setSelectedScenarioId('active-module');
    } else {
      const first = TUTOR_ROLEPLAY_SCENARIOS.find((s) => s.language === language);
      if (first) setSelectedScenarioId(first.id);
    }
  }, [language, activeLesson?.id]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, interimTranscript]);

  useEffect(() => {
    return () => {
      micHandleRef.current?.stop();
      speechEngine.stopSpeaking();
    };
  }, []);

  const lastTutorMessage = [...messages].reverse().find((m) => m.role === 'tutor');
  const currentEmotion: TutorEmotion = lastTutorMessage?.emotion || 'welcoming';

  const playTutorLine = (text: string, slow = slowMode) => {
    speakTutorUtterance(text, {
      language,
      slow,
      onStart: () => setIsSpeaking(true),
      onEnd: () => setIsSpeaking(false),
    });
  };

  const handleSendMessage = async (textOverride?: string) => {
    const clean = (textOverride ?? inputText).trim();
    if (!clean || isSending) return;

    micHandleRef.current?.stop();
    speechEngine.stopSpeaking();

    const userMsg: LiveTutorMessage = {
      id: `user-${Date.now()}`,
      role: 'learner',
      text: clean,
      timestamp: new Date().toISOString(),
    };

    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    if (!textOverride) setInputText('');
    setInterimTranscript('');
    setIsSending(true);

    try {
      const res = await sendLiveTutorTurn({
        language,
        level: activeLevel,
        scenarioTitle,
        learnerGoal,
        activeModuleTitle: activeLesson?.title,
        userMessage: clean,
        history: nextHistory,
        includeTransliteration: showTransliteration,
      });

      setUsedAiModelBadge(res.usedAi);
      setMessages((prev) => [...prev, res.message]);
      onTurnAwardXp(res.message.xpEarned || 20, res.message.fluencyScore);

      if (autoSpeak) {
        playTutorLine(res.message.text, slowMode);
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleToggleMic = async () => {
    if (isListening) {
      micHandleRef.current?.stop();
      micHandleRef.current = null;
      setIsListening(false);
      return;
    }

    const speechLang = language === 'tamil' ? 'ta-IN' : 'en-IN';
    micHandleRef.current = await startTutorSpeechCapture({
      speechLang,
      onInterim: (t) => setInterimTranscript(t),
      onFinal: (finalText) => {
        setInterimTranscript('');
        void handleSendMessage(finalText);
      },
      onListeningChange: (listening) => setIsListening(listening),
      onNotice: (notice) => setMicNotice(notice),
    });
  };

  const handleSaveSession = async () => {
    if (messages.length === 0 || isSaving) return;
    setIsSaving(true);
    try {
      await onSaveSessionRecord({
        title: `${scenarioTitle} (${messages.length} turns)`,
        language,
        level: activeLevel,
        messages,
      });
      setSaveToast('Saved session transcript to SQLite & Google Drive!');
      setTimeout(() => setSaveToast(null), 3500);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Expressive Animated Human Tutor Stage */}
      <LiveTutorAvatarStage
        language={language}
        persona={persona}
        emotion={currentEmotion}
        isSpeaking={isSpeaking}
        isListening={isListening}
        autoSpeak={autoSpeak}
        slowMode={slowMode}
        showTransliteration={showTransliteration}
        activeCaption={lastTutorMessage?.text}
        activeCaptionTranslit={lastTutorMessage?.transliteration}
        activeCaptionMeaning={lastTutorMessage?.englishMeaning}
        onToggleAutoSpeak={() => setAutoSpeak((v) => !v)}
        onToggleSlowMode={() => setSlowMode((v) => !v)}
        onToggleTransliteration={() => setShowTransliteration((v) => !v)}
        onReplayLast={() => {
          if (lastTutorMessage) playTutorLine(lastTutorMessage.text, slowMode);
        }}
      />

      {/* Interactive Scenario Selector Pills */}
      <div className="rounded-2xl bg-slate-900/80 border border-white/10 p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            Live Role-Play & Coaching Scenario
          </span>
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
              usedAiModelBadge
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                : 'bg-amber-500/15 text-amber-200 border-amber-500/30'
            }`}
          >
            {usedAiModelBadge ? 'Live AI Tutor Model' : 'Offline Human Coach Mode'}
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {activeLesson && activeLesson.language === language && (
            <button
              onClick={() => setSelectedScenarioId('active-module')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedScenarioId === 'active-module'
                  ? 'bg-gradient-to-r from-violet-500 to-fuchsia-600 text-white border-fuchsia-300/50 shadow-lg shadow-fuchsia-500/20'
                  : 'bg-slate-950/70 text-slate-300 border-slate-700 hover:border-violet-400/50'
              }`}
            >
              <span>📘</span>
              <span>Module: {activeLesson.title.slice(0, 26)}</span>
            </button>
          )}

          {languageScenarios.map((scen) => (
            <button
              key={scen.id}
              onClick={() => setSelectedScenarioId(scen.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedScenarioId === scen.id
                  ? language === 'tamil'
                    ? 'bg-gradient-to-r from-amber-500 to-rose-600 text-white border-amber-300/50 shadow-lg shadow-amber-500/20'
                    : 'bg-gradient-to-r from-sky-500 to-indigo-600 text-white border-sky-300/50 shadow-lg shadow-sky-500/20'
                  : 'bg-slate-950/70 text-slate-300 border-slate-700 hover:border-slate-500'
              }`}
            >
              <span>{scen.iconEmoji}</span>
              <span>{scen.title}</span>
            </button>
          ))}
        </div>

        <p className="text-[11px] text-cyan-200/90 bg-slate-950/60 px-3 py-1.5 rounded-xl border border-white/5">
          <strong className="text-white">Goal:</strong> {learnerGoal}
        </p>
      </div>

      {/* Live Dialogue Stream */}
      <div className="rounded-3xl bg-slate-950/80 border border-white/10 p-3 sm:p-4 space-y-3 max-h-[420px] overflow-y-auto">
        {messages.map((msg) => {
          const isTutor = msg.role === 'tutor';
          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isTutor ? 'items-start' : 'items-end'}`}
            >
              <div
                className={`max-w-[92%] sm:max-w-[85%] rounded-2xl p-3.5 border shadow-md space-y-2 ${
                  isTutor
                    ? language === 'tamil'
                      ? 'bg-gradient-to-br from-amber-950/60 to-slate-900 border-amber-500/30 text-white'
                      : 'bg-gradient-to-br from-indigo-950/65 to-slate-900 border-indigo-500/30 text-white'
                    : 'bg-gradient-to-br from-emerald-600/25 to-teal-900/40 border-emerald-400/35 text-emerald-50'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">
                    {isTutor ? persona.name : 'You (Learner)'}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {typeof msg.fluencyScore === 'number' && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                        Fluency {msg.fluencyScore}%
                      </span>
                    )}
                    {isTutor && (
                      <>
                        <button
                          onClick={() => playTutorLine(msg.text, false)}
                          title="Speak naturally"
                          className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => playTutorLine(msg.text, true)}
                          title="Speak slowly"
                          className="px-1.5 py-0.5 rounded-lg bg-white/10 hover:bg-white/20 text-[10px] font-bold text-amber-200 cursor-pointer"
                        >
                          0.75×
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <p className="text-xs sm:text-sm leading-relaxed font-medium">{msg.text}</p>

                {isTutor && showTransliteration && msg.transliteration && (
                  <p className="text-[11px] text-amber-200/90 italic">{msg.transliteration}</p>
                )}
                {isTutor && showTransliteration && msg.englishMeaning && (
                  <p className="text-[11px] text-sky-200/85">
                    <strong>Meaning:</strong> {msg.englishMeaning}
                  </p>
                )}

                {/* Warm Human Coaching Cards */}
                {isTutor &&
                  (msg.praiseNote || msg.grammarFeedback || msg.betterPhrasing || msg.pronunciationTip) && (
                    <div className="pt-2 border-t border-white/10 space-y-1.5 text-[11px]">
                      {msg.praiseNote && (
                        <div className="flex items-start gap-1.5 text-emerald-200 bg-emerald-500/10 rounded-xl px-2.5 py-1.5 border border-emerald-500/20">
                          <Heart className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald-400" />
                          <span>{msg.praiseNote}</span>
                        </div>
                      )}
                      {msg.betterPhrasing && (
                        <div className="flex items-start gap-1.5 text-violet-200 bg-violet-500/15 rounded-xl px-2.5 py-1.5 border border-violet-500/25">
                          <Wand2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-violet-300" />
                          <span>
                            <strong>Natural Upgrade:</strong> {msg.betterPhrasing}
                          </span>
                        </div>
                      )}
                      {msg.grammarFeedback && (
                        <div className="flex items-start gap-1.5 text-amber-200 bg-amber-500/10 rounded-xl px-2.5 py-1.5 border border-amber-500/20">
                          <Sparkles className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-300" />
                          <span>
                            <strong>Coach Note:</strong> {msg.grammarFeedback}
                          </span>
                        </div>
                      )}
                      {msg.pronunciationTip && (
                        <div className="flex items-start gap-1.5 text-cyan-200 bg-cyan-500/10 rounded-xl px-2.5 py-1.5 border border-cyan-500/20">
                          <Ear className="w-3.5 h-3.5 shrink-0 mt-0.5 text-cyan-300" />
                          <span>
                            <strong>Pronunciation:</strong> {msg.pronunciationTip}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                {/* Interactive Quick Reply Prompts */}
                {isTutor && msg.followUpSuggestions && msg.followUpSuggestions.length > 0 && (
                  <div className="pt-1 flex flex-wrap gap-1.5">
                    {msg.followUpSuggestions.map((sugg, idx) => (
                      <button
                        key={idx}
                        onClick={() => void handleSendMessage(sugg)}
                        disabled={isSending}
                        className="px-2.5 py-1 rounded-xl bg-white/10 hover:bg-white/20 text-[11px] text-white font-medium border border-white/15 transition-all cursor-pointer text-left"
                      >
                        💬 {sugg}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {interimTranscript && (
          <div className="flex justify-end">
            <div className="rounded-2xl px-3.5 py-2 bg-rose-500/20 border border-rose-400/40 text-rose-100 text-xs italic animate-pulse">
              🎙️ {interimTranscript}
            </div>
          </div>
        )}

        {isSending && (
          <div className="flex items-center gap-2 text-xs text-slate-300 px-2">
            <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
            <span>{persona.name} is thinking of a warm coaching reply...</span>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {micNotice && (
        <div className="text-xs text-amber-200 bg-amber-500/15 border border-amber-500/30 rounded-xl px-3 py-2">
          {micNotice}
        </div>
      )}

      {saveToast && (
        <div className="text-xs text-emerald-200 bg-emerald-500/20 border border-emerald-400/40 rounded-xl px-3 py-2 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{saveToast}</span>
        </div>
      )}

      {/* Composer Bar: Live Voice Mic + Type + Save Session */}
      <div className="rounded-2xl bg-slate-900/90 border border-white/10 p-2.5 sm:p-3 flex flex-col sm:flex-row gap-2">
        <div className="flex items-center gap-2 flex-1">
          <button
            onClick={() => void handleToggleMic()}
            className={`px-3.5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 shrink-0 cursor-pointer transition-all ${
              isListening
                ? 'bg-rose-600 text-white animate-pulse shadow-lg shadow-rose-500/30'
                : 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white shadow-md'
            }`}
          >
            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            <span>{isListening ? 'Stop Mic' : language === 'tamil' ? 'தமிழ் Mic' : 'Speak'}</span>
          </button>

          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void handleSendMessage();
              }
            }}
            placeholder={
              language === 'tamil'
                ? 'தமிழில் அல்லது ஆங்கிலத்தில் பேசுங்கள் / தட்டச்சு செய்யுங்கள்...'
                : 'Speak or type naturally in English...'
            }
            className="flex-1 bg-slate-950/80 border border-slate-700 focus:border-cyan-400 rounded-xl px-3 py-2.5 text-xs sm:text-sm text-white placeholder-slate-400 outline-none"
          />

          <button
            onClick={() => void handleSendMessage()}
            disabled={isSending || !inputText.trim()}
            className="p-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 disabled:opacity-40 text-white cursor-pointer shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2 justify-end">
          <button
            onClick={() => void handleSaveSession()}
            disabled={isSaving || messages.length < 2}
            className="px-3 py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 disabled:opacity-40 text-amber-200 border border-amber-400/35 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all"
          >
            {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <BookmarkCheck className="w-3.5 h-3.5" />}
            <span>Save to SQLite + Drive</span>
          </button>
        </div>
      </div>
    </div>
  );
};

