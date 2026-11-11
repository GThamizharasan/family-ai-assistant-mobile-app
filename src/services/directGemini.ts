import { getApiUrl } from './api';

export interface DirectChatTurnPayload {
  message: string;
  history: { role: string; content: string }[];
  context?: any;
  userProfile?: any;
  currentMood?: string;
  includeSpeechAudio?: boolean;
  currentLanguage?: string;
  model?: string;
  provider?: 'gemini' | 'nvidia' | string;
  attachment?: {
    name: string;
    mimeType: string;
    size: string;
    sizeBytes?: number;
    contentBase64?: string;
    textContent?: string;
    uploadedToGoogleDrive?: boolean;
    googleDriveFileId?: string;
    webViewLink?: string;
    uploadError?: string;
  } | null;
}

export interface DirectChatResponse {
  reply: string;
  emotion?: string;
  detectedIntent?: string;
  actionSuggestion?: string;
  audioBase64?: string | null;
  savedMemory?: any;
  savedKeepNote?: any;
  savedDriveFile?: any;
  isDirectClient?: boolean;
  modelUsed?: string;
  providerUsed?: string;
  navigateToTab?: string;
}

export function getDirectGeminiApiKey(): string {
  if (typeof window !== 'undefined' && window.localStorage) {
    const local = localStorage.getItem('aura_gemini_key');
    if (local && local.trim()) return local.trim();
  }
  return '';
}

export function isDirectGeminiAvailable(): boolean {
  // Always true because server manages sovereign API keys & multi-model failover
  return true;
}

/**
 * Execute chat turn securely via server-side Gemini/NVIDIA engine
 * No API keys or @google/genai SDK are exposed in browser bundles
 */
export async function chatWithGeminiDirect(
  payload: DirectChatTurnPayload
): Promise<DirectChatResponse> {
  const url = getApiUrl('/api/chat');

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}: Failed to process chat response`);
  }

  const data = await res.json();
  return {
    ...data,
    isDirectClient: false,
  };
}
