import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

let app: any = null;
let db: any = null;
let auth: any = null;
let hasConfiguredFirebase = false;

// Safe check to verify keys exist before initializing, avoiding start-up crashes
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || (typeof window !== 'undefined' ? (window as any).FIREBASE_API_KEY : undefined),
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || (typeof window !== 'undefined' ? (window as any).FIREBASE_PROJECT_ID : undefined),
  firestoreDatabaseId: process.env.VITE_FIREBASE_DATABASE_ID || "(default)",
};

if (firebaseConfig.apiKey && firebaseConfig.projectId) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
    auth = getAuth(app);
    hasConfiguredFirebase = true;
  } catch (error) {
    console.error("Failed to initialize Firebase:", error);
  }
}

export { app, db, auth, hasConfiguredFirebase };

// Ensure auth signs in anonymously to meet securely hardened Firestore rules which verify request.auth != null
export async function ensureAuth() {
  if (!hasConfiguredFirebase || !auth) return null;
  if (auth.currentUser) return auth.currentUser;
  try {
    const userCredential = await signInAnonymously(auth);
    return userCredential.user;
  } catch (err) {
    // Graceful trace - we fall back to a stable guest ID to circumvent the admin restricted policy error
    console.warn("Firebase Auth sign-in restricted. Falling back to secure localStorage guest session:", err);
    return null;
  }
}

export function getStableGuestId(): string {
  if (typeof window === "undefined") return "server_guest";
  let guestId = localStorage.getItem("nexa_stable_guest_id");
  if (!guestId) {
    guestId = "guest_" + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    localStorage.setItem("nexa_stable_guest_id", guestId);
  }
  return guestId;
}

// ── Error Handler ─────────────────────────────────────────────────────────────
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const currentUser = auth?.currentUser;
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: currentUser?.uid,
      email: currentUser?.email,
      emailVerified: currentUser?.emailVerified,
      isAnonymous: currentUser?.isAnonymous,
      tenantId: currentUser?.tenantId,
      providerInfo: currentUser?.providerData?.map((provider: any) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
