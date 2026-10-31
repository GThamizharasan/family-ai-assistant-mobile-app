// Sovereign Adobe Document Scanner & Google Drive Sync Service
// Integrates Scanned Documents directly into "Family Circle / Adobe Scans" folder in Google Drive.
// Supports multi-page PDF generation, local IndexedDB persistence, device downloading,
// external sharing, Drive synchronization, and favorites management.

import { ScannedDocument, ScanCategory, ScannedPage } from '../types/documentScanner';
import { getOrCreateGoogleDriveFolder } from './googleWorkspace';
import { saveScanPdfToStorage, getScanPdfFromStorage, deleteScanPdfFromStorage } from '../utils/scanStorage';
import { generatePdfFromScannedPages } from '../utils/pdfGenerator';

const LOCAL_STORAGE_KEY = 'aura_adobe_scanned_docs_v1';
export const DRIVE_FOLDER_NAME = 'Adobe Scans';

/**
 * Retrieve cached local scanned documents metadata
 */
export function getLocalScannedDocuments(): ScannedDocument[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.warn('Failed to parse local scanned documents:', err);
    return [];
  }
}

/**
 * Persist cached scanned documents metadata to localStorage (sanitizing heavy page base64)
 */
export function saveLocalScannedDocuments(docs: ScannedDocument[]) {
  if (typeof window === 'undefined') return;
  try {
    const sanitized = docs.map((d) => ({
      ...d,
      pdfContentBase64: undefined, // Binary stored in IndexedDB aura_scanner_vault_db
      pdfBlobUrl: undefined,
      pages: (d.pages || []).map((p) => ({
        ...p,
        // Keep small page preview data if tiny, else strip to prevent 5MB quota error
        dataUrl: p.dataUrl && p.dataUrl.length > 100000 ? '' : p.dataUrl,
      })),
    }));
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(sanitized));
  } catch (err) {
    console.warn('Failed to save scanned documents to localStorage:', err);
  }
}

/**
 * Upload a generated PDF document directly to Google Drive in "Family Circle / Adobe Scans"
 */
