// Sovereign Family Circle - Fever Temperature Recording & Drive/SQLite Sync Service
// Folder: Family Circle / Health And Wellness / Family Heath Record / Fever Logs

import { FeverLogEntry, FeverSeverity, FamilyHealthRecord, FeverReadingGroup } from '../types/healthRecord';
import { getGoogleAccessToken, getLocalHealthRecords } from './healthRecordDriveSync';
import { getOrCreateGoogleDriveFolder } from './googleWorkspace';
import { getApiUrl } from './api';

const LOCAL_FEVER_LOGS_KEY = 'aura_family_fever_logs_v1';
const LOCAL_FEVER_GROUPS_KEY = 'aura_family_fever_groups_v1';

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
 * Seed realistic initial fever reading groups (episodes/illness clusters)
 */
export function getDefaultFeverGroups(): FeverReadingGroup[] {
  const now = Date.now();
  const hour = 3600000;

  return [
    {
      id: 'grp_mithran_viral_nov',
      memberId: 'member_mithran',
      memberName: 'Mithran',
      groupName: 'Viral Flu Episode (Nov 2026)',
      startDate: new Date(now - hour * 40).toISOString(),
      isActive: true,
      notes: 'Pediatric fever episode with body aches, chills, and temperature spikes up to 102.6°F. Monitoring recovery with hydration and antipyretics.',
      recordedBy: 'Sangeetha (Mother)',
      driveSyncStatus: 'synced',
      createdAt: new Date(now - hour * 40).toISOString(),
    },
    {
      id: 'grp_maaran_throat_nov',
      memberId: 'member_maaran',
      memberName: 'Maaran',
      groupName: 'Post-Swimming Throat Episode',
      startDate: new Date(now - hour * 80).toISOString(),
      endDate: new Date(now - hour * 60).toISOString(),
      isActive: false,
      notes: 'Throat discomfort after swimming class resolved with warm salt water gargle. Normal temperature re-established.',
      recordedBy: 'Chinnathambi',
      driveSyncStatus: 'synced',
      createdAt: new Date(now - hour * 80).toISOString(),
    },
    {
      id: 'grp_general_baseline',
      memberId: 'member_chinnathambi',
      memberName: 'Chinnathambi',
      groupName: 'Routine Wellness Baseline',
      startDate: new Date(now - hour * 120).toISOString(),
      isActive: false,
      notes: 'Routine baseline temperature checks for adults.',
      recordedBy: 'Apple Health Sync',
      driveSyncStatus: 'synced',
      createdAt: new Date(now - hour * 120).toISOString(),
    },
  ];
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
      readingGroupId: 'grp_mithran_viral_nov',
      readingGroupName: 'Viral Flu Episode (Nov 2026)',
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
      readingGroupId: 'grp_mithran_viral_nov',
      readingGroupName: 'Viral Flu Episode (Nov 2026)',
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
      readingGroupId: 'grp_mithran_viral_nov',
      readingGroupName: 'Viral Flu Episode (Nov 2026)',
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
      readingGroupId: 'grp_mithran_viral_nov',
      readingGroupName: 'Viral Flu Episode (Nov 2026)',
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
      readingGroupId: 'grp_mithran_viral_nov',
      readingGroupName: 'Viral Flu Episode (Nov 2026)',
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
      readingGroupId: 'grp_mithran_viral_nov',
      readingGroupName: 'Viral Flu Episode (Nov 2026)',
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
      readingGroupId: 'grp_maaran_throat_nov',
      readingGroupName: 'Post-Swimming Throat Episode',
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
      readingGroupId: 'grp_maaran_throat_nov',
      readingGroupName: 'Post-Swimming Throat Episode',
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
      readingGroupId: 'grp_general_baseline',
      readingGroupName: 'Routine Wellness Baseline',
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
      readingGroupId: 'grp_general_baseline',
      readingGroupName: 'Routine Wellness Baseline',
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
 * Retrieve cached fever reading groups from localStorage
 */
export function getLocalFeverGroups(memberId?: string): FeverReadingGroup[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_FEVER_GROUPS_KEY);
    let groups: FeverReadingGroup[] = [];
    if (!raw) {
      groups = getDefaultFeverGroups();
      saveLocalFeverGroups(groups);
    } else {
      groups = JSON.parse(raw);
      if (!Array.isArray(groups) || groups.length === 0) {
        groups = getDefaultFeverGroups();
        saveLocalFeverGroups(groups);
      }
    }

    if (memberId && memberId.trim() && memberId !== 'all') {
      groups = groups.filter((g) => g.memberId === memberId.trim() || g.memberName.toLowerCase() === memberId.trim().toLowerCase());
    }
    return groups.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
  } catch (err) {
    console.warn('[FeverSync] Error reading local fever groups:', err);
    return getDefaultFeverGroups();
  }
}

