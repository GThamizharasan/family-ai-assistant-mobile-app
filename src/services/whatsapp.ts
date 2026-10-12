import { WhatsAppContact, WhatsAppMessage, WhatsAppAccountConfig } from '../types';
import { speechEngine } from './speech';

export const INITIAL_WHATSAPP_CONFIG: WhatsAppAccountConfig = {
  isConnected: true,
  linkedPhone: '+91 98401 23456',
  accountName: 'Thamiz (Primary Account)',
  pairedAt: 'Today, 08:30 AM via WhatsApp Web Bridge',
  autoDraftWithAura: true,
  autoVoiceRead: true,
  pairingCode: 'AURA-WA-7821',
};

export const INITIAL_WHATSAPP_CONTACTS: WhatsAppContact[] = [
  {
    id: 'wa-contact-selvapriya',
    name: 'Selvapriya (Spouse)',
    phone: '+91 98401 54321',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
    relationship: 'Spouse',
    lastMessageTime: '10:14 AM',
    unreadCount: 1,
    isOnline: true,
    category: 'family',
    lastMessagePreview: 'Maaran finished his robotics project early! Are we having dinner together at 8:30 PM?',
  },
  {
    id: 'wa-contact-maaran',
    name: 'Maaran (Son)',
    phone: '+91 98401 87654',
    avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80',
    relationship: 'Son',
    lastMessageTime: '09:48 AM',
    unreadCount: 1,
    isOnline: true,
    category: 'family',
    lastMessagePreview: 'Dad, I solved the AI simulation we talked about! Can I show it to you tonight?',
  },
  {
    id: 'wa-contact-sequoia',
    name: 'Arjun Mehta (Sequoia Capital)',
    phone: '+1 415 890 2234',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    relationship: 'Venture Partner',
    lastMessageTime: '09:15 AM',
    unreadCount: 1,
    isOnline: false,
    category: 'business',
    lastMessagePreview: 'Series B escrow verification completed. Do you have 5 mins tomorrow at 9:30 AM?',
  },
  {
    id: 'wa-contact-delaware',
    name: 'Delaware Family Trust Counsel',
    phone: '+1 302 445 9012',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
    relationship: 'Estate Counsel',
    lastMessageTime: 'Yesterday',
    unreadCount: 0,
    isOnline: false,
    category: 'business',
    lastMessagePreview: 'The Q4 municipal surplus sweep ($35k) documentation is ready for electronic sign-off.',
  },
  {
    id: 'wa-contact-family-group',
    name: 'Thamiz Family Circle 🌟',
    phone: '+91 98401 00000',
    avatar: 'https://images.unsplash.com/photo-1511895426328-dc8714191300?w=150&auto=format&fit=crop&q=80',
    relationship: 'Family Group',
    lastMessageTime: 'Yesterday',
    unreadCount: 0,
    isOnline: true,
    category: 'groups',
    lastMessagePreview: 'Selvapriya: Don’t forget our Sunday family morning wellness walk at 6:30 AM!',
  },
];

