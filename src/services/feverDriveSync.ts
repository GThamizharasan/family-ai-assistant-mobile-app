// Sovereign Family Circle - Fever Temperature Recording & Drive/SQLite Sync Service
// Folder: Family Circle / Health And Wellness / Family Heath Record / Fever Logs

import { FeverLogEntry, FeverSeverity, FamilyHealthRecord } from '../types/healthRecord';
import { getGoogleAccessToken, getLocalHealthRecords } from './healthRecordDriveSync';
import { getOrCreateGoogleDriveFolder } from './googleWorkspace';
import { getApiUrl } from './api';

const LOCAL_FEVER_LOGS_KEY = 'aura_family_fever_logs_v1';

export const FEVER_FOLDER_PATH = 'Family Circle/Health And Wellness/Family Heath Record/Fever Logs';

export function fahrenheitToCelsius(f: number): number {
  return Number(((f - 32) * (5 / 9)).toFixed(1));
}

export function celsiusToFahrenheit(c: number): number {
  return Number(((c * 9 / 5) + 32).toFixed(1));
}

export function calculateFeverSeverity(tempF: number): FeverSeverity {
  if (tempF < 99.1) return 'normal';
  if (tempF <= 100.4) return 'low';
  if (tempF <= 102.0) return 'moderate';
  if (tempF <= 104.0) return 'high';
  return 'hyperpyrexia';
}

export function getSeverityLabel(severity: FeverSeverity): string {
  switch (severity) {
    case 'normal':
      return 'Normal Temperature (< 99.1°F)';
    case 'low':
      return 'Low-Grade Fever (99.1 - 100.4°F)';
    case 'moderate':
      return 'Moderate Fever (100.5 - 102.0°F)';
    case 'high':
      return 'High Fever (102.1 - 104.0°F)';
    case 'hyperpyrexia':
      return 'Hyperpyrexia Danger (> 104.0°F)';
  }
}

export function getSeverityColor(severity: FeverSeverity): {
  bg: string;
  text: string;
  border: string;
  badge: string;
} {
  switch (severity) {
    case 'normal':
      return {
        bg: 'bg-emerald-500/10',
        text: 'text-emerald-400',
        border: 'border-emerald-500/30',
        badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
      };
    case 'low':
      return {
        bg: 'bg-amber-500/10',
        text: 'text-amber-400',
        border: 'border-amber-500/30',
        badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
      };
    case 'moderate':
      return {
        bg: 'bg-orange-500/10',
        text: 'text-orange-400',
        border: 'border-orange-500/30',
        badge: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
      };
    case 'high':
      return {
        bg: 'bg-rose-500/10',
        text: 'text-rose-400',
        border: 'border-rose-500/30',
        badge: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
      };
    case 'hyperpyrexia':
      return {
        bg: 'bg-red-600/20',
        text: 'text-red-300',
        border: 'border-red-500/60',
        badge: 'bg-red-600 text-white border-red-400 animate-pulse',
      };
  }
}

/**
 * Seed realistic initial fever logs for demonstration & clinical testing
 */
