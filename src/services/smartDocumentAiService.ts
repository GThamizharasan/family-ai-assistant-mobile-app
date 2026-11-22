// Smart AI Family Document Intelligence Service
// Powers BOTH:
// 1. Receipt / Bill / Warranty Scanner -> Auto-Finance Transaction & Warranty Expiry Reminders
// 2. Prescription / Lab Report Analyzer -> Auto-Medication Schedule & Bilingual (EN/தமிழ்) Insights
// Persists across LocalStorage + SQLite (/api/smart-documents) + Google Drive (Family Circle)

import { getApiUrl } from './api';
import { getActiveAiModel, getActiveAiProvider } from './aiConfig';
import { getOrCreateGoogleDriveFolder } from './googleWorkspace';
import { syncAnyAiOutputToDrive } from './guidedLearningService';
import { createReminder } from './reminderDriveSync';
import { getEffectiveGoogleToken } from './visualTopicStorageService';

export type SmartFamilyDocType = 'receipt_warranty' | 'prescription_lab';

export interface ReceiptWarrantyExtracted {
  title: string;
  vendor: string;
  totalAmount: number;
  currency: string;
  purchaseDate: string;
  category: 'Investments' | 'Living & Housing' | 'Family & Kids' | 'Wellness' | 'Business Ops';
  warrantyMonths: number;
  warrantyExpiryDate?: string | null;
  billDueDate?: string | null;
  lineItems: Array<{ name: string; price: number }>;
  summary: string;
}

export interface PrescriptionMedicationItem {
  name: string;
  dosage: string;
  frequency: string;
  timings: string[];
  mealRule: string;
  durationDays: number;
}

export interface LabMarkerItem {
  testName: string;
  value: string;
  normalRange: string;
  status: 'normal' | 'high' | 'low';
  note?: string;
}

export interface PrescriptionLabExtracted {
  title: string;
  doctorOrLab: string;
  patientName: string;
  visitDate: string;
  diagnosisSummary: string;
  simpleEnglishSummary: string;
  simpleTamilSummary: string;
  medications: PrescriptionMedicationItem[];
  labMarkers: LabMarkerItem[];
}

export interface SavedSmartDocument {
  id: string;
  docType: SmartFamilyDocType;
  title: string;
  vendorOrDoctor?: string;
  amount?: number;
  currency?: string;
  expiryOrDueDate?: string;
  payload: ReceiptWarrantyExtracted | PrescriptionLabExtracted;
  driveWebViewLink?: string;
  syncedToSqlite?: boolean;
  syncedToDrive?: boolean;
  createdAt: string;
  updatedAt: string;
}

const LOCAL_DOCS_KEY = 'aura_smart_family_documents_v1';
const DRIVE_DOCS_VAULT_FOLDER = 'Smart Family Documents Vault';
const DRIVE_DOCS_VAULT_FILE = 'smart_family_documents_vault.json';
const DRIVE_VAULT_CACHE_TTL_MS = 30_000;

let driveDocsVaultCache: {
  tokenPrefix: string;
  fetchedAt: number;
  records: SavedSmartDocument[];
  fileId?: string;
} | null = null;

function mergeSmartDocLists(lists: SavedSmartDocument[][]): SavedSmartDocument[] {
  const byId = new Map<string, SavedSmartDocument>();
  for (const list of lists) {
    for (const item of list) {
      if (!item || !item.id) continue;
      const existing = byId.get(item.id);
      if (!existing) {
        byId.set(item.id, item);
      } else {
        const existingTs = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
        const itemTs = new Date(item.updatedAt || item.createdAt || 0).getTime();
        const newer = itemTs >= existingTs ? item : existing;
        const older = itemTs >= existingTs ? existing : item;
        byId.set(item.id, {
          ...older,
          ...newer,
          driveWebViewLink: newer.driveWebViewLink || older.driveWebViewLink,
          syncedToSqlite: Boolean(newer.syncedToSqlite || older.syncedToSqlite),
          syncedToDrive: Boolean(newer.syncedToDrive || older.syncedToDrive || newer.driveWebViewLink || older.driveWebViewLink),
        });
      }
    }
  }
  return Array.from(byId.values()).sort(
    (a, b) =>
      new Date(b.updatedAt || b.createdAt || 0).getTime() -
      new Date(a.updatedAt || a.createdAt || 0).getTime()
  );
}

