// Text-to-Speech (TTS) Service & Google Drive Integration
// Saves audio memos to "Family Circle / Text to Speech Memos" folder in Google Drive.
// Supports Male, Female, and Child voice synthesis via Gemini 3.8 Flash Lite TTS.

import { TtsMemo, TtsVoiceOption, TtsVoiceType, TtsTemplate } from '../types/tts';
import { getOrCreateGoogleDriveFolder } from './googleWorkspace';
import { getApiUrl } from './api';

const LOCAL_STORAGE_KEY = 'aura_tts_memos_cache_v1';
export const DRIVE_FOLDER_NAME = 'Text to Speech Memos';

export const TTS_VOICES: TtsVoiceOption[] = [
  {
    id: 'male',
    label: 'Fenrir',
    subLabel: 'Deep, Confident & Articulate Male',
    geminiVoice: 'Fenrir',
    icon: '👨',
    accent: 'Warm Baritone',
    sampleText: 'Welcome to Auro Family Assistant. Let me organize your day with clarity.',
    styleDescription: 'Resonant, authoritative, and calm masculine tone.',
  },
  {
    id: 'female',
    label: 'Kore',
    subLabel: 'Warm, Expressive & Empathetic Female',
    geminiVoice: 'Kore',
    icon: '👩',
    accent: 'Crystal Clear Soprano',
    sampleText: 'Hello family! Wishing you a peaceful, productive, and joyful day ahead.',
    styleDescription: 'Warm, uplifting, natural, and caring feminine tone.',
  },
  {
    id: 'child',
    label: 'Puck (Youth)',
    subLabel: 'Playful, Cheerful & Energetic Child',
    geminiVoice: 'Puck',
    icon: '🧒',
    accent: 'Innocent & Bright',
    sampleText: 'Good morning! Are you ready for an exciting adventure today? Let’s go!',
    styleDescription: 'High-spirited, energetic, friendly, and playful young voice.',
  },
];

export const TTS_TEMPLATES: TtsTemplate[] = [
  {
    id: 't-1',
    category: 'Family Reminder',
    title: 'Morning Energy & Gratitude',
    voiceType: 'female',
    text: 'Good morning, dear family! Drink a warm glass of water, do ten minutes of deep breathing, and start today with a peaceful mind.',
  },
  {
    id: 't-2',
    category: 'Kids Bedtime Story',
    title: 'The Brave Little Star',
    voiceType: 'child',
    text: 'Once upon a time in the vast velvet night, a tiny star learned that even the smallest light can guide a traveler home. Sleep tight, sweet dreams!',
  },
  {
    id: 't-3',
    category: 'Tamil Wisdom',
    title: 'Thirukkural Insight',
    voiceType: 'male',
    text: 'இனிய உளவாக இன்னாத கூறல் கனியிருப்பக் காய்கவர்ந் தற்று. Speak sweet and kind words always; choose the ripe fruit over the bitter one.',
  },
  {
    id: 't-4',
    category: 'Meeting & Work',
    title: 'Executive Focus Briefing',
    voiceType: 'male',
    text: 'Today’s primary objective: execute high-leverage priorities first. Eliminate distractions and preserve peak mental focus during the morning block.',
  },
  {
    id: 't-5',
    category: 'Daily Affirmation',
    title: 'Unstoppable Momentum',
    voiceType: 'female',
    text: 'I am resilient, capable, and surrounded by unconditional love. Every challenge I face today is an opportunity to grow stronger.',
  },
];

export function getLocalTtsMemos(): TtsMemo[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.warn('Failed to parse local TTS memos:', err);
    return [];
  }
}

export function saveLocalTtsMemos(memos: TtsMemo[]) {
  if (typeof window === 'undefined') return;
  try {
    const sanitized = memos.map((m) => {
      if (m.audioContentBase64 && m.audioContentBase64.length > 200000) {
        return { ...m, audioContentBase64: undefined };
      }
      return m;
    });
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(sanitized));
  } catch (err) {
    console.warn('Failed to save TTS memos to localStorage:', err);
  }
}

