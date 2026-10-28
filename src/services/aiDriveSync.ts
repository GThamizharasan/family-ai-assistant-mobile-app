// Sovereign AI Studio Drive Sync & Creations History Service
// Keeps generated images, videos, music songs, and transcripts in the "Family Circle / AI Studio Creations" Google Drive path and maintains local persistent history.

import { AiStudioCreation, AiCreationType } from '../types/aiCreation';
import { getOrCreateGoogleDriveFolder } from './googleWorkspace';
import { getApiUrl, safeFetchJson } from './api';

const LOCAL_STORAGE_KEY = 'aura_ai_creations_history';

/**
 * Register a newly generated AI output, automatically saving to SQLite and syncing into Google Drive "Family Circle" path.
 */
export async function registerAiCreation(
  item: Omit<AiStudioCreation, 'id' | 'createdAt'> & { id?: string; createdAt?: string },
  accessToken?: string | null,
  userEmail = 'chinna.tamil2000@gmail.com'
): Promise<AiStudioCreation> {
  const id = item.id || `aic-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const createdAt = item.createdAt || new Date().toISOString();

  let folderCategory = 'Images';
  if (item.type === 'video') folderCategory = 'Videos';
  else if (item.type === 'music') folderCategory = 'Music';
  else if (item.type === 'transcript' || item.type === 'transcription') folderCategory = 'Transcripts';

  const driveFolderPath = item.driveFolderPath || item.drivePath || `Family Circle / AI Studio Creations / ${folderCategory}`;

  const creation: AiStudioCreation = {
    ...item,
    modelUsed: item.modelUsed || item.model || 'gemini-frontier',
    id,
    createdAt,
    userEmail,
    driveFolderPath,
    driveSyncStatus: accessToken ? 'pending' : 'local_only',
  };

  // 1. Immediately store in local cache
  try {
    const existing = getLocalAiCreations();
    const updated = [creation, ...existing.filter((c) => c.id !== id)];
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated.slice(0, 100)));
  } catch (err) {
    console.warn('[AI Drive Sync] LocalStorage write notice:', err);
  }

  // 2. Save to Server SQLite backend
  try {
    await fetch(getApiUrl('/api/ai/creations'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(creation),
    });
  } catch (err) {
    console.warn('[AI Drive Sync] Server SQLite post notice:', err);
  }

  // 3. If Google Drive access token is active, initiate live Drive upload in background
  if (accessToken && accessToken.trim()) {
    try {
      const driveMeta = await uploadAiCreationToGoogleDrive(creation, accessToken, userEmail);
      if (driveMeta) {
        creation.driveFileId = driveMeta.driveFileId;
        creation.driveWebViewLink = driveMeta.driveWebViewLink;
        creation.driveSyncStatus = 'synced';

        // Update local & backend with drive links
        updateLocalCreation(creation);
        await fetch(getApiUrl('/api/ai/creations'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(creation),
        }).catch(() => {});
      }
    } catch (dErr) {
      console.warn('[AI Drive Sync] Google Drive upload error:', dErr);
      creation.driveSyncStatus = 'error';
      updateLocalCreation(creation);
    }
  }

  return creation;
}

/**
 * Upload an AI Studio creation file directly into Google Drive under:
 * Family Circle / AI Studio Creations / {Images | Videos | Music | Transcripts}
 */
export async function uploadAiCreationToGoogleDrive(
  creation: AiStudioCreation,
  accessToken: string,
  userEmail = 'chinna.tamil2000@gmail.com'
): Promise<{ driveFileId: string; driveWebViewLink: string } | null> {
  if (!accessToken || !accessToken.trim()) return null;

  try {
    // 1. Ensure folder tree in Google Drive
    const rootFolder = await getOrCreateGoogleDriveFolder(accessToken, 'Family Circle');
    const creationsFolder = await getOrCreateGoogleDriveFolder(accessToken, 'AI Studio Creations', rootFolder.id);

    let subfolderName = 'Images';
    if (creation.type === 'video') subfolderName = 'Videos';
    else if (creation.type === 'music') subfolderName = 'Music';
    else if (creation.type === 'transcript') subfolderName = 'Transcripts';

    const typeFolder = await getOrCreateGoogleDriveFolder(accessToken, subfolderName, creationsFolder.id);

    // 2. Convert media URL to Blob
    let fileBlob: Blob;
    let fileName = `${creation.title.replace(/[^a-zA-Z0-9_\- ]/g, '').trim() || 'AI_Creation'}`;

    if (creation.mediaUrl.startsWith('data:')) {
      const parts = creation.mediaUrl.split(',');
      const mime = parts[0].match(/:(.*?);/)?.[1] || creation.mimeType;
      const binaryStr = atob(parts[1]);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      fileBlob = new Blob([bytes], { type: mime });
    } else if (creation.type === 'transcript' || creation.type === 'transcription') {
      fileBlob = new Blob([creation.contentPreview || creation.mediaUrl || creation.prompt || ''], { type: 'text/plain;charset=utf-8' });
      fileName += '.txt';
    } else {
      // Fetch the media URL (blob URL or external resource)
      try {
        const res = await fetch(creation.mediaUrl || '');
        fileBlob = await res.blob();
      } catch {
        fileBlob = new Blob([creation.prompt], { type: 'text/plain' });
      }
    }

    if (creation.type === 'video' && !fileName.endsWith('.mp4')) fileName += '.mp4';
    if (creation.type === 'image' && !fileName.match(/\.(png|jpg|jpeg|webp)$/i)) fileName += '.png';
    if (creation.type === 'music' && !fileName.match(/\.(mp3|wav|ogg)$/i)) fileName += '.mp3';

    // 3. Multipart Upload to Drive API v3
    const boundary = `-------AiDriveBoundary${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
    const metadata = {
      name: fileName,
      mimeType: fileBlob.type || creation.mimeType,
      parents: [typeFolder.id],
      description: `AI Studio Generation [${creation.type.toUpperCase()}] Model: ${creation.modelUsed}\nPrompt: ${creation.prompt}`,
    };

    const bodyBlob = new Blob(
      [
        `--${boundary}\r\n`,
        'Content-Type: application/json; charset=UTF-8\r\n\r\n',
        JSON.stringify(metadata),
        `\r\n--${boundary}\r\n`,
        `Content-Type: ${fileBlob.type || creation.mimeType}\r\n\r\n`,
        fileBlob,
        `\r\n--${boundary}--`,
      ],
      { type: `multipart/related; boundary=${boundary}` }
    );

    const driveRes = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,size',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: bodyBlob,
      }
    );

    if (!driveRes.ok) {
      const errText = await driveRes.text();
      throw new Error(`Drive upload error (${driveRes.status}): ${errText}`);
    }

    const driveFile = await driveRes.json();

    // 4. Mirror to server SQLite google_drive_files table
    try {
      await fetch(getApiUrl('/api/google/drive/upload'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: driveFile.id,
          userEmail,
          name: fileName,
          mimeType: fileBlob.type || creation.mimeType,
          size: `${(fileBlob.size / (1024 * 1024)).toFixed(1)} MB`,
          sizeBytes: fileBlob.size,
          webViewLink: driveFile.webViewLink,
          folderId: typeFolder.id,
          folderName: `Family Circle / AI Studio Creations / ${subfolderName}`,
          category: `AI Studio ${subfolderName}`,
          uploadedBy: 'ai_studio',
        }),
      });
    } catch {}

    return {
      driveFileId: driveFile.id,
      driveWebViewLink: driveFile.webViewLink,
    };
  } catch (err) {
    console.error('uploadAiCreationToGoogleDrive failed:', err);
    throw err;
  }
}

