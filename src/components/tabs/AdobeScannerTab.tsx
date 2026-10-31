import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  Camera,
  Upload,
  Sparkles,
  Download,
  Share2,
  Heart,
  Trash2,
  ExternalLink,
  UploadCloud,
  Check,
  Search,
  Plus,
  RotateCw,
  Eye,
  X,
  Layers,
  ChevronRight,
  ChevronLeft,
  Database,
  DownloadCloud,
  RefreshCw,
  Folder,
  ShieldCheck,
  Sliders,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  Settings2,
  FileCheck,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  ScannedDocument,
  ScannedPage,
  ScanCategory,
  ScanImageFilter,
  PdfPageSize,
  PdfOrientation,
  PdfMargin,
  PdfQuality,
  PdfGenerationOptions,
  SCAN_CATEGORIES,
  PDF_PAGE_SIZE_OPTIONS,
} from '../../types/documentScanner';
import {
  fetchScannedDocuments,
  saveScannedDocument,
  deleteScannedDocument,
  toggleDocumentFavorite,
  downloadScannedPdf,
  shareScannedPdf,
  uploadScannedPdfToDrive,
  getDocumentPdfBlobUrl,
  DRIVE_FOLDER_NAME,
} from '../../services/documentScannerService';
import {
  getScanPdfFromStorage,
  saveScanPdfToStorage,
  getAllCachedScanIds,
} from '../../utils/scanStorage';
import { applyScanFilter, generatePdfFromScannedPages, dataUrlToBlob } from '../../utils/pdfGenerator';

