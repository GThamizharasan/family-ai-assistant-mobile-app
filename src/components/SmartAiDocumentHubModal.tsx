import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  Receipt,
  Stethoscope,
  Camera,
  Upload,
  Sparkles,
  CheckCircle2,
  Loader2,
  Trash2,
  ExternalLink,
  ShieldCheck,
  Pill,
  Wallet,
  Bell,
  Volume2,
  Cloud,
  RefreshCw,
  History,
  Eye,
  ArrowLeft,
  Search,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  analyzeFamilyDocumentWithAi,
  createWarrantyOrBillReminder,
  deleteSmartDocumentEverywhere,
  loadSmartDocuments,
  PrescriptionLabExtracted,
  ReceiptWarrantyExtracted,
  SavedSmartDocument,
  saveSmartDocumentEverywhere,
  scheduleMedicationRemindersFromDoc,
  SmartFamilyDocType,
  syncAllSmartDocumentsWithDrive,
} from '../services/smartDocumentAiService';
import { reconcileReceiptWithGroceryList } from '../services/familyLifeSuiteService';
import { speechEngine } from '../services/speech';
import {
  AI_MODEL_CHANGED_EVENT,
  getActiveAiModel,
  getActiveAiProvider,
  getModelDisplayName,
} from '../services/aiConfig';

interface SmartAiDocumentHubModalProps {
  isOpen: boolean;
  initialDocType?: SmartFamilyDocType;
  onClose: () => void;
}

