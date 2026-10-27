import React, { useState, useEffect } from 'react';
import {
  X,
  UserPlus,
  Edit3,
  Heart,
  Phone,
  Mail,
  MapPin,
  Shield,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Activity,
  DollarSign,
  Camera,
  Sparkles,
} from 'lucide-react';
import { FamilyMember, UserRole } from '../types';

interface FamilyMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  memberToEdit?: FamilyMember | null;
  onSaveMember: (memberData: Partial<FamilyMember> & { name: string; relationship: string }) => Promise<void>;
  onDeleteMember?: (id: string) => Promise<void>;
  isPrimaryHead: boolean;
}

const PRESET_AVATARS = [
  { label: 'Husband / Primary', url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80' },
  { label: 'Spouse / Wife', url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80' },
  { label: 'Son / Youth', url: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80' },
  { label: 'Daughter', url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80' },
  { label: 'Elder / Parent', url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80' },
  { label: 'Grandmother', url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80' },
];

const RELATIONSHIP_OPTIONS = [
  'Self (Head)',
  'Spouse',
  'Eldest Son',
  'Younger Son',
  'Daughter',
  'Mother',
  'Father',
  'Brother',
  'Sister',
  'Grandfather',
  'Grandmother',
  'Relative / Guardian',
];

const BLOOD_GROUPS = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'Unknown'];

export const FamilyMemberModal: React.FC<FamilyMemberModalProps> = ({
  isOpen,
  onClose,
  memberToEdit,
  onSaveMember,
  onDeleteMember,
  isPrimaryHead,
}) => {
  const [name, setName] = useState('');
  const [relationship, setRelationship] = useState('Spouse');
  const [role, setRole] = useState<UserRole>('secondary');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [avatar, setAvatar] = useState(PRESET_AVATARS[0].url);
  const [allowanceMonthly, setAllowanceMonthly] = useState<number>(5000);
  const [bloodGroup, setBloodGroup] = useState('O+');
  const [medicalNotes, setMedicalNotes] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [address, setAddress] = useState('Innovation Campus, Anna Nagar, Chennai');
  const [todayMood, setTodayMood] = useState('Calm & Focused ✨');
  const [geofenceStatus, setGeofenceStatus] = useState<FamilyMember['geofenceStatus']>('home');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (memberToEdit) {
      setName(memberToEdit.name || '');
      setRelationship(memberToEdit.relationship || 'Spouse');
      setRole(memberToEdit.role || 'secondary');
      setEmail(memberToEdit.email || '');
      setPhone(memberToEdit.phone || '');
      setAvatar(memberToEdit.avatar || PRESET_AVATARS[0].url);
      setAllowanceMonthly(memberToEdit.allowanceMonthly || 5000);
      setBloodGroup(memberToEdit.bloodGroup || 'O+');
      setMedicalNotes(memberToEdit.medicalNotes || '');
      setEmergencyContact(memberToEdit.emergencyContact || '');
      setAddress(memberToEdit.liveLocation?.address || 'Innovation Campus, Anna Nagar, Chennai');
      setTodayMood(memberToEdit.todayMood || 'Calm & Focused ✨');
      setGeofenceStatus(memberToEdit.geofenceStatus || 'home');
    } else {
      setName('');
      setRelationship('Spouse');
      setRole('secondary');
      setEmail('');
      setPhone('+91 ');
      setAvatar(PRESET_AVATARS[1].url);
      setAllowanceMonthly(10000);
      setBloodGroup('O+');
      setMedicalNotes('');
      setEmergencyContact('+91 98408 05665');
      setAddress('Innovation Campus, Anna Nagar, Chennai');
      setTodayMood('Happy & Energized 🌟');
      setGeofenceStatus('home');
    }
    setConfirmDelete(false);
    setFeedback(null);
  }, [memberToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFeedback({ type: 'error', message: 'Family member name is required.' });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    try {
      await onSaveMember({
        ...(memberToEdit ? { id: memberToEdit.id } : {}),
        name: name.trim(),
        relationship,
        role,
        email: email.trim(),
        phone: phone.trim(),
        avatar,
        allowanceMonthly: Number(allowanceMonthly) || 0,
        bloodGroup,
        medicalNotes: medicalNotes.trim(),
        emergencyContact: emergencyContact.trim(),
        geofenceStatus,
        todayMood,
        liveLocation: {
          lat: memberToEdit?.liveLocation?.lat || 13.0827,
          lng: memberToEdit?.liveLocation?.lng || 80.2707,
          address: address.trim(),
          timestamp: 'Just now',
          batteryLevel: memberToEdit?.liveLocation?.batteryLevel || 95,
          status: 'Safe at Home',
        },
      });

      setFeedback({
        type: 'success',
        message: memberToEdit
          ? `Personal details for ${name} updated and synchronized across all instances.`
          : `${name} has been added to the Sovereign Family Circle.`,
      });

      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to save family member.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!memberToEdit || !onDeleteMember) return;
    setIsSubmitting(true);
    try {
      await onDeleteMember(memberToEdit.id);
      setFeedback({ type: 'success', message: `${memberToEdit.name} removed from Family Circle.` });
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to remove member.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-indigo-500/30 rounded-3xl w-full max-w-xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/30">
              {memberToEdit ? <Edit3 className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">
                  {memberToEdit ? 'Update Family Personal Details' : 'Add New Family Member'}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Primary Head Oversight
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Personal details, medical records, and geofence telemetry are encrypted & stored in SQLite.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4">
          {/* Avatar Preview & Quick Picker */}
          <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2.5">
            <label className="block text-xs font-semibold text-slate-300">
              Profile Photo & Avatar
            </label>
            <div className="flex items-center gap-3">
              <img
                src={avatar}
                alt="Selected Avatar"
                className="w-14 h-14 rounded-2xl object-cover border-2 border-indigo-500 shadow-md shrink-0"
              />
              <div className="flex-1">
                <span className="text-[11px] text-slate-400 block mb-1">
                  Choose preset or enter custom image URL:
                </span>
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  {PRESET_AVATARS.map((preset, idx) => (
                    <button
                      type="button"
                      key={idx}
                      onClick={() => setAvatar(preset.url)}
                      className={`relative w-8 h-8 rounded-xl overflow-hidden border-2 transition-transform shrink-0 ${
                        avatar === preset.url ? 'border-indigo-500 scale-110' : 'border-slate-800 hover:border-slate-600'
                      }`}
                      title={preset.label}
                    >
                      <img src={preset.url} alt={preset.label} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <input
              type="text"
              value={avatar}
              onChange={(e) => setAvatar(e.target.value)}
              placeholder="https://..."
              className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-300 font-mono focus:border-indigo-500 focus:outline-none"
            />
          </div>

          {/* Basic Identity Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Full Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Selvapriya Thamizh"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-indigo-500 text-xs text-white placeholder-slate-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Relationship
              </label>
              <select
                value={relationship}
                onChange={(e) => setRelationship(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-indigo-500 text-xs text-white focus:outline-none"
              >
                {RELATIONSHIP_OPTIONS.map((rel) => (
                  <option key={rel} value={rel} className="bg-slate-900 text-white">
                    {rel}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Contact Details: Phone & Email */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Phone Number
              </label>
              <div className="relative">
                <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 96779 01342"
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 focus:border-indigo-500 text-xs text-white placeholder-slate-500 focus:outline-none font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@family.aura"
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 focus:border-indigo-500 text-xs text-white placeholder-slate-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Role & Monthly Allowance */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Circle Role
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-indigo-500 text-xs text-white focus:outline-none"
              >
                <option value="secondary" className="bg-slate-900 text-white">
                  Secondary Member (Full Circle Access)
                </option>
                <option value="primary" className="bg-slate-900 text-white">
                  Primary Head (Executive Master Admin)
                </option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Monthly Allowance ($ / ₹)
              </label>
              <div className="relative">
                <DollarSign className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                <input
                  type="number"
                  min="0"
                  step="500"
                  value={allowanceMonthly}
                  onChange={(e) => setAllowanceMonthly(Number(e.target.value))}
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 focus:border-indigo-500 text-xs text-white focus:outline-none font-mono"
                />
              </div>
            </div>
          </div>

          {/* Health & Medical Emergency Profile */}
          <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center gap-2 text-rose-300 font-semibold text-xs">
              <Activity className="w-4 h-4 text-rose-400" />
              <span>Medical & Emergency Health Telemetry</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Blood Group
                </label>
                <select
                  value={bloodGroup}
                  onChange={(e) => setBloodGroup(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none"
                >
                  {BLOOD_GROUPS.map((bg) => (
                    <option key={bg} value={bg} className="bg-slate-900 text-white">
                      {bg}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Emergency Contact Phone
                </label>
                <input
                  type="text"
                  value={emergencyContact}
                  onChange={(e) => setEmergencyContact(e.target.value)}
                  placeholder="+91 98408 05665"
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Medical Notes & Allergies (Confidential)
              </label>
              <textarea
                rows={2}
                value={medicalNotes}
                onChange={(e) => setMedicalNotes(e.target.value)}
                placeholder="e.g. Allergic to penicillin; daily vitamin D; youth sports certificate verified."
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none resize-none"
              />
            </div>
          </div>

          {/* Location & Safe Geofence Zone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Home / Campus Address
              </label>
              <div className="relative">
                <MapPin className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. Innovation Campus, Chennai"
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 focus:border-indigo-500 text-xs text-white placeholder-slate-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Primary Geofence Zone
              </label>
              <select
                value={geofenceStatus}
                onChange={(e) => setGeofenceStatus(e.target.value as any)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-indigo-500 text-xs text-white focus:outline-none capitalize"
              >
                <option value="home" className="bg-slate-900 text-white">Home Office (Anna Nagar)</option>
                <option value="work" className="bg-slate-900 text-white">Work Hub (T. Nagar)</option>
                <option value="school" className="bg-slate-900 text-white">Campus & Lab (IIT Madras)</option>
                <option value="transit" className="bg-slate-900 text-white">In Transit (Chennai Metro)</option>
              </select>
            </div>
          </div>

          {/* Feedback message */}
          {feedback && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                feedback.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              )}
              <span>{feedback.message}</span>
            </div>
          )}

          {/* Delete Danger Section (For existing member) */}
          {memberToEdit && onDeleteMember && (
            <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
              {!confirmDelete ? (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1.5 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remove Member from Family Circle</span>
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-rose-300">Confirm removal?</span>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={isSubmitting}
                    className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold"
                  >
                    Yes, Remove
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Footer Controls */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white shadow-md shadow-indigo-600/30 transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Saving to SQLite...' : memberToEdit ? 'Save Changes' : 'Add to Circle'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