/**
 * Save fever reading groups to localStorage and dispatch update events
 */
export function saveLocalFeverGroups(groups: FeverReadingGroup[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_FEVER_GROUPS_KEY, JSON.stringify(groups));
    window.dispatchEvent(new CustomEvent('aura_fever_groups_changed', { detail: groups }));
    window.dispatchEvent(new Event('storage'));
  } catch (err) {
    console.warn('[FeverSync] Error saving fever groups to local storage:', err);
  }
}

/**
 * Fetch fever reading groups from SQLite backend and merge with local storage
 */
export async function fetchFeverGroupsFromSqlite(memberId?: string): Promise<FeverReadingGroup[]> {
  try {
    const baseUrl = getApiUrl('/api/health/fever-groups');
    const url = new URL(baseUrl, typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
    if (memberId && memberId !== 'all') {
      url.searchParams.set('memberId', memberId);
    }
    const res = await fetch(url.toString());
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.groups) && data.groups.length > 0) {
        const mappedGroups: FeverReadingGroup[] = data.groups.map((row: any) => ({
          id: row.id,
          memberId: row.memberId,
          memberName: row.memberName,
          groupName: row.groupName,
          startDate: row.startDate,
          endDate: row.endDate,
          isActive: Boolean(row.isActive),
          notes: row.notes,
          recordedBy: row.recordedBy,
          driveFolderId: row.driveFolderId,
          driveWebViewLink: row.driveWebViewLink,
          driveSyncStatus: row.driveSyncStatus,
          createdAt: row.createdAt,
        }));

        const currentLocal = getLocalFeverGroups();
        const mergedMap = new Map<string, FeverReadingGroup>();
        currentLocal.forEach((g) => mergedMap.set(g.id, g));
        mappedGroups.forEach((g) => mergedMap.set(g.id, g));
        const mergedList = Array.from(mergedMap.values()).sort(
          (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
        );
        saveLocalFeverGroups(mergedList);

        if (memberId && memberId !== 'all') {
          return mergedList.filter((g) => g.memberId === memberId || g.memberName.toLowerCase() === memberId.toLowerCase());
        }
        return mergedList;
      }
    }
  } catch (err) {
    console.warn('[FeverSync] Could not reach SQLite backend for fever groups:', err);
  }
  return getLocalFeverGroups(memberId);
}

/**
 * Create a new Named Fever Reading Group (Episode / Illness Cluster)
 */
