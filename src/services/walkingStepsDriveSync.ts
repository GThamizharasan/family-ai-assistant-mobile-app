// Sovereign Family Circle - Walking Steps Tracker Drive/SQLite Sync Service
// Folder: Family Circle / Health And Wellness / Family Heath Record / Walking Steps Logs

import {
  WalkingStepLogEntry,
  StepWalkType,
  FamilyHealthRecord,
} from '../types/healthRecord';
import {
  getGoogleAccessToken,
  getLocalHealthRecords,
} from './healthRecordDriveSync';
import { getOrCreateGoogleDriveFolder } from './googleWorkspace';
import { getApiUrl } from './api';

const LOCAL_STEPS_LOGS_KEY = 'aura_family_walking_steps_logs_v1';

export const STEPS_FOLDER_PATH =
  'Family Circle/Health And Wellness/Family Heath Record/Walking Steps Logs';

export const DEFAULT_MEMBER_STEP_GOALS: Record<string, number> = {
  member_chinnathambi: 10000,
  member_selvi: 8000,
  member_maaran: 12000,
  member_mithran: 6000,
  default: 10000,
};

/**
 * Standard stride length in meters (average adult 0.762m / ~2.5ft)
 */
export function estimateDistanceMeters(steps: number): number {
  return Math.round(steps * 0.762);
}

/**
 * Approximate calories burned (average adult burns ~0.04 kcal per step at standard brisk pace)
 */
export function estimateCalories(steps: number, walkType: StepWalkType = 'brisk_walking'): number {
  const multiplier =
    walkType === 'power_walk' ? 0.055 :
    walkType === 'hiking' ? 0.06 :
    walkType === 'treadmill' ? 0.045 :
    walkType === 'interval' ? 0.05 :
    walkType === 'casual_stroll' ? 0.035 : 0.04;
  return Math.round(steps * multiplier);
}

/**
 * Approximate duration in minutes based on steps and walk type cadence
 */
export function estimateDurationMinutes(steps: number, cadence: number = 105): number {
  return Math.max(1, Math.round(steps / cadence));
}

/**
 * Default Seed Walking Steps for today across family members
 */
