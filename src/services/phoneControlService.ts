/**
 * Sovereign Phone Access & App Control Service
 * Enables Auro Voice Assistant to control phone access on voice command:
 * e.g., "open whatsapp", "open facebook", "open youtube", "open instagram",
 * "open camera", "open spotify", "open google maps", "open chrome", etc.
 */

import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';

export interface PhoneAppDefinition {
  id: string;
  name: string;
  tamilName: string;
  aliases: string[];
  tamilAliases: string[];
  urlScheme: string;
  webUrl: string;
  intentUri?: string;
  category: 'communication' | 'social' | 'media' | 'utility' | 'system';
  icon: string;
}

export const SUPPORTED_PHONE_APPS: PhoneAppDefinition[] = [
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    tamilName: 'வாட்ஸ்அப்',
    aliases: ['whatsapp', 'whats app', 'wa'],
    tamilAliases: ['வாட்ஸ்அப்', 'வாட்ஸ் அப்', 'வாட்ஸப்'],
    urlScheme: 'whatsapp://',
    webUrl: 'https://wa.me/',
    intentUri: 'intent://#Intent;package=com.whatsapp;scheme=whatsapp;end',
    category: 'communication',
    icon: '💬',
  },
  {
    id: 'facebook',
    name: 'Facebook',
    tamilName: 'பேஸ்புக்',
    aliases: ['facebook', 'fb', 'face book'],
    tamilAliases: ['பேஸ்புக்', 'முகநூல்', 'பேஸ் புக்'],
    urlScheme: 'fb://facewebmodal/f?href=https://www.facebook.com',
    webUrl: 'https://www.facebook.com',
    intentUri: 'intent://#Intent;package=com.facebook.katana;scheme=fb;end',
    category: 'social',
    icon: '📘',
  },
  {
    id: 'youtube',
    name: 'YouTube',
    tamilName: 'யூடியூப்',
    aliases: ['youtube', 'yt', 'you tube'],
    tamilAliases: ['யூடியூப்', 'யூ டியூப்'],
    urlScheme: 'vnd.youtube://',
    webUrl: 'https://www.youtube.com',
    intentUri: 'intent://#Intent;package=com.google.android.youtube;scheme=vnd.youtube;end',
    category: 'media',
    icon: '▶️',
  },
  {
    id: 'instagram',
    name: 'Instagram',
    tamilName: 'இன்ஸ்டாகிராம்',
    aliases: ['instagram', 'insta', 'ig'],
    tamilAliases: ['இன்ஸ்டாகிராம்', 'இன்ஸ்டா'],
    urlScheme: 'instagram://app',
    webUrl: 'https://www.instagram.com',
    intentUri: 'intent://#Intent;package=com.instagram.android;scheme=instagram;end',
    category: 'social',
    icon: '📷',
  },
  {
    id: 'twitter',
    name: 'X (Twitter)',
    tamilName: 'எக்ஸ் (ட்விட்டர்)',
    aliases: ['twitter', 'x app', 'x', 'tweet'],
    tamilAliases: ['ட்விட்டர்', 'எக்ஸ்'],
    urlScheme: 'twitter://timeline',
    webUrl: 'https://x.com',
    intentUri: 'intent://#Intent;package=com.twitter.android;scheme=twitter;end',
    category: 'social',
    icon: '✖️',
  },
  {
    id: 'telegram',
    name: 'Telegram',
    tamilName: 'டெலிகிராம்',
    aliases: ['telegram', 'tg'],
    tamilAliases: ['டெலிகிராம்'],
    urlScheme: 'tg://',
    webUrl: 'https://t.me',
    intentUri: 'intent://#Intent;package=org.telegram.messenger;scheme=tg;end',
    category: 'communication',
    icon: '✈️',
  },
  {
    id: 'spotify',
    name: 'Spotify',
    tamilName: 'ஸ்பாட்டிஃபை',
    aliases: ['spotify', 'music app'],
    tamilAliases: ['ஸ்பாட்டிஃபை'],
    urlScheme: 'spotify://',
    webUrl: 'https://open.spotify.com',
    intentUri: 'intent://#Intent;package=com.spotify.music;scheme=spotify;end',
    category: 'media',
    icon: '🎵',
  },
  {
    id: 'maps',
    name: 'Google Maps',
    tamilName: 'கூகுள் மேப்ஸ்',
    aliases: ['google maps', 'maps', 'gmaps', 'google map'],
    tamilAliases: ['கூகுள் மேப்ஸ்', 'மேப்ஸ்', 'கூகுள் வரைபடம்'],
    urlScheme: 'geo:0,0?q=',
    webUrl: 'https://maps.google.com',
    intentUri: 'intent://#Intent;package=com.google.android.apps.maps;scheme=geo;end',
    category: 'utility',
    icon: '🗺️',
  },
  {
    id: 'chrome',
    name: 'Google Chrome',
    tamilName: 'கூகுள் குரோம்',
    aliases: ['chrome', 'browser', 'web browser', 'google chrome', 'internet'],
    tamilAliases: ['குரோம்', 'பிரவுசர்', 'இணையம்'],
    urlScheme: 'googlechrome://',
    webUrl: 'https://www.google.com',
    intentUri: 'intent://#Intent;package=com.android.chrome;scheme=googlechrome;end',
    category: 'utility',
    icon: '🌐',
  },
  {
    id: 'camera',
    name: 'Phone Camera',
    tamilName: 'கேமரா',
    aliases: ['camera', 'phone camera', 'take photo', 'cam'],
    tamilAliases: ['கேமரா', 'புகைப்படம் எடு'],
    urlScheme: 'intent:#Intent;action=android.media.action.IMAGE_CAPTURE;end',
    webUrl: '',
    category: 'system',
    icon: '📸',
  },
  {
    id: 'dialer',
    name: 'Phone Dialer',
    tamilName: 'ஃபோன் டயலர்',
    aliases: ['dialer', 'keypad', 'phone app', 'call pad', 'dial pad'],
    tamilAliases: ['டயலர்', 'ஃபோன்', 'அழைப்பு'],
    urlScheme: 'tel:',
    webUrl: '',
    category: 'system',
    icon: '📞',
  },
  {
    id: 'messages',
    name: 'SMS Messages',
    tamilName: 'மெசேஜ்',
    aliases: ['messages', 'sms', 'text messages', 'messaging app'],
    tamilAliases: ['செய்திகள்', 'எஸ்எம்எஸ்', 'மெசேஜ்'],
    urlScheme: 'sms:',
    webUrl: '',
    category: 'system',
    icon: '📩',
  },
  {
    id: 'gmail',
    name: 'Gmail',
    tamilName: 'ஜிமெயில்',
    aliases: ['gmail', 'google mail', 'email app', 'mail app'],
    tamilAliases: ['ஜிமெயில்', 'மின்னஞ்சல்'],
    urlScheme: 'googlegmail://',
    webUrl: 'https://mail.google.com',
    intentUri: 'intent://#Intent;package=com.google.android.gm;scheme=googlegmail;end',
    category: 'communication',
    icon: '✉️',
  },
  {
    id: 'calculator',
    name: 'Calculator',
    tamilName: 'கால்குலேட்டர்',
    aliases: ['calculator', 'calc'],
    tamilAliases: ['கால்குலேட்டர்', 'கணக்கீடு'],
    urlScheme: 'intent:#Intent;action=android.intent.action.MAIN;category=android.intent.category.APP_CALCULATOR;end',
    webUrl: '',
    category: 'system',
    icon: '🧮',
  },
  {
    id: 'gallery',
    name: 'Gallery & Photos',
    tamilName: 'கேலரி',
    aliases: ['gallery', 'photos', 'google photos', 'photo gallery'],
    tamilAliases: ['கேலரி', 'புகைப்படங்கள்'],
    urlScheme: 'intent:#Intent;action=android.intent.action.VIEW;type=image/*;end',
    webUrl: 'https://photos.google.com',
    category: 'system',
    icon: '🖼️',
  },
  {
    id: 'settings',
    name: 'Device Settings',
    tamilName: 'அமைப்புகள் (Settings)',
    aliases: ['settings', 'device settings', 'phone settings'],
    tamilAliases: ['செட்டிங்ஸ்', 'அமைப்புகள்'],
    urlScheme: 'intent:#Intent;action=android.settings.SETTINGS;end',
    webUrl: '',
    category: 'system',
    icon: '⚙️',
  },
  {
    id: 'playstore',
    name: 'Google Play Store',
    tamilName: 'ப்ளே ஸ்டோர்',
    aliases: ['play store', 'google play', 'app store', 'playstore'],
    tamilAliases: ['ப்ளே ஸ்டோர்', 'ப்ளேஸ்டோர்'],
    urlScheme: 'market://',
    webUrl: 'https://play.google.com',
    intentUri: 'intent://#Intent;package=com.android.vending;scheme=market;end',
    category: 'utility',
    icon: '🛍️',
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    tamilName: 'லிங்க்ட்இன்',
    aliases: ['linkedin', 'linked in'],
    tamilAliases: ['லிங்க்ட்இன்'],
    urlScheme: 'linkedin://',
    webUrl: 'https://www.linkedin.com',
    intentUri: 'intent://#Intent;package=com.linkedin.android;scheme=linkedin;end',
    category: 'social',
    icon: '💼',
  },
  {
    id: 'netflix',
    name: 'Netflix',
    tamilName: 'நெட்ஃபிளிக்ஸ்',
    aliases: ['netflix'],
    tamilAliases: ['நெட்ஃபிளிக்ஸ்'],
    urlScheme: 'netflix://',
    webUrl: 'https://www.netflix.com',
    intentUri: 'intent://#Intent;package=com.netflix.ninja;scheme=netflix;end',
    category: 'media',
    icon: '🎬',
  },
];