export const SmartAiDocumentHubModal: React.FC<SmartAiDocumentHubModalProps> = ({
  isOpen,
  initialDocType = 'receipt_warranty',
  onClose,
}) => {
  const { user, googleAccessToken, addTransaction } = useApp();
  const [docType, setDocType] = useState<SmartFamilyDocType>(initialDocType);
  const [rawText, setRawText] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [uploadedPdfBase64, setUploadedPdfBase64] = useState<string | null>(null);
  const [uploadedFileText, setUploadedFileText] = useState<string>('');
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [isParsingFile, setIsParsingFile] = useState(false);
  const [imageMime, setImageMime] = useState<string>('image/jpeg');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [extractedReceipt, setExtractedReceipt] = useState<ReceiptWarrantyExtracted | null>(null);
  const [extractedMedical, setExtractedMedical] = useState<PrescriptionLabExtracted | null>(null);
  const [modelUsedBadge, setModelUsedBadge] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [savedDocs, setSavedDocs] = useState<SavedSmartDocument[]>([]);
  const [selectedHistoryDoc, setSelectedHistoryDoc] = useState<SavedSmartDocument | null>(null);
  const [historyScope, setHistoryScope] = useState<'tab' | 'all'>('all');
  const [historySearch, setHistorySearch] = useState('');
  const [isSyncingDrive, setIsSyncingDrive] = useState(false);
  const [activeAiLabel, setActiveAiLabel] = useState<string>(() => {
    const p = getActiveAiProvider();
    return `${p.toUpperCase()} · ${getModelDisplayName(p, getActiveAiModel(p))}`;
  });

  useEffect(() => {
    const syncModel = () => {
      const p = getActiveAiProvider();
      setActiveAiLabel(`${p.toUpperCase()} · ${getModelDisplayName(p, getActiveAiModel(p))}`);
    };
    window.addEventListener(AI_MODEL_CHANGED_EVENT, syncModel);
    return () => window.removeEventListener(AI_MODEL_CHANGED_EVENT, syncModel);
  }, []);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setDocType(initialDocType);
  }, [initialDocType]);

  useEffect(() => {
    if (!isOpen) return;
    void loadSmartDocuments(user?.email, googleAccessToken).then(setSavedDocs);
  }, [isOpen, user?.email, googleAccessToken]);

  if (!isOpen) return null;

  const stripHtmlToReadableText = (html: string): string => {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      doc.querySelectorAll('style, script, svg, noscript').forEach((el) => el.remove());
      const rows = Array.from(doc.querySelectorAll('tr')).map((tr) =>
        Array.from(tr.querySelectorAll('th, td'))
          .map((cell) => (cell.textContent || '').replace(/\s+/g, ' ').trim())
          .filter(Boolean)
          .join(' | ')
      );
      const bodyText = (doc.body?.innerText || doc.body?.textContent || '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
      return rows.length > 0 ? `${bodyText}\n\n${rows.join('\n')}` : bodyText;
    } catch {
      return html
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }
  };

  const downscaleImageFile = (file: File): Promise<{ dataUrl: string; mime: string }> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Failed to read image'));
      reader.onload = () => {
        const rawUrl = typeof reader.result === 'string' ? reader.result : '';
        if (!rawUrl) return resolve({ dataUrl: '', mime: 'image/jpeg' });
        const img = new Image();
        img.onload = () => {
          const maxDim = 1280;
          const scale = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
          const w = Math.max(1, Math.round(img.width * scale));
          const h = Math.max(1, Math.round(img.height * scale));
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) return resolve({ dataUrl: rawUrl, mime: file.type || 'image/jpeg' });
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          resolve({ dataUrl: canvas.toDataURL('image/jpeg', 0.84), mime: 'image/jpeg' });
        };
        img.onerror = () => resolve({ dataUrl: rawUrl, mime: file.type || 'image/jpeg' });
        img.src = rawUrl;
      };
      reader.readAsDataURL(file);
    });

  const handleClearUploadedFile = () => {
    setPreviewImage(null);
    setUploadedPdfBase64(null);
    setUploadedFileText('');
    setUploadedFileName(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatusMessage(null);
    setPreviewImage(null);
    setUploadedPdfBase64(null);
    setUploadedFileText('');
    setUploadedFileName(file.name);
    setIsParsingFile(true);

    try {
      const lowerName = file.name.toLowerCase();
      const isPdf = file.type === 'application/pdf' || lowerName.endsWith('.pdf');
      const isHtml = file.type === 'text/html' || lowerName.endsWith('.html') || lowerName.endsWith('.htm');
      const isText =
        file.type.startsWith('text/') ||
        lowerName.endsWith('.txt') ||
        lowerName.endsWith('.csv') ||
        lowerName.endsWith('.md');

      if (isPdf) {
        const buf = await file.arrayBuffer();
        const bytes = new Uint8Array(buf);
        // Save base64 for scanned/image-only PDFs
        let bin = '';
        for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
        setUploadedPdfBase64(`data:application/pdf;base64,${btoa(bin)}`);

        // Extract clean text from every PDF page so NVIDIA, OpenAI, Claude, Custom & Gemini all read it!
        try {
          const { extractPdfChaptersAndPages } = await import('../utils/pdfHelper');
          const extractedPdf = await extractPdfChaptersAndPages(bytes);
          const allText = (extractedPdf.chapters || [])
            .map((ch) => ch.content || '')
            .join('\n\n')
            .trim();
          if (allText) {
            setUploadedFileText(allText);
          }
        } catch (pdfErr) {
          console.warn('[SmartDoc] PDF text layer extraction fallback:', pdfErr);
        }
      } else if (isHtml) {
        const htmlStr = await file.text();
        const cleanText = stripHtmlToReadableText(htmlStr);
        setUploadedFileText(cleanText);
      } else if (isText) {
        const txt = await file.text();
        setUploadedFileText(txt.trim());
      } else {
        // Image (Camera photo or uploaded PNG/JPG/WEBP)
        const { dataUrl, mime } = await downscaleImageFile(file);
        setImageMime(mime);
        setPreviewImage(dataUrl);
      }
    } catch (err: any) {
      setStatusMessage(`Could not read "${file.name}": ${err?.message || 'Unsupported file'}`);
    } finally {
      setIsParsingFile(false);
    }
  };

  const handleAnalyze = async () => {
    const combinedText = [uploadedFileText, rawText.trim()].filter(Boolean).join('\n\n').trim();
    if (!previewImage && !uploadedPdfBase64 && !combinedText) return;
    setIsAnalyzing(true);
    setStatusMessage(null);
    setExtractedReceipt(null);
    setExtractedMedical(null);

    try {
      const res = await analyzeFamilyDocumentWithAi({
        docType,
        imageBase64: previewImage || undefined,
        pdfBase64: uploadedPdfBase64 || undefined,
        mimeType: imageMime,
        rawText: combinedText,
      });
      setModelUsedBadge(res.modelUsed);
      if (!res.usedAi && res.fallbackReason) {
        setStatusMessage(`⚠️ Cloud Vision fallback (${res.fallbackReason}). If you just updated the app, restart the local server.`);
      }
      if (docType === 'receipt_warranty') {
        setExtractedReceipt(res.extracted as ReceiptWarrantyExtracted);
      } else {
        setExtractedMedical(res.extracted as PrescriptionLabExtracted);
      }
    } catch (err: any) {
      setStatusMessage(`Analysis error: ${err?.message || 'Please try again.'}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleApplyReceipt = async () => {
    if (!extractedReceipt || isApplying) return;
    setIsApplying(true);
    try {
      // 1. Add real expense transaction into Finance Hub (AppContext)
      addTransaction({
        title: `${extractedReceipt.vendor} — ${extractedReceipt.title}`.slice(0, 64),
        category: extractedReceipt.category || 'Living & Housing',
        amount: extractedReceipt.totalAmount || 0,
        type: 'expense',
        date: extractedReceipt.purchaseDate || new Date().toISOString().split('T')[0],
        member: user?.name || 'Family',
      });

      // 2. Schedule Warranty or Bill Due Reminder if present
      const reminderCreated = await createWarrantyOrBillReminder(
        extractedReceipt,
        googleAccessToken,
        user?.email
      );

      // 3. Persist to SQLite + Google Drive
      const saved = await saveSmartDocumentEverywhere(
        {
          docType: 'receipt_warranty',
          title: extractedReceipt.title,
          vendorOrDoctor: extractedReceipt.vendor,
          amount: extractedReceipt.totalAmount,
          currency: extractedReceipt.currency || '₹',
          expiryOrDueDate:
            extractedReceipt.warrantyExpiryDate || extractedReceipt.billDueDate || undefined,
          payload: extractedReceipt,
        },
        { userEmail: user?.email, googleAccessToken }
      );

      // 4. Auto-reconcile supermarket/grocery line items with Shared Family Grocery List + log price history!
      const groceryMatched = await reconcileReceiptWithGroceryList(extractedReceipt, {
        userEmail: user?.email,
        googleAccessToken,
      });

      setSavedDocs((prev) => [saved, ...prev.filter((d) => d.id !== saved.id)]);
      setStatusMessage(
        `✅ Logged ${extractedReceipt.currency}${extractedReceipt.totalAmount} in Finance Hub${
          reminderCreated ? ' + Warranty/Bill Reminder' : ''
        }${groceryMatched > 0 ? ` + checked off ${groceryMatched} Grocery item(s)` : ''} + saved to SQLite${
          saved.syncedToDrive ? ' & Google Drive!' : '!'
        }`
      );
    } finally {
      setIsApplying(false);
    }
  };

  const handleApplyPrescription = async () => {
    if (!extractedMedical || isApplying) return;
    setIsApplying(true);
    try {
      const remCount = await scheduleMedicationRemindersFromDoc(
        extractedMedical,
        googleAccessToken,
        user?.email
      );

      const saved = await saveSmartDocumentEverywhere(
        {
          docType: 'prescription_lab',
          title: extractedMedical.title,
          vendorOrDoctor: extractedMedical.doctorOrLab,
          payload: extractedMedical,
        },
        { userEmail: user?.email, googleAccessToken }
      );

      setSavedDocs((prev) => [saved, ...prev.filter((d) => d.id !== saved.id)]);
      const reminderLabel =
        extractedMedical.medications.length > 0
          ? `${remCount} medication reminder(s)`
          : `${remCount} lab follow-up reminder`;
      setStatusMessage(
        `✅ Scheduled ${reminderLabel} + archived report to SQLite${
          saved.syncedToDrive ? ' & Google Drive!' : '!'
        }`
      );
    } finally {
      setIsApplying(false);
    }
  };

  const handleSyncAllDrive = async () => {
    if (isSyncingDrive) return;
    setIsSyncingDrive(true);
    setStatusMessage(null);
    try {
      const res = await syncAllSmartDocumentsWithDrive(user?.email, googleAccessToken);
      setSavedDocs(res.records);
      if (res.needsSignIn) {
        setStatusMessage('☁️ Sign in with Google Drive in the app header to sync your report history across devices.');
      } else {
        setStatusMessage(
          `✅ Synced ${res.records.length} saved report(s) with Google Drive + SQLite${
            res.pulledFromDriveCount > 0 ? ` (restored ${res.pulledFromDriveCount} from Drive!)` : '!'
          }`
        );
      }
    } catch (err: any) {
      setStatusMessage(`Drive sync failed: ${err?.message || 'Please try again.'}`);
    } finally {
      setIsSyncingDrive(false);
    }
  };

  const filteredVault = savedDocs.filter((d) => {
    if (historyScope === 'tab' && d.docType !== docType) return false;
    const q = historySearch.trim().toLowerCase();
    if (!q) return true;
    const payloadStr = JSON.stringify(d.payload || {}).toLowerCase();
    return (
      (d.title || '').toLowerCase().includes(q) ||
      (d.vendorOrDoctor || '').toLowerCase().includes(q) ||
      payloadStr.includes(q)
    );
  });

  return (
    <div
      className="fixed inset-0 z-[70] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[90vh] rounded-3xl bg-slate-900 border border-white/15 shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-950/90 via-slate-900 to-rose-950/80 border-b border-white/10 flex items-center justify-between gap-3">
          <div>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-white/10 text-cyan-200 border border-white/15">
              Active AI: {activeAiLabel} · SQLite + Drive
            </span>
            <h3 className="text-lg sm:text-xl font-black text-white mt-1">
              Smart AI Family Document & Health Analyzer
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-2xl bg-white/10 hover:bg-white/20 text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Switcher */}
        <div className="px-4 pt-3 pb-2 bg-slate-950/60 border-b border-white/10 grid grid-cols-2 gap-2">
          <button
            onClick={() => {
              setDocType('receipt_warranty');
              setStatusMessage(null);
            }}
            className={`py-2.5 px-3 rounded-2xl text-xs font-extrabold flex items-center justify-center gap-2 cursor-pointer transition-all ${
              docType === 'receipt_warranty'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 shadow-lg'
                : 'bg-slate-900 text-slate-300 border border-white/10'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>Receipts, Bills & Warranties</span>
          </button>
          <button
            onClick={() => {
              setDocType('prescription_lab');
              setStatusMessage(null);
            }}
            className={`py-2.5 px-3 rounded-2xl text-xs font-extrabold flex items-center justify-center gap-2 cursor-pointer transition-all ${
              docType === 'prescription_lab'
                ? 'bg-gradient-to-r from-rose-500 to-pink-600 text-white shadow-lg'
                : 'bg-slate-900 text-slate-300 border border-white/10'
            }`}
          >
            <Stethoscope className="w-4 h-4" />
            <span>Prescriptions & Lab Reports</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* Capture / Upload / Paste Area */}
          <div className="rounded-3xl bg-slate-950/75 border border-white/10 p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileChange}
                className="hidden"
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf,.html,.htm,.txt,.csv,.md"
                onChange={(e) => void handleFileChange(e)}
                className="hidden"
              />
              <button
                onClick={() => cameraInputRef.current?.click()}
                className="px-3.5 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-200 border border-cyan-400/40 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Camera className="w-4 h-4" /> Snap Camera Photo
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Upload className="w-4 h-4" /> Upload Photo / PDF / HTML
              </button>
              {(previewImage || uploadedFileName) && (
                <button
                  onClick={handleClearUploadedFile}
                  className="px-2.5 py-2 rounded-xl bg-rose-500/20 text-rose-200 text-xs font-bold cursor-pointer"
                >
                  Remove File
                </button>
              )}
            </div>

            {isParsingFile && (
              <div className="text-xs text-cyan-300 flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Reading uploaded report...</span>
              </div>
            )}

            {uploadedFileName && !isParsingFile && (
              <div className="rounded-xl bg-indigo-950/60 border border-indigo-400/35 px-3 py-2 text-xs text-indigo-100 flex items-center justify-between gap-2">
                <span className="truncate font-semibold">
                  📄 Loaded: <strong>{uploadedFileName}</strong>
                  {uploadedFileText ? ` (${uploadedFileText.length} chars ready for AI)` : previewImage ? ' (Image ready)' : ' (PDF ready)'}
                </span>
              </div>
            )}

            {previewImage && (
              <img
                src={previewImage}
                alt="Uploaded document preview"
                className="max-h-44 rounded-2xl border border-white/15 object-contain bg-black/40 p-1"
              />
            )}

            <textarea
              rows={3}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder={
                docType === 'receipt_warranty'
                  ? 'Or paste receipt/bill text (e.g. "Samsung Microwave ₹12,499 · 2 Year Warranty · Croma Chennai")...'
                  : 'Or paste prescription/lab notes (e.g. "Paracetamol 500mg 1-0-1 after food for 5 days; Hemoglobin 13.4 g/dL")...'
              }
              className="w-full rounded-2xl bg-slate-900 border border-white/15 focus:border-cyan-400 p-3 text-xs text-white outline-none"
            />

            <button
              onClick={() => void handleAnalyze()}
              disabled={
                isAnalyzing ||
                isParsingFile ||
                (!previewImage && !uploadedPdfBase64 && !uploadedFileText && !rawText.trim())
              }
              className="w-full py-2.5 rounded-2xl bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-500 hover:brightness-110 disabled:opacity-45 text-white text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 shadow-lg cursor-pointer"
            >
              {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              <span>
                {isAnalyzing
                  ? 'Analyzing Document with AI...'
                  : docType === 'receipt_warranty'
                  ? 'Extract Expense, Bill Due Date & Warranty'
                  : 'Extract Medication Schedule & Bilingual (EN/தமிழ்) Summary'}
              </span>
            </button>
          </div>

          {statusMessage && (
            <div className="rounded-2xl bg-emerald-500/20 border border-emerald-400/40 px-4 py-2.5 text-xs font-bold text-emerald-100 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{statusMessage}</span>
            </div>
          )}

          {/* Extracted Receipt / Warranty Card */}
          {docType === 'receipt_warranty' && extractedReceipt && (
            <div className="rounded-3xl bg-emerald-950/35 border border-emerald-400/40 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-[10px] font-mono text-emerald-300 uppercase">
                    Extracted via {modelUsedBadge}
                  </span>
                  <h4 className="text-base font-black text-white">{extractedReceipt.title}</h4>
                  <p className="text-xs text-slate-300">
                    Vendor: <strong className="text-white">{extractedReceipt.vendor}</strong> · Category:{' '}
                    <strong className="text-cyan-300">{extractedReceipt.category}</strong>
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-black text-emerald-300">
                    {extractedReceipt.currency}
                    {extractedReceipt.totalAmount}
                  </div>
                  <div className="text-[10px] text-slate-400">{extractedReceipt.purchaseDate}</div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 text-xs">
                {extractedReceipt.warrantyExpiryDate && (
                  <span className="px-2.5 py-1 rounded-xl bg-amber-500/20 text-amber-200 border border-amber-400/40 font-bold flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" /> Warranty till {extractedReceipt.warrantyExpiryDate}
                  </span>
                )}
                {extractedReceipt.billDueDate && (
                  <span className="px-2.5 py-1 rounded-xl bg-rose-500/20 text-rose-200 border border-rose-400/40 font-bold flex items-center gap-1">
                    <Bell className="w-3.5 h-3.5" /> Due: {extractedReceipt.billDueDate}
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-200">{extractedReceipt.summary}</p>

              <button
                onClick={() => void handleApplyReceipt()}
                disabled={isApplying}
                className="w-full py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg"
              >
                <Wallet className="w-4 h-4" />
                <span>
                  {isApplying
                    ? 'Saving Everywhere...'
                    : 'Log Expense in Finance Hub + Set Reminder + Sync SQLite & Drive'}
                </span>
              </button>
            </div>
          )}

          {/* Extracted Prescription / Lab Report Card */}
          {docType === 'prescription_lab' && extractedMedical && (
            <div className="rounded-3xl bg-rose-950/30 border border-rose-400/40 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-[10px] font-mono text-rose-300 uppercase">
                    Extracted via {modelUsedBadge}
                  </span>
                  <h4 className="text-base font-black text-white">{extractedMedical.title}</h4>
                  <p className="text-xs text-slate-300">
                    {extractedMedical.doctorOrLab} · Patient: <strong className="text-white">{extractedMedical.patientName}</strong>
                  </p>
                </div>
                <button
                  onClick={() =>
                    speechEngine.speak(
                      `${extractedMedical.simpleEnglishSummary} ${extractedMedical.simpleTamilSummary}`
                    )
                  }
                  className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Volume2 className="w-3.5 h-3.5" /> Read EN + தமிழ்
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                <div className="rounded-2xl bg-slate-950/75 p-3 border border-white/10">
                  <div className="text-[10px] font-bold uppercase text-cyan-300 mb-1">
                    Plain English Summary
                  </div>
                  <p className="text-slate-200 leading-relaxed">
                    {extractedMedical.simpleEnglishSummary}
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-950/75 p-3 border border-white/10">
                  <div className="text-[10px] font-bold uppercase text-amber-300 mb-1">
                    எளிய தமிழ் விளக்கம்
                  </div>
                  <p className="text-amber-100 leading-relaxed">
                    {extractedMedical.simpleTamilSummary}
                  </p>
                </div>
              </div>

              {extractedMedical.medications.length === 0 && (
                <div className="rounded-xl bg-slate-950/70 border border-white/10 px-3 py-2 text-xs text-slate-300">
                  ℹ️ No separate prescription medicines were listed in this lab report — all detected lab markers & bilingual insights are shown below and ready to save!
                </div>
              )}

              {extractedMedical.medications.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[11px] font-extrabold uppercase text-rose-200 flex items-center gap-1">
                    <Pill className="w-3.5 h-3.5" /> Auto-Detected Medication Schedule
                  </div>
                  {extractedMedical.medications.map((m, idx) => (
                    <div
                      key={idx}
                      className="rounded-xl bg-slate-950/80 border border-white/10 p-2.5 text-xs flex flex-wrap items-center justify-between gap-2"
                    >
                      <div>
                        <strong className="text-white">{m.name}</strong>{' '}
                        <span className="text-cyan-300">({m.dosage})</span>
                        <div className="text-[11px] text-slate-400">
                          {m.frequency} · {m.mealRule} · {m.durationDays} days
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {(m.timings || []).map((t) => (
                          <span
                            key={t}
                            className="px-2 py-0.5 rounded-lg bg-rose-500/20 text-rose-200 text-[10px] font-bold"
                          >
                            ⏰ {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {extractedMedical.labMarkers.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[11px] font-extrabold uppercase text-emerald-300">
                    🧪 Detected Lab Tests & Markers ({extractedMedical.labMarkers.length})
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {extractedMedical.labMarkers.map((lm, idx) => (
                      <div
                        key={idx}
                        className={`p-2.5 rounded-2xl border text-xs space-y-0.5 ${
                          lm.status === 'normal'
                            ? 'bg-emerald-500/12 border-emerald-400/35 text-emerald-100'
                            : 'bg-amber-500/18 border-amber-400/45 text-amber-100'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <strong className="text-white">{lm.testName}</strong>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-black/30">
                            {lm.value}
                          </span>
                        </div>
                        {lm.note && (
                          <div className="text-[11px] text-slate-300 leading-snug">{lm.note}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-[10px] text-slate-400 italic">
                Note: AI organization assistant only — always verify exact medication dosages with your doctor or pharmacist.
              </p>

              <button
                onClick={() => void handleApplyPrescription()}
                disabled={isApplying}
                className="w-full py-2.5 rounded-2xl bg-gradient-to-r from-rose-500 to-pink-600 text-white font-extrabold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg"
              >
                <Bell className="w-4 h-4" />
                <span>
                  {isApplying
                    ? 'Scheduling Reminders...'
                    : extractedMedical.medications.length > 0
                    ? 'Auto-Schedule All Medication Reminders + Save to SQLite & Drive'
                    : 'Set Lab Follow-Up Reminder + Save Report to SQLite & Drive'}
                </span>
              </button>
            </div>
          )}

          {/* Selected History Report Full Viewer */}
          {selectedHistoryDoc && (
            <div className="rounded-3xl bg-slate-950/90 border border-cyan-400/45 p-4 space-y-3 shadow-2xl">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2.5">
                <button
                  onClick={() => setSelectedHistoryDoc(null)}
                  className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Back to History
                </button>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-200 border border-cyan-400/30">
                    {selectedHistoryDoc.docType === 'prescription_lab' ? '🩺 Health / Lab Report' : '🧾 Receipt / Warranty'}
                  </span>
                  {selectedHistoryDoc.syncedToDrive && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 inline-flex items-center gap-1">
                      <Cloud className="w-3 h-3" /> Drive Synced
                    </span>
                  )}
                  {selectedHistoryDoc.driveWebViewLink && (
                    <a
                      href={selectedHistoryDoc.driveWebViewLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 text-[11px] font-bold inline-flex items-center gap-1"
                    >
                      Open in Drive <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>

              {selectedHistoryDoc.docType === 'prescription_lab' ? (
                (() => {
                  const med = selectedHistoryDoc.payload as PrescriptionLabExtracted;
                  return (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <h4 className="text-base font-black text-white">{med.title}</h4>
                          <p className="text-xs text-slate-300">
                            {med.doctorOrLab} · Patient: <strong className="text-white">{med.patientName}</strong> ·{' '}
                            {med.visitDate || selectedHistoryDoc.createdAt.slice(0, 10)}
                          </p>
                          {med.diagnosisSummary && (
                            <p className="text-xs text-cyan-200 mt-1">{med.diagnosisSummary}</p>
                          )}
                        </div>
                        <button
                          onClick={() =>
                            speechEngine.speak(`${med.simpleEnglishSummary || ''} ${med.simpleTamilSummary || ''}`)
                          }
                          className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Volume2 className="w-3.5 h-3.5" /> Read EN + தமிழ்
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                        <div className="rounded-2xl bg-slate-900/90 p-3 border border-white/10">
                          <div className="text-[10px] font-bold uppercase text-cyan-300 mb-1">Plain English Summary</div>
                          <p className="text-slate-200 leading-relaxed">{med.simpleEnglishSummary}</p>
                        </div>
                        <div className="rounded-2xl bg-slate-900/90 p-3 border border-white/10">
                          <div className="text-[10px] font-bold uppercase text-amber-300 mb-1">எளிய தமிழ் விளக்கம்</div>
                          <p className="text-amber-100 leading-relaxed">{med.simpleTamilSummary}</p>
                        </div>
                      </div>

                      {(med.medications || []).length > 0 && (
                        <div className="space-y-1.5">
                          <div className="text-[11px] font-extrabold uppercase text-rose-200 flex items-center gap-1">
                            <Pill className="w-3.5 h-3.5" /> Saved Medication Schedule ({med.medications.length})
                          </div>
                          {med.medications.map((m, idx) => (
                            <div
                              key={idx}
                              className="rounded-xl bg-slate-900 border border-white/10 p-2.5 text-xs flex flex-wrap items-center justify-between gap-2"
                            >
                              <div>
                                <strong className="text-white">{m.name}</strong>{' '}
                                <span className="text-cyan-300">({m.dosage})</span>
                                <div className="text-[11px] text-slate-400">
                                  {m.frequency} · {m.mealRule} · {m.durationDays} days
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {(m.timings || []).map((t) => (
                                  <span key={t} className="px-2 py-0.5 rounded-lg bg-rose-500/20 text-rose-200 text-[10px] font-bold">
                                    ⏰ {t}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {(med.labMarkers || []).length > 0 && (
                        <div className="space-y-2">
                          <div className="text-[11px] font-extrabold uppercase text-emerald-300">
                            🧪 Saved Lab Tests & Markers ({med.labMarkers.length})
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {med.labMarkers.map((lm, idx) => (
                              <div
                                key={idx}
                                className={`p-2.5 rounded-2xl border text-xs space-y-0.5 ${
                                  lm.status === 'normal'
                                    ? 'bg-emerald-500/12 border-emerald-400/35 text-emerald-100'
                                    : 'bg-amber-500/18 border-amber-400/45 text-amber-100'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <strong className="text-white">{lm.testName}</strong>
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-black/30">
                                    {lm.value}
                                  </span>
                                </div>
                                {lm.note && <div className="text-[11px] text-slate-300 leading-snug">{lm.note}</div>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()
              ) : (
                (() => {
                  const rec = selectedHistoryDoc.payload as ReceiptWarrantyExtracted;
                  return (
                    <div className="space-y-3 text-xs">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <h4 className="text-base font-black text-white">{rec.title}</h4>
                          <p className="text-slate-300">
                            {rec.vendor} · {rec.category} · {rec.purchaseDate}
                          </p>
                        </div>
                        <div className="text-lg font-black text-emerald-300">
                          {rec.currency || '₹'}
                          {rec.totalAmount}
                        </div>
                      </div>
                      <p className="text-slate-200 leading-relaxed bg-slate-900/90 p-3 rounded-2xl border border-white/10">
                        {rec.summary}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {rec.warrantyExpiryDate && (
                          <span className="px-2.5 py-1 rounded-xl bg-amber-500/20 text-amber-200 font-bold">
                            🛡️ Warranty Expires: {rec.warrantyExpiryDate} ({rec.warrantyMonths}m)
                          </span>
                        )}
                        {rec.billDueDate && (
                          <span className="px-2.5 py-1 rounded-xl bg-rose-500/20 text-rose-200 font-bold">
                            ⏰ Bill Due: {rec.billDueDate}
                          </span>
                        )}
                      </div>
                      {(rec.lineItems || []).length > 0 && (
                        <div className="space-y-1">
                          <div className="text-[11px] font-extrabold uppercase text-emerald-300">Line Items</div>
                          {rec.lineItems.map((li, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-slate-900 border border-white/10"
                            >
                              <span className="text-slate-200">{li.name}</span>
                              <strong className="text-white">
                                {rec.currency || '₹'}
                                {li.price}
                              </strong>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()
              )}
            </div>
          )}

          {/* Saved Vault History List */}
          <div className="space-y-2.5 pt-3 border-t border-white/10">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-cyan-300" />
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-200">
                  Saved History Vault ({filteredVault.length})
                </h4>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  onClick={() => setHistoryScope('all')}
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-bold cursor-pointer ${
                    historyScope === 'all'
                      ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-400/40'
                      : 'bg-slate-950 text-slate-400 border border-white/10'
                  }`}
                >
                  All ({savedDocs.length})
                </button>
                <button
                  onClick={() => setHistoryScope('tab')}
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-bold cursor-pointer ${
                    historyScope === 'tab'
                      ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-400/40'
                      : 'bg-slate-950 text-slate-400 border border-white/10'
                  }`}
                >
                  {docType === 'receipt_warranty' ? 'Receipts Only' : 'Health Only'}
                </button>
                <button
                  onClick={() => void handleSyncAllDrive()}
                  disabled={isSyncingDrive}
                  className="px-2.5 py-1 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-200 text-[11px] font-extrabold inline-flex items-center gap-1 cursor-pointer disabled:opacity-60"
                >
                  <RefreshCw className={`w-3 h-3 ${isSyncingDrive ? 'animate-spin' : ''}`} />
                  {isSyncingDrive ? 'Syncing Drive...' : 'Sync with Drive'}
                </button>
              </div>
            </div>

            {savedDocs.length > 0 && (
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder="Search saved reports by patient, doctor, test name, or vendor..."
                  className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-950/80 border border-white/10 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400/50"
                />
              </div>
            )}

            {filteredVault.length === 0 ? (
              <p className="text-xs text-slate-500 py-3">
                No saved records found. Snap a photo or upload a report above to archive it to SQLite & Google Drive, or click &quot;Sync with Drive&quot; to pull saved history from another device!
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {filteredVault.map((doc) => (
                  <div
                    key={doc.id}
                    onClick={() => setSelectedHistoryDoc(doc)}
                    className={`rounded-2xl bg-slate-950/85 hover:bg-slate-900/95 border p-3 flex items-start justify-between gap-2 text-xs cursor-pointer transition-all ${
                      selectedHistoryDoc?.id === doc.id
                        ? 'border-cyan-400/60 ring-1 ring-cyan-400/30'
                        : 'border-white/10 hover:border-white/25'
                    }`}
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px]">
                          {doc.docType === 'prescription_lab' ? '🩺' : '🧾'}
                        </span>
                        <div className="font-extrabold text-white truncate">{doc.title}</div>
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">
                        {doc.vendorOrDoctor}
                        {typeof doc.amount === 'number' ? ` · ${doc.currency || '₹'}${doc.amount}` : ''}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                        <span className="text-[10px] text-slate-500">
                          {(doc.updatedAt || doc.createdAt || '').slice(0, 10)}
                        </span>
                        {doc.syncedToDrive ? (
                          <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 text-[9px] font-bold inline-flex items-center gap-0.5">
                            <Cloud className="w-2.5 h-2.5" /> Drive
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-300 text-[9px] font-bold">
                            Local/SQLite
                          </span>
                        )}
                        <span className="text-[10px] text-cyan-300 font-bold inline-flex items-center gap-0.5">
                          <Eye className="w-2.5 h-2.5" /> View Report
                        </span>
                      </div>
                      {doc.expiryOrDueDate && (
                        <div className="text-[10px] text-amber-300 font-bold">
                          Due / Expiry: {doc.expiryOrDueDate}
                        </div>
                      )}
                      {doc.driveWebViewLink && (
                        <a
                          href={doc.driveWebViewLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-[10px] text-emerald-300 inline-flex items-center gap-1 underline"
                        >
                          Open Drive File <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </div>
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        await deleteSmartDocumentEverywhere(doc.id, googleAccessToken);
                        setSavedDocs((prev) => prev.filter((d) => d.id !== doc.id));
                        if (selectedHistoryDoc?.id === doc.id) setSelectedHistoryDoc(null);
                      }}
                      title="Delete saved report"
                      className="p-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
