// Sovereign Family Circle Reminders & Google Drive Synchronization Engine
// Integrates Reminders directly with Clock & Alarm, Google Drive "Family Circle/Reminders",
// local SQLite database, and browser Notification + Audio Alarm synthesizer.

import { ClockReminder, ReminderCategory, ReminderPriority, AlarmSound } from '../types/clock';
import { getOrCreateGoogleDriveFolder } from './googleWorkspace';
import { getApiUrl } from './api';
import { audioAlarmEngine } from './audioAlarmSynthesizer';
import { speechEngine } from './speech';

const LOCAL_STORAGE_KEY = 'aura_clock_reminders_v1';
const DRIVE_FOLDER_NAME = 'Reminders';
const DRIVE_FILE_NAME = 'family_reminders.json';

export const REMINDER_CATEGORIES: { id: ReminderCategory; label: string; iconColor: string; bgBadge: string }[] = [
  { id: 'family', label: 'Family Circle', iconColor: 'text-amber-400', bgBadge: 'bg-amber-500/10 text-amber-300 border-amber-500/30' },
  { id: 'personal', label: 'Personal Memo', iconColor: 'text-sky-400', bgBadge: 'bg-sky-500/10 text-sky-300 border-sky-500/30' },
  { id: 'medical', label: 'Medical & Wellness', iconColor: 'text-rose-400', bgBadge: 'bg-rose-500/10 text-rose-300 border-rose-500/30' },
  { id: 'school', label: 'School & STEM', iconColor: 'text-emerald-400', bgBadge: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' },
  { id: 'work', label: 'Work & Projects', iconColor: 'text-purple-400', bgBadge: 'bg-purple-500/10 text-purple-300 border-purple-500/30' },
  { id: 'tradition', label: 'Tamil Tradition', iconColor: 'text-orange-400', bgBadge: 'bg-orange-500/10 text-orange-300 border-orange-500/30' },
  { id: 'celebration', label: 'Celebration & Birthday', iconColor: 'text-pink-400', bgBadge: 'bg-pink-500/10 text-pink-300 border-pink-500/30' },
];

export const DEFAULT_FAMILY_MEMBERS = [
  'All Family Circle',
  'Chinnathambi',
  'Selvi',
  'Maaran',
  'Kavinmozhi',
  'Grandparents',
];

/**
 * Retrieve active Google Drive access token from localStorage
 */
export function getGoogleAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return (
    localStorage.getItem('aura_google_access_token') ||
    localStorage.getItem('google_access_token') ||
    null
  );
}

/**
 * Retrieve cached local reminders from localStorage
 */
export function getLocalReminders(): ClockReminder[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return getDefaultReminders();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : getDefaultReminders();
  } catch (err) {
    console.warn('[Reminders] Failed to parse local reminders:', err);
    return getDefaultReminders();
  }
}

/**
 * Persist reminders to localStorage and dispatch instant reactive update event
 */
export function saveLocalReminders(reminders: ClockReminder[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(reminders));
    // Dispatch instant reactive event for all active UI components (ClockTab, App, VoiceAssistant)
    window.dispatchEvent(new CustomEvent('aura_reminders_changed', { detail: reminders }));
    window.dispatchEvent(new Event('storage'));
  } catch (err) {
    console.warn('[Reminders] Failed to save reminders to localStorage:', err);
  }
}

/**
 * Default seeded reminders if none exist
 */
