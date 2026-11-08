import { GeoPoint, NavigationRoute, NavigationStep, OfflineMapPackage } from '../types/mapNavigation.ts';

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
