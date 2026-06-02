import { initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const isFirebaseConfigured = Object.values(firebaseConfig).every(Boolean);

let auth = null;
let provider = null;

if (isFirebaseConfigured) {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  provider = new GoogleAuthProvider();
}

function toSession(user) {
  if (!user) return null;
  return {
    uid: user.uid,
    email: user.email ?? '',
    displayName: user.displayName ?? '',
  };
}

function assertConfigured() {
  if (!auth || !provider) {
    throw new Error(
      'Firebase 환경 변수가 비어 있습니다. 로컬은 .env.local에 VITE_FIREBASE_* 4개를 넣고 dev 서버를 재시작하세요. 배포 사이트는 Vercel Environment Variables를 확인하세요.',
    );
  }
}

export function getCurrentUserSession() {
  if (!auth) return null;
  return toSession(auth.currentUser);
}

export function subscribeAuthSession(callback) {
  if (!auth) return () => {};
  return onAuthStateChanged(auth, (user) => {
    callback(toSession(user));
  });
}

export async function signInWithGooglePopup() {
  assertConfigured();
  await signInWithPopup(auth, provider);
}

export async function signOutUser() {
  assertConfigured();
  await signOut(auth);
}
