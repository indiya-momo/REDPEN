import { describe, expect, it } from 'vitest';
import { buildCompoundFindRules } from './compoundFindPattern.js';
import {
  buildPageText,
  hangulSoftWrapSeparator,
  rejoinHangulSoftLineBreaks,
  shouldInsertLayoutSpaceBetweenPdfItems,
  shouldInsertSpaceBetweenPdfItems,
} from './pdfService.js';
import { buildAuxiliaryVerbFindRules } from './auxiliaryVerbPattern.js';
import { runRuleCheck } from './ruleEngine.js';
import { ensureDefaultAuxiliaryVerbs } from './defaultAuxiliaryVerbs.js';

/** @param {{ str: string, x: number, w?: number, font?: number }[]} parts */
function mockLineItems(parts, y = 200, font = 12) {
  return parts.map((p) => {
    const size = p.font ?? font;
    return {
      str: p.str,
      transform: [size, 0, 0, size, p.x, y],
      width: p.w ?? p.str.length * size * 0.48,
    };
  });
}

/** @param {import('./pdfService.js').PageData} page */
function matchCountsOnPage(page) {
  const literal = buildCompoundFindRules('역할을 해 왔다').map((r) => ({
    ...r,
    enabled: true,
  }));
  const haeWat = ensureDefaultAuxiliaryVerbs([]).filter(
    (r) =>
      r.enabled &&
      r.patternKind === 'auxiliary-verb' &&
      r.tailWord === '해 왔',
  );
  const lit = runRuleCheck([page], literal);
  const aux = runRuleCheck([page], haeWat);
  return {
    literal: lit.results.reduce((n, g) => n + g.instances.length, 0),
    auxiliary: aux.results.reduce((n, g) => n + g.instances.length, 0),
  };
}

describe('dedupeOverlayTextItems', () => {
  it('다른 y에 같은 줄이 한 번 더 있어도 한 줄만 조립', () => {
    const items = [
      ...mockLineItems([{ str: '안녕하세요.', x: 48, w: 80 }], 420),
      ...mockLineItems([{ str: '안녕하세요.', x: 48, w: 80 }], 140),
    ];
    const { text } = buildPageText(items);
    expect(text.split('\n').filter(Boolean)).toEqual(['안녕하세요.']);
  });

  it('페이지 블록이 [A,B,A,B]로 반복되면 절반만 유지', () => {
    const items = [
      ...mockLineItems([{ str: '첫', x: 0 }], 400),
      ...mockLineItems([{ str: '둘', x: 0 }], 380),
      ...mockLineItems([{ str: '첫', x: 0 }], 200),
      ...mockLineItems([{ str: '둘', x: 0 }], 180),
    ];
    const { text } = buildPageText(items);
    expect(text.split('\n').filter(Boolean)).toEqual(['첫', '둘']);
  });

  it('같은 좌표·문자열 이중 레이어는 한 줄로만 조립', () => {
    const items = mockLineItems([{ str: '모모는', x: 100, w: 40 }], 200);
    const doubled = [...items, ...items];
    const { text: once } = buildPageText(items);
    const { text: twice } = buildPageText(doubled);
    expect(twice).toBe(once);
    const rules = buildCompoundFindRules('모모').map((r) => ({
      ...r,
      enabled: true,
    }));
    const pageOnce = { pageNum: 1, text: once, items, itemRefs: [] };
    const pageTwice = {
      pageNum: 1,
      text: twice,
      items: doubled,
      itemRefs: [],
    };
    const countOnce = runRuleCheck([pageOnce], rules).results.reduce(
      (s, g) => s + g.instances.length,
      0,
    );
    const countTwice = runRuleCheck([pageTwice], rules).results.reduce(
      (s, g) => s + g.instances.length,
      0,
    );
    expect(countTwice).toBe(countOnce);
  });
});

