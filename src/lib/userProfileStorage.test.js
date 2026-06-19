import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  isOnboardingComplete,
  mergeUserProfileFromCloud,
  saveUserProfile,
} from './userProfileStorage.js';

const STORAGE_KEY = 'indiya-user-profile-v1';

/** @type {Record<string, string>} */
const localStore = {};

beforeEach(() => {
  for (const key of Object.keys(localStore)) delete localStore[key];
  vi.stubGlobal('localStorage', {
    getItem: (key) => localStore[key] ?? null,
    setItem: (key, value) => {
      localStore[key] = String(value);
    },
    removeItem: (key) => {
      delete localStore[key];
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
});
