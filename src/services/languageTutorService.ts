// Professional Live Language Tutor Service (English & Tamil / தமிழ்)
// Handles:
// 1. Dynamic AI course & lesson construction (/api/language-tutor/construct-lesson) + rich offline fallback
// 2. Real-time human-like 1-on-1 conversation turns (/api/language-tutor/live-turn)
// 3. Pronunciation & capstone speaking evaluation (/api/language-tutor/evaluate-speaking)
// 4. 3-Tier Persistence: LocalStorage + SQLite (/api/language-tutor/records) + Google Drive (Family Circle / Language Tutor Studio)

import {
  ConstructedLanguageLesson,
  EssayClinicResult,
  FamilyTutorSuiteState,
  LanguageModuleSummary,
  LiveTutorMessage,
  ProficiencyLevel,
  PronunciationHeatmapResult,
  RegisterRewriteResult,
  SavedLanguageTutorRecord,
  SpeakingEvaluationResult,
  SrsVocabItem,
  StageCompletionCertificate,
  TutorFamilyLearnerProfile,
  TutorLanguage,
  TutorProgressState,
  WordHeatmapToken,
} from '../types/languageTutor';
import {
  buildFallbackLanguageLesson,
  ENGLISH_CURRICULUM_MODULES,
  TAMIL_CURRICULUM_MODULES,
} from '../data/languageTutorCurriculum';
import {
  buildStarterSrsDeck,
  DEFAULT_FAMILY_LEARNERS,
} from '../data/languageTutorAdvancedData';
import { getActiveAiModel, getActiveAiProvider } from './aiConfig';
import { getApiUrl } from './api';
import { getOrCreateGoogleDriveFolder } from './googleWorkspace';
import { syncAnyAiOutputToDrive } from './guidedLearningService';
import { getEffectiveGoogleToken } from './visualTopicStorageService';

const LOCAL_RECORDS_KEY = 'aura_language_tutor_records_v1';
const LOCAL_PROGRESS_KEY = 'aura_language_tutor_progress_v1';
const DRIVE_STUDIO_FOLDER = 'Language Tutor Studio';
const DRIVE_VAULT_FILE = 'language_tutor_vault.json';
const DRIVE_CACHE_TTL_MS = 45_000;

let driveVaultCache: {
  tokenPrefix: string;
  fetchedAt: number;
  records: SavedLanguageTutorRecord[];
  fileId?: string;
} | null = null;

// ============================================================================
// 1. AI CONFIG & USER HELPERS
// ============================================================================

function getEffectiveUserEmail(userEmail?: string): string {
  if (userEmail && userEmail.trim()) return userEmail.toLowerCase().trim();
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('userEmail');
    if (stored && stored.trim()) return stored.toLowerCase().trim();
  }
  return 'chinna.tamil2000@gmail.com';
}

function getTutorActiveAiParams() {
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

  return {
    provider,
    model,
    customConfig,
    geminiApiKey,
    nvidiaApiKey,
    openaiApiKey,
    anthropicApiKey,
  };
}

export function buildAsciiDriveTitle(
  recordType: SavedLanguageTutorRecord['recordType'],
  language: TutorLanguage,
  level: ProficiencyLevel,
  moduleId?: string,
  fallbackTitle?: string
): string {
  const langPrefix = language === 'tamil' ? 'Tamil' : 'English';
  const cleanAscii = (fallbackTitle || '')
    .replace(/[^a-zA-Z0-9\s_-]/g, ' ')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 42);
  const modPart = moduleId ? moduleId.replace(/[^a-zA-Z0-9_-]/g, '_') : '';
  const coreName = cleanAscii || modPart || (recordType === 'live_session' ? 'Live_Coaching' : 'Course_Module');
  return `${langPrefix}_${level}_${coreName}`;
}

export function formatLessonAsMarkdown(lesson: ConstructedLanguageLesson): string {
  const lines: string[] = [
    `# ${lesson.title}`,
    lesson.nativeTitle ? `### ${lesson.nativeTitle}` : '',
    `**Language:** ${lesson.language === 'tamil' ? 'Tamil (தமிழ்)' : 'English'} | **Stage:** ${lesson.stageNumber} (${lesson.level}) | **Model:** ${lesson.generatedByModel}`,
    '',
    '## Teacher Introduction',
    lesson.teacherOpeningScript,
    lesson.teacherOpeningTransliteration ? `*Transliteration:* ${lesson.teacherOpeningTransliteration}` : '',
    lesson.teacherOpeningMeaning ? `*Meaning:* ${lesson.teacherOpeningMeaning}` : '',
    '',
    '## Learning Objectives',
    ...lesson.learningObjectives.map((obj) => `- ${obj}`),
    '',
    '## Concept Pillars',
  ];

  lesson.conceptPillars.forEach((p, idx) => {
    lines.push(`### ${idx + 1}. ${p.title}`);
    if (p.nativeTitle) lines.push(`*${p.nativeTitle}*`);
    lines.push(p.explanation);
    if (p.nativeExplanation) lines.push(`> ${p.nativeExplanation}`);
    if (p.ruleFormula) lines.push(`**Pattern:** \`${p.ruleFormula}\``);
    p.examples.forEach((ex) => {
      lines.push(
        `- **${ex.phrase}**${ex.transliteration ? ` (${ex.transliteration})` : ''} — ${ex.meaning}${
          ex.usageNote ? ` _(${ex.usageNote})_` : ''
        }`
      );
    });
    if (p.commonMistake) {
      lines.push(
        `- Avoid: ${p.commonMistake.wrong} -> **Better:** ${p.commonMistake.right} (${p.commonMistake.why})`
      );
    }
    lines.push('');
  });

  lines.push('## Vocabulary Deck');
  lesson.vocabularyDeck.forEach((v) => {
    lines.push(
      `- **${v.term}** ${v.transliteration ? `(${v.transliteration})` : ''} \`${v.phonetic}\` [${v.register}] — **${v.meaning}**. Example: "${v.exampleSentence}" (*${v.exampleMeaning}*)`
    );
  });

  lines.push('', '## Live Role-Play Script');
  lesson.liveDialogueScript.forEach((d) => {
    lines.push(
      `- **${d.speakerName}:** ${d.line}${d.transliteration ? ` _(${d.transliteration})_` : ''} — *${d.meaning}*`
    );
  });

  lines.push('', '## Cultural Spotlight');
  lines.push(`**${lesson.culturalSpotlight.title}**`);
  lines.push(`> "${lesson.culturalSpotlight.quote}"`);
  lines.push(lesson.culturalSpotlight.meaning);
  lines.push(lesson.culturalSpotlight.insight);

  return lines.filter((l) => l !== undefined && l !== null).join('\n');
}

export function formatSessionAsMarkdown(params: {
  language: TutorLanguage;
  scenarioTitle: string;
  level: ProficiencyLevel;
  messages: LiveTutorMessage[];
}): string {
  const lines: string[] = [
    `# Live Human Tutor Session: ${params.scenarioTitle}`,
    `**Language:** ${params.language === 'tamil' ? 'Tamil (தமிழ்)' : 'English'} | **Level:** ${params.level} | **Recorded:** ${new Date().toLocaleString()}`,
    '',
    '## Conversation & Live Coaching Notes',
  ];

  params.messages.forEach((m) => {
    const who =
      m.role === 'tutor'
        ? params.language === 'tamil'
          ? 'Prof. Kalaivani (ஆசிரியர் கலைவாணி)'
          : 'Prof. Clara Vance'
        : 'Learner';
    lines.push(`### ${who}`);
    lines.push(m.text);
    if (m.transliteration) lines.push(`*Transliteration:* ${m.transliteration}`);
    if (m.englishMeaning) lines.push(`*Meaning:* ${m.englishMeaning}`);
    if (m.praiseNote) lines.push(`- **Strength:** ${m.praiseNote}`);
    if (m.grammarFeedback) lines.push(`- **Coach Note:** ${m.grammarFeedback}`);
    if (m.betterPhrasing) lines.push(`- **Natural Upgrade:** ${m.betterPhrasing}`);
    if (m.pronunciationTip) lines.push(`- **Pronunciation Tip:** ${m.pronunciationTip}`);
    lines.push('');
  });

  return lines.join('\n');
}

