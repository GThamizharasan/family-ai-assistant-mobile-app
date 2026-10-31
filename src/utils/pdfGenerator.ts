// Authentic PDF 1.4 Generation Engine for Adobe Document Scanner
// Generates standard, vector-faithful, multi-page PDF documents from scanned images
// 100% Client-Side with zero external dependencies. Fully compliant with Adobe Acrobat, Apple Books, and Google Drive.

import { ScannedPage, ScanImageFilter } from '../types/documentScanner';

/**
 * Converts a base64 Data URL to a Uint8Array
 */
function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64Index = dataUrl.indexOf(';base64,');
  if (base64Index === -1) {
    throw new Error('Invalid data URL: missing base64 marker');
  }
  const base64String = dataUrl.substring(base64Index + 8);
  const binaryString = atob(base64String);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Ensures an image data URL is JPEG format (converting PNG/WebP if needed via canvas)
 */
async function ensureJpegDataUrl(dataUrl: string): Promise<string> {
  if (dataUrl.startsWith('data:image/jpeg') || dataUrl.startsWith('data:image/jpg')) {
    return dataUrl;
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width || 1200;
      canvas.height = img.height || 1600;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', 0.92));
      } else {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

/**
 * Apply Adobe Scan style image filter enhancement (Magic Color, Grayscale, B&W, or Original)
 */
export async function applyScanFilter(
  sourceDataUrl: string,
  filter: ScanImageFilter,
  rotation = 0
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const isRotated90or270 = rotation % 180 !== 0;
      const canvas = document.createElement('canvas');
      canvas.width = isRotated90or270 ? img.height : img.width;
      canvas.height = isRotated90or270 ? img.width : img.height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(sourceDataUrl);
        return;
      }

      ctx.save();
      // Handle rotation
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      ctx.restore();

      if (filter === 'original') {
        resolve(canvas.toDataURL('image/jpeg', 0.92));
        return;
      }

      // Process pixel filters
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = imgData.data;

      for (let i = 0; i < d.length; i += 4) {
        const r = d[i];
        const g = d[i + 1];
        const b = d[i + 2];

        // Standard luminance
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;

        if (filter === 'grayscale') {
          // Boost paper contrast: paper backgrounds turn clean white
          const enhanced = Math.min(255, Math.max(0, (gray - 30) * 1.25));
          d[i] = enhanced;
          d[i + 1] = enhanced;
          d[i + 2] = enhanced;
        } else if (filter === 'bw') {
          // Binarized threshold
          const val = gray > 135 ? 255 : 0;
          d[i] = val;
          d[i + 1] = val;
          d[i + 2] = val;
        } else if (filter === 'magic') {
          // Magic Color: enhance text sharpness & whiten background
          const contrast = 1.35;
          const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
          const cr = Math.min(255, Math.max(0, factor * (r - 128) + 128 + 15));
          const cg = Math.min(255, Math.max(0, factor * (g - 128) + 128 + 15));
          const cb = Math.min(255, Math.max(0, factor * (b - 128) + 128 + 15));

          // If close to white paper, snap to pure white
          if (cr > 215 && cg > 215 && cb > 215) {
            d[i] = 255;
            d[i + 1] = 255;
            d[i + 2] = 255;
          } else {
            d[i] = cr;
            d[i + 1] = cg;
            d[i + 2] = cb;
          }
        }
      }

      ctx.putImageData(imgData, 0, 0);
      resolve(canvas.toDataURL('image/jpeg', 0.92));
    };

    img.onerror = () => resolve(sourceDataUrl);
    img.src = sourceDataUrl;
  });
}

/**
 * Generates an authentic PDF 1.4 document from an array of scanned pages.
 * Supports multi-page documents, scaling to standard A4 dimensions (595.28 x 841.89 pt),
 * preserving aspect ratio with clean white margins.
 */
