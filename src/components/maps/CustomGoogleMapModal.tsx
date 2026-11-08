import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  APIProvider,
  Map,
  AdvancedMarker,
  InfoWindow,
  useMap,
} from '@vis.gl/react-google-maps';
import {
  NavigationRoute,
  TransportMode,
  GeoPoint,
  NavigationStep,
  OfflineMapPackage,
} from '../../types/mapNavigation.ts';

declare const google: any;
import { decodePolyline, speakTurnInstruction, cacheRouteLocally, getLocalCachedRoutes, cacheOfflinePackageLocally, getLocalOfflinePackages } from '../../services/offlineMapService.ts';
import { syncRouteToGoogleDrive } from '../../services/mapDriveSync.ts';
import {
  Car,
  Bus,
  Train,
  Bike,
  Footprints,
  Navigation,
  Compass,
  MapPin,
  Save,
  Download,
  Wifi,
  WifiOff,
  Volume2,
  VolumeX,
  Play,
  Pause,
  RotateCcw,
  FastForward,
  Share2,
  ArrowRight,
  ArrowLeft,
  CornerUpRight,
  CornerUpLeft,
  ArrowUp,
  X,
  CheckCircle2,
  ExternalLink,
  Layers,
  Sparkles,
  RefreshCw,
  Search,
  LocateFixed,
  Radio,
} from 'lucide-react';

interface CustomGoogleMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail?: string;
  initialOrigin?: { name: string; lat: number; lng: number };
  initialDestination?: { name: string; lat: number; lng: number };
  initialMode?: TransportMode;
  autoStartNavigation?: boolean;
  isInlineTab?: boolean;
}

// Preset locations for quick selection
const PRESET_PLACES = [
  { name: 'Family Home', lat: 13.0827, lng: 80.2707 },
  { name: 'Chennai Central Station', lat: 13.0823, lng: 80.2755 },
  { name: 'Chennai International Airport', lat: 12.9941, lng: 80.1709 },
  { name: 'Tidel Tech Park (OMR)', lat: 12.9892, lng: 80.2505 },
  { name: 'Apollo Main Hospital', lat: 13.0601, lng: 80.2509 },
  { name: 'Marina Beach Promenade', lat: 13.0500, lng: 80.2824 },
  { name: 'Phoenix Marketcity Mall', lat: 12.9918, lng: 80.2173 },
  { name: 'Anna University Campus', lat: 13.0102, lng: 80.2354 },
];

const MODE_CONFIG: Record<
  TransportMode,
  { label: string; icon: any; color: string; bg: string; badge: string }
> = {
  drive: {
    label: 'Car Drive',
    icon: Car,
    color: '#3b82f6',
    bg: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    badge: 'bg-blue-600',
  },
  transit_bus: {
    label: 'City Bus',
    icon: Bus,
    color: '#10b981',
    bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    badge: 'bg-emerald-600',
  },
  transit_train: {
    label: 'Metro / Train',
    icon: Train,
    color: '#6366f1',
    bg: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
    badge: 'bg-indigo-600',
  },
  bicycle: {
    label: 'Bicycle',
    icon: Bike,
    color: '#f97316',
    bg: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
    badge: 'bg-orange-600',
  },
  walk: {
    label: 'Walking',
    icon: Footprints,
    color: '#eab308',
    bg: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    badge: 'bg-amber-600',
  },
  two_wheeler: {
    label: 'Two-Wheeler',
    icon: Compass,
    color: '#06b6d4',
    bg: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
    badge: 'bg-cyan-600',
  },
};

/**
 * Polyline overlay renderer that safely fits bounds on Google Maps
 */
function RoutePolyline({
  path,
  color,
}: {
  path: GeoPoint[];
  color: string;
}) {
  const map = useMap();
  const polylineRef = useRef<any>(null);

  useEffect(() => {
    if (!map || !path || path.length === 0) return;

    if (polylineRef.current) {
      polylineRef.current.setMap(null);
    }

    const polyline = new google.maps.Polyline({
      path,
      geodesic: true,
      strokeColor: color,
      strokeOpacity: 0.9,
      strokeWeight: 6,
    });

    polyline.setMap(map);
    polylineRef.current = polyline;

    // Fit map bounds to view whole route
    const bounds = new google.maps.LatLngBounds();
    path.forEach((pt) => bounds.extend(pt));
    map.fitBounds(bounds, { top: 60, right: 60, bottom: 60, left: 60 });

    return () => {
      if (polylineRef.current) {
        polylineRef.current.setMap(null);
        polylineRef.current = null;
      }
    };
  }, [map, path, color]);

  return null;
}

/**
 * Controller to capture Google Maps instance for programmatic panning & zooming
 */
function MapInstanceController({
  onMapInstance,
}: {
  onMapInstance: (map: any) => void;
}) {
  const map = useMap();
  useEffect(() => {
    if (map) {
      onMapInstance(map);
    }
  }, [map, onMapInstance]);
  return null;
}

/**
 * Haversine formula to compute distance in meters between two coordinates
 */
function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

