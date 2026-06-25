import { describe, expect, it } from 'vitest';
import { buildCompoundFindRules } from './compoundFindPattern.js';
import {
  findPhraseInSpan,
  findPhraseRangeOnLine,
} from './pdfHighlightRange.js';
import {
  buildPageText,
  highlightRangeForCaution,
  highlightRangeForInstance,
  highlightRangeForSpelling,
  highlightRectsForTextRange,
} from './pdfService.js';
import { runRuleCheck } from './ruleEngine.js';
import { buildCautionCheckRules, CAUTION_RULES } from './cautionRules.js';

describe('findPhraseInSpan', () => {
  it('합성 공백(음절 경계)을 무시하고 만큼을 찾는다', () => {
    expect(findPhraseInSpan('회상할 만 큼', '만큼')).toEqual({
      start: 4,
      end: 7,
    });
  });

  it('같이 — 줄 안에서 가장 가까운 후보를 고른다', () => {
    const line = '날같이 골프를 같이 친다';
    const nearGachi = findPhraseRangeOnLine(line, '같이', line.indexOf('같이 친'));
    expect(line.slice(nearGachi?.start, nearGachi?.end)).toBe('같이');
  });
});

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

  it('편집자 검토 만큼 — PDF 항목 기준으로 만큼만 하이라이트', () => {
    const items = [
      {
        str: '회상할',
        transform: [12, 0, 0, 12, 48, 200],
        width: 48,
      },
      {
        str: '만큼',
        transform: [12, 0, 0, 12, 100, 200],
        width: 24,
        hasEOL: true,
      },
      {
        str: '강한',
        transform: [12, 0, 0, 12, 130, 200],
        width: 24,
        hasEOL: true,
      },
    ];
    const { text, itemRefs } = buildPageText(items);
    const page = { pageNum: 245, text, items, itemRefs };
    const enabled = Object.fromEntries(
      CAUTION_RULES.map((r) => [r.id, r.id === 'josa-uinoun-mankum']),
    );
    const { results } = runRuleCheck([page], buildCautionCheckRules(enabled));
    const inst = results[0]?.instances[0];
    expect(inst?.matchedText).toBe('회상할 만큼');
    expect(inst?.highlightText).toBe('만큼');
    expect(inst?.index).toBe(0);
    const range = highlightRangeForCaution(page, inst);
    expect(range).not.toBeNull();
    expect(text.slice(range.start, range.end)).toBe('만큼');

    const viewport = { transform: [1.2, 0, 0, 1.2, 0, 0], scale: 1.2 };
    const rects = highlightRectsForTextRange(
      /** @type {*} */ ({}),
      viewport,
      items,
      itemRefs,
      range.start,
      range.end,
      page,
    );
    expect(rects.length).toBe(1);
    expect(rects[0].width).toBeGreaterThan(0);
    expect(rects[0].width).toBeLessThanOrEqual(24 * 1.2 + 2);
  });

  it('바라/바래 — 같은 줄에 바라보셨습니다가 있어도 그는 바라다는 바라만 칠함', () => {
    const items = [
      {
        str: '하나님께',
        transform: [12, 0, 0, 12, 48, 220],
        width: 48,
      },
      {
        str: '바라보셨습니다.',
        transform: [12, 0, 0, 12, 100, 220],
        width: 96,
        hasEOL: true,
      },
      {
        str: '그는',
        transform: [12, 0, 0, 12, 48, 200],
        width: 24,
      },
      {
        str: '바라다.',
        transform: [12, 0, 0, 12, 76, 200],
        width: 36,
        hasEOL: true,
      },
    ];
    const { text, itemRefs } = buildPageText(items);
    const page = { pageNum: 216, text, items, itemRefs };
    const rules = buildCautionCheckRules({ 'verb-verb-bara': true });
    const { results } = runRuleCheck([page], rules);
    const inst = results[0]?.instances.find((i) => i.matchedText === '바라');
    expect(inst).toBeTruthy();
    expect(inst?.highlightText).toBe('바라');
    expect(inst?.highlightIndex).toBe(inst.index);

    const range = highlightRangeForCaution(page, inst);
    expect(range).not.toBeNull();
    const highlighted = text.slice(range.start, range.end);
    expect(highlighted).toBe('바라');
    expect(highlighted).not.toBe('습니다');
    expect(text.slice(range.start, range.end + 1)).not.toMatch(/^습니다/);
  });

  it('편집자 검토 — index가 어긋나도 matchedText 안에서만 stem 재계산 (페이지 전체 stem 검색 없음)', () => {
    const text = '<세한도>만큼은 일 년 쯤을 더 고민하시다가\n';
    const page = { pageNum: 226, text, items: [], itemRefs: [] };
    const enabled = Object.fromEntries(
      CAUTION_RULES.map((r) => [r.id, r.id === 'jubsa-garyang']),
    );
    const { results } = runRuleCheck([page], buildCautionCheckRules(enabled));
    const inst = results[0]?.instances[0];
    expect(inst?.highlightText).toBe('쯤');

    const wrongInst = { ...inst, index: text.indexOf('고민') };
    const spellingRange = highlightRangeForSpelling(page, wrongInst);
    expect(spellingRange).not.toBeNull();
    expect(text.slice(spellingRange.start, spellingRange.end)).toBe('년 쯤');

    const range = highlightRangeForCaution(page, wrongInst);
    expect(range).not.toBeNull();
    expect(text.slice(range.start, range.end)).toBe('쯤');
  });

  it('맞춤법 뭐 하 — matchedText 그대로 (stem 없음)', () => {
    const text = '뭐 하러 새것을 사냐고\n';
    const page = { pageNum: 1, text, items: [], itemRefs: [] };
    const inst = {
      pageNum: 1,
      index: text.indexOf('뭐 하'),
      matchedText: '뭐 하',
      find: '뭐 하',
      replace: '뭐하',
      suggestedText: '뭐하',
    };
    const wrongInst = { ...inst, index: text.indexOf('사냐') };
    const range = highlightRangeForSpelling(page, wrongInst);
    expect(range).not.toBeNull();
    expect(text.slice(range.start, range.end)).toBe('뭐 하');
  });
});
