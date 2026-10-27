import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  MapPin,
  Battery,
  AlertTriangle,
  Navigation,
  ExternalLink,
  ShieldCheck,
  Compass,
  Layers,
  LocateFixed,
  Play,
  Pause,
  RefreshCw,
  PhoneCall,
  Key,
  Maximize2,
  Sparkles,
} from 'lucide-react';
import { FamilyMember } from '../../types';

interface FamilyGoogleMapProps {
  familyMembers: FamilyMember[];
  onTriggerSos?: (id: string) => void;
  onClearSos?: (id: string) => void;
  onUpdateLocation?: (
    memberId: string,
    location: Partial<FamilyMember['liveLocation']>,
    geofence?: FamilyMember['geofenceStatus']
  ) => void;
}

// Predefined safe geofences in Chennai
const GEOFENCE_ZONES = [
  {
    name: 'Home / Global Family Office',
    center: [13.0827, 80.2707] as [number, number],
    radius: 900,
    color: '#10b981', // Emerald
    type: 'home',
  },
  {
    name: 'Work / T. Nagar Campus',
    center: [13.0418, 80.2341] as [number, number],
    radius: 750,
    color: '#6366f1', // Indigo
    type: 'work',
  },
  {
    name: 'School / IIT Madras Lab',
    center: [13.0112, 80.2337] as [number, number],
    radius: 800,
    color: '#a855f7', // Purple
    type: 'school',
  },
];

// Haversine formula to compute distance in kilometers
function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(2));
}

