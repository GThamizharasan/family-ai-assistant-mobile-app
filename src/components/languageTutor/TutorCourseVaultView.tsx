import React, { useState } from 'react';
import {
  Cloud,
  Database,
  Trash2,
  BookOpen,
  MessageSquare,
  RefreshCw,
  ExternalLink,
  Search,
  CheckCircle2,
} from 'lucide-react';
import {
  SavedLanguageTutorRecord,
  TutorLanguage,
} from '../../types/languageTutor';

interface TutorCourseVaultViewProps {
  records: SavedLanguageTutorRecord[];
  isSyncing: boolean;
  hasGoogleToken: boolean;
  onSyncAll: () => Promise<void>;
  onRefreshFromCloud: () => Promise<void>;
  onOpenRecord: (rec: SavedLanguageTutorRecord) => void;
  onDeleteRecord: (id: string) => Promise<void>;
}

export const TutorCourseVaultView: React.FC<TutorCourseVaultViewProps> = ({
  records,
  isSyncing,
  hasGoogleToken,
  onSyncAll,
  onRefreshFromCloud,
  onOpenRecord,
  onDeleteRecord,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [langFilter, setLangFilter] = useState<'all' | TutorLanguage>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'course_lesson' | 'live_session'>('all');

  const visibleRecords = records.filter((r) => {
    if (r.recordType === 'progress_snapshot' || r.recordType === 'family_suite_state') return false;
    if (langFilter !== 'all' && r.language !== langFilter) return false;
    if (typeFilter !== 'all' && r.recordType !== typeFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      if (
        !r.title.toLowerCase().includes(q) &&
        !r.language.toLowerCase().includes(q) &&
        !r.level.toLowerCase().includes(q)
      ) {
        return false;
      }
    }
    return true;
  });

  const courseCount = records.filter((r) => r.recordType === 'course_lesson').length;
  const sessionCount = records.filter((r) => r.recordType === 'live_session').length;
  const sqliteCount = records.filter((r) => r.syncedToSqlite || r.source === 'sqlite').length;
  const driveCount = records.filter((r) => r.syncedToDrive || r.source === 'google_drive').length;

  return (
    <div className="space-y-4">
      {/* Storage Overview & Sync Header */}
      <div className="rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950/80 to-teal-950/75 border border-cyan-400/30 p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base sm:text-lg font-extrabold text-white flex items-center gap-2">
              <Database className="w-5 h-5 text-cyan-400" />
              <span>SQLite + Google Drive Language Vault</span>
            </h3>
            <p className="text-xs text-slate-300 mt-0.5">
              Every AI-constructed English & Tamil coursebook and live tutor coaching transcript is saved locally in SQLite and backed up to <span className="text-cyan-200 font-semibold">Family Circle / Language Tutor Studio</span>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={() => void onRefreshFromCloud()}
              disabled={isSyncing}
              className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>Pull SQLite + Drive</span>
            </button>

            <button
              onClick={() => void onSyncAll()}
              disabled={isSyncing}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:brightness-110 disabled:opacity-50 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-md cursor-pointer"
            >
              <Cloud className="w-3.5 h-3.5" />
              <span>Sync All Now</span>
            </button>
          </div>
        </div>

        {/* Metrics Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {[
            { label: 'AI Courses Built', value: courseCount, color: 'text-amber-300' },
            { label: 'Live Sessions Saved', value: sessionCount, color: 'text-fuchsia-300' },
            { label: 'SQLite Synced', value: sqliteCount, color: 'text-cyan-300' },
            {
              label: 'Google Drive Synced',
              value: hasGoogleToken ? driveCount : 'Sign in for Drive',
              color: 'text-emerald-300',
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl bg-slate-950/75 border border-white/10 p-3 text-center"
            >
              <div className={`text-lg sm:text-xl font-black ${stat.color}`}>{stat.value}</div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search saved English & Tamil lessons or transcripts..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950/85 border border-white/15 text-xs text-white outline-none focus:border-cyan-400"
            />
          </div>

          <div className="flex gap-1.5">
            {(['all', 'english', 'tamil'] as const).map((lf) => (
              <button
                key={lf}
                onClick={() => setLangFilter(lf)}
                className={`px-3 py-2 rounded-xl text-xs font-bold border cursor-pointer capitalize ${
                  langFilter === lf
                    ? 'bg-amber-500 text-slate-950 border-amber-300'
                    : 'bg-slate-950/75 text-slate-300 border-white/10'
                }`}
              >
                {lf === 'tamil' ? 'தமிழ்' : lf}
              </button>
            ))}

            {(['all', 'course_lesson', 'live_session'] as const).map((tf) => (
              <button
                key={tf}
                onClick={() => setTypeFilter(tf)}
                className={`px-3 py-2 rounded-xl text-xs font-bold border cursor-pointer ${
                  typeFilter === tf
                    ? 'bg-cyan-500 text-slate-950 border-cyan-300'
                    : 'bg-slate-950/75 text-slate-300 border-white/10'
                }`}
              >
                {tf === 'all' ? 'All Types' : tf === 'course_lesson' ? 'Courses' : 'Sessions'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Vault List */}
      {visibleRecords.length === 0 ? (
        <div className="rounded-3xl bg-slate-900/70 border border-white/10 p-8 text-center space-y-2">
          <BookOpen className="w-8 h-8 text-slate-500 mx-auto" />
          <p className="text-sm font-bold text-white">No saved records match this filter yet</p>
          <p className="text-xs text-slate-400">
            Construct any module from the Course Roadmap or save a Live Tutor conversation to store it in SQLite & Google Drive.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {visibleRecords.map((rec) => {
            const isCourse = rec.recordType === 'course_lesson';
            return (
              <div
                key={rec.id}
                className="rounded-2xl bg-slate-900/85 border border-white/15 p-3.5 flex flex-col justify-between gap-3 hover:border-cyan-400/40 transition-all"
              >
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[10px]">
                    <span
                      className={`px-2 py-0.5 rounded-full font-extrabold uppercase ${
                        rec.language === 'tamil'
                          ? 'bg-amber-500/20 text-amber-200 border border-amber-400/35'
                          : 'bg-sky-500/20 text-sky-200 border border-sky-400/35'
                      }`}
                    >
                      {rec.language === 'tamil' ? '🪔 தமிழ்' : '🇬🇧 English'} · {rec.level.replace('_', ' ')}
                    </span>

                    <div className="flex items-center gap-1.5">
                      {rec.syncedToSqlite && (
                        <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-200 border border-cyan-400/30 font-bold inline-flex items-center gap-1">
                          <CheckCircle2 className="w-2.5 h-2.5" /> SQLite
                        </span>
                      )}
                      {rec.syncedToDrive && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 font-bold inline-flex items-center gap-1">
                          <Cloud className="w-2.5 h-2.5" /> Drive
                        </span>
                      )}
                    </div>
                  </div>

                  <h5 className="text-sm font-extrabold text-white flex items-start gap-2">
                    {isCourse ? (
                      <BookOpen className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                    ) : (
                      <MessageSquare className="w-4 h-4 text-fuchsia-300 shrink-0 mt-0.5" />
                    )}
                    <span>{rec.title}</span>
                  </h5>

                  <p className="text-[11px] text-slate-400">
                    Updated {new Date(rec.updatedAt || rec.createdAt).toLocaleString()}
                    {typeof rec.masteryPercent === 'number' && rec.masteryPercent > 0
                      ? ` · Mastery ${rec.masteryPercent}%`
                      : ''}
                  </p>
                </div>

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/10">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => onOpenRecord(rec)}
                      className="px-3 py-1.5 rounded-xl bg-indigo-500/30 hover:bg-indigo-500/45 text-white text-xs font-bold cursor-pointer"
                    >
                      {isCourse ? 'Open Lesson Lab' : 'Preview Session'}
                    </button>

                    {rec.driveWebViewLink && (
                      <a
                        href={rec.driveWebViewLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-200 text-xs font-bold inline-flex items-center gap-1"
                      >
                        <span>Drive</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>

                  <button
                    onClick={() => void onDeleteRecord(rec.id)}
                    title="Delete from Vault"
                    className="p-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

