// Sovereign Family Circle Health & Wellness Drive and SQLite Sync Service
// Folder Structure: Family Circle / Health And Wellness / Family Heath Record / <MemberName>

import {
  FamilyHealthRecord,
  HealthDocument,
  VitalSignEntry,
  AllergyEntry,
  MedicationEntry,
} from '../types/healthRecord';
import { getOrCreateGoogleDriveFolder } from './googleWorkspace';
import { getApiUrl } from './api';

const LOCAL_HEALTH_RECORDS_KEY = 'aura_family_health_records_v1';
const LOCAL_HEALTH_DOCS_KEY = 'aura_family_health_docs_v1';

export const HEALTH_ROOT_FOLDER = 'Family Circle';
export const HEALTH_SECTION_FOLDER = 'Health And Wellness';
export const HEALTH_RECORD_FOLDER = 'Family Heath Record';

/**
 * Retrieve active Google Drive access token
 */
export function getGoogleAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return (
    localStorage.getItem('aura_google_access_token') ||
    localStorage.getItem('google_access_token') ||
    null
  );
}

/**
 * Seed realistic family health records
 */
export function getDefaultFamilyHealthRecords(): FamilyHealthRecord[] {
  const now = new Date().toISOString();
  const today = now.split('T')[0];

  return [
    {
      id: 'hr_chinnathambi',
      memberId: 'member_chinnathambi',
      memberName: 'Chinnathambi',
      relationship: 'Primary / Self',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      dateOfBirth: '1992-06-15',
      age: 34,
      gender: 'male',
      bloodGroup: 'O+',
      heightCm: 178,
      weightKg: 74,
      allergies: [
        {
          id: 'alg_1',
          allergen: 'Penicillin',
          category: 'medication',
          severity: 'severe',
          reaction: 'Hives, rash, facial swelling',
          diagnosedDate: '2016-04-12',
        },
        {
          id: 'alg_2',
          allergen: 'Dust Mites',
          category: 'environmental',
          severity: 'mild',
          reaction: 'Sneezing and mild allergic rhinitis',
        },
      ],
      conditions: [
        {
          id: 'cnd_1',
          name: 'Mild Work Stress & Screen Fatigue',
          diagnosedDate: '2023-01-10',
          status: 'managed',
          treatingDoctor: 'Dr. A. Murugan (Neurology & Longevity)',
          carePlanNotes: 'Box breathing exercises, blue light filters, regular hydration.',
        },
      ],
      vitalsHistory: [
        {
          id: 'vit_c_1',
          timestamp: new Date(Date.now() - 3600000 * 4).toISOString(),
          recordedBy: 'Apple Watch & Oura Ring',
          systolicBp: 118,
          diastolicBp: 76,
          heartRate: 64,
          bloodGlucose: 92,
          glucoseContext: 'fasting',
          oxygenSpO2: 99,
          bodyTemperature: 98.4,
          weightKg: 74.2,
          bmi: 23.4,
          notes: 'Optimal autonomic recovery & resting heart rate.',
        },
        {
          id: 'vit_c_2',
          timestamp: new Date(Date.now() - 86400000 * 2).toISOString(),
          recordedBy: 'Manual Check',
          systolicBp: 122,
          diastolicBp: 79,
          heartRate: 68,
          oxygenSpO2: 98,
          bodyTemperature: 98.6,
          weightKg: 74.5,
          bmi: 23.5,
        },
      ],
      medications: [
        {
          id: 'med_c_1',
          drugName: 'Omega-3 DHA & EPA Longevity Complex',
          dosage: '1000mg',
          frequency: 'Once daily with breakfast',
          timeSlots: ['morning'],
          startDate: '2023-01-01',
          purpose: 'Cardiovascular, brain, and membrane protection',
          pillsRemaining: 45,
          reminderEnabled: true,
          takenToday: { morning: true },
        },
        {
          id: 'med_c_2',
          drugName: 'Magnesium L-Threonate & Zinc',
          dosage: '400mg',
          frequency: 'Every evening 30m before bed',
          timeSlots: ['bedtime'],
          startDate: '2023-02-15',
          purpose: 'Deep sleep motor memory consolidation & neural calm',
          pillsRemaining: 28,
          reminderEnabled: true,
          takenToday: { bedtime: false },
        },
      ],
      vaccinations: [
        {
          id: 'vac_c_1',
          vaccineName: 'COVID-19 Bivalent Booster',
          dateAdministered: '2023-11-04',
          doseNumber: 3,
          administeredBy: 'Apollo Wellness Clinic',
          status: 'completed',
        },
        {
          id: 'vac_c_2',
          vaccineName: 'Annual Influenza Quadrivalent',
          dateAdministered: '2024-09-18',
          doseNumber: 1,
          nextBoosterDue: '2025-09-18',
          status: 'completed',
        },
      ],
      emergencyContact: {
        name: 'Selvi Thamizharasan',
        relationship: 'Spouse',
        phone: '+91 98401 23456',
      },
      primaryDoctor: {
        name: 'Dr. K. Rajasekaran, MD',
        clinic: 'Family Health & Longevity Institute',
        phone: '+91 94440 98765',
        email: 'dr.rajasekaran@familyhealth.org',
      },
      insurance: {
        provider: 'Star Health Family Comprehensive',
        policyNumber: 'SH-FAM-99884210',
        validThru: '2027-12-31',
      },
      organDonor: true,
      notes: 'Active marathon runner. Excellent cardiovascular recovery status.',
      driveFolderPath: `${HEALTH_ROOT_FOLDER}/${HEALTH_SECTION_FOLDER}/${HEALTH_RECORD_FOLDER}/Chinnathambi`,
      driveSyncStatus: 'synced',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'hr_selvi',
      memberId: 'member_selvi',
      memberName: 'Selvi',
      relationship: 'Spouse',
      avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150',
      dateOfBirth: '1994-09-22',
      age: 32,
      gender: 'female',
      bloodGroup: 'B+',
      heightCm: 165,
      weightKg: 61,
      allergies: [
        {
          id: 'alg_s_1',
          allergen: 'Sulfa Drugs',
          category: 'medication',
          severity: 'moderate',
          reaction: 'Skin rash and pruritus',
          diagnosedDate: '2018-08-14',
        },
      ],
      conditions: [],
      vitalsHistory: [
        {
          id: 'vit_s_1',
          timestamp: new Date(Date.now() - 3600000 * 5).toISOString(),
          recordedBy: 'Apple Health Sync',
          systolicBp: 112,
          diastolicBp: 74,
          heartRate: 68,
          oxygenSpO2: 99,
          bodyTemperature: 98.6,
          weightKg: 61.0,
          bmi: 22.4,
          notes: 'Normal vitals, resting heart rate optimal.',
        },
      ],
      medications: [
        {
          id: 'med_s_1',
          drugName: 'Vitamin D3 (Cholecalciferol) 60,000 IU',
          dosage: 'Weekly oral solution',
          frequency: 'Once weekly on Sunday',
          timeSlots: ['morning'],
          startDate: '2024-01-07',
          purpose: 'Bone mineral density and immunity maintenance',
          pillsRemaining: 8,
          reminderEnabled: true,
          takenToday: { morning: true },
        },
      ],
      vaccinations: [
        {
          id: 'vac_s_1',
          vaccineName: 'Tetanus Toxoid (TT)',
          dateAdministered: '2023-05-10',
          doseNumber: 1,
          nextBoosterDue: '2028-05-10',
          status: 'completed',
        },
      ],
      emergencyContact: {
        name: 'Chinnathambi',
        relationship: 'Spouse',
        phone: '+91 98400 11223',
      },
      primaryDoctor: {
        name: 'Dr. Malathi Sundaram',
        clinic: 'Women and Wellness Care',
        phone: '+91 98410 44556',
      },
      insurance: {
        provider: 'Star Health Family Comprehensive',
        policyNumber: 'SH-FAM-99884210',
        validThru: '2027-12-31',
      },
      organDonor: true,
      driveFolderPath: `${HEALTH_ROOT_FOLDER}/${HEALTH_SECTION_FOLDER}/${HEALTH_RECORD_FOLDER}/Selvi`,
      driveSyncStatus: 'synced',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'hr_maaran',
      memberId: 'member_maaran',
      memberName: 'Maaran',
      relationship: 'Son',
      avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150',
      dateOfBirth: '2018-04-10',
      age: 8,
      gender: 'male',
      bloodGroup: 'O+',
      heightCm: 128,
      weightKg: 26,
      allergies: [],
      conditions: [],
      vitalsHistory: [
        {
          id: 'vit_m_1',
          timestamp: new Date(Date.now() - 3600000 * 24).toISOString(),
          recordedBy: 'Pediatric Checkup',
          systolicBp: 98,
          diastolicBp: 62,
          heartRate: 82,
          oxygenSpO2: 100,
          bodyTemperature: 98.4,
          weightKg: 26.1,
          bmi: 15.9,
          notes: 'Healthy pediatric growth percentile (75th percentile).',
        },
      ],
      medications: [
        {
          id: 'med_m_1',
          drugName: 'Kids Multivitamin & Iron Chewables',
          dosage: '1 gummy',
          frequency: 'Daily morning with milk',
          timeSlots: ['morning'],
          startDate: '2024-01-01',
          purpose: 'Growth & cognitive development support',
          pillsRemaining: 30,
          reminderEnabled: true,
          takenToday: { morning: true },
        },
      ],
      vaccinations: [
        {
          id: 'vac_m_1',
          vaccineName: 'MMR (Measles, Mumps, Rubella)',
          dateAdministered: '2023-04-15',
          doseNumber: 2,
          status: 'completed',
        },
        {
          id: 'vac_m_2',
          vaccineName: 'DTP Booster',
          dateAdministered: '2023-10-12',
          doseNumber: 4,
          status: 'completed',
        },
      ],
      emergencyContact: {
        name: 'Chinnathambi',
        relationship: 'Father',
        phone: '+91 98400 11223',
      },
      primaryDoctor: {
        name: 'Dr. S. Meenakshi, MD (Pediatrics)',
        clinic: 'Rainbow Children Health Center',
        phone: '+91 98402 77889',
      },
      driveFolderPath: `${HEALTH_ROOT_FOLDER}/${HEALTH_SECTION_FOLDER}/${HEALTH_RECORD_FOLDER}/Maaran`,
      driveSyncStatus: 'synced',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'hr_kavinmozhi',
      memberId: 'member_kavinmozhi',
      memberName: 'Kavinmozhi',
      relationship: 'Daughter',
      avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150',
      dateOfBirth: '2021-11-20',
      age: 4,
      gender: 'female',
      bloodGroup: 'B+',
      heightCm: 102,
      weightKg: 16.5,
      allergies: [],
      conditions: [],
      vitalsHistory: [
        {
          id: 'vit_k_1',
          timestamp: new Date(Date.now() - 3600000 * 30).toISOString(),
          recordedBy: 'Home Monitor',
          heartRate: 88,
          oxygenSpO2: 99,
          bodyTemperature: 98.6,
          weightKg: 16.5,
          notes: 'All pediatric vitals within ideal reference limits.',
        },
      ],
      medications: [],
      vaccinations: [
        {
          id: 'vac_k_1',
          vaccineName: 'Varicella (Chickenpox)',
          dateAdministered: '2023-03-10',
          doseNumber: 1,
          status: 'completed',
        },
        {
          id: 'vac_k_2',
          vaccineName: 'Typhoid Conjugate Vaccine',
          dateAdministered: '2023-09-20',
          doseNumber: 1,
          status: 'completed',
        },
      ],
      emergencyContact: {
        name: 'Selvi Thamizharasan',
        relationship: 'Mother',
        phone: '+91 98401 23456',
      },
      primaryDoctor: {
        name: 'Dr. S. Meenakshi, MD (Pediatrics)',
        clinic: 'Rainbow Children Health Center',
        phone: '+91 98402 77889',
      },
      driveFolderPath: `${HEALTH_ROOT_FOLDER}/${HEALTH_SECTION_FOLDER}/${HEALTH_RECORD_FOLDER}/Kavinmozhi`,
      driveSyncStatus: 'synced',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'hr_grandparents',
      memberId: 'member_grandparents',
      memberName: 'Grandparents',
      relationship: 'Elders',
      avatar: 'https://images.unsplash.com/photo-1547425260-76bcadfb4f2c?w=150',
      dateOfBirth: '1958-03-08',
      age: 68,
      gender: 'male',
      bloodGroup: 'AB+',
      heightCm: 170,
      weightKg: 69,
      allergies: [
        {
          id: 'alg_g_1',
          allergen: 'Aspirin & NSAIDs',
          category: 'medication',
          severity: 'moderate',
          reaction: 'Gastric irritation and wheezing',
          diagnosedDate: '2010-02-15',
        },
      ],
      conditions: [
        {
          id: 'cnd_g_1',
          name: 'Essential Hypertension',
          diagnosedDate: '2015-06-20',
          status: 'managed',
          treatingDoctor: 'Dr. V. Ramanathan, Senior Cardiologist',
          carePlanNotes: 'Low sodium diet, morning brisk walk, monitor BP twice daily.',
        },
        {
          id: 'cnd_g_2',
          name: 'Mild Type 2 Diabetes',
          diagnosedDate: '2018-09-12',
          status: 'managed',
          treatingDoctor: 'Dr. V. Ramanathan',
          carePlanNotes: 'HbA1c target < 6.8%. Metformin 500mg post dinner.',
        },
      ],
      vitalsHistory: [
        {
          id: 'vit_g_1',
          timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
          recordedBy: 'Omron BP Bluetooth Monitor',
          systolicBp: 128,
          diastolicBp: 82,
          heartRate: 72,
          bloodGlucose: 114,
          glucoseContext: 'fasting',
          oxygenSpO2: 97,
          bodyTemperature: 98.4,
          weightKg: 69.2,
          bmi: 23.9,
          notes: 'Blood pressure stable and well controlled under medication.',
        },
        {
          id: 'vit_g_2',
          timestamp: new Date(Date.now() - 86400000 * 1).toISOString(),
          recordedBy: 'Home Monitor',
          systolicBp: 132,
          diastolicBp: 84,
          heartRate: 74,
          bloodGlucose: 138,
          glucoseContext: 'post-meal',
          oxygenSpO2: 97,
        },
      ],
      medications: [
        {
          id: 'med_g_1',
          drugName: 'Telmisartan 40mg',
          dosage: '1 tablet',
          frequency: 'Every morning at 8:00 AM after breakfast',
          timeSlots: ['morning'],
          startDate: '2020-01-01',
          purpose: 'Blood pressure control & cardiovascular protection',
          pillsRemaining: 22,
          reminderEnabled: true,
          takenToday: { morning: true },
        },
        {
          id: 'med_g_2',
          drugName: 'Metformin Hydrochloride 500mg SR',
          dosage: '1 tablet',
          frequency: 'Night after dinner',
          timeSlots: ['bedtime'],
          startDate: '2021-03-10',
          purpose: 'Insulin sensitivity & glycemic control',
          pillsRemaining: 18,
          reminderEnabled: true,
          takenToday: { bedtime: false },
        },
      ],
      vaccinations: [
        {
          id: 'vac_g_1',
          vaccineName: 'Pneumococcal Conjugate (Prevnar 20)',
          dateAdministered: '2023-08-14',
          doseNumber: 1,
          status: 'completed',
        },
        {
          id: 'vac_g_2',
          vaccineName: 'Annual Senior Flu Shot',
          dateAdministered: '2024-10-05',
          doseNumber: 1,
          nextBoosterDue: '2025-10-05',
          status: 'completed',
        },
      ],
      emergencyContact: {
        name: 'Chinnathambi',
        relationship: 'Son',
        phone: '+91 98400 11223',
      },
      primaryDoctor: {
        name: 'Dr. V. Ramanathan, MD (Cardiology)',
        clinic: 'Madras Heart & Elder Care Institute',
        phone: '+91 94444 11223',
        email: 'dr.ramanathan@heartcare.org',
      },
      insurance: {
        provider: 'Star Health Senior Red Carpet',
        policyNumber: 'SH-SNR-1100452',
        validThru: '2027-12-31',
      },
      notes: 'Monitors BP twice daily. Enjoys evening herb garden walks and traditional herbal tea.',
      driveFolderPath: `${HEALTH_ROOT_FOLDER}/${HEALTH_SECTION_FOLDER}/${HEALTH_RECORD_FOLDER}/Grandparents`,
      driveSyncStatus: 'synced',
      createdAt: now,
      updatedAt: now,
    },
  ];
}