export const FamilyGoogleMap: React.FC<FamilyGoogleMapProps> = ({
  familyMembers,
  onTriggerSos,
  onClearSos,
  onUpdateLocation,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<{ [key: string]: L.Marker }>({});
  const circlesRef = useRef<L.Circle[]>([]);
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  // Map state
  const [mapEngine, setMapEngine] = useState<'interactive' | 'google'>('interactive');
  const [mapTileStyle, setMapTileStyle] = useState<'streets' | 'dark' | 'satellite'>('streets');
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [isLocatingUser, setIsLocatingUser] = useState(false);
  const [locationNotice, setLocationNotice] = useState<string | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [googleMapsKey, setGoogleMapsKey] = useState(() => {
    return (
      (typeof window !== 'undefined' ? localStorage.getItem('aura_google_maps_key') : null) ||
      (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string) ||
      ''
    );
  });

  const primaryMember = familyMembers.find((m) => m.role === 'primary') || familyMembers[0];

  // Tile URL definitions
  const TILE_URLS = {
    streets: {
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    },
    dark: {
      url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
      attribution: '&copy; CartoDB & OpenStreetMap',
    },
    satellite: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attribution: 'Tiles &copy; Esri, Earthstar Geographics',
    },
  };

  // 1. Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const defaultCenter: [number, number] = [
        primaryMember?.liveLocation.lat || 13.0827,
        primaryMember?.liveLocation.lng || 80.2707,
      ];

      const map = L.map(mapContainerRef.current, {
        center: defaultCenter,
        zoom: 12,
        zoomControl: true,
        attributionControl: false,
      });

      // Add Tile Layer
      const initialTile = TILE_URLS[mapTileStyle];
      tileLayerRef.current = L.tileLayer(initialTile.url, {
        maxZoom: 19,
        attribution: initialTile.attribution,
      }).addTo(map);

      // Add Geofence Zones
      GEOFENCE_ZONES.forEach((zone) => {
        const circle = L.circle(zone.center, {
          color: zone.color,
          fillColor: zone.color,
          fillOpacity: 0.12,
          radius: zone.radius,
          weight: 1.5,
          dashArray: '4, 6',
        }).addTo(map);
        circle.bindTooltip(`📍 ${zone.name}`, { permanent: false, direction: 'top' });
        circlesRef.current.push(circle);
      });

      mapInstanceRef.current = map;

      // Invalidate size to ensure clean rendering after mount
      setTimeout(() => {
        map.invalidateSize();
      }, 250);
    }

    return () => {
      // Map stays attached or unmounts cleanly
    };
  }, []);

  // 2. Handle Tile Layer Switch
  useEffect(() => {
    if (mapInstanceRef.current && tileLayerRef.current) {
      mapInstanceRef.current.removeLayer(tileLayerRef.current);
      const chosen = TILE_URLS[mapTileStyle];
      tileLayerRef.current = L.tileLayer(chosen.url, {
        maxZoom: 19,
        attribution: chosen.attribution,
      }).addTo(mapInstanceRef.current);
    }
  }, [mapTileStyle]);

  // 3. Render / Update Markers for Family Members
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    familyMembers.forEach((member) => {
      const { lat, lng } = member.liveLocation;
      const isSelected = selectedMemberId === member.id;
      const isSos = member.emergencySosActive;

      // Calculate distance from primary user
      const distKm =
        member.id !== primaryMember?.id && primaryMember
          ? calculateDistanceKm(primaryMember.liveLocation.lat, primaryMember.liveLocation.lng, lat, lng)
          : 0;

      // Create Custom Interactive Marker HTML
      const customIconHtml = `
        <div class="relative flex flex-col items-center group cursor-pointer" style="transform: translate(-50%, -50%);">
          <!-- Animated Radar Ripple -->
          <div class="absolute -top-1 w-12 h-12 rounded-full ${
            isSos ? 'bg-rose-500/60 animate-ping' : 'bg-blue-500/25 animate-ping'
          } pointer-events-none"></div>

          <!-- Avatar Pin -->
          <div class="relative w-11 h-11 rounded-full border-2 overflow-hidden shadow-2xl transition-transform ${
            isSos
              ? 'border-rose-500 ring-4 ring-rose-500/50 bg-rose-950 scale-110'
              : isSelected
              ? 'border-indigo-400 ring-4 ring-indigo-500/40 bg-indigo-950 scale-110'
              : 'border-blue-400 ring-2 ring-blue-500/20 bg-slate-900'
          }">
            <img src="${member.avatar}" alt="${member.name}" class="w-full h-full object-cover" />
          </div>

          <!-- Name & Battery Badge -->
          <div class="mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold shadow-xl border flex items-center gap-1 whitespace-nowrap ${
            isSos
              ? 'bg-rose-600 text-white border-rose-400 animate-bounce'
              : 'bg-slate-950/95 text-slate-100 border-slate-700'
          }">
            <span>${member.name.split(' ')[0]}</span>
            <span class="text-[9px] font-mono px-1 py-0.2 rounded ${
              member.liveLocation.batteryLevel < 20 ? 'bg-rose-500/40 text-rose-200' : 'bg-emerald-500/40 text-emerald-200'
            }">
              ${member.liveLocation.batteryLevel}%
            </span>
          </div>
        </div>
      `;

      const divIcon = L.divIcon({
        html: customIconHtml,
        className: 'custom-family-marker',
        iconSize: [44, 60],
        iconAnchor: [22, 50],
      });

      // Construct Popup Content
      const popupHtml = `
        <div style="font-family: system-ui, -apple-system, sans-serif; padding: 6px; min-width: 220px; color: #0f172a;">
          <div style="display: flex; align-items: center; gap: 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">
            <img src="${member.avatar}" style="width: 38px; height: 38px; border-radius: 9999px; object-fit: cover; border: 2px solid #6366f1;" />
            <div>
              <div style="font-size: 13px; font-weight: 700; color: #0f172a;">${member.name}</div>
              <div style="font-size: 10px; color: #64748b;">${member.relationship} • ${member.role === 'primary' ? 'Primary Head' : 'Member'}</div>
            </div>
          </div>
          
          <div style="margin-top: 8px; font-size: 11px; line-height: 1.4; color: #334155;">
            <div style="display: flex; align-items: flex-start; gap: 5px; margin-bottom: 4px;">
              <span style="color: #6366f1;">📍</span>
              <strong>${member.liveLocation.address}</strong>
            </div>
            <div style="font-size: 10px; font-family: monospace; color: #64748b; margin-bottom: 4px;">
              GPS: ${lat.toFixed(6)}, ${lng.toFixed(6)} • ${member.liveLocation.timestamp}
            </div>
            ${
              distKm > 0
                ? `<div style="font-size: 10px; color: #059669; font-weight: 600; margin-bottom: 6px;">
                    📏 ${distKm} km from Primary (${primaryMember?.name.split(' ')[0]})
                  </div>`
                : ''
            }
            <div style="background: #f1f5f9; padding: 4px 8px; border-radius: 6px; font-size: 10px; margin-bottom: 8px;">
              Zone: <strong style="text-transform: capitalize;">${member.geofenceStatus}</strong> • Battery: <strong>${member.liveLocation.batteryLevel}%</strong>
            </div>
          </div>

          <div style="display: flex; gap: 6px; margin-top: 4px;">
            <a href="https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}" target="_blank" rel="noopener noreferrer" style="flex: 1; background: #2563eb; color: #ffffff; padding: 6px 8px; border-radius: 6px; text-decoration: none; font-size: 10px; font-weight: 600; text-align: center; display: inline-block;">
              🧭 Google Maps Route
            </a>
          </div>
        </div>
      `;

      if (markersRef.current[member.id]) {
        // Update existing marker
        const existingMarker = markersRef.current[member.id];
        existingMarker.setLatLng([lat, lng]);
        existingMarker.setIcon(divIcon);
        existingMarker.setPopupContent(popupHtml);
      } else {
        // Create new marker
        const marker = L.marker([lat, lng], { icon: divIcon }).addTo(map);
        marker.bindPopup(popupHtml, { offset: [0, -40] });
        marker.on('click', () => {
          setSelectedMemberId(member.id);
        });
        markersRef.current[member.id] = marker;
      }
    });
  }, [familyMembers, selectedMemberId, primaryMember]);

  // 4. Focus on Member
  const handleFocusMember = (member: FamilyMember) => {
    setSelectedMemberId(member.id);
    const map = mapInstanceRef.current;
    if (map) {
      map.flyTo([member.liveLocation.lat, member.liveLocation.lng], 15, {
        duration: 1.2,
      });

      const targetMarker = markersRef.current[member.id];
      if (targetMarker) {
        setTimeout(() => targetMarker.openPopup(), 1200);
      }
    }
  };

  // 5. Fit All Members on Screen
  const handleFitAll = () => {
    setSelectedMemberId(null);
    const map = mapInstanceRef.current;
    if (!map || familyMembers.length === 0) return;

    const bounds = L.latLngBounds(
      familyMembers.map((m) => [m.liveLocation.lat, m.liveLocation.lng] as [number, number])
    );
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
  };

  // 6. Live Geolocation: Locate Real User Phone GPS
  const handleLocateMyPhone = () => {
    if (!navigator.geolocation) {
      setLocationNotice('Geolocation not supported by this browser.');
      setTimeout(() => setLocationNotice(null), 3500);
      return;
    }

    setIsLocatingUser(true);
    setLocationNotice('Acquiring real-time high-precision GPS coordinates...');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocatingUser(false);
        const { latitude, longitude, accuracy } = pos.coords;

        if (primaryMember && onUpdateLocation) {
          onUpdateLocation(
            primaryMember.id,
            {
              lat: latitude,
              lng: longitude,
              address: `Live GPS Device Position (±${Math.round(accuracy)}m)`,
              timestamp: 'Just now',
            },
            'home'
          );
        }

        const map = mapInstanceRef.current;
        if (map) {
          map.flyTo([latitude, longitude], 16, { duration: 1.4 });
        }

        setLocationNotice(`✓ Real-Time GPS Locked: ${latitude.toFixed(6)}, ${longitude.toFixed(6)} (±${Math.round(accuracy)}m)`);
        setTimeout(() => setLocationNotice(null), 5000);
      },
      (err) => {
        setIsLocatingUser(false);
        console.warn('Geolocation error:', err);
        setLocationNotice(`GPS Alert: ${err.message}. Using default sovereign campus coordinates.`);
        setTimeout(() => setLocationNotice(null), 4500);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 10000 }
    );
  };

  // 7. Live Movement Simulator
  useEffect(() => {
    if (!isSimulating || !onUpdateLocation) return;

    let step = 0;
    const interval = setInterval(() => {
      step += 1;
      const angle = (step * 0.15) % (2 * Math.PI);

      // Maaran moving along Sardar Patel Rd / IIT Campus
      const maaran = familyMembers.find((m) => m.name.includes('Maaran'));
      if (maaran) {
        const newLat = 13.0112 + Math.sin(angle) * 0.0035;
        const newLng = 80.2337 + Math.cos(angle) * 0.0042;
        onUpdateLocation(
          maaran.id,
          {
            lat: newLat,
            lng: newLng,
            timestamp: 'Just now (Live Transit)',
            status: 'In Transit',
          },
          'transit'
        );
      }

      // Selvapriya in T. Nagar
      const selva = familyMembers.find((m) => m.name.includes('Selvapriya'));
      if (selva) {
        const newLat = 13.0418 + Math.cos(angle * 0.8) * 0.0028;
        const newLng = 80.2341 + Math.sin(angle * 0.8) * 0.0031;
        onUpdateLocation(
          selva.id,
          {
            lat: newLat,
            lng: newLng,
            timestamp: 'Just now (Live Transit)',
            status: 'At Work / Campus',
          },
          'work'
        );
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [isSimulating, familyMembers, onUpdateLocation]);

  return (
    <div className="w-full rounded-3xl overflow-hidden border border-slate-800 bg-slate-950 flex flex-col shadow-2xl relative">
      {/* Top Map Toolbar */}
      <div className="px-4 py-3 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2.5 z-10">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
            <Compass className="w-4 h-4 animate-spin [animation-duration:14s]" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
              <span>Family Circle Real-Time GPS Tracking</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            </h4>
            <p className="text-[10px] text-slate-400">
              High-Precision Multi-Instance Telemetry • Live Geofence Enclave
            </p>
          </div>
        </div>

        {/* Member Focus Filter Chips */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={handleFitAll}
            className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors flex items-center gap-1"
          >
            <Maximize2 className="w-3 h-3" />
            <span>Fit All</span>
          </button>

          {familyMembers.map((m) => (
            <button
              key={m.id}
              onClick={() => handleFocusMember(m)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all ${
                selectedMemberId === m.id
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700/60'
              }`}
            >
              <img src={m.avatar} alt={m.name} className="w-3.5 h-3.5 rounded-full object-cover" />
              <span>{m.name.split(' ')[0]}</span>
              {m.emergencySosActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
              )}
            </button>
          ))}

          {/* Map Layer Switcher */}
          <div className="flex items-center gap-0.5 bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[10px]">
            <button
              onClick={() => setMapTileStyle('streets')}
              className={`px-2 py-0.5 rounded font-medium transition-colors ${
                mapTileStyle === 'streets'
                  ? 'bg-indigo-600 text-white font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Streets
            </button>
            <button
              onClick={() => setMapTileStyle('dark')}
              className={`px-2 py-0.5 rounded font-medium transition-colors ${
                mapTileStyle === 'dark'
                  ? 'bg-indigo-600 text-white font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Sovereign Dark
            </button>
            <button
              onClick={() => setMapTileStyle('satellite')}
              className={`px-2 py-0.5 rounded font-medium transition-colors ${
                mapTileStyle === 'satellite'
                  ? 'bg-indigo-600 text-white font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Satellite
            </button>
          </div>
        </div>
      </div>

      {/* Live Map Canvas */}
      <div className="w-full h-80 sm:h-96 md:h-[460px] relative bg-slate-950">
        <div ref={mapContainerRef} className="w-full h-full z-0" />

        {/* Live Floating Control Overlay */}
        <div className="absolute top-3 right-3 flex flex-col gap-2 z-10">
          <button
            onClick={handleLocateMyPhone}
            disabled={isLocatingUser}
            className="p-2.5 rounded-2xl bg-slate-900/90 hover:bg-slate-800 text-emerald-400 border border-slate-700 shadow-xl transition-all flex items-center gap-1.5 text-xs font-semibold backdrop-blur-md active:scale-95"
            title="Locate my actual phone via HTML5 GPS"
          >
            <LocateFixed className={`w-4 h-4 ${isLocatingUser ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">
              {isLocatingUser ? 'Locating GPS...' : 'Locate My Phone'}
            </span>
          </button>

          <button
            onClick={() => setIsSimulating(!isSimulating)}
            className={`p-2.5 rounded-2xl border shadow-xl transition-all flex items-center gap-1.5 text-xs font-semibold backdrop-blur-md active:scale-95 ${
              isSimulating
                ? 'bg-indigo-600 text-white border-indigo-400 animate-pulse'
                : 'bg-slate-900/90 hover:bg-slate-800 text-slate-300 border-slate-700'
            }`}
            title="Simulate real-time vehicle & pedestrian transit along Chennai roads"
          >
            {isSimulating ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            <span className="hidden sm:inline">
              {isSimulating ? 'Simulating Transit...' : 'Simulate Movement'}
            </span>
          </button>
        </div>

        {/* Location Notice Banner */}
        {locationNotice && (
          <div className="absolute bottom-4 left-4 right-4 z-20 p-3 rounded-2xl bg-slate-900/95 border border-indigo-500/40 text-xs text-indigo-200 shadow-2xl backdrop-blur-md flex items-center justify-between animate-fade-in">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{locationNotice}</span>
            </div>
            <button
              onClick={() => setLocationNotice(null)}
              className="text-slate-400 hover:text-white text-xs px-2 py-0.5"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Geofence Legend & Sovereign Status Bar */}
      <div className="px-4 py-2.5 bg-slate-950 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="text-slate-300">Home Office (Anna Nagar)</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
            <span className="text-slate-300">Work Hub (T. Nagar)</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
            <span className="text-slate-300">Campus Lab (IIT Madras)</span>
          </div>
        </div>

        <div className="flex items-center gap-2 font-mono text-[10px] text-slate-400">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Real-Time GPS Telemetry Active</span>
        </div>
      </div>
    </div>
  );
};