describe('shouldInsertSpaceBetweenPdfItems', () => {
  const lineH = 12 * 0.35;

  it('넓은 gap은 공백 삽입', () => {
    expect(shouldInsertSpaceBetweenPdfItems(5, lineH, '보여', '준다')).toBe(true);
  });

  it('의미 있는 좁은 gap이면 한글 음절 경계에 공백 (보여 준다)', () => {
    expect(shouldInsertSpaceBetweenPdfItems(1, lineH, '보여', '준다.')).toBe(true);
    expect(shouldInsertSpaceBetweenPdfItems(0.5, lineH, '상상해', '왔다')).toBe(true);
  });

  it('같은 어절 내 자간 수준 gap은 공백을 넣지 않음', () => {
    expect(shouldInsertSpaceBetweenPdfItems(0.05, lineH, '보', '여')).toBe(false);
    expect(shouldInsertSpaceBetweenPdfItems(0.08, lineH, '먹', '어')).toBe(false);
  });

  it('본용언+보조용언 경계(만들어 줄)는 좁은 gap도 공백으로 본다', () => {
    expect(shouldInsertSpaceBetweenPdfItems(0.08, lineH, '만들어', '줄')).toBe(
      true,
    );
    expect(shouldInsertSpaceBetweenPdfItems(0.08, lineH, '만들어', '주십니다')).toBe(
      true,
    );
  });

  it('gap 0이면 삽입 안 함', () => {
    expect(shouldInsertSpaceBetweenPdfItems(0, lineH, '보여', '준다')).toBe(false);
  });
});

describe('shouldInsertLayoutSpaceBetweenPdfItems', () => {
  const lineH = 12 * 0.35;

  it('넓은 gap만 layout 공백', () => {
    expect(shouldInsertLayoutSpaceBetweenPdfItems(5, lineH)).toBe(true);
    expect(shouldInsertLayoutSpaceBetweenPdfItems(1, lineH)).toBe(false);
    expect(shouldInsertLayoutSpaceBetweenPdfItems(0.5, lineH)).toBe(false);
  });
});

describe('hangulSoftWrapSeparator', () => {
  it('같은 크기 음절-음절은 빈 구분자', () => {
    expect(hangulSoftWrapSeparator('내자', '리는', 12, 12)).toBe('');
  });

  it('줄끝 공백이 있어도 음절이면 soft wrap', () => {
    expect(hangulSoftWrapSeparator('내 ', '자리는', 12, 12)).toBe('');
  });

  it('문장부호 뒤는 줄바꿈 유지', () => {
    expect(hangulSoftWrapSeparator('좋다.', '그래서', 12, 12)).toBe('\n');
  });

  it('글자 크기 차이가 크면 줄바꿈 유지(소제목)', () => {
    expect(hangulSoftWrapSeparator('경제', '불확실성의', 10, 14)).toBe('\n');
  });

  it('조사·어미 접미/좁은 조사로 끝나는 줄은 줄바꿈 유지', () => {
    expect(hangulSoftWrapSeparator('자리를', '잡는다', 12, 12)).toBe('\n');
    expect(hangulSoftWrapSeparator('보인다', '그래서', 12, 12)).toBe('\n');
  });

  it('명사 끝 다 + 다음 줄 조사는 줄바꿈 유지(바다\\n가)', () => {
    expect(hangulSoftWrapSeparator('바다', '가 아름답다', 12, 12)).toBe('\n');
  });

  it('어간 음절 다로만 끝나도 soft wrap은 붙일 수 있다', () => {
    // 단음절 `다` 단독 차단이 아님 — 다음이 어간 조각이면 결합
    expect(hangulSoftWrapSeparator('바라보', '다보니', 12, 12)).toBe('');
  });

  it('y 간격이 본문 행간 밖이면 줄바꿈 유지', () => {
    expect(
      hangulSoftWrapSeparator('긴문장의끝자', '리는', 12, 12, {
        prevY: 400,
        nextY: 340,
        leftLineOnly: '긴문장의끝자',
      }),
    ).toBe('\n');
  });

  it('짧은 한 줄은 soft wrap하지 않음', () => {
    expect(
      hangulSoftWrapSeparator('첫', '둘', 12, 12, {
        prevY: 400,
        nextY: 385,
        leftLineOnly: '첫',
      }),
    ).toBe('\n');
  });
});

