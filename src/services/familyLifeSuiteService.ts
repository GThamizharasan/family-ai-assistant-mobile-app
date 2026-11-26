// Unified 3-Tier Persistence & AI Service for All 5 Family Life Suite Bundles
// Syncs across LocalStorage + SQLite (/api/family-life/records) + Google Drive (Family Circle / Family Life Suite)

import {
  FamilyLifeDomain,
  FamilyLifeRecord,
  GroceryItemPayload,
  IdentityDocPayload,
} from '../types/familyLifeSuite';
import { getActiveAiModel, getActiveAiProvider } from './aiConfig';
import { getApiUrl } from './api';
import { getOrCreateGoogleDriveFolder } from './googleWorkspace';
import { createReminder } from './reminderDriveSync';
import { loadSmartDocuments, PrescriptionLabExtracted, ReceiptWarrantyExtracted } from './smartDocumentAiService';
import { getEffectiveGoogleToken } from './visualTopicStorageService';

const LOCAL_SUITE_KEY = 'aura_family_life_suite_v1';
const DRIVE_SUITE_FOLDER = 'Family Life Suite';
const DRIVE_SUITE_FILE = 'family_life_suite_vault.json';

function loadLocalSuite(): FamilyLifeRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_SUITE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLocalSuite(records: FamilyLifeRecord[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_SUITE_KEY, JSON.stringify(records.slice(0, 350)));
  } catch {}
}

function mergeRecords(lists: FamilyLifeRecord[][]): FamilyLifeRecord[] {
  const byId = new Map<string, FamilyLifeRecord>();
  for (const list of lists) {
    for (const r of list) {
      if (!r || !r.id) continue;
      const prev = byId.get(r.id);
      if (!prev) {
        byId.set(r.id, r);
      } else {
        const prevTs = new Date(prev.updatedAt || prev.createdAt || 0).getTime();
        const curTs = new Date(r.updatedAt || r.createdAt || 0).getTime();
        const newer = curTs >= prevTs ? r : prev;
        const older = curTs >= prevTs ? prev : r;
        byId.set(r.id, {
          ...older,
          ...newer,
          driveWebViewLink: newer.driveWebViewLink || older.driveWebViewLink,
          syncedToSqlite: Boolean(newer.syncedToSqlite || older.syncedToSqlite),
          syncedToDrive: Boolean(newer.syncedToDrive || older.syncedToDrive),
        });
      }
    }
  }
  return Array.from(byId.values()).sort(
    (a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime()
  );
}

async function fetchSuiteDriveVault(token: string): Promise<{ records: FamilyLifeRecord[]; fileId?: string; webViewLink?: string }> {
  if (!token) return { records: [] };
  try {
    const familyFolder = await getOrCreateGoogleDriveFolder(token, 'Family Circle');
    const suiteFolder = await getOrCreateGoogleDriveFolder(token, DRIVE_SUITE_FOLDER, familyFolder.id);
    const q = `'${suiteFolder.id}' in parents and name = '${DRIVE_SUITE_FILE}' and trashed = false`;
    const sRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&supportsAllDrives=true&fields=files(id,webViewLink)&pageSize=1`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!sRes.ok) return { records: [] };
    const sJson = await sRes.json();
    const file = sJson?.files?.[0];
    if (!file?.id) return { records: [] };
    const dl = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media&supportsAllDrives=true`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!dl.ok) return { records: [], fileId: file.id, webViewLink: file.webViewLink };
    const parsed = await dl.json();
    const list: FamilyLifeRecord[] = (Array.isArray(parsed?.records) ? parsed.records : []).map((r: any) => ({
      ...r,
      syncedToDrive: true,
      driveWebViewLink: r.driveWebViewLink || file.webViewLink,
    }));
    return { records: list, fileId: file.id, webViewLink: file.webViewLink };
  } catch {
    return { records: [] };
  }
}

