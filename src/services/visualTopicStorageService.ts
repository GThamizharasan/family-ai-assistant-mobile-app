// SQLite & Google Drive Visual Topic Vault Service
// Powers Speak Visual & Visualize lookup across saved Whiteboard scenes, SQLite records,
// SQLite-mirrored Drive documents, and live Google Drive notes — plus auto-sync on AI creation.

import {
  SavedVisualTopicRecord,
  SubjectDefinition,
  SubjectId,
  WhiteboardPrimitive,
  WhiteboardVisualScene,
} from '../types/adaptiveLearning';
import { getApiUrl } from './api';
import { getOrCreateGoogleDriveFolder } from './googleWorkspace';

const LOCAL_VISUAL_TOPICS_KEY = 'aura_saved_visual_topics_v1';
const DRIVE_VISUAL_FOLDER = 'Adaptive Visual Topics';
const DRIVE_VISUAL_FILE_NAME = 'whiteboard_visual_topics.json';
const DRIVE_CACHE_TTL_MS = 45_000;

let driveCache: {
  tokenPrefix: string;
  fetchedAt: number;
  records: SavedVisualTopicRecord[];
  fileId?: string;
} | null = null;

// ============================================================================
// 1. TOKEN, UTF-8 & QUERY NORMALIZATION HELPERS
// ============================================================================

export function getEffectiveGoogleToken(token?: string | null): string {
  if (token && token.trim()) return token.trim();
  if (typeof window === 'undefined') return '';
  return (
    localStorage.getItem('aura_google_access_token') ||
    localStorage.getItem('google_access_token') ||
    ''
  ).trim();
}

function getEffectiveUserEmail(userEmail?: string): string {
  if (userEmail && userEmail.trim()) return userEmail.toLowerCase().trim();
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('userEmail');
    if (stored && stored.trim()) return stored.toLowerCase().trim();
  }
  return 'chinna.tamil2000@gmail.com';
}

export function decodeBase64Utf8(base64Str: string): string {
  if (!base64Str) return '';
  try {
    const clean = base64Str.replace(/^data:[^;]+;base64,/, '').trim();
    const binary = atob(clean);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    if (typeof TextDecoder !== 'undefined') {
      return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    }
    return decodeURIComponent(escape(binary));
  } catch {
    try {
      return atob(base64Str);
    } catch {
      return '';
    }
  }
}

export function normalizeTopicQuery(raw: string): string {
  if (!raw) return '';
  let s = raw.toLowerCase().trim();
  // Strip multi-word conversational storage/voice phrases first
  s = s
    .replace(/\bfrom\s+google\s+drive\b/g, ' ')
    .replace(/\bfrom\s+sqlite\b/g, ' ')
    .replace(/\bin\s+sqlite\b/g, ' ')
    .replace(/\bfrom\s+drive\b/g, ' ')
    .replace(/\bin\s+drive\b/g, ' ')
    .replace(/\bsaved\s+in\b/g, ' ');

  // Strip common voice command & filler tokens
  const fillerWords = new Set([
    'draw',
    'generate',
    'plot',
    'show',
    'explain',
    'visualize',
    'open',
    'load',
    'find',
    'get',
    'fetch',
    'saved',
    'my',
    'the',
    'a',
    'an',
    'please',
    'me',
    'about',
    'on',
    'of',
    'for',
    'to',
    'whiteboard',
    'blackboard',
    'visual',
    'diagram',
    'chart',
    'வரை',
    'விளக்கு',
  ]);

  const cleaned = s
    .replace(/[_-]+/g, ' ')
    .replace(/[^\p{L}\p{N}\s+\-=/^%.]/gu, ' ');

  const tokens = cleaned
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t && !fillerWords.has(t));

  return tokens.join(' ');
}

