import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BETA_TAB_LIMIT_BOOSTED,
  BETA_TAB_LIMIT_DEFAULT,
  BETA_TAB_LIMIT_FEEDBACK,
  buildProofreadExportConfirmMessage,
  canRunTabCheck,
  getKstDayId,
  getTabCheckLimit,
  isBetaDailyQuotaEnabled,
  isBetaQuotaAdminExempt,
  consumeLocalDevQuotaPreview,
  formatBetaQuotaConsumedAlert,
  isLocalDevQuotaRelaxed,
  mergeTabQuotaCounts,
  mergeUserBonusDayIds,
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

describe('buildProofreadExportConfirmMessage', () => {
  it('맞춤법·표기 통일 탭별 제목과 본문을 만든다', () => {
    expect(buildProofreadExportConfirmMessage('spelling')).toBe(
      '[맞춤법 검수 결과 다운로드]\n' +
        '오늘 맞춤법 검수 결과 다운로드는 1회 가능합니다.\n\n' +
        '다운로드를 진행할까요?\n\n' +
        '※ 엑셀(.xlsx)파일로 진행되며, PDF 다운로드는 준비중입니다',
    );
    expect(buildProofreadExportConfirmMessage('consistency')).toBe(
      '[표기 통일 검수 결과 다운로드]\n' +
        '오늘 표기 통일 검수 결과 다운로드는 1회 가능합니다.\n\n' +
        '다운로드를 진행할까요?\n\n' +
        '※ 엑셀(.xlsx)파일로 진행되며, PDF 다운로드는 준비중입니다',
    );
  });
});

describe('formatBetaQuotaConsumedAlert', () => {
  it('맞춤법 차감 후 사용·남은 횟수를 표시한다', () => {
    expect(formatBetaQuotaConsumedAlert('spelling', 1, 2)).toBe(
      '오늘 맞춤법 검수 횟수가 1회 차감되었습니다.\n\n사용: 1/2회\n남음: 1회',
    );
  });

  it('일관성 한도 소진 시 남음 0회', () => {
    expect(formatBetaQuotaConsumedAlert('consistency', 3, 3)).toBe(
      '오늘 표기 통일 검수 횟수가 1회 차감되었습니다.\n\n사용: 3/3회\n남음: 0회',
    );
  });
});

describe('mergeTabQuotaCounts', () => {
  it('Firestore가 0이고 local이 있으면 local을 유지한다', () => {
    expect(
      mergeTabQuotaCounts(
        { spellingCount: 0, consistencyCount: 0 },
        { spellingCount: 1, consistencyCount: 0 },
      ),
    ).toEqual({ spellingCount: 1, consistencyCount: 0 });
  });

  it('Firestore가 더 크면 Firestore를 따른다', () => {
    expect(
      mergeTabQuotaCounts(
        { spellingCount: 2, consistencyCount: 1 },
        { spellingCount: 1, consistencyCount: 0 },
      ),
    ).toEqual({ spellingCount: 2, consistencyCount: 1 });
  });
});

describe('mergeUserBonusDayIds', () => {
  it('Firestore 보너스가 없으면 local 보너스를 쓴다', () => {
    expect(
      mergeUserBonusDayIds(
        { feedbackBonusDayId: null, boostApprovedDayId: null },
        { feedbackBonusDayId: '2026-06-05', boostApprovedDayId: null },
      ),
    ).toEqual({
      feedbackBonusDayId: '2026-06-05',
      boostApprovedDayId: null,
    });
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

describe('consumeLocalDevQuotaPreview', () => {
  const prevDev = import.meta.env.DEV;
  const prevRelax = import.meta.env.VITE_BETA_QUOTA_RELAX_LOCAL;
  const localStore = {};

  beforeEach(() => {
    import.meta.env.DEV = true;
    import.meta.env.VITE_BETA_QUOTA_RELAX_LOCAL = 'true';
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
    vi.stubGlobal('window', { location: { hostname: 'localhost' } });
  });

  afterEach(() => {
    import.meta.env.DEV = prevDev;
    import.meta.env.VITE_BETA_QUOTA_RELAX_LOCAL = prevRelax;
    vi.unstubAllGlobals();
  });

  it('RELAX_LOCAL일 때 맞춤법 검수 횟수를 local에 누적한다', () => {
    const first = consumeLocalDevQuotaPreview('uid-1', 'spelling', '2026-06-08');
    expect(first.tabCount).toBe(1);
    expect(first.tabLimit).toBe(1);
    expect(first.tabRemaining).toBe(0);

    const second = consumeLocalDevQuotaPreview('uid-1', 'spelling', '2026-06-08');
    expect(second.tabCount).toBe(2);
    expect(isLocalDevQuotaRelaxed()).toBe(true);
  });
});

describe('isBetaDailyQuotaEnforcedForUser localhost dev', () => {
  const prevDev = import.meta.env.DEV;
  const prevRelax = import.meta.env.VITE_BETA_QUOTA_RELAX_LOCAL;

  afterEach(() => {
    import.meta.env.DEV = prevDev;
    import.meta.env.VITE_BETA_QUOTA_RELAX_LOCAL = prevRelax;
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('localhost dev 기본은 배포와 같이 한도 적용', async () => {
    import.meta.env.DEV = true;
    import.meta.env.VITE_BETA_QUOTA_RELAX_LOCAL = 'false';
    vi.stubGlobal('window', { location: { hostname: 'localhost' } });
    vi.resetModules();
    const mod = await import('./betaDailyQuota.js');
    if (mod.isBetaDailyQuotaEnabled()) {
      expect(mod.isBetaDailyQuotaEnforcedForUser('uid-1', 'a@b.c')).toBe(true);
    }
  });

  it('RELAX_LOCAL이면 localhost dev에서 한도 미적용', async () => {
    import.meta.env.DEV = true;
    import.meta.env.VITE_BETA_QUOTA_RELAX_LOCAL = 'true';
    vi.stubGlobal('window', { location: { hostname: 'localhost' } });
    vi.resetModules();
    const mod = await import('./betaDailyQuota.js');
    expect(mod.isBetaDailyQuotaEnforcedForUser('uid-1', 'a@b.c')).toBe(false);
  });

  it('유료 plan이면 한도 미적용', async () => {
    import.meta.env.DEV = true;
    import.meta.env.VITE_BETA_QUOTA_RELAX_LOCAL = 'false';
    vi.stubGlobal('window', { location: { hostname: 'localhost' } });
    vi.resetModules();
    const mod = await import('./betaDailyQuota.js');
    expect(mod.isBetaDailyQuotaEnforcedForUser('uid-1', 'a@b.c', 'paid')).toBe(
      false,
    );
    if (mod.isBetaDailyQuotaEnabled()) {
      expect(
        mod.isBetaDailyQuotaEnforcedForUser('uid-1', 'a@b.c', 'free'),
      ).toBe(true);
    }
  });
});