export async function generatePdfFromScannedPages(
  pages: ScannedPage[],
  title = 'Adobe Document Scan'
): Promise<{
  blob: Blob;
  dataUrl: string;
  base64: string;
  fileSizeBytes: number;
}> {
  if (pages.length === 0) {
    throw new Error('At least one page is required to generate a PDF');
  }

  // Text encoder for ascii pdf header/dictionaries
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  let currentOffset = 0;

  const offsets: number[] = [];

  function writeAscii(str: string) {
    const bytes = enc.encode(str);
    chunks.push(bytes);
    currentOffset += bytes.length;
  }

  function writeBytes(bytes: Uint8Array) {
    chunks.push(bytes);
    currentOffset += bytes.length;
  }

  function recordObject(objNum: number) {
    offsets[objNum] = currentOffset;
  }

  // 1. PDF Header
  writeAscii('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');

  const pageCount = pages.length;
  // Obj 1: Catalog
  // Obj 2: Pages
  // Obj 3: Info
  // Per page:
  //   Obj (4 + i*3): Page
  //   Obj (5 + i*3): Contents stream
  //   Obj (6 + i*3): Image XObject
  const infoObjNum = 3;

  // Obj 1: Catalog
  recordObject(1);
  writeAscii('1 0 obj\n<<\n  /Type /Catalog\n  /Pages 2 0 R\n>>\nendobj\n');

  // Obj 2: Pages Collection
  recordObject(2);
  const kidsStr = pages.map((_, i) => `${4 + i * 3} 0 R`).join(' ');
  writeAscii(`2 0 obj\n<<\n  /Type /Pages\n  /Kids [${kidsStr}]\n  /Count ${pageCount}\n>>\nendobj\n`);

  // Obj 3: Info Metadata
  recordObject(3);
  const safeTitle = title.replace(/[()\\]/g, '');
  const now = new Date();
  const dateStr = `D:${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(
    now.getDate()
  ).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(
    2,
    '0'
  )}${String(now.getSeconds()).padStart(2, '0')}Z`;

  writeAscii(
    `3 0 obj\n<<\n  /Title (${safeTitle})\n  /Producer (Adobe Document Scanner • Family Circle)\n  /Creator (Auro Sovereign Multi-Modal Assistant)\n  /CreationDate (${dateStr})\n>>\nendobj\n`
  );

  // Standard A4 dimensions in PDF points (72 pt / inch)
  const A4_WIDTH = 595.28;
  const A4_HEIGHT = 841.89;

  // Pre-process all pages to ensure JPEGs
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const pageObjNum = 4 + i * 3;
    const contentsObjNum = 5 + i * 3;
    const imageObjNum = 6 + i * 3;

    const jpegDataUrl = await ensureJpegDataUrl(page.dataUrl);
    const jpegBytes = dataUrlToUint8Array(jpegDataUrl);

    // Determine orientation & page box
    const imgWidth = page.width || 1240;
    const imgHeight = page.height || 1754;
    const isLandscape = imgWidth > imgHeight;

    const pageWidth = isLandscape ? A4_HEIGHT : A4_WIDTH;
    const pageHeight = isLandscape ? A4_WIDTH : A4_HEIGHT;

    // Calculate fitted bounding box preserving aspect ratio
    const imgAspect = imgWidth / imgHeight;
    const pageAspect = pageWidth / pageHeight;

    let drawWidth = pageWidth;
    let drawHeight = pageHeight;
    let drawX = 0;
    let drawY = 0;

    if (imgAspect > pageAspect) {
      drawWidth = pageWidth;
      drawHeight = pageWidth / imgAspect;
      drawY = (pageHeight - drawHeight) / 2;
    } else {
      drawHeight = pageHeight;
      drawWidth = pageHeight * imgAspect;
      drawX = (pageWidth - drawWidth) / 2;
    }

    // 1. Page Object
    recordObject(pageObjNum);
    writeAscii(
      `${pageObjNum} 0 obj\n<<\n  /Type /Page\n  /Parent 2 0 R\n  /MediaBox [0 0 ${pageWidth.toFixed(
        2
      )} ${pageHeight.toFixed(2)}]\n  /Contents ${contentsObjNum} 0 R\n  /Resources <<\n    /XObject <<\n      /Im${
        i + 1
      } ${imageObjNum} 0 R\n    >>\n  >>\n>>\nendobj\n`
    );

    // 2. Contents Stream: transform matrix & paint image
    const contentStream = `q\n${drawWidth.toFixed(2)} 0 0 ${drawHeight.toFixed(2)} ${drawX.toFixed(
      2
    )} ${drawY.toFixed(2)} cm\n/Im${i + 1} Do\nQ\n`;
    const contentBytes = enc.encode(contentStream);

    recordObject(contentsObjNum);
    writeAscii(
      `${contentsObjNum} 0 obj\n<<\n  /Length ${contentBytes.length}\n>>\nstream\n`
    );
    writeBytes(contentBytes);
    writeAscii('\nendstream\nendobj\n');

    // 3. Image XObject Stream with /Filter /DCTDecode
    recordObject(imageObjNum);
    writeAscii(
      `${imageObjNum} 0 obj\n<<\n  /Type /XObject\n  /Subtype /Image\n  /Width ${imgWidth}\n  /Height ${imgHeight}\n  /ColorSpace /DeviceRGB\n  /BitsPerComponent 8\n  /Filter /DCTDecode\n  /Length ${jpegBytes.length}\n>>\nstream\n`
    );
    writeBytes(jpegBytes);
    writeAscii('\nendstream\nendobj\n');
  }

  // Cross-reference table (xref)
  const totalObjects = 3 + pages.length * 3;
  const startXrefOffset = currentOffset;

  writeAscii(`xref\n0 ${totalObjects + 1}\n`);
  writeAscii('0000000000 65535 f \n');

  for (let i = 1; i <= totalObjects; i++) {
    const off = offsets[i] || 0;
    const offStr = String(off).padStart(10, '0');
    writeAscii(`${offStr} 00000 n \n`);
  }

  // Trailer
  writeAscii(
    `trailer\n<<\n  /Size ${totalObjects + 1}\n  /Root 1 0 R\n  /Info ${infoObjNum} 0 R\n>>\nstartxref\n${startXrefOffset}\n%%EOF\n`
  );

  // Combine into a single Uint8Array
  const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
  const fullBytes = new Uint8Array(totalLength);
  let pos = 0;
  for (const c of chunks) {
    fullBytes.set(c, pos);
    pos += c.length;
  }

  const blob = new Blob([fullBytes], { type: 'application/pdf' });

  // Convert binary to base64 for IndexedDB / Drive Multipart Upload
  let binaryStr = '';
  const chunkSize = 8192;
  for (let i = 0; i < fullBytes.length; i += chunkSize) {
    const slice = fullBytes.subarray(i, i + chunkSize);
    binaryStr += String.fromCharCode.apply(null, Array.from(slice));
  }
  const base64 = btoa(binaryStr);
  const dataUrl = `data:application/pdf;base64,${base64}`;

  return {
    blob,
    dataUrl,
    base64,
    fileSizeBytes: fullBytes.length,
  };
}
