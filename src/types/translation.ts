export interface SupportedLanguage {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
  speechCode: string; // BCP-47 for speech synthesis / recognition
}

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧', speechCode: 'en-US' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', flag: '🇮🇳', speechCode: 'ta-IN' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳', speechCode: 'hi-IN' },
  { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം', flag: '🇮🇳', speechCode: 'ml-IN' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు', flag: '🇮🇳', speechCode: 'te-IN' },
  { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ', flag: '🇮🇳', speechCode: 'kn-IN' },
  { code: 'zh', name: 'Chinese', nativeName: '中文 (Mandarin)', flag: '🇨🇳', speechCode: 'zh-CN' },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷', speechCode: 'fr-FR' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸', speechCode: 'es-ES' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪', speechCode: 'de-DE' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵', speechCode: 'ja-JP' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦', speechCode: 'ar-SA' },
];

export interface LanguageTranslation {
  id: string;
  userEmail: string;
  sourceText: string;
  translatedText: string;
  sourceLang: string; // e.g. 'en'
  targetLang: string; // e.g. 'ta'
  phonetics?: string; // Transliteration (e.g. "Vanakkam, eppadi irukkeenga?")
  audioContentBase64?: string;
  audioMimeType?: string;
  driveFileId?: string;
  driveWebViewLink?: string;
  driveFolderPath?: string;
  driveSyncStatus: 'synced' | 'uploading' | 'local_only' | 'error';
  isFavorite: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface QuickPhrase {
  id: string;
  category: string;
  english: string;
  targetLangCode: string;
}
