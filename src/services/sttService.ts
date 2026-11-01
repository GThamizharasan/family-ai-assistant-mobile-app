// Realtime Speech-To-Text (STT) Service & Google Drive Integration
// Saves transcripts and audio memos to "Family Circle / Speech To Text Transcripts" folder in Google Drive.
// Supports Multi-Lingual Speech recognition (Tamil, English, Hindi, Telugu, Malayalam, Kannada, etc.).

import { SttMemo, SttLanguageOption, SttLanguageCode, SttTemplate } from '../types/stt';
import { getOrCreateGoogleDriveFolder } from './googleWorkspace';
import { getApiUrl } from './api';
import { saveAudioToStorage } from '../utils/audioStorage';

const LOCAL_STORAGE_KEY = 'aura_stt_memos_cache_v1';
export const DRIVE_FOLDER_NAME = 'Speech To Text Transcripts';
export const STT_DRIVE_FOLDER_NAME = DRIVE_FOLDER_NAME;

export const STT_LANGUAGES: SttLanguageOption[] = [
  {
    code: 'ta-IN',
    label: 'Tamil',
    name: 'Tamil',
    nativeName: 'தமிழ்',
    flag: '🇮🇳',
    bcp47: 'ta-IN',
    description: 'Authentic Tamil script with accurate inflection and Tamil vocabulary',
    samplePhrase: 'வணக்கம், இன்று நான் செய்ய வேண்டிய முக்கியமான வேலைகள்...',
  },
  {
    code: 'en-US',
    label: 'English (US)',
    name: 'English (US)',
    nativeName: 'English (US)',
    flag: '🇺🇸',
    bcp47: 'en-US',
    description: 'Standard North American English transcription',
    samplePhrase: 'Good morning, today we are reviewing our product goals and roadmap...',
  },
  {
    code: 'en-IN',
    label: 'English (India)',
    name: 'English (India)',
    nativeName: 'Indian English',
    flag: '🇮🇳',
    bcp47: 'en-IN',
    description: 'Indian English cadence with support for Indian terms and pronunciation',
    samplePhrase: 'Please note down the meeting minutes for the upcoming family review...',
  },
  {
    code: 'hi-IN',
    label: 'Hindi',
    name: 'Hindi',
    nativeName: 'हिन्दी',
    flag: '🇮🇳',
    bcp47: 'hi-IN',
    description: 'Devanagari script with natural colloquial Hindi recognition',
    samplePhrase: 'नमस्ते, आज के मुख्य कार्य और जरूरी योजनाएं...',
  },
  {
    code: 'auto',
    label: 'Multilingual Auto',
    name: 'Multilingual Auto',
    nativeName: 'Tanglish / Hinglish Auto',
    flag: '🌐',
    bcp47: 'ta-IN',
    description: 'Intelligent code-switching (Tamil + English, Hindi + English) auto-detection',
    samplePhrase: 'Innaiku meeting la discuss panna points ellam note pannunga...',
  },
  {
    code: 'te-IN',
    label: 'Telugu',
    name: 'Telugu',
    nativeName: 'తెలుగు',
    flag: '🇮🇳',
    bcp47: 'te-IN',
    description: 'Telugu script with pure vocabulary recognition',
    samplePhrase: 'నమస్కారం, ఈ రోజు ముఖ్యమైన పనులు మరియు నోట్స్...',
  },
  {
    code: 'ml-IN',
    label: 'Malayalam',
    name: 'Malayalam',
    nativeName: 'മലയാളം',
    flag: '🇮🇳',
    bcp47: 'ml-IN',
    description: 'Malayalam script transcription with high accuracy',
    samplePhrase: 'നമസ്കാരം, ഇന്നത്തെ പ്രധാനപ്പെട്ട ജോലികൾ...',
  },
  {
    code: 'kn-IN',
    label: 'Kannada',
    name: 'Kannada',
    nativeName: 'ಕನ್ನಡ',
    flag: '🇮🇳',
    bcp47: 'kn-IN',
    description: 'Kannada script with clear speech articulation',
    samplePhrase: 'ನಮಸ್ಕಾರ, ಇಂದಿನ ಪ್ರಮುಖ ಕೆಲಸಗಳು...',
  },
  {
    code: 'es-ES',
    label: 'Spanish',
    name: 'Spanish',
    nativeName: 'Español',
    flag: '🇪🇸',
    bcp47: 'es-ES',
    description: 'Castilian and Latin American Spanish speech recognition',
    samplePhrase: 'Buenos días, estas son las notas importantes para la reunión...',
  },
  {
    code: 'fr-FR',
    label: 'French',
    name: 'French',
    nativeName: 'Français',
    flag: '🇫🇷',
    bcp47: 'fr-FR',
    description: 'Metropolitan French transcription',
    samplePhrase: 'Bonjour, voici les points clés de notre discussion d’aujourd’hui...',
  },
  {
    code: 'de-DE',
    label: 'German',
    name: 'German',
    nativeName: 'Deutsch',
    flag: '🇩🇪',
    bcp47: 'de-DE',
    description: 'Standard German speech-to-text',
    samplePhrase: 'Guten Tag, hier sind die Notizen für unser heutiges Treffen...',
  },
  {
    code: 'ja-JP',
    label: 'Japanese',
    name: 'Japanese',
    nativeName: '日本語',
    flag: '🇯🇵',
    bcp47: 'ja-JP',
    description: 'Japanese Kanji, Hiragana and Katakana transcription',
    samplePhrase: 'おはようございます、本日のミーティングのメモを記録します...',
  },
  {
    code: 'ar-SA',
    label: 'Arabic',
    name: 'Arabic',
    nativeName: 'العربية',
    flag: '🇸🇦',
    bcp47: 'ar-SA',
    description: 'Modern Standard Arabic speech transcription',
    samplePhrase: 'مرحبا، هذه هي الملاحظات الهامة لاجتماع اليوم...',
  },
];