/**
 * Find a phone app definition by matching a spoken query or app name
 */
export function findPhoneAppByQuery(query: string): PhoneAppDefinition | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;

  for (const app of SUPPORTED_PHONE_APPS) {
    if (app.id === q || app.name.toLowerCase() === q) return app;
    if (app.aliases.some((alias) => q === alias || q.includes(alias))) return app;
    if (app.tamilAliases.some((tAlias) => query.includes(tAlias))) return app;
  }
  return null;
}

/**
 * Detect voice intent for opening a phone app
 * e.g., "open whatsapp", "launch facebook", "open youtube", "வாட்ஸ்அப் திற", "facebook open பண்ணு"
 */
export function parsePhoneAppVoiceIntent(spokenText: string): { app: PhoneAppDefinition; isTamil: boolean } | null {
  const lower = spokenText.trim().toLowerCase();
  const isTamil = /[\u0B80-\u0BFF]/.test(spokenText);

  // Safeguard: do not hijack message replies or sending messages
  if (
    lower.startsWith('reply') ||
    lower.startsWith('send ') ||
    lower.startsWith('message ') ||
    lower.includes('reply to') ||
    lower.includes('send whatsapp to')
  ) {
    return null;
  }

  // Strip prefixes like "open", "launch", "start", "go to"
  const cleaned = lower
    .replace(/^(hey auro|auro|please|can you|could you)\s+/i, '')
    .replace(/^(open|launch|start|run|access|go to)\s+/i, '')
    .trim();

  // Check direct matching or "open <app>"
  for (const app of SUPPORTED_PHONE_APPS) {
    // 1. Exact or prefixed alias check
    const matchedAlias = app.aliases.some((alias) => {
      return (
        lower === `open ${alias}` ||
        lower === `launch ${alias}` ||
        lower === `start ${alias}` ||
        lower === alias ||
        lower.startsWith(`open ${alias} `) ||
        cleaned === alias ||
        cleaned.startsWith(`${alias} on phone`) ||
        cleaned.startsWith(`${alias} app`)
      );
    });

    if (matchedAlias) {
      return { app, isTamil };
    }

    // 2. Tamil phrases check: e.g. "வாட்ஸ்அப் திற", "facebook திற"
    const matchedTamil = app.tamilAliases.some((tAlias) => {
      return (
        spokenText.includes(`${tAlias} திற`) ||
        spokenText.includes(`${tAlias} ஓபன்`) ||
        spokenText.includes(`${tAlias} திறக்கவும்`) ||
        spokenText.includes(`${tAlias} தொடங்கு`) ||
        lower.includes(`${tAlias} open`)
      );
    });

    if (matchedTamil) {
      return { app, isTamil: true };
    }
  }

  return null;
}

