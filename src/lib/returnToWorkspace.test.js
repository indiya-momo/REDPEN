/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  consumeReturnToMainWorkspace,
  markReturnToMainWorkspace,
  shouldReopenMainWorkspace,
} from './returnToWorkspace.js';

describe('returnToMainWorkspace flags', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('mark 후 should/consume로 메인 복귀 플래그를 다룬다', () => {
    expect(shouldReopenMainWorkspace()).toBe(false);
    markReturnToMainWorkspace();
    expect(shouldReopenMainWorkspace()).toBe(true);
    expect(consumeReturnToMainWorkspace()).toBe(true);
    expect(shouldReopenMainWorkspace()).toBe(false);
    expect(consumeReturnToMainWorkspace()).toBe(false);
  });
});