// ============================================================================
// 2. LOCAL + SQLITE + GOOGLE DRIVE PERSISTENCE ENGINE
// ============================================================================

function loadLocalRecords(): SavedLanguageTutorRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_RECORDS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLocalRecords(records: SavedLanguageTutorRecord[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_RECORDS_KEY, JSON.stringify(records.slice(0, 80)));
  } catch {}
}

function mergeRecordLists(lists: SavedLanguageTutorRecord[][]): SavedLanguageTutorRecord[] {
  const byId = new Map<string, SavedLanguageTutorRecord>();
  for (const list of lists) {
    for (const rec of list) {
      if (!rec || !rec.id || !rec.title) continue;
      const existing = byId.get(rec.id);
      if (!existing) {
        byId.set(rec.id, { ...rec });
        continue;
      }
      const existingTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
      const recTime = new Date(rec.updatedAt || rec.createdAt || 0).getTime();
      const newest = recTime >= existingTime ? rec : existing;
      byId.set(rec.id, {
        ...newest,
        syncedToSqlite: Boolean(existing.syncedToSqlite || rec.syncedToSqlite),
        syncedToDrive: Boolean(existing.syncedToDrive || rec.syncedToDrive),
        driveFileId: newest.driveFileId || existing.driveFileId || rec.driveFileId,
        driveWebViewLink: newest.driveWebViewLink || existing.driveWebViewLink || rec.driveWebViewLink,
      });
    }
  }
  return Array.from(byId.values()).sort(
    (a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime()
  );
}

async function fetchDriveVault(
  token: string,
  forceRefresh = false
): Promise<{ records: SavedLanguageTutorRecord[]; fileId?: string }> {
  if (!token) return { records: [] };
  const tokenPrefix = token.slice(0, 18);
  if (
    !forceRefresh &&
    driveVaultCache &&
    driveVaultCache.tokenPrefix === tokenPrefix &&
    Date.now() - driveVaultCache.fetchedAt < DRIVE_CACHE_TTL_MS
  ) {
    return { records: driveVaultCache.records, fileId: driveVaultCache.fileId };
  }

  try {
    const familyFolder = await getOrCreateGoogleDriveFolder(token, 'Family Circle');
    const studioFolder = await getOrCreateGoogleDriveFolder(token, DRIVE_STUDIO_FOLDER, familyFolder.id);
    const q = `'${studioFolder.id}' in parents and name = '${DRIVE_VAULT_FILE}' and trashed = false`;
    const searchRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&supportsAllDrives=true&fields=files(id,webViewLink)&pageSize=1`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!searchRes.ok) return { records: [] };
    const searchJson = await searchRes.json();
    const file = searchJson?.files?.[0];
    if (!file?.id) {
      driveVaultCache = { tokenPrefix, fetchedAt: Date.now(), records: [] };
      return { records: [] };
    }

    const dlRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media&supportsAllDrives=true`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!dlRes.ok) return { records: [], fileId: file.id };
    const parsed = await dlRes.json();
    const rawItems = Array.isArray(parsed?.records) ? parsed.records : [];
    const records: SavedLanguageTutorRecord[] = rawItems
      .filter((r: any) => r && r.id && r.title)
      .map((r: any) => ({
        ...r,
        source: 'google_drive' as const,
        syncedToDrive: true,
        driveFileId: r.driveFileId || file.id,
        driveWebViewLink: r.driveWebViewLink || file.webViewLink,
      }));

    driveVaultCache = {
      tokenPrefix,
      fetchedAt: Date.now(),
      records,
      fileId: file.id,
    };
    return { records, fileId: file.id };
  } catch {
    return { records: [] };
  }
}

async function upsertDriveVault(
  recordsToSave: SavedLanguageTutorRecord[],
  token: string
): Promise<{ fileId?: string; webViewLink?: string }> {
  if (!token) return {};
  try {
    const familyFolder = await getOrCreateGoogleDriveFolder(token, 'Family Circle');
    const studioFolder = await getOrCreateGoogleDriveFolder(token, DRIVE_STUDIO_FOLDER, familyFolder.id);

    const existing = await fetchDriveVault(token, true);
    const merged = mergeRecordLists([
      recordsToSave.map((r) => ({ ...r, syncedToDrive: true })),
      existing.records,
    ]).slice(0, 80);

    const jsonPayload = JSON.stringify(
      {
        appName: 'Aura Family AI Assistant — Live Language Tutor Studio',
        updatedAt: new Date().toISOString(),
        records: merged,
      },
      null,
      2
    );

    const boundary = `-------AuraLangVault${Date.now().toString(36)}`;
    const metadata: any = {
      name: DRIVE_VAULT_FILE,
      mimeType: 'application/json',
    };
    if (!existing.fileId) {
      metadata.parents = [studioFolder.id];
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

    if (!uploadRes.ok) return {};
    const upData = await uploadRes.json();
    driveVaultCache = null;
    return {
      fileId: upData.id,
      webViewLink: upData.webViewLink || `https://drive.google.com/file/d/${upData.id}/view`,
    };
  } catch (err) {
    console.warn('[LanguageTutor] Non-blocking Drive vault warning:', err);
    return {};
  }
}

export async function loadAllSavedTutorRecords(
  userEmail?: string,
  accessToken?: string | null,
  forceRefreshDrive = false
): Promise<SavedLanguageTutorRecord[]> {
  const localRecords = loadLocalRecords();
  const effectiveEmail = getEffectiveUserEmail(userEmail);
  const token = getEffectiveGoogleToken(accessToken);

  const [sqliteRecords, driveResult] = await Promise.all([
    (async (): Promise<SavedLanguageTutorRecord[]> => {
      try {
        const res = await fetch(
          getApiUrl(`/api/language-tutor/records?userEmail=${encodeURIComponent(effectiveEmail)}`)
        );
        if (!res.ok) return [];
        const data = await res.json();
        if (!data.success || !Array.isArray(data.records)) return [];
        return data.records.map(
          (r: any): SavedLanguageTutorRecord => ({
            id: r.id,
            language: (r.language === 'tamil' ? 'tamil' : 'english') as TutorLanguage,
            level: (r.level || 'beginner') as ProficiencyLevel,
            recordType: r.recordType || 'course_lesson',
            moduleId: r.moduleId,
            title: r.title,
            payload: r.payload,
            masteryPercent: r.masteryPercent,
            source: 'sqlite',
            syncedToSqlite: true,
            syncedToDrive: Boolean(r.driveFileId),
            driveFileId: r.driveFileId,
            driveWebViewLink: r.driveWebViewLink,
            createdAt: r.createdAt,
            updatedAt: r.updatedAt,
          })
        );
      } catch {
        return [];
      }
    })(),
    token ? fetchDriveVault(token, forceRefreshDrive) : Promise.resolve({ records: [] }),
  ]);

  const merged = mergeRecordLists([driveResult.records, sqliteRecords, localRecords]);
  saveLocalRecords(merged);
  return merged;
}

export async function saveTutorRecordEverywhere(
  record: Omit<SavedLanguageTutorRecord, 'source' | 'createdAt' | 'updatedAt'> & {
    createdAt?: string;
    updatedAt?: string;
  },
  options?: {
    userEmail?: string;
    googleAccessToken?: string | null;
    exportMarkdownToDrive?: boolean;
  }
): Promise<SavedLanguageTutorRecord> {
  const now = new Date().toISOString();
  const effectiveEmail = getEffectiveUserEmail(options?.userEmail);
  const token = getEffectiveGoogleToken(options?.googleAccessToken);

  let fullRecord: SavedLanguageTutorRecord = {
    ...record,
    source: 'local',
    syncedToSqlite: false,
    syncedToDrive: false,
    createdAt: record.createdAt || now,
    updatedAt: now,
  };

  // 1. Immediate LocalStorage save
  const currentLocal = loadLocalRecords();
  saveLocalRecords(mergeRecordLists([[fullRecord], currentLocal]));

  // 2. Google Drive Markdown Coursebook / Transcript Export (if requested & signed in)
  if (token && options?.exportMarkdownToDrive && record.recordType !== 'progress_snapshot') {
    try {
      const mdContent =
        record.recordType === 'course_lesson' && record.payload?.conceptPillars
          ? formatLessonAsMarkdown(record.payload as ConstructedLanguageLesson)
          : formatSessionAsMarkdown({
              language: record.language,
              scenarioTitle: record.title,
              level: record.level,
              messages: Array.isArray(record.payload?.messages) ? record.payload.messages : [],
            });
      const asciiTitle = buildAsciiDriveTitle(
        record.recordType,
        record.language,
        record.level,
        record.moduleId,
        record.title
      );
      const mdRes = await syncAnyAiOutputToDrive(asciiTitle, mdContent, token, {
        folderName: DRIVE_STUDIO_FOLDER,
        category: 'language-tutor',
        userEmail: effectiveEmail,
        promptContext: `${record.language.toUpperCase()} · ${record.level} · ${record.title}`,
      });
      if (mdRes) {
        fullRecord.driveFileId = mdRes.driveFileId;
        fullRecord.driveWebViewLink = mdRes.driveWebViewLink;
        fullRecord.syncedToDrive = true;
      }
    } catch (err) {
      console.warn('[LanguageTutor] Non-blocking Markdown Drive export warning:', err);
    }
  }

  // 3. Upsert structured Drive JSON vault
  if (token) {
    const vaultRes = await upsertDriveVault([fullRecord], token);
    if (vaultRes.fileId) {
      fullRecord.syncedToDrive = true;
      fullRecord.source = 'google_drive';
      fullRecord.driveFileId = fullRecord.driveFileId || vaultRes.fileId;
      fullRecord.driveWebViewLink = fullRecord.driveWebViewLink || vaultRes.webViewLink;
    }
  }

  // 4. Persist to SQLite
  try {
    const sqlRes = await fetch(getApiUrl('/api/language-tutor/records'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: fullRecord.id,
        userEmail: effectiveEmail,
        language: fullRecord.language,
        level: fullRecord.level,
        recordType: fullRecord.recordType,
        moduleId: fullRecord.moduleId,
        title: fullRecord.title,
        payload: fullRecord.payload,
        masteryPercent: fullRecord.masteryPercent,
        driveFileId: fullRecord.driveFileId,
        driveWebViewLink: fullRecord.driveWebViewLink,
      }),
    });
    if (sqlRes.ok) {
      fullRecord.syncedToSqlite = true;
      if (fullRecord.source === 'local') fullRecord.source = 'sqlite';
    }
  } catch {}

  // Update LocalStorage with final sync metadata
  saveLocalRecords(mergeRecordLists([[fullRecord], loadLocalRecords()]));
  return fullRecord;
}

