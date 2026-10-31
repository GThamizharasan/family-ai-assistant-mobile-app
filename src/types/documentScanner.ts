// Types for Adobe Document Scanner
// Sovereign Family Circle Document Scanning & PDF Engine

export type ScanCategory =
  | 'Receipt'
  | 'Invoice'
  | 'Contract'
  | 'ID & Passport'
  | 'Medical'
  | 'Personal'
  | 'Academic'
  | 'Certificate';

export type ScanImageFilter = 'magic' | 'grayscale' | 'bw' | 'original';

export interface ScannedPage {
  id: string;
  pageNumber: number;
  dataUrl: string; // Base64 image/jpeg data URL
  width: number;
  height: number;
  rotation: number; // 0, 90, 180, 270
  filter: ScanImageFilter;
}

export interface ScannedDocument {
  id: string;
  userEmail: string;
  title: string;
  category: ScanCategory;
  pages: ScannedPage[];
  pageCount: number;
  fileSizeBytes: number;
  thumbnailDataUrl?: string; // Small thumbnail of page 1
  pdfBlobUrl?: string; // In-memory blob URL for viewing
  pdfContentBase64?: string; // Cached or transient base64 of generated PDF
  driveFileId?: string;
  driveWebViewLink?: string;
  driveFolderPath?: string; // e.g. "Family Circle / Adobe Scans"
  driveSyncStatus: 'synced' | 'local_only' | 'uploading' | 'failed';
  isFavorite: boolean;
  notes?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export const SCAN_CATEGORIES: { id: ScanCategory; label: string; iconName: string; color: string }[] = [
  { id: 'Receipt', label: 'Receipts & Bills', iconName: 'Receipt', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
  { id: 'Invoice', label: 'Invoices', iconName: 'FileSpreadsheet', color: 'text-blue-400 bg-blue-500/10 border-blue-500/30' },
  { id: 'Contract', label: 'Contracts & Legal', iconName: 'FileCheck', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
  { id: 'ID & Passport', label: 'IDs & Passports', iconName: 'ShieldCheck', color: 'text-rose-400 bg-rose-500/10 border-rose-500/30' },
  { id: 'Medical', label: 'Medical & Prescriptions', iconName: 'HeartPulse', color: 'text-pink-400 bg-pink-500/10 border-pink-500/30' },
  { id: 'Personal', label: 'Personal Notes', iconName: 'FileText', color: 'text-purple-400 bg-purple-500/10 border-purple-500/30' },
  { id: 'Academic', label: 'Academic & Study', iconName: 'GraduationCap', color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30' },
  { id: 'Certificate', label: 'Certificates & Deeds', iconName: 'Award', color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30' },
];
