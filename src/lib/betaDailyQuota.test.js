import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BETA_TAB_LIMIT_DEFAULT,
  BETA_TAB_LIMIT_FEEDBACK,
  SIGNUP_BONUS_POLICY_VERSION,
  SIGNUP_BONUS_TAB_CHECKS,
  buildProofreadExportConfirmMessage,
  buildSignupBonusGrantAlert,
  buildSignupBonusGrantFields,
  canRunTabCheck,
  getKstDayId,
  getTabAvailableChecks,
  getTabCheckLimit,
  isBetaDailyQuotaEnabled,
  isBetaQuotaAdminExempt,
  consumeLocalDevQuotaPreview,
  formatBetaQuotaConsumedAlert,
  formatCheckQuotaConsumedLine,
  formatConsistencyCheckQuotaAvailabilityLine,
  formatSpellingCheckQuotaAvailabilityLine,
  getTabQuotaRemainingFromStatus,
  isLocalDevQuotaRelaxed,
  needsSignupBonusPolicyAlign,
  mergeTabQuotaCounts,
  mergeUserBonusDayIds,
  mergeSignupBonusState,
  normalizeBetaQuotaTab,
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
  it('맞춤법 기본은 하루 1회', () => {
    expect(getTabCheckLimit(null, null, '2026-06-05', 'spelling')).toBe(
      BETA_TAB_LIMIT_DEFAULT,
    );
  });

  it('맞춤법 피드백 보너스 당일이면 2회', () => {
    expect(getTabCheckLimit('2026-06-05', null, '2026-06-05', 'spelling')).toBe(
      BETA_TAB_LIMIT_FEEDBACK,
    );
  });

  it('우수 티어(boost)는 무시하고 피드백만 본다', () => {
    expect(getTabCheckLimit(null, '2026-06-05', '2026-06-05', 'spelling')).toBe(
      BETA_TAB_LIMIT_DEFAULT,
    );
    expect(
      getTabCheckLimit('2026-06-05', '2026-06-05', '2026-06-05', 'spelling'),
    ).toBe(BETA_TAB_LIMIT_FEEDBACK);
  });

  it('맞춤법 보너스가 다른 날이면 1회', () => {
    expect(getTabCheckLimit('2026-06-04', null, '2026-06-05', 'spelling')).toBe(
      1,
    );
  });

  it('표기 통일·통일형도 일일 한도는 동일', () => {
    expect(getTabCheckLimit(null, null, '2026-06-05', 'consistency')).toBe(
      BETA_TAB_LIMIT_DEFAULT,
    );
    expect(getTabCheckLimit(null, null, '2026-06-05', 'unify')).toBe(
      BETA_TAB_LIMIT_DEFAULT,
    );
    expect(
      getTabCheckLimit('2026-06-05', null, '2026-06-05', 'consistency'),
    ).toBe(BETA_TAB_LIMIT_FEEDBACK);
  });
});

describe('getTabAvailableChecks / normalizeBetaQuotaTab', () => {
  it('일일 잔여 + 가입 보너스를 합친다', () => {
    expect(getTabAvailableChecks(1, 0, 10)).toBe(11);
    expect(getTabAvailableChecks(1, 1, 10)).toBe(10);
    expect(getTabAvailableChecks(1, 3, 8)).toBe(8);
    expect(getTabAvailableChecks(2, 1, 0)).toBe(1);
    expect(getTabAvailableChecks(1, 1, 0)).toBe(0);
  });

  it('unify는 consistency로 정규화', () => {
    expect(normalizeBetaQuotaTab('unify')).toBe('consistency');
    expect(normalizeBetaQuotaTab('spelling')).toBe('spelling');
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
    expect(formatBetaQuotaConsumedAlert('spelling', 1, 11)).toBe(
      '오늘 맞춤법 검수 횟수가 1회 차감되었습니다.\n\n사용: 1회\n남음: 10회',
    );
  });

  it('일관성 한도 소진 시 남음 0회', () => {
    expect(formatBetaQuotaConsumedAlert('consistency', 11, 11)).toBe(
      '오늘 표기 통일 검수 횟수가 1회 차감되었습니다.\n\n사용: 11회\n남음: 0회',
    );
  });

  it('unify 라벨도 표기 통일로 표시', () => {
    expect(formatBetaQuotaConsumedAlert('unify', 1, 11)).toBe(
      '오늘 표기 통일 검수 횟수가 1회 차감되었습니다.\n\n사용: 1회\n남음: 10회',
    );
  });
});