export async function uploadScannedPdfToDrive(
  accessToken: string,
  doc: ScannedDocument,
  pdfBase64OrBytes?: string | Uint8Array
): Promise<{ driveFileId: string; webViewLink: string; folderId: string }> {
  // 1. Ensure "Family Circle" root folder
  const familyCircleFolder = await getOrCreateGoogleDriveFolder(accessToken, 'Family Circle');

  // 2. Ensure "Adobe Scans" subfolder
  const scansFolder = await getOrCreateGoogleDriveFolder(
    accessToken,
    DRIVE_FOLDER_NAME,
    familyCircleFolder.id
  );

  // 3. Resolve PDF binary
  let binaryBytes: Uint8Array;
  if (pdfBase64OrBytes instanceof Uint8Array) {
    binaryBytes = pdfBase64OrBytes;
  } else if (typeof pdfBase64OrBytes === 'string') {
    const cleanB64 = pdfBase64OrBytes.replace(/^data:application\/pdf;base64,/, '');
    const binStr = atob(cleanB64);
    binaryBytes = new Uint8Array(binStr.length);
    for (let i = 0; i < binStr.length; i++) {
      binaryBytes[i] = binStr.charCodeAt(i);
    }
  } else {
    // Try to read from IndexedDB
    const cachedUrl = await getScanPdfFromStorage(doc.id);
    if (!cachedUrl) {
      throw new Error('No PDF content available to upload to Google Drive');
    }
    const cleanB64 = cachedUrl.replace(/^data:application\/pdf;base64,/, '');
    const binStr = atob(cleanB64);
    binaryBytes = new Uint8Array(binStr.length);
    for (let i = 0; i < binStr.length; i++) {
      binaryBytes[i] = binStr.charCodeAt(i);
    }
  }

  const safeTitle = (doc.title || 'Scanned_Document').trim().replace(/[/\\?%*:|"<>]/g, '_');
  const fileName = safeTitle.toLowerCase().endsWith('.pdf') ? safeTitle : `${safeTitle}.pdf`;

  const metadata = {
    name: fileName,
    mimeType: 'application/pdf',
    parents: [scansFolder.id],
    description: `Auro Adobe Document Scan\nCategory: ${doc.category}\nPages: ${doc.pageCount}\nDate: ${new Date(
      doc.createdAt
    ).toLocaleString()}`,
  };

  const boundary = `-------AuroAdobeScanBoundary${Date.now()}`;
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const enc = new TextEncoder();
  const metadataPart = `${delimiter}Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(
    metadata
  )}\r\n`;
  const mediaHeader = `${delimiter}Content-Type: application/pdf\r\nContent-Transfer-Encoding: binary\r\n\r\n`;

  const metadataBytes = enc.encode(metadataPart);
  const mediaHeaderBytes = enc.encode(mediaHeader);
  const closeDelimiterBytes = enc.encode(closeDelimiter);

  const fullPayload = new Uint8Array(
    metadataBytes.length + mediaHeaderBytes.length + binaryBytes.length + closeDelimiterBytes.length
  );

  let offset = 0;
  fullPayload.set(metadataBytes, offset);
  offset += metadataBytes.length;
  fullPayload.set(mediaHeaderBytes, offset);
  offset += mediaHeaderBytes.length;
  fullPayload.set(binaryBytes, offset);
  offset += binaryBytes.length;
  fullPayload.set(closeDelimiterBytes, offset);

  const res = await fetch(
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

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Google Drive upload failed (${res.status}): ${errText}`);
  }

  const uploaded = await res.json();
  const webViewLink = uploaded.webViewLink || `https://drive.google.com/file/d/${uploaded.id}/view`;

  return {
    driveFileId: uploaded.id,
    webViewLink,
    folderId: scansFolder.id,
  };
}

/**
 * Fetch all scanned documents (merging local cache and Google Drive files)
 */
export async function fetchScannedDocuments(
  googleAccessToken?: string | null,
  userEmail?: string
): Promise<ScannedDocument[]> {
  const map = new Map<string, ScannedDocument>();

  // 1. Local Cache
  const localList = getLocalScannedDocuments();
  localList.forEach((d) => map.set(d.id, d));

  // 2. Fetch remote files from Google Drive "Family Circle / Adobe Scans"
  if (googleAccessToken) {
    try {
      const familyCircleFolder = await getOrCreateGoogleDriveFolder(googleAccessToken, 'Family Circle');
      const scansFolder = await getOrCreateGoogleDriveFolder(
        googleAccessToken,
        DRIVE_FOLDER_NAME,
        familyCircleFolder.id
      );

      const q = `'${scansFolder.id}' in parents and trashed = false and mimeType = 'application/pdf'`;
      const driveRes = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
          q
        )}&fields=files(id,name,mimeType,size,webViewLink,createdTime,description,thumbnailLink)&pageSize=50&orderBy=createdTime desc`,
        { headers: { Authorization: `Bearer ${googleAccessToken}` } }
      );

      if (driveRes.ok) {
        const data = await driveRes.json();
        const driveFiles = data.files || [];

        for (const df of driveFiles) {
          const match = Array.from(map.values()).find(
            (d) =>
              d.driveFileId === df.id ||
              d.id === df.id ||
              d.id === `drive_${df.id}` ||
              d.title.toLowerCase() === df.name.replace(/\.pdf$/i, '').toLowerCase()
          );

          if (match) {
            match.driveFileId = df.id;
            match.driveWebViewLink = df.webViewLink;
            match.driveSyncStatus = 'synced';
          } else {
            // Discovered PDF on Drive
            const newDoc: ScannedDocument = {
              id: `drive_${df.id}`,
              userEmail: userEmail || 'chinna.tamil2000@gmail.com',
              title: df.name.replace(/\.pdf$/i, ''),
              category: 'Personal',
              pages: [],
              pageCount: 1,
              fileSizeBytes: Number(df.size || 0),
              thumbnailDataUrl: df.thumbnailLink,
              driveFileId: df.id,
              driveWebViewLink: df.webViewLink,
              driveFolderPath: `Family Circle/${DRIVE_FOLDER_NAME}`,
              driveSyncStatus: 'synced',
              isFavorite: false,
              createdAt: df.createdTime || new Date().toISOString(),
              updatedAt: df.createdTime || new Date().toISOString(),
            };
            map.set(newDoc.id, newDoc);

            // Background pre-cache PDF binary into IndexedDB
            void fetch(`https://www.googleapis.com/drive/v3/files/${df.id}?alt=media`, {
              headers: { Authorization: `Bearer ${googleAccessToken}` },
            })
              .then(async (bRes) => {
                if (bRes.ok) {
                  const blob = await bRes.blob();
                  const reader = new FileReader();
                  reader.onloadend = () => {
                    const result = reader.result as string;
                    if (result) void saveScanPdfToStorage(newDoc.id, result);
                  };
                  reader.readAsDataURL(blob);
                }
              })
              .catch(() => {});
          }
        }
      }
    } catch (dErr) {
      console.warn('Google Drive scan documents discovery note:', dErr);
    }
  }

  const result = Array.from(map.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  saveLocalScannedDocuments(result);
  return result;
}