/**
 * Seed realistic health documents
 */
export function getDefaultHealthDocuments(): HealthDocument[] {
  const now = new Date().toISOString();
  return [
    {
      id: 'doc_1',
      memberId: 'member_chinnathambi',
      memberName: 'Chinnathambi',
      title: 'Annual Comprehensive Metabolic & Lipid Panel 2024',
      category: 'lab_report',
      documentDate: '2024-10-14',
      doctorOrFacility: 'Apollo Diagnostics Laboratory',
      fileName: 'Chinnathambi_Annual_Lipid_Panel_2024.pdf',
      mimeType: 'application/pdf',
      fileSizeBytes: 248000,
      driveFolderPath: `${HEALTH_ROOT_FOLDER}/${HEALTH_SECTION_FOLDER}/${HEALTH_RECORD_FOLDER}/Chinnathambi/Documents`,
      driveSyncStatus: 'synced',
      notes: 'HbA1c: 5.4%, Total Cholesterol: 168 mg/dL, HDL: 62 mg/dL, Triglycerides: 88 mg/dL. All markers optimal.',
      aiSummary: 'Cardiovascular risk score is lowest decile (<1%). Liver and kidney function enzymes well within standard reference intervals.',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'doc_2',
      memberId: 'member_grandparents',
      memberName: 'Grandparents',
      title: 'Cardiology 2D Echocardiogram & ECG Report',
      category: 'diagnostic_imaging',
      documentDate: '2024-09-02',
      doctorOrFacility: 'Madras Heart Institute',
      fileName: 'Grandparents_ECHO_ECG_Report.pdf',
      mimeType: 'application/pdf',
      fileSizeBytes: 420000,
      driveFolderPath: `${HEALTH_ROOT_FOLDER}/${HEALTH_SECTION_FOLDER}/${HEALTH_RECORD_FOLDER}/Grandparents/Documents`,
      driveSyncStatus: 'synced',
      notes: 'LVEF: 62%. Normal left ventricular systolic function. Mild grade 1 diastolic dysfunction consistent with age.',
      aiSummary: 'Heart muscle contractility remains strong. Ejection fraction 62% confirms effective pump performance. Continue prescribed Telmisartan.',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'doc_3',
      memberId: 'member_maaran',
      memberName: 'Maaran',
      title: 'Pediatric Immunization Record & Growth Milestone Chart',
      category: 'vaccination_card',
      documentDate: '2024-04-10',
      doctorOrFacility: 'Rainbow Children Hospital',
      fileName: 'Maaran_Immunization_Card_2024.pdf',
      mimeType: 'application/pdf',
      fileSizeBytes: 184000,
      driveFolderPath: `${HEALTH_ROOT_FOLDER}/${HEALTH_SECTION_FOLDER}/${HEALTH_RECORD_FOLDER}/Maaran/Documents`,
      driveSyncStatus: 'synced',
      notes: 'All standard universal immunization schedule vaccinations up to date. Next review at age 9.',
      aiSummary: 'Growth curve tracks at 75th percentile for height and 68th for weight. Excellent cognitive and physical development.',
      createdAt: now,
      updatedAt: now,
    },
  ];
}

