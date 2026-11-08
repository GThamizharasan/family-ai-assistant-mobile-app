// Sovereign Family Circle - Hydration Tracker Drive/SQLite Sync Service
// Folder: Family Circle / Health And Wellness / Family Heath Record / Hydration Logs

import {
  HydrationLogEntry,
  BeverageType,
  FamilyHealthRecord,
} from '../types/healthRecord';
import {
  getGoogleAccessToken,
  getLocalHealthRecords,
} from './healthRecordDriveSync';
import { getOrCreateGoogleDriveFolder } from './googleWorkspace';
import { getApiUrl } from './api';

const LOCAL_HYDRATION_LOGS_KEY = 'aura_family_hydration_logs_v1';

export const HYDRATION_FOLDER_PATH =
  'Family Circle/Health And Wellness/Family Heath Record/Hydration Logs';

export const DEFAULT_MEMBER_GOALS_ML: Record<string, number> = {
  member_chinnathambi: 3000,
  member_selvi: 2500,
  member_maaran: 1800,
  member_mithran: 1400,
  default: 2500,
};

/**
 * Default Seed Hydration Intake Logs for today
 */
export function getDefaultHydrationLogs(): HydrationLogEntry[] {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`;

  const makeIso = (hours: number, minutes: number) => {
    const d = new Date(year, now.getMonth(), now.getDate(), hours, minutes);
    return d.toISOString();
  };

  return [
    // Chinnathambi logs
    {
      id: 'hydro_c_1',
      memberId: 'member_chinnathambi',
      memberName: 'Chinnathambi',
      timestamp: makeIso(7, 30),
      amountMl: 500,
      beverageType: 'water',
      container: 'bottle_500',
      dailyGoalMl: 3000,
      notes: 'Morning awakening hydration with Himalayan pink salt pinch',
      loggedBy: 'Auro AI Voice',
      driveSyncStatus: 'synced',
      createdAt: makeIso(7, 30),
    },
    {
      id: 'hydro_c_2',
      memberId: 'member_chinnathambi',
      memberName: 'Chinnathambi',
      timestamp: makeIso(10, 15),
      amountMl: 250,
      beverageType: 'lemon_water',
      container: 'glass_250',
      dailyGoalMl: 3000,
      notes: 'Mid-morning lemon infused water',
      loggedBy: 'Self',
      driveSyncStatus: 'synced',
      createdAt: makeIso(10, 15),
    },
    {
      id: 'hydro_c_3',
      memberId: 'member_chinnathambi',
      memberName: 'Chinnathambi',
      timestamp: makeIso(12, 45),
      amountMl: 500,
      beverageType: 'water',
      container: 'bottle_500',
      dailyGoalMl: 3000,
      notes: 'Hydration 30 min before lunch',
      loggedBy: 'Auro AI Voice',
      driveSyncStatus: 'synced',
      createdAt: makeIso(12, 45),
    },
    {
      id: 'hydro_c_4',
      memberId: 'member_chinnathambi',
      memberName: 'Chinnathambi',
      timestamp: makeIso(15, 30),
      amountMl: 500,
      beverageType: 'electrolyte',
      container: 'bottle_500',
      dailyGoalMl: 3000,
      notes: 'Post-workout electrolyte rehydration',
      loggedBy: 'Apple Watch Sync',
      driveSyncStatus: 'synced',
      createdAt: makeIso(15, 30),
    },
    {
      id: 'hydro_c_5',
      memberId: 'member_chinnathambi',
      memberName: 'Chinnathambi',
      timestamp: makeIso(17, 45),
      amountMl: 250,
      beverageType: 'herbal_tea',
      container: 'glass_250',
      dailyGoalMl: 3000,
      notes: 'Chamomile & Tulsi infusion',
      loggedBy: 'Self',
      driveSyncStatus: 'synced',
      createdAt: makeIso(17, 45),
    },
    // Selvi logs
    {
      id: 'hydro_s_1',
      memberId: 'member_selvi',
      memberName: 'Selvi',
      timestamp: makeIso(8, 0),
      amountMl: 350,
      beverageType: 'lemon_water',
      container: 'custom',
      dailyGoalMl: 2500,
      notes: 'Warm water with chia seeds',
      loggedBy: 'Self',
      driveSyncStatus: 'synced',
      createdAt: makeIso(8, 0),
    },
    {
      id: 'hydro_s_2',
      memberId: 'member_selvi',
      memberName: 'Selvi',
      timestamp: makeIso(11, 30),
      amountMl: 500,
      beverageType: 'coconut_water',
      container: 'bottle_500',
      dailyGoalMl: 2500,
      notes: 'Fresh tender coconut water',
      loggedBy: 'Auro AI Voice',
      driveSyncStatus: 'synced',
      createdAt: makeIso(11, 30),
    },
    {
      id: 'hydro_s_3',
      memberId: 'member_selvi',
      memberName: 'Selvi',
      timestamp: makeIso(13, 15),
      amountMl: 400,
      beverageType: 'water',
      container: 'custom',
      dailyGoalMl: 2500,
      notes: 'Filtered copper vessel water',
      loggedBy: 'Self',
      driveSyncStatus: 'synced',
      createdAt: makeIso(13, 15),
    },
    {
      id: 'hydro_s_4',
      memberId: 'member_selvi',
      memberName: 'Selvi',
      timestamp: makeIso(16, 30),
      amountMl: 500,
      beverageType: 'water',
      container: 'bottle_500',
      dailyGoalMl: 2500,
      notes: 'Afternoon hydration goal',
      loggedBy: 'Auro AI Voice',
      driveSyncStatus: 'synced',
      createdAt: makeIso(16, 30),
    },
    // Maaran logs
    {
      id: 'hydro_ma_1',
      memberId: 'member_maaran',
      memberName: 'Maaran',
      timestamp: makeIso(7, 30),
      amountMl: 250,
      beverageType: 'water',
      container: 'glass_250',
      dailyGoalMl: 1800,
      notes: 'Before school breakfast',
      loggedBy: 'Selvi (Mother)',
      driveSyncStatus: 'synced',
      createdAt: makeIso(7, 30),
    },
    {
      id: 'hydro_ma_2',
      memberId: 'member_maaran',
      memberName: 'Maaran',
      timestamp: makeIso(10, 30),
      amountMl: 500,
      beverageType: 'water',
      container: 'bottle_500',
      dailyGoalMl: 1800,
      notes: 'School bottle 1st half',
      loggedBy: 'Self',
      driveSyncStatus: 'synced',
      createdAt: makeIso(10, 30),
    },
    {
      id: 'hydro_ma_3',
      memberId: 'member_maaran',
      memberName: 'Maaran',
      timestamp: makeIso(14, 0),
      amountMl: 500,
      beverageType: 'water',
      container: 'bottle_500',
      dailyGoalMl: 1800,
      notes: 'School bottle refill after PE',
      loggedBy: 'Auro AI Voice',
      driveSyncStatus: 'synced',
      createdAt: makeIso(14, 0),
    },
    // Mithran logs
    {
      id: 'hydro_mi_1',
      memberId: 'member_mithran',
      memberName: 'Mithran',
      timestamp: makeIso(8, 30),
      amountMl: 200,
      beverageType: 'water',
      container: 'custom',
      dailyGoalMl: 1400,
      notes: 'Morning sipper bottle',
      loggedBy: 'Selvi (Mother)',
      driveSyncStatus: 'synced',
      createdAt: makeIso(8, 30),
    },
    {
      id: 'hydro_mi_2',
      memberId: 'member_mithran',
      memberName: 'Mithran',
      timestamp: makeIso(11, 45),
      amountMl: 300,
      beverageType: 'water',
      container: 'custom',
      dailyGoalMl: 1400,
      notes: 'Mid-morning playtime hydration',
      loggedBy: 'Chinnathambi',
      driveSyncStatus: 'synced',
      createdAt: makeIso(11, 45),
    },
    {
      id: 'hydro_mi_3',
      memberId: 'member_mithran',
      memberName: 'Mithran',
      timestamp: makeIso(15, 0),
      amountMl: 400,
      beverageType: 'electrolyte',
      container: 'custom',
      dailyGoalMl: 1400,
      notes: 'Fever recovery electrolyte sips',
      loggedBy: 'Auro AI Voice',
      driveSyncStatus: 'synced',
      createdAt: makeIso(15, 0),
    },
  ];
}

/**
 * Retrieve cached hydration logs from localStorage
 */
export function getLocalHydrationLogs(memberId?: string): HydrationLogEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_HYDRATION_LOGS_KEY);
    let logs: HydrationLogEntry[] = [];
    if (!raw) {
      logs = getDefaultHydrationLogs();
      saveLocalHydrationLogs(logs);
    } else {
      logs = JSON.parse(raw);
      if (!Array.isArray(logs) || logs.length === 0) {
        logs = getDefaultHydrationLogs();
        saveLocalHydrationLogs(logs);
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
    console.warn('[HydrationSync] Error reading local hydration logs:', err);
    return getDefaultHydrationLogs();
  }
}

/**
 * Save hydration logs to localStorage and dispatch update events
 */
export function saveLocalHydrationLogs(logs: HydrationLogEntry[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_HYDRATION_LOGS_KEY, JSON.stringify(logs));
    window.dispatchEvent(
      new CustomEvent('aura_hydration_logs_changed', { detail: logs })
    );
    window.dispatchEvent(new Event('storage'));
  } catch (err) {
    console.warn('[HydrationSync] Error saving logs to local storage:', err);
  }
}

/**
 * Fetch hydration logs from SQLite backend and merge with local storage
 */
export async function fetchHydrationLogsFromSqlite(
  memberId?: string
): Promise<HydrationLogEntry[]> {
  try {
    const baseUrl = getApiUrl('/api/health/hydration-logs');
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
        const mappedLogs: HydrationLogEntry[] = data.logs.map((row: any) => ({
          id: row.id,
          userEmail: row.userEmail,
          memberId: row.memberId,
          memberName: row.memberName,
          timestamp: row.timestamp,
          amountMl: Number(row.amountMl),
          beverageType: row.beverageType as BeverageType,
          container: row.container,
          dailyGoalMl: Number(row.dailyGoalMl),
          notes: row.notes,
          loggedBy: row.loggedBy,
          driveFileId: row.driveFileId,
          driveWebViewLink: row.driveWebViewLink,
          driveSyncStatus: row.driveSyncStatus,
          createdAt: row.createdAt,
        }));

        const currentLocal = getLocalHydrationLogs();
        const mergedMap = new Map<string, HydrationLogEntry>();
        currentLocal.forEach((l) => mergedMap.set(l.id, l));
        mappedLogs.forEach((l) => mergedMap.set(l.id, l));
        const mergedList = Array.from(mergedMap.values()).sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        saveLocalHydrationLogs(mergedList);

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
      '[HydrationSync] Could not reach SQLite backend for hydration logs:',
      err
    );
  }
  return getLocalHydrationLogs(memberId);
}

/**
 * Log a new hydration intake entry:
 * 1. Saves to LocalStorage immediately
 * 2. Persists to SQLite /api/health/hydration-logs
 * 3. Triggers Google Drive sync in background if authenticated
 */
export async function logHydrationIntake(entryData: {
  memberId: string;
  memberName: string;
  amountMl: number;
  beverageType?: BeverageType;
  container?: HydrationLogEntry['container'];
  dailyGoalMl?: number;
  notes?: string;
  loggedBy?: string;
  timestamp?: string;
}): Promise<HydrationLogEntry> {
  const now = new Date().toISOString();
  const id = `hydration_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const defaultGoal =
    entryData.dailyGoalMl ||
    DEFAULT_MEMBER_GOALS_ML[entryData.memberId] ||
    DEFAULT_MEMBER_GOALS_ML.default;

  const newLog: HydrationLogEntry = {
    id,
    memberId: entryData.memberId,
    memberName: entryData.memberName,
    timestamp: entryData.timestamp || now,
    amountMl: Math.max(10, Math.min(3000, entryData.amountMl)),
    beverageType: entryData.beverageType || 'water',
    container: entryData.container || 'glass_250',
    dailyGoalMl: defaultGoal,
    notes: entryData.notes || '',
    loggedBy: entryData.loggedBy || 'Auro AI Voice',
    driveSyncStatus: 'local_only',
    createdAt: now,
  };

  // 1. Save to LocalStorage immediately
  const existing = getLocalHydrationLogs();
  const updated = [newLog, ...existing.filter((item) => item.id !== newLog.id)];
  saveLocalHydrationLogs(updated);

  // 2. Persist to SQLite
  try {
    const res = await fetch(getApiUrl('/api/health/hydration-logs'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: newLog.id,
        memberId: newLog.memberId,
        memberName: newLog.memberName,
        timestamp: newLog.timestamp,
        amountMl: newLog.amountMl,
        beverageType: newLog.beverageType,
        container: newLog.container,
        dailyGoalMl: newLog.dailyGoalMl,
        notes: newLog.notes,
        loggedBy: newLog.loggedBy,
        driveSyncStatus: 'local_only',
        createdAt: newLog.createdAt,
      }),
    });
    if (!res.ok) {
      console.warn('[HydrationSync] SQLite save status:', res.status);
    }
  } catch (err) {
    console.warn('[HydrationSync] SQLite network error during save:', err);
  }

  // 3. Initiate Google Drive sync in background if authenticated
  const token = getGoogleAccessToken();
  if (token) {
    syncHydrationWithGoogleDrive(token).catch((err) => {
      console.warn('[HydrationSync] Background Google Drive sync deferred:', err);
    });
  }

  return newLog;
}

