// Sovereign Apple Music Library Sync & Storage Service
// Synchronizes music tracks with Google Drive "Family Circle / Apple Music / [Category]" and local storage.

import { MusicTrack, MusicGenre } from '../types/music';
import { getApiUrl, safeFetchJson } from './api';
import {
  uploadTrackToAppleMusicDrive,
  refreshAppleMusicFromDrive,
  categorizeMusicSubfolder,
} from './appleMusicDrive';

export { refreshAppleMusicFromDrive, categorizeMusicSubfolder };

const LOCAL_STORAGE_KEY = 'aura_music_library_tracks';

export const INITIAL_MUSIC_TRACKS: MusicTrack[] = [
  {
    id: 'track-001',
    title: 'Family Circle Symphony',
    artist: 'Aura Orchestral & Thamizh Family',
    album: 'Sovereign Family Legacy',
    genre: 'Classical & Wellness',
    audioUrl: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112191.mp3',
    artworkUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80',
    durationSeconds: 210,
    lyrics: 'Harmonies of lifelong love, generational wisdom, and steady guidance...',
    driveFileId: 'gdf-music-001',
    driveWebViewLink: 'https://drive.google.com',
    driveFolderPath: 'Family Circle / Apple Music / Classical & Wellness',
    isFavorite: true,
    playCount: 14,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    localCached: true,
  },
  {
    id: 'track-002',
    title: 'Aura Ambient Focus Flow',
    artist: 'AI Studio Sound Lab',
    album: 'Executive Mindset Sessions',
    genre: 'Ambient & Study',
    audioUrl: 'https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0a13f69d2.mp3?filename=chill-abstract-intention-12099.mp3',
    artworkUrl: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=600&auto=format&fit=crop&q=80',
    durationSeconds: 180,
    lyrics: 'Deep focus, crystal clarity, visionary architecture, effortless momentum...',
    driveFileId: 'gdf-music-002',
    driveWebViewLink: 'https://drive.google.com',
    driveFolderPath: 'Family Circle / Apple Music / Ambient & Study',
    isFavorite: true,
    playCount: 28,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    localCached: true,
  },
  {
    id: 'track-003',
    title: 'Midnight Lullaby for Maaran & Kavinmozhi',
    artist: 'Selvapriya & Thamizh',
    album: 'Family Bedtime Peace',
    genre: 'Family Lullaby',
    audioUrl: 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_c8c8a73467.mp3?filename=sweet-lullaby-piano-version-10906.mp3',
    artworkUrl: 'https://images.unsplash.com/photo-1532767153582-b1a0e5145009?w=600&auto=format&fit=crop&q=80',
    durationSeconds: 240,
    lyrics: 'Sleep peacefully under starlight, dreaming of infinite worlds and boundless courage...',
    driveFileId: 'gdf-music-003',
    driveWebViewLink: 'https://drive.google.com',
    driveFolderPath: 'Family Circle / Apple Music / Family Lullaby',
    isFavorite: true,
    playCount: 42,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    localCached: true,
  },
  {
    id: 'track-004',
    title: 'Tamil Heritage Veena & Flute Melodies',
    artist: 'Tamil Isai Classical Ensemble',
    album: 'Roots & Heritage Vol. 1',
    genre: 'Tamil Melodies & Tradition',
    audioUrl: 'https://cdn.pixabay.com/download/audio/2021/09/06/audio_73e721a329.mp3?filename=indian-meditation-flute-7848.mp3',
    artworkUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80',
    durationSeconds: 225,
    lyrics: 'மகிழ்ச்சியும் அமைதியும் நிறைந்த பண்பாட்டு நல்லிசை...',
    driveFileId: 'gdf-music-004',
    driveWebViewLink: 'https://drive.google.com',
    driveFolderPath: 'Family Circle / Apple Music / Tamil Melodies & Tradition',
    isFavorite: true,
    playCount: 19,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    localCached: true,
  },
  {
    id: 'track-005',
    title: 'Billionaire Empire Motivation',
    artist: 'Aura Cinematic Soundscapes',
    album: 'High Stakes Sovereign Vision',
    genre: 'Cinematic',
    audioUrl: 'https://cdn.pixabay.com/download/audio/2022/03/10/audio_c3501258ef.mp3?filename=cinematic-epic-emotional-112423.mp3',
    artworkUrl: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600&auto=format&fit=crop&q=80',
    durationSeconds: 195,
    lyrics: 'Rise with purpose, build lasting institutions, empower generations...',
    driveFileId: 'gdf-music-005',
    driveWebViewLink: 'https://drive.google.com',
    driveFolderPath: 'Family Circle / Apple Music / Cinematic',
    isFavorite: false,
    playCount: 9,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    localCached: true,
  },
  {
    id: 'track-006',
    title: 'AI Studio Lyria Demo: Golden Sunset Groove',
    artist: 'Google Lyria AI Music Engine',
    album: 'AI Studio Synthetics',
    genre: 'AI Studio Lyria',
    audioUrl: 'https://cdn.pixabay.com/download/audio/2022/05/16/audio_db6591201e.mp3?filename=tropical-summer-music-111658.mp3',
    artworkUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&auto=format&fit=crop&q=80',
    durationSeconds: 165,
    lyrics: 'Warm breeze along the coast, sun dipping beneath the golden horizon...',
    driveFileId: 'gdf-music-006',
    driveWebViewLink: 'https://drive.google.com',
    driveFolderPath: 'Family Circle / Apple Music / AI Studio Lyria',
    isFavorite: true,
    playCount: 31,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    localCached: true,
  },
];