export function scoreTopicMatch(
  rawQuery: string,
  candidateTitle: string,
  candidateQuery?: string
): number {
  const normQ = normalizeTopicQuery(rawQuery);
  const normTitle = normalizeTopicQuery(candidateTitle);
  const normCandQ = normalizeTopicQuery(candidateQuery || '');

  if (!normQ) return 0;

  if (normQ === normTitle || (normCandQ && normQ === normCandQ)) {
    return 1.0;
  }

  const candidates = [normTitle, normCandQ].filter(Boolean);
  for (const cand of candidates) {
    if (normQ.length >= 4 && cand.length >= 4) {
      if (cand.includes(normQ) || normQ.includes(cand)) {
        return 0.88;
      }
    }
  }

  const qTokens = normQ.split(/\s+/).filter((t) => t.length >= 2);
  if (qTokens.length === 0) return 0;

  const candTokenSet = new Set(
    candidates
      .join(' ')
      .split(/\s+/)
      .filter((t) => t.length >= 2)
  );
  if (candTokenSet.size === 0) return 0;

  let matched = 0;
  for (const qt of qTokens) {
    if (candTokenSet.has(qt)) {
      matched++;
    } else {
      // Partial prefix match for plurals/inflections
      for (const ct of candTokenSet) {
        if (qt.length >= 4 && ct.length >= 4 && (ct.startsWith(qt) || qt.startsWith(ct))) {
          matched += 0.85;
          break;
        }
      }
    }
  }

  return Math.min(0.86, matched / qTokens.length);
}

// ============================================================================
// 2. LOCAL + SQLITE + GOOGLE DRIVE SAVED VISUAL TOPICS VAULT
// ============================================================================

function loadLocalVisualTopics(): SavedVisualTopicRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_VISUAL_TOPICS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLocalVisualTopics(records: SavedVisualTopicRecord[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_VISUAL_TOPICS_KEY, JSON.stringify(records.slice(0, 60)));
  } catch {}
}

function mergeVisualTopicLists(lists: SavedVisualTopicRecord[][]): SavedVisualTopicRecord[] {
  const byKey = new Map<string, SavedVisualTopicRecord>();

  const sourcePriority: Record<SavedVisualTopicRecord['source'], number> = {
    google_drive: 3,
    sqlite: 2,
    local: 1,
  };

  for (const list of lists) {
    for (const rec of list) {
      if (!rec || !rec.scene || !Array.isArray(rec.scene.primitives)) continue;
      const normTitle = normalizeTopicQuery(rec.title || rec.query);
      const dedupeKey = `${rec.subjectId}:${normTitle || rec.id}`;
      const existing = byKey.get(dedupeKey);
      if (!existing) {
        byKey.set(dedupeKey, rec);
        continue;
      }
      const existingTime = Date.parse(existing.updatedAt || existing.savedAt || '') || 0;
      const incomingTime = Date.parse(rec.updatedAt || rec.savedAt || '') || 0;
      if (
        incomingTime > existingTime ||
        (incomingTime === existingTime && sourcePriority[rec.source] > sourcePriority[existing.source])
      ) {
        byKey.set(dedupeKey, {
          ...existing,
          ...rec,
          driveFileId: rec.driveFileId || existing.driveFileId,
          driveWebViewLink: rec.driveWebViewLink || existing.driveWebViewLink,
        });
      }
    }
  }

  return Array.from(byKey.values())
    .sort((a, b) => (b.updatedAt || b.savedAt || '').localeCompare(a.updatedAt || a.savedAt || ''))
    .slice(0, 60);
}

