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
} from './consistencyCheckConfirm.js';
import { parseBracketTitleMessage } from './appDialog.js';

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
        remaining: 1,
        tabLimit: 2,
        literalActive: 0,
        literalTotal: 0,
        unifyActive: 0,
        unifyTotal: 0,
        commonStringActive: 1,
        commonStringTotal: 1,
        excludeActive: 0,
        auxiliaryActive: 1,
        auxiliaryTotal: 1,
      });
    const { title, message } = parseBracketTitleMessage(msg);
    expect(confirmMock).toHaveBeenCalledWith(`${title}\n\n${message}`);
  });

  it('통일형 항목이 켜져 있는데 📌 미지정이면 검수를 막는다', async () => {
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
    expect(alertMock).toHaveBeenCalledWith(
      `안내\n\n${CONSISTENCY_UNIFY_PIN_REQUIRED_MESSAGE}`,
    );
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
        remaining: 1,
        tabLimit: 1,
        literalActive: 3,
        literalTotal: 8,
        unifyActive: 1,
        unifyTotal: 2,
        commonStringActive: 1,
        commonStringTotal: 4,
        excludeActive: 1,
        auxiliaryActive: 2,
        auxiliaryTotal: 10,
      }),
    ).toBe(
      '[표기 통일 검수 진행]\n' +
        '\n' +
        '오늘 표기 통일 검수는 1회(한도 1회) 가능합니다\n' +
        '여러 개 찾기(3항목), 통일형 만들기(1항목), 공통 항목 찾기(1기준)\n' +
        '검수 제외 항목(1기준), 본용언(-아/어) + 보조용언 표기(2/10)\n' +
        '\n' +
        '검수를 진행할까요?',
    );
  });

  it('켜진 기준이 없으면 (없음)으로 표기한다', () => {
    expect(
      formatConsistencyCheckConfirmMessage({
        remaining: 1,
        tabLimit: 1,
        literalActive: 0,
        literalTotal: 0,
        unifyActive: 0,
        unifyTotal: 0,
        commonStringActive: 0,
        commonStringTotal: 0,
        excludeActive: 0,
        auxiliaryActive: 10,
        auxiliaryTotal: 10,
      }),
    ).toBe(
      '[표기 통일 검수 진행]\n' +
        '\n' +
        '오늘 표기 통일 검수는 1회(한도 1회) 가능합니다\n' +
        '여러 개 찾기(없음), 통일형 만들기(없음), 공통 항목 찾기(없음)\n' +
        '검수 제외 항목(없음), 본용언(-아/어) + 보조용언 표기(10/10)\n' +
        '\n' +
        '검수를 진행할까요?',
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
      '여러 개 찾기 2기준, 통일형 만들기 0기준, 공통 항목 찾기 1기준, 본용언+보조용언 1기준 전체 발견 40',
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
        '여러 개 찾기 0기준, 통일형 만들기 0기준, 공통 항목 찾기 1기준, 본용언+보조용언 1기준 전체 발견 3',
    );
  });
});