describe('rejoinHangulSoftLineBreaks', () => {
  it('음절-음절 soft wrap은 붙인다', () => {
    const { text } = rejoinHangulSoftLineBreaks('내자\n리는\n');
    expect(text).toBe('내자리는\n');
  });

  it('줄끝 공백이 있으면 어절 경계를 유지한다', () => {
    const { text } = rejoinHangulSoftLineBreaks('내 \n자리는\n');
    expect(text).toBe('내 자리는\n');
  });

  it('문장부호 뒤 줄바꿈은 유지한다', () => {
    const { text } = rejoinHangulSoftLineBreaks('좋다.\n그래서\n');
    expect(text).toBe('좋다.\n그래서\n');
  });

  it('다음 줄이 따옴표로 시작하면 유지한다', () => {
    const { text } = rejoinHangulSoftLineBreaks('말했다.\n“그래\n');
    expect(text).toBe('말했다.\n“그래\n');
  });

  it('조사·어미로 끝나면 붙이지 않는다', () => {
    const { text } = rejoinHangulSoftLineBreaks('그는\n사과를\n');
    expect(text).toBe('그는\n사과를\n');
  });

  it('두 번 연속 soft-wrap을 붙인다', () => {
    const { text } = rejoinHangulSoftLineBreaks('그래서 한글중\n간강제\n개행임\n');
    expect(text).toBe('그래서 한글중간강제개행임\n');
  });

  it('빈 줄(단락)은 유지한다 — 가\\n\\n나다', () => {
    const { text } = rejoinHangulSoftLineBreaks('가\n\n나다\n');
    expect(text).toBe('가\n\n나다\n');
  });

  it('줄머리 공백이 여러 개여도 soft wrap한다', () => {
    const { text } = rejoinHangulSoftLineBreaks('내자\n   리는\n');
    expect(text).toBe('내자리는\n');
  });

  it('줄머리 Thin Space 등 유니코드 공백도 제거한다', () => {
    const { text } = rejoinHangulSoftLineBreaks('내자\n\u2009리는\n');
    expect(text).toBe('내자리는\n');
  });

  it('빈 줄(단락)은 유지한다', () => {
    const { text } = rejoinHangulSoftLineBreaks('첫줄\n\n다음\n');
    expect(text).toBe('첫줄\n\n다음\n');
  });

  it('명사 끝 + 다음 줄 조사는 붙이지 않는다', () => {
    const { text } = rejoinHangulSoftLineBreaks('바다\n가 아름답다\n');
    expect(text).toBe('바다\n가 아름답다\n');
  });

  it('itemRefs 오프셋을 줄바꿈 삭제에 맞게 당긴다', () => {
    const refs = [
      { start: 0, end: 2, itemIndex: 0 },
      { start: 3, end: 5, itemIndex: 1 },
    ];
    const { text, itemRefs } = rejoinHangulSoftLineBreaks('내자\n리는', refs);
    expect(text).toBe('내자리는');
    expect(itemRefs[0]).toEqual({ start: 0, end: 2, itemIndex: 0 });
    expect(itemRefs[1]).toEqual({ start: 2, end: 4, itemIndex: 1 });
  });
});