async function fetchVisualTopicsFromGoogleDrive(
  token: string
): Promise<{ records: SavedVisualTopicRecord[]; fileId?: string }> {
  if (!token) return { records: [] };

  const tokenPrefix = token.slice(0, 18);
  if (
    driveCache &&
    driveCache.tokenPrefix === tokenPrefix &&
    Date.now() - driveCache.fetchedAt < DRIVE_CACHE_TTL_MS
  ) {
    return { records: driveCache.records, fileId: driveCache.fileId };
  }

  try {
    const familyFolder = await getOrCreateGoogleDriveFolder(token, 'Family Circle');
    const visualFolder = await getOrCreateGoogleDriveFolder(
      token,
      DRIVE_VISUAL_FOLDER,
      familyFolder.id
    );

    const q = `'${visualFolder.id}' in parents and name = '${DRIVE_VISUAL_FILE_NAME}' and trashed = false`;
    const searchRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&supportsAllDrives=true&fields=files(id,name,webViewLink)&pageSize=1`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!searchRes.ok) return { records: [] };

    const searchData = await searchRes.json();
    const file = searchData?.files?.[0];
    if (!file?.id) {
      driveCache = { tokenPrefix, fetchedAt: Date.now(), records: [] };
      return { records: [] };
    }

    const dlRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media&supportsAllDrives=true`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!dlRes.ok) return { records: [], fileId: file.id };

    const parsed = await dlRes.json();
    const rawTopics = Array.isArray(parsed?.topics) ? parsed.topics : [];
    const records: SavedVisualTopicRecord[] = rawTopics
      .filter((t: any) => t && t.scene && Array.isArray(t.scene.primitives))
      .map((t: any) => ({
        ...t,
        source: 'google_drive' as const,
        driveFileId: file.id,
        driveWebViewLink: file.webViewLink || t.driveWebViewLink,
      }));

    driveCache = {
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

export async function loadSavedVisualTopicsFromSqliteAndDrive(opts?: {
  userEmail?: string;
  googleAccessToken?: string | null;
}): Promise<SavedVisualTopicRecord[]> {
  const localRecords = loadLocalVisualTopics();
  const effectiveEmail = getEffectiveUserEmail(opts?.userEmail);
  const token = getEffectiveGoogleToken(opts?.googleAccessToken);

  const [sqliteRecords, driveResult] = await Promise.all([
    (async (): Promise<SavedVisualTopicRecord[]> => {
      try {
        const qs = effectiveEmail ? `?userEmail=${encodeURIComponent(effectiveEmail)}` : '';
        const res = await fetch(getApiUrl(`/api/adaptive-learning/records${qs}`));
        if (!res.ok) return [];
        const data = await res.json();
        if (!data.success || !Array.isArray(data.records)) return [];
        return data.records
          .filter(
            (r: any) =>
              r.recordType === 'visual_topic' &&
              r.payload?.scene &&
              Array.isArray(r.payload.scene.primitives)
          )
          .map(
            (r: any): SavedVisualTopicRecord => ({
              id: r.id,
              query: String(r.payload?.query || r.title || ''),
              title: String(r.title || r.payload?.scene?.title || 'Visual Topic'),
              subjectId: (r.subjectId || r.payload?.subjectId || 'physics') as SubjectId,
              scene: r.payload.scene as WhiteboardVisualScene,
              source: 'sqlite',
              driveFileId: r.payload?.driveFileId,
              driveWebViewLink: r.payload?.driveWebViewLink,
              savedAt: String(r.payload?.savedAt || r.createdAt || new Date().toISOString()),
              updatedAt: String(r.updatedAt || r.createdAt || new Date().toISOString()),
            })
          );
      } catch {
        return [];
      }
    })(),
    token ? fetchVisualTopicsFromGoogleDrive(token) : Promise.resolve({ records: [] }),
  ]);

  const merged = mergeVisualTopicLists([driveResult.records, sqliteRecords, localRecords]);
  saveLocalVisualTopics(merged);
  return merged;
}

export async function saveVisualTopicToSqliteAndDrive(
  query: string,
  subject: SubjectDefinition,
  scene: WhiteboardVisualScene,
  opts?: {
    userEmail?: string;
    googleAccessToken?: string | null;
    syncDrive?: boolean;
  }
): Promise<SavedVisualTopicRecord> {
  const norm = normalizeTopicQuery(scene.title || query) || normalizeTopicQuery(query) || 'topic';
  const slug = norm
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 48) || Date.now().toString(36);
  const stableId = `visual-${subject.id}-${slug}`;
  const now = new Date().toISOString();
  const effectiveEmail = getEffectiveUserEmail(opts?.userEmail);
  const token = getEffectiveGoogleToken(opts?.googleAccessToken);

  const record: SavedVisualTopicRecord = {
    id: stableId,
    query: query.trim() || scene.title,
    title: scene.title || query.trim(),
    subjectId: subject.id,
    scene: {
      ...scene,
      visualSource: scene.visualSource || 'ai_model',
    },
    source: 'sqlite',
    savedAt: now,
    updatedAt: now,
  };

  // 1. Save immediately in LocalStorage
  const currentLocal = loadLocalVisualTopics();
  const updatedLocal = mergeVisualTopicLists([[record], currentLocal]);
  saveLocalVisualTopics(updatedLocal);
  driveCache = null;

  // 2. Persist in SQLite
  try {
    await fetch(getApiUrl('/api/adaptive-learning/records'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: record.id,
        userEmail: effectiveEmail,
        subjectId: subject.id,
        recordType: 'visual_topic',
        title: record.title,
        payload: {
          query: record.query,
          subjectId: subject.id,
          scene: record.scene,
          savedAt: record.savedAt,
        },
      }),
    });
  } catch {}

  // 3. Upsert Google Drive JSON Vault when signed in and syncDrive !== false
  if (opts?.syncDrive !== false && token) {
    try {
      const familyFolder = await getOrCreateGoogleDriveFolder(token, 'Family Circle');
      const visualFolder = await getOrCreateGoogleDriveFolder(
        token,
        DRIVE_VISUAL_FOLDER,
        familyFolder.id
      );

      const q = `'${visualFolder.id}' in parents and name = '${DRIVE_VISUAL_FILE_NAME}' and trashed = false`;
      const searchRes = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&supportsAllDrives=true&fields=files(id)&pageSize=1`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      let existingFileId: string | undefined;
      let existingDriveTopics: SavedVisualTopicRecord[] = [];
      if (searchRes.ok) {
        const sd = await searchRes.json();
        existingFileId = sd?.files?.[0]?.id;
        if (existingFileId) {
          const dl = await fetch(
            `https://www.googleapis.com/drive/v3/files/${existingFileId}?alt=media&supportsAllDrives=true`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (dl.ok) {
            const dlJson = await dl.json().catch(() => null);
            if (Array.isArray(dlJson?.topics)) {
              existingDriveTopics = dlJson.topics;
            }
          }
        }
      }

      const mergedForDrive = mergeVisualTopicLists([
        [{ ...record, source: 'google_drive' }],
        existingDriveTopics,
        updatedLocal,
      ]).slice(0, 50);

      const jsonPayload = JSON.stringify(
        {
          appName: 'Aura Family AI Assistant',
          updatedAt: now,
          topics: mergedForDrive,
        },
        null,
        2
      );

      const boundary = `-------AuraVisualVault${Date.now().toString(36)}`;
      const metadata: any = {
        name: DRIVE_VISUAL_FILE_NAME,
        mimeType: 'application/json',
      };
      if (!existingFileId) {
        metadata.parents = [visualFolder.id];
      }

      const multipartBody =
        `--${boundary}\r\n` +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(metadata) +
        `\r\n--${boundary}\r\n` +
        'Content-Type: application/json\r\n\r\n' +
        jsonPayload +
        `\r\n--${boundary}--`;

      const uploadUrl = existingFileId
        ? `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=multipart&supportsAllDrives=true&fields=id,webViewLink`
        : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,webViewLink';

      const uploadRes = await fetch(uploadUrl, {
        method: existingFileId ? 'PATCH' : 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: multipartBody,
      });

      if (uploadRes.ok) {
        const upData = await uploadRes.json();
        record.driveFileId = upData.id;
        record.driveWebViewLink =
          upData.webViewLink || `https://drive.google.com/file/d/${upData.id}/view`;
      }
    } catch (err) {
      console.warn('[VisualTopicVault] Non-blocking Drive sync warning:', err);
    }
  }

  return record;
}

