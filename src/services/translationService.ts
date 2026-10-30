// Real-Time Language Translation Service & Google Drive Integration
// Saves translation notes and audio to "Family Circle / Language Translations" folder in Google Drive.
// Supports English, Tamil, Hindi, Malayalam, Telugu, Kannada, Chinese, French, Spanish and vice versa.

import { LanguageTranslation, SUPPORTED_LANGUAGES, QuickPhrase } from '../types/translation';
import { getOrCreateGoogleDriveFolder } from './googleWorkspace';
import { getApiUrl } from './api';

const LOCAL_STORAGE_KEY = 'aura_translations_cache_v1';
export const DRIVE_FOLDER_NAME = 'Language Translations';

export const POPULAR_LANGUAGE_PRESETS = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'ta', name: 'Tamil', native: 'தமிழ்', flag: '🇮🇳' },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी', flag: '🇮🇳' },
  { code: 'ml', name: 'Malayalam', native: 'മലയാളം', flag: '🇮🇳' },
  { code: 'te', name: 'Telugu', native: 'తెలుగు', flag: '🇮🇳' },
  { code: 'kn', name: 'Kannada', native: 'ಕನ್ನಡ', flag: '🇮🇳' },
  { code: 'zh', name: 'Chinese', native: '中文', flag: '🇨🇳' },
  { code: 'fr', name: 'French', native: 'Français', flag: '🇫🇷' },
  { code: 'es', name: 'Spanish', native: 'Español', flag: '🇪🇸' },
];

export const QUICK_FAMILY_PHRASES: QuickPhrase[] = [
  {
    id: 'qp-1',
    category: 'Daily Greeting',
    english: 'Good morning! Have a blessed and joyful day ahead.',
    targetLangCode: 'ta',
  },
  {
    id: 'qp-2',
    category: 'Family Care',
    english: 'Did you take your medicine and drink enough water today?',
    targetLangCode: 'ta',
  },
  {
    id: 'qp-3',
    category: 'Mealtime',
    english: 'Dinner is ready! Please come and eat hot food together.',
    targetLangCode: 'hi',
  },
  {
    id: 'qp-4',
    category: 'Travel & Help',
    english: 'Could you please help me find the nearest train station?',
    targetLangCode: 'fr',
  },
  {
    id: 'qp-5',
    category: 'Gratitude',
    english: 'Thank you from the bottom of my heart for your kindness.',
    targetLangCode: 'es',
  },
  {
    id: 'qp-6',
    category: 'Work & Collaboration',
    english: 'Let us coordinate on the key deliverables and finalize the timeline.',
    targetLangCode: 'zh',
  },
];

export function getLocalTranslations(): LanguageTranslation[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.warn('Failed to parse local translations:', err);
    return [];
  }
}

export function saveLocalTranslations(translations: LanguageTranslation[]) {
  if (typeof window === 'undefined') return;
  try {
    const sanitized = translations.map((t) => {
      if (t.audioContentBase64 && t.audioContentBase64.length > 200000) {
        return { ...t, audioContentBase64: undefined };
      }
      return t;
    });
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(sanitized));
  } catch (err) {
    console.warn('Failed to save translations to localStorage:', err);
  }
}

/**
 * Fetch all translations (merging local cache, server SQLite, and Google Drive)
 */
