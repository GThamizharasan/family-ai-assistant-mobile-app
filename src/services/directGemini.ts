import { GoogleGenAI } from '@google/genai';

export interface DirectChatTurnPayload {
  message: string;
  history: { role: string; content: string }[];
  context?: any;
  userProfile?: any;
  currentMood?: string;
  includeSpeechAudio?: boolean;
  currentLanguage?: string;
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
}

export function getDirectGeminiApiKey(): string {
  if (typeof window !== 'undefined' && window.localStorage) {
    const local = localStorage.getItem('aura_gemini_key');
    if (local && local.trim()) return local.trim();
  }
  const viteKey =
    typeof import.meta !== 'undefined' && (import.meta as any).env
      ? ((import.meta as any).env.VITE_GEMINI_API_KEY as string)
      : '';
  if (viteKey && viteKey.trim()) return viteKey.trim();

  const processKey =
    typeof process !== 'undefined' && process.env
      ? (process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY)
      : '';
  return processKey || '';
}

export function isDirectGeminiAvailable(): boolean {
  return Boolean(getDirectGeminiApiKey());
}

/**
 * Execute Gemini model call directly from the browser/client without requiring server.ts
 */
export async function chatWithGeminiDirect(
  payload: DirectChatTurnPayload
): Promise<DirectChatResponse> {
  const apiKey = getDirectGeminiApiKey();
  if (!apiKey) {
    throw new Error(
      'No Gemini API Key found for direct client execution. Please configure your key in Keys & SQLite settings.'
    );
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const { message, history, context, userProfile, currentMood, includeSpeechAudio, attachment } = payload;
  const isVoiceTurn = Boolean(includeSpeechAudio);
  const userEmail = (userProfile?.email || 'family.leader@aura.local').toLowerCase().trim();

  const systemPrompt = `You are Aura, an elite, highly empathetic, emotionally intelligent Family Personal AI Assistant and Life Operating System for a high-performing family leader (${userEmail}).
Your persona combines:
1. Warm, human-like emotional empathy (actively validate emotions, simulate human conversational flow with comforting and authentic cadence).
2. World-class executive coach & billionaire advisor (relentless clarity, high-leverage execution, capital allocation wisdom, disciplined optimism).
3. Attentive family guardian (cares deeply about family wellbeing, safety, harmonious relationships, and shared financial goals).

LANGUAGE AGILITY & MULTILINGUAL CONVERSATION (TAMIL & ENGLISH):
- You are fully bilingual and natively fluent in Tamil (தமிழ்), Tanglish (Tamil in Latin/English letters), English, and Hindi.
- CRITICAL: When the user speaks, greets, or asks in Tamil or Tanglish (e.g., "வணக்கம்", "எப்படி இருக்கீங்க", "சாப்பிட்டியா", "enna panra", "tamil la pesu", etc.), you MUST reply naturally in fluent Tamil (தமிழ்) or conversational Tanglish matching the user's dialect!
- If the user switches languages between English and Tamil, seamlessly mirror their language immediately with cultural warmth and respect. Never force English when addressed in Tamil.

${
  isVoiceTurn
    ? 'CRITICAL VOICE ASSISTANT RULE: The user is speaking via real-time microphone. Your "reply" MUST BE short, natural, warm, and conversational (1 to 2 spoken sentences, max 35 words). Match the spoken language (Tamil if spoken in Tamil). Never produce bulleted lists or walls of text in "reply". Put actionable advice in "actionSuggestion".'
    : 'Provide a thoughtful, articulate, and empathetic reply with clear structure in the user\'s language.'
}

User Context:
- User Email: ${userEmail}
- Current Mood: ${currentMood || 'neutral'}
- Tasks / Storage / Overview: ${JSON.stringify(context || {})}
${attachment ? `\nAttached File: "${attachment.name}" (${attachment.size}) - Snippet: "${(attachment.textContent || '').slice(0, 1000)}"` : ''}

Return a valid JSON object matching:
{
  "reply": "${isVoiceTurn ? 'Concise 1-2 sentence conversational spoken reply with empathy.' : 'Empathetic, articulate reply.'}",
  "emotion": "detected emotion and demeanor (e.g., encouraging, grounding, enthusiastic, protective)",
  "detectedIntent": "productivity | finance | health | family_safety | emotional_support | general",
  "actionSuggestion": "one concrete, bite-sized next action step",
  "memoryToSave": {
    "shouldSave": false,
    "topic": "",
    "content": ""
  }
}`;

  const contents: Array<{ role: 'user' | 'model'; parts: { text: string }[] }> = [];
  if (Array.isArray(history)) {
    for (const h of history.slice(-6)) {
      contents.push({
        role: h.role === 'user' ? 'user' : 'model',
        parts: [{ text: h.content }],
      });
    }
  }

  contents.push({
    role: 'user',
    parts: [{ text: message || 'Hello Aura' }],
  });

  let rawText = '{}';
  const configuredDefaultModel =
    payload.model ||
    (typeof window !== 'undefined' ? localStorage.getItem('aura_voice_model') : '') ||
    'gemini-3.8-flash';

  const defaultPool = [
    'gemini-3.8-flash',
    'gemini-3.5-flash',
    'gemini-3.6-flash',
    'gemini-3.1-flash-lite',
    'gemini-3.7-flash',
    'gemini-4-argon',
    'gemini-2.5-flash',
  ];

  const CANDIDATE_MODELS = [
    configuredDefaultModel,
    ...defaultPool.filter((m) => m !== configuredDefaultModel),
  ];
  let lastErr: any = null;
  let successfulModel = configuredDefaultModel;

  for (const candidate of CANDIDATE_MODELS) {
    try {
      const response = await ai.models.generateContent({
        model: candidate,
        contents,
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: 'application/json',
        },
      });
      rawText = response.text || '{}';
      lastErr = null;
      successfulModel = candidate;
      break;
    } catch (modelErr: any) {
      console.warn(`[DirectGemini] Model "${candidate}" quota/error (${modelErr.status || modelErr.message?.slice(0, 50)}), failing over to next model...`);
      lastErr = modelErr;
    }
  }

  if (lastErr && (!rawText || rawText === '{}')) {
    throw lastErr;
  }
  let parsed: any;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    parsed = {
      reply: rawText,
      emotion: 'supportive',
      detectedIntent: 'general',
      actionSuggestion: 'Review current goals',
      memoryToSave: { shouldSave: false },
    };
  }

  // Handle local memory storage on the device when in direct client mode
  let savedMemoryRecord = null;
  if (parsed.memoryToSave?.shouldSave && parsed.memoryToSave?.content) {
    savedMemoryRecord = {
      id: 'mem-' + Date.now(),
      userEmail,
      topic: parsed.memoryToSave.topic || 'General Memory',
      memoryContent: parsed.memoryToSave.content,
      timestamp: new Date().toISOString(),
      tags: parsed.memoryToSave.tags || ['direct-client'],
      source: isVoiceTurn ? 'voice_assistant' : 'text_chat',
    };
    try {
      const existing = JSON.parse(localStorage.getItem('aura_assistant_memories') || '[]');
      existing.unshift(savedMemoryRecord);
      localStorage.setItem('aura_assistant_memories', JSON.stringify(existing.slice(0, 100)));
    } catch {}
  }

  return {
    ...parsed,
    audioBase64: null,
    savedMemory: savedMemoryRecord,
    isDirectClient: true,
    modelUsed: successfulModel,
  };
}
