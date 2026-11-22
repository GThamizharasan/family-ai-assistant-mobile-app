// Centralized Family Media Library Service
// Architecture:
// - Master 1 TB Cloud Storage: Google Drive -> "Family Circle / Media Library Vault / <nested folders>"
// - Lightweight SQLite Index: Stores ONLY file names, Drive IDs, metadata, tags, AI captions, thumbnails, & audit logs
// - On-Demand Local SQLite Storage: Per-file toggle downloads & persists specific binaries in SQLite for offline viewing

import {
  MediaAnalyticsSummary,
  MediaAssetType,
  MediaCollectionItem,
  MediaFolderItem,
  MediaLibraryItem,
  MediaShareConfig,
} from '../types/mediaLibrary';
import { getActiveAiModel, getActiveAiProvider } from './aiConfig';
import { getApiUrl } from './api';
import { getOrCreateGoogleDriveFolder } from './googleWorkspace';
import { getEffectiveGoogleToken } from './visualTopicStorageService';

export const DRIVE_MEDIA_ROOT_FOLDER = 'Media Library Vault';
const CHUNK_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB chunks (multiple of 256 KiB required by Google Drive Resumable API)
const LOCAL_INDEX_CACHE_KEY = 'aura_media_library_cache_v1';

export function classifyMediaAssetType(mimeType: string, fileName: string): MediaAssetType {
  const m = (mimeType || '').toLowerCase();
  const n = (fileName || '').toLowerCase();
  if (m.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|svg|heic|avif)$/i.test(n)) {
    return /ai[_-]|generated|midjourney|dalle|imagen|flux/i.test(n) ? 'ai_generated' : 'image';
  }
  if (m.startsWith('video/') || /\.(mp4|mov|webm|mkv|avi|m4v)$/i.test(n)) return 'video';
  if (m.startsWith('audio/') || /\.(mp3|wav|m4a|ogg|flac|aac|opus)$/i.test(n)) return 'audio';
  if (m === 'application/pdf' || n.endsWith('.pdf')) return 'pdf';
  return 'document';
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const val = bytes / Math.pow(1024, i);
  return `${val >= 100 || i === 0 ? Math.round(val) : val.toFixed(1)} ${units[i]}`;
}

export function detectDeviceSource(): string {
  if (typeof navigator === 'undefined') return 'Web';
  const ua = navigator.userAgent || '';
  if (/android/i.test(ua)) return 'Android Mobile';
  if (/iphone|ipad|ipod/i.test(ua)) return 'iOS Mobile';
  if (/windows/i.test(ua)) return 'Windows Desktop';
  if (/macintosh/i.test(ua)) return 'macOS Desktop';
  return 'Web Browser';
}

export function validateMediaFile(file: File): { valid: boolean; reason?: string } {
  if (!file || !file.name) return { valid: false, reason: 'Invalid file' };
  if (file.size === 0) return { valid: false, reason: 'File is empty (0 bytes)' };
  if (/\.(exe|bat|cmd|scr|msi|com|pif)$/i.test(file.name)) {
    return { valid: false, reason: 'Executable files are blocked for family safety.' };
  }
  return { valid: true };
}

export async function computeFileSha256(file: File): Promise<string> {
  try {
    // For huge files (>120 MB), hash first 4MB + last 4MB + size + name so browser stays snappy
    let buf: ArrayBuffer;
    if (file.size > 120 * 1024 * 1024) {
      const head = await file.slice(0, 4 * 1024 * 1024).arrayBuffer();
      const tail = await file.slice(file.size - 4 * 1024 * 1024).arrayBuffer();
      const meta = new TextEncoder().encode(`|${file.size}|${file.name}`);
      const combined = new Uint8Array(head.byteLength + tail.byteLength + meta.byteLength);
      combined.set(new Uint8Array(head), 0);
      combined.set(new Uint8Array(tail), head.byteLength);
      combined.set(meta, head.byteLength + tail.byteLength);
      buf = combined.buffer;
    } else {
      buf = await file.arrayBuffer();
    }
    const digest = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    return `fallback-${file.name}-${file.size}-${file.lastModified}`;
  }
}

