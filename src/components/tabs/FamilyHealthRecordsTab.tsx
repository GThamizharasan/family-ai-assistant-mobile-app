import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  Baby,
  FileHeart,
  Plus,
  Printer,
  CheckCircle2,
  Bell,
  Trash2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  EmergencyMedicalCardPayload,
  FamilyLifeRecord,
  GrowthEntryPayload,
  LabManualPointPayload,
  VaccineRecordPayload,
} from '../../types/familyLifeSuite';
import {
  buildLongitudinalLabTrends,
  deleteFamilyLifeRecord,
  loadFamilyLifeRecords,
  LongitudinalBiomarkerSeries,
  saveFamilyLifeRecord,
} from '../../services/familyLifeSuiteService';
import { createReminder } from '../../services/reminderDriveSync';

const STANDARD_IMMUNIZATION_SCHEDULE = [
  { vaccineName: 'BCG & Hepatitis B (Birth Dose)', ageStage: 'Birth' },
  { vaccineName: '6-in-1 (DTaP/IPV/Hib/HepB) + Rotavirus + MenB', ageStage: '8 Weeks' },
  { vaccineName: '6-in-1 (Dose 2) + PCV Pneumococcal + Rotavirus', ageStage: '12 Weeks' },
  { vaccineName: '6-in-1 (Dose 3) + MenB Booster', ageStage: '16 Weeks' },
  { vaccineName: 'Hib/MenC + MMR (Dose 1) + PCV + MenB', ageStage: '1 Year' },
  { vaccineName: '4-in-1 Pre-School Booster (dTaP/IPV) + MMR (Dose 2)', ageStage: '3 Years 4 Months' },
  { vaccineName: 'Annual Nasal Flu Vaccine (Children)', ageStage: 'Yearly Autumn' },
  { vaccineName: 'HPV + Td/IPV Teenage Booster + MenACWY', ageStage: '12–14 Years' },
];

function estimateWhoPercentileBand(ageMonths: number, weightKg: number, heightCm: number): string {
  const bmi = weightKg / Math.pow(Math.max(0.4, heightCm / 100), 2);
  if (bmi < 13.8) return '10th–25th Percentile (Lean — monitor nutrition)';
  if (bmi <= 17.5) return '50th–75th Percentile (Healthy WHO Growth Band)';
  if (bmi <= 19.2) return '75th–90th Percentile (Above Average)';
  return '90th+ Percentile (Consult Pediatrician)';
}

