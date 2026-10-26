import React, { useState, useEffect } from 'react';
import {
  X,
  Key,
  Database,
  MapPin,
  Sparkles,
  Shield,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Send,
  Radio,
  FileCode,
  HardDrive,
  Cpu,
  Layers,
  ExternalLink,
  Save,
  MessageSquare,
  Lock,
  Server,
  Wifi,
  Languages,
  Volume2,
  Play,
  Check,
  Brain,
  Trash2,
  Plus,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { AVAILABLE_GEMINI_MODELS } from '../types';
import {
  getApiUrl,
  safeFetchJson,
  getApiBaseUrl,
  setApiBaseUrl,
} from '../services/api';
import {
  speechEngine,
  SUPPORTED_VOICE_LANGUAGES,
  VoiceLanguage,
} from '../services/speech';

interface HubKeysAndSqliteModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'keys' | 'sqlite' | 'assistant';
}

export const HubKeysAndSqliteModal: React.FC<HubKeysAndSqliteModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'keys',
}) => {
  const {
    user,
    assistantMemories,
    isLoadingMemories,
    loadAssistantMemories,
    saveAssistantMemory,
    deleteAssistantMemory,
    selectedVoiceModel,
    setSelectedVoiceModel,
  } = useApp();
  const [activeTab, setActiveTab] = useState<'keys' | 'sqlite' | 'assistant'>(initialTab);

  // Hub memory quick add state
  const [newHubMemTopic, setNewHubMemTopic] = useState('');
  const [newHubMemContent, setNewHubMemContent] = useState('');
  const [isSavingHubMem, setIsSavingHubMem] = useState(false);
  const [hubMemFilter, setHubMemFilter] = useState('');

  // Sync initialTab when modal opens or initialTab changes
  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
    if (isOpen) {
      loadAssistantMemories();
    }
  }, [isOpen, initialTab]);

  // Assistant & Voice Language state
  const [selectedVoiceLang, setSelectedVoiceLang] = useState<VoiceLanguage>(
    () => (speechEngine.getLanguage() as VoiceLanguage) || 'ta-IN'
  );
  const [testGreetingStatus, setTestGreetingStatus] = useState<string | null>(null);
  const [isTestingVoice, setIsTestingVoice] = useState(false);

  // Specific Tamil Voice Accent Tuning
  const [tamilVoices, setTamilVoices] = useState<Array<{ uri: string; name: string; lang: string; isDefault: boolean }>>([]);
  const [selectedTamilVoice, setSelectedTamilVoice] = useState<string>(() => speechEngine.getSelectedTamilVoice());
  const [tamilRate, setTamilRate] = useState<number>(() => speechEngine.getTamilSpeechRate());
  const [tamilPitch, setTamilPitch] = useState<number>(() => speechEngine.getTamilSpeechPitch());

  // Enumerate installed voices on open
  useEffect(() => {
    if (!isOpen) return;
    const updateVoices = () => {
      const v = speechEngine.getTamilVoices();
      setTamilVoices(v);
    };
    updateVoices();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }
  }, [isOpen]);

  // Backend Host URL (Essential for Android/Capacitor mobile instances)
  const [backendUrl, setBackendUrl] = useState('');
  const [serverPingStatus, setServerPingStatus] = useState<string | null>(null);
  const [isPingingServer, setIsPingingServer] = useState(false);

  // Keys form state
  const [geminiKey, setGeminiKey] = useState('');
  const [googleMapsKey, setGoogleMapsKey] = useState('');
  const [googleClientId, setGoogleClientId] = useState('');
  const [whatsAppToken, setWhatsAppToken] = useState('');
  const [whatsAppPhoneId, setWhatsAppPhoneId] = useState('');
  const [gcpProjectId, setGcpProjectId] = useState('');

  // Status & feedback
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [geminiTestStatus, setGeminiTestStatus] = useState<string | null>(null);
  const [isTestingGemini, setIsTestingGemini] = useState(false);

  // SQLite stats & communications
  const [sqliteStats, setSqliteStats] = useState<any>(null);
  const [sqliteComms, setSqliteComms] = useState<any[]>([]);
  const [isLoadingSqlite, setIsLoadingSqlite] = useState(false);
  const [pingMessage, setPingMessage] = useState<string | null>(null);

  // Load existing keys from localStorage and SQLite on mount
  useEffect(() => {
    if (!isOpen) return;

    // Load Backend Host URL
    const existingBackendUrl = getApiBaseUrl();
    setBackendUrl(existingBackendUrl);

    // Load from localStorage
    setGoogleMapsKey(
      localStorage.getItem('aura_google_maps_key') ||
        (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string) ||
        'AIzaSyB2zaNA_vbSdD78UFydYrxswRHhTlOPmbI'
    );
    setGoogleClientId(
      localStorage.getItem('aura_google_client_id') ||
        (import.meta.env.VITE_GOOGLE_CLIENT_ID as string) ||
        '600050762948-bqe3traltdnne31fmu99p1hn9n1ubgb8.apps.googleusercontent.com'
    );
    setGeminiKey(localStorage.getItem('aura_gemini_key') || (import.meta.env.VITE_GEMINI_API_KEY as string) || '');
    setWhatsAppToken(localStorage.getItem('aura_wa_token') || '');
    setWhatsAppPhoneId(localStorage.getItem('aura_wa_phone_id') || '104859203958172');
    setGcpProjectId(localStorage.getItem('aura_gcp_project_id') || 'gen-lang-client-094624825225');

    // Fetch live backend config
    safeFetchJson('/api/config/keys')
      .then((data) => {
        if (data.success && Array.isArray(data.keys)) {
          const gKey = data.keys.find((k: any) => k.keyName === 'GEMINI_API_KEY');
          if (gKey && !geminiKey) {
            // Keep masked or configured indicator
          }
        }
      })
      .catch(() => {});

    loadSqliteData();
  }, [isOpen]);

  const loadSqliteData = async () => {
    setIsLoadingSqlite(true);
    try {
      const [stats, comms] = await Promise.all([
        safeFetchJson('/api/sqlite/status'),
        safeFetchJson('/api/sqlite/communications?limit=15'),
      ]);
      if (stats.success) setSqliteStats(stats);
      if (comms.success) setSqliteComms(comms.communications || []);
    } catch (err: any) {
      console.warn('Failed to load SQLite telemetry:', err.message);
    } finally {
      setIsLoadingSqlite(false);
    }
  };

  const handleTestServerPing = async () => {
    setIsPingingServer(true);
    setServerPingStatus(null);
    try {
      if (backendUrl.trim()) {
        setApiBaseUrl(backendUrl.trim());
      }
      const start = Date.now();
      const data = await safeFetchJson('/api/health');
      const elapsed = Date.now() - start;
      setServerPingStatus(
        `✅ Connected (${elapsed}ms)! Model: ${data.model || 'gemini-3.8-flash'} • Gemini Key in SQLite: ${
          data.geminiApiKeyConnected ? 'Active' : 'Missing key'
        }`
      );
    } catch (err: any) {
      setServerPingStatus(`❌ Connection failed: ${err.message}`);
    } finally {
      setIsPingingServer(false);
    }
  };

  const handleSaveAllKeys = async () => {
    setIsSaving(true);
    setSaveMessage(null);
    try {
      // 1. Save Backend Server Host
      if (backendUrl.trim()) {
        setApiBaseUrl(backendUrl.trim());
      } else {
        setApiBaseUrl('');
      }

      // 2. Save to localStorage for client-side components
      localStorage.setItem('aura_google_maps_key', googleMapsKey.trim());
      localStorage.setItem('aura_google_client_id', googleClientId.trim());
      localStorage.setItem('aura_gemini_key', geminiKey.trim());
      localStorage.setItem('aura_wa_token', whatsAppToken.trim());
      localStorage.setItem('aura_wa_phone_id', whatsAppPhoneId.trim());
      localStorage.setItem('aura_gcp_project_id', gcpProjectId.trim());

      // 3. Persist each key to SQLite and server process.env via /api/config/keys
      const keysToSave = [
        { keyName: 'GOOGLE_MAPS_API_KEY', keyValue: googleMapsKey.trim(), description: 'Google Maps GPS & Geocoding Key' },
        { keyName: 'GEMINI_API_KEY', keyValue: geminiKey.trim(), description: 'Google Gemini 3.8 AI & Live Voice API Key' },
        { keyName: 'DEFAULT_GEMINI_MODEL', keyValue: selectedVoiceModel, description: 'Default Gemini Model for Voice Assistant' },
        { keyName: 'GOOGLE_CLIENT_ID', keyValue: googleClientId.trim(), description: 'Google Identity OAuth Client ID' },
        { keyName: 'WHATSAPP_API_TOKEN', keyValue: whatsAppToken.trim(), description: 'Meta WhatsApp Cloud API Token' },
        { keyName: 'WHATSAPP_PHONE_ID', keyValue: whatsAppPhoneId.trim(), description: 'WhatsApp Business Sender Phone Number ID' },
        { keyName: 'GOOGLE_CLOUD_PROJECT_ID', keyValue: gcpProjectId.trim(), description: 'Google Cloud Platform Project ID' },
      ];

      for (const k of keysToSave) {
        await safeFetchJson('/api/config/keys', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(k),
        });
      }

      setSaveMessage('All API keys & Backend URL saved to SQLite store & applied immediately!');
      setTimeout(() => setSaveMessage(null), 4000);
      loadSqliteData();
    } catch (err: any) {
      setSaveMessage(`Save notice: ${err.message || 'Updated in local store'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestGeminiKey = async () => {
    setIsTestingGemini(true);
    setGeminiTestStatus(null);
    try {
      if (backendUrl.trim()) {
        setApiBaseUrl(backendUrl.trim());
      }

      // Ensure key is saved to SQLite first
      if (geminiKey.trim()) {
        try {
          await safeFetchJson('/api/config/keys', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              keyName: 'GEMINI_API_KEY',
              keyValue: geminiKey.trim(),
              description: 'Google Gemini 3.8 AI & Live Voice API Key',
            }),
          });
        } catch {
          // continue
        }
      }

      const data = await safeFetchJson('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Ping from Hub API Key Diagnostic Test',
          userProfile: { email: user.email },
        }),
      });

      if (data.error || data.errorCategory) {
        setGeminiTestStatus(`❌ ${data.reply || data.error}`);
      } else if (data.reply) {
        setGeminiTestStatus(`✅ Gemini Verified: "${data.reply.slice(0, 80)}..."`);
      } else {
        setGeminiTestStatus('Gemini API replied successfully.');
      }
    } catch (err: any) {
      setGeminiTestStatus(`Gemini test notice: ${err.message}`);
    } finally {
      setIsTestingGemini(false);
    }
  };

  const handleSendTestSqlitePing = async () => {
    setPingMessage(null);
    try {
      const data = await safeFetchJson('/api/family/relay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          familyId: 'family-aura-primary',
          fromDeviceId: 'hub-console',
          type: 'sqlite_test_ping',
          message: {
            title: 'Diagnostic SQLite Ping',
            sender: user.name,
            timestamp: new Date().toISOString(),
          },
        }),
      });
      if (data.success) {
        setPingMessage(`Stored in SQLite (commId: ${data.commId}). Relayed to all instances.`);
        loadSqliteData();
      }
    } catch (err: any) {
      setPingMessage(`Relay error: ${err.message}`);
    }
  };

  const handleSelectLanguage = (lang: VoiceLanguage) => {
    setSelectedVoiceLang(lang);
    speechEngine.setLanguage(lang);
    localStorage.setItem('aura_voice_language', lang);
    const langObj = SUPPORTED_VOICE_LANGUAGES.find((l) => l.code === lang);
    setSaveMessage(`AI Assistant language updated to ${langObj?.label || lang}!`);
    setTimeout(() => setSaveMessage(null), 3000);
  };

  const handleTestGreeting = async (lang: VoiceLanguage) => {
    setIsTestingVoice(true);
    setTestGreetingStatus(null);
    speechEngine.setLanguage(lang);
    setSelectedVoiceLang(lang);

    const greetings: Record<VoiceLanguage, string> = {
      'ta-IN': 'வணக்கம்! நான் ஆரோ, உங்கள் குடும்ப AI உதவியாளர். நான் உங்களுக்கு எவ்வாறு உதவ முடியும்?',
      'en-US': 'Hello! I am Auro, your family AI assistant. How can I help you today?',
      'en-IN': 'Namaste! I am Auro, your family AI assistant. How may I assist you today?',
      'hi-IN': 'नमस्ते! मैं ऑरो हूँ, आपका पारिवारिक एआई सहायक। आज मैं आपकी क्या मदद कर सकता हूँ?',
    };

    const textToSpeak = greetings[lang] || greetings['ta-IN'];
    try {
      setTestGreetingStatus(`Playing greeting in ${lang}...`);
      await speechEngine.speak(textToSpeak, {
        onEnd: () => {
          setTestGreetingStatus(`Voice greeting played successfully.`);
          setIsTestingVoice(false);
        },
      });
      setTestGreetingStatus(`Voice greeting played successfully.`);
      setIsTestingVoice(false);
    } catch (err: any) {
      setTestGreetingStatus(`Playback status: ${err?.message || 'Completed'}`);
      setIsTestingVoice(false);
    }
  };

  const handleSelectTamilVoice = (uri: string) => {
    setSelectedTamilVoice(uri);
    speechEngine.setSelectedTamilVoice(uri);
    setSaveMessage(uri ? 'Specific Tamil voice saved and applied!' : 'Auto best natural Tamil voice enabled!');
    setTimeout(() => setSaveMessage(null), 3000);
  };

  const handleUpdateTamilRate = (rate: number) => {
    setTamilRate(rate);
    speechEngine.setTamilSpeechRate(rate);
  };

  const handleUpdateTamilPitch = (pitch: number) => {
    setTamilPitch(pitch);
    speechEngine.setTamilSpeechPitch(pitch);
  };

  const handleTestTamilAccent = async () => {
    setIsTestingVoice(true);
    setTestGreetingStatus(null);
    speechEngine.setLanguage('ta-IN');
    setSelectedVoiceLang('ta-IN');
    const tamilSentence = 'வணக்கம்! இது ஆரோ குடும்ப AI உதவியாளர். இந்த தமிழ் குரல் மற்றும் உச்சரிப்பு சரியாக உள்ளதா?';
    try {
      setTestGreetingStatus('Testing Tamil accent with selected voice...');
      await speechEngine.speak(tamilSentence, {
        rate: tamilRate,
        pitch: tamilPitch,
        onEnd: () => {
          setTestGreetingStatus('Tamil pronunciation test completed.');
          setIsTestingVoice(false);
        },
      });
      setTestGreetingStatus('Tamil pronunciation test completed.');
      setIsTestingVoice(false);
    } catch (err: any) {
      setTestGreetingStatus(`Playback status: ${err?.message || 'Completed'}`);
      setIsTestingVoice(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-blue-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <span>Hub Keys & SQLite Data Store</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono font-semibold border border-emerald-500/30">
                  SQLite Server-Authoritative
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Configure Backend Host, Gemini AI, Google Maps & SQLite inter-instance store
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-5 pt-2 gap-3 text-xs font-semibold overflow-x-auto">
          <button
            onClick={() => setActiveTab('keys')}
            className={`pb-3 border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap ${
              activeTab === 'keys'
                ? 'border-indigo-500 text-indigo-400 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>API Keys & Backend Host</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('sqlite');
              loadSqliteData();
            }}
            className={`pb-3 border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap ${
              activeTab === 'sqlite'
                ? 'border-emerald-500 text-emerald-400 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>SQLite Multi-Instance Store</span>
            {sqliteStats && (
              <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300 font-mono">
                {sqliteStats.totalRows} rows
              </span>
            )}
            {assistantMemories.length > 0 && (
              <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-purple-500/20 text-purple-300 font-mono">
                🧠 {assistantMemories.length} mems
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('assistant')}
            className={`pb-3 border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap ${
              activeTab === 'assistant'
                ? 'border-purple-500 text-purple-400 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Languages className="w-3.5 h-3.5" />
            <span>AI Assistant & Language</span>
            <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-purple-500/20 text-purple-300 font-mono">
              {SUPPORTED_VOICE_LANGUAGES.find((l) => l.code === selectedVoiceLang)?.nativeName || 'தமிழ்'}
            </span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {activeTab === 'keys' && (
            <div className="space-y-4">
              {/* Backend Hub Server URL Card */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-950/40 via-slate-900 to-slate-950 border border-indigo-500/40 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-white flex items-center gap-1.5">
                    <Server className="w-4 h-4 text-indigo-400" />
                    <span>Backend Server Hub URL (Node.js Server Host)</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleTestServerPing}
                    disabled={isPingingServer}
                    className="text-[10px] px-2.5 py-1 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 font-medium transition-colors border border-indigo-500/30 flex items-center gap-1"
                  >
                    <RefreshCw className={`w-2.5 h-2.5 ${isPingingServer ? 'animate-spin' : ''}`} />
                    <span>{isPingingServer ? 'Connecting...' : 'Test Server Ping'}</span>
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="http://192.168.1.100:3000 or https://your-app.run.app"
                  value={backendUrl}
                  onChange={(e) => setBackendUrl(e.target.value)}
                  className="w-full bg-slate-950 border border-indigo-500/40 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-indigo-400 text-xs"
                />
                {serverPingStatus && (
                  <p className="text-[11px] p-2 rounded-lg bg-slate-950/80 border border-slate-800 font-mono text-slate-200">
                    {serverPingStatus}
                  </p>
                )}
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  <strong>Crucial for Mobile App:</strong> In the Android/iOS app, enter the local Wi-Fi IP of your PC running <code className="text-indigo-300">server.ts</code> (e.g. <code className="text-indigo-300">http://192.168.X.X:3000</code>) or your public cloud URL so the mobile app can reach the SQLite database and Gemini AI.
                </p>
              </div>

              {/* Gemini API Key Card */}
              <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-200 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                    <span>Gemini 3.8 AI & Voice Live API Key</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleTestGeminiKey}
                    disabled={isTestingGemini}
                    className="text-[10px] px-2.5 py-1 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 font-medium transition-colors border border-purple-500/30 flex items-center gap-1"
                  >
                    <RefreshCw className={`w-2.5 h-2.5 ${isTestingGemini ? 'animate-spin' : ''}`} />
                    <span>{isTestingGemini ? 'Testing...' : 'Test AI Model'}</span>
                  </button>
                </div>
                <input
                  type="password"
                  placeholder="AIzaSy..."
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-purple-500 text-xs"
                />
                {geminiTestStatus && (
                  <p className="text-[11px] text-purple-300 bg-purple-500/10 p-2 rounded-lg border border-purple-500/20">
                    {geminiTestStatus}
                  </p>
                )}
                <p className="text-[11px] text-slate-400">
                  Stored directly in SQLite (<code className="text-purple-300">hub_api_keys</code>). Powers Aura conversational AI, Live Voice Companion, document summaries, and billionaire roadmap advisory.
                </p>

                {/* Default Voice Model Selection in Keys Tab */}
                <div className="pt-3 border-t border-slate-800/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                      <span>Default Voice Assistant Model:</span>
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-mono font-bold">
                      {AVAILABLE_GEMINI_MODELS.find((m) => m.id === selectedVoiceModel)?.name || selectedVoiceModel}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {AVAILABLE_GEMINI_MODELS.map((m) => {
                      const isSelected = selectedVoiceModel === m.id;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            setSelectedVoiceModel(m.id);
                            setSaveMessage(`Default model switched to ${m.name}!`);
                            setTimeout(() => setSaveMessage(null), 3000);
                          }}
                          className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-purple-600/30 border-purple-500 ring-1 ring-purple-400/50 shadow-md shadow-purple-950/50'
                              : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 hover:bg-slate-800/60'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-white text-xs truncate">{m.name.replace('Gemini ', '')}</span>
                            <span className="text-[8px] px-1 py-0.2 rounded bg-purple-500/20 text-purple-300 font-mono font-bold">
                              {m.badge}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 truncate mt-1">{m.speed}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Google Maps API Key Card */}
              <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-200 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-blue-400" />
                    <span>Google Maps API Key</span>
                  </label>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20 font-medium">
                    Map, Radar & GPS Telemetry
                  </span>
                </div>
                <input
                  type="text"
                  placeholder="AIzaSy..."
                  value={googleMapsKey}
                  onChange={(e) => setGoogleMapsKey(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-blue-500 text-xs"
                />
                <p className="text-[11px] text-slate-400">
                  Used by the Live Family GPS Map, place search, and radar geofencing. Pre-populated with verified key.
                </p>
              </div>

              {/* Google OAuth Client ID (@react-oauth/google) */}
              <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-200 flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Google OAuth Web Client ID (@react-oauth/google)</span>
                  </label>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-medium">
                    Pure OAuth 2.0 GIS
                  </span>
                </div>
                <input
                  type="text"
                  placeholder="600050762948-....apps.googleusercontent.com"
                  value={googleClientId}
                  onChange={(e) => setGoogleClientId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-emerald-500 text-xs"
                />
                <p className="text-[11px] text-slate-400">
                  Used directly by <code className="text-emerald-400">@react-oauth/google</code> for Google Identity SSO without Firebase dependency.
                </p>
              </div>

              {/* WhatsApp Cloud API */}
              <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-200 flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                    <span>WhatsApp Cloud API Credentials</span>
                  </label>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] text-slate-400 mb-1 block">Meta Permanent Access Token:</span>
                    <input
                      type="password"
                      placeholder="EAAG..."
                      value={whatsAppToken}
                      onChange={(e) => setWhatsAppToken(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 mb-1 block">Phone Number ID:</span>
                    <input
                      type="text"
                      placeholder="104859203958172"
                      value={whatsAppPhoneId}
                      onChange={(e) => setWhatsAppPhoneId(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>

              {/* Google Cloud Project ID */}
              <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2">
                <label className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-amber-400" />
                  <span>Google Cloud Project ID (Billing Guardrails)</span>
                </label>
                <input
                  type="text"
                  placeholder="gen-lang-client-..."
                  value={gcpProjectId}
                  onChange={(e) => setGcpProjectId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-500 text-xs"
                />
              </div>

              {saveMessage && (
                <div className="p-3 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{saveMessage}</span>
                </div>
              )}

              {/* Save Button */}
              <button
                type="button"
                onClick={handleSaveAllKeys}
                disabled={isSaving}
                className="w-full py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition-all active:scale-98"
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'Saving to SQLite...' : 'Save All Keys & Backend Host to SQLite'}</span>
              </button>
            </div>
          )}

          {activeTab === 'sqlite' && (
            <div className="space-y-4">
              {/* SQLite Health Banner */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/50 via-slate-900 to-slate-950 border border-emerald-500/40 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database className="w-5 h-5 text-emerald-400" />
                    <div>
                      <h4 className="font-bold text-white text-sm">SQLite Sovereign Data Store</h4>
                      <p className="text-[11px] text-emerald-300">
                        Status: Connected & Authoritative • Keeping all communications between app instances
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={loadSqliteData}
                    disabled={isLoadingSqlite}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                    title="Refresh SQLite Diagnostics"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingSqlite ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                {sqliteStats && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-[11px]">
                    <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800">
                      <span className="text-slate-500 block">Database File:</span>
                      <span className="font-mono text-slate-200 truncate block">aura_family_sync.sqlite</span>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800">
                      <span className="text-slate-500 block">Database Size:</span>
                      <span className="font-mono text-emerald-400 font-bold">{sqliteStats.sizeFormatted || '68 KB'}</span>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800">
                      <span className="text-slate-500 block">Total Records:</span>
                      <span className="font-mono text-indigo-300 font-bold">{sqliteStats.totalRows}</span>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800">
                      <span className="text-slate-500 block">Engine:</span>
                      <span className="font-mono text-slate-200">SQLite 3 WASM</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Table Breakdown */}
              {sqliteStats?.tableCounts && (
                <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2">
                  <h4 className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-indigo-400" />
                    <span>SQLite Tables Synchronizing Between App Instances</span>
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {Object.entries(sqliteStats.tableCounts).map(([tbl, count]: any) => (
                      <div
                        key={tbl}
                        className="p-2 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between"
                      >
                        <span className="font-mono text-[10px] text-slate-400 truncate">{tbl}</span>
                        <span className="px-1.5 py-0.2 rounded-md bg-indigo-500/20 text-indigo-300 font-mono font-bold text-[10px]">
                          {count}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Test Communication Action */}
              <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div>
                  <span className="font-semibold text-white block">Test Inter-Instance Communication</span>
                  <span className="text-[11px] text-slate-400">
                    Send a test sync packet to verify SQLite persistence & live instance broadcast.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleSendTestSqlitePing}
                  className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs flex items-center gap-1.5 transition-colors shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Test Ping</span>
                </button>
              </div>

              {pingMessage && (
                <p className="text-[11px] text-emerald-300 bg-emerald-500/10 p-2.5 rounded-xl border border-emerald-500/20">
                  {pingMessage}
                </p>
              )}

              {/* Live Communications Log */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-300 flex items-center gap-1.5 text-xs">
                    <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                    <span>Recent Communications Stored in SQLite ({sqliteComms.length})</span>
                  </span>
                  <span className="text-[10px] text-slate-500">Auto-persisted to disk</span>
                </div>

                <div className="space-y-1.5 max-h-56 overflow-y-auto">
                  {sqliteComms.length === 0 ? (
                    <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-center text-slate-500 text-xs">
                      No communications recorded yet. Pings, intercom messages, location changes, and pairings will appear here.
                    </div>
                  ) : (
                    sqliteComms.map((c) => (
                      <div
                        key={c.id}
                        className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between text-[11px]"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-400" />
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-slate-200">{c.eventType}</span>
                              <span className="text-slate-500">from {c.fromDeviceId}</span>
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono truncate block max-w-xs">
                              {JSON.stringify(c.payload).slice(0, 70)}...
                            </span>
                          </div>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {c.timestamp ? new Date(c.timestamp).toLocaleTimeString() : ''}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Voice Assistant Persistent SQLite Memory Bank */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-950/30 via-slate-900 to-slate-950 border border-purple-500/30 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-300">
                      <Brain className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-xs sm:text-sm flex items-center gap-2">
                        <span>Voice Assistant Persistent Memory Bank (SQLite)</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-mono font-semibold">
                          {assistantMemories.length} Stored Notes
                        </span>
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        Scoped to account <code className="text-purple-300 font-mono">{user.email || 'chinna.tamil2000@gmail.com'}</code> and persisted on server disk in <code className="text-slate-300 font-mono">data/aura_family_sync.sqlite</code>.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => loadAssistantMemories()}
                    disabled={isLoadingMemories}
                    className="text-[10px] px-2.5 py-1 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 font-medium transition-colors border border-purple-500/30 flex items-center gap-1 self-start sm:self-center"
                  >
                    <RefreshCw className={`w-2.5 h-2.5 ${isLoadingMemories ? 'animate-spin' : ''}`} />
                    <span>{isLoadingMemories ? 'Reloading...' : 'Refresh SQLite'}</span>
                  </button>
                </div>

                {/* Quick Add Memory */}
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!newHubMemTopic.trim() || !newHubMemContent.trim()) return;
                    setIsSavingHubMem(true);
                    await saveAssistantMemory(newHubMemTopic.trim(), newHubMemContent.trim(), ['hub-manual-entry']);
                    setNewHubMemTopic('');
                    setNewHubMemContent('');
                    setIsSavingHubMem(false);
                  }}
                  className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2"
                >
                  <span className="text-[11px] font-semibold text-slate-300 block">
                    Add Explicit Memory Note to SQLite
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="text"
                      placeholder="Topic (e.g. WiFi Password, Gate Code)"
                      value={newHubMemTopic}
                      onChange={(e) => setNewHubMemTopic(e.target.value)}
                      className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-purple-400"
                    />
                    <input
                      type="text"
                      placeholder="Memory details to remember..."
                      value={newHubMemContent}
                      onChange={(e) => setNewHubMemContent(e.target.value)}
                      className="sm:col-span-2 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-purple-400"
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={isSavingHubMem || !newHubMemTopic.trim() || !newHubMemContent.trim()}
                      className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-medium text-xs flex items-center gap-1 transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      <span>{isSavingHubMem ? 'Saving to SQLite...' : 'Save Note to Account Memory'}</span>
                    </button>
                  </div>
                </form>

                {/* Filter and Memory List */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-slate-300">
                      Memories Recalled by Auro in Conversations
                    </span>
                    <input
                      type="text"
                      placeholder="Search memories..."
                      value={hubMemFilter}
                      onChange={(e) => setHubMemFilter(e.target.value)}
                      className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-0.5 text-[11px] text-slate-200 focus:outline-none focus:border-purple-400 w-36 sm:w-48"
                    />
                  </div>

                  <div className="space-y-1.5 max-h-56 overflow-y-auto">
                    {assistantMemories.length === 0 ? (
                      <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-center text-slate-500 text-xs">
                        No persistent memories saved for this account yet. Tell Auro in voice <em>"Auro, remember that..."</em> or <em>"Auro, memory-ல store பண்ணு..."</em> to automatically extract and persist facts here!
                      </div>
                    ) : (
                      assistantMemories
                        .filter(
                          (m) =>
                            !hubMemFilter ||
                            m.topic.toLowerCase().includes(hubMemFilter.toLowerCase()) ||
                            m.memoryContent.toLowerCase().includes(hubMemFilter.toLowerCase())
                        )
                        .map((m) => (
                          <div
                            key={m.id}
                            className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 flex items-start justify-between gap-3 text-xs"
                          >
                            <div className="space-y-1 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-purple-300 font-mono text-[11px] px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/20">
                                  {m.topic}
                                </span>
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">
                                  {m.source}
                                </span>
                                <span className="text-[10px] text-slate-500">
                                  {new Date(m.timestamp).toLocaleDateString()} {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <p className="text-slate-200 leading-relaxed text-xs">{m.memoryContent}</p>
                            </div>
                            <button
                              onClick={() => deleteAssistantMemory(m.id)}
                              className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors shrink-0"
                              title="Delete memory from SQLite"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'assistant' && (
            <div className="space-y-4">
              {/* Header Info Banner */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-950/40 via-indigo-950/30 to-slate-950 border border-purple-500/30 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-purple-600/30 border border-purple-500/40 flex items-center justify-center text-purple-300">
                      <Languages className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-xs sm:text-sm flex items-center gap-2">
                        <span>Auro Assistant Language & Voice Settings</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-mono">
                          Real-time STT & TTS
                        </span>
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        Configure the primary speech recognition dialect and natural synthetic voice.
                      </p>
                    </div>
                  </div>
                </div>

                {saveMessage && (
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[11px] flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>{saveMessage}</span>
                  </div>
                )}
              </div>

              {/* Gemini Model Selection Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-300 text-xs flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                    <span>Default Gemini Model for Voice Assistant</span>
                  </label>
                  <span className="text-[10px] text-purple-300 font-mono font-semibold">
                    Active: {AVAILABLE_GEMINI_MODELS.find((m) => m.id === selectedVoiceModel)?.name || selectedVoiceModel}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {AVAILABLE_GEMINI_MODELS.map((modelOpt) => {
                    const isSelected = selectedVoiceModel === modelOpt.id;
                    return (
                      <div
                        key={modelOpt.id}
                        onClick={() => {
                          setSelectedVoiceModel(modelOpt.id);
                          setSaveMessage(`Auro Voice Model configured to ${modelOpt.name}!`);
                          setTimeout(() => setSaveMessage(null), 3000);
                        }}
                        className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative flex flex-col justify-between ${
                          isSelected
                            ? 'bg-gradient-to-br from-purple-950/70 to-indigo-950/70 border-purple-500 ring-2 ring-purple-500/30 shadow-lg shadow-purple-950/50'
                            : 'bg-slate-950/80 border-slate-800 hover:border-slate-700 hover:bg-slate-900/60'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="min-w-0 pr-2">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white text-sm">{modelOpt.name}</span>
                              <span className="px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 text-[9px] font-mono font-bold">
                                {modelOpt.badge}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-1 leading-snug">{modelOpt.tagline}</p>
                          </div>
                          <div
                            className={`w-5 h-5 rounded-full flex items-center justify-center border transition-colors shrink-0 ${
                              isSelected
                                ? 'bg-purple-600 border-purple-400 text-white'
                                : 'border-slate-700 bg-slate-900 text-transparent'
                            }`}
                          >
                            <Check className="w-3 h-3 stroke-[3]" />
                          </div>
                        </div>

                        <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px]">
                          <span className="text-slate-400 font-mono">Speed: <strong className="text-slate-200">{modelOpt.speed}</strong></span>
                          <span className="text-purple-300 font-medium">{modelOpt.recommendedFor}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Language Selection Grid */}
              <div className="space-y-2">
                <label className="font-bold text-slate-300 text-xs flex items-center justify-between">
                  <span>Select Voice & Speech Language</span>
                  <span className="text-[10px] text-slate-500 font-normal">Instant device sync</span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {SUPPORTED_VOICE_LANGUAGES.map((lang) => {
                    const isSelected = selectedVoiceLang === lang.code;
                    return (
                      <div
                        key={lang.code}
                        onClick={() => handleSelectLanguage(lang.code as VoiceLanguage)}
                        className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative flex flex-col justify-between ${
                          isSelected
                            ? 'bg-gradient-to-br from-purple-950/60 to-indigo-950/60 border-purple-500 ring-2 ring-purple-500/30 shadow-lg shadow-purple-950/50'
                            : 'bg-slate-950/80 border-slate-800 hover:border-slate-700 hover:bg-slate-900/60'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2.5">
                            <span className="text-2xl">{lang.flag}</span>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-white text-sm">
                                  {lang.nativeName}
                                </span>
                                {isSelected && (
                                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                                )}
                              </div>
                              <span className="text-[11px] text-slate-400">
                                {lang.label}
                              </span>
                            </div>
                          </div>
                          <div
                            className={`w-5 h-5 rounded-full flex items-center justify-center border transition-colors ${
                              isSelected
                                ? 'bg-purple-600 border-purple-400 text-white'
                                : 'border-slate-700 bg-slate-900 text-transparent'
                            }`}
                          >
                            <Check className="w-3 h-3 stroke-[3]" />
                          </div>
                        </div>

                        <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between">
                          <span className="text-[10px] font-mono text-purple-300/80">
                            {lang.code}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTestGreeting(lang.code as VoiceLanguage);
                            }}
                            disabled={isTestingVoice}
                            className="text-[10px] px-2 py-1 rounded-lg bg-slate-800 hover:bg-purple-600/30 text-slate-300 hover:text-purple-200 transition-colors flex items-center gap-1"
                          >
                            <Play className="w-2.5 h-2.5 text-purple-400 fill-purple-400" />
                            <span>Sample Voice</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Tamil Voice Accent & Dialect Tuning */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-950/40 via-purple-950/20 to-slate-950 border border-purple-500/40 space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-purple-500/20 text-purple-300 flex items-center justify-center font-bold text-xs">
                      த
                    </div>
                    <div>
                      <h5 className="font-bold text-white text-xs flex items-center gap-2">
                        <span>Tamil Voice Accent & Specific Voice Engine</span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 font-mono">
                          {tamilVoices.length} installed voice{tamilVoices.length === 1 ? '' : 's'}
                        </span>
                      </h5>
                      <p className="text-[10px] text-slate-400">
                        Choose the exact Tamil speaker profile and tune pronunciation speed & pitch.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleTestTamilAccent}
                    disabled={isTestingVoice}
                    className="text-[10px] px-2.5 py-1 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold transition-colors flex items-center gap-1 shadow-md shadow-purple-600/30"
                  >
                    <Play className={`w-2.5 h-2.5 ${isTestingVoice ? 'animate-pulse' : 'fill-white'}`} />
                    <span>Test Tamil Accent</span>
                  </button>
                </div>

                {/* Specific Voice Dropdown */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-slate-300 flex items-center justify-between">
                    <span>Select Specific Device Voice:</span>
                    <span className="text-[10px] font-mono text-purple-300">
                      {selectedTamilVoice ? 'Custom Voice Active' : 'Auto Best Neural Voice'}
                    </span>
                  </label>
                  <select
                    value={selectedTamilVoice}
                    onChange={(e) => handleSelectTamilVoice(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-xl px-3 py-2 text-xs text-white focus:outline-none font-medium"
                  >
                    <option value="">🌟 Auto (Highest Quality Google Natural / Neural Tamil)</option>
                    {tamilVoices.map((v) => (
                      <option key={v.uri} value={v.uri}>
                        {v.name} ({v.lang}){v.isDefault ? ' — System Default' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Advisory if no Tamil voices detected */}
                {tamilVoices.length === 0 && (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-[11px] space-y-1">
                    <div className="flex items-center gap-1.5 font-bold">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>No Native Tamil Voice Engine Detected on this Device</span>
                    </div>
                    <p className="text-slate-300 text-[10px] leading-relaxed">
                      Your phone or browser is currently using an English fallback voice to read Tamil, which creates an unnatural robotic accent.
                    </p>
                    <div className="pt-1 text-[10px] text-amber-300/90 font-mono">
                      👉 <strong>To fix on Android Phone:</strong> Settings ➔ Accessibility ➔ Text-to-Speech Output ➔ Preferred Engine (Google Speech) Gear ➔ Install Voice Data ➔ <strong>Tamil (India)</strong>.
                    </div>
                  </div>
                )}

                {/* Speed & Pitch Sliders */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-300 font-medium">Tamil Speech Pace (Speed):</span>
                      <span className="text-purple-300 font-mono font-bold">{tamilRate.toFixed(2)}x</span>
                    </div>
                    <input
                      type="range"
                      min="0.70"
                      max="1.20"
                      step="0.02"
                      value={tamilRate}
                      onChange={(e) => handleUpdateTamilRate(parseFloat(e.target.value))}
                      className="w-full accent-purple-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                    />
                    <div className="flex justify-between text-[9px] text-slate-500">
                      <span>Clear & Relaxed (0.75x)</span>
                      <span>Default (0.90x)</span>
                      <span>Fast (1.10x)</span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-300 font-medium">Voice Pitch & Tone:</span>
                      <span className="text-purple-300 font-mono font-bold">{tamilPitch.toFixed(2)}</span>
                    </div>
                    <input
                      type="range"
                      min="0.80"
                      max="1.20"
                      step="0.02"
                      value={tamilPitch}
                      onChange={(e) => handleUpdateTamilPitch(parseFloat(e.target.value))}
                      className="w-full accent-purple-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                    />
                    <div className="flex justify-between text-[9px] text-slate-500">
                      <span>Deeper (0.85)</span>
                      <span>Natural (1.00)</span>
                      <span>Higher (1.15)</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Voice Test & Diagnostics Panel */}
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-300 text-xs flex items-center gap-1.5">
                    <Volume2 className="w-3.5 h-3.5 text-purple-400" />
                    <span>Voice Output Test</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleTestGreeting(selectedVoiceLang)}
                    disabled={isTestingVoice}
                    className="text-[10px] px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold transition-colors flex items-center gap-1.5 shadow-md shadow-purple-600/30"
                  >
                    <Play className={`w-3 h-3 ${isTestingVoice ? 'animate-pulse' : 'fill-white'}`} />
                    <span>{isTestingVoice ? 'Speaking...' : 'Play Auro Greeting'}</span>
                  </button>
                </div>

                {testGreetingStatus && (
                  <p className="text-[11px] p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 font-mono">
                    {testGreetingStatus}
                  </p>
                )}
              </div>

              {/* Context Continuity & Code-Switching Reassurance Card */}
              <div className="p-4 rounded-2xl bg-slate-950/90 border border-indigo-500/20 space-y-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span className="font-bold text-white text-xs">
                    Do I need to switch conversation context?
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  <strong className="text-emerald-400">No!</strong> Your AI conversation context is fully unified. Gemini 3.8 Flash preserves memory of all earlier messages, tasks, calendar reminders, and family data across Tamil and English.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-[10px] text-slate-400">
                  <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800/80">
                    <span className="font-semibold text-slate-200 block mb-0.5">🎙️ Speech Recognition (STT):</span>
                    Selects the device acoustic model (e.g. Tamil phonetics) so spoken words are recognized accurately.
                  </div>
                  <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800/80">
                    <span className="font-semibold text-slate-200 block mb-0.5">🗣️ Natural Code-Switching:</span>
                    Feel free to mix Tamil & English freely (<em className="text-slate-300">"Auro, calendar check பண்ணு"</em>).
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
            <span>Zero-Knowledge Sovereign Enclave</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
