/**
 * Advanced Gemini AI Suite Client Service
 * Covers:
 * 1. Audio Transcription (gemini-3.5-transcribe)
 * 2. Veo 3 Video from Text (veo-3.1-fast-generate-preview)
 * 3. Gemini Multi-Turn Chatbot with Dynamic Model Routing (gemini-4-argon, gemini-3.8-flash, gemini-3.1-flash-lite)
 * 4. Animate Images into Video with Veo (veo-3.1-fast-generate-preview)
 * 5. Voice Conversations (gemini-3.8-live)
 * 6. Music Generation with Lyria (lyria-3-clip-preview & lyria-3-pro-preview)
 * 7. Create & Edit Images (gemini-nano-banana-2.1)
 */

import { getApiUrl } from './api';
import { GoogleGenAI } from '@google/genai';
import { getDirectGeminiApiKey, isDirectGeminiAvailable } from './directGemini';

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  modelUsed?: string;
  timestamp: string;
}

export interface ChatRoleConfig {
  id: string;
  label: string;
  description: string;
  badge: string;
  defaultComplexity: 'complex' | 'general' | 'fast';
  icon: string;
}

export const CHAT_ROLES: ChatRoleConfig[] = [
  {
    id: 'executive',
    label: 'Executive Life OS & Sovereign Strategist',
    description: 'Governance, strategic clarity, high-level planning & sovereign asset management.',
    badge: 'Argon Recommended',
    defaultComplexity: 'complex',
    icon: 'Crown',
  },
  {
    id: 'family_counselor',
    label: 'Empathetic Family Counselor',
    description: 'Active listening, emotional intelligence, parenting & harmony guidance.',
    badge: 'Flash 3.8',
    defaultComplexity: 'general',
    icon: 'Heart',
  },
  {
    id: 'venture_strategist',
    label: 'Venture & Market Architect',
    description: 'Financial analysis, term sheets, technology moats & venture capital scaling.',
    badge: 'Complex Reasoning',
    defaultComplexity: 'complex',
    icon: 'Briefcase',
  },
  {
    id: 'stem_tutor',
    label: 'STEM & Robotics Lab Mentor',
    description: 'AI pathfinding algorithms, physics, robotics engineering & code assistance for Maaran.',
    badge: 'STEM Specialized',
    defaultComplexity: 'complex',
    icon: 'Bot',
  },
  {
    id: 'creative_writer',
    label: 'Storytelling & Screenplay Consultant',
    description: 'Vivid prose, public speaking remarks, keynote scripts & creative screenplays.',
    badge: 'Creative Prose',
    defaultComplexity: 'general',
    icon: 'Sparkles',
  },
];

// Helper: Blob to Base64 (robust against null, undefined, 0-byte blobs, and FileReader errors)
export async function blobToBase64(blob: Blob | null | undefined): Promise<string> {
  if (!blob || !(blob instanceof Blob) || blob.size === 0) {
    return '';
  }

  return new Promise((resolve) => {
    try {
      const reader = new FileReader();

      reader.onloadend = () => {
        try {
          const result = reader.result;
          if (typeof result === 'string') {
            const commaIndex = result.indexOf(',');
            const base64 = commaIndex !== -1 ? result.slice(commaIndex + 1) : result;
            resolve(base64.trim());
          } else {
            resolve('');
          }
        } catch {
          resolve('');
        }
      };

      reader.onerror = () => {
        resolve('');
      };

      reader.onabort = () => {
        resolve('');
      };

      reader.readAsDataURL(blob);
    } catch {
      resolve('');
    }
  });
}

// 1. Audio Transcription using gemini-3.5-transcribe
export async function transcribeAudio(
  audioBlob: Blob,
  prompt?: string
): Promise<{ text: string; modelUsed: string; timestamp: string }> {
  const audioBase64 = await blobToBase64(audioBlob);
  const mimeType = audioBlob.type || 'audio/webm';

  const res = await fetch(getApiUrl('/api/ai/transcribe'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ audioBase64, mimeType, prompt }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}: Failed to transcribe audio`);
  }

  return await res.json();
}

// 2. Veo 3 Video Generation from Text using veo-3.1-fast-generate-preview
export async function generateVideoFromText(
  prompt: string,
  aspectRatio: '16:9' | '9:16' = '16:9',
  resolution: '720p' | '1080p' = '720p'
): Promise<{ operationName: string; modelUsed: string; aspectRatio: string }> {
  const res = await fetch(getApiUrl('/api/ai/generate-video'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, aspectRatio, resolution }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}: Failed to generate video`);
  }

  return await res.json();
}

