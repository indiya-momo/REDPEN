import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  clearRememberedAuthEmail,
  getRememberedAuthEmail,
  rememberAuthEmail,
} from './authEmailCache.js';

describe('authEmailCache', () => {
  /** @type {Map<string, string>} */
  let store;

  beforeEach(() => {
    store = new Map();
    vi.stubGlobal('localStorage', {
      getItem: (key) => store.get(key) ?? null,
      setItem: (key, value) => {
        store.set(key, String(value));
      },
      removeItem: (key) => {
        store.delete(key);
      },
      clear: () => {
        store.clear();
      },
    });
  });

  it('remembers and reads email by uid', () => {
    rememberAuthEmail('uid-1', 'user@example.com');
    expect(getRememberedAuthEmail('uid-1')).toBe('user@example.com');
    expect(getRememberedAuthEmail('uid-2')).toBe('');
  });

  it('clears email on logout path', () => {
    rememberAuthEmail('uid-1', 'user@example.com');
    clearRememberedAuthEmail('uid-1');
    expect(getRememberedAuthEmail('uid-1')).toBe('');
  });
});
