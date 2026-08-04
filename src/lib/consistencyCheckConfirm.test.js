import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  alertConsistencyCheckAfterRun,
  assertConsistencyUnifyPinnedForCheck,
  confirmConsistencyCheckBeforeRun,
  CONSISTENCY_UNIFY_PIN_REQUIRED_MESSAGE,
  countConsistencyCheckActiveRules,
  countConsistencyGroupsWithFindings,
  formatConsistencyCheckCompleteMessage,
  formatConsistencyCheckConfirmMessage,
  formatConsistencyUnifyCheckConfirmMessage,
  formatConsistencyUnifyCheckConfirmMessageWithoutQuota,
  formatUnifyCandidateFindConfirmMessage,
  formatUnifyCandidateFindCompleteMessage,
  alertUnifyCandidateFindAfterRun,
} from './consistencyCheckConfirm.js';
import { parseBracketTitleMessage } from './appDialog.js';
import { UNIFY_FEATURE_LABEL } from './consistencyRuleLimit.js';

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
      consistencyCount: 0,
      consistencyTabLimit: 11,
      unifyCount: 0,
      unifyTabLimit: 11,
      tabLimit: 11,
      dailyLimit: 1,
      signupBonusConsistencyRemaining: 10,
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
    ).toEqual({
      literalActive: 1,
      unifyActive: 0,
      commonStringActive: 1,
      auxiliaryActive: 2,
      excludeActive: 0,
    });
  });

  it('통일형·검수 제외 항목을 분리해 센다', () => {
    expect(
      countConsistencyCheckActiveRules(
        [
          {
            enabled: true,
            patternKind: 'compound-find',
            tailWord: '미국 정부',
            consistencyUnifyEntry: true,
          },
          {
            enabled: true,
            patternKind: 'compound-find',
            tailWord: '세계경제',
            consistencyLiteralEntry: true,
          },
        ],
        ['제외어'],
      ),
    ).toEqual({
      literalActive: 1,
      unifyActive: 1,
      commonStringActive: 0,
      auxiliaryActive: 0,
      excludeActive: 1,
    });
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

    const msg = formatConsistencyCheckConfirmMessage({
        remaining: 11,
        dailyRemaining: 1,
        bonusRemaining: 10,
        literalActive: 0,
        literalTotal: 0,
        commonStringActive: 1,
        commonStringTotal: 1,
        excludeActive: 0,
        auxiliaryActive: 1,
        auxiliaryTotal: 1,
      });
    const { title, message } = parseBracketTitleMessage(msg);
    expect(confirmMock).toHaveBeenCalledWith(`${title}\n\n${message}`);
  });

  it('기준 검수는 통일형 항목이 있으면 📌 지정을 요구한다', async () => {
    const alertMock = vi.fn();
    const confirmMock = vi.fn(() => true);
    vi.stubGlobal('alert', alertMock);
    vi.stubGlobal('confirm', confirmMock);

    const ok = await confirmConsistencyCheckBeforeRun('uid-1', 'a@b.c', [
      {
        enabled: true,
        patternKind: 'compound-find',
        tailWord: '신라시대',
        consistencyUnifyEntry: true,
      },
      {
        enabled: true,
        patternKind: 'compound-find',
        tailWord: '통일신라시대',
        consistencyUnifyEntry: true,
      },
    ]);

    expect(ok).toBe(false);
    expect(alertMock).toHaveBeenCalled();
    expect(confirmMock).not.toHaveBeenCalled();
  });
});

describe('assertConsistencyUnifyPinnedForCheck', () => {
  it('📌 지정이 있으면 통과한다', async () => {
    const alertMock = vi.fn();
    vi.stubGlobal('alert', alertMock);
    expect(
      await assertConsistencyUnifyPinnedForCheck([
        {
          enabled: true,
          patternKind: 'compound-find',
          tailWord: '신라시대',
          consistencyUnifyEntry: true,
          consistencyUnifyPinned: true,
        },
        {
          enabled: true,
          patternKind: 'compound-find',
          tailWord: '통일신라시대',
          consistencyUnifyEntry: true,
          overlayReplace: '신라시대',
        },
      ]),
    ).toBe(true);
    expect(alertMock).not.toHaveBeenCalled();
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
      unifyWithFindings: 0,
      commonStringWithFindings: 0,
      auxiliaryWithFindings: 1,
    });
  });

  it('통일형·일관성 찾기를 분리해 센다', () => {
    const customRules = [
      {
        patternKind: 'compound-find',
        tailWord: '미국 정부',
        consistencyUnifyEntry: true,
      },
      {
        patternKind: 'compound-find',
        tailWord: '세계경제',
        consistencyLiteralEntry: true,
      },
    ];
    expect(
      countConsistencyGroupsWithFindings(
        [
          { patternKind: 'compound-find', tailWord: '미국 정부', instances: [{}] },
          { patternKind: 'compound-find', tailWord: '세계경제', instances: [{}] },
          { patternKind: 'compound-find', tailWord: '세계경제', instances: [] },
        ],
        customRules,
      ),
    ).toEqual({
      literalWithFindings: 1,
      unifyWithFindings: 1,
      commonStringWithFindings: 0,
      auxiliaryWithFindings: 0,
    });
  });
});