export function getDefaultWalkingStepLogs(): WalkingStepLogEntry[] {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const date = now.getDate();

  const makeIso = (hours: number, minutes: number, daysAgo = 0) => {
    const d = new Date(year, month, date - daysAgo, hours, minutes);
    return d.toISOString();
  };

  return [
    // Chinnathambi logs (Total ~8,400 steps today)
    {
      id: 'step_c_1',
      memberId: 'member_chinnathambi',
      memberName: 'Chinnathambi',
      timestamp: makeIso(6, 45),
      steps: 3800,
      distanceMeters: 2895,
      durationMinutes: 36,
      caloriesBurned: 165,
      walkType: 'brisk_walking',
      cadenceAvg: 108,
      dailyStepGoal: 10000,
      notes: 'Morning brisk walk around lake perimeter trail',
      loggedBy: 'Apple Watch / Health Connect',
      driveSyncStatus: 'synced',
      createdAt: makeIso(6, 45),
    },
    {
      id: 'step_c_2',
      memberId: 'member_chinnathambi',
      memberName: 'Chinnathambi',
      timestamp: makeIso(13, 10),
      steps: 1450,
      distanceMeters: 1104,
      durationMinutes: 16,
      caloriesBurned: 52,
      walkType: 'casual_stroll',
      cadenceAvg: 92,
      dailyStepGoal: 10000,
      notes: 'Post-lunch digestion stroll in campus garden',
      loggedBy: 'Pedometer',
      driveSyncStatus: 'synced',
      createdAt: makeIso(13, 10),
    },
    {
      id: 'step_c_3',
      memberId: 'member_chinnathambi',
      memberName: 'Chinnathambi',
      timestamp: makeIso(17, 30),
      steps: 3150,
      distanceMeters: 2400,
      durationMinutes: 28,
      caloriesBurned: 142,
      walkType: 'power_walk',
      cadenceAvg: 114,
      dailyStepGoal: 10000,
      notes: 'Sunset aerobic tempo walking interval',
      loggedBy: 'Auro AI Voice',
      driveSyncStatus: 'synced',
      createdAt: makeIso(17, 30),
    },
    // Yesterday Chinnathambi
    {
      id: 'step_c_y1',
      memberId: 'member_chinnathambi',
      memberName: 'Chinnathambi',
      timestamp: makeIso(7, 0, 1),
      steps: 6200,
      distanceMeters: 4724,
      durationMinutes: 58,
      caloriesBurned: 270,
      walkType: 'brisk_walking',
      cadenceAvg: 107,
      dailyStepGoal: 10000,
      notes: 'Long morning loop',
      loggedBy: 'Apple Watch / Health Connect',
      driveSyncStatus: 'synced',
      createdAt: makeIso(7, 0, 1),
    },
    {
      id: 'step_c_y2',
      memberId: 'member_chinnathambi',
      memberName: 'Chinnathambi',
      timestamp: makeIso(18, 15, 1),
      steps: 4300,
      distanceMeters: 3276,
      durationMinutes: 40,
      caloriesBurned: 195,
      walkType: 'hiking',
      cadenceAvg: 102,
      dailyStepGoal: 10000,
      notes: 'Evening park nature trail',
      loggedBy: 'Pedometer',
      driveSyncStatus: 'synced',
      createdAt: makeIso(18, 15, 1),
    },

    // Selvi logs (Total ~6,200 steps today)
    {
      id: 'step_s_1',
      memberId: 'member_selvi',
      memberName: 'Selvi',
      timestamp: makeIso(7, 15),
      steps: 2800,
      distanceMeters: 2072,
      durationMinutes: 30,
      caloriesBurned: 118,
      walkType: 'brisk_walking',
      cadenceAvg: 102,
      dailyStepGoal: 8000,
      notes: 'Morning terrace walking & pranayama warmup',
      loggedBy: 'Pedometer',
      driveSyncStatus: 'synced',
      createdAt: makeIso(7, 15),
    },
    {
      id: 'step_s_2',
      memberId: 'member_selvi',
      memberName: 'Selvi',
      timestamp: makeIso(11, 45),
      steps: 1200,
      distanceMeters: 888,
      durationMinutes: 14,
      caloriesBurned: 45,
      walkType: 'casual_stroll',
      cadenceAvg: 88,
      dailyStepGoal: 8000,
      notes: 'Household activity & garden steps',
      loggedBy: 'Auro AI Voice',
      driveSyncStatus: 'synced',
      createdAt: makeIso(11, 45),
    },
    {
      id: 'step_s_3',
      memberId: 'member_selvi',
      memberName: 'Selvi',
      timestamp: makeIso(18, 0),
      steps: 2200,
      distanceMeters: 1628,
      durationMinutes: 24,
      caloriesBurned: 95,
      walkType: 'casual_stroll',
      cadenceAvg: 95,
      dailyStepGoal: 8000,
      notes: 'Evening neighborhood walk with Selvi community club',
      loggedBy: 'Apple Watch / Health Connect',
      driveSyncStatus: 'synced',
      createdAt: makeIso(18, 0),
    },

    // Maaran logs (Total ~10,800 steps today)
    {
      id: 'step_ma_1',
      memberId: 'member_maaran',
      memberName: 'Maaran',
      timestamp: makeIso(8, 0),
      steps: 2100,
      distanceMeters: 1550,
      durationMinutes: 20,
      caloriesBurned: 90,
      walkType: 'brisk_walking',
      cadenceAvg: 110,
      dailyStepGoal: 12000,
      notes: 'Walk to school bus stop & morning recess',
      loggedBy: 'School Fitness Band',
      driveSyncStatus: 'synced',
      createdAt: makeIso(8, 0),
    },
    {
      id: 'step_ma_2',
      memberId: 'member_maaran',
      memberName: 'Maaran',
      timestamp: makeIso(12, 30),
      steps: 3400,
      distanceMeters: 2510,
      durationMinutes: 32,
      caloriesBurned: 160,
      walkType: 'interval',
      cadenceAvg: 120,
      dailyStepGoal: 12000,
      notes: 'Physical education class & football field drills',
      loggedBy: 'Auro AI Voice',
      driveSyncStatus: 'synced',
      createdAt: makeIso(12, 30),
    },
    {
      id: 'step_ma_3',
      memberId: 'member_maaran',
      memberName: 'Maaran',
      timestamp: makeIso(16, 45),
      steps: 5300,
      distanceMeters: 3920,
      durationMinutes: 48,
      caloriesBurned: 245,
      walkType: 'power_walk',
      cadenceAvg: 118,
      dailyStepGoal: 12000,
      notes: 'Evening basketball warmup and outdoor running',
      loggedBy: 'Apple Watch / Health Connect',
      driveSyncStatus: 'synced',
      createdAt: makeIso(16, 45),
    },

    // Mithran logs (Total ~5,100 steps today)
    {
      id: 'step_mi_1',
      memberId: 'member_mithran',
      memberName: 'Mithran',
      timestamp: makeIso(9, 30),
      steps: 1600,
      distanceMeters: 960,
      durationMinutes: 25,
      caloriesBurned: 55,
      walkType: 'casual_stroll',
      cadenceAvg: 85,
      dailyStepGoal: 6000,
      notes: 'Playground sandbox fun and kindergarten playtime',
      loggedBy: 'Chinnathambi',
      driveSyncStatus: 'synced',
      createdAt: makeIso(9, 30),
    },
    {
      id: 'step_mi_2',
      memberId: 'member_mithran',
      memberName: 'Mithran',
      timestamp: makeIso(16, 0),
      steps: 3500,
      distanceMeters: 2100,
      durationMinutes: 40,
      caloriesBurned: 120,
      walkType: 'casual_stroll',
      cadenceAvg: 90,
      dailyStepGoal: 6000,
      notes: 'Evening bicycle follow-up and park lawn steps',
      loggedBy: 'Selvi (Mother)',
      driveSyncStatus: 'synced',
      createdAt: makeIso(16, 0),
    },
  ];
}