export const STT_TEMPLATES: SttTemplate[] = [
  {
    id: 'stt-t-1',
    category: 'Meeting Minutes',
    title: 'Executive Meeting Action Items',
    language: 'en-US',
    samplePrompt: 'Reviewing Q4 deliverables: 1. Finalize mobile app build, 2. Deploy Cloud Run endpoints, 3. Sync SQLite offline vault.',
    prompt: 'Reviewing Q4 deliverables: 1. Finalize mobile app build, 2. Deploy Cloud Run endpoints, 3. Sync SQLite offline vault.',
    icon: '💼',
  },
  {
    id: 'stt-t-2',
    category: 'Tamil Thought',
    title: 'தமிழ் சிந்தனை & கவிதை',
    language: 'ta-IN',
    samplePrompt: 'முயற்சி திருவினையாக்கும் முயற்றின்மை இன்மை புகுத்தி விடும். தினசரி உழைப்பும் அமைதியான மனமும் நம் வாழ்வின் வெற்றி.',
    prompt: 'முயற்சி திருவினையாக்கும் முயற்றின்மை இன்மை புகுத்தி விடும். தினசரி உழைப்பும் அமைதியான மனமும் நம் வாழ்வின் வெற்றி.',
    icon: '📜',
  },
  {
    id: 'stt-t-3',
    category: 'Family Reminder',
    title: 'Family Grocery & Errands',
    language: 'auto',
    samplePrompt: 'Evening shopping list: organic almond milk, fresh apples, brown bread, and pick up dry cleaning by 6 PM.',
    prompt: 'Evening shopping list: organic almond milk, fresh apples, brown bread, and pick up dry cleaning by 6 PM.',
    icon: '🛒',
  },
  {
    id: 'stt-t-4',
    category: 'Personal Journal',
    title: 'Daily Reflection & Gratitude',
    language: 'en-US',
    samplePrompt: 'Today I felt genuinely grateful for uninterrupted family time, good health, and steady progress on our long-term goals.',
    prompt: 'Today I felt genuinely grateful for uninterrupted family time, good health, and steady progress on our long-term goals.',
    icon: '📔',
  },
  {
    id: 'stt-t-5',
    category: 'Lecture Notes',
    title: 'Key Concepts & Summary',
    language: 'hi-IN',
    samplePrompt: 'आज के व्याख्यान के मुख्य बिंदु: निरंतर अभ्यास और सकारात्मक दृष्टिकोण ही वास्तविक सफलता का मार्ग है।',
    prompt: 'आज के व्याख्यान के मुख्य बिंदु: निरंतर अभ्यास और सकारात्मक दृष्टिकोण ही वास्तविक सफलता का मार्ग है।',
    icon: '🎓',
  },
];

