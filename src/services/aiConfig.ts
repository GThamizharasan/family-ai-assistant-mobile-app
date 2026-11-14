// Universal AI Model & Provider Configuration Service
// Extensible architecture supporting:
// 1. Google Gemini (Flash, Pro, Lite, Argon)
// 2. NVIDIA NIM (Nemotron, Llama, Riva, DeepSeek)
// 3. OpenAI (GPT-4o, GPT-4o-mini, o3-mini)
// 4. Anthropic Claude (Claude 3.7 Sonnet, Claude 3.5 Haiku)
// 5. Custom / Local / OpenAI-Compatible (Ollama, LM Studio, Groq, DeepSeek, vLLM)

import {
  AiProvider,
  AiModelOption,
  DynamicAiModel,
  CustomAiModelConfig,
  AVAILABLE_GEMINI_MODELS,
  AVAILABLE_NVIDIA_MODELS,
  AVAILABLE_OPENAI_MODELS,
  AVAILABLE_ANTHROPIC_MODELS,
  DEFAULT_CUSTOM_MODELS,
} from '../types';
import { getApiUrl } from './api';

export const AI_MODEL_CHANGED_EVENT = 'aura_ai_model_changed';

export const SUPPORTED_AI_PROVIDERS: Array<{
  id: AiProvider;
  name: string;
  shortLabel: string;
  badge: string;
  color: string;
  icon: string;
  description: string;
}> = [
  {
    id: 'gemini',
    name: 'Google Gemini',
    shortLabel: 'Gemini',
    badge: 'MULTIMODAL',
    color: '#818cf8',
    icon: '✦',
    description: 'Multimodal intelligence by Google DeepMind with massive context & fast turns',
  },
  {
    id: 'nvidia',
    name: 'NVIDIA NIM',
    shortLabel: 'NVIDIA',
    badge: 'GPU ACCELERATED',
    color: '#76b900',
    icon: '⚡',
    description: 'Hardware-accelerated AI inference on Hopper/Blackwell GPUs via NVIDIA NIM microservices',
  },
  {
    id: 'openai',
    name: 'OpenAI GPT',
    shortLabel: 'OpenAI',
    badge: 'FRONTIER',
    color: '#10a37f',
    icon: '🟢',
    description: 'Industry-standard OpenAI GPT-4o and o3-mini reasoning models',
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    shortLabel: 'Claude',
    badge: 'HYBRID REASONING',
    color: '#d97706',
    icon: '🟣',
    description: 'Deep thoughtful analysis and empathetic conversational intelligence by Anthropic',
  },
  {
    id: 'custom',
    name: 'Custom / Local / Ollama',
    shortLabel: 'Custom',
    badge: 'EXTENSIBLE',
    color: '#38bdf8',
    icon: '⚙',
    description: 'Self-hosted Ollama, LM Studio, DeepSeek, Groq, or any OpenAI-compatible API endpoint',
  },
];

const DEFAULT_CUSTOM_CONFIG: CustomAiModelConfig = {
  endpointUrl: 'http://localhost:11434/v1',
  modelId: 'llama3.2',
  modelName: 'Ollama Llama 3.2',
  apiKey: '',
  providerType: 'ollama',
};

// ----------------------------------------------------
// Getters and Setters
// ----------------------------------------------------

export function getActiveAiProvider(): AiProvider {
  if (typeof window === 'undefined') return 'gemini';
  const saved = localStorage.getItem('aura_ai_provider') as AiProvider;
  if (saved && ['gemini', 'nvidia', 'openai', 'anthropic', 'custom'].includes(saved)) {
    return saved;
  }
  return 'gemini';
}

export function getActiveAiModel(provider?: AiProvider): string {
  const currentProvider = provider || getActiveAiProvider();
  if (typeof window === 'undefined') {
    return currentProvider === 'nvidia'
      ? 'nvidia/nemotron-3.5-lightning-30b-a3b'
      : currentProvider === 'openai'
      ? 'gpt-4o-mini'
      : currentProvider === 'anthropic'
      ? 'claude-3-5-haiku-20241022'
      : currentProvider === 'custom'
      ? 'llama3.2'
      : 'gemini-3.8-flash';
  }

  const modelKey = `aura_${currentProvider}_model`;
  const saved = localStorage.getItem(modelKey);
  if (saved) return saved;

  // Fallbacks by provider
  switch (currentProvider) {
    case 'nvidia':
      return 'nvidia/nemotron-3.5-lightning-30b-a3b';
    case 'openai':
      return 'gpt-4o-mini';
    case 'anthropic':
      return 'claude-3-5-haiku-20241022';
    case 'custom': {
      const custom = getCustomAiConfig();
      return custom.modelId || 'llama3.2';
    }
    case 'gemini':
    default:
      return localStorage.getItem('aura_voice_model') || 'gemini-3.8-flash';
  }
}

