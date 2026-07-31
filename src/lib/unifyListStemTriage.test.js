import { describe, expect, it } from 'vitest';
import {
  classifyUnifyListSeries,
  classifyUnifyListStem,
  collectUnifyListTriage,
  markSeriesBySlotMajority,
  seriesSlotFiller,
  seriesSlotVote,
  isExcludedSeriesSlotFiller,
  isUnifyListDroppedMonoSlotCluster,
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

describe('seriesSlotFiller / seriesSlotVote', () => {
  it('접두 계열에서 띄움 뒤 어절을 채움말로 쓴다', () => {
    expect(
      seriesSlotFiller(
        { key: '과학기술', variants: ['과학 기술', '과학기술'] },
        '과학',
        'prefix',
      ),
    ).toBe('기술');
    expect(
      seriesSlotFiller(
        { key: '과학해보', variants: ['과학 해 보', '과학해보'] },
        '과학',
        'prefix',
      ),
    ).toBe('해보');
  });

  it('금융업·금융학은 @ 채움 단음절, 기술 58은 @ 채움 숫자', () => {
    expect(
      isExcludedSeriesSlotFiller(
        { key: '금융업', variants: ['금융 업', '금융업'] },
        '금융',
        'prefix',
      ),
    ).toBe(true);
    expect(
      isExcludedSeriesSlotFiller(
        { key: '금융시장', variants: ['금융 시장', '금융시장'] },
        '금융',
        'prefix',
      ),
    ).toBe(false);
    expect(
      isExcludedSeriesSlotFiller(
        { key: '기술58', variants: ['기술 58', '기술58'] },
        '기술',
        'prefix',
      ),
    ).toBe(true);
    expect(
      isExcludedSeriesSlotFiller(
        { key: '기술58은행', variants: ['기술 58 은행', '기술58은행'] },
        '은행',
        'suffix',
      ),
    ).toBe(true);
    expect(
      isUnifyListDroppedMonoSlotCluster({
        key: '금융학',
        variants: ['금융 학', '금융학'],
      }),
    ).toBe(true);
    expect(
      isUnifyListDroppedMonoSlotCluster({
        key: '기술58',
        variants: ['기술 58', '기술58'],
      }),
    ).toBe(true);
    expect(
      isUnifyListDroppedMonoSlotCluster({
        key: '금융시장',
        variants: ['금융 시장', '금융시장'],
      }),
    ).toBe(false);
  });

  it('보조용언 힌트·용언형 채움은 aux, 명사 채움은 noun', () => {
    expect(
      seriesSlotVote(
        {
          key: '과학해보',
          variants: ['과학 해 보'],
          auxReview: { status: 'review' },
        },
        '과학',
        'prefix',
      ),
    ).toBe('aux');
    expect(
      seriesSlotVote(
        { key: '과학기술', variants: ['과학 기술'] },
        '과학',
        'prefix',
      ),
    ).toBe('noun');
  });
});

describe('classifyUnifyListSeries', () => {
  it('@ 채움이 명사 다수면 명사', () => {
    expect(
      classifyUnifyListSeries({
        affix: '과학',
        affixType: 'prefix',
        clusters: [
          { key: '과학기술', variants: ['과학 기술'] },
          { key: '과학실험', variants: ['과학 실험'] },
          { key: '과학공원', variants: ['과학 공원'] },
        ],
      }),
    ).toBe('certain_noun');
  });

  it('@ 채움이 보조·용언 다수면 용언(추정)', () => {
    expect(
      classifyUnifyListSeries({
        affix: '과학',
        affixType: 'prefix',
        clusters: [
          {
            key: '과학해보',
            variants: ['과학 해 보'],
            auxReview: { status: 'review' },
          },
          {
            key: '과학해보았',
            variants: ['과학 해 보았'],
            auxReview: { status: 'review' },
          },
          { key: '과학기술', variants: ['과학 기술'] },
        ],
      }),
    ).toBe('ambiguous');
  });

  it('채움 없으면 affix 휴리스틱', () => {
    expect(
      classifyUnifyListSeries({
        affix: '만들어',
        affixType: 'prefix',
        clusters: [],
      }),
    ).toBe('ambiguous');
    expect(
      classifyUnifyListSeries({
        affix: '문화',
        affixType: 'prefix',
        clusters: [],
      }),
    ).toBe('certain_noun');
  });
});

describe('markSeriesBySlotMajority', () => {
  it('보조 다수 계열에 dictPos=predicate를 붙인다', () => {
    const [marked] = markSeriesBySlotMajority([
      {
        type: 'series',
        affix: '과학',
        affixType: 'prefix',
        label: '과학@',
        clusters: [
          {
            key: '과학해보',
            variants: ['과학 해 보'],
            auxReview: { status: 'review' },
          },
          {
            key: '과학내보',
            variants: ['과학 내 보'],
            auxReview: { status: 'review' },
          },
        ],
      },
    ]);
    expect(marked.dictPos).toBe('predicate');
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

  it('계열 @ 채움 보조 다수면 용언(추정)으로 센다', () => {
    const { certainNoun, ambiguous } = collectUnifyListTriage([
      {
        type: 'series',
        affixType: 'prefix',
        affix: '과학',
        label: '과학@',
        dictPos: 'predicate',
        clusters: [
          {
            key: '과학해보',
            variants: ['과학 해 보'],
            auxReview: { status: 'review' },
          },
        ],
      },
    ]);
    expect(certainNoun).toEqual([]);
    expect(ambiguous.map((x) => x.label)).toEqual(['과학@']);
  });
});