/**
 * Read cached health records from localStorage
 */
export function getLocalHealthRecords(): FamilyHealthRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_HEALTH_RECORDS_KEY);
    if (!raw) {
      const seeded = getDefaultFamilyHealthRecords();
      saveLocalHealthRecords(seeded);
      return seeded;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : getDefaultFamilyHealthRecords();
  } catch (err) {
    console.warn('[HealthRecords] Error loading cached records:', err);
    return getDefaultFamilyHealthRecords();
  }
}

/**
 * Save health records to localStorage and dispatch reactive event
 */
export function saveLocalHealthRecords(records: FamilyHealthRecord[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_HEALTH_RECORDS_KEY, JSON.stringify(records));
    window.dispatchEvent(new CustomEvent('aura_health_records_changed', { detail: records }));
    window.dispatchEvent(new Event('storage'));
  } catch (err) {
    console.warn('[HealthRecords] Error saving records:', err);
  }
}

/**
 * Read cached health documents from localStorage
 */
export function getLocalHealthDocuments(): HealthDocument[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_HEALTH_DOCS_KEY);
    if (!raw) {
      const seeded = getDefaultHealthDocuments();
      saveLocalHealthDocuments(seeded);
      return seeded;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : getDefaultHealthDocuments();
  } catch (err) {
    console.warn('[HealthDocuments] Error loading cached documents:', err);
    return getDefaultHealthDocuments();
  }
}

