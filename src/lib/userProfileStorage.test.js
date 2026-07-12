import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearLocalUserProfile,
  consumeResetOnboardingQuery,
  isOnboardingComplete,
  mergeUserProfileFromCloud,
  saveUserProfile,
  shouldSkipProfileCloudMerge,
} from './userProfileStorage.js';

const STORAGE_KEY = 'indiya-user-profile-v1';

/** @type {Record<string, string>} */
const localStore = {};
/** @type {Record<string, string>} */
const sessionStore = {};

beforeEach(() => {
  for (const key of Object.keys(localStore)) delete localStore[key];
  for (const key of Object.keys(sessionStore)) delete sessionStore[key];
  vi.stubGlobal('localStorage', {
    getItem: (key) => localStore[key] ?? null,
    setItem: (key, value) => {
      localStore[key] = String(value);
    },
    removeItem: (key) => {
      delete localStore[key];
    },
  });
  vi.stubGlobal('sessionStorage', {
    getItem: (key) => sessionStore[key] ?? null,
    setItem: (key, value) => {
      sessionStore[key] = String(value);
    },
    removeItem: (key) => {
      delete sessionStore[key];
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('userProfileStorage', () => {
  it('marks onboarding complete after modal save', () => {
    saveUserProfile('uid-a', { nickname: '모모친구' });
    expect(isOnboardingComplete('uid-a')).toBe(true);
  });

  it('treats legacy auto-save profiles as complete when nickname exists', () => {
    localStore[STORAGE_KEY] = JSON.stringify({
      'uid-legacy': {
        nickname: '편집자1234',
        onboardingComplete: true,
        userConfirmed: false,
        completedAt: 1,
      },
    });
    expect(isOnboardingComplete('uid-legacy')).toBe(true);
  });

  it('merges newer cloud profile into local storage', () => {
    saveUserProfile('uid-b', { nickname: '로컬' });
    const merged = mergeUserProfileFromCloud('uid-b', {
      nickname: '클라우드',
      onboardingComplete: true,
      userConfirmed: true,
      completedAt: Date.now() + 1000,
    });
    expect(merged).toBe(true);
    expect(isOnboardingComplete('uid-b')).toBe(true);
  });

  it('returns null when localStorage write fails', () => {
    vi.stubGlobal('localStorage', {
      getItem: (key) => localStore[key] ?? null,
      setItem: () => {
        throw new Error('quota');
      },
      removeItem: (key) => {
        delete localStore[key];
      },
    });
    expect(saveUserProfile('uid-c', { nickname: '실패' })).toBeNull();
    expect(isOnboardingComplete('uid-c')).toBe(false);
  });

  it('clears local onboarding for one uid', () => {
    saveUserProfile('uid-a', { nickname: 'A' });
    saveUserProfile('uid-b', { nickname: 'B' });
    expect(clearLocalUserProfile('uid-a')).toBe(true);
    expect(isOnboardingComplete('uid-a')).toBe(false);
    expect(isOnboardingComplete('uid-b')).toBe(true);
  });

  it('consumes ?resetOnboarding=1 and skips cloud merge this tab', () => {
    saveUserProfile('uid-d', { nickname: '리셋전' });
    const replaceState = vi.fn();
    vi.stubGlobal('window', {
      location: {
        search: '?resetOnboarding=1&workGuidePin=1',
        pathname: '/',
        hash: '',
      },
      history: { replaceState },
    });
    expect(consumeResetOnboardingQuery()).toBe(true);
    expect(isOnboardingComplete('uid-d')).toBe(false);
    expect(shouldSkipProfileCloudMerge()).toBe(true);
    expect(replaceState).toHaveBeenCalled();
    const nextUrl = replaceState.mock.calls[0][2];
    expect(String(nextUrl)).toContain('workGuidePin=1');
    expect(String(nextUrl)).not.toContain('resetOnboarding');
  });
});
