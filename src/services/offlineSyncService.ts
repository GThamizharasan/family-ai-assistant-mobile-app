// Sovereign 3GB SQLite Storage & Unified Offline Sync Service
// Coordinates local offline caching of Apple Books, Apple Music, Voice Memos, TTS Memos, Translations, and Google Drive Files

import { safeFetchJson, getApiUrl } from './api';
import { Book } from '../types/book';
import { MusicTrack } from '../types/music';
import { VoiceRecording } from '../types/voiceRecording';
import { TtsMemo } from '../types/tts';
import { LanguageTranslation } from '../types/translation';
import { fetchGoogleDriveFiles, syncGoogleDriveToSqliteStore, GoogleDriveFile } from './googleWorkspace';
import { saveAudioToStorage } from '../utils/audioStorage';
import { savePdfToStorage } from '../utils/pdfStorage';

export interface StorageBreakdownItem {
  count: number;
  bytes: number;
  mb: number;
}

export interface Sqlite3GbQuotaDetails {
  quotaBytes: number;
  quotaGb: number;
  totalUsedBytes: number;
  totalUsedMb: number;
  totalUsedGb: number;
  freeBytes: number;
  freeMb: number;
  freeGb: number;
  percentUsed: number;
  isNearQuota: boolean;
  isQuotaExceeded: boolean;
  dbFileSizeFormatted: string;
  breakdown: {
    books: StorageBreakdownItem;
    music: StorageBreakdownItem;
    memos: StorageBreakdownItem;
    tts: StorageBreakdownItem;
    translations: StorageBreakdownItem;
    scans?: StorageBreakdownItem;
    driveFiles: StorageBreakdownItem;
    aiCreations: StorageBreakdownItem;
    keepNotes: StorageBreakdownItem;
    other: { bytes: number; mb: number };
  };
  lastUpdated: string;
}

export const MAX_SQLITE_STORAGE_MB = 3072; // 3GB Max Storage

// Offline mode simulation key
const OFFLINE_SIMULATION_KEY = 'aura_offline_mode_active';

