import { describe, expect, it } from 'vitest';
import { buildCompoundFindRules } from './compoundFindPattern.js';
import { findPhraseRangeOnLine } from './pdfHighlightRange.js';
import { buildPageText, highlightRangeForInstance } from './pdfService.js';
import { runRuleCheck } from './ruleEngine.js';

describe('pdfHighlightRange', () => {
  it('findPhraseRangeOnLine — 붙여 쓴 줄', () => {
    expect(findPhraseRangeOnLine('불확실성의케이크', '불확실성의 케이크')).toEqual({
      start: 0,
      end: '불확실성의케이크'.length,
    });
  });

  it('공백 수가 달라도 소제목 줄에 하이라이트 범위를 잡는다', () => {
    const items = [
      {
        str: '불확실성의',
        transform: [14, 0, 0, 14, 48, 268],
        fontName: 'f2',
      },
      { str: '  ', transform: [14, 0, 0, 14, 120, 268], fontName: 'f2' },
      {
        str: '케이크',
        transform: [14, 0, 0, 14, 140, 268],
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
    const rules = buildCompoundFindRules('불확실성의 케이크');
    const page = { pageNum: 42, text, items, itemRefs };
    const { results } = runRuleCheck([page], rules);
    const subtitleInst = results[0]?.instances.find((inst) => {
      const chunk = text.slice(inst.index, inst.index + 20);
      return /^불확실성의\s+케이크/.test(chunk) && !chunk.includes('는');
    });
    expect(subtitleInst).toBeTruthy();
    const range = highlightRangeForInstance(page, subtitleInst);
    expect(range).not.toBeNull();
    const highlighted = text.slice(range.start, range.end);
    expect(highlighted).toMatch(/^불확실성의\s+케이크$/);
    expect(highlighted).not.toContain('는');
  });

  it('항목 사이 합성 공백 인덱스에서도 소제목 줄 컨텍스트를 잡는다', () => {
    const items = [
      {
        str: '불확실성의',
        transform: [14, 0, 0, 14, 48, 268],
        width: 56,
        fontName: 'f2',
      },
      {
        str: '케이크',
        transform: [14, 0, 0, 14, 110, 268],
        width: 40,
        fontName: 'f2',
        hasEOL: true,
      },
    ];
    const { text, itemRefs } = buildPageText(items);
    const gapIndex = text.indexOf(' ');
    expect(gapIndex).toBeGreaterThan(0);
    const rules = buildCompoundFindRules('불확실성의 케이크');
    const page = { pageNum: 42, text, items, itemRefs };
    const { results } = runRuleCheck([page], rules);
    const inst = results[0]?.instances[0];
    expect(inst).toBeTruthy();
    const instAtGap = { ...inst, index: gapIndex };
    const range = highlightRangeForInstance(page, instAtGap);
    expect(range).not.toBeNull();
    expect(text.slice(range.start, range.end)).toMatch(/^불확실성의\s+케이크$/);
  });
});