async function fetchSmartDocsDriveVault(
  token: string,
  forceRefresh = false
): Promise<{ records: SavedSmartDocument[]; fileId?: string; webViewLink?: string }> {
  if (!token) return { records: [] };
  const tokenPrefix = token.slice(0, 18);
  if (
    !forceRefresh &&
    driveDocsVaultCache &&
    driveDocsVaultCache.tokenPrefix === tokenPrefix &&
    Date.now() - driveDocsVaultCache.fetchedAt < DRIVE_VAULT_CACHE_TTL_MS
  ) {
    return { records: driveDocsVaultCache.records, fileId: driveDocsVaultCache.fileId };
  }

  try {
    const familyFolder = await getOrCreateGoogleDriveFolder(token, 'Family Circle');
    const vaultFolder = await getOrCreateGoogleDriveFolder(token, DRIVE_DOCS_VAULT_FOLDER, familyFolder.id);
    const q = `'${vaultFolder.id}' in parents and name = '${DRIVE_DOCS_VAULT_FILE}' and trashed = false`;
    const searchRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&supportsAllDrives=true&fields=files(id,webViewLink)&pageSize=1`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!searchRes.ok) return { records: [] };
    const searchJson = await searchRes.json();
    const file = searchJson?.files?.[0];
    if (!file?.id) {
      driveDocsVaultCache = { tokenPrefix, fetchedAt: Date.now(), records: [] };
      return { records: [] };
    }

    const dlRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media&supportsAllDrives=true`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!dlRes.ok) return { records: [], fileId: file.id, webViewLink: file.webViewLink };
    const parsed = await dlRes.json();
    const rawItems = Array.isArray(parsed?.records) ? parsed.records : [];
    const records: SavedSmartDocument[] = rawItems
      .filter((r: any) => r && r.id && r.title && r.payload)
      .map((r: any) => ({
        ...r,
        syncedToDrive: true,
        driveWebViewLink: r.driveWebViewLink || file.webViewLink,
      }));

    driveDocsVaultCache = {
      tokenPrefix,
      fetchedAt: Date.now(),
      records,
      fileId: file.id,
    };
    return { records, fileId: file.id, webViewLink: file.webViewLink };
  } catch {
    return { records: [] };
  }
}

async function upsertSmartDocsDriveVault(
  recordsToPersist: SavedSmartDocument[],
  token: string,
  replaceExact = false
): Promise<{ fileId?: string; webViewLink?: string; records: SavedSmartDocument[] }> {
  if (!token) return { records: recordsToPersist };
  try {
    const familyFolder = await getOrCreateGoogleDriveFolder(token, 'Family Circle');
    const vaultFolder = await getOrCreateGoogleDriveFolder(token, DRIVE_DOCS_VAULT_FOLDER, familyFolder.id);
    const existing = await fetchSmartDocsDriveVault(token, true);
    const finalRecords = (
      replaceExact
        ? recordsToPersist.map((r) => ({ ...r, syncedToDrive: true }))
        : mergeSmartDocLists([
            recordsToPersist.map((r) => ({ ...r, syncedToDrive: true })),
            existing.records,
          ])
    ).slice(0, 100);

    const jsonPayload = JSON.stringify(
      {
        appName: 'Aura Family AI Assistant — Smart Document & Health Vault',
        updatedAt: new Date().toISOString(),
        records: finalRecords,
      },
      null,
      2
    );

    const boundary = `-------AuraSmartDocVault${Date.now().toString(36)}`;
    const metadata: any = {
      name: DRIVE_DOCS_VAULT_FILE,
      mimeType: 'application/json',
    };
    if (!existing.fileId) {
      metadata.parents = [vaultFolder.id];
    }

    const multipartBody =
      `--${boundary}\r\n` +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      `\r\n--${boundary}\r\n` +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      jsonPayload +
      `\r\n--${boundary}--`;

    const uploadUrl = existing.fileId
      ? `https://www.googleapis.com/upload/drive/v3/files/${existing.fileId}?uploadType=multipart&supportsAllDrives=true&fields=id,webViewLink`
      : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,webViewLink';

    const uploadRes = await fetch(uploadUrl, {
      method: existing.fileId ? 'PATCH' : 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartBody,
    });
    if (!uploadRes.ok) return { records: finalRecords };
    const upData = await uploadRes.json();
    const vaultLink = upData.webViewLink || `https://drive.google.com/file/d/${upData.id}/view`;
    driveDocsVaultCache = {
      tokenPrefix: token.slice(0, 18),
      fetchedAt: Date.now(),
      records: finalRecords,
      fileId: upData.id,
    };
    return {
      fileId: upData.id,
      webViewLink: vaultLink,
      records: finalRecords.map((r) => ({
        ...r,
        syncedToDrive: true,
        driveWebViewLink: r.driveWebViewLink || vaultLink,
      })),
    };
  } catch {
    return { records: recordsToPersist };
  }
}