export function getDefaultFeverLogs(): FeverLogEntry[] {
  const now = Date.now();
  const hour = 3600000;

  return [
    // Mithran episode (recent 48h fever curve)
    {
      id: 'fever_m_1',
      memberId: 'member_mithran',
      memberName: 'Mithran',
      timestamp: new Date(now - hour * 36).toISOString(),
      temperatureF: 99.8,
      temperatureC: 37.7,
      measurementMethod: 'forehead',
      severity: 'low',
      symptoms: ['Mild chills', 'Runny nose'],
      notes: 'Noticed slight warmth before bedtime. Drank warm water.',
      recordedBy: 'Sangeetha (Mother)',
      driveSyncStatus: 'synced',
      createdAt: new Date(now - hour * 36).toISOString(),
    },
    {
      id: 'fever_m_2',
      memberId: 'member_mithran',
      memberName: 'Mithran',
      timestamp: new Date(now - hour * 28).toISOString(),
      temperatureF: 101.8,
      temperatureC: 38.8,
      measurementMethod: 'oral',
      severity: 'moderate',
      symptoms: ['Body ache', 'Headache', 'Flushed cheeks'],
      medicationGiven: {
        name: 'Paracetamol (Crocin Kids 250mg)',
        dose: '7.5 ml syrup',
        givenAt: new Date(now - hour * 28).toISOString(),
      },
      notes: 'Fever spiked early morning. Administered pediatric paracetamol with lukewarm compress.',
      recordedBy: 'Chinnathambi',
      driveSyncStatus: 'synced',
      createdAt: new Date(now - hour * 28).toISOString(),
    },
    {
      id: 'fever_m_3',
      memberId: 'member_mithran',
      memberName: 'Mithran',
      timestamp: new Date(now - hour * 22).toISOString(),
      temperatureF: 100.2,
      temperatureC: 37.9,
      measurementMethod: 'forehead',
      severity: 'low',
      symptoms: ['Mild fatigue'],
      notes: 'Temperature lowered 2 hours post-medication. Ate apple puree.',
      recordedBy: 'Auro AI Voice',
      driveSyncStatus: 'synced',
      createdAt: new Date(now - hour * 22).toISOString(),
    },
    {
      id: 'fever_m_4',
      memberId: 'member_mithran',
      memberName: 'Mithran',
      timestamp: new Date(now - hour * 14).toISOString(),
      temperatureF: 102.6,
      temperatureC: 39.2,
      measurementMethod: 'tympanic_ear',
      severity: 'high',
      symptoms: ['Shivering', 'High fever', 'Loss of appetite'],
      medicationGiven: {
        name: 'Ibuprofen (Ibugesic Plus 100mg)',
        dose: '5 ml syrup',
        givenAt: new Date(now - hour * 14).toISOString(),
      },
      notes: 'Second spike in afternoon. Consulted pediatrician Dr. Sundaram over phone.',
      recordedBy: 'Sangeetha (Mother)',
      driveSyncStatus: 'synced',
      createdAt: new Date(now - hour * 14).toISOString(),
    },
    {
      id: 'fever_m_5',
      memberId: 'member_mithran',
      memberName: 'Mithran',
      timestamp: new Date(now - hour * 8).toISOString(),
      temperatureF: 99.4,
      temperatureC: 37.4,
      measurementMethod: 'forehead',
      severity: 'low',
      symptoms: ['Perspiration', 'Improving energy'],
      notes: 'Sweating out fever. Sleeping comfortably.',
      recordedBy: 'Chinnathambi',
      driveSyncStatus: 'synced',
      createdAt: new Date(now - hour * 8).toISOString(),
    },
    {
      id: 'fever_m_6',
      memberId: 'member_mithran',
      memberName: 'Mithran',
      timestamp: new Date(now - hour * 2).toISOString(),
      temperatureF: 98.6,
      temperatureC: 37.0,
      measurementMethod: 'forehead',
      severity: 'normal',
      symptoms: [],
      notes: 'Afebril. Normal active play, stable temperature.',
      recordedBy: 'Auro AI Voice',
      driveSyncStatus: 'synced',
      createdAt: new Date(now - hour * 2).toISOString(),
    },
    // Maaran log
    {
      id: 'fever_ma_1',
      memberId: 'member_maaran',
      memberName: 'Maaran',
      timestamp: new Date(now - hour * 72).toISOString(),
      temperatureF: 99.2,
      temperatureC: 37.3,
      measurementMethod: 'forehead',
      severity: 'low',
      symptoms: ['Sore throat'],
      notes: 'Complained of throat scratchiness after swimming class. Salt water gargle given.',
      recordedBy: 'Chinnathambi',
      driveSyncStatus: 'synced',
      createdAt: new Date(now - hour * 72).toISOString(),
    },
    {
      id: 'fever_ma_2',
      memberId: 'member_maaran',
      memberName: 'Maaran',
      timestamp: new Date(now - hour * 64).toISOString(),
      temperatureF: 98.4,
      temperatureC: 36.9,
      measurementMethod: 'forehead',
      severity: 'normal',
      symptoms: [],
      notes: 'Throat discomfort resolved, temperature completely normal.',
      recordedBy: 'Sangeetha (Mother)',
      driveSyncStatus: 'synced',
      createdAt: new Date(now - hour * 64).toISOString(),
    },
    // Sangeetha log
    {
      id: 'fever_s_1',
      memberId: 'member_sangeetha',
      memberName: 'Sangeetha',
      timestamp: new Date(now - hour * 120).toISOString(),
      temperatureF: 98.6,
      temperatureC: 37.0,
      measurementMethod: 'oral',
      severity: 'normal',
      symptoms: [],
      notes: 'Routine baseline temperature check.',
      recordedBy: 'Manual Check',
      driveSyncStatus: 'synced',
      createdAt: new Date(now - hour * 120).toISOString(),
    },
    // Chinnathambi log
    {
      id: 'fever_c_1',
      memberId: 'member_chinnathambi',
      memberName: 'Chinnathambi',
      timestamp: new Date(now - hour * 96).toISOString(),
      temperatureF: 98.4,
      temperatureC: 36.9,
      measurementMethod: 'forehead',
      severity: 'normal',
      symptoms: [],
      notes: 'Post-workout cooldown check.',
      recordedBy: 'Apple Health Sync',
      driveSyncStatus: 'synced',
      createdAt: new Date(now - hour * 96).toISOString(),
    },
  ];
}

