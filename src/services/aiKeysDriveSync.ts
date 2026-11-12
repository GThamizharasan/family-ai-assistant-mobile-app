// Sovereign Family Circle AI Model Architecture & Key Sync Engine
// Persists AI Engine keys and model architecture configuration to:
// 1. Local SQLite store (table: hub_api_keys via /api/config/keys/bulk)
// 2. Google Drive under "Family Circle / AI Model Architecture / ai_model_architecture_keys.json"
// 3. Google Drive SQLite Mirror (table: google_drive_files via /api/google/drive/upload)

import { AiProvider, CustomAiModelConfig } from '../types';
import { getOrCreateGoogleDriveFolder } from './googleWorkspace';
import { getApiUrl } from './api';

export const AI_KEYS_DRIVE_ROOT_FOLDER = 'Family Circle';
export const AI_KEYS_DRIVE_SUBFOLDER = 'AI Model Architecture';
export const AI_KEYS_DRIVE_FILE_NAME = 'ai_model_architecture_keys.json';

export interface AiArchitectureSyncPayload {
  activeProvider: AiProvider;
  activeModel: string;
  geminiKey?: string;
  nvidiaKey?: string;
  openaiKey?: string;
  anthropicKey?: string;
  customConfig?: CustomAiModelConfig;
  userEmail?: string;
}

export interface AiArchitectureSyncResult {
  success: boolean;
  sqliteSaved: boolean;
  sqliteCount: number;
  driveSaved: boolean;
  driveFileId?: string;
  driveWebViewLink?: string;
  driveFolderId?: string;
  driveFolderPath?: string;
  error?: string;
  message?: string;
}

export interface StoredAiArchitectureJson {
  appName: string;
  schemaVersion: string;
  savedAt: string;
  userEmail: string;
  activeProvider: AiProvider;
  activeModel: string;
  keys: {
    GEMINI_API_KEY?: string;
    NVIDIA_API_KEY?: string;
    OPENAI_API_KEY?: string;
    ANTHROPIC_API_KEY?: string;
  };
  customConfig?: CustomAiModelConfig;
}

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
 * Save AI Engine keys to both SQLite (hub_api_keys) and Google Drive under "Family Circle"
 */