describe('buildPageText — 한글 soft wrap', () => {
  it('서로 다른 y의 음절 줄을 이어 붙인다', () => {
    const items = [
      ...mockLineItems([{ str: '그래서 내자', x: 48, w: 72 }], 220),
      ...mockLineItems([{ str: '리는', x: 48, w: 24 }], 206),
    ];
    const { text } = buildPageText(items);
    expect(text.replace(/\n+$/, '')).toBe('그래서 내자리는');
    expect(text).not.toMatch(/자\n리/);
  });

  it('연속 soft-wrap 두 줄을 이어서 붙인다', () => {
    const items = [
      ...mockLineItems([{ str: '그래서 한글중', x: 48, w: 80 }], 240),
      ...mockLineItems([{ str: '간강제', x: 48, w: 36 }], 226),
      ...mockLineItems([{ str: '개행임', x: 48, w: 36 }], 212),
    ];
    const { text } = buildPageText(items);
    expect(text.replace(/\n+$/, '')).toBe('그래서 한글중간강제개행임');
  });

  it('줄끝 공백이 있으면 띄어쓰기를 지치지 않는다', () => {
    const items = [
      ...mockLineItems(
        [
          { str: '그래서 내', x: 48, w: 48 },
          { str: ' ', x: 100, w: 6 },
        ],
        220,
      ),
      ...mockLineItems([{ str: '자리는', x: 48, w: 36 }], 206),
    ];
    const { text } = buildPageText(items);
    expect(text).toMatch(/내\s+자리는/);
    expect(text).not.toMatch(/내자리는/);
  });
});

describe('buildPageText', () => {
  it('textLayout — 음절 자간 공백만 text에 있고 layout에는 없음', () => {
    const items = [
      { str: '통해', transform: [10, 0, 0, 10, 0, 100], width: 22 },
      { str: '보장', transform: [10, 0, 0, 10, 22.6, 100], width: 22 },
    ];
    const { text, textLayout } = buildPageText(items);
    expect(text).toMatch(/통해\s+보장/);
    expect(textLayout).toBe('통해보장\n');
  });

  it('textLayout — 실제 어절 gap은 text·layout 둘 다 공백', () => {
    const items = [
      { str: '상상해', transform: [10, 0, 0, 10, 0, 100], width: 40 },
      { str: '보자', transform: [10, 0, 0, 10, 48, 100], width: 20 },
    ];
    const { text, textLayout } = buildPageText(items);
    expect(text).toMatch(/상상해\s+보자/);
    expect(textLayout).toMatch(/상상해\s+보자/);
  });
  it('포인트가 다른 소제목은 본문 끝과 한 줄로 묶지 않는다', () => {
    const items = [
      { str: '경제', transform: [10, 0, 0, 10, 48, 270] },
      { str: '불확실성의', transform: [14, 0, 0, 14, 90, 271] },
      { str: ' ', transform: [14, 0, 0, 14, 160, 271] },
      { str: '케이크', transform: [14, 0, 0, 14, 170, 271] },
      { str: '불확실성의', transform: [10, 0, 0, 10, 48, 220] },
      { str: ' ', transform: [10, 0, 0, 10, 120, 220] },
      { str: '케이크는', transform: [10, 0, 0, 10, 130, 220] },
    ];
    const { text, itemRefs } = buildPageText(items);
    expect(text).toMatch(/경제\n/);
    expect(text).toMatch(/불확실성의\s+케이크\n/);
    expect(text).not.toMatch(/경제불확실성의/);

    const rules = buildCompoundFindRules('불확실성의 케이크');
    const page = { pageNum: 42, text, items, itemRefs };
    const { results } = runRuleCheck([page], rules);
    const indices = results[0]?.instances.map((i) => i.index) ?? [];
    expect(indices.length).toBeGreaterThanOrEqual(2);
    const lines = text.split('\n').filter(Boolean);
    const subtitleLine = lines.find((l) => /^불확실성의\s+케이크$/.test(l.trim()));
    expect(subtitleLine).toBeTruthy();
    const subtitleIndex = text.indexOf(subtitleLine.trim());
    expect(indices).toContain(subtitleIndex);
  });

  it('hasEOL·fontName·왼쪽 여백이면 같은 포인트 소제목도 별도 줄', () => {
    const items = [
      { str: '경제', transform: [11, 0, 0, 11, 200, 270], fontName: 'f1' },
      {
        str: '불확실성의',
        transform: [11, 0, 0, 11, 48, 268],
        fontName: 'f2',
      },
      { str: ' ', transform: [11, 0, 0, 11, 130, 268], fontName: 'f2' },
      {
        str: '케이크',
        transform: [11, 0, 0, 11, 140, 268],
        fontName: 'f2',
        hasEOL: true,
      },
      {
        str: '불확실성의',
        transform: [11, 0, 0, 11, 48, 220],
        fontName: 'f1',
      },
      { str: ' ', transform: [11, 0, 0, 11, 120, 220], fontName: 'f1' },
      {
        str: '케이크는',
        transform: [11, 0, 0, 11, 130, 220],
        fontName: 'f1',
        hasEOL: true,
      },
    ];
    const { text, itemRefs } = buildPageText(items);
    const lines = text.split('\n').filter(Boolean);
    expect(lines.some((l) => /^불확실성의\s+케이크$/.test(l.trim()))).toBe(true);
    expect(text).not.toMatch(/경제불확실성의/);

    const rules = buildCompoundFindRules('불확실성의 케이크');
    const { results } = runRuleCheck(
      [{ pageNum: 42, text, items, itemRefs }],
      rules,
    );
    expect(results[0]?.instances.length).toBeGreaterThanOrEqual(2);
  });
});

