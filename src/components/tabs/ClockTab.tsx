import React, { useState, useEffect, useRef } from 'react';
import {
  Clock,
  Bell,
  Timer,
  Play,
  Pause,
  RotateCcw,
  Plus,
  Trash2,
  Edit2,
  Moon,
  Sun,
  Globe,
  Volume2,
  VolumeX,
  Check,
  ChevronRight,
  X,
  Sparkles,
  Search,
  BellRing,
  Calendar,
  CheckCircle2,
  RefreshCw,
  Cloud,
  Users,
  AlertCircle,
  Tag,
} from 'lucide-react';
import { Alarm, WorldCity, LapRecord, ClockSubTab, AlarmSound, ClockReminder, ReminderCategory, ReminderPriority } from '../../types/clock';
import { audioAlarmEngine } from '../../services/audioAlarmSynthesizer';
import { useApp } from '../../context/AppContext';
import {
  getLocalReminders,
  saveLocalReminders,
  syncRemindersWithGoogleDrive,
  createReminder,
  toggleReminder,
  completeReminder,
  deleteReminder,
  REMINDER_CATEGORIES,
  DEFAULT_FAMILY_MEMBERS,
} from '../../services/reminderDriveSync';

const ALARMS_STORAGE_KEY = 'aura_alarms_v1';
const CITIES_STORAGE_KEY = 'aura_world_cities_v1';

const DEFAULT_CITIES: WorldCity[] = [
  {
    id: 'london',
    cityName: 'London',
    country: 'United Kingdom',
    timezone: 'Europe/London',
    flag: '🇬🇧',
    isPrimary: true,
  },
  {
    id: 'chennai',
    cityName: 'Chennai',
    country: 'India',
    timezone: 'Asia/Kolkata',
    flag: '🇮🇳',
    isPrimary: true,
  },
  {
    id: 'newyork',
    cityName: 'New York',
    country: 'United States',
    timezone: 'America/New_York',
    flag: '🇺🇸',
  },
  {
    id: 'tokyo',
    cityName: 'Tokyo',
    country: 'Japan',
    timezone: 'Asia/Tokyo',
    flag: '🇯🇵',
  },
  {
    id: 'dubai',
    cityName: 'Dubai',
    country: 'United Arab Emirates',
    timezone: 'Asia/Dubai',
    flag: '🇦🇪',
  },
];

const AVAILABLE_GLOBAL_CITIES: WorldCity[] = [
  { id: 'london', cityName: 'London', country: 'United Kingdom', timezone: 'Europe/London', flag: '🇬🇧' },
  { id: 'chennai', cityName: 'Chennai', country: 'India', timezone: 'Asia/Kolkata', flag: '🇮🇳' },
  { id: 'newyork', cityName: 'New York', country: 'United States', timezone: 'America/New_York', flag: '🇺🇸' },
  { id: 'tokyo', cityName: 'Tokyo', country: 'Japan', timezone: 'Asia/Tokyo', flag: '🇯🇵' },
  { id: 'dubai', cityName: 'Dubai', country: 'United Arab Emirates', timezone: 'Asia/Dubai', flag: '🇦🇪' },
  { id: 'paris', cityName: 'Paris', country: 'France', timezone: 'Europe/Paris', flag: '🇫🇷' },
  { id: 'singapore', cityName: 'Singapore', country: 'Singapore', timezone: 'Asia/Singapore', flag: '🇸🇬' },
  { id: 'sydney', cityName: 'Sydney', country: 'Australia', timezone: 'Australia/Sydney', flag: '🇦🇺' },
  { id: 'sanfrancisco', cityName: 'San Francisco', country: 'United States', timezone: 'America/Los_Angeles', flag: '🇺🇸' },
  { id: 'toronto', cityName: 'Toronto', country: 'Canada', timezone: 'America/Toronto', flag: '🇨🇦' },
  { id: 'berlin', cityName: 'Berlin', country: 'Germany', timezone: 'Europe/Berlin', flag: '🇩🇪' },
  { id: 'mumbai', cityName: 'Mumbai', country: 'India', timezone: 'Asia/Kolkata', flag: '🇮🇳' },
];

