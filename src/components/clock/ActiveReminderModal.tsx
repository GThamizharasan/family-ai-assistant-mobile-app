import React, { useEffect } from 'react';
import {
  Bell,
  Clock,
  CheckCircle2,
  Moon,
  Volume2,
  X,
  Users,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';
import { ClockReminder } from '../../types/clock';
import { audioAlarmEngine } from '../../services/audioAlarmSynthesizer';
import { REMINDER_CATEGORIES } from '../../services/reminderDriveSync';

interface ActiveReminderModalProps {
  reminder: ClockReminder | null;
  onComplete: (reminder: ClockReminder) => void;
  onSnooze: (reminder: ClockReminder, minutes?: number) => void;
  onDismiss: () => void;
}

export const ActiveReminderModal: React.FC<ActiveReminderModalProps> = ({
  reminder,
  onComplete,
  onSnooze,
  onDismiss,
}) => {
  useEffect(() => {
    if (reminder) {
      audioAlarmEngine.startAlarm(reminder.sound || 'gentle', 0.85);
    } else {
      audioAlarmEngine.stopAlarm();
    }

    return () => {
      audioAlarmEngine.stopAlarm();
    };
  }, [reminder]);

  if (!reminder) return null;

  const categoryMeta = REMINDER_CATEGORIES.find((c) => c.id === reminder.category);

  const isUrgent = reminder.priority === 'urgent' || reminder.priority === 'high';

  return (
    <div
      className="fixed inset-0 z-[120] bg-slate-950/95 backdrop-blur-2xl flex flex-col items-center justify-between p-6 select-none animate-in fade-in zoom-in-95 duration-300"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="active-reminder-title"
    >
      {/* Top Header */}
      <div className="w-full max-w-md flex items-center justify-between text-slate-400 text-xs font-semibold pt-4">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-400 animate-spin" />
          <span className="text-white font-bold">Auro Family Circle Reminder</span>
        </div>
        <div className="flex items-center gap-2">
          {isUrgent && (
            <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-black uppercase tracking-wider animate-pulse">
              <AlertTriangle className="w-3 h-3" />
              {reminder.priority}
            </span>
          )}
          <button
            onClick={onDismiss}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Dismiss notification"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Reminder Card */}
      <div className="flex flex-col items-center justify-center my-auto text-center space-y-6 max-w-md w-full px-4">
        {/* Pulsing Bell Icon with Gradient Glow */}
        <div className="relative">
          <div
            className={`w-28 h-28 rounded-3xl flex items-center justify-center shadow-2xl transition-all animate-pulse ${
              isUrgent
                ? 'bg-gradient-to-tr from-rose-500/30 to-amber-500/30 border-2 border-rose-500/50 shadow-rose-500/30'
                : 'bg-gradient-to-tr from-amber-500/30 to-indigo-500/30 border-2 border-amber-500/50 shadow-amber-500/30'
            }`}
          >
            <Bell
              className={`w-14 h-14 animate-bounce ${
                isUrgent ? 'text-rose-400' : 'text-amber-400'
              }`}
            />
          </div>
          <div className="absolute inset-0 rounded-3xl border border-amber-400/40 animate-ping pointer-events-none" />
        </div>

        {/* Category & Family Member Pills */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          <span
            className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${
              categoryMeta?.bgBadge || 'bg-amber-500/10 text-amber-300 border-amber-500/30'
            }`}
          >
            <Sparkles className="w-3 h-3" />
            {categoryMeta?.label || reminder.category}
          </span>

          {reminder.familyMember && (
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 flex items-center gap-1.5">
              <Users className="w-3 h-3" />
              For: {reminder.familyMember}
            </span>
          )}
        </div>

        {/* Title and Notes */}
        <div className="space-y-3">
          <h2
            id="active-reminder-title"
            className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-snug"
          >
            {reminder.title}
          </h2>

          {reminder.notes && (
            <p className="text-sm text-slate-300 bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800 text-left leading-relaxed">
              {reminder.notes}
            </p>
          )}

          <div className="flex items-center justify-center gap-3 text-xs text-slate-400 pt-1">
            <span className="flex items-center gap-1 font-mono text-amber-300 font-bold text-sm">
              <Clock className="w-4 h-4 text-amber-400" />
              {reminder.dueTime}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Volume2 className="w-3.5 h-3.5 text-slate-400" />
              Tone: {reminder.sound?.toUpperCase() || 'GENTLE'}
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Actions: Complete, Snooze, Dismiss */}
      <div className="w-full max-w-md flex flex-col gap-3 pb-6">
        <button
          onClick={() => {
            audioAlarmEngine.stopAlarm();
            onComplete(reminder);
          }}
          className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-white font-extrabold text-base flex items-center justify-center gap-2.5 shadow-xl shadow-emerald-600/30 transition-transform active:scale-95"
        >
          <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
          <span>Mark as Completed</span>
        </button>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => {
              audioAlarmEngine.stopAlarm();
              onSnooze(reminder, 10);
            }}
            className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm flex items-center justify-center gap-2 border border-slate-700 shadow-md transition-transform active:scale-95"
          >
            <Moon className="w-4 h-4 text-indigo-400" />
            <span>Snooze (10m)</span>
          </button>

          <button
            onClick={() => {
              audioAlarmEngine.stopAlarm();
              onDismiss();
            }}
            className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-sm flex items-center justify-center gap-2 border border-slate-700 shadow-md transition-transform active:scale-95"
          >
            <X className="w-4 h-4 text-slate-400" />
            <span>Dismiss</span>
          </button>
        </div>
      </div>
    </div>
  );
};

