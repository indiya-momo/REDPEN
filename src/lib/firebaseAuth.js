/**
 * Firebase App/Auth 초기화, Google popup/redirect 로그인·로그아웃.
 * subscribeAuthSession/getCurrentUserSession으로 앱 전역 세션 스냅샷.
 * redirect 복귀·persistence·작업 가이드 세션 연동.
 */
import { initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  browserLocalPersistence,
  getAuth,
  getAdditionalUserInfo,
  getRedirectResult,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from 'firebase/auth';
import {
  clearRememberedAuthEmail,
  getRememberedAuthEmail,
  rememberAuthEmail,
} from './authEmailCache.js';
import { clearSessionPanelLeftWidth } from './panelLeftWidthSession.js';
import { clearReturnToMainWorkspace } from './returnToWorkspace.js';
import {
  clearWorkGuideAuthBound,
  syncWorkGuideOnAuthChange,
} from './workGuideLoginSession.js';

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
  provider.addScope('email');
  provider.addScope('profile');
  provider.setCustomParameters({ prompt: 'select_account' });
  persistenceReady = setPersistence(auth, browserLocalPersistence).catch(
    () => undefined,
  );
}

/**
 * Google 등 providerData에만 이메일이 있는 경우 보완
 * @param {import('firebase/auth').User | null | undefined} user
 */
export function resolveUserEmail(user) {
  if (!user) return '';
  if (user.email?.trim()) return user.email.trim();
  for (const provider of user.providerData ?? []) {
    if (provider.email?.trim()) return provider.email.trim();
  }
  const cached = getRememberedAuthEmail(user.uid);
  if (cached) return cached;
  return '';
}

/**
 * @param {import('firebase/auth').UserCredential | null | undefined} result
 */
function emailFromSignInResult(result) {
  if (!result?.user) return '';
  const direct = resolveUserEmail(result.user);
  if (direct) return direct;
  const info = getAdditionalUserInfo(result);
  const profile = info?.profile;
  if (profile && typeof profile === 'object' && 'email' in profile) {
    const profileEmail = profile.email;
    if (typeof profileEmail === 'string' && profileEmail.trim()) {
      return profileEmail.trim();
    }
  }
  return '';
}

/**
 * @param {import('firebase/auth').User} user
 * @param {import('firebase/auth').UserCredential | null} [signInResult]
 */
async function hydrateUserEmail(user, signInResult = null) {
  const fromSignIn = signInResult ? emailFromSignInResult(signInResult) : '';
  if (fromSignIn) {
    rememberAuthEmail(user.uid, fromSignIn);
    return fromSignIn;
  }

  let email = resolveUserEmail(user);
  if (email) {
    rememberAuthEmail(user.uid, email);
    return email;
  }

  try {
    await user.reload();
  } catch {
    /* offline 등 */
  }

  email = resolveUserEmail(user);
  if (email) {
    rememberAuthEmail(user.uid, email);
    return email;
  }

  try {
    const token = await user.getIdTokenResult();
    const fromClaim =
      typeof token.claims.email === 'string' ? token.claims.email.trim() : '';
    if (fromClaim) {
      rememberAuthEmail(user.uid, fromClaim);
      return fromClaim;
    }
  } catch {
    /* ignore */
  }

  return '';
}

/**
 * @param {{ uid?: string, email?: string } | null | undefined} session
 */
export function resolveSessionEmail(session) {
  const fromSession = (session?.email ?? '').trim();
  if (fromSession) return fromSession;
  const uid = session?.uid?.trim() ?? '';
  if (uid) {
    const cached = getRememberedAuthEmail(uid);
    if (cached) return cached;
  }
  if (!auth) return '';
  const user = auth.currentUser;
  if (!user || (uid && user.uid !== uid)) return '';
  return resolveUserEmail(user);
}

/**
 * @param {{ uid?: string, email?: string } | null | undefined} session
 */
export async function resolveSessionEmailAsync(session) {
  const sync = resolveSessionEmail(session);
  if (sync) return sync;
  const uid = session?.uid?.trim() ?? '';
  if (!uid || !auth?.currentUser || auth.currentUser.uid !== uid) return '';
  return hydrateUserEmail(auth.currentUser);
}