/**
 * Retrieve cached fever logs from localStorage
 */
export function getLocalFeverLogs(memberId?: string): FeverLogEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_FEVER_LOGS_KEY);
    let logs: FeverLogEntry[] = [];
    if (!raw) {
      logs = getDefaultFeverLogs();
      saveLocalFeverLogs(logs);
    } else {
      logs = JSON.parse(raw);
      if (!Array.isArray(logs) || logs.length === 0) {
        logs = getDefaultFeverLogs();
        saveLocalFeverLogs(logs);
      }
    }

    if (memberId && memberId.trim() && memberId !== 'all') {
      logs = logs.filter((l) => l.memberId === memberId.trim() || l.memberName.toLowerCase() === memberId.trim().toLowerCase());
    }
    return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  } catch (err) {
    console.warn('[FeverSync] Error reading local fever logs:', err);
    return getDefaultFeverLogs();
  }
}

/**
 * Save fever logs to localStorage and dispatch update events
 */
export function saveLocalFeverLogs(logs: FeverLogEntry[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_FEVER_LOGS_KEY, JSON.stringify(logs));
    window.dispatchEvent(new CustomEvent('aura_fever_logs_changed', { detail: logs }));
    window.dispatchEvent(new Event('storage'));
  } catch (err) {
    console.warn('[FeverSync] Error saving fever logs to local storage:', err);
  }
}

/**
 * Fetch fever logs from SQLite backend and merge with local storage
 */