// ============================================================================
// 3. CONTENT EXTRACTION & MATCHING FROM SAVED SQLITE / GOOGLE DRIVE DOCS
// ============================================================================

function parseEmbeddedVisualOrNoteContent(rawText: string): {
  scene?: WhiteboardVisualScene;
  noteContent?: string;
} {
  if (!rawText || typeof rawText !== 'string') return {};

  // Check for embedded AURA_VISUAL_SCENE_JSON HTML comment
  const markerStart = '<!-- AURA_VISUAL_SCENE_JSON:';
  const startIdx = rawText.indexOf(markerStart);
  if (startIdx !== -1) {
    const jsonStart = startIdx + markerStart.length;
    const endIdx = rawText.indexOf('-->', jsonStart);
    if (endIdx !== -1) {
      const jsonStr = rawText.slice(jsonStart, endIdx).trim();
      try {
        const parsed = JSON.parse(jsonStr);
        if (parsed && Array.isArray(parsed.primitives) && parsed.primitives.length > 0) {
          return { scene: parsed as WhiteboardVisualScene };
        }
      } catch {}
    }
  }

  // Check if entire file is raw JSON WhiteboardVisualScene
  const trimmed = rawText.trim();
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && Array.isArray(parsed.primitives) && parsed.primitives.length > 0) {
        return { scene: parsed as WhiteboardVisualScene };
      }
    } catch {}
  }

  // Strip YAML frontmatter (--- ... ---)
  let body = rawText.trim();
  if (body.startsWith('---')) {
    const secondFence = body.indexOf('---', 3);
    if (secondFence !== -1) {
      body = body.slice(secondFence + 3).trim();
    }
  }

  return { noteContent: body.slice(0, 2600) };
}

