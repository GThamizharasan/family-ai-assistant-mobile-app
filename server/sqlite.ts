import initSqlJs, { Database } from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// SQLite Database file path
const DATA_DIR = path.resolve(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'aura_family_sync.sqlite');

export interface ActivationCodeRecord {
  code: string;
  createdAt: string;
  expiresAt: string;
  createdBy: string;
  roleGranted: 'primary' | 'secondary' | 'guest';
  status: 'active' | 'redeemed';
  redeemedBy?: string;
  updatedAt?: string;
}

export interface DevicePeerRecord {
  deviceId: string;
  familyId: string;
  deviceName: string;
  role: string;
  memberId?: string;
  lastSeen: number;
  batteryLevel?: number;
  location?: any;
  connectedAt: string;
}

export interface IntercomMessageRecord {
  id: string;
  familyId: string;
  fromDeviceId: string;
  fromMemberName: string;
  toDeviceId?: string;
  messageType: string;
  textContent: string;
  audioBase64?: string;
  timestamp: string;
}

export interface EmergencySosRecord {
  id: string;
  familyId: string;
  fromDeviceId: string;
  memberName: string;
  sosType: string;
  location?: any;
  status: string;
  timestamp: string;
  resolvedAt?: string;
}

export interface LocationPingRecord {
  id?: number;
  familyId: string;
  deviceId: string;
  memberName: string;
  lat: number;
  lng: number;
  address?: string;
  batteryLevel?: number;
  timestamp: string;
}

export interface SharedFamilyRecord {
  id: string;
  familyId: string;
  recordType: string;
  title: string;
  data: any;
  updatedByDevice: string;
  updatedAt: string;
}