describe('formatConsistencyCheckConfirmMessage', () => {
  it('시작 confirm 문구를 새 형식으로 만든다', () => {
    expect(
      formatConsistencyCheckConfirmMessage({
        remaining: 11,
        dailyRemaining: 1,
        bonusRemaining: 10,
        literalActive: 3,
        literalTotal: 8,
        commonStringActive: 1,
        commonStringTotal: 4,
        excludeActive: 1,
        auxiliaryActive: 2,
        auxiliaryTotal: 10,
      }),
    ).toBe(
      '[표기 통일 검수]\n' +
        '\n' +
        '표기 통일 검수는 11회(1일 검수권 1장, 선물 검수권 10장) 가능합니다\n' +
        '표기 통일하기(없음), 여러 항목 찾기(3항목)\n' +
        '공통 항목 찾기(1기준), 검수 제외 항목(1기준)\n' +
        '본용언(-아/어) + 보조용언 표기(2/10)\n' +
        '\n' +
        '검수를 진행할까요?',
    );
  });

  it('켜진 기준이 없으면 (없음)으로 표기한다', () => {
    expect(
      formatConsistencyCheckConfirmMessage({
        remaining: 1,
        dailyRemaining: 1,
        bonusRemaining: 0,
        literalActive: 0,
        literalTotal: 0,
        commonStringActive: 0,
        commonStringTotal: 0,
        excludeActive: 0,
        auxiliaryActive: 10,
        auxiliaryTotal: 10,
      }),
    ).toBe(
      '[표기 통일 검수]\n' +
        '\n' +
        '표기 통일 검수는 1회(1일 검수권 1장, 선물 검수권 0장) 가능합니다\n' +
        '표기 통일하기(없음), 여러 항목 찾기(없음)\n' +
        '공통 항목 찾기(없음), 검수 제외 항목(없음)\n' +
        '본용언(-아/어) + 보조용언 표기(10/10)\n' +
        '\n' +
        '검수를 진행할까요?',
    );
  });
});

describe('formatConsistencyUnifyCheckConfirmMessage', () => {
  it('통일형 전용 confirm 문구를 만든다', () => {
    expect(
      formatConsistencyUnifyCheckConfirmMessage({
        remaining: 4,
        dailyRemaining: 1,
        bonusRemaining: 3,
        unifyActive: 2,
        pinnedTailWord: '조선시대',
      }),
    ).toBe(
      '[표기 통일하기 검수 진행]\n' +
        '\n' +
        '표기 통일 검수는 4회(1일 검수권 1장, 선물 검수권 3장) 가능합니다\n' +
        '(표기 통일하기는 표기 통일 검수 횟수를 사용합니다)\n' +
        `${UNIFY_FEATURE_LABEL}(2항목, 통일형: 조선시대📌)\n` +
        '\n' +
        '검수를 진행할까요?',
    );
  });

  it('한도 없이 통일형 전용 confirm 문구를 만든다', () => {
    expect(
      formatConsistencyUnifyCheckConfirmMessageWithoutQuota({
        unifyActive: 1,
        pinnedTailWord: '조선시대',
      }),
    ).toBe(
      '[통일형 검수 진행]\n' +
        '\n' +
        `${UNIFY_FEATURE_LABEL}(1항목, 통일형: 조선시대📌)\n` +
        '\n' +
        '검수를 진행할까요?',
    );
  });
});

describe('formatUnifyCandidateFindConfirmMessage', () => {
  it('표기 통일 추천 찾기 confirm 문구를 만든다', () => {
    expect(formatUnifyCandidateFindConfirmMessage()).toBe(
      '[1차 표기 통일 추천]\n' +
        '\n' +
        '표기 통일 검수권 1장을 사용합니다\n' +
        '브라우저에서 형태소 분석을 진행하는 과정에서\n' +
        '사용자의 PC 성능에 따라 10초 ~ 1분 정도 시간이 소요됩니다\n' +
        '\n' +
        '찾기를 진행할까요?',
    );
  });
});