export function getLocalSttMemos(): SttMemo[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveLocalSttMemos(memos: SttMemo[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(memos));
  } catch (err) {
    console.warn('Failed to save STT memos to localStorage:', err);
  }
}

/**
 * Fetch all STT memos from SQLite database with local cache fallback
 */
export async function fetchSttMemos(
  googleAccessToken?: string | null,
  userEmail = 'chinna.tamil2000@gmail.com'
): Promise<SttMemo[]> {
  try {
    const res = await fetch(getApiUrl(`/api/stt/memos?userEmail=${encodeURIComponent(userEmail)}`));
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.memos)) {
        saveLocalSttMemos(data.memos);
        return data.memos;
      }
    }
  } catch (err) {
    console.warn('Failed to fetch STT memos from SQLite, using local cache:', err);
  }

  return getLocalSttMemos();
}

/**
 * Upload STT transcript and optional audio to Google Drive under "Family Circle / Speech To Text Transcripts"
 */
export async function uploadSttMemoToDrive(
  first: string | SttMemo,
  second?: SttMemo | string | null,
  third?: Blob | string | null
): Promise<{ success: boolean; fileId: string; driveFileId: string; webViewLink: string; folderId: string }> {
  let accessToken: string;
  let memo: SttMemo;

  if (typeof first === 'string') {
    accessToken = first;
    memo = second as SttMemo;
  } else {
    memo = first;
    accessToken = (second as string) || '';
  }

  if (!accessToken) {
    throw new Error('Google Drive access token is required for upload');
  }

  const familyCircleFolder = await getOrCreateGoogleDriveFolder(accessToken, 'Family Circle');
  const sttFolder = await getOrCreateGoogleDriveFolder(
    accessToken,
    DRIVE_FOLDER_NAME,
    familyCircleFolder.id
  );

  const cleanTitle = (memo.title || 'STT Transcript').replace(/[/\\?%*:|"<>]/g, '_').trim();
  const fileName = `${cleanTitle}.md`;

  // Build formatted markdown document
  const markdownContent = `# ${memo.title || 'Speech-to-Text Transcription'}

- **Language**: ${memo.languageLabel} (\`${memo.sourceLanguage}\`)
- **Category**: ${memo.category || 'General'}
- **Created**: ${new Date(memo.createdAt).toLocaleString()}
- **Duration**: ${Math.round(memo.durationSeconds || 0)}s | **Words**: ${memo.wordCount} | **Characters**: ${memo.characterCount}
${memo.summary ? `\n## Executive Summary\n${memo.summary}\n` : ''}
${memo.keyPoints && memo.keyPoints.length ? `\n## Key Takeaways\n${memo.keyPoints.map((k) => `- ${k}`).join('\n')}\n` : ''}
## Spoken Transcript
${memo.transcribedText}

---
*Transcribed by AuraFamily AI Sovereign Speech OS*
`;

  const metadata = {
    name: fileName,
    mimeType: 'text/markdown',
    parents: [sttFolder.id],
    description: `Auro Speech-To-Text • Language: ${memo.languageLabel} (${memo.sourceLanguage})\nSummary: ${memo.summary || memo.transcribedText.slice(0, 150)}`,
  };

  const boundary = `-------AuroSttBoundary${Date.now()}`;
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const enc = new TextEncoder();
  const textBytes = enc.encode(markdownContent);

  const metadataPart = `${delimiter}Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`;
  const mediaPartHeader = `${delimiter}Content-Type: text/markdown; charset=UTF-8\r\nContent-Transfer-Encoding: binary\r\n\r\n`;

  const metadataBytes = enc.encode(metadataPart);
  const mediaHeaderBytes = enc.encode(mediaPartHeader);
  const closeDelimiterBytes = enc.encode(closeDelimiter);

  const fullPayload = new Uint8Array(
    metadataBytes.length + mediaHeaderBytes.length + textBytes.length + closeDelimiterBytes.length
  );

  let offset = 0;
  fullPayload.set(metadataBytes, offset);
  offset += metadataBytes.length;
  fullPayload.set(mediaHeaderBytes, offset);
  offset += mediaHeaderBytes.length;
  fullPayload.set(textBytes, offset);
  offset += textBytes.length;
  fullPayload.set(closeDelimiterBytes, offset);

  const uploadRes = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,parents',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: fullPayload,
    }
  );

  if (!uploadRes.ok) {
    const errText = await uploadRes.text().catch(() => '');
    throw new Error(`Google Drive upload failed (${uploadRes.status}): ${errText}`);
  }

  const uploadedData = await uploadRes.json();
  const webViewLink = uploadedData.webViewLink || `https://drive.google.com/file/d/${uploadedData.id}/view`;

  return {
    success: true,
    fileId: uploadedData.id,
    driveFileId: uploadedData.id,
    webViewLink,
    folderId: sttFolder.id,
  };
}

/**
 * Save STT memo into SQLite, Drive, and Local Cache
 */
export async function saveSttMemo(
  memo: SttMemo,
  audioBlobOrToken?: Blob | string | null,
  googleAccessTokenOrEmail?: string | null,
  audioBlobParam?: Blob
): Promise<SttMemo> {
  let updatedMemo = { ...memo };
  let audioBlob: Blob | undefined = undefined;
  let googleAccessToken: string | null = null;

  if (audioBlobOrToken instanceof Blob) {
    audioBlob = audioBlobOrToken;
    googleAccessToken = (googleAccessTokenOrEmail as string) || null;
  } else {
    googleAccessToken = (audioBlobOrToken as string) || null;
    audioBlob = audioBlobParam;
  }

  if (audioBlob && !updatedMemo.audioContentBase64) {
    try {
      const arrayBuffer = await audioBlob.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      const len = bytes.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      updatedMemo.audioContentBase64 = btoa(binary);
      updatedMemo.fileSizeBytes = arrayBuffer.byteLength;
    } catch {}
  }

  // 1. Save audio binary into Client IndexedDB store for zero-latency local playback
  if (updatedMemo.audioContentBase64 || audioBlob) {
    try {
      await saveAudioToStorage(
        updatedMemo.id,
        updatedMemo.audioContentBase64 || audioBlob!,
        updatedMemo.audioMimeType || 'audio/webm'
      );
    } catch (idbErr) {
      console.warn('[SttMemo] IndexedDB client save notice:', idbErr);
    }
  }

  // 2. Upload to Google Drive if connected
  if (googleAccessToken) {
    try {
      const driveInfo = await uploadSttMemoToDrive(googleAccessToken, updatedMemo, audioBlob);
      updatedMemo.driveFileId = driveInfo.driveFileId;
      updatedMemo.driveWebViewLink = driveInfo.webViewLink;
      updatedMemo.driveSyncStatus = 'synced';
    } catch (driveErr) {
      console.warn('Drive upload error (saving locally):', driveErr);
      updatedMemo.driveSyncStatus = 'local_only';
    }
  }

  // 3. Save to SQLite
  try {
    const res = await fetch(getApiUrl('/api/stt/memos'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedMemo),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.memo) {
        updatedMemo = { ...updatedMemo, ...data.memo };
      }
    }
  } catch (sqlErr) {
    console.warn('Failed to save STT memo to SQLite:', sqlErr);
  }

  // 4. Save to local cache
  const list = getLocalSttMemos().filter((m) => m.id !== updatedMemo.id);
  list.unshift(updatedMemo);
  saveLocalSttMemos(list);

  return updatedMemo;
}

/**
 * Delete STT memo from SQLite and Local Cache
 */
export async function deleteSttMemo(
  id: string,
  googleAccessTokenOrEmail?: string | null,
  userEmail?: string
): Promise<boolean> {
  const list = getLocalSttMemos().filter((m) => m.id !== id);
  saveLocalSttMemos(list);

  const email = userEmail || (googleAccessTokenOrEmail && !googleAccessTokenOrEmail.startsWith('ya29') ? googleAccessTokenOrEmail : '');

  try {
    const emailParam = email ? `?userEmail=${encodeURIComponent(email)}` : '';
    await fetch(getApiUrl(`/api/stt/memos/${id}${emailParam}`), {
      method: 'DELETE',
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Toggle favorite status
 */
export async function toggleSttFavorite(
  id: string,
  isFavorite: boolean,
  googleAccessTokenOrEmail?: string | null,
  userEmail?: string
): Promise<boolean> {
  const list = getLocalSttMemos();
  const item = list.find((m) => m.id === id);
  if (item) {
    item.isFavorite = isFavorite;
    saveLocalSttMemos(list);
  }

  try {
    await fetch(getApiUrl(`/api/stt/memos/${id}/favorite`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isFavorite }),
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Download STT transcript directly to device as Markdown or Text
 */
export function downloadSttTranscriptFile(
  memo: SttMemo,
  format: 'md' | 'txt' | 'markdown' = 'md'
): { success: boolean; filename: string } {
  const safeTitle = (memo.title || 'STT Transcript').replace(/[/\\?%*:|"<>]/g, '_').trim();
  const ext = format === 'txt' ? 'txt' : 'md';
  const filename = `${safeTitle}.${ext}`;

  let content = '';
  if (ext === 'md') {
    content = `# ${memo.title}\n\n**Language**: ${memo.languageLabel} (${memo.sourceLanguage})\n**Date**: ${new Date(memo.createdAt).toLocaleString()}\n**Words**: ${memo.wordCount}\n\n## Transcript\n${memo.transcribedText}\n\n${memo.summary ? `## Summary\n${memo.summary}\n` : ''}${memo.keyPoints?.length ? `## Key Takeaways\n${memo.keyPoints.map((k) => `- ${k}`).join('\n')}\n` : ''}`;
  } else {
    content = `${memo.title}\nLanguage: ${memo.languageLabel}\nDate: ${new Date(memo.createdAt).toLocaleString()}\n\n${memo.transcribedText}\n\nSummary:\n${memo.summary || 'N/A'}`;
  }

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  triggerBrowserDownload(blob, filename);
  return { success: true, filename };
}

/**
 * AI Summarize and Polish spoken text
 */
export async function summarizeSttText(
  text: string,
  language = 'auto'
): Promise<{ title?: string; summary?: string; keyPoints?: string[]; polishedText?: string; cleanedText?: string }> {
  const res = await fetch(getApiUrl('/api/stt/summarize'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, language }),
  });

  if (!res.ok) {
    throw new Error('Failed to generate summary');
  }

  const data = await res.json();
  return {
    ...data,
    cleanedText: data.cleanedText || data.polishedText,
  };
}

/**
 * Share STT memo using Web Share API or clipboard
 */
export async function shareSttMemo(memo: SttMemo): Promise<boolean> {
  const textToShare = `🎙️ ${memo.title}\nLanguage: ${memo.languageLabel}\n\n"${memo.transcribedText}"\n\n${memo.driveWebViewLink ? `Drive link: ${memo.driveWebViewLink}` : ''}`;

  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({
        title: memo.title,
        text: textToShare,
        url: memo.driveWebViewLink,
      });
      return true;
    } catch {
      return false;
    }
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    await navigator.clipboard.writeText(textToShare);
    return true;
  }

  return false;
}

function triggerBrowserDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 300);
}