export async function generateClientThumbnail(file: File, mediaType: MediaAssetType): Promise<string | undefined> {
  if (typeof document === 'undefined') return undefined;
  if (mediaType === 'image' || mediaType === 'ai_generated') {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        try {
          const maxDim = 320;
          const scale = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(img.width * scale));
          canvas.height = Math.max(1, Math.round(img.height * scale));
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.72));
        } catch {
          resolve(undefined);
        } finally {
          URL.revokeObjectURL(url);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(undefined);
      };
      img.src = url;
    });
  }
  if (mediaType === 'video') {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.preload = 'metadata';
      const cleanup = () => URL.revokeObjectURL(url);
      const timer = setTimeout(() => {
        cleanup();
        resolve(undefined);
      }, 4500);
      video.onloadeddata = () => {
        try {
          video.currentTime = Math.min(1, (video.duration || 1) / 3);
        } catch {
          clearTimeout(timer);
          cleanup();
          resolve(undefined);
        }
      };
      video.onseeked = () => {
        clearTimeout(timer);
        try {
          const canvas = document.createElement('canvas');
          const scale = Math.min(1, 320 / Math.max(video.videoWidth || 320, video.videoHeight || 180));
          canvas.width = Math.max(1, Math.round((video.videoWidth || 320) * scale));
          canvas.height = Math.max(1, Math.round((video.videoHeight || 180) * scale));
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.72));
        } catch {
          resolve(undefined);
        } finally {
          cleanup();
        }
      };
      video.onerror = () => {
        clearTimeout(timer);
        cleanup();
        resolve(undefined);
      };
      video.src = url;
    });
  }
  return undefined;
}

export async function fileToBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to encode file'));
    reader.onload = () => {
      const s = typeof reader.result === 'string' ? reader.result : '';
      resolve(s.replace(/^data:[^;]+;base64,/, ''));
    };
    reader.readAsDataURL(file);
  });
}

// Resolve/create nested folder hierarchy inside "Family Circle / Media Library Vault"
export async function ensureDriveFolderPath(
  folderPath: string,
  token: string,
  userEmail?: string
): Promise<{ folderId: string; cleanPath: string }> {
  const familyRoot = await getOrCreateGoogleDriveFolder(token, 'Family Circle');
  const mediaRoot = await getOrCreateGoogleDriveFolder(token, DRIVE_MEDIA_ROOT_FOLDER, familyRoot.id);

  const cleanPath = folderPath && folderPath !== '/' ? `/${folderPath.replace(/^\/+|\/+$/g, '')}` : '/';
  if (cleanPath === '/') {
    return { folderId: mediaRoot.id, cleanPath: '/' };
  }

  const segments = cleanPath.split('/').filter(Boolean);
  let parentId = mediaRoot.id;
  let runningPath = '';
  for (const seg of segments) {
    const prevPath = runningPath || '/';
    runningPath = `${runningPath}/${seg}`;
    const folder = await getOrCreateGoogleDriveFolder(token, seg, parentId);
    parentId = folder.id;
    // Register folder in SQLite
    fetch(getApiUrl('/api/media-library/folders'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userEmail,
        path: runningPath,
        name: seg,
        parentPath: prevPath,
        driveFolderId: folder.id,
      }),
    }).catch(() => {});
  }
  return { folderId: parentId, cleanPath };
}

