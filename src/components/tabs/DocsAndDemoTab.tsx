import React, { useState, useEffect } from 'react';
import {
  FileText,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  Copy,
  CheckCircle2,
  Download,
  Sparkles,
  Shield,
  Layers,
  Code,
  Users,
  TrendingUp,
  Cpu,
  Lock,
} from 'lucide-react';
import { speechEngine } from '../../services/speech';

export const DocsAndDemoTab: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'demo' | 'prd'>('demo');

  // Interactive Demo Video State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const [sceneProgress, setSceneProgress] = useState(0);
  const [copiedDoc, setCopiedDoc] = useState(false);

  const demoScenes = [
    {
      id: 1,
      title: 'Scene 1: Natural Empathetic Voice & Cognitive Companion',
      subtitle: 'Simulating Human Conversation Patterns & Emotional Intelligence',
      narration:
        'Aura is designed as your primary life companion. Powered by real-time speech recognition and empathetic voice synthesis, Aura listens with nuanced emotional intelligence, tracks your tone, and validates your daily reflections.',
      highlightColor: 'from-indigo-600 to-purple-600',
      badge: 'Voice AI & Empathy',
      details: [
        'Real-time Speech Recognition (STT) with live interim transcripts',
        'Empathetic conversational tone modeling with emotional state badge',
        'Adaptive voice synthesis with customized pitch, cadence and warmth',
        'Direct connection to Gemini server-side intelligence with telemetry headers',
      ],
    },
    {
      id: 2,
      title: 'Scene 2: Multi-Role Family Tracking & 16-Digit Pairing',
      subtitle: 'Primary Head of Family Oversight vs Secondary Family Members',
      narration:
        'Aura features a two-role architecture. As primary head (digitaltamilworld@gmail.com), you generate secure 16-digit activation codes. Secondary family members redeem these codes to link securely into your circle with live GPS telemetry, battery monitoring, and instant emergency SOS alerts.',
      highlightColor: 'from-blue-600 to-indigo-600',
      badge: 'Family Multi-Role & Safety',
      details: [
        '16-digit activation code generation: XXXX-XXXX-XXXX-XXXX',
        'Secondary member redemption with relationship tagging',
        'Real-time radar telemetry (25s GPS tick) with simulated geofencing (Home, School, Work)',
        'Emergency SOS distress broadcast reporting directly to Primary dashboard',
      ],
    },
    {
      id: 3,
      title: 'Scene 3: The Ethical Billionaire Blueprint & Milestone Execution',
      subtitle: 'Step-by-Step Path from Scratch to Sovereign Enterprise Holding',
      narration:
        'For your billionaire goal, Aura provides a structured 5-Phase Wealth Execution Roadmap. From high-margin cash engines to scalable enterprise IP, holding company mechanics, and sovereign scale. Daily high-leverage habits track progress directly towards your next milestone valuation.',
      highlightColor: 'from-amber-600 to-yellow-600',
      badge: 'Billionaire Roadmap',
      details: [
        'Phase 1 to 5 roadmap: From $1M cash mastery to $1B+ sovereign impact',
        'Daily high-leverage habit checklists with velocity compounding',
        'Enterprise valuation trackers and gross margin unit economics',
        'Direct AI Strategic Advisory & Private Family Office Deal Counsel',
      ],
    },
    {
      id: 4,
      title: 'Scene 4: Eisenhower Productivity, File Storage & AI Summarizer',
      subtitle: 'Seamless Phone Storage Access & Automatic Calendar Extraction',
      narration:
        'Aura acts as your executive productivity coach. Drop contracts, tax files, or notes directly from your phone storage. Aura summarizes key takeaways, extracts actionable tasks, and schedules calendar deadlines automatically into your Eisenhower Matrix.',
      highlightColor: 'from-purple-600 to-pink-600',
      badge: 'Productivity & File AI',
      details: [
        'Phone storage file upload & client-side parsing (PDF, DOCX, TXT, JSON)',
        'Automatic document executive summary & action item extraction',
        'Smart Eisenhower 4-Quadrant Priority Matrix with automated scheduling',
        'Cross-account task synchronization with family visibility',
      ],
    },
    {
      id: 5,
      title: 'Scene 5: Longevity, Wearable Ecosystem & Sleep Recovery',
      subtitle: 'Apple Watch, Oura Ring, Garmin Integration & Guided Box Meditation',
      narration:
        'Peak performance demands physiological recovery. Aura integrates biometrics from Apple Watch, Oura Ring, and Garmin. It analyzes deep sleep cycles, resting heart rates, and autonomic HRV to prescribe balanced nutrition plans and custom guided box breathing exercises.',
      highlightColor: 'from-rose-600 to-teal-600',
      badge: 'Health & Sleep Wellness',
      details: [
        'Deep, REM, and light sleep architecture tracking with readiness scoring',
        'Personalized nutrition plan generator based on daily metabolic demand',
        'Interactive guided Navy SEAL Box Breathing (4-4-4-4) meditation visualizer',
        'Connected wearable hub simulation with battery & online status indicators',
      ],
    },
    {
      id: 6,
      title: 'Scene 6: Google One SSO & Client-Side AES-256 Encrypted Memory Vault',
      subtitle: 'Zero-Knowledge Security, Seamless Cross-Device Sync & Unified Search',
      narration:
        'Your privacy is inviolable. All sensitive notes, family charters, and prompts are encrypted client-side using hardware-accelerated AES-256-GCM before syncing to your 2TB Google One cloud storage. Unified search queries your Google Drive, Gmail, and Assistant prompts seamlessly.',
      highlightColor: 'from-emerald-600 to-blue-600',
      badge: 'Encrypted Vault & Google One',
      details: [
        'Google Single Sign-On (SSO) with primary identity badge',
        '2TB Google One cloud storage breakdown & prompt archive',
        'Client-side AES-256-GCM zero-knowledge encryption via Web Crypto API',
        'Unified cross-account search across Drive, Gmail, Photos, and Memory Vault',
      ],
    },
  ];

  // Video Tour Autoplay Timer
  useEffect(() => {
    let interval: any = null;
    if (isPlaying) {
      interval = setInterval(() => {
        setSceneProgress((prev) => {
          if (prev >= 100) {
            setCurrentSceneIndex((idx) => {
              const next = (idx + 1) % demoScenes.length;
              // Speak narration for new scene
              speechEngine.speak(demoScenes[next].narration, {
                pitch: 1.05,
                rate: 1.0,
              });
              return next;
            });
            return 0;
          }
          return prev + 2.5; // ~40s per scene or ~4s per step
        });
      }, 100);
    }
    return () => clearInterval(interval);
  }, [isPlaying, demoScenes]);

  const togglePlay = () => {
    if (isPlaying) {
      setIsPlaying(false);
      speechEngine.stopSpeaking();
    } else {
      setIsPlaying(true);
      setSceneProgress(0);
      speechEngine.speak(demoScenes[currentSceneIndex].narration, {
        pitch: 1.05,
        rate: 1.0,
      });
    }
  };

  const handleNextScene = () => {
    const next = (currentSceneIndex + 1) % demoScenes.length;
    setCurrentSceneIndex(next);
    setSceneProgress(0);
    if (isPlaying) {
      speechEngine.speak(demoScenes[next].narration, { pitch: 1.05, rate: 1.0 });
    }
  };

  const handlePrevScene = () => {
    const prev = (currentSceneIndex - 1 + demoScenes.length) % demoScenes.length;
    setCurrentSceneIndex(prev);
    setSceneProgress(0);
    if (isPlaying) {
      speechEngine.speak(demoScenes[prev].narration, { pitch: 1.05, rate: 1.0 });
    }
  };

  const fullPrdMarkdown = `# SYSTEM SPECIFICATION & PRODUCT REQUIREMENT DOCUMENT (PRD)
## PROJECT: AuraFamily AI - Family Personal Assistant & Life Operating System
**Standard:** Google Engineering & Enterprise Architecture Guidelines (2026)
**Primary Stakeholder & Account:** digitaltamilworld@gmail.com
**Target Platforms:** Responsive Mobile Web App (PWA), Android & iOS native wrappers

---

### 1. EXECUTIVE VISION & PROBLEM STATEMENT
AuraFamily AI is a sovereign, family-centric AI Life Operating System engineered for high-performing founders and their families. It converges real-time empathetic conversational AI, multi-role family GPS tracking, 16-digit cryptographic pairing, ethical wealth compounding ("The Billionaire Blueprint"), autonomic longevity biometrics, and zero-knowledge AES-256 client-encrypted memory vaults.

---

### 2. CORE ARCHITECTURAL PILLARS

#### 2.1 Multi-Role Security & 16-Digit Code Exchange
- **Role Hierarchy:**
  1. **Primary Head of Family:** Full administrative oversight, financial allocation controls, real-time family location radar, activation code generation, master vault governance. (Bound to digitaltamilworld@gmail.com).
  2. **Secondary Family Members:** Restricted view, shared calendar, personal task lists, individual allowance metrics, emergency SOS triggers.
- **16-Digit Activation Handshake Protocol:**
  - Format: \`XXXX-XXXX-XXXX-XXXX\` (PBKDF2 derived / cryptographically random nonces).
  - Generated exclusively by Primary Account owner.
  - Redeemed by secondary devices to bind securely to the Family Circle without leaking credentials.

#### 2.2 Client-Side Zero-Knowledge Encryption (AES-256-GCM)
- All personal notes, family trusts, estate planning charters, and conversational memory context are encrypted directly in the user's browser using the native Web Crypto API (\`window.crypto.subtle\`).
- Keys are derived via PBKDF2 with 100,000 iterations from biometric/hardware seeds.
- Plaintext data never touches the wire without encryption.

#### 2.3 Real-Time Empathetic Voice & Gemini Intelligence
- Integrated with Gemini 3.8 Flash server-side SDK using official \`@google/genai\` patterns.
- Real-time speech recognition (STT) and voice synthesis (TTS) with warm empathetic intonation.
- Tone classifier, emotional state detection, and actionable suggestions.

#### 2.4 The Ethical Billionaire Blueprint (5-Phase Master Plan)
- **Phase 1 ($1M - $10M):** Sovereign Cashflow & High-Leverage Skills Monopoly.
- **Phase 2 ($10M - $100M):** Scalable Enterprise, Defensible AI Moats & 80%+ Gross Margins.
- **Phase 3 ($100M - $500M):** Conglomerate Holding & Asymmetric Capital Reinvestment.
- **Phase 4 ($500M - $1B+):** Sovereign Scale & Mission-Critical Monopolies.
- **Phase 5 ($1B+):** Intergenerational Governance & Civilizational Endowments.

#### 2.5 Phone Storage Access & Automated Document Summarizer
- Client-side file drop supporting PDFs, DOCX, TXT, JSON, and financial statements.
- Gemini server-side extraction creates structured executive summaries, action items, and calendar deadlines automatically.

#### 2.6 Longevity, Sleep & Wearable Ecosystem
- Simulated real-time sync with Apple Watch Ultra, Oura Ring Gen 3, Garmin, and Fitbit.
- Real-time tracking of Sleep Architecture (Deep, REM, Light, Readiness Score).
- Navy SEAL Box Breathing (4-4-4-4) meditation visualizer with autonomic nervous regulation.

#### 2.7 Google One SSO & Unified Cross-Account Search
- Google Single Sign-On integration.
- 2TB Google One storage allocation breakdown (Drive, Gmail, Photos, Assistant Memory).
- Unified cross-account search query engine.

---

### 3. API SPECIFICATION CONTRACTS

| Route | Method | Description |
|---|---|---|
| \`/api/chat\` | POST | Real-time conversational AI with emotion detection |
| \`/api/summarize-document\` | POST | Multi-modal document summarizer & calendar extractor |
| \`/api/writing-coach\` | POST | Tone analysis (Executive, Diplomatic, Persuasive, Empathetic) |
| \`/api/billionaire-advisory\` | POST | Strategic capital allocation & milestone advisory |
| \`/api/financial-insights\` | POST | Expense optimization & automated savings modeling |
| \`/api/wellness-plan\` | POST | Biometric longevity & nutrition protocol generator |
| \`/api/google-search-sync\` | POST | Unified Google One cross-account search |

---

### 4. COMPLIANCE & ZERO LEAKAGE CONTROLS
- No sensitive client data transmitted in unencrypted form.
- Passkeys & hardware biometric authentication enclave simulation.
- Offline access fallback with full local cache persistence.
`;

  const handleCopyPrd = () => {
    navigator.clipboard.writeText(fullPrdMarkdown);
    setCopiedDoc(true);
    setTimeout(() => setCopiedDoc(false), 2000);
  };

  const handleDownloadPrd = () => {
    const blob = new Blob([fullPrdMarkdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'AuraFamily_AI_Architecture_PRD.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  const activeScene = demoScenes[currentSceneIndex];

  return (
    <div className="space-y-6 pb-28 pt-2">
      {/* Top Selector: Demo Video vs System PRD */}
      <div className="flex items-center justify-between p-1.5 rounded-2xl bg-slate-900 border border-slate-800">
        <button
          onClick={() => setActiveSubTab('demo')}
          className={`flex-1 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
            activeSubTab === 'demo'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Play className="w-3.5 h-3.5" />
          <span>Interactive App Demo Tour (Video Mode)</span>
        </button>

        <button
          onClick={() => setActiveSubTab('prd')}
          className={`flex-1 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
            activeSubTab === 'prd'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Architecture & PRD Document</span>
        </button>
      </div>

      {activeSubTab === 'demo' ? (
        /* INTERACTIVE DEMO VIDEO PLAYER MODE */
        <div className="space-y-5">
          {/* Virtual Video Canvas Display */}
          <div className="rounded-3xl border border-slate-800 bg-slate-900/95 overflow-hidden shadow-2xl relative">
            {/* Simulated Video Player Screen */}
            <div className={`relative h-80 sm:h-96 bg-gradient-to-br ${activeScene.highlightColor} p-6 sm:p-8 flex flex-col justify-between overflow-hidden text-white transition-all duration-700`}>
              <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm pointer-events-none" />
              <div className="absolute -top-24 -right-24 w-80 h-80 bg-white/10 rounded-full blur-3xl pointer-events-none" />

              {/* Video Overlay Top Badge */}
              <div className="relative z-10 flex items-center justify-between">
                <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-white/20 backdrop-blur-md border border-white/30">
                  {activeScene.badge}
                </span>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono opacity-80">
                    Scene {currentSceneIndex + 1} of {demoScenes.length}
                  </span>
                  {isPlaying && (
                    <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-rose-500 text-[10px] font-bold animate-pulse">
                      <span className="w-1.5 h-1.5 rounded-full bg-white" />
                      REC / PLAYING
                    </span>
                  )}
                </div>
              </div>

              {/* Video Scene Center Content */}
              <div className="relative z-10 space-y-3 max-w-lg">
                <h3 className="text-xl sm:text-2xl font-black tracking-tight drop-shadow-md">
                  {activeScene.title}
                </h3>
                <p className="text-xs sm:text-sm text-slate-200 font-medium leading-relaxed drop-shadow">
                  {activeScene.subtitle}
                </p>

                {/* Animated Highlights Pills */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                  {activeScene.details.slice(0, 4).map((d, idx) => (
                    <div
                      key={idx}
                      className="p-2 rounded-xl bg-slate-950/60 border border-white/20 text-[11px] text-slate-100 flex items-center gap-2 backdrop-blur-md"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="truncate">{d}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Subtitles / Narration Bar */}
              <div className="relative z-10 p-3 rounded-2xl bg-slate-950/80 border border-white/20 backdrop-blur-md">
                <div className="flex items-center gap-2 text-indigo-300 text-xs font-bold mb-1">
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>Aura Live Voiceover Narration:</span>
                </div>
                <p className="text-xs text-slate-200 italic leading-snug">
                  "{activeScene.narration}"
                </p>
              </div>

              {/* Video Timeline Progress Bar */}
              <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-slate-800">
                <div
                  className="bg-white h-full transition-all duration-100"
                  style={{ width: `${sceneProgress}%` }}
                />
              </div>
            </div>

            {/* Video Player Controls Bar */}
            <div className="p-4 bg-slate-950 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={togglePlay}
                  className="p-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md active:scale-95"
                  title={isPlaying ? 'Pause Demo' : 'Play Interactive Video Tour'}
                >
                  {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-white" />}
                </button>

                <button
                  onClick={handlePrevScene}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 transition-colors"
                >
                  Previous
                </button>

                <button
                  onClick={handleNextScene}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 transition-colors"
                >
                  Next Scene
                </button>
              </div>

              {/* Scene Indicators */}
              <div className="flex items-center gap-1.5">
                {demoScenes.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setCurrentSceneIndex(idx);
                      setSceneProgress(0);
                    }}
                    className={`h-2 rounded-full transition-all ${
                      currentSceneIndex === idx
                        ? 'w-6 bg-indigo-500'
                        : 'w-2 bg-slate-800 hover:bg-slate-700'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Scene Breakdown List */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
              Tour Chapters & Flagship Capabilities
            </h4>
            {demoScenes.map((scene, idx) => (
              <div
                key={scene.id}
                onClick={() => {
                  setCurrentSceneIndex(idx);
                  setSceneProgress(0);
                }}
                className={`cursor-pointer p-3.5 rounded-2xl border transition-all text-xs flex items-center justify-between ${
                  currentSceneIndex === idx
                    ? 'bg-slate-800 border-indigo-500/50 text-white'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs font-bold opacity-60">0{idx + 1}</span>
                  <div>
                    <strong className="block text-slate-200">{scene.title.split(':')[1] || scene.title}</strong>
                    <span className="text-[11px] text-slate-500">{scene.subtitle}</span>
                  </div>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-950 border border-slate-800 text-slate-400">
                  {scene.badge}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* FULL PRD & ARCHITECTURE SPECIFICATION */
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-3xl bg-slate-900 border border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-white">Full System Architecture & PRD Document</h3>
              <p className="text-xs text-slate-400">Complete IEEE / Google Engineering Standard Specification</p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyPrd}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition-colors"
              >
                {copiedDoc ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedDoc ? 'Copied' : 'Copy PRD'}</span>
              </button>

              <button
                onClick={handleDownloadPrd}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-colors shadow-md shadow-indigo-600/30"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download .MD</span>
              </button>
            </div>
          </div>

          <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 font-mono text-xs leading-relaxed text-slate-300 space-y-4 whitespace-pre-wrap overflow-x-auto max-h-[600px] overflow-y-auto">
            {fullPrdMarkdown}
          </div>
        </div>
      )}
    </div>
  );
};
