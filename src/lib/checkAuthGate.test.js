import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  assertLoggedInForCheckOrAlert,
  CHECK_LOGIN_REQUIRED_ALERT,
  isCheckAuthBlocked,
  isLoginRequiredForChecks,
} from './checkAuthGate.js';
import {
  beginGuestBrowse,
  endGuestBrowse,
} from './guestBrowsePolicy.js';

describe('checkAuthGate', () => {
  afterEach(() => {
    endGuestBrowse();
    vi.unstubAllGlobals();
  });

  it('Firebase가 켜져 있으면 검수에 로그인을 요구한다', () => {
    expect(isLoginRequiredForChecks()).toBe(true);
  });

  it('uid 없으면 alert 후 거부한다', () => {
    const alert = vi.fn();
    vi.stubGlobal('alert', alert);
    expect(assertLoggedInForCheckOrAlert('')).toBe(false);
    expect(isCheckAuthBlocked('')).toBe(true);
    expect(alert).toHaveBeenCalledWith(CHECK_LOGIN_REQUIRED_ALERT);
  });

  it('uid 있으면 통과한다', () => {
    const alert = vi.fn();
    vi.stubGlobal('alert', alert);
    expect(assertLoggedInForCheckOrAlert('user-abc')).toBe(true);
    expect(isCheckAuthBlocked('user-abc')).toBe(false);
    expect(alert).not.toHaveBeenCalled();
  });

  it('둘러보기 중이면 uid 없이도 검수·결과 팝업을 허용한다', () => {
    const alert = vi.fn();
    vi.stubGlobal('alert', alert);
    beginGuestBrowse();
    expect(isCheckAuthBlocked('')).toBe(false);
    expect(assertLoggedInForCheckOrAlert('')).toBe(true);
    expect(alert).not.toHaveBeenCalled();
  });
});
