// Sovereign Family Musical Library Types (Apple Music & Apple Books style)

export interface MusicTrack {
  id: string;
  userEmail?: string;
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
  localCached?: boolean;
}

export type MusicGenre =
  | 'All'
  | 'AI Studio Lyria'
  | 'Classical & Wellness'
  | 'Ambient & Study'
  | 'Family Lullaby'
  | 'Tamil Melodies & Tradition'
  | 'Cinematic'
  | 'Lo-Fi Chill';

export const MUSIC_GENRES: MusicGenre[] = [
  'All',
  'AI Studio Lyria',
  'Classical & Wellness',
  'Ambient & Study',
  'Family Lullaby',
  'Tamil Melodies & Tradition',
  'Cinematic',
  'Lo-Fi Chill',
];

export type EqualizerPreset = 'lossless' | 'bass_boost' | 'vocal' | 'acoustic' | 'ambient';

export interface AudioPlaybackState {
  currentTrack: MusicTrack | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  playbackRate: number; // 0.75, 1.0, 1.25, 1.5
  repeatMode: 'off' | 'all' | 'one';
  shuffle: boolean;
  sleepTimerMinutes: number | null;
  sleepTimerRemainingSeconds: number | null;
  equalizerPreset?: EqualizerPreset;
  queueLength?: number;
}

