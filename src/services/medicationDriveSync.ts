// Sovereign Family Circle - Smart Medication & Supplement Drive/SQLite Sync Service
// Folder: Family Circle / Health And Wellness / Family Heath Record / Medication Schedules & Logs

import {
  MedicationEntry,
  MedicationDoseLog,
  MedicationCategory,
  MedicationDoseStatus,
  FamilyHealthRecord,
} from '../types/healthRecord';
import {
  getGoogleAccessToken,
  getLocalHealthRecords,
  saveLocalHealthRecords,
} from './healthRecordDriveSync';
import { getOrCreateGoogleDriveFolder } from './googleWorkspace';
import { getApiUrl } from './api';

const LOCAL_MEDICATION_LOGS_KEY = 'aura_family_medication_logs_v1';

export const MEDICATION_FOLDER_PATH =
  'Family Circle/Health And Wellness/Family Heath Record/Medication Schedules & Logs';

/**
 * Default Seed Medication Dose Logs (historical compliance logs)
 */
export function getDefaultMedicationLogs(): MedicationDoseLog[] {
  const now = Date.now();
  const day = 86400000;

  return [
    // Chinnathambi logs
    {
      id: 'medlog_c_1',
      memberId: 'member_chinnathambi',
      memberName: 'Chinnathambi',
      medicationId: 'med_c_1',
      drugName: 'Vitamin D3 + K2 (MK-7)',
      category: 'supplement',
      dosage: '5000 IU / 100mcg',
      timeSlot: 'morning',
      scheduledTime: '08:00 AM',
      loggedAt: new Date(now - 3600000 * 3).toISOString(),
      status: 'taken',
      loggedBy: 'Auro Voice Assistant',
      notes: 'Taken with bulletproof coffee & avocado toast',
      pillsRemaining: 42,
      driveSyncStatus: 'synced',
      createdAt: new Date(now - 3600000 * 3).toISOString(),
    },
    {
      id: 'medlog_c_2',
      memberId: 'member_chinnathambi',
      memberName: 'Chinnathambi',
      medicationId: 'med_c_2',
      drugName: 'Omega-3 Wild Alaskan Fish Oil',
      category: 'supplement',
      dosage: '1200mg (EPA 720mg / DHA 480mg)',
      timeSlot: 'morning',
      scheduledTime: '08:00 AM',
      loggedAt: new Date(now - 3600000 * 3).toISOString(),
      status: 'taken',
      loggedBy: 'Auro Voice Assistant',
      notes: 'Post-breakfast cardio routine',
      pillsRemaining: 28,
      driveSyncStatus: 'synced',
      createdAt: new Date(now - 3600000 * 3).toISOString(),
    },
    {
      id: 'medlog_c_3',
      memberId: 'member_chinnathambi',
      memberName: 'Chinnathambi',
      medicationId: 'med_c_3',
      drugName: 'Magnesium Glycinate & L-Threonate',
      category: 'supplement',
      dosage: '400mg',
      timeSlot: 'bedtime',
      scheduledTime: '10:00 PM',
      loggedAt: new Date(now - day).toISOString(),
      status: 'taken',
      loggedBy: 'Self',
      notes: 'Deep neuro-sleep and REM recovery support',
      pillsRemaining: 14,
      driveSyncStatus: 'synced',
      createdAt: new Date(now - day).toISOString(),
    },
    // Selvi logs
    {
      id: 'medlog_s_1',
      memberId: 'member_selvi',
      memberName: 'Selvi',
      medicationId: 'med_s_1',
      drugName: 'Vitamin D3 (Cholecalciferol) 60,000 IU',
      category: 'prescription',
      dosage: '1 oral solution shot',
      timeSlot: 'morning',
      scheduledTime: '09:00 AM',
      loggedAt: new Date(now - day * 2).toISOString(),
      status: 'taken',
      loggedBy: 'Auro Voice Assistant',
      notes: 'Weekly Sunday dose with milk',
      pillsRemaining: 6,
      driveSyncStatus: 'synced',
      createdAt: new Date(now - day * 2).toISOString(),
    },
    {
      id: 'medlog_s_2',
      memberId: 'member_selvi',
      memberName: 'Selvi',
      medicationId: 'med_s_2',
      drugName: 'CoQ10 (Ubiquinol 100mg)',
      category: 'supplement',
      dosage: '1 capsule',
      timeSlot: 'morning',
      scheduledTime: '09:00 AM',
      loggedAt: new Date(now - 3600000 * 4).toISOString(),
      status: 'taken',
      loggedBy: 'Self',
      notes: 'Mitochondrial antioxidant support',
      pillsRemaining: 20,
      driveSyncStatus: 'synced',
      createdAt: new Date(now - 3600000 * 4).toISOString(),
    },
    // Maaran logs
    {
      id: 'medlog_ma_1',
      memberId: 'member_maaran',
      memberName: 'Maaran',
      medicationId: 'med_ma_1',
      drugName: 'Kids Multivitamin & Iron Chewables',
      category: 'supplement',
      dosage: '1 bear gummy',
      timeSlot: 'morning',
      scheduledTime: '07:30 AM',
      loggedAt: new Date(now - 3600000 * 4).toISOString(),
      status: 'taken',
      loggedBy: 'Selvi (Mother)',
      notes: 'Given before school bus',
      pillsRemaining: 25,
      driveSyncStatus: 'synced',
      createdAt: new Date(now - 3600000 * 4).toISOString(),
    },
    // Mithran logs
    {
      id: 'medlog_mi_1',
      memberId: 'member_mithran',
      memberName: 'Mithran',
      medicationId: 'med_mi_1',
      drugName: 'Pediatric Probiotic & Zinc Drops',
      category: 'supplement',
      dosage: '5 drops',
      timeSlot: 'morning',
      scheduledTime: '08:00 AM',
      loggedAt: new Date(now - 3600000 * 2).toISOString(),
      status: 'taken',
      loggedBy: 'Auro Voice Assistant',
      notes: 'Mixed in warm apple puree',
      pillsRemaining: 18,
      driveSyncStatus: 'synced',
      createdAt: new Date(now - 3600000 * 2).toISOString(),
    },
  ];
}