export function getCustomAiConfig(): CustomAiModelConfig {
  if (typeof window === 'undefined') return DEFAULT_CUSTOM_CONFIG;
  try {
    const raw = localStorage.getItem('aura_custom_ai_config');
    if (raw) {
      return { ...DEFAULT_CUSTOM_CONFIG, ...JSON.parse(raw) };
    }
  } catch (err) {
    console.warn('Failed to parse aura_custom_ai_config:', err);
  }
  return DEFAULT_CUSTOM_CONFIG;
}

export function saveCustomAiConfig(config: Partial<CustomAiModelConfig>): void {
  if (typeof window === 'undefined') return;
  const current = getCustomAiConfig();
  const updated = { ...current, ...config };
  localStorage.setItem('aura_custom_ai_config', JSON.stringify(updated));
  if (updated.modelId) {
    localStorage.setItem('aura_custom_model', updated.modelId);
  }
  dispatchModelChange();
}

export function setActiveAiProvider(provider: AiProvider): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('aura_ai_provider', provider);
  dispatchModelChange();
}

export function setActiveAiModel(modelId: string, provider?: AiProvider): void {
  if (typeof window === 'undefined') return;
  const p = provider || getActiveAiProvider();
  localStorage.setItem(`aura_${p}_model`, modelId);
  if (p === 'gemini') {
    localStorage.setItem('aura_voice_model', modelId);
  } else if (p === 'nvidia') {
    localStorage.setItem('aura_nvidia_model', modelId);
  }
  dispatchModelChange();
}

export function setAiProviderAndModel(provider: AiProvider, modelId: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('aura_ai_provider', provider);
  localStorage.setItem(`aura_${provider}_model`, modelId);
  if (provider === 'gemini') {
    localStorage.setItem('aura_voice_model', modelId);
  } else if (provider === 'nvidia') {
    localStorage.setItem('aura_nvidia_model', modelId);
  }
  dispatchModelChange();
}

function dispatchModelChange(): void {
  if (typeof window === 'undefined') return;
  const provider = getActiveAiProvider();
  const model = getActiveAiModel(provider);
  const customConfig = provider === 'custom' ? getCustomAiConfig() : null;

  window.dispatchEvent(
    new CustomEvent(AI_MODEL_CHANGED_EVENT, {
      detail: {
        provider,
        model,
        customConfig,
        timestamp: Date.now(),
      },
    })
  );
}

// ----------------------------------------------------
// Dynamic AI Models (Future & On-Demand Engine Registry)
// ----------------------------------------------------

export const DYNAMIC_AI_MODELS_STORAGE_KEY = 'aura_dynamic_ai_models';

export function getDynamicAiModels(): DynamicAiModel[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(DYNAMIC_AI_MODELS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn('[AI Config] Failed to parse dynamic models from localStorage:', err);
  }
  return [];
}