// Resumable chunked upload to Google Drive v3 with progress, pause/resume & retry
export async function uploadFileResumableToDrive(params: {
  file: File;
  folderPath: string;
  token: string;
  userEmail?: string;
  existingSessionUri?: string;
  startByte?: number;
  onProgress?: (percent: number, uploadedBytes: number, sessionUri: string) => void;
  shouldAbort?: () => boolean;
}): Promise<{
  driveFileId: string;
  driveFolderId: string;
  driveWebViewLink: string;
  driveDownloadUrl: string;
}> {
  const { file, folderPath, token, userEmail, onProgress, shouldAbort } = params;
  const { folderId } = await ensureDriveFolderPath(folderPath, token, userEmail);

  let sessionUri = params.existingSessionUri || '';
  let offset = params.startByte || 0;

  if (!sessionUri) {
    const initRes = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true&fields=id,name,webViewLink,webContentLink,size,mimeType',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json; charset=UTF-8',
          'X-Upload-Content-Type': file.type || 'application/octet-stream',
          'X-Upload-Content-Length': String(file.size),
        },
        body: JSON.stringify({
          name: file.name,
          mimeType: file.type || 'application/octet-stream',
          parents: [folderId],
        }),
      }
    );
    if (!initRes.ok) {
      const errTxt = await initRes.text().catch(() => '');
      throw new Error(`Drive resumable init failed (${initRes.status}): ${errTxt.slice(0, 120)}`);
    }
    sessionUri = initRes.headers.get('Location') || '';
    if (!sessionUri) throw new Error('Google Drive did not return a resumable upload session URI.');
  }

  let uploadedMeta: any = null;
  const total = file.size;

  while (offset < total) {
    if (shouldAbort && shouldAbort()) {
      const pausedErr: any = new Error('PAUSED');
      pausedErr.sessionUri = sessionUri;
      pausedErr.uploadedBytes = offset;
      throw pausedErr;
    }

    const end = Math.min(offset + CHUNK_SIZE_BYTES, total);
    const chunk = file.slice(offset, end);
    const contentRange = `bytes ${offset}-${end - 1}/${total}`;

    const putRes = await fetch(sessionUri, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
        'Content-Range': contentRange,
      },
      body: chunk,
    });

    if (putRes.status === 308) {
      // Resume Incomplete -> advance offset
      const rangeHeader = putRes.headers.get('Range');
      if (rangeHeader) {
        const match = rangeHeader.match(/bytes=0-(\d+)/);
        if (match) offset = Number(match[1]) + 1;
        else offset = end;
      } else {
        offset = end;
      }
      onProgress?.(Math.min(99, Math.round((offset / total) * 100)), offset, sessionUri);
    } else if (putRes.status === 200 || putRes.status === 201) {
      uploadedMeta = await putRes.json();
      offset = total;
      onProgress?.(100, total, sessionUri);
      break;
    } else {
      const errTxt = await putRes.text().catch(() => '');
      const failErr: any = new Error(`Chunk upload error (${putRes.status}): ${errTxt.slice(0, 120)}`);
      failErr.sessionUri = sessionUri;
      failErr.uploadedBytes = offset;
      throw failErr;
    }
  }

  const fileId = uploadedMeta?.id;
  if (!fileId) throw new Error('Google Drive upload completed without file ID.');

  return {
    driveFileId: fileId,
    driveFolderId: folderId,
    driveWebViewLink: uploadedMeta.webViewLink || `https://drive.google.com/file/d/${fileId}/view`,
    driveDownloadUrl: uploadedMeta.webContentLink || `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
  };
}

// Recursive Metadata-Only Sync from Google Drive ("Family Circle / Media Library Vault") -> Local SQLite
export async function syncDriveMediaLibraryToSqlite(
  googleAccessToken?: string | null,
  userEmail?: string,
  ownerName = 'Family'
): Promise<{ syncedCount: number; folderCount: number; needsSignIn?: boolean }> {
  const token = getEffectiveGoogleToken(googleAccessToken);
  if (!token) return { syncedCount: 0, folderCount: 0, needsSignIn: true };

  const familyRoot = await getOrCreateGoogleDriveFolder(token, 'Family Circle');
  const mediaRoot = await getOrCreateGoogleDriveFolder(token, DRIVE_MEDIA_ROOT_FOLDER, familyRoot.id);

  const collectedItems: any[] = [];
  const collectedFolders: any[] = [];
  const queue: Array<{ folderId: string; folderPath: string }> = [{ folderId: mediaRoot.id, folderPath: '/' }];

  while (queue.length > 0) {
    const current = queue.shift()!;
    let pageToken: string | undefined = undefined;

    do {
      const q = `'${current.folderId}' in parents and trashed = false`;
      const url: string =
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}` +
        `&supportsAllDrives=true&includeItemsFromAllDrives=true&pageSize=100` +
        `&fields=nextPageToken,files(id,name,mimeType,size,modifiedTime,createdTime,webViewLink,webContentLink,thumbnailLink)` +
        (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '');

      const res: Response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) break;
      const data: any = await res.json();
      const files = Array.isArray(data.files) ? data.files : [];

      for (const f of files) {
        if (f.mimeType === 'application/vnd.google-apps.folder') {
          const childPath = current.folderPath === '/' ? `/${f.name}` : `${current.folderPath}/${f.name}`;
          collectedFolders.push({
            userEmail,
            path: childPath,
            name: f.name,
            parentPath: current.folderPath,
            driveFolderId: f.id,
          });
          queue.push({ folderId: f.id, folderPath: childPath });
        } else {
          const mediaType = classifyMediaAssetType(f.mimeType || '', f.name || '');
          collectedItems.push({
            id: `drv-${f.id}`,
            userEmail,
            fileName: f.name,
            driveFileId: f.id,
            driveFolderId: current.folderId,
            driveWebViewLink: f.webViewLink || `https://drive.google.com/file/d/${f.id}/view`,
            driveDownloadUrl: f.webContentLink || `https://www.googleapis.com/drive/v3/files/${f.id}?alt=media`,
            folderPath: current.folderPath,
            mediaType,
            mimeType: f.mimeType || 'application/octet-stream',
            fileSize: Number(f.size) || 0,
            thumbnailDataUrl: f.thumbnailLink || undefined,
            ownerName,
            deviceSource: 'Google Drive Sync',
            createdAt: f.createdTime || f.modifiedTime || new Date().toISOString(),
            updatedAt: f.modifiedTime || new Date().toISOString(),
          });
        }
      }
      pageToken = data.nextPageToken;
    } while (pageToken);
  }

  const syncRes = await fetch(getApiUrl('/api/media-library/sync-metadata'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userEmail,
      items: collectedItems,
      folders: collectedFolders,
    }),
  });
  if (!syncRes.ok) throw new Error('Failed to persist synced Drive metadata into SQLite.');
  const syncData = await syncRes.json();
  return { syncedCount: syncData.syncedCount || collectedItems.length, folderCount: collectedFolders.length };
}

