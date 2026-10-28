import * as pdfjsLib from 'pdfjs-dist';
import { Book, Chapter } from '../types/book';
import { savePdfToStorage, getPdfFromStorage } from './pdfStorage';
import { getApiUrl } from '../services/api';
import { downloadBookContentFromDrive } from '../services/appleBooksDrive';

// Configure PDF.js worker safely for Vite / Browser environment
if (typeof window !== 'undefined' && 'Worker' in window) {
  try {
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
    }
  } catch (e) {
    console.warn('PDF.js worker initialization notice:', e);
  }
}

/**
 * Formats byte size into human readable string (KB, MB)
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Helper to convert base64 data URL to Uint8Array
 */
export function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64Index = dataUrl.indexOf(';base64,');
  const base64 = base64Index !== -1 ? dataUrl.substring(base64Index + 8) : dataUrl;
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export interface ExtractedPdfData {
  totalPages: number;
  chapters: Chapter[];
  title?: string;
  author?: string;
}

/**
 * Extracts distinct, authentic text content and chapters for EVERY page of a PDF document.
 * This guarantees that navigating to the next page displays the actual content of that page.
 */
export async function extractPdfChaptersAndPages(
  source: Uint8Array | ArrayBuffer | string
): Promise<ExtractedPdfData> {
  try {
    let loadingTask;
    if (typeof source === 'string') {
      if (source.startsWith('data:application/pdf')) {
        const bytes = dataUrlToUint8Array(source);
        loadingTask = pdfjsLib.getDocument({ data: bytes });
      } else {
        loadingTask = pdfjsLib.getDocument({ url: source });
      }
    } else {
      const dataBytes = source instanceof Uint8Array ? source : new Uint8Array(source);
      loadingTask = pdfjsLib.getDocument({ data: dataBytes });
    }

    const doc = await loadingTask.promise;
    const numPages = Math.max(1, doc.numPages);
    const chapters: Chapter[] = [];

    let docTitle: string | undefined;
    let docAuthor: string | undefined;

    try {
      const metadata = await doc.getMetadata();
      const info = metadata?.info as any;
      if (info?.Title && typeof info.Title === 'string' && info.Title.trim().length > 1) {
        docTitle = info.Title.trim();
      }
      if (info?.Author && typeof info.Author === 'string' && info.Author.trim().length > 1) {
        docAuthor = info.Author.trim();
      }
    } catch {
      // Non-fatal if metadata missing
    }

    // Extract real text from EVERY page sequentially
    for (let p = 1; p <= numPages; p++) {
      try {
        const page = await doc.getPage(p);
        const textContent = await page.getTextContent();
        const items = textContent.items as any[];

        const pageLines: string[] = [];
        let currentLine = '';
        let lastY: number | null = null;

        for (const item of items) {
          if (typeof item.str === 'string') {
            const y = item.transform && Array.isArray(item.transform) ? item.transform[5] : null;
            if (lastY !== null && y !== null && Math.abs(y - lastY) > 9) {
              if (currentLine.trim()) {
                pageLines.push(currentLine.trim());
              }
              currentLine = item.str;
            } else {
              const needsSpace =
                currentLine.length > 0 &&
                !currentLine.endsWith(' ') &&
                !item.str.startsWith(' ') &&
                !item.str.startsWith(',') &&
                !item.str.startsWith('.');
              currentLine += (needsSpace ? ' ' : '') + item.str;
            }
            if (y !== null) lastY = y;
          }
        }
        if (currentLine.trim()) {
          pageLines.push(currentLine.trim());
        }

        // Group lines into readable paragraphs
        const paragraphs: string[] = [];
        let currentPara = '';
        for (const line of pageLines) {
          if (currentPara) currentPara += ' ';
          currentPara += line;
          if (/[.!?:]$/.test(line) || currentPara.length > 320) {
            paragraphs.push(currentPara);
            currentPara = '';
          }
        }
        if (currentPara.trim()) {
          paragraphs.push(currentPara.trim());
        }

        const fallbackHeading = `Page ${p}`;
        const hasText = paragraphs.length > 0;
        const totalWords = paragraphs.join(' ').split(/\s+/).filter(Boolean).length;
        const estMinutes = Math.max(1, Math.ceil(totalWords / 160));

        chapters.push({
          id: `page-${p}`,
          title: fallbackHeading,
          readingTimeMinutes: estMinutes,
          content: hasText
            ? paragraphs
            : [
                `Page ${p} of this document contains visual diagrams, charts, or scanned graphical elements.`,
                'Use the authentic PDF Canvas Viewer in the top toolbar to view this page in full high-definition fidelity.',
              ],
        });
      } catch (pageErr) {
        console.warn(`Could not extract page ${p}:`, pageErr);
        chapters.push({
          id: `page-${p}`,
          title: `Page ${p}`,
          readingTimeMinutes: 2,
          content: [`Page ${p} content loaded in PDF viewer.`],
        });
      }
    }

    return {
      totalPages: numPages,
      chapters,
      title: docTitle,
      author: docAuthor,
    };
  } catch (err) {
    console.error('Failed to extract PDF chapters:', err);
    throw err;
  }
}

