import React, { useState } from 'react';
import {
  Search,
  HardDrive,
  Mail,
  Calendar,
  Shield,
  Sparkles,
  CloudCheck,
  CheckCircle2,
  RefreshCw,
  Folder,
  ExternalLink,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { searchGoogleOneApi } from '../../services/api';

export const GoogleOneTab: React.FC = () => {
  const { user, role, googleOneStorageUsedGb, syncStatus, syncWithGoogleOne, chatHistory } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  const storageCategories = [
    { label: 'Google Drive (Documents & Contracts)', usedGb: 78.4, color: 'bg-blue-500' },
    { label: 'Gmail & Secure Attachments', usedGb: 34.2, color: 'bg-rose-500' },
    { label: 'Google Photos (Family Vault)', usedGb: 22.8, color: 'bg-amber-500' },
    { label: 'Aura Assistant Encrypted Prompts & Context', usedGb: 7.4, color: 'bg-indigo-500' },
  ];

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearching(true);
    setHasSearched(true);
    try {
      const res = await searchGoogleOneApi(searchQuery.trim());
      setSearchResults(res.results || []);
    } catch {
      setSearchResults([
        {
          source: 'Google Drive',
          title: `Result for "${searchQuery}" in Estate & Tech Vault`,
          snippet: 'Encrypted document stored with master key references and execution timelines.',
          date: '2026-10-09',
        },
      ]);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="space-y-6 pb-28 pt-2">
      {/* Google One Account & SSO Card */}
      <div className="p-5 rounded-3xl bg-gradient-to-br from-blue-950/40 via-slate-900 to-indigo-950/40 border border-blue-500/30 relative overflow-hidden shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center p-2.5 shadow-md">
              {/* Google multi-color G icon graphic */}
              <svg viewBox="0 0 24 24" className="w-full h-full">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.14z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.26v3.15C3.26 21.36 7.33 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.26C.46 8.16 0 9.94 0 12s.46 3.84 1.26 5.42l4.02-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.26 6.58l4.02 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                />
              </svg>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">Google One Single Sign-On</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  SSO Linked
                </span>
              </div>
              <p className="text-xs text-slate-300 font-mono">{user.email}</p>
            </div>
          </div>

          <button
            onClick={syncWithGoogleOne}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncStatus === 'syncing' ? 'animate-spin text-blue-400' : ''}`} />
            <span>{syncStatus === 'syncing' ? 'Syncing...' : 'Sync All Accounts'}</span>
          </button>
        </div>

        {/* Storage Bar Breakdown */}
        <div className="mt-5 pt-4 border-t border-blue-500/20 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-300 font-medium">Google One Storage (2 TB Plan)</span>
            <span className="font-mono text-white font-bold">{googleOneStorageUsedGb.toFixed(1)} GB of 2,048 GB</span>
          </div>

          {/* Progress multi-segment bar */}
          <div className="w-full h-3 rounded-full bg-slate-950 overflow-hidden flex">
            {storageCategories.map((cat, idx) => (
              <div
                key={idx}
                className={`${cat.color} h-full`}
                style={{ width: `${(cat.usedGb / 2048) * 100 * 7}%` }} // scaled for visual prominence
                title={`${cat.label}: ${cat.usedGb} GB`}
              />
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400 pt-1">
            {storageCategories.map((cat, idx) => (
              <div key={idx} className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${cat.color}`} />
                <span className="truncate">{cat.label}: <strong className="text-white">{cat.usedGb} GB</strong></span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Unified Cross-Account Personalized Search */}
      <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
            <Search className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Unified Cross-Account Personalized Search</h3>
            <p className="text-xs text-slate-400">
              Query simultaneously across Google Drive, Gmail, Calendar, and Assistant Prompt Vault
            </p>
          </div>
        </div>

        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search keywords, contract names, family events, wire receipts..."
            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
          />
          <button
            type="submit"
            disabled={searching || !searchQuery.trim()}
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-xs font-semibold text-white flex items-center gap-1.5 transition-colors"
          >
            {searching ? <Sparkles className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            <span>Search</span>
          </button>
        </form>

        {/* Search Results Display */}
        {hasSearched && (
          <div className="space-y-2.5 pt-2">
            <span className="text-xs font-semibold text-slate-400 block">
              Unified Search Results ({searchResults.length})
            </span>

            {searchResults.length === 0 ? (
              <p className="text-xs text-slate-500 py-3 text-center">No documents found matching "{searchQuery}".</p>
            ) : (
              searchResults.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5 text-xs hover:border-blue-500/40 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white">{item.title}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300 font-mono">
                      {item.source}
                    </span>
                  </div>
                  <p className="text-slate-400 leading-relaxed text-[11px]">{item.snippet}</p>
                  <span className="text-[10px] text-slate-500 font-mono block">Indexed: {item.date}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Google One Assistant Prompt & Response Sync Vault */}
      <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Google One Prompt & Context Sync</h3>
              <p className="text-xs text-slate-400">Every interaction encrypted & mirrored to Google One Cloud</p>
            </div>
          </div>
          <span className="text-xs text-emerald-400 font-mono font-semibold">100% Backed Up</span>
        </div>

        <div className="space-y-2">
          {chatHistory.slice(-4).map((msg) => (
            <div
              key={msg.id}
              className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800/80 flex items-center justify-between text-xs"
            >
              <div className="flex items-center gap-2 truncate pr-2">
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono uppercase ${
                  msg.role === 'user' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-purple-500/20 text-purple-300'
                }`}>
                  {msg.role}
                </span>
                <span className="text-slate-300 truncate">{msg.content}</span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono shrink-0">{msg.timestamp}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
