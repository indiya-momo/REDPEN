import { describe, expect, it } from 'vitest';
import { buildCompoundFindRules } from './compoundFindPattern.js';
import { buildPageText } from './pdfService.js';
import { runRuleCheck } from './ruleEngine.js';
import {
  findPhraseOccurrencesOnPage,
  isBodyMentionOnlyMatch,
  scanPhysicalLinesForPhrase,
} from './pdfTextAudit.js';

describe('pdfTextAudit', () => {
  it('findPhraseOccurrencesOnPage — 단독 줄·본문 인용을 구분한다', () => {
    let text = '';
    const items = [];
    const itemRefs = [];
    const addLine = (str, size, y) => {
      const start = text.length;
      items.push({ str, transform: [size, 0, 0, size, 48, y] });
      itemRefs.push({ start, end: start + str.length, itemIndex: items.length - 1 });
      text += `${str}\n`;
    };
    addLine('불확실성의 케이크', 13, 180);
    addLine('불확실성의 케이크는 설명', 10, 150);
    const page = { pageNum: 42, text, items, itemRefs };
    const occs = findPhraseOccurrencesOnPage(page, '불확실성의 케이크');
    expect(occs).toHaveLength(2);
    expect(occs[0]?.standalone).toBe(true);
    expect(occs[1]?.standalone).toBe(false);
  });

  it('isBodyMentionOnlyMatch', () => {
    let text = '불확실성의 케이크는 본문\n';
    const items = [
      { str: '불확실성의 케이크는 본문', transform: [10, 0, 0, 10, 48, 100] },
    ];
    const itemRefs = [{ start: 0, end: text.length - 1, itemIndex: 0 }];
    const page = { pageNum: 42, text, items, itemRefs };
    expect(
      isBodyMentionOnlyMatch(page, {
        pageNum: 42,
        index: 0,
        matchedText: '불확실성의 케이크',
        find: '',
        replace: '',
        suggestedText: '',
      }),
    ).toBe(true);
  });

  it('scanPhysicalLinesForPhrase — page.text 줄바꿈·y밴드 한 줄 소제목', () => {
    const items = [
      {
        str: '불확실성의',
        transform: [14, 0, 0, 14, 48, 268],
        width: 56,
        fontName: 'H',
        hasEOL: true,
      },
      {
        str: '케이크',
        transform: [14, 0, 0, 14, 48, 268],
        width: 40,
        fontName: 'H',
        hasEOL: true,
      },
      {
        str: '불확실성의 케이크는 본문',
        transform: [11, 0, 0, 11, 48, 220],
        width: 120,
        fontName: 'B',
        hasEOL: true,
      },
    ];
    const { text, itemRefs } = buildPageText(items);
    expect(text.split('\n').filter(Boolean).length).toBeGreaterThan(1);

    const page = { pageNum: 42, text, items, itemRefs };
    const hits = scanPhysicalLinesForPhrase(page, '불확실성의 케이크');
    const titleHit = hits.find((h) => h.standalone);
    expect(titleHit).toBeTruthy();
    expect(titleHit.matchedText).toMatch(/^불확실성의\s+케이크$/);
    expect(titleHit.matchedText).not.toContain('는');

    const rules = buildCompoundFindRules('불확실성의 케이크');
    const { results } = runRuleCheck([page], rules);
    expect(results[0]?.instances.length).toBe(1);
    expect(results[0]?.instances[0]?.matchedText).toContain('케이크');
  });
});