/**
 * Retrieve cached medication dose logs from localStorage
 */
export function getLocalMedicationLogs(memberId?: string): MedicationDoseLog[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_MEDICATION_LOGS_KEY);
    let logs: MedicationDoseLog[] = [];
    if (!raw) {
      logs = getDefaultMedicationLogs();
      saveLocalMedicationLogs(logs);
    } else {
      logs = JSON.parse(raw);
      if (!Array.isArray(logs) || logs.length === 0) {
        logs = getDefaultMedicationLogs();
        saveLocalMedicationLogs(logs);
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
      (a, b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime()
    );
  } catch (err) {
    console.warn('[MedicationSync] Error reading local medication logs:', err);
    return getDefaultMedicationLogs();
  }
}

/**
 * Save medication dose logs to localStorage and dispatch update events
 */
export function saveLocalMedicationLogs(logs: MedicationDoseLog[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_MEDICATION_LOGS_KEY, JSON.stringify(logs));
    window.dispatchEvent(
      new CustomEvent('aura_medication_logs_changed', { detail: logs })
    );
    window.dispatchEvent(new Event('storage'));
  } catch (err) {
    console.warn('[MedicationSync] Error saving logs to local storage:', err);
  }
}

/**
 * Fetch medication logs from SQLite backend and merge with local storage
 */