function buildSmartDocumentMarkdown(doc: SavedSmartDocument): string {
  if (doc.docType === 'prescription_lab') {
    const p = doc.payload as PrescriptionLabExtracted;
    return [
      `# ${p.title}`,
      `**Doctor / Lab:** ${p.doctorOrLab} | **Patient:** ${p.patientName} | **Date:** ${p.visitDate}`,
      p.diagnosisSummary ? `**Clinical Summary:** ${p.diagnosisSummary}` : '',
      '',
      `## Plain-Language Summary (English)`,
      p.simpleEnglishSummary,
      '',
      `## தமிழ் விளக்கம்`,
      p.simpleTamilSummary,
      '',
      ...(p.medications && p.medications.length > 0
        ? [
            `## Medication Schedule`,
            ...p.medications.map(
              (m) =>
                `- **${m.name}** (${m.dosage}) — ${m.frequency} [${(m.timings || []).join(', ')}] · ${m.mealRule} · ${m.durationDays} days`
            ),
            '',
          ]
        : []),
      `## Lab Tests & Markers`,
      ...(p.labMarkers || []).map(
        (l) =>
          `- **${l.testName}:** ${l.value} (Normal: ${l.normalRange}) — **${l.status.toUpperCase()}**${
            l.note ? ` — ${l.note}` : ''
          }`
      ),
    ]
      .filter((line) => line !== undefined)
      .join('\n');
  }

  const r = doc.payload as ReceiptWarrantyExtracted;
  return [
    `# ${r.title}`,
    `**Vendor:** ${r.vendor} | **Amount:** ${r.currency}${r.totalAmount} | **Date:** ${r.purchaseDate}`,
    `**Category:** ${r.category}`,
    r.warrantyExpiryDate ? `**Warranty Expires:** ${r.warrantyExpiryDate} (${r.warrantyMonths} months)` : '',
    r.billDueDate ? `**Bill Due Date:** ${r.billDueDate}` : '',
    '',
    `## Summary`,
    r.summary,
    ...(r.lineItems && r.lineItems.length > 0
      ? ['', `## Line Items`, ...r.lineItems.map((li) => `- ${li.name}: ${r.currency}${li.price}`)]
      : []),
  ]
    .filter(Boolean)
    .join('\n');
}

function loadLocalDocs(): SavedSmartDocument[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_DOCS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLocalDocs(docs: SavedSmartDocument[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_DOCS_KEY, JSON.stringify(docs.slice(0, 60)));
  } catch {}
}

function addMonthsToDate(isoDate: string, months: number): string {
  const d = new Date(isoDate || Date.now());
  if (Number.isNaN(d.getTime())) return new Date().toISOString().split('T')[0];
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split('T')[0];
}