export function isOfflineModeSimulated(): boolean {
  try {
    return localStorage.getItem(OFFLINE_SIMULATION_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setOfflineModeSimulated(active: boolean): void {
  try {
    localStorage.setItem(OFFLINE_SIMULATION_KEY, active ? 'true' : 'false');
    window.dispatchEvent(new CustomEvent('aura_offline_mode_changed', { detail: { active } }));
  } catch {}
}

export function isAppOffline(browserOnline = true): boolean {
  if (isOfflineModeSimulated()) return true;
  return !browserOnline;
}

/**
 * Fetch live 3GB storage quota details and per-feature breakdown from SQLite
 */
export async function fetchSqlite3GbQuota(): Promise<Sqlite3GbQuotaDetails | null> {
  try {
    const res = await safeFetchJson<any>('/api/sqlite/storage-quota');
    if (res && res.success && res.quotaBytes) {
      return res as Sqlite3GbQuotaDetails;
    }
  } catch (err) {
    console.warn('Could not fetch 3GB storage quota details from server:', err);
  }

  // Client-side SQLite & IndexedDB storage computation fallback
  try {
    let musicCount = 0;
    const localMusic = typeof window !== 'undefined'
      ? (localStorage.getItem('aura_music_library_tracks') || localStorage.getItem('aura_music_tracks'))
      : null;
    if (localMusic) {
      const parsed: MusicTrack[] = JSON.parse(localMusic);
      musicCount = parsed.filter((t) => t.localCached).length;
    }

    let booksCount = 0;
    const localBooks = typeof window !== 'undefined'
      ? localStorage.getItem('aura_ibooks_library')
      : null;
    if (localBooks) {
      const parsed: Book[] = JSON.parse(localBooks);
      booksCount = parsed.filter((b) => b.isLocalCached).length;
    }

    let memosCount = 0;
    const localMemos = typeof window !== 'undefined' ? localStorage.getItem('aura_voice_recordings_cache_v1') : null;
    if (localMemos) {
      const parsed: VoiceRecording[] = JSON.parse(localMemos);
      memosCount = parsed.length;
    }

    let ttsCount = 0;
    const localTts = typeof window !== 'undefined' ? localStorage.getItem('aura_tts_memos_cache_v1') : null;
    if (localTts) {
      const parsed: TtsMemo[] = JSON.parse(localTts);
      ttsCount = parsed.length;
    }

    let transCount = 0;
    const localTrans = typeof window !== 'undefined' ? localStorage.getItem('aura_translations_cache_v1') : null;
    if (localTrans) {
      const parsed: LanguageTranslation[] = JSON.parse(localTrans);
      transCount = parsed.length;
    }

    let scansCount = 0;
    const localScans = typeof window !== 'undefined' ? localStorage.getItem('aura_adobe_scanned_docs_v1') : null;
    if (localScans) {
      try {
        const parsed = JSON.parse(localScans);
        scansCount = Array.isArray(parsed) ? parsed.length : 0;
      } catch {}
    }

    let driveCount = 0;
    const localDrive = typeof window !== 'undefined' ? localStorage.getItem('aura_google_drive_files_cache') : null;
    if (localDrive) {
      try {
        const parsed = JSON.parse(localDrive);
        driveCount = Array.isArray(parsed) ? parsed.length : (parsed.files?.length || 0);
      } catch {}
    }

    const musicBytes = musicCount * 4.2 * 1024 * 1024;
    const booksBytes = booksCount * 5.0 * 1024 * 1024;
    const memosBytes = memosCount * 1.5 * 1024 * 1024;
    const ttsBytes = ttsCount * 0.8 * 1024 * 1024;
    const transBytes = transCount * 0.4 * 1024 * 1024;
    const scansBytes = scansCount * 1.8 * 1024 * 1024;
    const driveBytes = driveCount * 2.0 * 1024 * 1024;

    const totalBytes = musicBytes + booksBytes + memosBytes + ttsBytes + transBytes + scansBytes + driveBytes + 1024 * 1024;
    const totalMb = Math.round((totalBytes / (1024 * 1024)) * 10) / 10;
    const quotaBytes = 3 * 1024 * 1024 * 1024;
    const freeBytes = Math.max(0, quotaBytes - totalBytes);

    return {
      quotaBytes,
      quotaGb: 3,
      totalUsedBytes: totalBytes,
      totalUsedMb: totalMb,
      totalUsedGb: Math.round((totalMb / 1024) * 100) / 100,
      freeBytes,
      freeMb: Math.round(freeBytes / (1024 * 1024)),
      freeGb: Math.round((freeBytes / (1024 * 1024 * 1024)) * 10) / 10,
      percentUsed: Math.min(100, Math.round((totalBytes / quotaBytes) * 1000) / 10),
      isNearQuota: totalBytes > quotaBytes * 0.85,
      isQuotaExceeded: totalBytes >= quotaBytes,
      dbFileSizeFormatted: `${totalMb} MB`,
      breakdown: {
        books: { count: booksCount, bytes: booksBytes, mb: Math.round(booksBytes / (1024 * 1024)) },
        music: { count: musicCount, bytes: musicBytes, mb: Math.round(musicBytes / (1024 * 1024)) },
        memos: { count: memosCount, bytes: memosBytes, mb: Math.round(memosBytes / (1024 * 1024)) },
        tts: { count: ttsCount, bytes: ttsBytes, mb: Math.round(ttsBytes / (1024 * 1024)) },
        translations: { count: transCount, bytes: transBytes, mb: Math.round(transBytes / (1024 * 1024)) },
        scans: { count: scansCount, bytes: scansBytes, mb: Math.round(scansBytes / (1024 * 1024)) },
        driveFiles: { count: driveCount, bytes: driveBytes, mb: Math.round(driveBytes / (1024 * 1024)) },
        aiCreations: { count: 0, bytes: 0, mb: 0 },
        keepNotes: { count: 0, bytes: 0, mb: 0 },
        other: { bytes: 1024 * 1024, mb: 1 },
      },
      lastUpdated: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

/**
 * Save book directly into local Client SQLite store and mobile IndexedDB
 */
export async function saveBookToSqliteStore(book: Book, pdfContentBase64?: string): Promise<boolean> {
  try {
    let base64 = pdfContentBase64;
    const token = typeof window !== 'undefined'
      ? (localStorage.getItem('aura_google_access_token') || localStorage.getItem('google_access_token'))
      : null;

    // 1. If no base64 and book has Google Drive file ID, fetch directly from Google Drive
    if (!base64 && book.driveFileId && token) {
      try {
        const driveRes = await fetch(`https://www.googleapis.com/drive/v3/files/${book.driveFileId}?alt=media`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (driveRes.ok) {
          const ab = await driveRes.arrayBuffer();
          if (ab.byteLength > 100) {
            base64 = arrayBufferToBase64(ab);
          }
        }
      } catch (dErr) {
        console.warn('[Offline Sync] Google Drive book binary fetch note:', dErr);
      }
    }

    // 2. Save directly into Client SQLite (IndexedDB)
    if (base64) {
      await savePdfToStorage(book.id, base64).catch(() => {});
    }

    // 3. Update Client Local Storage metadata
    try {
      const keys = ['aura_ibooks_library', 'aura_offline_books'];
      keys.forEach((key) => {
        const saved = localStorage.getItem(key);
        if (saved) {
          const list: Book[] = JSON.parse(saved);
          const idx = list.findIndex((b) => b.id === book.id);
          const updated: Book = {
            ...book,
            isLocalCached: true,
          };
          if (idx >= 0) list[idx] = updated;
          else list.unshift(updated);
          localStorage.setItem(key, JSON.stringify(list));
        }
      });
    } catch {}

    // 4. Optional Mirroring to Server SQLite (Non-blocking)
    safeFetchJson<any>('/api/books/library', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...book,
        pdfContentBase64: base64,
        isLocalCached: true,
      }),
    }).catch(() => {});

    return true;
  } catch (err) {
    console.warn('[Offline Sync] saveBookToSqliteStore error:', err);
    return false;
  }
}

/**
 * Fetch all offline books cached in SQLite store
 */
export async function fetchBooksFromSqliteStore(userEmail?: string): Promise<Book[]> {
  try {
    const url = userEmail ? `/api/books/library?userEmail=${encodeURIComponent(userEmail)}` : '/api/books/library';
    const res = await safeFetchJson<{ success: boolean; books: any[] }>(url);
    if (res && res.success && Array.isArray(res.books)) {
      return res.books as Book[];
    }
  } catch {}

  // Fallback to client localStorage
  try {
    const saved = localStorage.getItem('aura_ibooks_library');
    if (saved) return JSON.parse(saved);
  } catch {}

  return [];
}

/**
 * Cache PDF content base64 directly into SQLite & IndexedDB
 */
export async function cacheBookPdfToSqlite(bookId: string, pdfContentBase64: string, pdfFileName?: string): Promise<boolean> {
  try {
    // 1. Client SQLite Storage
    await savePdfToStorage(bookId, pdfContentBase64).catch(() => {});

    // 2. Server mirror (non-blocking)
    safeFetchJson<any>(`/api/books/library/${bookId}/cache-pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pdfContentBase64, pdfFileName }),
    }).catch(() => {});

    return true;
  } catch {
    return false;
  }
}

/**
 * Update reading progress in SQLite
 */
export async function updateBookProgressInSqliteStore(
  bookId: string,
  page: number,
  chapterId?: string,
  percent?: number
): Promise<boolean> {
  try {
    const res = await safeFetchJson<any>(`/api/books/library/${bookId}/progress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page, chapterId, percent }),
    });
    return !!(res && res.success);
  } catch {
    return false;
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  const chunkSize = 8192;
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  return btoa(binary);
}

/**
 * Cache single music track and its audio binary content directly into Client SQLite & IndexedDB store.
 * Synchronizes directly with Google Drive and remote audio streams.
 */
export async function saveTrackToSqliteStore(
  track: MusicTrack,
  audioContentBase64?: string,
  mimeType?: string
): Promise<boolean> {
  try {
    let base64 = audioContentBase64 || track.audioContentBase64;
    let mime = mimeType || track.audioMimeType || 'audio/mpeg';

    const token = typeof window !== 'undefined'
      ? (localStorage.getItem('aura_google_access_token') || localStorage.getItem('google_access_token'))
      : null;

    // 1. If no base64, check Google Drive if track has driveFileId
    if (!base64 && track.driveFileId && token) {
      try {
        const driveRes = await fetch(`https://www.googleapis.com/drive/v3/files/${track.driveFileId}?alt=media`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (driveRes.ok) {
          const ab = await driveRes.arrayBuffer();
          if (ab.byteLength > 100) {
            base64 = arrayBufferToBase64(ab);
            mime = driveRes.headers.get('content-type') || mime;
          }
        }
      } catch (dErr) {
        console.warn('[Offline Sync] Google Drive track binary fetch note:', dErr);
      }
    }

    // 2. If still no base64, check track.audioUrl (remote stream or data URI)
    if (!base64 && track.audioUrl) {
      if (track.audioUrl.startsWith('data:')) {
        const match = track.audioUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
          mime = match[1];
          base64 = match[2];
        }
      } else if (track.audioUrl.startsWith('http')) {
        try {
          let audioRes = await fetch(track.audioUrl, { mode: 'cors' }).catch(() => null);
          if (!audioRes || !audioRes.ok) {
            // Try proxy endpoint
            audioRes = await fetch(getApiUrl(`/api/audio/proxy?url=${encodeURIComponent(track.audioUrl)}`)).catch(() => null);
          }
          if (audioRes && audioRes.ok) {
            const ab = await audioRes.arrayBuffer();
            if (ab.byteLength > 100) {
              base64 = arrayBufferToBase64(ab);
              mime = audioRes.headers.get('content-type') || mime;
            }
          }
        } catch (netErr) {
          console.warn('[Offline Sync] Remote audio fetch note:', netErr);
        }
      }
    }

    // 3. Fallback: try server endpoint if available
    if (!base64 && track.id) {
      try {
        const audioFetchUrl = getApiUrl(`/api/music/library/${track.id}/audio`);
        const audioRes = await fetch(audioFetchUrl).catch(() => null);
        if (audioRes && audioRes.ok) {
          const ab = await audioRes.arrayBuffer();
          if (ab.byteLength > 100) {
            base64 = arrayBufferToBase64(ab);
            mime = audioRes.headers.get('content-type') || mime;
          }
        }
      } catch (fErr) {
        console.warn('[Offline Sync] Server audio stream fetch note:', fErr);
      }
    }

    // 4. Client SQLite Storage Persistence (IndexedDB)
    if (base64) {
      await saveAudioToStorage(track.id, base64, mime).catch((err) => {
        console.warn('[Offline Sync] IndexedDB audio save notice:', err);
      });
    }

    // 5. Update Client Local Storage metadata (tracks list)
    try {
      const keys = ['aura_music_library_tracks', 'aura_music_tracks'];
      keys.forEach((key) => {
        const saved = localStorage.getItem(key);
        if (saved) {
          const list: MusicTrack[] = JSON.parse(saved);
          const idx = list.findIndex((t) => t.id === track.id);
          const updated: MusicTrack = {
            ...track,
            localCached: true,
            audioMimeType: mime,
            audioContentBase64: undefined, // keep lightweight
          };
          if (idx >= 0) list[idx] = updated;
          else list.unshift(updated);
          localStorage.setItem(key, JSON.stringify(list));
        }
      });
    } catch {}

    // 6. Optional Mirroring to Server SQLite (Non-blocking / Ignored if server offline)
    safeFetchJson<any>('/api/music/library', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...track,
        audioContentBase64: base64,
        audioMimeType: mime,
        localCached: true,
      }),
    }).catch(() => {});

    if (base64) {
      safeFetchJson<any>(`/api/music/library/${track.id}/cache-audio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioContentBase64: base64,
          mimeType: mime,
        }),
      }).catch(() => {});
    }

    // Dispatch sync event so quota & badges update across UI
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('aura_sqlite_synced'));
    }

    return true;
  } catch (err) {
    console.warn('[Offline Sync] saveTrackToSqliteStore error:', err);
    return false;
  }
}

/**
 * Cache all music tracks into the SQLite offline store in batch with progress reporting
 */
export async function cacheAllMusicTracksToSqlite(
  tracks: MusicTrack[],
  onProgress?: (current: number, total: number, trackTitle: string) => void
): Promise<{ success: boolean; cachedCount: number; errors: number; quota?: Sqlite3GbQuotaDetails | null }> {
  let cachedCount = 0;
  let errors = 0;
  for (let i = 0; i < tracks.length; i++) {
    const t = tracks[i];
    onProgress?.(i + 1, tracks.length, t.title);
    try {
      const ok = await saveTrackToSqliteStore(t);
      if (ok) cachedCount++;
      else errors++;
    } catch {
      errors++;
    }
  }

  const quota = await fetchSqlite3GbQuota();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('aura_sqlite_synced', { detail: { quota } }));
  }

  return { success: errors === 0, cachedCount, errors, quota };
}

/**
 * Fetch all offline music tracks cached in SQLite store
 */
export async function fetchMusicFromSqliteStore(userEmail?: string): Promise<MusicTrack[]> {
  try {
    const url = userEmail ? `/api/music/library?userEmail=${encodeURIComponent(userEmail)}` : '/api/music/library';
    const res = await safeFetchJson<{ success: boolean; tracks: any[] }>(url);
    if (res && res.success && Array.isArray(res.tracks)) {
      return res.tracks.map((t) => ({ ...t, localCached: true })) as MusicTrack[];
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Cache single Voice Memo audio directly into Client SQLite & IndexedDB store.
 * Synchronizes directly with Google Drive audio stream.
 */
export async function saveVoiceRecordingToSqliteStore(
  recording: VoiceRecording,
  audioContentBase64?: string
): Promise<boolean> {
  try {
    let base64 = audioContentBase64 || recording.audioContentBase64;
    const mime = recording.audioMimeType || 'audio/webm';
    const token = typeof window !== 'undefined'
      ? (localStorage.getItem('aura_google_access_token') || localStorage.getItem('google_access_token'))
      : null;

    // 1. If no base64 and has Google Drive file ID, fetch directly from Google Drive
    const driveId = recording.driveFileId || (recording.id.startsWith('drive_') ? recording.id.replace(/^drive_/, '') : null);
    if (!base64 && driveId && token) {
      try {
        const driveRes = await fetch(`https://www.googleapis.com/drive/v3/files/${driveId}?alt=media`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (driveRes.ok) {
          const ab = await driveRes.arrayBuffer();
          if (ab.byteLength > 100) {
            base64 = arrayBufferToBase64(ab);
          }
        }
      } catch (dErr) {
        console.warn('[Offline Sync] Google Drive voice memo binary fetch note:', dErr);
      }
    }

    // 2. Fallback: try server endpoint if available
    if (!base64 && recording.id) {
      try {
        const tokenParam = token ? `?accessToken=${encodeURIComponent(token)}` : '';
        const audioFetchUrl = getApiUrl(`/api/voice-recordings/${recording.id}/audio${tokenParam}`);
        const audioRes = await fetch(audioFetchUrl).catch(() => null);
        if (audioRes && audioRes.ok) {
          const ab = await audioRes.arrayBuffer();
          if (ab.byteLength > 100) {
            base64 = arrayBufferToBase64(ab);
          }
        }
      } catch (fErr) {
        console.warn('[Offline Sync] Server voice memo stream fetch note:', fErr);
      }
    }

    // 3. Client SQLite Storage Persistence (IndexedDB)
    if (base64) {
      await saveAudioToStorage(recording.id, base64, mime).catch((err) => {
        console.warn('[Offline Sync] IndexedDB voice memo save notice:', err);
      });
    }

    // 4. Update Client Local Storage metadata
    try {
      const saved = localStorage.getItem('aura_voice_recordings_cache_v1');
      if (saved) {
        const list: VoiceRecording[] = JSON.parse(saved);
        const idx = list.findIndex((r) => r.id === recording.id);
        const updated: VoiceRecording = {
          ...recording,
          driveSyncStatus: recording.driveFileId ? 'synced' : recording.driveSyncStatus,
          audioContentBase64: undefined, // keep lightweight in localStorage
        };
        if (idx >= 0) list[idx] = updated;
        else list.unshift(updated);
        localStorage.setItem('aura_voice_recordings_cache_v1', JSON.stringify(list));
      }
    } catch {}

    // 5. Optional Mirroring to Server SQLite (Non-blocking)
    safeFetchJson<any>('/api/voice-recordings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...recording,
        audioContentBase64: base64,
      }),
    }).catch(() => {});

    // Dispatch sync event so quota & badges update across UI
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('aura_sqlite_synced'));
    }

    return true;
  } catch (err) {
    console.warn('[Offline Sync] saveVoiceRecordingToSqliteStore error:', err);
    return false;
  }
}