export async function saveAiArchitectureKeysToSqliteAndDrive(
  payload: AiArchitectureSyncPayload
): Promise<AiArchitectureSyncResult> {
  const result: AiArchitectureSyncResult = {
    success: false,
    sqliteSaved: false,
    sqliteCount: 0,
    driveSaved: false,
  };

  const userEmail = payload.userEmail || (typeof window !== 'undefined' ? localStorage.getItem('userEmail') : null) || 'chinna.tamil2000@gmail.com';

  // 1. Save to Local Storage Cache
  if (typeof window !== 'undefined') {
    if (payload.geminiKey) localStorage.setItem('aura_custom_gemini_api_key', payload.geminiKey.trim());
    if (payload.nvidiaKey) localStorage.setItem('aura_nvidia_api_key', payload.nvidiaKey.trim());
    if (payload.openaiKey) localStorage.setItem('aura_openai_api_key', payload.openaiKey.trim());
    if (payload.anthropicKey) localStorage.setItem('aura_anthropic_api_key', payload.anthropicKey.trim());
    if (payload.customConfig) localStorage.setItem('aura_custom_ai_config', JSON.stringify(payload.customConfig));
    localStorage.setItem('aura_ai_provider', payload.activeProvider);
    localStorage.setItem(`aura_${payload.activeProvider}_model`, payload.activeModel);
  }

  // 2. Save to SQLite (hub_api_keys) via /api/config/keys/bulk
  try {
    const keysToPersist = [
      {
        keyName: 'GEMINI_API_KEY',
        keyValue: (payload.geminiKey || '').trim(),
        description: 'Google Gemini 3.5 & Multimodal API Key',
      },
      {
        keyName: 'NVIDIA_API_KEY',
        keyValue: (payload.nvidiaKey || '').trim(),
        description: 'NVIDIA AI Foundation Model (NIM) API Key',
      },
      {
        keyName: 'OPENAI_API_KEY',
        keyValue: (payload.openaiKey || '').trim(),
        description: 'OpenAI GPT-4o / Reasoning API Key',
      },
      {
        keyName: 'ANTHROPIC_API_KEY',
        keyValue: (payload.anthropicKey || '').trim(),
        description: 'Anthropic Claude 3.7 / 3.5 Sonnet API Key',
      },
      {
        keyName: 'DEFAULT_AI_PROVIDER',
        keyValue: payload.activeProvider,
        description: 'Default Active AI Engine Provider',
      },
      {
        keyName: payload.activeProvider === 'nvidia' ? 'DEFAULT_NVIDIA_MODEL' : 'DEFAULT_GEMINI_MODEL',
        keyValue: payload.activeModel,
        description: `Default Model for ${payload.activeProvider.toUpperCase()}`,
      },
    ];

    if (payload.customConfig) {
      keysToPersist.push(
        {
          keyName: 'CUSTOM_AI_ENDPOINT',
          keyValue: payload.customConfig.endpointUrl || '',
          description: 'Custom / Local AI Endpoint URL',
        },
        {
          keyName: 'CUSTOM_AI_MODEL',
          keyValue: payload.customConfig.modelId || '',
          description: 'Custom AI Model Identifier',
        },
        {
          keyName: 'CUSTOM_AI_KEY',
          keyValue: payload.customConfig.apiKey || '',
          description: 'Custom AI Endpoint Authorization Key',
        }
      );
    }

    const sqliteRes = await fetch(getApiUrl('/api/config/keys/bulk'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keys: keysToPersist }),
    });

    if (sqliteRes.ok) {
      const sqliteData = await sqliteRes.json();
      result.sqliteSaved = true;
      result.sqliteCount = sqliteData.count || keysToPersist.length;
    } else {
      console.warn('[AI Keys Sync] SQLite bulk update failed with status:', sqliteRes.status);
    }
  } catch (sqliteErr: any) {
    console.warn('[AI Keys Sync] SQLite bulk update error:', sqliteErr);
  }

  // 3. Save to Google Drive under "Family Circle / AI Model Architecture"
  const accessToken = getGoogleAccessToken();
  if (accessToken) {
    try {
      // 3a. Ensure Folder Structure: "Family Circle" -> "AI Model Architecture"
      const familyCircleFolder = await getOrCreateGoogleDriveFolder(accessToken, AI_KEYS_DRIVE_ROOT_FOLDER);
      const aiFolder = await getOrCreateGoogleDriveFolder(accessToken, AI_KEYS_DRIVE_SUBFOLDER, familyCircleFolder.id);

      result.driveFolderId = aiFolder.id;
      result.driveFolderPath = `${AI_KEYS_DRIVE_ROOT_FOLDER} / ${AI_KEYS_DRIVE_SUBFOLDER}`;

      // 3b. Prepare the JSON configuration file
      const backupData: StoredAiArchitectureJson = {
        appName: 'Aura Family AI Assistant',
        schemaVersion: '1.0',
        savedAt: new Date().toISOString(),
        userEmail,
        activeProvider: payload.activeProvider,
        activeModel: payload.activeModel,
        keys: {
          GEMINI_API_KEY: payload.geminiKey?.trim(),
          NVIDIA_API_KEY: payload.nvidiaKey?.trim(),
          OPENAI_API_KEY: payload.openaiKey?.trim(),
          ANTHROPIC_API_KEY: payload.anthropicKey?.trim(),
        },
        customConfig: payload.customConfig,
      };

      const fileContent = JSON.stringify(backupData, null, 2);

      // 3c. Search for existing file in the AI Model Architecture folder
      let existingFileId: string | null = null;
      try {
        const query = `'${aiFolder.id}' in parents and name = '${AI_KEYS_DRIVE_FILE_NAME}' and trashed = false`;
        const searchRes = await fetch(
          `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&supportsAllDrives=true&fields=files(id,name,webViewLink)&pageSize=1`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );
        if (searchRes.ok) {
          const sData = await searchRes.json();
          if (sData.files && sData.files.length > 0) {
            existingFileId = sData.files[0].id;
          }
        }
      } catch (findErr) {
        console.warn('[AI Keys Sync] Search existing file error:', findErr);
      }

      // 3d. Upload via Google Drive Multipart API
      const boundary = '-------314159265358979323846';
      const metadata = {
        name: AI_KEYS_DRIVE_FILE_NAME,
        mimeType: 'application/json',
        ...(!existingFileId ? { parents: [aiFolder.id] } : {}),
        description: `Family Circle Sovereign AI Engine & Model Architecture Keys. Last updated: ${new Date().toISOString()}`,
      };

      const multipartBody =
        `--${boundary}\r\n` +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(metadata) +
        `\r\n--${boundary}\r\n` +
        'Content-Type: application/json\r\n\r\n' +
        fileContent +
        `\r\n--${boundary}--`;

      let uploadUrl = existingFileId
        ? `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=multipart&supportsAllDrives=true&fields=id,webViewLink`
        : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,webViewLink';

      let uploadMethod = existingFileId ? 'PATCH' : 'POST';

      let uploadRes = await fetch(uploadUrl, {
        method: uploadMethod,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: multipartBody,
      });

      // If PATCH 404, fall back to POST
      if (!uploadRes.ok && uploadMethod === 'PATCH' && uploadRes.status === 404) {
        uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,webViewLink';
        uploadMethod = 'POST';
        const postMeta = { ...metadata, parents: [aiFolder.id] };
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
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': `multipart/related; boundary=${boundary}`,
          },
          body: postBody,
        });
      }

      if (uploadRes.ok) {
        const uploadData = await uploadRes.json();
        result.driveSaved = true;
        result.driveFileId = uploadData.id;
        result.driveWebViewLink = uploadData.webViewLink;

        // 3e. Mirror to Google Drive SQLite store (/api/google/drive/upload)
        try {
          await fetch(getApiUrl('/api/google/drive/upload'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: uploadData.id,
              userEmail,
              name: AI_KEYS_DRIVE_FILE_NAME,
              mimeType: 'application/json',
              size: `${(new Blob([fileContent]).size / 1024).toFixed(1)} KB`,
              sizeBytes: new Blob([fileContent]).size,
              webViewLink: uploadData.webViewLink,
              fileContentBase64: btoa(unescape(encodeURIComponent(fileContent))),
              folderId: aiFolder.id,
              folderName: `${AI_KEYS_DRIVE_ROOT_FOLDER} / ${AI_KEYS_DRIVE_SUBFOLDER}`,
              category: 'AI Model Architecture',
              uploadedBy: 'ai_engine_architecture',
            }),
          });
        } catch (mirrorErr) {
          console.warn('[AI Keys Sync] Drive SQLite mirror warning:', mirrorErr);
        }
      } else {
        const errText = await uploadRes.text().catch(() => '');
        console.warn(`[AI Keys Sync] Google Drive upload notice (${uploadRes.status}):`, errText);
      }
    } catch (gErr: any) {
      console.warn('[AI Keys Sync] Google Drive synchronization error:', gErr);
      result.error = gErr.message || 'Google Drive synchronization failed';
    }
  }

  result.success = result.sqliteSaved || result.driveSaved;
  result.message = result.driveSaved
    ? `Saved to SQLite and synced to Google Drive (${result.driveFolderPath})!`
    : result.sqliteSaved
    ? 'Saved to SQLite store (Connect Google Drive to enable cloud sync under Family Circle).'
    : 'Failed to save configuration';

  return result;
}

