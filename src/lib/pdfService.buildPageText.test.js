import { describe, expect, it } from 'vitest';
import { buildCompoundFindRules } from './compoundFindPattern.js';
import { buildPageText, shouldInsertSpaceBetweenPdfItems } from './pdfService.js';
import { runRuleCheck } from './ruleEngine.js';

describe('shouldInsertSpaceBetweenPdfItems', () => {
  const lineH = 12 * 0.35;

  it('넓은 gap은 공백 삽입', () => {
    expect(shouldInsertSpaceBetweenPdfItems(5, lineH, '보여', '준다')).toBe(true);
  });

  it('좁은 gap이라도 한글 음절 경계면 공백 (보여 준다)', () => {
    expect(shouldInsertSpaceBetweenPdfItems(1, lineH, '보여', '준다.')).toBe(true);
    expect(shouldInsertSpaceBetweenPdfItems(0.5, lineH, '상상해', '왔다')).toBe(true);
  });

  it('gap 0이면 삽입 안 함', () => {
    expect(shouldInsertSpaceBetweenPdfItems(0, lineH, '보여', '준다')).toBe(false);
  });
});

describe('buildPageText', () => {
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