export async function deleteTutorRecordEverywhere(
  id: string,
  _userEmail?: string,
  accessToken?: string | null
): Promise<boolean> {
  const remaining = loadLocalRecords().filter((r) => r.id !== id);
  saveLocalRecords(remaining);
  driveVaultCache = null;

  try {
    await fetch(getApiUrl(`/api/language-tutor/records/${encodeURIComponent(id)}`), {
      method: 'DELETE',
    });
  } catch {}

  const token = getEffectiveGoogleToken(accessToken);
  if (token) {
    try {
      const familyFolder = await getOrCreateGoogleDriveFolder(token, 'Family Circle');
      const studioFolder = await getOrCreateGoogleDriveFolder(token, DRIVE_STUDIO_FOLDER, familyFolder.id);
      const existing = await fetchDriveVault(token, true);
      if (existing.fileId) {
        const filtered = existing.records.filter((r) => r.id !== id);
        const jsonPayload = JSON.stringify(
          { appName: 'Aura Family AI Assistant — Live Language Tutor Studio', updatedAt: new Date().toISOString(), records: filtered },
          null,
          2
        );
        const boundary = `-------AuraLangDel${Date.now().toString(36)}`;
        const body =
          `--${boundary}\r\n` +
          'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
          JSON.stringify({ name: DRIVE_VAULT_FILE, mimeType: 'application/json' }) +
          `\r\n--${boundary}\r\n` +
          'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
          jsonPayload +
          `\r\n--${boundary}--`;
        await fetch(
          `https://www.googleapis.com/upload/drive/v3/files/${existing.fileId}?uploadType=multipart&supportsAllDrives=true`,
          {
            method: 'PATCH',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': `multipart/related; boundary=${boundary}`,
            },
            body,
          }
        );
        driveVaultCache = null;
      }
      void studioFolder;
    } catch {}
  }

  return true;
}

export async function syncAllLocalRecordsToSqliteAndDrive(
  userEmail?: string,
  accessToken?: string | null
): Promise<{ totalSynced: number; sqliteCount: number; driveSynced: boolean }> {
  const effectiveEmail = getEffectiveUserEmail(userEmail);
  const token = getEffectiveGoogleToken(accessToken);
  const records = await loadAllSavedTutorRecords(effectiveEmail, token, true);
  let sqliteCount = 0;

  for (const rec of records) {
    try {
      const r = await fetch(getApiUrl('/api/language-tutor/records'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: rec.id,
          userEmail: effectiveEmail,
          language: rec.language,
          level: rec.level,
          recordType: rec.recordType,
          moduleId: rec.moduleId,
          title: rec.title,
          payload: rec.payload,
          masteryPercent: rec.masteryPercent,
          driveFileId: rec.driveFileId,
          driveWebViewLink: rec.driveWebViewLink,
        }),
      });
      if (r.ok) {
        rec.syncedToSqlite = true;
        sqliteCount++;
      }
    } catch {}
  }

  let driveSynced = false;
  if (token && records.length > 0) {
    const vault = await upsertDriveVault(records, token);
    if (vault.fileId) {
      driveSynced = true;
      records.forEach((r) => {
        r.syncedToDrive = true;
        r.driveFileId = r.driveFileId || vault.fileId;
        r.driveWebViewLink = r.driveWebViewLink || vault.webViewLink;
      });
    }
  }

  saveLocalRecords(records);
  return { totalSynced: records.length, sqliteCount, driveSynced };
}

// ============================================================================
// 3. AI COURSE CONSTRUCTOR & LIVE HUMAN TUTOR API CALLS
// ============================================================================

