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

/** Firebase 웹 SDK 공개 설정 — 도메인 제한으로 보호됨(비밀키 아님). Vercel env 누락·캐시된 구버전 빌드 대비 */
const FIREBASE_WEB_DEFAULTS = {
  apiKey: 'AIzaSyA_K8yczBk4rzq-rvhoXt8fuZ-1-mZ3e8w',
  authDomain: 'indiya-757ba.firebaseapp.com',
  projectId: 'indiya-757ba',
  appId: '1:997633908785:web:0ca96220aae36a2b187510',
};

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || FIREBASE_WEB_DEFAULTS.apiKey,
  authDomain:
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || FIREBASE_WEB_DEFAULTS.authDomain,
  projectId:
    import.meta.env.VITE_FIREBASE_PROJECT_ID || FIREBASE_WEB_DEFAULTS.projectId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || FIREBASE_WEB_DEFAULTS.appId,
};

export const isFirebaseAuthConfigured = Object.values(firebaseConfig).every(
  Boolean,
);

/** @type {import('firebase/app').FirebaseApp | null} */
export let firebaseApp = null;
let auth = null;
let provider = null;
let persistenceReady = Promise.resolve();

if (isFirebaseAuthConfigured) {
  firebaseApp = initializeApp(firebaseConfig);
  auth = getAuth(firebaseApp);
  provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  persistenceReady = setPersistence(auth, browserLocalPersistence).catch(
    () => undefined,
  );
}

function toSession(user) {
  if (!user) return null;
  const createdAtMs = user.metadata?.creationTime
    ? Date.parse(user.metadata.creationTime)
    : NaN;
  return {
    uid: user.uid,
    email: user.email ?? '',
    displayName: user.displayName ?? '',
    createdAtMs: Number.isFinite(createdAtMs) ? createdAtMs : undefined,
  };
}

function assertConfigured() {
  if (!isFirebaseAuthConfigured) {
    throw new Error(
      'Firebase 설정을 읽지 못했습니다. 페이지를 강력 새로고침(Ctrl+Shift+R)한 뒤 다시 시도해 주세요.',
    );
  }
  if (!auth || !provider) {
    throw new Error(
      'Firebase 로그인 초기화에 실패했습니다. 브라우저 캐시를 비우거나 시크릿 창에서 다시 시도해 주세요.',
    );
  }
}

const PUBLIC_APP_URL = 'https://indiya.vercel.app';

export function mapFirebaseAuthError(error) {
  const code = error?.code ?? '';
  if (code === 'auth/unauthorized-domain' && import.meta.env.DEV) {
    console.warn(
      '[auth] unauthorized-domain — Firebase Console → Authentication → Authorized domains에 추가:',
      typeof window !== 'undefined' ? window.location.host : '',
    );
  }
  const messages = {
    'auth/popup-closed-by-user': '로그인 창이 닫혔습니다.',
    'auth/popup-blocked':
      '팝업이 차단되었습니다. 브라우저에서 팝업을 허용하거나, 시크릿 창이 아닌 일반 창에서 다시 시도해 주세요.',
    'auth/cancelled-popup-request':
      '로그인 창이 이미 열려 있습니다. 잠시 후 다시 시도해 주세요.',
    'auth/unauthorized-domain':
      `이 주소에서는 로그인을 할 수 없습니다.\n\n공식 사이트 ${PUBLIC_APP_URL} 에서 「구글로 시작하기」를 다시 시도해 주세요.`,
    'auth/operation-not-allowed':
      '지금은 Google 로그인을 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.',
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
