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

  it('어절 직후 공백은 앞 어절(그 → 모습이 오앵커 방지)', () => {
    expect(extractStartEojeol('요즘 말로는', 2)?.w).toBe('요즘');
    const t = '그 모습이';
    const space = t.indexOf(' ');
    expect(extractStartEojeol(t, space)?.w).toBe('그');
    expect(extractStartEojeol(t, space)?.w).not.toBe('모습이');
  });

  it('그·모습이 각각의 글자 클릭', () => {
    const t = '그 모습이';
    expect(extractStartEojeol(t, 0)?.w).toBe('그');
    expect(extractStartEojeol(t, t.indexOf('모'))?.w).toBe('모습이');
  });

  it('leading 공백만 있으면 다음 어절', () => {
    expect(extractStartEojeol(' 말로는', 0)?.w).toBe('말로는');
  });

  it('연속 공백: 첫 공백=앞 어절, 둘째 공백=뒤 어절(의도적 비대칭)', () => {
    const t = '그  모습이';
    expect(extractStartEojeol(t, 1)?.w).toBe('그'); // first space after 그
    expect(extractStartEojeol(t, 2)?.w).toBe('모습이'); // second space, prev is space
  });

  it('서: 어절 중간 vs 1글자 어절', () => {
    expect(extractStartEojeol('먼 곳에서 건너온', '먼 곳에서'.indexOf('서'))?.w).toBe(
      '곳에서',
    );
    expect(extractStartEojeol('곳 서 건너', '곳 서'.indexOf('서'))?.w).toBe('서');
  });

  it('줄끝 \\n 직전 공백은 앞 어절', () => {
    const t = '그 \n다음';
    expect(extractStartEojeol(t, 1)?.w).toBe('그');
  });
});

describe('lineStartIndex / indent·행갈이 첫 어절', () => {
  it('줄 머리 인덱스', () => {
    const t = '첫째줄\n둘째줄시작';
    expect(lineStartIndex(t, 8)).toBe(4);
  });

  it('들여·행갈이는 줄 첫 어절만', () => {
    const t = '요즘 말로는\n다음줄';
    expect(resolveAnchorEojeol(t, 0, 'indent')?.w).toBe('요즘');
    expect(resolveAnchorEojeol(t, 3, 'indent')).toBe(null);
    expect(resolveAnchorEojeol(t, 0, 'paraGap')?.w).toBe('요즘');
    expect(resolveAnchorEojeol(t, 3, 'paraGap')).toBe(null);
    expect(resolveAnchorEojeol(t, 3, 'paraSplit')?.w).toBe('말로는');
  });

  it('첫 어절 글자 중간 클릭은 그 어절로 허용', () => {
    const t = '첫째줄\n둘째줄시작';
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
