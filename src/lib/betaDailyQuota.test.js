import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  canRunBetaCheck,
  getKstDayId,
  isBetaDailyQuotaEnabled,
  isBetaQuotaAdminExempt,
} from './betaDailyQuota.js';

describe('getKstDayId', () => {
  it('UTC 15:00 전날 KST는 전날 날짜', () => {
    const utc = new Date('2026-06-02T14:59:59.000Z');
    expect(getKstDayId(utc)).toBe('2026-06-02');
  });

  it('UTC 15:00 이후 KST는 당일', () => {
    const utc = new Date('2026-06-02T15:00:00.000Z');
    expect(getKstDayId(utc)).toBe('2026-06-03');
  });
});

describe('canRunBetaCheck', () => {
  it('첫 검수 전이면 항상 허용', () => {
    expect(canRunBetaCheck(false, true)).toBe(true);
    expect(canRunBetaCheck(false, false)).toBe(true);
  });

  it('첫 검수 후 오늘 이미 썼으면 차단', () => {
    expect(canRunBetaCheck(true, true)).toBe(false);
  });

  it('첫 검수 후 오늘 아직 안 썼으면 허용', () => {
    expect(canRunBetaCheck(true, false)).toBe(true);
  });
});

describe('isBetaDailyQuotaEnabled', () => {
  const prev = import.meta.env.VITE_BETA_DAILY_QUOTA;

  afterEach(() => {
    import.meta.env.VITE_BETA_DAILY_QUOTA = prev;
    vi.resetModules();
  });

  it('env false면 비활성', async () => {
    import.meta.env.VITE_BETA_DAILY_QUOTA = 'false';
    vi.resetModules();
    const mod = await import('./betaDailyQuota.js');
    expect(mod.isBetaDailyQuotaEnabled()).toBe(false);
  });
});

describe('isBetaQuotaAdminExempt', () => {
  const prevUids = import.meta.env.VITE_BETA_QUOTA_ADMIN_UIDS;
  const prevEmails = import.meta.env.VITE_BETA_QUOTA_ADMIN_EMAILS;

  afterEach(() => {
    import.meta.env.VITE_BETA_QUOTA_ADMIN_UIDS = prevUids;
    import.meta.env.VITE_BETA_QUOTA_ADMIN_EMAILS = prevEmails;
    vi.resetModules();
  });

  it('관리자 이메일 목록에 있으면 면제', async () => {
    import.meta.env.VITE_BETA_QUOTA_ADMIN_EMAILS = 'Admin@Example.com, dev@test.io';
    vi.resetModules();
    const mod = await import('./betaDailyQuota.js');
    expect(mod.isBetaQuotaAdminExempt('any-uid', 'dev@test.io')).toBe(true);
    expect(mod.isBetaQuotaAdminExempt('any-uid', 'other@test.io')).toBe(false);
  });

  it('관리자 uid 목록에 있으면 면제', async () => {
    import.meta.env.VITE_BETA_QUOTA_ADMIN_UIDS = 'uid-abc,uid-xyz';
    vi.resetModules();
    const mod = await import('./betaDailyQuota.js');
    expect(mod.isBetaQuotaAdminExempt('uid-abc', '')).toBe(true);
    if (mod.isBetaDailyQuotaEnabled()) {
      expect(mod.isBetaDailyQuotaEnforcedForUser('uid-abc', 'x@y.z')).toBe(
        false,
      );
    }
  });
});
