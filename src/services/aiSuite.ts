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

// Helper: Blob to Base64
export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1] || result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// 1. Audio Transcription using gemini-3.5-transcribe
export async function transcribeAudio(
  audioBlob: Blob,
  prompt?: string
): Promise<{ text: string; modelUsed: string; timestamp: string }> {
  const audioBase64 = await blobToBase64(audioBlob);
  const mimeType = audioBlob.type || 'audio/webm';

  const res = await fetch('/api/ai/transcribe', {
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
  const res = await fetch('/api/ai/generate-video', {
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
      const fetched = await fetch(imageSource);
      const b = await fetched.blob();
      mimeType = b.type || 'image/png';
      imageBase64 = await blobToBase64(b);
    }
  } else {
    mimeType = imageSource.type || 'image/png';
    imageBase64 = await blobToBase64(imageSource);
  }

  const res = await fetch('/api/ai/image-to-video', {
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
  const res = await fetch('/api/ai/video-status', {
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
  const res = await fetch('/api/ai/video-download', {
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
  const res = await fetch('/api/ai/chat-multiturn', {
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

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}: Failed to get chat response`);
  }

  return await res.json();
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
        const fetched = await fetch(imageSource);
        const b = await fetched.blob();
        mimeType = b.type;
        imageBase64 = await blobToBase64(b);
      }
    } else {
      mimeType = imageSource.type;
      imageBase64 = await blobToBase64(imageSource);
    }
  }

  const res = await fetch('/api/ai/generate-music', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, mode, imageBase64, mimeType }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}: Failed to generate music`);
  }

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
        const fetched = await fetch(options.imageSource);
        const b = await fetched.blob();
        mimeType = b.type;
        imageBase64 = await blobToBase64(b);
      }
    } else {
      mimeType = options.imageSource.type;
      imageBase64 = await blobToBase64(options.imageSource);
    }
  }

  const res = await fetch('/api/ai/image-studio', {
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

  const res = await fetch('/api/ai/live-converse', {
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
