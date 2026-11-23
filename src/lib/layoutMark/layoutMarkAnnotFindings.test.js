import { describe, expect, it } from 'vitest';
import {
  filterLayoutFindingsAgainstTextReplaces,
  layoutMarksToAnnotFindings,
} from './layoutMarkAnnotFindings.js';
import { LAYOUT_INDENT_SPACE, LAYOUT_MARK_SOURCE } from './layoutMarkTypes.js';

describe('layoutMarksToAnnotFindings', () => {
  const pages = [{ pageNum: 1, text: '요즘 말로는' }];

  it('줄바꿈+들여를 한 AnnotFinding으로 합성', () => {
    const findings = layoutMarksToAnnotFindings(
      [
        {
          id: '1',
          pageNum: 1,
          index: 0,
          kind: 'paraSplit',
          source: LAYOUT_MARK_SOURCE,
        },
        {
          id: '2',
          pageNum: 1,
          index: 0,
          kind: 'indent',
          source: LAYOUT_MARK_SOURCE,
        },
      ],
      pages,
    );
    expect(findings).toHaveLength(1);
    expect(findings[0].found).toBe('요즘');
    expect(findings[0].replacement).toBe(`\n${LAYOUT_INDENT_SPACE}요즘`);
    expect(findings[0].fromLayoutMark).toBe(true);
  });
});

describe('filterLayoutFindingsAgainstTextReplaces', () => {
  it('문자 Replace와 겹치면 조판을 빼고 건수를 센다', () => {
    const layout = [
      {
        pageNum: 1,
        start: 0,
        end: 2,
        found: '요즘',
        replacement: '\n요즘',
        fromLayoutMark: true,
      },
    ];
    const text = [
      {
        pageNum: 1,
        start: 0,
        end: 2,
        found: '요즘',
        replacement: '요즘',
      },
    ];
    const { kept, excludedOverlap } = filterLayoutFindingsAgainstTextReplaces(
      layout,
      text,
    );
    expect(kept).toHaveLength(0);
    expect(excludedOverlap).toBe(1);
  });
});
