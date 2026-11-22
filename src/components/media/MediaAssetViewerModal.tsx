import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  HardDrive,
  Cloud,
  Sparkles,
  Share2,
  Star,
  Archive,
  Trash2,
  RotateCcw,
  Tag,
  ShieldCheck,
  ShieldAlert,
  Copy,
  Check,
  Loader2,
  Music,
  FileText,
  Subtitles,
  Plus,
} from 'lucide-react';
import { MediaCollectionItem, MediaFolderItem, MediaLibraryItem } from '../../types/mediaLibrary';
import {
  analyzeMediaItemWithAi,
  deleteMediaFileEverywhere,
  findSimilarMediaItems,
  formatBytes,
  patchMediaItemInSqlite,
  removeMediaItemFromLocalSqlite,
  resolvePlayableMediaUrl,
  storeMediaItemLocallyInSqlite,
  updateMediaSharing,
} from '../../services/mediaLibraryService';

interface MediaAssetViewerModalProps {
  item: MediaLibraryItem | null;
  allItems: MediaLibraryItem[];
  folders: MediaFolderItem[];
  collections: MediaCollectionItem[];
  googleAccessToken?: string | null;
  userEmail?: string;
  onClose: () => void;
  onSelectItem: (item: MediaLibraryItem) => void;
  onItemUpdated: (item: MediaLibraryItem) => void;
  onItemDeleted: (id: string) => void;
  onPlayAudioInBackground: (item: MediaLibraryItem) => void;
  onNotify: (kind: 'success' | 'error' | 'warning' | 'info', title: string, message: string) => void;
}