function buildOfflineFallbackExtraction(
  docType: SmartFamilyDocType,
  rawText: string
): ReceiptWarrantyExtracted | PrescriptionLabExtracted {
  const today = new Date().toISOString().split('T')[0];
  const clean = (rawText || '').trim();

  if (docType === 'prescription_lab') {
    const lines = clean
      .split(/\n|;/)
      .map((l) => l.trim())
      .filter(Boolean);

    const medLines = lines.filter((l) =>
      /(\d+\s*(mg|ml|mcg|tab|cap|drops|syrup)|calpol|paracetamol|dolo|ibuprofen|amoxicillin|azithromycin|cetirizine|crocin|antipyretic|tablet|capsule)/i.test(
        l
      ) && !/^antipyretic\s*\/\s*meds$/i.test(l)
    );

    const uniqueMedLines = Array.from(new Set(medLines)).slice(0, 6);
    const medications: PrescriptionMedicationItem[] = uniqueMedLines.map((line) => ({
      name: line.replace(/given/i, '').trim().slice(0, 48),
      dosage: line.match(/\d+(?:\.\d+)?\s*(mg|ml|mcg|tab|cap|drops)/i)?.[0] || '1 dose',
      frequency: /thrice|3\s*times|tds|1-1-1/i.test(line)
        ? 'Three times daily'
        : /twice|2\s*times|bd|1-0-1/i.test(line)
        ? 'Twice daily'
        : /q6h|every\s*6/i.test(line)
        ? 'Every 6 hours as needed'
        : 'As directed',
      timings: /thrice|3\s*times|tds|1-1-1/i.test(line)
        ? ['Morning 08:30', 'Afternoon 13:30', 'Night 20:30']
        : /twice|2\s*times|bd|1-0-1/i.test(line)
        ? ['Morning 08:30', 'Night 20:30']
        : ['Morning 08:30', 'Night 20:30'],
      mealRule: /before\s*food|empty/i.test(line) ? 'Before Food' : 'After Food',
      durationDays: Number(line.match(/(\d+)\s*day/i)?.[1]) || 3,
    }));

    const labMarkers: LabMarkerItem[] = [];
    // Extract temperature readings if present (e.g. 102.3°F)
    const tempMatches = clean.match(/\b(9[5-9]|10[0-6])(?:\.\d)?\s*°?\s*F\b/gi) || [];
    if (tempMatches.length > 0) {
      const nums = tempMatches
        .map((t) => parseFloat(t.replace(/[^\d.]/g, '')))
        .filter(Number.isFinite);
      const peak = Math.max(...nums);
      const latest = nums[nums.length - 1];
      labMarkers.push({
        testName: 'Peak Body Temperature',
        value: `${peak}°F`,
        normalRange: '97.0 - 99.0°F',
        status: peak >= 100.4 ? 'high' : 'normal',
        note: `${nums.length} readings logged in report.`,
      });
      if (latest !== peak) {
        labMarkers.push({
          testName: 'Latest Temperature',
          value: `${latest}°F`,
          normalRange: '97.0 - 99.0°F',
          status: latest >= 100.4 ? 'high' : 'normal',
        });
      }
    }

    // Extract common lab test markers (Hemoglobin, WBC, Platelets, Glucose, HbA1c, TSH, Cholesterol, CRP)
    const markerRegex =
      /\b(Hemoglobin|Hb|WBC|Platelets?|Glucose|Blood Sugar|Fasting Sugar|HbA1c|TSH|Cholesterol|Creatinine|CRP|Vitamin D|Vitamin B12)\b[^0-9\n]{0,18}(\d+(?:\.\d+)?(?:\s*[a-zA-Z/%µ]+)?)/gi;
    let mMatch: RegExpExecArray | null;
    while ((mMatch = markerRegex.exec(clean)) !== null && labMarkers.length < 8) {
      labMarkers.push({
        testName: mMatch[1],
        value: mMatch[2].trim(),
        normalRange: 'Check lab ref',
        status: 'normal',
      });
    }

    const titleLine =
      lines.find((l) => /report|prescription|lab|clinical|fever|blood/i.test(l)) ||
      'Family Clinical / Lab Report Summary';

    return {
      title: titleLine.slice(0, 60),
      doctorOrLab: 'Family Clinic / Diagnostics',
      patientName: clean.match(/patient(?:\s*name)?[:\s]+([A-Za-z ]{2,28})/i)?.[1]?.trim() || 'Family Member',
      visitDate: today,
      diagnosisSummary:
        labMarkers.length > 0
          ? `Extracted ${labMarkers.length} clinical marker(s) and ${medications.length} medication item(s) from report.`
          : 'Document analyzed — please confirm exact dosages with your doctor.',
      simpleEnglishSummary:
        medications.length > 0
          ? `Found ${medications.length} medication item(s) and ${labMarkers.length} health marker(s). You can schedule medication reminders below and confirm exact dosages with your doctor.`
          : `Extracted ${labMarkers.length} health/lab reading(s) from your report. No explicit prescription schedule was listed in the file — review markers below with your doctor.`,
      simpleTamilSummary:
        medications.length > 0
          ? `உங்கள் அறிக்கையில் ${medications.length} மருந்து விவரங்களும் ${labMarkers.length} பரிசோதனை அளவுகளும் கண்டறியப்பட்டுள்ளன. மருத்துவரிடம் உறுதிப்படுத்தி நினைவூட்டல்களை அமைக்கலாம்.`
          : `உங்கள் பரிசோதனை அறிக்கையில் ${labMarkers.length} மருத்துவ அளவுகள் கண்டறியப்பட்டுள்ளன. மருந்து அளவுகள் தனியாகக் குறிப்பிடப்படவில்லை — மருத்துவரிடம் ஆலோசிக்கவும்.`,
      medications,
      labMarkers,
    };
  }

  // Receipt / Bill / Warranty fallback
  const amountMatch = clean.match(/(?:₹|rs\.?|inr|\$)\s*([0-9,]+(?:\.[0-9]{1,2})?)/i) || clean.match(/\b([0-9]{2,6}(?:\.[0-9]{1,2})?)\b/);
  const parsedAmount = amountMatch ? Number(amountMatch[1].replace(/,/g, '')) : 499;
  const warrantyMatch = clean.match(/(\d+)\s*(?:year|yr)/i);
  const warrantyMonths = warrantyMatch ? Number(warrantyMatch[1]) * 12 : /warranty|appliance|tv|ac|phone|laptop/i.test(clean) ? 12 : 0;
  const firstLine = clean.split('\n').map((s) => s.trim()).find(Boolean) || 'Family Store Receipt';

  return {
    title: firstLine.slice(0, 48),
    vendor: firstLine.slice(0, 32),
    totalAmount: Number.isFinite(parsedAmount) && parsedAmount > 0 ? parsedAmount : 499,
    currency: clean.includes('$') ? '$' : '₹',
    purchaseDate: today,
    category: /hospital|pharmacy|med|clinic/i.test(clean)
      ? 'Wellness'
      : /school|book|toy|kids/i.test(clean)
      ? 'Family & Kids'
      : 'Living & Housing',
    warrantyMonths,
    warrantyExpiryDate: warrantyMonths > 0 ? addMonthsToDate(today, warrantyMonths) : null,
    billDueDate: /bill|electricity|broadband|water|due/i.test(clean) ? addMonthsToDate(today, 1) : null,
    lineItems: [{ name: firstLine.slice(0, 40), price: Number.isFinite(parsedAmount) ? parsedAmount : 499 }],
    summary:
      warrantyMonths > 0
        ? `Logged ₹${parsedAmount} purchase with ${warrantyMonths}-month warranty tracking.`
        : `Logged ₹${parsedAmount} family bill/receipt ready for Finance Hub & Google Drive.`,
  };
}

