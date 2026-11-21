import React, { useState } from 'react';
import {
  Users,
  Award,
  BarChart3,
  Plus,
  CloudUpload,
  Printer,
  ExternalLink,
  CheckCircle2,
  Flame,
  Clock,
  Sparkles,
  BookOpen,
} from 'lucide-react';
import {
  LearnerAgeGroup,
  StageCompletionCertificate,
  TutorFamilyLearnerProfile,
  TutorLanguage,
  TutorProgressState,
} from '../../types/languageTutor';
import { LANGUAGE_STAGES } from '../../data/languageTutorCurriculum';
import {
  exportTutorFluencyReportToDrive,
  issueStageCertificateAndSync,
} from '../../services/languageTutorService';

interface FamilyAnalyticsAndCertificatesViewProps {
  language: TutorLanguage;
  learners: TutorFamilyLearnerProfile[];
  activeLearner: TutorFamilyLearnerProfile;
  progress: TutorProgressState;
  userEmail?: string;
  googleAccessToken?: string | null;
  onSelectLearner: (learnerId: string) => void;
  onAddLearner: (profile: { name: string; avatar: string; ageGroup: LearnerAgeGroup }) => void;
  onCertificateIssued: (cert: StageCompletionCertificate) => void;
}

const AVATAR_CHOICES = ['🧒', '👧', '👩‍💼', '👨‍💻', '👴', '👵', '🧑‍🎓', '🚀'];

export const FamilyAnalyticsAndCertificatesView: React.FC<
  FamilyAnalyticsAndCertificatesViewProps
