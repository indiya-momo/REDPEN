import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./betaDailyQuota.js', () => ({
  grantFeedbackDailyQuotaBonus: vi.fn(async () => ({
    ok: true,
    granted: true,
    alreadyHadBonus: false,
  })),
  isLocalDevQuotaRelaxed: vi.fn(() => false),
}));

vi.mock('./rewardNotice.js', () => ({
  markRewardNotice: vi.fn(),
}));

import {
  grantFeedbackDailyQuotaBonus,
  isLocalDevQuotaRelaxed,
} from './betaDailyQuota.js';
import {
  FEEDBACK_SUBMITTED_QUERY,
  buildFeedbackFormOpenUrl,
  consumeFeedbackFormSubmitReturn,
  markFeedbackFormSubmitPending,
  resolveFeedbackThankYouOnLoad,
  stripFeedbackSubmittedFromUrl,
} from './feedbackFormSubmitReturn.js';
import { publishFeedbackThankYouSignal } from './feedbackThankYouSignal.js';

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
    expect(grantFeedbackDailyQuotaBonus).not.toHaveBeenCalled();
  });

  it('pending uid 일치 시 제출 보너스를 준다', async () => {
    markFeedbackFormSubmitPending('u1');
    const result = await consumeFeedbackFormSubmitReturn('u1', 'a@b.c');
    expect(result.granted).toBe(true);
    expect(result.showThankYou).toBe(true);
    expect(grantFeedbackDailyQuotaBonus).toHaveBeenCalledWith('u1', 'a@b.c');
    expect(window.history.replaceState).toHaveBeenCalled();
  });

  it('로컬 dev에서는 한도 미지급이어도 선물 UI를 연다', async () => {
    vi.mocked(isLocalDevQuotaRelaxed).mockReturnValue(true);
    vi.mocked(grantFeedbackDailyQuotaBonus).mockResolvedValue({
      ok: true,
      granted: false,
      alreadyHadBonus: false,
    });
    markFeedbackFormSubmitPending('u1');
    const result = await consumeFeedbackFormSubmitReturn('u1');
    expect(result.granted).toBe(false);
    expect(result.localRewardOnly).toBe(true);
    expect(result.showThankYou).toBe(true);
    expect(result.showEventReward).toBe(false);
  });
});

describe('resolveFeedbackThankYouOnLoad', () => {
  it('URL 없이 pending만 있으면 새로고침 시 감사 UI를 연다', async () => {
    vi.mocked(isLocalDevQuotaRelaxed).mockReturnValue(false);
    vi.mocked(grantFeedbackDailyQuotaBonus).mockResolvedValue({
      ok: true,
      granted: false,
      alreadyHadBonus: false,
    });
    window.location.search = '';
    markFeedbackFormSubmitPending('u1');
    const result = await resolveFeedbackThankYouOnLoad('u1');
    expect(result.fromPendingRefresh).toBe(true);
    expect(result.showThankYou).toBe(true);
    expect(grantFeedbackDailyQuotaBonus).toHaveBeenCalledWith('u1', '');
  });

  it('로컬 dev에서 한도 미지급이어도 pending 새로고침 시 감사 UI를 연다', async () => {
    vi.mocked(isLocalDevQuotaRelaxed).mockReturnValue(true);
    vi.mocked(grantFeedbackDailyQuotaBonus).mockResolvedValue({
      ok: true,
      granted: false,
      alreadyHadBonus: false,
    });
    window.location.search = '';
    markFeedbackFormSubmitPending('u1');
    const result = await resolveFeedbackThankYouOnLoad('u1');
    expect(result.fromPendingRefresh).toBe(true);
    expect(result.showThankYou).toBe(true);
    expect(result.localRewardOnly).toBe(true);
  });

  it('탭 간 신호만 있어도 감사 UI를 연다', async () => {
    publishFeedbackThankYouSignal('u1');
    const result = await resolveFeedbackThankYouOnLoad('u1');
    expect(result.fromSignal).toBe(true);
    expect(result.showThankYou).toBe(true);
    expect(grantFeedbackDailyQuotaBonus).not.toHaveBeenCalled();
  });
});

describe('stripFeedbackSubmittedFromUrl', () => {
  it('feedbackSubmitted 파라미터를 제거한다', () => {
    const params = new URLSearchParams('feedbackSubmitted=1&devPdf=x');
    stripFeedbackSubmittedFromUrl(params);
    expect(window.history.replaceState).toHaveBeenCalled();
  });
});