export async function analyzeFamilyDocumentWithAi(params: {
  docType: SmartFamilyDocType;
  imageBase64?: string;
  pdfBase64?: string;
  mimeType?: string;
  rawText?: string;
}): Promise<{
  extracted: ReceiptWarrantyExtracted | PrescriptionLabExtracted;
  modelUsed: string;
  usedAi: boolean;
  fallbackReason?: string;
}> {
  const provider = getActiveAiProvider();
  const model = getActiveAiModel(provider);
  const geminiApiKey =
    typeof window !== 'undefined' ? localStorage.getItem('aura_custom_gemini_api_key') || undefined : undefined;
  const nvidiaApiKey =
    typeof window !== 'undefined' ? localStorage.getItem('aura_nvidia_api_key') || undefined : undefined;
  const openaiApiKey =
    typeof window !== 'undefined' ? localStorage.getItem('aura_openai_api_key') || undefined : undefined;
  const anthropicApiKey =
    typeof window !== 'undefined' ? localStorage.getItem('aura_anthropic_api_key') || undefined : undefined;

  let customConfig: any = undefined;
  if (provider === 'custom' && typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem('aura_custom_ai_config');
      if (raw) customConfig = JSON.parse(raw);
    } catch {}
  }

  let fallbackReason: string | undefined;

  try {
    const res = await fetch(getApiUrl('/api/ai/analyze-family-document'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        docType: params.docType,
        imageBase64: params.imageBase64,
        pdfBase64: params.pdfBase64,
        mimeType: params.mimeType || 'image/jpeg',
        rawText: params.rawText || '',
        provider,
        model,
        customConfig,
        geminiApiKey,
        nvidiaApiKey,
        openaiApiKey,
        anthropicApiKey,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.extracted) {
        const rawExt = data.extracted;
        if (params.docType === 'prescription_lab') {
          const normalized: PrescriptionLabExtracted = {
            title: String(rawExt.title || 'Health Document Summary'),
            doctorOrLab: String(rawExt.doctorOrLab || 'Clinic / Lab'),
            patientName: String(rawExt.patientName || 'Family Member'),
            visitDate: String(rawExt.visitDate || new Date().toISOString().split('T')[0]),
            diagnosisSummary: String(rawExt.diagnosisSummary || ''),
            simpleEnglishSummary: String(
              rawExt.simpleEnglishSummary ||
                rawExt.diagnosisSummary ||
                'Report analyzed successfully.'
            ),
            simpleTamilSummary: String(
              rawExt.simpleTamilSummary ||
                'உங்கள் மருத்துவ அறிக்கை வெற்றிகரமாகப் பகுப்பாய்வு செய்யப்பட்டது.'
            ),
            medications: Array.isArray(rawExt.medications) ? rawExt.medications : [],
            labMarkers: Array.isArray(rawExt.labMarkers) ? rawExt.labMarkers : [],
          };
          return {
            extracted: normalized,
            modelUsed: data.modelUsed || model,
            usedAi: true,
          };
        }

        const normalizedReceipt: ReceiptWarrantyExtracted = {
          title: String(rawExt.title || 'Receipt / Invoice'),
          vendor: String(rawExt.vendor || 'Store'),
          totalAmount: Number(rawExt.totalAmount) || 0,
          currency: String(rawExt.currency || '₹'),
          purchaseDate: String(rawExt.purchaseDate || new Date().toISOString().split('T')[0]),
          category: rawExt.category || 'Living & Housing',
          warrantyMonths: Number(rawExt.warrantyMonths) || 0,
          warrantyExpiryDate: rawExt.warrantyExpiryDate || null,
          billDueDate: rawExt.billDueDate || null,
          lineItems: Array.isArray(rawExt.lineItems) ? rawExt.lineItems : [],
          summary: String(rawExt.summary || ''),
        };
        return {
          extracted: normalizedReceipt,
          modelUsed: data.modelUsed || model,
          usedAi: true,
        };
      } else if (data?.reason) {
        fallbackReason = String(data.reason);
      }
    } else {
      fallbackReason = `Backend returned HTTP ${res.status}`;
    }
  } catch (err: any) {
    fallbackReason = err?.message || 'Could not reach backend server';
  }

  return {
    extracted: buildOfflineFallbackExtraction(params.docType, params.rawText || ''),
    modelUsed: 'Offline Smart Extractor',
    usedAi: false,
    fallbackReason,
  };
}

