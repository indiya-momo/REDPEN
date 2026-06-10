import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  confirmSpellingCheckBeforeRun,
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
