import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  consumeReturnToMainWorkspace,
  markReturnToMainWorkspace,
  shouldReopenMainWorkspace,
} from './returnToWorkspace.js';

describe('returnToMainWorkspace flags', () => {
  const store = new Map();

  afterEach(() => {
    vi.unstubAllGlobals();
    store.clear();
  });

  it('mark 후 should/consume로 메인 복귀 플래그를 다룬다', () => {
    vi.stubGlobal('sessionStorage', {
      getItem: (key) => store.get(key) ?? null,
      setItem: (key, value) => {
        store.set(key, value);
      },
      removeItem: (key) => {
        store.delete(key);
      },
    });

    expect(shouldReopenMainWorkspace()).toBe(false);
    markReturnToMainWorkspace();
    expect(shouldReopenMainWorkspace()).toBe(true);
    expect(consumeReturnToMainWorkspace()).toBe(true);
    expect(shouldReopenMainWorkspace()).toBe(false);
    expect(consumeReturnToMainWorkspace()).toBe(false);
  });
});
