// Family Health Record & Wellness Types
// Sovereign Family Circle Health Vault, Vitals, Medications, and Medical Documents

export type BloodGroup = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-' | 'Unknown';

export type AllergySeverity = 'mild' | 'moderate' | 'severe' | 'anaphylaxis';

export interface AllergyEntry {
  id: string;
  allergen: string;
  category: 'medication' | 'food' | 'environmental' | 'other';
  severity: AllergySeverity;
  reaction: string;
  diagnosedDate?: string;
  notes?: string;
}

export interface ChronicCondition {
  id: string;
  name: string;
  diagnosedDate: string;
  status: 'active' | 'managed' | 'resolved';
  treatingDoctor?: string;
  carePlanNotes?: string;
}

export interface VitalSignEntry {
  id: string;
  timestamp: string; // ISO string
  recordedBy: string;
  systolicBp?: number; // mmHg
  diastolicBp?: number; // mmHg
  heartRate?: number; // bpm
  sleepHours?: number; // hours slept
  sleepQuality?: 'deep' | 'restful' | 'average' | 'disrupted';
  deepSleepMinutes?: number; // minutes of deep restorative sleep
  bloodGlucose?: number; // mg/dL
  glucoseContext?: 'fasting' | 'post-meal' | 'random';
  oxygenSpO2?: number; // %
  bodyTemperature?: number; // °F
  weightKg?: number; // kg
  bmi?: number;
  notes?: string;
}

export type FeverSeverity = 'normal' | 'low' | 'moderate' | 'high' | 'hyperpyrexia';

export interface FeverReadingGroup {
  id: string;
  memberId: string;
  memberName: string;
  groupName: string; // e.g. 'Viral Flu Episode (Nov 2026)'
  startDate: string; // ISO string
  endDate?: string; // ISO string when fever episode has resolved
  isActive: boolean;
  notes?: string;
  recordedBy?: string;
  driveFolderId?: string;
  driveWebViewLink?: string;
  driveSyncStatus?: 'synced' | 'local_only' | 'pending';
  createdAt: string;
}

export type FeverEpisode = FeverReadingGroup;

export interface FeverLogEntry {
  id: string;
  memberId: string;
  memberName: string;
  readingGroupId?: string;
  readingGroupName?: string;
  timestamp: string; // ISO string
  temperatureF: number; // e.g. 101.4 °F
  temperatureC: number; // e.g. 38.6 °C
  measurementMethod: 'oral' | 'forehead' | 'tympanic_ear' | 'axillary_armpit' | 'rectal';
  severity: FeverSeverity;
  symptoms: string[];
  medicationGiven?: {
    name: string; // e.g. 'Paracetamol (Calpol 250mg)'
    dose: string;
    givenAt: string;
  };
  notes?: string;
  recordedBy: string;
  driveFileId?: string;
  driveWebViewLink?: string;
  driveSyncStatus?: 'synced' | 'local_only' | 'pending';
  createdAt: string;
}

export type MedicationCategory = 'prescription' | 'supplement' | 'vitamin' | 'ayurvedic' | 'over_the_counter';
export type MedicationForm = 'tablet' | 'capsule' | 'syrup' | 'injection' | 'drops' | 'powder' | 'inhaler';
export type MedicationTiming = 'before_meal' | 'after_meal' | 'with_food' | 'empty_stomach' | 'anytime';
export type MedicationDoseStatus = 'taken' | 'skipped' | 'snoozed' | 'pending';

export interface MedicationEntry {
  id: string;
  drugName: string;
  category?: MedicationCategory;
  form?: MedicationForm;
  dosage: string; // e.g. "500mg" or "1 capsule"
  frequency: string; // e.g. "Twice daily after meals"
  timeSlots: ('morning' | 'afternoon' | 'evening' | 'bedtime')[];
  timing?: MedicationTiming;
  scheduledTime?: string; // e.g. "08:00 AM"
  prescribedBy?: string;
  startDate: string;
  endDate?: string;
  purpose: string;
  pillsRemaining?: number;
  refillThreshold?: number; // e.g. alert when <= 5
  refillDate?: string;
  instructions?: string;
  reminderEnabled: boolean;
  takenToday?: {
    morning?: boolean;
    afternoon?: boolean;
    evening?: boolean;
    bedtime?: boolean;
  };
}

