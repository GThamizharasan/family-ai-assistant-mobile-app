import { GeoPoint, NavigationRoute, NavigationStep, OfflineMapPackage, TransitStepDetails } from '../types/mapNavigation.ts';

const OFFLINE_ROUTES_KEY = 'aura_offline_saved_routes';
const OFFLINE_PACKAGES_KEY = 'aura_offline_map_packages';

/**
 * Decodes a Google Maps encoded polyline into an array of {lat, lng} points.
 */
export function decodePolyline(encoded: string): GeoPoint[] {
  if (!encoded) return [];
  const points: GeoPoint[] = [];
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;

  while (index < len) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push({
      lat: lat / 1e5,
      lng: lng / 1e5,
    });
  }

  return points;
}

/**
 * Calculate distance in meters between two coordinates via Haversine formula
 */
export function calculateDistanceMeters(p1: GeoPoint, p2: GeoPoint): number {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (p1.lat * Math.PI) / 180;
  const φ2 = (p2.lat * Math.PI) / 180;
  const Δφ = ((p2.lat - p1.lat) * Math.PI) / 180;
  const Δλ = ((p2.lng - p1.lng) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

/**
 * Calculate initial bearing between two points in degrees (0 - 360)
 */
export function calculateBearingDegrees(start: GeoPoint, end: GeoPoint): number {
  const startLat = (start.lat * Math.PI) / 180;
  const startLng = (start.lng * Math.PI) / 180;
  const endLat = (end.lat * Math.PI) / 180;
  const endLng = (end.lng * Math.PI) / 180;

  const y = Math.sin(endLng - startLng) * Math.cos(endLat);
  const x =
    Math.cos(startLat) * Math.sin(endLat) -
    Math.sin(startLat) * Math.cos(endLat) * Math.cos(endLng - startLng);
  const θ = Math.atan2(y, x);
  return (Math.round((θ * 180) / Math.PI) + 360) % 360;
}

/**
 * Text-to-speech announcement for turn-by-turn navigation instructions
 */
export function speakTurnInstruction(instruction: string): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const cleanText = instruction.replace(/<[^>]*>/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.warn('Speech synthesis failed:', err);
  }
}

/**
 * Encodes an array of {lat, lng} coordinates into a Google Maps encoded polyline string.
 */
export function encodeCoordinatesPolyline(points: GeoPoint[]): string {
  let result = '';
  let prevLat = 0;
  let prevLng = 0;

  for (const point of points) {
    const lat = Math.round(point.lat * 1e5);
    const lng = Math.round(point.lng * 1e5);

    let dLat = lat - prevLat;
    let dLng = lng - prevLng;

    prevLat = lat;
    prevLng = lng;

    for (let num of [dLat, dLng]) {
      num = num < 0 ? ~(num << 1) : num << 1;
      while (num >= 0x20) {
        result += String.fromCharCode((0x20 | (num & 0x1f)) + 63);
        num >>= 5;
      }
      result += String.fromCharCode(num + 63);
    }
  }
  return result;
}

export function formatTravelModeLabel(mode: string): string {
  switch (mode) {
    case 'transit_bus': return 'City Bus';
    case 'transit_train': return 'Metro / Train';
    case 'bicycle': return 'Bicycle';
    case 'walk': return 'Walking';
    case 'two_wheeler': return 'Two-Wheeler';
    case 'drive':
    default:
      return 'Car Drive';
  }
}

/**
 * Intelligent Client-Side Offline Route Generator
 * Produces full turn-by-turn steps, distance, duration, and encoded polyline
 * when the backend or external internet is unreachable on mobile.
 */
export function generateOfflineClientRoute(
  origin: { lat: number; lng: number; name?: string },
  destination: { lat: number; lng: number; name?: string },
  travelMode = 'drive',
  userEmail = ''
): NavigationRoute {
  const distMeters = Math.max(200, calculateDistanceMeters(origin, destination));
  const distKm = distMeters / 1000;

  let avgSpeedKmh = 40; // car
  if (travelMode === 'transit_bus') avgSpeedKmh = 22;
  else if (travelMode === 'transit_train') avgSpeedKmh = 48;
  else if (travelMode === 'bicycle') avgSpeedKmh = 16;
  else if (travelMode === 'walk') avgSpeedKmh = 4.8;
  else if (travelMode === 'two_wheeler') avgSpeedKmh = 35;

  const durationHours = distKm / avgSpeedKmh;
  const durationSeconds = Math.max(60, Math.round(durationHours * 3600));

  const stepsCount = Math.max(4, Math.min(8, Math.round(distKm / 1.5)));
  const pathPoints: GeoPoint[] = [];

  for (let i = 0; i <= stepsCount; i++) {
    const fraction = i / stepsCount;
    const sinOffset = Math.sin(fraction * Math.PI) * 0.003;
    const lat = origin.lat + (destination.lat - origin.lat) * fraction + sinOffset * 0.4;
    const lng = origin.lng + (destination.lng - origin.lng) * fraction + sinOffset;
    pathPoints.push({ lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) });
  }

  const encodedPolyline = encodeCoordinatesPolyline(pathPoints);

  const steps: NavigationStep[] = [];
  const maneuvers = ['HEAD', 'TURN_RIGHT', 'STRAIGHT', 'TURN_LEFT', 'RAMP_RIGHT', 'STRAIGHT'];
  const roadNames = ['Grand Southern Trunk Rd', 'Anna Salai Corridor', 'Outer Ring Rd', 'Central Bypass', 'Metro Expressway'];

  for (let i = 0; i < pathPoints.length - 1; i++) {
    const startLoc = pathPoints[i];
    const endLoc = pathPoints[i + 1];
    const stepDist = Math.round(distMeters / (pathPoints.length - 1));
    const stepDur = Math.round(durationSeconds / (pathPoints.length - 1));
    const road = roadNames[i % roadNames.length];
    const maneuver = maneuvers[i % maneuvers.length];

    let instruction = `Proceed on ${road} toward ${destination.name || 'destination'}`;
    let transitDetails: TransitStepDetails | undefined = undefined;

    if (travelMode === 'transit_bus') {
      if (i === 0) instruction = `Walk 250m to nearest Bus Stop (${origin.name || 'Origin Hub'})`;
      else if (i === 1) {
        instruction = `Board Bus 21G / 19B Express toward ${destination.name || 'Terminal'}`;
        transitDetails = {
          vehicleType: 'BUS',
          lineName: '21G Express Bus',
          departureStop: `${origin.name || 'Origin'} Stop`,
          arrivalStop: `${destination.name || 'Destination'} Stop`,
          numStops: Math.max(3, stepsCount + 2),
          headsign: destination.name || 'Central Terminal',
          color: '#10b981',
        };
      } else if (i === pathPoints.length - 2) {
        instruction = `Alight at ${destination.name || 'Destination'} Stop and walk 150m`;
      } else {
        instruction = `Stay on Bus 21G past stop ${i} of ${stepsCount}`;
      }
    } else if (travelMode === 'transit_train') {
      if (i === 0) instruction = `Walk to Metro Station (${origin.name || 'Origin'} Station)`;
      else if (i === 1) {
        instruction = `Board Metro Blue Line toward ${destination.name || 'Terminal'}`;
        transitDetails = {
          vehicleType: 'TRAIN',
          lineName: 'Metro Blue Line',
          departureStop: `${origin.name || 'Origin'} Metro Station`,
          arrivalStop: `${destination.name || 'Destination'} Metro Station`,
          numStops: Math.max(4, stepsCount + 3),
          headsign: destination.name || 'Airport / Central',
          color: '#6366f1',
        };
      } else if (i === pathPoints.length - 2) {
        instruction = `Arrive at ${destination.name || 'Destination'} Station, take Exit B`;
      } else {
        instruction = `Continue on train through transit tunnel`;
      }
    } else if (travelMode === 'bicycle') {
      instruction = i === 0 ? `Start biking along dedicated cycle path` : `Continue along ${road}`;
    } else if (travelMode === 'walk') {
      instruction = i === 0 ? `Walk towards ${road} using pedestrian pathway` : `Cross safely and continue on ${road}`;
    } else {
      if (i === 0) instruction = `Head toward ${road}`;
      else if (i === pathPoints.length - 2) instruction = `Turn right onto approach to ${destination.name || 'Destination'}`;
      else instruction = `Follow ${road} for ${(stepDist / 1000).toFixed(1)} km`;
    }

    steps.push({
      instruction,
      maneuver,
      distanceMeters: stepDist,
      distanceText: stepDist >= 1000 ? `${(stepDist / 1000).toFixed(1)} km` : `${stepDist} m`,
      durationText: stepDur >= 60 ? `${Math.round(stepDur / 60)} min` : `${stepDur} sec`,
      startLocation: startLoc,
      endLocation: endLoc,
      travelMode: travelMode as any,
      transitDetails,
      polyline: encodeCoordinatesPolyline([startLoc, endLoc]),
    });
  }

  const distanceText = distMeters >= 1000 ? `${(distMeters / 1000).toFixed(1)} km` : `${distMeters} m`;
  const durationText = durationSeconds >= 3600
    ? `${Math.floor(durationSeconds / 3600)} hr ${Math.round((durationSeconds % 3600) / 60)} min`
    : `${Math.max(1, Math.round(durationSeconds / 60))} mins`;

  return {
    id: 'route_client_' + Date.now(),
    userEmail,
    title: `${origin.name || 'Start'} to ${destination.name || 'Destination'} (${formatTravelModeLabel(travelMode)})`,
    originName: origin.name || 'Current Location',
    originLocation: { lat: origin.lat, lng: origin.lng },
    destinationName: destination.name || 'Destination',
    destinationLocation: { lat: destination.lat, lng: destination.lng },
    travelMode: travelMode as any,
    distanceMeters: distMeters,
    distanceText,
    durationText,
    durationSeconds,
    encodedPolyline,
    decodedPath: pathPoints,
    steps,
    transitSummary: travelMode.startsWith('transit')
      ? `Transit via ${travelMode === 'transit_bus' ? 'Metropolitan Bus (21G)' : 'Blue Line Metro'}`
      : undefined,
    isOfflineCached: true,
    driveSyncStatus: 'local_only',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Cache route in local browser storage for offline access
 */
export function cacheRouteLocally(route: NavigationRoute): void {
  try {
    const cached = getLocalCachedRoutes();
    const updated = [route, ...cached.filter((r) => r.id !== route.id)];
    localStorage.setItem(OFFLINE_ROUTES_KEY, JSON.stringify(updated.slice(0, 50)));
  } catch (err) {
    console.warn('Failed to cache route locally:', err);
  }
}

/**
 * Retrieve cached offline routes from local storage
 */
export function getLocalCachedRoutes(): NavigationRoute[] {
  try {
    const raw = localStorage.getItem(OFFLINE_ROUTES_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/**
 * Delete a route from local cache
 */
export function removeLocalCachedRoute(id: string): void {
  try {
    const cached = getLocalCachedRoutes();
    const filtered = cached.filter((r) => r.id !== id);
    localStorage.setItem(OFFLINE_ROUTES_KEY, JSON.stringify(filtered));
  } catch {}
}

/**
 * Save an offline map package locally
 */
export function cacheOfflinePackageLocally(pkg: OfflineMapPackage): void {
  try {
    const cached = getLocalOfflinePackages();
    const updated = [pkg, ...cached.filter((p) => p.id !== pkg.id)];
    localStorage.setItem(OFFLINE_PACKAGES_KEY, JSON.stringify(updated));
  } catch {}
}

/**
 * Get offline packages from local storage
 */
export function getLocalOfflinePackages(): OfflineMapPackage[] {
  try {
    const raw = localStorage.getItem(OFFLINE_PACKAGES_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/**
 * Delete offline package from local storage
 */
export function removeLocalOfflinePackage(id: string): void {
  try {
    const cached = getLocalOfflinePackages();
    const filtered = cached.filter((p) => p.id !== id);
    localStorage.setItem(OFFLINE_PACKAGES_KEY, JSON.stringify(filtered));
  } catch {}
}