function getDefaultReminders(): ClockReminder[] {
  const today = new Date().toISOString().split('T')[0];
  return [
    {
      id: 'rem_seed_1',
      title: 'Grandmother Herbal Medicine & Tea',
      notes: 'Evening herbal tea and wellness check-in',
      dueDate: today,
      dueTime: '17:30',
      category: 'medical',
      priority: 'high',
      familyMember: 'Grandparents',
      sound: 'gentle',
      enabled: true,
      completed: false,
      notified: false,
      voiceAlert: true,
      driveSyncStatus: 'local_only',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'rem_seed_2',
      title: 'Family Thirukkural & Evening Dinner',
      notes: 'Read couplet with children before dinner',
      dueDate: today,
      dueTime: '20:00',
      category: 'tradition',
      priority: 'normal',
      familyMember: 'All Family Circle',
      sound: 'dawn',
      enabled: true,
      completed: false,
      notified: false,
      voiceAlert: true,
      driveSyncStatus: 'local_only',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];
}

/**
 * Fetch and synchronize reminders across:
 * 1. Local Cache (localStorage)
 * 2. SQLite Backend (`/api/reminders`)
 * 3. Google Drive folder (`Family Circle / Reminders / family_reminders.json`)
 */
export async function syncRemindersWithGoogleDrive(
  googleAccessToken?: string | null,
  userEmail = 'chinna.tamil2000@gmail.com'
): Promise<{ reminders: ClockReminder[]; driveFileId?: string; status: 'synced' | 'local_only' | 'error' }> {
  const map = new Map<string, ClockReminder>();

  // 1. Seed from local storage
  getLocalReminders().forEach((r) => map.set(r.id, r));

  // 2. Fetch from local server SQLite
  try {
    const res = await fetch(getApiUrl(`/api/reminders?userEmail=${encodeURIComponent(userEmail)}`));
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.reminders)) {
        for (const item of data.reminders) {
          const existing = map.get(item.id);
          map.set(item.id, {
            ...existing,
            ...item,
            driveSyncStatus: item.driveFileId ? 'synced' : existing?.driveSyncStatus || 'local_only',
          });
        }
      }
    }
  } catch (err) {
    console.warn('[Reminders] SQLite fetch notice:', err);
  }

  let driveFileId: string | undefined;

  const token = (googleAccessToken && googleAccessToken.trim()) || getGoogleAccessToken();

  // 3. If Google Drive access token is available, sync with Drive folder
  if (token) {
    try {
      const familyCircleFolder = await getOrCreateGoogleDriveFolder(token, 'Family Circle');
      const remindersFolder = await getOrCreateGoogleDriveFolder(
        token,
        DRIVE_FOLDER_NAME,
        familyCircleFolder.id
      );

      // Check if family_reminders.json exists in this folder
      const q = `'${remindersFolder.id}' in parents and name = '${DRIVE_FILE_NAME}' and trashed = false`;
      const searchRes = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,webViewLink,modifiedTime)&pageSize=1`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (searchRes.ok) {
        const searchData = await searchRes.json();
        const existingDriveFile = searchData.files && searchData.files[0];

        if (existingDriveFile) {
          driveFileId = existingDriveFile.id;
          // Download existing reminders content from Drive
          try {
            const downloadRes = await fetch(
              `https://www.googleapis.com/drive/v3/files/${driveFileId}?alt=media`,
              { headers: { Authorization: `Bearer ${token}` } }
            );
            if (downloadRes.ok) {
              const driveJson = await downloadRes.json();
              if (Array.isArray(driveJson)) {
                for (const dr of driveJson) {
                  if (dr && dr.id) {
                    const localItem = map.get(dr.id);
                    if (!localItem || new Date(dr.updatedAt || 0) > new Date(localItem.updatedAt || 0)) {
                      map.set(dr.id, {
                        ...dr,
                        familyMember: dr.targetFamilyMember || dr.familyMember || 'All Family Circle',
                        targetFamilyMember: dr.targetFamilyMember || dr.familyMember || 'All Family Circle',
                        driveFileId: driveFileId,
                        driveWebViewLink: existingDriveFile.webViewLink,
                        driveSyncStatus: 'synced',
                      });
                    }
                  }
                }
              }
            }
          } catch (dErr) {
            console.warn('[Reminders] Drive download parse notice:', dErr);
          }
        }
      }

      // 4. Upload merged reminders back up to Google Drive
      const mergedList = Array.from(map.values()).map((r) => ({
        ...r,
        targetFamilyMember: r.familyMember || r.targetFamilyMember || 'All Family Circle',
        familyMember: r.familyMember || r.targetFamilyMember || 'All Family Circle',
        driveSyncStatus: 'synced' as const,
        driveFolderPath: `Family Circle/${DRIVE_FOLDER_NAME}`,
      }));

      const fileContent = JSON.stringify(mergedList, null, 2);
      const boundary = `-------ReminderDriveBoundary${Date.now().toString(36)}`;
      const metadata = {
        name: DRIVE_FILE_NAME,
        mimeType: 'application/json',
        ...(!driveFileId ? { parents: [remindersFolder.id] } : {}),
        description: `Family Circle Reminders Sovereign Store. Last synchronized: ${new Date().toISOString()}`,
      };

      const multipartBody =
        `--${boundary}\r\n` +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(metadata) +
        `\r\n--${boundary}\r\n` +
        'Content-Type: application/json\r\n\r\n' +
        fileContent +
        `\r\n--${boundary}--`;

      let uploadUrl = driveFileId
        ? `https://www.googleapis.com/upload/drive/v3/files/${driveFileId}?uploadType=multipart&fields=id,webViewLink`
        : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink';

      let uploadMethod = driveFileId ? 'PATCH' : 'POST';

      let uploadRes = await fetch(uploadUrl, {
        method: uploadMethod,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: multipartBody,
      });

      // If PATCH failed because file was deleted on Drive (404), fall back to POST
      if (!uploadRes.ok && uploadMethod === 'PATCH' && uploadRes.status === 404) {
        uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink';
        uploadMethod = 'POST';
        const postMeta = { ...metadata, parents: [remindersFolder.id] };
        const postBody =
          `--${boundary}\r\n` +
          'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
          JSON.stringify(postMeta) +
          `\r\n--${boundary}\r\n` +
          'Content-Type: application/json\r\n\r\n' +
          fileContent +
          `\r\n--${boundary}--`;

        uploadRes = await fetch(uploadUrl, {
          method: uploadMethod,
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': `multipart/related; boundary=${boundary}`,
          },
          body: postBody,
        });
      }

      if (uploadRes.ok) {
        const uploadData = await uploadRes.json();
        driveFileId = uploadData.id;
        const webViewLink = uploadData.webViewLink;

        // Update all items with drive File ID
        for (const r of mergedList) {
          r.driveFileId = driveFileId;
          r.driveWebViewLink = webViewLink;
          map.set(r.id, r);
        }
        console.log(`[Reminders] Successfully synced ${mergedList.length} reminders to Google Drive (File ID: ${driveFileId})`);
      } else {
        const errText = await uploadRes.text();
        console.warn(`[Reminders] Google Drive upload notice (${uploadRes.status}):`, errText);
      }
    } catch (gErr) {
      console.warn('[Reminders] Google Drive sync error:', gErr);
    }
  }

  const finalReminders = Array.from(map.values()).sort((a, b) => {
    const timeA = `${a.dueDate} ${a.dueTime}`;
    const timeB = `${b.dueDate} ${b.dueTime}`;
    return timeA.localeCompare(timeB);
  });

  // Save to local cache
  saveLocalReminders(finalReminders);

  // Sync to backend SQLite
  try {
    await fetch(getApiUrl('/api/reminders/bulk'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reminders: finalReminders }),
    });
  } catch {}

  return {
    reminders: finalReminders,
    driveFileId,
    status: driveFileId ? 'synced' : 'local_only',
  };
}