export async function createFeverReadingGroup(groupData: {
  memberId: string;
  memberName: string;
  groupName: string;
  startDate?: string;
  endDate?: string;
  isActive?: boolean;
  notes?: string;
  recordedBy?: string;
}): Promise<FeverReadingGroup> {
  const now = new Date().toISOString();
  const id = `grp_fever_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const newGroup: FeverReadingGroup = {
    id,
    memberId: groupData.memberId,
    memberName: groupData.memberName,
    groupName: groupData.groupName.trim(),
    startDate: groupData.startDate || now,
    endDate: groupData.endDate,
    isActive: groupData.isActive !== undefined ? groupData.isActive : true,
    notes: groupData.notes || '',
    recordedBy: groupData.recordedBy || 'AURO Health Assistant',
    driveSyncStatus: 'local_only',
    createdAt: now,
  };

  const existing = getLocalFeverGroups();
  const updated = [newGroup, ...existing.filter((g) => g.id !== newGroup.id)];
  saveLocalFeverGroups(updated);

  try {
    await fetch(getApiUrl('/api/health/fever-groups'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newGroup),
    });
  } catch (err) {
    console.warn('[FeverSync] Error saving fever group to SQLite:', err);
  }

  // Background Google Drive sync
  const token = getGoogleAccessToken();
  if (token) {
    syncFeverGroupToGoogleDrive(newGroup, [], token).catch(() => {});
  }

  return newGroup;
}

/**
 * Update a Named Fever Reading Group (e.g. resolve/close episode, edit notes)
 */
export async function updateFeverReadingGroup(
  id: string,
  updates: Partial<FeverReadingGroup>
): Promise<FeverReadingGroup | null> {
  const existing = getLocalFeverGroups();
  const idx = existing.findIndex((g) => g.id === id);
  if (idx === -1) return null;

  const updatedGroup = { ...existing[idx], ...updates };
  existing[idx] = updatedGroup;
  saveLocalFeverGroups(existing);

  try {
    await fetch(getApiUrl('/api/health/fever-groups'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedGroup),
    });
  } catch (err) {
    console.warn('[FeverSync] Error updating group in SQLite:', err);
  }

  return updatedGroup;
}

/**
 * Delete a Named Fever Reading Group from LocalStorage and SQLite
 */
export async function deleteFeverReadingGroup(id: string): Promise<boolean> {
  const existing = getLocalFeverGroups();
  saveLocalFeverGroups(existing.filter((g) => g.id !== id));

  try {
    await fetch(getApiUrl(`/api/health/fever-groups/${id}`), {
      method: 'DELETE',
    });
  } catch (err) {
    console.warn('[FeverSync] Error deleting group from SQLite:', err);
  }
  return true;
}

/**
 * Sync a Fever Reading Group manifest to Google Drive
 */
export async function syncFeverGroupToGoogleDrive(
  group: FeverReadingGroup,
  logsInGroup: FeverLogEntry[],
  token?: string
): Promise<{ success: boolean; driveFolderId?: string; driveWebViewLink?: string }> {
  const activeToken = token || getGoogleAccessToken();
  if (!activeToken) {
    return { success: false };
  }

  try {
    const parentFolderId = await getOrCreateGoogleDriveFolder(FEVER_FOLDER_PATH, activeToken);

    const cleanMember = group.memberName.replace(/\s+/g, '_');
    const cleanGroup = group.groupName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `Fever_Group_Report_${cleanMember}_${cleanGroup}_${group.id.slice(-6)}.json`;

    const groupPayload = {
      title: `Family Circle Fever Episode Report - ${group.groupName}`,
      groupId: group.id,
      familyMember: group.memberName,
      memberId: group.memberId,
      episodeName: group.groupName,
      status: group.isActive ? 'Active Fever Episode' : 'Resolved / Concluded',
      startDate: group.startDate,
      endDate: group.endDate || null,
      notes: group.notes || '',
      recordedBy: group.recordedBy || 'AURO Health Assistant',
      totalMomentsCount: logsInGroup.length,
      peakTemperatureF: logsInGroup.length > 0 ? Math.max(...logsInGroup.map((l) => l.temperatureF)) : null,
      lowestTemperatureF: logsInGroup.length > 0 ? Math.min(...logsInGroup.map((l) => l.temperatureF)) : null,
      moments: logsInGroup.map((m) => ({
        momentId: m.id,
        timestamp: m.timestamp,
        temperatureF: m.temperatureF,
        temperatureC: m.temperatureC,
        severity: m.severity,
        measurementMethod: m.measurementMethod,
        symptoms: m.symptoms,
        medicationGiven: m.medicationGiven || null,
        recordedBy: m.recordedBy,
        driveWebViewLink: m.driveWebViewLink || null,
      })),
      syncedAt: new Date().toISOString(),
    };

    const fileContent = JSON.stringify(groupPayload, null, 2);
    const boundary = '-------314159265358979323846';
    const delimiter = '\r\n--' + boundary + '\r\n';
    const closeDelim = '\r\n--' + boundary + '--';

    const metadata = {
      name: filename,
      mimeType: 'application/json',
      parents: [parentFolderId],
      description: `Clinical fever reading group summary for ${group.memberName}: ${group.groupName}`,
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
      const driveFolderId = driveData.id;
      const driveWebViewLink = `https://drive.google.com/file/d/${driveFolderId}/view`;

      // Update group locally
      updateFeverReadingGroup(group.id, {
        driveFolderId,
        driveWebViewLink,
        driveSyncStatus: 'synced',
      });

      // Update in SQLite
      try {
        await fetch(getApiUrl(`/api/health/fever-groups/${group.id}/drive-sync`), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            driveFolderId,
            driveWebViewLink,
          }),
        });
      } catch (err) {
        console.warn('[FeverSync] SQLite group drive sync patch error:', err);
      }

      return { success: true, driveFolderId, driveWebViewLink };
    }
  } catch (err) {
    console.warn('[FeverSync] Error syncing fever group to Google Drive:', err);
  }
  return { success: false };
}