/**
 * Save health documents to localStorage and dispatch reactive event
 */
export function saveLocalHealthDocuments(docs: HealthDocument[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_HEALTH_DOCS_KEY, JSON.stringify(docs));
    window.dispatchEvent(new CustomEvent('aura_health_docs_changed', { detail: docs }));
    window.dispatchEvent(new Event('storage'));
  } catch (err) {
    console.warn('[HealthDocuments] Error saving documents:', err);
  }
}

/**
 * Add or update vital sign for a member
 */
export async function addVitalSignToMember(
  memberId: string,
  vitals: Omit<VitalSignEntry, 'id' | 'timestamp'>,
  userEmail = 'chinna.tamil2000@gmail.com'
): Promise<FamilyHealthRecord | null> {
  const records = getLocalHealthRecords();
  const index = records.findIndex((r) => r.memberId === memberId || r.id === memberId || r.memberName.toLowerCase() === memberId.toLowerCase());
  if (index === -1) return null;

  const target = records[index];
  const newVital: VitalSignEntry = {
    ...vitals,
    id: `vit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
  };

  const updatedVitals = [newVital, ...(target.vitalsHistory || [])];
  const updatedRecord: FamilyHealthRecord = {
    ...target,
    vitalsHistory: updatedVitals,
    updatedAt: new Date().toISOString(),
    driveSyncStatus: 'syncing',
  };

  records[index] = updatedRecord;
  saveLocalHealthRecords(records);

  // Sync to backend SQLite
  try {
    await fetch(getApiUrl('/api/health/records'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ record: updatedRecord, userEmail }),
    });
  } catch (err) {
    console.warn('[HealthRecords] Server SQLite vital sync error:', err);
  }

  // Background Google Drive sync
  void syncHealthRecordsWithGoogleDrive(getGoogleAccessToken(), userEmail);

  return updatedRecord;
}

/**
 * Add an allergy to a member
 */
export async function addAllergyToMember(
  memberId: string,
  allergy: Omit<AllergyEntry, 'id'>,
  userEmail = 'chinna.tamil2000@gmail.com'
): Promise<FamilyHealthRecord | null> {
  const records = getLocalHealthRecords();
  const index = records.findIndex((r) => r.memberId === memberId || r.id === memberId || r.memberName.toLowerCase() === memberId.toLowerCase());
  if (index === -1) return null;

  const target = records[index];
  const newAllergy: AllergyEntry = {
    ...allergy,
    id: `alg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
  };

  const updatedRecord: FamilyHealthRecord = {
    ...target,
    allergies: [...(target.allergies || []), newAllergy],
    updatedAt: new Date().toISOString(),
    driveSyncStatus: 'syncing',
  };

  records[index] = updatedRecord;
  saveLocalHealthRecords(records);

  // Sync to backend SQLite
  try {
    await fetch(getApiUrl('/api/health/records'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ record: updatedRecord, userEmail }),
    });
  } catch (err) {
    console.warn('[HealthRecords] Server SQLite allergy sync error:', err);
  }

  // Background Google Drive sync
  void syncHealthRecordsWithGoogleDrive(getGoogleAccessToken(), userEmail);

  return updatedRecord;
}

