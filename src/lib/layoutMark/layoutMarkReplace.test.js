import { describe, expect, it } from 'vitest';
import {
  LAYOUT_INDENT_SPACE,
  LAYOUT_MARK_SOURCE,
} from './layoutMarkTypes.js';
import {
  composeAllLayoutMarkReplaces,
  extractStartEojeol,
  layoutMarkToReplacePayload,
  lineStartIndex,
  replacementForKind,
  resolveAnchorEojeol,
} from './layoutMarkReplace.js';

describe('extractStartEojeol', () => {
  it('어절 중간이면 앞으로 되돌아가 W를 잡는다', () => {
    const t = '요즘 말로는';
    expect(extractStartEojeol(t, 1)).toEqual({ w: '요즘', start: 0, end: 2 });
  });

  it('페이지 첫·끝 어절', () => {
    expect(extractStartEojeol('기와는', 0)?.w).toBe('기와는');
    const t = '끝어절';
    expect(extractStartEojeol(t, 0)?.w).toBe('끝어절');
  });

  it('공백 뒤 다음 어절', () => {
    expect(extractStartEojeol('요즘 말로는', 2)?.w).toBe('말로는');
  });
});

describe('lineStartIndex / indent 앵커', () => {
  it('줄 머리로 스냅', () => {
    const t = '첫째줄\n둘째줄시작';
    expect(lineStartIndex(t, 8)).toBe(4);
    expect(resolveAnchorEojeol(t, 8, 'indent')?.w).toBe('둘째줄시작');
  });
});

describe('replacementForKind', () => {
  it('세 종류 Contents', () => {
    expect(replacementForKind('paraSplit', '요즘')).toBe('\n요즘');
    expect(replacementForKind('paraGap', '요즘')).toBe('\n\n요즘');
    expect(replacementForKind('indent', '요즘')).toBe(`${LAYOUT_INDENT_SPACE}요즘`);
  });
});

describe('layoutMarkToReplacePayload', () => {
  it('after가 있으면 pageText 없이 만든다', () => {
    expect(
      layoutMarkToReplacePayload({
        id: '1',
        pageNum: 1,
        index: 0,
        kind: 'paraSplit',
        after: '요즘',
        source: LAYOUT_MARK_SOURCE,
      }),
    ).toMatchObject({ found: '요즘', replacement: '\n요즘' });
  });
});

describe('composeAllLayoutMarkReplaces', () => {
  const text = '요즘 말로는 꾸안꾸';

  it('줄바꿈+들여 → 한 건 \\n+전각+W', () => {
    const marks = [
      {
        id: 'a',
        pageNum: 1,
        index: 0,
        kind: 'paraSplit',
        source: LAYOUT_MARK_SOURCE,
      },
      {
        id: 'b',
        pageNum: 1,
        index: 0,
        kind: 'indent',
        source: LAYOUT_MARK_SOURCE,
      },
    ];
    const out = composeAllLayoutMarkReplaces(marks, text);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      found: '요즘',
      replacement: `\n${LAYOUT_INDENT_SPACE}요즘`,
      kinds: ['paraSplit', 'indent'],
    });
  });

  it('행갈이+들여', () => {
    const marks = [
      {
        id: 'a',
        pageNum: 1,
        index: 0,
        kind: 'paraGap',
        source: LAYOUT_MARK_SOURCE,
      },
      {
        id: 'b',
        pageNum: 1,
        index: 1,
        kind: 'indent',
        source: LAYOUT_MARK_SOURCE,
      },
    ];
    const out = composeAllLayoutMarkReplaces(marks, text);
    expect(out[0].replacement).toBe(`\n\n${LAYOUT_INDENT_SPACE}요즘`);
  });

  it('split+gap이면 gap 개행 우선', () => {
    const marks = [
      {
        id: 'a',
        pageNum: 1,
        index: 0,
        kind: 'paraSplit',
        source: LAYOUT_MARK_SOURCE,
      },
      {
        id: 'b',
        pageNum: 1,
        index: 0,
        kind: 'paraGap',
        source: LAYOUT_MARK_SOURCE,
      },
    ];
    expect(composeAllLayoutMarkReplaces(marks, text)[0].replacement).toBe(
      '\n\n요즘',
    );
  });
});