export async function findSavedVisualTopicInSqliteAndDrive(
  rawQuery: string,
  subject: SubjectDefinition,
  opts?: {
    userEmail?: string;
    googleAccessToken?: string | null;
  }
): Promise<{
  scene?: WhiteboardVisualScene;
  savedNoteContent?: string;
  matchedTitle: string;
  source: 'sqlite' | 'google_drive';
  driveWebViewLink?: string;
} | null> {
  const normQuery = normalizeTopicQuery(rawQuery);
  if (!normQuery) return null;

  const effectiveEmail = getEffectiveUserEmail(opts?.userEmail);
  const token = getEffectiveGoogleToken(opts?.googleAccessToken);

  // Priority 1 & 2: Structured Saved Visual Topics (SQLite + Local + Drive JSON vault)
  try {
    const vaultRecords = await loadSavedVisualTopicsFromSqliteAndDrive({
      userEmail: effectiveEmail,
      googleAccessToken: token,
    });

    let bestRec: SavedVisualTopicRecord | null = null;
    let bestScore = 0;

    for (const rec of vaultRecords) {
      let score = scoreTopicMatch(rawQuery, rec.title, rec.query);
      if (rec.subjectId === subject.id && score >= 0.6) {
        score = Math.min(1.05, score + 0.04);
      }
      if (score > bestScore) {
        bestScore = score;
        bestRec = rec;
      }
    }

    if (
      bestRec &&
      bestScore >= 0.6 &&
      bestRec.scene &&
      Array.isArray(bestRec.scene.primitives) &&
      bestRec.scene.primitives.length > 0
    ) {
      return {
        scene: bestRec.scene,
        matchedTitle: bestRec.title,
        source: bestRec.source === 'google_drive' ? 'google_drive' : 'sqlite',
        driveWebViewLink: bestRec.driveWebViewLink,
      };
    }
  } catch {}

  // Priority 3A: SQLite `google_drive_files` table mirror
  try {
    const qs = effectiveEmail ? `?userEmail=${encodeURIComponent(effectiveEmail)}` : '';
    const driveSqliteRes = await fetch(getApiUrl(`/api/google/drive${qs}`));
    if (driveSqliteRes.ok) {
      const data = await driveSqliteRes.json();
      const files: any[] = Array.isArray(data?.files) ? data.files : [];

      let bestFile: any = null;
      let bestScore = 0;

      for (const f of files) {
        const mime = String(f.mimeType || '').toLowerCase();
        const name = String(f.name || '');
        if (
          mime.startsWith('audio/') ||
          mime.startsWith('video/') ||
          mime.startsWith('image/') ||
          mime === 'application/pdf'
        ) {
          continue;
        }
        const cleanName = name.replace(/\.(md|txt|json)$/i, '').replace(/[_-]+/g, ' ');
        const score = Math.max(
          scoreTopicMatch(rawQuery, cleanName, String(f.category || '')),
          scoreTopicMatch(rawQuery, `${cleanName} ${f.folderName || ''}`)
        );
        if (score > bestScore) {
          bestScore = score;
          bestFile = f;
        }
      }

      if (bestFile && bestScore >= 0.6) {
        let decoded = '';
        if (bestFile.fileContentBase64) {
          decoded = decodeBase64Utf8(bestFile.fileContentBase64);
        } else if (token && bestFile.id && !String(bestFile.id).startsWith('local-')) {
          try {
            const dlRes = await fetch(
              `https://www.googleapis.com/drive/v3/files/${bestFile.id}?alt=media&supportsAllDrives=true`,
              { headers: { Authorization: `Bearer ${token}` } }
            );
            if (dlRes.ok) decoded = await dlRes.text();
          } catch {}
        }

        if (decoded.trim()) {
          const parsed = parseEmbeddedVisualOrNoteContent(decoded);
          const displayTitle = String(bestFile.name || normQuery)
            .replace(/\.(md|txt|json)$/i, '')
            .replace(/[_-]+/g, ' ');
          if (parsed.scene) {
            return {
              scene: parsed.scene,
              matchedTitle: parsed.scene.title || displayTitle,
              source: bestFile.fileContentBase64 ? 'sqlite' : 'google_drive',
              driveWebViewLink: bestFile.webViewLink,
            };
          }
          if (parsed.noteContent) {
            return {
              savedNoteContent: parsed.noteContent,
              matchedTitle: displayTitle,
              source: bestFile.fileContentBase64 ? 'sqlite' : 'google_drive',
              driveWebViewLink: bestFile.webViewLink,
            };
          }
        }
      }
    }
  } catch {}

  // Priority 3B: Live Google Drive Markdown / Text / JSON file search
  const primaryKeyword =
    normQuery
      .split(/\s+/)
      .sort((a, b) => b.length - a.length)[0] || '';

  if (token && primaryKeyword.length >= 3) {
    try {
      const safeKw = primaryKeyword.replace(/'/g, "\\'");
      const q = `name contains '${safeKw}' and trashed = false and (mimeType = 'text/markdown' or mimeType = 'text/plain' or mimeType = 'application/json')`;
      const searchRes = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
          q
        )}&supportsAllDrives=true&fields=files(id,name,mimeType,webViewLink)&pageSize=8`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        const driveFiles: any[] = Array.isArray(searchData?.files) ? searchData.files : [];

        let topFile: any = null;
        let topScore = 0;
        for (const f of driveFiles) {
          if (f.name === DRIVE_VISUAL_FILE_NAME) continue;
          const cleanName = String(f.name || '')
            .replace(/\.(md|txt|json)$/i, '')
            .replace(/[_-]+/g, ' ');
          const score = scoreTopicMatch(rawQuery, cleanName);
          if (score > topScore) {
            topScore = score;
            topFile = f;
          }
        }

        if (topFile && topScore >= 0.6) {
          const dlRes = await fetch(
            `https://www.googleapis.com/drive/v3/files/${topFile.id}?alt=media&supportsAllDrives=true`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (dlRes.ok) {
            const rawText = await dlRes.text();
            const parsed = parseEmbeddedVisualOrNoteContent(rawText);
            const displayTitle = String(topFile.name || normQuery)
              .replace(/\.(md|txt|json)$/i, '')
              .replace(/[_-]+/g, ' ');
            if (parsed.scene) {
              return {
                scene: parsed.scene,
                matchedTitle: parsed.scene.title || displayTitle,
                source: 'google_drive',
                driveWebViewLink: topFile.webViewLink,
              };
            }
            if (parsed.noteContent) {
              return {
                savedNoteContent: parsed.noteContent,
                matchedTitle: displayTitle,
                source: 'google_drive',
                driveWebViewLink: topFile.webViewLink,
              };
            }
          }
        }
      }
    } catch {}
  }

  return null;
}