/**
 * Retrieve cached walking step logs from localStorage
 */
export function getLocalWalkingStepLogs(memberId?: string): WalkingStepLogEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_STEPS_LOGS_KEY);
    let logs: WalkingStepLogEntry[] = [];
    if (!raw) {
      logs = getDefaultWalkingStepLogs();
      saveLocalWalkingStepLogs(logs);
    } else {
      logs = JSON.parse(raw);
      if (!Array.isArray(logs) || logs.length === 0) {
        logs = getDefaultWalkingStepLogs();
        saveLocalWalkingStepLogs(logs);
      }
    }

    if (memberId && memberId.trim() && memberId !== 'all') {
      return logs.filter(
        (l) =>
          l.memberId === memberId.trim() ||
          l.memberName.toLowerCase() === memberId.trim().toLowerCase()
      );
    }
    return logs.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  } catch (err) {
    console.warn('[StepsSync] Error reading local step logs:', err);
    return getDefaultWalkingStepLogs();
  }
}

/**
 * Save walking step logs to localStorage and dispatch update events
 */
export function saveLocalWalkingStepLogs(logs: WalkingStepLogEntry[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STEPS_LOGS_KEY, JSON.stringify(logs));
    window.dispatchEvent(
      new CustomEvent('aura_steps_logs_changed', { detail: logs })
    );
    window.dispatchEvent(new Event('storage'));
  } catch (err) {
    console.warn('[StepsSync] Error saving logs to local storage:', err);
  }
}

