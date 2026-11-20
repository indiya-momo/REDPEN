import { describe, expect, it } from 'vitest';
import { addManualFinding } from './addManualFinding.js';
import { countManualInstances } from './findingsSink.js';
import {
  countStoredManualFindings,
  hydrateManualGroups,
  manualFindingsEqual,
  normalizeManualFindings,
  removeStoredManualFinding,
  serializeManualGroups,
} from './persistManualFindings.js';

const page = {
  pageNum: 3,
  text: '방문할때면 마음 속',
  visualText: '방문할때면 마음 속',
  items: [],
  itemRefs: [{ start: 0, end: 10, itemIndex: 0 }],
};

describe('persistManualFindings', () => {
  it('정규화는 빈 원문·비숫자를 버린다', () => {
    expect(
      normalizeManualFindings([
        null,
        { pageNum: 1, start: 0, matchedText: '' },
        { pageNum: 'x', start: 0, matchedText: '가' },
        { pageNum: 2, start: 4, matchedText: '할때', replace: '할 때', tip: ' 띄어  ' },
      ]),
    ).toEqual([
      {
        pageNum: 2,
        start: 4,
        end: 6,
        matchedText: '할때',
        replace: '할 때',
        tip: '띄어',
        source: 'manual',
      },
    ]);
  });

  it('그룹 ↔ 저장 행을 왕복한다', () => {
    const groups = addManualFinding(
      [],
      {
        pageNum: 3,
        start: 2,
        end: 4,
        matchedText: '할때',
        replace: '할 때',
        tip: '띄어쓰기',
        source: 'manual',
      },
      page,
    );
    const stored = serializeManualGroups(groups);
    expect(stored).toEqual([
      {
        pageNum: 3,
        start: 2,
        end: 4,
        matchedText: '할때',
        replace: '할 때',
        tip: '띄어쓰기',
        source: 'manual',
      },
    ]);
    const restored = hydrateManualGroups(stored);
    expect(countManualInstances(restored)).toBe(1);
    expect(restored[0].find).toBe('할때');
    expect(restored[0].replace).toBe('할 때');
    expect(restored[0].instances[0]).toMatchObject({
      pageNum: 3,
      index: 2,
      matchedText: '할때',
      suggestedText: '할 때',
      manual: true,
    });
    expect(countStoredManualFindings(stored)).toBe(1);
  });

  it('같은 구간은 한 줄만 남긴다', () => {
    const rows = normalizeManualFindings([
      { pageNum: 1, start: 2, matchedText: '할때', replace: '할 때' },
      { pageNum: 1, start: 2, matchedText: '할때', replace: '할때면' },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].replace).toBe('할 때');
  });

  it('저장된 한 건을 지운다', () => {
    const next = removeStoredManualFinding(
      [
        { pageNum: 1, start: 2, matchedText: '할때', replace: '할 때' },
        { pageNum: 2, start: 0, matchedText: '마음', replace: '맘' },
      ],
      { pageNum: 1, index: 2 },
    );
    expect(next).toHaveLength(1);
    expect(next[0].matchedText).toBe('마음');
  });

  it('같은 내용이면 equal', () => {
    const a = [{ pageNum: 1, start: 0, matchedText: '가', replace: '나' }];
    expect(manualFindingsEqual(a, [...a])).toBe(true);
    expect(
      manualFindingsEqual(a, [
        { pageNum: 1, start: 0, matchedText: '가', replace: '다' },
      ]),
    ).toBe(false);
  });
});
