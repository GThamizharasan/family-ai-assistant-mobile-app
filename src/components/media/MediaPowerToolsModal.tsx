import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  EyeOff,
  FileSpreadsheet,
  Film,
  Lock,
  Unlock,
  Download,
  Save,
  Play,
  Pause,
  CheckCircle2,
  Loader2,
  RotateCcw,
} from 'lucide-react';
import { MediaFolderItem, MediaLibraryItem } from '../../types/mediaLibrary';
import {
  resolvePlayableMediaUrl,
  saveMediaMetadataToSqlite,
  storeMediaItemLocallyInSqlite,
  uploadFileResumableToDrive,
} from '../../services/mediaLibraryService';
import { getEffectiveGoogleToken } from '../../services/visualTopicStorageService';

// Zero-dependency standards-compliant Multi-JPEG -> Single PDF 1.4 binary builder!
async function buildMultiImagePdfBlob(dataUrls: string[]): Promise<Blob> {
  const pages: Array<{ bytes: Uint8Array; width: number; height: number }> = [];

  for (const url of dataUrls) {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = url;
    });
    const canvas = document.createElement('canvas');
    const maxDim = 1400;
    const scale = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const jpegB64 = canvas.toDataURL('image/jpeg', 0.86).replace(/^data:image\/jpeg;base64,/, '');
    const bin = atob(jpegB64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    pages.push({ bytes, width: canvas.width, height: canvas.height });
  }

  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [0]; // 1-indexed PDF object byte offsets
  let bytePos = 0;

  const pushStr = (s: string) => {
    const b = enc.encode(s);
    chunks.push(b);
    bytePos += b.length;
  };
  const pushBytes = (b: Uint8Array) => {
    chunks.push(b);
    bytePos += b.length;
  };

  pushStr('%PDF-1.4\n');
  // Obj 1: Catalog, Obj 2: Pages
  // Each page i uses 3 objects: Page (3 + i*3), Content (4 + i*3), Image XObject (5 + i*3)
  const pageObjNums = pages.map((_, i) => 3 + i * 3);

  offsets[1] = bytePos;
  pushStr('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  offsets[2] = bytePos;
  pushStr(`2 0 obj\n<< /Type /Pages /Kids [${pageObjNums.map((n) => `${n} 0 R`).join(' ')}] /Count ${pages.length} >>\nendobj\n`);

  pages.forEach((pg, i) => {
    const pageObj = 3 + i * 3;
    const contentObj = 4 + i * 3;
    const imgObj = 5 + i * 3;
    // Fit nicely inside A4 points (595 x 842)
    const pageW = 595;
    const pageH = 842;
    const scale = Math.min((pageW - 40) / pg.width, (pageH - 40) / pg.height);
    const drawW = Math.round(pg.width * scale);
    const drawH = Math.round(pg.height * scale);
    const offsetX = Math.round((pageW - drawW) / 2);
    const offsetY = Math.round((pageH - drawH) / 2);

    const contentStream = `q\n${drawW} 0 0 ${drawH} ${offsetX} ${offsetY} cm\n/Im${i} Do\nQ\n`;

    offsets[pageObj] = bytePos;
    pushStr(
      `${pageObj} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /XObject << /Im${i} ${imgObj} 0 R >> >> /Contents ${contentObj} 0 R >>\nendobj\n`
    );

    offsets[contentObj] = bytePos;
    pushStr(`${contentObj} 0 obj\n<< /Length ${contentStream.length} >>\nstream\n${contentStream}endstream\nendobj\n`);

    offsets[imgObj] = bytePos;
    pushStr(
      `${imgObj} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${pg.width} /Height ${pg.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${pg.bytes.length} >>\nstream\n`
    );
    pushBytes(pg.bytes);
    pushStr('\nendstream\nendobj\n');
  });

  const totalObjs = 2 + pages.length * 3;
  const xrefPos = bytePos;
  pushStr(`xref\n0 ${totalObjs + 1}\n0000000000 65535 f \n`);
  for (let id = 1; id <= totalObjs; id++) {
    pushStr(`${String(offsets[id] || 0).padStart(10, '0')} 00000 n \n`);
  }
  pushStr(`trailer\n<< /Size ${totalObjs + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`);

  return new Blob(chunks as BlobPart[], { type: 'application/pdf' });
}

