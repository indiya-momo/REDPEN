import { describe, expect, it } from 'vitest';
import {
  classifyUnifyListStem,
  collectUnifyListTriage,
} from './unifyListStemTriage.js';

describe('classifyUnifyListStem', () => {
  it('의존명사+의는 drop_rule', () => {
    expect(classifyUnifyListStem('개의')).toBe('drop_rule');
  });

  it('용언처럼 보이면 ambiguous', () => {
    expect(classifyUnifyListStem('만들어')).toBe('ambiguous');
    expect(classifyUnifyListStem('오래')).toBe('ambiguous');
  });

  it('일반 명사 계열은 certain_noun', () => {
    expect(classifyUnifyListStem('문화')).toBe('certain_noun');
    expect(classifyUnifyListStem('캘리포니아')).toBe('certain_noun');
  });
});

describe('collectUnifyListTriage', () => {
  it('애매·확정 명사를 센다', () => {
    const { certainNoun, ambiguous } = collectUnifyListTriage([
      {
        type: 'series',
        affixType: 'prefix',
        affix: '문화',
        label: '문화@',
        clusters: [],
      },
      {
        type: 'series',
        affixType: 'prefix',
        affix: '만들어',
        label: '만들어@',
        clusters: [],
      },
    ]);
    expect(certainNoun.map((x) => x.label)).toEqual(['문화@']);
    expect(ambiguous.map((x) => x.label)).toEqual(['만들어@']);
  });

  it('용언(predicate) 그룹은 용언(추정)으로 센다(띄어쓰기 묶음)', () => {
    const { certainNoun, ambiguous } = collectUnifyListTriage([
      {
        type: 'predicate',
        clusters: [
          { key: '계산해보자' },
          { key: '계산해 보자' },
          { key: '답해 보자' },
          { key: '답해보자' },
        ],
      },
      {
        type: 'series',
        affixType: 'prefix',
        affix: '과학',
        label: '과학@',
        clusters: [],
      },
    ]);
    expect(certainNoun.map((x) => x.label)).toEqual(['과학@']);
    expect(ambiguous.map((x) => x.label)).toEqual([
      '계산해보자 · 계산해 보자',
      '답해 보자 · 답해보자',
    ]);
  });

  it('띄어쓰기만 다른 단일 항목은 1건', () => {
    const { certainNoun, ambiguous } = collectUnifyListTriage([
      {
        type: 'single',
        clusters: [{ key: '거름종이' }, { key: '거름 종이' }],
      },
      {
        type: 'series',
        affixType: 'prefix',
        affix: '과학',
        label: '과학@',
        clusters: [],
      },
      {
        type: 'series',
        affixType: 'prefix',
        affix: '국립',
        label: '국립@',
        clusters: [],
      },
      {
        type: 'series',
        affixType: 'prefix',
        affix: '기름',
        label: '기름@',
        clusters: [],
      },
      {
        type: 'series',
        affixType: 'prefix',
        affix: '명지',
        label: '명지@',
        clusters: [],
      },
      {
        type: 'series',
        affixType: 'prefix',
        affix: '미국',
        label: '미국@',
        clusters: [],
      },
    ]);
    expect(certainNoun).toHaveLength(6);
    expect(certainNoun.map((x) => x.label)).toEqual([
      '거름종이 · 거름 종이',
      '과학@',
      '국립@',
      '기름@',
      '명지@',
      '미국@',
    ]);
    expect(ambiguous).toEqual([]);
  });
});
