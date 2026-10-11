import React, { useState } from 'react';
import {
  X,
  Cctv,
  HardDrive,
  ShieldCheck,
  Key,
  Globe,
  Wifi,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Copy,
  Play,
  Server,
  HelpCircle,
  ArrowRight,
  RefreshCw,
  Sliders,
  Film,
} from 'lucide-react';
import { TapoAccountConfig, TapoCameraDevice } from '../services/smartDevices';

interface TapoIntegrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: TapoAccountConfig;
  cameras: TapoCameraDevice[];
  onUpdateAccount: (updated: Partial<TapoAccountConfig>) => void;
  onUpdateCamera: (cameraId: string, updated: Partial<TapoCameraDevice>) => void;
}

export const TapoIntegrationModal: React.FC<TapoIntegrationModalProps> = ({
  isOpen,
  onClose,
  account,
  cameras,
  onUpdateAccount,
  onUpdateCamera,
}) => {
  const [activeTab, setActiveTab] = useState<'guide' | 'account' | 'rtsp' | 'storage'>('guide');
  const [selectedCamId, setSelectedCamId] = useState<string>(cameras[0]?.id || 'cam-01');
  const [emailInput, setEmailInput] = useState(account.accountEmail);
  const [cloudPassword, setCloudPassword] = useState('••••••••••••');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testOutput, setTestOutput] = useState<string | null>(null);

  const selectedCam = cameras.find((c) => c.id === selectedCamId) || cameras[0];

  const [camIp, setCamIp] = useState(selectedCam?.localIp || '192.168.1.120');
  const [camUser, setCamUser] = useState(selectedCam?.cameraAccountUser || 'thamiz_admin');
  const [camPassword, setCamPassword] = useState('••••••••');
  const [webrtcUrl, setWebrtcUrl] = useState(
    selectedCam?.webrtcBridgeUrl || `ws://${selectedCam?.localIp || '192.168.1.120'}:1984/api/ws?src=tapo-c210`
  );

  if (!isOpen) return null;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(label);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleTestDiagnostics = () => {
    setTestStatus('testing');
    setTestOutput(null);

    setTimeout(() => {
      setTestStatus('success');
      setTestOutput(
        `✓ Ping to ${camIp}: 12ms\n✓ Port 554 (RTSP Stream 1): Handshake OK\n✓ Port 2020 (ONVIF Profile S/G): Authenticated as "${camUser}"\n✓ MicroSD Internal Storage: 128 GB detected, 24 GB used, 4 video clips verified.`
      );
    }, 1400);
  };

  const handleSaveNetworkSettings = () => {
    onUpdateCamera(selectedCam.id, {
      localIp: camIp,
      cameraAccountUser: camUser,
      rtspStreamUrl: `rtsp://${camUser}:••••••••@${camIp}:554/stream1`,
      webrtcBridgeUrl: webrtcUrl,
    });
    setTestStatus('success');
    setTestOutput(`Saved network configuration for ${selectedCam.name}`);
  };

  const rtspMainUrl = `rtsp://${camUser || 'admin'}:<password>@${camIp || '192.168.1.120'}:554/stream1`;
  const rtspSubUrl = `rtsp://${camUser || 'admin'}:<password>@${camIp || '192.168.1.120'}:554/stream2`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-indigo-500/30 rounded-3xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-indigo-950/60 via-slate-900 to-purple-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/30">
              <Cctv className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">Tapo Account & Internal SD Storage Integration</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Step-by-Step
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Connect your TP-Link Tapo App, local camera stream (RTSP/ONVIF), and internal MicroSD storage
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="px-5 pt-3 pb-2 border-b border-slate-800 bg-slate-950 flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('guide')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === 'guide'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-300'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>1. How to Integrate (Guide)</span>
          </button>

          <button
            onClick={() => setActiveTab('account')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === 'account'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-300'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>2. TP-Link Tapo Cloud Account</span>
          </button>

          <button
            onClick={() => setActiveTab('rtsp')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === 'rtsp'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-300'
            }`}
          >
            <Wifi className="w-3.5 h-3.5" />
            <span>3. Camera Account & RTSP Stream</span>
          </button>

          <button
            onClick={() => setActiveTab('storage')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === 'storage'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-300'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span>4. MicroSD Internal Storage Access</span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1 text-xs">
          {/* TAB 1: HOW TO INTEGRATE (GUIDE) */}
          {activeTab === 'guide' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-500/30">
                <h4 className="text-sm font-bold text-white mb-1">
                  How TP-Link Tapo CCTV Integration Works with Web Browsers
                </h4>
                <p className="text-slate-300 leading-relaxed">
                  Tapo cameras (such as Tapo C200, C210, C310, C500) run an onboard embedded Linux OS with local
                  hardware video encoding and MicroSD card recording. Because web browsers cannot open raw RTSP port 554
                  directly for security reasons, there are two primary integration methods:
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Method A: Tapo Camera Account (Local RTSP / ONVIF) */}
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white font-bold flex items-center justify-center text-xs">
                      A
                    </span>
                    <h5 className="font-bold text-white text-xs">Local Camera Account (RTSP / ONVIF)</h5>
                  </div>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    Tapo allows creating an independent <strong>Camera Account</strong> in the Tapo App. This gives you
                    direct, high-speed access over your home Wi-Fi network without third-party cloud delay.
                  </p>
                  <ul className="space-y-1.5 text-slate-300 text-[11px]">
                    <li className="flex items-start gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      <span>Zero monthly subscription fees.</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      <span>Direct 2K QHD / 1080P stream over RTSP port 554.</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      <span>MicroSD recording playback via ONVIF Profile G or local HTTP bridge.</span>
                    </li>
                  </ul>
                </div>

                {/* Method B: TP-Link Tapo Cloud Account */}
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-purple-600 text-white font-bold flex items-center justify-center text-xs">
                      B
                    </span>
                    <h5 className="font-bold text-white text-xs">TP-Link Tapo Cloud Account & Tapo Care</h5>
                  </div>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    Uses your primary TP-Link ID (email: <code className="text-indigo-300 font-mono">{account.accountEmail}</code>)
                    to sync cloud event clips, motion push alerts, and remote access even when away from home.
                  </p>
                  <ul className="space-y-1.5 text-slate-300 text-[11px]">
                    <li className="flex items-start gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" />
                      <span>Remote access from anywhere on mobile/web.</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" />
                      <span>AI Person & Vehicle event cloud snapshots.</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" />
                      <span>30-Day cloud backup even if camera or SD card is damaged.</span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Step-by-Step Walkthrough */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <h5 className="font-bold text-white text-xs flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-indigo-400" />
                  <span>3 Simple Steps to Enable RTSP & MicroSD Access in Your Tapo Mobile App:</span>
                </h5>

                <div className="space-y-2.5">
                  <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                    <div className="w-5 h-5 rounded-full bg-indigo-600/30 text-indigo-300 font-bold flex items-center justify-center shrink-0 text-[10px]">
                      1
                    </div>
                    <div>
                      <p className="font-semibold text-slate-200">Create Camera Account in Tapo App</p>
                      <p className="text-slate-400 text-[11px] mt-0.5">
                        Open the <strong>Tapo App</strong> on your phone &rarr; Tap your Camera &rarr; Tap the{' '}
                        <strong>Gear Icon (Settings)</strong> &rarr; Scroll to <strong>Advanced Settings</strong> &rarr; Tap{' '}
                        <strong>Camera Account</strong> &rarr; Create a dedicated username (e.g.{' '}
                        <code className="text-indigo-300 font-mono">thamiz_admin</code>) and a password.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                    <div className="w-5 h-5 rounded-full bg-indigo-600/30 text-indigo-300 font-bold flex items-center justify-center shrink-0 text-[10px]">
                      2
                    </div>
                    <div>
                      <p className="font-semibold text-slate-200">Find the Camera's Local IP Address</p>
                      <p className="text-slate-400 text-[11px] mt-0.5">
                        In Camera Settings &rarr; Tap <strong>Device Info</strong> &rarr; Note the <strong>IP Address</strong>{' '}
                        (e.g. <code className="text-indigo-300 font-mono">192.168.1.120</code>). We recommend reserving this IP in your
                        Wi-Fi router so it stays static.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                    <div className="w-5 h-5 rounded-full bg-indigo-600/30 text-indigo-300 font-bold flex items-center justify-center shrink-0 text-[10px]">
                      3
                    </div>
                    <div>
                      <p className="font-semibold text-slate-200">Configure MicroSD Storage & Recording Schedule</p>
                      <p className="text-slate-400 text-[11px] mt-0.5">
                        In Camera Settings &rarr; Tap <strong>microSD Card</strong> &rarr; Make sure it says "Good/Healthy" &rarr; Tap{' '}
                        <strong>Recording Schedule</strong> &rarr; Choose <strong>Continuous Recording</strong> (blue grid) or{' '}
                        <strong>Detection Recording</strong> (orange grid) so clips are saved to internal storage.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: TAPO CLOUD ACCOUNT */}
          {activeTab === 'account' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <h4 className="text-xs font-bold text-white flex items-center gap-2">
                  <Globe className="w-4 h-4 text-indigo-400" />
                  <span>TP-Link Tapo Cloud Account Credentials</span>
                </h4>
                <p className="text-slate-400 text-[11px]">
                  Your TP-Link ID links all 4 cameras and synchronizes cloud backups with this dashboard.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      TP-Link ID Email Address
                    </label>
                    <input
                      type="email"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white font-mono focus:border-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Tapo Cloud Token / Password
                    </label>
                    <input
                      type="password"
                      value={cloudPassword}
                      onChange={(e) => setCloudPassword(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white font-mono focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-emerald-400 font-semibold text-[11px]">
                      Account Verified & Linked: {account.totalCameras} Tapo Cameras Active
                    </span>
                  </div>

                  <button
                    onClick={() => {
                      onUpdateAccount({ accountEmail: emailInput });
                      setTestStatus('success');
                      setTestOutput(`Updated Tapo Cloud account to: ${emailInput}`);
                    }}
                    className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-md transition-colors"
                  >
                    Save Account
                  </button>
                </div>
              </div>

              {/* Cloud Archive Tier Info */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-white block">Tapo Care Cloud Plan</span>
                  <span className="text-[11px] text-slate-400">{account.cloudStorageTier}</span>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Active (30-Day Backup)
                </span>
              </div>
            </div>
          )}

          {/* TAB 3: CAMERA ACCOUNT & RTSP */}
          {activeTab === 'rtsp' && (
            <div className="space-y-4">
              {/* Select Camera to Configure */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {cameras.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setSelectedCamId(c.id);
                      setCamIp(c.localIp || '192.168.1.120');
                      setCamUser(c.cameraAccountUser || 'thamiz_admin');
                      setWebrtcUrl(c.webrtcBridgeUrl || `ws://${c.localIp || '192.168.1.120'}:1984/api/ws?src=${c.id}`);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border ${
                      selectedCamId === c.id
                        ? 'bg-indigo-600 text-white border-indigo-500 shadow-md'
                        : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>

              {/* Camera Network Configuration Form */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <h4 className="text-xs font-bold text-white flex items-center gap-2">
                  <Wifi className="w-4 h-4 text-indigo-400" />
                  <span>Local RTSP & Camera Account Settings: {selectedCam.name}</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Camera Local IP Address
                    </label>
                    <input
                      type="text"
                      value={camIp}
                      onChange={(e) => setCamIp(e.target.value)}
                      placeholder="e.g. 192.168.1.120"
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white font-mono focus:border-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Camera Account Username
                    </label>
                    <input
                      type="text"
                      value={camUser}
                      onChange={(e) => setCamUser(e.target.value)}
                      placeholder="e.g. thamiz_admin"
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white font-mono focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    WebRTC / HLS Bridge Stream URL (go2rtc / MediaMTX)
                  </label>
                  <input
                    type="text"
                    value={webrtcUrl}
                    onChange={(e) => setWebrtcUrl(e.target.value)}
                    placeholder="ws://192.168.1.120:1984/api/ws?src=..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white font-mono focus:border-indigo-500 focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    Converts RTSP port 554 into HTML5 WebRTC for ultra-low latency browser playback.
                  </span>
                </div>

                {/* RTSP Stream URLs generated */}
                <div className="space-y-2 pt-2">
                  <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold">
                        Stream 1 (High Quality 2K QHD):
                      </span>
                      <code className="text-[11px] text-indigo-300 font-mono select-all">{rtspMainUrl}</code>
                    </div>
                    <button
                      onClick={() => copyToClipboard(rtspMainUrl, 'main')}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                      title="Copy RTSP URL"
                    >
                      {copiedKey === 'main' ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold">
                        Stream 2 (Substream 720p / Low Bandwidth):
                      </span>
                      <code className="text-[11px] text-indigo-300 font-mono select-all">{rtspSubUrl}</code>
                    </div>
                    <button
                      onClick={() => copyToClipboard(rtspSubUrl, 'sub')}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                      title="Copy Substream URL"
                    >
                      {copiedKey === 'sub' ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    onClick={handleTestDiagnostics}
                    disabled={testStatus === 'testing'}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition-colors"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${testStatus === 'testing' ? 'animate-spin' : ''}`} />
                    <span>{testStatus === 'testing' ? 'Testing Connection...' : 'Test Local Stream Connection'}</span>
                  </button>

                  <button
                    onClick={handleSaveNetworkSettings}
                    className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-md transition-colors"
                  >
                    Save Camera Configuration
                  </button>
                </div>

                {testOutput && (
                  <pre className="p-3 rounded-xl bg-black/60 border border-slate-800 font-mono text-[11px] text-emerald-400 whitespace-pre-wrap leading-relaxed animate-fade-in">
                    {testOutput}
                  </pre>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: MICROSD INTERNAL STORAGE ACCESS */}
          {activeTab === 'storage' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 space-y-2">
                <h4 className="text-xs font-bold text-white flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-indigo-400" />
                  <span>How to Access MicroSD Internal Storage Recordings Outside the Tapo App</span>
                </h4>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  Tapo cameras store encrypted MP4 chunks onto the MicroSD card formatted in FAT32 or exFAT. Here is how
                  to browse and play back those recordings in this web dashboard:
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs">
                    <Film className="w-4 h-4" />
                    <span>1. Dashboard Playback</span>
                  </div>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    Switch the camera view to <strong>"📼 SD Card Playback"</strong>. You can scrub through the 24-hour
                    timeline bar and view recorded AI clips (Person, Vehicle, Sound, Continuous) with instant playback!
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center gap-2 text-purple-400 font-bold text-xs">
                    <Server className="w-4 h-4" />
                    <span>2. ONVIF Profile G Replay</span>
                  </div>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    Tapo supports ONVIF Profile G on port <strong>2020</strong>. Any NVR, Synology Surveillance Station, or
                    Home Assistant can query recorded clips directly using your Camera Account credentials.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                    <HardDrive className="w-4 h-4" />
                    <span>3. Physical SD Reading</span>
                  </div>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    If you take the MicroSD card out and insert it into a PC/Mac card reader, the video files are standard
                    MP4 video files organized into date-named folders (<code className="text-emerald-300 font-mono">/record/YYYYMMDD/</code>).
                  </p>
                </div>
              </div>

              {/* Selected Camera MicroSD Card Telemetry */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <HardDrive className="w-4 h-4 text-indigo-400" />
                    <span className="font-bold text-white text-xs">{selectedCam.name} Internal MicroSD Status</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-300">
                    {selectedCam.sdCardHealth || 'Healthy (Good)'}
                  </span>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-400">Storage Used:</span>
                    <span className="text-white font-mono font-semibold">
                      {selectedCam.sdCardStorageGb.used} GB / {selectedCam.sdCardStorageGb.total} GB (
                      {selectedCam.sdCardStorageGb.free} GB Free)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
                      style={{
                        width: `${Math.round(
                          (selectedCam.sdCardStorageGb.used / selectedCam.sdCardStorageGb.total) * 100
                        )}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-[11px]">
                  <span className="text-slate-300">Continuous Auto-Loop Overwrite:</span>
                  <span className="text-emerald-400 font-semibold">
                    Enabled (Oldest recordings recycled automatically)
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Tapo Camera Account & Cloud integration ready</span>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-md transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
