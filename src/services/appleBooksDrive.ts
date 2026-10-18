// Sovereign Apple Books Google Drive Sync Service
// Integrates Apple Books library directly into "Family Circle / Apple Books / [Category]" folder in Google Drive.
// Supports smart subfolder categorization, bidirectional Drive refresh, and on-demand stream/download.

import { Book } from '../types/book';
import { getOrCreateGoogleDriveFolder } from './googleWorkspace';
import { getApiUrl } from './api';

export const APPLE_BOOK_CATEGORIES = [
  'Fiction & Literature',
  'Finance & Investing',
  'Technology & Engineering',
  'Biographies & History',
  'Self-Help & Mindset',
  'Children & Education',
  'Science & Medicine',
  'Reference & Documents',
] as const;

export type AppleBookCategory = typeof APPLE_BOOK_CATEGORIES[number];

/**
 * Categorize a book into an Apple Books subfolder based on title, author, genre, and text details.
 */
export function categorizeBookSubfolder(
  title: string,
  author = '',
  genre = '',
  description = '',
  textSnippet = ''
): { category: AppleBookCategory; subfolderName: string } {
  const text = `${title} ${author} ${genre} ${description} ${textSnippet}`.toLowerCase();

  // 1. Finance & Investing
  if (
    text.includes('bitcoin') ||
    text.includes('crypto') ||
    text.includes('investing') ||
    text.includes('finance') ||
    text.includes('wealth') ||
    text.includes('venture') ||
    text.includes('stock') ||
    text.includes('capital') ||
    text.includes('money') ||
    text.includes('buffett') ||
    text.includes('economics')
  ) {
    return { category: 'Finance & Investing', subfolderName: 'Finance & Investing' };
  }

  // 2. Technology & Engineering
  if (
    text.includes('software') ||
    text.includes('programming') ||
    text.includes('algorithm') ||
    text.includes('robotics') ||
    text.includes('artificial intelligence') ||
    text.includes('machine learning') ||
    text.includes('stem') ||
    text.includes('computer') ||
    text.includes('python') ||
    text.includes('neural')
  ) {
    return { category: 'Technology & Engineering', subfolderName: 'Technology & Engineering' };
  }

  // 3. Biographies & History
  if (
    text.includes('biography') ||
    text.includes('autobiography') ||
    text.includes('memoir') ||
    text.includes('history') ||
    text.includes('dynasty') ||
    text.includes('empire') ||
    text.includes('revolution') ||
    text.includes('war') ||
    text.includes('chronicles')
  ) {
    return { category: 'Biographies & History', subfolderName: 'Biographies & History' };
  }

  // 4. Self-Help & Mindset
  if (
    text.includes('habits') ||
    text.includes('atomic') ||
    text.includes('mindset') ||
    text.includes('psychology') ||
    text.includes('behavior') ||
    text.includes('discipline') ||
    text.includes('focus') ||
    text.includes('leadership') ||
    text.includes('stoic') ||
    text.includes('meditations')
  ) {
    return { category: 'Self-Help & Mindset', subfolderName: 'Self-Help & Mindset' };
  }

  // 5. Children & Education
  if (
    text.includes('children') ||
    text.includes('kids') ||
    text.includes('storybook') ||
    text.includes('school') ||
    text.includes('education') ||
    text.includes('fable') ||
    text.includes('elementary')
  ) {
    return { category: 'Children & Education', subfolderName: 'Children & Education' };
  }

  // 6. Science & Medicine
  if (
    text.includes('biology') ||
    text.includes('physics') ||
    text.includes('chemistry') ||
    text.includes('medicine') ||
    text.includes('genetics') ||
    text.includes('health') ||
    text.includes('neuroscience')
  ) {
    return { category: 'Science & Medicine', subfolderName: 'Science & Medicine' };
  }

  // 7. Fiction & Literature
  if (
    text.includes('fiction') ||
    text.includes('novel') ||
    text.includes('poetry') ||
    text.includes('literature') ||
    text.includes('drama') ||
    text.includes('classics')
  ) {
    return { category: 'Fiction & Literature', subfolderName: 'Fiction & Literature' };
  }

  return { category: 'Reference & Documents', subfolderName: 'Reference & Documents' };
}