export const AdobeScannerTab: React.FC = () => {
  const { user, googleAccessToken, isGoogleConnected, signInWithGoogleOAuth } = useApp();

  // Document Library
  const [documents, setDocuments] = useState<ScannedDocument[]>([]);
  const [cachedScanIds, setCachedScanIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCachingAll, setIsCachingAll] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [uploadingDocId, setUploadingDocId] = useState<string | null>(null);

  // Scanner Viewfinder & Capture Modal
  const [isScannerModalOpen, setIsScannerModalOpen] = useState(false);
  const [scanTitle, setScanTitle] = useState('');
  const [scanCategory, setScanCategory] = useState<ScanCategory>('Receipt');
  const [scanPages, setScanPages] = useState<ScannedPage[]>([]);
  const [selectedPageIdx, setSelectedPageIdx] = useState<number>(0);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // PDF Page Size & Customization Options (Default A4)
  const [showPdfOptions, setShowPdfOptions] = useState(false);
  const [pdfPageSize, setPdfPageSize] = useState<PdfPageSize>('A4');
  const [pdfOrientation, setPdfOrientation] = useState<PdfOrientation>('auto');
  const [pdfMargin, setPdfMargin] = useState<PdfMargin>('narrow');
  const [pdfQuality, setPdfQuality] = useState<PdfQuality>('high');

  // Video and Canvas refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // PDF Preview & Inspection Modal
  const [previewDoc, setPreviewDoc] = useState<ScannedDocument | null>(null);
  const [previewPdfBlobUrl, setPreviewPdfBlobUrl] = useState<string | null>(null);
  const [previewActivePage, setPreviewActivePage] = useState<number>(0);
  const [previewZoom, setPreviewZoom] = useState<number>(1);
  const [previewViewMode, setPreviewViewMode] = useState<'pages' | 'pdf'>('pages');

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Load documents & cached IDs
  const loadDocuments = async () => {
    setIsLoading(true);
    try {
      const list = await fetchScannedDocuments(googleAccessToken, user?.email);
      setDocuments(list);
      const cached = await getAllCachedScanIds();
      setCachedScanIds(cached);
    } catch (err) {
      console.warn('Error loading scanned documents:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadDocuments();
  }, [googleAccessToken, user?.email]);

  // Clean up camera stream on unmount or modal close
  const stopCameraStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  useEffect(() => {
    if (!isScannerModalOpen) {
      stopCameraStream();
    }
  }, [isScannerModalOpen]);

  // Start Camera
  const startCamera = async (facing: 'environment' | 'user' = cameraFacing) => {
    stopCameraStream();
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facing,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
      setIsCameraActive(true);
      setCameraFacing(facing);
    } catch (err: any) {
      console.warn('Camera stream error:', err);
      setCameraError('Camera access not available. Please allow permissions or upload photos from gallery.');
      setIsCameraActive(false);
    }
  };

  // Switch Camera Facing (Back / Front)
  const handleToggleCameraFacing = () => {
    const nextFacing = cameraFacing === 'environment' ? 'user' : 'environment';
    void startCamera(nextFacing);
  };

  // Capture current video frame as a scanned page
  const handleCapturePage = async () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const rawDataUrl = canvas.toDataURL('image/jpeg', 0.95);

    // Apply Magic Color filter by default for crisp document contrast & white paper
    const filteredDataUrl = await applyScanFilter(rawDataUrl, 'magic', 0);

    const newPage: ScannedPage = {
      id: `page_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      pageNumber: scanPages.length + 1,
      dataUrl: filteredDataUrl,
      width: canvas.width,
      height: canvas.height,
      rotation: 0,
      filter: 'magic',
    };

    setScanPages((prev) => [...prev, newPage]);
    setSelectedPageIdx(scanPages.length);
    showToast(`✓ Page ${scanPages.length + 1} captured!`);
  };

  // Handle uploading photos/images from device
  const handleUploadFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newPages: ScannedPage[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });

      // Filter
      const filtered = await applyScanFilter(dataUrl, 'magic', 0);

      newPages.push({
        id: `page_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6)}`,
        pageNumber: scanPages.length + i + 1,
        dataUrl: filtered,
        width: 1200,
        height: 1600,
        rotation: 0,
        filter: 'magic',
      });
    }

    setScanPages((prev) => [...prev, ...newPages]);
    if (!isScannerModalOpen) {
      setScanTitle(`Scan - ${new Date().toLocaleDateString()}`);
      setIsScannerModalOpen(true);
    }
    showToast(`✓ Added ${newPages.length} image(s) to scan`);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Rotate selected page
  const handleRotatePage = async (pageIdx: number) => {
    const page = scanPages[pageIdx];
    if (!page) return;

    const nextRot = (page.rotation + 90) % 360;
    const updatedDataUrl = await applyScanFilter(page.dataUrl, page.filter, 90);

    setScanPages((prev) =>
      prev.map((p, idx) =>
        idx === pageIdx
          ? {
              ...p,
              rotation: nextRot,
              dataUrl: updatedDataUrl,
              width: p.height,
              height: p.width,
            }
          : p
      )
    );
  };

  // Change filter on selected page
  const handleChangePageFilter = async (pageIdx: number, newFilter: ScanImageFilter) => {
    const page = scanPages[pageIdx];
    if (!page) return;

    const filteredUrl = await applyScanFilter(page.dataUrl, newFilter, 0);
    setScanPages((prev) =>
      prev.map((p, idx) =>
        idx === pageIdx
          ? {
              ...p,
              filter: newFilter,
              dataUrl: filteredUrl,
            }
          : p
      )
    );
  };

  // Delete page from session
  const handleDeletePage = (pageIdx: number) => {
    setScanPages((prev) => {
      const filtered = prev.filter((_, idx) => idx !== pageIdx);
      return filtered.map((p, i) => ({ ...p, pageNumber: i + 1 }));
    });
    setSelectedPageIdx((prev) => Math.max(0, prev - 1));
  };

  // Finish Scanning & Generate PDF (with customizable page size & layout)
  const handleSaveDocument = async () => {
    if (scanPages.length === 0) {
      showToast('Please capture or upload at least 1 page.');
      return;
    }

    setIsGeneratingPdf(true);
    try {
      const now = new Date();
      const defaultTitle = `${scanCategory} Scan - ${now.toLocaleDateString()}`;
      const finalTitle = scanTitle.trim() || defaultTitle;

      const pdfOpts: PdfGenerationOptions = {
        pageSize: pdfPageSize,
        orientation: pdfOrientation,
        margin: pdfMargin,
        quality: pdfQuality,
      };

      showToast(`Generating authentic ${pdfPageSize} Vector PDF...`);
      const gen = await generatePdfFromScannedPages(scanPages, finalTitle, pdfOpts);

      const newDoc: ScannedDocument = {
        id: `scan_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        userEmail: user?.email || 'chinna.tamil2000@gmail.com',
        title: finalTitle,
        category: scanCategory,
        pages: scanPages,
        pageCount: scanPages.length,
        fileSizeBytes: gen.fileSizeBytes,
        pageSize: pdfPageSize,
        pdfOptions: pdfOpts,
        thumbnailDataUrl: scanPages[0]?.dataUrl,
        pdfContentBase64: gen.dataUrl,
        pdfBlobUrl: URL.createObjectURL(gen.blob),
        driveFolderPath: `Family Circle/${DRIVE_FOLDER_NAME}`,
        driveSyncStatus: googleAccessToken ? 'uploading' : 'local_only',
        isFavorite: false,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };

      showToast('Saving to SQLite & Google Drive...');
      const saved = await saveScannedDocument(newDoc, googleAccessToken, pdfOpts);

      setDocuments((prev) => [saved, ...prev.filter((d) => d.id !== saved.id)]);
      const cached = await getAllCachedScanIds();
      setCachedScanIds(cached);

      setIsScannerModalOpen(false);
      setScanPages([]);
      setScanTitle('');
      stopCameraStream();

      showToast(`✓ "${saved.title}" saved (${pdfPageSize} PDF) & synced to Drive!`);
    } catch (err: any) {
      console.error('Failed saving scanned document:', err);
      showToast(err.message || 'Error creating PDF document');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Open Preview Modal (Intelligent Dual-Mode: Interactive Document Viewer + Native PDF Blob)
  const handleOpenPreview = async (doc: ScannedDocument) => {
    setPreviewDoc(doc);
    setPreviewActivePage(0);
    setPreviewZoom(1);
    setPreviewViewMode(doc.pages && doc.pages.length > 0 ? 'pages' : 'pdf');

    try {
      const blobUrl = await getDocumentPdfBlobUrl(doc);
      setPreviewPdfBlobUrl(blobUrl);
    } catch (err) {
      console.warn('Could not generate PDF blob URL:', err);
      setPreviewPdfBlobUrl(null);
    }
  };

  // Favorite toggle
  const handleToggleFavorite = (doc: ScannedDocument) => {
    const updated = toggleDocumentFavorite(doc.id, !doc.isFavorite);
    if (updated) {
      setDocuments((prev) => prev.map((d) => (d.id === doc.id ? updated : d)));
    }
  };

  // Manual Upload to Drive
  const handleUploadToDrive = async (doc: ScannedDocument) => {
    if (!googleAccessToken) {
      showToast('Please connect Google Account to sync to Google Drive');
      void signInWithGoogleOAuth();
      return;
    }

    setUploadingDocId(doc.id);
    showToast(`Uploading "${doc.title}" to Google Drive...`);
    try {
      const cachedDataUrl = await getScanPdfFromStorage(doc.id);
      const driveInfo = await uploadScannedPdfToDrive(googleAccessToken, doc, cachedDataUrl || undefined);

      const updated: ScannedDocument = {
        ...doc,
        driveFileId: driveInfo.driveFileId,
        driveWebViewLink: driveInfo.webViewLink,
        driveSyncStatus: 'synced',
        driveFolderPath: `Family Circle/${DRIVE_FOLDER_NAME}`,
      };

      await saveScannedDocument(updated, googleAccessToken);
      setDocuments((prev) => prev.map((d) => (d.id === doc.id ? updated : d)));
      showToast(`✓ Uploaded to "Family Circle / ${DRIVE_FOLDER_NAME}"!`);
    } catch (err: any) {
      console.warn('Upload error:', err);
      showToast(err.message || 'Drive upload failed');
    } finally {
      setUploadingDocId(null);
    }
  };

  // Download PDF (Reliable Blob URL download)
  const handleDownload = async (doc: ScannedDocument) => {
    try {
      showToast(`Preparing "${doc.title}.pdf" download...`);
      await downloadScannedPdf(doc);
      showToast(`✓ Downloaded ${doc.title}.pdf`);
    } catch (err: any) {
      console.warn('Download error:', err);
      showToast(err.message || 'Download failed');
    }
  };

  // Share PDF (Native File Share with Drive/Download Fallback)
  const handleShare = async (doc: ScannedDocument) => {
    try {
      const res = await shareScannedPdf(doc);
      if (res.shared) {
        showToast(res.message);
      }
    } catch (err: any) {
      console.warn('Share error:', err);
      showToast('Could not share document');
    }
  };

  // Delete Document
  const handleDelete = async (doc: ScannedDocument) => {
    if (!confirm(`Delete "${doc.title}" from local storage and Google Drive?`)) return;

    try {
      await deleteScannedDocument(doc, googleAccessToken);
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
      const cached = await getAllCachedScanIds();
      setCachedScanIds(cached);
      showToast(`Deleted "${doc.title}"`);
    } catch {
      showToast('Could not delete document');
    }
  };

  // Batch Cache All Offline
  const handleCacheAllOffline = async () => {
    if (isCachingAll || documents.length === 0) return;
    setIsCachingAll(true);
    showToast('Caching all documents into offline SQLite vault...');
    try {
      let count = 0;
      for (const doc of documents) {
        if (!cachedScanIds.includes(doc.id)) {
          if (doc.driveFileId && googleAccessToken) {
            const res = await fetch(`https://www.googleapis.com/drive/v3/files/${doc.driveFileId}?alt=media`, {
              headers: { Authorization: `Bearer ${googleAccessToken}` },
            });
            if (res.ok) {
              const blob = await res.blob();
              const reader = new FileReader();
              await new Promise<void>((resolve) => {
                reader.onloadend = async () => {
                  if (reader.result) {
                    await saveScanPdfToStorage(doc.id, reader.result as string);
                    count++;
                  }
                  resolve();
                };
                reader.readAsDataURL(blob);
              });
            }
          }
        }
      }
      const updated = await getAllCachedScanIds();
      setCachedScanIds(updated);
      showToast(`✓ ${count > 0 ? count : 'All'} document(s) cached offline in SQLite!`);
    } catch (err) {
      console.warn('Batch cache error:', err);
      showToast('Offline cache completed with partial items');
    } finally {
      setIsCachingAll(false);
    }
  };

  // Open Scanner Modal
  const handleOpenScanner = () => {
    setScanTitle(`Scan - ${new Date().toLocaleDateString()}`);
    setScanPages([]);
    setIsScannerModalOpen(true);
    setTimeout(() => {
      void startCamera('environment');
    }, 200);
  };

  // Filtered documents
  const filteredDocs = documents.filter((doc) => {
    if (favoritesOnly && !doc.isFavorite) return false;
    if (selectedCategory !== 'all' && doc.category !== selectedCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = doc.title.toLowerCase().includes(q);
      const matchCat = doc.category.toLowerCase().includes(q);
      const matchNotes = (doc.notes || '').toLowerCase().includes(q);
      if (!matchTitle && !matchCat && !matchNotes) return false;
    }
    return true;
  });

  return (
    <div className="min-h-full pb-24 text-slate-100">
      {/* Top Banner Header */}
      <div className="relative mb-6 p-6 rounded-3xl bg-gradient-to-br from-slate-900 via-red-950/40 to-slate-900 border border-red-500/30 overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-red-600/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

        <div className="relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-red-600 to-rose-500 flex items-center justify-center text-white shadow-lg shadow-red-600/30">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-black tracking-tight text-white">Adobe Document Scanner</h1>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-red-500/20 text-red-300 border border-red-500/30">
                    A4 PDF PRO
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Intelligent Multi-Page Camera Scanner • Customizable A4 Vector PDF • Family Circle Drive
                </p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2 flex-wrap">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleUploadFiles}
                className="hidden"
              />

              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-2 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700/80 text-xs font-semibold text-slate-200 hover:text-white transition-all flex items-center gap-1.5"
                title="Upload image files from gallery"
              >
                <Upload className="w-3.5 h-3.5 text-slate-400" />
                <span>Upload Photos</span>
              </button>

              <button
                onClick={handleOpenScanner}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-xs shadow-lg shadow-red-600/30 transition-all flex items-center gap-1.5 active:scale-95"
              >
                <Camera className="w-4 h-4" />
                <span>Scan Document</span>
              </button>
            </div>
          </div>

          {/* Drive & Offline Status Pill */}
          <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap pt-2 border-t border-slate-800/80">
            <div className="flex items-center gap-1.5">
              <Folder className="w-3.5 h-3.5 text-amber-400" />
              <span>Drive Folder:</span>
              <span className="font-mono text-slate-200">Family Circle / {DRIVE_FOLDER_NAME}</span>
            </div>
            <span>•</span>
            <div className="flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-cyan-400" />
              <span>Client SQLite Store:</span>
              <span className="font-mono text-slate-200">{cachedScanIds.length} offline ready</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="mb-6 space-y-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search receipts, invoices, contracts..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-900/80 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-red-500/50"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1">
            <button
              onClick={() => setFavoritesOnly(!favoritesOnly)}
              className={`p-2 rounded-xl text-xs border transition-all ${
                favoritesOnly
                  ? 'bg-rose-500/20 text-rose-400 border-rose-500/50'
                  : 'bg-slate-900/80 text-slate-400 border-slate-800'
              }`}
              title="Favorites Only"
            >
              <Heart className={`w-4 h-4 ${favoritesOnly ? 'fill-current' : ''}`} />
            </button>

            <button
              onClick={handleCacheAllOffline}
              disabled={isCachingAll || documents.length === 0}
              className="px-3 py-2 rounded-xl text-xs font-semibold bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-400 border border-cyan-500/30 transition-all flex items-center gap-1.5 disabled:opacity-50 shrink-0"
              title="Cache all scanned PDFs to offline SQLite store"
            >
              {isCachingAll ? (
                <div className="w-3.5 h-3.5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <DownloadCloud className="w-3.5 h-3.5" />
              )}
              <span>Cache All Offline</span>
            </button>
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-slate-800">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-all ${
              selectedCategory === 'all'
                ? 'bg-red-600 text-white shadow-md shadow-red-600/30'
                : 'bg-slate-900/80 hover:bg-slate-800 text-slate-400 border border-slate-800'
            }`}
          >
            All Documents ({documents.length})
          </button>
          {SCAN_CATEGORIES.map((cat) => {
            const count = documents.filter((d) => d.category === cat.id).length;
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-red-600 text-white shadow-md shadow-red-600/30'
                    : 'bg-slate-900/80 hover:bg-slate-800 text-slate-400 border border-slate-800'
                }`}
              >
                <span>{cat.label}</span>
                {count > 0 && <span className="text-[10px] opacity-70">({count})</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Documents Grid */}
      {isLoading && documents.length === 0 ? (
        <div className="text-center py-16 text-slate-500 text-xs">Loading scanned documents...</div>
      ) : filteredDocs.length === 0 ? (
        <div className="text-center py-16 px-4 rounded-3xl bg-slate-900/40 border border-slate-800/80">
          <div className="w-14 h-14 rounded-3xl bg-red-950/40 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto mb-3">
            <Camera className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-white">No Scanned Documents</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-4">
            Capture camera photos of receipts, invoices, IDs, or paper documents to generate multi-page PDFs saved to Family Circle.
          </p>
          <button
            onClick={handleOpenScanner}
            className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-xs shadow-lg shadow-red-600/30 inline-flex items-center gap-2"
          >
            <Camera className="w-4 h-4" />
            <span>Start First Scan</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDocs.map((doc) => {
            const isCached = cachedScanIds.includes(doc.id);
            const isUploading = uploadingDocId === doc.id;
            const categoryObj = SCAN_CATEGORIES.find((c) => c.id === doc.category);

            return (
              <div
                key={doc.id}
                className="p-4 rounded-3xl bg-slate-900/70 hover:bg-slate-900/90 border border-slate-800/90 transition-all duration-200 flex flex-col justify-between group shadow-xl"
              >
                <div>
                  {/* Thumbnail / Document Card Top */}
                  <div
                    onClick={() => handleOpenPreview(doc)}
                    className="relative w-full h-48 rounded-2xl bg-slate-950/80 border border-slate-800/80 overflow-hidden mb-3 cursor-pointer group-hover:border-red-500/40 transition-colors flex items-center justify-center"
                  >
                    {doc.thumbnailDataUrl ? (
                      <img
                        src={doc.thumbnailDataUrl}
                        alt={doc.title}
                        className="w-full h-full object-contain p-1.5"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-slate-600">
                        <FileText className="w-12 h-12" />
                        <span className="text-[11px] font-mono">PDF Document</span>
                      </div>
                    )}

                    {/* Top Badges */}
                    <div className="absolute top-2 left-2 flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                          categoryObj?.color || 'bg-slate-800 text-slate-300 border-slate-700'
                        }`}
                      >
                        {doc.category}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-bold bg-slate-900/90 border border-slate-700 text-slate-300">
                        {doc.pageSize || 'A4'}
                      </span>
                    </div>

                    <div className="absolute top-2 right-2 flex items-center gap-1">
                      {isCached && (
                        <span
                          className="p-1 rounded-lg bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 flex items-center gap-1 px-1.5 text-[10px] font-semibold"
                          title="Cached in Client SQLite for 100% Offline Playback"
                        >
                          <Database className="w-3 h-3" />
                          <span>Offline</span>
                        </span>
                      )}
                      {doc.driveFileId ? (
                        <span
                          className="p-1 rounded-lg bg-emerald-950/80 border border-emerald-500/40 text-emerald-400 flex items-center gap-1 px-1.5 text-[10px] font-semibold"
                          title="Synced to Google Drive"
                        >
                          <UploadCloud className="w-3 h-3" />
                          <span>Drive</span>
                        </span>
                      ) : (
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded-lg bg-slate-900/80 border border-slate-700 text-slate-400 font-medium"
                          title="Stored Locally in SQLite"
                        >
                          Local
                        </span>
                      )}
                    </div>

                    {/* View PDF Hover Prompt */}
                    <div className="absolute inset-0 bg-red-950/30 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 text-white font-bold text-xs">
                      <Eye className="w-4 h-4 text-red-400" />
                      <span>View & Inspect</span>
                    </div>
                  </div>

                  {/* Title & Metadata */}
                  <h4 className="text-sm font-bold text-white truncate mb-1" title={doc.title}>
                    {doc.title}
                  </h4>

                  <div className="flex items-center gap-2 text-[11px] text-slate-400 mb-3 flex-wrap">
                    <span>{new Date(doc.createdAt).toLocaleDateString()}</span>
                    <span>•</span>
                    <span className="font-semibold text-slate-300">
                      {doc.pageCount} {doc.pageCount === 1 ? 'Page' : 'Pages'}
                    </span>
                    {doc.fileSizeBytes > 0 && (
                      <>
                        <span>•</span>
                        <span>{Math.round(doc.fileSizeBytes / 1024)} KB</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Actions Toolbar (Exact match with Voice Memo Options) */}
                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-1">
                  {/* Left: View PDF Button */}
                  <button
                    onClick={() => handleOpenPreview(doc)}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5 text-red-400" />
                    <span>View</span>
                  </button>

                  {/* Right Actions: Heart, Drive, Share, Download, External Link, Delete */}
                  <div className="flex items-center gap-1">
                    {/* Favorite / Heart */}
                    <button
                      onClick={() => handleToggleFavorite(doc)}
                      className={`p-1.5 rounded-xl transition-colors ${
                        doc.isFavorite ? 'text-rose-500 bg-rose-500/10' : 'text-slate-400 hover:text-rose-400 hover:bg-slate-800'
                      }`}
                      title={doc.isFavorite ? 'Unfavorite' : 'Favorite'}
                    >
                      <Heart className={`w-4 h-4 ${doc.isFavorite ? 'fill-current' : ''}`} />
                    </button>

                    {/* Sync to Google Drive */}
                    {!doc.driveFileId ? (
                      <button
                        onClick={() => handleUploadToDrive(doc)}
                        disabled={isUploading}
                        className="p-1.5 rounded-xl text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 transition-colors"
                        title="Sync to Google Drive"
                      >
                        {isUploading ? (
                          <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <UploadCloud className="w-4 h-4" />
                        )}
                      </button>
                    ) : (
                      doc.driveWebViewLink && (
                        <a
                          href={doc.driveWebViewLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-xl text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors"
                          title="Open in Google Drive"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )
                    )}

                    {/* Download PDF */}
                    <button
                      onClick={() => handleDownload(doc)}
                      className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                      title="Download PDF File"
                    >
                      <Download className="w-4 h-4" />
                    </button>

                    {/* Share */}
                    <button
                      onClick={() => handleShare(doc)}
                      className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                      title="Share Document"
                    >
                      <Share2 className="w-4 h-4" />
                    </button>

                    {/* Delete */}
                    <button
                      onClick={() => handleDelete(doc)}
                      className="p-1.5 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* SCANNER MODAL / VIEWFINDER */}
      {isScannerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-2xl max-h-[92vh] flex flex-col rounded-3xl bg-slate-900 border border-red-500/40 shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-red-600 flex items-center justify-center text-white">
                  <Camera className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Adobe Document Viewfinder</h3>
                  <p className="text-[11px] text-slate-400">
                    {scanPages.length} {scanPages.length === 1 ? 'Page' : 'Pages'} Captured • PDF: {pdfPageSize}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsScannerModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: Camera Viewfinder or Pages Manager */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Live Camera Viewfinder */}
              <div className="relative w-full aspect-[4/3] rounded-2xl bg-black overflow-hidden border border-slate-800 shadow-inner flex items-center justify-center">
                <video
                  ref={videoRef}
                  playsInline
                  autoPlay
                  muted
                  className="w-full h-full object-cover"
                />

                {/* Document Edge Alignment Guides (A4 Aspect Ratio Overlay) */}
                <div className="absolute inset-5 border-2 border-dashed border-red-400/60 rounded-xl pointer-events-none flex items-center justify-center">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-red-300 bg-black/70 px-2.5 py-0.5 rounded-full border border-red-500/30">
                    Align {pdfPageSize} Document Within Frame
                  </span>
                </div>

                {cameraError && (
                  <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-4 text-center">
                    <Camera className="w-8 h-8 text-red-400 mb-2" />
                    <p className="text-xs text-slate-300 mb-3">{cameraError}</p>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 rounded-xl bg-red-600 text-white font-bold text-xs"
                    >
                      Upload Images Instead
                    </button>
                  </div>
                )}

                {/* Viewfinder Controls Overlay */}
                <div className="absolute bottom-3 inset-x-3 flex items-center justify-between">
                  <button
                    onClick={handleToggleCameraFacing}
                    className="p-2.5 rounded-full bg-slate-900/80 border border-slate-700 text-white hover:bg-slate-800"
                    title="Switch Camera (Front/Back)"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>

                  {/* Shutter Capture Button */}
                  <button
                    onClick={handleCapturePage}
                    className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-500 border-4 border-white text-white flex items-center justify-center shadow-xl shadow-red-600/50 active:scale-95 transition-transform"
                    title="Capture Page"
                  >
                    <div className="w-4 h-4 rounded-full bg-white" />
                  </button>

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2.5 rounded-full bg-slate-900/80 border border-slate-700 text-white hover:bg-slate-800"
                    title="Upload image from gallery"
                  >
                    <Upload className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Captured Pages Strip */}
              {scanPages.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-300">
                      Captured Pages ({scanPages.length})
                    </span>
                    <span className="text-[11px] text-slate-500">Tap to select, rotate or apply filter</span>
                  </div>

                  <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-800">
                    {scanPages.map((page, idx) => (
                      <div
                        key={page.id}
                        onClick={() => setSelectedPageIdx(idx)}
                        className={`relative shrink-0 w-20 h-28 rounded-xl overflow-hidden border-2 cursor-pointer transition-all ${
                          selectedPageIdx === idx
                            ? 'border-red-500 shadow-lg shadow-red-500/25 scale-105'
                            : 'border-slate-800 opacity-70 hover:opacity-100'
                        }`}
                      >
                        <img
                          src={page.dataUrl}
                          alt={`Page ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute top-1 left-1 px-1.5 py-0.2 rounded bg-black/70 text-[9px] font-bold text-white">
                          P.{idx + 1}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Page Controls Toolbar for selected page */}
                  {scanPages[selectedPageIdx] && (
                    <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 text-xs text-slate-300">
                        <span className="font-bold">Page {selectedPageIdx + 1} Filters:</span>
                        {(['magic', 'grayscale', 'bw', 'original'] as ScanImageFilter[]).map((f) => (
                          <button
                            key={f}
                            onClick={() => handleChangePageFilter(selectedPageIdx, f)}
                            className={`px-2 py-1 rounded-lg text-[10px] font-semibold capitalize ${
                              scanPages[selectedPageIdx].filter === f
                                ? 'bg-red-600 text-white'
                                : 'bg-slate-800 text-slate-400 hover:text-white'
                            }`}
                          >
                            {f === 'magic' ? 'Magic Color' : f}
                          </button>
                        ))}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleRotatePage(selectedPageIdx)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center gap-1 text-xs"
                          title="Rotate 90°"
                        >
                          <RotateCw className="w-3.5 h-3.5" />
                          <span>Rotate</span>
                        </button>

                        <button
                          onClick={() => handleDeletePage(selectedPageIdx)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 flex items-center gap-1 text-xs"
                          title="Delete Page"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Metadata Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                    Document Title
                  </label>
                  <input
                    type="text"
                    value={scanTitle}
                    onChange={(e) => setScanTitle(e.target.value)}
                    placeholder="e.g. Electric Bill, Lease, Passport"
                    className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-red-500/50"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                    Document Category
                  </label>
                  <select
                    value={scanCategory}
                    onChange={(e) => setScanCategory(e.target.value as ScanCategory)}
                    className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-red-500/50"
                  >
                    {SCAN_CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Customizable PDF Options Accordion (Default A4) */}
              <div className="rounded-2xl bg-slate-950/60 border border-slate-800/90 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowPdfOptions(!showPdfOptions)}
                  className="w-full p-3 flex items-center justify-between text-xs font-bold text-slate-300 hover:text-white"
                >
                  <div className="flex items-center gap-2">
                    <Settings2 className="w-4 h-4 text-red-400" />
                    <span>PDF Page Size & Layout Customization</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-red-950/80 border border-red-500/30 text-red-300">
                      Default: {pdfPageSize}
                    </span>
                  </div>
                  <ChevronRight className={`w-4 h-4 transition-transform ${showPdfOptions ? 'rotate-90' : ''}`} />
                </button>

                {showPdfOptions && (
                  <div className="p-3 pt-0 border-t border-slate-800/60 space-y-3">
                    {/* Page Size Select */}
                    <div>
                      <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                        Page Format / Size
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                        {PDF_PAGE_SIZE_OPTIONS.map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setPdfPageSize(opt.id)}
                            className={`p-2 rounded-xl text-left border transition-all ${
                              pdfPageSize === opt.id
                                ? 'bg-red-950/60 border-red-500/60 text-white shadow-md shadow-red-500/10'
                                : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white'
                            }`}
                          >
                            <div className="text-xs font-bold flex items-center justify-between">
                              <span>{opt.label}</span>
                              {pdfPageSize === opt.id && <Check className="w-3 h-3 text-red-400" />}
                            </div>
                            <div className="text-[10px] text-slate-500 truncate mt-0.5">
                              {opt.description}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Orientation & Margin Grid */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                          Orientation
                        </label>
                        <select
                          value={pdfOrientation}
                          onChange={(e) => setPdfOrientation(e.target.value as PdfOrientation)}
                          className="w-full px-2.5 py-1.5 text-xs bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none"
                        >
                          <option value="auto">Auto (Match Image)</option>
                          <option value="portrait">Portrait</option>
                          <option value="landscape">Landscape</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                          Page Margin
                        </label>
                        <select
                          value={pdfMargin}
                          onChange={(e) => setPdfMargin(e.target.value as PdfMargin)}
                          className="w-full px-2.5 py-1.5 text-xs bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none"
                        >
                          <option value="narrow">Narrow (5 mm) - Recommended</option>
                          <option value="standard">Standard (10 mm)</option>
                          <option value="none">None (Full Bleed)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 flex items-center justify-between gap-3 bg-slate-950/60">
              <button
                onClick={() => setIsScannerModalOpen(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>

              <button
                onClick={handleSaveDocument}
                disabled={isGeneratingPdf || scanPages.length === 0}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-red-600/30 flex items-center gap-2"
              >
                {isGeneratingPdf ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Building {pdfPageSize} PDF & Syncing...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Save {scanPages.length} Page ({pdfPageSize}) PDF</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INTELLIGENT DUAL-MODE DOCUMENT & PDF VIEWER MODAL */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-4xl h-[92vh] flex flex-col rounded-3xl bg-slate-900 border border-red-500/40 shadow-2xl overflow-hidden">
            {/* Preview Header */}
            <div className="p-3 sm:p-4 border-b border-slate-800 flex items-center justify-between gap-2 flex-wrap bg-slate-950/70">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="w-5 h-5 text-red-500 shrink-0" />
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-white truncate max-w-[200px] sm:max-w-md">
                    {previewDoc.title}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {previewDoc.pageCount} Pages • {previewDoc.category} • Format: {previewDoc.pageSize || 'A4'} • {Math.round(previewDoc.fileSizeBytes / 1024)} KB
                  </p>
                </div>
              </div>

              {/* Viewer Controls & Action Buttons */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {/* View Mode Toggle: Scanned Pages vs Native PDF Blob */}
                <div className="flex items-center bg-slate-800/90 rounded-xl p-0.5 border border-slate-700/80 mr-1">
                  <button
                    onClick={() => setPreviewViewMode('pages')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
                      previewViewMode === 'pages'
                        ? 'bg-red-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Pages
                  </button>
                  <button
                    onClick={() => setPreviewViewMode('pdf')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
                      previewViewMode === 'pdf'
                        ? 'bg-red-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    PDF Canvas
                  </button>
                </div>

                {/* Open in New Browser Tab */}
                {previewPdfBlobUrl && (
                  <button
                    onClick={() => window.open(previewPdfBlobUrl, '_blank')}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white"
                    title="Open PDF in Fullscreen Browser Tab"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                )}

                {/* Download PDF */}
                <button
                  onClick={() => handleDownload(previewDoc)}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white"
                  title="Download PDF"
                >
                  <Download className="w-4 h-4" />
                </button>

                {/* Share PDF */}
                <button
                  onClick={() => handleShare(previewDoc)}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white"
                  title="Share PDF"
                >
                  <Share2 className="w-4 h-4" />
                </button>

                {/* Google Drive Link */}
                {previewDoc.driveWebViewLink && (
                  <a
                    href={previewDoc.driveWebViewLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30"
                    title="Open in Google Drive"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}

                {/* Close */}
                <button
                  onClick={() => {
                    setPreviewDoc(null);
                    setPreviewPdfBlobUrl(null);
                  }}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Viewer Body */}
            <div className="flex-1 bg-slate-950 p-3 overflow-hidden flex flex-col items-center justify-center relative">
              {previewViewMode === 'pages' && previewDoc.pages && previewDoc.pages.length > 0 ? (
                // 1. Interactive High-Res Page Reader
                <div className="w-full h-full flex flex-col items-center justify-between">
                  {/* Zoom Controls */}
                  <div className="w-full flex items-center justify-between text-xs text-slate-400 px-2 py-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-200">
                        Page {previewActivePage + 1} of {previewDoc.pages.length}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                        {previewDoc.pageSize || 'A4'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setPreviewZoom((z) => Math.max(0.6, z - 0.2))}
                        className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300"
                        title="Zoom Out"
                      >
                        <ZoomOut className="w-3.5 h-3.5" />
                      </button>
                      <span className="font-mono text-[11px] w-12 text-center">
                        {Math.round(previewZoom * 100)}%
                      </span>
                      <button
                        onClick={() => setPreviewZoom((z) => Math.min(2.5, z + 0.2))}
                        className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300"
                        title="Zoom In"
                      >
                        <ZoomIn className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setPreviewZoom(1)}
                        className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-[10px] text-slate-400"
                      >
                        Reset
                      </button>
                    </div>
                  </div>

                  {/* Active Page Image Container */}
                  <div className="flex-1 w-full overflow-auto flex items-center justify-center p-2">
                    <img
                      src={previewDoc.pages[previewActivePage]?.dataUrl || previewDoc.thumbnailDataUrl}
                      alt={`Page ${previewActivePage + 1}`}
                      style={{
                        transform: `scale(${previewZoom})`,
                        transformOrigin: 'center center',
                        transition: 'transform 0.15s ease-out',
                      }}
                      className="max-h-[64vh] max-w-full object-contain rounded-xl shadow-2xl border border-slate-800 bg-white"
                    />
                  </div>

                  {/* Bottom Page Navigation Scrubber */}
                  <div className="w-full pt-2 flex items-center justify-center gap-3">
                    <button
                      onClick={() => setPreviewActivePage((p) => Math.max(0, p - 1))}
                      disabled={previewActivePage === 0}
                      className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-30 text-xs font-semibold flex items-center gap-1"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span>Prev Page</span>
                    </button>

                    <div className="flex gap-1.5 overflow-x-auto max-w-[280px] sm:max-w-md py-1">
                      {previewDoc.pages.map((p, i) => (
                        <button
                          key={p.id || i}
                          onClick={() => setPreviewActivePage(i)}
                          className={`w-7 h-7 rounded-lg text-xs font-bold transition-all shrink-0 ${
                            previewActivePage === i
                              ? 'bg-red-600 text-white shadow-md shadow-red-600/30'
                              : 'bg-slate-900 text-slate-400 hover:text-white'
                          }`}
                        >
                          {i + 1}
                        </button>
                      ))}
                    </div>

                    <button
                      onClick={() => setPreviewActivePage((p) => Math.min(previewDoc.pages.length - 1, p + 1))}
                      disabled={previewActivePage === previewDoc.pages.length - 1}
                      className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-30 text-xs font-semibold flex items-center gap-1"
                    >
                      <span>Next Page</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : previewPdfBlobUrl ? (
                // 2. Native PDF Blob Viewer
                <div className="w-full h-full flex flex-col items-center justify-center">
                  <object
                    data={previewPdfBlobUrl}
                    type="application/pdf"
                    className="w-full h-full rounded-2xl border border-slate-800"
                  >
                    {/* Fallback if object element cannot render inline PDF */}
                    <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-slate-950">
                      <FileText className="w-16 h-16 text-red-500 mb-3" />
                      <h4 className="text-base font-bold text-white mb-1">{previewDoc.title}</h4>
                      <p className="text-xs text-slate-400 mb-4 max-w-sm">
                        Standard vector PDF ({previewDoc.pageSize || 'A4'}) ready. Open in browser or download directly.
                      </p>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => window.open(previewPdfBlobUrl, '_blank')}
                          className="px-4 py-2 rounded-xl bg-red-600 text-white font-bold text-xs shadow-lg shadow-red-600/30 flex items-center gap-2"
                        >
                          <ExternalLink className="w-4 h-4" />
                          <span>Open in Fullscreen Reader</span>
                        </button>
                        <button
                          onClick={() => handleDownload(previewDoc)}
                          className="px-4 py-2 rounded-xl bg-slate-800 text-slate-200 text-xs font-semibold flex items-center gap-2"
                        >
                          <Download className="w-4 h-4" />
                          <span>Download PDF</span>
                        </button>
                      </div>
                    </div>
                  </object>
                </div>
              ) : previewDoc.thumbnailDataUrl ? (
                // 3. Fallback to Thumbnail
                <div className="flex flex-col items-center justify-center p-4">
                  <img
                    src={previewDoc.thumbnailDataUrl}
                    alt={previewDoc.title}
                    className="max-h-[70vh] max-w-full object-contain rounded-xl shadow-2xl border border-slate-800"
                  />
                </div>
              ) : (
                <div className="text-center text-slate-500 text-xs">
                  <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Loading document pages...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl bg-slate-900 border border-red-500/60 text-white text-xs font-semibold shadow-2xl flex items-center gap-2 backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-200">
          <Sparkles className="w-4 h-4 text-red-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