/**
 * Add or update medication for a member
 */
export async function addMedicationToMember(
  memberId: string,
  medication: Omit<MedicationEntry, 'id'>,
  userEmail = 'chinna.tamil2000@gmail.com'
): Promise<FamilyHealthRecord | null> {
  const records = getLocalHealthRecords();
  const index = records.findIndex((r) => r.memberId === memberId || r.id === memberId || r.memberName.toLowerCase() === memberId.toLowerCase());
  if (index === -1) return null;

  const target = records[index];
  const newMed: MedicationEntry = {
    ...medication,
    id: `med_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
  };

  const updatedRecord: FamilyHealthRecord = {
    ...target,
    medications: [...(target.medications || []), newMed],
    updatedAt: new Date().toISOString(),
    driveSyncStatus: 'syncing',
  };

  records[index] = updatedRecord;
  saveLocalHealthRecords(records);

  // Sync to backend SQLite
  try {
    await fetch(getApiUrl('/api/health/records'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ record: updatedRecord, userEmail }),
    });
  } catch (err) {
    console.warn('[HealthRecords] Server SQLite medication sync error:', err);
  }

  // Background Google Drive sync
  void syncHealthRecordsWithGoogleDrive(getGoogleAccessToken(), userEmail);

  return updatedRecord;
}

/**
 * Upload and save a medical document (Lab report, prescription, scan, etc.)
 * Stores in local SQLite store and uploads into Google Drive under:
 * Family Circle / Health And Wellness / Family Heath Record / <MemberName> / Documents / <FileName>
 */
export async function uploadHealthDocument(
  docData: {
    memberId: string;
    memberName: string;
    title: string;
    category: HealthDocument['category'];
    documentDate: string;
    doctorOrFacility?: string;
    fileName: string;
    mimeType: string;
    fileSizeBytes: number;
    fileContentBase64: string;
    notes?: string;
  },
  googleAccessToken?: string | null,
  userEmail = 'chinna.tamil2000@gmail.com'
): Promise<HealthDocument> {
  const docId = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const now = new Date().toISOString();

  let driveFileId: string | undefined;
  let driveWebViewLink: string | undefined;
  const folderPath = `${HEALTH_ROOT_FOLDER}/${HEALTH_SECTION_FOLDER}/${HEALTH_RECORD_FOLDER}/${docData.memberName}/Documents`;

  const token = (googleAccessToken && googleAccessToken.trim()) || getGoogleAccessToken();

  // 1. Upload to Google Drive if token available
  if (token) {
    try {
      const rootFolder = await getOrCreateGoogleDriveFolder(token, HEALTH_ROOT_FOLDER);
      const healthSectionFolder = await getOrCreateGoogleDriveFolder(token, HEALTH_SECTION_FOLDER, rootFolder.id);
      const healthRecordFolder = await getOrCreateGoogleDriveFolder(token, HEALTH_RECORD_FOLDER, healthSectionFolder.id);
      const memberFolder = await getOrCreateGoogleDriveFolder(token, docData.memberName, healthRecordFolder.id);
      const docsFolder = await getOrCreateGoogleDriveFolder(token, 'Documents', memberFolder.id);

      // Clean base64 payload to binary buffer
      const pureBase64 = docData.fileContentBase64.includes(',')
        ? docData.fileContentBase64.split(',')[1]
        : docData.fileContentBase64;
      const byteCharacters = atob(pureBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: docData.mimeType });

      // Multipart Drive upload
      const metadata = {
        name: docData.fileName,
        mimeType: docData.mimeType,
        parents: [docsFolder.id],
        description: `Family Health Record for ${docData.memberName} - ${docData.title} (${docData.category}). Date: ${docData.documentDate}`,
      };

      const boundary = `-------HealthDocBoundary${Date.now().toString(36)}`;
      const delimiter = `\r\n--${boundary}\r\n`;
      const closeDelimiter = `\r\n--${boundary}--`;

      const reader = new FileReader();
      const base64Data = await new Promise<string>((resolve) => {
        reader.onload = () => {
          const res = reader.result as string;
          resolve(res.split(',')[1]);
        };
        reader.readAsDataURL(blob);
      });

      const multipartRequestBody =
        delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        `Content-Type: ${docData.mimeType}\r\n` +
        'Content-Transfer-Encoding: base64\r\n\r\n' +
        base64Data +
        closeDelimiter;

      const driveRes = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': `multipart/related; boundary=${boundary}`,
          },
          body: multipartRequestBody,
        }
      );

      if (driveRes.ok) {
        const driveJson = await driveRes.json();
        driveFileId = driveJson.id;
        driveWebViewLink = driveJson.webViewLink;
      }
    } catch (driveErr) {
      console.warn('[HealthDocuments] Google Drive upload notice:', driveErr);
    }
  }

  const newDoc: HealthDocument = {
    id: docId,
    memberId: docData.memberId,
    memberName: docData.memberName,
    title: docData.title,
    category: docData.category,
    documentDate: docData.documentDate,
    doctorOrFacility: docData.doctorOrFacility,
    fileName: docData.fileName,
    mimeType: docData.mimeType,
    fileSizeBytes: docData.fileSizeBytes,
    driveFileId,
    driveWebViewLink,
    driveFolderPath: folderPath,
    driveSyncStatus: driveFileId ? 'synced' : 'local_only',
    fileContentBase64: docData.fileContentBase64,
    notes: docData.notes,
    createdAt: now,
    updatedAt: now,
  };

  // 2. Save to local cache
  const localDocs = getLocalHealthDocuments();
  saveLocalHealthDocuments([newDoc, ...localDocs]);

  // 3. Save to backend SQLite
  try {
    await fetch(getApiUrl('/api/health/documents'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ document: newDoc, userEmail }),
    });
  } catch (err) {
    console.warn('[HealthDocuments] Server SQLite document save notice:', err);
  }

  return newDoc;
}

/**
 * Full two-way synchronization of Health Records and metadata with:
 * 1. Local Cache (localStorage)
 * 2. SQLite Backend (`/api/health/records`)
 * 3. Google Drive (`Family Circle / Health And Wellness / Family Heath Record`)
 */
export async function syncHealthRecordsWithGoogleDrive(
  googleAccessToken?: string | null,
  userEmail = 'chinna.tamil2000@gmail.com'
): Promise<{
  records: FamilyHealthRecord[];
  documents: HealthDocument[];
  status: 'synced' | 'local_only' | 'error';
  folderLink?: string;
}> {
  const recordsMap = new Map<string, FamilyHealthRecord>();
  const docsMap = new Map<string, HealthDocument>();

  // 1. Seed from local storage
  getLocalHealthRecords().forEach((r) => recordsMap.set(r.memberId || r.id, r));
  getLocalHealthDocuments().forEach((d) => docsMap.set(d.id, d));

  // 2. Fetch from local server SQLite
  try {
    const recordsRes = await fetch(getApiUrl(`/api/health/records?userEmail=${encodeURIComponent(userEmail)}`));
    if (recordsRes.ok) {
      const data = await recordsRes.json();
      if (data && Array.isArray(data.records)) {
        for (const item of data.records) {
          const key = item.memberId || item.id;
          recordsMap.set(key, { ...recordsMap.get(key), ...item });
        }
      }
    }

    const docsRes = await fetch(getApiUrl(`/api/health/documents?userEmail=${encodeURIComponent(userEmail)}`));
    if (docsRes.ok) {
      const data = await docsRes.json();
      if (data && Array.isArray(data.documents)) {
        for (const item of data.documents) {
          docsMap.set(item.id, { ...docsMap.get(item.id), ...item });
        }
      }
    }
  } catch (err) {
    console.warn('[HealthRecords] Server SQLite fetch notice:', err);
  }

  const token = (googleAccessToken && googleAccessToken.trim()) || getGoogleAccessToken();
  let rootFolderLink: string | undefined;

  // 3. Sync with Google Drive if token available
  if (token) {
    try {
      const rootFolder = await getOrCreateGoogleDriveFolder(token, HEALTH_ROOT_FOLDER);
      const healthSectionFolder = await getOrCreateGoogleDriveFolder(token, HEALTH_SECTION_FOLDER, rootFolder.id);
      const healthRecordFolder = await getOrCreateGoogleDriveFolder(token, HEALTH_RECORD_FOLDER, healthSectionFolder.id);
      rootFolderLink = (healthRecordFolder as any).webViewLink || `https://drive.google.com/drive/folders/${healthRecordFolder.id}`;

      // Check for Master Index file: family_health_records_master.json
      const masterFileName = 'family_health_records_master.json';
      const q = `'${healthRecordFolder.id}' in parents and name = '${masterFileName}' and trashed = false`;
      const searchRes = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,webViewLink,modifiedTime)&pageSize=1`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      let masterDriveId: string | undefined;
      if (searchRes.ok) {
        const sData = await searchRes.json();
        if (sData.files && sData.files[0]) {
          masterDriveId = sData.files[0].id;
          try {
            const dl = await fetch(`https://www.googleapis.com/drive/v3/files/${masterDriveId}?alt=media`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (dl.ok) {
              const driveMaster = await dl.json();
              if (Array.isArray(driveMaster)) {
                for (const dm of driveMaster) {
                  const key = dm.memberId || dm.id;
                  const local = recordsMap.get(key);
                  if (!local || new Date(dm.updatedAt || 0) > new Date(local.updatedAt || 0)) {
                    recordsMap.set(key, { ...local, ...dm, driveSyncStatus: 'synced' });
                  }
                }
              }
            }
          } catch (e) {
            console.warn('[HealthRecords] Master index download notice:', e);
          }
        }
      }

      // Upload updated Master Index to Drive
      const recordList = Array.from(recordsMap.values()).map((r) => ({
        ...r,
        driveSyncStatus: 'synced' as const,
        lastSyncedAt: new Date().toISOString(),
      }));

      const masterContent = JSON.stringify(recordList, null, 2);
      const boundary = `-------MasterHealthBoundary${Date.now().toString(36)}`;
      const meta = {
        name: masterFileName,
        mimeType: 'application/json',
        ...(!masterDriveId ? { parents: [healthRecordFolder.id] } : {}),
        description: `Family Health Records Master Index. Last synchronized: ${new Date().toISOString()}`,
      };

      const multipartBody =
        `--${boundary}\r\n` +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(meta) +
        `\r\n--${boundary}\r\n` +
        'Content-Type: application/json\r\n\r\n' +
        masterContent +
        `\r\n--${boundary}--`;

      const uploadUrl = masterDriveId
        ? `https://www.googleapis.com/upload/drive/v3/files/${masterDriveId}?uploadType=multipart&fields=id,webViewLink`
        : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink';

      const uploadRes = await fetch(uploadUrl, {
        method: masterDriveId ? 'PATCH' : 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: multipartBody,
      });

      if (uploadRes.ok) {
        const uJson = await uploadRes.json();
        masterDriveId = uJson.id;
      }

      // Sync member specific JSON files into their respective subfolders
      for (const rec of recordList) {
        try {
          const memberFolder = await getOrCreateGoogleDriveFolder(token, rec.memberName, healthRecordFolder.id);
          const memberFileName = `${rec.memberName.toLowerCase()}_health_profile.json`;
          const memberQ = `'${memberFolder.id}' in parents and name = '${memberFileName}' and trashed = false`;
          const mSearch = await fetch(
            `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(memberQ)}&fields=files(id)&pageSize=1`,
            { headers: { Authorization: `Bearer ${token}` } }
          );

          let memFileId: string | undefined;
          if (mSearch.ok) {
            const mData = await mSearch.json();
            if (mData.files && mData.files[0]) {
              memFileId = mData.files[0].id;
            }
          }

          const mBoundary = `-------MemHealth${Date.now().toString(36)}`;
          const mMeta = {
            name: memberFileName,
            mimeType: 'application/json',
            ...(!memFileId ? { parents: [memberFolder.id] } : {}),
          };

          const mBody =
            `--${mBoundary}\r\n` +
            'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
            JSON.stringify(mMeta) +
            `\r\n--${mBoundary}\r\n` +
            'Content-Type: application/json\r\n\r\n' +
            JSON.stringify(rec, null, 2) +
            `\r\n--${mBoundary}--`;

          const mUrl = memFileId
            ? `https://www.googleapis.com/upload/drive/v3/files/${memFileId}?uploadType=multipart&fields=id,webViewLink`
            : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink';

          const mRes = await fetch(mUrl, {
            method: memFileId ? 'PATCH' : 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': `multipart/related; boundary=${mBoundary}`,
            },
            body: mBody,
          });

          if (mRes.ok) {
            const mJson = await mRes.json();
            rec.driveFileId = mJson.id;
            rec.driveWebViewLink = mJson.webViewLink;
          }
        } catch (mErr) {
          console.warn(`[HealthRecords] Sync error for ${rec.memberName}:`, mErr);
        }
      }
    } catch (driveErr) {
      console.warn('[HealthRecords] Drive sync error:', driveErr);
    }
  }

  const finalRecords = Array.from(recordsMap.values());
  const finalDocs = Array.from(docsMap.values());

  saveLocalHealthRecords(finalRecords);
  saveLocalHealthDocuments(finalDocs);

  // Sync merged records to SQLite backend
  try {
    await fetch(getApiUrl('/api/health/records/bulk'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ records: finalRecords, userEmail }),
    });
  } catch {}

  return {
    records: finalRecords,
    documents: finalDocs,
    status: token ? 'synced' : 'local_only',
    folderLink: rootFolderLink,
  };
}