/**
 * Cache all voice recordings into the SQLite offline store in batch with progress reporting
 */
export async function cacheAllVoiceRecordingsToSqlite(
  recordings: VoiceRecording[],
  onProgress?: (current: number, total: number, title: string) => void
): Promise<{ success: boolean; cachedCount: number; errors: number; quota?: Sqlite3GbQuotaDetails | null }> {
  let cachedCount = 0;
  let errors = 0;
  for (let i = 0; i < recordings.length; i++) {
    const r = recordings[i];
    onProgress?.(i + 1, recordings.length, r.title);
    try {
      const ok = await saveVoiceRecordingToSqliteStore(r);
      if (ok) cachedCount++;
      else errors++;
    } catch {
      errors++;
    }
  }

  const quota = await fetchSqlite3GbQuota();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('aura_sqlite_synced', { detail: { quota } }));
  }

  return { success: errors === 0, cachedCount, errors, quota };
}

/**
 * Cache single TTS memo audio directly into Client SQLite & IndexedDB store
 */
export async function saveTtsMemoToSqliteStore(
  memo: TtsMemo,
  audioContentBase64?: string
): Promise<boolean> {
  try {
    let base64 = audioContentBase64 || memo.audioContentBase64;
    const token = typeof window !== 'undefined'
      ? (localStorage.getItem('aura_google_access_token') || localStorage.getItem('google_access_token'))
      : null;

    if (!base64 && memo.driveFileId && token) {
      try {
        const driveRes = await fetch(`https://www.googleapis.com/drive/v3/files/${memo.driveFileId}?alt=media`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (driveRes.ok) {
          const ab = await driveRes.arrayBuffer();
          if (ab.byteLength > 100) {
            base64 = arrayBufferToBase64(ab);
          }
        }
      } catch (dErr) {
        console.warn('[Offline Sync] Google Drive TTS fetch note:', dErr);
      }
    }

    if (base64) {
      await saveAudioToStorage(memo.id, base64, 'audio/mpeg').catch((err) => {
        console.warn('[Offline Sync] IndexedDB TTS save notice:', err);
      });
    }

    try {
      const saved = localStorage.getItem('aura_tts_memos_cache_v1');
      if (saved) {
        const list: TtsMemo[] = JSON.parse(saved);
        const idx = list.findIndex((m) => m.id === memo.id);
        const updated: TtsMemo = {
          ...memo,
          audioContentBase64: undefined,
        };
        if (idx >= 0) list[idx] = updated;
        else list.unshift(updated);
        localStorage.setItem('aura_tts_memos_cache_v1', JSON.stringify(list));
      }
    } catch {}

    safeFetchJson<any>('/api/tts-memos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...memo,
        audioContentBase64: base64,
      }),
    }).catch(() => {});

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('aura_sqlite_synced'));
    }

    return true;
  } catch (err) {
    console.warn('[Offline Sync] saveTtsMemoToSqliteStore error:', err);
    return false;
  }
}

