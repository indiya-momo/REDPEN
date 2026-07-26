import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./betaDailyQuota.js', () => ({
  ensureSignupBonusGranted: vi.fn(async () => ({ ok: true })),
  notifySignupBonusGranted: vi.fn(async () => {}),
}));

import {
  ENTER_MAIN_AFTER_GOOGLE_KEY,
  SIGNUP_BONUS_NOTICE_PENDING_KEY,
  clearSignupBonusLoginPending,
  consumeSignupBonusLoginNotice,
  hasSeenSignupBonusNotice,
  markEnterMainAfterGoogle,
  markSignupBonusNoticePending,
  markSignupBonusNoticeSeen,
  peekSignupBonusLoginPending,
  presentSignupBonusNoticeOnce,
  resetSignupBonusNoticeForTests,
} from './signupBonusNotice.js';
import {
  ensureSignupBonusGranted,
  notifySignupBonusGranted,
} from './betaDailyQuota.js';

describe('signupBonusNotice', () => {
  /** @type {Record<string, string>} */
  const sessionStore = {};
  /** @type {Record<string, string>} */
  const localStore = {};

  beforeEach(() => {
    resetSignupBonusNoticeForTests();
    for (const key of Object.keys(sessionStore)) delete sessionStore[key];
    for (const key of Object.keys(localStore)) delete localStore[key];
    vi.stubGlobal('sessionStorage', {
      getItem: (key) => sessionStore[key] ?? null,
      setItem: (key, value) => {
        sessionStore[key] = String(value);
      },
      removeItem: (key) => {
        delete sessionStore[key];
      },
    });
    vi.stubGlobal('localStorage', {
      getItem: (key) => localStore[key] ?? null,
      setItem: (key, value) => {
        localStore[key] = String(value);
      },
      removeItem: (key) => {
        delete localStore[key];
      },
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('플래그를 찍고 읽을 수 있다', () => {
    markEnterMainAfterGoogle();
    markSignupBonusNoticePending();
    expect(peekSignupBonusLoginPending()).toEqual({
      pendingEnter: true,
      pendingNotice: true,
    });
    clearSignupBonusLoginPending();
    expect(peekSignupBonusLoginPending()).toEqual({
      pendingEnter: false,
      pendingNotice: false,
    });
  });

  it('소비 시 검수권 안내를 띄우고 확인 후에는 계정별로 다시 안 뜬다', async () => {
    markEnterMainAfterGoogle();
    markSignupBonusNoticePending();
    const result = await consumeSignupBonusLoginNotice('uid-1');
    expect(result).toEqual({ handled: true, enterMain: true });
    expect(ensureSignupBonusGranted).toHaveBeenCalledWith('uid-1');
    expect(notifySignupBonusGranted).toHaveBeenCalledTimes(1);
    expect(hasSeenSignupBonusNotice('uid-1')).toBe(true);
    expect(sessionStorage.getItem(ENTER_MAIN_AFTER_GOOGLE_KEY)).toBeNull();
    expect(sessionStorage.getItem(SIGNUP_BONUS_NOTICE_PENDING_KEY)).toBeNull();

    vi.clearAllMocks();
    resetSignupBonusNoticeForTests();
    markEnterMainAfterGoogle();
    markSignupBonusNoticePending();
    await consumeSignupBonusLoginNotice('uid-1');
    expect(notifySignupBonusGranted).not.toHaveBeenCalled();
    expect(ensureSignupBonusGranted).toHaveBeenCalledWith('uid-1');
  });

  it('플래그가 없으면 안내하지 않는다', async () => {
    const result = await consumeSignupBonusLoginNotice('uid-1');
    expect(result).toEqual({ handled: false, enterMain: false });
    expect(notifySignupBonusGranted).not.toHaveBeenCalled();
  });

  it('이미 본 계정은 presentSignupBonusNoticeOnce도 안내하지 않는다', async () => {
    markSignupBonusNoticeSeen('uid-2');
    await presentSignupBonusNoticeOnce('uid-2');
    expect(notifySignupBonusGranted).not.toHaveBeenCalled();
  });
});