async function upsertSuiteDriveVault(records: FamilyLifeRecord[], token: string, replaceExact = false): Promise<string | undefined> {
  if (!token) return undefined;
  try {
    const familyFolder = await getOrCreateGoogleDriveFolder(token, 'Family Circle');
    const suiteFolder = await getOrCreateGoogleDriveFolder(token, DRIVE_SUITE_FOLDER, familyFolder.id);
    const existing = await fetchSuiteDriveVault(token);
    const merged = (replaceExact ? records : mergeRecords([records, existing.records])).slice(0, 350);

    const boundary = `-------AuraFamilyLifeSuite${Date.now().toString(36)}`;
    const metadata: any = { name: DRIVE_SUITE_FILE, mimeType: 'application/json' };
    if (!existing.fileId) metadata.parents = [suiteFolder.id];

    const body =
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
      JSON.stringify(metadata) +
      `\r\n--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
      JSON.stringify({ updatedAt: new Date().toISOString(), records: merged }, null, 2) +
      `\r\n--${boundary}--`;

    const url = existing.fileId
      ? `https://www.googleapis.com/upload/drive/v3/files/${existing.fileId}?uploadType=multipart&supportsAllDrives=true&fields=id,webViewLink`
      : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,webViewLink';

    const up = await fetch(url, {
      method: existing.fileId ? 'PATCH' : 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    });
    if (!up.ok) return undefined;
    const upJson = await up.json();
    return upJson.webViewLink || `https://drive.google.com/file/d/${upJson.id}/view`;
  } catch {
    return undefined;
  }
}

export async function loadFamilyLifeRecords(
  domain?: FamilyLifeDomain,
  opts?: { userEmail?: string; googleAccessToken?: string | null; includeDrive?: boolean }
): Promise<FamilyLifeRecord[]> {
  const local = loadLocalSuite();
  let sqliteList: FamilyLifeRecord[] = [];
  let driveList: FamilyLifeRecord[] = [];

  try {
    const qs = new URLSearchParams();
    if (opts?.userEmail) qs.set('userEmail', opts.userEmail);
    const res = await fetch(getApiUrl(`/api/family-life/records?${qs.toString()}`));
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.records)) {
        sqliteList = data.records.map((r: any) => ({ ...r, syncedToSqlite: true }));
      }
    }
  } catch {}

  const token = opts?.includeDrive !== false ? getEffectiveGoogleToken(opts?.googleAccessToken) : '';
  if (token) {
    const dv = await fetchSuiteDriveVault(token);
    driveList = dv.records;
  }

  const merged = mergeRecords([sqliteList, driveList, local]);
  saveLocalSuite(merged);
  return domain ? merged.filter((r) => r.domain === domain) : merged;
}

