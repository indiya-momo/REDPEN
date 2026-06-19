import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  assertLoggedInForCheckOrAlert,
  CHECK_LOGIN_REQUIRED_ALERT,
  isLoginRequiredForChecks,
} from './checkAuthGate.js';

describe('checkAuthGate', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('Firebase가 켜져 있으면 검수에 로그인을 요구한다', () => {
    expect(isLoginRequiredForChecks()).toBe(true);
  });

  it('uid 없으면 alert 후 거부한다', () => {
    const alert = vi.fn();
    vi.stubGlobal('alert', alert);
    expect(assertLoggedInForCheckOrAlert('')).toBe(false);
    expect(alert).toHaveBeenCalledWith(CHECK_LOGIN_REQUIRED_ALERT);
  });

  it('uid 있으면 통과한다', () => {
    const alert = vi.fn();
    vi.stubGlobal('alert', alert);
    expect(assertLoggedInForCheckOrAlert('user-abc')).toBe(true);
    expect(alert).not.toHaveBeenCalled();
  });
});