export async function fetchFeverLogsFromSqlite(memberId?: string): Promise<FeverLogEntry[]> {
  try {
    const baseUrl = getApiUrl('/api/health/fever-logs');
    const url = new URL(baseUrl, typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
    if (memberId && memberId !== 'all') {
      url.searchParams.set('memberId', memberId);
    }
    const res = await fetch(url.toString());
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.logs) && data.logs.length > 0) {
        // Map SQLite records to FeverLogEntry
        const mappedLogs: FeverLogEntry[] = data.logs.map((row: any) => ({
          id: row.id,
          memberId: row.memberId,
          memberName: row.memberName,
          timestamp: row.timestamp,
          temperatureF: row.temperatureF,
          temperatureC: row.temperatureC,
          measurementMethod: row.measurementMethod,
          severity: row.severity,
          symptoms: typeof row.symptomsJson === 'string' ? JSON.parse(row.symptomsJson || '[]') : (row.symptomsJson || []),
          medicationGiven: row.medicationGivenJson ? (typeof row.medicationGivenJson === 'string' ? JSON.parse(row.medicationGivenJson) : row.medicationGivenJson) : undefined,
          notes: row.notes,
          recordedBy: row.recordedBy,
          driveFileId: row.driveFileId,
          driveWebViewLink: row.driveWebViewLink,
          driveSyncStatus: row.driveSyncStatus,
          createdAt: row.createdAt,
        }));

        // Merge with existing local logs
        const currentLocal = getLocalFeverLogs();
        const mergedMap = new Map<string, FeverLogEntry>();
        currentLocal.forEach((l) => mergedMap.set(l.id, l));
        mappedLogs.forEach((l) => mergedMap.set(l.id, l));
        const mergedList = Array.from(mergedMap.values()).sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        saveLocalFeverLogs(mergedList);

        if (memberId && memberId !== 'all') {
          return mergedList.filter((l) => l.memberId === memberId || l.memberName.toLowerCase() === memberId.toLowerCase());
        }
        return mergedList;
      }
    }
  } catch (err) {
    console.warn('[FeverSync] Could not reach SQLite backend for fever logs:', err);
  }
  return getLocalFeverLogs(memberId);
}

/**
 * Record a new Fever Temperature Entry:
 * 1. Saves to LocalStorage
 * 2. Persists to SQLite `/api/health/fever-logs`
 * 3. Triggers Google Drive background sync
 */