export async function loadSmartDocuments(
  userEmail?: string,
  googleAccessToken?: string | null,
  forceRefreshDrive = false
): Promise<SavedSmartDocument[]> {
  const local = loadLocalDocs();
  let sqliteRecords: SavedSmartDocument[] = [];
  let driveRecords: SavedSmartDocument[] = [];

  // 1. Load from SQLite
  try {
    const qs = userEmail ? `?userEmail=${encodeURIComponent(userEmail)}` : '';
    const res = await fetch(getApiUrl(`/api/smart-documents${qs}`));
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.records)) {
        sqliteRecords = data.records.map((r: any) => ({
          ...r,
          syncedToSqlite: true,
          syncedToDrive: Boolean(r.driveWebViewLink),
        }));
      }
    }
  } catch {}

  // 2. Load from Google Drive Vault JSON (cross-device history!)
  const token = getEffectiveGoogleToken(googleAccessToken);
  if (token) {
    try {
      const driveVault = await fetchSmartDocsDriveVault(token, forceRefreshDrive);
      driveRecords = driveVault.records;
    } catch {}
  }

  const merged = mergeSmartDocLists([sqliteRecords, driveRecords, local]);
  saveLocalDocs(merged);

  // 3. Silently backfill Drive-only records into local SQLite so they work offline & in Universal Search
  if (driveRecords.length > 0) {
    const sqliteIds = new Set(sqliteRecords.map((r) => r.id));
    const email = (userEmail || 'chinna.tamil2000@gmail.com').toLowerCase().trim();
    for (const dRec of driveRecords) {
      if (!sqliteIds.has(dRec.id)) {
        fetch(getApiUrl('/api/smart-documents'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: dRec.id,
            userEmail: email,
            docType: dRec.docType,
            title: dRec.title,
            vendorOrDoctor: dRec.vendorOrDoctor,
            amount: dRec.amount,
            currency: dRec.currency,
            expiryOrDueDate: dRec.expiryOrDueDate,
            payload: dRec.payload,
            driveWebViewLink: dRec.driveWebViewLink,
          }),
        }).catch(() => {});
      }
    }
  }

  return merged;
}

