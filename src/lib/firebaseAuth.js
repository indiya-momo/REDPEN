import { initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  browserLocalPersistence,
  getAuth,
  getRedirectResult,
  onAuthStateChanged,
  setPersistence,
  signInWithRedirect,
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
let persistenceReady = false;

if (isFirebaseConfigured) {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  persistenceReady = setPersistence(auth, browserLocalPersistence).catch(() => false);
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

export function mapFirebaseAuthError(error) {
  const code = error?.code ?? '';
  const messages = {
    'auth/popup-closed-by-user': '로그인 창이 닫혔습니다.',
    'auth/popup-blocked':
      '팝업이 차단되었습니다. 브라우저 설정에서 팝업을 허용해 주세요.',
    'auth/unauthorized-domain':
      'Firebase 승인 도메인에 localhost와 indiya.vercel.app을 추가해 주세요.',
    'auth/operation-not-allowed':
      'Firebase 콘솔에서 Google 로그인을 활성화해 주세요.',
    'auth/account-exists-with-different-credential':
      '이미 다른 방식으로 가입된 계정입니다.',
  };
  if (messages[code]) return messages[code];
  if (error instanceof Error && error.message) return error.message;
  return '로그인에 실패했습니다.';
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

/** Google 로그인 후 돌아온 경우 결과 처리 (리다이렉트 방식) */
export async function completeGoogleRedirectIfNeeded() {
  if (!auth) return null;
  await persistenceReady;
  try {
    const result = await getRedirectResult(auth);
    return toSession(result?.user ?? auth.currentUser);
  } catch (error) {
    throw new Error(mapFirebaseAuthError(error));
  }
}

/** 팝업 대신 리다이렉트 — 계정 선택 후 멈춤 현상 방지 */
export async function signInWithGoogleRedirect() {
  assertConfigured();
  await persistenceReady;
  if (auth.currentUser) {
    return;
  }
  await signInWithRedirect(auth, provider);
}

export async function signOutUser() {
  assertConfigured();
  await signOut(auth);
}