/**
 * Create a new reminder
 */
export async function createReminder(
  item: Partial<ClockReminder> & { title: string; dueTime: string },
  googleAccessToken?: string | null,
  userEmail = 'chinna.tamil2000@gmail.com'
): Promise<ClockReminder> {
  const id = item.id || `rem_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();
  const todayStr = now.split('T')[0];
  const token = (googleAccessToken && googleAccessToken.trim()) || getGoogleAccessToken();
  const member = item.familyMember || item.targetFamilyMember || 'All Family Circle';

  const reminder: ClockReminder = {
    id,
    userEmail,
    title: item.title.trim(),
    notes: item.notes || '',
    dueDate: item.dueDate || todayStr,
    dueTime: item.dueTime,
    category: item.category || 'family',
    priority: item.priority || 'normal',
    familyMember: member,
    targetFamilyMember: member,
    sound: item.sound || 'gentle',
    enabled: item.enabled !== undefined ? item.enabled : true,
    completed: false,
    notified: false,
    voiceAlert: item.voiceAlert !== undefined ? item.voiceAlert : true,
    driveSyncStatus: token ? 'pending' : 'local_only',
    createdAt: now,
    updatedAt: now,
  };

  // 1. Save locally and dispatch reactive event
  const current = getLocalReminders();
  const updated = [reminder, ...current.filter((r) => r.id !== id)];
  saveLocalReminders(updated);

  // 2. Save to SQLite
  try {
    const res = await fetch(getApiUrl('/api/reminders'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...reminder,
        targetFamilyMember: member,
      }),
    });
    if (res.ok) {
      console.log(`[Reminders] Saved reminder "${reminder.title}" to SQLite backend successfully`);
    }
  } catch (err) {
    console.warn('[Reminders] SQLite save notice:', err);
  }

  // 3. Trigger Drive sync in background if authenticated
  if (token) {
    syncRemindersWithGoogleDrive(token, userEmail).catch((e) =>
      console.warn('[Reminders] Background drive sync notice:', e)
    );
  }

  return reminder;
}

/**
 * Toggle enable/disable of a reminder
 */
export async function toggleReminder(
  id: string,
  googleAccessToken?: string | null,
  userEmail = 'chinna.tamil2000@gmail.com'
): Promise<ClockReminder | null> {
  const list = getLocalReminders();
  const target = list.find((r) => r.id === id);
  if (!target) return null;

  target.enabled = !target.enabled;
  target.updatedAt = new Date().toISOString();
  if (target.enabled) {
    // Reset notified status if re-enabling
    target.notified = false;
  }
  saveLocalReminders(list);

  try {
    await fetch(getApiUrl(`/api/reminders/${encodeURIComponent(id)}`), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: target.enabled, notified: target.notified, updatedAt: target.updatedAt }),
    });
  } catch {}

  if (googleAccessToken) {
    syncRemindersWithGoogleDrive(googleAccessToken, userEmail).catch(() => {});
  }

  return target;
}

/**
 * Mark a reminder as completed
 */
export async function completeReminder(
  id: string,
  googleAccessToken?: string | null,
  userEmail = 'chinna.tamil2000@gmail.com'
): Promise<ClockReminder | null> {
  const list = getLocalReminders();
  const target = list.find((r) => r.id === id);
  if (!target) return null;

  target.completed = true;
  target.updatedAt = new Date().toISOString();
  saveLocalReminders(list);

  try {
    await fetch(getApiUrl(`/api/reminders/${encodeURIComponent(id)}`), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: true, updatedAt: target.updatedAt }),
    });
  } catch {}

  if (googleAccessToken) {
    syncRemindersWithGoogleDrive(googleAccessToken, userEmail).catch(() => {});
  }

  return target;
}

/**
 * Snooze a reminder by adding minutes
 */
export async function snoozeReminder(
  id: string,
  snoozeMinutes = 10,
  googleAccessToken?: string | null,
  userEmail = 'chinna.tamil2000@gmail.com'
): Promise<ClockReminder | null> {
  const list = getLocalReminders();
  const target = list.find((r) => r.id === id);
  if (!target) return null;

  const now = new Date();
  now.setMinutes(now.getMinutes() + snoozeMinutes);
  const newDueTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const newDueDate = now.toISOString().split('T')[0];

  target.dueDate = newDueDate;
  target.dueTime = newDueTime;
  target.notified = false;
  target.completed = false;
  target.updatedAt = new Date().toISOString();
  saveLocalReminders(list);

  try {
    await fetch(getApiUrl(`/api/reminders/${encodeURIComponent(id)}`), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dueDate: target.dueDate,
        dueTime: target.dueTime,
        notified: false,
        completed: false,
        updatedAt: target.updatedAt,
      }),
    });
  } catch {}

  if (googleAccessToken) {
    syncRemindersWithGoogleDrive(googleAccessToken, userEmail).catch(() => {});
  }

  return target;
}

/**
 * Delete a reminder
 */
export async function deleteReminder(
  id: string,
  googleAccessToken?: string | null,
  userEmail = 'chinna.tamil2000@gmail.com'
): Promise<boolean> {
  const list = getLocalReminders();
  const filtered = list.filter((r) => r.id !== id);
  saveLocalReminders(filtered);

  try {
    await fetch(getApiUrl(`/api/reminders/${encodeURIComponent(id)}`), {
      method: 'DELETE',
    });
  } catch {}

  if (googleAccessToken) {
    syncRemindersWithGoogleDrive(googleAccessToken, userEmail).catch(() => {});
  }

  return true;
}

/**
 * Check if any enabled reminders are due right now.
 * Returns array of due reminders that have not been notified yet.
 */
export function checkDueReminders(): ClockReminder[] {
  const list = getLocalReminders();
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const currentHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const dueList: ClockReminder[] = [];

  for (const rem of list) {
    if (!rem.enabled || rem.completed || rem.notified) continue;

    // Check matching date and time
    const matchesDate = !rem.dueDate || rem.dueDate === todayStr;
    if (matchesDate && rem.dueTime === currentHHMM) {
      dueList.push(rem);
    }
  }

  return dueList;
}

/**
 * Mark a reminder as notified in local store and backend
 */
export function markReminderAsNotified(id: string) {
  const list = getLocalReminders();
  const target = list.find((r) => r.id === id);
  if (!target) return;
  target.notified = true;
  saveLocalReminders(list);

  try {
    fetch(getApiUrl(`/api/reminders/${encodeURIComponent(id)}`), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notified: true }),
    }).catch(() => {});
  } catch {}
}

/**
 * Trigger browser notification, audio alarm chime, and voice readout
 */
export function triggerReminderNotification(reminder: ClockReminder) {
  // 1. Play Synthesized Alarm Sound
  try {
    audioAlarmEngine.startAlarm(reminder.sound || 'gentle', 0.85);
  } catch (err) {
    console.warn('[Reminders] Sound trigger notice:', err);
  }

  // 2. Browser Web Notification API
  if (typeof window !== 'undefined' && 'Notification' in window) {
    try {
      if (Notification.permission === 'granted') {
        const notif = new Notification(`⏰ Reminder: ${reminder.title}`, {
          body: `${reminder.familyMember ? `For: ${reminder.familyMember}\n` : ''}${reminder.notes || 'Scheduled reminder alert.'}`,
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          tag: `rem_${reminder.id}`,
        });
        notif.onclick = () => {
          window.focus();
        };
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission();
      }
    } catch {}
  }

  // 3. Spoken Voice Announcement via Auro Speech Engine
  if (reminder.voiceAlert) {
    const textToSpeak = `Reminder for ${reminder.familyMember || 'Family Circle'}: ${reminder.title}. ${reminder.notes || ''}`;
    setTimeout(() => {
      try {
        speechEngine.speak(textToSpeak);
      } catch {}
    }, 400);
  }

  // 4. Mark as notified
  markReminderAsNotified(reminder.id);
}

