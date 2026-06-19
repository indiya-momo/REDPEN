import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./betaDailyQuota.js', () => ({
  grantFeedbackDailyQuotaBonus: vi.fn(async () => ({
    ok: true,
    granted: true,
    alreadyHadBonus: false,
  })),
}));

vi.mock('./badgeGrants.js', () => ({
  grantBadgeIfNew: vi.fn(() => true),
}));

import { grantFeedbackDailyQuotaBonus } from './betaDailyQuota.js';
import { grantBadgeIfNew } from './badgeGrants.js';
import {
  FEEDBACK_SUBMITTED_QUERY,
  buildFeedbackFormOpenUrl,
  consumeFeedbackFormSubmitReturn,
  markFeedbackFormSubmitPending,
  resolveFeedbackThankYouOnLoad,
  stripFeedbackSubmittedFromUrl,
} from './feedbackFormSubmitReturn.js';

const PENDING_KEY = 'indiya-feedback-submit-pending';

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
  const replaceState = vi.fn();
  vi.stubGlobal('window', {
    location: {
      href: 'https://indiya.vercel.app/?feedbackSubmitted=1',
      pathname: '/',
      search: '?feedbackSubmitted=1',
      hash: '',
      origin: 'https://indiya.vercel.app',
    },
    history: { replaceState },
  });
  vi.mocked(grantFeedbackDailyQuotaBonus).mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('buildFeedbackFormOpenUrl', () => {
  it('entry uid가 있으면 prefill 쿼리를 붙인다', () => {
    import.meta.env.VITE_FEEDBACK_FORM_ENTRY_UID = 'entry.999';
    import.meta.env.VITE_FEEDBACK_FORM_VIEW_URL =
      'https://docs.google.com/forms/d/e/abc/viewform';
    expect(buildFeedbackFormOpenUrl('uid-abc')).toBe(
      'https://docs.google.com/forms/d/e/abc/viewform?entry.999=uid-abc',
    );
  });
});

describe('consumeFeedbackFormSubmitReturn', () => {
  it('쿼리 없으면 처리하지 않는다', async () => {
    window.location.search = '';
    const result = await consumeFeedbackFormSubmitReturn('u1');
    expect(result.handled).toBe(false);
    expect(grantFeedbackDailyQuotaBonus).not.toHaveBeenCalled();
  });

  it('pending 없으면 혜택을 주지 않는다', async () => {
    const result = await consumeFeedbackFormSubmitReturn('u1');
    expect(result.handled).toBe(true);
    expect(result.granted).toBe(false);
    expect(result.showThankYou).toBe(false);
    expect(grantFeedbackDailyQuotaBonus).not.toHaveBeenCalled();
  });

  it('pending uid 일치 시 보너스만 주고 pending은 유지한다', async () => {
    markFeedbackFormSubmitPending('u1');
    const result = await consumeFeedbackFormSubmitReturn('u1', 'a@b.c');
    expect(result.granted).toBe(true);
    expect(result.showThankYou).toBe(false);
    expect(grantFeedbackDailyQuotaBonus).toHaveBeenCalledWith('u1', 'a@b.c');
    expect(grantBadgeIfNew).toHaveBeenCalledWith('u1', 'slot-2', {
      notify: true,
    });
    expect(localStorage.getItem(PENDING_KEY)).not.toBeNull();
    expect(window.history.replaceState).toHaveBeenCalled();
  });
});

describe('resolveFeedbackThankYouOnLoad', () => {
  it('URL 없이 pending만 있으면 새로고침 시 감사 UI를 연다', async () => {
    window.location.search = '';
    markFeedbackFormSubmitPending('u1');
    const result = await resolveFeedbackThankYouOnLoad('u1');
    expect(result.fromPendingRefresh).toBe(true);
    expect(result.showThankYou).toBe(true);
    expect(grantFeedbackDailyQuotaBonus).toHaveBeenCalledWith('u1', '');
    expect(localStorage.getItem(PENDING_KEY)).toBeNull();
  });

  it('Form 리다이렉트 후 작업 탭 새로고침 시 감사 UI를 연다', async () => {
    markFeedbackFormSubmitPending('u1');
    const redirect = await resolveFeedbackThankYouOnLoad('u1');
    expect(redirect.showThankYou).toBe(false);
    expect(localStorage.getItem(PENDING_KEY)).not.toBeNull();

    window.location.search = '';
    const refresh = await resolveFeedbackThankYouOnLoad('u1');
    expect(refresh.fromPendingRefresh).toBe(true);
    expect(refresh.showThankYou).toBe(true);
    expect(localStorage.getItem(PENDING_KEY)).toBeNull();
  });

  it('리다이렉트 탭에서는 말풍선을 띄우지 않는다', async () => {
    markFeedbackFormSubmitPending('u1');
    const result = await resolveFeedbackThankYouOnLoad('u1');
    expect(result.showThankYou).toBe(false);
  });
});

describe('stripFeedbackSubmittedFromUrl', () => {
  it('feedbackSubmitted 파라미터를 제거한다', () => {
    const params = new URLSearchParams('feedbackSubmitted=1&devPdf=x');
    stripFeedbackSubmittedFromUrl(params);
    expect(window.history.replaceState).toHaveBeenCalled();
  });
});
