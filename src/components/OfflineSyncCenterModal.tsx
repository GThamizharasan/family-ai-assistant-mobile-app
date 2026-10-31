import React, { useState, useEffect } from 'react';
import {
  Database,
  HardDrive,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  X,
  BookOpen,
  Music,
  Mic,
  Volume2,
  Languages,
  Folder,
  FileText,
  Sparkles,
  WifiOff,
  Wifi,
  ArrowRight,
  ShieldCheck,
  Check,
  ScanLine,
} from 'lucide-react';
import {
  fetchSqlite3GbQuota,
  syncAllFeaturesToSqliteStore,
  isOfflineModeSimulated,
  setOfflineModeSimulated,
  Sqlite3GbQuotaDetails,
  MAX_SQLITE_STORAGE_MB,
} from '../services/offlineSyncService';
import { useApp } from '../context/AppContext';
import { TabKey } from './BottomNav';

interface OfflineSyncCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab?: (tab: TabKey) => void;
}

export const OfflineSyncCenterModal: React.FC<OfflineSyncCenterModalProps> = ({
  isOpen,
  onClose,
  onNavigateTab,
}) => {
  const { user, googleAccessToken, isOnline } = useApp();
  const [quota, setQuota] = useState<Sqlite3GbQuotaDetails | null>(null);
  const [isLoadingQuota, setIsLoadingQuota] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncStatusMsg, setSyncStatusMsg] = useState('');
  const [syncResult, setSyncResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isSimulatedOffline, setIsSimulatedOffline] = useState(() => isOfflineModeSimulated());
  const [quotaRefreshNotice, setQuotaRefreshNotice] = useState<string | null>(null);

  const loadQuota = async () => {
    setIsLoadingQuota(true);
    try {
      const q = await fetchSqlite3GbQuota();
      if (q) {
        setQuota(q);
        const totalItems =
          (q.breakdown?.driveFiles?.count || 0) +
          (q.breakdown?.books?.count || 0) +
          (q.breakdown?.music?.count || 0) +
          (q.breakdown?.memos?.count || 0) +
          (q.breakdown?.tts?.count || 0) +
          (q.breakdown?.translations?.count || 0) +
          (q.breakdown?.scans?.count || 0);
        setQuotaRefreshNotice(`✓ Refreshed: ${q.totalUsedMb.toFixed(1)} MB used (${totalItems} cached items)`);
      } else {
        setQuotaRefreshNotice('Could not load statistics from SQLite.');
      }
      setTimeout(() => setQuotaRefreshNotice(null), 4000);
    } catch {
      setQuotaRefreshNotice('Could not load statistics from SQLite.');
      setTimeout(() => setQuotaRefreshNotice(null), 4000);
    } finally {
      setIsLoadingQuota(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadQuota();
      setIsSimulatedOffline(isOfflineModeSimulated());
    }
  }, [isOpen]);

  // Listen to external sync updates
  useEffect(() => {
    const handleSyncEvent = (e: any) => {
      if (e.detail?.quota) {
        setQuota(e.detail.quota);
      }
    };
    window.addEventListener('aura_sqlite_synced', handleSyncEvent);
    return () => window.removeEventListener('aura_sqlite_synced', handleSyncEvent);
  }, []);

  if (!isOpen) return null;

  const handleToggleOfflineMode = () => {
    const next = !isSimulatedOffline;
    setIsSimulatedOffline(next);
    setOfflineModeSimulated(next);
  };

  const handleSyncAll = async () => {
    setIsSyncing(true);
    setSyncResult(null);
    setSyncProgress(5);
    setSyncStatusMsg('Preparing local databases and Drive cache...');

    try {
      const result = await syncAllFeaturesToSqliteStore({
        userEmail: user?.email || 'chinna.tamil2000@gmail.com',
        googleAccessToken,
        onProgress: (msg, pct) => {
          setSyncStatusMsg(msg);
          setSyncProgress(pct);
        },
      });

      if (result.quota) {
        setQuota(result.quota);
      } else {
        await loadQuota();
      }

      setSyncResult({
        success: result.success,
        message: result.message,
      });
    } catch (err: any) {
      setSyncResult({
        success: false,
        message: err.message || 'Failed to complete local sync.',
      });
    } finally {
      setIsSyncing(false);
      setSyncProgress(100);
    }
  };

  const totalUsedMb = quota ? quota.totalUsedMb : 0;
  const quotaMb = MAX_SQLITE_STORAGE_MB; // 3072 MB (3GB)
  const percentUsed = quota ? quota.percentUsed : ((totalUsedMb / quotaMb) * 100);
  const freeMb = quota ? quota.freeMb : (quotaMb - totalUsedMb);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl relative text-white animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">3GB SQLite Offline Store</h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                  Native Persistence
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Persistent local storage for all Google Drive files, books, music & memos
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">

          {/* 3GB Storage Quota Meter Card */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/90 relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-indigo-400" />
                <span className="text-xs font-bold text-slate-200">Local SQLite Storage Pool</span>
              </div>
              <span className="text-[11px] font-mono text-amber-400 font-bold">
                Max 3.0 GB Quota
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-3.5 bg-slate-850 rounded-full overflow-hidden p-0.5 border border-slate-800 flex">
              <div
                className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-emerald-500 via-indigo-500 to-amber-500"
                style={{ width: `${Math.min(100, Math.max(1, percentUsed))}%` }}
              />
            </div>

            {/* Numbers Breakdown */}
            <div className="mt-2.5 flex items-center justify-between text-[11px] font-mono">
              <span className="text-slate-300">
                Used: <strong className="text-white">{totalUsedMb.toFixed(1)} MB</strong> ({percentUsed.toFixed(1)}%)
              </span>
              <span className="text-emerald-400">
                Free: <strong>{freeMb.toFixed(1)} MB</strong> ({((freeMb / quotaMb) * 100).toFixed(0)}%)
              </span>
            </div>

            {/* Quota notices */}
            {percentUsed > 85 && (
              <div className="mt-2.5 flex items-center gap-2 p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-[11px] text-amber-300">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Approaching 3GB storage limit. Older cache will automatically balance.</span>
              </div>
            )}
          </div>

          {/* Offline Simulation Switch */}
          <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl ${isSimulatedOffline ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                {isSimulatedOffline ? <WifiOff className="w-4 h-4" /> : <Wifi className="w-4 h-4" />}
              </div>
              <div>
                <span className="text-xs font-bold text-slate-200 block">
                  {isSimulatedOffline ? 'Simulated Offline Mode Active' : 'Realtime Connectivity Online'}
                </span>
                <span className="text-[10px] text-slate-400">
                  {isSimulatedOffline
                    ? 'Airplane test active. All navigation, books, and music read purely from SQLite.'
                    : 'Network requests allowed. Toggle to test zero-connection playback.'}
                </span>
              </div>
            </div>
            <button
              onClick={handleToggleOfflineMode}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
                isSimulatedOffline
                  ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-sm'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              }`}
            >
              {isSimulatedOffline ? 'Disable Offline' : 'Test Offline'}
            </button>
          </div>

          {/* Per-Feature SQLite Breakdown Grid */}
          <div>
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                Feature SQLite Allocation
              </span>
              <button
                onClick={loadQuota}
                disabled={isLoadingQuota}
                className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${isLoadingQuota ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>

            {quotaRefreshNotice && (
              <div className="mb-2.5 p-2 rounded-xl bg-indigo-950/60 border border-indigo-500/40 text-indigo-300 text-[11px] font-mono flex items-center gap-1.5 animate-fadeIn">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span>{quotaRefreshNotice}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 text-xs">
              {/* Apple Books */}
              <div
                onClick={() => onNavigateTab?.('ibooks')}
                className="p-3 rounded-2xl bg-slate-950/60 hover:bg-slate-950 border border-slate-800/90 cursor-pointer transition-colors group"
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5 text-amber-400">
                    <BookOpen className="w-3.5 h-3.5" />
                    <span className="font-bold">Apple Books</span>
                  </div>
                  <ArrowRight className="w-3 h-3 text-slate-500 group-hover:text-amber-400 transition-colors" />
                </div>
                <div className="text-[10px] text-slate-400">
                  {quota?.breakdown.books.count ?? 0} Books cached
                </div>
                <div className="text-[11px] font-mono text-slate-200 mt-1">
                  {(quota?.breakdown.books.mb ?? 0).toFixed(1)} MB
                </div>
              </div>

              {/* Apple Music */}
              <div
                onClick={() => onNavigateTab?.('music')}
                className="p-3 rounded-2xl bg-slate-950/60 hover:bg-slate-950 border border-slate-800/90 cursor-pointer transition-colors group"
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5 text-indigo-400">
                    <Music className="w-3.5 h-3.5" />
                    <span className="font-bold">Apple Music</span>
                  </div>
                  <ArrowRight className="w-3 h-3 text-slate-500 group-hover:text-indigo-400 transition-colors" />
                </div>
                <div className="text-[10px] text-slate-400">
                  {quota?.breakdown.music.count ?? 0} Tracks cached
                </div>
                <div className="text-[11px] font-mono text-slate-200 mt-1">
                  {(quota?.breakdown.music.mb ?? 0).toFixed(1)} MB
                </div>
              </div>

              {/* Voice Memos */}
              <div
                onClick={() => onNavigateTab?.('memos')}
                className="p-3 rounded-2xl bg-slate-950/60 hover:bg-slate-950 border border-slate-800/90 cursor-pointer transition-colors group"
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5 text-rose-400">
                    <Mic className="w-3.5 h-3.5" />
                    <span className="font-bold">Voice Memos</span>
                  </div>
                  <ArrowRight className="w-3 h-3 text-slate-500 group-hover:text-rose-400 transition-colors" />
                </div>
                <div className="text-[10px] text-slate-400">
                  {quota?.breakdown.memos.count ?? 0} Recordings
                </div>
                <div className="text-[11px] font-mono text-slate-200 mt-1">
                  {(quota?.breakdown.memos.mb ?? 0).toFixed(1)} MB
                </div>
              </div>

              {/* Text-to-Speech Memos */}
              <div
                onClick={() => onNavigateTab?.('tts')}
                className="p-3 rounded-2xl bg-slate-950/60 hover:bg-slate-950 border border-slate-800/90 cursor-pointer transition-colors group"
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5 text-purple-400">
                    <Volume2 className="w-3.5 h-3.5" />
                    <span className="font-bold">TTS Audio</span>
                  </div>
                  <ArrowRight className="w-3 h-3 text-slate-500 group-hover:text-purple-400 transition-colors" />
                </div>
                <div className="text-[10px] text-slate-400">
                  {quota?.breakdown.tts.count ?? 0} Audio files
                </div>
                <div className="text-[11px] font-mono text-slate-200 mt-1">
                  {(quota?.breakdown.tts.mb ?? 0).toFixed(1)} MB
                </div>
              </div>

              {/* Translator */}
              <div
                onClick={() => onNavigateTab?.('translate')}
                className="p-3 rounded-2xl bg-slate-950/60 hover:bg-slate-950 border border-slate-800/90 cursor-pointer transition-colors group"
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5 text-sky-400">
                    <Languages className="w-3.5 h-3.5" />
                    <span className="font-bold">Translator</span>
                  </div>
                  <ArrowRight className="w-3 h-3 text-slate-500 group-hover:text-sky-400 transition-colors" />
                </div>
                <div className="text-[10px] text-slate-400">
                  {quota?.breakdown.translations.count ?? 0} Phrases stored
                </div>
                <div className="text-[11px] font-mono text-slate-200 mt-1">
                  {(quota?.breakdown.translations.mb ?? 0).toFixed(1)} MB
                </div>
              </div>

              {/* Google Drive Local Cache */}
              <div
                onClick={() => onNavigateTab?.('google')}
                className="p-3 rounded-2xl bg-slate-950/60 hover:bg-slate-950 border border-slate-800/90 cursor-pointer transition-colors group"
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5 text-emerald-400">
                    <Folder className="w-3.5 h-3.5" />
                    <span className="font-bold">Google Drive</span>
                  </div>
                  <ArrowRight className="w-3 h-3 text-slate-500 group-hover:text-emerald-400 transition-colors" />
                </div>
                <div className="text-[10px] text-slate-400">
                  {quota?.breakdown.driveFiles.count ?? 0} Local sync files
                </div>
                <div className="text-[11px] font-mono text-slate-200 mt-1">
                  {(quota?.breakdown.driveFiles.mb ?? 0).toFixed(1)} MB
                </div>
              </div>

              {/* Adobe Document Scanner */}
              <div
                onClick={() => onNavigateTab?.('scanner')}
                className="p-3 rounded-2xl bg-slate-950/60 hover:bg-slate-950 border border-slate-800/90 cursor-pointer transition-colors group"
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5 text-rose-500">
                    <ScanLine className="w-3.5 h-3.5" />
                    <span className="font-bold">Adobe Scans</span>
                  </div>
                  <ArrowRight className="w-3 h-3 text-slate-500 group-hover:text-rose-500 transition-colors" />
                </div>
                <div className="text-[10px] text-slate-400">
                  {quota?.breakdown.scans?.count ?? 0} Scanned PDFs
                </div>
                <div className="text-[11px] font-mono text-slate-200 mt-1">
                  {(quota?.breakdown.scans?.mb ?? 0).toFixed(1)} MB
                </div>
              </div>
            </div>
          </div>

          {/* Sync Progress or Results */}
          {isSyncing && (
            <div className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 space-y-2">
              <div className="flex items-center justify-between text-xs text-indigo-300">
                <span className="font-semibold flex items-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                  Synchronizing All Features to SQLite...
                </span>
                <span className="font-mono">{syncProgress}%</span>
              </div>
              <div className="w-full h-2 bg-slate-850 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 transition-all duration-300"
                  style={{ width: `${syncProgress}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-400 truncate">{syncStatusMsg}</p>
            </div>
          )}

          {syncResult && (
            <div
              className={`p-3.5 rounded-2xl border flex items-start gap-2.5 text-xs ${
                syncResult.success
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                  : 'bg-rose-950/40 border-rose-500/40 text-rose-200'
              }`}
            >
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold">{syncResult.message}</p>
                <span className="text-[10px] opacity-80 mt-0.5 block">
                  All cached assets are now accessible without any internet connection.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-4 mt-3 border-t border-slate-800/80 flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer transition-colors"
          >
            Close
          </button>

          <button
            onClick={handleSyncAll}
            disabled={isSyncing}
            className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 transition-all active:scale-[0.98]"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync All to 3GB Local Store'}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
