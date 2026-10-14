import React, { useState } from 'react';
import { APIProvider, Map, AdvancedMarker, InfoWindow, useMap } from '@vis.gl/react-google-maps';
import { MapPin, Battery, AlertTriangle, Navigation, ExternalLink, ShieldCheck, Compass, Layers } from 'lucide-react';
import { FamilyMember } from '../../types';

interface FamilyGoogleMapProps {
  familyMembers: FamilyMember[];
  onTriggerSos?: (id: string) => void;
  onClearSos?: (id: string) => void;
}

// Controller component to smoothly pan/zoom camera
const MapCameraController: React.FC<{
  targetLocation: { lat: number; lng: number } | null;
}> = ({ targetLocation }) => {
  const map = useMap();

  React.useEffect(() => {
    if (map && targetLocation) {
      map.panTo(targetLocation);
      map.setZoom(14);
    }
  }, [map, targetLocation]);

  return null;
};

export const FamilyGoogleMap: React.FC<FamilyGoogleMapProps> = ({
  familyMembers,
  onTriggerSos,
  onClearSos,
}) => {
  const apiKey =
    (typeof window !== 'undefined' ? localStorage.getItem('aura_google_maps_key') : null) ||
    (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string) ||
    'AIzaSyB2zaNA_vbSdD78UFydYrxswRHhTlOPmbI';

  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null);
  const [focusedLocation, setFocusedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [mapTypeId, setMapTypeId] = useState<'roadmap' | 'satellite' | 'hybrid' | 'terrain'>('roadmap');

  const defaultCenter = { lat: 13.05, lng: 80.25 };

  const handleFocusMember = (member: FamilyMember) => {
    setSelectedMember(member);
    setFocusedLocation({ lat: member.liveLocation.lat, lng: member.liveLocation.lng });
  };

  const handleResetView = () => {
    setSelectedMember(null);
    setFocusedLocation(defaultCenter);
  };

  return (
    <div className="w-full rounded-3xl overflow-hidden border border-slate-800 bg-slate-950 flex flex-col shadow-2xl relative">
      {/* Map Header Toolbar */}
      <div className="px-4 py-3 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2.5 z-10">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400">
            <Compass className="w-4 h-4 animate-spin [animation-duration:12s]" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
              <span>Google Maps Live GPS Enclave</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            </h4>
            <p className="text-[10px] text-slate-400">
              Chennai Metro & Sovereign Geofence • 25s High-Precision Telemetry
            </p>
          </div>
        </div>

        {/* Focus Quick Filter Chips & Map Type */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={handleResetView}
            className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          >
            All Members
          </button>
          {familyMembers.map((m) => (
            <button
              key={m.id}
              onClick={() => handleFocusMember(m)}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold transition-all ${
                selectedMember?.id === m.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300'
              }`}
            >
              <img src={m.avatar} alt={m.name} className="w-3.5 h-3.5 rounded-full object-cover" />
              <span>{m.name.split(' ')[0]}</span>
              {m.emergencySosActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
              )}
            </button>
          ))}

          {/* Map Type Switcher */}
          <div className="flex items-center gap-0.5 bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[10px]">
            <button
              onClick={() => setMapTypeId('roadmap')}
              className={`px-1.5 py-0.5 rounded ${mapTypeId === 'roadmap' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Road
            </button>
            <button
              onClick={() => setMapTypeId('satellite')}
              className={`px-1.5 py-0.5 rounded ${mapTypeId === 'satellite' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Satellite
            </button>
            <button
              onClick={() => setMapTypeId('hybrid')}
              className={`px-1.5 py-0.5 rounded ${mapTypeId === 'hybrid' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Hybrid
            </button>
          </div>
        </div>
      </div>

      {/* Map Container - Height is explicitly styled per CF2 */}
      <div className="w-full h-80 sm:h-96 md:h-[420px] relative bg-slate-950">
        <APIProvider apiKey={apiKey} libraries={['marker']}>
          <Map
            mapId="DEMO_MAP_ID"
            defaultCenter={defaultCenter}
            defaultZoom={12}
            mapTypeId={mapTypeId}
            gestureHandling="greedy"
            disableDefaultUI={false}
            internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
            style={{ width: '100%', height: '100%' }}
          >
            <MapCameraController targetLocation={focusedLocation} />

            {/* Advanced Markers for each family member */}
            {familyMembers.map((member) => (
              <AdvancedMarker
                key={member.id}
                position={{ lat: member.liveLocation.lat, lng: member.liveLocation.lng }}
                title={`${member.name} - ${member.liveLocation.status}`}
                onClick={() => setSelectedMember(member)}
              >
                {/* Custom Interactive Avatar Pin */}
                <div className="relative flex flex-col items-center cursor-pointer group">
                  {/* Ping Ring */}
                  <span
                    className={`absolute w-12 h-12 rounded-full -top-1 animate-ping pointer-events-none ${
                      member.emergencySosActive
                        ? 'bg-rose-500/70'
                        : 'bg-blue-500/30'
                    }`}
                  />

                  {/* Avatar Circle */}
                  <div
                    className={`relative w-11 h-11 rounded-full border-2 overflow-hidden shadow-xl transition-transform group-hover:scale-115 ${
                      member.emergencySosActive
                        ? 'border-rose-500 ring-4 ring-rose-500/40 bg-rose-950'
                        : 'border-blue-400 ring-2 ring-blue-500/20 bg-slate-900'
                    }`}
                  >
                    <img
                      src={member.avatar}
                      alt={member.name}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Pin Callout Badge */}
                  <div
                    className={`mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold shadow-lg border flex items-center gap-1 whitespace-nowrap ${
                      member.emergencySosActive
                        ? 'bg-rose-600 text-white border-rose-400 animate-bounce'
                        : 'bg-slate-950/95 text-slate-200 border-slate-700/80'
                    }`}
                  >
                    <span>{member.name.split(' ')[0]}</span>
                    <span
                      className={`text-[9px] font-mono px-1 py-0.2 rounded ${
                        member.liveLocation.batteryLevel < 20
                          ? 'bg-rose-500/30 text-rose-300'
                          : 'bg-emerald-500/30 text-emerald-300'
                      }`}
                    >
                      {member.liveLocation.batteryLevel}%
                    </span>
                  </div>
                </div>
              </AdvancedMarker>
            ))}

            {/* InfoWindow on Marker Click */}
            {selectedMember && (
              <InfoWindow
                position={{
                  lat: selectedMember.liveLocation.lat,
                  lng: selectedMember.liveLocation.lng,
                }}
                onCloseClick={() => setSelectedMember(null)}
                pixelOffset={[0, -44]}
              >
                <div className="p-2.5 max-w-xs text-slate-900 select-none space-y-2">
                  <div className="flex items-center gap-2.5 border-b border-slate-200 pb-2">
                    <img
                      src={selectedMember.avatar}
                      alt={selectedMember.name}
                      className="w-10 h-10 rounded-full object-cover border border-slate-300 shrink-0"
                    />
                    <div>
                      <h4 className="font-bold text-xs text-slate-900 leading-tight">
                        {selectedMember.name}
                      </h4>
                      <p className="text-[10px] text-slate-600">
                        {selectedMember.relationship} • {selectedMember.role === 'primary' ? 'Head' : 'Member'}
                      </p>
                      <div className="flex items-center gap-1 mt-0.5 text-[10px] text-emerald-600 font-semibold">
                        <Battery className="w-3 h-3" />
                        <span>{selectedMember.liveLocation.batteryLevel}% Battery</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1 text-[11px] text-slate-700">
                    <div className="flex items-start gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                      <div>
                        <strong className="block text-slate-900 text-[11px]">Current Location:</strong>
                        <span className="text-slate-600 text-[10px] leading-snug">
                          {selectedMember.liveLocation.address}
                        </span>
                      </div>
                    </div>

                    <div className="text-[10px] text-slate-500 font-mono pl-5">
                      GPS: {selectedMember.liveLocation.lat.toFixed(4)}, {selectedMember.liveLocation.lng.toFixed(4)} • {selectedMember.liveLocation.timestamp}
                    </div>

                    <div className="bg-slate-100 p-1.5 rounded-lg text-[10px] text-slate-600">
                      Zone:{' '}
                      <strong className="text-slate-900 capitalize">
                        {selectedMember.geofenceStatus}
                      </strong>{' '}
                      • Mood: <span>{selectedMember.todayMood}</span>
                    </div>
                  </div>

                  {/* Actions inside InfoWindow */}
                  <div className="pt-1 flex items-center gap-1.5">
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${selectedMember.liveLocation.lat},${selectedMember.liveLocation.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-1.5 px-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-bold text-center flex items-center justify-center gap-1 shadow-sm"
                    >
                      <Navigation className="w-3 h-3" />
                      <span>Google Maps Route</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>

                    {selectedMember.emergencySosActive ? (
                      <button
                        onClick={() => onClearSos && onClearSos(selectedMember.id)}
                        className="py-1.5 px-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-[10px] font-semibold"
                      >
                        Clear SOS
                      </button>
                    ) : (
                      <button
                        onClick={() => onTriggerSos && onTriggerSos(selectedMember.id)}
                        className="py-1.5 px-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[10px] font-bold flex items-center gap-0.5"
                      >
                        <AlertTriangle className="w-3 h-3" />
                        <span>Test SOS</span>
                      </button>
                    )}
                  </div>
                </div>
              </InfoWindow>
            )}
          </Map>
        </APIProvider>
      </div>

      {/* Footer Geofence HUD */}
      <div className="px-4 py-2 bg-slate-950 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Active Geofencing: Chennai Innovation Campus, IIT Madras Lab, T. Nagar</span>
        </div>
        <span className="font-mono text-[10px] text-slate-500">Google Maps Platform SDK</span>
      </div>
    </div>
  );
};
