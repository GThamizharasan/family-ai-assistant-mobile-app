// IndexedDB Storage for large PDF Documents
// Solves browser localStorage 5MB QuotaExceededError by leveraging IndexedDB (hundreds of MBs quota)
import { Book } from '../types/book';

export const MAX_LOCAL_RECENT_BOOKS = 20;

const DB_NAME = 'aura_pdf_vault_db';
const STORE_NAME = 'pdf_documents';
const DB_VERSION = 1;

function openPdfDb(): Promise<IDBDatabase> {
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
 * Stores a PDF data URL / Blob in IndexedDB
 */
export async function savePdfToStorage(bookId: string, pdfDataUrl: string): Promise<void> {
  try {
    const db = await openPdfDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put({ id: bookId, data: pdfDataUrl, savedAt: Date.now() });

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Could not store PDF in IndexedDB:', err);
  }
}

/**
 * Retrieves a PDF data URL from IndexedDB
 */
export async function getPdfFromStorage(bookId: string): Promise<string | null> {
  try {
    const db = await openPdfDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(bookId);

      req.onsuccess = () => {
        if (req.result && req.result.data) {
          resolve(req.result.data);
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
 * Removes a PDF from IndexedDB
 */
export async function deletePdfFromStorage(bookId: string): Promise<void> {
  try {
    const db = await openPdfDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(bookId);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
  } catch {
    // Ignore
  }
}

/**
 * Safe localStorage setter that never crashes on QuotaExceededError
 */
export function safeSetLocalStorage(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err) {
    console.warn(`localStorage quota exceeded for key "${key}". Suppressing fatal error.`, err);
    try {
      // If quota exceeded, clean up stale non-critical keys
      const keysToClean = ['aura_cached_voice', 'aura_temp_preview', 'aura_ibooks_preview_cache'];
      keysToClean.forEach((k) => localStorage.removeItem(k));
      localStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Checks whether full book binary is present locally in IndexedDB
 */
export async function hasLocalBookContent(bookId: string): Promise<boolean> {
  const content = await getPdfFromStorage(bookId);
  return Boolean(content && content.length > 50);
}

/**
 * Manages local version retention for recent 20 books (LRU eviction).
 * Keeps local content for the top 20 most recently accessed or added books,
 * and clears heavy IndexedDB binary for older books (preserving metadata).
 */
export async function manageRecentBooksCache(
  allBooks: Book[],
  maxLocalBooks = MAX_LOCAL_RECENT_BOOKS
): Promise<Book[]> {
  if (!allBooks || allBooks.length === 0) return [];

  // Sort books by recency: lastAccessedAt -> cachedAt -> addedAt
  const sorted = [...allBooks].sort((a, b) => {
    const timeA = new Date(a.lastAccessedAt || a.cachedAt || a.addedAt || 0).getTime();
    const timeB = new Date(b.lastAccessedAt || b.cachedAt || b.addedAt || 0).getTime();
    return timeB - timeA;
  });

  const updatedBooks: Book[] = [];

  for (let idx = 0; idx < sorted.length; idx++) {
    const book = sorted[idx];
    if (idx < maxLocalBooks) {
      // Keep within top 20 local versions
      const isCached = await hasLocalBookContent(book.id);
      updatedBooks.push({
        ...book,
        isLocalCached: isCached,
      });
    } else {
      // Beyond top 20: purge local binary to preserve device storage while keeping metadata
      if (book.isLocalCached || book.isPdf) {
        await deletePdfFromStorage(book.id);
      }
      updatedBooks.push({
        ...book,
        isLocalCached: false,
      });
    }
  }

  return updatedBooks;
}

/**
 * Mark a book as recently accessed, store its binary if provided,
 * and enforce the recent 20 books cache limit.
 */
export async function markBookAccessedAndCache(
  bookId: string,
  allBooks: Book[],
  binaryDataUrl?: string
): Promise<Book[]> {
  if (binaryDataUrl) {
    await savePdfToStorage(bookId, binaryDataUrl);
  }

  const now = new Date().toISOString();
  const touchedBooks = allBooks.map((b) =>
    b.id === bookId
      ? {
          ...b,
          lastAccessedAt: now,
          cachedAt: binaryDataUrl ? now : b.cachedAt || now,
          isLocalCached: true,
        }
      : b
  );

  return await manageRecentBooksCache(touchedBooks, MAX_LOCAL_RECENT_BOOKS);
}