/**
 * Fetch walking step logs from SQLite backend and merge with local storage
 */
export async function fetchWalkingStepLogsFromSqlite(
  memberId?: string
): Promise<WalkingStepLogEntry[]> {
  try {
    const baseUrl = getApiUrl('/api/health/walking-steps');
    const url = new URL(
      baseUrl,
      typeof window !== 'undefined'
        ? window.location.origin
        : 'http://localhost:3000'
    );
    if (memberId && memberId !== 'all') {
      url.searchParams.set('memberId', memberId);
    }
    const res = await fetch(url.toString());
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.logs) && data.logs.length > 0) {
        const mappedLogs: WalkingStepLogEntry[] = data.logs.map((row: any) => ({
          id: row.id,
          userEmail: row.userEmail,
          memberId: row.memberId,
          memberName: row.memberName,
          timestamp: row.timestamp,
          steps: Number(row.steps || 0),
          distanceMeters: Number(row.distanceMeters || 0),
          durationMinutes: Number(row.durationMinutes || 0),
          caloriesBurned: Number(row.caloriesBurned || 0),
          walkType: (row.walkType as StepWalkType) || 'brisk_walking',
          cadenceAvg: Number(row.cadenceAvg || 100),
          dailyStepGoal: Number(row.dailyStepGoal || 10000),
          notes: row.notes,
          loggedBy: row.loggedBy,
          driveFileId: row.driveFileId,
          driveWebViewLink: row.driveWebViewLink,
          driveSyncStatus: row.driveSyncStatus,
          createdAt: row.createdAt,
        }));

        const currentLocal = getLocalWalkingStepLogs();
        const mergedMap = new Map<string, WalkingStepLogEntry>();
        currentLocal.forEach((l) => mergedMap.set(l.id, l));
        mappedLogs.forEach((l) => mergedMap.set(l.id, l));
        const mergedList = Array.from(mergedMap.values()).sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        saveLocalWalkingStepLogs(mergedList);

        if (memberId && memberId !== 'all') {
          return mergedList.filter(
            (l) =>
              l.memberId === memberId ||
              l.memberName.toLowerCase() === memberId.toLowerCase()
          );
        }
        return mergedList;
      }
    }
  } catch (err) {
    console.warn(
      '[StepsSync] Could not reach SQLite backend for walking steps logs:',
      err
    );
  }
  return getLocalWalkingStepLogs(memberId);
}

/**
 * Log a new walking step entry:
 * 1. Saves to LocalStorage immediately
 * 2. Persists to SQLite /api/health/walking-steps
 * 3. Triggers Google Drive sync in background if authenticated
 */
