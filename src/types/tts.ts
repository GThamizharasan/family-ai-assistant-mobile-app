export type TtsVoiceType = 'male' | 'female' | 'child';

export interface TtsVoiceOption {
  id: TtsVoiceType;
  label: string;
  subLabel: string;
  geminiVoice: string;
  icon: string;
  accent: string;
  sampleText: string;
  styleDescription: string;
}

export interface TtsMemo {
  id: string;
  userEmail: string;
  title: string;
  textPrompt: string;
  voiceType: TtsVoiceType;
  voiceName: string;
  audioUrl?: string;
  audioContentBase64?: string;
  audioMimeType: string;
  durationSeconds: number;
  fileSizeBytes: number;
  driveFileId?: string;
  driveWebViewLink?: string;
  driveFolderPath?: string;
  driveSyncStatus: 'synced' | 'uploading' | 'local_only' | 'error';
  isFavorite: boolean;
  playCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface TtsTemplate {
  id: string;
  category: string;
  title: string;
  voiceType: TtsVoiceType;
  text: string;
}