/**
 * Fetch fever logs from SQLite backend and merge with local storage
 */
export async function fetchFeverLogsFromSqlite(memberId?: string, readingGroupId?: string): Promise<FeverLogEntry[]> {
  try {
    const baseUrl = getApiUrl('/api/health/fever-logs');
    const url = new URL(baseUrl, typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
    if (memberId && memberId !== 'all') {
      url.searchParams.set('memberId', memberId);
    }
    if (readingGroupId && readingGroupId !== 'all') {
      url.searchParams.set('readingGroupId', readingGroupId);
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
          readingGroupId: row.readingGroupId,
          readingGroupName: row.readingGroupName,
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

        let result = mergedList;
        if (memberId && memberId !== 'all') {
          result = result.filter((l) => l.memberId === memberId || l.memberName.toLowerCase() === memberId.toLowerCase());
        }
        if (readingGroupId && readingGroupId !== 'all') {
          result = result.filter((l) => l.readingGroupId === readingGroupId);
        }
        return result;
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
    readingGroupId?: string;
    readingGroupName?: string;
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

  let readingGroupId = entryData.readingGroupId;
  let readingGroupName = entryData.readingGroupName;

  // If no group specified, attach to an active group for this member if exists
  if (!readingGroupId) {
    const memberGroups = getLocalFeverGroups(entryData.memberId);
    const activeGroup = memberGroups.find((g) => g.isActive);
    if (activeGroup) {
      readingGroupId = activeGroup.id;
      readingGroupName = activeGroup.groupName;
    }
  }

  const newLog: FeverLogEntry = {
    id,
    memberId: entryData.memberId,
    memberName: entryData.memberName,
    readingGroupId,
    readingGroupName,
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
        readingGroupId: newLog.readingGroupId,
        readingGroupName: newLog.readingGroupName,
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

  // 3. Initiate Google Drive sync for this specific moment immediately if authenticated
  const token = getGoogleAccessToken();
  if (token) {
    syncSingleFeverLogToGoogleDrive(newLog, token).catch((err) => {
      console.warn('[FeverSync] Moment Google Drive sync deferred:', err);
    });
  }

  return newLog;
}

/**
 * Sync an individual fever moment record to Google Drive as its own standalone file
 * in "Family Circle/Health And Wellness/Family Heath Record/Fever Logs".
 * Also patches SQLite with the moment's driveFileId and driveWebViewLink.
 */
export async function syncSingleFeverLogToGoogleDrive(
  log: FeverLogEntry,
  token?: string
): Promise<{ success: boolean; driveFileId?: string; driveWebViewLink?: string }> {
  const activeToken = token || getGoogleAccessToken();
  if (!activeToken) {
    return { success: false };
  }

  try {
    const folderId = await getOrCreateGoogleDriveFolder(FEVER_FOLDER_PATH, activeToken);

    // Format human-readable date & time for moment filename
    const dateObj = new Date(log.timestamp);
    const dateStr = dateObj.toISOString().split('T')[0];
    const timeStr = `${String(dateObj.getHours()).padStart(2, '0')}-${String(dateObj.getMinutes()).padStart(2, '0')}`;
    const cleanMember = log.memberName.replace(/\s+/g, '_');
    const cleanId = log.id.slice(-6);
    const filename = `Fever_Moment_${cleanMember}_${dateStr}_${timeStr}_${log.temperatureF}F_${cleanId}.json`;

    const momentPayload = {
      title: `Family Circle Fever Observation Moment - ${log.memberName}`,
      recordId: log.id,
      readingGroupId: log.readingGroupId || null,
      readingGroupName: log.readingGroupName || 'Ungrouped Moments',
      familyMember: log.memberName,
      memberId: log.memberId,
      momentTimestamp: log.timestamp,
      momentFormatted: dateObj.toLocaleString([], {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      temperature: {
        fahrenheit: log.temperatureF,
        celsius: log.temperatureC,
        severity: log.severity,
        severityLabel: getSeverityLabel(log.severity),
      },
      measurementSite: log.measurementMethod,
      symptomsAtMoment: log.symptoms,
      medicationAtMoment: log.medicationGiven || null,
      clinicalObserver: log.recordedBy,
      notes: log.notes || '',
      storageStatus: {
        sqliteTable: 'fever_logs',
        persistedInSqlite: true,
        persistedInGoogleDrive: true,
      },
      syncedAt: new Date().toISOString(),
    };

    const fileContent = JSON.stringify(momentPayload, null, 2);
    const boundary = '-------314159265358979323846';
    const delimiter = '\r\n--' + boundary + '\r\n';
    const closeDelim = '\r\n--' + boundary + '--';

    const metadata = {
      name: filename,
      mimeType: 'application/json',
      parents: [folderId],
      description: `Clinical fever temperature moment for ${log.memberName} on ${momentPayload.momentFormatted} (${log.temperatureF}°F)`,
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

      // Update log object
      log.driveFileId = driveFileId;
      log.driveWebViewLink = driveWebViewLink;
      log.driveSyncStatus = 'synced';

      // Update local storage
      const logs = getLocalFeverLogs();
      const idx = logs.findIndex((l) => l.id === log.id);
      if (idx !== -1) {
        logs[idx] = { ...logs[idx], driveFileId, driveWebViewLink, driveSyncStatus: 'synced' };
        saveLocalFeverLogs(logs);
      }

      // Update SQLite persistent store
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
      } catch (e) {
        console.warn('[FeverSync] SQLite patch sync status failed:', e);
      }

      return { success: true, driveFileId, driveWebViewLink };
    }
  } catch (err) {
    console.warn('[FeverSync] Single moment sync error:', err);
  }
  return { success: false };
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
 * 1. Synchronizes each fever moment as its own file in
 *    "Family Circle / Health And Wellness / Family Heath Record / Fever Logs"
 * 2. Also updates the master member timeline JSON summary
 * 3. Patches SQLite records with Drive File IDs and Web Links
 */
export async function syncFeverLogsWithGoogleDrive(token?: string): Promise<{ success: boolean; syncedCount: number }> {
  const activeToken = token || getGoogleAccessToken();
  if (!activeToken) {
    return { success: false, syncedCount: 0 };
  }

  try {
    const folderId = await getOrCreateGoogleDriveFolder(
      FEVER_FOLDER_PATH,
      activeToken
    );

    const logs = getLocalFeverLogs();
    if (logs.length === 0) {
      return { success: true, syncedCount: 0 };
    }

    let totalSynced = 0;

    // 1. Maintain each individual moment in Google Drive & SQLite
    for (const log of logs) {
      const res = await syncSingleFeverLogToGoogleDrive(log, activeToken);
      if (res.success) {
        totalSynced++;
      }
    }

    // 2. Also maintain the master timeline report for each family member
    const memberLogsMap = new Map<string, FeverLogEntry[]>();
    logs.forEach((log) => {
      const list = memberLogsMap.get(log.memberName) || [];
      list.push(log);
      memberLogsMap.set(log.memberName, list);
    });

    for (const [memberName, memberLogs] of memberLogsMap.entries()) {
      const cleanMember = memberName.replace(/\s+/g, '_');
      const filename = `Fever_Timeline_${cleanMember}_AllMoments.json`;
      const reportPayload = {
        title: `Family Circle Fever Timeline - ${memberName}`,
        generatedAt: new Date().toISOString(),
        familyMember: memberName,
        totalMomentsRecorded: memberLogs.length,
        highestTemperatureF: Math.max(...memberLogs.map((l) => l.temperatureF)),
        lowestTemperatureF: Math.min(...memberLogs.map((l) => l.temperatureF)),
        moments: memberLogs.map((m) => ({
          momentId: m.id,
          timestamp: m.timestamp,
          temperatureF: m.temperatureF,
          temperatureC: m.temperatureC,
          severity: m.severity,
          method: m.measurementMethod,
          symptoms: m.symptoms,
          medication: m.medicationGiven || null,
          observer: m.recordedBy,
          driveWebViewLink: m.driveWebViewLink || null,
        })),
      };

      const fileContent = JSON.stringify(reportPayload, null, 2);
      const boundary = '-------314159265358979323846';
      const delimiter = '\r\n--' + boundary + '\r\n';
      const closeDelim = '\r\n--' + boundary + '--';

      const metadata = {
        name: filename,
        mimeType: 'application/json',
        parents: [folderId],
        description: `AURO Health & Wellness Master Fever Timeline with moments for ${memberName}`,
      };

      const multipartRequestBody =
        delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        'Content-Type: application/json\r\n\r\n' +
        fileContent +
        closeDelim;

      await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${activeToken}`,
            'Content-Type': `multipart/related; boundary=${boundary}`,
          },
          body: multipartRequestBody,
        }
      ).catch(() => {});
    }

    return { success: true, syncedCount: totalSynced };
  } catch (err) {
    console.warn('[FeverSync] Google Drive sync error:', err);
    return { success: false, syncedCount: 0 };
  }
}

/**
 * Helper to prepare printable data for clinical report
 */
export function getPrintableFeverReport(memberId: string, readingGroupId?: string) {
  const records = getLocalHealthRecords();
  const member = records.find((r) => r.memberId === memberId || r.id === memberId) || null;
  let logs = getLocalFeverLogs(memberId);
  const allGroups = getLocalFeverGroups(memberId);
  let group: FeverReadingGroup | null = null;

  if (readingGroupId && readingGroupId !== 'all') {
    group = allGroups.find((g) => g.id === readingGroupId) || null;
    logs = logs.filter((l) => l.readingGroupId === readingGroupId);
  }

  const sortedLogs = logs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  const peakLog = sortedLogs.length > 0 ? [...sortedLogs].sort((a, b) => b.temperatureF - a.temperatureF)[0] : null;
  const lowestLog = sortedLogs.length > 0 ? [...sortedLogs].sort((a, b) => a.temperatureF - b.temperatureF)[0] : null;

  return {
    member,
    group,
    allGroups,
    logs: sortedLogs,
    peakLog,
    lowestLog,
    totalMoments: sortedLogs.length,
  };
}