export async function fetchMediaLibraryItems(params: {
  userEmail?: string;
  q?: string;
  mediaType?: string;
  folderPath?: string;
  collectionId?: string;
  tag?: string;
  favorite?: boolean;
  archived?: boolean;
  trash?: boolean;
  storedLocally?: boolean;
  recentlyViewed?: boolean;
  minSize?: number;
  maxSize?: number;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string;
  page?: number;
  limit?: number;
}): Promise<{ items: MediaLibraryItem[]; total: number; page: number; hasMore: boolean }> {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  });
  try {
    const res = await fetch(getApiUrl(`/api/media-library/items?${qs.toString()}`));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const items = Array.isArray(data.items) ? data.items : [];
    if (params.page === 1 && !params.q && !params.trash) {
      try {
        localStorage.setItem(LOCAL_INDEX_CACHE_KEY, JSON.stringify(items.slice(0, 60)));
      } catch {}
    }
    return { items, total: Number(data.total) || items.length, page: Number(data.page) || 1, hasMore: Boolean(data.hasMore) };
  } catch {
    try {
      const cached = JSON.parse(localStorage.getItem(LOCAL_INDEX_CACHE_KEY) || '[]');
      return { items: Array.isArray(cached) ? cached : [], total: cached.length || 0, page: 1, hasMore: false };
    } catch {
      return { items: [], total: 0, page: 1, hasMore: false };
    }
  }
}