export async function fetchMedicationLogsFromSqlite(
  memberId?: string
): Promise<MedicationDoseLog[]> {
  try {
    const baseUrl = getApiUrl('/api/health/medication-logs');
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
        const mappedLogs: MedicationDoseLog[] = data.logs.map((row: any) => ({
          id: row.id,
          userEmail: row.userEmail,
          memberId: row.memberId,
          memberName: row.memberName,
          medicationId: row.medicationId,
          drugName: row.drugName,
          category: row.category as MedicationCategory,
          dosage: row.dosage,
          timeSlot: row.timeSlot,
          scheduledTime: row.scheduledTime,
          loggedAt: row.loggedAt,
          status: row.status as MedicationDoseStatus,
          loggedBy: row.loggedBy,
          notes: row.notes,
          pillsRemaining: row.pillsRemaining,
          driveFileId: row.driveFileId,
          driveWebViewLink: row.driveWebViewLink,
          driveSyncStatus: row.driveSyncStatus,
          createdAt: row.createdAt,
        }));

        const currentLocal = getLocalMedicationLogs();
        const mergedMap = new Map<string, MedicationDoseLog>();
        currentLocal.forEach((l) => mergedMap.set(l.id, l));
        mappedLogs.forEach((l) => mergedMap.set(l.id, l));
        const mergedList = Array.from(mergedMap.values()).sort(
          (a, b) =>
            new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime()
        );
        saveLocalMedicationLogs(mergedList);

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
      '[MedicationSync] Could not reach SQLite backend for medication logs:',
      err
    );
  }
  return getLocalMedicationLogs(memberId);
}

/**
 * Log a medication dose taken or skipped:
 * 1. Decrements pills remaining in member profile
 * 2. Updates member takenToday flags in SQLite and localStorage
 * 3. Saves dose event log to SQLite and localStorage
 * 4. Triggers background Google Drive sync
 */