/**
 * Fetch all AI Studio Creations from Backend & Local Storage.
 */
export async function fetchAiCreationsHistory(
  userEmail = 'chinna.tamil2000@gmail.com',
  typeFilter?: string
): Promise<AiStudioCreation[]> {
  try {
    const url = getApiUrl(`/api/ai/creations?userEmail=${encodeURIComponent(userEmail)}${typeFilter ? `&type=${typeFilter}` : ''}`);
    const data = await safeFetchJson<{ success: boolean; creations: AiStudioCreation[] }>(url);
    if (data?.success && Array.isArray(data.creations)) {
      // Merge with local storage to capture any un-synced creations
      const local = getLocalAiCreations();
      const existingIds = new Set(data.creations.map((c) => c.id));
      const missingLocal = local.filter((l) => !existingIds.has(l.id));
      const combined = [...data.creations, ...missingLocal].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(combined.slice(0, 100)));
      return combined;
    }
  } catch (err) {
    console.warn('[AI Drive Sync] Fetch backend creations error, using local:', err);
  }

  // Fallback to local storage
  const local = getLocalAiCreations();
  if (typeFilter && typeFilter !== 'all') {
    return local.filter((c) => c.type === typeFilter);
  }
  return local;
}

/**
 * Delete a creation from history and backend
 */
export async function deleteAiCreation(id: string, userEmail = 'chinna.tamil2000@gmail.com'): Promise<boolean> {
  try {
    // Delete local
    const local = getLocalAiCreations().filter((c) => c.id !== id);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(local));

    // Delete backend
    await fetch(getApiUrl(`/api/ai/creations/${id}?userEmail=${encodeURIComponent(userEmail)}`), {
      method: 'DELETE',
    });
    return true;
  } catch (err) {
    console.warn('deleteAiCreation error:', err);
    return false;
  }
}

/**
 * Trigger file download for a creation
 */
export function downloadCreationFile(creation: AiStudioCreation) {
  const a = document.createElement('a');
  a.href = creation.mediaUrl || `data:text/plain;charset=utf-8,${encodeURIComponent(creation.prompt)}`;
  let ext = 'png';
  if (creation.type === 'video') ext = 'mp4';
  else if (creation.type === 'music') ext = 'mp3';
  else if (creation.type === 'transcript') ext = 'txt';

  a.download = `${creation.title.replace(/[^a-zA-Z0-9_\- ]/g, '').trim() || 'Creation'}.${ext}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// Helpers
function getLocalAiCreations(): AiStudioCreation[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function updateLocalCreation(updated: AiStudioCreation) {
  try {
    const list = getLocalAiCreations();
    const index = list.findIndex((c) => c.id === updated.id);
    if (index >= 0) {
      list[index] = updated;
    } else {
      list.unshift(updated);
    }
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
  } catch {}
}
