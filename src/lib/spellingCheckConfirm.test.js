import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  alertSpellingCheckAfterRun,
  confirmSpellingCheckBeforeRun,
  countSpellingGroupsWithFindings,
  formatSpellingCheckCompleteMessage,
  formatSpellingCheckConfirmMessage,
} from './spellingCheckConfirm.js';

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
        cautionActive: 5,
      }),
    );
  });
});

describe('formatSpellingCheckConfirmMessage', () => {
  it('한도·기준 개수·확인 문구를 한 블록으로 만든다', () => {
    expect(
      formatSpellingCheckConfirmMessage({
        remaining: 1,
        tabLimit: 2,
        builtinActive: 12,
        cautionActive: 5,
      }),
    ).toBe(
      '오늘 맞춤법 검수는 1회 (한도 2회) 가능합니다\n' +
        '맞춤법 기준 12개, 편집자 검토 필요 기준 5개\n' +
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
      '검수에서 발견한 편집자 검토 필요 기준은 1개, 맞춤법 기준은 2개\n' +
        '원고에 표시된 내용은 총 128개입니다.',
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