export async function saveDynamicAiModel(
  modelInput: Partial<DynamicAiModel> & { name: string; modelId: string; provider?: AiProvider }
): Promise<DynamicAiModel> {
  const now = new Date().toISOString();
  const id = modelInput.id || modelInput.modelId.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  const provider = modelInput.provider || (
    id.startsWith('gemini') ? 'gemini' :
    id.startsWith('nvidia') ? 'nvidia' :
    id.startsWith('claude') ? 'anthropic' :
    id.startsWith('gpt') ? 'openai' :
    'gemini'
  );

  const newModel: DynamicAiModel = {
    id,
    name: modelInput.name,
    provider,
    modelId: modelInput.modelId,
    badge: modelInput.badge || 'ON-DEMAND',
    tagline: modelInput.tagline || `${modelInput.name} (${provider.toUpperCase()}) - Sovereign Dynamic AI Model`,
    description: modelInput.description || `Registered dynamically via Voice Assistant for on-demand inference`,
    speed: modelInput.speed || 'Adaptive Live Inference',
    color: modelInput.color || (provider === 'nvidia' ? 'emerald' : provider === 'anthropic' ? 'amber' : provider === 'openai' ? 'teal' : 'purple'),
    endpointUrl: modelInput.endpointUrl,
    apiKey: modelInput.apiKey,
    isActive: modelInput.isActive ?? true,
    isDynamic: true,
    addedBy: modelInput.addedBy || 'voice_assistant',
    createdAt: modelInput.createdAt || now,
    updatedAt: now,
  };

  // 1. Save to LocalStorage cache
  if (typeof window !== 'undefined') {
    const current = getDynamicAiModels();
    const updated = [newModel, ...current.filter((m) => m.id !== id && m.modelId !== modelInput.modelId)];
    localStorage.setItem(DYNAMIC_AI_MODELS_STORAGE_KEY, JSON.stringify(updated));
  }

  // 2. Persist to SQLite Backend
  try {
    await fetch(getApiUrl('/api/ai/dynamic-models'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newModel),
    });
  } catch (sqlErr) {
    console.warn('[AI Config] SQLite dynamic model save notice:', sqlErr);
  }

  // 3. Dispatch change event across UI
  dispatchModelChange();

  return newModel;
}

export async function deleteDynamicAiModel(id: string): Promise<boolean> {
  if (typeof window !== 'undefined') {
    const current = getDynamicAiModels();
    const updated = current.filter((m) => m.id !== id && m.modelId !== id);
    localStorage.setItem(DYNAMIC_AI_MODELS_STORAGE_KEY, JSON.stringify(updated));
  }

  try {
    await fetch(getApiUrl(`/api/ai/dynamic-models/${id}`), {
      method: 'DELETE',
    });
  } catch (err) {
    console.warn('[AI Config] SQLite dynamic model delete notice:', err);
  }

  dispatchModelChange();
  return true;
}

export async function syncDynamicAiModelsFromSqlite(): Promise<DynamicAiModel[]> {
  try {
    const res = await fetch(getApiUrl('/api/ai/dynamic-models'));
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.models)) {
        const sqliteModels: DynamicAiModel[] = data.models.map((m: any) => ({
          ...m,
          isDynamic: true,
        }));
        if (typeof window !== 'undefined') {
          const local = getDynamicAiModels();
          const mergedMap = new Map<string, DynamicAiModel>();
          sqliteModels.forEach((m) => mergedMap.set(m.id, m));
          local.forEach((m) => {
            if (!mergedMap.has(m.id)) mergedMap.set(m.id, m);
          });
          const merged = Array.from(mergedMap.values());
          localStorage.setItem(DYNAMIC_AI_MODELS_STORAGE_KEY, JSON.stringify(merged));
        }
        return sqliteModels;
      }
    }
  } catch (err) {
    console.warn('[AI Config] syncDynamicAiModelsFromSqlite notice:', err);
  }
  return getDynamicAiModels();
}

// ----------------------------------------------------
// Model Catalog Queries
// ----------------------------------------------------