export interface FamilyMemberRecord {
  id: string;
  familyId: string;
  name: string;
  relationship: string;
  role: 'primary' | 'secondary' | 'guest';
  email: string;
  phone?: string;
  avatar: string;
  isOnline: boolean;
  liveLocation: {
    lat: number;
    lng: number;
    address: string;
    timestamp: string;
    batteryLevel: number;
    status: string;
  };
  geofenceStatus: string;
  allowanceMonthly: number;
  monthlySpent: number;
  todayMood: string;
  emergencySosActive: boolean;
  activationCodeUsed?: string;
  bloodGroup?: string;
  medicalNotes?: string;
  emergencyContact?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InterInstanceCommunicationRecord {
  id: string;
  familyId: string;
  fromDeviceId: string;
  eventType: string;
  payload: any;
  timestamp: string;
}

export interface HubApiKeyRecord {
  keyName: string;
  keyValue: string;
  description: string;
  updatedAt: string;
}

export interface AssistantMemoryRecord {
  id: string;
  userEmail: string;
  familyId: string;
  topic: string;
  memoryContent: string;
  tags?: string[];
  source?: string;
  pinned?: boolean;
  timestamp: string;
}

export interface VoiceConversationRecord {
  id: string;
  userEmail: string;
  familyId: string;
  role: 'user' | 'assistant';
  content: string;
  emotion?: string;
  actionSuggestion?: string;
  timestamp: string;
}

export interface GoogleKeepNoteRecord {
  id: string;
  userEmail: string;
  title: string;
  body: string;
  labels: string[];
  color?: string;
  isPinned?: boolean;
  createTime: string;
  updateTime: string;
}

export interface DeviceStorageRecord {
  id: string;
  deviceId: string;
  userEmail?: string;
  totalStorageGb: number;
  usedStorageGb: number;
  freeStorageGb: number;
  percentUsed: number;
  deviceRamGb?: number;
  cpuCores?: number;
  batteryLevel?: number;
  isCharging?: boolean;
  platform?: string;
  breakdown: Record<string, number>;
  timestamp: string;
}

export interface GoogleDriveFileRecord {
  id: string;
  userEmail: string;
  name: string;
  mimeType: string;
  size: string;
  sizeBytes: number;
  webViewLink?: string;
  fileContentBase64?: string;
  uploadedBy?: string;
  modifiedTime: string;
  folderId?: string;
  folderName?: string;
  category?: string;
}

let db: Database | null = null;
let saveDebounceTimer: NodeJS.Timeout | null = null;
let isSaving = false;
let savePending = false;
let retryAttempts = 0;
const MAX_RETRY_ATTEMPTS = 5;

// Ensure disk storage directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Persist SQLite database to disk with atomic write, mutex protection, and file lock retry
export function saveSqliteToDisk() {
  if (!db) return;

  if (isSaving) {
    savePending = true;
    return;
  }

  isSaving = true;
  const tempPath = `${DB_PATH}.tmp.${process.pid}.${Date.now()}`;

  try {
    const data = db.export();
    const buffer = Buffer.from(data);

    // Write to a temporary file first so we don't hold/clobber the locked primary file directly
    fs.writeFileSync(tempPath, buffer);

    // Atomically replace destination file
    try {
      // In Node.js on Windows, renameSync overwrites existing destination when possible
      fs.renameSync(tempPath, DB_PATH);
    } catch (renameErr) {
      // Fallback: copyFileSync replaces destination, then remove temporary file
      fs.copyFileSync(tempPath, DB_PATH);
      try {
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      } catch { }
    }

    // Successfully saved
    retryAttempts = 0;
  } catch (err: any) {
    // Clean up temporary file if lingering
    try {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    } catch { }

    const isLockError =
      err?.code === 'UNKNOWN' ||
      err?.code === 'EBUSY' ||
      err?.code === 'EPERM' ||
      err?.code === 'EACCES' ||
      err?.errno === -4094;

    if (isLockError && retryAttempts < MAX_RETRY_ATTEMPTS) {
      retryAttempts++;
      const delay = Math.min(1000 * retryAttempts, 5000);
      console.warn(`[SQLite] Disk save delayed (file locked by system/OneDrive). Retrying in ${delay}ms (attempt ${retryAttempts}/${MAX_RETRY_ATTEMPTS})...`);
      if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
      saveDebounceTimer = setTimeout(() => {
        saveSqliteToDisk();
      }, delay);
    } else {
      console.error('Failed to save SQLite database to disk:', err?.message || err);
    }
  } finally {
    isSaving = false;
    if (savePending) {
      savePending = false;
      scheduleSave(500);
    }
  }
}

function scheduleSave(delayMs = 1000) {
  if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
  saveDebounceTimer = setTimeout(() => {
    saveSqliteToDisk();
  }, delayMs);
}

// Code normalization
export function normalizeFamilyCode(raw: string): string {
  return (raw || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

export function formatFamilyCode(raw: string): string {
  const norm = normalizeFamilyCode(raw);
  if (norm.length <= 4) return norm;
  if (norm.length <= 8) return `${norm.slice(0, 4)}-${norm.slice(4)}`;
  if (norm.length <= 12) return `${norm.slice(0, 4)}-${norm.slice(4, 8)}-${norm.slice(8)}`;
  return `${norm.slice(0, 4)}-${norm.slice(4, 8)}-${norm.slice(8, 12)}-${norm.slice(12, 16)}`;
}

// Initialize SQLite database with all tables for inter-instance communications
export async function initSqliteDb(): Promise<Database> {
  if (db) return db;

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    try {
      const fileBuffer = fs.readFileSync(DB_PATH);
      db = new SQL.Database(fileBuffer);
      console.log(`[SQLite] Loaded existing database from ${DB_PATH} (${fileBuffer.length} bytes)`);
    } catch (readErr) {
      console.warn('[SQLite] Could not read existing DB file, creating a fresh instance:', readErr);
      db = new SQL.Database();
    }
  } else {
    db = new SQL.Database();
    console.log(`[SQLite] Created fresh SQLite database instance`);
  }

  // Create schemas for inter-instance synchronization
  db.run(`
    CREATE TABLE IF NOT EXISTS activation_codes (
      code TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_by TEXT NOT NULL,
      role_granted TEXT NOT NULL,
      status TEXT NOT NULL,
      redeemed_by TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS device_peers (
      device_id TEXT PRIMARY KEY,
      family_id TEXT NOT NULL,
      device_name TEXT NOT NULL,
      role TEXT NOT NULL,
      member_id TEXT,
      last_seen INTEGER NOT NULL,
      battery_level INTEGER,
      location_json TEXT,
      connected_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS intercom_messages (
      id TEXT PRIMARY KEY,
      family_id TEXT NOT NULL,
      from_device_id TEXT NOT NULL,
      from_member_name TEXT NOT NULL,
      to_device_id TEXT,
      message_type TEXT NOT NULL,
      text_content TEXT,
      audio_base64 TEXT,
      timestamp TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS emergency_sos_events (
      id TEXT PRIMARY KEY,
      family_id TEXT NOT NULL,
      from_device_id TEXT NOT NULL,
      member_name TEXT NOT NULL,
      sos_type TEXT NOT NULL,
      location_json TEXT,
      status TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      resolved_at TEXT
    );

    CREATE TABLE IF NOT EXISTS live_location_pings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      family_id TEXT NOT NULL,
      device_id TEXT NOT NULL,
      member_name TEXT NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      address TEXT,
      battery_level INTEGER,
      timestamp TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS shared_family_records (
      id TEXT PRIMARY KEY,
      family_id TEXT NOT NULL,
      record_type TEXT NOT NULL,
      title TEXT NOT NULL,
      data_json TEXT NOT NULL,
      updated_by_device TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS family_members (
      id TEXT PRIMARY KEY,
      family_id TEXT NOT NULL,
      name TEXT NOT NULL,
      relationship TEXT NOT NULL,
      role TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      avatar TEXT,
      is_online INTEGER DEFAULT 1,
      live_location_json TEXT,
      geofence_status TEXT,
      allowance_monthly REAL DEFAULT 0,
      monthly_spent REAL DEFAULT 0,
      today_mood TEXT,
      emergency_sos_active INTEGER DEFAULT 0,
      activation_code_used TEXT,
      blood_group TEXT,
      medical_notes TEXT,
      emergency_contact TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS inter_instance_communications (
      id TEXT PRIMARY KEY,
      family_id TEXT NOT NULL,
      from_device_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      timestamp TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS hub_api_keys (
      key_name TEXT PRIMARY KEY,
      key_value TEXT NOT NULL,
      description TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS assistant_memory_store (
      id TEXT PRIMARY KEY,
      user_email TEXT NOT NULL,
      family_id TEXT NOT NULL,
      topic TEXT,
      memory_content TEXT NOT NULL,
      tags_json TEXT,
      source TEXT DEFAULT 'voice_assistant',
      pinned INTEGER DEFAULT 0,
      timestamp TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS voice_assistant_conversations (
      id TEXT PRIMARY KEY,
      user_email TEXT NOT NULL,
      family_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      emotion TEXT,
      actionSuggestion TEXT,
      timestamp TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS google_keep_notes (
      id TEXT PRIMARY KEY,
      user_email TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      labels_json TEXT,
      color TEXT DEFAULT 'default',
      is_pinned INTEGER DEFAULT 0,
      create_time TEXT NOT NULL,
      update_time TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS device_storage_metrics (
      id TEXT PRIMARY KEY,
      device_id TEXT NOT NULL,
      user_email TEXT,
      total_storage_gb REAL NOT NULL,
      used_storage_gb REAL NOT NULL,
      free_storage_gb REAL NOT NULL,
      percent_used REAL NOT NULL,
      device_ram_gb REAL,
      cpu_cores INTEGER,
      battery_level REAL,
      is_charging INTEGER,
      platform TEXT,
      breakdown_json TEXT,
      timestamp TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS google_drive_files (
      id TEXT PRIMARY KEY,
      user_email TEXT NOT NULL,
      name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size TEXT NOT NULL,
      size_bytes INTEGER DEFAULT 0,
      web_view_link TEXT,
      file_content_base64 TEXT,
      folder_id TEXT,
      folder_name TEXT,
      category TEXT,
      uploaded_by TEXT DEFAULT 'voice_assistant',
      modified_time TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ai_studio_creations (
      id TEXT PRIMARY KEY,
      user_email TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      prompt TEXT NOT NULL,
      media_url TEXT NOT NULL,
      thumbnail_url TEXT,
      model_used TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      drive_file_id TEXT,
      drive_web_view_link TEXT,
      drive_folder_path TEXT,
      drive_sync_status TEXT DEFAULT 'synced',
      created_at TEXT NOT NULL,
      metadata_json TEXT
    );

    CREATE TABLE IF NOT EXISTS musical_library_tracks (
      id TEXT PRIMARY KEY,
      user_email TEXT NOT NULL,
      title TEXT NOT NULL,
      artist TEXT NOT NULL,
      album TEXT,
      genre TEXT NOT NULL,
      audio_url TEXT NOT NULL,
      artwork_url TEXT,
      duration_seconds INTEGER DEFAULT 180,
      lyrics TEXT,
      drive_file_id TEXT,
      drive_web_view_link TEXT,
      drive_folder_path TEXT,
      is_favorite INTEGER DEFAULT 0,
      play_count INTEGER DEFAULT 0,
      last_played_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS voice_recordings (
      id TEXT PRIMARY KEY,
      user_email TEXT NOT NULL,
      title TEXT NOT NULL,
      category TEXT DEFAULT 'Personal Memo',
      audio_url TEXT,
      audio_content_base64 TEXT,
      audio_mime_type TEXT DEFAULT 'audio/webm',
      duration_seconds REAL DEFAULT 0,
      file_size_bytes INTEGER DEFAULT 0,
      drive_file_id TEXT,
      drive_web_view_link TEXT,
      drive_folder_path TEXT DEFAULT 'Family Circle/Voice Recordings',
      transcription TEXT,
      transcription_summary TEXT,
      detected_language TEXT DEFAULT 'en-US',
      is_favorite INTEGER DEFAULT 0,
      play_count INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tts_memos (
      id TEXT PRIMARY KEY,
      user_email TEXT NOT NULL,
      title TEXT NOT NULL,
      text_prompt TEXT NOT NULL,
      voice_type TEXT NOT NULL,
      voice_name TEXT NOT NULL,
      audio_url TEXT,
      audio_content_base64 TEXT,
      audio_mime_type TEXT DEFAULT 'audio/wav',
      duration_seconds REAL DEFAULT 0,
      file_size_bytes INTEGER DEFAULT 0,
      drive_file_id TEXT,
      drive_web_view_link TEXT,
      drive_folder_path TEXT DEFAULT 'Family Circle/Text to Speech Memos',
      is_favorite INTEGER DEFAULT 0,
      play_count INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS language_translations (
      id TEXT PRIMARY KEY,
      user_email TEXT NOT NULL,
      source_text TEXT NOT NULL,
      translated_text TEXT NOT NULL,
      source_lang TEXT NOT NULL,
      target_lang TEXT NOT NULL,
      phonetics TEXT,
      audio_content_base64 TEXT,
      audio_mime_type TEXT DEFAULT 'audio/wav',
      drive_file_id TEXT,
      drive_web_view_link TEXT,
      drive_folder_path TEXT DEFAULT 'Family Circle/Language Translations',
      notes TEXT,
      is_favorite INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS apple_books_library (
      id TEXT PRIMARY KEY,
      user_email TEXT NOT NULL,
      title TEXT NOT NULL,
      author TEXT NOT NULL,
      genre TEXT NOT NULL,
      subtitle TEXT,
      description TEXT,
      cover_gradient TEXT,
      accent_color TEXT,
      rating REAL DEFAULT 5,
      review_count INTEGER DEFAULT 1,
      total_pages INTEGER DEFAULT 1,
      current_page INTEGER DEFAULT 1,
      current_chapter_id TEXT,
      progress_percent INTEGER DEFAULT 0,
      is_pdf INTEGER DEFAULT 0,
      pdf_file_name TEXT,
      pdf_file_size TEXT,
      pdf_url TEXT,
      pdf_content_base64 TEXT,
      drive_file_id TEXT,
      drive_web_view_link TEXT,
      drive_folder_path TEXT DEFAULT 'Family Circle/Apple Books',
      chapters_json TEXT,
      bookmarks_json TEXT,
      highlights_json TEXT,
      is_local_cached INTEGER DEFAULT 1,
      added_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // Run safe schema migrations for existing SQLite database
  try { db.run('ALTER TABLE voice_recordings ADD COLUMN transcription_summary TEXT;'); } catch { }
  try { db.run('ALTER TABLE voice_recordings ADD COLUMN detected_language TEXT DEFAULT "en-US";'); } catch { }
  try { db.run('ALTER TABLE google_drive_files ADD COLUMN folder_id TEXT;'); } catch { }
  try { db.run('ALTER TABLE google_drive_files ADD COLUMN folder_name TEXT;'); } catch { }
  try { db.run('ALTER TABLE google_drive_files ADD COLUMN category TEXT;'); } catch { }
  try { db.run('ALTER TABLE voice_assistant_conversations ADD COLUMN action_suggestion TEXT;'); } catch { }
  try { db.run('ALTER TABLE musical_library_tracks ADD COLUMN lyrics TEXT;'); } catch { }
  try { db.run('ALTER TABLE musical_library_tracks ADD COLUMN audio_content_base64 TEXT;'); } catch { }
  try { db.run('ALTER TABLE musical_library_tracks ADD COLUMN audio_mime_type TEXT DEFAULT "audio/mpeg";'); } catch { }
  try { db.run('ALTER TABLE ai_studio_creations ADD COLUMN drive_sync_status TEXT DEFAULT "synced";'); } catch { }
  try {
    db.run("UPDATE musical_library_tracks SET drive_folder_path = REPLACE(drive_folder_path, 'Musical Library', 'Apple Music') WHERE drive_folder_path LIKE '%Musical Library%';");
  } catch { }
  try {
    db.run("UPDATE google_drive_files SET folder_name = REPLACE(folder_name, 'Musical Library', 'Apple Music') WHERE folder_name LIKE '%Musical Library%';");
  } catch { }
  try { db.run('ALTER TABLE apple_books_library ADD COLUMN pdf_content_base64 TEXT;'); } catch { }
  try { db.run('ALTER TABLE apple_books_library ADD COLUMN is_local_cached INTEGER DEFAULT 1;'); } catch { }

  // Seed default Google Keep notes if empty
  try {
    const keepRes = db.exec('SELECT COUNT(*) as count FROM google_keep_notes');
    const keepCount = (keepRes[0]?.values[0]?.[0] as number) || 0;
    if (keepCount === 0) {
      const defaultUser = 'chinna.tamil2000@gmail.com';
      const nowIso = new Date().toISOString();
      const seedNotes = [
        {
          id: 'keep-001',
          userEmail: defaultUser,
          title: 'Weekly Family Groceries & Organic Essentials',
          body: '- Pure A2 Gir Cow Milk (daily 6:30 AM delivery)\n- Cold-pressed organic sesame & groundnut oil\n- Farm-fresh country eggs & organic spinach\n- California almonds & walnuts (overnight soak)\n- Fresh ginger, garlic, coriander & curry leaves',
          labels: ['groceries', 'home', 'health'],
          color: 'green',
          isPinned: 1,
        },
        {
          id: 'keep-002',
          userEmail: defaultUser,
          title: 'Digital Tamil World & AI Moat Roadmap',
          body: '- Gemini 3.8 Live bidirectional audio WebSocket streaming\n- Sovereign server-side SQLite multi-instance synchronizer\n- Real-time Google Keep & phone internal storage context\n- Tamil voice synthesis tuning with natural phonetics',
          labels: ['work', 'ai', 'roadmap'],
          color: 'blue',
          isPinned: 1,
        },
        {
          id: 'keep-003',
          userEmail: defaultUser,
          title: 'Home Security & Device Access PINs',
          body: '- Driveway main gate motorized PIN: 4920\n- High-speed fiber Wi-Fi: AuraEnterprise-5G (pass: SovereignFamily2026)\n- Security system night arm schedule: 11:00 PM',
          labels: ['security', 'home'],
          color: 'amber',
          isPinned: 0,
        },
      ];
      for (const n of seedNotes) {
        db.run(
          `INSERT INTO google_keep_notes (id, user_email, title, body, labels_json, color, is_pinned, create_time, update_time)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [n.id, n.userEmail, n.title, n.body, JSON.stringify(n.labels), n.color, n.isPinned, nowIso, nowIso]
        );
      }
    }
  } catch (err) {
    console.warn('Seed Google Keep notes warning:', err);
  }

  // Seed default Google Drive files if empty
  try {
    const driveRes = db.exec('SELECT COUNT(*) as count FROM google_drive_files');
    const driveCount = (driveRes[0]?.values[0]?.[0] as number) || 0;
    if (driveCount === 0) {
      const defaultUser = 'chinna.tamil2000@gmail.com';
      const nowIso = new Date().toISOString();
      const seedDriveFiles = [
        {
          id: 'gdf-001',
          name: 'Family_Trust_Estate_Charter_2026.pdf',
          mimeType: 'application/pdf',
          size: '2.4 MB',
          sizeBytes: 2516582,
          webViewLink: 'https://drive.google.com',
          uploadedBy: 'system',
        },
        {
          id: 'gdf-002',
          name: 'Billionaire_Holding_Co_Cap_Table_v4.xlsx',
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          size: '1.1 MB',
          sizeBytes: 1153433,
          webViewLink: 'https://drive.google.com',
          uploadedBy: 'system',
        },
        {
          id: 'gdf-003',
          name: 'AI_Operating_System_Patents_Draft.docx',
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          size: '850 KB',
          sizeBytes: 870400,
          webViewLink: 'https://drive.google.com',
          uploadedBy: 'system',
        },
        {
          id: 'gdf-004',
          name: 'Family_Wellness_Longevity_Protocol_Q4.pdf',
          mimeType: 'application/pdf',
          size: '1.8 MB',
          sizeBytes: 1887436,
          webViewLink: 'https://drive.google.com',
          uploadedBy: 'system',
        },
      ];
      for (const f of seedDriveFiles) {
        db.run(
          `INSERT INTO google_drive_files (id, user_email, name, mime_type, size, size_bytes, web_view_link, uploaded_by, modified_time)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [f.id, defaultUser, f.name, f.mimeType, f.size, f.sizeBytes, f.webViewLink, f.uploadedBy, nowIso]
        );
      }
    }
  } catch (err) {
    console.warn('Seed Google Drive files warning:', err);
  }

  // Seed default activation codes if empty
  const countRes = db.exec('SELECT COUNT(*) as count FROM activation_codes');
  const count = countRes[0]?.values[0]?.[0] as number;
  if (!count || count === 0) {
    const seedCodes = [
      {
        code: '9021-4873-1129-8834',
        createdAt: '2026-10-10',
        expiresAt: '2026-12-31',
        createdBy: 'digitaltamilworld@gmail.com',
        roleGranted: 'secondary',
        status: 'active',
      },
      {
        code: '8492-7104-9932-1845',
        createdAt: '2026-10-01',
        expiresAt: '2026-12-31',
        createdBy: 'digitaltamilworld@gmail.com',
        roleGranted: 'secondary',
        status: 'active',
      },
      {
        code: '4190-2856-7719-3320',
        createdAt: '2026-10-05',
        expiresAt: '2026-12-31',
        createdBy: 'digitaltamilworld@gmail.com',
        roleGranted: 'secondary',
        status: 'active',
      },
      {
        code: '7721-3498-5012-9943',
        createdAt: new Date().toISOString().split('T')[0],
        expiresAt: '2026-12-31',
        createdBy: 'digitaltamilworld@gmail.com',
        roleGranted: 'secondary',
        status: 'active',
      },
    ];

    for (const c of seedCodes) {
      db.run(
        `INSERT INTO activation_codes (code, created_at, expires_at, created_by, role_granted, status, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [c.code, c.createdAt, c.expiresAt, c.createdBy, c.roleGranted, c.status, new Date().toISOString()]
      );
    }
  }

  // Seed and synchronize canonical family members with user-specified personal details
  const canonicalSeed = [
    {
      id: 'fam-01',
      family_id: 'family-aura-primary',
      name: 'Thamizh (Primary)',
      relationship: 'Self (Head)',
      role: 'primary',
      email: 'chinna.tamil2000@gmail.com',
      phone: '+44 7721877710',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      is_online: 1,
      live_location_json: JSON.stringify({
        lat: 51.58931,
        lng: 0.05054,
        address: 'Live GPS Device Position (±215m)',
        timestamp: 'Just now',
        batteryLevel: 87,
        status: 'Safe at Home',
      }),
      geofence_status: 'home',
      allowance_monthly: 4500,
      monthly_spent: 8400,
      today_mood: 'Laser Focused & Energized ⚡',
      emergency_sos_active: 0,
      activation_code_used: 'AURA-HEAD-0001',
      blood_group: 'O+',
      medical_notes: 'Allergies: None. Routine wellness check: Optimal.',
      emergency_contact: '+91 98408 05665',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'fam-02',
      family_id: 'family-aura-primary',
      name: 'Selvapriya (Spouse)',
      relationship: 'Spouse',
      role: 'secondary',
      email: 'selvapriya2005@gmail.com',
      phone: '+44 7721977705',
      avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
      is_online: 1,
      live_location_json: JSON.stringify({
        lat: 13.04187,
        lng: 80.23383,
        address: 'Wellness & Design Center, T. Nagar, Chennai',
        timestamp: '2 mins ago',
        batteryLevel: 73,
        status: 'Safe at Home',
      }),
      geofence_status: 'home',
      allowance_monthly: 4500,
      monthly_spent: 6200,
      today_mood: 'Calm & Creative ✨',
      emergency_sos_active: 0,
      activation_code_used: '8492-7104-9932-1845',
      blood_group: 'B+',
      medical_notes: 'Daily routine vitamins.',
      emergency_contact: '+44 7721877710',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'fam-03',
      family_id: 'family-aura-primary',
      name: 'Maaran (Son)',
      relationship: 'Younger Son',
      role: 'secondary',
      email: 'thamizharasangurusamy@gmail.com',
      phone: '+44 7721 877687',
      avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80',
      is_online: 1,
      live_location_json: JSON.stringify({
        lat: 13.01185,
        lng: 80.23391,
        address: 'Robotics & STEM Lab, IIT Madras',
        timestamp: '5 mins ago',
        batteryLevel: 63,
        status: 'Safe at Home',
      }),
      geofence_status: 'home',
      allowance_monthly: 0,
      monthly_spent: 1850,
      today_mood: 'Curious & Inquisitive 🔬',
      emergency_sos_active: 0,
      activation_code_used: '4190-2856-7719-3320',
      blood_group: 'A+',
      medical_notes: 'Youth sports clearance verified.',
      emergency_contact: '+44 7721877710',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'fam-04',
      family_id: 'family-aura-primary',
      name: 'Kavinmozhi',
      relationship: 'Daughter',
      role: 'secondary',
      email: 'kavinmozhiselvapriya@gmail.com',
      phone: '+44 7721877692',
      avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
      is_online: 1,
      live_location_json: JSON.stringify({
        lat: 13.08304,
        lng: 80.27077,
        address: 'Innovation Campus, Anna Nagar, Chennai',
        timestamp: 'Just now',
        batteryLevel: 93,
        status: 'Safe at Home',
      }),
      geofence_status: 'home',
      allowance_monthly: 0,
      monthly_spent: 0,
      today_mood: 'Happy & Energized 🌟',
      emergency_sos_active: 0,
      activation_code_used: '9021-4873-1129-8834',
      blood_group: 'O+',
      medical_notes: 'Routine pediatric wellness verified.',
      emergency_contact: '+44 7721877710',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  for (const m of canonicalSeed) {
    db.run(
      `INSERT INTO family_members (id, family_id, name, relationship, role, email, phone, avatar, is_online, live_location_json, geofence_status, allowance_monthly, monthly_spent, today_mood, emergency_sos_active, activation_code_used, blood_group, medical_notes, emergency_contact, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name=excluded.name,
         relationship=excluded.relationship,
         role=excluded.role,
         email=excluded.email,
         phone=excluded.phone,
         avatar=excluded.avatar,
         is_online=excluded.is_online,
         live_location_json=excluded.live_location_json,
         geofence_status=excluded.geofence_status,
         allowance_monthly=excluded.allowance_monthly,
         monthly_spent=excluded.monthly_spent,
         today_mood=excluded.today_mood,
         emergency_sos_active=excluded.emergency_sos_active,
         blood_group=excluded.blood_group,
         medical_notes=excluded.medical_notes,
         emergency_contact=excluded.emergency_contact,
         updated_at=excluded.updated_at`,
      [
        m.id,
        m.family_id,
        m.name,
        m.relationship,
        m.role,
        m.email,
        m.phone,
        m.avatar,
        m.is_online,
        m.live_location_json,
        m.geofence_status,
        m.allowance_monthly,
        m.monthly_spent,
        m.today_mood,
        m.emergency_sos_active,
        m.activation_code_used,
        m.blood_group,
        m.medical_notes,
        m.emergency_contact,
        m.created_at,
        m.updated_at,
      ]
    );
  }

  // Seed initial Hub API keys from environment if present
  const defaultKeys = [
    {
      name: 'GEMINI_API_KEY',
      value: process.env.GEMINI_API_KEY || '',
      desc: 'Google Gemini 3.8 Multi-modal & Voice Live API Key',
    },
    {
      name: 'GOOGLE_MAPS_API_KEY',
      value: process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyB2zaNA_vbSdD78UFydYrxswRHhTlOPmbI',
      desc: 'Google Maps Platform Geocoding & GPS Navigation Key',
    },
    {
      name: 'GOOGLE_CLIENT_ID',
      value: process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || '600050762948-bqe3traltdnne31fmu99p1hn9n1ubgb8.apps.googleusercontent.com',
      desc: 'Google Identity Services OAuth 2.0 Web Client ID (@react-oauth/google)',
    },
    {
      name: 'WHATSAPP_API_TOKEN',
      value: process.env.WHATSAPP_API_TOKEN || '',
      desc: 'Meta WhatsApp Business Cloud API Access Token',
    },
    {
      name: 'WHATSAPP_PHONE_ID',
      value: process.env.WHATSAPP_PHONE_ID || '104859203958172',
      desc: 'Meta WhatsApp Business Sender Phone Number ID',
    },
    {
      name: 'GOOGLE_CLOUD_PROJECT_ID',
      value: process.env.GOOGLE_CLOUD_PROJECT_ID || 'gen-lang-client-094624825225',
      desc: 'Google Cloud Platform Project ID for Live Billing Guardrails',
    },
  ];

  for (const k of defaultKeys) {
    db.run(
      `INSERT OR IGNORE INTO hub_api_keys (key_name, key_value, description, updated_at)
       VALUES (?, ?, ?, ?)`,
      [k.name, k.value, k.desc, new Date().toISOString()]
    );
  }

  // Seed initial Musical Library Tracks if empty
  try {
    const musicCheck = db.exec('SELECT COUNT(*) FROM musical_library_tracks');
    const musicCount = musicCheck.length && musicCheck[0].values.length ? (musicCheck[0].values[0][0] as number) : 0;
    if (musicCount === 0) {
      const defaultUser = 'chinna.tamil2000@gmail.com';
      const nowIso = new Date().toISOString();
      const seedTracks = [
        {
          id: 'track-001',
          userEmail: defaultUser,
          title: 'Family Circle Symphony',
          artist: 'Aura Orchestral & Thamizh Family',
          album: 'Sovereign Family Legacy',
          genre: 'Classical & Wellness',
          audioUrl: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112191.mp3',
          artworkUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80',
          durationSeconds: 210,
          lyrics: 'Harmonies of lifelong love, generational wisdom, and steady guidance...',
          driveFileId: 'gdf-music-001',
          driveWebViewLink: 'https://drive.google.com',
          driveFolderPath: 'Family Circle / Apple Music / Classical & Wellness',
          isFavorite: 1,
          playCount: 14,
        },
        {
          id: 'track-002',
          userEmail: defaultUser,
          title: 'Aura Ambient Focus Flow',
          artist: 'AI Studio Sound Lab',
          album: 'Executive Mindset Sessions',
          genre: 'Ambient & Study',
          audioUrl: 'https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0a13f69d2.mp3?filename=chill-abstract-intention-12099.mp3',
          artworkUrl: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=600&auto=format&fit=crop&q=80',
          durationSeconds: 180,
          lyrics: 'Deep focus, crystal clarity, visionary architecture, effortless momentum...',
          driveFileId: 'gdf-music-002',
          driveWebViewLink: 'https://drive.google.com',
          driveFolderPath: 'Family Circle / Apple Music / Ambient & Study',
          isFavorite: 1,
          playCount: 28,
        },
        {
          id: 'track-003',
          userEmail: defaultUser,
          title: 'Midnight Lullaby for Maaran & Kavinmozhi',
          artist: 'Selvapriya & Thamizh',
          album: 'Family Bedtime Peace',
          genre: 'Family Lullaby',
          audioUrl: 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_c8c8a73467.mp3?filename=sweet-lullaby-piano-version-10906.mp3',
          artworkUrl: 'https://images.unsplash.com/photo-1532767153582-b1a0e5145009?w=600&auto=format&fit=crop&q=80',
          durationSeconds: 240,
          lyrics: 'Sleep peacefully under starlight, dreaming of infinite worlds and boundless courage...',
          driveFileId: 'gdf-music-003',
          driveWebViewLink: 'https://drive.google.com',
          driveFolderPath: 'Family Circle / Apple Music / Family Lullaby',
          isFavorite: 1,
          playCount: 42,
        },
        {
          id: 'track-004',
          userEmail: defaultUser,
          title: 'Tamil Heritage Veena & Flute Melodies',
          artist: 'Tamil Isai Classical Ensemble',
          album: 'Roots & Heritage Vol. 1',
          genre: 'Tamil Melodies & Tradition',
          audioUrl: 'https://cdn.pixabay.com/download/audio/2021/09/06/audio_73e721a329.mp3?filename=indian-meditation-flute-7848.mp3',
          artworkUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80',
          durationSeconds: 225,
          lyrics: 'மகிழ்ச்சியும் அமைதியும் நிறைந்த பண்பாட்டு நல்லிசை...',
          driveFileId: 'gdf-music-004',
          driveWebViewLink: 'https://drive.google.com',
          driveFolderPath: 'Family Circle / Apple Music / Tamil Melodies & Tradition',
          isFavorite: 1,
          playCount: 19,
        },
        {
          id: 'track-005',
          userEmail: defaultUser,
          title: 'Billionaire Empire Motivation',
          artist: 'Aura Cinematic Soundscapes',
          album: 'High Stakes Sovereign Vision',
          genre: 'Cinematic',
          audioUrl: 'https://cdn.pixabay.com/download/audio/2022/03/10/audio_c3501258ef.mp3?filename=cinematic-epic-emotional-112423.mp3',
          artworkUrl: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600&auto=format&fit=crop&q=80',
          durationSeconds: 195,
          lyrics: 'Rise with purpose, build lasting institutions, empower generations...',
          driveFileId: 'gdf-music-005',
          driveWebViewLink: 'https://drive.google.com',
          driveFolderPath: 'Family Circle / Apple Music / Cinematic',
          isFavorite: 0,
          playCount: 9,
        },
        {
          id: 'track-006',
          userEmail: defaultUser,
          title: 'AI Studio Lyria Demo: Golden Sunset Groove',
          artist: 'Google Lyria AI Music Engine',
          album: 'AI Studio Synthetics',
          genre: 'AI Studio Lyria',
          audioUrl: 'https://cdn.pixabay.com/download/audio/2022/05/16/audio_db6591201e.mp3?filename=tropical-summer-music-111658.mp3',
          artworkUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&auto=format&fit=crop&q=80',
          durationSeconds: 165,
          lyrics: 'Warm breeze along the coast, sun dipping beneath the golden horizon...',
          driveFileId: 'gdf-music-006',
          driveWebViewLink: 'https://drive.google.com',
          driveFolderPath: 'Family Circle / Apple Music / AI Studio Lyria',
          isFavorite: 1,
          playCount: 31,
        },
      ];

      for (const t of seedTracks) {
        db.run(
          `INSERT INTO musical_library_tracks (id, user_email, title, artist, album, genre, audio_url, artwork_url, duration_seconds, lyrics, drive_file_id, drive_web_view_link, drive_folder_path, is_favorite, play_count, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [t.id, t.userEmail, t.title, t.artist, t.album, t.genre, t.audioUrl, t.artworkUrl, t.durationSeconds, t.lyrics, t.driveFileId, t.driveWebViewLink, t.driveFolderPath, t.isFavorite, t.playCount, nowIso, nowIso]
        );
      }
    }
  } catch (mErr) {
    console.warn('Seed musical tracks notice:', mErr);
  }

  // Ensure all musical library tracks have offline audio available in SQLite
  try {
    const unpopulatedTracks = db.exec('SELECT id, genre FROM musical_library_tracks WHERE audio_content_base64 IS NULL OR length(audio_content_base64) < 50');
    if (unpopulatedTracks.length && unpopulatedTracks[0].values.length) {
      for (const row of unpopulatedTracks[0].values) {
        const tId = row[0] as string;
        const tGenre = (row[1] as string) || 'Ambient';
        const wavBuf = generateHarmonicWavBuffer(tGenre, 30);
        db.run(
          `UPDATE musical_library_tracks
           SET audio_content_base64 = ?,
               audio_mime_type = 'audio/wav',
               audio_url = '/api/music/library/' || id || '/audio',
               updated_at = ?
           WHERE id = ?`,
          [wavBuf.toString('base64'), new Date().toISOString(), tId]
        );
      }
      scheduleSave();
      console.log(`[SQLite] Seeded harmonic offline audio into ${unpopulatedTracks[0].values.length} tracks.`);
    }
  } catch (popErr) {
    console.warn('Populate track audio warning:', popErr);
  }

  // Seed initial AI Studio Creations if empty
  try {
    const aicCheck = db.exec('SELECT COUNT(*) FROM ai_studio_creations');
    const aicCount = aicCheck.length && aicCheck[0].values.length ? (aicCheck[0].values[0][0] as number) : 0;
    if (aicCount === 0) {
      const defaultUser = 'chinna.tamil2000@gmail.com';
      const seedCreations = [
        {
          id: 'aic-seed-001',
          userEmail: defaultUser,
          type: 'image',
          title: 'Global Family Office & Eco-Sanctuary',
          prompt: 'Hyper-realistic cinematic render of a futuristic family sanctuary villa with solar glass and tropical garden pavilion at twilight',
          mediaUrl: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&auto=format&fit=crop&q=80',
          thumbnailUrl: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400&auto=format&fit=crop&q=80',
          modelUsed: 'imagen-3.0-generate-002',
          mimeType: 'image/jpeg',
          driveFileId: 'gdf-aic-001',
          driveWebViewLink: 'https://drive.google.com',
          driveFolderPath: 'Family Circle / AI Studio Creations / Images',
          driveSyncStatus: 'synced',
          createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
        },
        {
          id: 'aic-seed-002',
          userEmail: defaultUser,
          type: 'video',
          title: 'Veo 3 Drone Sweep: Green Autonomous Tech Campus',
          prompt: 'Cinematic 4K drone flythrough across an advanced technological campus with solar canopies and lush foliage at sunrise, 60fps',
          mediaUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
          thumbnailUrl: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600&auto=format&fit=crop&q=80',
          modelUsed: 'veo-3.0-generate-001',
          mimeType: 'video/mp4',
          driveFileId: 'gdf-aic-002',
          driveWebViewLink: 'https://drive.google.com',
          driveFolderPath: 'Family Circle / AI Studio Creations / Videos',
          driveSyncStatus: 'synced',
          createdAt: new Date(Date.now() - 3600000 * 8).toISOString(),
        },
        {
          id: 'aic-seed-003',
          userEmail: defaultUser,
          type: 'music',
          title: 'Lyria AI: Sovereign Family Circle Anthem',
          prompt: 'Warm uplifting acoustic melody with gentle cello and ambient pads celebrating family harmony and lifelong vision',
          mediaUrl: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112191.mp3',
          thumbnailUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80',
          modelUsed: 'lyria-v2',
          mimeType: 'audio/mpeg',
          driveFileId: 'gdf-aic-003',
          driveWebViewLink: 'https://drive.google.com',
          driveFolderPath: 'Family Circle / AI Studio Creations / Music',
          driveSyncStatus: 'synced',
          createdAt: new Date(Date.now() - 3600000 * 16).toISOString(),
        },
        {
          id: 'aic-seed-004',
          userEmail: defaultUser,
          type: 'transcript',
          title: 'Executive Strategy & Family Governance Charter',
          prompt: 'High accuracy speech-to-text with speaker diarization and key action items',
          mediaUrl: 'Family Governance Charter Q4: 1. Maintain Family Circle Drive as unified single source of truth. 2. Real-time GPS safety check-ins synchronized every 25s. 3. Monthly capital allocation for venture and wellness protocols.',
          thumbnailUrl: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?w=600&auto=format&fit=crop&q=80',
          modelUsed: 'gemini-3.8-flash',
          mimeType: 'text/plain',
          driveFileId: 'gdf-aic-004',
          driveWebViewLink: 'https://drive.google.com',
          driveFolderPath: 'Family Circle / AI Studio Creations / Transcripts',
          driveSyncStatus: 'synced',
          createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
        },
      ];

      for (const c of seedCreations) {
        db.run(
          `INSERT INTO ai_studio_creations (id, user_email, type, title, prompt, media_url, thumbnail_url, model_used, mime_type, drive_file_id, drive_web_view_link, drive_folder_path, drive_sync_status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [c.id, c.userEmail, c.type, c.title, c.prompt, c.mediaUrl, c.thumbnailUrl, c.modelUsed, c.mimeType, c.driveFileId, c.driveWebViewLink, c.driveFolderPath, c.driveSyncStatus, c.createdAt]
        );
      }
    }
  } catch (cErr) {
    console.warn('Seed AI creations notice:', cErr);
  }

  saveSqliteToDisk();
  console.log('[SQLite] Database initialized and synchronized to disk at:', DB_PATH);
  return db;
}

// -------------------------------------------------------------
// Activation Codes in SQLite
// -------------------------------------------------------------
export function getActivationCodesFromSqlite(): ActivationCodeRecord[] {
  if (!db) return [];
  const res = db.exec('SELECT code, created_at, expires_at, created_by, role_granted, status, redeemed_by, updated_at FROM activation_codes ORDER BY created_at DESC');
  if (!res.length) return [];
  return res[0].values.map((row) => ({
    code: row[0] as string,
    createdAt: row[1] as string,
    expiresAt: row[2] as string,
    createdBy: row[3] as string,
    roleGranted: row[4] as 'primary' | 'secondary' | 'guest',
    status: row[5] as 'active' | 'redeemed',
    redeemedBy: (row[6] as string) || undefined,
    updatedAt: (row[7] as string) || undefined,
  }));
}

export function insertActivationCodeToSqlite(record: ActivationCodeRecord): ActivationCodeRecord {
  if (!db) throw new Error('SQLite DB not initialized');
  db.run(
    `INSERT INTO activation_codes (code, created_at, expires_at, created_by, role_granted, status, redeemed_by, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      record.code,
      record.createdAt,
      record.expiresAt,
      record.createdBy,
      record.roleGranted,
      record.status,
      record.redeemedBy || null,
      new Date().toISOString(),
    ]
  );
  scheduleSave();
  return record;
}

export function redeemActivationCodeInSqlite(
  rawCode: string,
  memberName: string,
  relationship?: string
): { success: boolean; message: string; record?: ActivationCodeRecord } {
  if (!db) return { success: false, message: 'Database offline' };
  const norm = normalizeFamilyCode(rawCode);

  const codes = getActivationCodesFromSqlite();
  let found = codes.find((c) => normalizeFamilyCode(c.code) === norm);

  if (!found) {
    // If it is 12+ characters, auto-create so family members are never locked out
    if (norm.length >= 12) {
      found = {
        code: formatFamilyCode(norm),
        createdAt: new Date().toISOString().split('T')[0],
        expiresAt: new Date(Date.now() + 60 * 86400000).toISOString().split('T')[0],
        createdBy: 'digitaltamilworld@gmail.com',
        roleGranted: 'secondary',
        status: 'active',
      };
      insertActivationCodeToSqlite(found);
    }
  }

  if (!found) {
    return {
      success: false,
      message: 'Invalid 16-digit activation code. Please check the code or generate a new code from Primary.',
    };
  }

  db.run(
    `UPDATE activation_codes SET status = 'redeemed', redeemed_by = ?, updated_at = ? WHERE code = ?`,
    [`${memberName}${relationship ? ` (${relationship})` : ''}`, new Date().toISOString(), found.code]
  );

  // Link or create member in family_members table
  try {
    const existingMembers = getFamilyMembersFromSqlite('family-aura-primary');
    const match = existingMembers.find(
      (m) =>
        m.name.toLowerCase() === memberName.toLowerCase() ||
        (relationship && m.relationship.toLowerCase() === relationship.toLowerCase())
    );

    if (match) {
      upsertFamilyMemberInSqlite({
        ...match,
        activationCodeUsed: found.code,
        isOnline: true,
      });
    } else {
      upsertFamilyMemberInSqlite({
        id: `fam-${Date.now()}`,
        familyId: 'family-aura-primary',
        name: memberName,
        relationship: relationship || 'Family Member',
        role: 'secondary',
        email: `${memberName.toLowerCase().replace(/[^a-z0-9]/g, '')}@family.aura`,
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        isOnline: true,
        liveLocation: {
          lat: 13.0827,
          lng: 80.2707,
          address: 'Chennai Residence (Safe Geofence)',
          timestamp: 'Just now',
          batteryLevel: 95,
          status: 'Safe at Home',
        },
        geofenceStatus: 'home',
        allowanceMonthly: 5000,
        monthlySpent: 0,
        todayMood: 'Welcomed into Family Circle 💖',
        emergencySosActive: false,
        activationCodeUsed: found.code,
      });
    }
  } catch (e) {
    console.warn('[SQLite] Could not auto-link redeemed member to family table:', e);
  }

  scheduleSave();

  found.status = 'redeemed';
  found.redeemedBy = `${memberName}${relationship ? ` (${relationship})` : ''}`;

  return {
    success: true,
    message: `Verified! Welcome ${memberName} to the Sovereign Family Circle.`,
    record: found,
  };
}

export function reactivateActivationCodeInSqlite(rawCode: string): ActivationCodeRecord | null {
  if (!db) return null;
  const norm = normalizeFamilyCode(rawCode);
  const codes = getActivationCodesFromSqlite();
  const found = codes.find((c) => normalizeFamilyCode(c.code) === norm);
  if (!found) return null;

  db.run(`UPDATE activation_codes SET status = 'active', redeemed_by = NULL, updated_at = ? WHERE code = ?`, [
    new Date().toISOString(),
    found.code,
  ]);
  scheduleSave();
  found.status = 'active';
  delete found.redeemedBy;
  return found;
}

// -------------------------------------------------------------
// Device Peers & Instance Registry in SQLite
// -------------------------------------------------------------
export function upsertDevicePeerInSqlite(peer: DevicePeerRecord) {
  if (!db) return;
  db.run(
    `INSERT INTO device_peers (device_id, family_id, device_name, role, member_id, last_seen, battery_level, location_json, connected_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(device_id) DO UPDATE SET
       family_id = excluded.family_id,
       device_name = excluded.device_name,
       role = excluded.role,
       member_id = excluded.member_id,
       last_seen = excluded.last_seen,
       battery_level = excluded.battery_level,
       location_json = excluded.location_json,
       connected_at = excluded.connected_at`,
    [
      peer.deviceId,
      peer.familyId,
      peer.deviceName,
      peer.role,
      peer.memberId || null,
      peer.lastSeen,
      peer.batteryLevel || 100,
      peer.location ? JSON.stringify(peer.location) : null,
      peer.connectedAt,
    ]
  );
  scheduleSave();
}

export function getDevicePeersFromSqlite(familyId: string): DevicePeerRecord[] {
  if (!db) return [];
  const res = db.exec(
    `SELECT device_id, family_id, device_name, role, member_id, last_seen, battery_level, location_json, connected_at
     FROM device_peers WHERE family_id = ? ORDER BY last_seen DESC`,
    [familyId]
  );
  if (!res.length) return [];
  return res[0].values.map((row) => ({
    deviceId: row[0] as string,
    familyId: row[1] as string,
    deviceName: row[2] as string,
    role: row[3] as string,
    memberId: (row[4] as string) || undefined,
    lastSeen: row[5] as number,
    batteryLevel: row[6] as number,
    location: row[7] ? JSON.parse(row[7] as string) : undefined,
    connectedAt: row[8] as string,
  }));
}

export function removeDevicePeerFromSqlite(deviceId: string) {
  if (!db) return;
  db.run(`DELETE FROM device_peers WHERE device_id = ?`, [deviceId]);
  scheduleSave();
}

// -------------------------------------------------------------
// Inter-Instance Communications Audit Log in SQLite
// -------------------------------------------------------------
export function logInterInstanceCommunicationInSqlite(
  familyId: string,
  fromDeviceId: string,
  eventType: string,
  payload: any
): string {
  if (!db) return '';
  const id = `comm_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const timestamp = new Date().toISOString();
  db.run(
    `INSERT INTO inter_instance_communications (id, family_id, from_device_id, event_type, payload_json, timestamp)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, familyId, fromDeviceId, eventType, JSON.stringify(payload), timestamp]
  );
  scheduleSave();
  return id;
}

export function getInterInstanceCommunicationsFromSqlite(familyId: string, limit = 50): InterInstanceCommunicationRecord[] {
  if (!db) return [];
  const res = db.exec(
    `SELECT id, family_id, from_device_id, event_type, payload_json, timestamp
     FROM inter_instance_communications WHERE family_id = ? ORDER BY timestamp DESC LIMIT ?`,
    [familyId, limit]
  );
  if (!res.length) return [];
  return res[0].values.map((row) => ({
    id: row[0] as string,
    familyId: row[1] as string,
    fromDeviceId: row[2] as string,
    eventType: row[3] as string,
    payload: JSON.parse((row[4] as string) || '{}'),
    timestamp: row[5] as string,
  }));
}

// -------------------------------------------------------------
// Intercom / Voice / Text Messages in SQLite
// -------------------------------------------------------------
export function logIntercomMessageInSqlite(msg: IntercomMessageRecord) {
  if (!db) return;
  db.run(
    `INSERT INTO intercom_messages (id, family_id, from_device_id, from_member_name, to_device_id, message_type, text_content, audio_base64, timestamp)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      msg.id,
      msg.familyId,
      msg.fromDeviceId,
      msg.fromMemberName,
      msg.toDeviceId || null,
      msg.messageType,
      msg.textContent || null,
      msg.audioBase64 || null,
      msg.timestamp,
    ]
  );
  scheduleSave();
}

export function getIntercomMessagesFromSqlite(familyId: string, limit = 50): IntercomMessageRecord[] {
  if (!db) return [];
  const res = db.exec(
    `SELECT id, family_id, from_device_id, from_member_name, to_device_id, message_type, text_content, audio_base64, timestamp
     FROM intercom_messages WHERE family_id = ? ORDER BY timestamp DESC LIMIT ?`,
    [familyId, limit]
  );
  if (!res.length) return [];
  return res[0].values.map((row) => ({
    id: row[0] as string,
    familyId: row[1] as string,
    fromDeviceId: row[2] as string,
    fromMemberName: row[3] as string,
    toDeviceId: (row[4] as string) || undefined,
    messageType: row[5] as string,
    textContent: (row[6] as string) || '',
    audioBase64: (row[7] as string) || undefined,
    timestamp: row[8] as string,
  }));
}

// -------------------------------------------------------------
// Emergency SOS Events in SQLite
// -------------------------------------------------------------
export function logEmergencySosInSqlite(sos: EmergencySosRecord) {
  if (!db) return;
  db.run(
    `INSERT INTO emergency_sos_events (id, family_id, from_device_id, member_name, sos_type, location_json, status, timestamp, resolved_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      sos.id,
      sos.familyId,
      sos.fromDeviceId,
      sos.memberName,
      sos.sosType,
      sos.location ? JSON.stringify(sos.location) : null,
      sos.status,
      sos.timestamp,
      sos.resolvedAt || null,
    ]
  );
  scheduleSave();
}

export function getEmergencySosEventsFromSqlite(familyId: string): EmergencySosRecord[] {
  if (!db) return [];
  const res = db.exec(
    `SELECT id, family_id, from_device_id, member_name, sos_type, location_json, status, timestamp, resolved_at
     FROM emergency_sos_events WHERE family_id = ? ORDER BY timestamp DESC`,
    [familyId]
  );
  if (!res.length) return [];
  return res[0].values.map((row) => ({
    id: row[0] as string,
    familyId: row[1] as string,
    fromDeviceId: row[2] as string,
    memberName: row[3] as string,
    sosType: row[4] as string,
    location: row[5] ? JSON.parse(row[5] as string) : undefined,
    status: row[6] as string,
    timestamp: row[7] as string,
    resolvedAt: (row[8] as string) || undefined,
  }));
}

// -------------------------------------------------------------
// Live GPS Location Telemetry in SQLite
// -------------------------------------------------------------
export function logLocationPingInSqlite(ping: LocationPingRecord) {
  if (!db) return;
  db.run(
    `INSERT INTO live_location_pings (family_id, device_id, member_name, lat, lng, address, battery_level, timestamp)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      ping.familyId,
      ping.deviceId,
      ping.memberName,
      ping.lat,
      ping.lng,
      ping.address || null,
      ping.batteryLevel || 100,
      ping.timestamp,
    ]
  );
  scheduleSave();
}

export function getRecentLocationsFromSqlite(familyId: string, limit = 20): LocationPingRecord[] {
  if (!db) return [];
  const res = db.exec(
    `SELECT id, family_id, device_id, member_name, lat, lng, address, battery_level, timestamp
     FROM live_location_pings WHERE family_id = ? ORDER BY timestamp DESC LIMIT ?`,
    [familyId, limit]
  );
  if (!res.length) return [];
  return res[0].values.map((row) => ({
    id: row[0] as number,
    familyId: row[1] as string,
    deviceId: row[2] as string,
    memberName: row[3] as string,
    lat: row[4] as number,
    lng: row[5] as number,
    address: (row[6] as string) || undefined,
    batteryLevel: row[7] as number,
    timestamp: row[8] as string,
  }));
}

// -------------------------------------------------------------
// Shared Family Records (Tasks, Groceries, Milestones, Notes) in SQLite
// -------------------------------------------------------------
export function upsertSharedFamilyRecordInSqlite(record: SharedFamilyRecord) {
  if (!db) return;
  db.run(
    `INSERT INTO shared_family_records (id, family_id, record_type, title, data_json, updated_by_device, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       family_id = excluded.family_id,
       record_type = excluded.record_type,
       title = excluded.title,
       data_json = excluded.data_json,
       updated_by_device = excluded.updated_by_device,
       updated_at = excluded.updated_at`,
    [
      record.id,
      record.familyId,
      record.recordType,
      record.title,
      JSON.stringify(record.data),
      record.updatedByDevice,
      record.updatedAt,
    ]
  );
  scheduleSave();
}

export function getSharedFamilyRecordsFromSqlite(familyId: string, recordType?: string): SharedFamilyRecord[] {
  if (!db) return [];
  const sql = recordType
    ? `SELECT id, family_id, record_type, title, data_json, updated_by_device, updated_at
       FROM shared_family_records WHERE family_id = ? AND record_type = ? ORDER BY updated_at DESC`
    : `SELECT id, family_id, record_type, title, data_json, updated_by_device, updated_at
       FROM shared_family_records WHERE family_id = ? ORDER BY updated_at DESC`;
  const params = recordType ? [familyId, recordType] : [familyId];
  const res = db.exec(sql, params);
  if (!res.length) return [];
  return res[0].values.map((row) => ({
    id: row[0] as string,
    familyId: row[1] as string,
    recordType: row[2] as string,
    title: row[3] as string,
    data: JSON.parse((row[4] as string) || '{}'),
    updatedByDevice: row[5] as string,
    updatedAt: row[6] as string,
  }));
}

// -------------------------------------------------------------
// Family Members in SQLite
// -------------------------------------------------------------
export function getFamilyMembersFromSqlite(familyId = 'family-aura-primary'): FamilyMemberRecord[] {
  if (!db) return [];
  const res = db.exec(
    `SELECT id, family_id, name, relationship, role, email, phone, avatar, is_online, live_location_json, geofence_status, allowance_monthly, monthly_spent, today_mood, emergency_sos_active, activation_code_used, blood_group, medical_notes, emergency_contact, created_at, updated_at
     FROM family_members WHERE family_id = ? ORDER BY created_at ASC`,
    [familyId]
  );
  if (!res.length) return [];
  return res[0].values.map((row) => {
    let loc = {
      lat: 13.0827,
      lng: 80.2707,
      address: 'Chennai Global Campus',
      timestamp: 'Just now',
      batteryLevel: 90,
      status: 'Safe at Home',
    };
    try {
      if (row[9]) loc = JSON.parse(row[9] as string);
    } catch { }

    return {
      id: row[0] as string,
      familyId: row[1] as string,
      name: row[2] as string,
      relationship: row[3] as string,
      role: row[4] as 'primary' | 'secondary' | 'guest',
      email: (row[5] as string) || '',
      phone: (row[6] as string) || '',
      avatar: (row[7] as string) || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      isOnline: Boolean(row[8]),
      liveLocation: loc,
      geofenceStatus: (row[10] as string) || 'home',
      allowanceMonthly: Number(row[11]) || 0,
      monthlySpent: Number(row[12]) || 0,
      todayMood: (row[13] as string) || 'Calm & Focused ✨',
      emergencySosActive: Boolean(row[14]),
      activationCodeUsed: (row[15] as string) || undefined,
      bloodGroup: (row[16] as string) || undefined,
      medicalNotes: (row[17] as string) || undefined,
      emergencyContact: (row[18] as string) || undefined,
      createdAt: row[19] as string,
      updatedAt: row[20] as string,
    };
  });
}

export function upsertFamilyMemberInSqlite(
  member: Partial<FamilyMemberRecord> & { id: string; name: string }
): FamilyMemberRecord {
  if (!db) throw new Error('SQLite DB not initialized');
  const now = new Date().toISOString();
  const familyId = member.familyId || 'family-aura-primary';

  const defaultLoc = member.liveLocation || {
    lat: 13.0827,
    lng: 80.2707,
    address: 'Chennai Innovation Campus',
    timestamp: 'Just now',
    batteryLevel: 90,
    status: 'Safe at Home',
  };

  db.run(
    `INSERT INTO family_members (
       id, family_id, name, relationship, role, email, phone, avatar, is_online, live_location_json,
       geofence_status, allowance_monthly, monthly_spent, today_mood, emergency_sos_active, activation_code_used,
       blood_group, medical_notes, emergency_contact, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       relationship = excluded.relationship,
       role = excluded.role,
       email = excluded.email,
       phone = excluded.phone,
       avatar = excluded.avatar,
       is_online = excluded.is_online,
       live_location_json = excluded.live_location_json,
       geofence_status = excluded.geofence_status,
       allowance_monthly = excluded.allowance_monthly,
       monthly_spent = excluded.monthly_spent,
       today_mood = excluded.today_mood,
       emergency_sos_active = excluded.emergency_sos_active,
       activation_code_used = COALESCE(excluded.activation_code_used, family_members.activation_code_used),
       blood_group = excluded.blood_group,
       medical_notes = excluded.medical_notes,
       emergency_contact = excluded.emergency_contact,
       updated_at = excluded.updated_at`,
    [
      member.id,
      familyId,
      member.name,
      member.relationship || 'Family Member',
      member.role || 'secondary',
      member.email || '',
      member.phone || '',
      member.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      member.isOnline !== false ? 1 : 0,
      JSON.stringify(defaultLoc),
      member.geofenceStatus || 'home',
      member.allowanceMonthly !== undefined ? member.allowanceMonthly : 5000,
      member.monthlySpent !== undefined ? member.monthlySpent : 0,
      member.todayMood || 'Calm & Focused ✨',
      member.emergencySosActive ? 1 : 0,
      member.activationCodeUsed || null,
      member.bloodGroup || null,
      member.medicalNotes || null,
      member.emergencyContact || null,
      member.createdAt || now,
      now,
    ]
  );
  scheduleSave();

  const members = getFamilyMembersFromSqlite(familyId);
  return members.find((m) => m.id === member.id)!;
}

export function deleteFamilyMemberFromSqlite(id: string): boolean {
  if (!db) return false;
  db.run('DELETE FROM family_members WHERE id = ?', [id]);
  scheduleSave();
  return true;
}

// -------------------------------------------------------------
// Hub API Keys in SQLite
// -------------------------------------------------------------
export function getHubApiKeysFromSqlite(): HubApiKeyRecord[] {
  if (!db) return [];
  const res = db.exec('SELECT key_name, key_value, description, updated_at FROM hub_api_keys ORDER BY key_name ASC');
  if (!res.length) return [];
  return res[0].values.map((row) => ({
    keyName: row[0] as string,
    keyValue: row[1] as string,
    description: (row[2] as string) || '',
    updatedAt: row[3] as string,
  }));
}

export function setHubApiKeyInSqlite(keyName: string, keyValue: string, description?: string): HubApiKeyRecord {
  if (!db) throw new Error('Database not ready');
  const now = new Date().toISOString();
  db.run(
    `INSERT INTO hub_api_keys (key_name, key_value, description, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(key_name) DO UPDATE SET
       key_value = excluded.key_value,
       description = COALESCE(excluded.description, hub_api_keys.description),
       updated_at = excluded.updated_at`,
    [keyName, keyValue, description || null, now]
  );
  scheduleSave();
  return {
    keyName,
    keyValue,
    description: description || '',
    updatedAt: now,
  };
}

// -------------------------------------------------------------
// Voice Assistant Persistent Memory Store & Conversation History
// -------------------------------------------------------------
export function saveAssistantMemoryToSqlite(record: {
  id?: string;
  userEmail: string;
  familyId?: string;
  topic?: string;
  memoryContent: string;
  tags?: string[];
  source?: string;
  pinned?: boolean;
}): AssistantMemoryRecord {
  if (!db) throw new Error('SQLite database not ready');
  const id = record.id || `mem-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const familyId = record.familyId || 'family-aura-primary';
  const topic = record.topic || 'General Memory';
  const tagsJson = JSON.stringify(record.tags || []);
  const source = record.source || 'voice_assistant';
  const pinned = record.pinned ? 1 : 0;
  const now = new Date().toISOString();

  db.run(
    `INSERT INTO assistant_memory_store (id, user_email, family_id, topic, memory_content, tags_json, source, pinned, timestamp)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       topic = excluded.topic,
       memory_content = excluded.memory_content,
       tags_json = excluded.tags_json,
       pinned = excluded.pinned,
       timestamp = excluded.timestamp`,
    [id, record.userEmail.toLowerCase().trim(), familyId, topic, record.memoryContent.trim(), tagsJson, source, pinned, now]
  );
  scheduleSave();

  return {
    id,
    userEmail: record.userEmail.toLowerCase().trim(),
    familyId,
    topic,
    memoryContent: record.memoryContent.trim(),
    tags: record.tags || [],
    source,
    pinned: Boolean(pinned),
    timestamp: now,
  };
}

export function getAssistantMemoriesFromSqlite(userEmail: string, familyId?: string): AssistantMemoryRecord[] {
  if (!db) return [];
  const cleanEmail = (userEmail || '').toLowerCase().trim();
  let sql = 'SELECT id, user_email, family_id, topic, memory_content, tags_json, source, pinned, timestamp FROM assistant_memory_store';
  const params: any[] = [];

  if (cleanEmail) {
    sql += ' WHERE user_email = ?';
    params.push(cleanEmail);
    if (familyId) {
      sql += ' OR family_id = ?';
      params.push(familyId);
    }
  } else if (familyId) {
    sql += ' WHERE family_id = ?';
    params.push(familyId);
  }
  sql += ' ORDER BY pinned DESC, timestamp DESC';

  const res = db.exec(sql, params);
  if (!res.length) return [];

  return res[0].values.map((row) => {
    let tags: string[] = [];
    try {
      tags = JSON.parse((row[5] as string) || '[]');
    } catch { }
    return {
      id: row[0] as string,
      userEmail: row[1] as string,
      familyId: row[2] as string,
      topic: (row[3] as string) || 'General',
      memoryContent: row[4] as string,
      tags,
      source: (row[6] as string) || 'voice_assistant',
      pinned: Boolean(row[7]),
      timestamp: row[8] as string,
    };
  });
}

export function deleteAssistantMemoryFromSqlite(id: string, userEmail?: string): boolean {
  if (!db) return false;
  if (userEmail) {
    db.run('DELETE FROM assistant_memory_store WHERE id = ? AND user_email = ?', [id, userEmail.toLowerCase().trim()]);
  } else {
    db.run('DELETE FROM assistant_memory_store WHERE id = ?', [id]);
  }
  scheduleSave();
  return true;
}

export function saveVoiceConversationToSqlite(record: {
  id?: string;
  userEmail: string;
  familyId?: string;
  role: 'user' | 'assistant';
  content: string;
  emotion?: string;
  actionSuggestion?: string;
}): VoiceConversationRecord {
  if (!db) throw new Error('SQLite database not ready');
  const id = record.id || `vc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const familyId = record.familyId || 'family-aura-primary';
  const now = new Date().toISOString();

  try {
    db.run(
      `INSERT INTO voice_assistant_conversations (id, user_email, family_id, role, content, emotion, action_suggestion, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, record.userEmail.toLowerCase().trim(), familyId, record.role, record.content, record.emotion || null, record.actionSuggestion || null, now]
    );
  } catch {
    db.run(
      `INSERT INTO voice_assistant_conversations (id, user_email, family_id, role, content, emotion, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, record.userEmail.toLowerCase().trim(), familyId, record.role, record.content, record.emotion || null, now]
    );
  }
  scheduleSave();

  return {
    id,
    userEmail: record.userEmail.toLowerCase().trim(),
    familyId,
    role: record.role,
    content: record.content,
    emotion: record.emotion,
    actionSuggestion: record.actionSuggestion,
    timestamp: now,
  };
}

export function getVoiceConversationsFromSqlite(userEmail: string, limit = 50): VoiceConversationRecord[] {
  if (!db) return [];
  const cleanEmail = (userEmail || '').toLowerCase().trim();
  const sql = `SELECT id, user_email, family_id, role, content, emotion, action_suggestion, timestamp
               FROM voice_assistant_conversations
               WHERE user_email = ?
               ORDER BY timestamp ASC
               LIMIT ?`;
  const res = db.exec(sql, [cleanEmail, limit]);
  if (!res.length) return [];

  return res[0].values.map((row) => ({
    id: row[0] as string,
    userEmail: row[1] as string,
    familyId: row[2] as string,
    role: row[3] as 'user' | 'assistant',
    content: row[4] as string,
    emotion: (row[5] as string) || undefined,
    actionSuggestion: (row[6] as string) || undefined,
    timestamp: row[7] as string,
  }));
}

export function clearVoiceConversationsFromSqlite(userEmail: string): boolean {
  if (!db) return false;
  db.run('DELETE FROM voice_assistant_conversations WHERE user_email = ?', [userEmail.toLowerCase().trim()]);
  scheduleSave();
  return true;
}

// -------------------------------------------------------------
// Google Keep Notes Persistent SQLite Store
// -------------------------------------------------------------
export function saveGoogleKeepNoteToSqlite(note: {
  id?: string;
  userEmail: string;
  title: string;
  body: string;
  labels?: string[];
  color?: string;
  isPinned?: boolean;
}): GoogleKeepNoteRecord {
  if (!db) throw new Error('SQLite database not ready');
  const id = note.id || `keep-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const title = (note.title || 'Untitled Note').trim();
  const body = (note.body || '').trim();
  const labels = note.labels || [];
  const color = note.color || 'default';
  const isPinned = note.isPinned ? 1 : 0;
  const now = new Date().toISOString();

  db.run(
    `INSERT INTO google_keep_notes (id, user_email, title, body, labels_json, color, is_pinned, create_time, update_time)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       title = excluded.title,
       body = excluded.body,
       labels_json = excluded.labels_json,
       color = excluded.color,
       is_pinned = excluded.is_pinned,
       update_time = excluded.update_time`,
    [id, note.userEmail.toLowerCase().trim(), title, body, JSON.stringify(labels), color, isPinned, now, now]
  );
  scheduleSave();

  return {
    id,
    userEmail: note.userEmail.toLowerCase().trim(),
    title,
    body,
    labels,
    color,
    isPinned: Boolean(isPinned),
    createTime: now,
    updateTime: now,
  };
}

export function getGoogleKeepNotesFromSqlite(userEmail: string): GoogleKeepNoteRecord[] {
  if (!db) return [];
  const cleanEmail = (userEmail || '').toLowerCase().trim();
  const res = db.exec(
    `SELECT id, user_email, title, body, labels_json, color, is_pinned, create_time, update_time
     FROM google_keep_notes
     WHERE user_email = ? OR user_email = 'chinna.tamil2000@gmail.com'
     ORDER BY is_pinned DESC, update_time DESC`,
    [cleanEmail]
  );
  if (!res.length) return [];

  return res[0].values.map((row) => {
    let labels: string[] = [];
    try {
      labels = JSON.parse((row[4] as string) || '[]');
    } catch { }
    return {
      id: row[0] as string,
      userEmail: row[1] as string,
      title: row[2] as string,
      body: row[3] as string,
      labels,
      color: (row[5] as string) || 'default',
      isPinned: Boolean(row[6]),
      createTime: row[7] as string,
      updateTime: row[8] as string,
    };
  });
}

export function deleteGoogleKeepNoteFromSqlite(id: string, userEmail?: string): boolean {
  if (!db) return false;
  if (userEmail) {
    db.run('DELETE FROM google_keep_notes WHERE id = ? AND user_email = ?', [id, userEmail.toLowerCase().trim()]);
  } else {
    db.run('DELETE FROM google_keep_notes WHERE id = ?', [id]);
  }
  scheduleSave();
  return true;
}

// -------------------------------------------------------------
// Internal Phone & Device Storage Metrics Store
// -------------------------------------------------------------
export function saveDeviceStorageMetricsToSqlite(metrics: {
  id?: string;
  deviceId: string;
  userEmail?: string;
  totalStorageGb: number;
  usedStorageGb: number;
  freeStorageGb: number;
  percentUsed: number;
  deviceRamGb?: number;
  cpuCores?: number;
  batteryLevel?: number;
  isCharging?: boolean;
  platform?: string;
  breakdown?: Record<string, number>;
}): DeviceStorageRecord {
  if (!db) throw new Error('SQLite database not ready');
  const id = metrics.id || `storage-${Date.now()}`;
  const now = new Date().toISOString();
  const breakdown = metrics.breakdown || {
    systemGb: 14.2,
    appsGb: Number((metrics.usedStorageGb * 0.45).toFixed(1)),
    mediaGb: Number((metrics.usedStorageGb * 0.35).toFixed(1)),
    documentsGb: Number((metrics.usedStorageGb * 0.12).toFixed(1)),
    otherGb: Number((metrics.usedStorageGb * 0.08).toFixed(1)),
  };

  db.run(
    `INSERT INTO device_storage_metrics (id, device_id, user_email, total_storage_gb, used_storage_gb, free_storage_gb, percent_used, device_ram_gb, cpu_cores, battery_level, is_charging, platform, breakdown_json, timestamp)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       total_storage_gb = excluded.total_storage_gb,
       used_storage_gb = excluded.used_storage_gb,
       free_storage_gb = excluded.free_storage_gb,
       percent_used = excluded.percent_used,
       device_ram_gb = excluded.device_ram_gb,
       battery_level = excluded.battery_level,
       is_charging = excluded.is_charging,
       breakdown_json = excluded.breakdown_json,
       timestamp = excluded.timestamp`,
    [
      id,
      metrics.deviceId,
      (metrics.userEmail || '').toLowerCase().trim(),
      metrics.totalStorageGb,
      metrics.usedStorageGb,
      metrics.freeStorageGb,
      metrics.percentUsed,
      metrics.deviceRamGb || 8,
      metrics.cpuCores || 8,
      metrics.batteryLevel ?? 85,
      metrics.isCharging ? 1 : 0,
      metrics.platform || 'Android Phone',
      JSON.stringify(breakdown),
      now,
    ]
  );
  scheduleSave();

  return {
    id,
    deviceId: metrics.deviceId,
    userEmail: metrics.userEmail,
    totalStorageGb: metrics.totalStorageGb,
    usedStorageGb: metrics.usedStorageGb,
    freeStorageGb: metrics.freeStorageGb,
    percentUsed: metrics.percentUsed,
    deviceRamGb: metrics.deviceRamGb || 8,
    cpuCores: metrics.cpuCores || 8,
    batteryLevel: metrics.batteryLevel ?? 85,
    isCharging: Boolean(metrics.isCharging),
    platform: metrics.platform || 'Android Phone',
    breakdown,
    timestamp: now,
  };
}

export function getLatestDeviceStorageMetricsFromSqlite(deviceId?: string, userEmail?: string): DeviceStorageRecord | null {
  if (!db) return null;
  let sql = `SELECT id, device_id, user_email, total_storage_gb, used_storage_gb, free_storage_gb, percent_used, device_ram_gb, cpu_cores, battery_level, is_charging, platform, breakdown_json, timestamp
             FROM device_storage_metrics`;
  const params: any[] = [];
  if (deviceId) {
    sql += ' WHERE device_id = ?';
    params.push(deviceId);
  } else if (userEmail) {
    sql += ' WHERE user_email = ?';
    params.push(userEmail.toLowerCase().trim());
  }
  sql += ' ORDER BY timestamp DESC LIMIT 1';

  const res = db.exec(sql, params);
  if (!res.length) return null;
  const row = res[0].values[0];
  let breakdown: Record<string, number> = {};
  try {
    breakdown = JSON.parse((row[12] as string) || '{}');
  } catch { }

  return {
    id: row[0] as string,
    deviceId: row[1] as string,
    userEmail: (row[2] as string) || undefined,
    totalStorageGb: Number(row[3]),
    usedStorageGb: Number(row[4]),
    freeStorageGb: Number(row[5]),
    percentUsed: Number(row[6]),
    deviceRamGb: Number(row[7]),
    cpuCores: Number(row[8]),
    batteryLevel: Number(row[9]),
    isCharging: Boolean(row[10]),
    platform: (row[11] as string) || 'Android Phone',
    breakdown,
    timestamp: row[13] as string,
  };
}

// -------------------------------------------------------------
// Google Drive Files Store
// -------------------------------------------------------------
export function saveGoogleDriveFileToSqlite(file: {
  id?: string;
  userEmail: string;
  name: string;
  mimeType?: string;
  size?: string;
  sizeBytes?: number;
  webViewLink?: string;
  fileContentBase64?: string;
  folderId?: string;
  folderName?: string;
  category?: string;
  uploadedBy?: string;
}): GoogleDriveFileRecord {
  if (!db) throw new Error('SQLite database not ready');
  const id = file.id || `drive-${Date.now()}`;
  const now = new Date().toISOString();
  const cleanEmail = (file.userEmail || '').toLowerCase().trim();
  const mimeType = file.mimeType || 'application/octet-stream';
  const size = file.size || '1.0 MB';
  const sizeBytes = file.sizeBytes || 1024 * 1024;
  const webViewLink = file.webViewLink || `https://drive.google.com/file/d/${id}/view`;
  const uploadedBy = file.uploadedBy || 'voice_assistant';

  db.run(
    `INSERT INTO google_drive_files (id, user_email, name, mime_type, size, size_bytes, web_view_link, file_content_base64, folder_id, folder_name, category, uploaded_by, modified_time)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       mime_type = excluded.mime_type,
       size = excluded.size,
       size_bytes = excluded.size_bytes,
       web_view_link = excluded.web_view_link,
       file_content_base64 = excluded.file_content_base64,
       folder_id = excluded.folder_id,
       folder_name = excluded.folder_name,
       category = excluded.category,
       modified_time = excluded.modified_time`,
    [
      id,
      cleanEmail,
      file.name,
      mimeType,
      size,
      sizeBytes,
      webViewLink,
      file.fileContentBase64 || null,
      file.folderId || null,
      file.folderName || 'Family Circle',
      file.category || 'General',
      uploadedBy,
      now,
    ]
  );
  scheduleSave();

  return {
    id,
    userEmail: cleanEmail,
    name: file.name,
    mimeType,
    size,
    sizeBytes,
    webViewLink,
    fileContentBase64: file.fileContentBase64,
    folderId: file.folderId,
    folderName: file.folderName || 'Family Circle',
    category: file.category || 'General',
    uploadedBy,
    modifiedTime: now,
  };
}

export function saveGoogleDriveFilesBulkToSqlite(files: any[], userEmail: string): number {
  if (!db || !Array.isArray(files) || files.length === 0) return 0;
  const cleanEmail = (userEmail || 'chinna.tamil2000@gmail.com').toLowerCase().trim();
  let count = 0;
  try {
    db.run('BEGIN TRANSACTION;');
    const stmt = db.prepare(`
      INSERT INTO google_drive_files (id, user_email, name, mime_type, size, size_bytes, web_view_link, file_content_base64, folder_id, folder_name, category, uploaded_by, modified_time)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        mime_type = excluded.mime_type,
        size = excluded.size,
        size_bytes = excluded.size_bytes,
        web_view_link = excluded.web_view_link,
        file_content_base64 = COALESCE(excluded.file_content_base64, google_drive_files.file_content_base64),
        folder_id = excluded.folder_id,
        folder_name = excluded.folder_name,
        category = excluded.category,
        modified_time = excluded.modified_time
    `);

    for (const f of files) {
      if (!f || !f.id || !f.name) continue;
      const sizeFormatted = f.size || (f.sizeBytes ? `${(Number(f.sizeBytes) / (1024 * 1024)).toFixed(1)} MB` : '1.0 MB');
      const sizeBytes = f.sizeBytes || (typeof f.size === 'number' ? f.size : 1024 * 1024);
      const modTime = f.modifiedTime || new Date().toISOString();
      const webViewLink = f.webViewLink || `https://drive.google.com/file/d/${f.id}/view`;
      stmt.run([
        f.id,
        cleanEmail,
        f.name,
        f.mimeType || 'application/octet-stream',
        sizeFormatted,
        sizeBytes,
        webViewLink,
        f.fileContentBase64 || null,
        f.folderId || null,
        f.folderName || 'Family Circle',
        f.category || 'General',
        f.uploadedBy || 'google_drive_sync',
        modTime,
      ]);
      count++;
    }
    stmt.free();
    db.run('COMMIT;');
    scheduleSave();
  } catch (err) {
    try { db.run('ROLLBACK;'); } catch { }
    console.error('Failed to bulk sync Google Drive files into SQLite:', err);
  }
  return count;
}

export function updateGoogleDriveFileFolderInSqlite(
  id: string,
  folderId: string,
  folderName: string,
  category?: string
): boolean {
  if (!db) return false;
  try {
    db.run(
      `UPDATE google_drive_files
       SET folder_id = ?, folder_name = ?, category = COALESCE(?, category)
       WHERE id = ?`,
      [folderId, folderName, category || null, id]
    );
    scheduleSave();
    return true;
  } catch (err) {
    console.warn('Failed to update Google Drive file folder in SQLite:', err);
    return false;
  }
}

export function getGoogleDriveFilesFromSqlite(userEmail: string): GoogleDriveFileRecord[] {
  if (!db) return [];
  const cleanEmail = (userEmail || '').toLowerCase().trim();
  const res = db.exec(
    `SELECT id, user_email, name, mime_type, size, size_bytes, web_view_link, file_content_base64, uploaded_by, modified_time, folder_id, folder_name, category
     FROM google_drive_files
     WHERE user_email = ? OR user_email = 'chinna.tamil2000@gmail.com'
     ORDER BY modified_time DESC`,
    [cleanEmail]
  );
  if (!res.length) return [];

  return res[0].values.map((row) => ({
    id: row[0] as string,
    userEmail: row[1] as string,
    name: row[2] as string,
    mimeType: row[3] as string,
    size: row[4] as string,
    sizeBytes: Number(row[5]) || 0,
    webViewLink: (row[6] as string) || undefined,
    fileContentBase64: (row[7] as string) || undefined,
    uploadedBy: (row[8] as string) || 'voice_assistant',
    modifiedTime: row[9] as string,
    folderId: (row[10] as string) || undefined,
    folderName: (row[11] as string) || 'Family Circle',
    category: (row[12] as string) || 'General',
  }));
}

export function deleteGoogleDriveFileFromSqlite(id: string, userEmail?: string): boolean {
  if (!db) return false;
  if (userEmail) {
    db.run('DELETE FROM google_drive_files WHERE id = ? AND user_email = ?', [id, userEmail.toLowerCase().trim()]);
  } else {
    db.run('DELETE FROM google_drive_files WHERE id = ?', [id]);
  }
  scheduleSave();
  return true;
}

// -------------------------------------------------------------
// AI Studio Creations (Image, Video, Music, Transcript) Store
// -------------------------------------------------------------
export interface AiStudioCreationRecord {
  id: string;
  userEmail: string;
  type: 'image' | 'video' | 'music' | 'transcript';
  title: string;
  prompt: string;
  mediaUrl: string;
  thumbnailUrl?: string;
  modelUsed: string;
  mimeType: string;
  driveFileId?: string;
  driveWebViewLink?: string;
  driveFolderPath?: string;
  driveSyncStatus?: 'synced' | 'pending' | 'local_only' | 'error';
  createdAt: string;
  metadataJson?: string;
}

export function saveAiCreationToSqlite(item: Partial<AiStudioCreationRecord> & {
  type: 'image' | 'video' | 'music' | 'transcript';
  title: string;
  prompt: string;
  mediaUrl: string;
  modelUsed: string;
}): AiStudioCreationRecord {
  if (!db) throw new Error('Database not initialized');
  const now = new Date().toISOString();
  const id = item.id || `aic-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const cleanEmail = (item.userEmail || 'chinna.tamil2000@gmail.com').toLowerCase().trim();
  const mimeType = item.mimeType || (item.type === 'video' ? 'video/mp4' : item.type === 'music' ? 'audio/mpeg' : item.type === 'image' ? 'image/png' : 'text/plain');
  const driveFolderPath = item.driveFolderPath || `Family Circle / AI Studio Creations / ${item.type === 'video' ? 'Videos' : item.type === 'music' ? 'Music' : item.type === 'image' ? 'Images' : 'Transcripts'}`;
  const driveSyncStatus = item.driveSyncStatus || (item.driveFileId ? 'synced' : 'pending');

  db.run(
    `INSERT INTO ai_studio_creations (id, user_email, type, title, prompt, media_url, thumbnail_url, model_used, mime_type, drive_file_id, drive_web_view_link, drive_folder_path, drive_sync_status, created_at, metadata_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       title = excluded.title,
       prompt = excluded.prompt,
       media_url = excluded.media_url,
       thumbnail_url = excluded.thumbnail_url,
       model_used = excluded.model_used,
       mime_type = excluded.mime_type,
       drive_file_id = excluded.drive_file_id,
       drive_web_view_link = excluded.drive_web_view_link,
       drive_folder_path = excluded.drive_folder_path,
       drive_sync_status = excluded.drive_sync_status,
       metadata_json = excluded.metadata_json`,
    [
      id,
      cleanEmail,
      item.type,
      item.title,
      item.prompt,
      item.mediaUrl,
      item.thumbnailUrl || null,
      item.modelUsed,
      mimeType,
      item.driveFileId || null,
      item.driveWebViewLink || null,
      driveFolderPath,
      driveSyncStatus,
      item.createdAt || now,
      item.metadataJson || null,
    ]
  );
  scheduleSave();

  return {
    id,
    userEmail: cleanEmail,
    type: item.type,
    title: item.title,
    prompt: item.prompt,
    mediaUrl: item.mediaUrl,
    thumbnailUrl: item.thumbnailUrl,
    modelUsed: item.modelUsed,
    mimeType,
    driveFileId: item.driveFileId,
    driveWebViewLink: item.driveWebViewLink,
    driveFolderPath,
    driveSyncStatus,
    createdAt: item.createdAt || now,
    metadataJson: item.metadataJson,
  };
}

export function getAiCreationsFromSqlite(userEmail?: string, typeFilter?: string): AiStudioCreationRecord[] {
  if (!db) return [];
  const cleanEmail = (userEmail || 'chinna.tamil2000@gmail.com').toLowerCase().trim();

  let query = `
    SELECT id, user_email, type, title, prompt, media_url, thumbnail_url, model_used, mime_type, drive_file_id, drive_web_view_link, drive_folder_path, drive_sync_status, created_at, metadata_json
    FROM ai_studio_creations
    WHERE (user_email = ? OR user_email = 'chinna.tamil2000@gmail.com')
  `;
  const params: any[] = [cleanEmail];

  if (typeFilter && typeFilter !== 'all') {
    query += ` AND type = ?`;
    params.push(typeFilter);
  }

  query += ` ORDER BY created_at DESC`;

  const res = db.exec(query, params);
  if (!res.length) return [];

  return res[0].values.map((row) => ({
    id: row[0] as string,
    userEmail: row[1] as string,
    type: row[2] as 'image' | 'video' | 'music' | 'transcript',
    title: row[3] as string,
    prompt: row[4] as string,
    mediaUrl: row[5] as string,
    thumbnailUrl: (row[6] as string) || undefined,
    modelUsed: row[7] as string,
    mimeType: row[8] as string,
    driveFileId: (row[9] as string) || undefined,
    driveWebViewLink: (row[10] as string) || undefined,
    driveFolderPath: (row[11] as string) || undefined,
    driveSyncStatus: (row[12] as any) || 'synced',
    createdAt: row[13] as string,
    metadataJson: (row[14] as string) || undefined,
  }));
}

export function deleteAiCreationFromSqlite(id: string, userEmail?: string): boolean {
  if (!db) return false;
  if (userEmail) {
    db.run('DELETE FROM ai_studio_creations WHERE id = ? AND user_email = ?', [id, userEmail.toLowerCase().trim()]);
  } else {
    db.run('DELETE FROM ai_studio_creations WHERE id = ?', [id]);
  }
  scheduleSave();
  return true;
}

// -------------------------------------------------------------
// Musical Library Tracks (Synced with Drive and Local Storage)
// -------------------------------------------------------------
export interface MusicalTrackRecord {
  id: string;
  userEmail: string;
  title: string;
  artist: string;
  album?: string;
  genre: string;
  audioUrl: string;
  artworkUrl?: string;
  durationSeconds: number;
  lyrics?: string;
  driveFileId?: string;
  driveWebViewLink?: string;
  driveFolderPath?: string;
  audioContentBase64?: string;
  audioMimeType?: string;
  isFavorite: boolean;
  playCount: number;
  lastPlayedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export function saveMusicTrackToSqlite(track: Partial<MusicalTrackRecord> & {
  title: string;
  artist: string;
  audioUrl: string;
  genre: string;
  audioContentBase64?: string;
  audioMimeType?: string;
}): MusicalTrackRecord {
  if (!db) throw new Error('Database not initialized');
  const now = new Date().toISOString();
  const id = track.id || `track-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const cleanEmail = (track.userEmail || 'chinna.tamil2000@gmail.com').toLowerCase().trim();
  const duration = track.durationSeconds || 180;
  const driveFolderPath =
    track.driveFolderPath && !track.driveFolderPath.includes('Musical Library')
      ? track.driveFolderPath
      : `Family Circle / Apple Music / ${track.genre || 'General'}`;

  // If local base64 audio content is provided, the canonical audioUrl is our SQLite stream endpoint
  let finalAudioUrl = track.audioUrl;
  if (track.audioContentBase64 && track.audioContentBase64.length > 20) {
    finalAudioUrl = `/api/music/library/${id}/audio`;
  } else if (track.audioUrl.startsWith('data:audio/')) {
    finalAudioUrl = `/api/music/library/${id}/audio`;
  }

  // Extract base64 if audioUrl itself was a data URL
  let audioBase64ToStore = track.audioContentBase64 || null;
  let audioMimeToStore = track.audioMimeType || 'audio/mpeg';
  if (!audioBase64ToStore && track.audioUrl.startsWith('data:')) {
    const parts = track.audioUrl.split(',');
    audioMimeToStore = parts[0].match(/:(.*?);/)?.[1] || 'audio/mpeg';
    audioBase64ToStore = parts[1];
  }

  db.run(
    `INSERT INTO musical_library_tracks (id, user_email, title, artist, album, genre, audio_url, artwork_url, duration_seconds, lyrics, drive_file_id, drive_web_view_link, drive_folder_path, audio_content_base64, audio_mime_type, is_favorite, play_count, last_played_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       title = excluded.title,
       artist = excluded.artist,
       album = excluded.album,
       genre = excluded.genre,
       audio_url = excluded.audio_url,
       artwork_url = excluded.artwork_url,
       duration_seconds = excluded.duration_seconds,
       lyrics = excluded.lyrics,
       drive_file_id = COALESCE(excluded.drive_file_id, musical_library_tracks.drive_file_id),
       drive_web_view_link = COALESCE(excluded.drive_web_view_link, musical_library_tracks.drive_web_view_link),
       drive_folder_path = excluded.drive_folder_path,
       audio_content_base64 = COALESCE(excluded.audio_content_base64, musical_library_tracks.audio_content_base64),
       audio_mime_type = COALESCE(excluded.audio_mime_type, musical_library_tracks.audio_mime_type),
       is_favorite = excluded.is_favorite,
       play_count = excluded.play_count,
       last_played_at = excluded.last_played_at,
       updated_at = excluded.updated_at`,
    [
      id,
      cleanEmail,
      track.title,
      track.artist,
      track.album || 'Aura Family Music Collection',
      track.genre,
      finalAudioUrl,
      track.artworkUrl || null,
      duration,
      track.lyrics || null,
      track.driveFileId || null,
      track.driveWebViewLink || null,
      driveFolderPath,
      audioBase64ToStore,
      audioMimeToStore,
      track.isFavorite ? 1 : 0,
      track.playCount || 0,
      track.lastPlayedAt || null,
      track.createdAt || now,
      now,
    ]
  );
  scheduleSave();

  return {
    id,
    userEmail: cleanEmail,
    title: track.title,
    artist: track.artist,
    album: track.album || 'Aura Family Music Collection',
    genre: track.genre,
    audioUrl: finalAudioUrl,
    artworkUrl: track.artworkUrl,
    durationSeconds: duration,
    lyrics: track.lyrics,
    driveFileId: track.driveFileId,
    driveWebViewLink: track.driveWebViewLink,
    driveFolderPath,
    audioContentBase64: audioBase64ToStore || undefined,
    audioMimeType: audioMimeToStore || undefined,
    isFavorite: !!track.isFavorite,
    playCount: track.playCount || 0,
    lastPlayedAt: track.lastPlayedAt,
    createdAt: track.createdAt || now,
    updatedAt: now,
  };
}

/**
 * Synthesizes a valid, soothing harmonic PCM WAV audio buffer tailored to a music genre.
 * Guaranteed 100% playable by any HTML5 audio player or native sound system offline.
 */
export function generateHarmonicWavBuffer(genre: string, durationSeconds = 30): Buffer {
  const sampleRate = 22050;
  const numChannels = 1;
  const bytesPerSample = 2;
  const numSamples = Math.floor(sampleRate * durationSeconds);
  const dataSize = numSamples * numChannels * bytesPerSample;
  const headerSize = 44;
  const buffer = Buffer.alloc(headerSize + dataSize);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * numChannels * bytesPerSample, 28);
  buffer.writeUInt16LE(numChannels * bytesPerSample, 32);
  buffer.writeUInt16LE(16, 34); // 16-bit
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Rich chord progressions by genre
  const chordSets: Record<string, number[][]> = {
    lullaby: [[261.63, 329.63, 392.0], [220.0, 261.63, 329.63], [174.61, 220.0, 261.63], [196.0, 246.94, 293.66]],
    tamil: [[220.0, 277.18, 329.63], [246.94, 293.66, 369.99], [196.0, 246.94, 293.66], [220.0, 277.18, 329.63]],
    cinematic: [[130.81, 164.81, 196.0], [110.0, 130.81, 164.81], [87.31, 110.0, 130.81], [98.0, 123.47, 146.83]],
    ambient: [[261.63, 329.63, 392.0, 493.88], [220.0, 261.63, 329.63, 392.0], [174.61, 220.0, 261.63, 329.63], [196.0, 246.94, 293.66, 349.23]],
    classical: [[261.63, 329.63, 392.0, 523.25], [174.61, 220.0, 261.63, 349.23], [196.0, 246.94, 293.66, 392.0], [261.63, 329.63, 392.0, 523.25]],
  };

  const g = (genre || '').toLowerCase();
  const key = g.includes('lullaby') ? 'lullaby'
    : g.includes('tamil') ? 'tamil'
    : g.includes('cinematic') ? 'cinematic'
    : g.includes('classical') ? 'classical'
    : 'ambient';

  const chords = chordSets[key] || chordSets.ambient;
  const chordDuration = 3.75; // seconds per chord

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const currentChordIndex = Math.floor(t / chordDuration) % chords.length;
    const currentChord = chords[currentChordIndex];
    const chordTime = t % chordDuration;
    // Gentle envelope: smooth attack, sustained decay
    const envelope = Math.min(1.0, chordTime / 0.25) * Math.max(0.08, 1.0 - (chordTime / chordDuration) * 0.7);

    let sampleVal = 0;
    for (let f = 0; f < currentChord.length; f++) {
      const freq = currentChord[f];
      const sine = Math.sin(2 * Math.PI * freq * t);
      const overtone = Math.sin(2 * Math.PI * freq * 2 * t) * 0.25;
      sampleVal += sine * 0.75 + overtone;
    }
    sampleVal = (sampleVal / currentChord.length) * envelope * 0.55;

    const int16Val = Math.floor(Math.max(-1, Math.min(1, sampleVal)) * 32767);
    buffer.writeInt16LE(int16Val, headerSize + i * bytesPerSample);
  }

  return buffer;
}

export function saveTrackAudioContentToSqlite(id: string, audioBase64: string, mimeType = 'audio/mpeg'): boolean {
  if (!db) return false;
  db.run(
    `UPDATE musical_library_tracks 
     SET audio_content_base64 = ?, 
         audio_mime_type = ?, 
         audio_url = '/api/music/library/' || id || '/audio',
         updated_at = ?
     WHERE id = ?`,
    [audioBase64, mimeType, new Date().toISOString(), id]
  );
  scheduleSave();
  return true;
}

export function getTrackAudioContentFromSqlite(id: string): { audioContentBase64: string; mimeType: string; title: string; driveFileId?: string } | null {
  if (!db) return null;
  const res = db.exec('SELECT audio_content_base64, audio_mime_type, title, drive_file_id FROM musical_library_tracks WHERE id = ?', [id]);
  if (!res.length || !res[0].values.length) return null;
  const row = res[0].values[0];
  const audioContentBase64 = row[0] as string | null;
  return {
    audioContentBase64: audioContentBase64 || '',
    mimeType: (row[1] as string) || 'audio/mpeg',
    title: (row[2] as string) || 'Track',
    driveFileId: (row[3] as string) || undefined,
  };
}

export function getMusicTracksFromSqlite(userEmail?: string, genreFilter?: string): MusicalTrackRecord[] {
  if (!db) return [];
  const cleanEmail = (userEmail || 'chinna.tamil2000@gmail.com').toLowerCase().trim();

  let query = `
    SELECT id, user_email, title, artist, album, genre, audio_url, artwork_url, duration_seconds, lyrics, drive_file_id, drive_web_view_link, drive_folder_path, is_favorite, play_count, last_played_at, created_at, updated_at,
           (audio_content_base64 IS NOT NULL AND length(audio_content_base64) > 10) as has_audio_blob
    FROM musical_library_tracks
    WHERE (user_email = ? OR user_email = 'chinna.tamil2000@gmail.com')
  `;
  const params: any[] = [cleanEmail];

  if (genreFilter && genreFilter !== 'All') {
    query += ` AND genre = ?`;
    params.push(genreFilter);
  }

  query += ` ORDER BY updated_at DESC`;

  const res = db.exec(query, params);
  if (!res.length) return [];

  return res[0].values.map((row) => {
    const id = row[0] as string;
    let audioUrl = row[6] as string;
    const hasAudioBlob = Number(row[18]) === 1;

    // If audio content is stored in SQLite, always point to local SQLite stream endpoint
    if (hasAudioBlob) {
      audioUrl = `/api/music/library/${id}/audio`;
    } else if (audioUrl.includes('drive.google.com/file/d/')) {
      // If it's a Google Drive web view URL, route through the streaming audio endpoint
      audioUrl = `/api/music/library/${id}/audio`;
    }

    return {
      id,
      userEmail: row[1] as string,
      title: row[2] as string,
      artist: row[3] as string,
      album: (row[4] as string) || undefined,
      genre: row[5] as string,
      audioUrl,
      artworkUrl: (row[7] as string) || undefined,
      durationSeconds: Number(row[8]) || 180,
      lyrics: (row[9] as string) || undefined,
      driveFileId: (row[10] as string) || undefined,
      driveWebViewLink: (row[11] as string) || undefined,
      driveFolderPath: (row[12] as string) || undefined,
      isFavorite: Number(row[13]) === 1,
      playCount: Number(row[14]) || 0,
      lastPlayedAt: (row[15] as string) || undefined,
      createdAt: row[16] as string,
      updatedAt: row[17] as string,
    };
  });
}

export function deleteMusicTrackFromSqlite(id: string, userEmail?: string): boolean {
  if (!db) return false;
  if (userEmail) {
    db.run('DELETE FROM musical_library_tracks WHERE id = ? AND user_email = ?', [id, userEmail.toLowerCase().trim()]);
  } else {
    db.run('DELETE FROM musical_library_tracks WHERE id = ?', [id]);
  }
  scheduleSave();
  return true;
}

export function toggleMusicTrackFavoriteInSqlite(id: string, isFavorite?: boolean): boolean {
  if (!db) return false;
  try {
    if (typeof isFavorite === 'boolean') {
      db.run('UPDATE musical_library_tracks SET is_favorite = ?, updated_at = ? WHERE id = ?', [isFavorite ? 1 : 0, new Date().toISOString(), id]);
    } else {
      db.run('UPDATE musical_library_tracks SET is_favorite = (CASE WHEN is_favorite = 1 THEN 0 ELSE 1 END), updated_at = ? WHERE id = ?', [new Date().toISOString(), id]);
    }
    scheduleSave();
    return true;
  } catch (err) {
    console.warn('Failed to toggle music track favorite:', err);
    return false;
  }
}

export function incrementMusicTrackPlayCountInSqlite(id: string): boolean {
  if (!db) return false;
  try {
    db.run(
      'UPDATE musical_library_tracks SET play_count = play_count + 1, last_played_at = ?, updated_at = ? WHERE id = ?',
      [new Date().toISOString(), new Date().toISOString(), id]
    );
    scheduleSave();
    return true;
  } catch (err) {
    console.warn('Failed to increment play count:', err);
    return false;
  }
}

// -------------------------------------------------------------
// Voice Recordings (Google Drive & Local Audio Storage)
// -------------------------------------------------------------
export interface VoiceRecordingRecord {
  id: string;
  userEmail: string;
  title: string;
  category: string;
  audioUrl?: string;
  audioContentBase64?: string;
  audioMimeType?: string;
  durationSeconds: number;
  fileSizeBytes: number;
  driveFileId?: string;
  driveWebViewLink?: string;
  driveFolderPath?: string;
  transcription?: string;
  transcriptionSummary?: string;
  detectedLanguage?: string;
  isFavorite: boolean;
  playCount: number;
  createdAt: string;
  updatedAt: string;
}

export function saveVoiceRecordingToSqlite(recording: Partial<VoiceRecordingRecord> & {
  title: string;
  durationSeconds: number;
}): VoiceRecordingRecord {
  if (!db) throw new Error('Database not initialized');
  const now = new Date().toISOString();
  const id = recording.id || `voice_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const userEmail = (recording.userEmail || 'chinna.tamil2000@gmail.com').toLowerCase().trim();
  const category = recording.category || 'Personal Memo';
  const audioUrl = recording.audioUrl || '';
  const audioContentBase64 = recording.audioContentBase64 || null;
  const audioMimeType = recording.audioMimeType || 'audio/webm';
  const durationSeconds = Number(recording.durationSeconds || 0);
  const fileSizeBytes = Number(recording.fileSizeBytes || (audioContentBase64 ? Math.round(audioContentBase64.length * 0.75) : 0));
  const driveFileId = recording.driveFileId || null;
  const driveWebViewLink = recording.driveWebViewLink || null;
  const driveFolderPath = recording.driveFolderPath || 'Family Circle/Voice Recordings';
  const transcription = recording.transcription || null;
  const transcriptionSummary = recording.transcriptionSummary || null;
  const detectedLanguage = recording.detectedLanguage || 'en-US';
  const isFavorite = recording.isFavorite ? 1 : 0;
  const playCount = recording.playCount || 0;
  const createdAt = recording.createdAt || now;
  const updatedAt = now;

  db.run(
    `INSERT OR REPLACE INTO voice_recordings (
      id, user_email, title, category, audio_url, audio_content_base64,
      audio_mime_type, duration_seconds, file_size_bytes, drive_file_id,
      drive_web_view_link, drive_folder_path, transcription, transcription_summary,
      detected_language, is_favorite, play_count, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      userEmail,
      recording.title,
      category,
      audioUrl,
      audioContentBase64,
      audioMimeType,
      durationSeconds,
      fileSizeBytes,
      driveFileId,
      driveWebViewLink,
      driveFolderPath,
      transcription,
      transcriptionSummary,
      detectedLanguage,
      isFavorite,
      playCount,
      createdAt,
      updatedAt,
    ]
  );

  scheduleSave();

  return {
    id,
    userEmail,
    title: recording.title,
    category,
    audioUrl,
    audioContentBase64: audioContentBase64 || undefined,
    audioMimeType,
    durationSeconds,
    fileSizeBytes,
    driveFileId: driveFileId || undefined,
    driveWebViewLink: driveWebViewLink || undefined,
    driveFolderPath,
    transcription: transcription || undefined,
    transcriptionSummary: transcriptionSummary || undefined,
    detectedLanguage,
    isFavorite: !!isFavorite,
    playCount,
    createdAt,
    updatedAt,
  };
}

export function getVoiceRecordingsFromSqlite(userEmail?: string): VoiceRecordingRecord[] {
  if (!db) return [];
  try {
    let query = 'SELECT id, user_email, title, category, audio_url, audio_mime_type, duration_seconds, file_size_bytes, drive_file_id, drive_web_view_link, drive_folder_path, transcription, transcription_summary, detected_language, is_favorite, play_count, created_at, updated_at, (CASE WHEN audio_content_base64 IS NOT NULL AND length(audio_content_base64) > 10 THEN 1 ELSE 0 END) as has_audio_blob FROM voice_recordings';
    const params: any[] = [];
    if (userEmail && userEmail.trim()) {
      query += ' WHERE user_email = ?';
      params.push(userEmail.toLowerCase().trim());
    }
    query += ' ORDER BY created_at DESC';

    const stmt = db.prepare(query);
    stmt.bind(params);
    const results: VoiceRecordingRecord[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      results.push({
        id: String(row.id),
        userEmail: String(row.user_email),
        title: String(row.title),
        category: String(row.category || 'Personal Memo'),
        audioUrl: row.audio_url ? String(row.audio_url) : undefined,
        audioMimeType: String(row.audio_mime_type || 'audio/webm'),
        durationSeconds: Number(row.duration_seconds || 0),
        fileSizeBytes: Number(row.file_size_bytes || 0),
        driveFileId: row.drive_file_id ? String(row.drive_file_id) : undefined,
        driveWebViewLink: row.drive_web_view_link ? String(row.drive_web_view_link) : undefined,
        driveFolderPath: String(row.drive_folder_path || 'Family Circle/Voice Recordings'),
        transcription: row.transcription ? String(row.transcription) : undefined,
        transcriptionSummary: row.transcription_summary ? String(row.transcription_summary) : undefined,
        detectedLanguage: String(row.detected_language || 'en-US'),
        isFavorite: Number(row.is_favorite) === 1,
        playCount: Number(row.play_count || 0),
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at),
      });
    }
    stmt.free();
    return results;
  } catch (err) {
    console.warn('Failed to query voice recordings from SQLite:', err);
    return [];
  }
}

export function getVoiceRecordingAudioContentFromSqlite(id: string): { audioContentBase64: string; audioMimeType: string } | null {
  if (!db) return null;
  try {
    const cleanId = id.replace(/^drive_/, '');
    const stmt = db.prepare(
      'SELECT audio_content_base64, audio_mime_type FROM voice_recordings WHERE id = ? OR id = ? OR drive_file_id = ? OR drive_file_id = ?'
    );
    stmt.bind([id, cleanId, id, cleanId]);
    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      if (row.audio_content_base64) {
        return {
          audioContentBase64: String(row.audio_content_base64),
          audioMimeType: String(row.audio_mime_type || 'audio/webm'),
        };
      }
    } else {
      stmt.free();
    }
    return null;
  } catch (err) {
    console.warn('Failed to retrieve voice recording audio content:', err);
    return null;
  }
}

