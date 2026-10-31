// IndexedDB Storage for Adobe Scanned Document PDFs
// Solves mobile browser localStorage 5MB quota limits by storing full binary PDFs in IndexedDB
// Provides 100% offline document access and instant PDF rendering without network

const DB_NAME = 'aura_scanner_vault_db';
const STORE_NAME = 'scanned_documents_pdf';
const DB_VERSION = 1;

interface CachedScanRecord {
  id: string;
  data: string; // Base64 or Data URL of PDF
  savedAt: number;
  sizeBytes: number;
}

function openScannerDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported in current environment'));
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
 * Stores a PDF binary data URL in IndexedDB
 */
export async function saveScanPdfToStorage(docId: string, pdfDataUrl: string): Promise<void> {
  try {
    const db = await openScannerDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const approxBytes = Math.round((pdfDataUrl.length * 3) / 4);

      const record: CachedScanRecord = {
        id: docId,
        data: pdfDataUrl,
        savedAt: Date.now(),
        sizeBytes: approxBytes,
      };

      const req = store.put(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[Scan Storage] Could not store PDF in IndexedDB:', err);
  }
}

/**
 * Retrieves a PDF data URL from IndexedDB
 */
export async function getScanPdfFromStorage(docId: string): Promise<string | null> {
  try {
    const db = await openScannerDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(docId);

      req.onsuccess = () => {
        const record = req.result as CachedScanRecord | undefined;
        if (record && record.data) {
          resolve(record.data);
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
 * Deletes a PDF from IndexedDB
 */
export async function deleteScanPdfFromStorage(docId: string): Promise<void> {
  try {
    const db = await openScannerDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(docId);

      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
  } catch {
    // Ignore error
  }
}

/**
 * Lists all cached scan document IDs
 */
export async function getAllCachedScanIds(): Promise<string[]> {
  try {
    const db = await openScannerDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAllKeys();

      req.onsuccess = () => {
        resolve((req.result as string[]) || []);
      };

      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

/**
 * Get total storage statistics for Adobe Scans
 */
export async function getScansStorageStats(): Promise<{ count: number; totalMb: number }> {
  try {
    const db = await openScannerDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => {
        const records = (req.result as CachedScanRecord[]) || [];
        const count = records.length;
        const totalBytes = records.reduce((sum, r) => sum + (r.sizeBytes || 0), 0);
        resolve({
          count,
          totalMb: +(totalBytes / (1024 * 1024)).toFixed(2),
        });
      };

      req.onerror = () => resolve({ count: 0, totalMb: 0 });
    });
  } catch {
    return { count: 0, totalMb: 0 };
  }
}
