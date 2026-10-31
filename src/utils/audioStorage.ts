// IndexedDB Storage for Audio Tracks & Music Files
// Solves mobile browser localStorage 5MB QuotaExceededError by leveraging IndexedDB (hundreds of MBs / GBs quota)
// Enables 100% offline playback on mobile devices (iOS Safari, Android Chrome, PWA) without network connection

const DB_NAME = 'aura_audio_vault_db';
const STORE_NAME = 'audio_tracks';
const DB_VERSION = 1;

interface CachedAudioRecord {
  id: string;
  data: string | Blob;
  mimeType: string;
  savedAt: number;
}

function openAudioDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Stores an audio file (base64 Data URL or Blob) in IndexedDB
 */
export async function saveAudioToStorage(
  trackId: string,
  audioDataUrlOrBlob: string | Blob,
  mimeType = 'audio/mpeg'
): Promise<void> {
  try {
    const db = await openAudioDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const record: CachedAudioRecord = {
        id: trackId,
        data: audioDataUrlOrBlob,
        mimeType,
        savedAt: Date.now(),
      };
      const req = store.put(record);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[Audio Storage] Could not store audio in IndexedDB:', err);
  }
}

/**
 * Retrieves a playable audio URL (object URL or data URL) from IndexedDB
 */
export async function getAudioFromStorage(trackId: string): Promise<string | null> {
  try {
    const db = await openAudioDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(trackId);

      req.onsuccess = () => {
        const record = req.result as CachedAudioRecord | undefined;
        if (!record || !record.data) {
          resolve(null);
          return;
        }

        if (typeof record.data === 'string') {
          // If it's already a base64 data URL
          if (record.data.startsWith('data:audio/')) {
            resolve(record.data);
          } else {
            resolve(`data:${record.mimeType || 'audio/mpeg'};base64,${record.data}`);
          }
        } else if (record.data instanceof Blob) {
          const objectUrl = URL.createObjectURL(record.data);
          resolve(objectUrl);
        } else {
          resolve(null);
        }
      };

      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * Checks whether audio binary is present locally in IndexedDB
 */
export async function hasLocalAudioContent(trackId: string): Promise<boolean> {
  try {
    const db = await openAudioDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(trackId);
      req.onsuccess = () => {
        const res = req.result;
        resolve(Boolean(res && res.data));
      };
      req.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

/**
 * Retrieves all cached audio track IDs currently stored in IndexedDB
 */
export async function getAllCachedTrackIds(): Promise<string[]> {
  try {
    const db = await openAudioDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAllKeys();
      req.onsuccess = () => {
        const keys = req.result as string[];
        resolve(keys.map(String));
      };
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

/**
 * Removes an audio track from IndexedDB
 */
export async function deleteAudioFromStorage(trackId: string): Promise<void> {
  try {
    const db = await openAudioDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(trackId);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
  } catch {
    // Ignore
  }
}
