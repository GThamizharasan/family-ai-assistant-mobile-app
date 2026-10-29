export type AlarmSound = 'radar' | 'gentle' | 'cosmic' | 'dawn' | 'digital';

export interface Alarm {
  id: string;
  time: string; // "HH:mm" in 24h format e.g. "07:00"
  label: string;
  enabled: boolean;
  repeatDays: number[]; // 0 = Sun, 1 = Mon, ..., 6 = Sat. Empty = once
  sound: AlarmSound;
  snoozeEnabled: boolean;
  snoozeMinutes: number;
  lastTriggeredDate?: string; // YYYY-MM-DD
}

export interface WorldCity {
  id: string;
  cityName: string;
  country: string;
  timezone: string;
  flag: string;
  isPrimary?: boolean;
}

export interface LapRecord {
  lapNumber: number;
  lapTimeMs: number;
  overallTimeMs: number;
  isFastest?: boolean;
  isSlowest?: boolean;
}

export type ClockSubTab = 'world' | 'alarm' | 'stopwatch' | 'timer';