export async function saveFamilyLifeRecord<T = any>(
  input: {
    id?: string;
    domain: FamilyLifeDomain;
    title: string;
    subtitle?: string;
    memberName?: string;
    dueOrExpiryDate?: string | null;
    payload: T;
  },
  opts?: { userEmail?: string; googleAccessToken?: string | null }
): Promise<FamilyLifeRecord<T>> {
  const now = new Date().toISOString();
  const id = input.id || `flr-${input.domain}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
  const email = (opts?.userEmail || 'chinna.tamil2000@gmail.com').toLowerCase().trim();

  const rec: FamilyLifeRecord<T> = {
    id,
    userEmail: email,
    domain: input.domain,
    title: input.title,
    subtitle: input.subtitle,
    memberName: input.memberName,
    dueOrExpiryDate: input.dueOrExpiryDate ?? null,
    payload: input.payload,
    syncedToSqlite: false,
    syncedToDrive: false,
    createdAt: now,
    updatedAt: now,
  };

  try {
    const res = await fetch(getApiUrl('/api/family-life/records'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rec),
    });
    if (res.ok) rec.syncedToSqlite = true;
  } catch {}

  const merged = mergeRecords([[rec], loadLocalSuite()]);
  saveLocalSuite(merged);

  const token = getEffectiveGoogleToken(opts?.googleAccessToken);
  if (token) {
    upsertSuiteDriveVault(merged, token, false)
      .then((link) => {
        if (link) {
          rec.syncedToDrive = true;
          rec.driveWebViewLink = link;
        }
      })
      .catch(() => {});
  }

  return rec;
}

export async function deleteFamilyLifeRecord(
  id: string,
  googleAccessToken?: string | null
): Promise<void> {
  const remaining = loadLocalSuite().filter((r) => r.id !== id);
  saveLocalSuite(remaining);
  try {
    await fetch(getApiUrl(`/api/family-life/records/${encodeURIComponent(id)}`), { method: 'DELETE' });
  } catch {}
  const token = getEffectiveGoogleToken(googleAccessToken);
  if (token) {
    void upsertSuiteDriveVault(remaining, token, true);
  }
}

export async function syncAllFamilyLifeWithDrive(
  userEmail?: string,
  googleAccessToken?: string | null
): Promise<{ total: number; driveLink?: string; needsSignIn?: boolean }> {
  const token = getEffectiveGoogleToken(googleAccessToken);
  if (!token) return { total: loadLocalSuite().length, needsSignIn: true };
  const all = await loadFamilyLifeRecords(undefined, { userEmail, googleAccessToken: token, includeDrive: true });
  const link = await upsertSuiteDriveVault(all, token, false);
  return { total: all.length, driveLink: link };
}

export async function callFamilyLifeAi<T = any>(params: {
  mode:
    | 'extract_id_document'
    | 'generate_trip_plan'
    | 'fridge_to_recipe'
    | 'generate_meal_plan'
    | 'homework_coach'
    | 'extract_school_circular'
    | 'morning_briefing';
  imageBase64?: string;
  mimeType?: string;
  promptContext?: string;
}): Promise<{ result: T | null; modelUsed: string; usedAi: boolean }> {
  const provider = getActiveAiProvider();
  const model = getActiveAiModel(provider);
  const geminiApiKey = typeof window !== 'undefined' ? localStorage.getItem('aura_custom_gemini_api_key') || undefined : undefined;
  const nvidiaApiKey = typeof window !== 'undefined' ? localStorage.getItem('aura_nvidia_api_key') || undefined : undefined;

  try {
    const res = await fetch(getApiUrl('/api/family-life/ai-assist'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...params,
        provider,
        model,
        geminiApiKey,
        nvidiaApiKey,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.result) {
        return { result: data.result as T, modelUsed: data.modelUsed || model, usedAi: true };
      }
    }
  } catch {}
  return { result: null, modelUsed: 'Smart Offline Engine', usedAi: false };
}

// Downscale camera/file image to crisp 1280px JPEG for Vision AI
export function downscaleImageToDataUrl(file: File, maxDim = 1280): Promise<{ dataUrl: string; mime: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image'));
    reader.onload = () => {
      const rawUrl = typeof reader.result === 'string' ? reader.result : '';
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve({ dataUrl: rawUrl, mime: file.type || 'image/jpeg' });
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve({ dataUrl: canvas.toDataURL('image/jpeg', 0.84), mime: 'image/jpeg' });
      };
      img.onerror = () => resolve({ dataUrl: rawUrl, mime: file.type || 'image/jpeg' });
      img.src = rawUrl;
    };
    reader.readAsDataURL(file);
  });
}

// Schedule 90 / 30 / 7-Day Renewal Reminders for Passports, Visas, Licences & Insurance!
export async function scheduleIdentityRenewalReminders(
  doc: IdentityDocPayload,
  googleAccessToken?: string | null,
  userEmail?: string
): Promise<number> {
  if (!doc.expiryDate) return 0;
  const exp = new Date(doc.expiryDate);
  if (Number.isNaN(exp.getTime())) return 0;
  const now = Date.now();
  let created = 0;

  for (const daysBefore of [90, 30, 7]) {
    const target = new Date(exp.getTime() - daysBefore * 86_400_000);
    // Schedule future milestone (or today if already inside the window)
    const dueDate =
      target.getTime() > now ? target.toISOString().split('T')[0] : daysBefore === 7 ? new Date().toISOString().split('T')[0] : null;
    if (!dueDate) continue;
    try {
      await createReminder(
        {
          title: `🛂 Renew ${doc.docCategory} (${doc.holderName}) — ${daysBefore}d Alert`,
          dueDate,
          dueTime: '09:00',
          category: 'family',
          priority: daysBefore <= 30 ? 'high' : 'medium',
          familyMember: doc.holderName || 'All Family Circle',
          notes: `Doc #${doc.documentNumber || 'N/A'} expires on ${doc.expiryDate} (${doc.issuingAuthority || doc.country})`,
        },
        googleAccessToken,
        userEmail
      );
      created++;
    } catch {}
  }
  return created;
}

