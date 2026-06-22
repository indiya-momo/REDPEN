import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  alertSpellingCheckAfterRun,
  confirmSpellingCheckBeforeRun,
  countSpellingGroupsWithFindings,
  formatSpellingCheckCompleteMessage,
  formatSpellingCheckConfirmMessage,
} from './spellingCheckConfirm.js';
import { BUILT_IN_QUOTA_RULES } from './builtInRules.js';
import { CAUTION_SEARCH_RULES } from './cautionRules.js';

vi.mock('./checkAuthGate.js', () => ({
  assertLoggedInForCheckOrAlert: () => true,
}));

vi.mock('./betaDailyQuota.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    isBetaDailyQuotaEnabled: vi.fn(() => true),
    isBetaDailyQuotaEnforcedForUser: vi.fn(() => false),
    getBetaDailyQuotaStatus: vi.fn(async () => ({
      spellingCount: 1,
      tabLimit: 2,
    })),
  };
});

vi.mock('./activeRuleCount.js', () => ({
  countBuiltInActiveRules: () => 12,
  countSpacingReviewActiveRules: () => 5,
}));

afterEach(() => {
  vi.restoreAllMocks();
  vi.stubGlobal('confirm', vi.fn(() => true));
  vi.stubGlobal('alert', vi.fn());
});

describe('confirmSpellingCheckBeforeRun', () => {
  it('한도 미적용(관리자·로컬)이어도 한도 문장을 포함한다', async () => {
    const confirmMock = vi.fn(() => true);
    vi.stubGlobal('confirm', confirmMock);

    await confirmSpellingCheckBeforeRun('uid-1', 'a@b.c', {});

    expect(confirmMock).toHaveBeenCalledWith(
      formatSpellingCheckConfirmMessage({
        remaining: 1,
        tabLimit: 2,
        builtinActive: 12,
        builtinTotal: BUILT_IN_QUOTA_RULES.length,
        cautionActive: 5,
        cautionTotal: CAUTION_SEARCH_RULES.length,
      }),
    );
  });
});

describe('formatSpellingCheckConfirmMessage', () => {
  it('한도·기준 개수·확인 문구를 한 블록으로 만든다', () => {
    expect(
      formatSpellingCheckConfirmMessage({
        remaining: 1,
        tabLimit: 1,
        builtinActive: 30,
        builtinTotal: 60,
        cautionActive: 16,
        cautionTotal: 18,
      }),
    ).toBe(
      '오늘 맞춤법 검수는 1회(한도 1회) 가능합니다\n' +
        '편집자 검토 필요 기준(16/18), 맞춤법 기준(60/30)\n' +
        '검수를 진행할까요?',
    );
  });
});

describe('countSpellingGroupsWithFindings', () => {
  it('발견이 있는 기준 그룹만 카테고리별로 센다', () => {
    expect(
      countSpellingGroupsWithFindings([
        { category: 'caution', instances: [{}, {}] },
        { category: 'caution', instances: [] },
        { category: 'spelling', instances: [{}] },
        { category: 'spelling', instances: [] },
      ]),
    ).toEqual({
      cautionWithFindings: 1,
      builtinWithFindings: 1,
    });
  });
});

describe('formatSpellingCheckCompleteMessage', () => {
  it('발견된 기준·총 발견 건수를 완료 alert 본문으로 만든다', () => {
    expect(
      formatSpellingCheckCompleteMessage({
        builtinWithFindings: 2,
        cautionWithFindings: 1,
        totalFindings: 128,
      }),
    ).toBe(
      '검수를 진행했습니다\n' +
        '편집자 검토 기준 {1}, 맞춤법 기준 {2}이 해당되어\n' +
        '전체 발견은 [128]입니다',
    );
  });
});

describe('alertSpellingCheckAfterRun', () => {
  it('검수 완료 alert를 띄운다', () => {
    const alertMock = vi.fn();
    vi.stubGlobal('alert', alertMock);

    alertSpellingCheckAfterRun(
      [
        { category: 'caution', instances: [{}] },
        { category: 'spelling', instances: [{}] },
      ],
      3,
    );

    expect(alertMock).toHaveBeenCalledWith(
      formatSpellingCheckCompleteMessage({
        builtinWithFindings: 1,
        cautionWithFindings: 1,
        totalFindings: 3,
      }),
    );
  });
});