export async function logMedicationDose(entryData: {
  memberId: string;
  memberName: string;
  medicationId: string;
  drugName: string;
  category?: MedicationCategory;
  dosage: string;
  timeSlot: 'morning' | 'afternoon' | 'evening' | 'bedtime';
  scheduledTime?: string;
  status?: MedicationDoseStatus;
  notes?: string;
  loggedBy?: string;
}): Promise<MedicationDoseLog> {
  const now = new Date().toISOString();
  const id = `medlog_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const status = entryData.status || 'taken';

  // Find member to update their pillsRemaining and takenToday state
  const healthRecords = getLocalHealthRecords();
  const memberIndex = healthRecords.findIndex(
    (m) =>
      m.memberId === entryData.memberId ||
      m.id === entryData.memberId ||
      m.memberName.toLowerCase() === entryData.memberName.toLowerCase()
  );

  let updatedPillsRemaining: number | undefined;

  if (memberIndex !== -1) {
    const member = healthRecords[memberIndex];
    const medIndex = member.medications.findIndex(
      (med) =>
        med.id === entryData.medicationId ||
        med.drugName.toLowerCase() === entryData.drugName.toLowerCase()
    );

    if (medIndex !== -1) {
      const med = member.medications[medIndex];
      // Decrement pills remaining if taken
      if (status === 'taken' && typeof med.pillsRemaining === 'number') {
        med.pillsRemaining = Math.max(0, med.pillsRemaining - 1);
        updatedPillsRemaining = med.pillsRemaining;
      }
      // Update takenToday for this timeSlot
      med.takenToday = {
        ...med.takenToday,
        [entryData.timeSlot]: status === 'taken',
      };
      member.medications[medIndex] = med;
      healthRecords[memberIndex] = member;
      saveLocalHealthRecords(healthRecords);
    }
  }

  const newLog: MedicationDoseLog = {
    id,
    memberId: entryData.memberId,
    memberName: entryData.memberName,
    medicationId: entryData.medicationId,
    drugName: entryData.drugName,
    category: entryData.category || 'prescription',
    dosage: entryData.dosage,
    timeSlot: entryData.timeSlot,
    scheduledTime: entryData.scheduledTime || '',
    loggedAt: now,
    status,
    loggedBy: entryData.loggedBy || 'Auro AI Voice',
    notes: entryData.notes || '',
    pillsRemaining: updatedPillsRemaining,
    driveSyncStatus: 'local_only',
    createdAt: now,
  };

  // 1. Save to LocalStorage immediately
  const existing = getLocalMedicationLogs();
  const updated = [newLog, ...existing.filter((item) => item.id !== newLog.id)];
  saveLocalMedicationLogs(updated);

  // 2. Persist to SQLite
  try {
    const res = await fetch(getApiUrl('/api/health/medication-logs'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: newLog.id,
        memberId: newLog.memberId,
        memberName: newLog.memberName,
        medicationId: newLog.medicationId,
        drugName: newLog.drugName,
        category: newLog.category,
        dosage: newLog.dosage,
        timeSlot: newLog.timeSlot,
        scheduledTime: newLog.scheduledTime,
        loggedAt: newLog.loggedAt,
        status: newLog.status,
        loggedBy: newLog.loggedBy,
        notes: newLog.notes,
        pillsRemaining: newLog.pillsRemaining,
        driveSyncStatus: 'local_only',
        createdAt: newLog.createdAt,
      }),
    });
    if (!res.ok) {
      console.warn('[MedicationSync] SQLite save status:', res.status);
    }
  } catch (err) {
    console.warn('[MedicationSync] SQLite network error during save:', err);
  }

  // 3. Initiate Google Drive sync in background if authenticated
  const token = getGoogleAccessToken();
  if (token) {
    syncMedicationsWithGoogleDrive(token).catch((err) => {
      console.warn('[MedicationSync] Background Google Drive sync deferred:', err);
    });
  }

  return newLog;
}

/**
 * Delete a medication dose log from local storage and SQLite
 */
export async function deleteMedicationLog(id: string): Promise<boolean> {
  const current = getLocalMedicationLogs();
  const filtered = current.filter((l) => l.id !== id);
  saveLocalMedicationLogs(filtered);

  try {
    await fetch(getApiUrl(`/api/health/medication-logs/${id}`), {
      method: 'DELETE',
    });
  } catch (err) {
    console.warn('[MedicationSync] Failed to delete medication log from SQLite:', err);
  }
  return true;
}

/**
 * Sync medication logs and active schedules with Google Drive:
 * Creates/finds "Family Circle / Health And Wellness / Family Heath Record / Medication Schedules & Logs"
 * Uploads a standardized medication adherence report and schedule JSON
 */
export async function syncMedicationsWithGoogleDrive(
  token?: string
): Promise<{ success: boolean; syncedCount: number }> {
  const activeToken = token || getGoogleAccessToken();
  if (!activeToken) {
    return { success: false, syncedCount: 0 };
  }

  try {
    const folderId = await getOrCreateGoogleDriveFolder(
      MEDICATION_FOLDER_PATH,
      activeToken
    );

    const logs = getLocalMedicationLogs();
    const healthRecords = getLocalHealthRecords();
    if (logs.length === 0 && healthRecords.length === 0) {
      return { success: true, syncedCount: 0 };
    }

    let totalSynced = 0;

    // Upload consolidated Medication Vault file for each family member
    for (const member of healthRecords) {
      const memberLogs = logs.filter(
        (l) =>
          l.memberId === member.memberId ||
          l.memberId === member.id ||
          l.memberName.toLowerCase() === member.memberName.toLowerCase()
      );

      const filename = `Medication_Schedule_Logs_${member.memberName.replace(/\s+/g, '_')}_Latest.json`;
      const reportPayload = {
        title: `Smart Medication & Supplement Vault - ${member.memberName}`,
        generatedAt: new Date().toISOString(),
        familyMember: member.memberName,
        activeMedicationsCount: member.medications?.length || 0,
        medicationSchedules: member.medications || [],
        totalDoseLogs: memberLogs.length,
        adherenceSummary: {
          takenCount: memberLogs.filter((l) => l.status === 'taken').length,
          skippedCount: memberLogs.filter((l) => l.status === 'skipped').length,
          adherencePercentage:
            memberLogs.length > 0
              ? Math.round(
                  (memberLogs.filter((l) => l.status === 'taken').length /
                    memberLogs.length) *
                    100
                )
              : 100,
        },
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
        description: `AURO Smart Medication & Supplement Schedules and Logs for ${member.memberName}`,
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
            await fetch(getApiUrl(`/api/health/medication-logs/${log.id}/drive-sync`), {
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

    saveLocalMedicationLogs(logs);
    return { success: true, syncedCount: totalSynced };
  } catch (err) {
    console.warn('[MedicationSync] Google Drive sync error:', err);
    return { success: false, syncedCount: 0 };
  }
}

/**
 * Calculate member today's medication dose status and schedule breakdown
 */
export function getTodayDoseStatusForMember(memberId: string) {
  const records = getLocalHealthRecords();
  const member =
    records.find(
      (r) =>
        r.memberId === memberId ||
        r.id === memberId ||
        r.memberName.toLowerCase() === memberId.toLowerCase()
    ) || records[0];

  if (!member || !member.medications) {
    return {
      member: null,
      totalDue: 0,
      takenCount: 0,
      pendingCount: 0,
      adherenceRate: 100,
      slots: {
        morning: [],
        afternoon: [],
        evening: [],
        bedtime: [],
      },
    };
  }

  const todayDate = new Date().toISOString().split('T')[0];
  const allLogs = getLocalMedicationLogs(member.memberId);
  const todayLogs = allLogs.filter((l) => l.loggedAt.startsWith(todayDate));

  const slots: Record<
    'morning' | 'afternoon' | 'evening' | 'bedtime',
    {
      med: MedicationEntry;
      status: MedicationDoseStatus;
      log?: MedicationDoseLog;
    }[]
  > = {
    morning: [],
    afternoon: [],
    evening: [],
    bedtime: [],
  };

  let totalDue = 0;
  let takenCount = 0;

  for (const med of member.medications) {
    for (const slot of med.timeSlots) {
      totalDue++;
      const matchingLog = todayLogs.find(
        (l) => l.medicationId === med.id && l.timeSlot === slot
      );
      const isTaken = matchingLog
        ? matchingLog.status === 'taken'
        : Boolean(med.takenToday?.[slot]);

      if (isTaken) takenCount++;

      slots[slot].push({
        med,
        status: isTaken ? 'taken' : matchingLog ? matchingLog.status : 'pending',
        log: matchingLog,
      });
    }
  }

  const adherenceRate =
    totalDue > 0 ? Math.round((takenCount / totalDue) * 100) : 100;

  return {
    member,
    totalDue,
    takenCount,
    pendingCount: Math.max(0, totalDue - takenCount),
    adherenceRate,
    slots,
  };
}

/**
 * Intelligent drug interaction & supplement timing tips
 */
export function getMedicationSynergyTips(medications: MedicationEntry[]): {
  synergyNotes: string[];
  timingTips: string[];
} {
  const synergyNotes: string[] = [];
  const timingTips: string[] = [];

  const names = medications.map((m) => m.drugName.toLowerCase());

  if (
    names.some((n) => n.includes('vitamin d')) &&
    names.some((n) => n.includes('magnesium'))
  ) {
    synergyNotes.push(
      'Optimal Synergy: Magnesium activates Vitamin D enzymes in the liver and kidneys, boosting cellular absorption by 30%.'
    );
  }

  if (
    names.some((n) => n.includes('vitamin d')) &&
    names.some((n) => n.includes('k2'))
  ) {
    synergyNotes.push(
      'Cardiovascular Shield: Vitamin K2 directs calcium absorbed via Vitamin D directly into bones instead of arterial walls.'
    );
  }

  if (names.some((n) => n.includes('omega') || n.includes('fish oil'))) {
    timingTips.push(
      'Bioavailability Tip: Take Omega-3 with meals containing healthy fats (avocado, olive oil, eggs) to maximize enteric absorption.'
    );
  }

  if (
    names.some((n) => n.includes('iron')) &&
    names.some((n) => n.includes('calcium') || n.includes('milk'))
  ) {
    timingTips.push(
      'Absorption Warning: Calcium competes with Iron for intestinal transporters. Space Iron intake at least 2 hours apart from dairy or calcium supplements.'
    );
  }

  if (names.some((n) => n.includes('magnesium'))) {
    timingTips.push(
      'Sleep Timing: Take Magnesium Glycinate / L-Threonate 30 to 45 minutes before sleep for GABAergic relaxation and deep sleep architecture.'
    );
  }

  if (synergyNotes.length === 0) {
    synergyNotes.push(
      'Nutrient Balance: Stay consistent with daily timing and drink adequate water (250ml) with every tablet or capsule.'
    );
  }

  if (timingTips.length === 0) {
    timingTips.push(
      'Routine Anchor: Taking morning supplements immediately after breakfast creates a seamless behavioral habit loop.'
    );
  }

  return { synergyNotes, timingTips };
}