export async function logWalkingSteps(entryData: {
  memberId: string;
  memberName: string;
  steps: number;
  walkType?: StepWalkType;
  durationMinutes?: number;
  distanceMeters?: number;
  caloriesBurned?: number;
  cadenceAvg?: number;
  dailyStepGoal?: number;
  notes?: string;
  loggedBy?: string;
  timestamp?: string;
}): Promise<WalkingStepLogEntry> {
  const now = new Date().toISOString();
  const id = `step_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const defaultGoal =
    entryData.dailyStepGoal ||
    DEFAULT_MEMBER_STEP_GOALS[entryData.memberId] ||
    DEFAULT_MEMBER_STEP_GOALS.default;

  const steps = Math.max(1, Math.min(100000, entryData.steps));
  const walkType = entryData.walkType || 'brisk_walking';
  const distanceMeters = entryData.distanceMeters ?? estimateDistanceMeters(steps);
  const durationMinutes = entryData.durationMinutes ?? estimateDurationMinutes(steps, entryData.cadenceAvg || 105);
  const caloriesBurned = entryData.caloriesBurned ?? estimateCalories(steps, walkType);
  const cadenceAvg = entryData.cadenceAvg ?? Math.round(steps / Math.max(1, durationMinutes));

  const newLog: WalkingStepLogEntry = {
    id,
    memberId: entryData.memberId,
    memberName: entryData.memberName,
    timestamp: entryData.timestamp || now,
    steps,
    distanceMeters,
    durationMinutes,
    caloriesBurned,
    walkType,
    cadenceAvg,
    dailyStepGoal: defaultGoal,
    notes: entryData.notes || '',
    loggedBy: entryData.loggedBy || 'Auro AI Voice',
    driveSyncStatus: 'local_only',
    createdAt: now,
  };

  // 1. Save to LocalStorage immediately
  const existing = getLocalWalkingStepLogs();
  const updated = [newLog, ...existing.filter((item) => item.id !== newLog.id)];
  saveLocalWalkingStepLogs(updated);

  // 2. Persist to SQLite
  try {
    const res = await fetch(getApiUrl('/api/health/walking-steps'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: newLog.id,
        memberId: newLog.memberId,
        memberName: newLog.memberName,
        timestamp: newLog.timestamp,
        steps: newLog.steps,
        distanceMeters: newLog.distanceMeters,
        durationMinutes: newLog.durationMinutes,
        caloriesBurned: newLog.caloriesBurned,
        walkType: newLog.walkType,
        cadenceAvg: newLog.cadenceAvg,
        dailyStepGoal: newLog.dailyStepGoal,
        notes: newLog.notes,
        loggedBy: newLog.loggedBy,
        driveSyncStatus: 'local_only',
        createdAt: newLog.createdAt,
      }),
    });
    if (!res.ok) {
      console.warn('[StepsSync] SQLite save status:', res.status);
    }
  } catch (err) {
    console.warn('[StepsSync] SQLite network error during save:', err);
  }

  // 3. Initiate Google Drive sync in background if authenticated
  const token = getGoogleAccessToken();
  if (token) {
    syncWalkingStepsWithGoogleDrive(token).catch((err) => {
      console.warn('[StepsSync] Background Google Drive sync deferred:', err);
    });
  }

  return newLog;
}

/**
 * Delete a step log from local storage and SQLite
 */
export async function deleteWalkingStepLog(id: string): Promise<boolean> {
  const current = getLocalWalkingStepLogs();
  const filtered = current.filter((l) => l.id !== id);
  saveLocalWalkingStepLogs(filtered);

  try {
    await fetch(getApiUrl(`/api/health/walking-steps/${id}`), {
      method: 'DELETE',
    });
  } catch (err) {
    console.warn('[StepsSync] Failed to delete walking step log from SQLite:', err);
  }
  return true;
}

/**
 * Calculate member today's walking steps and activity metrics
 */
export function getTodayStepsSummary(memberId: string) {
  const records = getLocalHealthRecords();
  const member =
    records.find(
      (r) =>
        r.memberId === memberId ||
        r.id === memberId ||
        r.memberName.toLowerCase() === memberId.toLowerCase()
    ) || records[0];

  const now = new Date();
  const todayPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const allLogs = getLocalWalkingStepLogs(member?.memberId);
  const todayLogs = allLogs
    .filter((l) => l.timestamp.startsWith(todayPrefix))
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const totalSteps = todayLogs.reduce((acc, l) => acc + l.steps, 0);
  const totalDistanceMeters = todayLogs.reduce((acc, l) => acc + l.distanceMeters, 0);
  const totalDistanceKm = Number((totalDistanceMeters / 1000).toFixed(2));
  const totalDistanceMiles = Number((totalDistanceKm * 0.621371).toFixed(2));
  const totalDurationMinutes = todayLogs.reduce((acc, l) => acc + l.durationMinutes, 0);
  const totalCaloriesBurned = todayLogs.reduce((acc, l) => acc + l.caloriesBurned, 0);

  const dailyStepGoal =
    todayLogs[0]?.dailyStepGoal ||
    DEFAULT_MEMBER_STEP_GOALS[member?.memberId || ''] ||
    DEFAULT_MEMBER_STEP_GOALS.default;

  const progressPercent = Math.min(200, Math.round((totalSteps / dailyStepGoal) * 100));
  const remainingSteps = Math.max(0, dailyStepGoal - totalSteps);

  const averageCadence =
    todayLogs.length > 0
      ? Math.round(
          todayLogs.reduce((acc, l) => acc + (l.cadenceAvg || 100), 0) / todayLogs.length
        )
      : 100;

  // Hourly distribution breakdown
  const timeBuckets: { label: string; steps: number }[] = [
    { label: '6-9 AM', steps: 0 },
    { label: '9-12 PM', steps: 0 },
    { label: '12-3 PM', steps: 0 },
    { label: '3-6 PM', steps: 0 },
    { label: '6-9 PM', steps: 0 },
    { label: '9-12 AM', steps: 0 },
  ];

  todayLogs.forEach((l) => {
    const hour = new Date(l.timestamp).getHours();
    if (hour >= 6 && hour < 9) timeBuckets[0].steps += l.steps;
    else if (hour >= 9 && hour < 12) timeBuckets[1].steps += l.steps;
    else if (hour >= 12 && hour < 15) timeBuckets[2].steps += l.steps;
    else if (hour >= 15 && hour < 18) timeBuckets[3].steps += l.steps;
    else if (hour >= 18 && hour < 21) timeBuckets[4].steps += l.steps;
    else if (hour >= 21) timeBuckets[5].steps += l.steps;
    else timeBuckets[0].steps += l.steps;
  });

  // Last 7 days step trend
  const last7Days: { dateStr: string; dayLabel: string; steps: number; goal: number; achieved: boolean }[] = [];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const dayLabel = i === 0 ? 'Today' : dayNames[d.getDay()];

    const dayLogs = allLogs.filter((l) => l.timestamp.startsWith(dStr));
    const daySteps = dayLogs.reduce((acc, l) => acc + l.steps, 0);

    last7Days.push({
      dateStr: dStr,
      dayLabel,
      steps: daySteps,
      goal: dailyStepGoal,
      achieved: daySteps >= dailyStepGoal,
    });
  }

  return {
    member,
    totalSteps,
    dailyStepGoal,
    progressPercent,
    remainingSteps,
    totalDistanceMeters,
    totalDistanceKm,
    totalDistanceMiles,
    totalDurationMinutes,
    totalCaloriesBurned,
    averageCadence,
    todayLogs,
    timeBuckets,
    last7Days,
  };
}

/**
 * Pull all Walking Steps records from Google Drive into SQLite and LocalStorage:
 * 1. Queries Drive folder: Family Circle -> Health And Wellness -> Family Health Record -> Walking Steps Logs
 * 2. Downloads and parses each JSON file (Walking_Steps_*.json)
 * 3. Merges records into LocalStorage and dispatches UI update event
 * 4. Persists records to SQLite (/api/health/walking-steps)
 */
export async function pullWalkingStepsFromGoogleDrive(token?: string): Promise<{
  success: boolean;
  pulledCount: number;
  message?: string;
}> {
  const activeToken = token || getGoogleAccessToken();
  if (!activeToken) {
    return { success: false, pulledCount: 0, message: 'Not authenticated with Google Drive' };
  }

  try {
    const folderId = await getOrCreateGoogleDriveFolder(STEPS_FOLDER_PATH, activeToken);

    // List all files in the Walking Steps folder
    const listUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
      `'${folderId}' in parents and trashed = false`
    )}&fields=files(id,name,mimeType,webViewLink)&pageSize=1000`;

    const listRes = await fetch(listUrl, {
      headers: { Authorization: `Bearer ${activeToken}` },
    });

    if (!listRes.ok) {
      console.warn('[StepsSync] Could not list Google Drive steps folder:', listRes.status);
      return { success: false, pulledCount: 0, message: 'Could not access Drive folder' };
    }

    const listData = await listRes.json();
    const files: Array<{ id: string; name: string; mimeType: string; webViewLink?: string }> = listData.files || [];

    if (files.length === 0) {
      return { success: true, pulledCount: 0 };
    }

    const existingLogs = getLocalWalkingStepLogs();
    const logsMap = new Map<string, WalkingStepLogEntry>();
    existingLogs.forEach((l) => logsMap.set(l.id, l));

    let pulledCount = 0;

    for (const file of files) {
      if (!file.name.endsWith('.json')) continue;

      try {
        const dlRes = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, {
          headers: { Authorization: `Bearer ${activeToken}` },
        });

        if (!dlRes.ok) continue;
        const data = await dlRes.json();
        if (!data || typeof data !== 'object') continue;

        // Process logs array in report manifest
        const candidateLogs = Array.isArray(data.logs) ? data.logs : (Array.isArray(data.steps) ? data.steps : [data]);

        for (const item of candidateLogs) {
          if (!item || !item.steps) continue;
          const logId = item.id || `step_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          const entry: WalkingStepLogEntry = {
            id: logId,
            memberId: item.memberId || data.memberId || 'member_chinnathambi',
            memberName: item.memberName || data.familyMember || 'Family Member',
            timestamp: item.timestamp || new Date().toISOString(),
            steps: Number(item.steps || 0),
            distanceMeters: Number(item.distanceMeters || estimateDistanceMeters(Number(item.steps || 0))),
            durationMinutes: Number(item.durationMinutes || 30),
            caloriesBurned: Number(item.caloriesBurned || estimateCalories(Number(item.steps || 0))),
            walkType: (item.walkType as StepWalkType) || 'brisk_walking',
            cadenceAvg: Number(item.cadenceAvg || 100),
            dailyStepGoal: Number(item.dailyStepGoal || 10000),
            notes: item.notes || '',
            loggedBy: item.loggedBy || 'Google Drive Sync',
            driveFileId: file.id,
            driveWebViewLink: file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`,
            driveSyncStatus: 'synced',
            createdAt: item.createdAt || new Date().toISOString(),
          };

          logsMap.set(logId, entry);
          pulledCount++;

          // Persist to SQLite in background
          try {
            fetch(getApiUrl('/api/health/walking-steps'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                ...entry,
                driveFileId: file.id,
                driveWebViewLink: entry.driveWebViewLink,
                driveSyncStatus: 'synced',
              }),
            }).catch(() => {});
          } catch {}
        }
      } catch (fileErr) {
        console.warn(`[StepsSync] Failed to process Drive file ${file.name}:`, fileErr);
      }
    }

    const mergedLogs = Array.from(logsMap.values()).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    saveLocalWalkingStepLogs(mergedLogs);

    return { success: true, pulledCount };
  } catch (err: any) {
    console.warn('[StepsSync] Error pulling walking steps from Google Drive:', err);
    return { success: false, pulledCount: 0, message: err.message };
  }
}