export async function fetchTranslations(
  googleAccessToken?: string | null,
  userEmail?: string
): Promise<LanguageTranslation[]> {
  const map = new Map<string, LanguageTranslation>();

  // 1. Local Cache
  const localList = getLocalTranslations();
  localList.forEach((t) => map.set(t.id, t));

  // 2. Server SQLite
  try {
    const emailParam = encodeURIComponent(userEmail || 'chinna.tamil2000@gmail.com');
    const res = await fetch(getApiUrl(`/api/translations?userEmail=${emailParam}`));
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.translations)) {
        for (const item of data.translations) {
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
    console.warn('Failed to fetch translations from server SQLite:', err);
  }

  // 3. Scan Google Drive folder "Family Circle / Language Translations"
  if (googleAccessToken) {
    try {
      const familyCircleFolder = await getOrCreateGoogleDriveFolder(googleAccessToken, 'Family Circle');
      const transFolder = await getOrCreateGoogleDriveFolder(
        googleAccessToken,
        DRIVE_FOLDER_NAME,
        familyCircleFolder.id
      );

      const q = `'${transFolder.id}' in parents and trashed = false and mimeType != 'application/vnd.google-apps.folder'`;
      const driveRes = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType,size,webViewLink,createdTime,description)&pageSize=50&orderBy=createdTime desc`,
        { headers: { Authorization: `Bearer ${googleAccessToken}` } }
      );

      if (driveRes.ok) {
        const driveData = await driveRes.json();
        const driveFiles = driveData.files || [];

        for (const df of driveFiles) {
          const match = Array.from(map.values()).find(
            (t) => t.driveFileId === df.id || t.sourceText.slice(0, 30).toLowerCase() === df.name.slice(0, 30).toLowerCase()
          );

          if (match) {
            match.driveFileId = df.id;
            match.driveWebViewLink = df.webViewLink;
            match.driveSyncStatus = 'synced';
          }
        }
      }
    } catch (dErr) {
      console.warn('Google Drive translation scan failed:', dErr);
    }
  }

  const combined = Array.from(map.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  saveLocalTranslations(combined);
  return combined;
}

/**
 * Execute real-time translation using Gemini server route
 */
export async function executeTranslation(
  text: string,
  sourceLang: string = 'en',
  targetLang: string = 'ta',
  tone: string = 'natural conversational'
): Promise<{
  translatedText: string;
  phonetics?: string;
  detectedSourceLang: string;
  targetLang: string;
  notes?: string;
}> {
  const cleanInput = text.trim();
  if (!cleanInput) {
    return {
      translatedText: '',
      phonetics: '',
      detectedSourceLang: sourceLang,
      targetLang,
      notes: '',
    };
  }

  // 1. Try server translation endpoint
  try {
    const res = await fetch(getApiUrl('/api/translate'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: cleanInput,
        sourceLang,
        targetLang,
        tone,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      // Guard against old un-restarted server instances returning the stale canned phrase
      const isCannedGreeting =
        data.translatedText &&
        (data.translatedText.includes('வணக்கம் மற்றும் அன்புடன் வாழ்த்துகள்') ||
          (data.translatedText.includes('என்பதற்கு தமிழ் மொழியாக்கம்') &&
            data.modelUsed === 'auro-linguistic-lexicon'));

      if (!isCannedGreeting && data.translatedText && data.translatedText.trim()) {
        return {
          translatedText: data.translatedText.trim(),
          phonetics: data.phonetics || '',
          detectedSourceLang: data.detectedSourceLang || sourceLang,
          targetLang: data.targetLang || targetLang,
          notes: data.notes || '',
        };
      }
    }
  } catch (serverErr) {
    console.warn('Backend /api/translate error, switching to direct neural fallback:', serverErr);
  }

  // 2. Client-side Direct Neural Translation Gateway Fallback
  try {
    const gtxUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(
      sourceLang
    )}&tl=${encodeURIComponent(targetLang)}&dt=t&dt=rm&q=${encodeURIComponent(cleanInput)}`;
    const gtxRes = await fetch(gtxUrl);
    if (gtxRes.ok) {
      const gtxData = await gtxRes.json();
      let translatedText = '';
      let phonetics = '';

      if (Array.isArray(gtxData[0])) {
        translatedText = gtxData[0]
          .map((s: any) => s[0])
          .filter(Boolean)
          .join('')
          .trim();

        for (const item of gtxData[0]) {
          if (item && Array.isArray(item)) {
            if (item[2] && typeof item[2] === 'string' && item[2].trim()) {
              phonetics = item[2].trim();
              break;
            }
          } else if (item && typeof item === 'string' && item.trim()) {
            phonetics = item.trim();
          }
        }
      }

      if (translatedText) {
        return {
          translatedText,
          phonetics: phonetics || translatedText,
          detectedSourceLang: sourceLang,
          targetLang,
          notes: 'High-speed neural translation gateway',
        };
      }
    }
  } catch (gtxErr) {
    console.warn('Client-side neural translation fallback error:', gtxErr);
  }

  return {
    translatedText: cleanInput,
    phonetics: cleanInput,
    detectedSourceLang: sourceLang,
    targetLang,
    notes: 'Direct text retained',
  };
}

/**
 * Upload translation document to Google Drive under "Family Circle / Language Translations"
 */
