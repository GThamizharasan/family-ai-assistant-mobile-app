import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  Users,
  Zap,
  Sparkles,
  Award,
  Radio,
  PauseCircle,
  PlayCircle,
  MessageSquarePlus,
  ArrowUpRight,
} from 'lucide-react';
import {
  EngagementWavePoint,
  GradingResult,
  StudentEngagementPod,
  SubjectDefinition,
  SubjectId,
  SynapticAlert,
} from '../../types/adaptiveLearning';

interface ClassroomEngagementViewProps {
  subject: SubjectDefinition;
  allSubjects: SubjectDefinition[];
  masteryMap: Record<string, number>;
  gradingHistory: GradingResult[];
  engagementWave: EngagementWavePoint[];
  classroomPods: StudentEngagementPod[];
  synapticAlerts: SynapticAlert[];
  isTelemetryLive: boolean;
  onToggleTelemetryLive: () => void;
  onNudgeStudent: (podId: string, actionLabel: string) => void;
  onExecuteAlert: (alert: SynapticAlert) => void;
  onSelectSubject: (subjectId: SubjectId) => void;
}

export const ClassroomEngagementView: React.FC<ClassroomEngagementViewProps> = ({
  subject,
  allSubjects,
  masteryMap,
  gradingHistory,
  engagementWave,
  classroomPods,
  synapticAlerts,
  isTelemetryLive,
  onToggleTelemetryLive,
  onNudgeStudent,
  onExecuteAlert,
  onSelectSubject,
}) => {
  const waveCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [selectedPodId, setSelectedPodId] = useState<string | null>(null);

  // Render glowing real-time dual-line neural engagement waveform
  useEffect(() => {
    const canvas = waveCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = 720;
    const h = 190;
    canvas.width = w;
    canvas.height = h;

    ctx.clearRect(0, 0, w, h);

    // Subtle telemetry grid
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)';
    ctx.lineWidth = 1;
    for (let y = 30; y < h; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    if (engagementWave.length < 2) return;
    const stepX = w / Math.max(1, engagementWave.length - 1);

    const drawSeries = (
      values: number[],
      strokeHex: string,
      fillHex: string
    ) => {
      ctx.save();
      ctx.beginPath();
      values.forEach((val, idx) => {
        const px = idx * stepX;
        const py = h - 18 - (Math.min(100, Math.max(0, val)) / 100) * (h - 36);
        if (idx === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.strokeStyle = strokeHex;
      ctx.lineWidth = 3;
      ctx.shadowColor = strokeHex;
      ctx.shadowBlur = 10;
      ctx.stroke();

      // Gradient fill underneath
      ctx.shadowBlur = 0;
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, fillHex);
      grad.addColorStop(1, 'rgba(15, 23, 42, 0)');
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.restore();
    };

    drawSeries(
      engagementWave.map((p) => p.focus),
      '#22d3ee',
      'rgba(34, 211, 238, 0.22)'
    );
    drawSeries(
      engagementWave.map((p) => p.cognitiveFlow),
      '#a855f7',
      'rgba(168, 85, 247, 0.14)'
    );
  }, [engagementWave]);

  const avgClassFocus = Math.round(
    classroomPods.reduce((acc, p) => acc + p.focusScore, 0) / Math.max(1, classroomPods.length)
  );
  const deepFlowCount = classroomPods.filter((p) => p.status === 'deep_flow').length;
  const avgGrade =
    gradingHistory.length > 0
      ? Math.round(
          gradingHistory.reduce((acc, g) => acc + g.overallScore, 0) / gradingHistory.length
        )
      : 88;
  const latestVoiceEnergy =
    engagementWave[engagementWave.length - 1]?.voiceActivity ?? 74;

  const selectedPod = classroomPods.find((p) => p.id === selectedPodId) || null;

  return (
    <div className="space-y-4">
      {/* =====================================================================
          1. LIVE NEURAL ENGAGEMENT WAVE MONITOR
          ===================================================================== */}
      <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-4 shadow-2xl space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <Radio
                className={`w-4 h-4 ${
                  isTelemetryLive ? 'text-emerald-400 animate-pulse' : 'text-slate-400'
                }`}
              />
              <h3 className="text-xs sm:text-sm font-bold text-white">
                Classroom Nervous System — Live Engagement Wave
              </h3>
            </div>
            <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5">
              Fuses live quiz accuracy, speech-to-chalk fluency, and classroom focus telemetry.
            </p>
          </div>

          <button
            type="button"
            onClick={onToggleTelemetryLive}
            className={`px-3 py-1.5 rounded-2xl text-xs font-bold flex items-center gap-1.5 border cursor-pointer transition-all ${
              isTelemetryLive
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : 'bg-slate-950 text-slate-300 border-slate-700'
            }`}
          >
            {isTelemetryLive ? (
              <PauseCircle className="w-3.5 h-3.5" />
            ) : (
              <PlayCircle className="w-3.5 h-3.5" />
            )}
            <span>{isTelemetryLive ? 'Live Pulse ON' : 'Paused'}</span>
          </button>
        </div>

        <div className="rounded-2xl bg-slate-950/95 border border-slate-800 p-2 relative overflow-hidden">
          <canvas ref={waveCanvasRef} className="w-full h-36 sm:h-44 block" />
          <div className="flex items-center justify-between px-2 pt-1 text-[10px] font-mono text-slate-400">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 text-cyan-300">
                <span className="w-2 h-2 rounded-full bg-cyan-400" />
                Classroom Focus
              </span>
              <span className="flex items-center gap-1 text-purple-300">
                <span className="w-2 h-2 rounded-full bg-purple-400" />
                Cognitive Synaptic Flow
              </span>
            </div>
            <span>Window: Live 30s Rolling</span>
          </div>
        </div>

        {/* 4 Telemetry KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="p-3 rounded-2xl bg-slate-950/85 border border-slate-800">
            <span className="text-[10px] font-mono text-slate-400 uppercase flex items-center gap-1">
              <Activity className="w-3 h-3 text-cyan-400" />
              Class Pulse
            </span>
            <p className="text-lg sm:text-xl font-extrabold text-cyan-300 mt-0.5 tabular-nums">
              {avgClassFocus}%
            </p>
          </div>
          <div className="p-3 rounded-2xl bg-slate-950/85 border border-slate-800">
            <span className="text-[10px] font-mono text-slate-400 uppercase flex items-center gap-1">
              <Zap className="w-3 h-3 text-emerald-400" />
              Deep Flow Pods
            </span>
            <p className="text-lg sm:text-xl font-extrabold text-emerald-300 mt-0.5 tabular-nums">
              {deepFlowCount}/{classroomPods.length}
            </p>
          </div>
          <div className="p-3 rounded-2xl bg-slate-950/85 border border-slate-800">
            <span className="text-[10px] font-mono text-slate-400 uppercase flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-400" />
              Board & Voice
            </span>
            <p className="text-lg sm:text-xl font-extrabold text-amber-300 mt-0.5 tabular-nums">
              {latestVoiceEnergy}%
            </p>
          </div>
          <div className="p-3 rounded-2xl bg-slate-950/85 border border-slate-800">
            <span className="text-[10px] font-mono text-slate-400 uppercase flex items-center gap-1">
              <Award className="w-3 h-3 text-purple-400" />
              Avg Grade
            </span>
            <p className="text-lg sm:text-xl font-extrabold text-purple-300 mt-0.5 tabular-nums">
              {avgGrade}%
            </p>
          </div>
        </div>
      </div>

      {/* =====================================================================
          2. CLASSROOM SEAT HEATMAP & MICRO-INTERVENTION NUDGES
          ===================================================================== */}
      <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-4 shadow-xl space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-400" />
            <h4 className="text-xs sm:text-sm font-bold text-white">
              Classroom Focus Heatmap (Tap any learner for AI nudge)
            </h4>
          </div>
          <span className="text-[10px] font-mono text-slate-400">
            Subject: {subject.name}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {classroomPods.map((pod) => {
            const isSelected = selectedPodId === pod.id;
            const statusStyle =
              pod.status === 'deep_flow'
                ? 'border-emerald-500/50 bg-emerald-500/10'
                : pod.status === 'engaged'
                ? 'border-cyan-500/40 bg-cyan-500/10'
                : pod.status === 'needs_nudge'
                ? 'border-amber-500/50 bg-amber-500/10 animate-pulse'
                : 'border-rose-500/50 bg-rose-500/10 animate-pulse';

            return (
              <button
                key={pod.id}
                type="button"
                onClick={() => setSelectedPodId(isSelected ? null : pod.id)}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${statusStyle} ${
                  isSelected ? 'ring-2 ring-white scale-[1.02]' : 'hover:scale-[1.01]'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-base">{pod.avatar}</span>
                  <span className="text-xs font-mono font-extrabold text-white tabular-nums">
                    {pod.focusScore}%
                  </span>
                </div>
                <p className="text-xs font-bold text-white truncate mt-1">
                  {pod.name}
                </p>
                <p className="text-[10px] text-slate-300/80 truncate">
                  {pod.lastNudge || pod.currentConcept}
                </p>
              </button>
            );
          })}
        </div>

        {/* Selected Learner Micro-Intervention Tray */}
        {selectedPod && (
          <div className="p-3 rounded-2xl bg-slate-950/90 border border-indigo-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                <MessageSquarePlus className="w-3.5 h-3.5 text-cyan-400" />
                <span>Send Adaptive Boost to {selectedPod.name}</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Current state: {selectedPod.status.replace('_', ' ')} • {selectedPod.responseSpeedSec}s avg cadence
              </p>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                'Visual Analogy Spark',
                'Chalkboard Hint',
                'Focus Encouragement',
              ].map((action) => (
                <button
                  key={action}
                  type="button"
                  onClick={() => onNudgeStudent(selectedPod.id, action)}
                  className="px-2.5 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500 hover:text-slate-950 border border-cyan-500/40 text-cyan-200 text-[11px] font-bold transition-all cursor-pointer"
                >
                  ⚡ {action}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* =====================================================================
          3. SYNAPTIC PEDAGOGICAL ALERTS + 7-SUBJECT MASTERY MATRIX
          ===================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Synaptic Alerts */}
        <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-4 space-y-2.5 shadow-xl">
          <div className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Real-Time Synaptic Alerts</span>
          </div>
          <div className="space-y-2">
            {synapticAlerts.map((alert) => (
              <div
                key={alert.id}
                className="p-3 rounded-2xl bg-slate-950/85 border border-slate-800 flex items-start justify-between gap-2.5"
              >
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        alert.severity === 'breakthrough'
                          ? 'bg-emerald-400'
                          : alert.severity === 'nudge'
                          ? 'bg-amber-400'
                          : 'bg-cyan-400'
                      }`}
                    />
                    <span className="text-xs font-bold text-white">{alert.title}</span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-snug">{alert.message}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onExecuteAlert(alert)}
                  className="px-2.5 py-1.5 rounded-xl bg-indigo-500/20 hover:bg-indigo-500 text-indigo-200 hover:text-white border border-indigo-500/40 text-[10px] font-bold flex items-center gap-1 shrink-0 cursor-pointer transition-all"
                >
                  <span>{alert.actionLabel}</span>
                  <ArrowUpRight className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* 7-Subject Mastery Matrix */}
        <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-4 space-y-2.5 shadow-xl">
          <div className="text-xs sm:text-sm font-bold text-white">
            All 7 Subjects Mastery Matrix (Tap to Switch)
          </div>
          <div className="space-y-2">
            {allSubjects.map((s) => {
              const avg = Math.round(
                s.concepts.reduce((sum, c) => sum + (masteryMap[c.id] ?? c.mastery), 0) /
                  Math.max(1, s.concepts.length)
              );
              const isCurrent = s.id === subject.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onSelectSubject(s.id)}
                  className={`w-full p-2.5 rounded-2xl border text-left transition-all cursor-pointer ${
                    isCurrent
                      ? 'bg-slate-950 border-white/40 shadow-md'
                      : 'bg-slate-950/60 hover:bg-slate-900 border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-bold mb-1">
                    <span className="text-white flex items-center gap-1.5">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: s.accentHex }}
                      />
                      {s.name}
                      {s.id === 'tamil' && (
                        <span className="text-[10px] text-amber-300">(தமிழ்)</span>
                      )}
                    </span>
                    <span className="font-mono text-slate-200 tabular-nums">{avg}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${avg}%`,
                        backgroundColor: s.accentHex,
                        boxShadow: `0 0 8px ${s.accentHex}`,
                      }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

