// Sovereign Voice Recording & Google Drive Synchronization Engine
// Integrates Voice Memos directly into "Family Circle / Voice Recordings" folder in Google Drive.
// Features real-time multipart upload, SQLite local mirroring, streaming audio playback,
// external sharing, device downloading, and Gemini speech-to-text transcription.

import { VoiceRecording, TranscriptionResult, RecordingCategory } from '../types/voiceRecording';
import { getOrCreateGoogleDriveFolder } from './googleWorkspace';
import { getApiUrl } from './api';
import { saveAudioToStorage, getAudioFromStorage, hasLocalAudioContent } from '../utils/audioStorage';

const LOCAL_STORAGE_KEY = 'aura_voice_recordings_cache_v1';
const DRIVE_FOLDER_NAME = 'Voice Recordings';

export const VOICE_RECORDING_CATEGORIES: RecordingCategory[] = [
  'Personal Memo',
  'Family Note',
  'Meeting & Work',
  'Idea & Inspiration',
  'Medical & Wellness',
  'Tamil Thoughts',
  'Daily Journal',
];

/**
 * Retrieve cached local voice recordings
 */
export function getLocalVoiceRecordings(): VoiceRecording[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.warn('Failed to parse local voice recordings:', err);
    return [];
  }
}

/**
 * Persist cached voice recordings to localStorage
 */
export function saveLocalVoiceRecordings(recordings: VoiceRecording[]) {
  if (typeof window === 'undefined') return;
  try {
    // Avoid saving large Base64 blobs directly in localStorage to prevent 5MB quota errors
    const sanitized = recordings.map((r) => {
      if (r.audioContentBase64 && r.audioContentBase64.length > 200000) {
        return { ...r, audioContentBase64: undefined };
      }
      return r;
    });
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(sanitized));
  } catch (err) {
    console.warn('Failed to save voice recordings to localStorage:', err);
  }
}

/**
 * Fetch all voice recordings (merging SQLite database, Google Drive, and local cache)
 */
export async function fetchVoiceRecordings(
  googleAccessToken?: string | null,
  userEmail?: string
): Promise<VoiceRecording[]> {
  const map = new Map<string, VoiceRecording>();

  // 1. Load local cache first
  const localList = getLocalVoiceRecordings();
  localList.forEach((r) => map.set(r.id, r));

  // 2. Fetch from server SQLite database
  try {
    const emailParam = encodeURIComponent(userEmail || 'chinna.tamil2000@gmail.com');
    const res = await fetch(getApiUrl(`/api/voice-recordings?userEmail=${emailParam}`));
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.recordings)) {
        for (const item of data.recordings) {
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
    console.warn('Failed to fetch voice recordings from server SQLite:', err);
  }

  // 3. If Google Drive access token is available, check for files in "Family Circle/Voice Recordings"
  if (googleAccessToken) {
    try {
      const familyCircleFolder = await getOrCreateGoogleDriveFolder(googleAccessToken, 'Family Circle');
      const voiceFolder = await getOrCreateGoogleDriveFolder(
        googleAccessToken,
        DRIVE_FOLDER_NAME,
        familyCircleFolder.id
      );

      const q = `'${voiceFolder.id}' in parents and trashed = false and mimeType != 'application/vnd.google-apps.folder'`;
      const driveRes = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType,size,webViewLink,createdTime,description)&pageSize=50&orderBy=createdTime desc`,
        { headers: { Authorization: `Bearer ${googleAccessToken}` } }
      );

      if (driveRes.ok) {
        const driveData = await driveRes.json();
        const driveFiles = driveData.files || [];

        for (const df of driveFiles) {
          const match = Array.from(map.values()).find(
            (r) =>
              r.driveFileId === df.id ||
              r.id === df.id ||
              r.id === `drive_${df.id}` ||
              (r.id.startsWith('drive_') && r.id.replace(/^drive_/, '') === df.id) ||
              r.title.toLowerCase() === df.name.replace(/\.[a-zA-Z0-9]+$/, '').toLowerCase()
          );

          if (match) {
            match.driveFileId = df.id;
            match.driveWebViewLink = df.webViewLink;
            match.driveSyncStatus = 'synced';
          } else {
            // New voice recording found on Google Drive
            const newRec: VoiceRecording = {
              id: `drive_${df.id}`,
              userEmail: userEmail || 'chinna.tamil2000@gmail.com',
              title: df.name.replace(/\.[a-zA-Z0-9]+$/, ''),
              category: 'Personal Memo',
              audioUrl: `https://drive.google.com/uc?export=download&id=${df.id}`,
              audioMimeType: df.mimeType || 'audio/webm',
              durationSeconds: 60,
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
            map.set(newRec.id, newRec);

            // Background pre-cache audio binary directly from Google Drive into Client SQLite (IndexedDB)
            if (googleAccessToken && df.id) {
              fetch(`https://www.googleapis.com/drive/v3/files/${df.id}?alt=media`, {
                headers: { Authorization: `Bearer ${googleAccessToken}` },
              })
                .then((r) => (r.ok ? r.arrayBuffer() : null))
                .then(async (ab) => {
                  if (ab && ab.byteLength > 100) {
                    let binary = '';
                    const bytes = new Uint8Array(ab);
                    const len = bytes.byteLength;
                    const chunkSize = 8192;
                    for (let i = 0; i < len; i += chunkSize) {
                      const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
                      binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
                    }
                    const b64 = btoa(binary);
                    await saveAudioToStorage(newRec.id, b64, df.mimeType || 'audio/webm');
                  }
                })
                .catch(() => {});
            }
          }
        }
      }
    } catch (dErr) {
      console.warn('Google Drive voice recording scan failed:', dErr);
    }
  }

  const combined = Array.from(map.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  saveLocalVoiceRecordings(combined);
  return combined;
}

