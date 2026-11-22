// Centralized Family Media Library Types (1 TB Google Drive + Lightweight SQLite Index + On-Demand Local SQLite Cache)

export type MediaAssetType = 'image' | 'video' | 'audio' | 'pdf' | 'document' | 'ai_generated';

export interface MediaShareConfig {
  isPublic: boolean;
  permissionRole: 'view' | 'comment' | 'edit';
  allowDownload: boolean;
  shareLink?: string;
  expiresAt?: string | null;
  sharedWithEmails: string[];
}

export interface MediaAiMetadata {
  caption?: string;
  ocrText?: string;
  transcript?: string;
  objects?: string[];
  faces?: string[];
  detectedLanguage?: string;
  moderationStatus?: 'approved' | 'pending' | 'flagged';
  moderationNotes?: string;
  analyzedAt?: string;
}

export interface MediaLibraryItem {
  id: string;
  userEmail: string;
  fileName: string;
  driveFileId?: string;
  driveFolderId?: string;
  driveWebViewLink?: string;
  driveDownloadUrl?: string;
  folderPath: string; // e.g. "/" or "/Vacations/2026"
  mediaType: MediaAssetType;
  mimeType: string;
  fileSize: number; // bytes
  sha256Hash?: string;
  thumbnailDataUrl?: string;
  tags: string[];
  category: string;
  collectionIds: string[];
  ownerName: string;
  deviceSource: string;
  location?: string;
  customMetadata: Record<string, string>;
  aiMetadata: MediaAiMetadata;
  shareConfig: MediaShareConfig;
  isFavorite: boolean;
  isArchived: boolean;
  isDeleted: boolean;
  deletedAt?: string | null;
  isStoredLocally: boolean;
  localCachedAt?: string | null;
  lastViewedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MediaFolderItem {
  id: string;
  userEmail: string;
  path: string; // "/Family Photos/2026"
  name: string;
  parentPath: string; // "/Family Photos" or "/"
  driveFolderId?: string;
  createdAt: string;
}

export interface MediaCollectionItem {
  id: string;
  userEmail: string;
  name: string;
  description?: string;
  kind: 'album' | 'collection' | 'playlist';
  coverThumbnail?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MediaAuditLogItem {
  id: string;
  userEmail: string;
  action:
    | 'upload'
    | 'sync_drive'
    | 'store_local'
    | 'remove_local'
    | 'share'
    | 'update_metadata'
    | 'ai_analyze'
    | 'soft_delete'
    | 'restore'
    | 'permanent_delete'
    | 'moderation';
  mediaId?: string;
  fileName?: string;
  details: string;
  createdAt: string;
}

export interface MediaAnalyticsSummary {
  totalItems: number;
  activeItems: number;
  trashItems: number;
  archivedItems: number;
  favoriteItems: number;
  totalDriveBytes: number;
  driveQuotaBytes: number; // 1 TB default
  localStoredCount: number;
  localStoredBytes: number;
  duplicateGroupsCount: number;
  flaggedCount: number;
  byType: Record<MediaAssetType, { count: number; bytes: number }>;
  recentAuditLogs: MediaAuditLogItem[];
}

export interface MediaUploadTask {
  id: string;
  file: File;
  fileName: string;
  fileSize: number;
  mimeType: string;
  mediaType: MediaAssetType;
  folderPath: string;
  storeLocally: boolean;
  progress: number; // 0-100
  status: 'queued' | 'hashing' | 'uploading' | 'paused' | 'completed' | 'failed' | 'duplicate';
  errorMessage?: string;
  resumableSessionUri?: string;
  uploadedBytes: number;
  sha256Hash?: string;
  thumbnailDataUrl?: string;
  duplicateOfId?: string;
  createdItem?: MediaLibraryItem;
}

export interface MediaNotificationItem {
  id: string;
  kind: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
}