export async function checkMediaDuplicate(sha256Hash: string, userEmail?: string): Promise<MediaLibraryItem | null> {
  try {
    const res = await fetch(getApiUrl('/api/media-library/check-duplicate'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sha256Hash, userEmail }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.duplicate || null;
  } catch {
    return null;
  }
}

export async function saveMediaMetadataToSqlite(item: Partial<MediaLibraryItem> & { fileName: string }): Promise<MediaLibraryItem> {
  const res = await fetch(getApiUrl('/api/media-library/items'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(item),
  });
  if (!res.ok) throw new Error('Failed to save media metadata to SQLite');
  const data = await res.json();
  return data.item;
}

export async function patchMediaItemInSqlite(
  id: string,
  patch: Partial<MediaLibraryItem> & { _silentViewPing?: boolean }
): Promise<MediaLibraryItem | null> {
  const res = await fetch(getApiUrl(`/api/media-library/items/${encodeURIComponent(id)}`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.item || null;
}

export async function permanentlyDeleteMediaItem(id: string): Promise<boolean> {
  const res = await fetch(getApiUrl(`/api/media-library/items/${encodeURIComponent(id)}`), { method: 'DELETE' });
  return res.ok;
}

// On-Demand Local SQLite Storage for Individual Media File
export async function storeMediaItemLocallyInSqlite(
  item: MediaLibraryItem,
  opts?: { file?: Blob; googleAccessToken?: string | null; userEmail?: string }
): Promise<MediaLibraryItem> {
  let blob = opts?.file;
  if (!blob) {
    if (!item.driveFileId) throw new Error('No Google Drive file linked to download locally.');
    const token = getEffectiveGoogleToken(opts?.googleAccessToken);
    if (!token) throw new Error('Sign in with Google Drive to download this file into local SQLite.');
    const dlRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${item.driveFileId}?alt=media&supportsAllDrives=true`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!dlRes.ok) throw new Error(`Failed to download from Google Drive (HTTP ${dlRes.status}).`);
    blob = await dlRes.blob();
  }

  if (blob.size > 35 * 1024 * 1024) {
    throw new Error('File is over 35 MB — keep large videos on Google Drive for streaming and cache smaller files locally.');
  }
  const b64 = await fileToBase64(blob);
  const saveRes = await fetch(getApiUrl(`/api/media-library/items/${encodeURIComponent(item.id)}/local-blob`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dataBase64: b64,
      mimeType: blob.type || item.mimeType,
      fileSize: blob.size || item.fileSize,
      userEmail: opts?.userEmail || item.userEmail,
    }),
  });
  const data = await saveRes.json();
  if (!saveRes.ok) throw new Error(data.error || 'Failed to store file locally in SQLite.');
  return data.item;
}

export async function removeMediaItemFromLocalSqlite(id: string): Promise<MediaLibraryItem | null> {
  const res = await fetch(getApiUrl(`/api/media-library/items/${encodeURIComponent(id)}/local-blob`), {
    method: 'DELETE',
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.item || null;
}

// Transparent Offline-First Media Loader: Local SQLite Blob first -> Google Drive authenticated stream
export async function resolvePlayableMediaUrl(
  item: MediaLibraryItem,
  googleAccessToken?: string | null
): Promise<{ url: string; source: 'sqlite_local' | 'google_drive' | 'thumbnail'; revoke?: () => void }> {
  // 1. Try local SQLite binary first if stored locally (works 100% offline!)
  if (item.isStoredLocally) {
    try {
      const res = await fetch(getApiUrl(`/api/media-library/items/${encodeURIComponent(item.id)}/local-blob`));
      if (res.ok) {
        const data = await res.json();
        if (data.blob?.dataBase64) {
          const byteChars = atob(data.blob.dataBase64);
          const bytes = new Uint8Array(byteChars.length);
          for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
          const blob = new Blob([bytes], { type: data.blob.mimeType || item.mimeType });
          const objectUrl = URL.createObjectURL(blob);
          return { url: objectUrl, source: 'sqlite_local', revoke: () => URL.revokeObjectURL(objectUrl) };
        }
      }
    } catch {}
  }

  // 2. Fetch directly from Google Drive API v3 with OAuth token
  const token = getEffectiveGoogleToken(googleAccessToken);
  if (token && item.driveFileId) {
    try {
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files/${item.driveFileId}?alt=media&supportsAllDrives=true`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const blob = await res.blob();
        const objectUrl = URL.createObjectURL(blob);
        return { url: objectUrl, source: 'google_drive', revoke: () => URL.revokeObjectURL(objectUrl) };
      }
    } catch {}
  }

  // 3. Fallback to cached thumbnail or webViewLink
  return { url: item.thumbnailDataUrl || item.driveWebViewLink || '', source: 'thumbnail' };
}

export async function updateMediaSharing(
  item: MediaLibraryItem,
  shareConfig: MediaShareConfig,
  googleAccessToken?: string | null
): Promise<MediaLibraryItem | null> {
  const token = getEffectiveGoogleToken(googleAccessToken);
  let shareLink = shareConfig.shareLink || item.driveWebViewLink || '';

  if (token && item.driveFileId) {
    try {
      const driveRole =
        shareConfig.permissionRole === 'edit'
          ? 'writer'
          : shareConfig.permissionRole === 'comment'
          ? 'commenter'
          : 'reader';

      if (shareConfig.isPublic) {
        await fetch(`https://www.googleapis.com/drive/v3/files/${item.driveFileId}/permissions?supportsAllDrives=true`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: driveRole, type: 'anyone' }),
        });
      }

      for (const email of shareConfig.sharedWithEmails || []) {
        if (!email.includes('@')) continue;
        await fetch(
          `https://www.googleapis.com/drive/v3/files/${item.driveFileId}/permissions?supportsAllDrives=true&sendNotificationEmail=false`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ role: driveRole, type: 'user', emailAddress: email.trim() }),
          }
        );
      }

      // Toggle download restriction on Drive
      await fetch(`https://www.googleapis.com/drive/v3/files/${item.driveFileId}?supportsAllDrives=true`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ copyRequiresWriterPermission: !shareConfig.allowDownload }),
      });

      if (!shareLink) shareLink = `https://drive.google.com/file/d/${item.driveFileId}/view`;
    } catch {}
  }

  return patchMediaItemInSqlite(item.id, {
    shareConfig: { ...shareConfig, shareLink },
  });
}