/**
 * Save new or modified scanned document, generate its PDF, persist to IndexedDB and sync to Drive
 */
export async function saveScannedDocument(
  doc: ScannedDocument,
  googleAccessToken?: string | null
): Promise<ScannedDocument> {
  let updated = { ...doc };

  // 1. Generate authentic PDF 1.4 binary if not already provided
  let pdfDataUrl = updated.pdfContentBase64;
  let pdfBlob: Blob | undefined;

  if (!pdfDataUrl && updated.pages && updated.pages.length > 0) {
    try {
      const gen = await generatePdfFromScannedPages(updated.pages, updated.title);
      pdfDataUrl = gen.dataUrl;
      pdfBlob = gen.blob;
      updated.fileSizeBytes = gen.fileSizeBytes;
      updated.pdfContentBase64 = gen.dataUrl;
      updated.pdfBlobUrl = URL.createObjectURL(gen.blob);
      if (!updated.thumbnailDataUrl && updated.pages[0]?.dataUrl) {
        updated.thumbnailDataUrl = updated.pages[0].dataUrl;
      }
    } catch (genErr) {
      console.warn('PDF generation error:', genErr);
    }
  }

  // 2. Persist PDF binary directly into Client SQLite & IndexedDB store
  if (pdfDataUrl) {
    try {
      await saveScanPdfToStorage(updated.id, pdfDataUrl);
    } catch (idbErr) {
      console.warn('[Scan Storage] IndexedDB save error:', idbErr);
    }
  }

  // 3. Upload to Google Drive if access token is available
  if (googleAccessToken && pdfDataUrl) {
    try {
      const driveInfo = await uploadScannedPdfToDrive(googleAccessToken, updated, pdfDataUrl);
      updated.driveFileId = driveInfo.driveFileId;
      updated.driveWebViewLink = driveInfo.webViewLink;
      updated.driveFolderPath = `Family Circle/${DRIVE_FOLDER_NAME}`;
      updated.driveSyncStatus = 'synced';
    } catch (driveErr) {
      console.warn('Google Drive scan upload notice (saved locally):', driveErr);
      updated.driveSyncStatus = 'local_only';
    }
  } else {
    updated.driveSyncStatus = updated.driveFileId ? 'synced' : 'local_only';
  }

  // 4. Update local cache
  const list = getLocalScannedDocuments().filter((d) => d.id !== updated.id);
  list.unshift(updated);
  saveLocalScannedDocuments(list);

  // 5. Dispatch sync event
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('aura_sqlite_synced'));
  }

  return updated;
}

