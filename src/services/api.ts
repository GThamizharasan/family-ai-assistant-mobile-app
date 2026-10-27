import { Capacitor } from '@capacitor/core';
import { chatWithGeminiDirect, isDirectGeminiAvailable } from './directGemini';

export const DEFAULT_BACKEND_URL = 'https://aura-family-hub-2cgg5gpa7a-nw.a.run.app';

export function getApiBaseUrl(): string {
  // 1. Web browser: use the current web origin (e.g. http://localhost:3000) so local endpoints (/api/tts, /api/chat, /api/google/*) work directly
  if (typeof window !== 'undefined' && !Capacitor.isNativePlatform()) {
    const runtimeUrl = localStorage.getItem('aura_api_base_url');
    // If a custom URL was explicitly configured (and it's not the default remote Cloud Run fallback), honor it
    if (runtimeUrl && runtimeUrl.trim() && runtimeUrl.trim() !== DEFAULT_BACKEND_URL) {
      return runtimeUrl.trim().replace(/\/+$/, '');
    }
    // Clean up outdated default cloud run URL in localStorage on web platform
    if (runtimeUrl === DEFAULT_BACKEND_URL) {
      try { localStorage.removeItem('aura_api_base_url'); } catch {}
    }
    return window.location.origin;
  }

  // 2. Runtime configured URL in localStorage (e.g. set from Hub Keys modal on mobile)
  if (typeof window !== 'undefined') {
    const runtimeUrl = localStorage.getItem('aura_api_base_url');
    if (runtimeUrl && runtimeUrl.trim()) {
      return runtimeUrl.trim().replace(/\/+$/, '');
    }
  }

  // 3. Vite build-time environment variable
  const envUrl = (import.meta.env.VITE_API_BASE_URL as string || '').trim().replace(/\/+$/, '');
  if (envUrl) {
    return envUrl;
  }

  // 4. Native Android / iOS fallback to Google Cloud Run
  return DEFAULT_BACKEND_URL;
}

export function setApiBaseUrl(url: string) {
  if (typeof window !== 'undefined') {
    const clean = url.trim().replace(/\/+$/, '');
    if (clean) {
      localStorage.setItem('aura_api_base_url', clean);
    } else {
      localStorage.removeItem('aura_api_base_url');
    }
  }
}

export function getApiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const baseUrl = getApiBaseUrl();

  if (baseUrl) {
    return `${baseUrl}${cleanPath}`;
  }

  // When running inside Capacitor native Android/iOS without a configured backend URL,
  // return cleanPath safely rather than throwing a synchronous exception.
  // This allows the app UI to boot up cleanly so the user can configure their Cloud Run URL in Keys & SQLite.
  return cleanPath;
}

export function getWsUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const baseUrl = getApiBaseUrl();

  if (baseUrl) {
    const wsBase = baseUrl.replace(/^http:/i, 'ws:').replace(/^https:/i, 'wss:');
    return `${wsBase}${cleanPath}`;
  }

  if (typeof window !== 'undefined') {
    if (Capacitor.isNativePlatform()) {
      return '';
    }
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}${cleanPath}`;
  }

  return cleanPath;
}

export async function safeFetchJson<T = any>(path: string, options?: RequestInit): Promise<T> {
  const baseUrl = getApiBaseUrl();
  if (Capacitor.isNativePlatform() && !baseUrl) {
    throw new Error(
      'Backend Server URL is not configured. Please open Keys & SQLite in the app and set your Backend Hub URL (e.g. your Cloud Run service URL https://...run.app).'
    );
  }

  const fullUrl = getApiUrl(path);
  let res: Response;
  try {
    res = await fetch(fullUrl, options);
  } catch (netErr: any) {
    throw new Error(`Cannot connect to backend server at ${fullUrl}: ${netErr.message || 'Network unreachable'}. Verify your backend server is running.`);
  }

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const rawText = await res.text();
    if (!res.ok) {
      throw new Error(`Server returned HTTP ${res.status}: ${rawText.slice(0, 150)}`);
    }
    throw new Error(
      `Received HTML instead of JSON from ${fullUrl}. Ensure your Backend Server URL is set to your running server.ts host (e.g., http://192.168.1.X:3000).`
    );
  }

  return res.json();
}

export async function sendChatMessage(payload: {
  message: string;
  history: { role: string; content: string }[];
  context?: any;
  userProfile?: any;
  currentMood?: string;
  includeSpeechAudio?: boolean;
  currentLanguage?: string;
  googleAccessToken?: string | null;
  model?: string;
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
}) {
  const token =
    payload.googleAccessToken ||
    (typeof window !== 'undefined' ? localStorage.getItem('aura_google_access_token') : null);

  const selectedModel =
    payload.model ||
    (typeof window !== 'undefined' ? localStorage.getItem('aura_voice_model') : null) ||
    'gemini-3.8-flash';

  const completePayload = {
    ...payload,
    googleAccessToken: token,
    model: selectedModel,
  };

  try {
    const res = await safeFetchJson('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(completePayload),
    });

    if (res && !res.error) {
      return res;
    }

    if (isDirectGeminiAvailable()) {
      try {
        console.log('[Auro] Backend error. Falling back to direct client-side Gemini...');
        return await chatWithGeminiDirect(completePayload);
      } catch (directErr) {
        console.warn('[Auro] Direct Gemini fallback failed:', directErr);
        if (res && (res.reply || res.error)) {
          return res;
        }
        throw directErr;
      }
    }
    return res;
  } catch (backendErr: any) {
    // If backend server.ts is offline, automatically fall back to direct on-device Gemini
    if (isDirectGeminiAvailable()) {
      console.log('[Auro] Backend server offline. Running direct client-side Gemini...', backendErr.message);
      return await chatWithGeminiDirect(completePayload);
    }
    throw backendErr;
  }
}