export const INITIAL_WHATSAPP_MESSAGES: WhatsAppMessage[] = [
  // Conversation with Selvapriya
  {
    id: 'wa-msg-101',
    contactId: 'wa-contact-selvapriya',
    contactName: 'Selvapriya (Spouse)',
    contactPhone: '+91 98401 54321',
    contactAvatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
    relationship: 'Spouse',
    text: 'Good morning Thamiz! Sent you the kids schedule for this weekend.',
    timestamp: '08:15 AM',
    isOutgoing: false,
    status: 'read',
    category: 'family',
  },
  {
    id: 'wa-msg-102',
    contactId: 'wa-contact-selvapriya',
    contactName: 'Selvapriya (Spouse)',
    contactPhone: '+91 98401 54321',
    text: 'Thank you Selvapriya. Scheduled into our master calendar! How is Maaran’s robotics class going?',
    timestamp: '08:22 AM',
    isOutgoing: true,
    status: 'read',
    category: 'family',
  },
  {
    id: 'wa-msg-103',
    contactId: 'wa-contact-selvapriya',
    contactName: 'Selvapriya (Spouse)',
    contactPhone: '+91 98401 54321',
    contactAvatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
    relationship: 'Spouse',
    text: 'Maaran finished his robotics project early! Are we having dinner together at 8:30 PM, or are you in an executive review block?',
    timestamp: '10:14 AM',
    isOutgoing: false,
    status: 'read',
    urgency: 'normal',
    category: 'family',
    suggestedReplies: [
      'Yes! Wrapping up my deep work block now. Let’s celebrate Maaran’s project at 8:30 PM.',
      'I’m finishing the term sheet review. I’ll be home by 8:45 PM with dessert for Maaran!',
      'Dinner at 8:30 PM sounds wonderful. Please tell Maaran I can’t wait to see his project.',
    ],
  },

  // Conversation with Maaran
  {
    id: 'wa-msg-201',
    contactId: 'wa-contact-maaran',
    contactName: 'Maaran (Son)',
    contactPhone: '+91 98401 87654',
    contactAvatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80',
    relationship: 'Son',
    text: 'Dad, remember the A* pathfinding algorithm you explained last Sunday?',
    timestamp: '09:20 AM',
    isOutgoing: false,
    status: 'read',
    category: 'family',
  },
  {
    id: 'wa-msg-202',
    contactId: 'wa-contact-maaran',
    contactName: 'Maaran (Son)',
    contactPhone: '+91 98401 87654',
    contactAvatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80',
    relationship: 'Son',
    text: 'Dad, I solved the AI simulation we talked about! Can I show it to you tonight?',
    timestamp: '09:48 AM',
    isOutgoing: false,
    status: 'read',
    urgency: 'normal',
    category: 'family',
    suggestedReplies: [
      'Brilliant persistence Maaran! So proud of you. Let’s review your simulation right after dinner.',
      'Awesome work champ! Can’t wait to see your algorithm in action tonight in my study.',
      'Fantastic milestone! Bring your laptop tonight, let’s run a few test benchmarks together.',
    ],
  },

  // Conversation with Arjun Mehta
  {
    id: 'wa-msg-301',
    contactId: 'wa-contact-sequoia',
    contactName: 'Arjun Mehta (Sequoia Capital)',
    contactPhone: '+1 415 890 2234',
    contactAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    relationship: 'Venture Partner',
    text: 'Thamiz, Series B escrow verification completed on our side. Wiring package is synchronized with counsel. Do you have 5 mins tomorrow morning for final closing remarks?',
    timestamp: '09:15 AM',
    isOutgoing: false,
    status: 'read',
    urgency: 'urgent',
    category: 'business',
    suggestedReplies: [
      'Confirmed Arjun. Escrow received and verified on our sovereign ledger. Let’s connect tomorrow at 9:30 AM.',
      'Excellent momentum Arjun. Legal counsel has verified documents. 9:30 AM works well for a 10-minute briefing.',
      'Received with appreciation. I will review the final closing draft and join you at 9:30 AM tomorrow.',
    ],
  },

  // Conversation with Delaware Trust
  {
    id: 'wa-msg-401',
    contactId: 'wa-contact-delaware',
    contactName: 'Delaware Family Trust Counsel',
    contactPhone: '+1 302 445 9012',
    contactAvatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
    relationship: 'Estate Counsel',
    text: 'Good afternoon Thamiz, the Q4 municipal surplus sweep ($35,000) documentation is ready for your sovereign electronic sign-off.',
    timestamp: 'Yesterday, 04:30 PM',
    isOutgoing: false,
    status: 'read',
    urgency: 'normal',
    category: 'business',
    suggestedReplies: [
      'Thank you counsel. I am reviewing the allocation schedule via Aura Family Vault and will authorize shortly.',
      'Understood. Please confirm all beneficiaries match our Digital Tamil World sovereign trust charter.',
    ],
  },

  // Conversation with Family Group
  {
    id: 'wa-msg-501',
    contactId: 'wa-contact-family-group',
    contactName: 'Thamiz Family Circle 🌟',
    contactPhone: '+91 98401 00000',
    contactAvatar: 'https://images.unsplash.com/photo-1511895426328-dc8714191300?w=150&auto=format&fit=crop&q=80',
    relationship: 'Family Group',
    text: 'Selvapriya: Don’t forget our Sunday family morning wellness walk at 6:30 AM at the lake park!',
    timestamp: 'Yesterday, 07:15 PM',
    isOutgoing: false,
    status: 'read',
    category: 'groups',
    suggestedReplies: [
      'Already on my calendar! Looking forward to it.',
      'Count me in! I’ll set the morning alarms and bring water bottles.',
    ],
  },
];

