import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  Cpu,
  Settings,
  Check,
  Zap,
  Globe,
  Key,
  Server,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Activity,
  Layers,
  Terminal,
  Database,
  Cloud,
  FolderCheck,
  CheckCircle2,
  HardDrive,
  Download,
} from 'lucide-react';
import {
  AiProvider,
  CustomAiModelConfig,
} from '../types';
import {
  SUPPORTED_AI_PROVIDERS,
  getActiveAiProvider,
  getActiveAiModel,
  getCustomAiConfig,
  saveCustomAiConfig,
  setAiProviderAndModel,
  getModelsForProvider,
  testAiModelConnection,
  AI_MODEL_CHANGED_EVENT,
} from '../services/aiConfig';
import {
  saveAiArchitectureKeysToSqliteAndDrive,
  loadAiArchitectureKeysFromSqlite,
  restoreAiArchitectureFromDrive,
  getGoogleAccessToken,
  AI_KEYS_DRIVE_ROOT_FOLDER,
  AI_KEYS_DRIVE_SUBFOLDER,
  AiArchitectureSyncResult,
} from '../services/aiKeysDriveSync';

interface AiModelConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PRESET_CUSTOM_ENDPOINTS = [
  {
    name: 'Ollama Local',
    endpointUrl: 'http://localhost:11434/v1',
    modelId: 'llama3.2',
    modelName: 'Ollama Llama 3.2',
    icon: '🦙',
    requiresKey: false,
  },
  {
    name: 'LM Studio Local',
    endpointUrl: 'http://localhost:1234/v1',
    modelId: 'local-model',
    modelName: 'LM Studio Local Model',
    icon: '💻',
    requiresKey: false,
  },
  {
    name: 'DeepSeek API',
    endpointUrl: 'https://api.deepseek.com/v1',
    modelId: 'deepseek-chat',
    modelName: 'DeepSeek V3 / R1',
    icon: '🐋',
    requiresKey: true,
  },
  {
    name: 'Groq Cloud',
    endpointUrl: 'https://api.groq.com/openai/v1',
    modelId: 'llama-3.3-70b-versatile',
    modelName: 'Groq Llama 3.3 70B',
    icon: '⚡',
    requiresKey: true,
  },
];