export async function uploadTranslationToDrive(
  accessToken: string,
  translation: LanguageTranslation
): Promise<{ driveFileId: string; webViewLink: string; folderId: string }> {
  const familyCircleFolder = await getOrCreateGoogleDriveFolder(accessToken, 'Family Circle');
  const transFolder = await getOrCreateGoogleDriveFolder(
    accessToken,
    DRIVE_FOLDER_NAME,
    familyCircleFolder.id
  );

  const cleanSnippet = translation.sourceText.slice(0, 25).replace(/[/\\?%*:|"<>]/g, '_').trim();
  const fileName = `Translation_${translation.sourceLang}_to_${translation.targetLang}_${cleanSnippet}.txt`;

  const contentText = `=====================================================
AURO FAMILY ASSISTANT • LANGUAGE TRANSLATION RECORD
Date: ${new Date(translation.createdAt).toLocaleString()}
Language Pair: ${translation.sourceLang.toUpperCase()} ➔ ${translation.targetLang.toUpperCase()}
Folder: Family Circle / ${DRIVE_FOLDER_NAME}
=====================================================

ORIGINAL TEXT (${translation.sourceLang.toUpperCase()}):
${translation.sourceText}

TRANSLATED TEXT (${translation.targetLang.toUpperCase()}):
${translation.translatedText}

${translation.phonetics ? `PHONETIC PRONUNCIATION GUIDE:\n${translation.phonetics}\n` : ''}
${translation.notes ? `CULTURAL & LINGUISTIC NOTES:\n${translation.notes}\n` : ''}
=====================================================
Saved via Auro Sovereign Multi-Modal Assistant
`;

  const metadata = {
    name: fileName,
    mimeType: 'text/plain',
    parents: [transFolder.id],
    description: `Auro Translation (${translation.sourceLang} ➔ ${translation.targetLang})\nOriginal: "${translation.sourceText}"\nTranslation: "${translation.translatedText}"`,
  };

  const boundary = `-------AuroTransBoundary${Date.now()}`;
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const enc = new TextEncoder();
  const fileBytes = enc.encode(contentText);

  const metadataPart = `${delimiter}Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`;
  const mediaPartHeader = `${delimiter}Content-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: binary\r\n\r\n`;

  const metadataBytes = enc.encode(metadataPart);
  const mediaHeaderBytes = enc.encode(mediaPartHeader);
  const closeDelimiterBytes = enc.encode(closeDelimiter);

  const fullPayload = new Uint8Array(
    metadataBytes.length + mediaHeaderBytes.length + fileBytes.length + closeDelimiterBytes.length
  );

  let offset = 0;
  fullPayload.set(metadataBytes, offset);
  offset += metadataBytes.length;
  fullPayload.set(mediaHeaderBytes, offset);
  offset += mediaHeaderBytes.length;
  fullPayload.set(fileBytes, offset);
  offset += fileBytes.length;
  fullPayload.set(closeDelimiterBytes, offset);

  const uploadRes = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,parents',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: fullPayload,
    }
  );

  if (!uploadRes.ok) {
    const errText = await uploadRes.text().catch(() => '');
    throw new Error(`Google Drive upload failed (${uploadRes.status}): ${errText}`);
  }

  const uploadedData = await uploadRes.json();
  const webViewLink = uploadedData.webViewLink || `https://drive.google.com/file/d/${uploadedData.id}/view`;

  return {
    driveFileId: uploadedData.id,
    webViewLink,
    folderId: transFolder.id,
  };
}

/**
 * Save translation into SQLite, Drive, and Local Cache
 */
export async function saveTranslation(
  translation: LanguageTranslation,
  googleAccessToken?: string | null
): Promise<LanguageTranslation> {
  let updated = { ...translation };

  // 1. Upload to Drive if access token is available
  if (googleAccessToken) {
    try {
      const driveInfo = await uploadTranslationToDrive(googleAccessToken, updated);
      updated.driveFileId = driveInfo.driveFileId;
      updated.driveWebViewLink = driveInfo.webViewLink;
      updated.driveSyncStatus = 'synced';
    } catch (driveErr) {
      console.warn('Drive upload error (saved locally):', driveErr);
      updated.driveSyncStatus = 'local_only';
    }
  }

  // 2. Save to SQLite
  try {
    const res = await fetch(getApiUrl('/api/translations'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.translation) {
        updated = { ...updated, ...data.translation };
      }
    }
  } catch (sqlErr) {
    console.warn('Failed to save translation to SQLite:', sqlErr);
  }

  // 3. Local Cache
  const list = getLocalTranslations().filter((t) => t.id !== updated.id);
  list.unshift(updated);
  saveLocalTranslations(list);

  return updated;
}

