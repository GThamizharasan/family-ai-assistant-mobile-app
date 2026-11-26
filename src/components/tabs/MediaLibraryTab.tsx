import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Cloud,
  Upload,
  FolderPlus,
  Search,
  Mic,
  Sparkles,
  RefreshCw,
  HardDrive,
  Star,
  Clock,
  Archive,
  Trash2,
  RotateCcw,
  Folder,
  Layers,
  Image as ImageIcon,
  Video,
  Music,
  FileText,
  Grid,
  List,
  Bell,
  BarChart3,
  Pause,
  Play,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  X,
  Plus,
  ShieldAlert,
  SkipForward,
  Volume2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  MediaAnalyticsSummary,
  MediaAssetType,
  MediaCollectionItem,
  MediaFolderItem,
  MediaLibraryItem,
  MediaNotificationItem,
  MediaUploadTask,
} from '../../types/mediaLibrary';
import {
  analyzeMediaItemWithAi,
  checkMediaDuplicate,
  classifyMediaAssetType,
  computeFileSha256,
  createMediaCollection,
  createMediaFolder,
  deleteMediaFileEverywhere,
  detectDeviceSource,
  ensureDriveFolderPath,
  fetchMediaAnalytics,
  fetchMediaCollections,
  fetchMediaFolders,
  fetchMediaLibraryItems,
  formatBytes,
  generateClientThumbnail,
  patchMediaItemInSqlite,
  permanentlyDeleteMediaItem,
  pushSingleLocalMediaItemToDrive,
  removeMediaItemFromLocalSqlite,
  resolvePlayableMediaUrl,
  saveMediaMetadataToSqlite,
  storeMediaItemLocallyInSqlite,
  syncDriveMediaLibraryToSqlite,
  uploadFileResumableToDrive,
  validateMediaFile,
} from '../../services/mediaLibraryService';
import { getEffectiveGoogleToken } from '../../services/visualTopicStorageService';
import { MediaAssetViewerModal } from '../media/MediaAssetViewerModal';
import { getLockedFolderPaths, MediaPowerToolsModal } from '../media/MediaPowerToolsModal';

type NavScope = 'all' | 'favorites' | 'recent' | 'offline_local' | 'archive' | 'trash' | 'admin';