function toSession(user) {
  if (!user) return null;
  const createdAtMs = user.metadata?.creationTime
    ? Date.parse(user.metadata.creationTime)
    : NaN;
  const lastSignInMs = user.metadata?.lastSignInTime
    ? Date.parse(user.metadata.lastSignInTime)
    : NaN;
  return {
    uid: user.uid,
    email: resolveUserEmail(user),
    displayName: user.displayName ?? '',
    createdAtMs: Number.isFinite(createdAtMs) ? createdAtMs : undefined,
    lastSignInMs: Number.isFinite(lastSignInMs) ? lastSignInMs : undefined,
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

function isLocalDevHost() {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1';
}

function getLocalhostAuthRedirectHint(hostname, port) {
  const localPort = port || '5173';
  return `http://localhost:${localPort}`;
}

/** 127.0.0.1 — Firebase Authorized domains 기본 목록에 없음 */
function getLoopback127AuthHostMessage() {
  if (typeof window === 'undefined') return '';
  const { hostname, host, port } = window.location;
  if (hostname !== '127.0.0.1') return '';
  return (
    `이 주소(${host})에서는 Google 로그인이 되지 않습니다.\n\n` +
    `아래 주소로 접속한 뒤 다시 시도해 주세요.\n` +
    `· ${getLocalhostAuthRedirectHint(hostname, port)}`
  );
}

/** Vite network URL(192.168.x.x) 등 — Firebase Authorized domains 미등록 → internal-error 유발 */
function getUnsupportedAuthHostMessage() {
  if (typeof window === 'undefined') return '';
  const { hostname, host, port } = window.location;
  const loopbackHint = getLoopback127AuthHostMessage();
  if (loopbackHint) return loopbackHint;
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    return '';
  }
  const localPort = port || '5173';
  return (
    `이 주소(${host})에서는 Google 로그인이 되지 않습니다.\n\n` +
    `아래 주소로 접속한 뒤 다시 시도해 주세요.\n` +
    `· ${getLocalhostAuthRedirectHint(hostname, localPort)}\n` +
    `· ${PUBLIC_APP_URL}`
  );
}

function shouldPreferGoogleRedirect() {
  return false;
}

export function mapFirebaseAuthError(error) {
  const code = error?.code ?? '';
  if (code === 'auth/unauthorized-domain' && import.meta.env.DEV) {
    console.warn(
      '[auth] unauthorized-domain — Firebase Console → Authentication → Authorized domains에 추가:',
      typeof window !== 'undefined' ? window.location.host : '',
    );
  }
  if (code === 'app/unsupported-auth-host' && error instanceof Error && error.message) {
    return error.message;
  }
  const messages = {
    'auth/popup-closed-by-user': '로그인 창이 닫혔습니다.',
    'auth/popup-blocked':
      '팝업이 차단되었습니다. 브라우저에서 팝업을 허용하거나, 시크릿 창이 아닌 일반 창에서 다시 시도해 주세요.',
    'auth/cancelled-popup-request':
      '로그인 창이 이미 열려 있습니다. 잠시 후 다시 시도해 주세요.',
    'auth/unauthorized-domain': (() => {
      const loopbackHint = getLoopback127AuthHostMessage();
      if (loopbackHint) return loopbackHint;
      const lanHint = getUnsupportedAuthHostMessage();
      if (lanHint) return lanHint;
      if (import.meta.env.DEV && typeof window !== 'undefined') {
        const { hostname, port } = window.location;
        if (hostname === 'localhost') {
          return (
            '이 주소에서 로그인이 거부되었습니다.\n\n' +
            'Firebase Console → Authentication → Authorized domains에 localhost가 있는지 확인해 주세요.'
          );
        }
      }
      return (
        `이 주소에서는 로그인을 할 수 없습니다.\n\n` +
        `공식 사이트 ${PUBLIC_APP_URL} 에서 「구글로 회원가입」을 다시 시도해 주세요.`
      );
    })(),
    'auth/operation-not-allowed':
      '지금은 Google 로그인을 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.',
    'auth/account-exists-with-different-credential':
      '이미 다른 방식으로 가입된 계정입니다.',
    'auth/web-storage-unsupported':
      '브라우저가 로그인 저장을 막고 있습니다. 시크릿 창을 끄거나 쿠키 차단을 해제해 주세요.',
    'auth/internal-error': (() => {
      const lanHint = getUnsupportedAuthHostMessage();
      if (lanHint) return lanHint;
      const loginUrl = isLocalDevHost()
        ? `http://localhost:${window.location.port || '5173'}`
        : PUBLIC_APP_URL;
      return (
        'Google 로그인에 실패했습니다.\n\n' +
        `Chrome 일반 창에서 ${loginUrl} 로 접속해 주세요.\n` +
        '(팝업·서드파티 쿠키 차단을 해제한 뒤 다시 시도)'
      );
    })(),
  };
  if (messages[code]) return messages[code];
  if (import.meta.env.DEV && code) {
    console.warn('[auth]', code, error);
  }
  if (error instanceof Error && error.message) return error.message;
  return '로그인에 실패했습니다.';
}

export function getCurrentUserSession() {
  if (!auth) return null;
  return toSession(auth.currentUser);
}

/**
 * persistence·리다이렉트 처리 후 Auth 초기화 완료까지 대기
 * @returns {Promise<ReturnType<typeof toSession>>}
 */
export async function waitForAuthInitialization() {
  if (!auth) return null;
  await persistenceReady;
  const immediate = toSession(auth.currentUser);
  if (immediate) return immediate;
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (user) => {
      unsub();
      resolve(toSession(user));
    });
  });
}