/**
 * Delete translation
 */
export async function deleteTranslation(id: string, userEmail?: string): Promise<boolean> {
  const list = getLocalTranslations().filter((t) => t.id !== id);
  saveLocalTranslations(list);

  try {
    const emailParam = userEmail ? `?userEmail=${encodeURIComponent(userEmail)}` : '';
    await fetch(getApiUrl(`/api/translations/${id}${emailParam}`), {
      method: 'DELETE',
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Toggle favorite
 */
export async function toggleTranslationFavorite(id: string, isFavorite: boolean): Promise<boolean> {
  const list = getLocalTranslations();
  const item = list.find((t) => t.id === id);
  if (item) {
    item.isFavorite = isFavorite;
    saveLocalTranslations(list);
  }

  try {
    await fetch(getApiUrl(`/api/translations/${id}/favorite`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isFavorite }),
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Speak text in the given target language using Web Speech API synthesis
 */
export function speakText(text: string, langCode: string, onEnd?: () => void) {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    onEnd?.();
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);

  // Match target speech code (e.g. 'ta-IN', 'hi-IN', 'en-US')
  const langObj = SUPPORTED_LANGUAGES.find((l) => l.code === langCode);
  const targetSpeechCode = langObj?.speechCode || 'en-US';
  utterance.lang = targetSpeechCode;
  utterance.rate = 0.95;
  utterance.pitch = 1.0;

  if (onEnd) {
    utterance.onend = () => onEnd();
    utterance.onerror = () => onEnd();
  }

  // Attempt to find matching native voice
  const voices = window.speechSynthesis.getVoices();
  const matchedVoice = voices.find(
    (v) => v.lang.toLowerCase().startsWith(targetSpeechCode.toLowerCase().slice(0, 2))
  );
  if (matchedVoice) {
    utterance.voice = matchedVoice;
  }

  window.speechSynthesis.speak(utterance);
}

/**
 * Download translation text file directly to device
 */
export function downloadTranslationFile(translation: LanguageTranslation) {
  const safeSnippet = translation.sourceText.slice(0, 20).replace(/[/\\?%*:|"<>]/g, '_').trim();
  const filename = `Translation_${translation.sourceLang}_to_${translation.targetLang}_${safeSnippet}.txt`;

  const textContent = `AURO FAMILY TRANSLATION
Date: ${new Date(translation.createdAt).toLocaleString()}
Language: ${translation.sourceLang.toUpperCase()} -> ${translation.targetLang.toUpperCase()}

[ORIGINAL]
${translation.sourceText}

[TRANSLATED]
${translation.translatedText}

${translation.phonetics ? `[PHONETICS]\n${translation.phonetics}\n` : ''}
${translation.notes ? `[NOTES]\n${translation.notes}\n` : ''}
`;

  const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * Share translation via native share API, WhatsApp, or clipboard
 */
export async function shareTranslation(translation: LanguageTranslation): Promise<{ success: boolean; method: string }> {
  const shareText = `🌐 Auro Translation (${translation.sourceLang.toUpperCase()} ➔ ${translation.targetLang.toUpperCase()}):\n\n"${translation.sourceText}"\n\n⬇️\n\n"${translation.translatedText}"\n${
    translation.phonetics ? `\nPronunciation: ${translation.phonetics}\n` : ''
  }`;

  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({
        title: `Translation: ${translation.sourceLang.toUpperCase()} to ${translation.targetLang.toUpperCase()}`,
        text: shareText,
        url: translation.driveWebViewLink || undefined,
      });
      return { success: true, method: 'native' };
    } catch (err: any) {
      if (err.name === 'AbortError') return { success: false, method: 'cancelled' };
    }
  }

  // Fallback to clipboard
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(shareText);
      return { success: true, method: 'clipboard' };
    }
  } catch {}

  return { success: false, method: 'none' };
}
