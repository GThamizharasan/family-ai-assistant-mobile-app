// Unified Types for All 5 Family Life Suite Bundles
// Persisted across LocalStorage + SQLite (/api/family-life/records) + Google Drive (Family Circle / Family Life Suite)

export type FamilyLifeDomain =
  | 'identity_doc'
  | 'trip_plan'
  | 'offline_ticket'
  | 'kitchen_recipe'
  | 'grocery_item'
  | 'meal_plan'
  | 'homework_session'
  | 'school_event'
  | 'chore_habit'
  | 'reward_item'
  | 'growth_entry'
  | 'vaccine_record'
  | 'medical_card'
  | 'lab_manual_point';

export interface FamilyLifeRecord<T = any> {
  id: string;
  userEmail: string;
  domain: FamilyLifeDomain;
  title: string;
  subtitle?: string;
  memberName?: string;
  dueOrExpiryDate?: string | null;
  payload: T;
  driveWebViewLink?: string;
  syncedToSqlite?: boolean;
  syncedToDrive?: boolean;
  createdAt: string;
  updatedAt: string;
}

// ---------------- BUNDLE 1: IDENTITY, TRAVEL & EXPIRY VAULT ----------------
export type IdentityDocCategory =
  | 'Passport'
  | 'Visa / BRP'
  | 'NHS / Aadhaar'
  | 'Driving Licence'
  | 'Health Insurance'
  | 'Motor / Home Insurance'
  | 'Other Official ID';

export interface IdentityDocPayload {
  docCategory: IdentityDocCategory;
  holderName: string;
  documentNumber: string;
  issuingAuthority: string;
  country: string;
  issueDate?: string;
  expiryDate: string;
  linkedMediaId?: string;
  thumbnailDataUrl?: string;
  remindersScheduled?: boolean;
  notes?: string;
}

export interface TripPackingItem {
  id: string;
  label: string;
  category: 'Documents' | 'Kids' | 'Clothing' | 'Meds & Toiletries' | 'Tech';
  packed: boolean;
}

export interface TripItineraryDay {
  day: number;
  title: string;
  morning: string;
  afternoon: string;
  evening: string;
  kidsTip?: string;
}

export interface TripPlanPayload {
  destination: string;
  startDate: string;
  endDate: string;
  travelers: string;
  estimatedBudget: number;
  currency: string;
  loggedToFinance?: boolean;
  itinerary: TripItineraryDay[];
  packingList: TripPackingItem[];
}

export interface OfflineTicketPayload {
  tripName: string;
  carrierOrVenue: string;
  passengerName: string;
  departureDate: string;
  seatOrGate?: string;
  bookingRef: string;
  fileDataUrl?: string; // Cached locally in SQLite for airport offline access!
  mimeType?: string;
}

// ---------------- BUNDLE 2: SMART KITCHEN, GROCERY & MEAL PLANNER ----------------
export interface KitchenRecipePayload {
  cuisine: 'South Indian / Tamil' | 'North Indian' | 'International' | 'Kids Healthy Snack';
  prepMinutes: number;
  servings: number;
  healthTags: string[];
  titleTamil: string;
  summaryEnglish: string;
  summaryTamil: string;
  ingredients: string[];
  stepsEnglish: string[];
  stepsTamil: string[];
  caloriesPerServing?: number;
}

export interface GroceryPricePoint {
  date: string;
  price: number;
  vendor?: string;
}

export interface GroceryItemPayload {
  category: 'Produce' | 'Dairy & Eggs' | 'Spices & Dal' | 'Grains & Rice' | 'Kids & Snacks' | 'Household';
  quantity: string;
  checked: boolean;
  lowStockAutoRestock?: boolean;
  lastBoughtDate?: string;
  latestPrice?: number;
  currency?: string;
  priceHistory: GroceryPricePoint[];
}

export interface DayMealSlot {
  day: string; // Monday..Sunday
  breakfast: string;
  kidsLunchbox: string;
  dinner: string;
  tamilHighlight?: string;
}

export interface WeeklyMealPlanPayload {
  weekStart: string;
  healthFocus: string;
  days: DayMealSlot[];
  suggestedGroceries: string[];
}

// ---------------- BUNDLE 3: KIDS HOMEWORK, SCHOOL & CHORE REWARD HUB ----------------
export interface HomeworkCoachPayload {
  subject: 'Maths' | 'Science' | 'English' | 'Tamil' | 'General';
  childName: string;
  problemExtracted: string;
  conceptName: string;
  hint1: string;
  hint2: string;
  stepByStepGuide: string[];
  tamilExplanation: string;
  verificationCheckAnswer: string;
  savedToClassroom?: boolean;
}

export interface SchoolEventPayload {
  eventType: 'Exam' | 'Circular / Event' | 'Library Book Return' | 'Uniform / PE Kit';
  childName: string;
  subjectOrItem: string;
  eventDate: string;
  dayOfWeek?: string;
  kitOrActionNote: string;
  completed?: boolean;
}

export interface ChoreHabitPayload {
  childName: string;
  icon: string;
  starsReward: number;
  completedDates: string[]; // YYYY-MM-DD
}

export interface KidsRewardPayload {
  childName: string;
  costStars: number;
  icon: string;
  redeemedCount: number;
}

// ---------------- BUNDLE 4: LONGITUDINAL HEALTH, GROWTH & DOCTOR PACK ----------------
export interface GrowthEntryPayload {
  childName: string;
  ageMonths: number;
  recordedDate: string;
  heightCm: number;
  weightKg: number;
  bmi: number;
  percentileBand: string;
  notes?: string;
}

export interface VaccineRecordPayload {
  childName: string;
  vaccineName: string;
  ageStage: string; // e.g. "Birth", "6 Weeks", "12 Months", "3 Years 4 Months"
  scheduleSystem: 'NHS UK & IAP';
  dueDate?: string;
  completed: boolean;
  completedDate?: string;
}

export interface EmergencyMedicalCardPayload {
  memberName: string;
  dateOfBirth: string;
  bloodGroup: string;
  nhsOrHealthId?: string;
  allergies: string[];
  chronicConditions: string[];
  activeMedications: string[];
  emergencyContactName: string;
  emergencyContactPhone: string;
  gpOrDoctorName?: string;
}

export interface LabManualPointPayload {
  memberName: string;
  markerName: string;
  valueNumeric: number;
  unit: string;
  recordedDate: string;
  normalMin?: number;
  normalMax?: number;
}
