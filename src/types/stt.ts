export type SttLanguageCode =
  | 'auto'
  | 'ta-IN'
  | 'en-US'
  | 'en-IN'
  | 'hi-IN'
  | 'te-IN'
  | 'ml-IN'
  | 'kn-IN'
  | 'es-ES'
  | 'fr-FR'
  | 'de-DE'
  | 'ja-JP'
  | 'ar-SA';

export interface SttLanguageOption {
  code: SttLanguageCode;
  label: string;
  name?: string;
  nativeName: string;
  flag: string;
  bcp47: string;
  description: string;
  samplePhrase: string;
}

export interface SttMemo {
  id: string;
  userEmail?: string;
  title: string;
  transcribedText: string;
  sourceLanguage: SttLanguageCode;
  languageLabel: string;
  category: string;
  audioUrl?: string;
  audioContentBase64?: string;
  audioMimeType: string;
  durationSeconds: number;
  wordCount: number;
  characterCount: number;
  fileSizeBytes: number;
  driveFileId?: string;
  driveWebViewLink?: string;
  driveFolderPath?: string;
  driveSyncStatus?: 'synced' | 'uploading' | 'local_only' | 'error';
  summary?: string;
  keyPoints?: string[];
  isFavorite: boolean;
  playCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface SttTemplate {
  id: string;
  category: string;
  title: string;
  language: SttLanguageCode;
  samplePrompt: string;
  prompt?: string;
  icon: string;
}