export async function saveSmartDocumentEverywhere(
  doc: Omit<SavedSmartDocument, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
  opts?: { userEmail?: string; googleAccessToken?: string | null }
): Promise<SavedSmartDocument> {
  const now = new Date().toISOString();
  const id = doc.id || `sdoc-${doc.docType}-${Date.now().toString(36)}`;
  const email = (opts?.userEmail || 'chinna.tamil2000@gmail.com').toLowerCase().trim();
  const token = getEffectiveGoogleToken(opts?.googleAccessToken);

  const full: SavedSmartDocument = {
    ...doc,
    id,
    createdAt: now,
    updatedAt: now,
    syncedToSqlite: false,
    syncedToDrive: false,
  };

  // 1. Export individual human-readable Markdown report to Google Drive if signed in
  if (token) {
    try {
      const folderName =
        doc.docType === 'prescription_lab' ? 'Health & Prescriptions' : 'Receipts & Warranties';
      const asciiTitle = `${doc.docType === 'prescription_lab' ? 'Health_Doc' : 'Receipt_Warranty'}_${doc.title
        .replace(/[^a-zA-Z0-9\s_-]/g, ' ')
        .trim()
        .replace(/\s+/g, '_')
        .slice(0, 36)}`;
      const md = buildSmartDocumentMarkdown(full);

      const uploaded = await syncAnyAiOutputToDrive(asciiTitle, md, token, {
        folderName,
        category: doc.docType,
        userEmail: email,
      });
      if (uploaded) {
        full.driveWebViewLink = uploaded.driveWebViewLink;
        full.syncedToDrive = true;
      }
    } catch {}
  }

  // 2. Save to SQLite
  try {
    const res = await fetch(getApiUrl('/api/smart-documents'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: full.id,
        userEmail: email,
        docType: full.docType,
        title: full.title,
        vendorOrDoctor: full.vendorOrDoctor,
        amount: full.amount,
        currency: full.currency,
        expiryOrDueDate: full.expiryOrDueDate,
        payload: full.payload,
        driveWebViewLink: full.driveWebViewLink,
      }),
    });
    if (res.ok) full.syncedToSqlite = true;
  } catch {}

  const updated = mergeSmartDocLists([[full], loadLocalDocs()]);
  saveLocalDocs(updated);

  // 3. Upsert the structured Google Drive Vault JSON so ALL history syncs across Web & Mobile!
  if (token) {
    try {
      const vaultRes = await upsertSmartDocsDriveVault(updated, token, false);
      if (vaultRes.webViewLink) {
        full.syncedToDrive = true;
        if (!full.driveWebViewLink) full.driveWebViewLink = vaultRes.webViewLink;
        saveLocalDocs(mergeSmartDocLists([[full], vaultRes.records]));
      }
    } catch {}
  }

  return full;
}

export async function syncAllSmartDocumentsWithDrive(
  userEmail?: string,
  googleAccessToken?: string | null
): Promise<{
  records: SavedSmartDocument[];
  syncedCount: number;
  pulledFromDriveCount: number;
  driveVaultUrl?: string;
  needsSignIn?: boolean;
}> {
  const token = getEffectiveGoogleToken(googleAccessToken);
  if (!token) {
    const localAndSqlite = await loadSmartDocuments(userEmail, null, false);
    return {
      records: localAndSqlite,
      syncedCount: 0,
      pulledFromDriveCount: 0,
      needsSignIn: true,
    };
  }

  const email = (userEmail || 'chinna.tamil2000@gmail.com').toLowerCase().trim();
  const beforeLocal = await loadSmartDocuments(email, null, false);
  const beforeIds = new Set(beforeLocal.map((d) => d.id));

  const remoteVault = await fetchSmartDocsDriveVault(token, true);
  const pulledFromDriveCount = remoteVault.records.filter((r) => !beforeIds.has(r.id)).length;

  let merged = mergeSmartDocLists([beforeLocal, remoteVault.records]);

  // Upload readable Markdown for any report that does not yet have a Drive link
  let uploadedCount = 0;
  for (let i = 0; i < merged.length; i++) {
    const doc = merged[i];
    if (!doc.driveWebViewLink || !doc.syncedToDrive) {
      try {
        const folderName =
          doc.docType === 'prescription_lab' ? 'Health & Prescriptions' : 'Receipts & Warranties';
        const asciiTitle = `${doc.docType === 'prescription_lab' ? 'Health_Doc' : 'Receipt_Warranty'}_${doc.title
          .replace(/[^a-zA-Z0-9\s_-]/g, ' ')
          .trim()
          .replace(/\s+/g, '_')
          .slice(0, 36)}`;
        const md = buildSmartDocumentMarkdown(doc);
        const uploaded = await syncAnyAiOutputToDrive(asciiTitle, md, token, {
          folderName,
          category: doc.docType,
          userEmail: email,
        });
        if (uploaded) {
          merged[i] = {
            ...doc,
            driveWebViewLink: uploaded.driveWebViewLink,
            syncedToDrive: true,
          };
          uploadedCount++;
        }
      } catch {}
    }
  }

  // Persist master JSON vault to Google Drive
  const vaultRes = await upsertSmartDocsDriveVault(merged, token, false);
  merged = vaultRes.records;
  saveLocalDocs(merged);

  // Sync all merged records back into SQLite
  for (const doc of merged) {
    try {
      await fetch(getApiUrl('/api/smart-documents'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: doc.id,
          userEmail: email,
          docType: doc.docType,
          title: doc.title,
          vendorOrDoctor: doc.vendorOrDoctor,
          amount: doc.amount,
          currency: doc.currency,
          expiryOrDueDate: doc.expiryOrDueDate,
          payload: doc.payload,
          driveWebViewLink: doc.driveWebViewLink,
        }),
      });
      doc.syncedToSqlite = true;
    } catch {}
  }

  saveLocalDocs(merged);
  return {
    records: merged,
    syncedCount: Math.max(uploadedCount, merged.length),
    pulledFromDriveCount,
    driveVaultUrl: vaultRes.webViewLink,
  };
}