export async function recordFeverTemperature(
  entryData: {
    memberId: string;
    memberName: string;
    temperatureF?: number;
    temperatureC?: number;
    measurementMethod?: FeverLogEntry['measurementMethod'];
    symptoms?: string[];
    medicationGiven?: {
      name: string;
      dose: string;
      givenAt: string;
    };
    notes?: string;
    recordedBy?: string;
    timestamp?: string;
  }
): Promise<FeverLogEntry> {
  const now = new Date().toISOString();
  const id = `fever_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  let tempF = entryData.temperatureF;
  let tempC = entryData.temperatureC;

  if (tempF === undefined && tempC !== undefined) {
    tempF = celsiusToFahrenheit(tempC);
  } else if (tempF !== undefined && tempC === undefined) {
    tempC = fahrenheitToCelsius(tempF);
  } else if (tempF === undefined && tempC === undefined) {
    tempF = 98.6;
    tempC = 37.0;
  }

  const severity = calculateFeverSeverity(tempF!);

  const newLog: FeverLogEntry = {
    id,
    memberId: entryData.memberId,
    memberName: entryData.memberName,
    timestamp: entryData.timestamp || now,
    temperatureF: Number(tempF!.toFixed(1)),
    temperatureC: Number(tempC!.toFixed(1)),
    measurementMethod: entryData.measurementMethod || 'forehead',
    severity,
    symptoms: entryData.symptoms || [],
    medicationGiven: entryData.medicationGiven,
    notes: entryData.notes || '',
    recordedBy: entryData.recordedBy || 'AURO Voice Assistant',
    driveSyncStatus: 'local_only',
    createdAt: now,
  };

  // 1. Save to LocalStorage immediately
  const existing = getLocalFeverLogs();
  const updated = [newLog, ...existing.filter((item) => item.id !== newLog.id)].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  saveLocalFeverLogs(updated);

  // 2. Persist to SQLite
  try {
    const res = await fetch(getApiUrl('/api/health/fever-logs'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: newLog.id,
        memberId: newLog.memberId,
        memberName: newLog.memberName,
        timestamp: newLog.timestamp,
        temperatureF: newLog.temperatureF,
        temperatureC: newLog.temperatureC,
        measurementMethod: newLog.measurementMethod,
        severity: newLog.severity,
        symptomsJson: JSON.stringify(newLog.symptoms),
        medicationGivenJson: newLog.medicationGiven ? JSON.stringify(newLog.medicationGiven) : '',
        notes: newLog.notes,
        recordedBy: newLog.recordedBy,
        driveSyncStatus: 'local_only',
        createdAt: newLog.createdAt,
      }),
    });
    if (!res.ok) {
      console.warn('[FeverSync] SQLite save status:', res.status);
    }
  } catch (err) {
    console.warn('[FeverSync] SQLite network error during save:', err);
  }

  // 3. Initiate Google Drive sync in background if authenticated
  const token = getGoogleAccessToken();
  if (token) {
    syncFeverLogsWithGoogleDrive(token).catch((err) => {
      console.warn('[FeverSync] Background Google Drive sync deferred:', err);
    });
  }

  return newLog;
}

/**
 * Delete a fever log entry from local storage and SQLite
 */
export async function deleteFeverLog(id: string): Promise<boolean> {
  const current = getLocalFeverLogs();
  const filtered = current.filter((l) => l.id !== id);
  saveLocalFeverLogs(filtered);

  try {
    await fetch(getApiUrl(`/api/health/fever-logs/${id}`), {
      method: 'DELETE',
    });
  } catch (err) {
    console.warn('[FeverSync] Failed to delete fever log from SQLite:', err);
  }
  return true;
}

/**
 * Sync fever logs with Google Drive:
 * Creates/finds "Family Circle / Health And Wellness / Family Heath Record / Fever Logs"
 * Uploads a standardized clinical fever history JSON file and markdown summary
 */
export async function syncFeverLogsWithGoogleDrive(token?: string): Promise<{ success: boolean; syncedCount: number }> {
  const activeToken = token || getGoogleAccessToken();
  if (!activeToken) {
    return { success: false, syncedCount: 0 };
  }

  try {
    // 1. Ensure folder exists in Drive
    const folderId = await getOrCreateGoogleDriveFolder(
      FEVER_FOLDER_PATH,
      activeToken
    );

    const logs = getLocalFeverLogs();
    if (logs.length === 0) {
      return { success: true, syncedCount: 0 };
    }

    // Group logs by member
    const memberLogsMap = new Map<string, FeverLogEntry[]>();
    logs.forEach((log) => {
      const list = memberLogsMap.get(log.memberName) || [];
      list.push(log);
      memberLogsMap.set(log.memberName, list);
    });

    let totalSynced = 0;

    // Upload a consolidated JSON report file for each family member with fever history
    for (const [memberName, memberLogs] of memberLogsMap.entries()) {
      const filename = `Fever_Report_${memberName.replace(/\s+/g, '_')}_Latest.json`;
      const reportPayload = {
        title: `Family Circle Fever Log - ${memberName}`,
        generatedAt: new Date().toISOString(),
        familyMember: memberName,
        totalEntries: memberLogs.length,
        highestTemperatureF: Math.max(...memberLogs.map((l) => l.temperatureF)),
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
        description: `AURO Health & Wellness Clinical Fever Temperature Records for ${memberName}`,
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

        // Update local logs sync status for this member
        for (const log of memberLogs) {
          log.driveFileId = driveFileId;
          log.driveWebViewLink = driveWebViewLink;
          log.driveSyncStatus = 'synced';

          // Patch SQLite
          try {
            await fetch(getApiUrl(`/api/health/fever-logs/${log.id}/drive-sync`), {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                driveFileId,
                driveWebViewLink,
                syncStatus: 'synced',
              }),
            });
          } catch {}
        }
        totalSynced += memberLogs.length;
      }
    }

    saveLocalFeverLogs(logs);
    return { success: true, syncedCount: totalSynced };
  } catch (err) {
    console.warn('[FeverSync] Google Drive sync error:', err);
    return { success: false, syncedCount: 0 };
  }
}

/**
 * Helper to prepare printable data for clinical report
 */
export function getPrintableFeverReport(memberId: string) {
  const records = getLocalHealthRecords();
  const member = records.find((r) => r.memberId === memberId || r.id === memberId) || null;
  const logs = getLocalFeverLogs(memberId);
  return {
    member,
    logs: logs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()),
  };
}
