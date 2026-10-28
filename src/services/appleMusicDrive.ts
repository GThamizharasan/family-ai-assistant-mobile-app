// Sovereign Apple Music Google Drive Sync & Categorization Engine
// Integrates Musical Library directly into "Family Circle / Apple Music / [Category]" folder in Google Drive.
// Features smart genre/category subfolder classification, direct multipart upload,
// parent folder enforcement, bidirectional Drive sync, and server SQLite mirroring.

import { MusicTrack, MusicGenre } from '../types/music';
import { getOrCreateGoogleDriveFolder } from './googleWorkspace';
import { getApiUrl } from './api';

export const APPLE_MUSIC_CATEGORIES = [
  'Classical & Wellness',
  'Ambient & Study',
  'Family Lullaby',
  'Tamil Melodies & Tradition',
  'Cinematic',
  'AI Studio Lyria',
  'Lo-Fi Chill',
  'Acoustic & Folk',
  'Pop & High Energy',
  'Sovereign Family Legacy',
  'Uncategorized',
] as const;

export type AppleMusicCategory = typeof APPLE_MUSIC_CATEGORIES[number];

/**
 * Categorize a music track into an Apple Music subfolder based on genre, title, artist, and lyrics.
 */
export function categorizeMusicSubfolder(
  title: string,
  artist = '',
  genre = '',
  lyrics = ''
): { category: string; subfolderName: string } {
  const cleanGenre = (genre || '').trim();
  const text = `${title} ${artist} ${genre} ${lyrics}`.toLowerCase();

  // 1. Explicit Genre Matching if already standard
  if (cleanGenre === 'Classical & Wellness') {
    return { category: 'Classical & Wellness', subfolderName: 'Classical & Wellness' };
  }
  if (cleanGenre === 'Ambient & Study') {
    return { category: 'Ambient & Study', subfolderName: 'Ambient & Study' };
  }
  if (cleanGenre === 'Family Lullaby') {
    return { category: 'Family Lullaby', subfolderName: 'Family Lullaby' };
  }
  if (cleanGenre === 'Tamil Melodies & Tradition' || cleanGenre === 'Tamil Melodies') {
    return { category: 'Tamil Melodies & Tradition', subfolderName: 'Tamil Melodies & Tradition' };
  }
  if (cleanGenre === 'Cinematic') {
    return { category: 'Cinematic', subfolderName: 'Cinematic' };
  }
  if (cleanGenre === 'AI Studio Lyria') {
    return { category: 'AI Studio Lyria', subfolderName: 'AI Studio Lyria' };
  }
  if (cleanGenre === 'Lo-Fi Chill' || cleanGenre === 'Lo-Fi' || cleanGenre === 'Lofi') {
    return { category: 'Lo-Fi Chill', subfolderName: 'Lo-Fi Chill' };
  }

  // 2. Tamil Melodies & Heritage (Detection by Tamil characters or keywords)
  if (
    /[\u0B80-\u0BFF]/.test(title + artist + genre + lyrics) ||
    text.includes('tamil') ||
    text.includes('veena') ||
    text.includes('flute') ||
    text.includes('carnatic') ||
    text.includes('isai') ||
    text.includes('bharathiyar') ||
    text.includes('thirukkural') ||
    text.includes('raaga')
  ) {
    return { category: 'Tamil Melodies & Tradition', subfolderName: 'Tamil Melodies & Tradition' };
  }

  // 3. AI Studio Lyria & Synthetics
  if (
    text.includes('lyria') ||
    text.includes('google lyria') ||
    text.includes('ai studio') ||
    text.includes('gemini audio') ||
    text.includes('synthetics')
  ) {
    return { category: 'AI Studio Lyria', subfolderName: 'AI Studio Lyria' };
  }

  // 4. Family Lullaby & Kids
  if (
    text.includes('lullaby') ||
    text.includes('bedtime') ||
    text.includes('sleep') ||
    text.includes('maaran') ||
    text.includes('kavinmozhi') ||
    text.includes('children') ||
    text.includes('baby') ||
    text.includes('sweet dreams')
  ) {
    return { category: 'Family Lullaby', subfolderName: 'Family Lullaby' };
  }

  // 5. Classical, Symphony & Wellness
  if (
    text.includes('symphony') ||
    text.includes('classical') ||
    text.includes('orchestral') ||
    text.includes('wellness') ||
    text.includes('healing') ||
    text.includes('peace') ||
    text.includes('meditation') ||
    text.includes('serenade')
  ) {
    return { category: 'Classical & Wellness', subfolderName: 'Classical & Wellness' };
  }

  // 6. Ambient, Study & Focus
  if (
    text.includes('ambient') ||
    text.includes('study') ||
    text.includes('focus') ||
    text.includes('deep work') ||
    text.includes('binaural') ||
    text.includes('flow') ||
    text.includes('mindset')
  ) {
    return { category: 'Ambient & Study', subfolderName: 'Ambient & Study' };
  }

  // 7. Cinematic & High Motivation
  if (
    text.includes('cinematic') ||
    text.includes('soundtrack') ||
    text.includes('score') ||
    text.includes('epic') ||
    text.includes('billionaire') ||
    text.includes('empire') ||
    text.includes('motivation') ||
    text.includes('heroic')
  ) {
    return { category: 'Cinematic', subfolderName: 'Cinematic' };
  }

  // 8. Lo-Fi Chill & Beats
  if (
    text.includes('lo-fi') ||
    text.includes('lofi') ||
    text.includes('chill') ||
    text.includes('coffee') ||
    text.includes('sunset') ||
    text.includes('groove') ||
    text.includes('beats')
  ) {
    return { category: 'Lo-Fi Chill', subfolderName: 'Lo-Fi Chill' };
  }

  // 9. If custom genre is provided and clean, use it as a custom subfolder
  if (cleanGenre && cleanGenre.length > 2 && cleanGenre.length < 30) {
    const sanitized = cleanGenre.replace(/[/\\?%*:|"<>]/g, '').trim();
    if (sanitized) {
      return { category: sanitized, subfolderName: sanitized };
    }
  }

  return { category: 'Uncategorized', subfolderName: 'Uncategorized' };
}

/**
 * Upload a music track audio file and manifest directly into Google Drive under:
 * Family Circle / Apple Music / [Category]
 */
export async function uploadTrackToAppleMusicDrive(
  accessToken: string | null | undefined,
  track: MusicTrack,
  audioFileOrBlob?: File | Blob | null,
  defaultFolder = 'Family Circle',
  userEmail = 'chinna.tamil2000@gmail.com'
): Promise<{
  driveFileId: string;
  driveFolderId: string;
  driveFolderPath: string;
  driveCategory: string;
  driveWebViewLink: string;
}> {
  // Try fallback access token from local storage if not directly provided
  const token = (accessToken && accessToken.trim()) || localStorage.getItem('aura_google_access_token');
  if (!token || !token.trim()) {
    throw new Error('NO_GOOGLE_AUTH: Active Google account authorization is required to upload into Google Drive.');
  }

  // 1. Determine category & subfolder name
  const { category, subfolderName } = categorizeMusicSubfolder(
    track.title,
    track.artist,
    track.genre,
    track.lyrics
  );

  // 2. Ensure folder hierarchy: Family Circle -> Apple Music -> [Category]
  const rootFolder = await getOrCreateGoogleDriveFolder(token, defaultFolder);
  const appleMusicFolder = await getOrCreateGoogleDriveFolder(token, 'Apple Music', rootFolder.id);
  const categoryFolder = await getOrCreateGoogleDriveFolder(token, subfolderName, appleMusicFolder.id);

  const driveFolderPath = `${rootFolder.name} / Apple Music / ${categoryFolder.name}`;

  // 3. Prepare Binary Audio Blob
  let fileBlob: Blob;
  let fileMime = 'audio/mpeg';
  let cleanName = `${track.title.replace(/[^a-zA-Z0-9_\- ]/g, '').trim()} - ${track.artist.replace(/[^a-zA-Z0-9_\- ]/g, '').trim()}`;

  if (audioFileOrBlob) {
    fileBlob = audioFileOrBlob;
    fileMime = audioFileOrBlob.type || 'audio/mpeg';
    if (audioFileOrBlob instanceof File && audioFileOrBlob.name) {
      const extMatch = audioFileOrBlob.name.match(/\.(mp3|wav|m4a|aac|ogg|flac)$/i);
      if (extMatch) {
        cleanName = `${track.title.replace(/[^a-zA-Z0-9_\- ]/g, '').trim()} - ${track.artist.replace(/[^a-zA-Z0-9_\- ]/g, '').trim()}${extMatch[0]}`;
      }
    }
  } else if (track.audioUrl.startsWith('data:')) {
    const parts = track.audioUrl.split(',');
    fileMime = parts[0].match(/:(.*?);/)?.[1] || 'audio/mpeg';
    const binaryStr = atob(parts[1]);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    fileBlob = new Blob([bytes], { type: fileMime });
  } else {
    // It's a remote URL: attempt to fetch directly, or use audio proxy
    try {
      const res = await fetch(track.audioUrl, { mode: 'cors' });
      if (res.ok) {
        fileBlob = await res.blob();
        fileMime = fileBlob.type || 'audio/mpeg';
      } else {
        throw new Error('Direct fetch failed');
      }
    } catch {
      try {
        const proxyRes = await fetch(getApiUrl(`/api/audio/proxy?url=${encodeURIComponent(track.audioUrl)}`));
        if (proxyRes.ok) {
          fileBlob = await proxyRes.blob();
          fileMime = fileBlob.type || 'audio/mpeg';
        } else {
          throw new Error('Proxy fetch failed');
        }
      } catch {
        // Fallback: create metadata JSON audio track descriptor
        const descriptor = JSON.stringify(
          {
            title: track.title,
            artist: track.artist,
            album: track.album || 'Aura Family Collection',
            genre: track.genre,
            category: subfolderName,
            audioUrl: track.audioUrl,
            artworkUrl: track.artworkUrl,
            lyrics: track.lyrics,
            durationSeconds: track.durationSeconds,
            uploadedAt: new Date().toISOString(),
            platform: 'Apple Music in Family Circle Drive',
          },
          null,
          2
        );
        fileBlob = new Blob([descriptor], { type: 'application/json' });
        cleanName += ' [Track Info].json';
      }
    }
  }

  if (!cleanName.endsWith('.mp3') && !cleanName.endsWith('.wav') && !cleanName.endsWith('.m4a') && !cleanName.endsWith('.json')) {
    cleanName += '.mp3';
  }

  // 4. Multipart upload directly to Google Drive into the category folder
  const boundary = `-------AppleMusicDriveBoundary${Date.now().toString(36)}${Math.random().toString(36).substring(2)}`;
  const metadata = {
    name: cleanName,
    mimeType: fileBlob.type || fileMime,
    parents: [categoryFolder.id],
    description: `Aura Apple Music [${categoryFolder.name}]: "${track.title}" by ${track.artist}\nAlbum: ${track.album || 'Family Music Collection'}\nDuration: ${track.durationSeconds || 180}s`,
  };

  const bodyBlob = new Blob(
    [
      `--${boundary}\r\n`,
      'Content-Type: application/json; charset=UTF-8\r\n\r\n',
      JSON.stringify(metadata),
      `\r\n--${boundary}\r\n`,
      `Content-Type: ${fileBlob.type || fileMime}\r\n\r\n`,
      fileBlob,
      `\r\n--${boundary}--`,
    ],
    {
      type: `multipart/related; boundary=${boundary}`,
    }
  );

  const driveRes = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,mimeType,modifiedTime,size,webViewLink,parents',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: bodyBlob,
    }
  );

  if (!driveRes.ok) {
    const errorBody = await driveRes.text().catch(() => '');
    throw new Error(`Google Drive Apple Music upload failed (${driveRes.status}): ${errorBody}`);
  }

  const driveData = await driveRes.json();
  const driveWebViewLink = driveData.webViewLink || `https://drive.google.com/file/d/${driveData.id}/view`;

  // 5. Enforce parent folder guarantee for Apple Music category subfolder
  let trackParents: string[] = Array.isArray(driveData.parents) ? driveData.parents : [];
  if (categoryFolder.id && !trackParents.includes(categoryFolder.id)) {
    try {
      const moveParams = new URLSearchParams({
        addParents: categoryFolder.id,
        supportsAllDrives: 'true',
        fields: 'id,name,mimeType,modifiedTime,size,webViewLink,parents',
      });
      if (trackParents.length > 0) {
        moveParams.set('removeParents', trackParents.join(','));
      }
      await fetch(
        `https://www.googleapis.com/drive/v3/files/${driveData.id}?${moveParams.toString()}`,
        {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}` },
        }
      );
    } catch (moveErr) {
      console.warn('[Apple Music Drive] Parent move correction notice:', moveErr);
    }
  }

  // 6. Mirror file to server SQLite google_drive_files table
  try {
    await fetch(getApiUrl('/api/google/drive/upload'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: driveData.id,
        name: cleanName,
        mimeType: driveData.mimeType || fileBlob.type || 'audio/mpeg',
        size: driveData.size
          ? `${(Number(driveData.size) / (1024 * 1024)).toFixed(1)} MB`
          : `${(fileBlob.size / (1024 * 1024)).toFixed(1)} MB`,
        sizeBytes: fileBlob.size,
        folderId: categoryFolder.id,
        folderName: driveFolderPath,
        category: `Apple Music - ${categoryFolder.name}`,
        webViewLink: driveWebViewLink,
        modifiedTime: driveData.modifiedTime || new Date().toISOString(),
        userEmail: userEmail || 'chinna.tamil2000@gmail.com',
        uploadedBy: 'apple_music',
      }),
    });
  } catch (err) {
    console.warn('[Apple Music Drive] SQLite mirror notice:', err);
  }

  // 6.5 Persist audio binary content directly into SQLite for instant playback across app refreshes
  try {
    if (fileBlob && fileBlob.size > 0 && typeof FileReader !== 'undefined') {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const res = reader.result as string;
          resolve(res.includes(',') ? res.split(',')[1] : res);
        };
        reader.onerror = reject;
        reader.readAsDataURL(fileBlob);
      });
      const audioContentBase64 = await base64Promise;
      if (audioContentBase64) {
        await fetch(getApiUrl(`/api/music/library/${track.id}/cache-audio`), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            audioContentBase64,
            mimeType: fileBlob.type || fileMime,
          }),
        });
      }
    }
  } catch (cacheErr) {
    console.warn('[Apple Music Drive] SQLite audio caching notice:', cacheErr);
  }

  return {
    driveFileId: driveData.id,
    driveFolderId: categoryFolder.id,
    driveFolderPath,
    driveCategory: categoryFolder.name,
    driveWebViewLink,
  };
}

/**
 * Scan "Family Circle / Apple Music" folder in Google Drive, discovering existing audio files
 * across all category subfolders, and returns reconciled tracks.
 */
export async function refreshAppleMusicFromDrive(
  accessToken: string | null | undefined,
  currentTracks: MusicTrack[],
  defaultFolder = 'Family Circle',
  userEmail = 'chinna.tamil2000@gmail.com'
): Promise<{ tracks: MusicTrack[]; newCount: number }> {
  const token = (accessToken && accessToken.trim()) || localStorage.getItem('aura_google_access_token');
  if (!token) {
    return { tracks: currentTracks, newCount: 0 };
  }

  try {
    // 1. Locate root folder and Apple Music folder
    const rootFolder = await getOrCreateGoogleDriveFolder(token, defaultFolder);
    const appleMusicFolder = await getOrCreateGoogleDriveFolder(token, 'Apple Music', rootFolder.id);

    // 2. Query all subfolders under Apple Music
    const subfolderQuery = `'${appleMusicFolder.id}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    const folderRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(subfolderQuery)}&fields=files(id,name)&pageSize=30`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!folderRes.ok) return { tracks: currentTracks, newCount: 0 };
    const folderData = await folderRes.json();
    const categoryFolders: Array<{ id: string; name: string }> = folderData.files || [];

    const existingIds = new Set(currentTracks.map((t) => t.driveFileId).filter(Boolean));
    const newlyDiscovered: MusicTrack[] = [];

    // 3. For each category folder, query audio files
    for (const catFolder of categoryFolders) {
      const fileQuery = `'${catFolder.id}' in parents and trashed = false and (mimeType contains 'audio' or name contains '.mp3' or name contains '.m4a' or name contains '.wav')`;
      const fileRes = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(fileQuery)}&fields=files(id,name,mimeType,size,webViewLink,webContentLink,createdTime)&pageSize=30`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!fileRes.ok) continue;
      const fileData = await fileRes.json();
      const files = fileData.files || [];

      for (const f of files) {
        if (existingIds.has(f.id)) continue;

        // Parse title and artist from file name
        const baseName = f.name.replace(/\.(mp3|wav|m4a|aac|ogg|json)$/i, '');
        let title = baseName;
        let artist = 'Family Artist';
        if (baseName.includes(' - ')) {
          const parts = baseName.split(' - ');
          title = parts[0].trim();
          artist = parts.slice(1).join(' - ').trim();
        }

        const trackId = `track-drive-${f.id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 16)}`;
        const discoveredTrack: MusicTrack = {
          id: trackId,
          userEmail,
          title,
          artist,
          album: `Apple Music - ${catFolder.name}`,
          genre: catFolder.name,
          audioUrl: getApiUrl(`/api/music/library/${trackId}/audio`),
          artworkUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80',
          durationSeconds: 195,
          driveFileId: f.id,
          driveWebViewLink: f.webViewLink,
          driveFolderPath: `Family Circle / Apple Music / ${catFolder.name}`,
          isFavorite: false,
          playCount: 1,
          createdAt: f.createdTime || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          localCached: true,
        };

        // Mirror discovered track into backend SQLite
        fetch(getApiUrl('/api/music/library'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(discoveredTrack),
        }).catch(() => {});

        newlyDiscovered.push(discoveredTrack);
        existingIds.add(f.id);
      }
    }

    const merged = [...newlyDiscovered, ...currentTracks];
    return { tracks: merged, newCount: newlyDiscovered.length };
  } catch (err) {
    console.warn('[Apple Music Drive] Refresh error:', err);
    return { tracks: currentTracks, newCount: 0 };
  }
}