/**
 * Retrieve current keys from SQLite store
 */
export async function loadAiArchitectureKeysFromSqlite(): Promise<{
  geminiKey?: string;
  nvidiaKey?: string;
  openaiKey?: string;
  anthropicKey?: string;
  defaultProvider?: AiProvider;
  defaultGeminiModel?: string;
  defaultNvidiaModel?: string;
  customEndpoint?: string;
  customModel?: string;
  customKey?: string;
}> {
  try {
    const res = await fetch(getApiUrl('/api/config/keys'));
    if (!res.ok) return {};
    const data = await res.json();
    if (!data.keys || !Array.isArray(data.keys)) return {};

    const findKey = (name: string) => data.keys.find((k: any) => k.keyName === name)?.keyValue || '';

    return {
      geminiKey: findKey('GEMINI_API_KEY'),
      nvidiaKey: findKey('NVIDIA_API_KEY'),
      openaiKey: findKey('OPENAI_API_KEY'),
      anthropicKey: findKey('ANTHROPIC_API_KEY'),
      defaultProvider: (findKey('DEFAULT_AI_PROVIDER') as AiProvider) || undefined,
      defaultGeminiModel: findKey('DEFAULT_GEMINI_MODEL') || undefined,
      defaultNvidiaModel: findKey('DEFAULT_NVIDIA_MODEL') || undefined,
      customEndpoint: findKey('CUSTOM_AI_ENDPOINT') || undefined,
      customModel: findKey('CUSTOM_AI_MODEL') || undefined,
      customKey: findKey('CUSTOM_AI_KEY') || undefined,
    };
  } catch (err) {
    console.warn('[AI Keys Sync] Failed to load keys from SQLite:', err);
    return {};
  }
}

