import { getGoogleAccessToken } from './healthRecordDriveSync.ts';
import { NavigationRoute } from '../types/mapNavigation.ts';

const DRIVE_BASE_PATH = 'Family Circle / Navigation And Maps / Saved Routes & Trips';

/**
 * Helper to retrieve or create nested folders on Google Drive
 */
export async function getOrCreateMapsFolder(token: string): Promise<string> {
  const parts = ['Family Circle', 'Navigation And Maps', 'Saved Routes & Trips'];
  let parentId = 'root';

  for (const part of parts) {
    const q = encodeURIComponent(
      `mimeType = 'application/vnd.google-apps.folder' and name = '${part}' and '${parentId}' in parents and trashed = false`
    );
    const searchRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id, name)`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!searchRes.ok) {
      throw new Error(`Google Drive API error: ${searchRes.statusText}`);
    }

    const data = await searchRes.json();
    if (data.files && data.files.length > 0) {
      parentId = data.files[0].id;
    } else {
      const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: part,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [parentId],
        }),
      });

      if (!createRes.ok) {
        throw new Error(`Failed to create folder ${part}: ${createRes.statusText}`);
      }

      const createdFolder = await createRes.json();
      parentId = createdFolder.id;
    }
  }

  return parentId;
}

/**
 * Uploads or updates a saved route JSON file in Google Drive
 */
export async function syncRouteToGoogleDrive(
  route: NavigationRoute,
  accessToken?: string
): Promise<{ fileId: string; webViewLink?: string }> {
  const token = accessToken || getGoogleAccessToken();
  if (!token) {
    throw new Error('Google Drive access token unavailable. Please sign in with Google Workspace.');
  }

  const folderId = await getOrCreateMapsFolder(token);
  const fileName = `${route.title.replace(/[^a-zA-Z0-9_-]/g, '_')}_route.json`;

  const routeGeoJson = {
    type: 'FeatureCollection',
    metadata: {
      routeId: route.id,
      title: route.title,
      travelMode: route.travelMode,
      distanceText: route.distanceText,
      durationText: route.durationText,
      origin: route.originName,
      destination: route.destinationName,
      stepsCount: route.steps.length,
      savedAt: new Date().toISOString(),
      source: 'AuraFamily Custom Google Maps & Offline Navigation',
    },
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [route.originLocation.lng, route.originLocation.lat],
        },
        properties: { name: route.originName, role: 'origin' },
      },
      {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [route.destinationLocation.lng, route.destinationLocation.lat],
        },
        properties: { name: route.destinationName, role: 'destination' },
      },
    ],
    routePayload: route,
  };

  const fileBlob = new Blob([JSON.stringify(routeGeoJson, null, 2)], {
    type: 'application/json',
  });

  const metadata = {
    name: fileName,
    parents: [folderId],
    description: `AuraFamily Navigation Route: ${route.title} (${route.distanceText}, ${route.durationText})`,
  };

  const form = new FormData();
  form.append(
    'metadata',
    new Blob([JSON.stringify(metadata)], { type: 'application/json' })
  );
  form.append('file', fileBlob);

  const uploadRes = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: form,
    }
  );

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error(`Failed to upload route to Drive: ${errText}`);
  }

  const uploadedFile = await uploadRes.json();

  // Also notify local SQLite backend to record Drive file ID
  try {
    await fetch(`/api/maps/routes/${route.id}/drive-sync`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        driveFileId: uploadedFile.id,
        driveWebViewLink: uploadedFile.webViewLink,
      }),
    });
  } catch {}

  return {
    fileId: uploadedFile.id,
    webViewLink: uploadedFile.webViewLink,
  };
}

/**
 * Lists routes stored in the user's Google Drive folder
 */
export async function listRoutesFromGoogleDrive(
  accessToken?: string
): Promise<Array<{ id: string; name: string; webViewLink?: string; modifiedTime?: string }>> {
  const token = accessToken || getGoogleAccessToken();
  if (!token) return [];

  try {
    const folderId = await getOrCreateMapsFolder(token);
    const q = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id, name, webViewLink, modifiedTime)&orderBy=modifiedTime desc`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!res.ok) return [];
    const data = await res.json();
    return data.files || [];
  } catch (err) {
    console.warn('Failed to list routes from Google Drive:', err);
    return [];
  }
}
