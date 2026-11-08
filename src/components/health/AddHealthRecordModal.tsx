import React, { useState, useRef } from 'react';
import {
  X,
  HeartPulse,
  Pill,
  AlertTriangle,
  Activity,
  Upload,
  FileText,
  Calendar,
  CheckCircle2,
  Sparkles,
  Camera,
} from 'lucide-react';
import { FamilyHealthRecord, HealthDocumentCategory } from '../../types/healthRecord';
import {
  addVitalSignToMember,
  addAllergyToMember,
  addMedicationToMember,
  uploadHealthDocument,
} from '../../services/healthRecordDriveSync';

interface AddHealthRecordModalProps {
  member: FamilyHealthRecord;
  isOpen: boolean;
  onClose: () => void;
  defaultMode?: 'vitals' | 'medication' | 'allergy' | 'condition' | 'document';
  onRecordUpdated: () => void;
}

export const AddHealthRecordModal: React.FC<AddHealthRecordModalProps> = ({
  member,
  isOpen,
  onClose,
  defaultMode = 'vitals',
  onRecordUpdated,
}) => {
  const [mode, setMode] = useState<'vitals' | 'medication' | 'allergy' | 'document'>(
    defaultMode === 'condition' ? 'vitals' : defaultMode
  );
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Vitals State
  const [systolicBp, setSystolicBp] = useState<string>('120');
  const [diastolicBp, setDiastolicBp] = useState<string>('80');
  const [heartRate, setHeartRate] = useState<string>('72');
  const [bloodGlucose, setBloodGlucose] = useState<string>('');
  const [glucoseContext, setGlucoseContext] = useState<'fasting' | 'post-meal' | 'random'>('fasting');
  const [oxygenSpO2, setOxygenSpO2] = useState<string>('98');
  const [bodyTemperature, setBodyTemperature] = useState<string>('98.6');
  const [weightKg, setWeightKg] = useState<string>(member.weightKg ? String(member.weightKg) : '70');
  const [sleepHours, setSleepHours] = useState<string>('7.5');
  const [sleepQuality, setSleepQuality] = useState<'deep' | 'restful' | 'average' | 'disrupted'>('restful');
  const [vitalsNotes, setVitalsNotes] = useState<string>('');

  // Medication State
  const [drugName, setDrugName] = useState('');
  const [dosage, setDosage] = useState('');
  const [frequency, setFrequency] = useState('Once daily');
  const [timeSlots, setTimeSlots] = useState<('morning' | 'afternoon' | 'evening' | 'bedtime')[]>(['morning']);
  const [purpose, setPurpose] = useState('');
  const [pillsRemaining, setPillsRemaining] = useState('30');

  // Allergy State
  const [allergen, setAllergen] = useState('');
  const [allergyCategory, setAllergyCategory] = useState<'medication' | 'food' | 'environmental' | 'other'>('medication');
  const [allergySeverity, setAllergySeverity] = useState<'mild' | 'moderate' | 'severe' | 'anaphylaxis'>('moderate');
  const [allergyReaction, setAllergyReaction] = useState('');

  // Document State
  const [docTitle, setDocTitle] = useState('');
  const [docCategory, setDocCategory] = useState<HealthDocumentCategory>('lab_report');
  const [docDate, setDocDate] = useState(new Date().toISOString().split('T')[0]);
  const [doctorOrFacility, setDoctorOrFacility] = useState('');
  const [docNotes, setDocNotes] = useState('');
  const [selectedFile, setSelectedFile] = useState<{
    name: string;
    mimeType: string;
    size: number;
    base64: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!docTitle) {
      setDocTitle(file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' '));
    }

    const reader = new FileReader();
    reader.onload = () => {
      const b64 = reader.result as string;
      setSelectedFile({
        name: file.name,
        mimeType: file.type || 'application/pdf',
        size: file.size,
        base64: b64,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setStatusMessage(null);

    try {
      if (mode === 'vitals') {
        await addVitalSignToMember(member.memberId, {
          recordedBy: 'Manual Check',
          systolicBp: systolicBp ? Number(systolicBp) : undefined,
          diastolicBp: diastolicBp ? Number(diastolicBp) : undefined,
          heartRate: heartRate ? Number(heartRate) : undefined,
          bloodGlucose: bloodGlucose ? Number(bloodGlucose) : undefined,
          glucoseContext: bloodGlucose ? glucoseContext : undefined,
          oxygenSpO2: oxygenSpO2 ? Number(oxygenSpO2) : undefined,
          bodyTemperature: bodyTemperature ? Number(bodyTemperature) : undefined,
          weightKg: weightKg ? Number(weightKg) : undefined,
          sleepHours: sleepHours ? Number(sleepHours) : undefined,
          sleepQuality: sleepQuality as any,
          deepSleepMinutes: sleepHours ? Math.round(Number(sleepHours) * 16) : undefined,
          notes: vitalsNotes || undefined,
        });
        setStatusMessage('Vitals & sleep recorded into local SQLite store & Drive queue.');
      } else if (mode === 'medication') {
        if (!drugName.trim()) throw new Error('Medication name required');
        await addMedicationToMember(member.memberId, {
          drugName: drugName.trim(),
          dosage: dosage.trim() || 'Standard Dose',
          frequency,
          timeSlots,
          startDate: new Date().toISOString().split('T')[0],
          purpose: purpose.trim() || 'Health support',
          pillsRemaining: pillsRemaining ? Number(pillsRemaining) : 30,
          reminderEnabled: true,
        });
        setStatusMessage('Medication saved with automated reminders.');
      } else if (mode === 'allergy') {
        if (!allergen.trim()) throw new Error('Allergen required');
        await addAllergyToMember(member.memberId, {
          allergen: allergen.trim(),
          category: allergyCategory,
          severity: allergySeverity,
          reaction: allergyReaction.trim() || 'Allergic reaction',
        });
        setStatusMessage('Allergy logged into Medical ID.');
      } else if (mode === 'document') {
        if (!selectedFile) throw new Error('Please select a file to upload');
        setStatusMessage('Syncing document with Google Drive and sovereign SQLite store...');
        await uploadHealthDocument({
          memberId: member.memberId,
          memberName: member.memberName,
          title: docTitle.trim() || selectedFile.name,
          category: docCategory,
          documentDate: docDate,
          doctorOrFacility: doctorOrFacility.trim() || undefined,
          fileName: selectedFile.name,
          mimeType: selectedFile.mimeType,
          fileSizeBytes: selectedFile.size,
          fileContentBase64: selectedFile.base64,
          notes: docNotes || undefined,
        });
        setStatusMessage('Document uploaded and stored in Google Drive & SQLite.');
      }

      onRecordUpdated();
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message || 'Operation failed'}`);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleTimeSlot = (slot: 'morning' | 'afternoon' | 'evening' | 'bedtime') => {
    setTimeSlots((prev) =>
      prev.includes(slot) ? prev.filter((s) => s !== slot) : [...prev, slot]
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-lg max-h-[92vh] flex flex-col bg-slate-900 border border-slate-700 rounded-3xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-4 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white">Add Health Entry</h2>
            <p className="text-xs text-slate-400">For {member.memberName} ({member.relationship})</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Pills */}
        <div className="p-3 bg-slate-950 border-b border-slate-800 grid grid-cols-4 gap-1.5">
          <button
            type="button"
            onClick={() => setMode('vitals')}
            className={`py-2 px-1 rounded-xl text-xs font-bold flex flex-col sm:flex-row items-center justify-center gap-1 transition-all ${
              mode === 'vitals'
                ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <HeartPulse className="w-3.5 h-3.5" />
            <span>Vitals</span>
          </button>

          <button
            type="button"
            onClick={() => setMode('medication')}
            className={`py-2 px-1 rounded-xl text-xs font-bold flex flex-col sm:flex-row items-center justify-center gap-1 transition-all ${
              mode === 'medication'
                ? 'bg-sky-600 text-white shadow-md shadow-sky-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Pill className="w-3.5 h-3.5" />
            <span>Medication</span>
          </button>

          <button
            type="button"
            onClick={() => setMode('allergy')}
            className={`py-2 px-1 rounded-xl text-xs font-bold flex flex-col sm:flex-row items-center justify-center gap-1 transition-all ${
              mode === 'allergy'
                ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Allergy</span>
          </button>

          <button
            type="button"
            onClick={() => setMode('document')}
            className={`py-2 px-1 rounded-xl text-xs font-bold flex flex-col sm:flex-row items-center justify-center gap-1 transition-all ${
              mode === 'document'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {mode === 'vitals' && (
            <div className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Systolic BP (mmHg)</label>
                  <input
                    type="number"
                    value={systolicBp}
                    onChange={(e) => setSystolicBp(e.target.value)}
                    placeholder="120"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono focus:border-rose-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Diastolic BP (mmHg)</label>
                  <input
                    type="number"
                    value={diastolicBp}
                    onChange={(e) => setDiastolicBp(e.target.value)}
                    placeholder="80"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono focus:border-rose-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Heart Rate (bpm)</label>
                  <input
                    type="number"
                    value={heartRate}
                    onChange={(e) => setHeartRate(e.target.value)}
                    placeholder="72"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono focus:border-rose-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Blood Oxygen SpO2 (%)</label>
                  <input
                    type="number"
                    value={oxygenSpO2}
                    onChange={(e) => setOxygenSpO2(e.target.value)}
                    placeholder="98"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono focus:border-rose-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Blood Glucose (mg/dL)</label>
                  <input
                    type="number"
                    value={bloodGlucose}
                    onChange={(e) => setBloodGlucose(e.target.value)}
                    placeholder="Optional (e.g. 95)"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono focus:border-rose-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Context</label>
                  <select
                    value={glucoseContext}
                    onChange={(e: any) => setGlucoseContext(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-rose-500 outline-none"
                  >
                    <option value="fasting">Fasting</option>
                    <option value="post-meal">Post-Meal (2h)</option>
                    <option value="random">Random</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Body Temperature (°F)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={bodyTemperature}
                    onChange={(e) => setBodyTemperature(e.target.value)}
                    placeholder="98.6"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono focus:border-rose-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Body Weight (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={weightKg}
                    onChange={(e) => setWeightKg(e.target.value)}
                    placeholder="70"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono focus:border-rose-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Sleep Duration (hrs)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={sleepHours}
                    onChange={(e) => setSleepHours(e.target.value)}
                    placeholder="7.5"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono focus:border-rose-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Sleep Architecture</label>
                  <select
                    value={sleepQuality}
                    onChange={(e: any) => setSleepQuality(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-rose-500 outline-none"
                  >
                    <option value="deep">Deep & Restorative (Optimal)</option>
                    <option value="restful">Restful (Normal)</option>
                    <option value="average">Average</option>
                    <option value="disrupted">Disrupted / Fragmented</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Notes / Observations</label>
                <input
                  type="text"
                  value={vitalsNotes}
                  onChange={(e) => setVitalsNotes(e.target.value)}
                  placeholder="e.g., Checked after 10m rest, post morning walk"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-rose-500 outline-none"
                />
              </div>
            </div>
          )}

          {mode === 'medication' && (
            <div className="space-y-3.5">
              <div>
                <label className="block text-slate-400 font-bold mb-1">Medication / Drug Name *</label>
                <input
                  type="text"
                  required
                  value={drugName}
                  onChange={(e) => setDrugName(e.target.value)}
                  placeholder="e.g. Telmisartan or Amoxicillin"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-sky-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Dosage</label>
                  <input
                    type="text"
                    value={dosage}
                    onChange={(e) => setDosage(e.target.value)}
                    placeholder="e.g. 40mg or 1 tablet"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-sky-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Frequency</label>
                  <input
                    type="text"
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value)}
                    placeholder="e.g. Twice daily after food"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-sky-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1.5">Schedule Time Slots</label>
                <div className="grid grid-cols-4 gap-2">
                  {(['morning', 'afternoon', 'evening', 'bedtime'] as const).map((slot) => (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => toggleTimeSlot(slot)}
                      className={`py-1.5 rounded-xl capitalize font-bold border transition-all ${
                        timeSlots.includes(slot)
                          ? 'bg-sky-500/20 text-sky-300 border-sky-500/50'
                          : 'bg-slate-950 text-slate-500 border-slate-800 hover:text-slate-300'
                      }`}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Purpose / Condition Treated</label>
                <input
                  type="text"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="e.g. Blood pressure regulation"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-sky-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Pills Remaining (for Refill Reminder)</label>
                <input
                  type="number"
                  value={pillsRemaining}
                  onChange={(e) => setPillsRemaining(e.target.value)}
                  placeholder="30"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono focus:border-sky-500 outline-none"
                />
              </div>
            </div>
          )}

          {mode === 'allergy' && (
            <div className="space-y-3.5">
              <div>
                <label className="block text-slate-400 font-bold mb-1">Allergen Name *</label>
                <input
                  type="text"
                  required
                  value={allergen}
                  onChange={(e) => setAllergen(e.target.value)}
                  placeholder="e.g. Penicillin, Peanuts, Sulfa"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-amber-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Category</label>
                  <select
                    value={allergyCategory}
                    onChange={(e: any) => setAllergyCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-amber-500 outline-none"
                  >
                    <option value="medication">Medication</option>
                    <option value="food">Food</option>
                    <option value="environmental">Environmental</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1">Severity</label>
                  <select
                    value={allergySeverity}
                    onChange={(e: any) => setAllergySeverity(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-amber-500 outline-none"
                  >
                    <option value="mild">Mild (Itch, sneezing)</option>
                    <option value="moderate">Moderate (Hives, rash)</option>
                    <option value="severe">Severe (Facial swelling, wheeze)</option>
                    <option value="anaphylaxis">Anaphylaxis (Life-threatening)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Reaction Description</label>
                <input
                  type="text"
                  value={allergyReaction}
                  onChange={(e) => setAllergyReaction(e.target.value)}
                  placeholder="e.g. Hives, difficulty breathing, gastric upset"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-amber-500 outline-none"
                />
              </div>
            </div>
          )}

          {mode === 'document' && (
            <div className="space-y-3.5">
              <div>
                <label className="block text-slate-400 font-bold mb-1">Select Document / Scan (PDF or Image) *</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf,image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />

                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="p-5 rounded-2xl border-2 border-dashed border-slate-700 hover:border-emerald-500/60 bg-slate-950 flex flex-col items-center justify-center cursor-pointer transition-all"
                >
                  {selectedFile ? (
                    <div className="text-center space-y-1">
                      <FileText className="w-8 h-8 text-emerald-400 mx-auto" />
                      <p className="font-bold text-white text-xs">{selectedFile.name}</p>
                      <p className="text-[10px] text-slate-400">
                        {(selectedFile.size / 1024).toFixed(1)} KB • Click to choose different file
                      </p>
                    </div>
                  ) : (
                    <div className="text-center space-y-1">
                      <Upload className="w-8 h-8 text-slate-500 mx-auto mb-1" />
                      <p className="font-bold text-white text-xs">Tap to choose PDF or Image file</p>
                      <p className="text-[10px] text-slate-400">
                        Supports Lab Reports, Prescriptions, Scans & Discharge Summaries
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Document Title *</label>
                <input
                  type="text"
                  required
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  placeholder="e.g. Annual Blood Lipid Panel 2024"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-emerald-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Category</label>
                  <select
                    value={docCategory}
                    onChange={(e: any) => setDocCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-emerald-500 outline-none"
                  >
                    <option value="lab_report">Lab Report</option>
                    <option value="prescription">Prescription</option>
                    <option value="diagnostic_imaging">Imaging (X-Ray/ECG/MRI)</option>
                    <option value="vaccination_card">Vaccination Card</option>
                    <option value="discharge_summary">Discharge Summary</option>
                    <option value="insurance_card">Insurance Card</option>
                    <option value="doctor_note">Doctor Note</option>
                    <option value="other">Other Document</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1">Document Date</label>
                  <input
                    type="date"
                    value={docDate}
                    onChange={(e) => setDocDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-emerald-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Doctor / Hospital / Laboratory</label>
                <input
                  type="text"
                  value={doctorOrFacility}
                  onChange={(e) => setDoctorOrFacility(e.target.value)}
                  placeholder="e.g. Apollo Diagnostics or Dr. Ramanathan"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Notes / Diagnostic Summary</label>
                <textarea
                  rows={2}
                  value={docNotes}
                  onChange={(e) => setDocNotes(e.target.value)}
                  placeholder="e.g. Normal cholesterol, fasting glucose 92 mg/dL"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:border-emerald-500 outline-none resize-none"
                />
              </div>

              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400">
                <span className="font-bold text-slate-300 block mb-0.5">Google Drive Storage Destination:</span>
                <span className="font-mono text-emerald-400 text-[10px]">
                  Family Circle/Health And Wellness/Family Heath Record/{member.memberName}/Documents/
                </span>
              </div>
            </div>
          )}

          {statusMessage && (
            <div className="p-3 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 text-indigo-200 text-xs flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400 animate-spin" />
              <span>{statusMessage}</span>
            </div>
          )}

          {/* Submit Action */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {submitting ? (
                <Sparkles className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              <span>{submitting ? 'Saving to Vault & Drive...' : 'Save Health Entry'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
