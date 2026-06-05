import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WORK_GUIDE_KEYS, workGuideStorageKey } from './workGuideKeys.js';
import {
  clearWorkGuideAuthBound,
  syncWorkGuideOnAuthChange,
} from './workGuideLoginSession.js';

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

function dismissKey(uid, guideKey) {
  return `pdf-proofread-tooltip-guide-${workGuideStorageKey(uid, guideKey)}`;
}

describe('workGuideLoginSession', () => {
  it('clears dismissals on first login in tab session', () => {
    localStorage.setItem(dismissKey('u1', WORK_GUIDE_KEYS.PDF_OPENED), '1');

    expect(syncWorkGuideOnAuthChange('u1')).toBe(true);
    expect(localStorage.getItem(dismissKey('u1', WORK_GUIDE_KEYS.PDF_OPENED))).toBe(
      null,
    );
    expect(sessionStorage.getItem('pdf-proofread-work-guide-auth-bound')).toBe('u1');
  });

  it('does not reset again on refresh within same tab session', () => {
    syncWorkGuideOnAuthChange('u1');
    localStorage.setItem(dismissKey('u1', WORK_GUIDE_KEYS.PDF_OPENED), '1');

    expect(syncWorkGuideOnAuthChange('u1')).toBe(false);
    expect(localStorage.getItem(dismissKey('u1', WORK_GUIDE_KEYS.PDF_OPENED))).toBe(
      '1',
    );
  });

  it('resets after logout clears bound and user logs in again', () => {
    syncWorkGuideOnAuthChange('u1');
    localStorage.setItem(dismissKey('u1', WORK_GUIDE_KEYS.LEFT_CRITERIA), '1');
    clearWorkGuideAuthBound();

    expect(syncWorkGuideOnAuthChange('u1')).toBe(true);
    expect(
      localStorage.getItem(dismissKey('u1', WORK_GUIDE_KEYS.LEFT_CRITERIA)),
    ).toBe(null);
  });

  it('resets when switching accounts in the same tab', () => {
    syncWorkGuideOnAuthChange('u1');
    localStorage.setItem(dismissKey('u1', WORK_GUIDE_KEYS.PDF_OPENED), '1');
    localStorage.setItem(dismissKey('u2', WORK_GUIDE_KEYS.PDF_OPENED), '1');

    expect(syncWorkGuideOnAuthChange('u2')).toBe(true);
    expect(localStorage.getItem(dismissKey('u1', WORK_GUIDE_KEYS.PDF_OPENED))).toBe(
      '1',
    );
    expect(localStorage.getItem(dismissKey('u2', WORK_GUIDE_KEYS.PDF_OPENED))).toBe(
      null,
    );
  });
});