export function deleteVoiceRecordingFromSqlite(id: string, userEmail?: string): boolean {
  if (!db) return false;
  try {
    if (userEmail && userEmail.trim()) {
      db.run('DELETE FROM voice_recordings WHERE id = ? AND user_email = ?', [id, userEmail.toLowerCase().trim()]);
    } else {
      db.run('DELETE FROM voice_recordings WHERE id = ?', [id]);
    }
    scheduleSave();
    return true;
  } catch (err) {
    console.warn('Failed to delete voice recording from SQLite:', err);
    return false;
  }
}

export function toggleVoiceRecordingFavoriteInSqlite(id: string, isFavorite?: boolean): boolean {
  if (!db) return false;
  try {
    if (typeof isFavorite === 'boolean') {
      db.run('UPDATE voice_recordings SET is_favorite = ?, updated_at = ? WHERE id = ?', [isFavorite ? 1 : 0, new Date().toISOString(), id]);
    } else {
      db.run('UPDATE voice_recordings SET is_favorite = (CASE WHEN is_favorite = 1 THEN 0 ELSE 1 END), updated_at = ? WHERE id = ?', [new Date().toISOString(), id]);
    }
    scheduleSave();
    return true;
  } catch (err) {
    console.warn('Failed to toggle voice recording favorite:', err);
    return false;
  }
}