/**
 * Fetch all music tracks from Backend SQLite and Local Cache.
 */
export async function fetchMusicTracks(
  userEmail = 'chinna.tamil2000@gmail.com',
  genreFilter?: string
): Promise<MusicTrack[]> {
  try {
    const url = getApiUrl(`/api/music/library?userEmail=${encodeURIComponent(userEmail)}${genreFilter && genreFilter !== 'All' ? `&genre=${encodeURIComponent(genreFilter)}` : ''}`);
    const data = await safeFetchJson<{ success: boolean; tracks: MusicTrack[] }>(url);
    if (data?.success && Array.isArray(data.tracks) && data.tracks.length > 0) {
      // Merge with local storage
      const local = getLocalTracks();
      const existingIds = new Set(data.tracks.map((t) => t.id));
      const missingLocal = local.filter((l) => !existingIds.has(l.id));
      const combined = [...data.tracks, ...missingLocal];
      saveLocalTracks(combined);
      return combined;
    }
  } catch (err) {
    console.warn('[Music Library] Fetch from backend notice, using local cache:', err);
  }

  // Fallback to local storage or initial seed
  const local = getLocalTracks();
  if (local.length > 0) {
    if (genreFilter && genreFilter !== 'All') {
      return local.filter((t) => t.genre === genreFilter);
    }
    return local;
  }

  saveLocalTracks(INITIAL_MUSIC_TRACKS);
  return INITIAL_MUSIC_TRACKS;
}

/**
 * Add or update a track in the Musical Library, saving locally and syncing to Google Drive under:
 * Family Circle / Apple Music / [Category]
 */
