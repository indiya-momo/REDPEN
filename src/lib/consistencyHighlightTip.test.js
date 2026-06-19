import { describe, expect, it } from 'vitest';
import { getConsistencyHighlightTip } from './consistencyHighlightTip.js';

describe('getConsistencyHighlightTip', () => {
  it('uses explicit tip when present', () => {
    expect(
      getConsistencyHighlightTip({
        find: 'a',
        replace: 'b',
        label: 'L',
        tip: '시트 안내',
        instances: [],
      }),
    ).toBe('시트 안내');
  });

  it('formats auxiliary-verb as 본용언 + 보조용언 : (tag)', () => {
    expect(
      getConsistencyHighlightTip({
        find: 'F',
        replace: '$0',
        label: '고˅있 (아/어) + 있다',
        patternKind: 'auxiliary-verb',
        tailWord: '고 있',
        groupDisplayLabel: '(아/어) + 있다',
        instances: [],
      }),
    ).toBe('본용언 + 보조용언 : (아/어) + 있다');
  });

  it('formats literal consistency without replace line', () => {
    expect(
      getConsistencyHighlightTip({
        find: '세계경제',
        replace: '$0',
        label: '세계경제 → $0',
        category: 'consistency',
        instances: [],
      }),
    ).toBe('일관성 찾기 : 세계경제');
  });

  it('uses tailWord for compound rules', () => {
    expect(
      getConsistencyHighlightTip({
        find: '(?<=^)경제',
        replace: '$0',
        label: '경제',
        patternKind: 'compound-find',
        tailWord: '세계경제',
        instances: [],
      }),
    ).toBe('일관성 찾기 : 세계경제');
  });
});