export const AiModelConfigModal: React.FC<AiModelConfigModalProps> = ({ isOpen, onClose }) => {
  const [selectedProvider, setSelectedProvider] = useState<AiProvider>(() => getActiveAiProvider());
  const [selectedModel, setSelectedModel] = useState<string>(() => getActiveAiModel(getActiveAiProvider()));

  // Custom AI model configuration state
  const [customConfig, setCustomConfig] = useState<CustomAiModelConfig>(() => getCustomAiConfig());

  // API Keys state
  const [geminiKey, setGeminiKey] = useState<string>(() => {
    return (typeof window !== 'undefined' ? localStorage.getItem('aura_custom_gemini_api_key') : '') || '';
  });
  const [nvidiaKey, setNvidiaKey] = useState<string>(() => {
    return (typeof window !== 'undefined' ? localStorage.getItem('aura_nvidia_api_key') : '') || '';
  });
  const [openaiKey, setOpenaiKey] = useState<string>(() => {
    return (typeof window !== 'undefined' ? localStorage.getItem('aura_openai_api_key') : '') || '';
  });
  const [anthropicKey, setAnthropicKey] = useState<string>(() => {
    return (typeof window !== 'undefined' ? localStorage.getItem('aura_anthropic_api_key') : '') || '';
  });

  // Test connection state
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string; latencyMs: number } | null>(null);

  // Persistence & Sync State
  const [isSaving, setIsSaving] = useState(false);
  const [syncStatus, setSyncStatus] = useState<AiArchitectureSyncResult | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [hasDriveToken, setHasDriveToken] = useState<boolean>(() => Boolean(getGoogleAccessToken()));

  // Sync state when modal opens
  useEffect(() => {
    if (isOpen) {
      const p = getActiveAiProvider();
      setSelectedProvider(p);
      setSelectedModel(getActiveAiModel(p));
      setCustomConfig(getCustomAiConfig());
      setTestResult(null);
      setSyncStatus(null);
      setHasDriveToken(Boolean(getGoogleAccessToken()));

      // Initialize keys from SQLite hub_api_keys if available
      loadAiArchitectureKeysFromSqlite().then((sqliteKeys) => {
        if (sqliteKeys.geminiKey) setGeminiKey(sqliteKeys.geminiKey);
        if (sqliteKeys.nvidiaKey) setNvidiaKey(sqliteKeys.nvidiaKey);
        if (sqliteKeys.openaiKey) setOpenaiKey(sqliteKeys.openaiKey);
        if (sqliteKeys.anthropicKey) setAnthropicKey(sqliteKeys.anthropicKey);
        if (sqliteKeys.customEndpoint) {
          setCustomConfig((prev) => ({
            ...prev,
            endpointUrl: sqliteKeys.customEndpoint || prev.endpointUrl,
            modelId: sqliteKeys.customModel || prev.modelId,
            apiKey: sqliteKeys.customKey || prev.apiKey,
          }));
        }
      }).catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentModels = getModelsForProvider(selectedProvider);

  const handleSelectProvider = (provider: AiProvider) => {
    setSelectedProvider(provider);
    const m = getActiveAiModel(provider);
    setSelectedModel(m);
    setTestResult(null);
  };

  const handleSelectModel = (modelId: string) => {
    setSelectedModel(modelId);
    setTestResult(null);
  };

  const handleApplyPreset = (preset: typeof PRESET_CUSTOM_ENDPOINTS[0]) => {
    const updated: CustomAiModelConfig = {
      endpointUrl: preset.endpointUrl,
      modelId: preset.modelId,
      modelName: preset.modelName,
      apiKey: customConfig.apiKey || '',
      providerType: 'openai-compatible',
    };
    setCustomConfig(updated);
    setSelectedModel(preset.modelId);
    setTestResult(null);
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const targetApiKey =
        selectedProvider === 'gemini'
          ? geminiKey
          : selectedProvider === 'nvidia'
          ? nvidiaKey
          : selectedProvider === 'openai'
          ? openaiKey
          : selectedProvider === 'anthropic'
          ? anthropicKey
          : customConfig.apiKey;

      const res = await testAiModelConnection(selectedProvider, selectedModel, {
        customConfig: selectedProvider === 'custom' ? customConfig : undefined,
        apiKey: targetApiKey,
      });
      setTestResult(res);
    } catch (err: any) {
      setTestResult({
        ok: false,
        message: err.message || 'Connection test failed',
        latencyMs: 0,
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleRestoreFromDrive = async () => {
    setIsRestoring(true);
    setSyncStatus(null);
    try {
      const restored = await restoreAiArchitectureFromDrive();
      if (restored) {
        if (restored.keys?.GEMINI_API_KEY) setGeminiKey(restored.keys.GEMINI_API_KEY);
        if (restored.keys?.NVIDIA_API_KEY) setNvidiaKey(restored.keys.NVIDIA_API_KEY);
        if (restored.keys?.OPENAI_API_KEY) setOpenaiKey(restored.keys.OPENAI_API_KEY);
        if (restored.keys?.ANTHROPIC_API_KEY) setAnthropicKey(restored.keys.ANTHROPIC_API_KEY);
        if (restored.customConfig) setCustomConfig(restored.customConfig);
        if (restored.activeProvider) setSelectedProvider(restored.activeProvider);
        if (restored.activeModel) setSelectedModel(restored.activeModel);

        setSyncStatus({
          success: true,
          sqliteSaved: true,
          sqliteCount: 5,
          driveSaved: true,
          driveFolderPath: `${AI_KEYS_DRIVE_ROOT_FOLDER} / ${AI_KEYS_DRIVE_SUBFOLDER}`,
          message: `Restored keys from Google Drive (${AI_KEYS_DRIVE_ROOT_FOLDER} / ${AI_KEYS_DRIVE_SUBFOLDER})!`,
        });
      } else {
        setSyncStatus({
          success: false,
          sqliteSaved: false,
          sqliteCount: 0,
          driveSaved: false,
          message: `No backup found in Google Drive folder "${AI_KEYS_DRIVE_ROOT_FOLDER} / ${AI_KEYS_DRIVE_SUBFOLDER}".`,
        });
      }
    } catch (err: any) {
      setSyncStatus({
        success: false,
        sqliteSaved: false,
        sqliteCount: 0,
        driveSaved: false,
        message: err.message || 'Failed to restore keys from Google Drive',
      });
    } finally {
      setIsRestoring(false);
    }
  };

  const handleSaveAndApply = async () => {
    setIsSaving(true);
    setSyncStatus(null);
    try {
      const modelToSet = selectedProvider === 'custom' ? customConfig.modelId || selectedModel : selectedModel;

      // 1. Save keys to both SQLite (hub_api_keys) and Google Drive under "Family Circle / AI Model Architecture"
      const syncRes = await saveAiArchitectureKeysToSqliteAndDrive({
        activeProvider: selectedProvider,
        activeModel: modelToSet,
        geminiKey: geminiKey.trim(),
        nvidiaKey: nvidiaKey.trim(),
        openaiKey: openaiKey.trim(),
        anthropicKey: anthropicKey.trim(),
        customConfig: selectedProvider === 'custom' ? customConfig : undefined,
      });

      // 2. Set active provider & model and dispatch application event
      setAiProviderAndModel(selectedProvider, modelToSet);
      if (selectedProvider === 'custom') {
        saveCustomAiConfig(customConfig);
      }

      setSyncStatus(syncRes);

      // Brief delay so user sees the confirmation checkmarks
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setSyncStatus({
        success: false,
        sqliteSaved: false,
        sqliteCount: 0,
        driveSaved: false,
        message: err.message || 'Save error occurred',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-3 sm:p-5 animate-in fade-in duration-200">
      <div className="w-full max-w-xl max-h-[90vh] rounded-3xl border border-slate-800 bg-slate-900/95 flex flex-col shadow-2xl relative overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:px-6 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center shadow-inner">
              <Zap className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-white">AI Engine & Model Architecture</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-mono">
                  EXTENSIBLE
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Switch or configure AI models across the entire app (Voice Assistant, AI Studio, STT, Translators).
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {/* 1. Provider Switcher Tabs */}
          <div>
            <label className="text-xs font-semibold text-slate-300 mb-2 block flex items-center justify-between">
              <span>Select AI Provider / Engine</span>
              <span className="text-[10px] text-indigo-400 font-mono font-normal">Active across all tabs</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 p-1 rounded-2xl bg-slate-950/80 border border-slate-800">
              {SUPPORTED_AI_PROVIDERS.map((prov) => {
                const isActive = selectedProvider === prov.id;
                return (
                  <button
                    key={prov.id}
                    type="button"
                    onClick={() => handleSelectProvider(prov.id)}
                    className={`py-2 px-2 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                      isActive
                        ? 'bg-gradient-to-b from-indigo-600 to-indigo-700 text-white shadow-md shadow-indigo-900/40 border border-indigo-400/40'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
                    }`}
                  >
                    <span className="text-sm">{prov.icon}</span>
                    <span className="text-[11px] truncate w-full text-center">{prov.shortLabel}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Provider Details & Models */}
          {selectedProvider !== 'custom' ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300">
                  {SUPPORTED_AI_PROVIDERS.find((p) => p.id === selectedProvider)?.name} Models
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {currentModels.length} models available
                </span>
              </div>

              {/* Models List */}
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {currentModels.map((m) => {
                  const isChosen = selectedModel === m.id;
                  return (
                    <div
                      key={m.id}
                      onClick={() => handleSelectModel(m.id)}
                      className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-start justify-between gap-3 ${
                        isChosen
                          ? 'bg-indigo-950/40 border-indigo-500/50 shadow-md shadow-indigo-950/30'
                          : 'bg-slate-950/40 border-slate-800/80 hover:bg-slate-950/80 hover:border-slate-700'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs font-bold ${isChosen ? 'text-white' : 'text-slate-200'}`}>
                            {m.name}
                          </span>
                          <span className="text-[9px] px-1.5 py-0.2 rounded font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700">
                            {m.badge}
                          </span>
                          <span className="text-[9px] text-emerald-400 font-mono">
                            ⚡ {m.speed}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                          {m.tagline}
                        </p>
                        {m.recommendedFor && (
                          <span className="inline-block mt-1 text-[9px] text-indigo-300/80 font-mono">
                            Best for: {m.recommendedFor}
                          </span>
                        )}
                      </div>
                      <div
                        className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 border ${
                          isChosen
                            ? 'bg-indigo-600 border-indigo-400 text-white'
                            : 'border-slate-700 text-transparent'
                        }`}
                      >
                        <Check className="w-3 h-3" />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* API Key Override for this provider */}
              <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-300 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Key className="w-3 h-3 text-amber-400" />
                    {SUPPORTED_AI_PROVIDERS.find((p) => p.id === selectedProvider)?.name} API Key (Optional)
                  </span>
                  <span className="text-[9px] text-emerald-400 font-medium">Saves to SQLite & Google Drive (Family Circle)</span>
                </label>
                <input
                  type="password"
                  placeholder={`Leave blank to use server environment default key...`}
                  value={
                    selectedProvider === 'gemini'
                      ? geminiKey
                      : selectedProvider === 'nvidia'
                      ? nvidiaKey
                      : selectedProvider === 'openai'
                      ? openaiKey
                      : anthropicKey
                  }
                  onChange={(e) => {
                    const val = e.target.value;
                    if (selectedProvider === 'gemini') setGeminiKey(val);
                    else if (selectedProvider === 'nvidia') setNvidiaKey(val);
                    else if (selectedProvider === 'openai') setOpenaiKey(val);
                    else setAnthropicKey(val);
                  }}
                  className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>
            </div>
          ) : (
            /* 3. Custom / Local / OpenAI-Compatible Endpoint Configuration */
            <div className="space-y-4">
              <div>
                <span className="text-xs font-semibold text-slate-300 mb-2 block">
                  Quick Connect Local / Third-Party Presets
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {PRESET_CUSTOM_ENDPOINTS.map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => handleApplyPreset(preset)}
                      className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer ${
                        customConfig.endpointUrl === preset.endpointUrl
                          ? 'bg-sky-950/40 border-sky-500/50 shadow-sm'
                          : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="text-base mb-1">{preset.icon}</div>
                      <div className="text-xs font-bold text-white truncate">{preset.name}</div>
                      <div className="text-[9px] text-slate-400 truncate mt-0.5">{preset.modelId}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-sky-400">
                  <Server className="w-3.5 h-3.5" />
                  <span>Custom Endpoint Parameters</span>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300">
                    Base API Endpoint URL (OpenAI-Compatible)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. http://localhost:11434/v1 or https://api.deepseek.com/v1"
                    value={customConfig.endpointUrl}
                    onChange={(e) => setCustomConfig({ ...customConfig, endpointUrl: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 font-mono"
                  />
                  <p className="text-[10px] text-slate-500">
                    Ollama default is <code className="text-slate-400">http://localhost:11434/v1</code>
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-300">Target Model ID</label>
                    <input
                      type="text"
                      placeholder="e.g. llama3.2, deepseek-chat, qwen2.5"
                      value={customConfig.modelId}
                      onChange={(e) => {
                        setCustomConfig({ ...customConfig, modelId: e.target.value });
                        setSelectedModel(e.target.value);
                      }}
                      className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-300">Display Label</label>
                    <input
                      type="text"
                      placeholder="e.g. Local Llama 3.2 8B"
                      value={customConfig.modelName}
                      onChange={(e) => setCustomConfig({ ...customConfig, modelName: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300 flex items-center justify-between">
                    <span>API Key / Bearer Token (Optional for Ollama)</span>
                    <span className="text-[9px] text-slate-500">Only needed for gated or cloud APIs</span>
                  </label>
                  <input
                    type="password"
                    placeholder="Enter custom API key if required..."
                    value={customConfig.apiKey || ''}
                    onChange={(e) => setCustomConfig({ ...customConfig, apiKey: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Dual Persistence Card: SQLite + Google Drive Family Circle */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950/40 border border-slate-800 space-y-2.5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-200 flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-indigo-400" />
                Storage & Synchronization Architecture
              </span>
              <span className="text-[9px] px-2 py-0.5 rounded-full font-bold bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 font-mono">
                DUAL SYNC
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
              {/* SQLite Store */}
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                <Database className="w-4 h-4 text-purple-400 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-white font-semibold flex items-center gap-1">
                    SQLite Hub Keys
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono truncate">table: hub_api_keys</div>
                </div>
              </div>

              {/* Google Drive Family Circle */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                <div className="flex items-center gap-2 min-w-0">
                  <Cloud className={`w-4 h-4 shrink-0 ${hasDriveToken ? 'text-sky-400' : 'text-slate-500'}`} />
                  <div className="min-w-0">
                    <div className="text-white font-semibold flex items-center gap-1">
                      Google Drive
                      {hasDriveToken && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">
                      Family Circle / {AI_KEYS_DRIVE_SUBFOLDER}
                    </div>
                  </div>
                </div>

                {hasDriveToken && (
                  <button
                    type="button"
                    onClick={handleRestoreFromDrive}
                    disabled={isRestoring}
                    title="Pull & restore keys from Google Drive"
                    className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[10px] font-semibold text-slate-300 border border-slate-700 flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
                  >
                    <Download className={`w-3 h-3 ${isRestoring ? 'animate-bounce text-sky-400' : ''}`} />
                    <span>{isRestoring ? 'Pulling...' : 'Restore'}</span>
                  </button>
                )}
              </div>
            </div>

            {syncStatus && (
              <div
                className={`p-2.5 rounded-xl border text-xs flex items-center gap-2 animate-in fade-in duration-200 ${
                  syncStatus.success
                    ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                    : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                }`}
              >
                {syncStatus.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <Activity className="w-4 h-4 text-rose-400 shrink-0" />
                )}
                <span className="truncate">{syncStatus.message}</span>
              </div>
            )}
          </div>

          {/* Test Connection Banner */}
          {testResult && (
            <div
              className={`p-3 rounded-2xl border text-xs flex items-center justify-between gap-2 animate-in fade-in duration-200 ${
                testResult.ok
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                  : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <Activity className="w-4 h-4 shrink-0" />
                <span className="truncate">{testResult.message}</span>
              </div>
              {testResult.ok && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-200 border border-emerald-500/30 shrink-0 font-bold">
                  {testResult.latencyMs}ms
                </span>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:px-6 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={isTesting}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-850 hover:bg-slate-800 text-slate-300 border border-slate-700 hover:border-slate-600 transition-all disabled:opacity-50 cursor-pointer shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin text-indigo-400' : ''}`} />
            <span>{isTesting ? 'Testing Model...' : 'Test Connection'}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveAndApply}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving to SQLite & Drive...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Save to SQLite & Drive</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