/**
 * Upload a book into Google Drive under:
 * {defaultFolder} / Apple Books / {Category}
 */
export async function uploadBookToDrive(
  accessToken: string | null | undefined,
  book: Book,
  fileBlobOrDataUrl: Blob | File | string,
  defaultFolder = 'Family Circle',
  userEmail?: string
): Promise<{
  driveFileId: string;
  driveFolderId: string;
  driveFolderPath: string;
  driveCategory: string;
  driveWebViewLink: string;
}> {
  if (!accessToken || !accessToken.trim()) {
    throw new Error('NO_GOOGLE_AUTH: Active Google account authorization is required to upload into Google Drive.');
  }

  // 1. Determine smart category & subfolder
  const { category, subfolderName } = categorizeBookSubfolder(
    book.title,
    book.author,
    book.genre,
    book.description,
    book.chapters?.[0]?.content?.join(' ')
  );

  // 2. Ensure folder hierarchy: {defaultFolder} -> Apple Books -> {Category}
  const rootFolder = await getOrCreateGoogleDriveFolder(accessToken, defaultFolder);
  const appleBooksFolder = await getOrCreateGoogleDriveFolder(accessToken, 'Apple Books', rootFolder.id);
  const categoryFolder = await getOrCreateGoogleDriveFolder(accessToken, subfolderName, appleBooksFolder.id);

  const driveFolderPath = `${rootFolder.name} / Apple Books / ${categoryFolder.name}`;

  // 3. Prepare Binary Blob
  let fileBlob: Blob;
  if (typeof fileBlobOrDataUrl === 'string') {
    if (fileBlobOrDataUrl.startsWith('data:')) {
      const parts = fileBlobOrDataUrl.split(',');
      const mime = parts[0].match(/:(.*?);/)?.[1] || 'application/pdf';
      const binaryStr = atob(parts[1]);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      fileBlob = new Blob([bytes], { type: mime });
    } else {
      // It's a text string or plain representation
      fileBlob = new Blob([fileBlobOrDataUrl], { type: 'application/pdf' });
    }
  } else {
    fileBlob = fileBlobOrDataUrl;
  }

  const cleanFileName = book.pdfFileName || `${book.title.replace(/[^a-zA-Z0-9_\- ]/g, '')}.pdf`;
  const boundary = `-------AppleBooksDriveBoundary${Date.now().toString(36)}${Math.random().toString(36).substring(2)}`;
  const metadata = {
    name: cleanFileName,
    mimeType: fileBlob.type || 'application/pdf',
    parents: [categoryFolder.id],
    description: `Aura Apple Books Library [${category}]: "${book.title}" by ${book.author}`,
  };

  const bodyBlob = new Blob(
    [
      `--${boundary}\r\n`,
      'Content-Type: application/json; charset=UTF-8\r\n\r\n',
      JSON.stringify(metadata),
      `\r\n--${boundary}\r\n`,
      `Content-Type: ${fileBlob.type || 'application/pdf'}\r\n\r\n`,
      fileBlob,
      `\r\n--${boundary}--`,
    ],
    {
      type: `multipart/related; boundary=${boundary}`,
    }
  );

  const driveRes = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,mimeType,modifiedTime,size,webViewLink,parents',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: bodyBlob,
    }
  );

  if (!driveRes.ok) {
    const errorBody = await driveRes.text().catch(() => '');
    throw new Error(`Google Drive Apple Books upload failed (${driveRes.status}): ${errorBody}`);
  }

  const driveData = await driveRes.json();
  const driveWebViewLink = driveData.webViewLink || `https://drive.google.com/file/d/${driveData.id}/view`;

  // Enforce parent folder guarantee for Apple Books subfolder
  let bookParents: string[] = Array.isArray(driveData.parents) ? driveData.parents : [];
  if (categoryFolder.id && !bookParents.includes(categoryFolder.id)) {
    console.warn(
      `[Apple Books Drive] Book ${driveData.id} was created with parents [${bookParents.join(',')}], moving directly to subfolder ${categoryFolder.id}...`
    );
    try {
      const moveParams = new URLSearchParams({
        addParents: categoryFolder.id,
        supportsAllDrives: 'true',
        fields: 'id,name,mimeType,modifiedTime,size,webViewLink,parents',
      });
      if (bookParents.length > 0) {
        moveParams.set('removeParents', bookParents.join(','));
      }
      const moveRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${driveData.id}?${moveParams.toString()}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );
      if (moveRes.ok) {
        const movedData = await moveRes.json();
        bookParents = Array.isArray(movedData.parents) ? movedData.parents : [categoryFolder.id];
        console.log(`[Apple Books Drive] Successfully confirmed book moved into subfolder: ${categoryFolder.id}`);
      }
    } catch (moveErr) {
      console.warn('[Apple Books Drive] Parent move correction warning:', moveErr);
    }
  }

  // 4. Mirror to server SQLite
  try {
    await fetch(getApiUrl('/api/google/drive/upload'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: driveData.id,
        name: cleanFileName,
        mimeType: driveData.mimeType || 'application/pdf',
        size: driveData.size ? `${(Number(driveData.size) / (1024 * 1024)).toFixed(1)} MB` : undefined,
        folderId: categoryFolder.id,
        folderName: driveFolderPath,
        category,
        webViewLink: driveWebViewLink,
        modifiedTime: driveData.modifiedTime || new Date().toISOString(),
        userEmail: userEmail || 'chinna.tamil2000@gmail.com',
        uploadedBy: 'apple_books',
      }),
    });
  } catch (err) {
    console.warn('[Apple Books Drive] SQLite mirror notice:', err);
  }

  return {
    driveFileId: driveData.id,
    driveFolderId: categoryFolder.id,
    driveFolderPath,
    driveCategory: category,
    driveWebViewLink,
  };
}