// 4. Animate Image into Video using veo-3.1-fast-generate-preview
export async function animateImageToVideo(
  imageSource: Blob | string,
  prompt?: string,
  aspectRatio: '16:9' | '9:16' = '16:9',
  resolution: '720p' | '1080p' = '720p'
): Promise<{ operationName: string; modelUsed: string; aspectRatio: string }> {
  let imageBase64: string;
  let mimeType = 'image/png';

  if (typeof imageSource === 'string') {
    if (imageSource.startsWith('data:')) {
      const match = imageSource.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        mimeType = match[1];
        imageBase64 = match[2];
      } else {
        imageBase64 = imageSource;
      }
    } else {
      // Remote or local URL
      try {
        const fetched = await fetch(imageSource);
        if (fetched.ok) {
          const b = await fetched.blob();
          mimeType = b.type || 'image/png';
          imageBase64 = await blobToBase64(b);
        } else {
          imageBase64 = '';
        }
      } catch {
        imageBase64 = '';
      }
    }
  } else {
    mimeType = imageSource?.type || 'image/png';
    imageBase64 = await blobToBase64(imageSource);
  }

  const res = await fetch(getApiUrl('/api/ai/image-to-video'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64, mimeType, prompt, aspectRatio, resolution }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}: Failed to animate image`);
  }

  return await res.json();
}

// Poll Veo Video Operation Status
export async function pollVideoOperation(
  operationName: string
): Promise<{ done: boolean; hasVideo: boolean; error?: any }> {
  const res = await fetch(getApiUrl('/api/ai/video-status'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ operationName }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}: Failed to check video status`);
  }

  return await res.json();
}