/**
 * Upload voice recording audio directly to Google Drive under "Family Circle / Voice Recordings"
 */
export async function uploadVoiceRecordingToDrive(
  accessToken: string,
  recording: VoiceRecording,
  audioBlob: Blob
): Promise<{ driveFileId: string; webViewLink: string; folderId: string }> {
  // 1. Get or create "Family Circle" root folder
  const familyCircleFolder = await getOrCreateGoogleDriveFolder(accessToken, 'Family Circle');

  // 2. Get or create "Voice Recordings" subfolder
  const voiceFolder = await getOrCreateGoogleDriveFolder(
    accessToken,
    DRIVE_FOLDER_NAME,
    familyCircleFolder.id
  );

  // Clean filename
  const cleanTitle = (recording.title || 'Voice Memo').replace(/[/\\?%*:|"<>]/g, '_').trim();
  const ext = recording.audioMimeType.includes('mpeg') || recording.audioMimeType.includes('mp3')
    ? 'mp3'
    : recording.audioMimeType.includes('wav')
    ? 'wav'
    : recording.audioMimeType.includes('m4a')
    ? 'm4a'
    : 'webm';
  const fileName = `${cleanTitle}.${ext}`;

  // 3. Perform multipart upload
  const metadata = {
    name: fileName,
    mimeType: recording.audioMimeType || 'audio/webm',
    parents: [voiceFolder.id],
    description: `Auro Voice Memo • Category: ${recording.category} • Duration: ${Math.round(recording.durationSeconds)}s`,
  };

  const boundary = `-------AuroVoiceBoundary${Date.now()}`;
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const audioBytes = new Uint8Array(await audioBlob.arrayBuffer());

  const metadataPart = `${delimiter}Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`;
  const mediaPartHeader = `${delimiter}Content-Type: ${recording.audioMimeType || 'audio/webm'}\r\nContent-Transfer-Encoding: binary\r\n\r\n`;

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
    folderId: voiceFolder.id,
  };
}

/**
 * Save new voice recording to SQLite, Google Drive, and local cache
 */
export async function saveVoiceRecording(
  recording: VoiceRecording,
  audioBlob?: Blob,
  googleAccessToken?: string | null
): Promise<VoiceRecording> {
  let updatedRec = { ...recording };

  // 1. If audioBlob provided and Base64 not yet generated, convert to Base64
  if (audioBlob && !updatedRec.audioContentBase64) {
    const arrayBuffer = await audioBlob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    updatedRec.audioContentBase64 = btoa(binary);
    updatedRec.fileSizeBytes = arrayBuffer.byteLength;
  }

  // 1.5 Save audio binary directly into Client SQLite & IndexedDB store
  if (updatedRec.audioContentBase64 || audioBlob) {
    try {
      await saveAudioToStorage(
        updatedRec.id,
        updatedRec.audioContentBase64 || audioBlob!,
        updatedRec.audioMimeType || 'audio/webm'
      );
    } catch (idbErr) {
      console.warn('[VoiceRecording] IndexedDB client save notice:', idbErr);
    }
  }

  // 2. Upload to Google Drive if access token is available
  if (googleAccessToken && audioBlob) {
    try {
      const driveInfo = await uploadVoiceRecordingToDrive(googleAccessToken, updatedRec, audioBlob);
      updatedRec.driveFileId = driveInfo.driveFileId;
      updatedRec.driveWebViewLink = driveInfo.webViewLink;
      updatedRec.driveSyncStatus = 'synced';
    } catch (driveErr) {
      console.warn('Drive upload error (saved locally):', driveErr);
      updatedRec.driveSyncStatus = 'local_only';
    }
  }

  // 3. Save to server SQLite
  try {
    const res = await fetch(getApiUrl('/api/voice-recordings'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedRec),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.recording) {
        updatedRec = { ...updatedRec, ...data.recording };
      }
    }
  } catch (sqlErr) {
    console.warn('Failed to save voice recording to SQLite:', sqlErr);
  }

  // 4. Update local cache
  const list = getLocalVoiceRecordings().filter((r) => r.id !== updatedRec.id);
  list.unshift(updatedRec);
  saveLocalVoiceRecordings(list);

  return updatedRec;
}

