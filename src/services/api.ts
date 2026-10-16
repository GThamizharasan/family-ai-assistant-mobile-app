import { Capacitor } from '@capacitor/core';

const nativeApiBaseUrl = (
  import.meta.env.VITE_API_BASE_URL ||
  'https://ais-dev-v7juadaauum45rl6hebiav-946248252259.europe-west2.run.app'
).replace(/\/+$/, '');

export function getApiUrl(path: string): string {
  return Capacitor.isNativePlatform() ? `${nativeApiBaseUrl}${path}` : path;
}

export async function sendChatMessage(payload: {
  message: string;
  history: { role: string; content: string }[];
  context?: any;
  userProfile?: any;
  currentMood?: string;
  includeSpeechAudio?: boolean;
}) {
  const res = await fetch(getApiUrl('/api/chat'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Chat service error');
  return res.json();
}

export async function transcribeAudioApi(audioBase64: string, mimeType = 'audio/webm') {
  const res = await fetch(getApiUrl('/api/ai/transcribe'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ audioBase64, mimeType }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}: Failed to transcribe audio`);
  }
  return res.json();
}

export async function synthesizeSpeechApi(text: string, voiceName = 'Kore') {
  const res = await fetch('/api/ai/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voiceName }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Speech synthesis failed');
  }
  return res.json();
}

export async function summarizeDocumentApi(payload: {
  fileName: string;
  fileContent: string;
  fileType: string;
}) {
  const res = await fetch('/api/summarize-document', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Summarization error');
  return res.json();
}

export async function getWritingFeedbackApi(payload: {
  draftText: string;
  targetTone: string;
}) {
  const res = await fetch('/api/writing-coach', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Writing coach error');
  return res.json();
}

export async function getBillionaireAdvisoryApi(payload: {
  currentPhase: string;
  focusIndustry: string;
  questions: string;
}) {
  const res = await fetch('/api/billionaire-advisory', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Billionaire advisory error');
  return res.json();
}

export async function getFinancialInsightsApi(payload: {
  monthlyIncome: number;
  totalExpenses: number;
  expensesByCategory: Record<string, number>;
  savingsGoal: string;
}) {
  const res = await fetch('/api/financial-insights', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Financial insights error');
  return res.json();
}

export async function getWellnessPlanApi(payload: {
  sleepHours: number;
  hrv: number;
  heartRate: number;
  activityLevel: string;
  energyScore: number;
}) {
  const res = await fetch('/api/wellness-plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Wellness plan error');
  return res.json();
}

export async function searchGoogleOneApi(query: string) {
  const res = await fetch('/api/google-search-sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error('Google One search error');
  return res.json();
}

export async function summarizeEmailsApi(emails: any[]) {
  const res = await fetch('/api/summarize-emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emails }),
  });
  if (!res.ok) throw new Error('Email summarization error');
  return res.json();
}

export async function summarizeCalendarEventsApi(events: any[]) {
  const res = await fetch('/api/summarize-calendar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ events }),
  });
  if (!res.ok) throw new Error('Calendar briefing error');
  return res.json();
}

export async function getWhatsAppReplyApi(payload: {
  senderName: string;
  senderRelationship?: string;
  messageText: string;
  userName?: string;
  userEmail?: string;
  tone?: string;
}) {
  const res = await fetch('/api/whatsapp-reply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('WhatsApp AI reply error');
  return res.json();
}

export async function summarizeCallApi(payload: {
  contactName: string;
  contactPhone: string;
  durationSeconds: number;
  callNotes?: string;
  relationship?: string;
  userName?: string;
}) {
  const res = await fetch('/api/summarize-call', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Call summarization error');
  return res.json();
}

export async function getGcpBillingOptimizationApi(payload: {
  projectId: string;
  currentSpend: number;
  budgetLimit: number;
  services?: any[];
  userEmail?: string;
}) {
  const res = await fetch('/api/gcp-billing-optimize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('GCP billing optimization error');
  return res.json();
}