export async function deleteSmartDocumentEverywhere(
  id: string,
  googleAccessToken?: string | null
): Promise<void> {
  const remaining = loadLocalDocs().filter((d) => d.id !== id);
  saveLocalDocs(remaining);
  try {
    await fetch(getApiUrl(`/api/smart-documents/${encodeURIComponent(id)}`), { method: 'DELETE' });
  } catch {}
  const token = getEffectiveGoogleToken(googleAccessToken);
  if (token) {
    try {
      await upsertSmartDocsDriveVault(remaining, token, true);
    } catch {}
  }
}

export async function scheduleMedicationRemindersFromDoc(
  doc: PrescriptionLabExtracted,
  googleAccessToken?: string | null,
  userEmail?: string
): Promise<number> {
  let created = 0;
  for (const med of doc.medications || []) {
    const timings = med.timings && med.timings.length > 0 ? med.timings : ['Morning 08:30'];
    for (const slot of timings) {
      const timeMatch = slot.match(/(\d{1,2}:\d{2})/);
      const dueTime = timeMatch
        ? timeMatch[1].padStart(5, '0')
        : /night|evening/i.test(slot)
        ? '20:30'
        : /afternoon|noon/i.test(slot)
        ? '13:30'
        : '08:30';
      try {
        await createReminder(
          {
            title: `💊 ${med.name} (${med.dosage}) — ${med.mealRule}`,
            dueTime,
            category: 'medical',
            priority: 'high',
            familyMember: doc.patientName || 'All Family Circle',
            notes: `${med.frequency} for ${med.durationDays} days · Prescribed by ${doc.doctorOrLab}`,
          },
          googleAccessToken,
          userEmail
        );
        created++;
      } catch {}
    }
  }

  // If this is a Lab Request Form / Lab Report with no medications, create a helpful Lab Follow-Up Reminder!
  if (created === 0 && (doc.labMarkers || []).length > 0) {
    try {
      const testNames = (doc.labMarkers || [])
        .map((m) => m.testName)
        .filter(Boolean)
        .slice(0, 6)
        .join(', ');
      await createReminder(
        {
          title: `🧪 Lab Follow-Up: ${doc.title} (${doc.patientName || 'Family'})`,
          dueDate: doc.visitDate || undefined,
          dueTime: '09:00',
          category: 'medical',
          priority: 'high',
          familyMember: doc.patientName || 'All Family Circle',
          notes: `Tests: ${testNames} · ${doc.diagnosisSummary || doc.doctorOrLab}`,
        },
        googleAccessToken,
        userEmail
      );
      created = 1;
    } catch {}
  }
  return created;
}

export async function createWarrantyOrBillReminder(
  doc: ReceiptWarrantyExtracted,
  googleAccessToken?: string | null,
  userEmail?: string
): Promise<boolean> {
  const targetDate = doc.billDueDate || doc.warrantyExpiryDate;
  if (!targetDate) return false;
  try {
    await createReminder(
      {
        title: doc.billDueDate
          ? `🧾 Pay Bill: ${doc.vendor} (${doc.currency}${doc.totalAmount})`
          : `🛡️ Warranty Expiring: ${doc.title}`,
        dueDate: targetDate,
        dueTime: '09:00',
        category: 'family',
        priority: 'high',
        notes: doc.summary,
      },
      googleAccessToken,
      userEmail
    );
    return true;
  } catch {
    return false;
  }
}