function mockSpreadPageItems() {
  const leftX = 48;
  const rightX = 420;
  const font = 11;
  const row = (parts, y) => mockLineItems(parts, y, font);
  return [
    ...row(
      [
        { str: '바로잡아', x: leftX, w: 55 },
        { str: '바', x: leftX + 58, w: 11 },
      ],
      200,
    ),
    ...row([{ str: '하는', x: rightX, w: 22 }], 200),
    ...row([{ str: '왼쪽윗', x: leftX }], 520),
    ...row([{ str: '왼쪽중', x: leftX }], 460),
    ...row([{ str: '왼쪽아래', x: leftX }], 400),
    ...row([{ str: '오른윗', x: rightX }], 520),
    ...row([{ str: '오른중', x: rightX }], 460),
    ...row([{ str: '오른아래', x: rightX }], 400),
  ];
}

describe('buildPageText — 펼침면 단 분할', () => {
  it('책등을 넘는 바·하는 한 줄로 엮이지 않는다', () => {
    const items = mockSpreadPageItems();
    const { text } = buildPageText(items);
    expect(text).not.toMatch(/바하/);
    expect(text.indexOf('바')).toBeLessThan(text.indexOf('하는'));
    expect(text).toMatch(/바\n/);
    expect(text).toMatch(/하는\n/);
  });

  it('textLayout도 동일하게 단 분할된다', () => {
    const items = mockSpreadPageItems();
    const { textLayout } = buildPageText(items);
    expect(textLayout).not.toMatch(/바하/);
  });

  it('펼침면 바하 오탐 — 맞춤법 검사 0건', () => {
    const items = mockSpreadPageItems();
    const { text, itemRefs } = buildPageText(items);
    const page = { pageNum: 7, text, items, itemRefs };
    const { results } = runRuleCheck(
      [page],
      [
        {
          find: '바하',
          replace: '바흐',
          pattern: 'literal',
          category: 'spelling',
          builtIn: true,
          enabled: true,
        },
      ],
    );
    expect(results[0]?.instances ?? []).toHaveLength(0);
  });

  it('itemRefs itemIndex가 원본 items를 가리킨다', () => {
    const items = mockSpreadPageItems();
    const { text, itemRefs, textLayout, itemRefsLayout } = buildPageText(items);
    const barRef = itemRefs.find(
      (r) => items[r.itemIndex]?.str?.includes('바') && !items[r.itemIndex]?.str?.includes('바로'),
    );
    expect(barRef).toBeTruthy();
    expect(text.slice(barRef.start, barRef.end)).toBe('바');
    const layoutRef = itemRefsLayout.find((r) => r.itemIndex === barRef.itemIndex);
    expect(layoutRef).toBeTruthy();
    expect(textLayout.slice(layoutRef.start, layoutRef.end)).toBe('바');
  });

  it('단면 페이지는 기존과 같이 조립한다', () => {
    const items = [
      { str: '통해', transform: [10, 0, 0, 10, 0, 100], width: 22 },
      { str: '보장', transform: [10, 0, 0, 10, 22.6, 100], width: 22 },
    ];
    const { text, textLayout, itemRefs } = buildPageText(items);
    expect(text).toMatch(/통해\s+보장/);
    expect(textLayout).toBe('통해보장\n');
    expect(itemRefs).toHaveLength(2);
  });

  it('가운데 쪽번호만 있는 단면은 펼침으로 쪼개지 않는다', () => {
    const font = 11;
    const items = [
      ...mockLineItems([{ str: '본문', x: 48 }], 420, font),
      ...mockLineItems([{ str: '이어', x: 48 }], 380, font),
      ...mockLineItems([{ str: '쓴다', x: 48 }], 340, font),
      ...mockLineItems([{ str: '또', x: 48 }], 300, font),
      ...mockLineItems([{ str: '내용', x: 48 }], 260, font),
      ...mockLineItems([{ str: '계속', x: 48 }], 220, font),
      ...mockLineItems([{ str: '단락', x: 48 }], 180, font),
      ...mockLineItems([{ str: '끝', x: 48 }], 140, font),
      {
        str: '50',
        transform: [font, 0, 0, font, 120, 400],
        width: 16,
      },
    ];
    const { text } = buildPageText(items);
    expect(text.split('\n').filter(Boolean).length).toBeGreaterThanOrEqual(8);
    expect(text).toContain('50');
  });
});

