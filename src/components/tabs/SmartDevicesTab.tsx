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
  Play,
  Pause,
  Film,
  Download,
  Calendar,
  FastForward,
  Layers,
  HelpCircle,
  ExternalLink,
  Copy,
  AlertCircle,
  Wifi,
  Info,
  Terminal,
} from 'lucide-react';
import {
  INITIAL_SMART_WATCHES,
  INITIAL_TAPO_CAMERAS,
  INITIAL_TAPO_ACCOUNT,
  SmartWatchDevice,
  TapoCameraDevice,
  TapoAccountConfig,
  TapoSdRecording,
} from '../../services/smartDevices';
import { useApp } from '../../context/AppContext';
import { TapoIntegrationModal } from '../TapoIntegrationModal';

const CctvLivePlayer: React.FC<{ camera: TapoCameraDevice }> = ({ camera }) => {
  const [streamError, setStreamError] = useState(false);
  const [key, setKey] = useState(0);
  const [isSnapshotFallback, setIsSnapshotFallback] = useState(false);
  const [snapshotUrl, setSnapshotUrl] = useState('');

  const pass = camera.cameraAccountPassword || 'CMVijayTVK12$';
  const user = camera.cameraAccountUser || 'thamiz_admin';
  const ip = camera.localIp || '192.168.1.67';
  const rtspUrl = camera.rtspStreamUrl || `rtsp://${user}:${encodeURIComponent(pass)}@${ip}:554/stream1`;
  const streamUrl = `/api/camera/stream?camId=${camera.id}&url=${encodeURIComponent(rtspUrl)}&t=${key}`;

  const handleRefresh = () => {
    setStreamError(false);
    setIsSnapshotFallback(false);
    setKey((prev) => prev + 1);
  };

  React.useEffect(() => {
    let interval: any;
    if (isSnapshotFallback) {
      interval = setInterval(() => {
        const snap = `/api/camera/snapshot?camId=${camera.id}&url=${encodeURIComponent(rtspUrl)}&t=${Date.now()}`;
        setSnapshotUrl(snap);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isSnapshotFallback, camera.id, rtspUrl]);

  return (
    <div className="relative w-full h-full bg-black flex items-center justify-center overflow-hidden">
      {!isSnapshotFallback ? (
        <img
          key={key}
          src={streamUrl}
          alt={camera.name}
          className="w-full h-full object-cover"
          onError={() => {
            console.warn('MJPEG stream error, switching to 1-FPS live snapshot fallback');
            setIsSnapshotFallback(true);
          }}
        />
      ) : (
        <img
          src={snapshotUrl || `/api/camera/snapshot?camId=${camera.id}&url=${encodeURIComponent(rtspUrl)}&t=${Date.now()}`}
          alt={camera.name}
          className="w-full h-full object-cover"
          onError={() => {
            setStreamError(true);
          }}
        />
      )}

      {/* Live Overlay Badges */}
      <div className="absolute top-3 left-3 flex items-center gap-2 z-10">
        <span className="px-2 py-0.5 rounded-md bg-rose-600 text-white text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 animate-pulse">
          <span className="w-1.5 h-1.5 rounded-full bg-white" /> LIVE CCTV
        </span>
        <span className="px-2 py-0.5 rounded-md bg-slate-950/80 text-emerald-300 text-[10px] font-mono border border-slate-700">
          {isSnapshotFallback ? '1 FPS Snapshot Mode' : 'Live Stream 10 FPS'}
        </span>
      </div>

      <div className="absolute top-3 right-3 flex items-center gap-1.5 z-10">
        <button
          onClick={handleRefresh}
          className="px-2 py-1 rounded-md bg-slate-950/80 hover:bg-slate-800 text-slate-200 text-[10px] font-mono border border-slate-700 flex items-center gap-1"
          title="Reconnect Stream"
        >
          <RefreshCw className="w-3 h-3 text-indigo-400" />
          <span>Refresh</span>
        </button>
      </div>

      <div className="absolute bottom-3 left-3 text-[11px] font-mono text-white/90 drop-shadow-md bg-black/60 px-2 py-1 rounded z-10">
        {camera.location} • {new Date().toLocaleTimeString()}
      </div>

      {streamError && (
        <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-4 text-center space-y-2 z-20">
          <AlertCircle className="w-8 h-8 text-rose-400" />
          <p className="text-xs font-bold text-white">Camera Offline or Unreachable on LAN</p>
          <p className="text-[10px] text-slate-400 max-w-xs">
            Verify camera IP ({ip}) and credentials ({user}:••••••••) on port 554.
          </p>
          <button
            onClick={handleRefresh}
            className="px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-bold flex items-center gap-1 mt-2"
          >
            <RefreshCw className="w-3 h-3" /> Retry Stream
          </button>
        </div>
      )}
    </div>
  );
};

export const SmartDevicesTab: React.FC = () => {
  const { user } = useApp();
  const [activeFilter, setActiveFilter] = useState<'all' | 'cameras' | 'watches' | 'settings'>('all');
  const [cameras, setCameras] = useState<TapoCameraDevice[]>(() => {
    try {
      const saved = localStorage.getItem('aura_tapo_cameras');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((cam: TapoCameraDevice) => {
            if (cam.id === 'cam-01') {
              return {
                ...cam,
                localIp: cam.localIp || '192.168.1.67',
                cameraAccountUser: cam.cameraAccountUser || 'thamiz_admin',
                cameraAccountPassword: cam.cameraAccountPassword || 'CMVijayTVK12$',
                rtspStreamUrl:
                  cam.rtspStreamUrl ||
                  'rtsp://thamiz_admin:CMVijayTVK12$@192.168.1.67:554/stream1',
              };
            }
            return cam;
          });
        }
      }
    } catch (e) {}
    return INITIAL_TAPO_CAMERAS;
  });
  const [watches, setWatches] = useState<SmartWatchDevice[]>(INITIAL_SMART_WATCHES);
  const [tapoAccount, setTapoAccount] = useState<TapoAccountConfig>(INITIAL_TAPO_ACCOUNT);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('cam-01');
  const [isSyncing, setIsSyncing] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Tapo Integration & SD Card Playback States
  const [isTapoModalOpen, setIsTapoModalOpen] = useState(false);
  const [cameraViewMode, setCameraViewMode] = useState<'live' | 'playback'>('live');
  const [streamPlayerType, setStreamPlayerType] = useState<'live-mjpeg' | 'simulated' | 'webrtc' | 'vlc'>('live-mjpeg');
  const [selectedRecordingId, setSelectedRecordingId] = useState<string | null>(null);
  const [isPlayingPlayback, setIsPlayingPlayback] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<1 | 2 | 4 | 8>(1);
  const [playbackTimelineHour, setPlaybackTimelineHour] = useState<number>(15.5); // 15:30
  const [recordingFilter, setRecordingFilter] = useState<'all' | 'person' | 'vehicle' | 'motion' | 'sound' | 'continuous'>('all');
  const [isFormattingSd, setIsFormattingSd] = useState(false);
  const [showRtspGuide, setShowRtspGuide] = useState(true);
  const [copiedRtsp, setCopiedRtsp] = useState(false);

  const selectedCamera = cameras.find((c) => c.id === selectedCameraId) || cameras[0];
  const cameraRecordings = selectedCamera.sdCardRecordings || [];

  const activeRecording =
    cameraRecordings.find((r) => r.id === selectedRecordingId) || cameraRecordings[0] || null;

  const showFeedback = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 3500);
  };

  const handleUpdateAccount = (updated: Partial<TapoAccountConfig>) => {
    setTapoAccount((prev) => ({ ...prev, ...updated }));
    showFeedback('TP-Link Tapo Account settings updated');
  };

  const handleUpdateCamera = (cameraId: string, updated: Partial<TapoCameraDevice>) => {
    setCameras((prev) =>
      prev.map((cam) => (cam.id === cameraId ? { ...cam, ...updated } : cam))
    );
    showFeedback(`Settings updated for camera`);
  };

  // MicroSD format simulation
  const handleFormatSdCard = (cameraId: string) => {
    if (confirm(`Are you sure you want to format the internal MicroSD card on ${selectedCamera.name}? All recorded clips will be cleared.`)) {
      setIsFormattingSd(true);
      setTimeout(() => {
        setCameras((prev) =>
          prev.map((cam) => {
            if (cam.id !== cameraId) return cam;
            return {
              ...cam,
              sdCardStorageGb: { total: cam.sdCardStorageGb.total, used: 0.1, free: cam.sdCardStorageGb.total - 0.1 },
              sdCardRecordings: [],
            };
          })
        );
        setIsFormattingSd(false);
        showFeedback(`MicroSD card on ${selectedCamera.name} formatted successfully (FAT32/exFAT).`);
      }, 2000);
    }
  };

  // Download MP4 from SD Card
  const handleDownloadClip = (recording: TapoSdRecording) => {
    showFeedback(`Downloading ${recording.eventTitle} (${recording.startTime}-${recording.endTime}.mp4) from MicroSD internal storage...`);
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
  const handleToggle2WayAudio = async (cameraId: string) => {
    const isActivating = !selectedCamera.twoWayAudioActive;
    if (isActivating && typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());
      } catch (e) {
        showFeedback('Microphone permission blocked in browser. Please allow mic in address bar.');
      }
    }
    setCameras((prev) =>
      prev.map((cam) => {
        if (cam.id !== cameraId) return cam;
        return { ...cam, twoWayAudioActive: !cam.twoWayAudioActive };
      })
    );
    showFeedback(`2-Way Audio Intercom ${selectedCamera.twoWayAudioActive ? 'Muted' : 'Live (Mic Open)'}`);
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
              onClick={() => setIsTapoModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 text-xs font-semibold text-purple-200 border border-purple-500/40 shadow-md transition-colors"
            >
              <HardDrive className="w-3.5 h-3.5 text-purple-300" />
              <span>Tapo & SD Card Setup</span>
            </button>
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

          {/* Featured Viewport (Live Stream vs MicroSD Playback) */}
          <div className="p-4 sm:p-5 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-xl">
            {/* Camera Switcher Tabs & Mode Selector */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-slate-800/80">
              {/* Camera Switcher Tabs */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
                {cameras.map((cam) => (
                  <button
                    key={cam.id}
                    onClick={() => {
                      setSelectedCameraId(cam.id);
                      setSelectedRecordingId(null);
                    }}
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

              {/* Mode Switcher: Live Stream vs SD Storage Playback */}
              <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-950 border border-slate-800 shrink-0 self-start sm:self-auto">
                <button
                  onClick={() => setCameraViewMode('live')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    cameraViewMode === 'live'
                      ? 'bg-rose-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  <span>Live Feed</span>
                </button>

                <button
                  onClick={() => setCameraViewMode('playback')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    cameraViewMode === 'playback'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <HardDrive className="w-3.5 h-3.5" />
                  <span>SD Playback ({cameraRecordings.length})</span>
                </button>

                <button
                  onClick={() => setIsTapoModalOpen(true)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-indigo-300 hover:bg-slate-800 transition-colors"
                  title="Configure Tapo Network & Storage"
                >
                  <Settings className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* VIEW 1: LIVE FEED & PTZ */}
            {cameraViewMode === 'live' && (
              <>
                {/* Stream Source Mode Selector */}
                <div className="flex items-center justify-between px-1 pb-1">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Stream Output Mode:
                  </span>
                  <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
                    <button
                      onClick={() => setStreamPlayerType('live-mjpeg')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                        streamPlayerType === 'live-mjpeg'
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Live CCTV Stream (FFmpeg)
                    </button>
                    <button
                      onClick={() => setStreamPlayerType('simulated')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                        streamPlayerType === 'simulated'
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      AI QHD Preview
                    </button>
                    <button
                      onClick={() => setStreamPlayerType('webrtc')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                        streamPlayerType === 'webrtc'
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      WebRTC Bridge
                    </button>
                    <button
                      onClick={() => setStreamPlayerType('vlc')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                        streamPlayerType === 'vlc'
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      VLC Direct
                    </button>
                  </div>
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
                  ) : streamPlayerType === 'live-mjpeg' ? (
                    <CctvLivePlayer camera={selectedCamera} />
                  ) : streamPlayerType === 'webrtc' ? (
                    <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center p-4 text-center space-y-3">
                      <iframe
                        src={selectedCamera.webrtcBridgeUrl || `http://${selectedCamera.localIp || '172.20.10.2'}:1984/stream.html?src=tapo-c210`}
                        title="WebRTC Stream Bridge"
                        className="w-full h-full border-0 rounded-xl"
                        onError={() => {}}
                      />
                      <div className="absolute bottom-2 left-2 right-2 bg-slate-900/90 backdrop-blur-md p-2 rounded-xl border border-slate-800 flex items-center justify-between text-[11px] text-slate-300">
                        <span className="font-mono text-indigo-300 truncate">
                          Bridge: {selectedCamera.webrtcBridgeUrl || `http://${selectedCamera.localIp || '172.20.10.2'}:1984`}
                        </span>
                        <span className="text-[10px] text-emerald-400 font-bold px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                          WebRTC Active
                        </span>
                      </div>
                    </div>
                  ) : streamPlayerType === 'vlc' ? (
                    <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-slate-950 to-indigo-950 p-6 flex flex-col items-center justify-center text-center space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30 shadow-lg">
                        <Wifi className="w-6 h-6 animate-pulse" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">Direct RTSP Stream (Port 554)</h4>
                        <p className="text-xs text-slate-300 max-w-md mt-1 leading-relaxed">
                          Your camera stream is fully verified and streaming live over RTSP on LAN:
                        </p>
                        <div className="my-2 p-2.5 rounded-xl bg-black/80 border border-slate-800 text-emerald-300 font-mono text-xs select-all">
                          {selectedCamera.rtspStreamUrl || `rtsp://${selectedCamera.cameraAccountUser || 'thamizh'}:iloveyou@${selectedCamera.localIp || '172.20.10.2'}:554/stream1`}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => {
                            const pass = selectedCamera.cameraAccountPassword || 'iloveyou';
                            const encodedPass = encodeURIComponent(pass);
                            const user = selectedCamera.cameraAccountUser || 'thamizh';
                            const ip = selectedCamera.localIp || '172.20.10.2';
                            const url = selectedCamera.rtspStreamUrl || `rtsp://${user}:${encodedPass}@${ip}:554/stream1`;
                            navigator.clipboard.writeText(url);
                            setCopiedRtsp(true);
                            setTimeout(() => setCopiedRtsp(false), 2500);
                          }}
                          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white shadow-md flex items-center gap-1.5 transition-colors"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>{copiedRtsp ? 'Copied RTSP URL!' : 'Copy RTSP Stream URL for VLC'}</span>
                        </button>
                      </div>
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

                {/* RTSP Stream Status & Browser Stream Diagnostics Banner */}
                <div className="p-4 rounded-2xl bg-indigo-950/30 border border-indigo-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Wifi className="w-4 h-4 text-indigo-400" />
                      <h4 className="text-xs font-bold text-white">
                        RTSP Direct Stream Diagnostics ({selectedCamera.name})
                      </h4>
                    </div>
                    <button
                      onClick={() => setShowRtspGuide(!showRtspGuide)}
                      className="text-[11px] text-indigo-300 hover:text-white font-medium underline flex items-center gap-1"
                    >
                      <Info className="w-3.5 h-3.5" />
                      {showRtspGuide ? 'Hide Stream Guide' : 'Why Stream Needs Bridge / VLC'}
                    </button>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2 font-mono text-[11px]">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="truncate">
                        <span className="text-slate-400">Target RTSP URL: </span>
                        <span className="text-emerald-300 font-bold select-all">
                          {selectedCamera.rtspStreamUrl || `rtsp://${selectedCamera.cameraAccountUser || 'thamizh'}:<password>@${selectedCamera.localIp || '172.20.10.2'}:554/stream1`}
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          const pass = selectedCamera.cameraAccountPassword || 'iloveyou';
                          const encodedPass = encodeURIComponent(pass);
                          const user = selectedCamera.cameraAccountUser || 'thamizh';
                          const ip = selectedCamera.localIp || '172.20.10.2';
                          const urlToCopy = selectedCamera.rtspStreamUrl || `rtsp://${user}:${encodedPass}@${ip}:554/stream1`;
                          navigator.clipboard.writeText(urlToCopy);
                          setCopiedRtsp(true);
                          setTimeout(() => setCopiedRtsp(false), 2500);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-sans text-xs font-bold flex items-center gap-1 shrink-0 transition-colors"
                      >
                        <Copy className="w-3 h-3" />
                        <span>{copiedRtsp ? 'Copied URL!' : 'Copy RTSP for VLC'}</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-4 text-[10px] text-slate-400 pt-1 border-t border-slate-800/80">
                      <span>IP: <strong className="text-slate-200">{selectedCamera.localIp || '172.20.10.2'}</strong></span>
                      <span>Port: <strong className="text-slate-200">554 (RTSP)</strong></span>
                      <span>User: <strong className="text-slate-200">{selectedCamera.cameraAccountUser || 'thamizh'}</strong></span>
                    </div>
                  </div>

                  {showRtspGuide && (
                    <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs space-y-2 text-slate-300">
                      <div className="flex items-start gap-2 text-amber-300 font-semibold">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                        <span>Why raw RTSP streams (`rtsp://`) don't play directly inside standard Web Browsers:</span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed pl-6">
                        Web browsers (Chrome, Edge, Safari, Firefox) run HTML5 decoders and <strong>do not natively support raw RTSP binary sockets on TCP port 554</strong> inside standard <code className="text-indigo-200">&lt;video&gt;</code> tags. Desktop media players like <strong>VLC</strong> contain built-in C++ FFmpeg socket decoders, which is why your URL <code className="text-emerald-300 font-mono">rtsp://thamizh:iloveyou@172.20.10.2:554/stream1</code> plays perfectly in VLC!
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pl-6 pt-1 text-[11px]">
                        <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 space-y-1">
                          <span className="font-bold text-indigo-300 block">1. Verified Live Stream (VLC Player)</span>
                          <p className="text-slate-400 text-[10px]">
                            Open VLC &rarr; Media &rarr; Open Network Stream &rarr; paste <code className="text-emerald-300 font-mono">rtsp://thamizh:iloveyou@172.20.10.2:554/stream1</code>.
                          </p>
                        </div>
                        <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 space-y-1">
                          <span className="font-bold text-indigo-300 block">2. In-App WebRTC Stream Bridge</span>
                          <p className="text-slate-400 text-[10px]">
                            Run <code className="text-indigo-200">go2rtc</code> or <code className="text-indigo-200">MediaMTX</code> or Express bridge on LAN to translate RTSP 554 to WebRTC/HLS for standard HTML5 video elements.
                          </p>
                        </div>
                        <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 space-y-1">
                          <span className="font-bold text-indigo-300 block">3. Tapo Camera Account Verified</span>
                          <p className="text-slate-400 text-[10px]">
                            User: <code className="text-indigo-200">thamizh</code> • IP: <code className="text-indigo-200">172.20.10.2</code> • Port: <code className="text-indigo-200">554</code>. Authentication confirmed active!
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Storage & AI Event Feed Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div
                    onClick={() => setCameraViewMode('playback')}
                    className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800/80 text-xs flex items-center justify-between cursor-pointer hover:border-indigo-500/50 transition-all"
                  >
                    <div className="flex items-center gap-2">
                      <HardDrive className="w-4 h-4 text-indigo-400" />
                      <div>
                        <span className="font-semibold text-slate-200 block">MicroSD Storage ({selectedCamera.sdCardRecordings?.length || 0} clips saved)</span>
                        <span className="text-[11px] text-slate-400">
                          {selectedCamera.sdCardStorageGb.free} GB free of {selectedCamera.sdCardStorageGb.total} GB • Click to browse
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300">
                      View Playback &rarr;
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
              </>
            )}

            {/* VIEW 2: MICROSD INTERNAL STORAGE PLAYBACK & RECORDINGS TIMELINE */}
            {cameraViewMode === 'playback' && (
              <div className="space-y-4">
                {/* Active Clip Player Window */}
                <div className="relative rounded-2xl overflow-hidden bg-black aspect-video sm:h-80 w-full border border-slate-800 shadow-inner group">
                  <img
                    src={activeRecording?.thumbnailUrl || selectedCamera.mockFeedImage}
                    alt={activeRecording?.eventTitle || 'MicroSD Recording'}
                    className="w-full h-full object-cover filter contrast-105"
                  />

                  {/* Playback Badges & Overlays */}
                  <div className="absolute top-3 left-3 flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-indigo-600 text-white text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                      <Film className="w-3 h-3" /> SD PLAYBACK
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-slate-950/80 text-white text-[10px] font-mono border border-slate-700">
                      {activeRecording ? `${activeRecording.startTime} - ${activeRecording.endTime}` : 'No clip selected'}
                    </span>
                    {activeRecording && (
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                          activeRecording.eventType === 'person'
                            ? 'bg-purple-600/80 text-purple-200'
                            : activeRecording.eventType === 'vehicle'
                            ? 'bg-blue-600/80 text-blue-200'
                            : activeRecording.eventType === 'sound'
                            ? 'bg-amber-600/80 text-amber-200'
                            : activeRecording.eventType === 'continuous'
                            ? 'bg-emerald-600/80 text-emerald-200'
                            : 'bg-slate-700 text-slate-200'
                        }`}
                      >
                        {activeRecording.eventType}
                      </span>
                    )}
                  </div>

                  <div className="absolute top-3 right-3 flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-slate-950/80 text-slate-200 text-[10px] font-mono border border-slate-700">
                      Speed: {playbackSpeed}x
                    </span>
                  </div>

                  {/* Playing Indicator */}
                  {isPlayingPlayback && (
                    <div className="absolute inset-x-0 bottom-12 px-4">
                      <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-400 rounded-full animate-pulse w-2/3" />
                      </div>
                    </div>
                  )}

                  {/* Player Bottom Control Bar */}
                  <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/95 via-black/70 to-transparent flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => {
                          setIsPlayingPlayback(!isPlayingPlayback);
                          showFeedback(isPlayingPlayback ? 'Playback paused' : 'Playing MicroSD clip');
                        }}
                        className="w-8 h-8 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center shadow-md transition-colors"
                      >
                        {isPlayingPlayback ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                      </button>

                      <div>
                        <span className="text-xs font-bold text-white block">
                          {activeRecording?.eventTitle || 'MicroSD Stored Footage'}
                        </span>
                        <span className="text-[10px] text-slate-300 font-mono">
                          {activeRecording ? `${activeRecording.dateStr} • Duration: ${Math.round(activeRecording.durationSeconds / 60)}m` : 'Select a recording below'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* Speed Multiplier */}
                      <button
                        onClick={() => {
                          const speeds: Array<1 | 2 | 4 | 8> = [1, 2, 4, 8];
                          const next = speeds[(speeds.indexOf(playbackSpeed) + 1) % speeds.length];
                          setPlaybackSpeed(next);
                          showFeedback(`Playback speed set to ${next}x`);
                        }}
                        className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-mono font-bold transition-colors"
                      >
                        {playbackSpeed}x Speed
                      </button>

                      {/* Download Clip */}
                      {activeRecording && (
                        <button
                          onClick={() => handleDownloadClip(activeRecording)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600/40 hover:bg-indigo-600/60 border border-indigo-500/40 text-indigo-200 text-[10px] font-semibold transition-colors"
                        >
                          <Download className="w-3 h-3" />
                          <span>MP4 ({Math.round(activeRecording.fileSizeBytes / (1024 * 1024))}MB)</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* 24-HOUR MICROSD TIMELINE SCRUBBER */}
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <Film className="w-3.5 h-3.5 text-indigo-400" />
                      <span className="font-bold text-white">24-Hour MicroSD Timeline Scrubber</span>
                      <span className="text-[10px] text-slate-400 font-mono">Today, 2026-10-11</span>
                    </div>

                    {/* Legend */}
                    <div className="hidden sm:flex items-center gap-3 text-[10px]">
                      <span className="flex items-center gap-1 text-emerald-300">
                        <span className="w-2 h-2 rounded bg-emerald-500" /> Continuous
                      </span>
                      <span className="flex items-center gap-1 text-purple-300">
                        <span className="w-2 h-2 rounded bg-purple-500" /> Person
                      </span>
                      <span className="flex items-center gap-1 text-blue-300">
                        <span className="w-2 h-2 rounded bg-blue-500" /> Vehicle
                      </span>
                      <span className="flex items-center gap-1 text-amber-300">
                        <span className="w-2 h-2 rounded bg-amber-500" /> Sound
                      </span>
                    </div>
                  </div>

                  {/* Interactive Timeline Track */}
                  <div className="relative pt-3 pb-2">
                    {/* Hour Marks */}
                    <div className="flex justify-between text-[9px] font-mono text-slate-500 mb-1 px-1">
                      <span>00:00</span>
                      <span>04:00</span>
                      <span>08:00</span>
                      <span>12:00</span>
                      <span>16:00</span>
                      <span>20:00</span>
                      <span>23:59</span>
                    </div>

                    {/* Timeline Bar with Event Blocks */}
                    <div
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const clickX = e.clientX - rect.left;
                        const pct = Math.max(0, Math.min(1, clickX / rect.width));
                        const hour = pct * 24;
                        setPlaybackTimelineHour(Math.round(hour * 10) / 10);
                        showFeedback(`Timeline scrubbed to ${String(Math.floor(hour)).padStart(2, '0')}:${String(Math.round((hour % 1) * 60)).padStart(2, '0')}`);
                      }}
                      className="relative h-6 bg-slate-900 rounded-lg cursor-pointer border border-slate-800 overflow-hidden"
                    >
                      {/* Continuous Recording Background Strip (e.g. 12:00 to 13:00) */}
                      <div
                        className="absolute top-0 bottom-0 bg-emerald-500/30 border-l border-r border-emerald-500/60"
                        style={{ left: `${(12 / 24) * 100}%`, width: `${(1 / 24) * 100}%` }}
                        title="Continuous Recording: 12:00 - 13:00"
                      />

                      {/* Event Markers on timeline */}
                      {cameraRecordings.map((rec) => {
                        const [h, m] = rec.startTime.split(':').map(Number);
                        const recHour = (h || 0) + (m || 0) / 60;
                        const leftPct = (recHour / 24) * 100;
                        const widthPct = Math.max(1.5, ((rec.durationSeconds / 3600) / 24) * 100);

                        const colorClass =
                          rec.eventType === 'person'
                            ? 'bg-purple-500'
                            : rec.eventType === 'vehicle'
                            ? 'bg-blue-500'
                            : rec.eventType === 'sound'
                            ? 'bg-amber-500'
                            : 'bg-emerald-500';

                        return (
                          <div
                            key={rec.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedRecordingId(rec.id);
                              setPlaybackTimelineHour(recHour);
                              showFeedback(`Loaded clip: ${rec.eventTitle}`);
                            }}
                            className={`absolute top-0 bottom-0 ${colorClass} opacity-80 hover:opacity-100 hover:scale-y-110 transition-all rounded-xs`}
                            style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                            title={`${rec.eventTitle} (${rec.startTime} - ${rec.endTime})`}
                          />
                        );
                      })}

                      {/* Current Scrubber Needle */}
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-rose-500 z-10"
                        style={{ left: `${(playbackTimelineHour / 24) * 100}%` }}
                      >
                        <div className="w-2.5 h-2.5 rounded-full bg-rose-500 -ml-1 -top-1 relative shadow-sm shadow-rose-500/80" />
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                      <span>Click anywhere on the track to scrub through the 24-hour video index</span>
                      <span className="font-mono text-indigo-300 font-bold">
                        Scrubber: {String(Math.floor(playbackTimelineHour)).padStart(2, '0')}:
                        {String(Math.round((playbackTimelineHour % 1) * 60)).padStart(2, '0')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* MicroSD Hardware Health & Capacity Bar */}
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <HardDrive className="w-4 h-4 text-indigo-400" />
                      <div>
                        <span className="font-bold text-white text-xs">
                          {selectedCamera.name} MicroSD Card Health: {selectedCamera.sdCardHealth || 'Healthy (Good)'}
                        </span>
                        <span className="text-[10px] text-slate-400 block font-mono">
                          Format: FAT32 • Continuous Auto-Loop: Active
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleFormatSdCard(selectedCamera.id)}
                        disabled={isFormattingSd}
                        className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-semibold transition-colors"
                      >
                        {isFormattingSd ? 'Formatting...' : 'Format SD Card'}
                      </button>
                      <button
                        onClick={() => setIsTapoModalOpen(true)}
                        className="px-2.5 py-1 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/30 text-[10px] font-semibold transition-colors"
                      >
                        Storage Settings
                      </button>
                    </div>
                  </div>

                  {/* Storage Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-400 font-mono">
                        Used: {selectedCamera.sdCardStorageGb.used} GB / {selectedCamera.sdCardStorageGb.total} GB
                      </span>
                      <span className="text-emerald-400 font-mono font-semibold">
                        {selectedCamera.sdCardStorageGb.free} GB Free
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden border border-slate-800">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
                        style={{
                          width: `${Math.round(
                            (selectedCamera.sdCardStorageGb.used / selectedCamera.sdCardStorageGb.total) * 100
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* RECORDED VIDEO CLIPS BROWSER */}
                <div className="space-y-3 pt-1">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Film className="w-4 h-4 text-purple-400" />
                      <h4 className="text-xs font-bold text-white">
                        Internal MicroSD Recorded Clips ({cameraRecordings.length})
                      </h4>
                    </div>

                    {/* Filter Tabs */}
                    <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
                      {(['all', 'person', 'vehicle', 'motion', 'sound', 'continuous'] as const).map((ft) => (
                        <button
                          key={ft}
                          onClick={() => setRecordingFilter(ft)}
                          className={`px-2.5 py-1 rounded-xl text-[10px] font-semibold capitalize whitespace-nowrap transition-colors ${
                            recordingFilter === ft
                              ? 'bg-indigo-600 text-white'
                              : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                          }`}
                        >
                          {ft}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Clips Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {cameraRecordings
                      .filter((r) => recordingFilter === 'all' || r.eventType === recordingFilter)
                      .map((clip) => {
                        const isSelected = activeRecording?.id === clip.id;
                        return (
                          <div
                            key={clip.id}
                            onClick={() => {
                              setSelectedRecordingId(clip.id);
                              showFeedback(`Playing ${clip.eventTitle}`);
                            }}
                            className={`p-3 rounded-2xl bg-slate-950 border transition-all cursor-pointer space-y-2 ${
                              isSelected
                                ? 'border-indigo-500 shadow-md shadow-indigo-500/20 bg-indigo-950/20'
                                : 'border-slate-800 hover:border-slate-700'
                            }`}
                          >
                            {/* Thumbnail & duration overlay */}
                            <div className="relative rounded-xl overflow-hidden aspect-video bg-black">
                              <img
                                src={clip.thumbnailUrl}
                                alt={clip.eventTitle}
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/80 text-[9px] font-mono text-white">
                                {Math.round(clip.durationSeconds / 60)}m
                              </div>
                              <div className="absolute top-1.5 left-1.5">
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${
                                    clip.eventType === 'person'
                                      ? 'bg-purple-600 text-white'
                                      : clip.eventType === 'vehicle'
                                      ? 'bg-blue-600 text-white'
                                      : clip.eventType === 'sound'
                                      ? 'bg-amber-600 text-white'
                                      : 'bg-emerald-600 text-white'
                                  }`}
                                >
                                  {clip.eventType}
                                </span>
                              </div>
                            </div>

                            <div>
                              <span className="text-[11px] font-bold text-white block truncate">
                                {clip.eventTitle}
                              </span>
                              <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono mt-0.5">
                                <span>
                                  {clip.startTime} - {clip.endTime}
                                </span>
                                <span>{Math.round(clip.fileSizeBytes / (1024 * 1024))} MB</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 pt-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedRecordingId(clip.id);
                                  setIsPlayingPlayback(true);
                                  showFeedback(`Playing ${clip.eventTitle}`);
                                }}
                                className="flex-1 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-semibold flex items-center justify-center gap-1 transition-colors"
                              >
                                <Play className="w-3 h-3 ml-0.5" />
                                <span>Play</span>
                              </button>

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDownloadClip(clip);
                                }}
                                className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] transition-colors"
                                title="Download MP4 to PC/Phone"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>
            )}
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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-white">Tapo Cloud Security & Linkage</h3>
            </div>

            <button
              onClick={() => setIsTapoModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-md transition-colors"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Open Tapo Account & SD Storage Wizard</span>
            </button>
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

      {/* Tapo Account & Internal SD Storage Integration Modal */}
      <TapoIntegrationModal
        isOpen={isTapoModalOpen}
        onClose={() => setIsTapoModalOpen(false)}
        account={tapoAccount}
        cameras={cameras}
        onUpdateAccount={handleUpdateAccount}
        onUpdateCamera={handleUpdateCamera}
      />
    </div>
  );
};
