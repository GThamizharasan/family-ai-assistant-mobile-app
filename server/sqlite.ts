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
  `);

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