// Auto-mark bought items & append price history when a Grocery/Supermarket receipt is scanned!
export async function reconcileReceiptWithGroceryList(
  receipt: ReceiptWarrantyExtracted,
  opts?: { userEmail?: string; googleAccessToken?: string | null }
): Promise<number> {
  if (!receipt.lineItems || receipt.lineItems.length === 0) return 0;
  const groceries = await loadFamilyLifeRecords('grocery_item', { userEmail: opts?.userEmail, includeDrive: false });
  let matchedCount = 0;

  for (const g of groceries) {
    const gName = g.title.toLowerCase().trim();
    const matchedLine = receipt.lineItems.find((li) => {
      const lName = (li.name || '').toLowerCase();
      return lName.includes(gName) || gName.includes(lName);
    });
    if (matchedLine) {
      const payload = g.payload as GroceryItemPayload;
      const nextHistory = [
        ...(payload.priceHistory || []),
        {
          date: receipt.purchaseDate || new Date().toISOString().split('T')[0],
          price: Number(matchedLine.price) || 0,
          vendor: receipt.vendor,
        },
      ].slice(-12);

      await saveFamilyLifeRecord<GroceryItemPayload>(
        {
          id: g.id,
          domain: 'grocery_item',
          title: g.title,
          subtitle: `${payload.quantity} · Last: ${receipt.currency || '₹'}${matchedLine.price}`,
          payload: {
            ...payload,
            checked: true,
            lastBoughtDate: receipt.purchaseDate || new Date().toISOString().split('T')[0],
            latestPrice: Number(matchedLine.price) || payload.latestPrice,
            currency: receipt.currency || '₹',
            priceHistory: nextHistory,
          },
        },
        opts
      );
      matchedCount++;
    }
  }
  return matchedCount;
}

// Extract Longitudinal Lab Biomarker Points from all saved Smart Health Reports + manual lab points
export interface LongitudinalBiomarkerSeries {
  markerName: string;
  unit: string;
  points: Array<{
    date: string;
    value: number;
    rawLabel: string;
    memberName: string;
    status: 'normal' | 'high' | 'low';
  }>;
}

export async function buildLongitudinalLabTrends(
  userEmail?: string,
  googleAccessToken?: string | null,
  memberFilter?: string
): Promise<LongitudinalBiomarkerSeries[]> {
  const [smartDocs, manualPoints] = await Promise.all([
    loadSmartDocuments(userEmail, googleAccessToken, false),
    loadFamilyLifeRecords('lab_manual_point', { userEmail, includeDrive: false }),
  ]);

  const map = new Map<string, LongitudinalBiomarkerSeries>();

  const addPoint = (
    markerName: string,
    numericVal: number,
    unit: string,
    date: string,
    memberName: string,
    status: 'normal' | 'high' | 'low',
    rawLabel: string
  ) => {
    if (!Number.isFinite(numericVal)) return;
    if (memberFilter && memberFilter !== 'ALL' && !memberName.toLowerCase().includes(memberFilter.toLowerCase())) {
      return;
    }
    const key = markerName.trim().toLowerCase();
    const existing = map.get(key) || { markerName: markerName.trim(), unit, points: [] };
    existing.points.push({ date, value: numericVal, rawLabel, memberName, status });
    map.set(key, existing);
  };

  for (const doc of smartDocs) {
    if (doc.docType !== 'prescription_lab') continue;
    const payload = doc.payload as PrescriptionLabExtracted;
    const date = payload.visitDate || doc.createdAt.slice(0, 10);
    const patient = payload.patientName || 'Family Member';
    for (const lm of payload.labMarkers || []) {
      const numMatch = String(lm.value || '').match(/(-?\d+(?:\.\d+)?)/);
      if (!numMatch) continue;
      const val = parseFloat(numMatch[1]);
      const unit = String(lm.value || '').replace(numMatch[1], '').trim();
      addPoint(lm.testName, val, unit, date, patient, lm.status || 'normal', lm.value);
    }
  }

  for (const mp of manualPoints) {
    const p = mp.payload;
    addPoint(
      p.markerName,
      Number(p.valueNumeric),
      p.unit || '',
      p.recordedDate || mp.createdAt.slice(0, 10),
      p.memberName || mp.memberName || 'Family Member',
      'normal',
      `${p.valueNumeric} ${p.unit || ''}`.trim()
    );
  }

  return Array.from(map.values())
    .map((s) => ({
      ...s,
      points: s.points.sort((a, b) => a.date.localeCompare(b.date)),
    }))
    .filter((s) => s.points.length > 0);
}