/**
 * Fetch all TTS memos (merging local cache, SQLite, and Google Drive)
 */
export async function fetchTtsMemos(
  googleAccessToken?: string | null,
  userEmail?: string
): Promise<TtsMemo[]> {
  const map = new Map<string, TtsMemo>();

  // 1. Local Cache
  const localList = getLocalTtsMemos();
  localList.forEach((m) => map.set(m.id, m));

  // 2. Fetch from server SQLite
  try {
    const emailParam = encodeURIComponent(userEmail || 'chinna.tamil2000@gmail.com');
    const res = await fetch(getApiUrl(`/api/tts/memos?userEmail=${emailParam}`));
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.memos)) {
        for (const item of data.memos) {
          const existing = map.get(item.id);
          map.set(item.id, {
            ...existing,
            ...item,
            driveSyncStatus: item.driveFileId ? 'synced' : existing?.driveSyncStatus || 'local_only',
          });
        }
      }
    }
  } catch (err) {
    console.warn('Failed to fetch TTS memos from server SQLite:', err);
  }

  // 3. Scan Google Drive folder "Family Circle / Text to Speech Memos"
  if (googleAccessToken) {
    try {
      const familyCircleFolder = await getOrCreateGoogleDriveFolder(googleAccessToken, 'Family Circle');
      const ttsFolder = await getOrCreateGoogleDriveFolder(
        googleAccessToken,
        DRIVE_FOLDER_NAME,
        familyCircleFolder.id
      );

      const q = `'${ttsFolder.id}' in parents and trashed = false and mimeType != 'application/vnd.google-apps.folder'`;
      const driveRes = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType,size,webViewLink,createdTime,description)&pageSize=50&orderBy=createdTime desc`,
        { headers: { Authorization: `Bearer ${googleAccessToken}` } }
      );

      if (driveRes.ok) {
        const driveData = await driveRes.json();
        const driveFiles = driveData.files || [];

        for (const df of driveFiles) {
          const match = Array.from(map.values()).find(
            (m) => m.driveFileId === df.id || m.title.toLowerCase() === df.name.replace(/\.[a-zA-Z0-9]+$/, '').toLowerCase()
          );

          if (match) {
            match.driveFileId = df.id;
            match.driveWebViewLink = df.webViewLink;
            match.driveSyncStatus = 'synced';
          } else {
            const desc = df.description || '';
            const isChild = desc.toLowerCase().includes('child');
            const isFemale = desc.toLowerCase().includes('female');
            const voiceType: TtsVoiceType = isChild ? 'child' : isFemale ? 'female' : 'male';

            const newMemo: TtsMemo = {
              id: `drive_tts_${df.id}`,
              userEmail: userEmail || 'chinna.tamil2000@gmail.com',
              title: df.name.replace(/\.[a-zA-Z0-9]+$/, ''),
              textPrompt: desc || df.name,
              voiceType,
              voiceName: voiceType === 'female' ? 'Kore' : voiceType === 'child' ? 'Puck' : 'Fenrir',
              audioUrl: `https://drive.google.com/uc?export=download&id=${df.id}`,
              audioMimeType: df.mimeType || 'audio/wav',
              durationSeconds: 15,
              fileSizeBytes: Number(df.size || 0),
              driveFileId: df.id,
              driveWebViewLink: df.webViewLink,
              driveFolderPath: `Family Circle/${DRIVE_FOLDER_NAME}`,
              driveSyncStatus: 'synced',
              isFavorite: false,
              playCount: 0,
              createdAt: df.createdTime || new Date().toISOString(),
              updatedAt: df.createdTime || new Date().toISOString(),
            };
            map.set(newMemo.id, newMemo);
          }
        }
      }
    } catch (dErr) {
      console.warn('Google Drive TTS scan failed:', dErr);
    }
  }

  const combined = Array.from(map.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  saveLocalTtsMemos(combined);
  return combined;
}

/**
 * Generate speech audio from text via server endpoint
 */