export interface MedicationDoseLog {
  id: string;
  userEmail?: string;
  memberId: string;
  memberName: string;
  medicationId: string;
  drugName: string;
  category?: MedicationCategory;
  dosage: string;
  timeSlot: 'morning' | 'afternoon' | 'evening' | 'bedtime';
  scheduledTime?: string;
  loggedAt: string; // ISO string
  status: MedicationDoseStatus;
  loggedBy: string; // e.g. "Auro AI Voice" | "Self"
  notes?: string;
  pillsRemaining?: number;
  driveFileId?: string;
  driveWebViewLink?: string;
  driveSyncStatus?: 'synced' | 'local_only' | 'pending';
  createdAt: string;
}

export type BeverageType =
  | 'water'
  | 'electrolyte'
  | 'herbal_tea'
  | 'coconut_water'
  | 'lemon_water'
  | 'soup_broth';

export interface HydrationLogEntry {
  id: string;
  userEmail?: string;
  memberId: string;
  memberName: string;
  timestamp: string; // ISO string
  amountMl: number; // e.g. 250, 500, 750
  beverageType: BeverageType;
  container: 'glass_250' | 'bottle_500' | 'sports_750' | 'carafe_1000' | 'custom';
  dailyGoalMl: number; // e.g. 2800
  notes?: string;
  loggedBy: string; // e.g. "Auro AI Voice" | "Self"
  driveFileId?: string;
  driveWebViewLink?: string;
  driveSyncStatus?: 'synced' | 'local_only' | 'pending';
  createdAt: string;
}

export interface VaccinationEntry {
  id: string;
  vaccineName: string;
  dateAdministered: string;
  doseNumber: number;
  totalDoses?: number;
  administeredBy?: string;
  nextBoosterDue?: string;
  batchNumber?: string;
  status: 'completed' | 'upcoming' | 'overdue';
}

export type HealthDocumentCategory =
  | 'lab_report'
  | 'prescription'
  | 'discharge_summary'
  | 'diagnostic_imaging'
  | 'vaccination_card'
  | 'insurance_card'
  | 'doctor_note'
  | 'other';

export interface HealthDocument {
  id: string;
  memberId: string;
  memberName: string;
  title: string;
  category: HealthDocumentCategory;
  documentDate: string;
  doctorOrFacility?: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  driveFileId?: string;
  driveWebViewLink?: string;
  driveFolderPath: string;
  driveSyncStatus: 'synced' | 'local_only' | 'syncing' | 'error';
  fileContentBase64?: string; // Stored in SQLite for sovereign offline viewing
  notes?: string;
  aiSummary?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FamilyHealthRecord {
  id: string;
  memberId: string;
  memberName: string;
  relationship: string;
  avatar?: string;
  dateOfBirth?: string;
  age?: number;
  gender?: 'male' | 'female' | 'other';
  bloodGroup: BloodGroup;
  heightCm?: number;
  weightKg?: number;
  allergies: AllergyEntry[];
  conditions: ChronicCondition[];
  vitalsHistory: VitalSignEntry[];
  medications: MedicationEntry[];
  vaccinations: VaccinationEntry[];
  emergencyContact: {
    name: string;
    relationship: string;
    phone: string;
  };
  primaryDoctor?: {
    name: string;
    clinic: string;
    phone: string;
    email?: string;
  };
  insurance?: {
    provider: string;
    policyNumber: string;
    groupNumber?: string;
    validThru?: string;
  };
  organDonor?: boolean;
  notes?: string;
  driveFileId?: string;
  driveWebViewLink?: string;
  driveFolderPath: string;
  driveSyncStatus: 'synced' | 'local_only' | 'syncing' | 'error';
  lastSyncedAt?: string;
  createdAt: string;
  updatedAt: string;
}
