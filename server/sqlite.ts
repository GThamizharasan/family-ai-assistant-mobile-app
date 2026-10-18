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
}

let db: Database | null = null;
let saveDebounceTimer: NodeJS.Timeout | null = null;

// Ensure disk storage directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Persist SQLite database to disk
export function saveSqliteToDisk() {
  if (!db) return;
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  } catch (err) {
    console.error('Failed to save SQLite database to disk:', err);
  }
}

function scheduleSave() {
  if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
  saveDebounceTimer = setTimeout(() => {
    saveSqliteToDisk();
  }, 200);
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
      uploaded_by TEXT DEFAULT 'voice_assistant',
      modified_time TEXT NOT NULL
    );
  `);

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
    } catch {}
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

  db.run(
    `INSERT INTO voice_assistant_conversations (id, user_email, family_id, role, content, emotion, action_suggestion, timestamp)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, record.userEmail.toLowerCase().trim(), familyId, record.role, record.content, record.emotion || null, record.actionSuggestion || null, now]
  );
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
    } catch {}
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
  } catch {}

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
    `INSERT INTO google_drive_files (id, user_email, name, mime_type, size, size_bytes, web_view_link, file_content_base64, uploaded_by, modified_time)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       mime_type = excluded.mime_type,
       size = excluded.size,
       size_bytes = excluded.size_bytes,
       web_view_link = excluded.web_view_link,
       file_content_base64 = excluded.file_content_base64,
       modified_time = excluded.modified_time`,
    [id, cleanEmail, file.name, mimeType, size, sizeBytes, webViewLink, file.fileContentBase64 || null, uploadedBy, now]
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
    uploadedBy,
    modifiedTime: now,
  };
}

export function getGoogleDriveFilesFromSqlite(userEmail: string): GoogleDriveFileRecord[] {
  if (!db) return [];
  const cleanEmail = (userEmail || '').toLowerCase().trim();
  const res = db.exec(
    `SELECT id, user_email, name, mime_type, size, size_bytes, web_view_link, file_content_base64, uploaded_by, modified_time
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
    };
  }

  let sizeBytes = 0;
  try {
    if (fs.existsSync(DB_PATH)) {
      sizeBytes = fs.statSync(DB_PATH).size;
    }
  } catch (e) {}

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
    lastSaved: new Date().toISOString(),
  };
}