/**
 * Transcribe a voice recording using Gemini AI Speech-To-Text
 */
export async function transcribeVoiceRecording(
  recording: VoiceRecording,
  prompt?: string,
  googleAccessToken?: string | null
): Promise<TranscriptionResult> {
  const token =
    googleAccessToken ||
    (typeof localStorage !== 'undefined'
      ? localStorage.getItem('aura_google_access_token') ||
        localStorage.getItem('google_access_token')
      : null) ||
    '';

  const driveId =
    recording.driveFileId ||
    (recording.id.startsWith('drive_') ? recording.id.replace(/^drive_/, '') : '');

  const payload: any = {
    prompt,
    accessToken: token,
    driveFileId: driveId,
    title: recording.title,
    category: recording.category,
    durationSeconds: recording.durationSeconds,
    userEmail: recording.userEmail,
    driveWebViewLink: recording.driveWebViewLink,
  };

  if (recording.audioContentBase64) {
    payload.audioBase64 = recording.audioContentBase64;
    payload.mimeType = recording.audioMimeType;
  } else if (driveId && token) {
    // Attempt client-side direct fetch of audio blob from Google Drive API
    try {
      const driveRes = await fetch(`https://www.googleapis.com/drive/v3/files/${driveId}?alt=media`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (driveRes.ok) {
        const arrayBuf = await driveRes.arrayBuffer();
        const bytes = new Uint8Array(arrayBuf);
        let bin = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          bin += String.fromCharCode(bytes[i]);
        }
        const b64 = btoa(bin);
        payload.audioBase64 = b64;
        payload.mimeType = driveRes.headers.get('content-type') || recording.audioMimeType || 'audio/webm';
        recording.audioContentBase64 = b64;
      }
    } catch (e) {
      console.warn('Client-side Drive audio fetch for transcription fallback to backend:', e);
    }
  }

  const tokenParam = token ? `?accessToken=${encodeURIComponent(token)}` : '';
  const driveParam = driveId ? `${tokenParam ? '&' : '?'}driveFileId=${encodeURIComponent(driveId)}` : '';

  const res = await fetch(getApiUrl(`/api/voice-recordings/${recording.id}/transcribe${tokenParam}${driveParam}`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Transcription failed (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const result: TranscriptionResult = {
    transcription: data.transcription || '',
    summary: data.summary || '',
    keyPoints: data.keyPoints || [],
    actionItems: data.actionItems || [],
    detectedLanguage: data.detectedLanguage || 'en-US',
    modelUsed: data.modelUsed,
  };

  // Update local cache
  const list = getLocalVoiceRecordings();
  const item = list.find((r) => r.id === recording.id);
  if (item) {
    item.transcription = result.transcription;
    item.transcriptionSummary = result.summary;
    item.detectedLanguage = result.detectedLanguage;
    saveLocalVoiceRecordings(list);
  }

  return result;
}

/**
 * Toggle favorite on voice recording
 */
export async function toggleRecordingFavorite(id: string, isFavorite: boolean): Promise<boolean> {
  const list = getLocalVoiceRecordings();
  const item = list.find((r) => r.id === id);
  if (item) {
    item.isFavorite = isFavorite;
    saveLocalVoiceRecordings(list);
  }

  try {
    await fetch(getApiUrl(`/api/voice-recordings/${id}/favorite`), {
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
 * Delete voice recording from SQLite and local cache
 */
export async function deleteVoiceRecording(id: string, userEmail?: string): Promise<boolean> {
  const list = getLocalVoiceRecordings().filter((r) => r.id !== id);
  saveLocalVoiceRecordings(list);

  try {
    const emailParam = userEmail ? `?userEmail=${encodeURIComponent(userEmail)}` : '';
    await fetch(getApiUrl(`/api/voice-recordings/${id}${emailParam}`), {
      method: 'DELETE',
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Download voice recording audio file directly to device (WAV/MP3/WebM)
 */
export async function downloadVoiceRecordingFile(
  recording: VoiceRecording,
  googleAccessToken?: string | null
): Promise<{ success: boolean; filename?: string; error?: string }> {
  try {
    const safeTitle = (recording.title || 'Voice Memo').replace(/[/\\?%*:|"<>]/g, '_').trim();
    const ext = recording.audioMimeType.includes('mpeg') || recording.audioMimeType.includes('mp3')
      ? 'mp3'
      : recording.audioMimeType.includes('wav')
      ? 'wav'
      : recording.audioMimeType.includes('m4a')
      ? 'm4a'
      : 'webm';
    const filename = `${safeTitle}.${ext}`;

    // 1. Direct Base64 audio content stored in object
    if (recording.audioContentBase64 && recording.audioContentBase64.length > 20) {
      const mime = recording.audioMimeType || 'audio/webm';
      const byteChars = atob(recording.audioContentBase64);
      const byteNumbers = new Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) {
        byteNumbers[i] = byteChars.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: mime });
      triggerBrowserDownload(blob, filename);
      return { success: true, filename };
    }

    // 2. Fetch from server SQLite streaming endpoint
    const token =
      googleAccessToken ||
      (typeof localStorage !== 'undefined' &&
        (localStorage.getItem('aura_google_access_token') ||
          localStorage.getItem('google_access_token'))) ||
      '';
    const tokenParam = token ? `?accessToken=${encodeURIComponent(token)}` : '';
    const serverUrl = getApiUrl(`/api/voice-recordings/${recording.id}/audio${tokenParam}`);

    try {
      const res = await fetch(serverUrl);
      if (res.ok) {
        const blob = await res.blob();
        if (blob.size > 50) {
          triggerBrowserDownload(blob, filename);
          return { success: true, filename };
        }
      }
    } catch (e) {
      console.warn('Server voice audio endpoint error, falling back:', e);
    }

    // 3. Fallback: Google Drive download
    if (recording.driveFileId) {
      const driveDownloadUrl = `https://drive.google.com/uc?export=download&id=${recording.driveFileId}`;
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

    // 4. Fallback link
    const fallbackUrl = recording.driveWebViewLink || recording.audioUrl;
    if (fallbackUrl) {
      window.open(fallbackUrl, '_blank');
      return { success: true, filename };
    }

    return { success: false, error: 'No audio source found to download.' };
  } catch (err: any) {
    console.error('downloadVoiceRecordingFile error:', err);
    return { success: false, error: err.message || 'Download failed.' };
  }
}

/**
 * Share voice recording via native share API or fallback
 */
export async function shareVoiceRecording(recording: VoiceRecording): Promise<{ success: boolean; method: string }> {
  const shareUrl = recording.driveWebViewLink || recording.audioUrl || window.location.href;
  const shareText = `🎙️ "${recording.title}" • Auro Voice Memo\nCategory: ${recording.category}\n${
    recording.transcriptionSummary ? `Summary: ${recording.transcriptionSummary}\n` : ''
  }`;

  const shareData = {
    title: recording.title,
    text: shareText,
    url: shareUrl,
  };

  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share(shareData);
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

  if (shareUrl && shareUrl !== window.location.href) {
    window.open(shareUrl, '_blank');
    return { success: true, method: 'url' };
  }

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
