// Global Universal Search Engine (Apps + Local Context + SQLite Vaults + Drive Mirror)

import { TabKey } from '../components/BottomNav';
import { EisenhowerTask, FamilyMember, Transaction } from '../types';
import { getApiUrl } from './api';
import { getLocalReminders } from './reminderDriveSync';

export interface UniversalSearchResultItem {
  id: string;
  category:
    | 'app'
    | 'language_tutor'
    | 'adaptive_learning'
    | 'smart_document'
    | 'reminder'
    | 'drive_file'
    | 'task'
    | 'finance'
    | 'family'
    | 'memory_note';
  title: string;
  subtitle: string;
  iconEmoji: string;
  targetTab: TabKey | 'smart-doc-modal';
  deepLink?: Record<string, any>;
}

const APP_SHORTCUTS: UniversalSearchResultItem[] = [
  {
    id: 'app-home',
    category: 'app',
    title: 'Home Hub Dashboard',
    subtitle: 'Overview, Quick Launch & Family Pulse',
    iconEmoji: '🏠',
    targetTab: 'home',
  },
  {
    id: 'app-lang-tutor',
    category: 'app',
    title: 'Live Language Tutor (English & தமிழ்)',
    subtitle: 'Prof. Clara & ஆசிரியர் கலைவாணி · Hands-Free Call, Tracing, Clinic, Certs',
    iconEmoji: '🗣️',
    targetTab: 'language-tutor',
  },
  {
    id: 'app-adaptive',
    category: 'app',
    title: 'AI Classroom & Kids Math Practice (Ages 6–10)',
    subtitle: 'Smart Whiteboard, Tables 1–10, Clock, Fractions, ₹ Money, Python & Custom Subject',
    iconEmoji: '🎓',
    targetTab: 'adaptive-learning',
  },
  {
    id: 'app-receipt-scanner',
    category: 'smart_document',
    title: 'AI Receipt, Bill & Warranty Scanner',
    subtitle: 'Snap receipt → Auto-Finance Hub expense & warranty reminder',
    iconEmoji: '🧾',
    targetTab: 'smart-doc-modal',
    deepLink: { docType: 'receipt_warranty' },
  },
  {
    id: 'app-prescription-analyzer',
    category: 'smart_document',
    title: 'AI Prescription & Lab Report Analyzer',
    subtitle: 'Scan prescription/lab PDF → Bilingual (EN/தமிழ்) summary & auto medication schedule',
    iconEmoji: '🩺',
    targetTab: 'smart-doc-modal',
    deepLink: { docType: 'prescription_lab' },
  },
  {
    id: 'app-health',
    category: 'app',
    title: 'Health & Wellness Hub',
    subtitle: 'Fever Tracker, Medications, Hydration & Walking Steps',
    iconEmoji: '❤️',
    targetTab: 'wellness',
  },
  {
    id: 'app-finance',
    category: 'app',
    title: 'Wealth & Finance Hub',
    subtitle: 'Expenses, Investments, Budgets & Receipt Transactions',
    iconEmoji: '💰',
    targetTab: 'finance',
  },
  {
    id: 'app-clock',
    category: 'app',
    title: 'World Clock, Alarms & Reminders',
    subtitle: 'Family Circle Reminders, Medication Alerts & Timers',
    iconEmoji: '⏰',
    targetTab: 'clock',
  },
  {
    id: 'app-google',
    category: 'app',
    title: 'Google Workspace & 2TB Drive',
    subtitle: 'Gmail, Google Drive, Calendar & Google One',
    iconEmoji: '☁️',
    targetTab: 'google',
  },
  {
    id: 'app-scanner',
    category: 'app',
    title: 'Adobe Document Scanner',
    subtitle: 'Multi-page PDF scanning & OCR archive',
    iconEmoji: '📄',
    targetTab: 'scanner',
  },
  {
    id: 'app-translate',
    category: 'app',
    title: 'Real-Time Polyglot Translator',
    subtitle: 'English ⇄ Tamil & 12+ languages live translation',
    iconEmoji: '🌐',
    targetTab: 'translate',
  },
  {
    id: 'app-weather',
    category: 'app',
    title: 'Weather Forecast',
    subtitle: 'Live local temperature, hourly & 7-day forecast',
    iconEmoji: '⛅',
    targetTab: 'weather',
  },
  {
    id: 'app-navigation',
    category: 'app',
    title: 'Google Navigation & Offline Maps',
    subtitle: 'Multi-modal transit, driving & offline routes',
    iconEmoji: '🗺️',
    targetTab: 'navigation',
  },
  {
    id: 'app-family',
    category: 'app',
    title: 'Family Radar & Safety SOS',
    subtitle: 'Live family locations, geofences & intercom',
    iconEmoji: '👨‍👩‍👧‍👦',
    targetTab: 'family',
  },
  {
    id: 'app-productivity',
    category: 'app',
    title: 'Eisenhower Tasks & Productivity',
    subtitle: 'Priority matrix & family to-dos',
    iconEmoji: '✅',
    targetTab: 'productivity',
  },
  {
    id: 'app-vault',
    category: 'app',
    title: 'Encrypted Memory Vault',
    subtitle: 'Private notes & family secrets',
    iconEmoji: '🔐',
    targetTab: 'vault',
  },
  {
    id: 'app-ai-studio',
    category: 'app',
    title: 'Gemini Multi-Modal AI Studio',
    subtitle: 'Image, video, audio & guided learning creations',
    iconEmoji: '✨',
    targetTab: 'ai-studio',
  },
];

