import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WORK_GUIDE_KEYS, workGuideStorageKey } from './workGuideKeys.js';
import {
  clearWorkGuideAuthBound,
  syncWorkGuideOnAuthChange,
} from './workGuideLoginSession.js';

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

function dismissKey(uid, guideKey) {
  return `pdf-proofread-tooltip-guide-${workGuideStorageKey(uid, guideKey)}`;
}

describe('workGuideLoginSession', () => {
  it('로그인해도 dismiss를 초기화하지 않는다', () => {
    localStorage.setItem(dismissKey('u1', WORK_GUIDE_KEYS.PDF_OPENED), '1');

    expect(syncWorkGuideOnAuthChange('u1')).toBe(false);
    expect(localStorage.getItem(dismissKey('u1', WORK_GUIDE_KEYS.PDF_OPENED))).toBe(
      '1',
    );
  });

  it('계정 전환해도 각 uid dismiss는 유지한다', () => {
    localStorage.setItem(dismissKey('u1', WORK_GUIDE_KEYS.PDF_OPENED), '1');
    localStorage.setItem(dismissKey('u2', WORK_GUIDE_KEYS.PDF_OPENED), '1');

    expect(syncWorkGuideOnAuthChange('u2')).toBe(false);
    expect(localStorage.getItem(dismissKey('u1', WORK_GUIDE_KEYS.PDF_OPENED))).toBe(
      '1',
    );
    expect(localStorage.getItem(dismissKey('u2', WORK_GUIDE_KEYS.PDF_OPENED))).toBe(
      '1',
    );
  });

  it('로그아웃 시 bound 초기화는 no-op', () => {
    expect(() => clearWorkGuideAuthBound()).not.toThrow();
  });
});