// ============================================================================
// 4. OFFLINE RENDERER FOR SAVED SQLITE / GOOGLE DRIVE NOTES
// ============================================================================

export function buildSavedNoteVisualScene(
  matchedTitle: string,
  noteContent: string,
  source: 'sqlite' | 'google_drive',
  subject: SubjectDefinition
): WhiteboardVisualScene {
  const sourceBadge = source === 'google_drive' ? 'Loaded from Google Drive' : 'Loaded from SQLite Vault';

  const rawLines = noteContent
    .split(/\r?\n/)
    .map((l) =>
      l
        .replace(/^#+\s*/, '')
        .replace(/^[-*•]\s*/, '')
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/`([^`]+)`/g, '$1')
        .trim()
    )
    .filter((l) => l.length > 2 && !l.startsWith('Synchronized with Google Drive'));

  const formulaCandidate = rawLines.find(
    (l) => /key formula|formula|law|rule|equation|quote|=/i.test(l) && l.length <= 90
  );

  const keyPoints = rawLines
    .filter((l) => l !== formulaCandidate)
    .slice(0, 4);

  while (keyPoints.length < 3) {
    keyPoints.push(
      keyPoints.length === 0
        ? `Saved study notes for ${matchedTitle}`
        : `Review in ${subject.name} whiteboard workspace`
    );
  }

  const cardColors = ['#2563eb', '#059669', '#7c3aed', '#d97706'];
  const fillColors = [
    'rgba(37, 99, 235, 0.12)',
    'rgba(5, 150, 105, 0.12)',
    'rgba(124, 58, 237, 0.12)',
    'rgba(217, 119, 6, 0.12)',
  ];

  const primitives: WhiteboardPrimitive[] = [
    {
      type: 'text',
      x: 500,
      y: 120,
      text: `${matchedTitle} (${sourceBadge})`,
      fontSize: 21,
      bold: true,
      align: 'center',
      color: '#059669',
      boxed: true,
    },
  ];

  // Stack 3 or 4 sleek visual concept blocks with connecting flow arrows
  const cards = keyPoints.slice(0, 4);
  const startY = 195;
  const cardH = 128;
  const gap = 36;

  cards.forEach((line, idx) => {
    const y = startY + idx * (cardH + gap);
    const labelText = `${idx + 1}. ${line.length > 46 ? line.slice(0, 43) + '...' : line}`;
    primitives.push({
      type: 'rect',
      x: 120,
      y,
      width: 760,
      height: cardH,
      label: labelText,
      stroke: cardColors[idx % cardColors.length],
      fill: fillColors[idx % fillColors.length],
      rounded: 14,
    });
    if (idx < cards.length - 1) {
      primitives.push({
        type: 'line',
        x1: 500,
        y1: y + cardH + 2,
        x2: 500,
        y2: y + cardH + gap - 4,
        arrowEnd: true,
        stroke: cardColors[idx % cardColors.length],
        lineWidth: 3.5,
      });
    }
  });

  return {
    title: matchedTitle,
    subtitle: `${sourceBadge} • ${subject.name}`,
    formulaBox: formulaCandidate || `Saved Vault Anchor: ${matchedTitle}`,
    steps: keyPoints.map((kp, i) => `${i + 1}. ${kp}`),
    primitives,
    spokenSummary: `Loaded your saved ${matchedTitle} topic from ${
      source === 'google_drive' ? 'Google Drive' : 'SQLite vault'
    } onto the whiteboard.`,
    visualSource: source,
    modelUsed: source === 'google_drive' ? 'Google Drive Notes Renderer' : 'SQLite Vault Notes Renderer',
  };
}

