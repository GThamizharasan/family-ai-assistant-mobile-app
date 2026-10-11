import React, { useState } from 'react';
import {
  Cctv,
  Watch,
  Shield,
  Video,
  Radio,
  Eye,
  EyeOff,
  Moon,
  Volume2,
  VolumeX,
  Bell,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Heart,
  Activity,
  Flame,
  Footprints,
  MoonStar,
  HardDrive,
  Maximize2,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Sliders,
  Settings,
  Lock,
  Plus,
} from 'lucide-react';
import {
  INITIAL_SMART_WATCHES,
  INITIAL_TAPO_CAMERAS,
  INITIAL_TAPO_ACCOUNT,
  SmartWatchDevice,
  TapoCameraDevice,
  TapoAccountConfig,
} from '../../services/smartDevices';
import { useApp } from '../../context/AppContext';

export const SmartDevicesTab: React.FC = () => {
  const { user } = useApp();
  const [activeFilter, setActiveFilter] = useState<'all' | 'cameras' | 'watches' | 'settings'>('all');
  const [cameras, setCameras] = useState<TapoCameraDevice[]>(INITIAL_TAPO_CAMERAS);
  const [watches, setWatches] = useState<SmartWatchDevice[]>(INITIAL_SMART_WATCHES);
  const [tapoAccount, setTapoAccount] = useState<TapoAccountConfig>(INITIAL_TAPO_ACCOUNT);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('cam-01');
  const [isSyncing, setIsSyncing] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const selectedCamera = cameras.find((c) => c.id === selectedCameraId) || cameras[0];

  const showFeedback = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 3500);
  };

  // Camera Pan/Tilt Controls
  const handlePanTilt = (cameraId: string, direction: 'up' | 'down' | 'left' | 'right' | 'center') => {
    setCameras((prev) =>
      prev.map((cam) => {
        if (cam.id !== cameraId) return cam;
        let { pan, tilt } = cam.panTiltAngle;
        if (direction === 'up') tilt = Math.min(60, tilt + 10);
        if (direction === 'down') tilt = Math.max(-20, tilt - 10);
        if (direction === 'left') pan = Math.max(-170, pan - 15);
        if (direction === 'right') pan = Math.min(170, pan + 15);
        if (direction === 'center') {
          pan = 0;
          tilt = 0;
        }
        return { ...cam, panTiltAngle: { pan, tilt } };
      })
    );
    showFeedback(`Camera PTZ moved ${direction.toUpperCase()} (${selectedCamera.name})`);
  };

  // Toggle Privacy Mode (lens tilts inside housing)
  const handleTogglePrivacy = (cameraId: string) => {
    setCameras((prev) =>
      prev.map((cam) => {
        if (cam.id !== cameraId) return cam;
        const next = !cam.privacyModeActive;
        return {
          ...cam,
          privacyModeActive: next,
          status: next ? 'privacy_mode' : 'online',
        };
      })
    );
    showFeedback(`Tapo Privacy Mode ${selectedCamera.privacyModeActive ? 'Deactivated' : 'Activated'}`);
  };

  // Toggle Night Vision
  const handleToggleNightVision = (cameraId: string) => {
    setCameras((prev) =>
      prev.map((cam) => {
        if (cam.id !== cameraId) return cam;
        const nextMode = cam.nightVisionMode === 'Full Color' ? 'Smart IR' : 'Full Color';
        return { ...cam, nightVisionMode: nextMode };
      })
    );
    showFeedback(`Night vision switched to ${selectedCamera.nightVisionMode === 'Full Color' ? 'Smart IR' : 'Full Color'}`);
  };

  // Toggle 2-way Audio Intercom
  const handleToggle2WayAudio = (cameraId: string) => {
    setCameras((prev) =>
      prev.map((cam) => {
        if (cam.id !== cameraId) return cam;
        return { ...cam, twoWayAudioActive: !cam.twoWayAudioActive };
      })
    );
    showFeedback(`2-Way Audio Intercom ${selectedCamera.twoWayAudioActive ? 'Muted' : 'Live'}`);
  };

  // Trigger Deterrence Siren
  const handleTriggerSiren = (cameraId: string) => {
    setCameras((prev) =>
      prev.map((cam) => {
        if (cam.id !== cameraId) return cam;
        return { ...cam, sirenAlarmActive: !cam.sirenAlarmActive };
      })
    );
    showFeedback(`Deterrence Siren ${selectedCamera.sirenAlarmActive ? 'Silenced' : 'Triggered'}`);
  };

  // Test Watch Haptic Alert
  const handleTestWatchHaptic = (watch: SmartWatchDevice) => {
    showFeedback(`Haptic Emergency Ping sent to ${watch.name} (${watch.assignedTo})`);
  };

  const handleSyncAllDevices = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      showFeedback('All Smartwatches & Tapo CCTV streams synchronized successfully');
    }, 1200);
  };

  return (
    <div className="space-y-5 pb-28 pt-2">
      {/* Header Hub Card */}
      <div className="p-5 rounded-3xl bg-gradient-to-br from-indigo-950/40 via-slate-900 to-purple-950/40 border border-indigo-500/30 relative overflow-hidden shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center p-2.5 shadow-md shadow-indigo-600/30 shrink-0 text-white">
              <Cctv className="w-6 h-6" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">Smart IoT & Tapo CCTV Command Hub</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Cloud Live
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Tapo Cloud: <strong className="text-indigo-300 font-mono">{tapoAccount.accountEmail}</strong> • 4 Cameras & 3 Smartwatches
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSyncAllDevices}
              disabled={isSyncing}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white shadow-md transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Syncing...' : 'Sync IoT Devices'}</span>
            </button>
          </div>
        </div>

        {/* Global Toast Alert */}
        {actionNotice && (
          <div className="mt-3 p-2.5 rounded-xl bg-indigo-500/20 border border-indigo-500/40 text-xs text-indigo-200 flex items-center gap-2 animate-fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{actionNotice}</span>
          </div>
        )}

        {/* Category Sub-Navigation */}
        <div className="flex items-center gap-1.5 pt-4 overflow-x-auto">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
              activeFilter === 'all'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300'
            }`}
          >
            All Smart Devices ({cameras.length + watches.length})
          </button>
          <button
            onClick={() => setActiveFilter('cameras')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
              activeFilter === 'cameras'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300'
            }`}
          >
            <Cctv className="w-3.5 h-3.5" />
            <span>Tapo CCTV ({cameras.length})</span>
          </button>
          <button
            onClick={() => setActiveFilter('watches')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
              activeFilter === 'watches'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300'
            }`}
          >
            <Watch className="w-3.5 h-3.5" />
            <span>Smartwatches ({watches.length})</span>
          </button>
          <button
            onClick={() => setActiveFilter('settings')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
              activeFilter === 'settings'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Tapo Cloud Settings</span>
          </button>
        </div>
      </div>

      {/* SECTION 1: CCTV TAPO CAMERAS (When 'all' or 'cameras' is active) */}
      {(activeFilter === 'all' || activeFilter === 'cameras') && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <Cctv className="w-4 h-4 text-indigo-400" />
              <h3 className="text-sm font-bold text-white">TP-Link Tapo Security Cameras</h3>
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              Account: {tapoAccount.accountEmail} • 2K QHD RTSP
            </span>
          </div>

          {/* Featured Live Stream Viewport & PTZ Controller */}
          <div className="p-4 sm:p-5 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-xl">
            {/* Camera Switcher Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {cameras.map((cam) => (
                <button
                  key={cam.id}
                  onClick={() => setSelectedCameraId(cam.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border ${
                    selectedCameraId === cam.id
                      ? 'bg-indigo-600 text-white border-indigo-500 shadow-md'
                      : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      cam.privacyModeActive
                        ? 'bg-amber-400'
                        : cam.status === 'online'
                        ? 'bg-emerald-400 animate-pulse'
                        : 'bg-rose-500'
                    }`}
                  />
                  <span>{cam.name}</span>
                </button>
              ))}
            </div>

            {/* Video Feed Window */}
            <div className="relative rounded-2xl overflow-hidden bg-black aspect-video sm:h-80 w-full border border-slate-800 shadow-inner group">
              {selectedCamera.privacyModeActive ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 p-6 text-center space-y-3">
                  <div className="w-14 h-14 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center">
                    <EyeOff className="w-7 h-7" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Privacy Mode Activated</h4>
                    <p className="text-xs text-slate-400 max-w-sm mt-1">
                      Camera lens has physically rotated inside the chassis. Audio and video streaming are stopped for family privacy.
                    </p>
                  </div>
                  <button
                    onClick={() => handleTogglePrivacy(selectedCamera.id)}
                    className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-xs font-bold text-white shadow-md transition-colors"
                  >
                    Disable Privacy Mode & Resume Feed
                  </button>
                </div>
              ) : (
                <>
                  <img
                    src={selectedCamera.mockFeedImage}
                    alt={selectedCamera.name}
                    className="w-full h-full object-cover"
                  />

                  {/* Feed Overlays */}
                  <div className="absolute top-3 left-3 flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-rose-600 text-white text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 animate-pulse">
                      <span className="w-1.5 h-1.5 rounded-full bg-white" /> LIVE
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-slate-950/80 text-white text-[10px] font-mono border border-slate-700">
                      {selectedCamera.streamQuality} • {selectedCamera.bitrateKbps} kbps • {selectedCamera.frameRateFps} fps
                    </span>
                  </div>

                  <div className="absolute top-3 right-3 flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded-md bg-slate-950/80 text-slate-200 text-[10px] font-mono border border-slate-700">
                      PTZ ({selectedCamera.panTiltAngle.pan}°, {selectedCamera.panTiltAngle.tilt}°)
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-slate-950/80 text-slate-200 text-[10px] font-medium border border-slate-700">
                      {selectedCamera.nightVisionMode}
                    </span>
                  </div>

                  <div className="absolute bottom-3 left-3 text-[11px] font-mono text-white/90 drop-shadow-md bg-black/50 px-2 py-1 rounded">
                    {selectedCamera.location} • {new Date().toLocaleTimeString()}
                  </div>
                </>
              )}
            </div>

            {/* Quick Action Toolbar & PTZ D-pad */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
              {/* Camera Action Buttons */}
              <div className="md:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  onClick={() => handleTogglePrivacy(selectedCamera.id)}
                  className={`p-3 rounded-2xl border text-xs font-semibold flex flex-col items-center justify-center gap-1.5 transition-all ${
                    selectedCamera.privacyModeActive
                      ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                      : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-300'
                  }`}
                >
                  {selectedCamera.privacyModeActive ? (
                    <EyeOff className="w-4 h-4 text-amber-400" />
                  ) : (
                    <Eye className="w-4 h-4 text-slate-400" />
                  )}
                  <span>{selectedCamera.privacyModeActive ? 'Privacy ON' : 'Privacy Mode'}</span>
                </button>

                <button
                  onClick={() => handleToggleNightVision(selectedCamera.id)}
                  className="p-3 rounded-2xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-xs font-semibold flex flex-col items-center justify-center gap-1.5 text-slate-300 transition-all"
                >
                  <Moon className="w-4 h-4 text-indigo-400" />
                  <span>Night: {selectedCamera.nightVisionMode}</span>
                </button>

                <button
                  onClick={() => handleToggle2WayAudio(selectedCamera.id)}
                  className={`p-3 rounded-2xl border text-xs font-semibold flex flex-col items-center justify-center gap-1.5 transition-all ${
                    selectedCamera.twoWayAudioActive
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                      : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-300'
                  }`}
                >
                  {selectedCamera.twoWayAudioActive ? (
                    <Volume2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <VolumeX className="w-4 h-4 text-slate-400" />
                  )}
                  <span>2-Way Audio</span>
                </button>

                <button
                  onClick={() => handleTriggerSiren(selectedCamera.id)}
                  className={`p-3 rounded-2xl border text-xs font-semibold flex flex-col items-center justify-center gap-1.5 transition-all ${
                    selectedCamera.sirenAlarmActive
                      ? 'bg-rose-500/20 border-rose-500 text-rose-300 animate-pulse'
                      : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-300'
                  }`}
                >
                  <Bell className="w-4 h-4 text-rose-400" />
                  <span>{selectedCamera.sirenAlarmActive ? 'Alarm Sounding' : 'Trigger Siren'}</span>
                </button>
              </div>

              {/* PTZ Pan/Tilt Directional Controller */}
              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-white block">Pan/Tilt Controller</span>
                  <span className="text-[10px] text-slate-400">Tapo PTZ Precision Motor</span>
                </div>

                <div className="grid grid-cols-3 gap-1 w-24">
                  <div />
                  <button
                    onClick={() => handlePanTilt(selectedCamera.id, 'up')}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center"
                    title="Tilt Up"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <div />

                  <button
                    onClick={() => handlePanTilt(selectedCamera.id, 'left')}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center"
                    title="Pan Left"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handlePanTilt(selectedCamera.id, 'center')}
                    className="p-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[9px] font-bold flex items-center justify-center"
                    title="Reset Center"
                  >
                    0°
                  </button>
                  <button
                    onClick={() => handlePanTilt(selectedCamera.id, 'right')}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center"
                    title="Pan Right"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>

                  <div />
                  <button
                    onClick={() => handlePanTilt(selectedCamera.id, 'down')}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center"
                    title="Tilt Down"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                  <div />
                </div>
              </div>
            </div>

            {/* Storage & AI Event Feed Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800/80 text-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-indigo-400" />
                  <div>
                    <span className="font-semibold text-slate-200 block">MicroSD Storage</span>
                    <span className="text-[11px] text-slate-400">
                      {selectedCamera.sdCardStorageGb.free} GB free of {selectedCamera.sdCardStorageGb.total} GB
                    </span>
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300">
                  Continuous Loop Record
                </span>
              </div>

              {selectedCamera.lastMotionEvent && (
                <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800/80 text-xs flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-slate-200 block">
                      AI {selectedCamera.lastMotionEvent.type} Detected
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {selectedCamera.lastMotionEvent.description} ({selectedCamera.lastMotionEvent.timestamp})
                    </span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300">
                    Snapshot Saved
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: SMARTWATCHES & WEARABLES (When 'all' or 'watches' is active) */}
      {(activeFilter === 'all' || activeFilter === 'watches') && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <Watch className="w-4 h-4 text-purple-400" />
              <h3 className="text-sm font-bold text-white">Family Smartwatches & Health Telemetry</h3>
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              Wear OS 5 • Apple Health • Fitbit Cloud
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {watches.map((watch) => (
              <div
                key={watch.id}
                className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-xl hover:border-slate-700 transition-all"
              >
                {/* Watch Card Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <img
                      src={watch.avatar}
                      alt={watch.assignedTo}
                      className="w-10 h-10 rounded-full object-cover border-2 border-purple-400"
                    />
                    <div>
                      <h4 className="text-xs font-bold text-white">{watch.assignedTo}</h4>
                      <p className="text-[10px] text-slate-400 font-mono">{watch.brand}</p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300">
                      {watch.batteryLevel}% Battery
                    </span>
                    <span className="text-[9px] text-slate-500 block mt-0.5">{watch.lastSyncTime}</span>
                  </div>
                </div>

                <div className="p-2.5 rounded-2xl bg-slate-950 border border-slate-800/80 text-xs">
                  <span className="text-[11px] text-slate-300 font-medium block truncate">
                    {watch.model}
                  </span>
                </div>

                {/* Key Biometrics Grid */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800">
                    <div className="flex items-center gap-1.5 text-rose-400 mb-1">
                      <Heart className="w-3.5 h-3.5 animate-pulse" />
                      <span className="text-[10px] font-semibold">Live Pulse</span>
                    </div>
                    <span className="text-lg font-bold text-white font-mono">{watch.heartRateBpm}</span>
                    <span className="text-[10px] text-slate-400 ml-1">BPM</span>
                    <span className="text-[9px] text-slate-500 block">Resting: {watch.restingHeartRate} BPM</span>
                  </div>

                  <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800">
                    <div className="flex items-center gap-1.5 text-blue-400 mb-1">
                      <Activity className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-semibold">Blood SpO2</span>
                    </div>
                    <span className="text-lg font-bold text-white font-mono">{watch.bloodOxygenSpO2}%</span>
                    <span className="text-[9px] text-slate-500 block">Temp: {watch.bodyTempCelsius}°C</span>
                  </div>

                  <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800">
                    <div className="flex items-center gap-1.5 text-amber-400 mb-1">
                      <Footprints className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-semibold">Steps Today</span>
                    </div>
                    <span className="text-base font-bold text-white font-mono">{watch.stepCount.toLocaleString()}</span>
                    <span className="text-[9px] text-slate-500 block">
                      Goal: {watch.stepGoal.toLocaleString()} ({Math.round((watch.stepCount / watch.stepGoal) * 100)}%)
                    </span>
                  </div>

                  <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800">
                    <div className="flex items-center gap-1.5 text-indigo-400 mb-1">
                      <MoonStar className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-semibold">Sleep Score</span>
                    </div>
                    <span className="text-base font-bold text-white font-mono">{watch.sleepScore}</span>
                    <span className="text-[10px] text-emerald-400 ml-1">Optimal</span>
                    <span className="text-[9px] text-slate-500 block">{watch.sleepDurationHours} hrs rest</span>
                  </div>
                </div>

                {/* Fall Detection & Haptic Test Button */}
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-semibold">
                    <Shield className="w-3.5 h-3.5" />
                    <span>Fall Detection: Armed</span>
                  </div>

                  <button
                    onClick={() => handleTestWatchHaptic(watch)}
                    className="px-2.5 py-1 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border border-purple-500/30 text-[10px] font-bold transition-colors"
                  >
                    Test Haptic SOS
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTION 3: TAPO CLOUD SETTINGS & SECURITY */}
      {(activeFilter === 'all' || activeFilter === 'settings') && (
        <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-xl">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">Tapo Cloud Security & Linkage</h3>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="font-semibold text-slate-200 block">TP-Link Tapo Cloud Account</span>
                <span className="text-[11px] text-slate-400 font-mono">{tapoAccount.accountEmail}</span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300">
                Connected & Verified
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="font-semibold text-slate-200 block">Tapo Care Cloud Archive</span>
                <span className="text-[11px] text-slate-400">{tapoAccount.cloudStorageTier}</span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300">
                30-Day Rolling Backup
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="font-semibold text-slate-200 block">Local RTSP & Sovereign LAN Streaming</span>
                <span className="text-[11px] text-slate-400">Encrypted on-premise streaming (Port 554 RTSP / ONVIF Profile S)</span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300">
                AES-128 Encryption Active
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