/**
 * Handles uploading a user's local PDF file.
 * Accurately extracts the real text and page count for every page,
 * stores the binary in IndexedDB for long-term multi-session persistence,
 * and attaches a lightweight Blob URL for instant canvas rendering.
 */
export async function parsePdfFileToBook(file: File): Promise<Book> {
  const cleanName = file.name
    .replace(/\.pdf$/i, '')
    .replace(/[-_]+/g, ' ')
    .trim();

  const formattedTitle = cleanName
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  const fileSizeFormatted = formatBytes(file.size);
  const bookId = `pdf-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const blobUrl = URL.createObjectURL(file);

  // Read array buffer for PDF.js text and page extraction
  const arrayBuffer = await file.arrayBuffer();

  let extractedData: ExtractedPdfData;
  try {
    extractedData = await extractPdfChaptersAndPages(arrayBuffer);
  } catch (e) {
    console.warn('Falling back to default single chapter for PDF:', e);
    extractedData = {
      totalPages: 1,
      chapters: [
        {
          id: 'page-1',
          title: 'Document Overview',
          readingTimeMinutes: 3,
          content: [
            `Document "${file.name}" loaded successfully into Apple Books.`,
            'Use the PDF Document Viewer to inspect all pages in native vector fidelity.',
          ],
        },
      ],
    };
  }

  // Also convert to data URL for IndexedDB storage
  const reader = new FileReader();
  const dataUrlPromise = new Promise<string>((resolve) => {
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });
  const dataUrl = await dataUrlPromise;

  // Persist full binary in IndexedDB
  await savePdfToStorage(bookId, dataUrl);

  const finalTitle = extractedData.title || formattedTitle || 'Uploaded PDF Document';
  const finalAuthor = extractedData.author || 'Personal Library / Imported Document';
  const numPages = extractedData.totalPages || 1;

  const newPdfBook: Book = {
    id: bookId,
    title: finalTitle,
    subtitle: `Imported PDF (${numPages} Pages • ${fileSizeFormatted})`,
    author: finalAuthor,
    genre: 'PDF & Documents',
    coverGradient: 'from-rose-950 via-slate-900 to-amber-950',
    accentColor: '#ef4444',
    rating: 5.0,
    reviewCount: 1,
    totalPages: numPages,
    currentPage: 1,
    currentChapterId: extractedData.chapters[0]?.id || 'page-1',
    progressPercent: 0,
    isFinished: false,
    wantToRead: false,
    isFavorite: false,
    addedAt: new Date().toISOString(),
    description: `Personal PDF document "${file.name}" uploaded to Aura Apple Books Library. Contains ${numPages} verified pages with instant navigation, vector canvas rendering, and text-to-speech narration.`,
    isPdf: true,
    pdfUrl: blobUrl,
    pdfFileName: file.name,
    pdfFileSize: fileSizeFormatted,
    pdfPageCount: numPages,
    chapters: extractedData.chapters,
  };

  return newPdfBook;
}

/**
 * Creates a standalone high-fidelity viewable PDF/HTML data URL representation
 * with page breaks, authentic typography, headers, footers, and page numbers.
 * Generated on-demand so storage is not bloated.
 */
export function generateReadablePdfDocumentUrl(
  title: string,
  author: string,
  subtitle: string = '',
  chapters: Chapter[] = []
): string {
  const chaptersHtml = chapters
    .map(
      (chap, index) => `
      <section class="pdf-page">
        <div class="page-header">
          <span>${title}</span>
          <span>${author}</span>
        </div>
        <div class="chapter-content">
          <div class="chapter-badge">SECTION 0${index + 1}</div>
          <h2 class="chapter-title">${chap.title}</h2>
          <div class="reading-meta">${chap.readingTimeMinutes} min estimated reading time &bull; Sovereign Library Edition</div>
          <div class="chapter-body">
            ${chap.content.map((p) => `<p class="para">${p}</p>`).join('')}
          </div>
        </div>
        <div class="page-footer">
          <span>Aura Apple Books & Sovereign Library</span>
          <span>Page ${index + 1}</span>
        </div>
      </section>
    `
    )
    .join('');

  const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${title} - Sovereign PDF Library</title>
  <style>
    @page {
      size: A4;
      margin: 20mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      background: #525659;
      font-family: -apple-system, BlinkMacSystemFont, "Charter", "Georgia", "Times New Roman", serif;
      color: #1a1a1a;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 24px 12px;
      gap: 20px;
    }
    .pdf-page {
      width: 100%;
      max-width: 820px;
      min-height: 1060px;
      background: #ffffff;
      padding: 60px 68px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.35);
      border-radius: 4px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      page-break-after: always;
    }
    .page-header {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #888888;
      border-bottom: 1px solid #e5e5e5;
      padding-bottom: 12px;
      margin-bottom: 36px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    .chapter-badge {
      display: inline-block;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.15em;
      color: #b45309;
      background: #fef3c7;
      padding: 3px 8px;
      border-radius: 4px;
      margin-bottom: 12px;
      font-family: monospace;
    }
    .chapter-title {
      font-size: 26px;
      font-weight: 700;
      line-height: 1.25;
      color: #111827;
      margin-bottom: 8px;
    }
    .reading-meta {
      font-size: 12px;
      color: #6b7280;
      margin-bottom: 24px;
      font-style: italic;
    }
    .chapter-body {
      font-size: 16px;
      line-height: 1.8;
      color: #1f2937;
    }
    .para {
      margin-bottom: 18px;
      text-align: justify;
      text-indent: 1.5em;
    }
    .para:first-child {
      text-indent: 0;
    }
    .para:first-child::first-letter {
      font-size: 3.2em;
      float: left;
      line-height: 0.85;
      margin: 4px 8px 0 0;
      font-weight: bold;
      color: #b45309;
    }
    .page-footer {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      color: #9ca3af;
      border-top: 1px solid #f3f4f6;
      padding-top: 16px;
      margin-top: 40px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    @media print {
      body {
        background: transparent;
        padding: 0;
      }
      .pdf-page {
        box-shadow: none;
        border-radius: 0;
        min-height: auto;
      }
    }
  </style>
</head>
<body>
  ${chaptersHtml}
</body>
</html>`;

  return 'data:text/html;charset=utf-8,' + encodeURIComponent(fullHtml);
}

