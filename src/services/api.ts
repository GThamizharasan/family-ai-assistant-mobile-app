export async function sendChatMessage(payload: {
  message: string;
  history: { role: string; content: string }[];
  context?: any;
  userProfile?: any;
  currentMood?: string;
}) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Chat service error');
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
