import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Video,
  Music,
  Image as ImageIcon,
  FileText,
  Cloud,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  Trash2,
  Search,
  Filter,
  Play,
  Pause,
  RefreshCw,
  Plus,
  Share2,
  Copy,
  Check,
  Maximize2,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { AiStudioCreation, AiCreationType } from '../../types/aiCreation';
import {
  fetchAiCreationsHistory,
  deleteAiCreation,
  downloadCreationFile,
  uploadAiCreationToGoogleDrive,
} from '../../services/aiDriveSync';
import { saveMusicTrack } from '../../services/musicLibraryService';
import { musicAudioEngine } from '../../services/musicAudioEngine';

interface AiCreationsHistoryDashboardProps {
  accessToken?: string | null;
  userEmail?: string;
  onNavigateToMusicTab?: () => void;
  onOpenSubTab?: (subTab: string) => void;
}

export const AiCreationsHistoryDashboard: React.FC<AiCreationsHistoryDashboardProps> = ({
  accessToken,
  userEmail = 'chinna.tamil2000@gmail.com',
  onNavigateToMusicTab,
  onOpenSubTab,
}) => {
  const [creations, setCreations] = useState<AiStudioCreation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [activeMediaModal, setActiveMediaModal] = useState<AiStudioCreation | null>(null);

  useEffect(() => {
    loadHistory();
  }, [userEmail]);

  const loadHistory = async () => {
    setIsLoading(true);
    try {
      const data = await fetchAiCreationsHistory(userEmail);
      setCreations(data);
    } catch (e) {
      console.warn('loadHistory error:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (creation: AiStudioCreation) => {
    if (!confirm(`Delete "${creation.title}" from AI Studio history?`)) return;
    setCreations((prev) => prev.filter((c) => c.id !== creation.id));
    await deleteAiCreation(creation.id, userEmail);
  };

  const handleManualSyncDrive = async (creation: AiStudioCreation) => {
    if (!accessToken) {
      setNotice('Please ensure Google Single Sign-On is connected to upload to Drive.');
      setTimeout(() => setNotice(null), 4000);
      return;
    }

    setSyncingId(creation.id);
    try {
      const meta = await uploadAiCreationToGoogleDrive(creation, accessToken, userEmail);
      if (meta) {
        setCreations((prev) =>
          prev.map((c) =>
            c.id === creation.id
              ? {
                  ...c,
                  driveFileId: meta.driveFileId,
                  driveWebViewLink: meta.driveWebViewLink,
                  driveSyncStatus: 'synced',
                }
              : c
          )
        );
        setNotice(`✓ "${creation.title}" saved to Family Circle Drive!`);
        setTimeout(() => setNotice(null), 4000);
      }
    } catch (err: any) {
      setNotice(`Drive upload error: ${err.message}`);
      setTimeout(() => setNotice(null), 4000);
    } finally {
      setSyncingId(null);
    }
  };

  const handleCopyPrompt = (creation: AiStudioCreation) => {
    navigator.clipboard.writeText(creation.prompt);
    setCopiedId(creation.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handlePlayMusic = (creation: AiStudioCreation) => {
    if (playingAudioId === creation.id) {
      musicAudioEngine.pause();
      setPlayingAudioId(null);
    } else {
      musicAudioEngine.playTrack({
        id: creation.id,
        title: creation.title,
        artist: 'AI Studio Lyria',
        genre: 'AI Studio Lyria',
        audioUrl: creation.mediaUrl || '',
        artworkUrl: creation.thumbnailUrl,
        durationSeconds: 180,
        isFavorite: true,
        playCount: 1,
        createdAt: creation.createdAt,
        updatedAt: creation.createdAt,
        driveFolderPath: creation.driveFolderPath,
      });
      setPlayingAudioId(creation.id);
    }
  };

  const handleAddToMusicLibrary = async (creation: AiStudioCreation) => {
    try {
      await saveMusicTrack(
        {
          title: creation.title,
          artist: 'AI Studio Lyria',
          genre: 'AI Studio Lyria',
          audioUrl: creation.mediaUrl || '',
          artworkUrl: creation.thumbnailUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80',
          lyrics: creation.lyrics || `Prompt: ${creation.prompt}`,
          durationSeconds: 180,
          driveFolderPath: 'Family Circle / Musical Library / AI Studio Lyria',
        },
        accessToken,
        userEmail
      );
      setNotice(`🎵 "${creation.title}" added to Musical Library & Drive!`);
      setTimeout(() => setNotice(null), 4000);
      if (onNavigateToMusicTab) {
        onNavigateToMusicTab();
      }
    } catch (err: any) {
      alert(`Could not add to library: ${err.message}`);
    }
  };

  // Filtered list
  const filtered = creations.filter((c) => {
    const matchesType = filterType === 'all' || c.type === filterType;
    const matchesSearch =
      !searchQuery.trim() ||
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.prompt.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.modelUsed.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  const videoCount = creations.filter((c) => c.type === 'video').length;
  const musicCount = creations.filter((c) => c.type === 'music').length;
  const imageCount = creations.filter((c) => c.type === 'image').length;
  const transcriptCount = creations.filter((c) => c.type === 'transcript').length;

  return (
    <div className="space-y-5">
      {/* Overview Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 font-medium uppercase">Veo 3 Videos</span>
            <div className="text-lg font-bold text-white">{videoCount}</div>
          </div>
          <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
            <Video className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 font-medium uppercase">Lyria Songs</span>
            <div className="text-lg font-bold text-white">{musicCount}</div>
          </div>
          <div className="p-2 rounded-xl bg-pink-500/10 text-pink-400">
            <Music className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 font-medium uppercase">Banana Images</span>
            <div className="text-lg font-bold text-white">{imageCount}</div>
          </div>
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
            <ImageIcon className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 font-medium uppercase">Drive Synced</span>
            <div className="text-lg font-bold text-emerald-300">
              {creations.filter((c) => c.driveSyncStatus === 'synced').length}
            </div>
          </div>
          <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
            <Cloud className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Notice Banner */}
      {notice && (
        <div className="p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between gap-2 animate-in fade-in">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{notice}</span>
          </span>
          <button onClick={() => setNotice(null)} className="text-slate-400 hover:text-white">
            ✕
          </button>
        </div>
      )}

      {/* Filter Tabs & Search */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          {/* Type Filter Buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {[
              { id: 'all', label: `All (${creations.length})` },
              { id: 'image', label: `Images (${imageCount})`, icon: ImageIcon },
              { id: 'video', label: `Videos (${videoCount})`, icon: Video },
              { id: 'music', label: `Music (${musicCount})`, icon: Music },
              { id: 'transcript', label: `Transcripts (${transcriptCount})`, icon: FileText },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilterType(tab.id)}
                className={`text-xs px-3 py-1.5 rounded-xl font-semibold whitespace-nowrap transition-all ${
                  filterType === tab.id
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            onClick={loadHistory}
            disabled={isLoading}
            className="self-end sm:self-auto p-2 rounded-xl bg-slate-850 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 text-xs flex items-center gap-1"
            title="Refresh creations"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-indigo-400' : ''}`} />
            <span className="text-[11px] hidden sm:inline">Refresh</span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search creations by title, prompt, or model name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Creations Feed Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {filtered.map((item) => (
          <div
            key={item.id}
            className="p-4 rounded-3xl bg-slate-900/90 border border-slate-800 hover:border-slate-700/80 transition-all flex flex-col justify-between space-y-3.5 shadow-xl group"
          >
            {/* Top Badge & Model */}
            <div className="flex items-center justify-between gap-2">
              <span
                className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-0.5 rounded-full border ${
                  item.type === 'video'
                    ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                    : item.type === 'music'
                    ? 'bg-pink-500/15 text-pink-300 border-pink-500/30'
                    : item.type === 'image'
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                    : 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                }`}
              >
                {item.type === 'video' && <Video className="w-3 h-3" />}
                {item.type === 'music' && <Music className="w-3 h-3" />}
                {item.type === 'image' && <ImageIcon className="w-3 h-3" />}
                {item.type === 'transcript' && <FileText className="w-3 h-3" />}
                <span className="capitalize">{item.type}</span>
              </span>

              <span className="text-[10px] font-mono text-slate-500">{item.modelUsed}</span>
            </div>

            {/* Media Preview Box */}
            <div className="relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-800/80">
              {item.type === 'image' && (
                <div
                  onClick={() => setActiveMediaModal(item)}
                  className="cursor-pointer group relative aspect-video sm:aspect-square overflow-hidden"
                >
                  <img
                    src={item.mediaUrl}
                    alt={item.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-slate-950/20 group-hover:bg-slate-950/40 flex items-center justify-center transition-colors">
                    <Maximize2 className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
                  </div>
                </div>
              )}

              {item.type === 'video' && (
                <div className="aspect-video relative bg-slate-950 flex items-center justify-center">
                  <video
                    src={item.mediaUrl}
                    controls
                    poster={item.thumbnailUrl}
                    className="w-full h-full object-contain"
                  />
                </div>
              )}

              {item.type === 'music' && (
                <div className="p-4 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/60 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="relative w-14 h-14 rounded-xl overflow-hidden shrink-0 border border-slate-700 shadow-md">
                      <img
                        src={item.thumbnailUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80'}
                        alt={item.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs font-bold text-white truncate">{item.title}</h4>
                      <p className="text-[11px] text-slate-400">Lyria AI Audio Stream</p>
                    </div>
                  </div>

                  {/* Play & Add to Library */}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => handlePlayMusic(item)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/30 transition-all active:scale-95"
                    >
                      {playingAudioId === item.id ? (
                        <>
                          <Pause className="w-3.5 h-3.5 fill-white" />
                          <span>Pause</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5 fill-white translate-x-0.5" />
                          <span>Listen</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => handleAddToMusicLibrary(item)}
                      className="flex items-center gap-1 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors"
                      title="Add to Sovereign Musical Library"
                    >
                      <Plus className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Add to Library</span>
                    </button>
                  </div>
                </div>
              )}

              {item.type === 'transcript' && (
                <div className="p-3.5 max-h-36 overflow-y-auto font-mono text-[11px] text-slate-300 whitespace-pre-wrap leading-relaxed">
                  {item.mediaUrl}
                </div>
              )}
            </div>

            {/* Title & Prompt Details */}
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-white tracking-tight line-clamp-1">{item.title}</h4>
              <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed italic">
                "{item.prompt}"
              </p>
            </div>

            {/* Google Drive Path Status Badge */}
            <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-1.5 text-slate-300 truncate max-w-[220px]">
                <Cloud className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="truncate font-mono text-[10px]">
                  {item.driveFolderPath || 'Family Circle / AI Studio Creations'}
                </span>
              </div>

              {item.driveWebViewLink ? (
                <a
                  href={item.driveWebViewLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-400 hover:text-emerald-300 font-medium text-[10px] flex items-center gap-0.5 shrink-0"
                >
                  <span>Drive</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              ) : (
                <button
                  onClick={() => handleManualSyncDrive(item)}
                  disabled={syncingId === item.id}
                  className="text-indigo-400 hover:text-indigo-300 text-[10px] font-semibold shrink-0"
                >
                  {syncingId === item.id ? 'Syncing...' : 'Sync to Drive'}
                </button>
              )}
            </div>

            {/* Bottom Actions Bar */}
            <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-xs">
              <span className="text-[10px] text-slate-500 font-mono">
                {new Date(item.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleCopyPrompt(item)}
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                  title="Copy Prompt"
                >
                  {copiedId === item.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>

                <button
                  onClick={() => downloadCreationFile(item)}
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                  title="Download File"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => handleDelete(item)}
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-rose-400 transition-colors"
                  title="Delete Creation"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="p-12 text-center rounded-3xl bg-slate-900/50 border border-slate-800 text-slate-400 space-y-2">
          <Sparkles className="w-8 h-8 mx-auto text-slate-600" />
          <p className="text-xs">No creations found under this filter.</p>
        </div>
      )}

      {/* Lightbox Image Preview Modal */}
      {activeMediaModal && (
        <div
          onClick={() => setActiveMediaModal(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md cursor-pointer animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-w-3xl w-full max-h-[85vh] bg-slate-900 rounded-3xl overflow-hidden border border-slate-700 shadow-2xl p-4 space-y-3 cursor-default"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs">
              <span className="font-bold text-white">{activeMediaModal.title}</span>
              <button
                onClick={() => setActiveMediaModal(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                ✕
              </button>
            </div>
            <img
              src={activeMediaModal.mediaUrl}
              alt={activeMediaModal.title}
              className="w-full max-h-[60vh] object-contain rounded-xl bg-black"
            />
            <p className="text-xs text-slate-300 italic text-center">"{activeMediaModal.prompt}"</p>
          </div>
        </div>
      )}
    </div>
  );
};
