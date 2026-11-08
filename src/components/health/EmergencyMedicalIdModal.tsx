import React, { useState } from 'react';
import {
  ShieldAlert,
  X,
  Phone,
  Heart,
  AlertTriangle,
  Pill,
  Activity,
  User,
  Share2,
  Check,
  Stethoscope,
  Building,
  QrCode,
  Calendar,
} from 'lucide-react';
import { FamilyHealthRecord } from '../../types/healthRecord';

interface EmergencyMedicalIdModalProps {
  record: FamilyHealthRecord;
  isOpen: boolean;
  onClose: () => void;
}

export const EmergencyMedicalIdModal: React.FC<EmergencyMedicalIdModalProps> = ({
  record,
  isOpen,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);

  if (!isOpen) return null;

  const handleShareSummary = () => {
    const summary = `🚨 EMERGENCY MEDICAL ID: ${record.memberName.toUpperCase()}
• Blood Type: ${record.bloodGroup}
• Age: ${record.age || 'N/A'} (DOB: ${record.dateOfBirth || 'N/A'})
• Emergency Contact: ${record.emergencyContact.name} (${record.emergencyContact.relationship}) - ${record.emergencyContact.phone}
• Primary Doctor: ${record.primaryDoctor?.name || 'N/A'} - ${record.primaryDoctor?.phone || 'N/A'}
• Allergies: ${record.allergies.map((a) => `${a.allergen} (${a.severity})`).join(', ') || 'None known'}
• Conditions: ${record.conditions.map((c) => c.name).join(', ') || 'None'}
• Active Meds: ${record.medications.map((m) => `${m.drugName} ${m.dosage}`).join(', ') || 'None'}
• Organ Donor: ${record.organDonor ? 'YES' : 'NO'}`;

    if (navigator.clipboard) {
      void navigator.clipboard.writeText(summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-lg max-h-[92vh] flex flex-col bg-slate-900 border-2 border-rose-500/50 rounded-3xl overflow-hidden shadow-2xl shadow-rose-950/40">
        {/* Header Bar */}
        <div className="p-4 bg-gradient-to-r from-rose-950 via-slate-900 to-rose-950/80 border-b border-rose-500/30 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rose-600 text-white shadow-lg shadow-rose-600/40 animate-pulse">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">EMERGENCY MEDICAL ID</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 uppercase">
                  First Responder View
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Immediate access medical profile for {record.memberName}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable ID Card Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Member Banner with Blood Type Badge */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {record.avatar ? (
                <img
                  src={record.avatar}
                  alt={record.memberName}
                  className="w-14 h-14 rounded-2xl object-cover border-2 border-rose-500/40"
                />
              ) : (
                <div className="w-14 h-14 rounded-2xl bg-rose-950/80 border-2 border-rose-500/40 flex items-center justify-center text-rose-300">
                  <User className="w-7 h-7" />
                </div>
              )}
              <div>
                <h3 className="text-lg font-bold text-white leading-tight">{record.memberName}</h3>
                <p className="text-xs text-slate-400">{record.relationship} • {record.age ? `${record.age} Years` : 'Age N/A'}</p>
                {record.dateOfBirth && (
                  <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    <span>DOB: {record.dateOfBirth}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Prominent Blood Group Emblem */}
            <div className="flex flex-col items-center justify-center px-4 py-2.5 rounded-2xl bg-gradient-to-br from-rose-600 to-rose-700 text-white shadow-lg shadow-rose-700/30 border border-rose-400/30">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-200">Blood Type</span>
              <span className="text-2xl font-black font-mono tracking-tight">{record.bloodGroup}</span>
            </div>
          </div>

          {/* Emergency Contacts - Priority 1 */}
          <div className="p-4 rounded-2xl bg-rose-950/20 border border-rose-500/30 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-rose-400" />
                In Case of Emergency (ICE)
              </span>
              <span className="text-[10px] text-slate-400">Primary Contact</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/80 border border-rose-500/20 flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-white">{record.emergencyContact.name}</div>
                <div className="text-xs text-slate-400">{record.emergencyContact.relationship}</div>
              </div>
              <a
                href={`tel:${record.emergencyContact.phone}`}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md shadow-rose-600/30 transition-all"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>Call ICE</span>
              </a>
            </div>
          </div>

          {/* Allergies & Reactions - Critical Alerts */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                Allergies & Contraindications ({record.allergies.length})
              </span>
            </div>

            {record.allergies.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No known medication, food, or environmental allergies recorded.</p>
            ) : (
              <div className="space-y-1.5">
                {record.allergies.map((alg) => (
                  <div
                    key={alg.id}
                    className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${
                      alg.severity === 'severe' || alg.severity === 'anaphylaxis'
                        ? 'bg-rose-950/40 border-rose-500/40 text-rose-200'
                        : 'bg-amber-950/30 border-amber-500/30 text-amber-200'
                    }`}
                  >
                    <div>
                      <span className="font-bold">{alg.allergen}</span>
                      <span className="text-[10px] opacity-75 ml-2">({alg.category})</span>
                      {alg.reaction && <p className="text-[11px] opacity-80 mt-0.5">Reaction: {alg.reaction}</p>}
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border">
                      {alg.severity}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Active Medications */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2.5">
            <span className="text-xs font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
              <Pill className="w-3.5 h-3.5 text-sky-400" />
              Active Prescriptions & Dosages ({record.medications.length})
            </span>

            {record.medications.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No daily active medications recorded.</p>
            ) : (
              <div className="space-y-1.5">
                {record.medications.map((med) => (
                  <div
                    key={med.id}
                    className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-bold text-white">{med.drugName}</span>
                      <span className="text-slate-400 ml-1.5 font-mono">{med.dosage}</span>
                      <p className="text-[11px] text-slate-400 mt-0.5">{med.frequency} • {med.purpose}</p>
                    </div>
                    <div className="flex gap-1">
                      {med.timeSlots.map((ts) => (
                        <span key={ts} className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[9px] uppercase font-mono">
                          {ts.slice(0, 3)}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Chronic Diagnoses & Conditions */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2.5">
            <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-indigo-400" />
              Diagnosed Medical Conditions ({record.conditions.length})
            </span>

            {record.conditions.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No chronic medical diagnoses noted.</p>
            ) : (
              <div className="space-y-1.5">
                {record.conditions.map((c) => (
                  <div key={c.id} className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white">{c.name}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 uppercase">
                        {c.status}
                      </span>
                    </div>
                    {c.carePlanNotes && <p className="text-[11px] text-slate-400 mt-1">{c.carePlanNotes}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Primary Doctor & Insurance */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {record.primaryDoctor && (
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                  <Stethoscope className="w-3 h-3 text-emerald-400" /> Primary Doctor
                </span>
                <p className="font-bold text-white">{record.primaryDoctor.name}</p>
                <p className="text-[11px] text-slate-400">{record.primaryDoctor.clinic}</p>
                <a
                  href={`tel:${record.primaryDoctor.phone}`}
                  className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-bold hover:underline mt-1"
                >
                  <Phone className="w-3 h-3" /> {record.primaryDoctor.phone}
                </a>
              </div>
            )}

            {record.insurance && (
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                  <Building className="w-3 h-3 text-purple-400" /> Health Insurance
                </span>
                <p className="font-bold text-white">{record.insurance.provider}</p>
                <p className="text-[11px] text-slate-400 font-mono">Policy: {record.insurance.policyNumber}</p>
                {record.insurance.validThru && (
                  <p className="text-[10px] text-slate-500">Valid: {record.insurance.validThru}</p>
                )}
              </div>
            )}
          </div>

          {/* Organ Donor & Vitals Summary */}
          <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Heart className="w-4 h-4 text-rose-400" />
              <span className="text-slate-300">Registered Organ Donor:</span>
            </div>
            <span
              className={`px-2.5 py-1 rounded-full text-[10px] font-bold font-mono border ${
                record.organDonor
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
            >
              {record.organDonor ? 'YES - LIFE SAVER' : 'NO'}
            </span>
          </div>

          {/* Simulated QR Code for First Responders */}
          {showQr && (
            <div className="p-4 rounded-2xl bg-white text-slate-900 text-center space-y-2 animate-fade-in">
              <p className="text-xs font-bold">First Responder Digital Medical Pass</p>
              <div className="w-36 h-36 mx-auto bg-slate-100 border-2 border-slate-300 rounded-xl flex items-center justify-center p-2">
                <QrCode className="w-28 h-28 text-slate-900" />
              </div>
              <p className="text-[10px] text-slate-600 font-mono">PASS-ID: MED-{record.memberId.toUpperCase()}-{record.bloodGroup.replace('+', 'POS').replace('-', 'NEG')}</p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-3">
          <button
            onClick={() => setShowQr(!showQr)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold border border-slate-700 transition-colors"
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>{showQr ? 'Hide QR' : 'Show Medical QR'}</span>
          </button>

          <button
            onClick={handleShareSummary}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-indigo-600 hover:from-rose-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-rose-600/25 transition-all"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
            <span>{copied ? 'Summary Copied!' : 'Copy Medical Summary'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
