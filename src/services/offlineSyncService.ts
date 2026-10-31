// Sovereign 3GB SQLite Storage & Unified Offline Sync Service
// Coordinates local offline caching of Apple Books, Apple Music, Voice Memos, TTS Memos, Translations, and Google Drive Files

import { safeFetchJson, getApiUrl } from './api';
import { Book } from '../types/book';
import { MusicTrack } from '../types/music';
import { fetchGoogleDriveFiles, syncGoogleDriveToSqliteStore, GoogleDriveFile } from './googleWorkspace';

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
    if (res && res.success) {
      return res as Sqlite3GbQuotaDetails;
    }
    return null;
  } catch (err) {
    console.warn('Could not fetch 3GB storage quota details:', err);
    return null;
  }
}

/**
 * Save book directly into local SQLite store
 */
export async function saveBookToSqliteStore(book: Book, pdfContentBase64?: string): Promise<boolean> {
  try {
    const res = await safeFetchJson<any>('/api/books/library', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...book,
        pdfContentBase64,
        isLocalCached: true,
      }),
    });
    return !!(res && res.success);
  } catch {
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
    return [];
  } catch {
    return [];
  }
}

/**
 * Cache PDF content base64 directly into SQLite
 */
export async function cacheBookPdfToSqlite(bookId: string, pdfContentBase64: string, pdfFileName?: string): Promise<boolean> {
  try {
    const res = await safeFetchJson<any>(`/api/books/library/${bookId}/cache-pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pdfContentBase64, pdfFileName }),
    });
    return !!(res && res.success);
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

    onProgress?.(`Syncing ${localBooks.length} Books and ${driveFilesToSync.length} Google Drive files...`, 45);

    // 3. Gather Music tracks
    let localMusic: MusicTrack[] = [];
    try {
      const savedMusic = localStorage.getItem('aura_music_tracks') || localStorage.getItem('aura_music_library_tracks');
      if (savedMusic) localMusic = JSON.parse(savedMusic);
    } catch {}

    // 4. Gather Voice Recordings
    let localRecordings: any[] = [];
    try {
      const savedRecs = localStorage.getItem('aura_voice_recordings_cache_v1');
      if (savedRecs) localRecordings = JSON.parse(savedRecs);
    } catch {}

    // 5. Gather TTS Memos
    let localTts: any[] = [];
    try {
      const savedTts = localStorage.getItem('aura_tts_memos_cache_v1');
      if (savedTts) localTts = JSON.parse(savedTts);
    } catch {}

    // 6. Gather Translations
    let localTranslations: any[] = [];
    try {
      const savedTranslations = localStorage.getItem('aura_translations_cache_v1');
      if (savedTranslations) localTranslations = JSON.parse(savedTranslations);
    } catch {}

    onProgress?.('Writing all records & media into SQLite 3GB storage...', 70);

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