/**
 * Refresh and sync Apple Books from Google Drive folder:
 * Searches "{defaultFolder} / Apple Books" and all its category subfolders,
 * discovers any new books or updates, and reconciles with current library.
 */
export async function refreshAppleBooksFromDrive(
  accessToken: string | null | undefined,
  currentBooks: Book[],
  defaultFolder = 'Family Circle',
  _userEmail?: string
): Promise<{ books: Book[]; newCount: number }> {
  if (!accessToken || !accessToken.trim()) {
    return { books: currentBooks, newCount: 0 };
  }

  try {
    // 1. Locate {defaultFolder}
    const rootRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
        `mimeType = 'application/vnd.google-apps.folder' and name = '${defaultFolder}' and trashed = false`
      )}&fields=files(id,name)&pageSize=5`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const rootData = await rootRes.json();
    const rootFolderId = rootData.files?.[0]?.id;
    if (!rootFolderId) {
      return { books: currentBooks, newCount: 0 };
    }

    // 2. Locate "Apple Books" folder
    const abRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
        `mimeType = 'application/vnd.google-apps.folder' and name = 'Apple Books' and '${rootFolderId}' in parents and trashed = false`
      )}&fields=files(id,name)&pageSize=5`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const abData = await abRes.json();
    const appleBooksFolderId = abData.files?.[0]?.id;
    if (!appleBooksFolderId) {
      return { books: currentBooks, newCount: 0 };
    }

    // 3. Find subfolder categories inside "Apple Books"
    const subRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
        `mimeType = 'application/vnd.google-apps.folder' and '${appleBooksFolderId}' in parents and trashed = false`
      )}&fields=files(id,name)&pageSize=30`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const subData = await subRes.json();
    const subFolders: Array<{ id: string; name: string }> = subData.files || [];

    // Collect all folder IDs to scan (the Apple Books folder itself + all its category subfolders)
    const scanFolders = [
      { id: appleBooksFolderId, name: 'General', path: `${defaultFolder} / Apple Books` },
      ...subFolders.map((sf) => ({
        id: sf.id,
        name: sf.name,
        path: `${defaultFolder} / Apple Books / ${sf.name}`,
      })),
    ];

    const discoveredDriveFiles: Array<{
      file: any;
      folderPath: string;
      category: string;
    }> = [];

    for (const folder of scanFolders) {
      try {
        const filesRes = await fetch(
          `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
            `'${folder.id}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed = false`
          )}&fields=files(id,name,mimeType,size,modifiedTime,webViewLink)&pageSize=50`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (filesRes.ok) {
          const filesData = await filesRes.json();
          if (Array.isArray(filesData.files)) {
            filesData.files.forEach((f: any) => {
              discoveredDriveFiles.push({
                file: f,
                folderPath: folder.path,
                category: folder.name,
              });
            });
          }
        }
      } catch (err) {
        console.warn(`Error scanning folder ${folder.path}:`, err);
      }
    }

    // 4. Reconcile with existing books
    const existingById = new Map<string, Book>();
    const existingByDriveId = new Map<string, Book>();
    const existingByName = new Map<string, Book>();

    currentBooks.forEach((b) => {
      existingById.set(b.id, b);
      if (b.driveFileId) existingByDriveId.set(b.driveFileId, b);
      if (b.pdfFileName) existingByName.set(b.pdfFileName.toLowerCase(), b);
      existingByName.set(b.title.toLowerCase(), b);
    });

    let newCount = 0;
    const reconciledBooks = [...currentBooks];

    for (const item of discoveredDriveFiles) {
      const f = item.file;
      const existing =
        existingByDriveId.get(f.id) ||
        existingByName.get(f.name.toLowerCase()) ||
        existingByName.get(f.name.replace(/\.pdf$/i, '').toLowerCase());

      if (existing) {
        // Update drive metadata on existing book
        const idx = reconciledBooks.findIndex((b) => b.id === existing.id);
        if (idx !== -1) {
          reconciledBooks[idx] = {
            ...reconciledBooks[idx],
            driveFileId: f.id,
            driveFolderId: f.parents?.[0],
            driveFolderPath: item.folderPath,
            driveCategory: item.category,
            driveWebViewLink: f.webViewLink || reconciledBooks[idx].driveWebViewLink,
          };
        }
      } else {
        // Construct new Book entry discovered from Google Drive
        newCount++;
        const cleanTitle = f.name.replace(/\.pdf$/i, '').replace(/[-_]/g, ' ');
        const sizeFormatted = f.size ? `${(Number(f.size) / (1024 * 1024)).toFixed(1)} MB` : 'Cloud Document';

        const newBook: Book = {
          id: `drive-book-${f.id}`,
          title: cleanTitle,
          subtitle: `Synced from Drive (${item.category} • ${sizeFormatted})`,
          author: 'Sovereign Google Drive Library',
          genre: item.category || 'PDF & Documents',
          coverGradient: 'from-blue-950 via-slate-900 to-indigo-950',
          accentColor: '#3b82f6',
          rating: 5.0,
          reviewCount: 1,
          totalPages: 10,
          currentPage: 1,
          currentChapterId: 'ch-1',
          progressPercent: 0,
          isFinished: false,
          wantToRead: true,
          addedAt: f.modifiedTime || new Date().toISOString(),
          description: `Book discovered in Google Drive under "${item.folderPath}". Ready for instant reading and voice read-aloud.`,
          isPdf: true,
          pdfFileName: f.name,
          pdfFileSize: sizeFormatted,
          pdfPageCount: 10,
          driveFileId: f.id,
          driveFolderPath: item.folderPath,
          driveCategory: item.category,
          driveWebViewLink: f.webViewLink || `https://drive.google.com/file/d/${f.id}/view`,
          isLocalCached: false,
          chapters: [
            {
              id: 'ch-1',
              title: cleanTitle,
              readingTimeMinutes: 5,
              content: [
                `Document "${f.name}" synchronized from your sovereign Google Drive folder "${item.folderPath}".`,
                'Tap to open and read directly inside Apple Books.',
              ],
            },
          ],
        };

        reconciledBooks.unshift(newBook);
      }
    }

    return { books: reconciledBooks, newCount };
  } catch (err) {
    console.error('Failed to refresh Apple Books from Google Drive:', err);
    return { books: currentBooks, newCount: 0 };
  }
}

/**
 * Downloads a book's PDF content from Google Drive on-demand for offline viewing and reading.
 */
export async function downloadBookContentFromDrive(
  accessToken: string | null | undefined,
  driveFileId: string
): Promise<string> {
  if (!accessToken) throw new Error('NO_GOOGLE_AUTH: Active Google authorization required to download book.');

  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${driveFileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`Failed to download book from Google Drive (${res.status})`);
  }

  const blob = await res.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