describe('formatUnifyCandidateFindCompleteMessage', () => {
  it('발견 항목·총 횟수를 완료 alert 본문으로 만든다', () => {
    expect(formatUnifyCandidateFindCompleteMessage(3, 6)).toBe(
      '1차 표기 통일 : 추천 항목 3 전체 발견 6',
    );
  });

  it('후보가 없으면 안내 문구만 반환한다', () => {
    expect(formatUnifyCandidateFindCompleteMessage(0, 0)).toBe(
      '띄어쓰기만 다른 표기 후보를 찾지 못했습니다.',
    );
  });
});

describe('alertUnifyCandidateFindAfterRun', () => {
  it('찾기 완료 alert를 띄운다', async () => {
    const alertMock = vi.fn();
    vi.stubGlobal('alert', alertMock);

    await alertUnifyCandidateFindAfterRun(
      [
        {
          key: '개인소득',
          variants: ['개인소득', '개인 소득'],
          counts: { 개인소득: 1, '개인 소득': 1 },
          totalCount: 2,
          recommendedUnify: '개인소득',
          occurrencesByVariant: {},
        },
      ],
      { uid: 'u1', email: 'a@b.c' },
    );

    expect(alertMock).toHaveBeenCalledWith(
      '찾기를 진행했습니다\n\n' +
        '1차 표기 통일 : 추천 항목 1 전체 발견 2\n\n' +
        '표기 통일 검수권 1장이 사용되었습니다(1일 검수권 1장, 선물 검수권 5장 사용 가능)',
    );
  });

  it('morphFilterInactive면 본문에 형태소 필터 미적용을 넣는다', async () => {
    const alertMock = vi.fn();
    vi.stubGlobal('alert', alertMock);

    await alertUnifyCandidateFindAfterRun(
      [
        {
          key: '개인소득',
          variants: ['개인소득', '개인 소득'],
          counts: { 개인소득: 1, '개인 소득': 1 },
          totalCount: 2,
          recommendedUnify: '개인소득',
          occurrencesByVariant: {},
        },
      ],
      { uid: 'u1', email: 'a@b.c', morphFilterInactive: true },
    );

    const text = String(alertMock.mock.calls[0]?.[0] ?? '');
    expect(text).toContain('형태소 필터 미적용');
  });

  it('itemCount가 있으면 클러스터 수 대신 아코디언 행 수를 쓴다', async () => {
    const alertMock = vi.fn();
    vi.stubGlobal('alert', alertMock);

    await alertUnifyCandidateFindAfterRun(
      [
        {
          key: '경제성장',
          variants: ['경제성장', '경제 성장'],
          counts: { 경제성장: 2, '경제 성장': 1 },
          totalCount: 3,
          recommendedUnify: '경제성장',
          occurrencesByVariant: {},
        },
        {
          key: '경제회복',
          variants: ['경제회복', '경제 회복'],
          counts: { 경제회복: 1, '경제 회복': 1 },
          totalCount: 2,
          recommendedUnify: '경제회복',
          occurrencesByVariant: {},
        },
      ],
      { uid: 'u1', email: 'a@b.c', itemCount: 1 },
    );

    expect(alertMock).toHaveBeenCalledWith(
      expect.stringContaining('1차 표기 통일 : 추천 항목 1 전체 발견 5'),
    );
  });
});

describe('formatConsistencyCheckCompleteMessage', () => {
  it('발견된 기준·총 발견 건수를 완료 alert 본문으로 만든다', () => {
    expect(
      formatConsistencyCheckCompleteMessage({
        literalWithFindings: 2,
        unifyWithFindings: 0,
        commonStringWithFindings: 1,
        auxiliaryWithFindings: 1,
        totalFindings: 40,
      }),
    ).toBe(
      '표기 통일하기 0기준, 여러 항목 찾기 2기준, 공통 항목 찾기 1기준, 본용언+보조용언 1기준 전체 발견 40',
    );
  });
});

describe('alertConsistencyCheckAfterRun', () => {
  it('검수 완료 alert를 띄운다 — N기준은 발견 있는 그룹 수', async () => {
    const alertMock = vi.fn();
    vi.stubGlobal('alert', alertMock);

    await alertConsistencyCheckAfterRun(
      [
        { patternKind: 'phrase-slot-find', instances: [{}] },
        { patternKind: 'auxiliary-verb', instances: [{}, {}] },
      ],
      3,
      [],
      {
        literalSelected: true,
        unifySelected: true,
        commonStringSelected: true,
        auxiliarySelected: true,
      },
    );

    expect(alertMock).toHaveBeenCalledWith(
      '검수를 진행했습니다\n\n' +
        '표기 통일하기 0기준, 여러 항목 찾기 0기준, 공통 항목 찾기 1기준, 본용언+보조용언 1기준 전체 발견 3',
    );
  });
});
