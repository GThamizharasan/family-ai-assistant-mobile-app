import React, { useState, useEffect } from 'react';
import {
  X,
  GitBranch,
  GitPullRequest,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  Lock,
  Terminal,
  FolderGit2,
} from 'lucide-react';

interface GitHubSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface GitStatusData {
  hasGit: boolean;
  remotes: string;
  branch: string;
  status: string;
  lastCommit: string;
}

export const GitHubSyncModal: React.FC<GitHubSyncModalProps> = ({ isOpen, onClose }) => {
  const [repoUrl, setRepoUrl] = useState(
    () => localStorage.getItem('aura_github_repo_url') || 'https://github.com/GThamizharasan/family-ai-assistant-mobile-app.git'
  );
  const [branch, setBranch] = useState(() => localStorage.getItem('aura_github_branch') || 'main');
  const [token, setToken] = useState(() => localStorage.getItem('aura_github_token') || '');
  const [isSyncing, setIsSyncing] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [gitStatus, setGitStatus] = useState<GitStatusData | null>(null);
  const [syncOutput, setSyncOutput] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchGitStatus = async () => {
    setStatusLoading(true);
    try {
      const res = await fetch('/api/git/status');
      const data = await res.json();
      if (data.success) {
        setGitStatus(data);
      }
    } catch (err: any) {
      console.warn('Could not fetch git status', err);
    } finally {
      setStatusLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchGitStatus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSyncPull = async () => {
    if (!repoUrl.trim()) {
      setErrorMsg('Please enter your GitHub repository URL (e.g. https://github.com/username/repo.git)');
      return;
    }

    setIsSyncing(true);
    setErrorMsg(null);
    setSyncOutput(null);

    // Save preferences
    localStorage.setItem('aura_github_repo_url', repoUrl.trim());
    localStorage.setItem('aura_github_branch', branch.trim());
    if (token) {
      localStorage.setItem('aura_github_token', token.trim());
    }

    try {
      const res = await fetch('/api/git/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoUrl: repoUrl.trim(),
          branch: branch.trim() || 'main',
          token: token.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSyncOutput(
          `${data.message}\n\nLast Commit: ${data.latestCommit || 'N/A'}\n\nPull Output:\n${data.pullLog || 'Up to date'}`
        );
        fetchGitStatus();
      } else {
        setErrorMsg(data.error || 'Failed to pull from GitHub');
        if (data.stderr) {
          setSyncOutput(`Error Details:\n${data.stderr}`);
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Network error syncing with GitHub');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-indigo-500/30 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/30">
              <FolderGit2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">GitHub Source Synchronization</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  AI Studio Git Engine
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Pull the latest commits from your GitHub repository directly into this workspace
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* Current Git Status Bar */}
          <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-indigo-400" /> Current Workspace Git State
              </span>
              <button
                onClick={fetchGitStatus}
                disabled={statusLoading}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
              >
                <RefreshCw className={`w-3 h-3 ${statusLoading ? 'animate-spin' : ''}`} /> Refresh Status
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-400">
              <div>
                <span className="text-slate-500 block">Branch:</span>
                <span className="text-white">{gitStatus?.branch || 'main'}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Remote:</span>
                <span className="text-white truncate block">{gitStatus?.remotes || 'No remote origin set yet'}</span>
              </div>
            </div>

            {gitStatus?.lastCommit && (
              <div className="text-[11px] font-mono bg-slate-900/80 p-2 rounded-lg border border-slate-800 text-slate-300">
                <span className="text-slate-500 text-[10px] block">HEAD Commit:</span>
                {gitStatus.lastCommit}
              </div>
            )}
          </div>

          {/* Form */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                GitHub Repository URL <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/your-username/your-repo.git"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-indigo-500 text-xs text-white placeholder-slate-500 focus:outline-none transition-colors"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Supports public HTTPS repository links or private repos with access token below.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Branch</label>
                <div className="relative">
                  <GitBranch className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    placeholder="main"
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 focus:border-indigo-500 text-xs text-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  GitHub Personal Access Token (Optional for Private Repos)
                </label>
                <div className="relative">
                  <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="password"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="ghp_••••••••••••••••"
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 focus:border-indigo-500 text-xs text-white focus:outline-none font-mono"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Feedback & Result Output */}
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block">Sync Failed</span>
                <span className="text-[11px] text-rose-300/90">{errorMsg}</span>
              </div>
            </div>
          )}

          {syncOutput && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-200 space-y-1 font-mono">
              <div className="flex items-center gap-1.5 font-bold text-emerald-300">
                <CheckCircle2 className="w-4 h-4" />
                <span>Git Pull Results</span>
              </div>
              <pre className="text-[10px] whitespace-pre-wrap max-h-36 overflow-y-auto bg-black/40 p-2 rounded">
                {syncOutput}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/50 flex items-center justify-between">
          <div className="text-[11px] text-slate-400">
            Workspace auto-recompiles upon Git checkout
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSyncPull}
              disabled={isSyncing}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white shadow-md shadow-indigo-600/30 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Pulling from GitHub...' : 'Pull & Sync from GitHub'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