export function getModelsForProvider(provider: AiProvider): AiModelOption[] {
  const dynamicModels = getDynamicAiModels()
    .filter((dm) => dm.provider === provider)
    .map((dm) => ({
      id: dm.modelId,
      name: dm.name,
      provider: dm.provider,
      badge: dm.badge || 'ON-DEMAND',
      tagline: dm.tagline || `${dm.name} - Sovereign Dynamic Model`,
      speed: dm.speed || 'Adaptive',
      color: dm.color || 'purple',
      recommendedFor: 'Voice & Sovereign Tasks',
      isDynamic: true,
      endpointUrl: dm.endpointUrl,
      apiKey: dm.apiKey,
    }));

  let baseList: AiModelOption[] = [];
  switch (provider) {
    case 'gemini':
      baseList = AVAILABLE_GEMINI_MODELS.map((m) => ({
        id: m.id,
        name: m.name,
        provider: 'gemini' as AiProvider,
        badge: m.badge,
        tagline: m.tagline,
        speed: m.speed,
        color: m.color,
        recommendedFor: m.recommendedFor,
      }));
      break;
    case 'nvidia':
      baseList = AVAILABLE_NVIDIA_MODELS;
      break;
    case 'openai':
      baseList = AVAILABLE_OPENAI_MODELS;
      break;
    case 'anthropic':
      baseList = AVAILABLE_ANTHROPIC_MODELS;
      break;
    case 'custom': {
      const custom = getCustomAiConfig();
      baseList = [
        {
          id: custom.modelId || 'llama3.2',
          name: custom.modelName || 'Custom Model',
          provider: 'custom',
          badge: 'ACTIVE CUSTOM',
          tagline: `Endpoint: ${custom.endpointUrl || 'http://localhost:11434/v1'}`,
          speed: 'Configured Endpoint',
          color: 'sky',
          recommendedFor: 'Custom Inference',
        },
        ...DEFAULT_CUSTOM_MODELS,
      ];
      break;
    }
    default:
      baseList = [];
  }

  // Prepend dynamic models so any newly added models are immediately accessible at the top
  return [...dynamicModels, ...baseList];
}

export function getModelDisplayName(provider: AiProvider, modelId: string): string {
  // Check dynamic models first
  const dynamic = getDynamicAiModels().find((m) => m.modelId === modelId || m.id === modelId);
  if (dynamic) return dynamic.name;

  const models = getModelsForProvider(provider);
  const found = models.find((m) => m.id === modelId);
  if (found) return found.name;

  // Clean raw id
  if (modelId.startsWith('nvidia/')) return modelId.replace('nvidia/', '');
  if (modelId.startsWith('meta/')) return modelId.replace('meta/', '');
  if (modelId.startsWith('deepseek-ai/')) return modelId.replace('deepseek-ai/', '');
  return modelId;
}

// ----------------------------------------------------
// AI Request Payload Helper for all API calls
// ----------------------------------------------------

export function getUniversalAiPayloadParams(): {
  provider: AiProvider;
  model: string;
  customConfig?: CustomAiModelConfig;
  geminiApiKey?: string | null;
  nvidiaApiKey?: string | null;
  openaiApiKey?: string | null;
  anthropicApiKey?: string | null;
} {
  const provider = getActiveAiProvider();
  const model = getActiveAiModel(provider);

  const geminiApiKey = typeof window !== 'undefined' ? localStorage.getItem('aura_custom_gemini_api_key') : null;
  const nvidiaApiKey = typeof window !== 'undefined' ? localStorage.getItem('aura_nvidia_api_key') : null;
  const openaiApiKey = typeof window !== 'undefined' ? localStorage.getItem('aura_openai_api_key') : null;
  const anthropicApiKey = typeof window !== 'undefined' ? localStorage.getItem('aura_anthropic_api_key') : null;

  return {
    provider,
    model,
    customConfig: provider === 'custom' ? getCustomAiConfig() : undefined,
    geminiApiKey,
    nvidiaApiKey,
    openaiApiKey,
    anthropicApiKey,
  };
}

// ----------------------------------------------------
// Realtime Connection Tester
// ----------------------------------------------------

export async function testAiModelConnection(
  provider: AiProvider,
  modelId: string,
  options?: { customConfig?: CustomAiModelConfig; apiKey?: string }
): Promise<{ ok: boolean; message: string; latencyMs: number; modelUsed?: string }> {
  const start = performance.now();
  try {
    const res = await fetch(getApiUrl('/api/ai/test-connection'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider,
        model: modelId,
        customConfig: options?.customConfig || (provider === 'custom' ? getCustomAiConfig() : undefined),
        apiKey: options?.apiKey,
      }),
    });

    const latencyMs = Math.round(performance.now() - start);
    const data = await res.json().catch(() => ({}));

    if (res.ok && data.success) {
      return {
        ok: true,
        message: data.message || `Connected successfully! (${latencyMs}ms)`,
        latencyMs,
        modelUsed: data.modelUsed || modelId,
      };
    } else {
      return {
        ok: false,
        message: data.error || `HTTP ${res.status}: Connection test failed`,
        latencyMs,
      };
    }
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - start);
    return {
      ok: false,
      message: err.message || 'Network error reaching backend AI test endpoint',
      latencyMs,
    };
  }
}