function normalizeConstructedLesson(
  raw: any,
  language: TutorLanguage,
  moduleSummary: LanguageModuleSummary,
  modelUsed: string,
  customGoal?: string
): ConstructedLanguageLesson {
  const fallback = buildFallbackLanguageLesson(language, moduleSummary, customGoal);
  if (!raw || typeof raw !== 'object') return fallback;

  const pillars = Array.isArray(raw.conceptPillars) && raw.conceptPillars.length > 0
    ? raw.conceptPillars.map((p: any, idx: number) => ({
        id: String(p?.id || `p-${idx + 1}`),
        title: String(p?.title || `Pillar ${idx + 1}`),
        nativeTitle: p?.nativeTitle ? String(p.nativeTitle) : undefined,
        explanation: String(p?.explanation || ''),
        nativeExplanation: p?.nativeExplanation ? String(p.nativeExplanation) : undefined,
        ruleFormula: p?.ruleFormula ? String(p.ruleFormula) : undefined,
        examples: Array.isArray(p?.examples) && p.examples.length > 0
          ? p.examples.map((ex: any) => ({
              phrase: String(ex?.phrase || ''),
              transliteration: ex?.transliteration ? String(ex.transliteration) : undefined,
              meaning: String(ex?.meaning || ''),
              usageNote: ex?.usageNote ? String(ex.usageNote) : undefined,
            }))
          : fallback.conceptPillars[0].examples,
        commonMistake:
          p?.commonMistake && p.commonMistake.wrong && p.commonMistake.right
            ? {
                wrong: String(p.commonMistake.wrong),
                right: String(p.commonMistake.right),
                why: String(p.commonMistake.why || ''),
              }
            : undefined,
      }))
    : fallback.conceptPillars;

  const vocab = Array.isArray(raw.vocabularyDeck) && raw.vocabularyDeck.length > 0
    ? raw.vocabularyDeck.map((v: any, idx: number) => ({
        id: String(v?.id || `v-${idx + 1}`),
        term: String(v?.term || ''),
        phonetic: String(v?.phonetic || ''),
        transliteration: v?.transliteration ? String(v.transliteration) : undefined,
        meaning: String(v?.meaning || ''),
        partOfSpeech: String(v?.partOfSpeech || 'Expression'),
        register: (['casual', 'formal', 'literary'].includes(v?.register) ? v.register : 'formal') as
          | 'casual'
          | 'formal'
          | 'literary',
        exampleSentence: String(v?.exampleSentence || ''),
        exampleMeaning: String(v?.exampleMeaning || ''),
        memoryHook: String(v?.memoryHook || ''),
      }))
    : fallback.vocabularyDeck;

  const dialogue = Array.isArray(raw.liveDialogueScript) && raw.liveDialogueScript.length > 0
    ? raw.liveDialogueScript.map((d: any) => ({
        speaker: (d?.speaker === 'learner' ? 'learner' : 'tutor') as 'tutor' | 'learner',
        speakerName: String(
          d?.speakerName ||
            (d?.speaker === 'learner'
              ? 'Learner'
              : language === 'tamil'
              ? 'ஆசிரியர் கலைவாணி'
              : 'Prof. Clara Vance')
        ),
        line: String(d?.line || ''),
        transliteration: d?.transliteration ? String(d.transliteration) : undefined,
        meaning: String(d?.meaning || ''),
        coachingTip: d?.coachingTip ? String(d.coachingTip) : undefined,
      }))
    : fallback.liveDialogueScript;

  const drills = Array.isArray(raw.pronunciationDrills) && raw.pronunciationDrills.length > 0
    ? raw.pronunciationDrills.map((d: any, idx: number) => ({
        id: String(d?.id || `d-${idx + 1}`),
        focusSound: String(d?.focusSound || 'Sound Clarity'),
        targetPhrase: String(d?.targetPhrase || ''),
        transliteration: d?.transliteration ? String(d.transliteration) : undefined,
        meaning: String(d?.meaning || ''),
        mouthTip: String(d?.mouthTip || 'Speak smoothly with clear breath support.'),
        difficulty: (['easy', 'medium', 'hard'].includes(d?.difficulty) ? d.difficulty : 'medium') as
          | 'easy'
          | 'medium'
          | 'hard',
      }))
    : fallback.pronunciationDrills;

  const exercises = Array.isArray(raw.interactiveExercises) && raw.interactiveExercises.length > 0
    ? raw.interactiveExercises.map((e: any, idx: number) => ({
        id: String(e?.id || `e-${idx + 1}`),
        type: (['mcq', 'fill_blank', 'speaking'].includes(e?.type) ? e.type : 'mcq') as
          | 'mcq'
          | 'fill_blank'
          | 'speaking',
        prompt: String(e?.prompt || ''),
        nativePrompt: e?.nativePrompt ? String(e.nativePrompt) : undefined,
        options: Array.isArray(e?.options) ? e.options.map(String) : undefined,
        correctAnswer: String(e?.correctAnswer || e?.options?.[0] || ''),
        explanation: String(e?.explanation || ''),
        xp: typeof e?.xp === 'number' ? e.xp : 35,
      }))
    : fallback.interactiveExercises;

  const now = new Date().toISOString();

  return {
    id: `lesson-${moduleSummary.id}-${customGoal ? Date.now().toString(36) : 'ai'}`,
    moduleId: moduleSummary.id,
    language,
    level: moduleSummary.level,
    stageNumber: moduleSummary.stageNumber,
    title: String(raw.title || customGoal || moduleSummary.title),
    nativeTitle: String(raw.nativeTitle || moduleSummary.nativeTitle || moduleSummary.title),
    isCustomCourse: Boolean(customGoal),
    teacherOpeningScript: String(raw.teacherOpeningScript || fallback.teacherOpeningScript),
    teacherOpeningTransliteration:
      raw.teacherOpeningTransliteration || fallback.teacherOpeningTransliteration,
    teacherOpeningMeaning: String(raw.teacherOpeningMeaning || fallback.teacherOpeningMeaning || ''),
    learningObjectives:
      Array.isArray(raw.learningObjectives) && raw.learningObjectives.length > 0
        ? raw.learningObjectives.map(String)
        : fallback.learningObjectives,
    conceptPillars: pillars,
    vocabularyDeck: vocab,
    liveDialogueScript: dialogue,
    pronunciationDrills: drills,
    interactiveExercises: exercises,
    culturalSpotlight:
      raw.culturalSpotlight && raw.culturalSpotlight.quote
        ? {
            title: String(raw.culturalSpotlight.title || fallback.culturalSpotlight.title),
            quote: String(raw.culturalSpotlight.quote),
            transliteration: raw.culturalSpotlight.transliteration
              ? String(raw.culturalSpotlight.transliteration)
              : undefined,
            meaning: String(raw.culturalSpotlight.meaning || ''),
            insight: String(raw.culturalSpotlight.insight || ''),
          }
        : fallback.culturalSpotlight,
    capstoneChallenge:
      raw.capstoneChallenge && raw.capstoneChallenge.prompt
        ? {
            title: String(raw.capstoneChallenge.title || fallback.capstoneChallenge.title),
            prompt: String(raw.capstoneChallenge.prompt),
            targetSkills: Array.isArray(raw.capstoneChallenge.targetSkills)
              ? raw.capstoneChallenge.targetSkills.map(String)
              : fallback.capstoneChallenge.targetSkills,
            sampleMasteryResponse: String(
              raw.capstoneChallenge.sampleMasteryResponse || fallback.capstoneChallenge.sampleMasteryResponse
            ),
          }
        : fallback.capstoneChallenge,
    generatedByModel: modelUsed,
    createdAt: now,
    updatedAt: now,
  };
}

export async function constructLanguageLessonWithAi(params: {
  language: TutorLanguage;
  moduleSummary?: LanguageModuleSummary;
  customGoal?: string;
  level?: ProficiencyLevel;
  userEmail?: string;
  googleAccessToken?: string | null;
  onStageProgress?: (stageLabel: string) => void;
}): Promise<{ lesson: ConstructedLanguageLesson; savedRecord: SavedLanguageTutorRecord; usedAi: boolean }> {
  const { language, customGoal, userEmail, googleAccessToken, onStageProgress } = params;
  const catalog = language === 'tamil' ? TAMIL_CURRICULUM_MODULES : ENGLISH_CURRICULUM_MODULES;
  const chosenLevel = params.level || params.moduleSummary?.level || 'beginner';
  const stageNumMap: Record<ProficiencyLevel, number> = {
    beginner: 1,
    elementary: 2,
    intermediate: 3,
    upper_intermediate: 4,
    advanced: 5,
    mastery: 6,
  };
  const moduleSummary: LanguageModuleSummary = params.moduleSummary || {
    id: `custom-${language}-${Date.now().toString(36)}`,
    language,
    stageNumber: stageNumMap[chosenLevel],
    level: chosenLevel,
    levelLabel: `${language === 'tamil' ? 'சுய பாடம்' : 'Custom Course'} · Stage ${stageNumMap[chosenLevel]}`,
    title: customGoal?.trim() || catalog[0].title,
    nativeTitle: customGoal?.trim() || catalog[0].nativeTitle,
    subtitle: `Tailored AI course module constructed for ${customGoal || catalog[0].title}`,
    estimatedMinutes: 20,
    keyTopics: [customGoal?.trim() || catalog[0].title, 'Live Speaking', 'Grammar & Nuance'],
    xpReward: 180,
    colorGradient: 'from-indigo-600/30 to-purple-900/40',
  };

  onStageProgress?.(
    language === 'tamil'
      ? '✨ ஆசிரியர் கலைவாணி பாடத்திட்டத்தை AI மூலம் உருவாக்குகிறார்...'
      : '✨ Prof. Clara is designing your interactive course module with AI...'
  );

  const aiCfg = getTutorActiveAiParams();
  let lesson: ConstructedLanguageLesson | null = null;
  let usedAi = false;

  try {
    const res = await fetch(getApiUrl('/api/language-tutor/construct-lesson'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language,
        level: moduleSummary.level,
        stageNumber: moduleSummary.stageNumber,
        moduleTitle: moduleSummary.title,
        moduleSubtitle: moduleSummary.subtitle,
        customGoal,
        keyTopics: moduleSummary.keyTopics,
        ...aiCfg,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.lesson) {
        lesson = normalizeConstructedLesson(
          data.lesson,
          language,
          moduleSummary,
          `${data.providerUsed || aiCfg.provider} · ${data.modelUsed || aiCfg.model}`,
          customGoal
        );
        usedAi = true;
      }
    }
  } catch (err) {
    console.warn('[LanguageTutor] Falling back to offline course builder:', err);
  }

  if (!lesson) {
    lesson = buildFallbackLanguageLesson(language, moduleSummary, customGoal);
  }

  onStageProgress?.('💾 Saving coursebook to SQLite & Google Drive...');

  const stableRecordId = customGoal
    ? `course-${language}-${Date.now().toString(36)}`
    : `course-${moduleSummary.id}`;

  const savedRecord = await saveTutorRecordEverywhere(
    {
      id: stableRecordId,
      language,
      level: moduleSummary.level,
      recordType: 'course_lesson',
      moduleId: moduleSummary.id,
      title: lesson.title,
      payload: lesson,
      masteryPercent: 0,
    },
    {
      userEmail,
      googleAccessToken,
      exportMarkdownToDrive: true,
    }
  );

  return { lesson, savedRecord, usedAi };
}