export function subscribeAuthSession(callback) {
  if (!auth) return () => {};
  return onAuthStateChanged(auth, (user) => {
    if (!user) {
      callback(null);
      return;
    }
    const session = toSession(user);
    if (session.email) {
      rememberAuthEmail(user.uid, session.email);
    }
    callback(session);
    if (!session.email) {
      void hydrateUserEmail(user).then((email) => {
        if (!email || auth.currentUser?.uid !== user.uid) return;
        callback({ ...session, email });
      });
    }
  });
}

/** Google 로그인 후 돌아온 경우 결과 처리 (리다이렉트 fallback용) */
export async function completeGoogleRedirectIfNeeded() {
  if (!auth) return { session: null, error: null };
  await persistenceReady;
  try {
    const result = await getRedirectResult(auth);
    const user = result?.user ?? auth.currentUser;
    if (user) {
      await hydrateUserEmail(user, result);
    }
    return { session: toSession(user), error: null };
  } catch (error) {
    const code = error?.code ?? '';
    if (code === 'auth/internal-error' && !auth.currentUser) {
      if (import.meta.env.DEV) {
        console.warn('[auth] getRedirectResult internal-error (no session, ignored)', error);
      }
      return { session: null, error: null };
    }
    return { session: null, error: mapFirebaseAuthError(error) };
  }
}

const POPUP_REDIRECT_FALLBACK_CODES = new Set([
  'auth/popup-blocked',
  'auth/internal-error',
]);

/** 팝업 우선, 실패 시 전체 페이지 리다이렉트 */
export async function signInWithGoogle() {
  assertConfigured();
  const loopbackHost = getLoopback127AuthHostMessage();
  if (loopbackHost) {
    throw Object.assign(new Error(loopbackHost), {
      code: 'app/unsupported-auth-host',
    });
  }
  const unsupportedHost = getUnsupportedAuthHostMessage();
  if (unsupportedHost) {
    throw Object.assign(new Error(unsupportedHost), {
      code: 'app/unsupported-auth-host',
    });
  }
  await persistenceReady;
  if (auth.currentUser) {
    await hydrateUserEmail(auth.currentUser);
    return;
  }

  if (shouldPreferGoogleRedirect()) {
    await signInWithRedirect(auth, provider);
    return;
  }

  try {
    const result = await signInWithPopup(auth, provider);
    if (result.user) {
      await hydrateUserEmail(result.user, result);
    }
  } catch (error) {
    const code = error?.code ?? '';
    if (import.meta.env.DEV) {
      console.warn('[auth] signInWithPopup failed:', code, error);
    }
    if (POPUP_REDIRECT_FALLBACK_CODES.has(code)) {
      await signInWithRedirect(auth, provider);
      return;
    }
    throw error;
  }
}

export async function signOutUser() {
  assertConfigured();
  const uid = auth.currentUser?.uid;
  clearReturnToMainWorkspace();
  clearWorkGuideAuthBound();
  if (uid) clearSessionPanelLeftWidth(uid);
  await signOut(auth);
  if (uid) clearRememberedAuthEmail(uid);
}