export async function transcribeAudioApi(audioBase64: string, mimeType = 'audio/webm') {
  return safeFetchJson('/api/ai/transcribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ audioBase64, mimeType }),
  });
}

export async function synthesizeSpeechApi(text: string, voiceName = 'Kore') {
  return safeFetchJson('/api/ai/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voiceName }),
  });
}

export async function summarizeDocumentApi(payload: {
  fileName: string;
  fileContent: string;
  fileType: string;
}) {
  return safeFetchJson('/api/summarize-document', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function getWritingFeedbackApi(payload: {
  draftText: string;
  targetTone: string;
}) {
  return safeFetchJson('/api/writing-coach', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function getBillionaireAdvisoryApi(payload: {
  currentPhase: string;
  focusIndustry: string;
  questions: string;
}) {
  return safeFetchJson('/api/billionaire-advisory', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function getFinancialInsightsApi(payload: {
  monthlyIncome: number;
  totalExpenses: number;
  expensesByCategory: Record<string, number>;
  savingsGoal: string;
}) {
  return safeFetchJson('/api/financial-insights', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function getWellnessPlanApi(payload: {
  sleepHours: number;
  hrv: number;
  heartRate: number;
  activityLevel: string;
  energyScore: number;
}) {
  return safeFetchJson('/api/wellness-plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function searchGoogleOneApi(query: string) {
  return safeFetchJson('/api/google-search-sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
}

export async function summarizeEmailsApi(emails: any[]) {
  return safeFetchJson('/api/summarize-emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emails }),
  });
}

export async function summarizeCalendarEventsApi(events: any[]) {
  return safeFetchJson('/api/summarize-calendar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ events }),
  });
}

export async function getWhatsAppReplyApi(payload: {
  senderName: string;
  senderRelationship?: string;
  messageText: string;
  userName?: string;
  userEmail?: string;
  tone?: string;
}) {
  return safeFetchJson('/api/whatsapp-reply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function summarizeCallApi(payload: {
  contactName: string;
  contactPhone: string;
  durationSeconds: number;
  callNotes?: string;
  relationship?: string;
  userName?: string;
}) {
  return safeFetchJson('/api/summarize-call', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function getGcpBillingOptimizationApi(payload: {
  projectId: string;
  currentSpend: number;
  budgetLimit: number;
  services?: any[];
  userEmail?: string;
}) {
  return safeFetchJson('/api/gcp-billing-optimize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

// -------------------------------------------------------------
// Voice Assistant Persistent SQLite Memory Store APIs
// -------------------------------------------------------------
export interface AssistantMemoryItem {
  id: string;
  userEmail: string;
  familyId: string;
  topic: string;
  memoryContent: string;
  tags?: string[];
  source?: string;
  pinned?: boolean;
  timestamp: string;
}

export async function fetchAssistantMemoriesApi(
  userEmail: string,
  familyId?: string
): Promise<{ success: boolean; count: number; memories: AssistantMemoryItem[] }> {
  const url = `/api/assistant/memories?userEmail=${encodeURIComponent(userEmail)}${
    familyId ? `&familyId=${encodeURIComponent(familyId)}` : ''
  }`;
  return safeFetchJson(url);
}

export async function saveAssistantMemoryApi(payload: {
  userEmail: string;
  familyId?: string;
  topic?: string;
  memoryContent: string;
  tags?: string[];
  pinned?: boolean;
}): Promise<{ success: boolean; memory: AssistantMemoryItem }> {
  return safeFetchJson('/api/assistant/memories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function deleteAssistantMemoryApi(
  id: string,
  userEmail: string
): Promise<{ success: boolean }> {
  return safeFetchJson(
    `/api/assistant/memories/${encodeURIComponent(id)}?userEmail=${encodeURIComponent(userEmail)}`,
    {
      method: 'DELETE',
    }
  );
}

export async function fetchVoiceConversationsApi(
  userEmail: string,
  limit = 50
): Promise<{ success: boolean; count: number; conversations: any[] }> {
  return safeFetchJson(
    `/api/assistant/conversations?userEmail=${encodeURIComponent(userEmail)}&limit=${limit}`
  );
}

export async function clearVoiceConversationsApi(userEmail: string): Promise<{ success: boolean }> {
  return safeFetchJson(
    `/api/assistant/conversations?userEmail=${encodeURIComponent(userEmail)}`,
    {
      method: 'DELETE',
    }
  );
}

// -------------------------------------------------------------
// Family Members & 16-Digit Code API
// -------------------------------------------------------------
export async function fetchFamilyMembersApi(): Promise<any> {
  return safeFetchJson('/api/family/members');
}

export async function addFamilyMemberApi(memberData: any): Promise<any> {
  return safeFetchJson('/api/family/members', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(memberData),
  });
}

export async function updateFamilyMemberApi(id: string, memberData: any): Promise<any> {
  return safeFetchJson(`/api/family/members/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(memberData),
  });
}

export async function deleteFamilyMemberApi(id: string): Promise<any> {
  return safeFetchJson(`/api/family/members/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function redeemFamilyCodeApi(code: string, memberName: string, relationship?: string): Promise<any> {
  return safeFetchJson('/api/family/codes/redeem', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, memberName, relationship }),
  });
}