describe('mergeTabQuotaCounts', () => {
  it('firestore가 0이고 local이 있으면 local을 유지한다', () => {
    expect(
      mergeTabQuotaCounts(
        { spellingCount: 0, consistencyCount: 0 },
        { spellingCount: 1, consistencyCount: 0 },
      ),
    ).toEqual({ spellingCount: 1, consistencyCount: 0 });
  });

  it('firestore가 더 크면 Firestore를 따른다', () => {
    expect(
      mergeTabQuotaCounts(
        { spellingCount: 2, consistencyCount: 1 },
        { spellingCount: 1, consistencyCount: 0 },
      ),
    ).toEqual({ spellingCount: 2, consistencyCount: 1 });
  });
});

describe('mergeUserBonusDayIds / mergeSignupBonusState', () => {
  it('firestore 보너스가 없으면 local 보너스를 쓴다', () => {
    expect(
      mergeUserBonusDayIds(
        { feedbackBonusDayId: null },
        { feedbackBonusDayId: '2026-06-05' },
      ),
    ).toEqual({
      feedbackBonusDayId: '2026-06-05',
      boostApprovedDayId: null,
    });
  });

  it('가입 보너스는 firestore granted를 우선한다', () => {
    expect(
      mergeSignupBonusState(
        {
          signupBonusGranted: true,
          signupBonusSpellingRemaining: 7,
          signupBonusConsistencyRemaining: 9,
        },
        {
          signupBonusGranted: true,
          signupBonusSpellingRemaining: 10,
          signupBonusConsistencyRemaining: 10,
        },
      ),
    ).toEqual({
      signupBonusGranted: true,
      signupBonusSpellingRemaining: 7,
      signupBonusConsistencyRemaining: 9,
      signupBonusPolicyVersion: 0,
    });
  });

  it('미지급이면 가입 보너스 초기값으로 본다', () => {
    expect(
      mergeSignupBonusState(
        {
          signupBonusGranted: false,
          signupBonusSpellingRemaining: SIGNUP_BONUS_TAB_CHECKS,
          signupBonusConsistencyRemaining: SIGNUP_BONUS_TAB_CHECKS,
        },
        {
          signupBonusGranted: false,
          signupBonusSpellingRemaining: SIGNUP_BONUS_TAB_CHECKS,
          signupBonusConsistencyRemaining: SIGNUP_BONUS_TAB_CHECKS,
        },
      ).signupBonusSpellingRemaining,
    ).toBe(SIGNUP_BONUS_TAB_CHECKS);
  });
});

describe('signup bonus policy align', () => {
  it('정책 버전이 다르면 재정렬이 필요하다', () => {
    expect(needsSignupBonusPolicyAlign({ signupBonusPolicyVersion: 0 })).toBe(
      true,
    );
    expect(needsSignupBonusPolicyAlign({ signupBonusPolicyVersion: 1 })).toBe(
      true,
    );
    expect(
      needsSignupBonusPolicyAlign({
        signupBonusPolicyVersion: SIGNUP_BONUS_POLICY_VERSION,
      }),
    ).toBe(false);
  });

  it('지급 필드는 각 5회·현재 정책 버전이다', () => {
    expect(buildSignupBonusGrantFields()).toEqual({
      signupBonusGranted: true,
      signupBonusSpellingRemaining: 5,
      signupBonusConsistencyRemaining: 5,
      signupBonusPolicyVersion: SIGNUP_BONUS_POLICY_VERSION,
    });
  });

  it('로그인 검수권 안내 문구에 가입 보너스 횟수가 들어간다', () => {
    const alert = buildSignupBonusGrantAlert();
    expect(alert.title).toContain('검수권 선물');
    expect(alert.message).toContain(
      `맞춤법·표기 통일 ${SIGNUP_BONUS_TAB_CHECKS}회 검수권🎫`,
    );
    expect(alert.message).toContain('일일 검수권');
    expect(alert.messageNode).toBeTruthy();
  });
});