const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const ClockTab: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<ClockSubTab>('world');
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  // -------------------------------------------------------------
  // WORLD CLOCK STATE
  // -------------------------------------------------------------
  const [worldCities, setWorldCities] = useState<WorldCity[]>(() => {
    try {
      const saved = localStorage.getItem(CITIES_STORAGE_KEY);
      return saved ? JSON.parse(saved) : DEFAULT_CITIES;
    } catch {
      return DEFAULT_CITIES;
    }
  });
  const [isAddCityOpen, setIsAddCityOpen] = useState(false);
  const [citySearchQuery, setCitySearchQuery] = useState('');

  // -------------------------------------------------------------
  // ALARMS STATE
  // -------------------------------------------------------------
  const [alarms, setAlarms] = useState<Alarm[]>(() => {
    try {
      const saved = localStorage.getItem(ALARMS_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      {
        id: 'alarm_1',
        time: '06:30',
        label: 'Family Morning Wellness & Meditation',
        enabled: true,
        repeatDays: [1, 2, 3, 4, 5],
        sound: 'radar',
        snoozeEnabled: true,
        snoozeMinutes: 9,
      },
      {
        id: 'alarm_2',
        time: '08:00',
        label: 'School & IIT Madras STEM Routine',
        enabled: true,
        repeatDays: [1, 2, 3, 4, 5],
        sound: 'gentle',
        snoozeEnabled: true,
        snoozeMinutes: 5,
      },
      {
        id: 'alarm_3',
        time: '21:30',
        label: 'Evening Family Call & Gratitude',
        enabled: false,
        repeatDays: [0, 1, 2, 3, 4, 5, 6],
        sound: 'dawn',
        snoozeEnabled: true,
        snoozeMinutes: 10,
      },
    ];
  });

  const [isEditAlarmModalOpen, setIsEditAlarmModalOpen] = useState(false);
  const [editingAlarm, setEditingAlarm] = useState<Alarm | null>(null);

  const { user, googleAccessToken } = useApp();

  // -------------------------------------------------------------
  // REMINDERS STATE & GOOGLE DRIVE SYNC
  // -------------------------------------------------------------
  const [reminders, setReminders] = useState<ClockReminder[]>(() => getLocalReminders());
  const [reminderFilter, setReminderFilter] = useState<'all' | 'today' | 'family' | 'completed'>('all');
  const [reminderSearchQuery, setReminderSearchQuery] = useState('');
  const [isSyncingDrive, setIsSyncingDrive] = useState(false);
  const [isAddReminderOpen, setIsAddReminderOpen] = useState(false);
  const [editingReminder, setEditingReminder] = useState<ClockReminder | null>(null);

  const [reminderForm, setReminderForm] = useState<{
    title: string;
    notes: string;
    dueDate: string;
    dueTime: string;
    category: ReminderCategory;
    priority: ReminderPriority;
    familyMember: string;
    sound: AlarmSound;
    voiceAlert: boolean;
  }>({
    title: '',
    notes: '',
    dueDate: new Date().toISOString().split('T')[0],
    dueTime: '18:00',
    category: 'family',
    priority: 'normal',
    familyMember: 'All Family Circle',
    sound: 'gentle',
    voiceAlert: true,
  });

  const handleSyncWithDrive = async () => {
    setIsSyncingDrive(true);
    try {
      const res = await syncRemindersWithGoogleDrive(googleAccessToken, user?.email || undefined);
      setReminders(res.reminders);
    } finally {
      setIsSyncingDrive(false);
    }
  };

  useEffect(() => {
    // 1. Initial load from local cache
    setReminders(getLocalReminders());

    // 2. Fetch latest from SQLite & Google Drive
    void handleSyncWithDrive();

    // 3. Listen to instant reactive reminder updates from Voice Assistant or other components
    const handleRemindersUpdate = (e: any) => {
      if (e.detail && Array.isArray(e.detail)) {
        setReminders(e.detail);
      } else {
        setReminders(getLocalReminders());
      }
    };

    window.addEventListener('aura_reminders_changed', handleRemindersUpdate);
    window.addEventListener('storage', handleRemindersUpdate);

    return () => {
      window.removeEventListener('aura_reminders_changed', handleRemindersUpdate);
      window.removeEventListener('storage', handleRemindersUpdate);
    };
  }, [googleAccessToken]);

  const handleOpenAddReminder = () => {
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    now.setHours(now.getHours() + 1, 0, 0, 0);
    const defaultTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    setEditingReminder(null);
    setReminderForm({
      title: '',
      notes: '',
      dueDate: today,
      dueTime: defaultTime,
      category: 'family',
      priority: 'normal',
      familyMember: 'All Family Circle',
      sound: 'gentle',
      voiceAlert: true,
    });
    setIsAddReminderOpen(true);
  };

  const handleOpenEditReminder = (rem: ClockReminder) => {
    setEditingReminder(rem);
    setReminderForm({
      title: rem.title,
      notes: rem.notes || '',
      dueDate: rem.dueDate,
      dueTime: rem.dueTime,
      category: rem.category,
      priority: rem.priority,
      familyMember: rem.familyMember || 'All Family Circle',
      sound: rem.sound || 'gentle',
      voiceAlert: rem.voiceAlert !== false,
    });
    setIsAddReminderOpen(true);
  };

  const handleSaveReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reminderForm.title.trim() || !reminderForm.dueTime) return;

    if (editingReminder) {
      const updated: ClockReminder = {
        ...editingReminder,
        title: reminderForm.title.trim(),
        notes: reminderForm.notes.trim(),
        dueDate: reminderForm.dueDate,
        dueTime: reminderForm.dueTime,
        category: reminderForm.category,
        priority: reminderForm.priority,
        familyMember: reminderForm.familyMember,
        sound: reminderForm.sound,
        voiceAlert: reminderForm.voiceAlert,
        updatedAt: new Date().toISOString(),
      };
      const list = reminders.map((r) => (r.id === editingReminder.id ? updated : r));
      setReminders(list);
      saveLocalReminders(list);
      setIsAddReminderOpen(false);
      setEditingReminder(null);
      if (googleAccessToken) {
        void syncRemindersWithGoogleDrive(googleAccessToken, user?.email || undefined);
      }
    } else {
      const created = await createReminder(
        reminderForm,
        googleAccessToken,
        user?.email || undefined
      );
      setReminders((prev) => [created, ...prev.filter((r) => r.id !== created.id)]);
      setIsAddReminderOpen(false);
    }
  };

  const handleToggleReminderItem = async (id: string) => {
    const updated = await toggleReminder(id, googleAccessToken, user?.email || undefined);
    if (updated) {
      setReminders((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, enabled: updated.enabled, notified: updated.notified } : r
        )
      );
    }
  };

  const handleCompleteReminderItem = async (id: string) => {
    const updated = await completeReminder(id, googleAccessToken, user?.email || undefined);
    if (updated) {
      setReminders((prev) => prev.map((r) => (r.id === id ? { ...r, completed: true } : r)));
    }
  };

  const handleDeleteReminderItem = async (id: string) => {
    await deleteReminder(id, googleAccessToken, user?.email || undefined);
    setReminders((prev) => prev.filter((r) => r.id !== id));
  };

  // -------------------------------------------------------------
  // STOPWATCH STATE
  // -------------------------------------------------------------
  const [stopwatchTimeMs, setStopwatchTimeMs] = useState(0);
  const [isStopwatchRunning, setIsStopwatchRunning] = useState(false);
  const [laps, setLaps] = useState<LapRecord[]>([]);
  const stopwatchIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastLapTimeRef = useRef<number>(0);

  // -------------------------------------------------------------
  // TIMER STATE
  // -------------------------------------------------------------
  const [timerDurationSec, setTimerDurationSec] = useState<number>(300); // 5 min default
  const [timerRemainingSec, setTimerRemainingSec] = useState<number>(300);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [timerDoneNotice, setTimerDoneNotice] = useState(false);

  // Live Clock Tick
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Save Alarms to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(ALARMS_STORAGE_KEY, JSON.stringify(alarms));
    } catch {}
  }, [alarms]);

  // Save Cities to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(CITIES_STORAGE_KEY, JSON.stringify(worldCities));
    } catch {}
  }, [worldCities]);

  // Stopwatch interval
  useEffect(() => {
    if (isStopwatchRunning) {
      const startTime = Date.now() - stopwatchTimeMs;
      stopwatchIntervalRef.current = setInterval(() => {
        setStopwatchTimeMs(Date.now() - startTime);
      }, 10);
    } else if (stopwatchIntervalRef.current) {
      clearInterval(stopwatchIntervalRef.current);
    }
    return () => {
      if (stopwatchIntervalRef.current) clearInterval(stopwatchIntervalRef.current);
    };
  }, [isStopwatchRunning]);

  // Timer interval
  useEffect(() => {
    if (isTimerRunning) {
      timerIntervalRef.current = setInterval(() => {
        setTimerRemainingSec((prev) => {
          if (prev <= 1) {
            clearInterval(timerIntervalRef.current!);
            setIsTimerRunning(false);
            audioAlarmEngine.playTimerFinishAlert();
            setTimerDoneNotice(true);
            setTimeout(() => setTimerDoneNotice(false), 5000);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [isTimerRunning]);

  // -------------------------------------------------------------
  // ALARM HANDLERS
  // -------------------------------------------------------------
  const handleToggleAlarm = (id: string) => {
    setAlarms((prev) =>
      prev.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a))
    );
  };

  const handleDeleteAlarm = (id: string) => {
    setAlarms((prev) => prev.filter((a) => a.id !== id));
  };

  const handleOpenAddAlarm = () => {
    setEditingAlarm({
      id: `alarm_${Date.now()}`,
      time: '07:00',
      label: 'Alarm',
      enabled: true,
      repeatDays: [1, 2, 3, 4, 5],
      sound: 'radar',
      snoozeEnabled: true,
      snoozeMinutes: 9,
    });
    setIsEditAlarmModalOpen(true);
  };

  const handleOpenEditAlarm = (alarm: Alarm) => {
    setEditingAlarm({ ...alarm });
    setIsEditAlarmModalOpen(true);
  };

  const handleSaveAlarm = () => {
    if (!editingAlarm) return;
    setAlarms((prev) => {
      const exists = prev.some((a) => a.id === editingAlarm.id);
      if (exists) {
        return prev.map((a) => (a.id === editingAlarm.id ? editingAlarm : a));
      }
      return [...prev, editingAlarm].sort((a, b) => a.time.localeCompare(b.time));
    });
    setIsEditAlarmModalOpen(false);
    setEditingAlarm(null);
  };

  // -------------------------------------------------------------
  // STOPWATCH HANDLERS
  // -------------------------------------------------------------
  const handleStartStopwatch = () => {
    setIsStopwatchRunning(true);
  };

  const handleStopStopwatch = () => {
    setIsStopwatchRunning(false);
  };

  const handleResetStopwatch = () => {
    setIsStopwatchRunning(false);
    setStopwatchTimeMs(0);
    setLaps([]);
    lastLapTimeRef.current = 0;
  };

  const handleRecordLap = () => {
    const currentTotal = stopwatchTimeMs;
    const lapTime = currentTotal - lastLapTimeRef.current;
    lastLapTimeRef.current = currentTotal;

    const newLap: LapRecord = {
      lapNumber: laps.length + 1,
      lapTimeMs: lapTime,
      overallTimeMs: currentTotal,
    };

    const nextLaps = [newLap, ...laps];

    // Recalculate fastest and slowest
    if (nextLaps.length >= 2) {
      let fastestIndex = 0;
      let slowestIndex = 0;
      for (let i = 1; i < nextLaps.length; i++) {
        if (nextLaps[i].lapTimeMs < nextLaps[fastestIndex].lapTimeMs) fastestIndex = i;
        if (nextLaps[i].lapTimeMs > nextLaps[slowestIndex].lapTimeMs) slowestIndex = i;
      }
      nextLaps.forEach((l, idx) => {
        l.isFastest = idx === fastestIndex;
        l.isSlowest = idx === slowestIndex;
      });
    }

    setLaps(nextLaps);
  };

  const formatStopwatch = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const hundredths = Math.floor((ms % 1000) / 10);
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(
      hundredths
    ).padStart(2, '0')}`;
  };

  // -------------------------------------------------------------
  // TIMER HANDLERS
  // -------------------------------------------------------------
  const handleStartTimer = () => {
    if (timerRemainingSec === 0) {
      setTimerRemainingSec(timerDurationSec);
    }
    setIsTimerRunning(true);
  };

  const handlePauseTimer = () => {
    setIsTimerRunning(false);
  };

  const handleResetTimer = () => {
    setIsTimerRunning(false);
    setTimerRemainingSec(timerDurationSec);
  };

  const handleSelectPreset = (sec: number) => {
    setIsTimerRunning(false);
    setTimerDurationSec(sec);
    setTimerRemainingSec(sec);
  };

  const formatTimer = (sec: number) => {
    const hours = Math.floor(sec / 3600);
    const minutes = Math.floor((sec % 3600) / 60);
    const seconds = sec % 60;
    if (hours > 0) {
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(
        seconds
      ).padStart(2, '0')}`;
    }
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  // Time in specific timezone
  const getTimeInZone = (tz: string) => {
    try {
      const timeStr = currentTime.toLocaleTimeString([], {
        timeZone: tz,
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
      const dateStr = currentTime.toLocaleDateString([], {
        timeZone: tz,
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });

      // Hour in target zone to determine day/night
      const hourInt = parseInt(
        currentTime.toLocaleTimeString([], { timeZone: tz, hour: 'numeric', hour12: false }),
        10
      );
      const isDay = hourInt >= 6 && hourInt < 19;

      return { timeStr, dateStr, isDay };
    } catch {
      return { timeStr: '--:--', dateStr: '', isDay: true };
    }
  };

  // Relative hour difference
  const getOffsetString = (tz: string) => {
    try {
      const localDate = new Date();
      const localUtc = localDate.getTime() + localDate.getTimezoneOffset() * 60000;
      const targetStr = localDate.toLocaleString('en-US', { timeZone: tz });
      const targetDate = new Date(targetStr);
      const diffHours = (targetDate.getTime() - localDate.getTime()) / 3600000;
      const rounded = Math.round(diffHours * 10) / 10;
      if (rounded === 0) return 'Same as local time';
      return `${rounded > 0 ? `+${rounded}` : `${rounded}`} HRS`;
    } catch {
      return '';
    }
  };

  return (
    <div className="space-y-6 pb-28 pt-2">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/80 border border-slate-800 p-4 rounded-3xl shadow-xl backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-600 flex items-center justify-center text-slate-950 font-bold shadow-lg shadow-amber-500/20">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold tracking-tight text-white">Clock & Alarm</h1>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold">
                Sovereign Precision
              </span>
            </div>
            <p className="text-xs text-slate-400">
              World time synchronization, smart alarm engine, stopwatch & timer
            </p>
          </div>
        </div>

        {/* SubTab Navigation Switcher */}
        <div className="flex items-center bg-slate-950/80 p-1 rounded-2xl border border-slate-800 self-start sm:self-auto overflow-x-auto max-w-full">
          {[
            { id: 'world' as ClockSubTab, label: 'World', icon: Globe },
            { id: 'alarm' as ClockSubTab, label: 'Alarms', icon: Bell },
            {
              id: 'reminder' as ClockSubTab,
              label: 'Reminders',
              icon: BellRing,
              badge: reminders.filter((r) => r.enabled && !r.completed).length,
            },
            { id: 'stopwatch' as ClockSubTab, label: 'Stopwatch', icon: Clock },
            { id: 'timer' as ClockSubTab, label: 'Timer', icon: Timer },
          ].map((tab) => {
            const Icon = tab.icon;
            const isSel = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id)}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all whitespace-nowrap ${
                  isSel
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                      isSel ? 'bg-slate-950 text-amber-400' : 'bg-amber-500/20 text-amber-300'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* =========================================================================
          TAB 1: WORLD CLOCK
      ========================================================================= */}
      {activeSubTab === 'world' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Local Digital Hero Banner */}
          <div className="p-6 rounded-3xl bg-gradient-to-br from-slate-900/90 via-slate-900/70 to-slate-950 border border-slate-800 text-center relative overflow-hidden shadow-2xl">
            <div className="absolute top-3 right-4 flex items-center gap-1 text-[11px] text-amber-400 font-semibold bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/30">
              <Sun className="w-3.5 h-3.5" />
              <span>Current Device Time</span>
            </div>

            <div className="text-5xl sm:text-6xl font-extrabold text-white font-mono tracking-tight my-2">
              {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
            <div className="text-xs text-slate-400 font-medium">
              {currentTime.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </div>
          </div>

          {/* World Cities Header & Add Button */}
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider">
              Family Global Cities ({worldCities.length})
            </h2>
            <button
              onClick={() => setIsAddCityOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-semibold flex items-center gap-1 border border-slate-700 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add City</span>
            </button>
          </div>

          {/* Cities Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {worldCities.map((city) => {
              const { timeStr, dateStr, isDay } = getTimeInZone(city.timezone);
              const offset = getOffsetString(city.timezone);

              return (
                <div
                  key={city.id}
                  className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 hover:border-slate-700 transition-all flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{city.flag}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm">{city.cityName}</span>
                        {city.isPrimary && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold">
                            PRIMARY
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                        <span>{offset}</span>
                        <span>•</span>
                        <span>{dateStr}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-lg font-bold text-white font-mono">{timeStr}</div>
                      <div className="text-[10px] text-slate-400 flex items-center justify-end gap-1">
                        {isDay ? (
                          <Sun className="w-3 h-3 text-amber-400" />
                        ) : (
                          <Moon className="w-3 h-3 text-indigo-400" />
                        )}
                        <span>{isDay ? 'Day' : 'Night'}</span>
                      </div>
                    </div>

                    {!city.isPrimary && (
                      <button
                        onClick={() =>
                          setWorldCities((prev) => prev.filter((c) => c.id !== city.id))
                        }
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-all"
                        title="Remove city"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: ALARMS
      ========================================================================= */}
      {activeSubTab === 'alarm' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between px-1">
            <div>
              <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider">
                Smart Alarms ({alarms.length})
              </h2>
              <p className="text-xs text-slate-500">Continuous Web Audio ringtone & snooze</p>
            </div>
            <button
              onClick={handleOpenAddAlarm}
              className="px-3.5 py-2 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-amber-500/20 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>New Alarm</span>
            </button>
          </div>

          <div className="space-y-3">
            {alarms.map((alarm) => {
              const repeatLabel =
                alarm.repeatDays.length === 7
                  ? 'Every day'
                  : alarm.repeatDays.length === 5 &&
                    alarm.repeatDays.includes(1) &&
                    alarm.repeatDays.includes(5)
                  ? 'Weekdays'
                  : alarm.repeatDays.length === 2 &&
                    alarm.repeatDays.includes(0) &&
                    alarm.repeatDays.includes(6)
                  ? 'Weekends'
                  : alarm.repeatDays.length === 0
                  ? 'Once'
                  : alarm.repeatDays.map((d) => DAYS_SHORT[d]).join(', ');

              return (
                <div
                  key={alarm.id}
                  className={`p-4 rounded-3xl border transition-all flex items-center justify-between ${
                    alarm.enabled
                      ? 'bg-slate-900/90 border-slate-700 shadow-xl'
                      : 'bg-slate-950/60 border-slate-800/80 opacity-60'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl sm:text-4xl font-extrabold text-white font-mono tracking-tight">
                        {alarm.time}
                      </span>
                      <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
                        {alarm.sound}
                      </span>
                    </div>

                    <div className="text-xs font-semibold text-slate-300">{alarm.label}</div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                      <span>{repeatLabel}</span>
                      {alarm.snoozeEnabled && (
                        <>
                          <span>•</span>
                          <span>Snooze {alarm.snoozeMinutes}m</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleOpenEditAlarm(alarm)}
                      className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                      title="Edit alarm"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleDeleteAlarm(alarm.id)}
                      className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                      title="Delete alarm"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    {/* Toggle Switch */}
                    <button
                      type="button"
                      onClick={() => handleToggleAlarm(alarm.id)}
                      className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        alarm.enabled ? 'bg-amber-500' : 'bg-slate-800'
                      }`}
                      aria-label="Toggle alarm status"
                    >
                      <span
                        className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                          alarm.enabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2.5: REMINDERS & FAMILY CIRCLE SYNC
      ========================================================================= */}
      {activeSubTab === 'reminder' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Top Status & Sync Banner */}
          <div className="p-4 rounded-3xl bg-gradient-to-br from-slate-900/90 to-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <BellRing className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white">Family Circle Reminders</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold flex items-center gap-1">
                    <Cloud className="w-2.5 h-2.5" />
                    Google Drive Synced
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  On-time voice & audio chime alerts synced with Family Circle/Reminders
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <button
                onClick={handleSyncWithDrive}
                disabled={isSyncingDrive}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-colors disabled:opacity-50"
                title="Sync with Family Circle/Reminders on Google Drive"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 text-amber-400 ${isSyncingDrive ? 'animate-spin' : ''}`}
                />
                <span>{isSyncingDrive ? 'Syncing...' : 'Sync Drive'}</span>
              </button>

              <button
                onClick={handleOpenAddReminder}
                className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-amber-500/20 transition-all active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>New Reminder</span>
              </button>
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Total', count: reminders.length, color: 'text-slate-200' },
              {
                label: 'Due Today',
                count: reminders.filter(
                  (r) => r.dueDate === new Date().toISOString().split('T')[0] && !r.completed
                ).length,
                color: 'text-amber-400',
              },
              {
                label: 'Family',
                count: reminders.filter((r) => r.category === 'family' && !r.completed).length,
                color: 'text-sky-400',
              },
              {
                label: 'Done',
                count: reminders.filter((r) => r.completed).length,
                color: 'text-emerald-400',
              },
            ].map((stat, idx) => (
              <div
                key={idx}
                className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800/80 text-center"
              >
                <div className={`text-lg font-black ${stat.color}`}>{stat.count}</div>
                <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>

          {/* Search & Filters */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Search reminders by title, notes, or family member..."
                value={reminderSearchQuery}
                onChange={(e) => setReminderSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
              />
              {reminderSearchQuery && (
                <button
                  onClick={() => setReminderSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-xl border border-slate-800 overflow-x-auto">
              {[
                { id: 'all' as const, label: 'All' },
                { id: 'today' as const, label: 'Today' },
                { id: 'family' as const, label: 'Family Circle' },
                { id: 'completed' as const, label: 'Completed' },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setReminderFilter(f.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                    reminderFilter === f.id
                      ? 'bg-amber-500 text-slate-950'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Reminders List */}
          {(() => {
            const todayStr = new Date().toISOString().split('T')[0];
            const filtered = reminders.filter((r) => {
              // Search filter
              if (reminderSearchQuery.trim()) {
                const q = reminderSearchQuery.toLowerCase();
                const matches =
                  r.title.toLowerCase().includes(q) ||
                  (r.notes && r.notes.toLowerCase().includes(q)) ||
                  (r.familyMember && r.familyMember.toLowerCase().includes(q));
                if (!matches) return false;
              }
              // Tab filter
              if (reminderFilter === 'today') return r.dueDate === todayStr && !r.completed;
              if (reminderFilter === 'family') return r.category === 'family' && !r.completed;
              if (reminderFilter === 'completed') return r.completed;
              return true;
            });

            if (filtered.length === 0) {
              return (
                <div className="p-8 rounded-3xl bg-slate-900/40 border border-slate-800 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto text-slate-500">
                    <BellRing className="w-6 h-6" />
                  </div>
                  <div className="text-sm font-bold text-slate-300">No Reminders Found</div>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    {reminderSearchQuery
                      ? 'No reminders match your query. Try searching for something else.'
                      : 'You do not have any reminders in this view. Create one or ask Auro Voice Assistant: "Remind me to..."'}
                  </p>
                  <button
                    onClick={handleOpenAddReminder}
                    className="mt-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold inline-flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create Reminder</span>
                  </button>
                </div>
              );
            }

            return (
              <div className="space-y-3">
                {filtered.map((rem) => {
                  const catMeta = REMINDER_CATEGORIES.find((c) => c.id === rem.category);
                  const isToday = rem.dueDate === todayStr;
                  const isPastDue =
                    !rem.completed &&
                    (rem.dueDate < todayStr ||
                      (rem.dueDate === todayStr &&
                        rem.dueTime <
                          `${String(new Date().getHours()).padStart(2, '0')}:${String(
                            new Date().getMinutes()
                          ).padStart(2, '0')}`));

                  return (
                    <div
                      key={rem.id}
                      className={`p-4 rounded-3xl border transition-all ${
                        rem.completed
                          ? 'bg-slate-950/40 border-slate-900 opacity-60'
                          : rem.enabled
                          ? 'bg-slate-900/90 border-slate-800 hover:border-slate-700 shadow-lg'
                          : 'bg-slate-900/40 border-slate-800/50 opacity-75'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        {/* Checkbox & Details */}
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <button
                            type="button"
                            onClick={() => handleCompleteReminderItem(rem.id)}
                            className={`mt-1 w-5 h-5 rounded-lg border flex items-center justify-center transition-colors shrink-0 ${
                              rem.completed
                                ? 'bg-emerald-500 border-emerald-500 text-slate-950'
                                : 'border-slate-700 hover:border-amber-400 text-transparent'
                            }`}
                            title={rem.completed ? 'Completed' : 'Mark as completed'}
                          >
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </button>

                          <div className="flex-1 min-w-0 space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`text-base font-bold text-white break-words ${
                                  rem.completed ? 'line-through text-slate-400' : ''
                                }`}
                              >
                                {rem.title}
                              </span>

                              {rem.priority === 'urgent' && (
                                <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-bold">
                                  URGENT
                                </span>
                              )}
                              {rem.priority === 'high' && (
                                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
                                  HIGH
                                </span>
                              )}
                            </div>

                            {rem.notes && (
                              <p className="text-xs text-slate-400 leading-relaxed break-words">
                                {rem.notes}
                              </p>
                            )}

                            {/* Tags row */}
                            <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
                              {/* Date & Time */}
                              <span
                                className={`flex items-center gap-1 font-mono font-semibold px-2 py-0.5 rounded-md ${
                                  isPastDue
                                    ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                    : isToday
                                    ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                                    : 'bg-slate-800 text-slate-300'
                                }`}
                              >
                                <Calendar className="w-3 h-3" />
                                {isToday ? 'Today' : rem.dueDate} at {rem.dueTime}
                              </span>

                              {/* Category */}
                              <span
                                className={`px-2 py-0.5 rounded-md border font-medium ${
                                  catMeta?.bgBadge || 'bg-slate-800 text-slate-300 border-slate-700'
                                }`}
                              >
                                {catMeta?.label || rem.category}
                              </span>

                              {/* Family Member */}
                              {rem.familyMember && (
                                <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-medium">
                                  <Users className="w-3 h-3" />
                                  {rem.familyMember}
                                </span>
                              )}

                              {/* Drive Sync Status */}
                              <span className="flex items-center gap-1 text-[10px] text-slate-500">
                                <Cloud className="w-3 h-3 text-emerald-400" />
                                Family Circle/Reminders
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Right Toggle & Actions */}
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => handleToggleReminderItem(rem.id)}
                            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                              rem.enabled ? 'bg-amber-500' : 'bg-slate-800'
                            }`}
                            title={rem.enabled ? 'Enabled' : 'Disabled'}
                          >
                            <span
                              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                                rem.enabled ? 'translate-x-5' : 'translate-x-0'
                              }`}
                            />
                          </button>

                          <button
                            onClick={() => handleOpenEditReminder(rem)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                            title="Edit reminder"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleDeleteReminderItem(rem.id)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                            title="Delete reminder"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* =========================================================================
          TAB 3: STOPWATCH
      ========================================================================= */}
      {activeSubTab === 'stopwatch' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Main Stopwatch Readout */}
          <div className="p-8 rounded-3xl bg-slate-900/80 border border-slate-800 text-center relative overflow-hidden shadow-2xl flex flex-col items-center justify-center min-h-[220px]">
            <div className="text-6xl sm:text-7xl font-extrabold text-white font-mono tracking-tight select-none">
              {formatStopwatch(stopwatchTimeMs)}
            </div>
            <div className="text-xs text-slate-400 mt-2 font-medium">
              Precision High-Resolution Milliseconds
            </div>
          </div>

          {/* Action Buttons: Lap & Start/Stop */}
          <div className="flex items-center justify-around max-w-sm mx-auto gap-4">
            {/* Lap / Reset button */}
            <button
              onClick={isStopwatchRunning ? handleRecordLap : handleResetStopwatch}
              disabled={stopwatchTimeMs === 0 && !isStopwatchRunning}
              className="w-20 h-20 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex flex-col items-center justify-center gap-1 border border-slate-700 shadow-xl transition-all disabled:opacity-40"
            >
              {isStopwatchRunning ? 'Lap' : 'Reset'}
            </button>

            {/* Start / Stop button */}
            <button
              onClick={isStopwatchRunning ? handleStopStopwatch : handleStartStopwatch}
              className={`w-20 h-20 rounded-full font-extrabold text-sm flex flex-col items-center justify-center gap-1 shadow-2xl transition-all ${
                isStopwatchRunning
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 hover:bg-rose-500/30'
                  : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30'
              }`}
            >
              {isStopwatchRunning ? 'Stop' : 'Start'}
            </button>
          </div>

          {/* Recorded Laps List */}
          {laps.length > 0 && (
            <div className="p-4 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-2 max-h-64 overflow-y-auto">
              <div className="flex items-center justify-between text-xs font-bold text-slate-400 border-b border-slate-800 pb-2 px-2">
                <span>Lap #</span>
                <span>Split</span>
                <span>Overall Time</span>
              </div>
              {laps.map((lap) => (
                <div
                  key={lap.lapNumber}
                  className={`flex items-center justify-between p-2 rounded-xl text-xs font-mono transition-colors ${
                    lap.isFastest
                      ? 'text-emerald-400 bg-emerald-500/10 font-bold'
                      : lap.isSlowest
                      ? 'text-rose-400 bg-rose-500/10 font-bold'
                      : 'text-slate-200 hover:bg-slate-800/40'
                  }`}
                >
                  <span>Lap {lap.lapNumber}</span>
                  <span>{formatStopwatch(lap.lapTimeMs)}</span>
                  <span>{formatStopwatch(lap.overallTimeMs)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 4: TIMER
      ========================================================================= */}
      {activeSubTab === 'timer' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Toast on timer finish */}
          {timerDoneNotice && (
            <div className="p-3 rounded-2xl bg-amber-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-xl animate-bounce">
              <Sparkles className="w-4 h-4" />
              <span>Timer Completed! Alert Sound Triggered.</span>
            </div>
          )}

          {/* Circular Countdown Ring Hero */}
          <div className="p-8 rounded-3xl bg-slate-900/80 border border-slate-800 text-center relative overflow-hidden shadow-2xl flex flex-col items-center justify-center min-h-[220px]">
            <div className="text-6xl sm:text-7xl font-extrabold text-white font-mono tracking-tight select-none">
              {formatTimer(timerRemainingSec)}
            </div>

            {/* Progress bar */}
            <div className="w-full max-w-xs h-2 bg-slate-800 rounded-full mt-4 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all duration-1000"
                style={{
                  width: `${
                    timerDurationSec > 0
                      ? Math.min(100, Math.max(0, (timerRemainingSec / timerDurationSec) * 100))
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>

          {/* Quick Presets */}
          <div className="space-y-2">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
              Quick Timer Presets
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {[
                { label: '1 min', sec: 60 },
                { label: '3 min', sec: 180 },
                { label: '5 min', sec: 300 },
                { label: '15 min', sec: 900 },
                { label: '25 min (Pomodoro)', sec: 1500 },
              ].map((p) => (
                <button
                  key={p.sec}
                  onClick={() => handleSelectPreset(p.sec)}
                  className={`p-2.5 rounded-2xl text-xs font-bold border transition-all ${
                    timerDurationSec === p.sec
                      ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20'
                      : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Action Buttons: Cancel & Start/Pause */}
          <div className="flex items-center justify-around max-w-sm mx-auto gap-4 pt-2">
            <button
              onClick={handleResetTimer}
              className="w-20 h-20 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex flex-col items-center justify-center gap-1 border border-slate-700 shadow-xl transition-all"
            >
              Cancel
            </button>

            <button
              onClick={isTimerRunning ? handlePauseTimer : handleStartTimer}
              className={`w-20 h-20 rounded-full font-extrabold text-sm flex flex-col items-center justify-center gap-1 shadow-2xl transition-all ${
                isTimerRunning
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 hover:bg-amber-500/30'
                  : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30'
              }`}
            >
              {isTimerRunning ? 'Pause' : 'Start'}
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: ADD WORLD CLOCK CITY
      ========================================================================= */}
      {isAddCityOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white text-base">Add World Clock City</h3>
              <button
                onClick={() => setIsAddCityOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={citySearchQuery}
                onChange={(e) => setCitySearchQuery(e.target.value)}
                placeholder="Search city or country..."
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* City list */}
            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              {AVAILABLE_GLOBAL_CITIES.filter(
                (c) =>
                  c.cityName.toLowerCase().includes(citySearchQuery.toLowerCase()) ||
                  c.country.toLowerCase().includes(citySearchQuery.toLowerCase())
              ).map((city) => {
                const alreadyAdded = worldCities.some((c) => c.id === city.id);
                return (
                  <button
                    key={city.id}
                    disabled={alreadyAdded}
                    onClick={() => {
                      if (!alreadyAdded) {
                        setWorldCities((prev) => [...prev, city]);
                        setIsAddCityOpen(false);
                      }
                    }}
                    className={`w-full p-2.5 rounded-xl flex items-center justify-between text-left transition-colors ${
                      alreadyAdded
                        ? 'opacity-40 cursor-not-allowed bg-slate-950/40'
                        : 'hover:bg-slate-800/80'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl">{city.flag}</span>
                      <div>
                        <div className="text-xs font-bold text-white">{city.cityName}</div>
                        <div className="text-[10px] text-slate-400">{city.country}</div>
                      </div>
                    </div>
                    {alreadyAdded ? (
                      <span className="text-[10px] text-slate-500">Added</span>
                    ) : (
                      <Plus className="w-4 h-4 text-amber-400" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: EDIT OR CREATE ALARM
      ========================================================================= */}
      {isEditAlarmModalOpen && editingAlarm && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <button
                onClick={() => setIsEditAlarmModalOpen(false)}
                className="text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <h3 className="font-bold text-white text-sm">Set Alarm</h3>
              <button
                onClick={handleSaveAlarm}
                className="text-xs font-bold text-amber-400 hover:text-amber-300"
              >
                Save
              </button>
            </div>

            {/* Time Picker */}
            <div className="flex justify-center py-2">
              <input
                type="time"
                value={editingAlarm.time}
                onChange={(e) => setEditingAlarm({ ...editingAlarm, time: e.target.value })}
                className="bg-slate-950 border border-slate-800 rounded-2xl px-6 py-3 text-3xl font-bold font-mono text-white text-center focus:outline-none focus:border-amber-500 shadow-inner"
              />
            </div>

            {/* Label input */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Alarm Label
              </label>
              <input
                type="text"
                value={editingAlarm.label}
                onChange={(e) => setEditingAlarm({ ...editingAlarm, label: e.target.value })}
                placeholder="e.g. Medicine Reminder, School Routine"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Repeat Days */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Repeat Days
              </label>
              <div className="flex justify-between gap-1">
                {DAYS_SHORT.map((day, idx) => {
                  const isSel = editingAlarm.repeatDays.includes(idx);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => {
                        const next = isSel
                          ? editingAlarm.repeatDays.filter((d) => d !== idx)
                          : [...editingAlarm.repeatDays, idx].sort();
                        setEditingAlarm({ ...editingAlarm, repeatDays: next });
                      }}
                      className={`w-8 h-8 rounded-full text-[11px] font-bold flex items-center justify-center transition-all ${
                        isSel
                          ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/25'
                          : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {day[0]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Sound Selector */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Alarm Sound Tone
                </label>
                <button
                  type="button"
                  onClick={() => audioAlarmEngine.playAlarmPulse(editingAlarm.sound)}
                  className="text-[10px] text-amber-400 hover:underline flex items-center gap-1"
                >
                  <Volume2 className="w-3 h-3" />
                  <span>Preview</span>
                </button>
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                {(['radar', 'gentle', 'cosmic', 'dawn', 'digital'] as AlarmSound[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setEditingAlarm({ ...editingAlarm, sound: s });
                      audioAlarmEngine.playAlarmPulse(s);
                    }}
                    className={`p-2 rounded-xl text-xs font-semibold capitalize border transition-all ${
                      editingAlarm.sound === s
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Snooze Switch */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-950 border border-slate-800">
              <div>
                <div className="text-xs font-bold text-white">Snooze</div>
                <div className="text-[10px] text-slate-400">Ring again in 9 minutes</div>
              </div>
              <input
                type="checkbox"
                checked={editingAlarm.snoozeEnabled}
                onChange={(e) =>
                  setEditingAlarm({ ...editingAlarm, snoozeEnabled: e.target.checked })
                }
                className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: ADD / EDIT REMINDER
      ========================================================================= */}
      {isAddReminderOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-5 sm:p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <BellRing className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-white text-base">
                  {editingReminder ? 'Edit Reminder' : 'New Family Reminder'}
                </h3>
              </div>
              <button
                onClick={() => {
                  setIsAddReminderOpen(false);
                  setEditingReminder(null);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveReminder} className="space-y-4">
              {/* Title */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">Reminder Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Grandma blood pressure check & medicine"
                  value={reminderForm.title}
                  onChange={(e) => setReminderForm({ ...reminderForm, title: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-300">Due Date</label>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          const today = new Date().toISOString().split('T')[0];
                          setReminderForm({ ...reminderForm, dueDate: today });
                        }}
                        className="text-[10px] text-amber-400 hover:underline"
                      >
                        Today
                      </button>
                      <span className="text-[10px] text-slate-600">|</span>
                      <button
                        type="button"
                        onClick={() => {
                          const tom = new Date();
                          tom.setDate(tom.getDate() + 1);
                          setReminderForm({
                            ...reminderForm,
                            dueDate: tom.toISOString().split('T')[0],
                          });
                        }}
                        className="text-[10px] text-amber-400 hover:underline"
                      >
                        Tmrw
                      </button>
                    </div>
                  </div>
                  <input
                    type="date"
                    required
                    value={reminderForm.dueDate}
                    onChange={(e) => setReminderForm({ ...reminderForm, dueDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300">Due Time</label>
                  <input
                    type="time"
                    required
                    value={reminderForm.dueTime}
                    onChange={(e) => setReminderForm({ ...reminderForm, dueTime: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Category */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Category</label>
                <div className="flex flex-wrap gap-1.5">
                  {REMINDER_CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setReminderForm({ ...reminderForm, category: cat.id })}
                      className={`px-2.5 py-1 rounded-xl text-xs font-semibold border transition-all ${
                        reminderForm.category === cat.id
                          ? `${cat.bgBadge} ring-1 ring-amber-400`
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Priority */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Priority Level</label>
                <div className="grid grid-cols-4 gap-2">
                  {(['low', 'normal', 'high', 'urgent'] as ReminderPriority[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setReminderForm({ ...reminderForm, priority: p })}
                      className={`py-1.5 rounded-xl text-xs font-bold uppercase border transition-all ${
                        reminderForm.priority === p
                          ? p === 'urgent'
                            ? 'bg-rose-500 text-white border-rose-500'
                            : p === 'high'
                            ? 'bg-amber-500 text-slate-950 border-amber-500'
                            : 'bg-slate-800 text-amber-300 border-amber-500/50'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Target Family Member */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Target Family Member</label>
                <div className="flex flex-wrap gap-1.5">
                  {DEFAULT_FAMILY_MEMBERS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setReminderForm({ ...reminderForm, familyMember: m })}
                      className={`px-2.5 py-1 rounded-xl text-xs font-semibold border transition-all ${
                        reminderForm.familyMember === m
                          ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50 ring-1 ring-indigo-400'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Audio Chime Sound */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-300">Alarm Tone Chime</label>
                  <button
                    type="button"
                    onClick={() => audioAlarmEngine.playAlarmPulse(reminderForm.sound)}
                    className="text-[10px] text-amber-400 hover:underline flex items-center gap-1"
                  >
                    <Volume2 className="w-3 h-3" />
                    <span>Preview</span>
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['gentle', 'radar', 'cosmic', 'dawn', 'digital'] as AlarmSound[]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        setReminderForm({ ...reminderForm, sound: s });
                        audioAlarmEngine.playAlarmPulse(s);
                      }}
                      className={`p-2 rounded-xl text-xs font-semibold capitalize border transition-all ${
                        reminderForm.sound === s
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Voice Alert Toggle */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-950 border border-slate-800">
                <div>
                  <div className="text-xs font-bold text-white">Auro Voice Readout</div>
                  <div className="text-[10px] text-slate-400">
                    Auro speaks reminder aloud in English & Tamil when due
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={reminderForm.voiceAlert}
                  onChange={(e) =>
                    setReminderForm({ ...reminderForm, voiceAlert: e.target.checked })
                  }
                  className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                />
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">
                  Notes & Instructions (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Additional context, dosage, directions, or links..."
                  value={reminderForm.notes}
                  onChange={(e) => setReminderForm({ ...reminderForm, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 resize-none"
                />
              </div>

              {/* Google Drive sync note */}
              <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400 flex items-center gap-2">
                <Cloud className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  Synchronizes directly with Google Drive:{' '}
                  <strong className="text-slate-200">
                    Family Circle / Reminders / family_reminders.json
                  </strong>
                </span>
              </div>

              {/* Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddReminderOpen(false);
                    setEditingReminder(null);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-lg shadow-amber-500/20"
                >
                  {editingReminder ? 'Save Changes' : 'Create Reminder'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