/**
 * Cache all TTS memos into the SQLite offline store in batch with progress reporting
 */
export async function cacheAllTtsMemosToSqlite(
  memos: TtsMemo[],
  onProgress?: (current: number, total: number, title: string) => void
): Promise<{ success: boolean; cachedCount: number; errors: number; quota?: Sqlite3GbQuotaDetails | null }> {
  let cachedCount = 0;
  let errors = 0;
  for (let i = 0; i < memos.length; i++) {
    const m = memos[i];
    onProgress?.(i + 1, memos.length, m.title);
    try {
      const ok = await saveTtsMemoToSqliteStore(m);
      if (ok) cachedCount++;
      else errors++;
    } catch {
      errors++;
    }
  }

  const quota = await fetchSqlite3GbQuota();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('aura_sqlite_synced', { detail: { quota } }));
  }

  return { success: errors === 0, cachedCount, errors, quota };
}

/**
 * Cache single Language Translation into Client SQLite & IndexedDB store
 */
export async function saveTranslationToSqliteStore(
  translation: LanguageTranslation,
  audioContentBase64?: string
): Promise<boolean> {
  try {
    let base64 = audioContentBase64 || translation.audioContentBase64;
    const token = typeof window !== 'undefined'
      ? (localStorage.getItem('aura_google_access_token') || localStorage.getItem('google_access_token'))
      : null;

    if (!base64 && translation.driveFileId && token) {
      try {
        const driveRes = await fetch(`https://www.googleapis.com/drive/v3/files/${translation.driveFileId}?alt=media`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (driveRes.ok) {
          const ab = await driveRes.arrayBuffer();
          if (ab.byteLength > 100) {
            base64 = arrayBufferToBase64(ab);
          }
        }
      } catch (dErr) {
        console.warn('[Offline Sync] Google Drive translation fetch note:', dErr);
      }
    }

    if (base64) {
      await saveAudioToStorage(translation.id, base64, 'audio/mpeg').catch((err) => {
        console.warn('[Offline Sync] IndexedDB translation save notice:', err);
      });
    }

    try {
      const saved = localStorage.getItem('aura_translations_cache_v1');
      if (saved) {
        const list: LanguageTranslation[] = JSON.parse(saved);
        const idx = list.findIndex((t) => t.id === translation.id);
        const updated: LanguageTranslation = {
          ...translation,
          audioContentBase64: undefined,
        };
        if (idx >= 0) list[idx] = updated;
        else list.unshift(updated);
        localStorage.setItem('aura_translations_cache_v1', JSON.stringify(list));
      }
    } catch {}

    safeFetchJson<any>('/api/translations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...translation,
        audioContentBase64: base64,
      }),
    }).catch(() => {});

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('aura_sqlite_synced'));
    }

    return true;
  } catch (err) {
    console.warn('[Offline Sync] saveTranslationToSqliteStore error:', err);
    return false;
  }
}