describe('canRunTabCheck', () => {
  it('한도 미만이면 허용', () => {
    expect(canRunTabCheck(0, 1)).toBe(true);
    expect(canRunTabCheck(1, 2)).toBe(true);
  });

  it('한도에 도달하면 차단', () => {
    expect(canRunTabCheck(1, 1)).toBe(false);
    expect(canRunTabCheck(11, 11)).toBe(false);
  });
});

describe('formatCheckQuotaConsumedLine', () => {
  it('차감 직후 남은 일일·선물 검수권을 한 줄로 만든다', () => {
    expect(formatCheckQuotaConsumedLine(0, 4)).toBe(
      '검수권 1회를 사용했습니다(1일 검수권 0회, 선물 검수권 4회 남음)',
    );
  });
});

describe('formatConsistencyCheckQuotaAvailabilityLine', () => {
  it('표기 통일 검수 직전 가능 횟수를 한 줄로 만든다', () => {
    expect(formatConsistencyCheckQuotaAvailabilityLine(6, 1, 5)).toBe(
      '표기 통일 검수는 6회(1일 검수권 1회, 선물 검수권 5회) 가능합니다',
    );
  });
});

describe('formatSpellingCheckQuotaAvailabilityLine', () => {
  it('맞춤법 검수 직전 가능 횟수를 한 줄로 만든다', () => {
    expect(formatSpellingCheckQuotaAvailabilityLine(5, 0, 5)).toBe(
      '오늘 맞춤법 검수는 5회(1일 검수권 0회, 선물 검수권 5회) 가능합니다',
    );
  });
});

describe('getTabQuotaRemainingFromStatus', () => {
  it('맞춤법 탭 사용 후 일일·선물 잔여를 계산한다', () => {
    expect(
      getTabQuotaRemainingFromStatus(
        {
          spellingCount: 1,
          consistencyCount: 0,
          dailyLimit: 1,
          signupBonusSpellingRemaining: 4,
          signupBonusConsistencyRemaining: 5,
        },
        'spelling',
      ),
    ).toEqual({ dailyRemaining: 0, bonusRemaining: 4 });
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

  it('일일 1회 쓴 뒤에도 가입 보너스로 계속 쓸 수 있다', () => {
    const first = consumeLocalDevQuotaPreview('uid-1', 'spelling', '2026-06-08');
    expect(first.ok).toBe(true);
    expect(first.tabCount).toBe(1);
    expect(first.tabRemaining).toBe(SIGNUP_BONUS_TAB_CHECKS);

    const second = consumeLocalDevQuotaPreview('uid-1', 'spelling', '2026-06-08');
    expect(second.ok).toBe(true);
    expect(second.tabCount).toBe(2);
    expect(second.bonusRemaining).toBe(SIGNUP_BONUS_TAB_CHECKS - 1);
    expect(isLocalDevQuotaRelaxed()).toBe(true);
  });

  it('unify 소비는 consistency 풀을 쓴다', () => {
    const r = consumeLocalDevQuotaPreview('uid-2', 'unify', '2026-06-08');
    expect(r.ok).toBe(true);
    expect(r.tab).toBe('consistency');
    expect(r.tabCount).toBe(1);
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
