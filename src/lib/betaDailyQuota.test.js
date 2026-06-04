import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  canRunBetaCheck,
  getKstDayId,
  isBetaDailyQuotaEnabled,
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