/**
 * Delete a hydration log from local storage and SQLite
 */
export async function deleteHydrationLog(id: string): Promise<boolean> {
  const current = getLocalHydrationLogs();
  const filtered = current.filter((l) => l.id !== id);
  saveLocalHydrationLogs(filtered);

  try {
    await fetch(getApiUrl(`/api/health/hydration-logs/${id}`), {
      method: 'DELETE',
    });
  } catch (err) {
    console.warn('[HydrationSync] Failed to delete hydration log from SQLite:', err);
  }
  return true;
}

/**
 * Calculate member today's hydration intake and circular ring metrics
 */
export function getTodayHydrationSummary(memberId: string) {
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

  const allLogs = getLocalHydrationLogs(member?.memberId);
  const todayLogs = allLogs
    .filter((l) => l.timestamp.startsWith(todayPrefix))
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const totalDrankMl = todayLogs.reduce((acc, l) => acc + l.amountMl, 0);
  const dailyGoalMl =
    todayLogs[0]?.dailyGoalMl ||
    DEFAULT_MEMBER_GOALS_ML[member?.memberId || ''] ||
    DEFAULT_MEMBER_GOALS_ML.default;

  const progressPercent = Math.min(150, Math.round((totalDrankMl / dailyGoalMl) * 100));
  const remainingMl = Math.max(0, dailyGoalMl - totalDrankMl);

  // Hourly intake breakdown (e.g. 6AM-9AM, 9AM-12PM, 12PM-3PM, 3PM-6PM, 6PM-9PM, 9PM-12AM)
  const timeBuckets: { label: string; amountMl: number }[] = [
    { label: '6-9 AM', amountMl: 0 },
    { label: '9-12 PM', amountMl: 0 },
    { label: '12-3 PM', amountMl: 0 },
    { label: '3-6 PM', amountMl: 0 },
    { label: '6-9 PM', amountMl: 0 },
    { label: '9-12 AM', amountMl: 0 },
  ];

  todayLogs.forEach((l) => {
    const hour = new Date(l.timestamp).getHours();
    if (hour >= 6 && hour < 9) timeBuckets[0].amountMl += l.amountMl;
    else if (hour >= 9 && hour < 12) timeBuckets[1].amountMl += l.amountMl;
    else if (hour >= 12 && hour < 15) timeBuckets[2].amountMl += l.amountMl;
    else if (hour >= 15 && hour < 18) timeBuckets[3].amountMl += l.amountMl;
    else if (hour >= 18 && hour < 21) timeBuckets[4].amountMl += l.amountMl;
    else if (hour >= 21) timeBuckets[5].amountMl += l.amountMl;
    else timeBuckets[0].amountMl += l.amountMl;
  });

  return {
    member,
    totalDrankMl,
    dailyGoalMl,
    progressPercent,
    remainingMl,
    todayLogs,
    timeBuckets,
  };
}

