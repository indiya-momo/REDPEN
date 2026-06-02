import { initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  browserLocalPersistence,
  getAuth,
  getRedirectResult,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const isFirebaseAuthConfigured = Object.values(firebaseConfig).every(
  Boolean,
);

let auth = null;
let provider = null;
let persistenceReady = Promise.resolve();

if (isFirebaseAuthConfigured) {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  persistenceReady = setPersistence(auth, browserLocalPersistence).catch(
    () => undefined,
  );
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
      '팝업이 차단되었습니다. 브라우저에서 팝업을 허용하거나, 시크릿 창이 아닌 일반 창에서 다시 시도해 주세요.',
    'auth/cancelled-popup-request':
      '로그인 창이 이미 열려 있습니다. 잠시 후 다시 시도해 주세요.',
    'auth/unauthorized-domain':
      'Firebase → Authentication → Settings → Authorized domains에 이 사이트 주소(indiya.vercel.app, localhost)를 추가해 주세요.',
    'auth/operation-not-allowed':
      'Firebase 콘솔에서 Google 로그인(Sign-in method)을 활성화해 주세요.',
    'auth/account-exists-with-different-credential':
      '이미 다른 방식으로 가입된 계정입니다.',
    'auth/web-storage-unsupported':
      '브라우저가 로그인 저장을 막고 있습니다. 시크릿 창을 끄거나 쿠키 차단을 해제해 주세요.',
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

/** Google 로그인 후 돌아온 경우 결과 처리 (리다이렉트 fallback용) */
export async function completeGoogleRedirectIfNeeded() {
  if (!auth) return { session: null, error: null };
  await persistenceReady;
  try {
    const result = await getRedirectResult(auth);
    const session = toSession(result?.user ?? auth.currentUser);
    return { session, error: null };
  } catch (error) {
    return { session: null, error: mapFirebaseAuthError(error) };
  }
}

const POPUP_FALLBACK_CODES = new Set([
  'auth/popup-blocked',
  'auth/popup-closed-by-user',
  'auth/cancelled-popup-request',
]);

/** 팝업 우선, 실패 시 전체 페이지 리다이렉트 */
export async function signInWithGoogle() {
  assertConfigured();
  await persistenceReady;
  if (auth.currentUser) {
    return;
  }

  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    const code = error?.code ?? '';
    if (POPUP_FALLBACK_CODES.has(code)) {
      await signInWithRedirect(auth, provider);
      return;
    }
    throw error;
  }
}

export async function signOutUser() {
  assertConfigured();
  await signOut(auth);
}