describe('buildPageText — 역할을 해 왔다 추출·검사 (가설 검증)', () => {
  it('PDF 항목에 공백 문자가 있으면 text에도 띄움 유지', () => {
    const items = mockLineItems([
      { str: '역할을', x: 0, w: 40 },
      { str: ' ', x: 42, w: 4 },
      { str: '해', x: 48, w: 14 },
      { str: ' ', x: 64, w: 4 },
      { str: '왔다.', x: 70, w: 28 },
    ]);
    const { text, textLayout } = buildPageText(items);
    expect(text).toMatch(/역할을\s+해\s+왔다/);
    expect(textLayout).toMatch(/역할을\s+해\s+왔다/);
    const page = { pageNum: 99, text, items, itemRefs: [] };
    expect(matchCountsOnPage(page)).toEqual({ literal: 1, auxiliary: 0 });
  });

  it('항목이 한 덩어리(역할을해왔다)면 띄어쓴 등록과는 별도 — 붙임 규칙으로 등록', () => {
    const items = mockLineItems([{ str: '역할을해왔다.', x: 0, w: 90 }]);
    const { text, textLayout } = buildPageText(items);
    expect(text).toBe('역할을해왔다.\n');
    expect(textLayout).toBe('역할을해왔다.\n');
    const page = { pageNum: 99, text, items, itemRefs: [] };
    expect(matchCountsOnPage(page)).toEqual({ literal: 0, auxiliary: 0 });
    const glued = buildCompoundFindRules('역할을해왔다').map((r) => ({
      ...r,
      enabled: true,
    }));
    const lit = runRuleCheck([page], glued);
    expect(lit.results.reduce((n, g) => n + g.instances.length, 0)).toBe(1);
  });

  it('해·왔 항목 gap이 음절 경계(좁지만 10% 이상)면 text에 해↔왔 공백', () => {
    const items = mockLineItems([
      { str: '역할을', x: 0, w: 40 },
      { str: '해', x: 44, w: 14 },
      { str: '왔다.', x: 60, w: 28 },
    ]);
    const lineH = 12 * 0.35;
    const gap =
      items[2].transform[4] -
      (items[1].transform[4] + (items[1].width ?? 0));
    expect(shouldInsertSpaceBetweenPdfItems(gap, lineH, '해', '왔다.')).toBe(
      true,
    );
    const { text } = buildPageText(items);
    expect(text).toMatch(/역할을\s+해\s+왔다/);
    const page = { pageNum: 99, text, items, itemRefs: [] };
    expect(matchCountsOnPage(page)).toEqual({ literal: 1, auxiliary: 0 });
  });

  it('인용문(작은 글씨) — 본문과 줄 분리돼도 역할을 해 왔다·본조 둘 다', () => {
    const items = [
      ...mockLineItems([{ str: '본문 어절입니다.', x: 0 }], 220, 12),
      ...mockLineItems(
        [
          { str: '역할을', x: 0, w: 40 },
          { str: '해', x: 44, w: 14 },
          { str: '왔다.', x: 60, w: 28 },
        ],
        200,
        9,
      ),
    ];
    const { text } = buildPageText(items);
    const quoteLine = text.split('\n').find((l) => /역할을/.test(l)) ?? '';
    expect(quoteLine).toMatch(/역할을\s+해\s+왔다/);
    const page = { pageNum: 99, text, items, itemRefs: [] };
    expect(matchCountsOnPage(page)).toEqual({ literal: 1, auxiliary: 0 });
  });

  it('해·왔 gap이 자간 수준이면 text는 해왔 붙음 — 본조만 빠질 수 있음', () => {
    const items = mockLineItems([
      { str: '역할을', x: 0, w: 40 },
      { str: '해', x: 44, w: 14 },
      { str: '왔다.', x: 45.5, w: 28 },
    ]);
    const lineH = 12 * 0.35;
    const gap =
      items[2].transform[4] - (items[1].transform[4] + items[1].width);
    expect(shouldInsertSpaceBetweenPdfItems(gap, lineH, '해', '왔다.')).toBe(
      false,
    );
    const { text } = buildPageText(items);
    expect(text).toMatch(/역할을\s+해왔다/);
    const page = { pageNum: 99, text, items, itemRefs: [] };
    expect(matchCountsOnPage(page)).toEqual({ literal: 0, auxiliary: 0 });
  });

  it('Hancom PDF — 공백 항목 bbox가 넓어도 같은 줄 어절로 묶음', () => {
    const y = 801.7;
    const font = 13;
    const items = [
      { str: '문장을', transform: [font, 0, 0, font, 140.5, y], width: 37.75 },
      { str: ' ', transform: [font, 0, 0, font, 178.3, y], width: 54.14 },
      { str: '살펴', transform: [font, 0, 0, font, 185.3, y], width: 25.16 },
      { str: ' ', transform: [font, 0, 0, font, 210.4, y], width: 54.14 },
      { str: '주길', transform: [font, 0, 0, font, 217.4, y], width: 25.16 },
      { str: ' ', transform: [font, 0, 0, font, 242.5, y], width: 54.14 },
      { str: '소망했어요.', transform: [font, 0, 0, font, 249.5, y], width: 75.5 },
    ];
    const { text } = buildPageText(items);
    const line = text.split('\n').find((l) => /살펴/.test(l)) ?? '';
    expect(line).toMatch(/문장을\s+살펴\s+주길\s+소망했어요/);
    expect(text.split('\n').filter((l) => l.trim() === '살펴').length).toBe(0);

    const rules = buildCompoundFindRules('아 두');
    const page = { pageNum: 1, text, items, itemRefs: [] };
    const 담아Items = [
      { str: '담아', transform: [font, 0, 0, font, 100, 700], width: 25 },
      { str: ' ', transform: [font, 0, 0, font, 126, 700], width: 54 },
      { str: '두어요.', transform: [font, 0, 0, font, 133, 700], width: 50 },
    ];
    const { text: text2 } = buildPageText([...items, ...담아Items]);
    const { results } = runRuleCheck(
      [{ pageNum: 1, text: text2, items: [...items, ...담아Items], itemRefs: [] }],
      rules,
    );
    expect(results[0]?.instances.length).toBeGreaterThanOrEqual(1);
  });
});