export async function generateTtsAudio(
  text: string,
  voiceType: TtsVoiceType = 'male',
  voiceName?: string
): Promise<{ audioBase64: string; mimeType: string; voiceName: string }> {
  const res = await fetch(getApiUrl('/api/tts/generate'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      voiceType,
      voiceName,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`TTS generation failed (${res.status}): ${errText}`);
  }

  const data = await res.json();
  return {
    audioBase64: data.audioBase64,
    mimeType: data.mimeType || 'audio/wav',
    voiceName: data.voiceName || (voiceType === 'female' ? 'Kore' : voiceType === 'child' ? 'Puck' : 'Fenrir'),
  };
}

/**
 * Upload TTS audio directly to Google Drive under "Family Circle / Text to Speech Memos"
 */
export async function uploadTtsMemoToDrive(
  accessToken: string,
  memo: TtsMemo,
  audioBlob: Blob
): Promise<{ driveFileId: string; webViewLink: string; folderId: string }> {
  const familyCircleFolder = await getOrCreateGoogleDriveFolder(accessToken, 'Family Circle');
  const ttsFolder = await getOrCreateGoogleDriveFolder(
    accessToken,
    DRIVE_FOLDER_NAME,
    familyCircleFolder.id
  );

  const cleanTitle = (memo.title || 'TTS Memo').replace(/[/\\?%*:|"<>]/g, '_').trim();
  const isMp3 = memo.audioMimeType?.includes('mpeg') || memo.audioMimeType?.includes('mp3');
  const ext = isMp3 ? 'mp3' : 'wav';
  const mimeType = isMp3 ? 'audio/mpeg' : 'audio/wav';
  const fileName = `${cleanTitle}.${ext}`;

  const metadata = {
    name: fileName,
    mimeType,
    parents: [ttsFolder.id],
    description: `Auro Text-to-Speech Memo • Voice: ${memo.voiceType.toUpperCase()} (${memo.voiceName})\nScript: "${memo.textPrompt}"`,
  };

  const boundary = `-------AuroTtsBoundary${Date.now()}`;
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const audioBytes = new Uint8Array(await audioBlob.arrayBuffer());

  const metadataPart = `${delimiter}Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`;
  const mediaPartHeader = `${delimiter}Content-Type: ${memo.audioMimeType || 'audio/wav'}\r\nContent-Transfer-Encoding: binary\r\n\r\n`;

  const enc = new TextEncoder();
  const metadataBytes = enc.encode(metadataPart);
  const mediaHeaderBytes = enc.encode(mediaPartHeader);
  const closeDelimiterBytes = enc.encode(closeDelimiter);

  const fullPayload = new Uint8Array(
    metadataBytes.length + mediaHeaderBytes.length + audioBytes.length + closeDelimiterBytes.length
  );

  let offset = 0;
  fullPayload.set(metadataBytes, offset);
  offset += metadataBytes.length;
  fullPayload.set(mediaHeaderBytes, offset);
  offset += mediaHeaderBytes.length;
  fullPayload.set(audioBytes, offset);
  offset += audioBytes.length;
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
    driveFileId: uploadedData.id,
    webViewLink,
    folderId: ttsFolder.id,
  };
}

/**
 * Save TTS memo into SQLite, Drive, and Local Cache
 */
export async function saveTtsMemo(
  memo: TtsMemo,
  audioBlob?: Blob,
  googleAccessToken?: string | null
): Promise<TtsMemo> {
  let updatedMemo = { ...memo };

  if (audioBlob && !updatedMemo.audioContentBase64) {
    const arrayBuffer = await audioBlob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    updatedMemo.audioContentBase64 = btoa(binary);
    updatedMemo.fileSizeBytes = arrayBuffer.byteLength;
  }

  // Upload to Drive if access token is available
  if (googleAccessToken && audioBlob) {
    try {
      const driveInfo = await uploadTtsMemoToDrive(googleAccessToken, updatedMemo, audioBlob);
      updatedMemo.driveFileId = driveInfo.driveFileId;
      updatedMemo.driveWebViewLink = driveInfo.webViewLink;
      updatedMemo.driveSyncStatus = 'synced';
    } catch (driveErr) {
      console.warn('Drive upload error (saving locally):', driveErr);
      updatedMemo.driveSyncStatus = 'local_only';
    }
  }

  // Save to SQLite
  try {
    const res = await fetch(getApiUrl('/api/tts/memos'), {
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
    console.warn('Failed to save TTS memo to SQLite:', sqlErr);
  }

  // Save to local cache
  const list = getLocalTtsMemos().filter((m) => m.id !== updatedMemo.id);
  list.unshift(updatedMemo);
  saveLocalTtsMemos(list);

  return updatedMemo;
}

/**
 * Delete TTS memo
 */
export async function deleteTtsMemo(id: string, userEmail?: string): Promise<boolean> {
  const list = getLocalTtsMemos().filter((m) => m.id !== id);
  saveLocalTtsMemos(list);

  try {
    const emailParam = userEmail ? `?userEmail=${encodeURIComponent(userEmail)}` : '';
    await fetch(getApiUrl(`/api/tts/memos/${id}${emailParam}`), {
      method: 'DELETE',
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Toggle favorite
 */
export async function toggleTtsFavorite(id: string, isFavorite: boolean): Promise<boolean> {
  const list = getLocalTtsMemos();
  const item = list.find((m) => m.id === id);
  if (item) {
    item.isFavorite = isFavorite;
    saveLocalTtsMemos(list);
  }

  try {
    await fetch(getApiUrl(`/api/tts/memos/${id}/favorite`), {
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
 * Download TTS audio file directly to device
 */
export async function downloadTtsAudioFile(
  memo: TtsMemo,
  googleAccessToken?: string | null
): Promise<{ success: boolean; filename?: string; error?: string }> {
  try {
    const safeTitle = (memo.title || 'TTS Audio').replace(/[/\\?%*:|"<>]/g, '_').trim();
    const isMp3 = memo.audioMimeType?.includes('mpeg') || memo.audioMimeType?.includes('mp3');
    const ext = isMp3 ? 'mp3' : 'wav';
    const filename = `${safeTitle}.${ext}`;

    if (memo.audioContentBase64 && memo.audioContentBase64.length > 20) {
      const mime = memo.audioMimeType || (isMp3 ? 'audio/mpeg' : 'audio/wav');
      const byteChars = atob(memo.audioContentBase64);
      const byteNumbers = new Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) {
        byteNumbers[i] = byteChars.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: mime });
      triggerBrowserDownload(blob, filename);
      return { success: true, filename };
    }

    // Try server endpoint
    const serverUrl = getApiUrl(`/api/tts/memos/${memo.id}/audio`);
    try {
      const res = await fetch(serverUrl);
      if (res.ok) {
        const blob = await res.blob();
        if (blob.size > 50) {
          triggerBrowserDownload(blob, filename);
          return { success: true, filename };
        }
      }
    } catch {}

    // Try Google Drive download
    if (memo.driveFileId) {
      const driveDownloadUrl = `https://drive.google.com/uc?export=download&id=${memo.driveFileId}`;
      const a = document.createElement('a');
      a.href = driveDownloadUrl;
      a.download = filename;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return { success: true, filename };
    }

    return { success: false, error: 'Audio source not found' };
  } catch (err: any) {
    return { success: false, error: err.message || 'Download failed' };
  }
}

/**
 * Share TTS memo
 */
export async function shareTtsMemo(memo: TtsMemo): Promise<{ success: boolean; method: string }> {
  const shareUrl = memo.driveWebViewLink || memo.audioUrl || window.location.href;
  const shareText = `🔊 "${memo.title}" (${memo.voiceType.toUpperCase()} voice)\n"${memo.textPrompt}"\nGenerated via Auro Family Assistant`;

  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({
        title: memo.title,
        text: shareText,
        url: shareUrl,
      });
      return { success: true, method: 'native' };
    } catch (err: any) {
      if (err.name === 'AbortError') return { success: false, method: 'cancelled' };
    }
  }

  // Fallback to clipboard
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
      return { success: true, method: 'clipboard' };
    }
  } catch {}

  return { success: false, method: 'none' };
}

function triggerBrowserDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
