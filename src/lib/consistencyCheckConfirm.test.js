import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  alertConsistencyCheckAfterRun,
  confirmConsistencyCheckBeforeRun,
  countConsistencyCheckActiveRules,
  countConsistencyGroupsWithFindings,
  formatConsistencyCheckCompleteMessage,
  formatConsistencyCheckConfirmMessage,
} from './consistencyCheckConfirm.js';

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
      consistencyCount: 1,
      tabLimit: 2,
    })),
  };
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.stubGlobal('confirm', vi.fn(() => true));
  vi.stubGlobal('alert', vi.fn());
});

describe('countConsistencyCheckActiveRules', () => {
  it('UI에 보이는 등록 항목(켜진 것)만 센다', () => {
    expect(
      countConsistencyCheckActiveRules([
        { enabled: true, patternKind: 'compound-find', tailWord: '조선시대' },
        { enabled: true, patternKind: 'compound-find', tailWord: '조선시대' },
        { enabled: false, patternKind: 'compound-find', tailWord: '고려시대' },
        { enabled: true, patternKind: 'phrase-slot-find', tailWord: '@시대' },
        {
          enabled: true,
          patternKind: 'auxiliary-verb',
          bonBojoItemId: 'verb-oda',
          tailWord: '오다',
        },
        {
          enabled: true,
          patternKind: 'auxiliary-verb',
          bonBojoItemId: 'verb-oda',
          tailWord: '오다',
        },
        {
          enabled: true,
          patternKind: 'auxiliary-verb',
          bonBojoItemId: 'verb-gada',
          tailWord: '가다',
        },
      ]),
    ).toEqual({ literalActive: 2, auxiliaryActive: 2 });
  });
});

describe('confirmConsistencyCheckBeforeRun', () => {
  it('한도 미적용이어도 한도 문장을 포함한다', async () => {
    const confirmMock = vi.fn(() => true);
    vi.stubGlobal('confirm', confirmMock);

    await confirmConsistencyCheckBeforeRun('uid-1', 'a@b.c', [
      { enabled: true, patternKind: 'phrase-slot-find', tailWord: '@시대' },
      {
        enabled: true,
        patternKind: 'auxiliary-verb',
        bonBojoItemId: 'verb-oda',
        tailWord: '오다',
      },
      {
        enabled: true,
        patternKind: 'auxiliary-verb',
        bonBojoItemId: 'verb-oda',
        tailWord: '오다',
      },
    ]);

    expect(confirmMock).toHaveBeenCalledWith(
      formatConsistencyCheckConfirmMessage({
        remaining: 1,
        tabLimit: 2,
        literalActive: 1,
        auxiliaryActive: 1,
      }),
    );
  });
});

describe('countConsistencyGroupsWithFindings', () => {
  it('발견이 있는 기준 그룹만 카테고리별로 센다', () => {
    expect(
      countConsistencyGroupsWithFindings([
        { patternKind: 'compound-find', instances: [{}, {}] },
        { patternKind: 'compound-find', instances: [] },
        { patternKind: 'auxiliary-verb', instances: [{}] },
      ]),
    ).toEqual({
      literalWithFindings: 1,
      auxiliaryWithFindings: 1,
    });
  });
});

describe('formatConsistencyCheckCompleteMessage', () => {
  it('발견된 기준·총 발견 건수를 완료 alert 본문으로 만든다', () => {
    expect(
      formatConsistencyCheckCompleteMessage({
        literalWithFindings: 2,
        auxiliaryWithFindings: 1,
        totalFindings: 40,
      }),
    ).toBe(
      '검수에서 발견한 일관성 찾기는 2개, 본용언 + 보조용언 표기는 1개\n' +
        '원고에 표시된 내용은 총 40개입니다.',
    );
  });
});

describe('alertConsistencyCheckAfterRun', () => {
  it('검수 완료 alert를 띄운다', () => {
    const alertMock = vi.fn();
    vi.stubGlobal('alert', alertMock);

    alertConsistencyCheckAfterRun(
      [
        { patternKind: 'phrase-slot-find', instances: [{}] },
        { patternKind: 'auxiliary-verb', instances: [{}, {}] },
      ],
      3,
    );

    expect(alertMock).toHaveBeenCalledWith(
      formatConsistencyCheckCompleteMessage({
        literalWithFindings: 1,
        auxiliaryWithFindings: 1,
        totalFindings: 3,
      }),
    );
  });
});
