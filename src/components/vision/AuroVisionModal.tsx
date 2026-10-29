import React, { useState, useEffect, useRef } from 'react';
import {
  Eye,
  Camera,
  FileText,
  DollarSign,
  Package,
  Palette,
  Volume2,
  RefreshCw,
  Zap,
  ZapOff,
  X,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Play,
  Square,
  Mic,
  Copy,
  ChevronRight,
} from 'lucide-react';
import { visionEngine, VisionMode, VisionAnalysisResult } from '../../services/visionAssist';
import { speechEngine } from '../../services/speech';

interface AuroVisionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuroVisionModal: React.FC<AuroVisionModalProps> = ({ isOpen, onClose }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [activeMode, setActiveMode] = useState<VisionMode>('describe');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [isContinuous, setIsContinuous] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentResult, setCurrentResult] = useState<VisionAnalysisResult | null>(null);
  const [customQuestion, setCustomQuestion] = useState('');
  const [isListeningQuestion, setIsListeningQuestion] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Start camera on modal open
  useEffect(() => {
    if (!isOpen) {
      visionEngine.stopCamera();
      setIsCameraActive(false);
      setIsContinuous(false);
      return;
    }

    let isMounted = true;
    const start = async () => {
      if (videoRef.current) {
        const ok = await visionEngine.startCamera(videoRef.current, facingMode);
        if (isMounted) {
          setIsCameraActive(ok);
          // Check torch capability
          setIsTorchOn(false);
          setHasTorch(true);
          // Welcome announcement for blind users
          speechEngine.speak(
            'Auro Vision is ready. Point your camera at your surroundings, or tap Describe Now.'
          );
        }
      }
    };

    void start();

    return () => {
      isMounted = false;
      visionEngine.stopCamera();
      setIsCameraActive(false);
      setIsContinuous(false);
    };
  }, [isOpen, facingMode]);

  // Flip camera
  const handleFlipCamera = async () => {
    const nextFacing = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextFacing);
    if (videoRef.current) {
      await visionEngine.startCamera(videoRef.current, nextFacing);
      speechEngine.speak(nextFacing === 'user' ? 'Switched to front camera.' : 'Switched to rear camera.');
    }
  };

  // Toggle torch
  const handleToggleTorch = async () => {
    const state = await visionEngine.toggleTorch();
    setIsTorchOn(state);
    speechEngine.speak(state ? 'Flashlight on.' : 'Flashlight off.');
  };

  // Single frame analysis
  const handleScan = async (promptOverride?: string) => {
    if (isAnalyzing) return;
    setIsAnalyzing(true);
    setCurrentResult(null);

    const result = await visionEngine.analyzeFrame(
      activeMode,
      promptOverride || customQuestion,
      speechEngine.getLanguage(),
      true
    );

    setIsAnalyzing(false);
    if (result) {
      setCurrentResult(result);
    }
  };

  // Toggle continuous guidance mode
  const handleToggleContinuous = () => {
    if (isContinuous) {
      visionEngine.stopContinuousGuidance();
      setIsContinuous(false);
      speechEngine.speak('Continuous guidance stopped.');
    } else {
      setIsContinuous(true);
      speechEngine.speak('Continuous guidance started. Auro will automatically scan every five seconds.');
      visionEngine.startContinuousGuidance(
        (res) => {
          setCurrentResult(res);
        },
        5000,
        activeMode,
        speechEngine.getLanguage()
      );
    }
  };

  // Voice question recognition
  const handleVoiceQuestion = () => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      showToast('Voice input not supported in this browser.');
      return;
    }

    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognizer = new SpeechRec();
    recognizer.lang = speechEngine.getLanguage() || 'en-US';
    recognizer.interimResults = false;
    recognizer.maxAlternatives = 1;

    setIsListeningQuestion(true);
    speechEngine.speak('Ask your question now.');

    recognizer.onresult = (event: any) => {
      const text = event.results[0]?.[0]?.transcript || '';
      setCustomQuestion(text);
      setIsListeningQuestion(false);
      if (text) {
        void handleScan(text);
      }
    };

    recognizer.onerror = () => {
      setIsListeningQuestion(false);
    };

    recognizer.onend = () => {
      setIsListeningQuestion(false);
    };

    try {
      recognizer.start();
    } catch {}
  };

  const modes = [
    {
      id: 'describe' as VisionMode,
      label: 'Scene & Steps',
      subtitle: 'Surroundings & Obstacles',
      icon: Eye,
      color: 'from-amber-500 to-amber-700',
    },
    {
      id: 'text' as VisionMode,
      label: 'Read Text',
      subtitle: 'Signs, Medicine, Mail',
      icon: FileText,
      color: 'from-cyan-500 to-blue-700',
    },
    {
      id: 'currency' as VisionMode,
      label: 'Cash & Coins',
      subtitle: 'Identify Notes & Value',
      icon: DollarSign,
      color: 'from-emerald-500 to-teal-700',
    },
    {
      id: 'objects' as VisionMode,
      label: 'Find Objects',
      subtitle: 'Keys, Glasses, Phone',
      icon: Package,
      color: 'from-purple-500 to-indigo-700',
    },
    {
      id: 'colors' as VisionMode,
      label: 'Colors & Clothes',
      subtitle: 'Style & Outfit Matching',
      icon: Palette,
      color: 'from-rose-500 to-pink-700',
    },
  ];

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black flex flex-col text-white font-sans overflow-hidden select-none"
      role="dialog"
      aria-modal="true"
      aria-label="Auro Computer Vision Accessibility Assistant for Blind and Low-Vision Users"
    >
      {/* Toast Notice */}
      {toastMessage && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-2xl bg-slate-900/95 border border-slate-700 text-xs text-white shadow-2xl animate-in fade-in slide-in-from-top-2">
          {toastMessage}
        </div>
      )}

      {/* Header with high-contrast accessibility controls */}
      <header className="px-4 py-3 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between shrink-0 z-10 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-400 flex items-center justify-center text-slate-950 font-bold shadow-lg shadow-amber-500/20">
            <Eye className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white tracking-wide flex items-center gap-1.5">
              <span>Auro Vision</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold">
                Blind Assist
              </span>
            </h1>
            <p className="text-[11px] text-slate-400">Auditory Eyes & Spatial Guidance</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Torch toggle */}
          {hasTorch && (
            <button
              onClick={handleToggleTorch}
              className={`p-2.5 rounded-xl border transition-colors ${
                isTorchOn
                  ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-lg shadow-amber-400/30'
                  : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white'
              }`}
              title="Toggle Flashlight / Torch"
              aria-label={isTorchOn ? 'Turn flashlight off' : 'Turn flashlight on'}
            >
              {isTorchOn ? <Zap className="w-4 h-4 fill-current" /> : <ZapOff className="w-4 h-4" />}
            </button>
          )}

          {/* Flip camera */}
          <button
            onClick={handleFlipCamera}
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 hover:text-white transition-colors"
            title="Switch between front and back camera"
            aria-label="Switch camera"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {/* Close modal */}
          <button
            onClick={() => {
              speechEngine.speak('Auro Vision closed.');
              onClose();
            }}
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 hover:text-white transition-colors"
            title="Close Auro Vision"
            aria-label="Close Vision Assistant"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 relative flex flex-col overflow-hidden bg-slate-950">
        {/* Camera Live Viewfinder */}
        <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
            aria-hidden="true"
          />

          {/* Fallback overlay if camera loading */}
          {!isCameraActive && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 text-center p-6">
              <Camera className="w-12 h-12 text-slate-600 mb-3 animate-pulse" />
              <p className="text-sm font-semibold text-slate-300">Activating camera...</p>
              <p className="text-xs text-slate-500 mt-1 max-w-xs">
                Please grant camera permission so Auro can provide real-time visual assistance.
              </p>
            </div>
          )}

          {/* Crosshairs & Scanning Grid Animation */}
          {isCameraActive && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-64 h-64 border-2 border-dashed border-amber-400/40 rounded-3xl relative">
                <div className="absolute -top-1 -left-1 w-5 h-5 border-t-2 border-l-2 border-amber-400" />
                <div className="absolute -top-1 -right-1 w-5 h-5 border-t-2 border-r-2 border-amber-400" />
                <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-2 border-l-2 border-amber-400" />
                <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-2 border-r-2 border-amber-400" />
                {isAnalyzing && (
                  <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-amber-400 to-transparent animate-bounce opacity-80" />
                )}
              </div>
            </div>
          )}

          {/* Continuous Guidance Active Badge */}
          {isContinuous && (
            <div className="absolute top-4 left-4 z-20 px-3 py-1.5 rounded-full bg-emerald-500/90 backdrop-blur-md text-slate-950 text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-500/30 animate-pulse">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Hands-Free Auto Scanning</span>
            </div>
          )}

          {/* Safety Alert Banner overlay if hazards detected */}
          {currentResult?.safetyAlerts && currentResult.safetyAlerts.length > 0 && (
            <div
              className="absolute top-4 inset-x-4 z-20 p-3 rounded-2xl bg-rose-600/95 border border-rose-400 text-white shadow-2xl backdrop-blur-md flex items-start gap-2.5 animate-in slide-in-from-top duration-200"
              role="alert"
              aria-live="assertive"
            >
              <AlertTriangle className="w-5 h-5 text-amber-300 shrink-0 mt-0.5 animate-bounce" />
              <div className="flex-1">
                <div className="text-xs font-bold uppercase tracking-wider text-rose-100">
                  ⚠️ Obstacle / Safety Hazard Alert
                </div>
                <div className="text-xs font-semibold mt-0.5">
                  {currentResult.safetyAlerts.join(' • ')}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Results / Audio Readout Box (High contrast, screen reader enabled) */}
        {currentResult && (
          <div
            className="p-3.5 bg-slate-900/95 border-t border-slate-800 text-slate-100 max-h-48 overflow-y-auto shrink-0 shadow-2xl"
            role="region"
            aria-live="polite"
            aria-label="Vision Analysis Result"
          >
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-amber-400 flex items-center gap-1">
                  <Eye className="w-3.5 h-3.5" />
                  <span>Spoken Visual Guidance:</span>
                </span>
                {currentResult.currencyDetected && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
                    💵 {currentResult.currencyDetected}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => speechEngine.speak(currentResult.spokenText)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                  title="Repeat Speech"
                  aria-label="Repeat spoken description"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={async () => {
                    await navigator.clipboard.writeText(
                      currentResult.detectedText || currentResult.spokenText
                    );
                    showToast('✓ Copied to clipboard');
                  }}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                  title="Copy Text"
                  aria-label="Copy text to clipboard"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <p className="text-sm font-medium leading-relaxed text-slate-100">
              {currentResult.spokenText}
            </p>

            {/* If verbatim text is found */}
            {currentResult.detectedText && (
              <div className="mt-2 p-2 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-cyan-200">
                <span className="font-bold text-cyan-400 mr-1">Extracted Text:</span>
                {currentResult.detectedText}
              </div>
            )}
          </div>
        )}

        {/* Mode Selector Strip */}
        <div className="px-3 py-2 bg-slate-950 border-t border-slate-800/80 overflow-x-auto flex items-center gap-2 shrink-0 scrollbar-none">
          {modes.map((m) => {
            const Icon = m.icon;
            const isSel = activeMode === m.id;
            return (
              <button
                key={m.id}
                onClick={() => {
                  setActiveMode(m.id);
                  speechEngine.speak(`Mode set to ${m.label}.`);
                }}
                className={`px-3 py-2 rounded-2xl flex items-center gap-2 shrink-0 transition-all ${
                  isSel
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-lg shadow-amber-500/25 scale-[1.02]'
                    : 'bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
                aria-pressed={isSel}
                aria-label={`Select ${m.label} mode: ${m.subtitle}`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <div className="text-left">
                  <div className="text-xs leading-none">{m.label}</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Custom Voice Question Bar */}
        <div className="px-3 py-2 bg-slate-950 border-t border-slate-900 flex items-center gap-2 shrink-0">
          <button
            onClick={handleVoiceQuestion}
            className={`p-2.5 rounded-xl border transition-colors ${
              isListeningQuestion
                ? 'bg-rose-500 text-white border-rose-400 animate-pulse'
                : 'bg-slate-900 border-slate-800 text-amber-400 hover:bg-slate-800'
            }`}
            title="Ask question by voice"
            aria-label="Ask a specific question by voice"
          >
            <Mic className="w-4 h-4" />
          </button>
          <input
            type="text"
            value={customQuestion}
            onChange={(e) => setCustomQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && customQuestion.trim()) {
                void handleScan();
              }
            }}
            placeholder='Ask: "What color is this shirt?", "Is the path clear?"...'
            className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
            aria-label="Type a specific question for Auro Vision"
          />
          {customQuestion && (
            <button
              onClick={() => handleScan()}
              className="px-3 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400 transition-colors"
              aria-label="Submit question"
            >
              Ask
            </button>
          )}
        </div>

        {/* Big Action Controls for Touch & Accessibility */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center gap-3 shrink-0">
          {/* Main Describe Button */}
          <button
            onClick={() => handleScan()}
            disabled={isAnalyzing}
            className={`flex-1 py-4 px-6 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-extrabold text-base flex items-center justify-center gap-3 shadow-xl shadow-amber-500/25 transition-all active:scale-[0.98] ${
              isAnalyzing ? 'opacity-70 animate-pulse' : ''
            }`}
            aria-label="Describe now. Captures camera view and speaks guidance."
          >
            <Camera className="w-5 h-5 text-slate-950" />
            <span>{isAnalyzing ? 'Analyzing Environment...' : 'Describe Now'}</span>
          </button>

          {/* Continuous Guidance Mode Toggle */}
          <button
            onClick={handleToggleContinuous}
            className={`py-4 px-4 rounded-2xl border font-bold text-xs flex flex-col items-center justify-center gap-1 transition-all ${
              isContinuous
                ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-lg shadow-emerald-500/30'
                : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
            title="Auto scan every 5 seconds hands-free"
            aria-pressed={isContinuous}
            aria-label={
              isContinuous
                ? 'Stop hands-free continuous scanning'
                : 'Start hands-free continuous auto scanning'
            }
          >
            {isContinuous ? <Square className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4" />}
            <span className="text-[10px] whitespace-nowrap">
              {isContinuous ? 'Stop Auto' : 'Auto Scan'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