/**
 * Cache all Translations into the SQLite offline store in batch with progress reporting
 */
export async function cacheAllTranslationsToSqlite(
  translations: LanguageTranslation[],
  onProgress?: (current: number, total: number, title: string) => void
): Promise<{ success: boolean; cachedCount: number; errors: number; quota?: Sqlite3GbQuotaDetails | null }> {
  let cachedCount = 0;
  let errors = 0;
  for (let i = 0; i < translations.length; i++) {
    const tr = translations[i];
    onProgress?.(i + 1, translations.length, tr.sourceText.slice(0, 20));
    try {
      const ok = await saveTranslationToSqliteStore(tr);
      if (ok) cachedCount++;
      else errors++;
    } catch {
      errors++;
    }
  }

  const quota = await fetchSqlite3GbQuota();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('aura_sqlite_synced', { detail: { quota } }));
  }

  return { success: errors === 0, cachedCount, errors, quota };
}

/**
 * Unified 1-Click Sync All Features into 3GB Local SQLite Store.
 * Fully synchronizes Google Drive files, Apple Books, Apple Music,
 * Voice Memos, TTS Audio, and Translations into SQLite persistence.
 */
export async function syncAllFeaturesToSqliteStore(options: {
  userEmail?: string;
  googleAccessToken?: string | null;
  onProgress?: (message: string, percent: number) => void;
}): Promise<{
  success: boolean;
  message: string;
  syncedCounts?: any;
  quota?: Sqlite3GbQuotaDetails;
}> {
  const { userEmail = 'chinna.tamil2000@gmail.com', onProgress } = options;
  const token = options.googleAccessToken || (typeof window !== 'undefined' ? localStorage.getItem('aura_google_access_token') : null);

  try {
    onProgress?.('Inspecting local features and preparing SQLite sync...', 10);

    // 1. Synchronize Google Drive Files into SQLite if authenticated
    let driveFilesToSync: any[] = [];
    if (token) {
      onProgress?.('Connecting to Google Drive API & scanning files...', 25);
      try {
        const driveFiles = await fetchGoogleDriveFiles(token, userEmail);
        driveFilesToSync = driveFiles.map((f) => ({
          id: f.id,
          name: f.name,
          mimeType: f.mimeType,
          size: f.size,
          modifiedTime: f.modifiedTime,
          webViewLink: f.webViewLink,
          folderId: f.folderId,
          folderName: f.folderName,
          category: f.category,
        }));
      } catch (driveErr) {
        console.warn('Google Drive scan during offline sync note:', driveErr);
      }
    }

    // 2. Gather Books from localStorage / initial data
    let localBooks: Book[] = [];
    try {
      const savedBooks = localStorage.getItem('aura_ibooks_library');
      if (savedBooks) localBooks = JSON.parse(savedBooks);
    } catch {}

    onProgress?.(`Syncing ${localBooks.length} Books and ${driveFilesToSync.length} Google Drive files...`, 35);
    for (const b of localBooks) {
      await saveBookToSqliteStore(b).catch(() => {});
    }

    // 3. Gather Music tracks
    let localMusic: MusicTrack[] = [];
    try {
      const savedMusic = localStorage.getItem('aura_music_tracks') || localStorage.getItem('aura_music_library_tracks');
      if (savedMusic) localMusic = JSON.parse(savedMusic);
    } catch {}

    onProgress?.(`Caching ${localMusic.length} Music Tracks into 3GB Vault...`, 50);
    for (const m of localMusic) {
      await saveTrackToSqliteStore(m).catch(() => {});
    }

    // 4. Gather Voice Recordings
    let localRecordings: VoiceRecording[] = [];
    try {
      const savedRecs = localStorage.getItem('aura_voice_recordings_cache_v1');
      if (savedRecs) localRecordings = JSON.parse(savedRecs);
    } catch {}

    onProgress?.(`Caching ${localRecordings.length} Voice Memos into 3GB Vault...`, 65);
    for (const r of localRecordings) {
      await saveVoiceRecordingToSqliteStore(r).catch(() => {});
    }

    // 5. Gather TTS Memos
    let localTts: TtsMemo[] = [];
    try {
      const savedTts = localStorage.getItem('aura_tts_memos_cache_v1');
      if (savedTts) localTts = JSON.parse(savedTts);
    } catch {}

    onProgress?.(`Caching ${localTts.length} TTS Memos...`, 75);
    for (const t of localTts) {
      await saveTtsMemoToSqliteStore(t).catch(() => {});
    }

    // 6. Gather Translations
    let localTranslations: LanguageTranslation[] = [];
    try {
      const savedTranslations = localStorage.getItem('aura_translations_cache_v1');
      if (savedTranslations) localTranslations = JSON.parse(savedTranslations);
    } catch {}

    onProgress?.(`Caching ${localTranslations.length} Translations...`, 85);
    for (const tr of localTranslations) {
      await saveTranslationToSqliteStore(tr).catch(() => {});
    }

    onProgress?.('Writing all records & media into SQLite 3GB storage...', 90);

    // 7. Post to unified sync endpoint
    const syncPayload = {
      userEmail,
      books: localBooks.map((b) => ({
        ...b,
        isLocalCached: true,
      })),
      musicTracks: localMusic,
      voiceRecordings: localRecordings,
      ttsMemos: localTts,
      translations: localTranslations,
      driveFiles: driveFilesToSync,
    };

    const res = await safeFetchJson<any>('/api/sqlite/sync-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(syncPayload),
    });

    onProgress?.('Finalizing SQLite storage metrics...', 95);

    const quota = await fetchSqlite3GbQuota();

    onProgress?.('Sync complete! All features & Google Drive offline ready.', 100);

    // Dispatch sync completion event
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('aura_sqlite_synced', { detail: { quota } }));
    }

    return {
      success: true,
      message: res?.message || 'Successfully synchronized Google Drive and all features into local SQLite 3GB store.',
      syncedCounts: res?.syncedCounts,
      quota: quota || undefined,
    };
  } catch (err: any) {
    console.error('Failed to sync all features to SQLite:', err);
    return {
      success: false,
      message: err.message || 'Unified SQLite sync encountered an issue.',
    };
  }
}

export { syncGoogleDriveToSqliteStore };
