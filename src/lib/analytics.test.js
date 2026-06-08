import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildAnalyticsPersonProperties,
  bucketFileSizeMb,
  bucketFindingCount,
  bucketPageCount,
  bucketRuleCount,
} from './analytics.js';

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
    vi.resetModules();
    import.meta.env.VITE_PUBLIC_POSTHOG_KEY = 'phc_test';
    const mod = await import('./analytics.js');
    await mod.initAnalytics();
    mod.setAnalyticsOptOut(true);
    mod.setAnalyticsOptOut(false);
    expect(optOut).toHaveBeenCalled();
    expect(optIn).toHaveBeenCalled();
    vi.doUnmock('posthog-js');
    vi.resetModules();
    delete import.meta.env.VITE_PUBLIC_POSTHOG_KEY;
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
});