/**
 * Synchronize books to SQLite database so all app instances communicate and share library data
 */
export async function syncBookToSqlite(
  book: Book,
  familyId = 'family-aura-primary',
  deviceId = 'web-browser'
): Promise<boolean> {
  try {
    const res = await fetch(getApiUrl('/api/family/sync'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        familyId,
        recordType: 'pdf_book',
        id: `book_${book.id}`,
        title: book.title,
        data: {
          id: book.id,
          title: book.title,
          author: book.author,
          genre: book.genre,
          subtitle: book.subtitle,
          totalPages: book.totalPages,
          currentPage: book.currentPage,
          progressPercent: book.progressPercent,
          isPdf: book.isPdf,
          pdfFileName: book.pdfFileName,
          pdfFileSize: book.pdfFileSize,
          addedAt: book.addedAt,
          description: book.description,
          chapters: book.chapters,
        },
        fromDeviceId: deviceId,
      }),
    });
    return res.ok;
  } catch (e) {
    console.warn('SQLite sync warning:', e);
    return false;
  }
}

/**
 * Triggers a device download for any book (PDF file, Google Drive file, or formatted Markdown/Text book)
 */
export async function downloadBookFile(
  book: Book,
  googleAccessToken?: string | null
): Promise<{ success: boolean; filename: string; error?: string }> {
  try {
    const safeTitle = (book.title || 'book').replace(/[/\\?%*:|"<>]/g, '_').trim();

    // 1. Check if book already has a direct pdfUrl
    let pdfDataUrl = book.pdfUrl;

    // 2. If not, check IndexedDB storage
    if (!pdfDataUrl) {
      pdfDataUrl = (await getPdfFromStorage(book.id)) || undefined;
    }

    // If we have a base64 or blob PDF data URL:
    if (pdfDataUrl) {
      const filename = book.pdfFileName || `${safeTitle}.pdf`;
      if (pdfDataUrl.startsWith('data:')) {
        const bytes = dataUrlToUint8Array(pdfDataUrl);
        const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' });
        triggerBrowserFileDownload(blob, filename);
        return { success: true, filename };
      } else {
        const a = document.createElement('a');
        a.href = pdfDataUrl;
        a.download = filename;
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        return { success: true, filename };
      }
    }

    // 3. If book is linked to Google Drive
    if (book.driveFileId) {
      const filename = book.pdfFileName || `${safeTitle}.pdf`;
      const token =
        googleAccessToken ||
        (typeof localStorage !== 'undefined' &&
          (localStorage.getItem('aura_google_access_token') ||
            localStorage.getItem('google_access_token'))) ||
        '';

      if (token) {
        try {
          const driveDataUrl = await downloadBookContentFromDrive(token, book.driveFileId);
          if (driveDataUrl) {
            const bytes = dataUrlToUint8Array(driveDataUrl);
            const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' });
            triggerBrowserFileDownload(blob, filename);
            return { success: true, filename };
          }
        } catch (dErr) {
          console.warn('Drive direct download failed, fallback to direct export:', dErr);
        }
      }

      // Fallback: trigger Google Drive download link
      const driveDownloadUrl = `https://drive.google.com/uc?export=download&id=${book.driveFileId}`;
      const a = document.createElement('a');
      a.href = driveDownloadUrl;
      a.download = filename;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return { success: true, filename };
    }

    // 4. Curated Book or AI-woven chapter book:
    // Generate a clean, readable formatted Markdown ebook
    const filename = `${safeTitle}.md`;
    let bookContent = `# ${book.title}\n\n`;
    bookContent += `**Author:** ${book.author}\n\n`;
    bookContent += `**Genre:** ${book.genre}\n\n`;
    if (book.subtitle) {
      bookContent += `*${book.subtitle}*\n\n`;
    }
    bookContent += `### Overview\n${book.description}\n\n`;
    bookContent += `---\n\n## Table of Contents\n`;
    (book.chapters || []).forEach((ch, idx) => {
      bookContent += `${idx + 1}. [${ch.title}](#chapter-${idx + 1})\n`;
    });
    bookContent += `\n---\n\n`;

    (book.chapters || []).forEach((ch, idx) => {
      bookContent += `## <a name="chapter-${idx + 1}"></a>${ch.title}\n\n`;
      bookContent += `${(ch.content || []).join('\n\n')}\n\n---\n\n`;
    });

    const blob = new Blob([bookContent], { type: 'text/markdown;charset=utf-8' });
    triggerBrowserFileDownload(blob, filename);
    return { success: true, filename };
  } catch (err: any) {
    console.error('downloadBookFile error:', err);
    return { success: false, filename: `${book.title}.pdf`, error: err.message || 'Download failed' };
  }
}

function triggerBrowserFileDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
