import { describe, expect, it } from 'vitest';
import { searchHitsToGroups } from './searchFindings.js';
import { SEARCH_BADGE_LABEL, SEARCH_CATEGORY } from './types.js';
import { collectAnnotFindings } from '../pdfAnnotExport/collectAnnotFindings.js';

describe('searchHitsToGroups', () => {
  it('질의어 카드·쪽 위치 인스턴스를 만든다', () => {
    const groups = searchHitsToGroups(
      [
        { pageNum: 53, start: 10, end: 12, matchedText: '토끼' },
        { pageNum: 58, start: 4, end: 6, matchedText: '토끼' },
        { pageNum: 92, start: 0, end: 2, matchedText: '토끼' },
      ],
      '토끼',
    );
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      find: '토끼',
      label: '토끼',
      category: SEARCH_CATEGORY,
    });
    expect(groups[0].instances).toHaveLength(3);
    expect(groups[0].instances.map((row) => row.pageNum)).toEqual([53, 58, 92]);
    expect(SEARCH_BADGE_LABEL).toBe('검색');
  });

  it('빈 질의·빈 hit는 그룹이 없다', () => {
    expect(searchHitsToGroups([], '토끼')).toEqual([]);
    expect(
      searchHitsToGroups([{ pageNum: 1, start: 0, end: 1, matchedText: '가' }], ''),
    ).toEqual([]);
  });

  it('내려받기에 넣지 않는다', () => {
    const groups = searchHitsToGroups(
      [{ pageNum: 1, start: 2, end: 4, matchedText: '할때' }],
      '할때',
    );
    const findings = collectAnnotFindings({
      spellingEntries: groups.map((group) => ({ source: 'spelling', group })),
      pageTexts: [
        {
          pageNum: 1,
          text: '방문할때면 마음 속',
          items: [],
          itemRefs: [{ start: 0, end: 10, itemIndex: 0 }],
        },
      ],
    });
    expect(findings).toEqual([]);
  });
});