export async function sendLiveTutorTurn(params: {
  language: TutorLanguage;
  level: ProficiencyLevel;
  scenarioTitle: string;
  learnerGoal?: string;
  activeModuleTitle?: string;
  userMessage: string;
  history: LiveTutorMessage[];
  includeTransliteration?: boolean;
}): Promise<{ message: LiveTutorMessage; usedAi: boolean }> {
  const aiCfg = getTutorActiveAiParams();

  try {
    const res = await fetch(getApiUrl('/api/language-tutor/live-turn'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language: params.language,
        level: params.level,
        scenarioTitle: params.scenarioTitle,
        learnerGoal: params.learnerGoal,
        activeModuleTitle: params.activeModuleTitle,
        userMessage: params.userMessage,
        history: params.history.map((m) => ({
          role: m.role === 'learner' ? 'user' : 'assistant',
          content: m.text,
        })),
        includeTransliteration: params.includeTransliteration ?? true,
        ...aiCfg,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.turn && data.turn.reply) {
        const t = data.turn;
        return {
          usedAi: true,
          message: {
            id: `tutor-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            role: 'tutor',
            text: String(t.reply),
            transliteration: t.transliteration ? String(t.transliteration) : undefined,
            englishMeaning: t.englishMeaning ? String(t.englishMeaning) : undefined,
            emotion: (['welcoming', 'explaining', 'encouraging', 'celebrating', 'listening', 'coaching'].includes(
              t.emotion
            )
              ? t.emotion
              : 'encouraging') as any,
            praiseNote: t.praiseNote ? String(t.praiseNote) : undefined,
            grammarFeedback:
              t.grammarFeedback && t.grammarFeedback !== 'null' ? String(t.grammarFeedback) : undefined,
            betterPhrasing:
              t.betterPhrasing && t.betterPhrasing !== 'null' ? String(t.betterPhrasing) : undefined,
            pronunciationTip:
              t.pronunciationTip && t.pronunciationTip !== 'null' ? String(t.pronunciationTip) : undefined,
            fluencyScore: typeof t.fluencyScore === 'number' ? t.fluencyScore : 86,
            xpEarned: typeof t.xpEarned === 'number' ? t.xpEarned : 20,
            followUpSuggestions: Array.isArray(t.followUpSuggestions)
              ? t.followUpSuggestions.slice(0, 3).map(String)
              : undefined,
            timestamp: new Date().toISOString(),
          },
        };
      }
    }
  } catch {}

  // Warm, genuinely responsive offline human-tutor fallback
  const u = params.userMessage.trim();
  const wordCount = u.split(/\s+/).filter(Boolean).length;
  const fluency = Math.min(95, Math.max(72, 68 + wordCount * 2));

  if (params.language === 'tamil') {
    const hasTamilScript = /[\u0B80-\u0BFF]/.test(u);
    return {
      usedAi: false,
      message: {
        id: `tutor-${Date.now()}`,
        role: 'tutor',
        text: hasTamilScript
          ? `அருமை! "${u}" என்று நீங்கள் அழகாகச் சொன்னீர்கள். இதே உற்சாகத்துடன் உங்கள் கருத்தை இன்னும் ஒரு வாக்கியத்தில் விவரிக்க முடியுமா?`
          : `நல்ல முயற்சி! "${u}" என்பதை இயல்பான தமிழில் "நான் தினமும் ஆர்வத்துடன் பேசிப் பழகுகிறேன்" என்று கூறலாம். இப்போது நீங்களே தமிழ் வார்த்தைகளில் சொல்லிப் பாருங்களேன்!`,
        transliteration: hasTamilScript
          ? 'Arumai! Neengal azhagaaga sonneergal. Idhe urchaagaththudan ungal karuththai innum oru vaakkiyaththil vivarikka mudiyumaa?'
          : 'Nalla muyarchi! Idhai iyalbaana Tamilil "Naan dhinamum aarvaththudan pesi pazhugugiren" endru kooralaam. Ippodhu neengale sollunga!',
        englishMeaning: hasTamilScript
          ? 'Wonderful! You expressed that nicely. With the same enthusiasm, could you expand your thought by one more sentence?'
          : 'Great effort! You can say that naturally in Tamil as "I practice speaking enthusiastically every day." Give it a try!',
        emotion: 'encouraging',
        praiseNote: 'Great courage jumping right into conversation!',
        grammarFeedback: hasTamilScript
          ? undefined
          : 'Try blending at least 1–2 Tamil words like "வணக்கம்", "நன்றி", or "நல்லா இருக்கு" in your next reply.',
        pronunciationTip: 'Keep vowels steady and crisp; pause slightly after respectful "-ங்கள்" endings.',
        fluencyScore: fluency,
        xpEarned: 15,
        followUpSuggestions: [
          'வணக்கம், இன்று எனக்குப் புதிய வார்த்தைகள் கற்க ஆசை.',
          'என் குடும்பத்துடன் தமிழில் பேச மிகவும் பிடிக்கும்.',
        ],
        timestamp: new Date().toISOString(),
      },
    };
  }

  return {
    usedAi: false,
    message: {
      id: `tutor-${Date.now()}`,
      role: 'tutor',
      text: `I love how thoughtfully you shared that! Notice how clear your core idea is. To give your sentence extra natural flow, try linking a specific example with "What I noticed most was...". What example comes to mind right now?`,
      emotion: 'encouraging',
      praiseNote: `Clear message in ${wordCount} words with warm conversational tone.`,
      betterPhrasing:
        wordCount < 6
          ? `You could expand this into: "Actually, what excites me most about this is..."`
          : undefined,
      pronunciationTip: 'Emphasize key nouns & verbs lightly while letting "to", "the", and "of" glide softly.',
      fluencyScore: fluency,
      xpEarned: 15,
      followUpSuggestions: [
        'What I noticed most was how practicing aloud improved my confidence.',
        'Could you share one stronger way to express that idea?',
      ],
      timestamp: new Date().toISOString(),
    },
  };
}

export async function evaluateSpeakingPractice(params: {
  language: TutorLanguage;
  level: ProficiencyLevel;
  targetPhrase: string;
  learnerResponse: string;
  taskType?: 'pronunciation_drill' | 'capstone';
}): Promise<SpeakingEvaluationResult> {
  const aiCfg = getTutorActiveAiParams();

  try {
    const res = await fetch(getApiUrl('/api/language-tutor/evaluate-speaking'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language: params.language,
        level: params.level,
        targetPhrase: params.targetPhrase,
        learnerResponse: params.learnerResponse,
        taskType: params.taskType || 'pronunciation_drill',
        ...aiCfg,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.evaluation) {
        const ev = data.evaluation;
        return {
          overallScore: Number(ev.overallScore) || 85,
          pronunciationScore: Number(ev.pronunciationScore) || 84,
          grammarScore: Number(ev.grammarScore) || 86,
          naturalnessScore: Number(ev.naturalnessScore) || 85,
          emotion: ev.emotion || 'celebrating',
          coachFeedback: String(ev.coachFeedback || 'Wonderful effort!'),
          correctedVersion: String(ev.correctedVersion || params.targetPhrase),
          phoneticTip: String(ev.phoneticTip || 'Keep steady rhythm and clear breathing.'),
          xpEarned: Number(ev.xpEarned) || 30,
        };
      }
    }
  } catch {}

  // Deterministic local phonetic/word overlap evaluator
  const clean = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter(Boolean);

  const targetWords = clean(params.targetPhrase);
  const userWords = clean(params.learnerResponse);

  let overlap = 0;
  if (params.taskType === 'capstone') {
    overlap = Math.min(1, userWords.length / 10);
  } else if (targetWords.length > 0) {
    const userSet = new Set(userWords);
    const matches = targetWords.filter((w) => userSet.has(w)).length;
    overlap = matches / targetWords.length;
  }

  const score = Math.round(62 + overlap * 34);
  return {
    overallScore: score,
    pronunciationScore: Math.min(98, score + 1),
    grammarScore: Math.min(98, score),
    naturalnessScore: Math.min(98, score - 1),
    emotion: score >= 82 ? 'celebrating' : 'encouraging',
    coachFeedback:
      params.language === 'tamil'
        ? score >= 82
          ? 'மிகச் சிறப்பு! உங்கள் தமிழ் உச்சரிப்பும் சொல் தெளிவும் அருமையாக உள்ளன!'
          : 'நல்ல முயற்சி! மெதுவாக ஒவ்வொரு அசையையும் அழுத்தமாகச் சொல்லி மீண்டும் முயற்சியுங்கள்.'
        : score >= 82
        ? 'Brilliant clarity! Your phrasing and rhythm landed naturally.'
        : 'Strong effort! Slow down slightly on the stressed syllables and glide through connecting words.',
    correctedVersion: params.taskType === 'capstone' ? params.learnerResponse : params.targetPhrase,
    phoneticTip:
      params.language === 'tamil'
        ? 'ழ, ள, ல மற்றும் குறில்-நெடில் ஓசைகளுக்குச் சற்று கவனத்துடன் நேரம் கொடுங்கள்.'
        : 'Pause naturally between thought chunks and project crisp ending consonants.',
    xpEarned: score >= 82 ? 40 : 25,
  };
}

// ============================================================================
// 4. LEARNER PROGRESS PERSISTENCE
// ============================================================================

export function loadTutorProgress(): TutorProgressState {
  const today = new Date().toISOString().split('T')[0];
  const defaults: TutorProgressState = {
    xp: 240,
    streakDays: 1,
    lastActiveDate: today,
    completedModules: {},
    masteredVocabIds: [],
    totalLiveTurns: 0,
    averageFluency: 86,
    englishLevel: 'intermediate',
    tamilLevel: 'beginner',
  };

  if (typeof window === 'undefined') return defaults;
  try {
    const raw = localStorage.getItem(LOCAL_PROGRESS_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    return { ...defaults, ...parsed };
  } catch {
    return defaults;
  }
}

export async function saveTutorProgress(
  progress: TutorProgressState,
  userEmail?: string,
  accessToken?: string | null
): Promise<void> {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(LOCAL_PROGRESS_KEY, JSON.stringify(progress));
    } catch {}
  }

  await saveTutorRecordEverywhere(
    {
      id: 'lt-global-progress-snapshot',
      language: 'english',
      level: progress.englishLevel,
      recordType: 'progress_snapshot',
      title: `Learner Progress Snapshot (${progress.xp} XP)`,
      payload: progress,
      masteryPercent: progress.averageFluency,
    },
    {
      userEmail,
      googleAccessToken: accessToken,
      exportMarkdownToDrive: false,
    }
  );
}

// ============================================================================
// 5. BUNDLE 1: WORD-BY-WORD PRONUNCIATION HEATMAP & 3-REGISTER LIVE REWRITER
// ============================================================================

function wordEditDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

export function analyzeWordPronunciationHeatmap(
  targetPhrase: string,
  spokenTranscript: string,
  language: TutorLanguage
): PronunciationHeatmapResult {
  const cleanTokens = (s: string) =>
    s
      .replace(/[^\p{L}\p{N}\s']/gu, ' ')
      .split(/\s+/)
      .map((w) => w.trim())
      .filter(Boolean);

  const targetWords = cleanTokens(targetPhrase);
  const spokenWords = cleanTokens(spokenTranscript).map((w) => w.toLowerCase());

  if (targetWords.length === 0) {
    return {
      overallAccuracy: 0,
      tokens: [],
      coachSummary: 'Select or enter a phrase first, then speak it clearly.',
    };
  }

  let clearCount = 0;
  let driftCount = 0;
  const tokens: WordHeatmapToken[] = targetWords.map((rawWord) => {
    const norm = rawWord.toLowerCase();
    let bestSim = 0;
    for (const sw of spokenWords) {
      if (sw === norm) {
        bestSim = 1;
        break;
      }
      const maxLen = Math.max(norm.length, sw.length);
      if (maxLen > 0) {
        const sim = 1 - wordEditDistance(norm, sw) / maxLen;
        if (sim > bestSim) bestSim = sim;
      }
    }

    const hasTrickyTamil = /[ழளலணனநறர]/.test(rawWord);
    if (bestSim >= 0.85) {
      clearCount++;
      return { word: rawWord, status: 'clear' };
    }
    if (bestSim >= 0.45) {
      driftCount++;
      return {
        word: rawWord,
        status: 'drift',
        tip:
          language === 'tamil' && hasTrickyTamil
            ? 'Watch tongue curl on ழ/ள/ல or ண/ன/ந — try 0.75× slow shadow!'
            : language === 'tamil'
            ? 'Give each vowel its crisp length (குறில் vs நெடில்).'
            : 'Slightly slow down and stress the main syllable cleanly.',
      };
    }
    return {
      word: rawWord,
      status: 'missed',
      tip:
        language === 'tamil'
          ? `Missed or muffled "${rawWord}" — listen once slowly and repeat.`
          : `Missed "${rawWord}" — project this word clearly with crisp ending sounds.`,
    };
  });

  const overallAccuracy = Math.round(((clearCount + driftCount * 0.55) / targetWords.length) * 100);
  const coachSummary =
    overallAccuracy >= 85
      ? language === 'tamil'
        ? `அருமை! ${overallAccuracy}% தெளிவான உச்சரிப்பு — இயல்பான குரல் நயம்!`
        : `Brilliant clarity (${overallAccuracy}%)! Your rhythm and articulation landed cleanly.`
      : overallAccuracy >= 60
      ? language === 'tamil'
        ? `நல்ல முயற்சி (${overallAccuracy}%)! மஞ்சள்/சிவப்பு சொற்களை 0.75× வேகத்தில் கேட்டு மீண்டும் சொல்லுங்கள்.`
        : `Solid momentum (${overallAccuracy}%)! Shadow the amber/red words slowly once and watch your score jump.`
      : language === 'tamil'
      ? `தொடங்குவதே வெற்றி (${overallAccuracy}%)! முதலில் ஆசிரியரின் குரலை மெதுவாகக் கேட்டு ஒவ்வொரு சொல்லாகப் பயிற்சி செய்யுங்கள்.`
      : `Great first run (${overallAccuracy}%)! Listen at 0.75× slow speed and shadow 3 words at a time.`;

  return { overallAccuracy, tokens, coachSummary };
}

export async function rewriteSentenceThreeRegisters(
  text: string,
  language: TutorLanguage
): Promise<RegisterRewriteResult> {
  const clean = text.trim();
  const aiCfg = getTutorActiveAiParams();

  try {
    const res = await fetch(getApiUrl('/api/language-tutor/register-rewrite'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: clean, language, ...aiCfg }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.result && data.result.casual) {
        return {
          input: clean,
          language,
          casual: String(data.result.casual),
          casualTranslit: data.result.casualTranslit ? String(data.result.casualTranslit) : undefined,
          formal: String(data.result.formal || data.result.casual),
          formalTranslit: data.result.formalTranslit ? String(data.result.formalTranslit) : undefined,
          literary: String(data.result.literary || data.result.formal || data.result.casual),
          literaryTranslit: data.result.literaryTranslit
            ? String(data.result.literaryTranslit)
            : undefined,
          coachingNote: String(data.result.coachingNote || 'Notice how verb endings and word choices elevate tone.'),
          modelUsed: data.modelUsed || aiCfg.model,
        };
      }
    }
  } catch {}

  if (language === 'tamil') {
    return {
      input: clean,
      language: 'tamil',
      casual: `இதைப் பத்தி ரொம்ப சந்தோஷமா பேசுறேன்: "${clean}"`,
      casualTranslit: `Idhai paththi romba sandhoshamaa pesuren: "${clean}"`,
      formal: `இதைப் பற்றி மிக்க மகிழ்ச்சியுடன் பகிர்ந்து கொள்கிறேன்: "${clean}"`,
      formalTranslit: `Idhai patri mikka magizhchiyudan pagirndhu kolgiren: "${clean}"`,
      literary: `இக்கருத்தினைப் பெருமகிழ்வோடு தங்களின் முன் சமர்ப்பிக்கின்றேன்: "${clean}"`,
      literaryTranslit: `Ikkaruththinai perumagizhvodhu thangalin mun samarppikkindren: "${clean}"`,
      coachingNote:
        'Notice the progression: Spoken பேச்சுத் தமிழ் ("பத்தி / பேசுறேன்") -> Formal ("பற்றி / பகிர்ந்து கொள்கிறேன்") -> Literary செந்தமிழ் ("இக்கருத்தினை / சமர்ப்பிக்கின்றேன்").',
      modelUsed: 'Offline Register Engine',
    };
  }

  return {
    input: clean,
    language: 'english',
    casual: `Hey, just wanted to share this: ${clean}`,
    formal: `I would like to clearly share the following update: ${clean}`,
    literary: `Allow me to underscore a pivotal perspective: ${clean}`,
    coachingNote:
      'Casual uses warm contractions, Professional centers on clarity, and Executive C2 uses elevated verbs ("underscore", "pivotal").',
    modelUsed: 'Offline Register Engine',
  };
}

// ============================================================================
// 6. BUNDLE 2: AI ESSAY, EMAIL & SPEECH CLINIC (BILINGUAL RED-PEN GRADER)
// ============================================================================

export async function gradeWritingWithEssayClinic(params: {
  text: string;
  language: TutorLanguage;
  genre: string;
  level: ProficiencyLevel;
  userEmail?: string;
  googleAccessToken?: string | null;
}): Promise<{ clinic: EssayClinicResult; savedRecord: SavedLanguageTutorRecord }> {
  const aiCfg = getTutorActiveAiParams();
  let clinic: EssayClinicResult | null = null;

  try {
    const res = await fetch(getApiUrl('/api/language-tutor/essay-clinic'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: params.text,
        language: params.language,
        genre: params.genre,
        level: params.level,
        ...aiCfg,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.clinic && data.clinic.polishedVersion) {
        const c = data.clinic;
        clinic = {
          cefrBand: String(c.cefrBand || 'B1'),
          fluencyScore: Number(c.fluencyScore) || 82,
          grammarScore: Number(c.grammarScore) || 80,
          vocabRichness: Number(c.vocabRichness) || 78,
          clarityScore: Number(c.clarityScore) || 84,
          corrections: Array.isArray(c.corrections) ? c.corrections.slice(0, 6) : [],
          polishedVersion: String(c.polishedVersion),
          encouragement: String(c.encouragement || 'Wonderful voice and clarity!'),
          modelUsed: data.modelUsed || aiCfg.model,
        };
      }
    }
  } catch {}

  if (!clinic) {
    const words = params.text.trim().split(/\s+/).filter(Boolean).length;
    const score = Math.min(92, Math.max(70, 66 + Math.min(24, words)));
    clinic = {
      cefrBand: score >= 86 ? 'B2' : score >= 78 ? 'B1' : 'A2',
      fluencyScore: score,
      grammarScore: score - 1,
      vocabRichness: score - 2,
      clarityScore: Math.min(95, score + 2),
      corrections: [
        {
          original: params.text.slice(0, 60),
          improved:
            params.language === 'tamil'
              ? `${params.text.trim()} (சந்தி மற்றும் மரியாதை விகுதிகளைச் சரிபார்க்கவும்)`
              : `${params.text.trim()} — try opening with a crisp topic sentence and one vivid transition.`,
          reason:
            params.language === 'tamil'
              ? 'தெளிவான முன்னுரை மற்றும் முறையான வினை முடிவுகள் கட்டுரைக்கு அழகு சேர்க்கும்.'
              : 'Adding a clear connector and active verb immediately elevates readability.',
        },
      ],
      polishedVersion: params.text.trim(),
      encouragement:
        params.language === 'tamil'
          ? 'அருமையான எழுத்து முயற்சி! தொடர்ந்து தினமும் 4–5 வாக்கியங்கள் எழுதினால் உங்கள் செந்தமிழ் விரைவில் ஒளிரும்.'
          : 'Warm, authentic writing! Keep pairing crisp active verbs with clear transitions to reach the next CEFR band.',
      modelUsed: 'Offline Writing Clinic',
    };
  }

  const savedRecord = await saveTutorRecordEverywhere(
    {
      id: `clinic-${params.language}-${Date.now().toString(36)}`,
      language: params.language,
      level: params.level,
      recordType: 'essay_clinic',
      title: `${params.genre} Clinic (${clinic.cefrBand} · ${clinic.fluencyScore}%)`,
      payload: {
        originalText: params.text,
        genre: params.genre,
        clinic,
      },
      masteryPercent: clinic.fluencyScore,
    },
    {
      userEmail: params.userEmail,
      googleAccessToken: params.googleAccessToken,
      exportMarkdownToDrive: true,
    }
  );

  return { clinic, savedRecord };
}

// ============================================================================
// 7. BUNDLE 3: SM-2 SPACED REPETITION ENGINE
// ============================================================================

export function scheduleSrsCardReview(
  item: SrsVocabItem,
  quality: 'again' | 'good' | 'easy'
): SrsVocabItem {
  let ease = item.easeFactor || 2.5;
  let reps = item.repetitions || 0;
  let interval = item.intervalDays || 1;

  if (quality === 'again') {
    reps = 0;
    interval = 1;
    ease = Math.max(1.3, ease - 0.2);
  } else if (quality === 'good') {
    reps += 1;
    interval = reps === 1 ? 1 : reps === 2 ? 3 : Math.round(interval * ease);
  } else {
    reps += 1;
    ease = Math.min(3.0, ease + 0.15);
    interval = reps === 1 ? 3 : reps === 2 ? 7 : Math.round(interval * ease * 1.25);
  }

  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + interval);

  return {
    ...item,
    easeFactor: Number(ease.toFixed(2)),
    repetitions: reps,
    intervalDays: interval,
    nextReviewDate: nextDate.toISOString().split('T')[0],
    lastReviewedAt: new Date().toISOString(),
  };
}

// ============================================================================
// 8. BUNDLE 4: MULTI-LEARNER FAMILY SUITE, CERTIFICATES & FLUENCY ANALYTICS
// ============================================================================

const FAMILY_SUITE_KEY = 'aura_language_tutor_family_suite_v1';

export function buildDefaultProgressForLearner(isKid = false): TutorProgressState {
  const today = new Date().toISOString().split('T')[0];
  return {
    xp: isKid ? 120 : 240,
    streakDays: 1,
    lastActiveDate: today,
    completedModules: {},
    masteredVocabIds: [],
    totalLiveTurns: 0,
    averageFluency: 84,
    englishLevel: isKid ? 'beginner' : 'intermediate',
    tamilLevel: 'beginner',
    speakingMinutes: 0,
    tracedLettersCount: 0,
    essaysGradedCount: 0,
    sentencePuzzlesSolved: 0,
    srsDeck: [...buildStarterSrsDeck('tamil'), ...buildStarterSrsDeck('english')],
    certificates: [],
    fluencyHistory: [
      { date: today, language: 'tamil', fluencyScore: 80, speakingMinutes: 5, xpEarned: 60 },
      { date: today, language: 'english', fluencyScore: 86, speakingMinutes: 6, xpEarned: 80 },
    ],
    placementResult: {},
  };
}

export function loadFamilyTutorSuite(): FamilyTutorSuiteState {
  const fallbackSuite: FamilyTutorSuiteState = {
    activeLearnerId: DEFAULT_FAMILY_LEARNERS[0].id,
    learners: DEFAULT_FAMILY_LEARNERS,
    progressByLearner: {
      [DEFAULT_FAMILY_LEARNERS[0].id]: {
        ...buildDefaultProgressForLearner(false),
        ...loadTutorProgress(),
      },
      [DEFAULT_FAMILY_LEARNERS[1].id]: buildDefaultProgressForLearner(true),
    },
  };

  if (typeof window === 'undefined') return fallbackSuite;
  try {
    const raw = localStorage.getItem(FAMILY_SUITE_KEY);
    if (!raw) return fallbackSuite;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.learners) || parsed.learners.length === 0) {
      return fallbackSuite;
    }
    return {
      activeLearnerId: parsed.activeLearnerId || parsed.learners[0].id,
      learners: parsed.learners,
      progressByLearner: parsed.progressByLearner || fallbackSuite.progressByLearner,
    };
  } catch {
    return fallbackSuite;
  }
}

export async function saveFamilyTutorSuite(
  suite: FamilyTutorSuiteState,
  userEmail?: string,
  accessToken?: string | null
): Promise<void> {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(FAMILY_SUITE_KEY, JSON.stringify(suite));
    } catch {}
  }

  const activeProg =
    suite.progressByLearner[suite.activeLearnerId] || buildDefaultProgressForLearner(false);

  await saveTutorRecordEverywhere(
    {
      id: 'lt-family-suite-state',
      language: 'english',
      level: activeProg.englishLevel,
      recordType: 'family_suite_state',
      title: `Family Language Tutor Suite (${suite.learners.length} Learners)`,
      payload: suite,
      masteryPercent: activeProg.averageFluency,
    },
    {
      userEmail,
      googleAccessToken: accessToken,
      exportMarkdownToDrive: false,
    }
  );
}

export async function issueStageCertificateAndSync(params: {
  learner: TutorFamilyLearnerProfile;
  language: TutorLanguage;
  stageNumber: number;
  cefrCode: string;
  stageTitle: string;
  scorePercent: number;
  userEmail?: string;
  googleAccessToken?: string | null;
}): Promise<StageCompletionCertificate> {
  const signedBy =
    params.language === 'tamil'
      ? 'ஆசிரியர் கலைவாணி (Prof. Kalaivani)'
      : 'Prof. Clara Vance';
  const issuedAt = new Date().toISOString();
  const certId = `cert-${params.learner.id}-${params.language}-s${params.stageNumber}`;

  const cert: StageCompletionCertificate = {
    id: certId,
    learnerId: params.learner.id,
    learnerName: params.learner.name,
    language: params.language,
    stageNumber: params.stageNumber,
    cefrCode: params.cefrCode,
    stageTitle: params.stageTitle,
    scorePercent: params.scorePercent,
    signedBy,
    issuedAt,
  };

  const md = [
    `# Certificate of Mastery — ${params.language === 'tamil' ? 'தமிழ் (Tamil)' : 'English'}`,
    '',
    `**Awarded To:** ${cert.learnerName} (${params.learner.roleLabel})`,
    `**Stage Completed:** Stage ${cert.stageNumber} (${cert.cefrCode}) — ${cert.stageTitle}`,
    `**Mastery Score:** ${cert.scorePercent}%`,
    `**Signed By:** ${cert.signedBy}`,
    `**Issued On:** ${new Date(issuedAt).toLocaleDateString()}`,
    '',
    '> *Archived in Aura Family AI Assistant — SQLite & Google Drive (Family Circle / Language Tutor Studio).*',
  ].join('\n');

  const token = getEffectiveGoogleToken(params.googleAccessToken);
  if (token) {
    try {
      const uploaded = await syncAnyAiOutputToDrive(
        `Certificate_${params.language}_Stage${params.stageNumber}_${params.learner.name.replace(/[^a-zA-Z0-9]/g, '_')}`,
        md,
        token,
        {
          folderName: `${DRIVE_STUDIO_FOLDER}`,
          category: 'language-tutor-certificate',
          userEmail: params.userEmail,
        }
      );
      if (uploaded) cert.driveWebViewLink = uploaded.driveWebViewLink;
    } catch {}
  }

  await saveTutorRecordEverywhere(
    {
      id: certId,
      language: params.language,
      level: 'mastery',
      recordType: 'certificate',
      title: `Certificate: ${cert.learnerName} — ${params.language === 'tamil' ? 'Tamil' : 'English'} ${cert.cefrCode}`,
      payload: cert,
      masteryPercent: cert.scorePercent,
      driveWebViewLink: cert.driveWebViewLink,
    },
    {
      userEmail: params.userEmail,
      googleAccessToken: params.googleAccessToken,
      exportMarkdownToDrive: false,
    }
  );

  return cert;
}

export async function exportTutorFluencyReportToDrive(params: {
  learner: TutorFamilyLearnerProfile;
  progress: TutorProgressState;
  accessToken?: string | null;
  userEmail?: string;
}): Promise<{ ok: boolean; message: string; webViewLink?: string }> {
  const { learner, progress, accessToken, userEmail } = params;
  const token = getEffectiveGoogleToken(accessToken);

  const md = [
    `# Language Tutor Weekly Fluency & Mastery Report`,
    `**Learner:** ${learner.avatar} ${learner.name} (${learner.roleLabel})`,
    `**Generated:** ${new Date().toLocaleString()}`,
    '',
    '## Key Fluency Metrics',
    `- **Total XP:** ${progress.xp} XP`,
    `- **Current Streak:** ${progress.streakDays} Days`,
    `- **Average Live Fluency:** ${progress.averageFluency}%`,
    `- **Speaking Time Logged:** ${progress.speakingMinutes || 0} minutes (${progress.totalLiveTurns} live turns)`,
    `- **English Level:** ${progress.englishLevel} | **Tamil Level:** ${progress.tamilLevel}`,
    `- **Vocabulary Mastered / SRS Deck:** ${(progress.srsDeck || []).length} cards`,
    `- **Letters Traced:** ${progress.tracedLettersCount || 0} | **Essays Graded:** ${progress.essaysGradedCount || 0} | **Sentence Puzzles Solved:** ${progress.sentencePuzzlesSolved || 0}`,
    `- **Certificates Earned:** ${(progress.certificates || []).length}`,
    '',
    '## Fluency Trend History',
    ...(progress.fluencyHistory || []).slice(-10).map(
      (pt) => `- ${pt.date} (${pt.language.toUpperCase()}): Fluency ${pt.fluencyScore}% · ${pt.speakingMinutes}m · +${pt.xpEarned} XP`
    ),
  ].join('\n');

  if (!token) {
    return {
      ok: false,
      message: 'Analytics saved to SQLite! Sign in with Google to export this report to Google Drive.',
    };
  }

  try {
    const res = await syncAnyAiOutputToDrive(
      `Language_Fluency_Report_${learner.name.replace(/[^a-zA-Z0-9]/g, '_')}`,
      md,
      token,
      {
        folderName: DRIVE_STUDIO_FOLDER,
        category: 'language-tutor-analytics',
        userEmail,
      }
    );
    if (res) {
      return {
        ok: true,
        webViewLink: res.driveWebViewLink,
        message: 'Weekly Fluency Report exported to Google Drive (Family Circle / Language Tutor Studio)!',
      };
    }
    return { ok: false, message: 'Could not upload report to Google Drive right now.' };
  } catch (err: any) {
    return { ok: false, message: err?.message || 'Drive upload failed.' };
  }
}

