export type RecordingCategory =
  | 'Personal Memo'
  | 'Family Note'
  | 'Meeting & Work'
  | 'Idea & Inspiration'
  | 'Medical & Wellness'
  | 'Tamil Thoughts'
  | 'Daily Journal';

export interface VoiceRecording {
  id: string;
  userEmail: string;
  title: string;
  category: RecordingCategory | string;
  audioUrl?: string;
  audioContentBase64?: string;
  audioMimeType: string;
  durationSeconds: number;
  fileSizeBytes: number;
  driveFileId?: string;
  driveWebViewLink?: string;
  driveFolderPath?: string;
  driveSyncStatus?: 'synced' | 'pending' | 'local_only';
  transcription?: string;
  transcriptionSummary?: string;
  detectedLanguage?: string;
  isFavorite: boolean;
  playCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface TranscriptionResult {
  transcription: string;
  summary: string;
  keyPoints?: string[];
  actionItems?: string[];
  detectedLanguage: string;
  modelUsed?: string;
}