export async function analyzeMediaItemWithAi(
  item: MediaLibraryItem,
  opts?: { imageBase64?: string; rawText?: string }
): Promise<{ item?: MediaLibraryItem; analysis: any; modelUsed: string }> {
  const provider = getActiveAiProvider();
  const model = getActiveAiModel(provider);
  const geminiApiKey = typeof window !== 'undefined' ? localStorage.getItem('aura_custom_gemini_api_key') || undefined : undefined;
  const nvidiaApiKey = typeof window !== 'undefined' ? localStorage.getItem('aura_nvidia_api_key') || undefined : undefined;

  const res = await fetch(getApiUrl('/api/media-library/ai-analyze'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mediaId: item.id,
      fileName: item.fileName,
      mediaType: item.mediaType,
      mimeType: item.mimeType,
      imageBase64: opts?.imageBase64 || (item.thumbnailDataUrl?.startsWith('data:image') ? item.thumbnailDataUrl : undefined),
      rawText: opts?.rawText || item.aiMetadata?.ocrText || item.aiMetadata?.caption || '',
      provider,
      model,
      geminiApiKey,
      nvidiaApiKey,
    }),
  });
  if (!res.ok) throw new Error('AI analysis failed');
  return res.json();
}

export async function fetchMediaFolders(userEmail?: string): Promise<MediaFolderItem[]> {
  try {
    const qs = userEmail ? `?userEmail=${encodeURIComponent(userEmail)}` : '';
    const res = await fetch(getApiUrl(`/api/media-library/folders${qs}`));
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.folders) ? data.folders : [];
  } catch {
    return [];
  }
}