export const FamilyHealthRecordsTab: React.FC = () => {
  const { user, googleAccessToken } = useApp();
  const userEmail = user?.email || 'chinna.tamil2000@gmail.com';
  const todayIso = new Date().toISOString().split('T')[0];

  const [subTab, setSubTab] = useState<'trends' | 'growth' | 'medcard'>('trends');
  const [memberFilter, setMemberFilter] = useState('ALL');
  const [trendSeries, setTrendSeries] = useState<LongitudinalBiomarkerSeries[]>([]);
  const [growthEntries, setGrowthEntries] = useState<FamilyLifeRecord<GrowthEntryPayload>[]>([]);
  const [vaccines, setVaccines] = useState<FamilyLifeRecord<VaccineRecordPayload>[]>([]);
  const [medicalCards, setMedicalCards] = useState<FamilyLifeRecord<EmergencyMedicalCardPayload>[]>([]);
  const [banner, setBanner] = useState<string | null>(null);

  // Manual Lab Marker Form
  const [labMember, setLabMember] = useState('Adithya');
  const [labMarker, setLabMarker] = useState('Hemoglobin');
  const [labValue, setLabValue] = useState('');
  const [labUnit, setLabUnit] = useState('g/dL');
  const [labDate, setLabDate] = useState(todayIso);

  // Pediatric Growth Form
  const [childName, setChildName] = useState('Adithya');
  const [ageMonths, setAgeMonths] = useState('72');
  const [heightCm, setHeightCm] = useState('116');
  const [weightKg, setWeightKg] = useState('21');

  // Medical Card Form
  const [mcName, setMcName] = useState('Adithya Thamizarasan');
  const [mcDob, setMcDob] = useState('2020-09-13');
  const [mcBlood, setMcBlood] = useState('O+');
  const [mcNhs, setMcNhs] = useState('733 521 8306');
  const [mcAllergies, setMcAllergies] = useState('None known');
  const [mcMeds, setMcMeds] = useState('Vitamin D supplement');
  const [mcGp, setMcGp] = useState('Clayhall Group Practice');
  const [mcPhone, setMcPhone] = useState('07721877710');

  const reloadAll = useCallback(async () => {
    const [all, trends] = await Promise.all([
      loadFamilyLifeRecords(undefined, { userEmail, googleAccessToken }),
      buildLongitudinalLabTrends(userEmail, googleAccessToken, memberFilter),
    ]);
    setTrendSeries(trends);
    setGrowthEntries(all.filter((r) => r.domain === 'growth_entry'));
    setMedicalCards(all.filter((r) => r.domain === 'medical_card'));

    let loadedVaccines = all.filter((r) => r.domain === 'vaccine_record');
    if (loadedVaccines.length === 0) {
      const seeded: FamilyLifeRecord<VaccineRecordPayload>[] = [];
      for (const v of STANDARD_IMMUNIZATION_SCHEDULE) {
        const s = await saveFamilyLifeRecord<VaccineRecordPayload>(
          {
            domain: 'vaccine_record',
            title: v.vaccineName,
            subtitle: v.ageStage,
            memberName: 'Adithya',
            payload: {
              childName: 'Adithya',
              vaccineName: v.vaccineName,
              ageStage: v.ageStage,
              scheduleSystem: 'NHS UK & IAP',
              completed: false,
            },
          },
          { userEmail, googleAccessToken: null }
        );
        seeded.push(s);
      }
      loadedVaccines = seeded;
    }
    setVaccines(loadedVaccines);
  }, [userEmail, googleAccessToken, memberFilter]);

  useEffect(() => {
    void reloadAll();
  }, [reloadAll]);

  const handleAddManualLabPoint = async () => {
    const num = parseFloat(labValue);
    if (!Number.isFinite(num) || !labMarker.trim()) return;
    await saveFamilyLifeRecord<LabManualPointPayload>(
      {
        domain: 'lab_manual_point',
        title: `${labMarker}: ${num} ${labUnit}`,
        memberName: labMember,
        dueOrExpiryDate: labDate,
        payload: {
          memberName: labMember,
          markerName: labMarker.trim(),
          valueNumeric: num,
          unit: labUnit.trim(),
          recordedDate: labDate,
        },
      },
      { userEmail, googleAccessToken }
    );
    setLabValue('');
    const updatedTrends = await buildLongitudinalLabTrends(userEmail, googleAccessToken, memberFilter);
    setTrendSeries(updatedTrends);
    setBanner(`📈 Logged ${labMarker} (${num} ${labUnit}) into Longitudinal Biomarker Chart!`);
  };

  const handleAddGrowthEntry = async () => {
    const h = parseFloat(heightCm);
    const w = parseFloat(weightKg);
    const m = parseInt(ageMonths, 10) || 60;
    if (!Number.isFinite(h) || !Number.isFinite(w)) return;
    const bmi = Number((w / Math.pow(h / 100, 2)).toFixed(1));
    const band = estimateWhoPercentileBand(m, w, h);

    const saved = await saveFamilyLifeRecord<GrowthEntryPayload>(
      {
        domain: 'growth_entry',
        title: `${childName} — ${h} cm · ${w} kg (BMI ${bmi})`,
        subtitle: band,
        memberName: childName,
        dueOrExpiryDate: todayIso,
        payload: {
          childName,
          ageMonths: m,
          recordedDate: todayIso,
          heightCm: h,
          weightKg: w,
          bmi,
          percentileBand: band,
        },
      },
      { userEmail, googleAccessToken }
    );
    setGrowthEntries((prev) => [saved, ...prev]);
    setBanner(`📏 Logged growth measurement (${band})!`);
  };

  const handlePrintDoctorPack = () => {
    if (typeof window !== 'undefined' && (window as any).AndroidPrinter?.print) {
      (window as any).AndroidPrinter.print('AuraFamily_Doctor_Visit_Pack');
    } else {
      window.print();
    }
  };

  return (
    <div className="space-y-4 pb-24 text-white">
      {/* Header */}
      <div className="rounded-3xl bg-gradient-to-r from-rose-950/90 via-slate-900 to-cyan-950/90 border border-white/15 p-4 sm:p-5 shadow-2xl flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-rose-500/20 text-rose-200 border border-rose-400/40">
            📈 Longitudinal Lab Trends · WHO Growth & NHS/IAP Vaccines · Doctor Visit Pack
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-white mt-1">
            Family Longitudinal Health & Pediatric Growth Hub
          </h2>
        </div>
        <button
          onClick={handlePrintDoctorPack}
          className="px-3.5 py-2 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/15 text-white text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
        >
          <Printer className="w-3.5 h-3.5" /> Print / Export PDF
        </button>
      </div>

      {banner && (
        <div className="rounded-2xl bg-rose-500/15 border border-rose-400/40 px-4 py-2.5 text-xs text-rose-100 flex items-center justify-between">
          <span>{banner}</span>
          <button onClick={() => setBanner(null)} className="font-bold cursor-pointer">✕</button>
        </div>
      )}

      {/* Sub-Tabs */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { id: 'trends', label: `📈 Lab Biomarker Trends (${trendSeries.length})`, icon: Activity },
          { id: 'growth', label: '👶 Growth & Vaccines', icon: Baby },
          { id: 'medcard', label: `🏥 Doctor Visit Pack (${medicalCards.length})`, icon: FileHeart },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id as any)}
            className={`py-2.5 px-3 rounded-2xl text-xs font-extrabold cursor-pointer transition-all ${
              subTab === t.id
                ? 'bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-lg'
                : 'bg-slate-900/85 text-slate-300 border border-white/10'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* SUB-TAB 1: LONGITUDINAL LAB BIOMARKER TREND CHARTS */}
      {subTab === 'trends' && (
        <div className="space-y-4">
          <div className="rounded-3xl bg-slate-900/90 border border-white/15 p-4 space-y-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-black text-white">📊 Longitudinal Lab Biomarker Logger & Auto-Synced Report Trends</h3>
                <p className="text-[11px] text-slate-400">
                  Automatically aggregates numeric markers from Smart Document Health Analyzer + manual lab readings below.
                </p>
              </div>
              <input
                value={memberFilter === 'ALL' ? '' : memberFilter}
                onChange={(e) => setMemberFilter(e.target.value.trim() || 'ALL')}
                placeholder="Filter patient name..."
                className="px-3 py-1.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs"
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <input value={labMember} onChange={(e) => setLabMember(e.target.value)} placeholder="Patient" className="px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white" />
              <select value={labMarker} onChange={(e) => setLabMarker(e.target.value)} className="px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white font-bold">
                {['Hemoglobin', 'Vitamin D', 'HbA1c', 'Fasting Glucose', 'WBC Count', 'Liver ALT', 'Creatinine', 'Ferritin', 'TSH'].map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <input type="number" step="0.1" value={labValue} onChange={(e) => setLabValue(e.target.value)} placeholder="Value (e.g. 13.4)" className="px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white" />
              <input value={labUnit} onChange={(e) => setLabUnit(e.target.value)} placeholder="Unit (g/dL)" className="px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white" />
              <button onClick={() => void handleAddManualLabPoint()} className="py-2 px-3 rounded-xl bg-rose-500 text-white font-extrabold inline-flex items-center justify-center gap-1 cursor-pointer">
                <Plus className="w-4 h-4" /> Plot Reading
              </button>
            </div>
          </div>

          {trendSeries.length === 0 ? (
            <div className="rounded-3xl bg-slate-900/70 border border-white/10 p-8 text-center text-xs text-slate-400">
              No numeric lab readings plotted yet — scan a lab report in Smart Document Analyzer or add a reading above to see trend curves!
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {trendSeries.map((series) => {
                const vals = series.points.map((p) => p.value);
                const minV = Math.min(...vals);
                const maxV = Math.max(...vals);
                const span = Math.max(1, maxV - minV);
                const latest = series.points[series.points.length - 1];

                const svgPoints = series.points
                  .map((pt, idx) => {
                    const x = series.points.length === 1 ? 150 : 24 + (idx / (series.points.length - 1)) * 252;
                    const y = 76 - ((pt.value - minV) / span) * 52;
                    return `${x},${y}`;
                  })
                  .join(' ');

                return (
                  <div key={series.markerName} className="rounded-3xl bg-slate-900/90 border border-white/15 p-4 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-black text-white">{series.markerName}</h4>
                        <span className="text-[11px] text-slate-400">{latest.memberName} · {series.points.length} reading(s)</span>
                      </div>
                      <div className="text-right">
                        <div className="text-base font-black text-cyan-300">
                          {latest.value} {series.unit}
                        </div>
                        <div className="text-[10px] text-slate-400">Latest: {latest.date}</div>
                      </div>
                    </div>

                    <svg viewBox="0 0 300 95" className="w-full h-24 rounded-2xl bg-slate-950 border border-white/10">
                      <polyline
                        fill="none"
                        stroke="#22d3ee"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        points={svgPoints}
                      />
                      {series.points.map((pt, idx) => {
                        const x = series.points.length === 1 ? 150 : 24 + (idx / (series.points.length - 1)) * 252;
                        const y = 76 - ((pt.value - minV) / span) * 52;
                        return (
                          <g key={`${pt.date}-${idx}`}>
                            <circle cx={x} cy={y} r="4.5" fill={pt.status === 'normal' ? '#34d399' : '#fbbf24'} />
                            <text x={x} y={y - 8} textAnchor="middle" fill="#e2e8f0" fontSize="9" fontWeight="bold">
                              {pt.value}
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 2: PEDIATRIC GROWTH CURVES & NHS/IAP VACCINATION SCHEDULE */}
      {subTab === 'growth' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
          {/* Growth Tracker */}
          <div className="rounded-3xl bg-slate-900/90 border border-white/15 p-4 space-y-3">
            <h3 className="text-sm font-black text-white">📏 Child Height, Weight & WHO Percentile Tracker</h3>
            <div className="grid grid-cols-2 gap-2">
              <input value={childName} onChange={(e) => setChildName(e.target.value)} placeholder="Child Name" className="px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white" />
              <input type="number" value={ageMonths} onChange={(e) => setAgeMonths(e.target.value)} placeholder="Age (Months)" className="px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white" />
              <input type="number" step="0.1" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} placeholder="Height (cm)" className="px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white" />
              <input type="number" step="0.1" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} placeholder="Weight (kg)" className="px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white" />
            </div>
            <button
              onClick={() => void handleAddGrowthEntry()}
              className="w-full py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 text-slate-950 font-extrabold cursor-pointer"
            >
              Log Growth & Compute WHO Percentile
            </button>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {growthEntries.map((g) => (
                <div key={g.id} className="p-3 rounded-2xl bg-slate-950 border border-white/10 flex items-center justify-between">
                  <div>
                    <div className="font-extrabold text-white">{g.title}</div>
                    <div className="text-[11px] text-emerald-300">{g.payload.percentileBand}</div>
                    <div className="text-[10px] text-slate-500">{g.payload.recordedDate} · {g.payload.ageMonths} months</div>
                  </div>
                  <button
                    onClick={async () => {
                      await deleteFamilyLifeRecord(g.id, googleAccessToken);
                      setGrowthEntries((prev) => prev.filter((x) => x.id !== g.id));
                    }}
                    className="p-1.5 rounded-lg bg-rose-500/15 text-rose-300 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* NHS UK & IAP Immunization Checklist */}
          <div className="rounded-3xl bg-slate-900/90 border border-white/15 p-4 space-y-3">
            <h3 className="text-sm font-black text-white">💉 NHS UK & IAP Child Vaccination Checklist</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {vaccines.map((v) => {
                const done = v.payload.completed;
                return (
                  <div
                    key={v.id}
                    className={`p-3 rounded-2xl border flex items-center justify-between gap-2 ${
                      done ? 'bg-emerald-500/15 border-emerald-400/40' : 'bg-slate-950 border-white/10'
                    }`}
                  >
                    <label
                      onClick={async () => {
                        const u = await saveFamilyLifeRecord<VaccineRecordPayload>(
                          {
                            id: v.id,
                            domain: 'vaccine_record',
                            title: v.title,
                            subtitle: v.subtitle,
                            memberName: v.memberName,
                            payload: {
                              ...v.payload,
                              completed: !done,
                              completedDate: !done ? todayIso : undefined,
                            },
                          },
                          { userEmail, googleAccessToken }
                        );
                        setVaccines((prev) => prev.map((x) => (x.id === u.id ? u : x)));
                      }}
                      className="flex items-center gap-2.5 cursor-pointer flex-1"
                    >
                      <CheckCircle2 className={`w-5 h-5 shrink-0 ${done ? 'text-emerald-400' : 'text-slate-600'}`} />
                      <div>
                        <div className="font-extrabold text-white">{v.payload.vaccineName}</div>
                        <div className="text-[11px] text-cyan-300">Stage: {v.payload.ageStage}</div>
                      </div>
                    </label>
                    {!done && (
                      <button
                        onClick={async () => {
                          await createReminder(
                            {
                              title: `💉 Vaccine Due: ${v.payload.vaccineName} (${v.payload.childName})`,
                              dueTime: '09:30',
                              category: 'medical',
                              priority: 'high',
                              familyMember: v.payload.childName,
                              notes: `Stage: ${v.payload.ageStage}`,
                            },
                            googleAccessToken,
                            userEmail
                          );
                          setBanner(`🔔 Scheduled immunization reminder for ${v.payload.vaccineName}!`);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-200 font-bold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Bell className="w-3 h-3" /> Alert
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: 1-TAP DOCTOR VISIT PACK & EMERGENCY MEDICAL CARD */}
      {subTab === 'medcard' && (
        <div className="space-y-4">
          <div className="rounded-3xl bg-slate-900/90 border border-white/15 p-4 space-y-3 text-xs">
            <h3 className="text-sm font-black text-white">🏥 Create / Update Printable Doctor Visit Pack & Emergency Medical Card</h3>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <input value={mcName} onChange={(e) => setMcName(e.target.value)} placeholder="Patient Full Name" className="px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white" />
              <input type="date" value={mcDob} onChange={(e) => setMcDob(e.target.value)} className="px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white" />
              <input value={mcBlood} onChange={(e) => setMcBlood(e.target.value)} placeholder="Blood Group (e.g. O+)" className="px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white font-bold" />
              <input value={mcNhs} onChange={(e) => setMcNhs(e.target.value)} placeholder="NHS / Health ID" className="px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white" />
              <input value={mcAllergies} onChange={(e) => setMcAllergies(e.target.value)} placeholder="Allergies (comma separated)" className="sm:col-span-2 px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white" />
              <input value={mcMeds} onChange={(e) => setMcMeds(e.target.value)} placeholder="Active Medications" className="sm:col-span-2 px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white" />
              <input value={mcGp} onChange={(e) => setMcGp(e.target.value)} placeholder="GP Surgery / Clinic" className="sm:col-span-2 px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white" />
              <input value={mcPhone} onChange={(e) => setMcPhone(e.target.value)} placeholder="Emergency Phone" className="sm:col-span-2 px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white" />
            </div>
            <button
              onClick={async () => {
                const saved = await saveFamilyLifeRecord<EmergencyMedicalCardPayload>(
                  {
                    domain: 'medical_card',
                    title: `Medical Card — ${mcName}`,
                    subtitle: `Blood ${mcBlood} · NHS ${mcNhs}`,
                    memberName: mcName,
                    payload: {
                      memberName: mcName,
                      dateOfBirth: mcDob,
                      bloodGroup: mcBlood,
                      nhsOrHealthId: mcNhs,
                      allergies: mcAllergies.split(',').map((s) => s.trim()).filter(Boolean),
                      chronicConditions: [],
                      activeMedications: mcMeds.split(',').map((s) => s.trim()).filter(Boolean),
                      emergencyContactName: user?.name || 'Parent / Guardian',
                      emergencyContactPhone: mcPhone,
                      gpOrDoctorName: mcGp,
                    },
                  },
                  { userEmail, googleAccessToken }
                );
                setMedicalCards((prev) => [saved, ...prev]);
                setBanner('✅ Saved Emergency Medical Card & Doctor Visit Summary!');
              }}
              className="w-full py-2.5 rounded-2xl bg-gradient-to-r from-rose-500 to-pink-600 text-white font-extrabold cursor-pointer"
            >
              Save Emergency Medical Card to SQLite & Google Drive
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {medicalCards.map((card) => {
              const p = card.payload;
              return (
                <div key={card.id} className="rounded-3xl bg-slate-950 border-2 border-rose-400/50 p-4 space-y-2.5 text-xs shadow-xl">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="px-2.5 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-black uppercase">
                        🚑 Emergency Medical & Clinic Card
                      </span>
                      <h4 className="text-lg font-black text-white mt-1">{p.memberName}</h4>
                      <div className="text-slate-300">DOB: {p.dateOfBirth} · NHS/ID: {p.nhsOrHealthId || 'N/A'}</div>
                    </div>
                    <div className="px-3 py-1.5 rounded-2xl bg-rose-500/20 border border-rose-400/40 text-rose-200 text-base font-black">
                      {p.bloodGroup}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10">
                    <div>
                      <div className="text-[10px] uppercase text-amber-300 font-bold">Allergies</div>
                      <div className="text-white font-semibold">{(p.allergies || []).join(', ') || 'None known'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase text-cyan-300 font-bold">Active Meds</div>
                      <div className="text-white font-semibold">{(p.activeMedications || []).join(', ') || 'None'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase text-slate-400 font-bold">GP / Doctor</div>
                      <div className="text-slate-200">{p.gpOrDoctorName || 'Family Clinic'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase text-emerald-300 font-bold">Emergency Contact</div>
                      <div className="text-emerald-200 font-mono">{p.emergencyContactPhone}</div>
                    </div>
                  </div>
                  <div className="flex justify-between items-center pt-2">
                    <button
                      onClick={handlePrintDoctorPack}
                      className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" /> Print / Save PDF
                    </button>
                    <button
                      onClick={async () => {
                        await deleteFamilyLifeRecord(card.id, googleAccessToken);
                        setMedicalCards((prev) => prev.filter((x) => x.id !== card.id));
                      }}
                      className="p-1.5 rounded-xl bg-rose-500/15 text-rose-300 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
