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

export type ClockSubTab = 'world' | 'alarm' | 'stopwatch' | 'timer' | 'reminder';

export type ReminderCategory =
  | 'family'
  | 'personal'
  | 'health'
  | 'medical'
  | 'medication'
  | 'work'
  | 'school'
  | 'finance'
  | 'tradition'
  | 'celebration'
  | 'general';

export type ReminderPriority = 'low' | 'normal' | 'medium' | 'high' | 'urgent';

export interface ClockReminder {
  id: string;
  title: string;
  notes?: string;
  dueDate: string; // "YYYY-MM-DD"
  dueTime: string; // "HH:mm" in 24h format e.g. "09:30"
  category: ReminderCategory;
  priority: ReminderPriority;
  targetFamilyMember?: string; // e.g. "All Family Circle", "Chinnathambi", "Selvi"
  familyMember?: string;
  sound?: AlarmSound;
  voiceAlert?: boolean;
  enabled: boolean;
  completed: boolean;
  notified?: boolean;
  repeat?: 'none' | 'daily' | 'weekly' | 'monthly';
  createdBy?: string;
  userEmail?: string;
  createdAt: string;
  updatedAt: string;
  driveSyncStatus?: 'synced' | 'pending' | 'local_only' | 'error';
  driveFileId?: string;
  driveWebViewLink?: string;
  driveFolderPath?: string;
}
