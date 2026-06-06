import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BETA_TAB_LIMIT_BOOSTED,
  BETA_TAB_LIMIT_DEFAULT,
  BETA_TAB_LIMIT_FEEDBACK,
  canRunTabCheck,
  getKstDayId,
  getTabCheckLimit,
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

describe('getTabCheckLimit', () => {
  it('베타 기본은 탭당 1회', () => {
    expect(getTabCheckLimit(null, null, '2026-06-05')).toBe(
      BETA_TAB_LIMIT_DEFAULT,
    );
  });

  it('피드백 보너스 당일이면 탭당 2회', () => {
    expect(getTabCheckLimit('2026-06-05', null, '2026-06-05')).toBe(
      BETA_TAB_LIMIT_FEEDBACK,
    );
  });

  it('우수 피드백 선정 당일이면 탭당 3회', () => {
    expect(getTabCheckLimit(null, '2026-06-05', '2026-06-05')).toBe(
      BETA_TAB_LIMIT_BOOSTED,
    );
  });

  it('피드백과 선정이 겹치면 3회', () => {
    expect(getTabCheckLimit('2026-06-05', '2026-06-05', '2026-06-05')).toBe(
      BETA_TAB_LIMIT_BOOSTED,
    );
  });

  it('보너스가 다른 날이면 1회', () => {
    expect(getTabCheckLimit('2026-06-04', null, '2026-06-05')).toBe(1);
  });
});

describe('canRunTabCheck', () => {
  it('한도 미만이면 허용', () => {
    expect(canRunTabCheck(0, 1)).toBe(true);
    expect(canRunTabCheck(1, 2)).toBe(true);
    expect(canRunTabCheck(2, 3)).toBe(true);
  });

  it('한도에 도달하면 차단', () => {
    expect(canRunTabCheck(1, 1)).toBe(false);
    expect(canRunTabCheck(2, 2)).toBe(false);
    expect(canRunTabCheck(3, 3)).toBe(false);
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

describe('isBetaDailyQuotaEnforcedForUser localhost dev', () => {
  const prevDev = import.meta.env.DEV;
  const prevForce = import.meta.env.VITE_BETA_QUOTA_FORCE_LOCAL;

  afterEach(() => {
    import.meta.env.DEV = prevDev;
    import.meta.env.VITE_BETA_QUOTA_FORCE_LOCAL = prevForce;
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('localhost dev면 한도 미적용', async () => {
    import.meta.env.DEV = true;
    import.meta.env.VITE_BETA_QUOTA_FORCE_LOCAL = 'false';
    vi.stubGlobal('window', { location: { hostname: 'localhost' } });
    vi.resetModules();
    const mod = await import('./betaDailyQuota.js');
    expect(mod.isBetaDailyQuotaEnforcedForUser('uid-1', 'a@b.c')).toBe(false);
  });

  it('FORCE_LOCAL이면 localhost dev에서도 한도 적용', async () => {
    import.meta.env.DEV = true;
    import.meta.env.VITE_BETA_QUOTA_FORCE_LOCAL = 'true';
    vi.stubGlobal('window', { location: { hostname: 'localhost' } });
    vi.resetModules();
    const mod = await import('./betaDailyQuota.js');
    if (mod.isBetaDailyQuotaEnabled()) {
      expect(mod.isBetaDailyQuotaEnforcedForUser('uid-1', 'a@b.c')).toBe(true);
    }
  });
});