/**
 * Creates direct WhatsApp Web / App intent URL
 */
export function createDirectWhatsAppUrl(phone: string, text?: string): string {
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  const encodedText = text ? encodeURIComponent(text) : '';
  return `https://wa.me/${cleanPhone}${encodedText ? `?text=${encodedText}` : ''}`;
}

/**
 * Generate intelligent, empathetic context-aware replies via Auro AI assistant
 */
export async function generateAuraWhatsAppReply(
  incomingMessage: WhatsAppMessage,
  userProfile?: { name?: string; email?: string },
  customTone?: string
): Promise<{
  suggestedReplies: string[];
  rationale: string;
  recommendedAction: string;
}> {
  try {
    const res = await fetch('/api/whatsapp-reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        senderName: incomingMessage.contactName,
        senderRelationship: incomingMessage.relationship || 'Contact',
        messageText: incomingMessage.text,
        userName: userProfile?.name || 'Thamiz',
        userEmail: userProfile?.email || 'digitaltamilworld@gmail.com',
        tone: customTone || 'warm, empathetic, and executive',
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.suggestedReplies && data.suggestedReplies.length > 0) {
        return data;
      }
    }
  } catch (err) {
    console.warn('Backend WhatsApp AI reply error, falling back to local heuristic:', err);
  }

  // High-fidelity fallback based on contact relationship
  if (incomingMessage.contactName.toLowerCase().includes('selvapriya') || incomingMessage.relationship === 'Spouse') {
    return {
      suggestedReplies: [
        'Yes! Wrapping up my deep work block now. Let’s celebrate Maaran’s project at 8:30 PM.',
        'I’m finishing the term sheet review. I’ll be home by 8:45 PM with dessert for Maaran!',
        'Dinner at 8:30 PM sounds wonderful. Please tell Maaran I can’t wait to see his project.',
      ],
      rationale: 'Validates family achievement, honors dinner commitment, balances executive priorities.',
      recommendedAction: 'Send confirmation and mark 8:30 PM family dinner on calendar.',
    };
  }

  if (incomingMessage.contactName.toLowerCase().includes('maaran') || incomingMessage.relationship === 'Son') {
    return {
      suggestedReplies: [
        'Brilliant persistence Maaran! So proud of you. Let’s review your simulation right after dinner.',
        'Awesome work champ! Can’t wait to see your algorithm in action tonight in my study.',
        'Fantastic milestone! Bring your laptop tonight, let’s run a few test benchmarks together.',
      ],
      rationale: 'Celebrates his problem-solving persistence and affirms dedicated 1-on-1 father-son time.',
      recommendedAction: 'Dedicate 30 minutes in study after dinner for robotics code walkthrough.',
    };
  }

  if (incomingMessage.category === 'business' || incomingMessage.contactName.includes('Sequoia')) {
    return {
      suggestedReplies: [
        'Confirmed Arjun. Escrow received and verified on our sovereign ledger. Let’s connect tomorrow at 9:30 AM.',
        'Excellent momentum Arjun. Legal counsel has verified documents. 9:30 AM works well for a 10-minute briefing.',
        'Received with appreciation. I will review the final closing draft and join you at 9:30 AM tomorrow.',
      ],
      rationale: 'Acknowledges high-value Series B closing with executive precision and locks a 10-minute cadence.',
      recommendedAction: 'Schedule 9:30 AM closing call in Google Calendar and link Series B escrow docket.',
    };
  }

  return {
    suggestedReplies: [
      `Thank you ${incomingMessage.contactName.split(' ')[0]}. I’ve reviewed your note and will follow up shortly.`,
      `Received! Let’s coordinate on this today.`,
      `Sounds great, appreciated.`,
    ],
    rationale: 'Clear, polite executive acknowledgment.',
    recommendedAction: 'Send acknowledgment.',
  };
}

/**
 * Read out message aloud hands-free via Auro Assistant
 */
export function speakWhatsAppMessage(senderName: string, text: string) {
  const speechText = `New WhatsApp message from ${senderName}: ${text}`;
  speechEngine.speak(speechText, {
    pitch: 1.05,
    rate: 0.98,
  });
}
