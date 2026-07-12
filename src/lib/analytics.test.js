import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildAnalyticsPersonProperties,
  bucketFileSizeMb,
  bucketFindingCount,
  bucketPageCount,
  bucketRuleCount,
} from './analytics.js';

/** 테스트에서 localhost 스킵을 피하려면 배포 호스트로 스텁 */
function stubAnalyticsHost(hostname) {
  vi.stubGlobal('window', {
    location: { hostname },
  });
}

describe('buildAnalyticsPersonProperties', () => {
  const prevEmails = import.meta.env.VITE_BETA_QUOTA_ADMIN_EMAILS;

  afterEach(() => {
    import.meta.env.VITE_BETA_QUOTA_ADMIN_EMAILS = prevEmails;
    vi.resetModules();
  });

  it('면제 이메일이면 is_internal true (이메일은 PostHog로 안 감)', async () => {
    import.meta.env.VITE_BETA_QUOTA_ADMIN_EMAILS = 'dev@test.io';
    vi.resetModules();
    const mod = await import('./analytics.js');
    expect(mod.buildAnalyticsPersonProperties('any-uid', 'dev@test.io')).toEqual({
      is_internal: true,
    });
  });

  it('일반 회원은 is_internal false', async () => {
    import.meta.env.VITE_BETA_QUOTA_ADMIN_EMAILS = 'dev@test.io';
    vi.resetModules();
    const mod = await import('./analytics.js');
    expect(mod.buildAnalyticsPersonProperties('uid-1', 'beta@test.io')).toEqual({
      is_internal: false,
    });
  });
});

describe('identifyAnalyticsUser', () => {
  afterEach(() => {
    vi.doUnmock('posthog-js');
    vi.unstubAllGlobals();
    vi.resetModules();
    delete import.meta.env.VITE_PUBLIC_POSTHOG_KEY;
  });

  it('opt-out 복구 시 PostHog opt_in_capturing 호출', async () => {
    const optIn = vi.fn();
    const optOut = vi.fn();
    vi.doMock('posthog-js', () => ({
      default: {
        init: vi.fn(),
        identify: vi.fn(),
        capture: vi.fn(),
        opt_in_capturing: optIn,
        opt_out_capturing: optOut,
        reset: vi.fn(),
      },
    }));
    stubAnalyticsHost('indiya.vercel.app');
    vi.resetModules();
    import.meta.env.VITE_PUBLIC_POSTHOG_KEY = 'phc_test';
    const mod = await import('./analytics.js');
    await mod.initAnalytics();
    mod.setAnalyticsOptOut(true);
    mod.setAnalyticsOptOut(false);
    expect(optOut).toHaveBeenCalled();
    expect(optIn).toHaveBeenCalled();
  });
});

describe('analytics buckets', () => {
  it('bucketPageCount', () => {
    expect(bucketPageCount(30)).toBe('1-50');
    expect(bucketPageCount(200)).toBe('151-300');
    expect(bucketPageCount(400)).toBe('301+');
  });

  it('bucketFileSizeMb', () => {
    expect(bucketFileSizeMb(5 * 1024 * 1024)).toBe('0-10');
    expect(bucketFileSizeMb(45 * 1024 * 1024)).toBe('30-50');
  });

  it('bucketRuleCount and bucketFindingCount', () => {
    expect(bucketRuleCount(0)).toBe('0');
    expect(bucketRuleCount(25)).toBe('11-30');
    expect(bucketFindingCount(0)).toBe('0');
    expect(bucketFindingCount(250)).toBe('101-500');
  });

  it('bucketUploadIndex', async () => {
    const { bucketUploadIndex } = await import('./analytics.js');
    expect(bucketUploadIndex(1)).toBe('1');
    expect(bucketUploadIndex(2)).toBe('2');
    expect(bucketUploadIndex(4)).toBe('4+');
  });

  it('nextPdfUploadIndex는 localStorage에 누적', async () => {
    const store = new Map();
    vi.stubGlobal('localStorage', {
      getItem: (k) => store.get(k) ?? null,
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    });
    store.set('pdf-proofread-analytics-upload-count', '1');
    vi.resetModules();
    const { nextPdfUploadIndex, readPdfUploadCount } = await import('./analytics.js');
    expect(nextPdfUploadIndex()).toBe(2);
    expect(readPdfUploadCount()).toBe(2);
    vi.unstubAllGlobals();
    vi.resetModules();
  });
});

describe('trackGuestBrowse', () => {
  afterEach(() => {
    vi.doUnmock('posthog-js');
    vi.unstubAllGlobals();
    vi.resetModules();
    delete import.meta.env.VITE_PUBLIC_POSTHOG_KEY;
  });

  it('started는 guest_browse_started를 보낸다', async () => {
    const capture = vi.fn();
    vi.doMock('posthog-js', () => ({
      default: {
        init: vi.fn(),
        identify: vi.fn(),
        capture,
        opt_in_capturing: vi.fn(),
        opt_out_capturing: vi.fn(),
        reset: vi.fn(),
      },
    }));
    stubAnalyticsHost('indiya.vercel.app');
    import.meta.env.VITE_PUBLIC_POSTHOG_KEY = 'phc_test';
    vi.resetModules();
    const mod = await import('./analytics.js');
    await mod.initAnalytics();
    mod.trackGuestBrowseStarted();
    expect(capture).toHaveBeenCalledWith('guest_browse_started', {
      source: 'welcome',
    });
  });

  it('completed는 둘러보기 중일 때만 보낸다', async () => {
    const capture = vi.fn();
    vi.doMock('posthog-js', () => ({
      default: {
        init: vi.fn(),
        identify: vi.fn(),
        capture,
        opt_in_capturing: vi.fn(),
        opt_out_capturing: vi.fn(),
        reset: vi.fn(),
      },
    }));
    stubAnalyticsHost('indiya.vercel.app');
    import.meta.env.VITE_PUBLIC_POSTHOG_KEY = 'phc_test';
    vi.resetModules();
    const session = await import('./guestBrowseSession.js');
    session.endGuestBrowse();
    const mod = await import('./analytics.js');
    await mod.initAnalytics();
    mod.trackGuestBrowseCompleted();
    expect(capture).not.toHaveBeenCalledWith(
      'guest_browse_completed',
      expect.anything(),
    );
    session.beginGuestBrowse();
    mod.trackGuestBrowseCompleted();
    expect(capture).toHaveBeenCalledWith('guest_browse_completed', {
      source: 'work_exit_guide',
    });
    session.endGuestBrowse();
  });

  it('localhost에서는 PostHog를 초기화하지 않는다', async () => {
    const capture = vi.fn();
    const init = vi.fn();
    vi.doMock('posthog-js', () => ({
      default: {
        init,
        identify: vi.fn(),
        capture,
        opt_in_capturing: vi.fn(),
        opt_out_capturing: vi.fn(),
        reset: vi.fn(),
      },
    }));
    stubAnalyticsHost('127.0.0.1');
    import.meta.env.VITE_PUBLIC_POSTHOG_KEY = 'phc_test';
    vi.resetModules();
    const mod = await import('./analytics.js');
    expect(mod.isLocalAnalyticsHost()).toBe(true);
    await mod.initAnalytics();
    mod.trackGuestBrowseStarted();
    expect(init).not.toHaveBeenCalled();
    expect(capture).not.toHaveBeenCalled();
  });
});
