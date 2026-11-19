import React, { useState } from 'react';
import {
  Sparkles,
  BookOpen,
  Mic,
  CheckCircle2,
  Clock,
  Layers,
  Loader2,
  Wand2,
  Cloud,
  Database,
  Play,
} from 'lucide-react';
import {
  LanguageModuleSummary,
  ProficiencyLevel,
  SavedLanguageTutorRecord,
  TutorLanguage,
} from '../../types/languageTutor';
import {
  ENGLISH_CURRICULUM_MODULES,
  LANGUAGE_STAGES,
  TAMIL_CURRICULUM_MODULES,
} from '../../data/languageTutorCurriculum';

interface CourseRoadmapStudioViewProps {
  language: TutorLanguage;
  completedModules: Record<string, number>;
  savedRecords: SavedLanguageTutorRecord[];
  isConstructing: boolean;
  constructionStatus: string;
  onConstructModule: (mod: LanguageModuleSummary) => Promise<void>;
  onConstructCustomCourse: (goal: string, level: ProficiencyLevel) => Promise<void>;
  onPracticeModuleLive: (mod: LanguageModuleSummary) => Promise<void>;
  onOpenSavedCourse: (rec: SavedLanguageTutorRecord) => void;
}

export const CourseRoadmapStudioView: React.FC<CourseRoadmapStudioViewProps> = ({
  language,
  completedModules,
  savedRecords,
  isConstructing,
  constructionStatus,
  onConstructModule,
  onConstructCustomCourse,
  onPracticeModuleLive,
  onOpenSavedCourse,
}) => {
  const [customGoal, setCustomGoal] = useState('');
  const [customLevel, setCustomLevel] = useState<ProficiencyLevel>('intermediate');
  const [selectedStageFilter, setSelectedStageFilter] = useState<number | 'all'>('all');

  const isTamil = language === 'tamil';
  const modules = isTamil ? TAMIL_CURRICULUM_MODULES : ENGLISH_CURRICULUM_MODULES;

  const customIdeas = isTamil
    ? [
        'திருக்குறள் & மேடைப் பேச்சுப் பயிற்சி',
        'தமிழில் தொழில்முறை நேர்முகத் தேர்வு',
        'குழந்தைகளுக்கான தமிழ் கதை & உயிர்மெய் எழுத்துக்கள்',
        'சங்க இலக்கியம் & செந்தமிழ் இலக்கணம்',
      ]
    : [
        'Executive Presentation & Q&A Fluency',
        'IELTS Band 8.5 Speaking & Coherence',
        'Daily Family Storytelling & Warm Small Talk',
        'Accent Rhythm, Intonation & Connected Speech',
      ];

  const visibleStages = LANGUAGE_STAGES.filter(
    (s) => selectedStageFilter === 'all' || s.stageNumber === selectedStageFilter
  );

  return (
    <div className="space-y-5">
      {/* Custom AI On-Demand Course Constructor Studio */}
      <div
        className={`rounded-3xl p-4 sm:p-5 border shadow-xl relative overflow-hidden ${
          isTamil
            ? 'bg-gradient-to-br from-amber-950/75 via-rose-950/60 to-slate-900 border-amber-500/35'
            : 'bg-gradient-to-br from-indigo-950/80 via-purple-950/65 to-slate-900 border-indigo-400/35'
        }`}
      >
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-white/10 text-amber-200 border border-white/15 inline-flex items-center gap-1.5">
              <Wand2 className="w-3.5 h-3.5 text-amber-300" />
              AI On-Demand Course Architect · SQLite + Google Drive Sync
            </span>
            <span className="text-[11px] text-emerald-300 font-semibold flex items-center gap-1">
              <Cloud className="w-3.5 h-3.5" /> Auto-Exports Coursebook
            </span>
          </div>

          <div>
            <h3 className="text-base sm:text-lg font-extrabold text-white">
              {isTamil
                ? 'உங்கள் விருப்பத்திற்கேற்ப புதிய தமிழ் பாடத்தை AI மூலம் உருவாக்குங்கள்'
                : 'Construct Any Custom English Course Module with AI'}
            </h3>
            <p className="text-xs text-slate-300 mt-0.5">
              {isTamil
                ? 'எந்தத் தலைப்பைக் கொடுத்தாலும் ஆசிரியர் கலைவாணி முழுப் பாடம், உரையாடல், பயிற்சிகள் மற்றும் வினாடி-வினாவை உருவாக்கி SQLite & Google Drive-ல் சேமிப்பார்.'
                : 'Enter any topic, career scenario, or grammar goal — Prof. Clara constructs a complete interactive course, pronunciation drills, and saves it automatically to SQLite & Google Drive.'}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={customGoal}
              onChange={(e) => setCustomGoal(e.target.value)}
              placeholder={
                isTamil
                  ? 'உதா: அலுவலகத் தமிழ் மின்னஞ்சல் & கூட்ட உரையாடல்...'
                  : 'e.g., Confident Client Negotiation, Narrative Past Tenses...'
              }
              className="flex-1 bg-slate-950/80 border border-white/15 focus:border-amber-400 rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-slate-400 outline-none"
            />
            <select
              value={customLevel}
              onChange={(e) => setCustomLevel(e.target.value as ProficiencyLevel)}
              className="bg-slate-950/85 border border-white/15 rounded-2xl px-3 py-2.5 text-xs font-bold text-white outline-none"
            >
              {LANGUAGE_STAGES.map((st) => (
                <option key={st.level} value={st.level}>
                  {st.cefrCode} · {st.englishLabel}
                </option>
              ))}
            </select>
            <button
              onClick={() => {
                if (customGoal.trim()) {
                  void onConstructCustomCourse(customGoal.trim(), customLevel);
                }
              }}
              disabled={isConstructing || !customGoal.trim()}
              className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 via-pink-500 to-indigo-600 hover:brightness-110 disabled:opacity-45 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg cursor-pointer shrink-0 transition-all"
            >
              {isConstructing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              <span>Construct & Save Course</span>
            </button>
          </div>

          {/* Quick Idea Pills */}
          <div className="flex flex-wrap gap-1.5">
            {customIdeas.map((idea) => (
              <button
                key={idea}
                onClick={() => setCustomGoal(idea)}
                className="px-2.5 py-1 rounded-xl bg-slate-950/70 hover:bg-slate-900 text-[11px] text-cyan-200 border border-white/10 cursor-pointer transition-colors"
              >
                ✨ {idea}
              </button>
            ))}
          </div>

          {isConstructing && constructionStatus && (
            <div className="rounded-2xl bg-indigo-500/20 border border-indigo-400/40 px-3.5 py-2.5 text-xs font-semibold text-indigo-100 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-amber-300 shrink-0" />
              <span>{constructionStatus}</span>
            </div>
          )}
        </div>
      </div>

      {/* Stage Filter Chips */}
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          onClick={() => setSelectedStageFilter('all')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold border cursor-pointer transition-all ${
            selectedStageFilter === 'all'
              ? 'bg-white text-slate-950 border-white'
              : 'bg-slate-900/75 text-slate-300 border-slate-700 hover:border-slate-500'
          }`}
        >
          All 6 Stages (18 Modules)
        </button>
        {LANGUAGE_STAGES.map((st) => (
          <button
            key={st.stageNumber}
            onClick={() => setSelectedStageFilter(st.stageNumber)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border cursor-pointer transition-all ${
              selectedStageFilter === st.stageNumber
                ? `bg-gradient-to-r ${st.gradient} text-white border-white/40 shadow-md`
                : 'bg-slate-900/75 text-slate-300 border-slate-700 hover:border-slate-500'
            }`}
          >
            {st.cefrCode} · {isTamil ? st.tamilLabel.split(' ')[0] : st.englishLabel.split(' ')[0]}
          </button>
        ))}
      </div>

      {/* End-to-End 6-Stage Curriculum Progression */}
      <div className="space-y-5">
        {visibleStages.map((stage) => {
          const stageModules = modules.filter((m) => m.stageNumber === stage.stageNumber);
          const avgStageMastery =
            stageModules.length > 0
              ? Math.round(
                  stageModules.reduce((acc, m) => acc + (completedModules[m.id] || 0), 0) /
                    stageModules.length
                )
              : 0;

          return (
            <div
              key={stage.stageNumber}
              className="rounded-3xl bg-slate-900/75 border border-white/10 p-4 space-y-3"
            >
              {/* Colorful Stage Banner */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-white/10">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-gradient-to-r ${stage.gradient} text-white shadow-sm`}
                    >
                      Stage {stage.stageNumber} · {stage.cefrCode}
                    </span>
                    <h4 className="text-sm sm:text-base font-extrabold text-white">
                      {isTamil ? `${stage.tamilLabel} (${stage.englishLabel})` : stage.englishLabel}
                    </h4>
                  </div>
                  <p className="text-xs text-slate-400">{stage.description}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="w-24 h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${stage.gradient}`}
                      style={{ width: `${Math.max(4, avgStageMastery)}%` }}
                    />
                  </div>
                  <span className="text-xs font-extrabold text-white">{avgStageMastery}%</span>
                </div>
              </div>

              {/* Stage Module Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {stageModules.map((mod) => {
                  const mastery = completedModules[mod.id] || 0;
                  const savedRec = savedRecords.find(
                    (r) =>
                      r.recordType === 'course_lesson' &&
                      (r.moduleId === mod.id || r.id === `course-${mod.id}`)
                  );

                  return (
                    <div
                      key={mod.id}
                      className={`rounded-2xl p-3.5 bg-gradient-to-br ${mod.colorGradient} border border-white/15 flex flex-col justify-between gap-3 hover:border-white/30 transition-all shadow-lg`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2 text-[10px]">
                          <span className="font-bold px-2 py-0.5 rounded-full bg-black/35 text-slate-100 border border-white/10 flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {mod.estimatedMinutes}m · +{mod.xpReward} XP
                          </span>

                          {savedRec ? (
                            <span className="font-bold px-2 py-0.5 rounded-full bg-emerald-500/25 text-emerald-200 border border-emerald-400/40 flex items-center gap-1">
                              <Database className="w-3 h-3" />
                              {savedRec.syncedToDrive ? 'SQLite + Drive ✓' : 'Built ✓'}
                            </span>
                          ) : (
                            <span className="font-semibold text-slate-300 flex items-center gap-1">
                              <Layers className="w-3 h-3" /> AI Ready
                            </span>
                          )}
                        </div>

                        <div>
                          <h5 className="text-sm font-extrabold text-white leading-snug">
                            {mod.title}
                          </h5>
                          <p className="text-[11px] text-amber-200/90 font-medium mt-0.5">
                            {mod.nativeTitle}
                          </p>
                        </div>

                        <p className="text-[11px] text-slate-200/90 leading-relaxed">
                          {mod.subtitle}
                        </p>

                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {mod.keyTopics.map((topic) => (
                            <span
                              key={topic}
                              className="px-2 py-0.5 rounded-lg bg-slate-950/60 text-[10px] text-slate-200 border border-white/10"
                            >
                              {topic}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2 pt-2 border-t border-white/10">
                        {mastery > 0 && (
                          <div className="flex items-center justify-between text-[10px] text-emerald-200 font-bold">
                            <span className="flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Mastery
                            </span>
                            <span>{mastery}%</span>
                          </div>
                        )}

                        <div className="flex items-center gap-1.5">
                          {savedRec ? (
                            <button
                              onClick={() => onOpenSavedCourse(savedRec)}
                              className="flex-1 px-2.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white font-bold text-[11px] flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                            >
                              <BookOpen className="w-3.5 h-3.5" />
                              <span>Open Lesson</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => void onConstructModule(mod)}
                              disabled={isConstructing}
                              className="flex-1 px-2.5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:brightness-110 disabled:opacity-50 text-white font-bold text-[11px] flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-md"
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                              <span>AI Construct & Learn</span>
                            </button>
                          )}

                          <button
                            onClick={() => void onPracticeModuleLive(mod)}
                            disabled={isConstructing}
                            title="Practice this module live with your human tutor"
                            className="px-2.5 py-2 rounded-xl bg-rose-500/25 hover:bg-rose-500/40 text-rose-100 border border-rose-400/40 font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-all"
                          >
                            {savedRec ? <Play className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                            <span>Live</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