/**
 * Pull and restore AI Architecture keys from Google Drive folder "Family Circle / AI Model Architecture"
 */
export async function restoreAiArchitectureFromDrive(
  accessToken?: string
): Promise<StoredAiArchitectureJson | null> {
  const token = accessToken || getGoogleAccessToken();
  if (!token) {
    throw new Error('Google Drive access token not available. Please sign in to Google.');
  }

  // 1. Locate "Family Circle" -> "AI Model Architecture"
  const familyCircleFolder = await getOrCreateGoogleDriveFolder(token, AI_KEYS_DRIVE_ROOT_FOLDER);
  const aiFolder = await getOrCreateGoogleDriveFolder(token, AI_KEYS_DRIVE_SUBFOLDER, familyCircleFolder.id);

  // 2. Search for ai_model_architecture_keys.json
  const query = `'${aiFolder.id}' in parents and name = '${AI_KEYS_DRIVE_FILE_NAME}' and trashed = false`;
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&supportsAllDrives=true&fields=files(id,name)&pageSize=1`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!searchRes.ok) {
    throw new Error(`Failed to query Google Drive folder: ${searchRes.statusText}`);
  }

  const sData = await searchRes.json();
  if (!sData.files || sData.files.length === 0) {
    return null;
  }

  const fileId = sData.files[0].id;

  // 3. Download the file content
  const downloadRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!downloadRes.ok) {
    throw new Error(`Failed to download file from Google Drive: ${downloadRes.statusText}`);
  }

  const parsed: StoredAiArchitectureJson = await downloadRes.json();

  // 4. Save to local SQLite and localStorage immediately
  if (parsed.keys) {
    await saveAiArchitectureKeysToSqliteAndDrive({
      activeProvider: parsed.activeProvider || 'gemini',
      activeModel: parsed.activeModel || 'gemini-3.5-flash',
      geminiKey: parsed.keys.GEMINI_API_KEY,
      nvidiaKey: parsed.keys.NVIDIA_API_KEY,
      openaiKey: parsed.keys.OPENAI_API_KEY,
      anthropicKey: parsed.keys.ANTHROPIC_API_KEY,
      customConfig: parsed.customConfig,
      userEmail: parsed.userEmail,
    });
  }

  return parsed;
}

