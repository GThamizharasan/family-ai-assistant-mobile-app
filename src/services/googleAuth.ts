import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Standard Google Workspace Scopes configured via set_up_oauth
export const WORKSPACE_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/drive.readonly',
];

// Google Cloud Platform Scopes for live Billing & Resource Manager
export const GCP_SCOPES = [
  'https://www.googleapis.com/auth/cloud-platform.read-only',
  'https://www.googleapis.com/auth/cloud-billing.readonly',
];

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
[...WORKSPACE_SCOPES, ...GCP_SCOPES].forEach((scope) => {
  provider.addScope(scope);
});
provider.setCustomParameters({
  prompt: 'select_account',
});

// Flag to indicate if we are in the middle of a sign-in flow
let isSigningIn = false;
// In-memory cache for the access token (Never stored in localStorage per security guidelines)
let cachedAccessToken: string | null = null;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string | null) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export interface GoogleAuthResult {
  user: User | null;
  accessToken: string | null;
  cancelled?: boolean;
}

export const googleSignIn = async (): Promise<GoogleAuthResult> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    cachedAccessToken = credential?.accessToken || null;

    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    if (
      error?.code === 'auth/popup-closed-by-user' ||
      error?.code === 'auth/cancelled-popup-request' ||
      error?.code === 'auth/popup-blocked'
    ) {
      console.warn('Google Sign-In popup closed or cancelled by user:', error.code);
      return { user: null, accessToken: null, cancelled: true };
    }
    console.warn('Google Sign-In notice:', error?.message || error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const googleSignInGcp = async (): Promise<GoogleAuthResult> => {
  try {
    isSigningIn = true;
    const gcpProvider = new GoogleAuthProvider();
    [...WORKSPACE_SCOPES, ...GCP_SCOPES].forEach((scope) => {
      gcpProvider.addScope(scope);
    });
    gcpProvider.setCustomParameters({
      prompt: 'consent select_account',
      access_type: 'offline',
    });
    const result = await signInWithPopup(auth, gcpProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    cachedAccessToken = credential?.accessToken || null;

    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    if (
      error?.code === 'auth/popup-closed-by-user' ||
      error?.code === 'auth/cancelled-popup-request' ||
      error?.code === 'auth/popup-blocked'
    ) {
      console.warn('Google GCP Sign-In popup closed or cancelled by user:', error.code);
      return { user: null, accessToken: null, cancelled: true };
    }
    console.warn('Google GCP Sign-In notice:', error?.message || error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const setCachedAccessToken = (token: string | null) => {
  cachedAccessToken = token;
};

export const logoutGoogle = async () => {
  await signOut(auth);
  cachedAccessToken = null;
};
