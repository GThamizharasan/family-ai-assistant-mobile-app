import React, { useEffect } from 'react';
import { Bell, Clock, Volume2, Moon, Check } from 'lucide-react';
import { Alarm } from '../../types/clock';
import { audioAlarmEngine } from '../../services/audioAlarmSynthesizer';

interface ActiveAlarmModalProps {
  ringingAlarm: Alarm | null;
  onStop: () => void;
  onSnooze: (alarm: Alarm) => void;
}

export const ActiveAlarmModal: React.FC<ActiveAlarmModalProps> = ({
  ringingAlarm,
  onStop,
  onSnooze,
}) => {
  useEffect(() => {
    if (ringingAlarm) {
      audioAlarmEngine.startAlarm(ringingAlarm.sound || 'radar');
    } else {
      audioAlarmEngine.stopAlarm();
    }

    return () => {
      audioAlarmEngine.stopAlarm();
    };
  }, [ringingAlarm]);

  if (!ringingAlarm) return null;

  const nowTime = new Date().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div
      className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-2xl flex flex-col items-center justify-between p-6 select-none animate-in fade-in zoom-in-95 duration-300"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="ringing-alarm-label"
    >
      {/* Top Header */}
      <div className="w-full flex items-center justify-between text-slate-400 text-xs font-semibold pt-4">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-400 animate-spin" />
          <span>Auro Smart Alarm</span>
        </div>
        <div className="px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[10px] uppercase font-bold tracking-wider">
          Ringing
        </div>
      </div>

      {/* Center Alarm Pulsing Display */}
      <div className="flex flex-col items-center justify-center my-auto text-center space-y-6">
        {/* Pulsing Bell Icon */}
        <div className="relative">
          <div className="w-32 h-32 rounded-full bg-gradient-to-tr from-amber-500/20 to-rose-500/20 border-2 border-amber-500/40 flex items-center justify-center shadow-2xl shadow-amber-500/30 animate-pulse">
            <Bell className="w-16 h-16 text-amber-400 animate-bounce" />
          </div>
          <div className="absolute inset-0 rounded-full border border-amber-400/30 animate-ping pointer-events-none" />
        </div>

        {/* Digital Time Readout */}
        <div className="space-y-1">
          <div className="text-6xl sm:text-7xl font-extrabold tracking-tight text-white font-mono">
            {nowTime}
          </div>
          <div
            id="ringing-alarm-label"
            className="text-xl sm:text-2xl font-bold text-amber-300 capitalize"
          >
            {ringingAlarm.label || 'Morning Alarm'}
          </div>
          <div className="text-xs text-slate-400 flex items-center justify-center gap-1.5 pt-1">
            <Volume2 className="w-3.5 h-3.5 text-amber-400" />
            <span>Tone: {ringingAlarm.sound.toUpperCase()}</span>
          </div>
        </div>
      </div>

      {/* Bottom Actions: Snooze & Stop */}
      <div className="w-full max-w-sm flex flex-col gap-3 pb-8">
        {ringingAlarm.snoozeEnabled && (
          <button
            onClick={() => onSnooze(ringingAlarm)}
            className="w-full py-4 px-6 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-base flex items-center justify-center gap-2.5 border border-slate-700 shadow-lg transition-transform active:scale-95"
            aria-label={`Snooze alarm for ${ringingAlarm.snoozeMinutes || 9} minutes`}
          >
            <Moon className="w-5 h-5 text-indigo-400" />
            <span>Snooze ({ringingAlarm.snoozeMinutes || 9}m)</span>
          </button>
        )}

        <button
          onClick={onStop}
          className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-600 text-white font-extrabold text-lg flex items-center justify-center gap-2.5 shadow-2xl shadow-rose-600/40 transition-transform active:scale-95"
          aria-label="Stop alarm"
        >
          <Check className="w-6 h-6 stroke-[3]" />
          <span>Stop Alarm</span>
        </button>
      </div>
    </div>
  );
};
