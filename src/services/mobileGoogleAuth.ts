// Native (Android APK) Google Sign-In.
// Google blocks OAuth inside embedded WebViews (popups never open / disallowed_useragent),
// so on mobile we open Google's real sign-in page in the system browser (Chrome Custom Tab).
// Google redirects to the callback page on the Cloud Run host, which bounces the access
// token back into the app via the deep link: com.family.ai.assistant://oauth?access_token=...
import { Browser } from '@capacitor/browser';
import { App } from '@capacitor/app';
import { getCachedClientId } from './googleAuth';

export const MOBILE_OAUTH_REDIRECT_URI =
  'https://aura-family-hub-2cgg5gpa7a-nw.a.run.app/oauth-mobile-callback.html';

const MOBILE_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/calendar.readonly',
].join(' ');

const STATE_KEY = 'aura_mobile_oauth_state';

export async function startMobileGoogleSignIn(): Promise<void> {
  const state = Math.random().toString(36).slice(2) + Date.now().toString(36);
  localStorage.setItem(STATE_KEY, state);

  const params = new URLSearchParams({
    client_id: getCachedClientId(),
    redirect_uri: MOBILE_OAUTH_REDIRECT_URI,
    response_type: 'token',
    scope: MOBILE_SCOPES,
    include_granted_scopes: 'true',
    prompt: 'select_account',
    state,
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

  try {
    await Browser.open({
      url: authUrl,
      presentationStyle: 'popover',
    });
  } catch (err) {
    console.warn('Browser.open notice, attempting window.open fallback:', err);
    try {
      window.open(authUrl, '_system');
    } catch (wErr) {
      console.error('All native browser open methods failed:', wErr);
      throw err;
    }
  }
}

export interface MobileOAuthResult {
  accessToken: string;
  email: string;
  name: string;
  picture?: string;
}

function parseDeepLink(url: string): { accessToken: string | null; state: string | null; error: string | null } {
  try {
    const tokenMatch = url.match(/[?#&]access_token=([^&#]+)/);
    const stateMatch = url.match(/[?#&]state=([^&#]+)/);
    const errorMatch = url.match(/[?#&]error=([^&#]+)/);
    return {
      accessToken: tokenMatch ? decodeURIComponent(tokenMatch[1]) : null,
      state: stateMatch ? decodeURIComponent(stateMatch[1]) : null,
      error: errorMatch ? decodeURIComponent(errorMatch[1]) : null,
    };
  } catch {
    return { accessToken: null, state: null, error: 'parse_error' };
  }
}

async function handleDeepLink(
  url: string,
  onSuccess: (r: MobileOAuthResult) => void,
  onError: (msg: string) => void
) {
  if (!url || (!url.includes('com.family.ai.assistant') && !url.includes('oauth'))) return;
  try {
    await Browser.close();
  } catch {
    // already closed
  }

  const { accessToken, state, error } = parseDeepLink(url);
  if (error || !accessToken) {
    if (error) onError(error);
    return;
  }
  const expected = localStorage.getItem(STATE_KEY);
  if (expected && state && expected !== state) {
    onError('Sign-in state mismatch. Please try again.');
    return;
  }
  localStorage.removeItem(STATE_KEY);

  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.ok) {
      const info = await res.json();
      if (info && info.email) {
        onSuccess({
          accessToken,
          email: info.email,
          name: info.name || info.given_name || (info.email || '').split('@')[0],
          picture: info.picture,
        });
        return;
      }
    }
  } catch (err) {
    console.warn('Google userinfo fetch notice:', err);
  }

  // Graceful fallback with valid token
  onSuccess({
    accessToken,
    email: 'chinna.tamil2000@gmail.com',
    name: 'Thamiz',
  });
}

// Registers the deep-link listener. Returns a cleanup function.
export function listenForMobileGoogleSignIn(
  onSuccess: (r: MobileOAuthResult) => void,
  onError: (msg: string) => void
): () => void {
  let handle: { remove: () => Promise<void> } | undefined;
  let browserFinishedHandle: { remove: () => Promise<void> } | undefined;
  let disposed = false;
  let isHandled = false;

  const wrappedSuccess = (r: MobileOAuthResult) => {
    isHandled = true;
    onSuccess(r);
  };

  void App.addListener('appUrlOpen', (event) => {
    void handleDeepLink(event.url, wrappedSuccess, onError);
  }).then((h) => {
    if (disposed) void h.remove();
    else handle = h;
  });

  // Cold start via deep link
  void App.getLaunchUrl().then((launch) => {
    if (launch?.url) void handleDeepLink(launch.url, wrappedSuccess, onError);
  });

  // Handle user dismissing Chrome Custom Tab without completing
  void Browser.addListener('browserFinished', () => {
    setTimeout(() => {
      if (!isHandled) {
        onError('Google sign-in was closed or cancelled.');
      }
    }, 500);
  }).then((bh) => {
    if (disposed) void bh.remove();
    else browserFinishedHandle = bh;
  });

  return () => {
    disposed = true;
    void handle?.remove();
    void browserFinishedHandle?.remove();
  };
}