/**
 * Both-Way Sync with Google Drive:
 * 1. Pulls latest remote Drive entries down into SQLite and LocalStorage
 * 2. Compiles standardized daily step records and reports per member
 * 3. Uploads files to Google Drive folder:
 *    "Family Circle / Health And Wellness / Family Heath Record / Walking Steps Logs"
 * 4. Updates SQLite with drive file IDs and 'synced' status
 */
export async function syncWalkingStepsWithGoogleDrive(
  token?: string
): Promise<{
  success: boolean;
  syncedCount: number;
  pulledCount: number;
  folderLink?: string;
}> {
  const activeToken = token || getGoogleAccessToken();
  if (!activeToken) {
    return { success: false, syncedCount: 0, pulledCount: 0 };
  }

  try {
    // 1. Pull remote Drive entries first for true two-way synchronization
    const pullResult = await pullWalkingStepsFromGoogleDrive(activeToken);

    // 2. Fetch latest unified logs from SQLite/LocalStorage
    await fetchWalkingStepLogsFromSqlite();
    const logs = getLocalWalkingStepLogs();
    const healthRecords = getLocalHealthRecords();

    const folderId = await getOrCreateGoogleDriveFolder(
      STEPS_FOLDER_PATH,
      activeToken
    );
    const folderLink = `https://drive.google.com/drive/folders/${folderId}`;

    if (logs.length === 0 && healthRecords.length === 0) {
      return { success: true, syncedCount: 0, pulledCount: pullResult.pulledCount, folderLink };
    }

    let totalSynced = 0;

    for (const member of healthRecords) {
      const memberLogs = logs.filter(
        (l) =>
          l.memberId === member.memberId ||
          l.memberId === member.id ||
          l.memberName.toLowerCase() === member.memberName.toLowerCase()
      );

      const filename = `Walking_Steps_Logs_${member.memberName.replace(/\s+/g, '_')}_Latest.json`;
      const totalSteps = memberLogs.reduce((acc, l) => acc + l.steps, 0);
      const totalDistance = memberLogs.reduce((acc, l) => acc + l.distanceMeters, 0);
      const totalCalories = memberLogs.reduce((acc, l) => acc + l.caloriesBurned, 0);
      const totalDuration = memberLogs.reduce((acc, l) => acc + l.durationMinutes, 0);

      const reportPayload = {
        title: `Smart Pedometer & Walking Steps Log - ${member.memberName}`,
        generatedAt: new Date().toISOString(),
        familyMember: member.memberName,
        dailyStepGoal: DEFAULT_MEMBER_STEP_GOALS[member.memberId] || 10000,
        totalLogsCount: memberLogs.length,
        totalCumulativeSteps: totalSteps,
        totalDistanceKm: Number((totalDistance / 1000).toFixed(2)),
        totalCaloriesBurned: totalCalories,
        totalActiveDurationMinutes: totalDuration,
        logs: memberLogs,
      };

      const fileContent = JSON.stringify(reportPayload, null, 2);
      const boundary = '-------314159265358979323846';
      const delimiter = '\r\n--' + boundary + '\r\n';
      const closeDelim = '\r\n--' + boundary + '--';

      const metadata = {
        name: filename,
        mimeType: 'application/json',
        parents: [folderId],
        description: `AURO Smart Walking Steps & Activity Log for ${member.memberName}`,
      };

      const multipartRequestBody =
        delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        'Content-Type: application/json\r\n\r\n' +
        fileContent +
        closeDelim;

      const uploadRes = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${activeToken}`,
            'Content-Type': `multipart/related; boundary=${boundary}`,
          },
          body: multipartRequestBody,
        }
      );

      if (uploadRes.ok) {
        const driveData = await uploadRes.json();
        const driveFileId = driveData.id;
        const driveWebViewLink = `https://drive.google.com/file/d/${driveFileId}/view`;

        for (const log of memberLogs) {
          log.driveFileId = driveFileId;
          log.driveWebViewLink = driveWebViewLink;
          log.driveSyncStatus = 'synced';

          try {
            await fetch(getApiUrl(`/api/health/walking-steps/${log.id}/drive-sync`), {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                driveFileId,
                driveWebViewLink,
              }),
            });
          } catch {}
        }
        totalSynced += memberLogs.length;
      }
    }

    saveLocalWalkingStepLogs(logs);
    return {
      success: true,
      syncedCount: totalSynced,
      pulledCount: pullResult.pulledCount,
      folderLink,
    };
  } catch (err) {
    console.warn('[StepsSync] Google Drive two-way sync error:', err);
    return { success: false, syncedCount: 0, pulledCount: 0 };
  }
}
