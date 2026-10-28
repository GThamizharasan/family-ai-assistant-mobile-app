// AI Studio Creations & Family Circle Drive Sync Types

export type AiCreationType = 'image' | 'video' | 'music' | 'transcript' | 'transcription';

export interface AiStudioCreation {
  id: string;
  userEmail?: string;
  type: AiCreationType;
  title: string;
  prompt: string;
  mediaUrl: string;
  thumbnailUrl?: string;
  modelUsed: string;
  model?: string;
  mimeType: string;
  contentPreview?: string;
  driveFileId?: string;
  driveWebViewLink?: string;
  driveFolderPath?: string;
  drivePath?: string;
  driveSyncStatus?: 'synced' | 'pending' | 'local_only' | 'error';
  createdAt: string;
  metadataJson?: string;
  aspectRatio?: string;
  resolution?: string;
  durationSeconds?: number;
  lyrics?: string;
  tags?: string[];
}