/**
 * Launch an external mobile phone app or fallback to system browser
 */
export async function launchPhoneApp(app: PhoneAppDefinition): Promise<{
  success: boolean;
  message: string;
  openedTarget: string;
}> {
  const isNative = Capacitor.isNativePlatform();
  const targetUrl = app.urlScheme || app.webUrl;

  try {
    if (isNative) {
      // 1. Try launching through anchor tag with target="_system" (standard Capacitor intent trigger)
      try {
        const a = document.createElement('a');
        a.href = targetUrl;
        a.target = '_system';
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        return {
          success: true,
          message: `Launched ${app.name} on your device`,
          openedTarget: targetUrl,
        };
      } catch (err) {
        console.warn(`[PhoneControl] Anchor launch failed for ${app.name}:`, err);
      }

      // 2. If anchor doesn't trigger, use Capacitor Browser plugin as robust fallback
      if (app.webUrl) {
        await Browser.open({ url: app.webUrl });
        return {
          success: true,
          message: `Opened ${app.name} via secure browser window`,
          openedTarget: app.webUrl,
        };
      }
    } else {
      // Running on Web / Desktop browser
      if (app.webUrl) {
        window.open(app.webUrl, '_blank', 'noopener,noreferrer');
        return {
          success: true,
          message: `Opened ${app.name} in a new tab`,
          openedTarget: app.webUrl,
        };
      } else if (app.urlScheme) {
        window.location.href = app.urlScheme;
        return {
          success: true,
          message: `Dispatched ${app.name} protocol`,
          openedTarget: app.urlScheme,
        };
      }
    }

    return {
      success: true,
      message: `Triggered ${app.name}`,
      openedTarget: targetUrl,
    };
  } catch (err: any) {
    console.error(`[PhoneControl] Error opening ${app.name}:`, err);
    // Ultimate fallback: window.open
    if (app.webUrl) {
      window.open(app.webUrl, '_blank');
    }
    return {
      success: false,
      message: `Unable to launch ${app.name}: ${err?.message || 'Unknown error'}`,
      openedTarget: targetUrl,
    };
  }
}
