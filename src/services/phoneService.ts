import { PhoneContact, CallLogItem } from '../types';

// DTMF Frequency Map (Standard Telephony)
const DTMF_FREQUENCIES: Record<string, [number, number]> = {
  '1': [697, 1209],
  '2': [697, 1336],
  '3': [697, 1477],
  '4': [770, 1209],
  '5': [770, 1336],
  '6': [770, 1477],
  '7': [852, 1209],
  '8': [852, 1336],
  '9': [852, 1477],
  '*': [941, 1209],
  '0': [941, 1336],
  '#': [941, 1477],
};

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  try {
    if (!audioCtx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        audioCtx = new AudioCtx();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  } catch {
    return null;
  }
}

/**
 * Play authentic dual-tone multi-frequency (DTMF) dialpad sound
 */
export function playDtmfTone(key: string, durationMs = 120): void {
  const freqs = DTMF_FREQUENCIES[key];
  if (!freqs) return;

  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const [f1, f2] = freqs;
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(f1, now);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(f2, now);

    gainNode.gain.setValueAtTime(0.12, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + durationMs / 1000);

    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + durationMs / 1000);
    osc2.stop(now + durationMs / 1000);
  } catch (err) {
    console.debug('DTMF audio not allowed without user gesture:', err);
  }
}

/**
 * Play ringing tone simulation
 */
export function playRingTone(): () => void {
  const ctx = getAudioContext();
  if (!ctx) return () => {};

  let isPlaying = true;
  let timerId: any = null;

  const ringCycle = () => {
    if (!isPlaying) return;
    try {
      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(440, now);
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(480, now);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.setValueAtTime(0.08, now + 1.2);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.3);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 1.3);
      osc2.stop(now + 1.3);
    } catch {
      // Audio context error
    }

    timerId = setTimeout(ringCycle, 3500);
  };

  ringCycle();

  return () => {
    isPlaying = false;
    if (timerId) clearTimeout(timerId);
  };
}

/**
 * Check if the browser supports the native Contact Picker API
 */
export function isDeviceContactPickerSupported(): boolean {
  return typeof navigator !== 'undefined' && 'contacts' in navigator && 'ContactsManager' in window;
}

/**
 * Request contacts directly from the device's native address book
 */
export async function pickDeviceContacts(): Promise<PhoneContact[]> {
  if (isDeviceContactPickerSupported()) {
    try {
      const props = ['name', 'tel', 'email', 'icon'];
      const opts = { multiple: true };
      const selected = await (navigator as any).contacts.select(props, opts);

      if (Array.isArray(selected) && selected.length > 0) {
        return selected.map((item, idx) => {
          const rawName = Array.isArray(item.name) ? item.name[0] : item.name || `Device Contact ${idx + 1}`;
          const rawPhone = Array.isArray(item.tel) ? item.tel[0] : item.tel || '';
          const rawEmail = Array.isArray(item.email) ? item.email[0] : item.email || '';
          
          let avatarUrl = '';
          if (item.icon && item.icon.length > 0) {
            try {
              avatarUrl = URL.createObjectURL(item.icon[0]);
            } catch {
              // fallback avatar
            }
          }

          return {
            id: `dev-contact-${Date.now()}-${idx}`,
            name: rawName,
            phone: rawPhone || '+1 (555) 000-0000',
            email: rawEmail,
            avatar: avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(rawName)}&background=0D9488&color=fff`,
            relationship: 'Mobile Phone Contact',
            category: 'personal',
            source: 'device',
            isFavorite: false,
          };
        });
      }
    } catch (err: any) {
      if (err.name !== 'TypeError' && err.name !== 'AbortError') {
        console.warn('Native Contact Picker result notice:', err);
      }
    }
  }

  return [];
}

/**
 * Make a direct phone call using the native cellular/carrier protocol handler
 */
export function makeNativeDirectCall(phoneNumber: string): void {
  const cleanPhone = phoneNumber.replace(/[^0-9+*#]/g, '');
  if (!cleanPhone) return;

  // Triggers native mobile dialer / phone app directly
  window.location.href = `tel:${cleanPhone}`;
}

/**
 * Simple vCard (.vcf) parser for fallback contact import
 */
export function parseVCardContent(vcfString: string): PhoneContact[] {
  const contacts: PhoneContact[] = [];
  const cards = vcfString.split(/BEGIN:VCARD/i).filter((c) => c.trim().length > 0);

  cards.forEach((card, idx) => {
    let name = '';
    let phone = '';
    let email = '';

    const lines = card.split(/\r?\n/);
    lines.forEach((line) => {
      if (line.startsWith('FN:')) {
        name = line.substring(3).trim();
      } else if (!name && line.startsWith('N:')) {
        const parts = line.substring(2).split(';');
        name = parts.filter(Boolean).reverse().join(' ').trim();
      } else if (line.match(/^TEL/i)) {
        const parts = line.split(':');
        if (parts.length > 1) {
          phone = parts.slice(1).join(':').trim();
        }
      } else if (line.match(/^EMAIL/i)) {
        const parts = line.split(':');
        if (parts.length > 1) {
          email = parts.slice(1).join(':').trim();
        }
      }
    });

    if (name || phone) {
      contacts.push({
        id: `vcf-contact-${Date.now()}-${idx}`,
        name: name || phone,
        phone: phone || '+1 555 0100',
        email,
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'Contact')}&background=4338CA&color=fff`,
        relationship: 'Imported Phone Contact',
        category: 'personal',
        source: 'device',
        isFavorite: false,
      });
    }
  });

  return contacts;
}