export function getDefaultQuickSearchItems(): UniversalSearchResultItem[] {
  return APP_SHORTCUTS.slice(0, 8);
}

export async function runGlobalUniversalSearch(params: {
  query: string;
  userEmail?: string;
  tasks: EisenhowerTask[];
  transactions: Transaction[];
  familyMembers: FamilyMember[];
}): Promise<UniversalSearchResultItem[]> {
  const q = params.query.trim().toLowerCase();
  if (!q) return getDefaultQuickSearchItems();

  const results: UniversalSearchResultItem[] = [];

  // 1. Instant App & Feature Shortcuts
  for (const app of APP_SHORTCUTS) {
    if (app.title.toLowerCase().includes(q) || app.subtitle.toLowerCase().includes(q)) {
      results.push(app);
    }
  }

  // 2. Local Tasks, Transactions, Family Members & Reminders
  for (const t of params.tasks || []) {
    if (t.title.toLowerCase().includes(q) || t.category.toLowerCase().includes(q)) {
      results.push({
        id: `task-${t.id}`,
        category: 'task',
        title: t.title,
        subtitle: `Task · ${t.category} (${t.completed ? 'Done' : 'Pending'})`,
        iconEmoji: '✅',
        targetTab: 'productivity',
      });
    }
  }

  for (const tx of params.transactions || []) {
    if (tx.title.toLowerCase().includes(q) || tx.category.toLowerCase().includes(q)) {
      results.push({
        id: `tx-${tx.id}`,
        category: 'finance',
        title: tx.title,
        subtitle: `Finance · ${tx.category} · ${tx.type === 'income' ? '+' : '-'}${tx.amount}`,
        iconEmoji: '💳',
        targetTab: 'finance',
      });
    }
  }

  for (const m of params.familyMembers || []) {
    if (m.name.toLowerCase().includes(q) || m.relationship.toLowerCase().includes(q)) {
      results.push({
        id: `fam-${m.id}`,
        category: 'family',
        title: `${m.name} (${m.relationship})`,
        subtitle: `Family Radar · ${m.liveLocation?.status || 'Active'}`,
        iconEmoji: '📍',
        targetTab: 'family',
      });
    }
  }

  for (const rem of getLocalReminders()) {
    if (rem.title.toLowerCase().includes(q) || (rem.notes || '').toLowerCase().includes(q)) {
      results.push({
        id: `lrem-${rem.id}`,
        category: 'reminder',
        title: rem.title,
        subtitle: `Reminder · ${rem.dueDate} ${rem.dueTime}`,
        iconEmoji: '⏰',
        targetTab: 'clock',
      });
    }
  }

  // 3. Live SQLite Multi-Table Search (/api/universal-search)
  try {
    const qs = `q=${encodeURIComponent(params.query.trim())}${
      params.userEmail ? `&userEmail=${encodeURIComponent(params.userEmail)}` : ''
    }`;
    const res = await fetch(getApiUrl(`/api/universal-search?${qs}`));
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.hits)) {
        const iconMap: Record<string, string> = {
          language_tutor: '🗣️',
          adaptive_learning: '🖍️',
          smart_document: '🧾',
          reminder: '⏰',
          drive_file: '☁️',
          voice_memo: '🎙️',
          memory_note: '🔐',
        };
        for (const h of data.hits) {
          results.push({
            id: h.id,
            category: h.category,
            title: h.title,
            subtitle: h.subtitle,
            iconEmoji: iconMap[h.category] || '🔎',
            targetTab: h.targetTab as TabKey | 'smart-doc-modal',
            deepLink: h.deepLink,
          });
        }
      }
    }
  } catch {}

  // Deduplicate by title+targetTab
  const seen = new Set<string>();
  return results
    .filter((r) => {
      const k = `${r.targetTab}:${r.title.toLowerCase()}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, 24);
}