export const MediaAssetViewerModal: React.FC<MediaAssetViewerModalProps> = ({
  item,
  allItems,
  folders,
  collections,
  googleAccessToken,
  userEmail,
  onClose,
  onSelectItem,
  onItemUpdated,
  onItemDeleted,
  onPlayAudioInBackground,
  onNotify,
}) => {
  const [playableUrl, setPlayableUrl] = useState<string>('');
  const [playSource, setPlaySource] = useState<'sqlite_local' | 'google_drive' | 'thumbnail'>('thumbnail');
  const [loadingMedia, setLoadingMedia] = useState(false);

  // Image viewer controls
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [slideshow, setSlideshow] = useState(false);

  // Video controls
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showCaptions, setShowCaptions] = useState(true);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const viewerStageRef = useRef<HTMLDivElement | null>(null);

  // Audio waveform canvas
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const waveCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Inspector tabs
  const [inspectorTab, setInspectorTab] = useState<'details' | 'ai' | 'share'>('details');
  const [newTag, setNewTag] = useState('');
  const [customKey, setCustomKey] = useState('');
  const [customVal, setCustomVal] = useState('');
  const [locationDraft, setLocationDraft] = useState('');
  const [isCachingLocal, setIsCachingLocal] = useState(false);
  const [isAnalyzingAi, setIsAnalyzingAi] = useState(false);
  const [isSavingShare, setIsSavingShare] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Share form state
  const [sharePublic, setSharePublic] = useState(false);
  const [shareRole, setShareRole] = useState<'view' | 'comment' | 'edit'>('view');
  const [allowDownload, setAllowDownload] = useState(true);
  const [shareExpires, setShareExpires] = useState('');
  const [shareEmailInput, setShareEmailInput] = useState('');
  const [sharedEmails, setSharedEmails] = useState<string[]>([]);

  useEffect(() => {
    if (!item) return;
    setZoom(1);
    setRotation(0);
    setLocationDraft(item.location || '');
    setSharePublic(Boolean(item.shareConfig?.isPublic));
    setShareRole(item.shareConfig?.permissionRole || 'view');
    setAllowDownload(item.shareConfig?.allowDownload !== false);
    setShareExpires(item.shareConfig?.expiresAt || '');
    setSharedEmails(item.shareConfig?.sharedWithEmails || []);

    let revokeFn: (() => void) | undefined;
    let cancelled = false;
    setLoadingMedia(true);

    // Record recently viewed timestamp silently
    patchMediaItemInSqlite(item.id, { lastViewedAt: new Date().toISOString(), _silentViewPing: true }).catch(() => {});

    resolvePlayableMediaUrl(item, googleAccessToken)
      .then((res) => {
        if (cancelled) {
          res.revoke?.();
          return;
        }
        setPlayableUrl(res.url);
        setPlaySource(res.source);
        revokeFn = res.revoke;
      })
      .finally(() => {
        if (!cancelled) setLoadingMedia(false);
      });

    return () => {
      cancelled = true;
      revokeFn?.();
    };
  }, [item?.id, item?.isStoredLocally, googleAccessToken]);

  // Image slideshow timer
  useEffect(() => {
    if (!slideshow || !item) return;
    const images = allItems.filter((i) => (i.mediaType === 'image' || i.mediaType === 'ai_generated') && !i.isDeleted);
    if (images.length < 2) return;
    const timer = setInterval(() => {
      const idx = images.findIndex((x) => x.id === item.id);
      const next = images[(idx + 1) % images.length];
      if (next) onSelectItem(next);
    }, 3500);
    return () => clearInterval(timer);
  }, [slideshow, item, allItems, onSelectItem]);

  // Video playback speed sync
  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = playbackSpeed;
  }, [playbackSpeed]);

  // Audio waveform animation
  useEffect(() => {
    if (!item || item.mediaType !== 'audio' || !waveCanvasRef.current) return;
    const canvas = waveCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let rafId = 0;
    let phase = 0;
    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      const isPlaying = Boolean(audioRef.current && !audioRef.current.paused);
      const bars = 48;
      const gap = w / bars;
      phase += isPlaying ? 0.14 : 0.02;
      for (let i = 0; i < bars; i++) {
        const amp = isPlaying
          ? 0.25 + 0.65 * Math.abs(Math.sin(phase + i * 0.35) * Math.cos(phase * 0.6 + i * 0.17))
          : 0.15 + 0.2 * Math.abs(Math.sin(i * 0.45));
        const barH = Math.max(6, amp * (h - 12));
        const grad = ctx.createLinearGradient(0, (h - barH) / 2, 0, (h + barH) / 2);
        grad.addColorStop(0, '#22d3ee');
        grad.addColorStop(1, '#a855f7');
        ctx.fillStyle = grad;
        ctx.fillRect(i * gap + 2, (h - barH) / 2, Math.max(3, gap - 4), barH);
      }
      rafId = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(rafId);
  }, [item?.id, item?.mediaType]);

  if (!item) return null;

  const currentIndex = allItems.findIndex((x) => x.id === item.id);
  const similarItems = findSimilarMediaItems(item, allItems);

  const navigateStep = (delta: number) => {
    if (allItems.length < 2) return;
    const nextIdx = (currentIndex + delta + allItems.length) % allItems.length;
    onSelectItem(allItems[nextIdx]);
  };

  const handleToggleLocalSqlite = async () => {
    if (isCachingLocal) return;
    setIsCachingLocal(true);
    try {
      if (item.isStoredLocally) {
        const updated = await removeMediaItemFromLocalSqlite(item.id);
        if (updated) onItemUpdated(updated);
        onNotify('info', 'Removed Local Copy', `"${item.fileName}" removed from local SQLite (still safe on Google Drive).`);
      } else {
        const updated = await storeMediaItemLocallyInSqlite(item, { googleAccessToken, userEmail });
        onItemUpdated(updated);
        onNotify('success', 'Stored Locally in SQLite', `"${item.fileName}" is now cached locally for 100% offline access!`);
      }
    } catch (err: any) {
      onNotify('error', 'Local Storage Error', err?.message || 'Could not update local SQLite cache.');
    } finally {
      setIsCachingLocal(false);
    }
  };

  const handleRunAiAnalysis = async () => {
    if (isAnalyzingAi) return;
    setIsAnalyzingAi(true);
    try {
      const res = await analyzeMediaItemWithAi(item);
      if (res.item) onItemUpdated(res.item);
      onNotify('success', 'AI Analysis Complete', `Tagged & analyzed via ${res.modelUsed}.`);
    } catch (err: any) {
      onNotify('error', 'AI Analysis Failed', err?.message || 'Please try again.');
    } finally {
      setIsAnalyzingAi(false);
    }
  };

  const handleAddTag = async () => {
    const clean = newTag.trim().toLowerCase();
    if (!clean) return;
    const nextTags = Array.from(new Set([...(item.tags || []), clean]));
    const updated = await patchMediaItemInSqlite(item.id, { tags: nextTags });
    if (updated) onItemUpdated(updated);
    setNewTag('');
  };

  const handleRemoveTag = async (tagToRemove: string) => {
    const nextTags = (item.tags || []).filter((t) => t !== tagToRemove);
    const updated = await patchMediaItemInSqlite(item.id, { tags: nextTags });
    if (updated) onItemUpdated(updated);
  };

  const handleAddCustomMeta = async () => {
    if (!customKey.trim() || !customVal.trim()) return;
    const nextMeta = { ...(item.customMetadata || {}), [customKey.trim()]: customVal.trim() };
    const updated = await patchMediaItemInSqlite(item.id, { customMetadata: nextMeta });
    if (updated) onItemUpdated(updated);
    setCustomKey('');
    setCustomVal('');
  };

  const handleSaveShare = async () => {
    setIsSavingShare(true);
    try {
      const updated = await updateMediaSharing(
        item,
        {
          isPublic: sharePublic,
          permissionRole: shareRole,
          allowDownload,
          expiresAt: shareExpires || null,
          sharedWithEmails: sharedEmails,
          shareLink: item.shareConfig?.shareLink || item.driveWebViewLink,
        },
        googleAccessToken
      );
      if (updated) onItemUpdated(updated);
      onNotify('success', 'Sharing Updated', `Permissions saved to Google Drive & SQLite for "${item.fileName}".`);
    } catch (err: any) {
      onNotify('error', 'Share Update Failed', err?.message || 'Could not update share settings.');
    } finally {
      setIsSavingShare(false);
    }
  };

  const handleCopyLink = () => {
    const link = item.shareConfig?.shareLink || item.driveWebViewLink || '';
    if (!link) return;
    navigator.clipboard?.writeText(link).catch(() => {});
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 1800);
  };

  return (
    <div
      className="fixed inset-0 z-[80] bg-slate-950/92 backdrop-blur-lg flex items-center justify-center p-2 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-6xl h-[92vh] rounded-3xl bg-slate-900 border border-white/15 shadow-2xl overflow-hidden flex flex-col lg:flex-row"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left: Multimodal Media Stage */}
        <div ref={viewerStageRef} className="flex-1 bg-slate-950 flex flex-col min-h-[45%] lg:min-h-0 relative">
          {/* Top Viewer Controls */}
          <div className="px-4 py-3 bg-slate-900/90 border-b border-white/10 flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0 flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-cyan-500/20 text-cyan-200 border border-cyan-400/30">
                {item.mediaType.replace('_', ' ')}
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1 ${
                  playSource === 'sqlite_local'
                    ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/35'
                    : 'bg-indigo-500/20 text-indigo-200 border border-indigo-400/35'
                }`}
              >
                {playSource === 'sqlite_local' ? <HardDrive className="w-3 h-3" /> : <Cloud className="w-3 h-3" />}
                {playSource === 'sqlite_local' ? 'Playing from Local SQLite (Offline Ready)' : 'Streaming from Google Drive'}
              </span>
              <h3 className="text-sm font-black text-white truncate max-w-[220px] sm:max-w-xs">{item.fileName}</h3>
            </div>
            <div className="flex items-center gap-1.5">
              {(item.mediaType === 'image' || item.mediaType === 'ai_generated') && (
                <>
                  <button onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))} title="Zoom Out" className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer">
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <button onClick={() => setZoom((z) => Math.min(3, z + 0.25))} title="Zoom In" className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer">
                    <ZoomIn className="w-4 h-4" />
                  </button>
                  <button onClick={() => setRotation((r) => (r + 90) % 360)} title="Rotate 90°" className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer">
                    <RotateCw className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setSlideshow((s) => !s)}
                    title="Slideshow"
                    className={`px-2.5 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1 cursor-pointer ${
                      slideshow ? 'bg-amber-500 text-slate-950' : 'bg-white/10 text-white hover:bg-white/20'
                    }`}
                  >
                    {slideshow ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    Slideshow
                  </button>
                </>
              )}
              <button
                onClick={() => viewerStageRef.current?.requestFullscreen?.().catch(() => {})}
                title="Fullscreen"
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
              {playableUrl && (
                <a
                  href={playableUrl}
                  download={item.fileName}
                  title="Download"
                  className="p-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-200 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                </a>
              )}
              <button onClick={onClose} className="p-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/35 text-rose-200 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Main Render Area */}
          <div className="flex-1 flex items-center justify-center p-4 overflow-hidden relative">
            {allItems.length > 1 && (
              <>
                <button
                  onClick={() => navigateStep(-1)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-slate-900/80 hover:bg-slate-800 border border-white/15 text-white cursor-pointer"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={() => navigateStep(1)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-slate-900/80 hover:bg-slate-800 border border-white/15 text-white cursor-pointer"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </>
            )}

            {loadingMedia ? (
              <div className="flex flex-col items-center gap-2 text-slate-300 text-xs">
                <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
                <span>Loading media asset...</span>
              </div>
            ) : item.mediaType === 'image' || item.mediaType === 'ai_generated' ? (
              <img
                src={playableUrl || item.thumbnailDataUrl}
                alt={item.fileName}
                style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }}
                className="max-h-full max-w-full object-contain transition-transform duration-200 rounded-xl shadow-2xl"
              />
            ) : item.mediaType === 'video' ? (
              <div className="w-full h-full flex flex-col items-center justify-center gap-3">
                <video
                  ref={videoRef}
                  src={playableUrl}
                  poster={item.thumbnailDataUrl}
                  controls
                  playsInline
                  className="max-h-[72%] max-w-full rounded-2xl border border-white/15 bg-black shadow-2xl"
                />
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="px-2.5 py-1 rounded-xl bg-white/10 text-slate-300 font-bold">Speed:</span>
                  {[0.5, 1, 1.25, 1.5, 2].map((spd) => (
                    <button
                      key={spd}
                      onClick={() => setPlaybackSpeed(spd)}
                      className={`px-2.5 py-1 rounded-xl font-bold cursor-pointer ${
                        playbackSpeed === spd ? 'bg-cyan-500 text-slate-950' : 'bg-white/10 text-slate-200'
                      }`}
                    >
                      {spd}x
                    </button>
                  ))}
                  <button
                    onClick={() => setShowCaptions((c) => !c)}
                    className={`px-2.5 py-1 rounded-xl font-bold inline-flex items-center gap-1 cursor-pointer ${
                      showCaptions ? 'bg-amber-500/25 text-amber-200 border border-amber-400/40' : 'bg-white/10 text-slate-300'
                    }`}
                  >
                    <Subtitles className="w-3.5 h-3.5" /> Captions
                  </button>
                </div>
                {showCaptions && (item.aiMetadata?.transcript || item.aiMetadata?.caption) && (
                  <div className="max-w-xl px-4 py-2 rounded-xl bg-black/75 border border-white/15 text-xs text-amber-100 text-center">
                    {item.aiMetadata?.transcript || item.aiMetadata?.caption}
                  </div>
                )}
              </div>
            ) : item.mediaType === 'audio' ? (
              <div className="w-full max-w-lg rounded-3xl bg-slate-900/90 border border-white/15 p-6 space-y-4 text-center">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center shadow-lg">
                  <Music className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h4 className="text-base font-black text-white">{item.fileName}</h4>
                  <p className="text-xs text-slate-400">{formatBytes(item.fileSize)} · {item.mimeType}</p>
                </div>
                <canvas ref={waveCanvasRef} width={440} height={80} className="w-full h-20 rounded-xl bg-slate-950/90 border border-white/10" />
                <audio ref={audioRef} src={playableUrl} controls className="w-full" />
                <button
                  onClick={() => onPlayAudioInBackground(item)}
                  className="w-full py-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-purple-500 text-slate-950 font-extrabold text-xs cursor-pointer"
                >
                  🎧 Send to Background Audio Player & Playlist
                </button>
              </div>
            ) : item.mediaType === 'pdf' && playableUrl ? (
              <iframe src={playableUrl} title={item.fileName} className="w-full h-full rounded-2xl border border-white/15 bg-white" />
            ) : (
              <div className="max-w-md rounded-3xl bg-slate-900/90 border border-white/15 p-6 text-center space-y-3">
                <FileText className="w-12 h-12 mx-auto text-cyan-400" />
                <h4 className="text-base font-black text-white">{item.fileName}</h4>
                <p className="text-xs text-slate-400">
                  {item.mimeType} · {formatBytes(item.fileSize)}
                </p>
                {item.aiMetadata?.ocrText && (
                  <div className="text-left max-h-40 overflow-y-auto p-3 rounded-xl bg-slate-950 text-xs text-slate-200 border border-white/10">
                    {item.aiMetadata.ocrText}
                  </div>
                )}
                <div className="flex flex-wrap justify-center gap-2 pt-2">
                  {playableUrl && (
                    <a
                      href={playableUrl}
                      download={item.fileName}
                      className="px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 font-extrabold text-xs inline-flex items-center gap-1.5"
                    >
                      <Download className="w-4 h-4" /> Download Document
                    </a>
                  )}
                  {item.driveWebViewLink && (
                    <a
                      href={item.driveWebViewLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs inline-flex items-center gap-1.5"
                    >
                      Open in Google Drive Viewer <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Metadata, Local SQLite Offline Toggle, AI Inspector & Sharing */}
        <div className="w-full lg:w-[370px] bg-slate-900 border-t lg:border-t-0 lg:border-l border-white/10 flex flex-col max-h-[45%] lg:max-h-full">
          {/* Quick Action Strip */}
          <div className="p-3 border-b border-white/10 space-y-2">
            <button
              onClick={() => void handleToggleLocalSqlite()}
              disabled={isCachingLocal}
              className={`w-full py-2.5 px-3 rounded-2xl text-xs font-extrabold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                item.isStoredLocally
                  ? 'bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/50 text-emerald-200'
                  : 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg'
              }`}
            >
              {isCachingLocal ? <Loader2 className="w-4 h-4 animate-spin" /> : <HardDrive className="w-4 h-4" />}
              {item.isStoredLocally
                ? '✅ Stored Locally in SQLite (Click to Remove Local Copy)'
                : '💾 Store This File Locally in SQLite (Offline Mode)'}
            </button>

            <div className="grid grid-cols-4 gap-1.5 text-[11px]">
              <button
                onClick={async () => {
                  const u = await patchMediaItemInSqlite(item.id, { isFavorite: !item.isFavorite });
                  if (u) onItemUpdated(u);
                }}
                className={`py-1.5 rounded-xl font-bold flex items-center justify-center gap-1 cursor-pointer ${
                  item.isFavorite ? 'bg-amber-500/25 text-amber-200 border border-amber-400/40' : 'bg-slate-950 text-slate-300 border border-white/10'
                }`}
              >
                <Star className="w-3.5 h-3.5" /> Fav
              </button>
              <button
                onClick={async () => {
                  const u = await patchMediaItemInSqlite(item.id, { isArchived: !item.isArchived });
                  if (u) onItemUpdated(u);
                }}
                className={`py-1.5 rounded-xl font-bold flex items-center justify-center gap-1 cursor-pointer ${
                  item.isArchived ? 'bg-indigo-500/25 text-indigo-200 border border-indigo-400/40' : 'bg-slate-950 text-slate-300 border border-white/10'
                }`}
              >
                <Archive className="w-3.5 h-3.5" /> Arch
              </button>
              {item.driveWebViewLink ? (
                <a
                  href={item.driveWebViewLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-1.5 rounded-xl font-bold flex items-center justify-center gap-1 bg-slate-950 text-emerald-300 border border-white/10"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Drive
                </a>
              ) : (
                <span className="py-1.5 rounded-xl text-center text-slate-500 bg-slate-950 border border-white/5">Local</span>
              )}
              <button
                onClick={async () => {
                  if (item.isDeleted) {
                    const u = await patchMediaItemInSqlite(item.id, { isDeleted: false, deletedAt: null });
                    if (u) onItemUpdated(u);
                  } else {
                    const u = await patchMediaItemInSqlite(item.id, { isDeleted: true, deletedAt: new Date().toISOString() });
                    if (u) {
                      onItemUpdated(u);
                      onItemDeleted(item.id);
                    }
                  }
                }}
                className="py-1.5 rounded-xl font-bold flex items-center justify-center gap-1 bg-amber-500/15 hover:bg-amber-500/30 text-amber-200 border border-amber-400/30 cursor-pointer"
              >
                {item.isDeleted ? <RotateCcw className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />}
                {item.isDeleted ? 'Restore' : 'Trash'}
              </button>
            </div>

            <button
              onClick={async () => {
                if (
                  !window.confirm(
                    `Permanently delete "${item.fileName}" from BOTH Local SQLite and Google Drive? This cannot be undone.`
                  )
                ) {
                  return;
                }
                const res = await deleteMediaFileEverywhere(item, googleAccessToken);
                onItemDeleted(item.id);
                onNotify(
                  res.driveMessage ? 'warning' : 'success',
                  'File Permanently Deleted',
                  res.deletedFromDrive
                    ? `"${item.fileName}" deleted from Local SQLite AND Google Drive.`
                    : res.driveMessage || `"${item.fileName}" deleted from Local SQLite.`
                );
              }}
              className="w-full py-1.5 px-3 rounded-xl bg-rose-500/15 hover:bg-rose-500/30 border border-rose-400/40 text-rose-200 text-[11px] font-extrabold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete Permanently (Local SQLite + Google Drive)
            </button>
          </div>

          {/* Inspector Sub-Tabs */}
          <div className="grid grid-cols-3 gap-1 p-2 bg-slate-950/60 border-b border-white/10 text-xs">
            {(['details', 'ai', 'share'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setInspectorTab(t)}
                className={`py-1.5 rounded-xl font-extrabold uppercase text-[10px] cursor-pointer ${
                  inspectorTab === t ? 'bg-cyan-500 text-slate-950' : 'text-slate-300 hover:bg-white/10'
                }`}
              >
                {t === 'details' ? 'Metadata' : t === 'ai' ? '✨ AI Insights' : '🔗 Share'}
              </button>
            ))}
          </div>

          {/* Inspector Body */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-3 text-xs">
            {inspectorTab === 'details' && (
              <>
                <div className="rounded-2xl bg-slate-950/80 border border-white/10 p-3 space-y-1.5 text-[11px]">
                  <div className="flex justify-between"><span className="text-slate-400">Size:</span><strong className="text-white">{formatBytes(item.fileSize)}</strong></div>
                  <div className="flex justify-between"><span className="text-slate-400">MIME:</span><span className="text-slate-200 truncate max-w-[180px]">{item.mimeType}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Owner:</span><span className="text-white">{item.ownerName}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Device:</span><span className="text-slate-200">{item.deviceSource}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Uploaded:</span><span className="text-slate-200">{(item.createdAt || '').slice(0, 10)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Modified:</span><span className="text-slate-200">{(item.updatedAt || '').slice(0, 10)}</span></div>
                </div>

                {/* Folder & Category */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-400">Folder</label>
                    <select
                      value={item.folderPath}
                      onChange={async (e) => {
                        const u = await patchMediaItemInSqlite(item.id, { folderPath: e.target.value });
                        if (u) onItemUpdated(u);
                      }}
                      className="w-full mt-1 px-2 py-1.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs"
                    >
                      <option value="/">/ (Root)</option>
                      {folders.map((f) => (
                        <option key={f.id} value={f.path}>{f.path}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-400">Category</label>
                    <select
                      value={item.category}
                      onChange={async (e) => {
                        const u = await patchMediaItemInSqlite(item.id, { category: e.target.value });
                        if (u) onItemUpdated(u);
                      }}
                      className="w-full mt-1 px-2 py-1.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs"
                    >
                      {['General', 'Family', 'Travel', 'Documents', 'Health', 'Finance', 'Kids & Learning', 'Music & Audio', 'AI Art'].map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Collections / Albums */}
                {collections.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-[10px] font-bold uppercase text-slate-400">Albums & Collections</div>
                    <div className="flex flex-wrap gap-1.5">
                      {collections.map((col) => {
                        const active = (item.collectionIds || []).includes(col.id);
                        return (
                          <button
                            key={col.id}
                            onClick={async () => {
                              const next = active
                                ? (item.collectionIds || []).filter((id) => id !== col.id)
                                : [...(item.collectionIds || []), col.id];
                              const u = await patchMediaItemInSqlite(item.id, { collectionIds: next });
                              if (u) onItemUpdated(u);
                            }}
                            className={`px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer ${
                              active ? 'bg-purple-500/30 text-purple-100 border border-purple-400/50' : 'bg-slate-950 text-slate-400 border border-white/10'
                            }`}
                          >
                            {active ? '✓ ' : '+ '}
                            {col.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Tags */}
                <div className="space-y-1.5">
                  <div className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1">
                    <Tag className="w-3 h-3" /> Tags
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(item.tags || []).map((t) => (
                      <span
                        key={t}
                        onClick={() => void handleRemoveTag(t)}
                        title="Click to remove tag"
                        className="px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-400/30 text-cyan-200 text-[10px] font-bold cursor-pointer hover:bg-rose-500/25"
                      >
                        #{t} ×
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-1.5">
                    <input
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && void handleAddTag()}
                      placeholder="Add tag..."
                      className="flex-1 px-2.5 py-1.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs"
                    />
                    <button onClick={() => void handleAddTag()} className="px-2.5 py-1.5 rounded-xl bg-cyan-500 text-slate-950 font-bold cursor-pointer">
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Location & Custom Metadata */}
                <div className="space-y-1.5">
                  <div className="text-[10px] font-bold uppercase text-slate-400">Location (Optional)</div>
                  <div className="flex gap-1.5">
                    <input
                      value={locationDraft}
                      onChange={(e) => setLocationDraft(e.target.value)}
                      placeholder="e.g. London, UK"
                      className="flex-1 px-2.5 py-1.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs"
                    />
                    <button
                      onClick={async () => {
                        const u = await patchMediaItemInSqlite(item.id, { location: locationDraft.trim() });
                        if (u) onItemUpdated(u);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold cursor-pointer"
                    >
                      Save
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="text-[10px] font-bold uppercase text-slate-400">Custom Metadata</div>
                  {Object.entries(item.customMetadata || {}).map(([k, v]) => (
                    <div key={k} className="flex justify-between px-2.5 py-1 rounded-lg bg-slate-950 border border-white/5 text-[11px]">
                      <span className="text-slate-400">{k}</span>
                      <span className="text-white font-semibold">{v}</span>
                    </div>
                  ))}
                  <div className="grid grid-cols-5 gap-1">
                    <input value={customKey} onChange={(e) => setCustomKey(e.target.value)} placeholder="Key" className="col-span-2 px-2 py-1 rounded-lg bg-slate-950 border border-white/10 text-white text-[11px]" />
                    <input value={customVal} onChange={(e) => setCustomVal(e.target.value)} placeholder="Value" className="col-span-2 px-2 py-1 rounded-lg bg-slate-950 border border-white/10 text-white text-[11px]" />
                    <button onClick={() => void handleAddCustomMeta()} className="rounded-lg bg-white/15 hover:bg-white/25 text-white font-bold cursor-pointer">+</button>
                  </div>
                </div>
              </>
            )}

            {inspectorTab === 'ai' && (
              <div className="space-y-3">
                <button
                  onClick={() => void handleRunAiAnalysis()}
                  disabled={isAnalyzingAi}
                  className="w-full py-2.5 rounded-2xl bg-gradient-to-r from-fuchsia-500 to-cyan-500 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg"
                >
                  {isAnalyzingAi ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {isAnalyzingAi ? 'Running AI Vision & OCR...' : '✨ Run AI Auto-Tag, Caption, OCR & Face/Object Scan'}
                </button>

                <div className="rounded-2xl bg-slate-950/80 border border-white/10 p-3 space-y-2">
                  <div className="text-[10px] font-bold uppercase text-cyan-300">AI Caption</div>
                  <p className="text-slate-200 leading-relaxed">{item.aiMetadata?.caption || 'Not analyzed yet — click above to generate AI caption & tags.'}</p>

                  {item.aiMetadata?.ocrText && (
                    <div>
                      <div className="text-[10px] font-bold uppercase text-amber-300 mt-2">OCR Extracted Text</div>
                      <p className="text-slate-300 text-[11px] bg-slate-900 p-2 rounded-xl mt-1 max-h-28 overflow-y-auto">{item.aiMetadata.ocrText}</p>
                    </div>
                  )}

                  {(item.aiMetadata?.objects || []).length > 0 && (
                    <div>
                      <div className="text-[10px] font-bold uppercase text-emerald-300 mt-2">Detected Objects</div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {item.aiMetadata.objects!.map((o) => (
                          <span key={o} className="px-2 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-200 text-[10px] font-bold">{o}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {(item.aiMetadata?.faces || []).length > 0 && (
                    <div>
                      <div className="text-[10px] font-bold uppercase text-pink-300 mt-2">Face / People Detection</div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {item.aiMetadata.faces!.map((f) => (
                          <span key={f} className="px-2 py-0.5 rounded-lg bg-pink-500/15 text-pink-200 text-[10px] font-bold">{f}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="pt-2 flex items-center justify-between border-t border-white/10">
                    <span className="text-[10px] font-bold uppercase text-slate-400">Moderation</span>
                    <button
                      onClick={async () => {
                        const nextStatus = item.aiMetadata?.moderationStatus === 'flagged' ? 'approved' : 'flagged';
                        const u = await patchMediaItemInSqlite(item.id, {
                          aiMetadata: { ...item.aiMetadata, moderationStatus: nextStatus },
                        });
                        if (u) onItemUpdated(u);
                      }}
                      className={`px-2.5 py-1 rounded-xl text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer ${
                        item.aiMetadata?.moderationStatus === 'flagged'
                          ? 'bg-rose-500/25 text-rose-200 border border-rose-400/40'
                          : 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/40'
                      }`}
                    >
                      {item.aiMetadata?.moderationStatus === 'flagged' ? <ShieldAlert className="w-3 h-3" /> : <ShieldCheck className="w-3 h-3" />}
                      {item.aiMetadata?.moderationStatus === 'flagged' ? 'Flagged (Click to Approve)' : 'Approved'}
                    </button>
                  </div>
                </div>

                {/* Similar Media Recommendations */}
                {similarItems.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-[10px] font-bold uppercase text-purple-300">Similar Media Recommendations</div>
                    <div className="grid grid-cols-2 gap-2">
                      {similarItems.map((sim) => (
                        <button
                          key={sim.id}
                          onClick={() => onSelectItem(sim)}
                          className="p-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-white/10 text-left cursor-pointer"
                        >
                          <div className="text-[11px] font-bold text-white truncate">{sim.fileName}</div>
                          <div className="text-[9px] text-slate-400">{sim.mediaType} · {sim.category}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {inspectorTab === 'share' && (
              <div className="space-y-3">
                <div className="rounded-2xl bg-slate-950/80 border border-white/10 p-3 space-y-2.5">
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="font-bold text-white">Public Link Access</span>
                    <input type="checkbox" checked={sharePublic} onChange={(e) => setSharePublic(e.target.checked)} className="w-4 h-4 accent-cyan-500" />
                  </label>
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="font-bold text-white">Allow Download</span>
                    <input type="checkbox" checked={allowDownload} onChange={(e) => setAllowDownload(e.target.checked)} className="w-4 h-4 accent-cyan-500" />
                  </label>
                  <div>
                    <div className="text-[10px] font-bold uppercase text-slate-400 mb-1">Permission Level</div>
                    <select
                      value={shareRole}
                      onChange={(e) => setShareRole(e.target.value as any)}
                      className="w-full px-2.5 py-1.5 rounded-xl bg-slate-900 border border-white/10 text-white text-xs"
                    >
                      <option value="view">View Only (Reader)</option>
                      <option value="comment">Can Comment</option>
                      <option value="edit">Can Edit (Writer)</option>
                    </select>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase text-slate-400 mb-1">Expiring Link Date (Optional)</div>
                    <input
                      type="date"
                      value={shareExpires}
                      onChange={(e) => setShareExpires(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-xl bg-slate-900 border border-white/10 text-white text-xs"
                    />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase text-slate-400 mb-1">Share with Family / Team Email</div>
                    <div className="flex gap-1.5">
                      <input
                        value={shareEmailInput}
                        onChange={(e) => setShareEmailInput(e.target.value)}
                        placeholder="member@gmail.com"
                        className="flex-1 px-2.5 py-1.5 rounded-xl bg-slate-900 border border-white/10 text-white text-xs"
                      />
                      <button
                        onClick={() => {
                          if (!shareEmailInput.includes('@')) return;
                          setSharedEmails((prev) => Array.from(new Set([...prev, shareEmailInput.trim()])));
                          setShareEmailInput('');
                        }}
                        className="px-3 py-1.5 rounded-xl bg-cyan-500 text-slate-950 font-bold cursor-pointer"
                      >
                        Add
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {sharedEmails.map((em) => (
                        <span
                          key={em}
                          onClick={() => setSharedEmails((prev) => prev.filter((x) => x !== em))}
                          className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-200 text-[10px] font-bold cursor-pointer"
                        >
                          {em} ×
                        </span>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => void handleSaveShare()}
                    disabled={isSavingShare}
                    className="w-full py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {isSavingShare ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Share2 className="w-3.5 h-3.5" />}
                    Apply Permissions on Google Drive
                  </button>

                  {(item.shareConfig?.shareLink || item.driveWebViewLink) && (
                    <button
                      onClick={handleCopyLink}
                      className="w-full py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedLink ? 'Link Copied!' : 'Copy Shareable Link'}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