export const MediaLibraryTab: React.FC = () => {
  const { user, googleAccessToken } = useApp();
  const userEmail = user?.email || 'chinna.tamil2000@gmail.com';
  const ownerName = user?.name || 'Family Member';

  // Core data
  const [items, setItems] = useState<MediaLibraryItem[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [folders, setFolders] = useState<MediaFolderItem[]>([]);
  const [collections, setCollections] = useState<MediaCollectionItem[]>([]);
  const [analytics, setAnalytics] = useState<MediaAnalyticsSummary | null>(null);

  // Navigation & Filters
  const [navScope, setNavScope] = useState<NavScope>('all');
  const [activeFolder, setActiveFolder] = useState<string>('ALL');
  const [activeCollectionId, setActiveCollectionId] = useState<string>('');
  const [mediaTypeFilter, setMediaTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [semanticMode, setSemanticMode] = useState(false);
  const [isVoiceListening, setIsVoiceListening] = useState(false);
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'name' | 'size' | 'recent'>('newest');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [minSizeMb, setMinSizeMb] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Upload manager
  const [uploadDrawerOpen, setUploadDrawerOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadQueue, setUploadQueue] = useState<MediaUploadTask[]>([]);
  const [uploadFolder, setUploadFolder] = useState<string>('/');
  const [uploadStoreLocal, setUploadStoreLocal] = useState(false);
  const [autoAiOnUpload, setAutoAiOnUpload] = useState(true);
  const abortFlagsRef = useRef<Record<string, boolean>>({});
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);

  // Sync, Modals, Notifications & Audio Player
  const [isSyncingDrive, setIsSyncingDrive] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MediaLibraryItem | null>(null);
  const [notifications, setNotifications] = useState<MediaNotificationItem[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [newCollectionKind, setNewCollectionKind] = useState<'album' | 'collection' | 'playlist'>('album');
  const [creatingCollection, setCreatingCollection] = useState(false);

  // Admin Cleanup & Bulk Delete State
  const [adminFiles, setAdminFiles] = useState<MediaLibraryItem[]>([]);
  const [adminFilter, setAdminFilter] = useState<'all' | 'largest' | 'duplicates' | 'local' | 'trashed' | 'flagged'>('all');
  const [adminSearch, setAdminSearch] = useState('');
  const [adminSelectedIds, setAdminSelectedIds] = useState<string[]>([]);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);

  // Media Power Tools & PIN Private Folder Lock State
  const [powerToolsOpen, setPowerToolsOpen] = useState(false);
  const [powerToolsTab, setPowerToolsTab] = useState<'redact' | 'pdf_merge' | 'memories' | 'pin_lock'>('redact');
  const [isVaultUnlocked, setIsVaultUnlocked] = useState(false);
  const [lockedFolders, setLockedFolders] = useState<string[]>(() => getLockedFolderPaths());

  // Background Audio Player + Playlist
  const [audioPlaylist, setAudioPlaylist] = useState<MediaLibraryItem[]>([]);
  const [currentAudioIdx, setCurrentAudioIdx] = useState(0);
  const [bgAudioUrl, setBgAudioUrl] = useState<string>('');
  const bgAudioRevokeRef = useRef<(() => void) | undefined>(undefined);

  const pushNotification = useCallback(
    (kind: MediaNotificationItem['kind'], title: string, message: string) => {
      setNotifications((prev) => [
        {
          id: `mn-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
          kind,
          title,
          message,
          createdAt: new Date().toISOString(),
          read: false,
        },
        ...prev.slice(0, 29),
      ]);
    },
    []
  );

  const loadMetadata = useCallback(async () => {
    const [fList, cList, stats] = await Promise.all([
      fetchMediaFolders(userEmail),
      fetchMediaCollections(userEmail),
      fetchMediaAnalytics(userEmail).catch(() => null),
    ]);
    setFolders(fList);
    setCollections(cList);
    if (stats) {
      setAnalytics(stats);
      if (stats.totalDriveBytes / stats.driveQuotaBytes > 0.85) {
        pushNotification(
          'warning',
          '1 TB Storage Alert',
          `Google Drive Media Vault is using ${Math.round((stats.totalDriveBytes / stats.driveQuotaBytes) * 100)}% of 1 TB quota.`
        );
      }
    }
  }, [userEmail, pushNotification]);

  const loadItems = useCallback(
    async (targetPage = 1, append = false) => {
      if (navScope === 'admin') return;
      setLoading(true);
      try {
        const res = await fetchMediaLibraryItems({
          userEmail,
          q: searchQuery.trim() || undefined,
          mediaType: mediaTypeFilter !== 'all' ? mediaTypeFilter : undefined,
          folderPath: activeFolder !== 'ALL' ? activeFolder : undefined,
          collectionId: activeCollectionId || undefined,
          favorite: navScope === 'favorites' ? true : undefined,
          archived: navScope === 'archive' ? true : navScope === 'all' ? false : undefined,
          trash: navScope === 'trash' ? true : undefined,
          storedLocally: navScope === 'offline_local' ? true : undefined,
          recentlyViewed: navScope === 'recent' ? true : undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          minSize: minSizeMb ? Math.round(Number(minSizeMb) * 1024 * 1024) : undefined,
          sortBy,
          page: targetPage,
          limit: 36,
        });
        setItems((prev) => (append ? [...prev, ...res.items.filter((n) => !prev.some((p) => p.id === n.id))] : res.items));
        setTotalItems(res.total);
        setPage(res.page);
        setHasMore(res.hasMore);
      } finally {
        setLoading(false);
      }
    },
    [
      userEmail,
      searchQuery,
      mediaTypeFilter,
      activeFolder,
      activeCollectionId,
      navScope,
      dateFrom,
      dateTo,
      minSizeMb,
      sortBy,
    ]
  );

  const loadAdminFiles = useCallback(async () => {
    const [activeRes, trashRes] = await Promise.all([
      fetchMediaLibraryItems({ userEmail, limit: 100, page: 1, sortBy: 'size' }),
      fetchMediaLibraryItems({ userEmail, trash: true, limit: 100, page: 1, sortBy: 'newest' }),
    ]);
    const combined = [...activeRes.items, ...trashRes.items.filter((t) => !activeRes.items.some((a) => a.id === t.id))];
    setAdminFiles(combined);
  }, [userEmail]);

  useEffect(() => {
    void loadMetadata();
  }, [loadMetadata]);

  useEffect(() => {
    if (navScope === 'admin') {
      void loadAdminFiles();
    } else {
      void loadItems(1, false);
    }
  }, [loadItems, loadAdminFiles, navScope]);

  const handlePermanentDeleteSingle = async (target: MediaLibraryItem) => {
    if (
      !window.confirm(
        `Permanently delete "${target.fileName}" from BOTH Local SQLite and Google Drive? This cannot be undone.`
      )
    ) {
      return;
    }
    const res = await deleteMediaFileEverywhere(target, googleAccessToken);
    setItems((prev) => prev.filter((x) => x.id !== target.id));
    setAdminFiles((prev) => prev.filter((x) => x.id !== target.id));
    setAdminSelectedIds((prev) => prev.filter((id) => id !== target.id));
    setTotalItems((n) => Math.max(0, n - 1));
    if (selectedItem?.id === target.id) setSelectedItem(null);
    pushNotification(
      res.driveMessage ? 'warning' : 'success',
      'File Permanently Deleted',
      res.deletedFromDrive
        ? `"${target.fileName}" removed from Local SQLite AND Google Drive.`
        : res.driveMessage || `"${target.fileName}" removed from Local SQLite.`
    );
    void loadMetadata();
  };

  const handleBulkDeleteAdminSelected = async () => {
    const targets = adminFiles.filter((f) => adminSelectedIds.includes(f.id));
    if (targets.length === 0 || isDeletingBulk) return;
    if (
      !window.confirm(
        `Permanently delete ${targets.length} selected file(s) from BOTH Local SQLite and Google Drive? This cannot be undone.`
      )
    ) {
      return;
    }
    setIsDeletingBulk(true);
    let driveCount = 0;
    let localCount = 0;
    try {
      for (const t of targets) {
        const res = await deleteMediaFileEverywhere(t, googleAccessToken);
        if (res.deletedLocally) localCount++;
        if (res.deletedFromDrive) driveCount++;
      }
      const deletedSet = new Set(targets.map((t) => t.id));
      setItems((prev) => prev.filter((x) => !deletedSet.has(x.id)));
      setAdminFiles((prev) => prev.filter((x) => !deletedSet.has(x.id)));
      setAdminSelectedIds([]);
      pushNotification(
        'success',
        'Bulk Permanent Delete Complete',
        `Deleted ${localCount} file(s) locally and ${driveCount} file(s) from Google Drive.`
      );
      void loadMetadata();
    } finally {
      setIsDeletingBulk(false);
    }
  };

  const filteredAdminFiles = useMemo(() => {
    const hashFreq = new Map<string, number>();
    for (const f of adminFiles) {
      if (f.sha256Hash && !f.isDeleted) {
        hashFreq.set(f.sha256Hash, (hashFreq.get(f.sha256Hash) || 0) + 1);
      }
    }
    let list = adminFiles.filter((f) => {
      if (adminFilter === 'duplicates') return Boolean(f.sha256Hash && (hashFreq.get(f.sha256Hash) || 0) > 1);
      if (adminFilter === 'local') return f.isStoredLocally;
      if (adminFilter === 'trashed') return f.isDeleted;
      if (adminFilter === 'flagged') return f.aiMetadata?.moderationStatus === 'flagged';
      return true;
    });
    const q = adminSearch.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (f) =>
          f.fileName.toLowerCase().includes(q) ||
          f.folderPath.toLowerCase().includes(q) ||
          f.mediaType.toLowerCase().includes(q)
      );
    }
    if (adminFilter === 'largest') {
      list = [...list].sort((a, b) => b.fileSize - a.fileSize);
    }
    return list;
  }, [adminFiles, adminFilter, adminSearch]);

  // Listen for deep-links from Global Universal Search (Ctrl+K) & Auro Voice Assistant
  useEffect(() => {
    const handler = (ev: Event) => {
      const detail = (ev as CustomEvent)?.detail || {};
      if (detail.query) {
        setSearchQuery(String(detail.query));
        setNavScope('all');
      }
      if (detail.mediaId) {
        const found = items.find((i) => i.id === detail.mediaId);
        if (found) setSelectedItem(found);
      }
    };
    window.addEventListener('aura-open-media-library', handler as EventListener);
    return () => window.removeEventListener('aura-open-media-library', handler as EventListener);
  }, [items]);

  // Infinite scroll sentinel
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!hasMore || loading || navScope === 'admin') return;
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void loadItems(page + 1, true);
        }
      },
      { rootMargin: '200px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, loading, page, loadItems, navScope]);

  // Background Audio Loader
  const currentAudioItem = audioPlaylist[currentAudioIdx] || null;
  useEffect(() => {
    if (!currentAudioItem) return;
    let cancelled = false;
    bgAudioRevokeRef.current?.();
    resolvePlayableMediaUrl(currentAudioItem, googleAccessToken).then((res) => {
      if (cancelled) {
        res.revoke?.();
        return;
      }
      setBgAudioUrl(res.url);
      bgAudioRevokeRef.current = res.revoke;
    });
    return () => {
      cancelled = true;
    };
  }, [currentAudioItem?.id, googleAccessToken]);

  const handlePlayAudioInBackground = (item: MediaLibraryItem) => {
    const existingIdx = audioPlaylist.findIndex((a) => a.id === item.id);
    if (existingIdx >= 0) {
      setCurrentAudioIdx(existingIdx);
    } else {
      const next = [...audioPlaylist, item];
      setAudioPlaylist(next);
      setCurrentAudioIdx(next.length - 1);
    }
  };

  // Voice Search
  const handleVoiceSearch = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      pushNotification('warning', 'Voice Search Unavailable', 'Speech recognition is not supported in this browser.');
      return;
    }
    const rec = new SR();
    rec.lang = 'en-US';
    rec.interimResults = false;
    setIsVoiceListening(true);
    rec.onresult = (e: any) => {
      const transcript = e.results?.[0]?.[0]?.transcript || '';
      if (transcript) setSearchQuery(transcript);
    };
    rec.onerror = () => setIsVoiceListening(false);
    rec.onend = () => setIsVoiceListening(false);
    rec.start();
  };

  // Sync metadata from Google Drive -> Local SQLite AND push any local-only SQLite files UP to Drive
  const handleSyncFromDrive = async () => {
    if (isSyncingDrive) return;
    setIsSyncingDrive(true);
    try {
      const res = await syncDriveMediaLibraryToSqlite(googleAccessToken, userEmail, ownerName);
      if (res.needsSignIn) {
        pushNotification(
          'warning',
          'Google Drive Sign-In Needed',
          'Sign in with Google in the top header to upload local files & sync your 1 TB Family Circle Media Vault.'
        );
      } else {
        pushNotification(
          'success',
          '2-Way Google Drive Sync Complete',
          `${
            res.pushedToDriveCount > 0 ? `Pushed ${res.pushedToDriveCount} local file(s) UP to Google Drive + ` : ''
          }Synced ${res.syncedCount} media file(s) & ${res.folderCount} folder(s) metadata into SQLite.`
        );
        await Promise.all([loadItems(1, false), loadMetadata()]);
      }
    } catch (err: any) {
      pushNotification('error', 'Drive Sync Failed', err?.message || 'Could not sync with Google Drive.');
    } finally {
      setIsSyncingDrive(false);
    }
  };

  // Upload Task Runner (Resumable Chunked Drive Upload + Duplicate Check + Optional Local SQLite)
  const runUploadTask = async (task: MediaUploadTask, forceDuplicate = false) => {
    const token = getEffectiveGoogleToken(googleAccessToken);
    abortFlagsRef.current[task.id] = false;

    const updateTask = (patch: Partial<MediaUploadTask>) => {
      setUploadQueue((prev) => prev.map((t) => (t.id === task.id ? { ...t, ...patch } : t)));
    };

    try {
      updateTask({ status: 'hashing', errorMessage: undefined });
      const hash = task.sha256Hash || (await computeFileSha256(task.file));
      const thumb = task.thumbnailDataUrl || (await generateClientThumbnail(task.file, task.mediaType));
      updateTask({ sha256Hash: hash, thumbnailDataUrl: thumb });

      if (!forceDuplicate) {
        const dup = await checkMediaDuplicate(hash, userEmail);
        if (dup) {
          updateTask({
            status: 'duplicate',
            duplicateOfId: dup.id,
            errorMessage: `Duplicate detected: matches "${dup.fileName}" in ${dup.folderPath}`,
          });
          pushNotification('warning', 'Duplicate File Detected', `"${task.fileName}" already exists in ${dup.folderPath}.`);
          return;
        }
      }

      updateTask({ status: 'uploading' });
      let driveMeta: { driveFileId?: string; driveFolderId?: string; driveWebViewLink?: string; driveDownloadUrl?: string } = {};

      if (token) {
        driveMeta = await uploadFileResumableToDrive({
          file: task.file,
          folderPath: task.folderPath,
          token,
          userEmail,
          existingSessionUri: task.resumableSessionUri,
          startByte: task.uploadedBytes || 0,
          shouldAbort: () => Boolean(abortFlagsRef.current[task.id]),
          onProgress: (percent, uploadedBytes, sessionUri) => {
            updateTask({ progress: percent, uploadedBytes, resumableSessionUri: sessionUri });
          },
        });
      } else {
        updateTask({ progress: 60 });
      }

      // Save lightweight metadata into SQLite
      const savedItem = await saveMediaMetadataToSqlite({
        userEmail,
        fileName: task.fileName,
        driveFileId: driveMeta.driveFileId,
        driveFolderId: driveMeta.driveFolderId,
        driveWebViewLink: driveMeta.driveWebViewLink,
        driveDownloadUrl: driveMeta.driveDownloadUrl,
        folderPath: task.folderPath,
        mediaType: task.mediaType,
        mimeType: task.mimeType,
        fileSize: task.fileSize,
        sha256Hash: hash,
        thumbnailDataUrl: thumb,
        ownerName,
        deviceSource: detectDeviceSource(),
      });

      let finalItem = savedItem;
      // If user requested local SQLite persistence OR not signed into Google Drive (for <= 35MB)
      if (task.storeLocally || (!token && task.fileSize <= 35 * 1024 * 1024)) {
        try {
          finalItem = await storeMediaItemLocallyInSqlite(savedItem, {
            file: task.file,
            googleAccessToken,
            userEmail,
          });
        } catch {}
      }

      // Optional AI Auto-Tagging & Captioning in background
      if (autoAiOnUpload) {
        analyzeMediaItemWithAi(finalItem, {
          imageBase64: thumb,
        })
          .then((aiRes) => {
            if (aiRes.item) {
              setItems((prev) => prev.map((x) => (x.id === aiRes.item!.id ? aiRes.item! : x)));
            }
          })
          .catch(() => {});
      }

      updateTask({ status: 'completed', progress: 100, createdItem: finalItem });
      setItems((prev) => [finalItem, ...prev.filter((x) => x.id !== finalItem.id)]);
      setTotalItems((n) => n + 1);
      if (driveMeta.driveFileId) {
        pushNotification(
          'success',
          'Uploaded to Google Drive',
          `"${task.fileName}" stored in Google Drive (Family Circle / Media Library Vault${task.folderPath === '/' ? '' : task.folderPath}) & indexed in SQLite.`
        );
      } else {
        pushNotification(
          'warning',
          'Stored Locally Only (Drive Not Connected)',
          `"${task.fileName}" saved in local SQLite. Connect Google Drive in the header and click "Sync with Drive" to push it to your 1 TB Drive vault.`
        );
      }
      void loadMetadata();
    } catch (err: any) {
      if (err?.message === 'PAUSED') {
        updateTask({
          status: 'paused',
          resumableSessionUri: err.sessionUri || task.resumableSessionUri,
          uploadedBytes: err.uploadedBytes ?? task.uploadedBytes,
        });
      } else {
        updateTask({
          status: 'failed',
          errorMessage: err?.message || 'Upload failed',
          resumableSessionUri: err?.sessionUri || task.resumableSessionUri,
          uploadedBytes: err?.uploadedBytes ?? task.uploadedBytes,
        });
        pushNotification('error', 'Upload Failed', `"${task.fileName}": ${err?.message || 'Retry available'}`);
      }
    }
  };

  // Recursively traverse dropped folders via FileSystemEntry API (preserves nested subfolder paths)
  const extractDroppedEntries = async (
    dataTransfer: DataTransfer
  ): Promise<Array<{ file: File; relativeFolder: string }>> => {
    const out: Array<{ file: File; relativeFolder: string }> = [];
    const itemsList = Array.from(dataTransfer.items || []);
    const hasEntryApi = itemsList.some((it: any) => typeof it.webkitGetAsEntry === 'function');

    if (hasEntryApi && itemsList.length > 0) {
      const readAllDirectoryEntries = (dirReader: any): Promise<any[]> =>
        new Promise((resolve) => {
          const collected: any[] = [];
          const readBatch = () => {
            dirReader.readEntries(
              (batch: any[]) => {
                if (!batch || batch.length === 0) {
                  resolve(collected);
                } else {
                  collected.push(...batch);
                  readBatch();
                }
              },
              () => resolve(collected)
            );
          };
          readBatch();
        });

      const walkEntry = async (entry: any, currentSubPath: string): Promise<void> => {
        if (!entry) return;
        if (entry.isFile) {
          const file: File | null = await new Promise((resolve) => entry.file(resolve, () => resolve(null)));
          if (file) {
            out.push({ file, relativeFolder: currentSubPath });
          }
        } else if (entry.isDirectory) {
          const nextSub = currentSubPath ? `${currentSubPath}/${entry.name}` : entry.name;
          const children = await readAllDirectoryEntries(entry.createReader());
          for (const child of children) {
            await walkEntry(child, nextSub);
          }
        }
      };

      for (const it of itemsList) {
        const entry = (it as any).webkitGetAsEntry?.();
        if (entry) await walkEntry(entry, '');
      }
      if (out.length > 0) return out;
    }

    // Fallback to standard FileList (handles webkitRelativePath too)
    for (const f of Array.from(dataTransfer.files || [])) {
      const rel = ((f as any).webkitRelativePath || '') as string;
      const parts = rel.split('/').filter(Boolean);
      const relativeFolder = parts.length > 1 ? parts.slice(0, -1).join('/') : '';
      out.push({ file: f, relativeFolder });
    }
    return out;
  };

  const enqueueFileEntries = async (entries: Array<{ file: File; relativeFolder?: string }>) => {
    if (!entries || entries.length === 0) return;
    setUploadDrawerOpen(true);

    const baseFolder = uploadFolder && uploadFolder !== '/' ? `/${uploadFolder.replace(/^\/+|\/+$/g, '')}` : '';
    const newTasks: MediaUploadTask[] = [];
    const uniqueFolderPaths = new Set<string>();

    for (const entry of entries) {
      const f = entry.file;
      // Skip OS junk files automatically when uploading folders
      if (/^(\.ds_store|thumbs\.db|desktop\.ini|\._.*)$/i.test(f.name)) continue;

      const check = validateMediaFile(f);
      if (!check.valid) {
        pushNotification('error', 'File Rejected', `${f.name}: ${check.reason}`);
        continue;
      }

      let subFolder = (entry.relativeFolder || '').trim().replace(/^\/+|\/+$/g, '');
      if (!subFolder) {
        const rel = ((f as any).webkitRelativePath || '') as string;
        const parts = rel.split('/').filter(Boolean);
        if (parts.length > 1) subFolder = parts.slice(0, -1).join('/');
      }

      const targetFolderPath = subFolder
        ? `${baseFolder}/${subFolder}`.replace(/\/+/g, '/')
        : baseFolder || '/';

      uniqueFolderPaths.add(targetFolderPath);

      newTasks.push({
        id: `up-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        file: f,
        fileName: f.name,
        fileSize: f.size,
        mimeType: f.type || 'application/octet-stream',
        mediaType: classifyMediaAssetType(f.type, f.name),
        folderPath: targetFolderPath,
        storeLocally: uploadStoreLocal,
        progress: 0,
        status: 'queued',
        uploadedBytes: 0,
      });
    }

    if (newTasks.length === 0) return;

    setUploadQueue((prev) => [...newTasks, ...prev]);

    // Pre-create unique nested folders sequentially first so concurrent uploads never duplicate Drive folders!
    const token = getEffectiveGoogleToken(googleAccessToken);
    const sortedPaths = Array.from(uniqueFolderPaths).sort((a, b) => a.length - b.length);
    for (const fp of sortedPaths) {
      if (fp === '/') continue;
      if (token) {
        try {
          await ensureDriveFolderPath(fp, token, userEmail);
        } catch {}
      } else {
        const segs = fp.split('/').filter(Boolean);
        let run = '';
        for (const s of segs) {
          const parent = run || '/';
          run = `${run}/${s}`;
          await createMediaFolder({ userEmail, parentPath: parent, name: s, googleAccessToken: null }).catch(() => {});
        }
      }
    }
    void loadMetadata();

    // Process uploads with a clean 3-worker concurrency pool (safe for large folders with hundreds of files)
    let cursor = 0;
    const concurrency = Math.min(3, newTasks.length);
    const worker = async () => {
      while (cursor < newTasks.length) {
        const currentTask = newTasks[cursor++];
        if (currentTask) {
          await runUploadTask(currentTask);
        }
      }
    };
    void Promise.all(Array.from({ length: concurrency }, () => worker()));
  };

  const enqueueFiles = (fileList: FileList | File[]) => {
    const arr = Array.from(fileList || []).map((file) => ({ file }));
    void enqueueFileEntries(arr);
  };

  // Filter out PIN-locked folders unless unlocked + AI Semantic re-ranking when semanticMode is enabled
  const displayedItems = useMemo(() => {
    const visible = isVaultUnlocked
      ? items
      : items.filter(
          (it) => !lockedFolders.some((lp) => it.folderPath === lp || it.folderPath.startsWith(`${lp}/`))
        );
    if (!semanticMode || !searchQuery.trim()) return visible;
    const terms = searchQuery
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 1);
    return [...visible].sort((a, b) => {
      const score = (it: MediaLibraryItem) => {
        const hay = `${it.fileName} ${it.category} ${(it.tags || []).join(' ')} ${it.aiMetadata?.caption || ''} ${
          it.aiMetadata?.ocrText || ''
        } ${(it.aiMetadata?.objects || []).join(' ')}`.toLowerCase();
        return terms.reduce((acc, t) => acc + (hay.includes(t) ? 1 : 0), 0);
      };
      return score(b) - score(a);
    });
  }, [items, semanticMode, searchQuery, isVaultUnlocked, lockedFolders]);

  const unreadNotifs = notifications.filter((n) => !n.read).length;
  const quotaPct = analytics ? Math.min(100, (analytics.totalDriveBytes / analytics.driveQuotaBytes) * 100) : 0;
  const isDriveConnected = Boolean(getEffectiveGoogleToken(googleAccessToken));
  const localOnlyUnsyncedCount = items.filter((it) => !it.driveFileId && !it.isDeleted).length;

  return (
    <div
      className="min-h-full pb-28 text-white space-y-4"
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={async (e) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer) {
          const dropped = await extractDroppedEntries(e.dataTransfer);
          if (dropped.length > 0) void enqueueFileEntries(dropped);
        }
      }}
    >
      {/* Drag-and-Drop Overlay */}
      {isDragging && (
        <div className="fixed inset-0 z-[90] bg-cyan-950/85 backdrop-blur-md border-4 border-dashed border-cyan-400 flex flex-col items-center justify-center gap-3 pointer-events-none">
          <Upload className="w-16 h-16 text-cyan-300 animate-bounce" />
          <div className="text-2xl font-black text-white">Drop Files or Entire Folders Here</div>
          <p className="text-sm text-cyan-200">Preserves nested subfolder structure in Google Drive + lightweight SQLite index</p>
        </div>
      )}

      {/* Hero Header */}
      <div className="rounded-3xl bg-gradient-to-r from-cyan-950/90 via-slate-900 to-purple-950/90 border border-white/15 p-4 sm:p-5 shadow-2xl space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-cyan-500/20 text-cyan-200 border border-cyan-400/35">
                ☁️ 1 TB Google Drive · Family Circle / Media Library Vault
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                  isDriveConnected
                    ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40'
                    : 'bg-amber-500/20 text-amber-200 border-amber-400/40'
                }`}
              >
                {isDriveConnected ? '✅ Google Drive Connected' : '⚠️ Drive Not Connected (Local Only)'}
              </span>
              {localOnlyUnsyncedCount > 0 && (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-rose-500/20 text-rose-200 border border-rose-400/40">
                  {localOnlyUnsyncedCount} Pending Drive Upload
                </span>
              )}
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white mt-1.5">
              Centralized Family Media Library
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => void handleSyncFromDrive()}
              disabled={isSyncingDrive}
              className="px-3 py-2 rounded-2xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-200 text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingDrive ? 'animate-spin' : ''}`} />
              {isSyncingDrive
                ? 'Syncing Drive...'
                : localOnlyUnsyncedCount > 0
                ? `Sync & Push ${localOnlyUnsyncedCount} to Drive`
                : 'Sync with Drive'}
            </button>

            <button
              onClick={() => setUploadDrawerOpen((o) => !o)}
              className="px-3.5 py-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-xs font-extrabold inline-flex items-center gap-1.5 shadow-lg cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              Upload Media {uploadQueue.filter((t) => t.status === 'uploading').length > 0 && `(${uploadQueue.filter((t) => t.status === 'uploading').length})`}
            </button>

            <button
              onClick={() => {
                setPowerToolsTab('redact');
                setPowerToolsOpen(true);
              }}
              className="px-3 py-2 rounded-2xl bg-fuchsia-500/20 hover:bg-fuchsia-500/30 border border-fuchsia-400/40 text-fuchsia-200 text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" /> Studio · PDF · Memories · {isVaultUnlocked ? '🔓' : '🔒'}
            </button>

            <button
              onClick={() => setNavScope(navScope === 'admin' ? 'all' : 'admin')}
              className={`px-3 py-2 rounded-2xl text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer border ${
                navScope === 'admin'
                  ? 'bg-purple-500 text-slate-950 border-purple-300'
                  : 'bg-white/10 hover:bg-white/20 text-white border-white/15'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" /> Admin & Quota
            </button>

            <div className="relative">
              <button
                onClick={() => {
                  setNotifOpen((o) => !o);
                  setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
                }}
                className="p-2 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/15 text-white relative cursor-pointer"
              >
                <Bell className="w-4 h-4" />
                {unreadNotifs > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-[9px] font-black flex items-center justify-center">
                    {unreadNotifs}
                  </span>
                )}
              </button>
              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 max-h-80 overflow-y-auto rounded-2xl bg-slate-900 border border-white/15 shadow-2xl p-3 z-50 space-y-2">
                  <div className="flex items-center justify-between text-xs font-extrabold text-slate-300">
                    <span>Media Notifications</span>
                    <button onClick={() => setNotifOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {notifications.length === 0 ? (
                    <p className="text-xs text-slate-500 py-4 text-center">No notifications yet.</p>
                  ) : (
                    notifications.map((n) => (
                      <div key={n.id} className="p-2 rounded-xl bg-slate-950 border border-white/10 text-xs space-y-0.5">
                        <div className="font-bold text-white">{n.title}</div>
                        <div className="text-[11px] text-slate-300">{n.message}</div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Search + Voice Search + AI Semantic Toggle */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search filename, #tags, OCR text, AI captions, metadata, or folder..."
              className="w-full pl-9 pr-10 py-2.5 rounded-2xl bg-slate-950/90 border border-white/15 text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
            />
            <button
              onClick={handleVoiceSearch}
              title="Voice Search"
              className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-xl cursor-pointer ${
                isVoiceListening ? 'bg-rose-500 text-white animate-pulse' : 'bg-white/10 hover:bg-white/20 text-cyan-300'
              }`}
            >
              <Mic className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={() => setSemanticMode((s) => !s)}
            className={`px-3 py-2.5 rounded-2xl text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer border ${
              semanticMode
                ? 'bg-fuchsia-500/25 text-fuchsia-200 border-fuchsia-400/50'
                : 'bg-slate-950/80 text-slate-300 border-white/10'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" /> AI Semantic
          </button>

          <div className="flex rounded-2xl bg-slate-950/80 border border-white/10 p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-xl cursor-pointer ${viewMode === 'grid' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400'}`}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-xl cursor-pointer ${viewMode === 'list' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400'}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Upload Drawer (Multi-File, Drag & Drop, Resumable Chunked Drive Upload, Duplicate Detection, Local SQLite Toggle) */}
      {uploadDrawerOpen && (
        <div className="rounded-3xl bg-slate-900/95 border border-cyan-400/40 p-4 space-y-3 shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-black text-white flex items-center gap-2">
              <Upload className="w-4 h-4 text-cyan-400" /> Multi-File Resumable Upload Manager
            </div>
            <button onClick={() => setUploadDrawerOpen(false)} className="p-1.5 rounded-xl bg-white/10 text-slate-300 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs">
            <div className="flex items-center gap-2 bg-slate-950/80 border border-white/10 rounded-2xl px-3 py-2">
              <Folder className="w-4 h-4 text-amber-300 shrink-0" />
              <span className="text-slate-400 shrink-0">Target Folder:</span>
              <select
                value={uploadFolder}
                onChange={(e) => setUploadFolder(e.target.value)}
                className="flex-1 bg-transparent text-white font-bold focus:outline-none"
              >
                <option value="/" className="bg-slate-900">/ (Media Library Root)</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.path} className="bg-slate-900">{f.path}</option>
                ))}
              </select>
            </div>

            <label className="flex items-center justify-between gap-2 bg-slate-950/80 border border-white/10 rounded-2xl px-3 py-2 cursor-pointer">
              <span className="font-bold text-emerald-200">💾 Also Store Locally in SQLite</span>
              <input type="checkbox" checked={uploadStoreLocal} onChange={(e) => setUploadStoreLocal(e.target.checked)} className="w-4 h-4 accent-emerald-500" />
            </label>

            <label className="flex items-center justify-between gap-2 bg-slate-950/80 border border-white/10 rounded-2xl px-3 py-2 cursor-pointer">
              <span className="font-bold text-fuchsia-200">✨ Auto AI Tag & Caption</span>
              <input type="checkbox" checked={autoAiOnUpload} onChange={(e) => setAutoAiOnUpload(e.target.checked)} className="w-4 h-4 accent-fuchsia-500" />
            </label>
          </div>

          <div className="rounded-2xl border-2 border-dashed border-cyan-400/45 hover:border-cyan-300 bg-slate-950/70 p-5 text-center transition-all space-y-3">
            <Upload className="w-8 h-8 mx-auto text-cyan-400" />
            <div>
              <div className="text-sm font-extrabold text-white">Drag & Drop Files or Entire Media Folders Here</div>
              <p className="text-xs text-slate-400 mt-1">
                Preserves nested subfolders in Google Drive (&quot;Family Circle / Media Library Vault&quot;) · Auto-skips OS junk files
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer shadow"
              >
                <Upload className="w-3.5 h-3.5" /> Select Files
              </button>
              <button
                type="button"
                onClick={() => folderInputRef.current?.click()}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer shadow"
              >
                <Folder className="w-3.5 h-3.5" /> Upload Entire Folder
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.md,.json,.ppt,.pptx"
              onChange={(e) => {
                if (e.target.files?.length) enqueueFiles(e.target.files);
                e.target.value = '';
              }}
              className="hidden"
            />
            <input
              ref={folderInputRef}
              type="file"
              multiple
              {...({ webkitdirectory: '', directory: '' } as any)}
              onChange={(e) => {
                if (e.target.files?.length) enqueueFiles(e.target.files);
                e.target.value = '';
              }}
              className="hidden"
            />
          </div>

          {uploadQueue.length > 0 && (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {uploadQueue.map((task) => (
                <div key={task.id} className="rounded-2xl bg-slate-950/90 border border-white/10 p-3 text-xs space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="font-extrabold text-white truncate block max-w-xs">{task.fileName}</span>
                      <span className="text-[10px] text-slate-400">
                        {formatBytes(task.fileSize)} · {task.folderPath} · {task.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {task.status === 'uploading' && (
                        <button
                          onClick={() => {
                            abortFlagsRef.current[task.id] = true;
                          }}
                          className="px-2 py-1 rounded-lg bg-amber-500/20 text-amber-200 font-bold inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Pause className="w-3 h-3" /> Pause
                        </button>
                      )}
                      {(task.status === 'paused' || task.status === 'failed') && (
                        <button
                          onClick={() => void runUploadTask(task, true)}
                          className="px-2 py-1 rounded-lg bg-cyan-500/25 text-cyan-200 font-bold inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Play className="w-3 h-3" /> {task.status === 'paused' ? 'Resume' : 'Retry'}
                        </button>
                      )}
                      {task.status === 'duplicate' && (
                        <button
                          onClick={() => void runUploadTask(task, true)}
                          className="px-2 py-1 rounded-lg bg-amber-500/25 text-amber-200 font-bold cursor-pointer"
                        >
                          Upload Anyway
                        </button>
                      )}
                      {task.status === 'completed' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                    </div>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        task.status === 'failed'
                          ? 'bg-rose-500'
                          : task.status === 'completed'
                          ? 'bg-emerald-400'
                          : 'bg-gradient-to-r from-cyan-400 to-blue-500'
                      }`}
                      style={{ width: `${task.progress}%` }}
                    />
                  </div>
                  {task.errorMessage && <div className="text-[10px] text-amber-300">{task.errorMessage}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Main Split Layout: Sidebar + Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Sidebar */}
        <div className="lg:col-span-3 space-y-3">
          {/* Quick Scopes */}
          <div className="rounded-3xl bg-slate-900/85 border border-white/10 p-3 space-y-1 text-xs">
            {(
              [
                { id: 'all', label: 'All Media', icon: Layers, count: analytics?.activeItems },
                { id: 'favorites', label: 'Favorites', icon: Star, count: analytics?.favoriteItems },
                { id: 'recent', label: 'Recently Viewed', icon: Clock, count: undefined },
                { id: 'offline_local', label: 'Stored Local (SQLite)', icon: HardDrive, count: analytics?.localStoredCount },
                { id: 'archive', label: 'Archived', icon: Archive, count: analytics?.archivedItems },
                { id: 'trash', label: 'Trash / Restore', icon: Trash2, count: analytics?.trashItems },
              ] as Array<{ id: NavScope; label: string; icon: React.FC<{ className?: string }>; count?: number }>
            ).map((s) => {
              const Icon = s.icon;
              const active = navScope === s.id && activeFolder === 'ALL' && !activeCollectionId;
              return (
                <button
                  key={s.id}
                  onClick={() => {
                    setNavScope(s.id);
                    setActiveFolder('ALL');
                    setActiveCollectionId('');
                  }}
                  className={`w-full px-3 py-2 rounded-2xl font-bold flex items-center justify-between cursor-pointer transition-all ${
                    active ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/40' : 'text-slate-300 hover:bg-white/5'
                  }`}
                >
                  <span className="inline-flex items-center gap-2">
                    <Icon className="w-4 h-4" /> {s.label}
                  </span>
                  {typeof s.count === 'number' && (
                    <span className="px-2 py-0.5 rounded-full bg-white/10 text-[10px] font-black">{s.count}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Nested Folders */}
          <div className="rounded-3xl bg-slate-900/85 border border-white/10 p-3 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Nested Folders</span>
              <button
                onClick={() => setCreatingFolder((c) => !c)}
                className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-cyan-300 cursor-pointer"
                title="New Folder"
              >
                <FolderPlus className="w-3.5 h-3.5" />
              </button>
            </div>
            {creatingFolder && (
              <div className="flex gap-1">
                <input
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder={activeFolder === 'ALL' ? 'Folder name' : `Subfolder in ${activeFolder}`}
                  className="flex-1 px-2 py-1.5 rounded-xl bg-slate-950 border border-white/10 text-white text-[11px]"
                />
                <button
                  onClick={async () => {
                    if (!newFolderName.trim()) return;
                    const created = await createMediaFolder({
                      userEmail,
                      parentPath: activeFolder === 'ALL' ? '/' : activeFolder,
                      name: newFolderName,
                      googleAccessToken,
                    });
                    setFolders((prev) => [...prev.filter((f) => f.id !== created.id), created]);
                    setNewFolderName('');
                    setCreatingFolder(false);
                    pushNotification('success', 'Folder Created', `Created ${created.path} in Drive & SQLite.`);
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-cyan-500 text-slate-950 font-extrabold cursor-pointer"
                >
                  Add
                </button>
              </div>
            )}
            <div className="space-y-1 max-h-44 overflow-y-auto">
              <button
                onClick={() => {
                  setNavScope('all');
                  setActiveFolder('/');
                  setActiveCollectionId('');
                }}
                className={`w-full px-2.5 py-1.5 rounded-xl text-left flex items-center gap-2 cursor-pointer ${
                  activeFolder === '/' ? 'bg-amber-500/20 text-amber-200 font-bold' : 'text-slate-300 hover:bg-white/5'
                }`}
              >
                <Folder className="w-3.5 h-3.5 text-amber-300" /> / (Vault Root)
              </button>
              {folders.map((f) => (
                <button
                  key={f.id}
                  onClick={() => {
                    setNavScope('all');
                    setActiveFolder(f.path);
                    setActiveCollectionId('');
                  }}
                  className={`w-full px-2.5 py-1.5 rounded-xl text-left flex items-center gap-2 truncate cursor-pointer ${
                    activeFolder === f.path ? 'bg-amber-500/20 text-amber-200 font-bold' : 'text-slate-300 hover:bg-white/5'
                  }`}
                >
                  <Folder className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                  <span className="truncate">{f.path}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Albums & Collections */}
          <div className="rounded-3xl bg-slate-900/85 border border-white/10 p-3 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Albums & Collections</span>
              <button
                onClick={() => setCreatingCollection((c) => !c)}
                className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-purple-300 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            {creatingCollection && (
              <div className="space-y-1.5">
                <input
                  value={newCollectionName}
                  onChange={(e) => setNewCollectionName(e.target.value)}
                  placeholder="Album / Collection name"
                  className="w-full px-2 py-1.5 rounded-xl bg-slate-950 border border-white/10 text-white text-[11px]"
                />
                <div className="flex gap-1">
                  <select
                    value={newCollectionKind}
                    onChange={(e) => setNewCollectionKind(e.target.value as any)}
                    className="flex-1 px-2 py-1 rounded-xl bg-slate-950 border border-white/10 text-white text-[11px]"
                  >
                    <option value="album">Album</option>
                    <option value="collection">Collection</option>
                    <option value="playlist">Audio Playlist</option>
                  </select>
                  <button
                    onClick={async () => {
                      if (!newCollectionName.trim()) return;
                      const col = await createMediaCollection({
                        userEmail,
                        name: newCollectionName.trim(),
                        kind: newCollectionKind,
                      });
                      setCollections((prev) => [col, ...prev]);
                      setNewCollectionName('');
                      setCreatingCollection(false);
                    }}
                    className="px-3 py-1 rounded-xl bg-purple-500 text-slate-950 font-extrabold cursor-pointer"
                  >
                    Create
                  </button>
                </div>
              </div>
            )}
            <div className="space-y-1 max-h-36 overflow-y-auto">
              {collections.length === 0 ? (
                <p className="text-[11px] text-slate-500">Create family albums or audio playlists.</p>
              ) : (
                collections.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setNavScope('all');
                      setActiveFolder('ALL');
                      setActiveCollectionId(c.id);
                    }}
                    className={`w-full px-2.5 py-1.5 rounded-xl text-left flex items-center justify-between cursor-pointer ${
                      activeCollectionId === c.id ? 'bg-purple-500/25 text-purple-100 font-bold' : 'text-slate-300 hover:bg-white/5'
                    }`}
                  >
                    <span className="truncate">{c.name}</span>
                    <span className="text-[9px] uppercase text-slate-400">{c.kind}</span>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* 1 TB Drive Quota + Local SQLite Mini Gauge */}
          <div className="rounded-3xl bg-slate-900/85 border border-white/10 p-3.5 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-cyan-300 inline-flex items-center gap-1">
                <Cloud className="w-3.5 h-3.5" /> Google Drive (1 TB)
              </span>
              <span className="text-[11px] font-bold text-white">{formatBytes(analytics?.totalDriveBytes || 0)}</span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-cyan-400 to-purple-500" style={{ width: `${Math.max(1, quotaPct)}%` }} />
            </div>
            <div className="flex items-center justify-between text-[11px] text-emerald-300 pt-1 border-t border-white/10">
              <span className="inline-flex items-center gap-1">
                <HardDrive className="w-3.5 h-3.5" /> Local SQLite Cache
              </span>
              <strong>
                {analytics?.localStoredCount || 0} files ({formatBytes(analytics?.localStoredBytes || 0)})
              </strong>
            </div>
          </div>
        </div>

        {/* Right Main Pane: Admin Dashboard OR Media Grid/List */}
        <div className="lg:col-span-9 space-y-3">
          {navScope === 'admin' ? (
            <div className="rounded-3xl bg-slate-900/90 border border-white/15 p-5 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black text-white">Admin Storage Monitoring, Quotas & Audit Logs</h3>
                  <p className="text-xs text-slate-400">1 TB Google Drive Media Vault + On-Demand Local SQLite Offline Cache</p>
                </div>
                <button onClick={() => void loadMetadata()} className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold cursor-pointer">
                  Refresh Stats
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-cyan-400/30">
                  <div className="text-slate-400">Indexed Assets</div>
                  <div className="text-2xl font-black text-white mt-1">{analytics?.activeItems || 0}</div>
                  <div className="text-[10px] text-cyan-300">Supports 1M+ metadata rows</div>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-purple-400/30">
                  <div className="text-slate-400">Drive Cloud Used</div>
                  <div className="text-2xl font-black text-white mt-1">{formatBytes(analytics?.totalDriveBytes || 0)}</div>
                  <div className="text-[10px] text-purple-300">of 1 TB Quota ({quotaPct.toFixed(3)}%)</div>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-emerald-400/30">
                  <div className="text-slate-400">Local SQLite Blobs</div>
                  <div className="text-2xl font-black text-white mt-1">{analytics?.localStoredCount || 0}</div>
                  <div className="text-[10px] text-emerald-300">{formatBytes(analytics?.localStoredBytes || 0)} cached offline</div>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-amber-400/30">
                  <div className="text-slate-400">Duplicates / Flagged</div>
                  <div className="text-2xl font-black text-white mt-1">
                    {analytics?.duplicateGroupsCount || 0} / {analytics?.flaggedCount || 0}
                  </div>
                  <div className="text-[10px] text-amber-300">SHA-256 & AI Moderation</div>
                </div>
              </div>

              {/* Type Breakdown */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                {Object.entries(analytics?.byType || {}).map(([type, info]) => (
                  <div key={type} className="p-3 rounded-2xl bg-slate-950/80 border border-white/10 flex items-center justify-between">
                    <span className="uppercase font-extrabold text-slate-300">{type.replace('_', ' ')}</span>
                    <span className="text-white font-bold">
                      {info.count} · {formatBytes(info.bytes)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Admin File Cleanup & Permanent Deletion (Local SQLite + Google Drive) */}
              <div className="rounded-3xl bg-slate-950/80 border border-rose-400/30 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-black text-white flex items-center gap-1.5">
                      <Trash2 className="w-4 h-4 text-rose-400" /> Admin File Manager — Permanent Delete (Local SQLite + Google Drive)
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Delete unwanted, duplicate, or oversized files permanently from both local storage and Google Drive.
                    </p>
                  </div>
                  {adminSelectedIds.length > 0 && (
                    <button
                      onClick={() => void handleBulkDeleteAdminSelected()}
                      disabled={isDeletingBulk}
                      className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer shadow-lg disabled:opacity-60"
                    >
                      {isDeletingBulk ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      Delete Selected ({adminSelectedIds.length}) Local + Drive
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      value={adminSearch}
                      onChange={(e) => setAdminSearch(e.target.value)}
                      placeholder="Filter files by name, folder, or type..."
                      className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-900 border border-white/10 text-xs text-white"
                    />
                  </div>
                  {(
                    [
                      { id: 'all', label: `All (${adminFiles.length})` },
                      { id: 'largest', label: 'Largest First' },
                      { id: 'duplicates', label: 'Duplicates' },
                      { id: 'local', label: 'Local SQLite' },
                      { id: 'trashed', label: 'Trashed' },
                      { id: 'flagged', label: 'Flagged' },
                    ] as const
                  ).map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setAdminFilter(f.id)}
                      className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold cursor-pointer ${
                        adminFilter === f.id
                          ? 'bg-rose-500/25 text-rose-200 border border-rose-400/50'
                          : 'bg-slate-900 text-slate-300 border border-white/10'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                  {filteredAdminFiles.length > 0 && (
                    <button
                      onClick={() => {
                        if (adminSelectedIds.length === filteredAdminFiles.length) {
                          setAdminSelectedIds([]);
                        } else {
                          setAdminSelectedIds(filteredAdminFiles.map((x) => x.id));
                        }
                      }}
                      className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold cursor-pointer"
                    >
                      {adminSelectedIds.length === filteredAdminFiles.length ? 'Unselect All' : 'Select All'}
                    </button>
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto space-y-1.5 text-xs">
                  {filteredAdminFiles.length === 0 ? (
                    <p className="text-slate-500 py-4 text-center">No files match this filter.</p>
                  ) : (
                    filteredAdminFiles.map((f) => {
                      const checked = adminSelectedIds.includes(f.id);
                      return (
                        <div
                          key={f.id}
                          className={`p-2.5 rounded-xl border flex flex-wrap items-center justify-between gap-2 ${
                            checked ? 'bg-rose-950/35 border-rose-400/45' : 'bg-slate-900/90 border-white/10'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                setAdminSelectedIds((prev) =>
                                  checked ? prev.filter((id) => id !== f.id) : [...prev, f.id]
                                )
                              }
                              className="w-4 h-4 accent-rose-500 shrink-0 cursor-pointer"
                            />
                            <div className="min-w-0">
                              <div className="font-extrabold text-white truncate max-w-[220px] sm:max-w-sm">
                                {f.fileName}
                              </div>
                              <div className="text-[10px] text-slate-400 flex flex-wrap items-center gap-1.5">
                                <span>{f.folderPath}</span>
                                <span>·</span>
                                <span className="text-slate-200 font-bold">{formatBytes(f.fileSize)}</span>
                                {f.driveFileId && <span className="text-cyan-300 font-bold">☁️ Drive</span>}
                                {f.isStoredLocally && <span className="text-emerald-300 font-bold">💾 Local</span>}
                                {f.isDeleted && <span className="text-amber-300 font-bold">🗑️ In Trash</span>}
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => void handlePermanentDeleteSingle(f)}
                            className="px-2.5 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/35 border border-rose-400/40 text-rose-200 text-[11px] font-extrabold inline-flex items-center gap-1 cursor-pointer shrink-0"
                          >
                            <Trash2 className="w-3 h-3" /> Delete Local + Drive
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Audit Logs */}
              <div className="space-y-2">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Recent Audit Logs</h4>
                <div className="max-h-72 overflow-y-auto space-y-1.5 text-xs">
                  {(analytics?.recentAuditLogs || []).length === 0 ? (
                    <p className="text-slate-500">No audit activity yet.</p>
                  ) : (
                    analytics!.recentAuditLogs.map((log) => (
                      <div key={log.id} className="p-2.5 rounded-xl bg-slate-950 border border-white/10 flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <span className="px-2 py-0.5 rounded-md bg-cyan-500/20 text-cyan-200 text-[10px] font-black uppercase mr-2">
                            {log.action}
                          </span>
                          <span className="text-slate-200">{log.details}</span>
                        </div>
                        <span className="text-[10px] text-slate-500">{log.createdAt.replace('T', ' ').slice(0, 19)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Filter Bar */}
              <div className="rounded-3xl bg-slate-900/85 border border-white/10 p-3 space-y-2.5">
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  {(
                    [
                      { id: 'all', label: 'All Types' },
                      { id: 'image', label: '🖼️ Images' },
                      { id: 'video', label: '🎬 Videos' },
                      { id: 'audio', label: '🎵 Audio' },
                      { id: 'pdf', label: '📕 PDFs' },
                      { id: 'document', label: '📄 Docs' },
                      { id: 'ai_generated', label: '✨ AI Media' },
                    ] as const
                  ).map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setMediaTypeFilter(t.id)}
                      className={`px-3 py-1.5 rounded-xl font-bold cursor-pointer transition-all ${
                        mediaTypeFilter === t.id
                          ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-slate-950 shadow'
                          : 'bg-slate-950 text-slate-300 border border-white/10 hover:bg-white/10'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-950 border border-white/10 text-white font-bold"
                  >
                    <option value="newest">Sort: Newest</option>
                    <option value="oldest">Sort: Oldest</option>
                    <option value="name">Sort: Filename A–Z</option>
                    <option value="size">Sort: Largest First</option>
                    <option value="recent">Sort: Recently Viewed</option>
                  </select>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    title="Date From"
                    className="px-2.5 py-1.5 rounded-xl bg-slate-950 border border-white/10 text-white"
                  />
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    title="Date To"
                    className="px-2.5 py-1.5 rounded-xl bg-slate-950 border border-white/10 text-white"
                  />
                  <input
                    type="number"
                    min="0"
                    value={minSizeMb}
                    onChange={(e) => setMinSizeMb(e.target.value)}
                    placeholder="Min MB"
                    className="w-20 px-2.5 py-1.5 rounded-xl bg-slate-950 border border-white/10 text-white"
                  />
                  <span className="ml-auto text-slate-400 font-bold">
                    Showing {displayedItems.length} of {totalItems}
                  </span>
                </div>
              </div>

              {/* Media Grid / List */}
              {loading && displayedItems.length === 0 ? (
                <div className="py-16 flex flex-col items-center gap-2 text-slate-400 text-xs">
                  <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
                  <span>Loading Family Media Vault...</span>
                </div>
              ) : displayedItems.length === 0 ? (
                <div className="rounded-3xl bg-slate-900/70 border border-white/10 p-10 text-center space-y-3">
                  <Cloud className="w-12 h-12 mx-auto text-cyan-400 opacity-80" />
                  <h4 className="text-base font-black text-white">No Media Assets Found</h4>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    Upload images, videos, audio, PDFs, or documents directly to your 1 TB Google Drive Media Vault, or click &quot;Sync from Drive&quot; to index existing files into SQLite.
                  </p>
                  <div className="flex flex-wrap justify-center gap-2 pt-1">
                    <button
                      onClick={() => setUploadDrawerOpen(true)}
                      className="px-4 py-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-xs font-extrabold cursor-pointer"
                    >
                      + Upload Media Files
                    </button>
                    <button
                      onClick={() => void handleSyncFromDrive()}
                      className="px-4 py-2 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-xs font-extrabold cursor-pointer"
                    >
                      ☁️ Sync from Google Drive
                    </button>
                  </div>
                </div>
              ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                  {displayedItems.map((it) => (
                    <div
                      key={it.id}
                      onClick={() => setSelectedItem(it)}
                      className="group rounded-3xl bg-slate-900/90 hover:bg-slate-800/95 border border-white/10 hover:border-cyan-400/50 overflow-hidden cursor-pointer transition-all flex flex-col shadow-lg"
                    >
                      <div className="aspect-[4/3] bg-slate-950 relative flex items-center justify-center overflow-hidden">
                        {it.thumbnailDataUrl ? (
                          <img src={it.thumbnailDataUrl} alt={it.fileName} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                        ) : it.mediaType === 'video' ? (
                          <Video className="w-10 h-10 text-purple-400" />
                        ) : it.mediaType === 'audio' ? (
                          <Music className="w-10 h-10 text-cyan-400" />
                        ) : it.mediaType === 'image' || it.mediaType === 'ai_generated' ? (
                          <ImageIcon className="w-10 h-10 text-emerald-400" />
                        ) : (
                          <FileText className="w-10 h-10 text-amber-400" />
                        )}

                        <div className="absolute top-2 left-2 flex gap-1">
                          <span className="px-2 py-0.5 rounded-full bg-black/70 text-[9px] font-black uppercase text-white">
                            {it.mediaType.replace('_', ' ')}
                          </span>
                          {it.aiMetadata?.moderationStatus === 'flagged' && (
                            <span className="px-1.5 py-0.5 rounded-full bg-rose-500/90 text-[9px] font-black text-white inline-flex items-center gap-0.5">
                              <ShieldAlert className="w-2.5 h-2.5" /> Flag
                            </span>
                          )}
                        </div>

                        <div className="absolute top-2 right-2 flex gap-1">
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              const u = await patchMediaItemInSqlite(it.id, { isFavorite: !it.isFavorite });
                              if (u) setItems((prev) => prev.map((x) => (x.id === u.id ? u : x)));
                            }}
                            className={`p-1.5 rounded-full backdrop-blur-md cursor-pointer ${
                              it.isFavorite ? 'bg-amber-500 text-slate-950' : 'bg-black/60 text-white hover:bg-black/80'
                            }`}
                          >
                            <Star className="w-3 h-3" />
                          </button>
                        </div>

                        {it.isStoredLocally && (
                          <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded-full bg-emerald-500/90 text-slate-950 text-[9px] font-black inline-flex items-center gap-1">
                            <HardDrive className="w-2.5 h-2.5" /> Local SQLite
                          </span>
                        )}
                      </div>

                      <div className="p-2.5 space-y-1 flex-1 flex flex-col justify-between">
                        <div>
                          <div className="text-xs font-extrabold text-white truncate">{it.fileName}</div>
                          <div className="text-[10px] text-slate-400 truncate">
                            {formatBytes(it.fileSize)} · {it.folderPath}
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-1 pt-1 border-t border-white/5 text-[10px]">
                          <div className="flex items-center gap-1">
                            {!it.driveFileId && !it.isDeleted && (
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  try {
                                    const pushed = await pushSingleLocalMediaItemToDrive(it, googleAccessToken, userEmail);
                                    setItems((prev) => prev.map((x) => (x.id === pushed.id ? pushed : x)));
                                    pushNotification('success', 'Uploaded to Google Drive', `"${it.fileName}" is now stored in Google Drive!`);
                                    void loadMetadata();
                                  } catch (err: any) {
                                    pushNotification('error', 'Drive Upload Failed', err?.message || 'Reconnect Google Drive and retry.');
                                  }
                                }}
                                className="px-2 py-0.5 rounded-lg bg-amber-500/25 hover:bg-amber-500/40 text-amber-200 font-bold cursor-pointer"
                              >
                                ↑ Push Drive
                              </button>
                            )}
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                try {
                                  const u = it.isStoredLocally
                                    ? await removeMediaItemFromLocalSqlite(it.id)
                                    : await storeMediaItemLocallyInSqlite(it, { googleAccessToken, userEmail });
                                  if (u) setItems((prev) => prev.map((x) => (x.id === u.id ? u : x)));
                                  void loadMetadata();
                                } catch (err: any) {
                                  pushNotification('error', 'Local Cache Failed', err?.message || 'Error');
                                }
                              }}
                              className={`px-2 py-0.5 rounded-lg font-bold cursor-pointer ${
                                it.isStoredLocally
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : 'bg-white/10 hover:bg-cyan-500/25 text-cyan-200'
                              }`}
                            >
                              {it.isStoredLocally ? '✓ Offline' : 'Store Local'}
                            </button>
                          </div>

                          {it.isDeleted ? (
                            <div className="flex gap-1">
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  await patchMediaItemInSqlite(it.id, { isDeleted: false, deletedAt: null });
                                  setItems((prev) => prev.filter((x) => x.id !== it.id));
                                }}
                                className="px-2 py-0.5 rounded-lg bg-emerald-500/25 text-emerald-200 font-bold cursor-pointer"
                              >
                                Restore
                              </button>
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  await handlePermanentDeleteSingle(it);
                                }}
                                className="px-2 py-0.5 rounded-lg bg-rose-500/25 text-rose-200 font-bold cursor-pointer"
                              >
                                Delete All
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                void handlePermanentDeleteSingle(it);
                              }}
                              title="Delete permanently from Local SQLite & Google Drive"
                              className="p-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/35 text-rose-300 cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-1.5">
                  {displayedItems.map((it) => (
                    <div
                      key={it.id}
                      onClick={() => setSelectedItem(it)}
                      className="rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-white/10 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="px-2 py-0.5 rounded-lg bg-cyan-500/15 text-cyan-200 text-[10px] font-black uppercase">
                          {it.mediaType}
                        </span>
                        <div className="min-w-0">
                          <div className="font-extrabold text-white truncate max-w-xs sm:max-w-md">{it.fileName}</div>
                          <div className="text-[10px] text-slate-400">
                            {it.folderPath} · {it.category} · {(it.tags || []).slice(0, 3).map((t) => `#${t}`).join(' ')}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-[11px]">
                        <span className="text-slate-300 font-bold">{formatBytes(it.fileSize)}</span>
                        {it.isStoredLocally && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                            Local SQLite
                          </span>
                        )}
                        <span className="text-slate-500">{(it.updatedAt || '').slice(0, 10)}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            void handlePermanentDeleteSingle(it);
                          }}
                          title="Delete permanently from Local SQLite & Google Drive"
                          className="p-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/35 text-rose-300 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Infinite Scroll Sentinel / Load More */}
              {hasMore && (
                <div ref={sentinelRef} className="py-4 text-center">
                  <button
                    onClick={() => void loadItems(page + 1, true)}
                    disabled={loading}
                    className="px-4 py-2 rounded-2xl bg-white/10 hover:bg-white/20 text-xs font-bold text-cyan-200 cursor-pointer"
                  >
                    {loading ? 'Loading more...' : 'Load More Media Assets'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Persistent Background Audio Mini-Player & Playlist Bar */}
      {currentAudioItem && bgAudioUrl && (
        <div className="fixed bottom-16 left-3 right-3 sm:left-6 sm:right-6 z-50 rounded-2xl bg-slate-900/95 backdrop-blur-xl border border-cyan-400/40 p-3 shadow-2xl flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center shrink-0">
              <Volume2 className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-extrabold text-white truncate max-w-[180px] sm:max-w-xs">{currentAudioItem.fileName}</div>
              <div className="text-[10px] text-cyan-300">
                Playlist Track {currentAudioIdx + 1} of {audioPlaylist.length}
              </div>
            </div>
          </div>
          <audio
            src={bgAudioUrl}
            controls
            autoPlay
            onEnded={() => {
              if (audioPlaylist.length > 1) setCurrentAudioIdx((i) => (i + 1) % audioPlaylist.length);
            }}
            className="h-8 flex-1 max-w-md"
          />
          <div className="flex items-center gap-1.5">
            {audioPlaylist.length > 1 && (
              <button
                onClick={() => setCurrentAudioIdx((i) => (i + 1) % audioPlaylist.length)}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer"
              >
                <SkipForward className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => {
                setAudioPlaylist([]);
                setBgAudioUrl('');
              }}
              className="p-1.5 rounded-xl bg-rose-500/20 text-rose-200 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Full Multimodal Media Viewer Modal */}
      <MediaAssetViewerModal
        item={selectedItem}
        allItems={displayedItems}
        folders={folders}
        collections={collections}
        googleAccessToken={googleAccessToken}
        userEmail={userEmail}
        onClose={() => setSelectedItem(null)}
        onSelectItem={(it) => setSelectedItem(it)}
        onItemUpdated={(updated) => {
          setSelectedItem(updated);
          setItems((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
          void loadMetadata();
        }}
        onItemDeleted={(id) => {
          setItems((prev) => prev.filter((x) => x.id !== id));
          setSelectedItem(null);
          void loadMetadata();
        }}
        onPlayAudioInBackground={handlePlayAudioInBackground}
        onNotify={pushNotification}
      />

      {/* Power Tools: Redact/Enhance, Multi-Image->PDF Merger, Memories Slideshow & PIN Private Folder Lock */}
      <MediaPowerToolsModal
        isOpen={powerToolsOpen}
        initialTab={powerToolsTab}
        items={items}
        folders={folders}
        googleAccessToken={googleAccessToken}
        userEmail={userEmail}
        ownerName={ownerName}
        isVaultUnlocked={isVaultUnlocked}
        onUnlockChange={setIsVaultUnlocked}
        onLockedFoldersChange={setLockedFolders}
        onCreatedMediaItem={(created) => {
          setItems((prev) => [created, ...prev.filter((x) => x.id !== created.id)]);
          void loadMetadata();
        }}
        onClose={() => setPowerToolsOpen(false)}
      />
    </div>
  );
};