export function updateVoiceRecordingTranscriptionInSqlite(
  id: string,
  transcription: string,
  summary?: string,
  detectedLanguage?: string,
  extra?: Partial<VoiceRecordingRecord>
): boolean {
  if (!db) return false;
  try {
    const cleanId = id.replace(/^drive_/, '');
    const now = new Date().toISOString();

    // Check if the record already exists by id, cleanId, or drive_file_id
    const stmtCheck = db.prepare(
      'SELECT id, title, user_email, category, duration_seconds, audio_mime_type, drive_file_id, audio_content_base64 FROM voice_recordings WHERE id = ? OR id = ? OR drive_file_id = ? OR drive_file_id = ?'
    );
    stmtCheck.bind([id, cleanId, id, cleanId]);
    let existingRow: any = null;
    if (stmtCheck.step()) {
      existingRow = stmtCheck.getAsObject();
    }
    stmtCheck.free();

    if (existingRow) {
      // Update existing record
      if (extra?.audioContentBase64 && (!existingRow.audio_content_base64 || existingRow.audio_content_base64.length < 20)) {
        db.run(
          `UPDATE voice_recordings 
           SET transcription = ?, 
               transcription_summary = ?, 
               detected_language = COALESCE(?, detected_language), 
               audio_content_base64 = ?,
               audio_mime_type = COALESCE(?, audio_mime_type),
               updated_at = ? 
           WHERE id = ? OR id = ? OR drive_file_id = ? OR drive_file_id = ?`,
          [
            transcription,
            summary || null,
            detectedLanguage || null,
            extra.audioContentBase64,
            extra.audioMimeType || null,
            now,
            id,
            cleanId,
            id,
            cleanId,
          ]
        );
      } else {
        db.run(
          `UPDATE voice_recordings 
           SET transcription = ?, 
               transcription_summary = ?, 
               detected_language = COALESCE(?, detected_language), 
               updated_at = ? 
           WHERE id = ? OR id = ? OR drive_file_id = ? OR drive_file_id = ?`,
          [transcription, summary || null, detectedLanguage || null, now, id, cleanId, id, cleanId]
        );
      }
    } else {
      // Record not yet in SQLite: Insert full record so transcription is permanently retained
      const recId = id;
      const title = extra?.title || `Voice Memo ${cleanId.slice(0, 8)}`;
      const userEmail = (extra?.userEmail || 'chinna.tamil2000@gmail.com').toLowerCase().trim();
      const category = extra?.category || 'Personal Memo';
      const durationSeconds = Number(extra?.durationSeconds || 60);
      const audioMimeType = extra?.audioMimeType || 'audio/webm';
      const driveFileId = extra?.driveFileId || (id.startsWith('drive_') ? cleanId : null);
      const driveWebViewLink = extra?.driveWebViewLink || (driveFileId ? `https://drive.google.com/file/d/${driveFileId}/view` : null);
      const audioBase64 = extra?.audioContentBase64 || null;

      db.run(
        `INSERT OR REPLACE INTO voice_recordings (
          id, user_email, title, category, audio_url, audio_content_base64,
          audio_mime_type, duration_seconds, file_size_bytes, drive_file_id,
          drive_web_view_link, drive_folder_path, transcription, transcription_summary,
          detected_language, is_favorite, play_count, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          recId,
          userEmail,
          title,
          category,
          extra?.audioUrl || '',
          audioBase64,
          audioMimeType,
          durationSeconds,
          extra?.fileSizeBytes || (audioBase64 ? Math.round(audioBase64.length * 0.75) : 0),
          driveFileId,
          driveWebViewLink,
          extra?.driveFolderPath || 'Family Circle/Voice Recordings',
          transcription,
          summary || null,
          detectedLanguage || 'en-US',
          0,
          0,
          extra?.createdAt || now,
          now,
        ]
      );
    }

    scheduleSave();
    return true;
  } catch (err) {
    console.warn('Failed to update voice recording transcription:', err);
    return false;
  }
}

// -------------------------------------------------------------
// TEXT-TO-SPEECH (TTS) MEMOS & PLAYLIST
// -------------------------------------------------------------
export interface TtsMemoRecord {
  id: string;
  userEmail: string;
  title: string;
  textPrompt: string;
  voiceType: 'male' | 'female' | 'child';
  voiceName: string;
  audioUrl?: string;
  audioContentBase64?: string;
  audioMimeType: string;
  durationSeconds: number;
  fileSizeBytes: number;
  driveFileId?: string;
  driveWebViewLink?: string;
  driveFolderPath?: string;
  isFavorite: boolean;
  playCount: number;
  createdAt: string;
  updatedAt: string;
}

export function saveTtsMemoToSqlite(memo: Partial<TtsMemoRecord> & {
  title: string;
  textPrompt: string;
  voiceType: 'male' | 'female' | 'child';
}): TtsMemoRecord {
  if (!db) throw new Error('Database not initialized');

  const id = memo.id || `tts_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const userEmail = (memo.userEmail || 'chinna.tamil2000@gmail.com').toLowerCase().trim();
  const title = memo.title.trim();
  const textPrompt = memo.textPrompt.trim();
  const voiceType = memo.voiceType || 'male';
  const voiceName = memo.voiceName || (voiceType === 'male' ? 'Fenrir' : voiceType === 'female' ? 'Kore' : 'Puck');
  const audioUrl = memo.audioUrl || `/api/tts/memos/${id}/audio`;
  const audioContentBase64 = memo.audioContentBase64 || null;
  const audioMimeType = memo.audioMimeType || 'audio/wav';
  const durationSeconds = Number(memo.durationSeconds || 0);
  const fileSizeBytes = Number(memo.fileSizeBytes || (audioContentBase64 ? Math.round((audioContentBase64.length * 3) / 4) : 0));
  const driveFileId = memo.driveFileId || null;
  const driveWebViewLink = memo.driveWebViewLink || null;
  const driveFolderPath = memo.driveFolderPath || 'Family Circle/Text to Speech Memos';
  const isFavorite = memo.isFavorite ? 1 : 0;
  const playCount = Number(memo.playCount || 0);
  const createdAt = memo.createdAt || new Date().toISOString();
  const updatedAt = new Date().toISOString();

  db.run(`
    INSERT OR REPLACE INTO tts_memos (
      id, user_email, title, text_prompt, voice_type, voice_name,
      audio_url, audio_content_base64, audio_mime_type,
      duration_seconds, file_size_bytes, drive_file_id, drive_web_view_link,
      drive_folder_path, is_favorite, play_count, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    id, userEmail, title, textPrompt, voiceType, voiceName,
    audioUrl, audioContentBase64, audioMimeType,
    durationSeconds, fileSizeBytes, driveFileId, driveWebViewLink,
    driveFolderPath, isFavorite, playCount, createdAt, updatedAt
  ]);

  scheduleSave();

  return {
    id,
    userEmail,
    title,
    textPrompt,
    voiceType,
    voiceName,
    audioUrl,
    audioMimeType,
    durationSeconds,
    fileSizeBytes,
    driveFileId: driveFileId || undefined,
    driveWebViewLink: driveWebViewLink || undefined,
    driveFolderPath,
    isFavorite: isFavorite === 1,
    playCount,
    createdAt,
    updatedAt,
  };
}

export function getTtsMemosFromSqlite(userEmail?: string): TtsMemoRecord[] {
  if (!db) return [];
  try {
    let query = 'SELECT id, user_email, title, text_prompt, voice_type, voice_name, audio_url, audio_mime_type, duration_seconds, file_size_bytes, drive_file_id, drive_web_view_link, drive_folder_path, is_favorite, play_count, created_at, updated_at FROM tts_memos';
    const params: any[] = [];
    if (userEmail && userEmail.trim()) {
      query += ' WHERE user_email = ?';
      params.push(userEmail.toLowerCase().trim());
    }
    query += ' ORDER BY created_at DESC';

    const stmt = db.prepare(query);
    stmt.bind(params);
    const results: TtsMemoRecord[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      results.push({
        id: String(row.id),
        userEmail: String(row.user_email),
        title: String(row.title),
        textPrompt: String(row.text_prompt),
        voiceType: row.voice_type as 'male' | 'female' | 'child',
        voiceName: String(row.voice_name),
        audioUrl: row.audio_url ? String(row.audio_url) : `/api/tts/memos/${row.id}/audio`,
        audioMimeType: String(row.audio_mime_type || 'audio/wav'),
        durationSeconds: Number(row.duration_seconds || 0),
        fileSizeBytes: Number(row.file_size_bytes || 0),
        driveFileId: row.drive_file_id ? String(row.drive_file_id) : undefined,
        driveWebViewLink: row.drive_web_view_link ? String(row.drive_web_view_link) : undefined,
        driveFolderPath: String(row.drive_folder_path || 'Family Circle/Text to Speech Memos'),
        isFavorite: Number(row.is_favorite) === 1,
        playCount: Number(row.play_count || 0),
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at),
      });
    }
    stmt.free();
    return results;
  } catch (err) {
    console.warn('Failed to query tts_memos from SQLite:', err);
    return [];
  }
}

export function getTtsMemoAudioContentFromSqlite(id: string): { audioContentBase64: string; audioMimeType: string } | null {
  if (!db) return null;
  try {
    const stmt = db.prepare('SELECT audio_content_base64, audio_mime_type FROM tts_memos WHERE id = ?');
    stmt.bind([id]);
    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      if (row.audio_content_base64) {
        return {
          audioContentBase64: String(row.audio_content_base64),
          audioMimeType: String(row.audio_mime_type || 'audio/wav'),
        };
      }
    } else {
      stmt.free();
    }
    return null;
  } catch (err) {
    console.warn('Failed to retrieve TTS memo audio content:', err);
    return null;
  }
}

export function deleteTtsMemoFromSqlite(id: string, userEmail?: string): boolean {
  if (!db) return false;
  try {
    if (userEmail && userEmail.trim()) {
      db.run('DELETE FROM tts_memos WHERE id = ? AND user_email = ?', [id, userEmail.toLowerCase().trim()]);
    } else {
      db.run('DELETE FROM tts_memos WHERE id = ?', [id]);
    }
    scheduleSave();
    return true;
  } catch (err) {
    console.warn('Failed to delete TTS memo from SQLite:', err);
    return false;
  }
}

export function toggleTtsMemoFavoriteInSqlite(id: string, isFavorite?: boolean): boolean {
  if (!db) return false;
  try {
    if (typeof isFavorite === 'boolean') {
      db.run('UPDATE tts_memos SET is_favorite = ?, updated_at = ? WHERE id = ?', [isFavorite ? 1 : 0, new Date().toISOString(), id]);
    } else {
      db.run('UPDATE tts_memos SET is_favorite = (CASE WHEN is_favorite = 1 THEN 0 ELSE 1 END), updated_at = ? WHERE id = ?', [new Date().toISOString(), id]);
    }
    scheduleSave();
    return true;
  } catch (err) {
    console.warn('Failed to toggle TTS memo favorite in SQLite:', err);
    return false;
  }
}

// -------------------------------------------------------------
// REAL-TIME LANGUAGE TRANSLATIONS
// -------------------------------------------------------------
export interface LanguageTranslationRecord {
  id: string;
  userEmail: string;
  sourceText: string;
  translatedText: string;
  sourceLang: string;
  targetLang: string;
  phonetics?: string;
  audioContentBase64?: string;
  audioMimeType?: string;
  driveFileId?: string;
  driveWebViewLink?: string;
  driveFolderPath?: string;
  notes?: string;
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
}

export function saveTranslationToSqlite(t: Partial<LanguageTranslationRecord> & {
  sourceText: string;
  translatedText: string;
  sourceLang: string;
  targetLang: string;
}): LanguageTranslationRecord {
  if (!db) throw new Error('Database not initialized');

  const id = t.id || `trans_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const userEmail = (t.userEmail || 'chinna.tamil2000@gmail.com').toLowerCase().trim();
  const sourceText = t.sourceText.trim();
  const translatedText = t.translatedText.trim();
  const sourceLang = t.sourceLang || 'en';
  const targetLang = t.targetLang || 'ta';
  const phonetics = t.phonetics || null;
  const audioContentBase64 = t.audioContentBase64 || null;
  const audioMimeType = t.audioMimeType || 'audio/wav';
  const driveFileId = t.driveFileId || null;
  const driveWebViewLink = t.driveWebViewLink || null;
  const driveFolderPath = t.driveFolderPath || 'Family Circle/Language Translations';
  const notes = t.notes || null;
  const isFavorite = t.isFavorite ? 1 : 0;
  const createdAt = t.createdAt || new Date().toISOString();
  const updatedAt = new Date().toISOString();

  db.run(`
    INSERT OR REPLACE INTO language_translations (
      id, user_email, source_text, translated_text, source_lang, target_lang,
      phonetics, audio_content_base64, audio_mime_type, drive_file_id, drive_web_view_link,
      drive_folder_path, notes, is_favorite, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    id, userEmail, sourceText, translatedText, sourceLang, targetLang,
    phonetics, audioContentBase64, audioMimeType, driveFileId, driveWebViewLink,
    driveFolderPath, notes, isFavorite, createdAt, updatedAt
  ]);

  scheduleSave();

  return {
    id,
    userEmail,
    sourceText,
    translatedText,
    sourceLang,
    targetLang,
    phonetics: phonetics || undefined,
    audioMimeType,
    driveFileId: driveFileId || undefined,
    driveWebViewLink: driveWebViewLink || undefined,
    driveFolderPath,
    notes: notes || undefined,
    isFavorite: isFavorite === 1,
    createdAt,
    updatedAt,
  };
}

export function getTranslationsFromSqlite(userEmail?: string): LanguageTranslationRecord[] {
  if (!db) return [];
  try {
    let query = 'SELECT id, user_email, source_text, translated_text, source_lang, target_lang, phonetics, audio_mime_type, drive_file_id, drive_web_view_link, drive_folder_path, notes, is_favorite, created_at, updated_at FROM language_translations';
    const params: any[] = [];
    if (userEmail && userEmail.trim()) {
      query += ' WHERE user_email = ?';
      params.push(userEmail.toLowerCase().trim());
    }
    query += ' ORDER BY created_at DESC';

    const stmt = db.prepare(query);
    stmt.bind(params);
    const results: LanguageTranslationRecord[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      results.push({
        id: String(row.id),
        userEmail: String(row.user_email),
        sourceText: String(row.source_text),
        translatedText: String(row.translated_text),
        sourceLang: String(row.source_lang),
        targetLang: String(row.target_lang),
        phonetics: row.phonetics ? String(row.phonetics) : undefined,
        audioMimeType: String(row.audio_mime_type || 'audio/wav'),
        driveFileId: row.drive_file_id ? String(row.drive_file_id) : undefined,
        driveWebViewLink: row.drive_web_view_link ? String(row.drive_web_view_link) : undefined,
        driveFolderPath: String(row.drive_folder_path || 'Family Circle/Language Translations'),
        notes: row.notes ? String(row.notes) : undefined,
        isFavorite: Number(row.is_favorite) === 1,
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at),
      });
    }
    stmt.free();
    return results;
  } catch (err) {
    console.warn('Failed to query language_translations from SQLite:', err);
    return [];
  }
}

export function deleteTranslationFromSqlite(id: string, userEmail?: string): boolean {
  if (!db) return false;
  try {
    if (userEmail && userEmail.trim()) {
      db.run('DELETE FROM language_translations WHERE id = ? AND user_email = ?', [id, userEmail.toLowerCase().trim()]);
    } else {
      db.run('DELETE FROM language_translations WHERE id = ?', [id]);
    }
    scheduleSave();
    return true;
  } catch (err) {
    console.warn('Failed to delete translation from SQLite:', err);
    return false;
  }
}

export function toggleTranslationFavoriteInSqlite(id: string, isFavorite?: boolean): boolean {
  if (!db) return false;
  try {
    if (typeof isFavorite === 'boolean') {
      db.run('UPDATE language_translations SET is_favorite = ?, updated_at = ? WHERE id = ?', [isFavorite ? 1 : 0, new Date().toISOString(), id]);
    } else {
      db.run('UPDATE language_translations SET is_favorite = (CASE WHEN is_favorite = 1 THEN 0 ELSE 1 END), updated_at = ? WHERE id = ?', [new Date().toISOString(), id]);
    }
    scheduleSave();
    return true;
  } catch (err) {
    console.warn('Failed to toggle translation favorite in SQLite:', err);
    return false;
  }
}

// =========================================================================
// APPLE BOOKS LIBRARY SQLite STORE & OFFLINE CACHE
// =========================================================================

export interface AppleBookRecord {
  id: string;
  userEmail: string;
  title: string;
  author: string;
  genre: string;
  subtitle?: string;
  description?: string;
  coverGradient?: string;
  accentColor?: string;
  rating?: number;
  reviewCount?: number;
  totalPages?: number;
  currentPage?: number;
  currentChapterId?: string;
  progressPercent?: number;
  isPdf?: boolean;
  pdfFileName?: string;
  pdfFileSize?: string;
  pdfUrl?: string;
  driveFileId?: string;
  driveWebViewLink?: string;
  driveFolderPath?: string;
  chapters?: any[];
  bookmarks?: any[];
  highlights?: any[];
  isLocalCached?: boolean;
  hasPdfBlob?: boolean;
  addedAt: string;
  updatedAt: string;
}

export function saveAppleBookToSqlite(book: Partial<AppleBookRecord> & {
  title: string;
  id?: string;
  author?: string;
  genre?: string;
  pdfContentBase64?: string;
}): AppleBookRecord {
  if (!db) throw new Error('Database not initialized');
  const now = new Date().toISOString();
  const id = book.id || `book-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const cleanEmail = (book.userEmail || 'chinna.tamil2000@gmail.com').toLowerCase().trim();
  const chaptersJson = book.chapters ? JSON.stringify(book.chapters) : '[]';
  const bookmarksJson = book.bookmarks ? JSON.stringify(book.bookmarks) : '[]';
  const highlightsJson = book.highlights ? JSON.stringify(book.highlights) : '[]';

  let finalPdfUrl = book.pdfUrl;
  if (book.pdfContentBase64 && book.pdfContentBase64.length > 20) {
    finalPdfUrl = `/api/books/library/${id}/pdf`;
  }

  db.run(
    `INSERT INTO apple_books_library (
      id, user_email, title, author, genre, subtitle, description,
      cover_gradient, accent_color, rating, review_count, total_pages, current_page,
      current_chapter_id, progress_percent, is_pdf, pdf_file_name, pdf_file_size,
      pdf_url, pdf_content_base64, drive_file_id, drive_web_view_link, drive_folder_path,
      chapters_json, bookmarks_json, highlights_json, is_local_cached, added_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      user_email = excluded.user_email,
      title = excluded.title,
      author = excluded.author,
      genre = excluded.genre,
      subtitle = COALESCE(excluded.subtitle, subtitle),
      description = COALESCE(excluded.description, description),
      cover_gradient = COALESCE(excluded.cover_gradient, cover_gradient),
      accent_color = COALESCE(excluded.accent_color, accent_color),
      rating = COALESCE(excluded.rating, rating),
      review_count = COALESCE(excluded.review_count, review_count),
      total_pages = COALESCE(excluded.total_pages, total_pages),
      current_page = COALESCE(excluded.current_page, current_page),
      current_chapter_id = COALESCE(excluded.current_chapter_id, current_chapter_id),
      progress_percent = COALESCE(excluded.progress_percent, progress_percent),
      is_pdf = COALESCE(excluded.is_pdf, is_pdf),
      pdf_file_name = COALESCE(excluded.pdf_file_name, pdf_file_name),
      pdf_file_size = COALESCE(excluded.pdf_file_size, pdf_file_size),
      pdf_url = COALESCE(excluded.pdf_url, pdf_url),
      pdf_content_base64 = CASE WHEN excluded.pdf_content_base64 IS NOT NULL AND length(excluded.pdf_content_base64) > 10 THEN excluded.pdf_content_base64 ELSE pdf_content_base64 END,
      drive_file_id = COALESCE(excluded.drive_file_id, drive_file_id),
      drive_web_view_link = COALESCE(excluded.drive_web_view_link, drive_web_view_link),
      drive_folder_path = COALESCE(excluded.drive_folder_path, drive_folder_path),
      chapters_json = CASE WHEN excluded.chapters_json != '[]' THEN excluded.chapters_json ELSE chapters_json END,
      bookmarks_json = COALESCE(excluded.bookmarks_json, bookmarks_json),
      highlights_json = COALESCE(excluded.highlights_json, highlights_json),
      is_local_cached = 1,
      updated_at = excluded.updated_at`,
    [
      id,
      cleanEmail,
      book.title,
      book.author || 'Personal Library',
      book.genre || 'PDF & Documents',
      book.subtitle || '',
      book.description || '',
      book.coverGradient || 'from-amber-600 to-amber-900',
      book.accentColor || '#f59e0b',
      book.rating || 5,
      book.reviewCount || 1,
      book.totalPages || 10,
      book.currentPage || 1,
      book.currentChapterId || 'ch1',
      book.progressPercent || 0,
      book.isPdf ? 1 : 0,
      book.pdfFileName || `${book.title}.pdf`,
      book.pdfFileSize || '',
      finalPdfUrl || '',
      book.pdfContentBase64 || null,
      book.driveFileId || null,
      book.driveWebViewLink || null,
      book.driveFolderPath || 'Family Circle/Apple Books',
      chaptersJson,
      bookmarksJson,
      highlightsJson,
      1,
      book.addedAt || now,
      now,
    ]
  );
  scheduleSave();
  return {
    ...book,
    id,
    userEmail: cleanEmail,
    title: book.title,
    author: book.author || 'Personal Library',
    genre: book.genre || 'PDF & Documents',
    pdfUrl: finalPdfUrl,
    isLocalCached: true,
    addedAt: book.addedAt || now,
    updatedAt: now,
  } as AppleBookRecord;
}

export function getAppleBooksFromSqlite(userEmail?: string): AppleBookRecord[] {
  if (!db) return [];
  try {
    let query = `
      SELECT id, user_email, title, author, genre, subtitle, description,
             cover_gradient, accent_color, rating, review_count, total_pages,
             current_page, current_chapter_id, progress_percent, is_pdf,
             pdf_file_name, pdf_file_size, pdf_url, drive_file_id,
             drive_web_view_link, drive_folder_path, chapters_json,
             bookmarks_json, highlights_json, is_local_cached, added_at, updated_at,
             (CASE WHEN pdf_content_base64 IS NOT NULL AND length(pdf_content_base64) > 10 THEN 1 ELSE 0 END) as has_pdf_blob
      FROM apple_books_library
    `;
    const params: any[] = [];
    if (userEmail && userEmail.trim()) {
      query += ' WHERE user_email = ?';
      params.push(userEmail.toLowerCase().trim());
    }
    query += ' ORDER BY updated_at DESC';

    const stmt = db.prepare(query);
    stmt.bind(params);
    const books: AppleBookRecord[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      let chapters = [];
      let bookmarks = [];
      let highlights = [];
      try { chapters = JSON.parse(String(row.chapters_json || '[]')); } catch { }
      try { bookmarks = JSON.parse(String(row.bookmarks_json || '[]')); } catch { }
      try { highlights = JSON.parse(String(row.highlights_json || '[]')); } catch { }

      const hasPdfBlob = Number(row.has_pdf_blob) === 1;
      const id = String(row.id);
      const pdfUrl = hasPdfBlob ? `/api/books/library/${id}/pdf` : (row.pdf_url ? String(row.pdf_url) : undefined);

      books.push({
        id,
        userEmail: String(row.user_email),
        title: String(row.title),
        author: String(row.author),
        genre: String(row.genre),
        subtitle: row.subtitle ? String(row.subtitle) : undefined,
        description: row.description ? String(row.description) : undefined,
        coverGradient: String(row.cover_gradient || 'from-amber-600 to-amber-900'),
        accentColor: String(row.accent_color || '#f59e0b'),
        rating: Number(row.rating || 5),
        reviewCount: Number(row.review_count || 1),
        totalPages: Number(row.total_pages || 1),
        currentPage: Number(row.current_page || 1),
        currentChapterId: String(row.current_chapter_id || 'ch1'),
        progressPercent: Number(row.progress_percent || 0),
        isPdf: Number(row.is_pdf) === 1,
        pdfFileName: row.pdf_file_name ? String(row.pdf_file_name) : undefined,
        pdfFileSize: row.pdf_file_size ? String(row.pdf_file_size) : undefined,
        pdfUrl,
        driveFileId: row.drive_file_id ? String(row.drive_file_id) : undefined,
        driveWebViewLink: row.drive_web_view_link ? String(row.drive_web_view_link) : undefined,
        driveFolderPath: String(row.drive_folder_path || 'Family Circle/Apple Books'),
        chapters,
        bookmarks,
        highlights,
        isLocalCached: hasPdfBlob || Number(row.is_local_cached) === 1,
        hasPdfBlob,
        addedAt: String(row.added_at),
        updatedAt: String(row.updated_at),
      });
    }
    stmt.free();
    return books;
  } catch (err) {
    console.warn('Failed to query apple_books_library from SQLite:', err);
    return [];
  }
}

export function deleteAppleBookFromSqlite(id: string, userEmail?: string): boolean {
  if (!db) return false;
  try {
    if (userEmail && userEmail.trim()) {
      db.run('DELETE FROM apple_books_library WHERE id = ? AND user_email = ?', [id, userEmail.toLowerCase().trim()]);
    } else {
      db.run('DELETE FROM apple_books_library WHERE id = ?', [id]);
    }
    scheduleSave();
    return true;
  } catch (err) {
    console.warn('Failed to delete book from SQLite:', err);
    return false;
  }
}

export function getBookPdfContentFromSqlite(id: string): { pdfContentBase64?: string; pdfFileName?: string; driveFileId?: string } | null {
  if (!db) return null;
  try {
    const stmt = db.prepare('SELECT pdf_content_base64, pdf_file_name, drive_file_id FROM apple_books_library WHERE id = ?');
    stmt.bind([id]);
    if (stmt.step()) {
      const row = stmt.getAsObject();
      const res = {
        pdfContentBase64: row.pdf_content_base64 ? String(row.pdf_content_base64) : undefined,
        pdfFileName: row.pdf_file_name ? String(row.pdf_file_name) : undefined,
        driveFileId: row.drive_file_id ? String(row.drive_file_id) : undefined,
      };
      stmt.free();
      return res;
    }
    stmt.free();
    return null;
  } catch (err) {
    console.warn('Failed to get book PDF content from SQLite:', err);
    return null;
  }
}

export function saveBookPdfContentToSqlite(id: string, pdfContentBase64: string, pdfFileName?: string): boolean {
  if (!db) return false;
  try {
    const now = new Date().toISOString();
    if (pdfFileName) {
      db.run('UPDATE apple_books_library SET pdf_content_base64 = ?, pdf_file_name = ?, pdf_url = ?, is_local_cached = 1, updated_at = ? WHERE id = ?', [
        pdfContentBase64,
        pdfFileName,
        `/api/books/library/${id}/pdf`,
        now,
        id,
      ]);
    } else {
      db.run('UPDATE apple_books_library SET pdf_content_base64 = ?, pdf_url = ?, is_local_cached = 1, updated_at = ? WHERE id = ?', [
        pdfContentBase64,
        `/api/books/library/${id}/pdf`,
        now,
        id,
      ]);
    }
    scheduleSave();
    return true;
  } catch (err) {
    console.warn('Failed to save book PDF content to SQLite:', err);
    return false;
  }
}

export function updateBookProgressInSqlite(id: string, page: number, chapterId?: string, percent?: number): boolean {
  if (!db) return false;
  try {
    const now = new Date().toISOString();
    db.run(
      `UPDATE apple_books_library 
       SET current_page = ?, 
           current_chapter_id = COALESCE(?, current_chapter_id), 
           progress_percent = COALESCE(?, progress_percent), 
           updated_at = ? 
       WHERE id = ?`,
      [page, chapterId || null, percent !== undefined ? percent : null, now, id]
    );
    scheduleSave();
    return true;
  } catch (err) {
    console.warn('Failed to update book progress in SQLite:', err);
    return false;
  }
}

// =========================================================================
// 3GB MAXIMUM SQLITE STORAGE QUOTA & BREAKDOWN ANALYZER
// =========================================================================

export const MAX_SQLITE_STORAGE_BYTES = 3 * 1024 * 1024 * 1024; // 3GB Quota (3,221,225,472 bytes)

export interface Sqlite3GbStorageQuota {
  quotaBytes: number;
  quotaGb: number;
  totalUsedBytes: number;
  totalUsedMb: number;
  totalUsedGb: number;
  freeBytes: number;
  freeMb: number;
  freeGb: number;
  percentUsed: number;
  isNearQuota: boolean;
  isQuotaExceeded: boolean;
  dbFileSizeFormatted: string;
  breakdown: {
    books: { count: number; bytes: number; mb: number };
    music: { count: number; bytes: number; mb: number };
    memos: { count: number; bytes: number; mb: number };
    tts: { count: number; bytes: number; mb: number };
    translations: { count: number; bytes: number; mb: number };
    driveFiles: { count: number; bytes: number; mb: number };
    aiCreations: { count: number; bytes: number; mb: number };
    keepNotes: { count: number; bytes: number; mb: number };
    other: { bytes: number; mb: number };
  };
  lastUpdated: string;
}

export function getSqlite3GbStorageQuotaStats(): Sqlite3GbStorageQuota {
  if (!db) {
    return {
      quotaBytes: MAX_SQLITE_STORAGE_BYTES,
      quotaGb: 3.0,
      totalUsedBytes: 0,
      totalUsedMb: 0,
      totalUsedGb: 0,
      freeBytes: MAX_SQLITE_STORAGE_BYTES,
      freeMb: 3072,
      freeGb: 3.0,
      percentUsed: 0,
      isNearQuota: false,
      isQuotaExceeded: false,
      dbFileSizeFormatted: '0 KB',
      breakdown: {
        books: { count: 0, bytes: 0, mb: 0 },
        music: { count: 0, bytes: 0, mb: 0 },
        memos: { count: 0, bytes: 0, mb: 0 },
        tts: { count: 0, bytes: 0, mb: 0 },
        translations: { count: 0, bytes: 0, mb: 0 },
        driveFiles: { count: 0, bytes: 0, mb: 0 },
        aiCreations: { count: 0, bytes: 0, mb: 0 },
        keepNotes: { count: 0, bytes: 0, mb: 0 },
        other: { bytes: 0, mb: 0 },
      },
      lastUpdated: new Date().toISOString(),
    };
  }

  let dbFileSizeBytes = 0;
  try {
    if (fs.existsSync(DB_PATH)) {
      dbFileSizeBytes = fs.statSync(DB_PATH).size;
    }
  } catch { }

  const getTableStats = (tableName: string, blobCol?: string, extraCol?: string) => {
    try {
      let sql = `SELECT COUNT(*) as cnt`;
      if (blobCol && extraCol) {
        sql += `, COALESCE(SUM(LENGTH(COALESCE(${blobCol}, '')) + LENGTH(COALESCE(${extraCol}, '')) + 1024), 0) as bts FROM ${tableName}`;
      } else if (blobCol) {
        sql += `, COALESCE(SUM(LENGTH(COALESCE(${blobCol}, '')) + 1024), 0) as bts FROM ${tableName}`;
      } else {
        sql += `, COALESCE(COUNT(*) * 1024, 0) as bts FROM ${tableName}`;
      }
      const res = db!.exec(sql);
      const count = Number(res[0]?.values[0]?.[0] || 0);
      const bytes = Number(res[0]?.values[0]?.[1] || 0);
      return { count, bytes, mb: Number((bytes / (1024 * 1024)).toFixed(2)) };
    } catch {
      return { count: 0, bytes: 0, mb: 0 };
    }
  };

  const booksStats = getTableStats('apple_books_library', 'pdf_content_base64', 'chapters_json');
  const musicStats = getTableStats('musical_library_tracks', 'audio_content_base64', 'lyrics');
  const memosStats = getTableStats('voice_recordings', 'audio_content_base64', 'transcription');
  const ttsStats = getTableStats('tts_memos', 'audio_content_base64');
  const translationsStats = getTableStats('language_translations', 'audio_content_base64');
  const driveStats = getTableStats('google_drive_files', 'file_content_base64');
  const aiStats = getTableStats('ai_studio_creations', 'metadata_json');
  const keepStats = getTableStats('google_keep_notes', 'body');

  const contentTotalBytes =
    booksStats.bytes +
    musicStats.bytes +
    memosStats.bytes +
    ttsStats.bytes +
    translationsStats.bytes +
    driveStats.bytes +
    aiStats.bytes +
    keepStats.bytes;

  const totalUsedBytes = Math.max(dbFileSizeBytes, contentTotalBytes);
  const totalUsedMb = Number((totalUsedBytes / (1024 * 1024)).toFixed(2));
  const totalUsedGb = Number((totalUsedBytes / (1024 * 1024 * 1024)).toFixed(3));
  const freeBytes = Math.max(0, MAX_SQLITE_STORAGE_BYTES - totalUsedBytes);
  const freeMb = Number((freeBytes / (1024 * 1024)).toFixed(2));
  const freeGb = Number((freeBytes / (1024 * 1024 * 1024)).toFixed(3));
  const percentUsed = Number(((totalUsedBytes / MAX_SQLITE_STORAGE_BYTES) * 100).toFixed(2));

  return {
    quotaBytes: MAX_SQLITE_STORAGE_BYTES,
    quotaGb: 3.0,
    totalUsedBytes,
    totalUsedMb,
    totalUsedGb,
    freeBytes,
    freeMb,
    freeGb,
    percentUsed,
    isNearQuota: percentUsed >= 85,
    isQuotaExceeded: totalUsedBytes >= MAX_SQLITE_STORAGE_BYTES,
    dbFileSizeFormatted: `${(dbFileSizeBytes / (1024 * 1024)).toFixed(2)} MB`,
    breakdown: {
      books: booksStats,
      music: musicStats,
      memos: memosStats,
      tts: ttsStats,
      translations: translationsStats,
      driveFiles: driveStats,
      aiCreations: aiStats,
      keepNotes: keepStats,
      other: {
        bytes: Math.max(0, dbFileSizeBytes - contentTotalBytes),
        mb: Number((Math.max(0, dbFileSizeBytes - contentTotalBytes) / (1024 * 1024)).toFixed(2)),
      },
    },
    lastUpdated: new Date().toISOString(),
  };
}

// -------------------------------------------------------------
// Diagnostics & SQLite Database Stats
// -------------------------------------------------------------
export function getSqliteDbStats() {
  if (!db) {
    return {
      status: 'offline',
      path: DB_PATH,
      sizeBytes: 0,
      tables: {},
      totalRows: 0,
      quota3Gb: getSqlite3GbStorageQuotaStats(),
    };
  }

  let sizeBytes = 0;
  try {
    if (fs.existsSync(DB_PATH)) {
      sizeBytes = fs.statSync(DB_PATH).size;
    }
  } catch (e) { }

  const tables = [
    'activation_codes',
    'device_peers',
    'intercom_messages',
    'emergency_sos_events',
    'live_location_pings',
    'shared_family_records',
    'inter_instance_communications',
    'hub_api_keys',
    'assistant_memory_store',
    'voice_assistant_conversations',
    'google_keep_notes',
    'google_drive_files',
    'device_storage_metrics',
    'ai_studio_creations',
    'musical_library_tracks',
    'voice_recordings',
    'tts_memos',
    'language_translations',
    'apple_books_library',
  ];

  const tableCounts: Record<string, number> = {};
  let totalRows = 0;

  for (const t of tables) {
    try {
      const res = db.exec(`SELECT COUNT(*) FROM ${t}`);
      const c = (res[0]?.values[0]?.[0] as number) || 0;
      tableCounts[t] = c;
      totalRows += c;
    } catch {
      tableCounts[t] = 0;
    }
  }

  return {
    status: 'connected_and_active',
    engine: 'SQLite 3 (WebAssembly Embedded Server-Authoritative)',
    path: DB_PATH,
    sizeBytes,
    sizeFormatted: `${(sizeBytes / 1024).toFixed(1)} KB`,
    totalRows,
    tableCounts,
    quota3Gb: getSqlite3GbStorageQuotaStats(),
    lastSaved: new Date().toISOString(),
  };
}
