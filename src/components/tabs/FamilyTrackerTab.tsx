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
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { FamilyGoogleMap } from '../maps/FamilyGoogleMap';

export const FamilyTrackerTab: React.FC = () => {
  const {
    user,
    role,
    familyMembers,
    activationCodes,
    generateActivationCode,
    redeemActivationCode,
    triggerEmergencySos,
    clearEmergencySos,
    updateMemberAllowance,
    startCall,
  } = useApp();

  const [mapMode, setMapMode] = useState<'google' | 'radar'>('google');
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showRedeemModal, setShowRedeemModal] = useState(false);
  const [generatedCode, setGeneratedCode] = useState('');
  const [copied, setCopied] = useState(false);

  // Form states for secondary redemption
  const [redeemInputCode, setRedeemInputCode] = useState('');
  const [redeemMemberName, setRedeemMemberName] = useState('');
  const [redeemRelationship, setRedeemRelationship] = useState('Spouse');
  const [redeemFeedback, setRedeemFeedback] = useState<{ success: boolean; message: string } | null>(null);

  // Allowance editing modal
  const [selectedMemberForAllowance, setSelectedMemberForAllowance] = useState<string | null>(null);
  const [newAllowance, setNewAllowance] = useState<number>(5000);

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
        <div className="flex items-center gap-2">
          {role === 'primary' && (
            <button
              onClick={handleCreateCode}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-colors shadow-md shadow-indigo-600/30"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Generate 16-Digit Code</span>
            </button>
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

      {/* Family Members Activity & Safety Cards */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
          Active Family Members ({familyMembers.length})
        </h3>

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
              <div className="flex items-center gap-3">
                <img
                  src={member.avatar}
                  alt={member.name}
                  className="w-12 h-12 rounded-2xl object-cover border border-slate-700"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-white text-sm">{member.name}</h4>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-medium border border-slate-700">
                      {member.relationship}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-medium">
                      {member.role === 'primary' ? 'Primary' : 'Secondary'}
                    </span>
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

                {/* Calling & SOS Trigger */}
                <div className="flex items-center gap-1.5 mt-1">
                  <button
                    onClick={() => {
                      const phone = member.relationship.includes('Spouse')
                        ? '+91 96779 01342'
                        : '+44 7721 877710';
                      startCall({ name: member.name, phone, avatar: member.avatar, relationship: member.relationship }, false);
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold transition-colors shadow-sm"
                    title={`Call ${member.name} directly`}
                  >
                    <PhoneCall className="w-3 h-3" />
                    <span>Call</span>
                  </button>

                  <a
                    href={`tel:${member.relationship.includes('Spouse') ? '+919677901342' : '+447721877710'}`}
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
              className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
            >
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-sm font-bold tracking-wider text-indigo-300">
                  {codeItem.code}
                </span>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  codeItem.status === 'redeemed'
                    ? 'bg-slate-800 text-slate-400'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                }`}>
                  {codeItem.status.toUpperCase()}
                </span>
              </div>

              <div className="text-[11px] text-slate-400">
                {codeItem.status === 'redeemed' ? (
                  <span>Redeemed by: <strong className="text-slate-200">{codeItem.redeemedBy}</strong></span>
                ) : (
                  <span>Expires: {codeItem.expiresAt}</span>
                )}
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
              Share this secure code with your spouse, child, or parent. They can redeem it on their phone to join this Family Circle with Secondary privileges.
            </p>

            <div className="p-4 rounded-2xl bg-slate-950 border border-indigo-500/40 text-center mb-4">
              <div className="font-mono text-lg font-bold tracking-widest text-indigo-300 select-all">
                {generatedCode}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleCopyCode}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white flex items-center justify-center gap-1.5 transition-colors"
              >
                {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Copied to Clipboard!' : 'Copy Code'}</span>
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
                <label className="text-xs text-slate-300 block mb-1">16-Digit Activation Code</label>
                <input
                  type="text"
                  placeholder="e.g. 9021-4873-1129-8834"
                  value={redeemInputCode}
                  onChange={(e) => setRedeemInputCode(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                />
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
                  className={`p-3 rounded-xl text-xs ${
                    redeemFeedback.success
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  }`}
                >
                  {redeemFeedback.message}
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
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-colors"
                >
                  Verify & Join
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