export async function saveMusicTrack(
  trackData: Partial<MusicTrack> & { title: string; artist: string; audioUrl: string; genre: string },
  accessToken?: string | null,
  userEmail = 'chinna.tamil2000@gmail.com',
  audioFile?: File | Blob | null
): Promise<MusicTrack> {
  const id = trackData.id || `track-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();

  // Categorize track into Apple Music subfolder
  const { subfolderName } = categorizeMusicSubfolder(
    trackData.title,
    trackData.artist,
    trackData.genre,
    trackData.lyrics
  );

  const driveFolderPath =
    trackData.driveFolderPath && !trackData.driveFolderPath.includes('Musical Library')
      ? trackData.driveFolderPath
      : `Family Circle / Apple Music / ${subfolderName}`;

  const track: MusicTrack = {
    ...trackData,
    id,
    userEmail,
    genre: trackData.genre || subfolderName,
    album: trackData.album || `Apple Music - ${subfolderName}`,
    artworkUrl: trackData.artworkUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80',
    durationSeconds: trackData.durationSeconds || 180,
    isFavorite: !!trackData.isFavorite,
    playCount: trackData.playCount || 0,
    driveFolderPath,
    createdAt: trackData.createdAt || now,
    updatedAt: now,
    localCached: true,
  };

  // 1. Save in local cache
  const local = getLocalTracks();
  const updatedLocal = [track, ...local.filter((t) => t.id !== id)];
  saveLocalTracks(updatedLocal);

  // 2. Save in SQLite backend
  try {
    await fetch(getApiUrl('/api/music/library'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(track),
    });
  } catch (err) {
    console.warn('[Music Library] Backend save notice:', err);
  }

  // 3. Sync to Google Drive under "Family Circle / Apple Music / [Category]"
  const effectiveToken = (accessToken && accessToken.trim()) || localStorage.getItem('aura_google_access_token');
  if (effectiveToken && effectiveToken.trim()) {
    try {
      const driveMeta = await uploadTrackToAppleMusicDrive(
        effectiveToken,
        track,
        audioFile || null,
        'Family Circle',
        userEmail
      );
      if (driveMeta) {
        track.driveFileId = driveMeta.driveFileId;
        track.driveWebViewLink = driveMeta.driveWebViewLink;
        track.driveFolderPath = driveMeta.driveFolderPath;

        // Re-save with drive metadata
        updateLocalTrack(track);
        await fetch(getApiUrl('/api/music/library'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(track),
        }).catch(() => {});
      }
    } catch (dErr) {
      console.warn('[Music Library] Apple Music Drive upload notice:', dErr);
    }
  }

  return track;
}

/**
 * On-demand sync for an individual track into "Family Circle / Apple Music / [Category]"
 */
export async function syncTrackToAppleMusic(
  track: MusicTrack,
  accessToken?: string | null,
  userEmail = 'chinna.tamil2000@gmail.com',
  audioFile?: File | Blob | null
): Promise<{ success: boolean; track: MusicTrack; error?: string }> {
  const token = (accessToken && accessToken.trim()) || localStorage.getItem('aura_google_access_token');
  if (!token) {
    return { success: false, track, error: 'Google account authorization is required to sync to Drive.' };
  }

  try {
    const driveMeta = await uploadTrackToAppleMusicDrive(
      token,
      track,
      audioFile || null,
      'Family Circle',
      userEmail
    );
    if (driveMeta) {
      track.driveFileId = driveMeta.driveFileId;
      track.driveWebViewLink = driveMeta.driveWebViewLink;
      track.driveFolderPath = driveMeta.driveFolderPath;

      updateLocalTrack(track);
      await fetch(getApiUrl('/api/music/library'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(track),
      }).catch(() => {});

      return { success: true, track };
    }
    return { success: false, track, error: 'Drive upload did not return metadata.' };
  } catch (err: any) {
    return { success: false, track, error: err.message || 'Drive sync failed' };
  }
}

/**
 * Upload track audio file directly into Google Drive under:
 * Family Circle / Apple Music / [Category]
 * (Backward compatibility alias)
 */
export async function uploadTrackAudioToDrive(
  track: MusicTrack,
  accessToken: string,
  userEmail = 'chinna.tamil2000@gmail.com'
): Promise<{ driveFileId: string; driveWebViewLink: string; driveFolderPath?: string } | null> {
  const res = await uploadTrackToAppleMusicDrive(accessToken, track, null, 'Family Circle', userEmail);
  return res ? { driveFileId: res.driveFileId, driveWebViewLink: res.driveWebViewLink, driveFolderPath: res.driveFolderPath } : null;
}

/**
 * Toggle track favorite status
 */
export async function toggleTrackFavorite(id: string, isFavorite?: boolean): Promise<boolean> {
  const local = getLocalTracks();
  const track = local.find((t) => t.id === id);
  if (track) {
    track.isFavorite = typeof isFavorite === 'boolean' ? isFavorite : !track.isFavorite;
    saveLocalTracks(local);
  }

  try {
    await fetch(getApiUrl(`/api/music/library/${id}/favorite`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isFavorite }),
    });
    return true;
  } catch {
    return true;
  }
}

/**
 * Increment track play count
 */
export async function incrementTrackPlay(id: string): Promise<void> {
  const local = getLocalTracks();
  const track = local.find((t) => t.id === id);
  if (track) {
    track.playCount = (track.playCount || 0) + 1;
    track.lastPlayedAt = new Date().toISOString();
    saveLocalTracks(local);
  }

  try {
    await fetch(getApiUrl(`/api/music/library/${id}/play`), {
      method: 'POST',
    });
  } catch {}
}

/**
 * Delete a track from Musical Library
 */
export async function deleteMusicTrack(id: string, userEmail = 'chinna.tamil2000@gmail.com'): Promise<boolean> {
  const local = getLocalTracks().filter((t) => t.id !== id);
  saveLocalTracks(local);

  try {
    await fetch(getApiUrl(`/api/music/library/${id}?userEmail=${encodeURIComponent(userEmail)}`), {
      method: 'DELETE',
    });
    return true;
  } catch {
    return true;
  }
}

// Helpers
function getLocalTracks(): MusicTrack[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalTracks(tracks: MusicTrack[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(tracks));
  } catch {}
}

function updateLocalTrack(track: MusicTrack) {
  const list = getLocalTracks();
  const idx = list.findIndex((t) => t.id === track.id);
  if (idx >= 0) {
    list[idx] = track;
  } else {
    list.unshift(track);
  }
  saveLocalTracks(list);
}
