import React, { useState, useEffect } from 'react';
import {
  FileText,
  X,
  ExternalLink,
  Download,
  Calendar,
  User,
  Sparkles,
  Building,
  CheckCircle2,
  HardDrive,
} from 'lucide-react';
import { HealthDocument } from '../../types/healthRecord';
import { getApiUrl } from '../../services/api';

interface HealthDocumentViewerModalProps {
  document: HealthDocument | null;
  isOpen: boolean;
  onClose: () => void;
}

export const HealthDocumentViewerModal: React.FC<HealthDocumentViewerModalProps> = ({
  document,
  isOpen,
  onClose,
}) => {
  const [contentBase64, setContentBase64] = useState<string | null>(null);
  const [loadingContent, setLoadingContent] = useState(false);

  useEffect(() => {
    if (!isOpen || !document) {
      setContentBase64(null);
      return;
    }

    if (document.fileContentBase64) {
      setContentBase64(document.fileContentBase64);
      return;
    }

    // Try fetching content from SQLite backend
    setLoadingContent(true);
    fetch(getApiUrl(`/api/health/documents/${document.id}/content`))
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.fileContentBase64) {
          setContentBase64(data.fileContentBase64);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingContent(false));
  }, [isOpen, document]);

  if (!isOpen || !document) return null;

  const isPdf = document.mimeType.includes('pdf') || document.fileName.toLowerCase().endsWith('.pdf');
  const isImage = document.mimeType.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(document.fileName);

  const formattedDataUrl = contentBase64
    ? contentBase64.startsWith('data:')
      ? contentBase64
      : `data:${document.mimeType};base64,${contentBase64}`
    : null;

  const handleDownload = () => {
    if (formattedDataUrl) {
      const a = window.document.createElement('a');
      a.href = formattedDataUrl;
      a.download = document.fileName;
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
    } else if (document.driveWebViewLink) {
      window.open(document.driveWebViewLink, '_blank');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-2xl max-h-[92vh] flex flex-col bg-slate-900 border border-slate-700 rounded-3xl overflow-hidden shadow-2xl">
        {/* Header Bar */}
        <div className="p-4 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white line-clamp-1">{document.title}</h2>
              <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                <span className="flex items-center gap-1">
                  <User className="w-3 h-3 text-slate-400" /> {document.memberName}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-slate-400" /> {document.documentDate}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {document.driveWebViewLink && (
              <a
                href={document.driveWebViewLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
                title="Open in Google Drive"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Drive</span>
              </a>
            )}

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Viewer Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Metadata Card */}
          <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div>
              <span className="text-[10px] text-slate-500 block">Category</span>
              <span className="font-bold text-white capitalize">{document.category.replace('_', ' ')}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block">Doctor / Clinic</span>
              <span className="font-bold text-white truncate block">{document.doctorOrFacility || 'General Clinic'}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block">Drive Location</span>
              <span className="font-mono text-[11px] text-slate-300 truncate block">{document.driveFolderPath}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block">Sync Status</span>
              <span className="inline-flex items-center gap-1 font-bold text-emerald-400 text-[11px]">
                <CheckCircle2 className="w-3 h-3" />
                {document.driveSyncStatus === 'synced' ? 'Google Drive Synced' : 'SQLite Vault'}
              </span>
            </div>
          </div>

          {/* AI Clinical Summary if present */}
          {document.aiSummary && (
            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-indigo-950/40 via-slate-950 to-purple-950/30 border border-indigo-500/30 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-300">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                <span>AI Clinical Report Summary</span>
              </div>
              <p className="text-xs text-slate-200 leading-relaxed">{document.aiSummary}</p>
            </div>
          )}

          {/* Document Preview Pane */}
          <div className="rounded-2xl bg-slate-950 border border-slate-800 p-2 min-h-[300px] flex items-center justify-center overflow-hidden">
            {loadingContent ? (
              <div className="py-12 text-center text-xs text-slate-400">
                <Sparkles className="w-6 h-6 text-indigo-400 animate-spin mx-auto mb-2" />
                <span>Retrieving encrypted document from sovereign store...</span>
              </div>
            ) : formattedDataUrl ? (
              isImage ? (
                <img
                  src={formattedDataUrl}
                  alt={document.title}
                  className="max-h-[500px] w-auto mx-auto rounded-xl object-contain"
                />
              ) : isPdf ? (
                <iframe
                  src={formattedDataUrl}
                  title={document.title}
                  className="w-full h-[520px] rounded-xl border border-slate-800 bg-white"
                />
              ) : (
                <div className="py-12 text-center text-xs text-slate-300">
                  <FileText className="w-12 h-12 text-slate-500 mx-auto mb-2" />
                  <p className="font-bold">{document.fileName}</p>
                  <p className="text-slate-500 text-[11px] mt-1">Binary file preview ready for export</p>
                </div>
              )
            ) : (
              <div className="py-12 text-center text-xs text-slate-400 space-y-3">
                <HardDrive className="w-10 h-10 text-indigo-400/80 mx-auto" />
                <p>Document metadata synchronized with Google Drive and local SQLite catalog.</p>
                {document.driveWebViewLink && (
                  <a
                    href={document.driveWebViewLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-all shadow-lg shadow-indigo-600/30"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>View in Google Drive</span>
                  </a>
                )}
              </div>
            )}
          </div>

          {/* User Notes */}
          {document.notes && (
            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs">
              <span className="text-[10px] text-slate-400 font-bold block mb-1 uppercase tracking-wider">Clinical Notes:</span>
              <p className="text-slate-200">{document.notes}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <span className="text-[11px] text-slate-500 font-mono">
            Size: {(document.fileSizeBytes / 1024).toFixed(1)} KB
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md shadow-indigo-600/25"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download / Save</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