// Initial pre-synced executive phone directory
export const INITIAL_PHONE_CONTACTS: PhoneContact[] = [
  {
    id: 'pc-selvapriya',
    name: 'Selvapriya (Spouse)',
    phone: '+91 96779 01342',
    email: 'selvapriya.family@gmail.com',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
    relationship: 'Spouse',
    category: 'family',
    source: 'google',
    isFavorite: true,
    notes: 'Priority Line. Master home & family coordination.',
  },
  {
    id: 'pc-maaran',
    name: 'Maaran (Son)',
    phone: '+44 7721 877710',
    email: 'maaran.k@gmail.com',
    avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80',
    relationship: 'Son',
    category: 'family',
    source: 'google',
    isFavorite: true,
    notes: 'Robotics Academy & AI study tracking (UK Line).',
  },
  {
    id: 'pc-sequoia',
    name: 'Arjun Mehta (Sequoia Capital)',
    phone: '+1 415 890 2234',
    email: 'arjun.mehta@sequoiacap.com',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    relationship: 'Venture Partner',
    category: 'business',
    source: 'google',
    isFavorite: true,
    notes: 'Series B Escrow & Lead Board Director.',
  },
  {
    id: 'pc-delaware-trust',
    name: 'Delaware Family Trust Counsel',
    phone: '+1 302 445 9012',
    email: 'counsel@delawarefamilytrust.org',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
    relationship: 'Estate Counsel',
    category: 'business',
    source: 'google',
    isFavorite: true,
    notes: 'Sovereign wealth charter & Q4 municipal surplus sign-offs.',
  },
  {
    id: 'pc-physician',
    name: 'Dr. R. Sundaram (Family Physician)',
    phone: '+91 98401 11223',
    email: 'dr.sundaram@chennaimedical.in',
    avatar: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=150&auto=format&fit=crop&q=80',
    relationship: 'Lead Physician',
    category: 'medical',
    source: 'google',
    isFavorite: false,
    notes: 'Family preventive health & annual executive biometrics.',
  },
  {
    id: 'pc-security',
    name: 'Commander Vikram (Executive Protection)',
    phone: '+91 98401 99887',
    email: 'security.operations@digitaltamilworld.com',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    relationship: 'Security Chief',
    category: 'security',
    source: 'google',
    isFavorite: false,
    notes: '24/7 sovereign estate radar, smart perimeter & SOS dispatch.',
  },
  {
    id: 'pc-morgan-stanley',
    name: 'Morgan Stanley Private Sovereign Desk',
    phone: '+1 212 555 0199',
    email: 'privatewealth@morganstanley.com',
    avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80',
    relationship: 'Wealth Advisor',
    category: 'business',
    source: 'google',
    isFavorite: false,
    notes: 'Treasury yields, municipal debt sweeps, and liquid escrow.',
  },
];

// Initial seeded recent call logs
export const INITIAL_CALL_LOGS: CallLogItem[] = [
  {
    id: 'cl-1',
    contactName: 'Selvapriya (Spouse)',
    phone: '+91 96779 01342',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
    relationship: 'Spouse',
    timestamp: 'Today, 08:35 AM',
    durationSeconds: 142,
    type: 'outgoing',
    notes: 'Coordinated Maaran’s robotics demo and confirmed 8:30 PM dinner celebration.',
    aiSummary: 'Confirmed 8:30 PM dinner together. Selvapriya mentioned Maaran solved the pathfinding simulation earlier today.',
    actionItems: ['Be home by 8:30 PM for celebration dinner', 'Pick up fresh dessert from organic store'],
    sentiment: 'affectionate & supportive',
  },
  {
    id: 'cl-2',
    contactName: 'Arjun Mehta (Sequoia Capital)',
    phone: '+1 415 890 2234',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    relationship: 'Venture Partner',
    timestamp: 'Yesterday, 05:15 PM',
    durationSeconds: 380,
    type: 'incoming',
    notes: 'Reviewed Series B closing protocol, legal escrow receipt, and board schedule.',
    aiSummary: 'Sequoia legal confirmed escrow synchronization. Scheduled 10-minute briefing for final signature packet.',
    actionItems: ['Review legal signature docket', 'Coordinate with Delaware trust counsel'],
    sentiment: 'decisive & high-velocity',
  },
  {
    id: 'cl-3',
    contactName: 'Delaware Family Trust Counsel',
    phone: '+1 302 445 9012',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
    relationship: 'Estate Counsel',
    timestamp: 'Yesterday, 11:20 AM',
    durationSeconds: 215,
    type: 'outgoing',
    notes: 'Q4 municipal surplus sweep authorization ($35,000) verification.',
    aiSummary: 'Counsel confirmed all beneficiaries match the Digital Tamil World sovereign trust charter.',
    actionItems: ['Authorize surplus sweep electronic sign-off in Vault'],
    sentiment: 'governance & precise',
  },
];