export async function createMediaFolder(params: {
  userEmail?: string;
  parentPath: string;
  name: string;
  googleAccessToken?: string | null;
}): Promise<MediaFolderItem> {
  const cleanName = params.name.trim().replace(/[\\/]+/g, '-');
  const cleanParent = params.parentPath === '/' ? '/' : `/${params.parentPath.replace(/^\/+|\/+$/g, '')}`;
  const fullPath = cleanParent === '/' ? `/${cleanName}` : `${cleanParent}/${cleanName}`;
  let driveFolderId: string | undefined;

  const token = getEffectiveGoogleToken(params.googleAccessToken);
  if (token) {
    try {
      const ensured = await ensureDriveFolderPath(fullPath, token, params.userEmail);
      driveFolderId = ensured.folderId;
    } catch {}
  }

  const res = await fetch(getApiUrl('/api/media-library/folders'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userEmail: params.userEmail,
      path: fullPath,
      name: cleanName,
      parentPath: cleanParent,
      driveFolderId,
    }),
  });
  const data = await res.json();
  return data.folder;
}

export async function fetchMediaCollections(userEmail?: string): Promise<MediaCollectionItem[]> {
  try {
    const qs = userEmail ? `?userEmail=${encodeURIComponent(userEmail)}` : '';
    const res = await fetch(getApiUrl(`/api/media-library/collections${qs}`));
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.collections) ? data.collections : [];
  } catch {
    return [];
  }
}

export async function createMediaCollection(params: {
  userEmail?: string;
  name: string;
  description?: string;
  kind?: 'album' | 'collection' | 'playlist';
}): Promise<MediaCollectionItem> {
  const res = await fetch(getApiUrl('/api/media-library/collections'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  return data.collection;
}

export async function fetchMediaAnalytics(userEmail?: string): Promise<MediaAnalyticsSummary> {
  const res = await fetch(
    getApiUrl(`/api/media-library/analytics${userEmail ? `?userEmail=${encodeURIComponent(userEmail)}` : ''}`)
  );
  const data = await res.json();
  return data.analytics;
}

export function findSimilarMediaItems(target: MediaLibraryItem, allItems: MediaLibraryItem[]): MediaLibraryItem[] {
  const targetTokens = new Set([
    ...(target.tags || []).map((t) => t.toLowerCase()),
    ...(target.aiMetadata?.objects || []).map((o) => o.toLowerCase()),
    target.category.toLowerCase(),
    target.mediaType,
  ]);

  return allItems
    .filter((other) => other.id !== target.id && !other.isDeleted)
    .map((other) => {
      let score = 0;
      if (other.mediaType === target.mediaType) score += 2;
      if (other.category === target.category) score += 2;
      if (other.folderPath === target.folderPath) score += 1;
      for (const t of other.tags || []) {
        if (targetTokens.has(t.toLowerCase())) score += 3;
      }
      for (const o of other.aiMetadata?.objects || []) {
        if (targetTokens.has(o.toLowerCase())) score += 2;
      }
      return { item: other, score };
    })
    .filter((x) => x.score > 1)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map((x) => x.item);
}