// Download/Fetch Video from Backend
export async function fetchCompletedVideoBlob(operationName: string): Promise<string> {
  const res = await fetch(getApiUrl('/api/ai/video-download'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ operationName }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}: Failed to download video`);
  }

  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

// 3. Multi-Turn Chatbot using Gemini (gemini-4-argon, gemini-3.8-flash, gemini-3.1-flash-lite)
export async function sendMultiTurnChat(
  messages: Array<{ role: 'user' | 'model'; text: string }>,
  options: {
    role?: string;
    taskComplexity?: 'complex' | 'general' | 'fast';
    modelOverride?: string;
    customSystemInstruction?: string;
  } = {}
): Promise<{ reply: string; modelUsed: string; roleUsed: string; taskComplexity: string }> {
  try {
    const res = await fetch(getApiUrl('/api/ai/chat-multiturn'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages,
        role: options.role || 'executive',
        taskComplexity: options.taskComplexity || 'general',
        modelOverride: options.modelOverride,
        customSystemInstruction: options.customSystemInstruction,
      }),
    });

    if (res.ok) {
      return await res.json();
    }

    const err = await res.json().catch(() => ({}));
    let errMsg = err.error || `HTTP ${res.status}: Failed to get chat response`;
    // Clean up if it's JSON encoded error from Google API
    try {
      if (typeof errMsg === 'string' && errMsg.includes('{')) {
        const jsonStart = errMsg.indexOf('{');
        const parsed = JSON.parse(errMsg.slice(jsonStart));
        if (parsed.error?.message) {
          errMsg = parsed.error.message;
        }
      }
    } catch {}

    // Check if client-side direct fallback is available
    if (isDirectGeminiAvailable()) {
      console.warn('[sendMultiTurnChat] Backend error, falling back to direct client-side Gemini execution...');
      return await directMultiTurnChatFallback(messages, options);
    }

    throw new Error(errMsg);
  } catch (error: any) {
    if (isDirectGeminiAvailable()) {
      console.warn('[sendMultiTurnChat] Network or backend failure, attempting direct client-side Gemini fallback...');
      try {
        return await directMultiTurnChatFallback(messages, options);
      } catch (directErr: any) {
        throw new Error(directErr.message || error.message);
      }
    }
    throw error;
  }
}

/**
 * Direct client-side Gemini multi-turn execution with multi-model failover cascade
 */
async function directMultiTurnChatFallback(
  messages: Array<{ role: 'user' | 'model'; text: string }>,
  options: {
    role?: string;
    taskComplexity?: 'complex' | 'general' | 'fast';
    modelOverride?: string;
    customSystemInstruction?: string;
  }
): Promise<{ reply: string; modelUsed: string; roleUsed: string; taskComplexity: string }> {
  const apiKey = getDirectGeminiApiKey();
  if (!apiKey) {
    throw new Error('Gemini API key is required for direct client execution.');
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const roleInstructions: Record<string, string> = {
    executive:
      'You are the Executive Life OS & Sovereign Strategic Co-pilot for Thamizh and his family. You provide decisive, highly articulate, strategic advice on governance, enterprise technology, and family harmony.',
    family_counselor:
      'You are an Empathetic Family Counselor & Harmony Guide. You communicate with warmth, active listening, deep emotional intelligence, and actionable mindfulness practices for parents and children.',
    venture_strategist:
      'You are a Silicon Valley Principal Venture Partner & Technologist. You evaluate business models, unit economics, term sheets, cap tables, and emerging market moats with rigorous quantitative clarity.',
    stem_tutor:
      'You are an inspiring STEM & Robotics Mentor (specializing in AI simulations, robotics, A* algorithms, and physics). You explain deep technical concepts simply with engaging analogies and code examples.',
    creative_writer:
      'You are an award-winning creative author and storytelling consultant, offering vivid prose, emotional cadence, and polished screenplays.',
  };

  const systemInstruction =
    options.customSystemInstruction ||
    (options.role ? roleInstructions[options.role] : '') ||
    roleInstructions.executive;

  let candidateModels: string[];
  if (options.modelOverride) {
    candidateModels = [options.modelOverride, 'gemini-3.7-flash', 'gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-3.1-flash-lite'];
  } else if (options.taskComplexity === 'complex') {
    candidateModels = [
      'gemini-4-argon',
      'gemini-3.7-flash',
      'gemini-3.8-flash',
      'gemini-3.5-flash',
      'gemini-3.6-flash',
      'gemini-3.1-flash-lite',
    ];
  } else if (options.taskComplexity === 'fast') {
    candidateModels = [
      'gemini-3.1-flash-lite',
      'gemini-3.5-flash-lite',
      'gemini-3.5-flash',
      'gemini-3.8-flash',
    ];
  } else {
    candidateModels = [
      'gemini-3.8-flash',
      'gemini-3.7-flash',
      'gemini-3.5-flash',
      'gemini-3.6-flash',
      'gemini-3.1-flash-lite',
    ];
  }

  const contents = messages.map((m) => ({
    role: m.role === 'model' ? 'model' : 'user',
    parts: [{ text: m.text }],
  }));

  let lastError: any = null;
  for (const modelCandidate of candidateModels) {
    try {
      const response = await ai.models.generateContent({
        model: modelCandidate,
        contents,
        config: {
          systemInstruction,
        },
      });
      return {
        reply: response.text || '',
        modelUsed: `${modelCandidate} (Direct Client)`,
        roleUsed: options.role || 'executive',
        taskComplexity: options.taskComplexity || 'general',
      };
    } catch (err: any) {
      console.warn(`[directMultiTurnChatFallback] Model ${modelCandidate} failed:`, err.message?.slice(0, 60));
      lastError = err;
    }
  }

  throw lastError || new Error('All candidate models failed to generate response.');
}

// 6. Music Generation using Lyria (lyria-3-clip-preview & lyria-3-pro-preview)
export async function generateMusic(
  prompt: string,
  mode: 'clip' | 'pro' = 'clip',
  imageSource?: Blob | string
): Promise<{ audioUrl: string; lyrics: string; modelUsed: string; mode: string }> {
  let imageBase64: string | undefined;
  let mimeType: string | undefined;

  if (imageSource) {
    if (typeof imageSource === 'string') {
      const match = imageSource.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        mimeType = match[1];
        imageBase64 = match[2];
      } else {
        try {
          const fetched = await fetch(imageSource);
          if (fetched.ok) {
            const b = await fetched.blob();
            mimeType = b.type;
            imageBase64 = await blobToBase64(b);
          }
        } catch {
          imageBase64 = undefined;
        }
      }
    } else {
      mimeType = imageSource?.type;
      imageBase64 = await blobToBase64(imageSource);
    }
  }

  try {
    const res = await fetch(getApiUrl('/api/ai/generate-music'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, mode, imageBase64, mimeType }),
    });

    if (res.ok) {
      const data = await res.json();
      let audioUrl = '';

      if (data.audioBase64) {
        const binary = atob(data.audioBase64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: data.mimeType || 'audio/wav' });
        audioUrl = URL.createObjectURL(blob);
      }

      return {
        audioUrl,
        lyrics: data.lyrics || '',
        modelUsed: data.modelUsed,
        mode: data.mode,
      };
    }

    const err = await res.json().catch(() => ({}));
    let errMsg = err.error || `HTTP ${res.status}: Failed to generate music`;
    try {
      if (typeof errMsg === 'string' && errMsg.includes('{')) {
        const jsonStart = errMsg.indexOf('{');
        const parsed = JSON.parse(errMsg.slice(jsonStart));
        if (parsed.error?.message) {
          errMsg = parsed.error.message;
        }
      }
    } catch {}

    if (isDirectGeminiAvailable()) {
      return await directMusicFallback(prompt, mode);
    }

    throw new Error(errMsg);
  } catch (error: any) {
    if (isDirectGeminiAvailable()) {
      try {
        return await directMusicFallback(prompt, mode);
      } catch (fallbackErr: any) {
        throw new Error(fallbackErr.message || error.message);
      }
    }
    throw error;
  }
}

/**
 * Direct client-side Gemini lyrics and melodic voice audio synthesis fallback
 */
async function directMusicFallback(
  prompt: string,
  mode: 'clip' | 'pro'
): Promise<{ audioUrl: string; lyrics: string; modelUsed: string; mode: string }> {
  const apiKey = getDirectGeminiApiKey();
  if (!apiKey) {
    throw new Error('Gemini API key is required for direct music generation.');
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
  });

  const lyricsPrompt = `You are an elite music composer and lyricist. Compose evocative, rhyming musical lyrics for a song inspired by: "${prompt}".
Structure cleanly with:
[Verse 1]
...
[Chorus]
...
[Outro]
Keep it musical, uplifting, and poetic.`;

  let lyrics = '';
  const textModels = ['gemini-3.5-flash', 'gemini-3.7-flash', 'gemini-3.8-flash'];
  for (const tm of textModels) {
    try {
      const lRes = await ai.models.generateContent({
        model: tm,
        contents: lyricsPrompt,
      });
      lyrics = lRes.text?.trim() || '';
      if (lyrics) break;
    } catch {}
  }

  if (!lyrics) {
    lyrics = `[Verse 1]\nMelodies rise in the evening light,\nDrifting softly through the night.\n[Chorus]\nPeace and rhythm hand in hand,\nGuiding dreams across the land.\n[Outro]\nHarmony stays forever true.`;
  }

  const cleanVocalText = lyrics
    .replace(/\[.*?\]/g, '')
    .split('\n')
    .filter((line: string) => line.trim().length > 0)
    .slice(0, 8)
    .join('. ');

  const ttsRes = await ai.models.generateContent({
    model: 'gemini-3.8-flash-lite-tts',
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: cleanVocalText,
            speechMetadata: {
              style: `Melodic, soulful musical delivery with rhythmic cadence, acoustic warmth, and harmonic depth matching: ${prompt}`,
            },
          },
        ],
      },
    ],
    config: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Kore' },
        },
      },
    },
  });

  const synthAudio = ttsRes.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!synthAudio) {
    throw new Error('Failed to synthesize music audio.');
  }

  const binary = atob(synthAudio);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: 'audio/wav' });
  const audioUrl = URL.createObjectURL(blob);

  return {
    audioUrl,
    lyrics,
    modelUsed: 'gemini-3.8-flash-lite-tts (Direct Client Fallback)',
    mode,
  };
}

// 7. Create & Edit Images using gemini-nano-banana-2.1
export async function generateOrEditImage(
  prompt: string,
  options: {
    imageSource?: Blob | string;
    aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4' | '1:4' | '4:1';
    imageSize?: '1K' | '2K' | '4K';
    useSearch?: boolean;
  } = {}
): Promise<{ imageUrl: string; text: string; modelUsed: string; aspectRatio: string; imageSize: string }> {
  let imageBase64: string | undefined;
  let mimeType: string | undefined;

  if (options.imageSource) {
    if (typeof options.imageSource === 'string') {
      const match = options.imageSource.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        mimeType = match[1];
        imageBase64 = match[2];
      } else {
        try {
          const fetched = await fetch(options.imageSource);
          if (fetched.ok) {
            const b = await fetched.blob();
            mimeType = b.type;
            imageBase64 = await blobToBase64(b);
          }
        } catch {
          imageBase64 = undefined;
        }
      }
    } else {
      mimeType = options.imageSource?.type;
      imageBase64 = await blobToBase64(options.imageSource);
    }
  }

  const res = await fetch(getApiUrl('/api/ai/image-studio'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      imageBase64,
      mimeType,
      aspectRatio: options.aspectRatio || '1:1',
      imageSize: options.imageSize || '1K',
      useSearch: !!options.useSearch,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}: Failed to generate/edit image`);
  }

  return await res.json();
}

// 5. Voice Conversations with gemini-3.8-live (Live API)
export async function converseLiveTurn(
  audioBlob?: Blob,
  textPrompt?: string
): Promise<{ audioUrl: string | null; text: string; modelUsed: string }> {
  let audioBase64: string | undefined;
  let mimeType: string | undefined;

  if (audioBlob) {
    mimeType = audioBlob.type || 'audio/webm';
    audioBase64 = await blobToBase64(audioBlob);
  }

  const res = await fetch(getApiUrl('/api/ai/live-converse'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ audioBase64, mimeType, textPrompt }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}: Failed live voice turn`);
  }

  const data = await res.json();
  let audioUrl: string | null = null;

  if (data.audioBase64) {
    const binary = atob(data.audioBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: 'audio/wav' });
    audioUrl = URL.createObjectURL(blob);
  }

  return {
    audioUrl,
    text: data.text,
    modelUsed: data.modelUsed,
  };
}
