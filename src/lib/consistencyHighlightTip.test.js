import { describe, expect, it } from 'vitest';
import {
  buildConsistencyItemIndexMap,
  getConsistencyHighlightTip,
  getConsistencyResultCardParts,
  getConsistencyResultCardTitle,
} from './consistencyHighlightTip.js';

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

  it('formats auxiliary-verb as 본+보 : (tag)', () => {
    expect(
      getConsistencyHighlightTip({
        find: 'F',
        replace: '$0',
        label: '고˅있 본(-아/어) + 있다',
        patternKind: 'auxiliary-verb',
        tailWord: '고 있',
        groupDisplayLabel: '본(-아/어) + 있다',
        instances: [],
      }),
    ).toBe('본+보 : 본(-아/어) + 있다');
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
    ).toBe('여러 개 찾기 : 세계경제');
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
    ).toBe('여러 개 찾기 : 세계경제');
  });

  it('통일형·공통 문자열 — 결과 카드와 동일 배지', () => {
    const unifyRules = [
      {
        patternKind: 'compound-find',
        tailWord: '미국정부',
        consistencyUnifyEntry: true,
        consistencyUnifyPinned: true,
      },
      {
        patternKind: 'compound-find',
        tailWord: '미국 정부',
        consistencyUnifyEntry: true,
      },
    ];
    expect(
      getConsistencyHighlightTip(
        {
          find: '미국 정부',
          replace: '$0',
          label: '미국 정부',
          patternKind: 'compound-find',
          tailWord: '미국 정부',
          instances: [],
        },
        unifyRules,
      ),
    ).toBe('통일형 찾기 : 미국˅정부');
    expect(
      getConsistencyHighlightTip(
        {
          find: '@정부',
          replace: '$0',
          label: '@정부',
          patternKind: 'phrase-slot-find',
          tailWord: '@정부',
          instances: [],
        },
      ),
    ).toBe('공통 문자열 찾기 : @정부');
  });
});

describe('getConsistencyResultCardParts', () => {
  it('literal consistency — 일관성 배지 + 등록 문자열', () => {
    expect(
      getConsistencyResultCardParts({
        find: '세계경제',
        replace: '$0',
        label: '세계경제',
        patternKind: 'compound-find',
        tailWord: '세계경제',
        instances: [{}, {}, {}],
      }),
    ).toEqual({ badge: '여러 개 찾기', label: '세계경제' });
    expect(
      getConsistencyResultCardParts({
        find: '세계 경제',
        replace: '$0',
        label: '세계 경제',
        patternKind: 'compound-find',
        tailWord: '세계 경제',
        instances: [{}],
      }),
    ).toEqual({ badge: '여러 개 찾기', label: '세계˅경제' });
  });

  it('통일형 — 배지·📌 표시', () => {
    const unifyRules = [
      {
        patternKind: 'compound-find',
        tailWord: '세계경제',
        consistencyUnifyEntry: true,
        consistencyUnifyPinned: true,
      },
      {
        patternKind: 'compound-find',
        tailWord: '세계 경제',
        consistencyUnifyEntry: true,
      },
    ];
    expect(
      getConsistencyResultCardParts(
        {
          find: '세계경제',
          replace: '$0',
          label: '세계경제',
          patternKind: 'compound-find',
          tailWord: '세계경제',
          instances: [{}],
        },
        unifyRules,
      ),
    ).toEqual({ badge: '통일형 찾기', label: '세계경제 📌' });
    expect(
      getConsistencyResultCardParts(
        {
          find: '세계 경제',
          replace: '$0',
          label: '세계 경제',
          patternKind: 'compound-find',
          tailWord: '세계 경제',
          instances: [{}],
        },
        unifyRules,
      ),
    ).toEqual({ badge: '통일형 찾기', label: '세계˅경제' });
  });

  it('phrase-slot — 공통 문자열 찾기 배지 + 등록 문자열', () => {
    expect(
      getConsistencyResultCardParts({
        find: '@정부',
        replace: '$0',
        label: '@정부',
        patternKind: 'phrase-slot-find',
        tailWord: '@정부',
        instances: [{}],
      }),
    ).toEqual({ badge: '공통 문자열 찾기', label: '@정부' });
  });

  it('auxiliary-verb — 본+보 배지 + 항목 라벨', () => {
    expect(
      getConsistencyResultCardParts({
        find: 'F',
        replace: '$0',
        label: '고˅있 본(-아/어) + 가다',
        patternKind: 'auxiliary-verb',
        tailWord: '고 있',
        groupDisplayLabel: '본(-아/어) + 가다',
        instances: [{}],
      }),
    ).toEqual({ badge: '본+보', label: '본(-아/어) + 가다' });
  });
});

describe('getConsistencyResultCardTitle', () => {
  it('joins badge and label for plain text fallback', () => {
    expect(
      getConsistencyResultCardTitle({
        find: '세계경제',
        replace: '$0',
        label: '세계경제',
        patternKind: 'compound-find',
        tailWord: '세계경제',
        instances: [{}],
      }),
    ).toBe('여러 개 찾기 세계경제');
  });
});

describe('buildConsistencyItemIndexMap', () => {
  it('numbers each consistency category from 1 in list order', () => {
    const entries = [
      {
        source: 'consistency',
        group: {
          label: 'a',
          find: 'a',
          patternKind: 'compound-find',
          instances: [{}],
        },
      },
      {
        source: 'consistency',
        group: {
          label: 'b',
          find: 'b',
          patternKind: 'phrase-slot-find',
          instances: [{}],
        },
      },
      {
        source: 'consistency',
        group: {
          label: 'c',
          find: 'c',
          patternKind: 'compound-find',
          instances: [{}],
        },
      },
    ];
    const map = buildConsistencyItemIndexMap(entries);
    expect(map.get('consistency-a-a')).toBe(1);
    expect(map.get('consistency-b-b')).toBe(1);
    expect(map.get('consistency-c-c')).toBe(2);
  });
});