> = ({
  language,
  learners,
  activeLearner,
  progress,
  userEmail,
  googleAccessToken,
  onSelectLearner,
  onAddLearner,
  onCertificateIssued,
}) => {
  const [newName, setNewName] = useState('');
  const [newAvatar, setNewAvatar] = useState('🧒');
  const [newAgeGroup, setNewAgeGroup] = useState<LearnerAgeGroup>('kids_6_10');
  const [showAddForm, setShowAddForm] = useState(false);

  const [issuingStage, setIssuingStage] = useState<number | null>(null);
  const [isExportingReport, setIsExportingReport] = useState(false);
  const [reportNotice, setReportNotice] = useState<{
    ok: boolean;
    message: string;
    webViewLink?: string;
  } | null>(null);

  const certificates = progress.certificates || [];
  const fluencyPoints = (progress.fluencyHistory || []).slice(-8);

  const handleCreateLearner = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    onAddLearner({ name: newName.trim(), avatar: newAvatar, ageGroup: newAgeGroup });
    setNewName('');
    setShowAddForm(false);
  };

  const handleIssueCert = async (stageNum: number) => {
    const st = LANGUAGE_STAGES.find((s) => s.stageNumber === stageNum);
    if (!st) return;
    setIssuingStage(stageNum);
    try {
      const cert = await issueStageCertificateAndSync({
        learner: activeLearner,
        language,
        stageNumber: st.stageNumber,
        cefrCode: st.cefrCode,
        stageTitle: language === 'tamil' ? `${st.tamilLabel} (${st.englishLabel})` : st.englishLabel,
        scorePercent: Math.max(85, progress.averageFluency),
        userEmail,
        googleAccessToken,
      });
      onCertificateIssued(cert);
    } finally {
      setIssuingStage(null);
    }
  };

  const handlePrintCertificate = (cert: StageCompletionCertificate) => {
    const win = window.open('', '_blank', 'width=860,height=620');
    if (!win) return;
    win.document.write(`
      <html>
        <head>
          <title>Certificate - ${cert.learnerName}</title>
          <style>
            body { font-family: Georgia, serif; background: #0f172a; color: #f8fafc; display:flex; align-items:center; justify-content:center; min-height:100vh; margin:0; }
            .card { width: 740px; padding: 48px; border: 8px double #f59e0b; border-radius: 24px; background: linear-gradient(135deg, #1e1b4b, #0f172a); text-align:center; }
            h1 { color: #fbbf24; font-size: 32px; margin-bottom: 8px; }
            h2 { font-size: 28px; color: #ffffff; margin: 16px 0; }
            p { color: #cbd5e1; font-size: 16px; line-height: 1.6; }
            .badge { display:inline-block; padding:6px 18px; border-radius:999px; background:#f59e0b; color:#0f172a; font-weight:bold; font-family:sans-serif; font-size:13px; }
            .sig { margin-top: 36px; display:flex; justify-content:space-between; border-top:1px solid rgba(255,255,255,0.2); padding-top:18px; font-family:sans-serif; font-size:13px; color:#94a3b8; }
          </style>
        </head>
        <body>
          <div class="card">
            <span class="badge">AURA LIVE LANGUAGE TUTOR STUDIO · ${cert.language === 'tamil' ? 'தமிழ்' : 'ENGLISH'}</span>
            <h1>Certificate of Mastery</h1>
            <p>Proudly presented to</p>
            <h2>${cert.learnerName}</h2>
            <p>for achieving Stage ${cert.stageNumber} (${cert.cefrCode}) proficiency in<br/><strong>${cert.stageTitle}</strong><br/>with a Mastery Score of <strong>${cert.scorePercent}%</strong>.</p>
            <div class="sig">
              <div><strong>Mentor Signature:</strong><br/>${cert.signedBy}</div>
              <div><strong>Issued On:</strong><br/>${new Date(cert.issuedAt).toLocaleDateString()}</div>
            </div>
          </div>
          <script>window.onload = () => window.print();</script>
        </body>
      </html>
    `);
    win.document.close();
  };

  const handleExportAnalytics = async () => {
    setIsExportingReport(true);
    setReportNotice(null);
    try {
      const res = await exportTutorFluencyReportToDrive({
        learner: activeLearner,
        progress,
        accessToken: googleAccessToken,
        userEmail,
      });
      setReportNotice(res);
    } finally {
      setIsExportingReport(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* 1. MULTI-LEARNER FAMILY PROFILE SWITCHER */}
      <div className="rounded-3xl bg-slate-900/90 border border-indigo-400/30 p-4 sm:p-5 space-y-3.5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-extrabold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-cyan-400" />
              <span>Multi-Learner Family Profiles (SQLite + Drive Synced)</span>
            </h3>
            <p className="text-xs text-slate-300">
              Separate XP, vocabulary decks, certificates, and Kids (Age 6–10) vs. Adult Executive tracks per family member.
            </p>
          </div>
          <button
            onClick={() => setShowAddForm((v) => !v)}
            className="px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/35 text-cyan-200 border border-cyan-400/40 text-xs font-bold flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Add Family Member
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {learners.map((l) => {
            const isActive = l.id === activeLearner.id;
            return (
              <button
                key={l.id}
                onClick={() => onSelectLearner(l.id)}
                className={`rounded-2xl p-3 border text-left flex items-center gap-3 cursor-pointer transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-indigo-600/40 to-fuchsia-600/35 border-cyan-300 shadow-lg'
                    : 'bg-slate-950/75 border-white/10 hover:border-white/25'
                }`}
              >
                <span className="text-2xl">{l.avatar}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-xs sm:text-sm font-extrabold text-white truncate">
                    {l.name}
                  </div>
                  <div className="text-[10px] text-amber-200 font-semibold">{l.roleLabel}</div>
                </div>
                {isActive && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
              </button>
            );
          })}
        </div>

        {showAddForm && (
          <form
            onSubmit={handleCreateLearner}
            className="rounded-2xl bg-slate-950/85 border border-white/15 p-3.5 flex flex-col sm:flex-row gap-2.5 items-center"
          >
            <div className="flex gap-1">
              {AVATAR_CHOICES.map((av) => (
                <button
                  key={av}
                  type="button"
                  onClick={() => setNewAvatar(av)}
                  className={`w-8 h-8 rounded-xl flex items-center justify-center cursor-pointer ${
                    newAvatar === av ? 'bg-cyan-500/30 ring-2 ring-cyan-300' : 'bg-slate-900'
                  }`}
                >
                  {av}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Learner name (e.g. Kavin, Amma)..."
              className="flex-1 w-full rounded-xl bg-slate-900 border border-white/15 px-3 py-2 text-xs text-white outline-none"
            />
            <select
              value={newAgeGroup}
              onChange={(e) => setNewAgeGroup(e.target.value as LearnerAgeGroup)}
              className="rounded-xl bg-slate-900 border border-white/15 px-2.5 py-2 text-xs text-white outline-none"
            >
              <option value="kids_6_10">Kids (Age 6–10)</option>
              <option value="teens">Teens (Age 11–17)</option>
              <option value="adult">Adult Executive</option>
              <option value="elder">Elder Leisure</option>
            </select>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 text-xs font-extrabold cursor-pointer shrink-0"
            >
              Create
            </button>
          </form>
        )}
      </div>

      {/* 2. WEEKLY FLUENCY & MASTERY ANALYTICS DASHBOARD */}
      <div className="rounded-3xl bg-slate-900/90 border border-emerald-400/30 p-4 sm:p-5 space-y-4 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-extrabold text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-emerald-400" />
              <span>Weekly Fluency & Mastery Analytics — {activeLearner.name}</span>
            </h3>
            <p className="text-xs text-slate-300">
              Tracks live fluency trend, speaking minutes, SM-2 vocabulary retention, tracing & writing clinics.
            </p>
          </div>

          <button
            onClick={() => void handleExportAnalytics()}
            disabled={isExportingReport}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 disabled:opacity-50 text-slate-950 text-xs font-extrabold flex items-center gap-1.5 shadow-md cursor-pointer"
          >
            <CloudUpload className="w-3.5 h-3.5" />
            <span>{isExportingReport ? 'Exporting...' : 'Export Report to Google Drive'}</span>
          </button>
        </div>

        {reportNotice && (
          <div
            className={`rounded-xl px-3 py-2 text-xs font-semibold flex flex-wrap items-center justify-between gap-2 border ${
              reportNotice.ok
                ? 'bg-emerald-500/15 text-emerald-200 border-emerald-400/35'
                : 'bg-amber-500/15 text-amber-200 border-amber-400/35'
            }`}
          >
            <span>{reportNotice.message}</span>
            {reportNotice.webViewLink && (
              <a
                href={reportNotice.webViewLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 underline font-bold text-white"
              >
                Open in Drive <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {[
            { label: 'Avg Fluency', val: `${progress.averageFluency}%`, icon: Sparkles, cls: 'text-emerald-300' },
            { label: 'Speaking Time', val: `${progress.speakingMinutes || progress.totalLiveTurns} min`, icon: Clock, cls: 'text-cyan-300' },
            { label: 'Letters & Essays', val: `${(progress.tracedLettersCount || 0) + (progress.essaysGradedCount || 0)}`, icon: BookOpen, cls: 'text-fuchsia-300' },
            { label: 'Active Streak', val: `${progress.streakDays}d`, icon: Flame, cls: 'text-amber-300' },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                className="rounded-2xl bg-slate-950/80 border border-white/10 p-3 text-center space-y-1"
              >
                <Icon className={`w-4 h-4 mx-auto ${stat.cls}`} />
                <div className={`text-lg font-black ${stat.cls}`}>{stat.val}</div>
                <div className="text-[10px] font-bold uppercase text-slate-400">{stat.label}</div>
              </div>
            );
          })}
        </div>

        {/* Colorful Fluency Trend Bar Sparkline */}
        {fluencyPoints.length > 0 && (
          <div className="rounded-2xl bg-slate-950/75 border border-white/10 p-3.5 space-y-2">
            <div className="text-[11px] font-bold uppercase text-slate-400">
              Recent Fluency Trend (%)
            </div>
            <div className="flex items-end gap-2 h-24 pt-2">
              {fluencyPoints.map((pt, idx) => (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                  <span className="text-[10px] font-mono font-bold text-cyan-200">
                    {pt.fluencyScore}%
                  </span>
                  <div
                    className={`w-full max-w-[36px] rounded-t-xl ${
                      pt.language === 'tamil'
                        ? 'bg-gradient-to-t from-amber-500 to-rose-400'
                        : 'bg-gradient-to-t from-sky-500 to-indigo-400'
                    }`}
                    style={{ height: `${Math.max(18, pt.fluencyScore * 0.72)}%` }}
                  />
                  <span className="text-[9px] font-mono text-slate-400 truncate">
                    {pt.date.slice(5)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 3. PRINTABLE & SHAREABLE STAGE COMPLETION CERTIFICATES */}
      <div className="rounded-3xl bg-gradient-to-br from-amber-950/55 via-slate-900 to-indigo-950/60 border border-amber-400/35 p-4 sm:p-5 space-y-4 shadow-xl">
        <div>
          <h3 className="text-base font-extrabold text-white flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-400" />
            <span>
              Stage Mastery Certificates ({language === 'tamil' ? 'தமிழ்' : 'English'} · A1 → C2)
            </span>
          </h3>
          <p className="text-xs text-slate-300">
            Generate official bilingual diplomas signed by{' '}
            {language === 'tamil' ? 'ஆசிரியர் கலைவாணி' : 'Prof. Clara Vance'}, print to PDF, and archive directly to Google Drive!
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {LANGUAGE_STAGES.map((st) => {
            const earned = certificates.find(
              (c) => c.language === language && c.stageNumber === st.stageNumber
            );
            return (
              <div
                key={st.stageNumber}
                className={`rounded-2xl p-3.5 border flex flex-col justify-between gap-3 ${
                  earned
                    ? 'bg-gradient-to-br from-amber-500/20 via-slate-950/90 to-indigo-950/80 border-amber-400/60 shadow-lg'
                    : 'bg-slate-950/75 border-white/10'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className={`px-2 py-0.5 rounded-full font-black bg-gradient-to-r ${st.gradient} text-white`}>
                      Stage {st.stageNumber} · {st.cefrCode}
                    </span>
                    {earned && (
                      <span className="text-emerald-300 font-extrabold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Issued
                      </span>
                    )}
                  </div>
                  <div className="text-xs sm:text-sm font-extrabold text-white">
                    {language === 'tamil' ? st.tamilLabel : st.englishLabel}
                  </div>
                  <p className="text-[10px] text-slate-400">
                    {earned
                      ? `Awarded to ${earned.learnerName} (${earned.scorePercent}%)`
                      : 'Claim & archive diploma to SQLite + Google Drive'}
                  </p>
                </div>

                {earned ? (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handlePrintCertificate(earned)}
                      className="flex-1 px-2.5 py-1.5 rounded-xl bg-amber-400 text-slate-950 text-[11px] font-extrabold flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" /> Print / PDF
                    </button>
                    {earned.driveWebViewLink && (
                      <a
                        href={earned.driveWebViewLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1.5 rounded-xl bg-emerald-500/25 text-emerald-200 text-[11px] font-bold inline-flex items-center gap-1"
                      >
                        Drive <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => void handleIssueCert(st.stageNumber)}
                    disabled={issuingStage === st.stageNumber}
                    className="w-full py-1.5 rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white text-[11px] font-bold cursor-pointer"
                  >
                    {issuingStage === st.stageNumber ? 'Issuing & Syncing...' : '🎓 Claim Certificate'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