/**
 * Delete a scanned document from local IndexedDB, localStorage, and Google Drive
 */
export async function deleteScannedDocument(
  doc: ScannedDocument,
  googleAccessToken?: string | null
): Promise<boolean> {
  // 1. Remove from IndexedDB
  await deleteScanPdfFromStorage(doc.id);

  // 2. Remove from local cache
  const list = getLocalScannedDocuments().filter((d) => d.id !== doc.id);
  saveLocalScannedDocuments(list);

  // 3. If on Google Drive, delete file
  if (googleAccessToken && doc.driveFileId) {
    try {
      await fetch(`https://www.googleapis.com/drive/v3/files/${doc.driveFileId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${googleAccessToken}` },
      });
    } catch (dErr) {
      console.warn('Google Drive delete error:', dErr);
    }
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('aura_sqlite_synced'));
  }

  return true;
}

/**
 * Toggle favorite status
 */
export function toggleDocumentFavorite(id: string, isFavorite: boolean): ScannedDocument | null {
  const list = getLocalScannedDocuments();
  const doc = list.find((d) => d.id === id);
  if (!doc) return null;

  doc.isFavorite = isFavorite;
  doc.updatedAt = new Date().toISOString();
  saveLocalScannedDocuments(list);
  return doc;
}

/**
 * Download scanned PDF directly to device
 */
export async function downloadScannedPdf(doc: ScannedDocument): Promise<void> {
  let downloadUrl = doc.pdfBlobUrl;

  if (!downloadUrl) {
    const cachedDataUrl = await getScanPdfFromStorage(doc.id);
    if (cachedDataUrl) {
      downloadUrl = cachedDataUrl;
    } else if (doc.driveFileId) {
      downloadUrl = `https://drive.google.com/uc?export=download&id=${doc.driveFileId}`;
    }
  }

  if (!downloadUrl) {
    throw new Error('No PDF content available to download.');
  }

  const safeTitle = (doc.title || 'Scanned_Document').trim().replace(/[/\\?%*:|"<>]/g, '_');
  const filename = safeTitle.toLowerCase().endsWith('.pdf') ? safeTitle : `${safeTitle}.pdf`;

  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/**
 * Share scanned document via Web Share API or external link
 */
export async function shareScannedPdf(doc: ScannedDocument): Promise<boolean> {
  const shareTitle = `${doc.title} (Adobe Document Scan)`;
  const shareText = `Check out this document "${doc.title}" (${doc.pageCount} pages, ${doc.category}) scanned via Auro Adobe Scanner.`;

  // 1. Try Native Web Share with PDF File
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      const cachedDataUrl = await getScanPdfFromStorage(doc.id);
      if (cachedDataUrl && navigator.canShare) {
        const cleanB64 = cachedDataUrl.replace(/^data:application\/pdf;base64,/, '');
        const binStr = atob(cleanB64);
        const bytes = new Uint8Array(binStr.length);
        for (let i = 0; i < binStr.length; i++) {
          bytes[i] = binStr.charCodeAt(i);
        }
        const file = new File([bytes], `${doc.title || 'Scanned_Doc'}.pdf`, {
          type: 'application/pdf',
        });

        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: shareTitle,
            text: shareText,
            files: [file],
          });
          return true;
        }
      }

      // Fallback share URL
      const shareUrl = doc.driveWebViewLink || window.location.href;
      await navigator.share({
        title: shareTitle,
        text: shareText,
        url: shareUrl,
      });
      return true;
    } catch (err: any) {
      if (err.name === 'AbortError') return false;
    }
  }

  // 2. Fallback: Copy link or download
  if (doc.driveWebViewLink && typeof navigator !== 'undefined' && navigator.clipboard) {
    await navigator.clipboard.writeText(doc.driveWebViewLink);
    return true;
  }

  await downloadScannedPdf(doc);
  return true;
}