export const CustomGoogleMapModal: React.FC<CustomGoogleMapModalProps> = ({
  isOpen,
  onClose,
  userEmail = 'family@aura.hub',
  initialOrigin,
  initialDestination,
  initialMode = 'drive',
  autoStartNavigation = false,
  isInlineTab = false,
}) => {
  // Config & API Key
  const [apiKey, setApiKey] = useState<string>(() => {
    return (
      (typeof window !== 'undefined' ? localStorage.getItem('aura_google_maps_key') : null) ||
      (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string) ||
      ''
    );
  });
  const [activeTab, setActiveTab] = useState<'navigate' | 'saved' | 'packages'>('navigate');

  // Route Planning State
  const [selectedMode, setSelectedMode] = useState<TransportMode>(initialMode);
  const [origin, setOrigin] = useState<{ name: string; lat: number; lng: number }>(
    initialOrigin || PRESET_PLACES[0]
  );
  const [destination, setDestination] = useState<{ name: string; lat: number; lng: number } | null>(
    initialDestination || null
  );
  const [customOriginInput, setCustomOriginInput] = useState(origin.name);
  const [customDestInput, setCustomDestInput] = useState(initialDestination ? initialDestination.name : '');

  // Destination Search & Auto-Suggest State
  const [destSearchResults, setDestSearchResults] = useState<
    Array<{ name: string; lat: number; lng: number; formattedAddress?: string }>
  >([]);
  const [isSearchingDest, setIsSearchingDest] = useState(false);
  const [showDestSuggestions, setShowDestSuggestions] = useState(false);
  const searchDebounceTimerRef = useRef<any>(null);

  // Computed Route & Navigation State
  const [isComputing, setIsComputing] = useState(false);
  const [currentRoute, setCurrentRoute] = useState<NavigationRoute | null>(null);
  const [decodedCoordinates, setDecodedCoordinates] = useState<GeoPoint[]>([]);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  // Offline & Drive Sync State
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [isSyncingDrive, setIsSyncingDrive] = useState(false);
  const [driveSyncSuccess, setDriveSyncSuccess] = useState<string | null>(null);
  const [savedRoutes, setSavedRoutes] = useState<NavigationRoute[]>([]);
  const [offlinePackages, setOfflinePackages] = useState<OfflineMapPackage[]>([]);

  // Turn-by-Turn Live Simulation & GPS State
  const [isNavigating, setIsNavigating] = useState(false);
  const [simStepIndex, setSimStepIndex] = useState(0);
  const [simProgress, setSimProgress] = useState(0);
  const [simSpeedMultiplier, setSimSpeedMultiplier] = useState(1);
  const [isVoiceGuidanceActive, setIsVoiceGuidanceActive] = useState(true);
  const [simCurrentLocation, setSimCurrentLocation] = useState<GeoPoint | null>(null);

  // Real-Time GPS Geolocation State
  const [realGpsLocation, setRealGpsLocation] = useState<{
    lat: number;
    lng: number;
    accuracy: number;
    heading?: number | null;
    speed?: number | null;
    timestamp: number;
  } | null>(null);
  const [isAcquiringGps, setIsAcquiringGps] = useState(false);
  const [gpsStatusNotice, setGpsStatusNotice] = useState<string | null>(null);
  const [isFollowingGps, setIsFollowingGps] = useState(false);
  const [navModeType, setNavModeType] = useState<'live_gps' | 'simulation'>('live_gps');

  const mapInstanceRef = useRef<any>(null);
  const gpsWatchIdRef = useRef<number | null>(null);

  // Marker Info Window
  const [activeMarkerInfo, setActiveMarkerInfo] = useState<
    'origin' | 'destination' | 'cursor' | 'my-location' | null
  >(null);

  // Acquire current real-time GPS coordinates
  const acquireCurrentLocation = (autoSetOrigin = false, shouldCenterMap = true) => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setGpsStatusNotice('GPS Geolocation is not supported on this device/browser.');
      setTimeout(() => setGpsStatusNotice(null), 4000);
      return;
    }

    setIsAcquiringGps(true);
    setGpsStatusNotice('Acquiring real-time high-accuracy GPS coordinates...');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsAcquiringGps(false);
        const { latitude, longitude, accuracy, heading, speed } = pos.coords;
        const newLocation = {
          lat: latitude,
          lng: longitude,
          accuracy: Math.round(accuracy),
          heading: heading ?? null,
          speed: speed ?? null,
          timestamp: pos.timestamp || Date.now(),
        };

        setRealGpsLocation(newLocation);
        setGpsStatusNotice(`✓ Real-time location active (Accuracy: ±${Math.round(accuracy)}m)`);
        setTimeout(() => setGpsStatusNotice(null), 4000);

        if (autoSetOrigin) {
          setOrigin({
            name: 'My Current Location (Live GPS)',
            lat: latitude,
            lng: longitude,
          });
          setCustomOriginInput('My Current Location (Live GPS)');
        }

        if (shouldCenterMap && mapInstanceRef.current) {
          mapInstanceRef.current.panTo({ lat: latitude, lng: longitude });
          mapInstanceRef.current.setZoom(16);
        }
      },
      (err) => {
        setIsAcquiringGps(false);
        console.warn('[GPS] High accuracy position timed out or failed, trying standard fallback:', err);
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const { latitude, longitude, accuracy } = pos.coords;
            const newLocation = {
              lat: latitude,
              lng: longitude,
              accuracy: Math.round(accuracy),
              timestamp: pos.timestamp || Date.now(),
            };
            setRealGpsLocation(newLocation);
            setGpsStatusNotice(`✓ Location acquired (Accuracy: ±${Math.round(accuracy)}m)`);
            setTimeout(() => setGpsStatusNotice(null), 4000);

            if (autoSetOrigin) {
              setOrigin({
                name: 'My Current Location (Live GPS)',
                lat: latitude,
                lng: longitude,
              });
              setCustomOriginInput('My Current Location (Live GPS)');
            }

            if (shouldCenterMap && mapInstanceRef.current) {
              mapInstanceRef.current.panTo({ lat: latitude, lng: longitude });
              mapInstanceRef.current.setZoom(15);
            }
          },
          (fallbackErr) => {
            setGpsStatusNotice(`GPS Notice: ${fallbackErr.message}. Check browser location permission.`);
            setTimeout(() => setGpsStatusNotice(null), 5000);
          },
          { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
        );
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 10000 }
    );
  };

  const handleCenterOnMyLocation = () => {
    if (realGpsLocation && mapInstanceRef.current) {
      mapInstanceRef.current.panTo({ lat: realGpsLocation.lat, lng: realGpsLocation.lng });
      mapInstanceRef.current.setZoom(16);
      setGpsStatusNotice('Centered on your real-time GPS location.');
      setTimeout(() => setGpsStatusNotice(null), 3000);
    } else {
      acquireCurrentLocation(false, true);
    }
  };

  // Start continuous watchPosition when modal is open
  useEffect(() => {
    if (!isOpen) {
      if (gpsWatchIdRef.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.clearWatch(gpsWatchIdRef.current);
        gpsWatchIdRef.current = null;
      }
      return;
    }

    // Automatically acquire live location on mount (set as origin if initialOrigin not specified)
    acquireCurrentLocation(!initialOrigin, true);

    // Continuous real-time GPS tracking
    if (typeof window !== 'undefined' && navigator.geolocation) {
      try {
        const id = navigator.geolocation.watchPosition(
          (pos) => {
            const { latitude, longitude, accuracy, heading, speed } = pos.coords;
            const loc = {
              lat: latitude,
              lng: longitude,
              accuracy: Math.round(accuracy),
              heading: heading ?? null,
              speed: speed ?? null,
              timestamp: pos.timestamp || Date.now(),
            };
            setRealGpsLocation(loc);

            // If following GPS or navigating in live GPS mode, pan map
            if (isFollowingGps && mapInstanceRef.current) {
              mapInstanceRef.current.panTo({ lat: latitude, lng: longitude });
            }
          },
          (err) => {
            console.warn('[CustomGoogleMapModal] watchPosition warning:', err.message);
          },
          { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
        );
        gpsWatchIdRef.current = id;
      } catch (e) {
        console.warn('[CustomGoogleMapModal] watchPosition init error:', e);
      }
    }

    return () => {
      if (gpsWatchIdRef.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.clearWatch(gpsWatchIdRef.current);
        gpsWatchIdRef.current = null;
      }
    };
  }, [isOpen, initialOrigin, isFollowingGps]);

  // Fetch client configuration from backend if API key not stored locally
  useEffect(() => {
    async function loadConfig() {
      try {
        const res = await fetch('/api/maps/client-config');
        if (res.ok) {
          const data = await res.json();
          if (data?.apiKey) {
            setApiKey(data.apiKey);
          }
        }
      } catch (err) {
        console.warn('Could not fetch maps client config:', err);
      }
    }
    loadConfig();
  }, []);

  // Update initial parameters if passed dynamically
  useEffect(() => {
    if (initialOrigin) {
      setOrigin(initialOrigin);
      setCustomOriginInput(initialOrigin.name);
    }
    if (initialDestination) {
      setDestination(initialDestination);
      setCustomDestInput(initialDestination.name);
    }
    if (initialMode) {
      setSelectedMode(initialMode);
    }
  }, [initialOrigin, initialDestination, initialMode]);

  // Load saved routes and offline packages from SQLite and localStorage
  useEffect(() => {
    async function loadSavedData() {
      try {
        const routesRes = await fetch(`/api/maps/routes?userEmail=${encodeURIComponent(userEmail)}`);
        if (routesRes.ok) {
          const data = await routesRes.json();
          if (data.routes && data.routes.length > 0) {
            setSavedRoutes(
              data.routes.map((r: any) => ({
                ...r,
                originLocation: { lat: r.originLat, lng: r.originLng },
                destinationLocation: { lat: r.destinationLat, lng: r.destinationLng },
                steps: typeof r.stepsJson === 'string' ? JSON.parse(r.stepsJson || '[]') : r.stepsJson,
              }))
            );
          } else {
            setSavedRoutes(getLocalCachedRoutes());
          }
        } else {
          setSavedRoutes(getLocalCachedRoutes());
        }

        const pkgRes = await fetch('/api/maps/offline-packages');
        if (pkgRes.ok) {
          const pData = await pkgRes.json();
          if (pData.packages && pData.packages.length > 0) {
            setOfflinePackages(
              pData.packages.map((p: any) => ({
                ...p,
                center: { lat: p.centerLat, lng: p.centerLng },
                routeIds: typeof p.routeIdsJson === 'string' ? JSON.parse(p.routeIdsJson || '[]') : [],
              }))
            );
          } else {
            setOfflinePackages(getLocalOfflinePackages());
          }
        } else {
          setOfflinePackages(getLocalOfflinePackages());
        }
      } catch {
        setSavedRoutes(getLocalCachedRoutes());
        setOfflinePackages(getLocalOfflinePackages());
      }
    }

    if (isOpen) {
      loadSavedData();
    }
  }, [isOpen, userEmail]);

  // Search destination based on user query
  const handleSearchDestination = async (query: string, autoSelectFirst = false) => {
    const q = (query || '').trim();
    if (!q) {
      setDestSearchResults([]);
      setShowDestSuggestions(false);
      return null;
    }

    setIsSearchingDest(true);
    setErrorNotice(null);

    try {
      // 1. Client-side Google Geocoder if loaded
      if (typeof window !== 'undefined' && (window as any).google?.maps?.Geocoder) {
        try {
          const geocoder = new (window as any).google.maps.Geocoder();
          const geoRes = await new Promise<any>((resolve) => {
            geocoder.geocode({ address: q }, (res: any, status: string) => {
              if (status === 'OK' && res && res.length > 0) {
                resolve(res);
              } else {
                resolve(null);
              }
            });
          });

          if (geoRes && geoRes.length > 0) {
            const places = geoRes.slice(0, 5).map((r: any) => ({
              name: r.formatted_address || q,
              formattedAddress: r.formatted_address,
              lat: r.geometry.location.lat(),
              lng: r.geometry.location.lng(),
            }));
            setDestSearchResults(places);
            setShowDestSuggestions(true);

            if (autoSelectFirst && places[0]) {
              applyDestination(places[0]);
              return places[0];
            }
            return places;
          }
        } catch (e) {
          console.warn('[Geocode] Client geocoder warning:', e);
        }
      }

      // 2. Server geocoding endpoint
      const res = await fetch(`/api/maps/geocode?query=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.results) && data.results.length > 0) {
          setDestSearchResults(data.results);
          setShowDestSuggestions(true);

          if (autoSelectFirst && data.results[0]) {
            applyDestination(data.results[0]);
            return data.results[0];
          }
          return data.results;
        }
      }

      // 3. Fallback matching presets
      const lower = q.toLowerCase();
      const matched = PRESET_PLACES.filter((p) => p.name.toLowerCase().includes(lower));
      if (matched.length > 0) {
        setDestSearchResults(matched);
        setShowDestSuggestions(true);
        if (autoSelectFirst && matched[0]) {
          applyDestination(matched[0]);
          return matched[0];
        }
        return matched;
      }

      if (autoSelectFirst) {
        setErrorNotice(`No matching locations found for "${q}". Please check spelling or enter a landmark.`);
      }
      return null;
    } catch (err: any) {
      console.warn('Destination search error:', err);
      if (autoSelectFirst) {
        setErrorNotice('Failed to search target destination.');
      }
      return null;
    } finally {
      setIsSearchingDest(false);
    }
  };

  const handleDestInputChange = (val: string) => {
    setCustomDestInput(val);
    if (destination && destination.name !== val) {
      setDestination(null);
      setCurrentRoute(null);
      setDecodedCoordinates([]);
    }

    if (searchDebounceTimerRef.current) {
      clearTimeout(searchDebounceTimerRef.current);
    }

    if (!val || val.trim().length < 2) {
      setDestSearchResults([]);
      setShowDestSuggestions(false);
      return;
    }

    searchDebounceTimerRef.current = setTimeout(() => {
      handleSearchDestination(val, false);
    }, 350);
  };

  const applyDestination = (place: { name: string; lat: number; lng: number }) => {
    setDestination(place);
    setCustomDestInput(place.name);
    setShowDestSuggestions(false);
    setDestSearchResults([]);
    setErrorNotice(null);
    if (mapInstanceRef.current) {
      mapInstanceRef.current.panTo({ lat: place.lat, lng: place.lng });
      mapInstanceRef.current.setZoom(15);
    }
    handleComputeRoute(undefined, place);
  };

  // Handle route computation
  const handleComputeRoute = async (
    modeOverride?: TransportMode,
    destinationOverride?: { name: string; lat: number; lng: number }
  ) => {
    const targetDest = destinationOverride || destination;

    if (!targetDest) {
      if (!customDestInput.trim()) {
        setErrorNotice('Please search or enter a target destination above.');
        return;
      }
      // Attempt to resolve target location from the search input
      await handleSearchDestination(customDestInput, true);
      return;
    }

    const mode = modeOverride || selectedMode;
    setIsComputing(true);
    setErrorNotice(null);
    setDriveSyncSuccess(null);
    setIsNavigating(false);

    try {
      const res = await fetch('/api/maps/routes/compute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin: { lat: origin.lat, lng: origin.lng, name: origin.name },
          destination: { lat: targetDest.lat, lng: targetDest.lng, name: targetDest.name },
          travelMode: mode,
          userEmail,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to compute route directions.');
      }

      const data = await res.json();
      if (data?.route) {
        const route: NavigationRoute = data.route;
        const decoded = decodePolyline(route.encodedPolyline);
        route.decodedPath = decoded;

        setCurrentRoute(route);
        setDecodedCoordinates(decoded);
        setSimCurrentLocation(decoded[0] || origin);

        // Cache locally for offline navigation
        cacheRouteLocally(route);

        // Save to SQLite
        try {
          await fetch('/api/maps/routes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(route),
          });
        } catch {}

        if (autoStartNavigation) {
          startNavigationSimulation(route, decoded);
        }
      } else {
        setErrorNotice('No valid route could be determined for this mode.');
      }
    } catch (err: any) {
      console.warn('Compute route error:', err);
      setErrorNotice(err.message || 'Routing computation failed.');
    } finally {
      setIsComputing(false);
    }
  };

  // Automatically compute route on open ONLY IF an explicit initialDestination was provided
  useEffect(() => {
    if (isOpen && !currentRoute && initialDestination) {
      handleComputeRoute();
    }
  }, [isOpen]);

  // Live GPS turn-by-turn step tracking
  useEffect(() => {
    if (!isNavigating || navModeType !== 'live_gps' || !realGpsLocation || !currentRoute?.steps) return;

    if (isFollowingGps && mapInstanceRef.current) {
      mapInstanceRef.current.panTo({ lat: realGpsLocation.lat, lng: realGpsLocation.lng });
    }

    const steps = currentRoute.steps;
    if (steps.length === 0) return;

    const currentStep = steps[simStepIndex];
    if (currentStep?.startLocation) {
      const dist = calculateDistanceMeters(
        realGpsLocation.lat,
        realGpsLocation.lng,
        currentStep.endLocation?.lat ?? currentStep.startLocation.lat,
        currentStep.endLocation?.lng ?? currentStep.startLocation.lng
      );

      // If user reached within 40 meters of step end, transition to next step
      if (dist <= 40 && simStepIndex < steps.length - 1) {
        const nextIdx = simStepIndex + 1;
        setSimStepIndex(nextIdx);
        const nextStep = steps[nextIdx];
        if (isVoiceGuidanceActive && nextStep?.instruction) {
          speakTurnInstruction(nextStep.instruction);
        }
      }
    }
  }, [realGpsLocation, isNavigating, navModeType, isFollowingGps, simStepIndex, currentRoute, isVoiceGuidanceActive]);

  // Turn-by-Turn Simulation Timer (only active during simulation demo)
  useEffect(() => {
    if (!isNavigating || navModeType !== 'simulation' || !decodedCoordinates || decodedCoordinates.length === 0) return;

    const interval = setInterval(() => {
      setSimProgress((prev) => {
        const next = prev + 0.02 * simSpeedMultiplier;
        if (next >= 1) {
          setIsNavigating(false);
          if (isVoiceGuidanceActive) {
            speakTurnInstruction('You have arrived at your destination.');
          }
          return 1;
        }

        // Calculate current simulated GPS coordinate
        const totalPoints = decodedCoordinates.length;
        const targetIndex = Math.floor(next * (totalPoints - 1));
        const pt = decodedCoordinates[targetIndex];
        if (pt) {
          setSimCurrentLocation(pt);
          if (isFollowingGps && mapInstanceRef.current) {
            mapInstanceRef.current.panTo(pt);
          }
        }

        // Calculate step index
        if (currentRoute?.steps && currentRoute.steps.length > 0) {
          const stepIdx = Math.min(
            currentRoute.steps.length - 1,
            Math.floor(next * currentRoute.steps.length)
          );
          if (stepIdx !== simStepIndex) {
            setSimStepIndex(stepIdx);
            const step = currentRoute.steps[stepIdx];
            if (isVoiceGuidanceActive && step?.instruction) {
              speakTurnInstruction(step.instruction);
            }
          }
        }

        return next;
      });
    }, 500);

    return () => clearInterval(interval);
  }, [isNavigating, navModeType, decodedCoordinates, simSpeedMultiplier, currentRoute, simStepIndex, isVoiceGuidanceActive, isFollowingGps]);

  const startNavigationSimulation = (
    route = currentRoute,
    path = decodedCoordinates,
    mode: 'live_gps' | 'simulation' = 'live_gps'
  ) => {
    if (!route || path.length === 0) return;
    setIsNavigating(true);
    setNavModeType(mode);
    setSimProgress(0);
    setSimStepIndex(0);
    if (mode === 'live_gps' && realGpsLocation) {
      setSimCurrentLocation(realGpsLocation);
      setIsFollowingGps(true);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.panTo(realGpsLocation);
        mapInstanceRef.current.setZoom(17);
      }
    } else {
      setSimCurrentLocation(path[0]);
    }
    if (isVoiceGuidanceActive && route.steps[0]) {
      speakTurnInstruction(`Starting ${mode === 'live_gps' ? 'live GPS' : ''} navigation to ${route.destinationName}. ${route.steps[0].instruction}`);
    }
  };

  const handleSwapLocations = () => {
    if (!destination) return;
    const tempOrig = origin;
    const tempDest = destination;
    setOrigin(tempDest);
    setDestination(tempOrig);
    setCustomOriginInput(tempDest.name);
    setCustomDestInput(tempOrig.name);
  };

  const handleSelectPreset = (place: { name: string; lat: number; lng: number }, target: 'origin' | 'dest') => {
    if (target === 'origin') {
      setOrigin(place);
      setCustomOriginInput(place.name);
    } else {
      applyDestination(place);
    }
  };

  const handleSyncToDrive = async () => {
    if (!currentRoute) return;
    setIsSyncingDrive(true);
    setDriveSyncSuccess(null);
    try {
      const result = await syncRouteToGoogleDrive(currentRoute);
      setDriveSyncSuccess(`Synced to Google Drive folder "Family Circle / Navigation And Maps / Saved Routes & Trips"!`);
      setCurrentRoute((prev) =>
        prev
          ? {
              ...prev,
              driveFileId: result.fileId,
              driveWebViewLink: result.webViewLink,
              driveSyncStatus: 'synced',
            }
          : null
      );
    } catch (err: any) {
      setErrorNotice(err.message || 'Drive sync failed. Make sure Google Drive access is authorized.');
    } finally {
      setIsSyncingDrive(false);
    }
  };

  const handleDownloadOfflineRegion = async (packageName: string) => {
    const newPkg: OfflineMapPackage = {
      id: 'pkg_' + Date.now(),
      packageName,
      center: origin,
      zoom: 14,
      radiusKm: 15,
      routesCount: currentRoute ? 1 : 0,
      routeIds: currentRoute ? [currentRoute.id] : [],
      sizeBytes: 1024 * 1024 * 6.4,
      isDownloaded: true,
      downloadedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    cacheOfflinePackageLocally(newPkg);
    setOfflinePackages((prev) => [newPkg, ...prev]);

    try {
      await fetch('/api/maps/offline-packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPkg),
      });
    } catch {}
  };

  if (!isOpen) return null;

  const currentModeInfo = MODE_CONFIG[selectedMode];

  const modalBody = (
    <div className={`relative w-full ${isInlineTab ? 'h-full flex-1 min-h-[calc(100vh-10rem)]' : 'max-w-6xl max-h-[95vh]'} bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden`}>
      {/* Header Bar */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 bg-neutral-950/80 border-b border-neutral-800">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20">
            <Navigation className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white tracking-tight">
                AuraFamily Custom Google Maps & Offline Navigation
              </h2>
              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                Routes API v2
              </span>
              {isOfflineMode && (
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                  <WifiOff className="w-3 h-3" /> Offline Mode
                </span>
              )}
            </div>
            <p className="text-xs text-neutral-400">
              Multi-Modal Transit, Bus, Train, Cycle, Car & SQLite/Drive Sync
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Offline Mode Toggle Button */}
          <button
            onClick={() => setIsOfflineMode(!isOfflineMode)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              isOfflineMode
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
            }`}
            title="Toggle Offline Navigation Mode"
          >
            {isOfflineMode ? <WifiOff className="w-3.5 h-3.5" /> : <Wifi className="w-3.5 h-3.5 text-emerald-400" />}
            <span>{isOfflineMode ? 'Offline On' : 'Online'}</span>
          </button>

          {/* Navigation / Saved Tabs Switcher */}
          <div className="hidden sm:flex items-center bg-neutral-800 rounded-lg p-0.5 text-xs font-medium">
            <button
              onClick={() => setActiveTab('navigate')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                activeTab === 'navigate' ? 'bg-neutral-700 text-white shadow' : 'text-neutral-400 hover:text-white'
              }`}
            >
              Directions
            </button>
            <button
              onClick={() => setActiveTab('saved')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                activeTab === 'saved' ? 'bg-neutral-700 text-white shadow' : 'text-neutral-400 hover:text-white'
              }`}
            >
              Saved Routes ({savedRoutes.length})
            </button>
            <button
              onClick={() => setActiveTab('packages')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                activeTab === 'packages' ? 'bg-neutral-700 text-white shadow' : 'text-neutral-400 hover:text-white'
              }`}
            >
              Offline Packages ({offlinePackages.length})
            </button>
          </div>

          <button
            onClick={onClose}
            className={`p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors flex items-center gap-1.5 ${
              isInlineTab ? 'bg-neutral-800/80 text-neutral-200 px-3 py-1.5 border border-neutral-700 text-xs font-semibold' : ''
            }`}
            title={isInlineTab ? 'Back to Hub' : 'Close'}
          >
            {isInlineTab ? (
              <>
                <ArrowLeft className="w-4 h-4" />
                <span>Hub</span>
              </>
            ) : (
              <X className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

        {/* Transportation Mode Selector Tabs */}
        <div className="px-4 sm:px-6 py-2.5 bg-neutral-900 border-b border-neutral-800 overflow-x-auto flex items-center gap-2">
          {(Object.keys(MODE_CONFIG) as TransportMode[]).map((mode) => {
            const config = MODE_CONFIG[mode];
            const Icon = config.icon;
            const isSelected = selectedMode === mode;
            return (
              <button
                key={mode}
                onClick={() => {
                  setSelectedMode(mode);
                  handleComputeRoute(mode);
                }}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap ${
                  isSelected
                    ? `${config.bg} border shadow-sm ring-1 ring-white/10`
                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 border border-transparent'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{config.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content Body Grid */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0 overflow-hidden">
          {/* Left Column: Route Controls & Guidance (5 Cols) */}
          <div className="lg:col-span-5 p-4 flex flex-col gap-4 overflow-y-auto border-r border-neutral-800 max-h-[400px] lg:max-h-full">
            {activeTab === 'navigate' && (
              <>
                {/* Origin & Destination Inputs */}
                <div className="bg-neutral-950/70 p-3.5 rounded-xl border border-neutral-800 flex flex-col gap-3">
                  <div className="flex items-center justify-between text-xs font-semibold text-neutral-300">
                    <div className="flex items-center gap-2">
                      <span>Route Locations</span>
                      {realGpsLocation && (
                        <span className="text-[10px] text-emerald-400 font-normal flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          GPS ±{realGpsLocation.accuracy}m
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          if (realGpsLocation) {
                            setOrigin({
                              name: 'My Current Location (Live GPS)',
                              lat: realGpsLocation.lat,
                              lng: realGpsLocation.lng,
                            });
                            setCustomOriginInput('My Current Location (Live GPS)');
                            if (mapInstanceRef.current) {
                              mapInstanceRef.current.panTo({ lat: realGpsLocation.lat, lng: realGpsLocation.lng });
                              mapInstanceRef.current.setZoom(15);
                            }
                          } else {
                            acquireCurrentLocation(true, true);
                          }
                        }}
                        className="text-blue-400 hover:text-blue-300 flex items-center gap-1 text-[11px] font-semibold cursor-pointer"
                        title="Set origin to your real-time GPS location"
                      >
                        <LocateFixed className="w-3 h-3" /> My Location
                      </button>
                      <button
                        onClick={handleSwapLocations}
                        className="text-neutral-400 hover:text-white flex items-center gap-1 text-[11px] cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" /> Swap
                      </button>
                    </div>
                  </div>

                  {/* Origin */}
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20 shrink-0" />
                    <input
                      type="text"
                      value={customOriginInput}
                      onChange={(e) => setCustomOriginInput(e.target.value)}
                      placeholder="Origin Address or Place"
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* Destination Search Input with Live Suggestions */}
                  <div className="relative">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-rose-500 ring-4 ring-rose-500/20 shrink-0" />
                      <div className="relative flex-1 flex items-center">
                        <input
                          type="text"
                          value={customDestInput}
                          onChange={(e) => handleDestInputChange(e.target.value)}
                          onFocus={() => {
                            if (destSearchResults.length > 0) setShowDestSuggestions(true);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSearchDestination(customDestInput, true);
                            }
                          }}
                          placeholder="Search target destination or address..."
                          className="w-full bg-neutral-900 border border-neutral-700 rounded-lg pl-2.5 pr-14 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-blue-500"
                        />
                        <div className="absolute right-1 flex items-center gap-1">
                          {customDestInput && (
                            <button
                              type="button"
                              onClick={() => {
                                setCustomDestInput('');
                                setDestination(null);
                                setCurrentRoute(null);
                                setDecodedCoordinates([]);
                                setDestSearchResults([]);
                                setShowDestSuggestions(false);
                              }}
                              className="p-1 text-neutral-400 hover:text-white rounded"
                              title="Clear destination"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleSearchDestination(customDestInput, true)}
                            disabled={isSearchingDest || !customDestInput.trim()}
                            className="p-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-40 transition-colors"
                            title="Search target location"
                          >
                            {isSearchingDest ? (
                              <RefreshCw className="w-3 h-3 animate-spin" />
                            ) : (
                              <Search className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Auto-suggest Search Results Dropdown */}
                    {showDestSuggestions && destSearchResults.length > 0 && (
                      <div className="absolute left-5 right-0 top-full mt-1 z-30 bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl overflow-hidden max-h-56 overflow-y-auto">
                        <div className="px-3 py-1.5 bg-neutral-950/90 border-b border-neutral-800 text-[10px] text-neutral-400 font-semibold flex items-center justify-between">
                          <span>Search Results ({destSearchResults.length})</span>
                          <button
                            type="button"
                            onClick={() => setShowDestSuggestions(false)}
                            className="hover:text-white"
                          >
                            ✕
                          </button>
                        </div>
                        {destSearchResults.map((place, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => applyDestination(place)}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-neutral-800 border-b border-neutral-800/50 last:border-b-0 flex items-start gap-2 group transition-colors"
                          >
                            <MapPin className="w-3.5 h-3.5 text-rose-400 mt-0.5 shrink-0 group-hover:scale-110 transition-transform" />
                            <div className="min-w-0 flex-1">
                              <div className="font-medium text-white truncate">{place.name}</div>
                              {place.formattedAddress && place.formattedAddress !== place.name && (
                                <div className="text-[10px] text-neutral-400 truncate">{place.formattedAddress}</div>
                              )}
                              <div className="text-[9px] text-neutral-500 font-mono">
                                {place.lat.toFixed(4)}, {place.lng.toFixed(4)}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Quick Preset Badges */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <span className="text-[10px] text-neutral-400 flex items-center gap-1 mr-1">
                      <Sparkles className="w-2.5 h-2.5 text-amber-400" /> Quick:
                    </span>
                    {realGpsLocation && (
                      <button
                        onClick={() => {
                          setOrigin({
                            name: 'My Current Location (Live GPS)',
                            lat: realGpsLocation.lat,
                            lng: realGpsLocation.lng,
                          });
                          setCustomOriginInput('My Current Location (Live GPS)');
                          if (mapInstanceRef.current) {
                            mapInstanceRef.current.panTo({ lat: realGpsLocation.lat, lng: realGpsLocation.lng });
                            mapInstanceRef.current.setZoom(15);
                          }
                        }}
                        className="text-[11px] px-2 py-0.5 rounded-md bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 border border-blue-500/40 font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                        title="Use real-time GPS coordinates as Origin"
                      >
                        <LocateFixed className="w-2.5 h-2.5 text-blue-400" />
                        <span>My Location</span>
                      </button>
                    )}
                    {PRESET_PLACES.slice(0, 5).map((place) => (
                      <button
                        key={place.name}
                        onClick={() => handleSelectPreset(place, 'dest')}
                        className="text-[11px] px-2 py-0.5 rounded-md bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors"
                      >
                        {place.name.split(' ')[0]}
                      </button>
                    ))}
                  </div>

                  {/* Compute Route Button */}
                  <button
                    onClick={() => handleComputeRoute()}
                    disabled={isComputing}
                    className="w-full mt-1 py-2 px-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium text-xs rounded-xl shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                  >
                    {isComputing ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Computing Optimal Path...</span>
                      </>
                    ) : (
                      <>
                        <Navigation className="w-3.5 h-3.5" />
                        <span>Calculate Directions ({currentModeInfo.label})</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Target Destination Search Prompt when not set yet */}
                {!destination && !currentRoute && (
                  <div className="bg-neutral-950/60 rounded-xl border border-dashed border-neutral-800 p-4 text-center space-y-2">
                    <div className="w-8 h-8 rounded-full bg-rose-500/10 text-rose-400 mx-auto flex items-center justify-center">
                      <Search className="w-4 h-4" />
                    </div>
                    <div className="text-xs font-semibold text-neutral-200">
                      Search Target Destination
                    </div>
                    <p className="text-[11px] text-neutral-400 max-w-xs mx-auto">
                      Enter any destination address or landmark above to calculate directions and start turn-by-turn navigation.
                    </p>
                  </div>
                )}

                {/* Route Overview Metric Banner */}
                {currentRoute && (
                  <div className="bg-neutral-950/90 rounded-xl border border-neutral-800 p-3.5 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-md ${currentModeInfo.badge} text-white`}>
                          {currentModeInfo.label}
                        </span>
                        {currentRoute.transitSummary && (
                          <span className="text-xs text-neutral-300 font-medium truncate max-w-[200px]">
                            {currentRoute.transitSummary}
                          </span>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-base font-bold text-white tracking-tight">
                          {currentRoute.durationText}
                        </div>
                        <div className="text-xs text-neutral-400">
                          {currentRoute.distanceText}
                        </div>
                      </div>
                    </div>

                    {/* Action Bar (Live GPS navigation, Turn simulation, Drive sync) */}
                    <div className="flex flex-col gap-2 pt-1 border-t border-neutral-800/80">
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => {
                            if (isNavigating && navModeType === 'live_gps') {
                              setIsNavigating(false);
                            } else {
                              startNavigationSimulation(currentRoute, decodedCoordinates, 'live_gps');
                            }
                          }}
                          className={`py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                            isNavigating && navModeType === 'live_gps'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30'
                              : 'bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/20'
                          }`}
                          title="Navigate live using device GPS location"
                        >
                          {isNavigating && navModeType === 'live_gps' ? (
                            <Pause className="w-3.5 h-3.5" />
                          ) : (
                            <Navigation className="w-3.5 h-3.5" />
                          )}
                          <span>{isNavigating && navModeType === 'live_gps' ? 'Stop GPS Nav' : 'Live GPS Nav'}</span>
                        </button>

                        <button
                          onClick={() => {
                            if (isNavigating && navModeType === 'simulation') {
                              setIsNavigating(false);
                            } else {
                              startNavigationSimulation(currentRoute, decodedCoordinates, 'simulation');
                            }
                          }}
                          className={`py-1.5 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                            isNavigating && navModeType === 'simulation'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30'
                              : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20'
                          }`}
                          title="Simulate route playback walkthrough"
                        >
                          {isNavigating && navModeType === 'simulation' ? (
                            <Pause className="w-3.5 h-3.5" />
                          ) : (
                            <Play className="w-3.5 h-3.5" />
                          )}
                          <span>{isNavigating && navModeType === 'simulation' ? 'Pause Demo' : 'Simulation'}</span>
                        </button>
                      </div>

                      <button
                        onClick={handleSyncToDrive}
                        disabled={isSyncingDrive}
                        className="w-full py-1.5 px-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 border border-neutral-700 transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        {isSyncingDrive ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Save className="w-3.5 h-3.5 text-blue-400" />
                        )}
                        <span>Save to Drive & SQLite</span>
                      </button>
                    </div>

                    {/* Drive Sync Success Notice */}
                    {driveSyncSuccess && (
                      <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[11px] flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span>{driveSyncSuccess}</span>
                      </div>
                    )}

                    {/* Turn Navigation Controls */}
                    {isNavigating && (
                      <div className="p-2.5 rounded-lg bg-neutral-900 border border-neutral-800 flex flex-col gap-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-neutral-400 font-medium flex items-center gap-1.5">
                            {navModeType === 'live_gps' ? (
                              <>
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                                <span className="text-emerald-300 font-bold">Live GPS Active</span>
                              </>
                            ) : (
                              <>
                                <Compass className="w-3.5 h-3.5 text-blue-400" />
                                <span>Simulated Walkthrough:</span>
                              </>
                            )}
                          </span>
                          <span className="text-white font-bold">
                            {navModeType === 'live_gps'
                              ? `Step ${simStepIndex + 1}/${currentRoute?.steps?.length || 1}`
                              : `${Math.round(simProgress * 100)}%`}
                          </span>
                        </div>
                        {navModeType === 'simulation' && (
                          <div className="w-full bg-neutral-800 h-1.5 rounded-full overflow-hidden">
                            <div
                              className="bg-emerald-500 h-full transition-all duration-300"
                              style={{ width: `${simProgress * 100}%` }}
                            />
                          </div>
                        )}
                        <div className="flex items-center justify-between pt-1 text-[11px]">
                          <button
                            onClick={() => setIsVoiceGuidanceActive(!isVoiceGuidanceActive)}
                            className="flex items-center gap-1 text-neutral-300 hover:text-white"
                          >
                            {isVoiceGuidanceActive ? (
                              <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <VolumeX className="w-3.5 h-3.5 text-neutral-500" />
                            )}
                            <span>{isVoiceGuidanceActive ? 'Voice Voice Active' : 'Muted'}</span>
                          </button>

                          <div className="flex items-center gap-1">
                            {[1, 2, 4].map((mult) => (
                              <button
                                key={mult}
                                onClick={() => setSimSpeedMultiplier(mult)}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                  simSpeedMultiplier === mult
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-neutral-800 text-neutral-400 hover:text-white'
                                }`}
                              >
                                {mult}x
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Step-by-Step Maneuver List */}
                {currentRoute && currentRoute.steps && (
                  <div className="flex flex-col gap-2">
                    <h3 className="text-xs font-semibold text-neutral-300 px-1 flex items-center justify-between">
                      <span>Turn-by-Turn Steps ({currentRoute.steps.length})</span>
                      <span className="text-[10px] text-neutral-500 font-normal">Offline Accessible</span>
                    </h3>
                    <div className="flex flex-col gap-1.5 max-h-[220px] overflow-y-auto pr-1">
                      {currentRoute.steps.map((step, idx) => {
                        const isCurrentSimStep = isNavigating && simStepIndex === idx;
                        return (
                          <div
                            key={idx}
                            className={`p-2.5 rounded-xl border text-xs transition-all flex items-start gap-2.5 ${
                              isCurrentSimStep
                                ? 'bg-blue-500/10 border-blue-500/40 text-white ring-1 ring-blue-500/30'
                                : 'bg-neutral-950/60 border-neutral-800/80 text-neutral-300'
                            }`}
                          >
                            <div className="mt-0.5 p-1 rounded-md bg-neutral-800 text-neutral-400 shrink-0">
                              {step.transitDetails ? (
                                step.transitDetails.vehicleType === 'BUS' ? (
                                  <Bus className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <Train className="w-3.5 h-3.5 text-indigo-400" />
                                )
                              ) : step.maneuver?.includes('RIGHT') ? (
                                <CornerUpRight className="w-3.5 h-3.5 text-blue-400" />
                              ) : step.maneuver?.includes('LEFT') ? (
                                <CornerUpLeft className="w-3.5 h-3.5 text-blue-400" />
                              ) : (
                                <ArrowUp className="w-3.5 h-3.5 text-neutral-300" />
                              )}
                            </div>
                            <div className="flex-1">
                              <div className="font-medium leading-tight">{step.instruction}</div>
                              {step.transitDetails && (
                                <div className="mt-1 text-[11px] text-emerald-400 font-medium">
                                  {step.transitDetails.lineName} • {step.transitDetails.numStops} stops •{' '}
                                  {step.transitDetails.departureStop} ➔ {step.transitDetails.arrivalStop}
                                </div>
                              )}
                              <div className="mt-0.5 text-[10px] text-neutral-500 flex items-center gap-2">
                                <span>{step.distanceText}</span>
                                <span>•</span>
                                <span>{step.durationText}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Saved Routes Tab */}
            {activeTab === 'saved' && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-white">Saved Routes in SQLite & Drive</h3>
                  <span className="text-[11px] text-neutral-400">{savedRoutes.length} stored</span>
                </div>
                {savedRoutes.length === 0 ? (
                  <div className="p-6 text-center text-xs text-neutral-500 bg-neutral-950/50 rounded-xl border border-neutral-800">
                    No routes saved yet. Calculate a route and click "Save to Drive" or "Save for Offline".
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 max-h-[360px] overflow-y-auto">
                    {savedRoutes.map((rt) => (
                      <div
                        key={rt.id}
                        className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 hover:border-neutral-700 transition-all flex flex-col gap-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-xs text-white truncate max-w-[220px]">
                            {rt.title}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300">
                            {rt.travelMode}
                          </span>
                        </div>
                        <div className="text-[11px] text-neutral-400 flex items-center gap-2">
                          <span>{rt.distanceText}</span>
                          <span>•</span>
                          <span>{rt.durationText}</span>
                        </div>
                        <div className="flex items-center justify-between pt-1 border-t border-neutral-800/60 mt-1">
                          <button
                            onClick={() => {
                              setCurrentRoute(rt);
                              const dec = decodePolyline(rt.encodedPolyline);
                              setDecodedCoordinates(dec);
                              setOrigin(rt.originLocation as any);
                              setDestination(rt.destinationLocation as any);
                              setActiveTab('navigate');
                            }}
                            className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1"
                          >
                            <Play className="w-3 h-3" /> Load on Map
                          </button>
                          {rt.driveWebViewLink && (
                            <a
                              href={rt.driveWebViewLink}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[10px] text-neutral-400 hover:text-white flex items-center gap-0.5"
                            >
                              Drive <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Offline Region Packages Tab */}
            {activeTab === 'packages' && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-white">Offline Map Cache Packages</h3>
                  <span className="text-[11px] text-neutral-400">Zero-Network Ready</span>
                </div>
                <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300 flex flex-col gap-1.5">
                  <div className="font-medium flex items-center gap-1.5">
                    <Download className="w-4 h-4" /> Download Local Area
                  </div>
                  <p className="text-[11px] text-neutral-300">
                    Pre-caches full turn maneuvers, vector waypoints, and transit schedules for this city zone into local SQLite & browser storage.
                  </p>
                  <button
                    onClick={() => handleDownloadOfflineRegion(`${origin.name || 'Metropolitan'} Zone`)}
                    className="mt-1 py-1 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium self-start transition-colors"
                  >
                    Cache Current Region (15 km)
                  </button>
                </div>

                {offlinePackages.length > 0 && (
                  <div className="flex flex-col gap-2 max-h-[260px] overflow-y-auto">
                    {offlinePackages.map((pkg) => (
                      <div
                        key={pkg.id}
                        className="p-2.5 rounded-xl bg-neutral-950 border border-neutral-800 flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-medium text-white">{pkg.packageName}</div>
                          <div className="text-[10px] text-neutral-400">
                            {pkg.radiusKm} km radius • {(pkg.sizeBytes / (1024 * 1024)).toFixed(1)} MB
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Cached
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Column: Google Maps Interactive Canvas (7 Cols) */}
          <div className="lg:col-span-7 relative bg-neutral-950 min-h-[380px] lg:min-h-[550px] h-full flex flex-col">
            {apiKey ? (
              <APIProvider apiKey={apiKey}>
                <div style={{ height: '100%', width: '100%', minHeight: '380px', position: 'relative' }}>
                  <Map
                    mapId="DEMO_MAP_ID"
                    internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                    defaultCenter={realGpsLocation ? { lat: realGpsLocation.lat, lng: realGpsLocation.lng } : { lat: origin.lat, lng: origin.lng }}
                    defaultZoom={13}
                    gestureHandling={'greedy'}
                    disableDefaultUI={false}
                    className="w-full h-full"
                  >
                    {/* Capture Map instance */}
                    <MapInstanceController onMapInstance={(m) => { mapInstanceRef.current = m; }} />

                    {/* Route Polyline Overlay */}
                    {decodedCoordinates.length > 0 && (
                      <RoutePolyline path={decodedCoordinates} color={currentModeInfo.color} />
                    )}

                    {/* Real-Time User Live GPS Location Marker (Always visible when GPS acquired) */}
                    {realGpsLocation && (
                      <AdvancedMarker
                        position={{ lat: realGpsLocation.lat, lng: realGpsLocation.lng }}
                        onClick={() => setActiveMarkerInfo('my-location')}
                        title="You are here (Live Real-Time GPS)"
                      >
                        <div className="relative flex items-center justify-center cursor-pointer">
                          <div className="absolute w-12 h-12 rounded-full bg-blue-500/25 animate-ping pointer-events-none" />
                          <div className="absolute w-8 h-8 rounded-full bg-blue-500/30 border border-blue-400/60 pointer-events-none animate-pulse" />
                          <div className="relative w-5 h-5 rounded-full bg-blue-600 border-2 border-white shadow-xl shadow-blue-600/60 flex items-center justify-center hover:scale-125 transition-transform">
                            {realGpsLocation.heading != null && !isNaN(realGpsLocation.heading) ? (
                              <Navigation
                                className="w-3 h-3 text-white transform"
                                style={{ transform: `rotate(${realGpsLocation.heading}deg)` }}
                              />
                            ) : (
                              <div className="w-2 h-2 rounded-full bg-white" />
                            )}
                          </div>
                        </div>
                      </AdvancedMarker>
                    )}

                    {/* Origin Marker */}
                    <AdvancedMarker
                      position={{ lat: origin.lat, lng: origin.lng }}
                      onClick={() => setActiveMarkerInfo('origin')}
                    >
                      <div className="p-2 rounded-full bg-emerald-600 text-white shadow-xl shadow-emerald-500/30 border-2 border-white cursor-pointer hover:scale-110 transition-transform">
                        <MapPin className="w-4 h-4" />
                      </div>
                    </AdvancedMarker>

                    {/* Destination Marker (Only when destination is set) */}
                    {destination && (
                      <AdvancedMarker
                        position={{ lat: destination.lat, lng: destination.lng }}
                        onClick={() => setActiveMarkerInfo('destination')}
                      >
                        <div className="p-2 rounded-full bg-rose-600 text-white shadow-xl shadow-rose-500/30 border-2 border-white cursor-pointer hover:scale-110 transition-transform">
                          <MapPin className="w-4 h-4" />
                        </div>
                      </AdvancedMarker>
                    )}

                    {/* Live Simulation GPS Cursor Marker (during simulation mode) */}
                    {isNavigating && navModeType === 'simulation' && simCurrentLocation && (
                      <AdvancedMarker
                        position={simCurrentLocation}
                        onClick={() => setActiveMarkerInfo('cursor')}
                      >
                        <div className="relative">
                          <div className="w-6 h-6 rounded-full bg-amber-500 text-white shadow-xl border-2 border-white flex items-center justify-center animate-pulse">
                            <Navigation className="w-3.5 h-3.5 transform -rotate-45" />
                          </div>
                          <div className="absolute -inset-1 rounded-full bg-amber-500/30 animate-ping" />
                        </div>
                      </AdvancedMarker>
                    )}

                    {/* Info Windows */}
                    {activeMarkerInfo === 'my-location' && realGpsLocation && (
                      <InfoWindow
                        position={{ lat: realGpsLocation.lat, lng: realGpsLocation.lng }}
                        onCloseClick={() => setActiveMarkerInfo(null)}
                      >
                        <div className="p-1.5 text-neutral-900 text-xs min-w-[200px] space-y-1.5">
                          <div className="flex items-center gap-1.5 text-blue-600 font-bold">
                            <LocateFixed className="w-3.5 h-3.5" />
                            <span>Your Real-Time Location</span>
                          </div>
                          <div className="text-[11px] text-neutral-600 font-mono">
                            {realGpsLocation.lat.toFixed(5)}, {realGpsLocation.lng.toFixed(5)}
                          </div>
                          <div className="text-[10px] text-neutral-500 flex items-center justify-between">
                            <span>Accuracy: ±{realGpsLocation.accuracy}m</span>
                            <span className="text-emerald-600 font-semibold flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live GPS
                            </span>
                          </div>
                          <div className="pt-1 flex gap-1.5 border-t border-neutral-200">
                            <button
                              onClick={() => {
                                setOrigin({
                                  name: 'My Current Location (Live GPS)',
                                  lat: realGpsLocation.lat,
                                  lng: realGpsLocation.lng,
                                });
                                setCustomOriginInput('My Current Location (Live GPS)');
                                setActiveMarkerInfo(null);
                              }}
                              className="px-2 py-1 bg-blue-600 text-white rounded text-[10px] font-semibold hover:bg-blue-700 transition cursor-pointer"
                            >
                              Set as Origin
                            </button>
                            <button
                              onClick={() => {
                                setDestination({
                                  name: 'My Current Location (Live GPS)',
                                  lat: realGpsLocation.lat,
                                  lng: realGpsLocation.lng,
                                });
                                setCustomDestInput('My Current Location (Live GPS)');
                                setActiveMarkerInfo(null);
                              }}
                              className="px-2 py-1 bg-neutral-200 text-neutral-800 rounded text-[10px] font-semibold hover:bg-neutral-300 transition cursor-pointer"
                            >
                              Set as Destination
                            </button>
                          </div>
                        </div>
                      </InfoWindow>
                    )}

                    {activeMarkerInfo === 'origin' && (
                      <InfoWindow
                        position={{ lat: origin.lat, lng: origin.lng }}
                        onCloseClick={() => setActiveMarkerInfo(null)}
                      >
                        <div className="p-1 text-neutral-900 text-xs">
                          <div className="font-bold">Origin</div>
                          <div>{origin.name}</div>
                        </div>
                      </InfoWindow>
                    )}

                    {activeMarkerInfo === 'destination' && destination && (
                      <InfoWindow
                        position={{ lat: destination.lat, lng: destination.lng }}
                        onCloseClick={() => setActiveMarkerInfo(null)}
                      >
                        <div className="p-1 text-neutral-900 text-xs">
                          <div className="font-bold">Destination</div>
                          <div>{destination.name}</div>
                        </div>
                      </InfoWindow>
                    )}
                  </Map>

                  {/* Top Floating GPS Status Pill */}
                  <div className="absolute top-3 left-3 z-10 pointer-events-auto">
                    <div
                      className={`px-3 py-1.5 rounded-xl border text-xs font-semibold backdrop-blur-md shadow-xl flex items-center gap-2 ${
                        realGpsLocation
                          ? 'bg-neutral-900/90 border-emerald-500/40 text-emerald-300'
                          : isAcquiringGps
                          ? 'bg-neutral-900/90 border-blue-500/40 text-blue-300 animate-pulse'
                          : 'bg-neutral-900/90 border-amber-500/40 text-amber-300'
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
                          realGpsLocation
                            ? 'bg-emerald-400 animate-ping'
                            : isAcquiringGps
                            ? 'bg-blue-400'
                            : 'bg-amber-400'
                        }`}
                      />
                      <span>
                        {realGpsLocation
                          ? `GPS Live (±${realGpsLocation.accuracy}m)`
                          : isAcquiringGps
                          ? 'Acquiring GPS...'
                          : 'GPS Standby'}
                      </span>
                      {realGpsLocation && (
                        <button
                          onClick={handleCenterOnMyLocation}
                          className="ml-1 text-[10px] underline text-blue-400 hover:text-blue-300 font-semibold cursor-pointer"
                          title="Center map on your live GPS position"
                        >
                          Center
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Floating Quick Action Map Controls (Locate Me button) */}
                  <div className="absolute top-3 right-3 z-10 flex flex-col gap-2 pointer-events-auto">
                    <button
                      onClick={handleCenterOnMyLocation}
                      disabled={isAcquiringGps}
                      className={`p-2.5 rounded-xl shadow-2xl border backdrop-blur-md transition-all flex items-center justify-center cursor-pointer active:scale-95 ${
                        realGpsLocation
                          ? 'bg-neutral-900/90 text-blue-400 border-blue-500/40 hover:bg-neutral-800 hover:text-blue-300 ring-2 ring-blue-500/20'
                          : 'bg-neutral-900/90 text-neutral-400 border-neutral-700 hover:text-white'
                      }`}
                      title="Center on my real-time GPS location"
                    >
                      <LocateFixed className={`w-4 h-4 ${isAcquiringGps ? 'animate-spin text-blue-400' : ''}`} />
                    </button>

                    {isNavigating && (
                      <button
                        onClick={() => setIsFollowingGps(!isFollowingGps)}
                        className={`p-2.5 rounded-xl shadow-2xl border backdrop-blur-md transition-all flex items-center justify-center cursor-pointer ${
                          isFollowingGps
                            ? 'bg-blue-600 text-white border-blue-400 ring-2 ring-blue-400/30'
                            : 'bg-neutral-900/90 text-neutral-400 border-neutral-700 hover:text-white'
                        }`}
                        title={isFollowingGps ? 'Auto-following GPS' : 'Free map pan (Tap to follow GPS)'}
                      >
                        <Navigation className={`w-4 h-4 ${isFollowingGps ? 'animate-pulse text-white' : ''}`} />
                      </button>
                    )}
                  </div>

                  {/* GPS Status Notice Toast */}
                  {gpsStatusNotice && (
                    <div className="absolute top-14 left-3 z-10 px-3 py-1.5 rounded-lg bg-blue-950/90 border border-blue-500/40 text-blue-200 text-xs shadow-xl backdrop-blur-md flex items-center gap-2 animate-in fade-in">
                      <LocateFixed className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
                      <span>{gpsStatusNotice}</span>
                    </div>
                  )}
                </div>
              </APIProvider>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-neutral-400">
                <Navigation className="w-10 h-10 text-neutral-600 mb-2" />
                <p className="text-xs">Initializing Google Maps Platform Demo Service...</p>
              </div>
            )}

            {/* Error Notice Floating Toast */}
            {errorNotice && (
              <div className="absolute bottom-4 left-4 right-4 z-20 p-3 rounded-xl bg-rose-950/90 border border-rose-800 text-rose-200 text-xs shadow-xl flex items-center justify-between">
                <span>{errorNotice}</span>
                <button
                  onClick={() => setErrorNotice(null)}
                  className="text-rose-400 hover:text-white font-bold ml-2"
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
  );

  if (isInlineTab) {
    return (
      <div className="w-full flex-1 flex flex-col p-2 sm:p-4 pb-24">
        {modalBody}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-2 sm:p-4 overflow-y-auto">
      {modalBody}
    </div>
  );
};