/**
 * Sync hydration logs with Google Drive:
 * Creates/finds "Family Circle / Health And Wellness / Family Heath Record / Hydration Logs"
 * Uploads a standardized daily water balance report and timeline JSON
 */
export async function syncHydrationWithGoogleDrive(
  token?: string
): Promise<{ success: boolean; syncedCount: number }> {
  const activeToken = token || getGoogleAccessToken();
  if (!activeToken) {
    return { success: false, syncedCount: 0 };
  }

  try {
    const folderId = await getOrCreateGoogleDriveFolder(
      HYDRATION_FOLDER_PATH,
      activeToken
    );

    const logs = getLocalHydrationLogs();
    const healthRecords = getLocalHealthRecords();
    if (logs.length === 0 && healthRecords.length === 0) {
      return { success: true, syncedCount: 0 };
    }

    let totalSynced = 0;

    for (const member of healthRecords) {
      const memberLogs = logs.filter(
        (l) =>
          l.memberId === member.memberId ||
          l.memberId === member.id ||
          l.memberName.toLowerCase() === member.memberName.toLowerCase()
      );

      const filename = `Hydration_Intake_Logs_${member.memberName.replace(/\s+/g, '_')}_Latest.json`;
      const reportPayload = {
        title: `Smart Hydration & Cellular Water Balance - ${member.memberName}`,
        generatedAt: new Date().toISOString(),
        familyMember: member.memberName,
        dailyGoalMl: DEFAULT_MEMBER_GOALS_ML[member.memberId] || 2500,
        totalLogsCount: memberLogs.length,
        totalIntakeVolumeMl: memberLogs.reduce((acc, l) => acc + l.amountMl, 0),
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
        description: `AURO Smart Hydration & Water Intake Logs for ${member.memberName}`,
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
            await fetch(getApiUrl(`/api/health/hydration-logs/${log.id}/drive-sync`), {
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

    saveLocalHydrationLogs(logs);
    return { success: true, syncedCount: totalSynced };
  } catch (err) {
    console.warn('[HydrationSync] Google Drive sync error:', err);
    return { success: false, syncedCount: 0 };
  }
}