export const PRIVATE_PIN_KEY = 'aura_media_vault_pin_v1';
export const LOCKED_FOLDERS_KEY = 'aura_media_locked_folders_v1';

export function getLockedFolderPaths(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCKED_FOLDERS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

interface MediaPowerToolsModalProps {
  isOpen: boolean;
  initialTab?: 'redact' | 'pdf_merge' | 'memories' | 'pin_lock';
  items: MediaLibraryItem[];
  folders: MediaFolderItem[];
  googleAccessToken?: string | null;
  userEmail?: string;
  ownerName?: string;
  isVaultUnlocked: boolean;
  onUnlockChange: (unlocked: boolean) => void;
  onLockedFoldersChange: (paths: string[]) => void;
  onCreatedMediaItem: (item: MediaLibraryItem) => void;
  onClose: () => void;
}

export const MediaPowerToolsModal: React.FC<MediaPowerToolsModalProps> = ({
  isOpen,
  initialTab = 'redact',
  items,
  folders,
  googleAccessToken,
  userEmail,
  ownerName = 'Family',
  isVaultUnlocked,
  onUnlockChange,
  onLockedFoldersChange,
  onCreatedMediaItem,
  onClose,
}) => {
  const [tab, setTab] = useState<'redact' | 'pdf_merge' | 'memories' | 'pin_lock'>(initialTab);
  const [status, setStatus] = useState<string | null>(null);

  const imageItems = items.filter((i) => (i.mediaType === 'image' || i.mediaType === 'ai_generated') && !i.isDeleted);
  const audioItems = items.filter((i) => i.mediaType === 'audio' && !i.isDeleted);

  // 1. Redact / Enhance Studio state
  const [selectedRedactItem, setSelectedRedactItem] = useState<MediaLibraryItem | null>(null);
  const [brightness, setBrightness] = useState(105);
  const [contrast, setContrast] = useState(110);
  const [redactBoxes, setRedactBoxes] = useState<Array<{ x: number; y: number; w: number; h: number }>>([]);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [isSavingRedact, setIsSavingRedact] = useState(false);
  const redactCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const loadedImgRef = useRef<HTMLImageElement | null>(null);

  // 2. Multi-Image -> PDF Merger state
  const [selectedPdfIds, setSelectedPdfIds] = useState<string[]>([]);
  const [pdfTitle, setPdfTitle] = useState('Family_Document_Bundle');
  const [isMergingPdf, setIsMergingPdf] = useState(false);

  // 3. Memories Slideshow state
  const [memIdx, setMemIdx] = useState(0);
  const [memPlaying, setMemPlaying] = useState(false);
  const [selectedAudioId, setSelectedAudioId] = useState<string>('');
  const [memAudioUrl, setMemAudioUrl] = useState<string>('');

  // 4. PIN Private Folder Lock state
  const [pinInput, setPinInput] = useState('');
  const [lockedPaths, setLockedPaths] = useState<string[]>(() => getLockedFolderPaths());
  const savedPin = typeof window !== 'undefined' ? localStorage.getItem(PRIVATE_PIN_KEY) || '' : '';

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (!selectedRedactItem && imageItems.length > 0) {
      setSelectedRedactItem(imageItems[0]);
    }
  }, [imageItems, selectedRedactItem]);

  // Render Redact/Enhance Canvas
  const redrawRedactCanvas = () => {
    const canvas = redactCanvasRef.current;
    const img = loadedImgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.filter = `brightness(${brightness}%) contrast(${contrast}%)`;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    ctx.filter = 'none';

    // Draw pixelated/solid privacy redaction bars
    for (const b of redactBoxes) {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(b.x, b.y, b.w, b.h);
    }
  };

  useEffect(() => {
    if (!isOpen || tab !== 'redact' || !selectedRedactItem) return;
    let revoke: (() => void) | undefined;
    resolvePlayableMediaUrl(selectedRedactItem, googleAccessToken).then((res) => {
      revoke = res.revoke;
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        loadedImgRef.current = img;
        if (redactCanvasRef.current) {
          const maxW = 640;
          const scale = Math.min(1, maxW / Math.max(img.width || 1, 1));
          redactCanvasRef.current.width = Math.max(1, Math.round(img.width * scale));
          redactCanvasRef.current.height = Math.max(1, Math.round(img.height * scale));
          redrawRedactCanvas();
        }
      };
      img.src = res.url || selectedRedactItem.thumbnailDataUrl || '';
    });
    return () => revoke?.();
  }, [isOpen, tab, selectedRedactItem?.id, googleAccessToken]);

  useEffect(() => {
    redrawRedactCanvas();
  }, [brightness, contrast, redactBoxes]);

  // Memories Slideshow Timer + Audio
  useEffect(() => {
    if (!memPlaying || imageItems.length < 2) return;
    const timer = setInterval(() => {
      setMemIdx((i) => (i + 1) % imageItems.length);
    }, 3600);
    return () => clearInterval(timer);
  }, [memPlaying, imageItems.length]);

  useEffect(() => {
    const audioItem = audioItems.find((a) => a.id === selectedAudioId);
    if (!audioItem) {
      setMemAudioUrl('');
      return;
    }
    let revoke: (() => void) | undefined;
    resolvePlayableMediaUrl(audioItem, googleAccessToken).then((res) => {
      revoke = res.revoke;
      setMemAudioUrl(res.url);
    });
    return () => revoke?.();
  }, [selectedAudioId, googleAccessToken]);

  if (!isOpen) return null;

  const handleSaveRedactedImage = async () => {
    const canvas = redactCanvasRef.current;
    if (!canvas || !selectedRedactItem) return;
    setIsSavingRedact(true);
    try {
      const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
      const blob = await (await fetch(dataUrl)).blob();
      const cleanName = `Redacted_${selectedRedactItem.fileName.replace(/\.[^.]+$/, '')}.jpg`;
      const file = new File([blob], cleanName, { type: 'image/jpeg' });
      const token = getEffectiveGoogleToken(googleAccessToken);

      let driveMeta: any = {};
      if (token) {
        driveMeta = await uploadFileResumableToDrive({
          file,
          folderPath: selectedRedactItem.folderPath || '/',
          token,
          userEmail,
        });
      }

      const saved = await saveMediaMetadataToSqlite({
        userEmail,
        fileName: cleanName,
        driveFileId: driveMeta.driveFileId,
        driveFolderId: driveMeta.driveFolderId,
        driveWebViewLink: driveMeta.driveWebViewLink,
        driveDownloadUrl: driveMeta.driveDownloadUrl,
        folderPath: selectedRedactItem.folderPath || '/',
        mediaType: 'image',
        mimeType: 'image/jpeg',
        fileSize: file.size,
        thumbnailDataUrl: dataUrl,
        tags: ['redacted', 'enhanced', ...(selectedRedactItem.tags || [])],
        category: selectedRedactItem.category || 'Documents',
        ownerName,
        deviceSource: 'Media Studio Editor',
      });
      await storeMediaItemLocallyInSqlite(saved, { file, googleAccessToken, userEmail }).catch(() => {});
      onCreatedMediaItem(saved);
      setStatus(`✅ Saved redacted/enhanced image "${cleanName}" to Media Vault & Google Drive!`);
    } catch (err: any) {
      setStatus(`Error: ${err?.message || 'Could not save image'}`);
    } finally {
      setIsSavingRedact(false);
    }
  };

  const handleMergeImagesToPdf = async () => {
    const chosen = imageItems.filter((i) => selectedPdfIds.includes(i.id));
    if (chosen.length === 0) {
      setStatus('Select at least 1 image below to merge into a PDF.');
      return;
    }
    setIsMergingPdf(true);
    try {
      const urls: string[] = [];
      for (const it of chosen) {
        const res = await resolvePlayableMediaUrl(it, googleAccessToken);
        urls.push(res.url || it.thumbnailDataUrl || '');
      }
      const pdfBlob = await buildMultiImagePdfBlob(urls.filter(Boolean));
      const cleanFileName = `${pdfTitle.trim().replace(/\W+/g, '_') || 'Merged_Document'}.pdf`;
      const pdfFile = new File([pdfBlob], cleanFileName, { type: 'application/pdf' });

      // Trigger immediate browser download
      const dlUrl = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = dlUrl;
      a.download = cleanFileName;
      a.click();
      setTimeout(() => URL.revokeObjectURL(dlUrl), 4000);

      // Archive to Google Drive & SQLite Media Vault!
      const token = getEffectiveGoogleToken(googleAccessToken);
      let driveMeta: any = {};
      if (token) {
        driveMeta = await uploadFileResumableToDrive({
          file: pdfFile,
          folderPath: '/Merged PDFs',
          token,
          userEmail,
        });
      }

      const saved = await saveMediaMetadataToSqlite({
        userEmail,
        fileName: cleanFileName,
        driveFileId: driveMeta.driveFileId,
        driveFolderId: driveMeta.driveFolderId,
        driveWebViewLink: driveMeta.driveWebViewLink,
        driveDownloadUrl: driveMeta.driveDownloadUrl,
        folderPath: '/Merged PDFs',
        mediaType: 'pdf',
        mimeType: 'application/pdf',
        fileSize: pdfFile.size,
        tags: ['merged-pdf', 'scan'],
        category: 'Documents',
        ownerName,
        deviceSource: 'Multi-Image PDF Merger',
      });
      await storeMediaItemLocallyInSqlite(saved, { file: pdfFile, googleAccessToken, userEmail }).catch(() => {});
      onCreatedMediaItem(saved);
      setSelectedPdfIds([]);
      setStatus(`📕 Merged ${chosen.length} image(s) into "${cleanFileName}" — downloaded & archived to Drive + SQLite!`);
    } catch (err: any) {
      setStatus(`PDF merge error: ${err?.message || 'Please try again.'}`);
    } finally {
      setIsMergingPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[85] bg-slate-950/90 backdrop-blur-lg flex items-center justify-center p-3 sm:p-5" onClick={onClose}>
      <div
        className="w-full max-w-4xl max-h-[90vh] rounded-3xl bg-slate-900 border border-white/15 shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-purple-950 via-slate-900 to-cyan-950 border-b border-white/10 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase text-cyan-300">✨ Media Vault Power Studio</span>
            <h3 className="text-lg font-black text-white">Redact & Enhance · Image→PDF Merger · Memories Reel · PIN Lock</h3>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl bg-white/10 text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tool Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-2.5 bg-slate-950/70 border-b border-white/10 text-xs">
          {[
            { id: 'redact', label: '🕵️ Redact & Enhance', icon: EyeOff },
            { id: 'pdf_merge', label: '📕 Images → Single PDF', icon: FileSpreadsheet },
            { id: 'memories', label: '🎞️ Memories Slideshow', icon: Film },
            { id: 'pin_lock', label: '🔒 Private Folder PIN', icon: Lock },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as any)}
              className={`py-2 px-3 rounded-xl font-extrabold cursor-pointer ${
                tab === t.id ? 'bg-cyan-500 text-slate-950' : 'bg-slate-900 text-slate-300 border border-white/10'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {status && (
          <div className="mx-4 mt-3 px-3.5 py-2 rounded-xl bg-emerald-500/15 border border-emerald-400/40 text-xs text-emerald-100 flex justify-between">
            <span>{status}</span>
            <button onClick={() => setStatus(null)} className="font-bold cursor-pointer">✕</button>
          </div>
        )}

        <div className="p-4 overflow-y-auto flex-1 space-y-4 text-xs text-white">
          {/* 1. REDACT & ENHANCE */}
          {tab === 'redact' && (
            <div className="space-y-3">
              <p className="text-slate-300">
                Drag across the image below to draw **black privacy redaction boxes** over sensitive ID/account numbers before sharing, or adjust scan contrast!
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={selectedRedactItem?.id || ''}
                  onChange={(e) => {
                    const found = imageItems.find((x) => x.id === e.target.value) || null;
                    setSelectedRedactItem(found);
                    setRedactBoxes([]);
                  }}
                  className="px-3 py-2 rounded-xl bg-slate-950 border border-white/15 text-white font-bold"
                >
                  {imageItems.map((img) => (
                    <option key={img.id} value={img.id}>{img.fileName}</option>
                  ))}
                </select>
                <label className="flex items-center gap-1.5">
                  <span className="text-slate-400">Brightness</span>
                  <input type="range" min="70" max="150" value={brightness} onChange={(e) => setBrightness(Number(e.target.value))} />
                </label>
                <label className="flex items-center gap-1.5">
                  <span className="text-slate-400">Contrast</span>
                  <input type="range" min="70" max="170" value={contrast} onChange={(e) => setContrast(Number(e.target.value))} />
                </label>
                <button
                  onClick={() => setRedactBoxes([])}
                  className="px-2.5 py-1.5 rounded-xl bg-white/10 text-slate-200 font-bold inline-flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Clear Boxes
                </button>
              </div>

              {imageItems.length === 0 ? (
                <div className="p-8 text-center text-slate-400 bg-slate-950 rounded-2xl">Upload at least one image in Media Vault first.</div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <canvas
                    ref={redactCanvasRef}
                    onMouseDown={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const scaleX = e.currentTarget.width / rect.width;
                      const scaleY = e.currentTarget.height / rect.height;
                      setDragStart({ x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY });
                    }}
                    onMouseUp={(e) => {
                      if (!dragStart) return;
                      const rect = e.currentTarget.getBoundingClientRect();
                      const scaleX = e.currentTarget.width / rect.width;
                      const scaleY = e.currentTarget.height / rect.height;
                      const endX = (e.clientX - rect.left) * scaleX;
                      const endY = (e.clientY - rect.top) * scaleY;
                      const w = Math.abs(endX - dragStart.x);
                      const h = Math.abs(endY - dragStart.y);
                      if (w > 8 && h > 6) {
                        setRedactBoxes((prev) => [
                          ...prev,
                          { x: Math.min(dragStart.x, endX), y: Math.min(dragStart.y, endY), w, h },
                        ]);
                      }
                      setDragStart(null);
                    }}
                    className="max-w-full max-h-[380px] rounded-2xl border-2 border-cyan-400/40 cursor-crosshair bg-slate-950"
                  />
                  <button
                    onClick={() => void handleSaveRedactedImage()}
                    disabled={isSavingRedact}
                    className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-extrabold inline-flex items-center gap-2 cursor-pointer"
                  >
                    {isSavingRedact ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save Redacted & Enhanced Copy to Google Drive + SQLite
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 2. MULTI-IMAGE -> SINGLE PDF MERGER */}
          {tab === 'pdf_merge' && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={pdfTitle}
                  onChange={(e) => setPdfTitle(e.target.value)}
                  placeholder="Output PDF Filename"
                  className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-white/15 text-white font-bold"
                />
                <button
                  onClick={() => void handleMergeImagesToPdf()}
                  disabled={isMergingPdf || selectedPdfIds.length === 0}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-extrabold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                >
                  {isMergingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  Merge ({selectedPdfIds.length}) Images → Single PDF
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 max-h-80 overflow-y-auto">
                {imageItems.map((img) => {
                  const orderIdx = selectedPdfIds.indexOf(img.id);
                  const active = orderIdx >= 0;
                  return (
                    <div
                      key={img.id}
                      onClick={() =>
                        setSelectedPdfIds((prev) =>
                          active ? prev.filter((id) => id !== img.id) : [...prev, img.id]
                        )
                      }
                      className={`p-2 rounded-2xl border cursor-pointer relative ${
                        active ? 'bg-emerald-500/20 border-emerald-400' : 'bg-slate-950 border-white/10'
                      }`}
                    >
                      {img.thumbnailDataUrl && (
                        <img src={img.thumbnailDataUrl} alt={img.fileName} className="w-full h-24 object-cover rounded-xl mb-1.5" />
                      )}
                      <div className="truncate font-bold">{img.fileName}</div>
                      {active && (
                        <span className="absolute top-3 right-3 w-6 h-6 rounded-full bg-emerald-400 text-slate-950 font-black flex items-center justify-center">
                          {orderIdx + 1}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 3. AI FAMILY MEMORIES HIGHLIGHT SLIDESHOW */}
          {tab === 'memories' && (
            <div className="space-y-3 text-center">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <select
                  value={selectedAudioId}
                  onChange={(e) => setSelectedAudioId(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-slate-950 border border-white/15 text-white"
                >
                  <option value="">🎵 Optional Background Music (Select from Vault Audio)</option>
                  {audioItems.map((a) => (
                    <option key={a.id} value={a.id}>{a.fileName}</option>
                  ))}
                </select>
                <button
                  onClick={() => setMemPlaying((p) => !p)}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-fuchsia-500 to-amber-500 text-slate-950 font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  {memPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  {memPlaying ? 'Pause Memories Reel' : 'Play Family Memories Reel'}
                </button>
              </div>

              {memAudioUrl && memPlaying && <audio src={memAudioUrl} autoPlay loop className="hidden" />}

              {imageItems.length === 0 ? (
                <div className="p-10 text-slate-400 bg-slate-950 rounded-2xl">Upload family photos to play your Memories Highlight Reel!</div>
              ) : (
                <div className="rounded-3xl bg-slate-950 border border-white/15 p-4 space-y-2 relative overflow-hidden">
                  <img
                    src={imageItems[memIdx % imageItems.length]?.thumbnailDataUrl}
                    alt="Memory"
                    className={`max-h-80 mx-auto rounded-2xl object-contain transition-transform duration-1000 ${
                      memPlaying ? 'scale-105' : 'scale-100'
                    }`}
                  />
                  <div className="text-sm font-black text-white">
                    {imageItems[memIdx % imageItems.length]?.aiMetadata?.caption ||
                      imageItems[memIdx % imageItems.length]?.fileName}
                  </div>
                  <div className="text-[11px] text-cyan-300">
                    Memory {(memIdx % imageItems.length) + 1} of {imageItems.length} ·{' '}
                    {(imageItems[memIdx % imageItems.length]?.createdAt || '').slice(0, 10)}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 4. PIN / BIOMETRIC PRIVATE FOLDER LOCK */}
          {tab === 'pin_lock' && (
            <div className="space-y-4">
              <div className="rounded-2xl bg-slate-950 border border-amber-400/40 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-black text-white">🔒 Private Folder PIN Lock</h4>
                    <p className="text-[11px] text-slate-400">
                      Files inside locked folders are hidden from the Media Vault grid until you unlock with your 4-digit PIN.
                    </p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full font-black text-[10px] ${
                      isVaultUnlocked ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                    }`}
                  >
                    {isVaultUnlocked ? '🔓 UNLOCKED' : '🔒 LOCKED'}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  <input
                    type="password"
                    maxLength={6}
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
                    placeholder={savedPin ? 'Enter 4-digit PIN to Unlock / Lock' : 'Create 4-digit Vault PIN'}
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-white/15 text-white font-mono tracking-widest"
                  />
                  {!savedPin ? (
                    <button
                      onClick={() => {
                        if (pinInput.length < 4) {
                          setStatus('Enter at least 4 digits to set your Private Vault PIN.');
                          return;
                        }
                        localStorage.setItem(PRIVATE_PIN_KEY, btoa(`aura:${pinInput}`));
                        setPinInput('');
                        onUnlockChange(true);
                        setStatus('🔐 Private Vault PIN configured!');
                      }}
                      className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-extrabold cursor-pointer"
                    >
                      Set PIN
                    </button>
                  ) : isVaultUnlocked ? (
                    <button
                      onClick={() => {
                        onUnlockChange(false);
                        setStatus('🔒 Private folders locked and hidden from Media Grid.');
                      }}
                      className="px-4 py-2 rounded-xl bg-rose-500 text-white font-extrabold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Lock className="w-3.5 h-3.5" /> Lock Now
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        if (btoa(`aura:${pinInput}`) === savedPin) {
                          onUnlockChange(true);
                          setPinInput('');
                          setStatus('🔓 Private folders unlocked for this session!');
                        } else {
                          setStatus('❌ Incorrect PIN.');
                        }
                      }}
                      className="px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 font-extrabold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Unlock className="w-3.5 h-3.5" /> Unlock Vault
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-[11px] font-extrabold uppercase text-slate-400">Select Folders to Protect with PIN Lock</div>
                {['/Identity & Policies', '/Merged PDFs', ...folders.map((f) => f.path)]
                  .filter((v, idx, arr) => arr.indexOf(v) === idx)
                  .map((path) => {
                    const isLocked = lockedPaths.includes(path);
                    return (
                      <div
                        key={path}
                        onClick={() => {
                          const next = isLocked ? lockedPaths.filter((p) => p !== path) : [...lockedPaths, path];
                          setLockedPaths(next);
                          localStorage.setItem(LOCKED_FOLDERS_KEY, JSON.stringify(next));
                          onLockedFoldersChange(next);
                        }}
                        className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer ${
                          isLocked ? 'bg-amber-500/15 border-amber-400/50 text-amber-100' : 'bg-slate-950 border-white/10 text-slate-300'
                        }`}
                      >
                        <span className="font-bold">{path}</span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-extrabold">
                          {isLocked ? <CheckCircle2 className="w-4 h-4 text-amber-400" /> : null}
                          {isLocked ? '🔒 PIN Protected' : 'Click to Protect'}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
