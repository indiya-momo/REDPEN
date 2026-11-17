import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('firebase/app', () => ({
  getApps: () => [],
  getApp: vi.fn(),
  initializeApp: vi.fn(() => ({ name: '[DEFAULT]' })),
}));

vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: vi.fn(function GoogleAuthProvider() {
    this.addScope = vi.fn();
    this.setCustomParameters = vi.fn();
  }),
  browserLocalPersistence: {},
  getAuth: vi.fn(() => ({})),
  getAdditionalUserInfo: vi.fn(),
  getRedirectResult: vi.fn(async () => null),
  onAuthStateChanged: vi.fn(() => () => {}),
  setPersistence: vi.fn(async () => undefined),
  signInWithPopup: vi.fn(),
  signInWithRedirect: vi.fn(),
  signOut: vi.fn(),
}));

describe('resolveFirebaseAuthDomain', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('env가 있으면 그 값을 쓴다', async () => {
    vi.stubEnv('VITE_FIREBASE_AUTH_DOMAIN', 'custom.example.com');
    const { resolveFirebaseAuthDomain } = await import('./firebaseAuth.js');
    expect(resolveFirebaseAuthDomain()).toBe('custom.example.com');
  });

  it('indiya.vercel.app 호스트면 앱 도메인을 authDomain으로 쓴다', async () => {
    vi.stubEnv('VITE_FIREBASE_AUTH_DOMAIN', '');
    vi.stubGlobal('window', {
      location: { hostname: 'indiya.vercel.app' },
    });
    const { resolveFirebaseAuthDomain } = await import('./firebaseAuth.js');
    expect(resolveFirebaseAuthDomain()).toBe('indiya.vercel.app');
  });

  it('그 외 호스트는 firebaseapp.com 기본값', async () => {
    vi.stubEnv('VITE_FIREBASE_AUTH_DOMAIN', '');
    vi.stubGlobal('window', {
      location: { hostname: 'localhost' },
    });
    const { resolveFirebaseAuthDomain } = await import('./firebaseAuth.js');
    expect(resolveFirebaseAuthDomain()).toBe('indiya-757ba.firebaseapp.com');
  });
});
