import React, { useState } from 'react';
import {
  Users,
  KeyRound,
  MapPin,
  Battery,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Plus,
  ShieldAlert,
  Compass,
  DollarSign,
  Heart,
  Send,
  Sparkles,
  Map as MapIcon,
  Radio,
  Phone,
  PhoneCall,
  Wifi,
  Smartphone,
  Volume2,
  Check,
  Zap,
  MessageSquare,
  ArrowRightLeft,
  HelpCircle,
  ExternalLink,
  Navigation,
  UserPlus,
  Edit3,
  Activity,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { FamilyGoogleMap } from '../maps/FamilyGoogleMap';
import { FamilyMemberModal } from '../FamilyMemberModal';
import { FamilyMember } from '../../types';

export const FamilyTrackerTab: React.FC = () => {
  const {
    user,
    role,
    familyMembers,
    addFamilyMember,
    updateFamilyMember,
    deleteFamilyMember,
    activationCodes,
    generateActivationCode,
    redeemActivationCode,
    reactivateActivationCode,
    triggerEmergencySos,
    clearEmergencySos,
    updateMemberAllowance,
    updateMemberLocation,
    startCall,
    connectedPeers,
    myDeviceId,
    myDeviceName,
    isRelayConnected,
    intercomMessages,
    sendIntercomPing,
    incomingSosAlert,
    dismissIncomingSosAlert,
  } = useApp();

  const [mapMode, setMapMode] = useState<'google' | 'radar'>('google');
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showRedeemModal, setShowRedeemModal] = useState(false);
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [selectedMemberToEdit, setSelectedMemberToEdit] = useState<FamilyMember | null>(null);
  const [generatedCode, setGeneratedCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [copiedCodeItem, setCopiedCodeItem] = useState<string | null>(null);

  // Form states for secondary redemption
  const [redeemInputCode, setRedeemInputCode] = useState('');
  const [redeemMemberName, setRedeemMemberName] = useState('');
  const [redeemRelationship, setRedeemRelationship] = useState('Spouse');
  const [redeemFeedback, setRedeemFeedback] = useState<{ success: boolean; message: string } | null>(null);

  // Allowance editing modal
  const [selectedMemberForAllowance, setSelectedMemberForAllowance] = useState<string | null>(null);
  const [newAllowance, setNewAllowance] = useState<number>(5000);

  // Intercom & Instance communication states
  const [intercomInput, setIntercomInput] = useState('');
  const [intercomNotice, setIntercomNotice] = useState<string | null>(null);
  const [showArchitectureModal, setShowArchitectureModal] = useState(false);
  const [copiedAppUrl, setCopiedAppUrl] = useState(false);

  const handleCreateCode = () => {
    const code = generateActivationCode('secondary');
    setGeneratedCode(code);
    setShowGenerateModal(true);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(generatedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopySpecificCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCodeItem(code);
    setTimeout(() => setCopiedCodeItem(null), 2000);
  };

  const handleRedeemCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 16);
    if (val.length <= 4) setRedeemInputCode(val);
    else if (val.length <= 8) setRedeemInputCode(`${val.slice(0, 4)}-${val.slice(4)}`);
    else if (val.length <= 12) setRedeemInputCode(`${val.slice(0, 4)}-${val.slice(4, 8)}-${val.slice(8)}`);
    else setRedeemInputCode(`${val.slice(0, 4)}-${val.slice(4, 8)}-${val.slice(8, 12)}-${val.slice(12, 16)}`);
  };

  const handleRedeemSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!redeemInputCode.trim() || !redeemMemberName.trim()) return;

    const res = redeemActivationCode(redeemInputCode, redeemMemberName, redeemRelationship);
    setRedeemFeedback(res);
    if (res.success) {
      setTimeout(() => {
        setShowRedeemModal(false);
        setRedeemFeedback(null);
        setRedeemInputCode('');
        setRedeemMemberName('');
      }, 1600);
    }
  };

  return (
    <div className="space-y-6 pb-28 pt-2">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/70 border border-slate-800 p-4 rounded-3xl">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Family Circle & Real-Time Tracking</h2>
              <p className="text-xs text-slate-400">
                Primary Oversight: <strong className="text-indigo-300 font-mono">{user.email}</strong>
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {role === 'primary' && (
            <>
              <button
                onClick={() => {
                  setSelectedMemberToEdit(null);
                  setIsMemberModalOpen(true);
                }}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white transition-colors shadow-md shadow-emerald-600/30"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>+ Add Family Member</span>
              </button>

              <button
                onClick={handleCreateCode}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-colors shadow-md shadow-indigo-600/30"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Generate 16-Digit Code</span>
              </button>
            </>
          )}

          <button
            onClick={() => setShowRedeemModal(true)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Join with 16-Digit Code</span>
          </button>
        </div>
      </div>

      {/* Remote Instance Emergency SOS Banner */}
      {incomingSosAlert && (
        <div className="p-4 rounded-3xl bg-rose-600/20 border-2 border-rose-500 flex items-center justify-between gap-3 animate-pulse shadow-lg shadow-rose-950">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-rose-600 text-white animate-bounce">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-rose-100">
                🚨 EMERGENCY SOS BROADCAST FROM {incomingSosAlert.fromName.toUpperCase()}
              </h4>
              <p className="text-xs text-rose-300">
                Remote device triggered a live SOS alert. Coordinates: {incomingSosAlert.location?.address || 'Live Location'}.
              </p>
            </div>
          </div>
          <button
            onClick={dismissIncomingSosAlert}
            className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shrink-0"
          >
            Acknowledge
          </button>
        </div>
      )}

      {/* Emergency Alert Banner (if any member has SOS active) */}
      {familyMembers.some((m) => m.emergencySosActive) && (
        <div className="p-4 rounded-3xl bg-rose-500/15 border-2 border-rose-500/50 flex items-center justify-between gap-3 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-rose-500 text-white">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-rose-200">EMERGENCY SOS ALERT ACTIVATED!</h4>
              <p className="text-xs text-rose-300">
                Immediate GPS telemetry dispatched to Primary ({user.email}). Check location details below.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Family Map & Radar HUD */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Real-Time Location & Geofencing
            </span>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              Live GPS Sync (25s)
            </span>
          </div>

          {/* Toggle between Google Maps & Radar HUD */}
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setMapMode('google')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-semibold transition-all ${
                mapMode === 'google'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <MapIcon className="w-3.5 h-3.5" />
              <span>Google Maps</span>
            </button>
            <button
              onClick={() => setMapMode('radar')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-semibold transition-all ${
                mapMode === 'radar'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Tactical Radar</span>
            </button>
          </div>
        </div>

        {mapMode === 'google' ? (
          <FamilyGoogleMap
            familyMembers={familyMembers}
            onTriggerSos={triggerEmergencySos}
            onClearSos={clearEmergencySos}
            onUpdateLocation={updateMemberLocation}
          />
        ) : (
          <div className="rounded-3xl border border-slate-800 bg-slate-900/90 overflow-hidden shadow-xl">
            <div className="p-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Tactical Radar HUD Telemetry
                </h3>
              </div>
              <span className="text-[11px] font-mono text-slate-400">GPS Interval: 25s auto-sync</span>
            </div>

            {/* Visual Map Canvas / Radar HUD */}
            <div className="relative h-64 sm:h-72 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/80 p-4 flex items-center justify-center overflow-hidden">
              <div className="absolute w-80 h-80 rounded-full border border-indigo-500/20" />
              <div className="absolute w-60 h-60 rounded-full border border-indigo-500/25" />
              <div className="absolute w-40 h-40 rounded-full border border-indigo-500/30" />
              <div className="absolute w-20 h-20 rounded-full border border-indigo-500/40" />
              <div className="absolute inset-0 bg-[radial-gradient(#6366f1_1px,transparent_1px)] [background-size:24px_24px] opacity-20" />

              <div className="absolute w-80 h-80 rounded-full border-r border-indigo-500/40 animate-spin [animation-duration:8s] pointer-events-none" />

              <div className="relative w-full h-full max-w-md">
                {familyMembers.map((member, idx) => {
                  const positions = [
                    { top: '35%', left: '46%' },
                    { top: '65%', left: '68%' },
                    { top: '22%', left: '25%' },
                    { top: '70%', left: '30%' },
                  ];
                  const pos = positions[idx % positions.length];

                  return (
                    <div
                      key={member.id}
                      className="absolute -translate-x-1/2 -translate-y-1/2 group cursor-pointer"
                      style={{ top: pos.top, left: pos.left }}
                    >
                      <div className="relative flex flex-col items-center">
                        <span
                          className={`absolute w-12 h-12 rounded-full -top-1 animate-ping ${
                            member.emergencySosActive
                              ? 'bg-rose-500/50'
                              : 'bg-indigo-500/20'
                          }`}
                        />

                        <div
                          className={`relative w-10 h-10 rounded-full border-2 overflow-hidden shadow-lg transition-transform group-hover:scale-110 ${
                            member.emergencySosActive
                              ? 'border-rose-500 ring-4 ring-rose-500/30'
                              : 'border-indigo-400 ring-2 ring-indigo-500/20'
                          }`}
                        >
                          <img
                            src={member.avatar}
                            alt={member.name}
                            className="w-full h-full object-cover"
                          />
                        </div>

                        <div className="mt-1.5 px-2 py-0.5 rounded-md bg-slate-950/90 border border-slate-700/80 text-[10px] font-semibold text-slate-200 whitespace-nowrap shadow-md">
                          {member.name.split(' ')[0]} ({member.liveLocation.batteryLevel}%)
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="absolute bottom-2 left-3 text-[10px] text-slate-400 bg-slate-950/80 px-2 py-1 rounded-md border border-slate-800">
                Geofence Zones: Home • School • Work • Transit
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Real-Time Multi-Device Intercom & Instance Sync Hub */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/30 p-5 rounded-3xl shadow-xl space-y-4">
        {/* Header & Status */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">Multi-Device Intercom & Instance Link</h3>
                <span
                  className={`inline-flex items-center gap-1.5 text-[10px] font-mono font-semibold px-2.5 py-0.5 rounded-full border ${
                    connectedPeers.length > 0
                      ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                      : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      connectedPeers.length > 0 ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'
                    }`}
                  />
                  {connectedPeers.length > 0
                    ? `${connectedPeers.length} Peer Instance(s) Online`
                    : 'Awaiting 2nd Instance'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Connected instances communicate via bidirectional WebSocket relay (
                <span className="text-indigo-300 font-mono">/ws/family-relay</span>) with sub-30ms latency.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowArchitectureModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-950/80 hover:bg-indigo-900 text-xs font-medium text-indigo-300 border border-indigo-800/60 transition-colors"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>How It Works</span>
            </button>
            <button
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                setCopiedAppUrl(true);
                setTimeout(() => setCopiedAppUrl(false), 2500);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 transition-colors"
            >
              {copiedAppUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedAppUrl ? 'URL Copied!' : 'Copy Link for 2nd Phone'}</span>
            </button>
          </div>
        </div>

        {/* Device Badges Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* This Instance */}
          <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
                <Smartphone className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-white">This Device</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono">
                    Current
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 truncate max-w-[180px]">{myDeviceName}</div>
              </div>
            </div>
            <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
              <Wifi className="w-3 h-3" />
              {isRelayConnected ? 'Connected' : 'Connecting...'}
            </span>
          </div>

          {/* Peer Instance(s) */}
          <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div
                className={`p-2 rounded-xl ${
                  connectedPeers.length > 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-500'
                }`}
              >
                <Radio className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-white">Remote Peer Devices</span>
                  <span className="text-[10px] font-mono text-slate-400">({connectedPeers.length})</span>
                </div>
                <div className="text-[11px] text-slate-400 truncate max-w-[180px]">
                  {connectedPeers.length > 0
                    ? connectedPeers.map((p) => p.deviceName).join(', ')
                    : 'Open in 2nd tab or phone to link'}
                </div>
              </div>
            </div>
            {connectedPeers.length > 0 ? (
              <span className="text-[10px] font-mono text-emerald-400 font-semibold flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Live Sync
              </span>
            ) : (
              <span className="text-[10px] font-mono text-amber-400">Waiting</span>
            )}
          </div>
        </div>

        {/* Walkie-Talkie & Instant Intercom Quick Actions */}
        <div className="space-y-2 pt-1">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                sendIntercomPing('⚡ Family Intercom Ping: Connected and listening in real time!');
                setIntercomNotice('Chime & Ping sent to connected instances!');
                setTimeout(() => setIntercomNotice(null), 3000);
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-all shadow-md shadow-indigo-600/20 active:scale-95"
            >
              <Zap className="w-3.5 h-3.5 text-yellow-300" />
              <span>⚡ Send Intercom Chime</span>
            </button>

            <button
              onClick={() => {
                sendIntercomPing('📢 Family Announcement: Dinner is ready at the table!');
                setIntercomNotice('Broadcast sent to all devices!');
                setTimeout(() => setIntercomNotice(null), 3000);
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 transition-colors"
            >
              <Volume2 className="w-3.5 h-3.5 text-indigo-400" />
              <span>Broadcast "Dinner Ready"</span>
            </button>

            <button
              onClick={() => {
                sendIntercomPing('📍 Live Check-in: Coordinates updated and synchronized with Family Circle.');
                setIntercomNotice('Check-in broadcasted to peer devices!');
                setTimeout(() => setIntercomNotice(null), 3000);
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 transition-colors"
            >
              <MapPin className="w-3.5 h-3.5 text-emerald-400" />
              <span>Share Live Check-in</span>
            </button>
          </div>

          {/* Custom Intercom Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!intercomInput.trim()) return;
              sendIntercomPing(intercomInput.trim());
              setIntercomInput('');
              setIntercomNotice('Message & audio chime dispatched to peer device!');
              setTimeout(() => setIntercomNotice(null), 3000);
            }}
            className="flex items-center gap-2 pt-1"
          >
            <input
              type="text"
              value={intercomInput}
              onChange={(e) => setIntercomInput(e.target.value)}
              placeholder="Type instant intercom message to 2nd phone..."
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
            <button
              type="submit"
              disabled={!intercomInput.trim()}
              className="flex items-center gap-1 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-xs font-semibold text-white transition-all shadow-md shadow-indigo-600/30"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send</span>
            </button>
          </form>

          {intercomNotice && (
            <div className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{intercomNotice}</span>
            </div>
          )}
        </div>

        {/* Live Intercom Messages Feed */}
        {intercomMessages.length > 0 && (
          <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
            <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
              <span className="font-semibold uppercase tracking-wider text-[10px]">
                Recent Inter-Instance Transmissions
              </span>
              <span className="font-mono text-[10px]">{intercomMessages.length} total</span>
            </div>
            <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
              {intercomMessages.slice(0, 5).map((msg) => (
                <div
                  key={msg.id}
                  className={`p-2.5 rounded-xl text-xs flex items-start justify-between gap-2 border ${
                    msg.fromDeviceId === myDeviceId
                      ? 'bg-slate-950/70 border-slate-800 text-slate-300'
                      : 'bg-indigo-950/40 border-indigo-500/40 text-indigo-100'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-medium shrink-0">
                      {msg.fromDeviceId === myDeviceId ? 'You (This Device)' : msg.fromName}
                    </span>
                    <span className="text-xs">{msg.text}</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500 shrink-0">{msg.timestamp}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Family Members Activity & Safety Cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Active Family Members ({familyMembers.length})
          </h3>
          {role === 'primary' && (
            <button
              onClick={() => {
                setSelectedMemberToEdit(null);
                setIsMemberModalOpen(true);
              }}
              className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-semibold"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Add Member</span>
            </button>
          )}
        </div>

        {familyMembers.map((member) => (
          <div
            key={member.id}
            className={`p-4 rounded-3xl border transition-all ${
              member.emergencySosActive
                ? 'bg-rose-950/30 border-rose-500/60'
                : 'bg-slate-900/80 border-slate-800'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start sm:items-center gap-3">
                <div className="relative shrink-0">
                  <img
                    src={member.avatar}
                    alt={member.name}
                    className="w-12 h-12 rounded-2xl object-cover border border-slate-700 shadow-md"
                  />
                  {role === 'primary' && (
                    <button
                      onClick={() => {
                        setSelectedMemberToEdit(member);
                        setIsMemberModalOpen(true);
                      }}
                      className="absolute -bottom-1 -right-1 p-1 rounded-full bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white border border-slate-700 transition-colors shadow"
                      title="Edit avatar & details"
                    >
                      <Edit3 className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-bold text-white text-sm">{member.name}</h4>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-medium border border-slate-700">
                      {member.relationship}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-medium">
                      {member.role === 'primary' ? 'Primary' : 'Secondary'}
                    </span>
                    {role === 'primary' && (
                      <button
                        onClick={() => {
                          setSelectedMemberToEdit(member);
                          setIsMemberModalOpen(true);
                        }}
                        className="p-1 rounded-md bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white transition-colors"
                        title="Edit Personal Details"
                      >
                        <Edit3 className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {/* Personal Contact & Medical Details */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400 mt-1">
                    {member.phone && (
                      <span className="flex items-center gap-1 text-slate-300 font-mono text-[11px]">
                        <Phone className="w-3 h-3 text-emerald-400" />
                        {member.phone}
                      </span>
                    )}
                    {member.email && (
                      <span className="text-slate-400 text-[11px]">
                        {member.email}
                      </span>
                    )}
                    {member.bloodGroup && (
                      <span className="px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-300 border border-rose-500/30 text-[10px] font-semibold">
                        🩸 {member.bloodGroup}
                      </span>
                    )}
                    {member.medicalNotes && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px]">
                        💊 {member.medicalNotes}
                      </span>
                    )}
                    {member.emergencyContact && (
                      <span className="text-[10px] text-rose-400 font-mono">
                        🚨 ICE: {member.emergencyContact}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                    <MapPin className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    <span className="text-slate-300">{member.liveLocation.address}</span>
                  </div>

                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Mood: <span className="text-slate-200">{member.todayMood}</span> • Coordinates:{' '}
                    <span className="font-mono text-[10px] text-slate-500">
                      {member.liveLocation.lat}, {member.liveLocation.lng}
                    </span>
                  </p>
                </div>
              </div>

              {/* Right Vitals & Controls */}
              <div className="flex sm:flex-col items-center sm:items-end justify-between border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-800 gap-2">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 text-xs text-slate-300 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800">
                    <Battery className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{member.liveLocation.batteryLevel}%</span>
                  </div>

                  <span className={`text-[10px] font-semibold px-2 py-1 rounded-lg ${
                    member.emergencySosActive
                      ? 'bg-rose-500 text-white font-bold animate-pulse'
                      : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  }`}>
                    {member.liveLocation.status}
                  </span>
                </div>

                {/* Financial Oversight: Allowance */}
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <span>Allowance: </span>
                  <strong className="text-white font-mono">${member.allowanceMonthly}/mo</strong>
                  <span className="text-slate-500">(${member.monthlySpent} spent)</span>
                </div>

                {/* Calling, Navigation, Edit & SOS Trigger */}
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  {role === 'primary' && (
                    <button
                      onClick={() => {
                        setSelectedMemberToEdit(member);
                        setIsMemberModalOpen(true);
                      }}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600/30 hover:bg-indigo-600 text-indigo-200 hover:text-white border border-indigo-500/40 text-[11px] font-medium transition-colors"
                      title="Edit personal details"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>Edit Details</span>
                    </button>
                  )}

                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${member.liveLocation.lat},${member.liveLocation.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-semibold transition-colors shadow-sm"
                    title={`Get Google Maps directions to ${member.name}`}
                  >
                    <Navigation className="w-3 h-3" />
                    <span>Navigate</span>
                  </a>

                  <button
                    onClick={() => {
                      const phone = member.phone || (member.relationship.includes('Spouse')
                        ? '+91 96779 01342'
                        : '+44 7721 877710');
                      startCall({ name: member.name, phone, avatar: member.avatar, relationship: member.relationship }, false);
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold transition-colors shadow-sm"
                    title={`Call ${member.name} directly`}
                  >
                    <PhoneCall className="w-3 h-3" />
                    <span>Call</span>
                  </button>

                  <a
                    href={`tel:${(member.phone || (member.relationship.includes('Spouse') ? '+919677901342' : '+447721877710')).replace(/\s+/g, '')}`}
                    className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 hover:text-white transition-colors border border-slate-700"
                    title="Direct cellular call"
                  >
                    <Phone className="w-3.5 h-3.5" />
                  </a>

                  {member.emergencySosActive ? (
                    <button
                      onClick={() => clearEmergencySos(member.id)}
                      className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold transition-colors"
                    >
                      Clear SOS
                    </button>
                  ) : (
                    <button
                      onClick={() => triggerEmergencySos(member.id)}
                      className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-[11px] font-semibold transition-colors"
                    >
                      Simulate SOS
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 16-Digit Activation Codes Management (Google standard security) */}
      <div className="p-4 sm:p-5 rounded-3xl bg-slate-900/80 border border-slate-800">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">16-Digit Family Activation System</h3>
              <p className="text-xs text-slate-400">
                Primary sends 16-digit activation code to authorize secondary family members
              </p>
            </div>
          </div>

          {role === 'primary' && (
            <button
              onClick={handleCreateCode}
              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors"
            >
              + New Code
            </button>
          )}
        </div>

        <div className="space-y-2">
          {activationCodes.map((codeItem) => (
            <div
              key={codeItem.code}
              className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
            >
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-sm font-bold tracking-wider text-indigo-300">
                  {codeItem.code}
                </span>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  codeItem.status === 'redeemed'
                    ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                }`}>
                  {codeItem.status === 'active' ? 'ACTIVE & READY' : 'REDEEMED'}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-[11px] text-slate-400">
                  {codeItem.status === 'redeemed' ? (
                    <span>Used by: <strong className="text-slate-200">{codeItem.redeemedBy || 'Family Member'}</strong></span>
                  ) : (
                    <span>Expires: {codeItem.expiresAt}</span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => handleCopySpecificCode(codeItem.code)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] transition-colors"
                    title="Copy 16-digit code"
                  >
                    {copiedCodeItem === codeItem.code ? (
                      <>
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-400 font-medium">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>

                  {codeItem.status === 'redeemed' && role === 'primary' && (
                    <button
                      onClick={() => reactivateActivationCode(codeItem.code)}
                      className="px-2 py-1 rounded-lg bg-indigo-950/60 hover:bg-indigo-900 border border-indigo-700/50 text-indigo-300 text-[11px] font-medium transition-colors"
                      title="Make this code reusable again"
                    >
                      Reactivate
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setRedeemInputCode(codeItem.code);
                      setShowRedeemModal(true);
                    }}
                    className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-[11px] transition-colors"
                  >
                    Use
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* MODAL: Generate Code */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4">
          <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-6 text-center shadow-2xl">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-4">
              <KeyRound className="w-6 h-6" />
            </div>

            <h3 className="text-base font-bold text-white">16-Digit Family Activation Code</h3>
            <p className="text-xs text-slate-400 mt-1 mb-4">
              Share this secure code with your spouse, child, or parent. They can enter it on the login screen or under Family Tracker to join with Secondary privileges. Synced across all devices!
            </p>

            <div className="p-4 rounded-2xl bg-slate-950 border border-indigo-500/40 text-center mb-4">
              <div className="font-mono text-xl font-bold tracking-widest text-indigo-300 select-all">
                {generatedCode}
              </div>
              <span className="text-[10px] text-emerald-400 mt-1.5 inline-block font-medium">
                ✓ Active and synced to server
              </span>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleCopyCode}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white flex items-center justify-center gap-1.5 transition-colors shadow-md shadow-indigo-600/30"
              >
                {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Copied to Clipboard!' : 'Copy Code'}</span>
              </button>
              <button
                onClick={() => {
                  setRedeemInputCode(generatedCode);
                  setShowGenerateModal(false);
                  setShowRedeemModal(true);
                }}
                className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-indigo-300 transition-colors font-medium"
              >
                Test Redeem
              </button>
              <button
                onClick={() => setShowGenerateModal(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Redeem Code (Secondary Join) */}
      {showRedeemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4">
          <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white">Join Family with 16-Digit Code</h3>
            <p className="text-xs text-slate-400 mt-1 mb-4">
              Enter the activation code sent from Primary owner (<span className="text-indigo-300">{user.email}</span>).
            </p>

            <form onSubmit={handleRedeemSubmit} className="space-y-3.5">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-slate-300 font-medium">16-Digit Activation Code</label>
                  {activationCodes.length > 0 && (
                    <span className="text-[10px] text-slate-400">
                      {activationCodes.filter((c) => c.status === 'active').length} active code(s)
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  placeholder="XXXX-XXXX-XXXX-XXXX"
                  value={redeemInputCode}
                  onChange={handleRedeemCodeChange}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white font-mono tracking-wider focus:outline-none focus:border-indigo-500"
                />

                {/* Quick Selection Chips */}
                {activationCodes.length > 0 && (
                  <div className="mt-2 p-2 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1">
                    <span className="text-[10px] text-slate-400 block font-medium">
                      Tap any verified code to auto-fill:
                    </span>
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                      {activationCodes.map((c) => (
                        <button
                          key={c.code}
                          type="button"
                          onClick={() => setRedeemInputCode(c.code)}
                          className={`text-[11px] font-mono px-2 py-0.5 rounded-lg border transition-all ${
                            redeemInputCode === c.code
                              ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                              : c.status === 'active'
                              ? 'bg-indigo-950/60 border-indigo-700/50 text-indigo-300 hover:bg-indigo-900'
                              : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-300'
                          }`}
                        >
                          {c.code} {c.status === 'active' ? '✓' : '(re-link)'}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs text-slate-300 block mb-1">Your Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. Priyan"
                  value={redeemMemberName}
                  onChange={(e) => setRedeemMemberName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 block mb-1">Family Relationship</label>
                <select
                  value={redeemRelationship}
                  onChange={(e) => setRedeemRelationship(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="Spouse">Spouse</option>
                  <option value="Eldest Son">Eldest Son</option>
                  <option value="Daughter">Daughter</option>
                  <option value="Parent">Parent</option>
                </select>
              </div>

              {redeemFeedback && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                    redeemFeedback.success
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  }`}
                >
                  {redeemFeedback.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  )}
                  <span>{redeemFeedback.message}</span>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRedeemModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!redeemInputCode.trim() || !redeemMemberName.trim()}
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-xs font-semibold text-white transition-colors shadow-md shadow-indigo-600/30"
                >
                  Verify & Join
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* How Two Instances Talk Architecture Modal */}
      {showArchitectureModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400">
                  <ArrowRightLeft className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">How Two App Instances Talk</h3>
                  <p className="text-xs text-slate-400">Real-Time Multi-Device Intercom & Synchronization Architecture</p>
                </div>
              </div>
              <button
                onClick={() => setShowArchitectureModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              {/* Pillar 1 */}
              <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-1">
                <div className="flex items-center gap-2 text-indigo-400 font-bold">
                  <Radio className="w-4 h-4" />
                  <span>1. Real-Time WebSocket Relay (/ws/family-relay)</span>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  Every running instance connects to the centralized WebSocket relay. When Phone A clicks "⚡ Send Intercom Chime" or triggers an SOS, the server broadcasts the event to Phone B in under 30 milliseconds with audio feedback.
                </p>
              </div>

              {/* Pillar 2 */}
              <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-1">
                <div className="flex items-center gap-2 text-emerald-400 font-bold">
                  <KeyRound className="w-4 h-4" />
                  <span>2. 16-Digit Family Code Handshake</span>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  The primary head generates a 16-digit cryptographic pairing code (e.g., <code className="text-emerald-300 font-mono">AURA-9821-4412-8801</code>). The secondary phone inputs this code to join the same private family circle room without sharing personal passwords.
                </p>
              </div>

              {/* Pillar 3 */}
              <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-1">
                <div className="flex items-center gap-2 text-sky-400 font-bold">
                  <PhoneCall className="w-4 h-4" />
                  <span>3. WebRTC Direct P2P Media Streaming</span>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  For walkie-talkie voice calls and live camera streaming, the WebSocket server acts as the signaling channel (swapping SDP offers/ICE candidates), establishing an encrypted direct peer-to-peer connection between devices.
                </p>
              </div>

              {/* Pillar 4 */}
              <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-1">
                <div className="flex items-center gap-2 text-amber-400 font-bold">
                  <Sparkles className="w-4 h-4" />
                  <span>4. Cloud Database & Offline Reconciliation</span>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  Persistent data (tasks, allowances, budget goals, memories) synchronizes to Cloud Firestore and the server database so if one device is offline or powered down, changes sync automatically once it reconnects.
                </p>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => setShowArchitectureModal(false)}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-semibold text-white text-xs transition-colors"
              >
                Got It, Return to Family Hub
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Family Member Add & Update Modal */}
      <FamilyMemberModal
        isOpen={isMemberModalOpen}
        onClose={() => {
          setIsMemberModalOpen(false);
          setSelectedMemberToEdit(null);
        }}
        memberToEdit={selectedMemberToEdit}
        isPrimaryHead={role === 'primary'}
        onSaveMember={async (memberData) => {
          if (selectedMemberToEdit) {
            await updateFamilyMember(selectedMemberToEdit.id, memberData);
          } else {
            await addFamilyMember(memberData);
          }
          setIsMemberModalOpen(false);
          setSelectedMemberToEdit(null);
        }}
        onDeleteMember={
          selectedMemberToEdit
            ? async (id) => {
                await deleteFamilyMember(id);
                setIsMemberModalOpen(false);
                setSelectedMemberToEdit(null);
              }
            : undefined
        }
      />
    </div>
  );
};
