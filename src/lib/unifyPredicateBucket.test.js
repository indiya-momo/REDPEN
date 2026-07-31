import { describe, expect, it } from 'vitest';
import {
  isUnifyPredicateCluster,
  looksLikePredicateKey,
  isUnifyJosaPlusPredicateKey,
  dropJosaPlusPredicateFromGroups,
} from './unifyPredicateBucket.js';

describe('looksLikePredicateKey', () => {
  it('용언 활용형 끝 음절을 잡는다', () => {
    expect(looksLikePredicateKey('돌아가')).toBe(true);
    expect(looksLikePredicateKey('만들어')).toBe(true);
    expect(looksLikePredicateKey('보여')).toBe(true);
    expect(looksLikePredicateKey('생각해')).toBe(true);
    expect(looksLikePredicateKey('싶어')).toBe(true);
    expect(looksLikePredicateKey('알려')).toBe(true);
    expect(looksLikePredicateKey('올려')).toBe(true);
  });

  it('기본형·보조용언 꼬리(@보다·@내다)를 잡는다', () => {
    expect(looksLikePredicateKey('보다')).toBe(true);
    expect(looksLikePredicateKey('내다')).toBe(true);
    expect(looksLikePredicateKey('가다')).toBe(true);
    expect(looksLikePredicateKey('살펴보다')).toBe(true);
    expect(looksLikePredicateKey('만들어내다')).toBe(true);
  });

  it('알려진 용언 어간(오래)을 잡는다', () => {
    expect(looksLikePredicateKey('오래')).toBe(true);
  });

  it('개의(의존명사+의)는 휴리스틱 용언이 아니다', () => {
    expect(looksLikePredicateKey('개의')).toBe(false);
  });

  it('명사 위주 표기는 제외한다', () => {
    expect(looksLikePredicateKey('물가')).toBe(false);
    expect(looksLikePredicateKey('생활')).toBe(false);
    expect(looksLikePredicateKey('세계')).toBe(false);
    expect(looksLikePredicateKey('신용')).toBe(false);
    expect(looksLikePredicateKey('이전')).toBe(false);
    expect(looksLikePredicateKey('언어')).toBe(false);
    expect(looksLikePredicateKey('바다')).toBe(false);
    expect(looksLikePredicateKey('고려')).toBe(false);
    expect(looksLikePredicateKey('노래')).toBe(false);
    expect(looksLikePredicateKey('미래')).toBe(false);
  });

  it('외래 지명 -ia(~니아·~시아)는 용언으로 보지 않는다', () => {
    expect(looksLikePredicateKey('캘리포니아')).toBe(false);
    expect(looksLikePredicateKey('미국캘리포니아')).toBe(false);
    expect(looksLikePredicateKey('펜실베니아')).toBe(false);
    expect(looksLikePredicateKey('미국펜실베니아')).toBe(false);
    expect(looksLikePredicateKey('아시아')).toBe(false);
    expect(looksLikePredicateKey('러시아')).toBe(false);
    expect(looksLikePredicateKey('좋아')).toBe(true);
    expect(looksLikePredicateKey('살아')).toBe(true);
  });
});

describe('isUnifyPredicateCluster', () => {
  it('auxReview가 있으면 용언으로 본다', () => {
    expect(
      isUnifyPredicateCluster({
        key: '해보',
        auxReview: { status: 'review', stemKey: '해보', stemSpaced: '해 보' },
      }),
    ).toBe(true);
  });

  it('어미 휴리스틱만으로도 판단한다', () => {
    expect(isUnifyPredicateCluster({ key: '만들어' })).toBe(true);
    expect(isUnifyPredicateCluster({ key: '인구' })).toBe(false);
  });
});

describe('isUnifyJosaPlusPredicateKey', () => {
  it('조사+용언·어간+조사+용언을 잡는다', () => {
    expect(isUnifyJosaPlusPredicateKey('을하다')).toBe(true);
    expect(isUnifyJosaPlusPredicateKey('이되다')).toBe(true);
    expect(isUnifyJosaPlusPredicateKey('역할을하다')).toBe(true);
    expect(isUnifyJosaPlusPredicateKey('회사에서하다')).toBe(true);
  });

  it('활용형 꼬리(보자)도 조사+용언으로 잡는다', () => {
    expect(isUnifyJosaPlusPredicateKey('금리인상을보자')).toBe(true);
    expect(isUnifyJosaPlusPredicateKey('담론을보자')).toBe(true);
    expect(isUnifyJosaPlusPredicateKey('답변을보자')).toBe(true);
    expect(isUnifyJosaPlusPredicateKey('을보자')).toBe(true);
  });

  it('사전 API 용언 키면 활용 휴리스틱 밖 꼬리도 조사 구조로 잡는다', () => {
    expect(
      isUnifyJosaPlusPredicateKey('정책을펼치자', {
        stdictPredicateKeys: new Set(['정책을펼치자']),
      }),
    ).toBe(true);
    expect(isUnifyJosaPlusPredicateKey('정책을펼치자')).toBe(false);
  });

  it('일반 용언·보조 꼬리는 제외하지 않는다', () => {
    expect(isUnifyJosaPlusPredicateKey('살펴보다')).toBe(false);
    expect(isUnifyJosaPlusPredicateKey('하다')).toBe(false);
    expect(isUnifyJosaPlusPredicateKey('보다')).toBe(false);
    expect(isUnifyJosaPlusPredicateKey('만들어')).toBe(false);
  });
});

describe('dropJosaPlusPredicateFromGroups', () => {
  it('용언 단일에서 역할을하다를 빼고 살펴보다는 남긴다', () => {
    const groups = dropJosaPlusPredicateFromGroups([
      {
        type: 'predicate',
        clusters: [
          { key: '역할을하다', variants: ['역할을하다', '역할을 하다'] },
          { key: '살펴보다', variants: ['살펴보다', '살펴 보다'] },
        ],
      },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].clusters.map((c) => c.key)).toEqual(['살펴보다']);
  });

  it('단일 구간에서도 금리인상을보자를 뺀다', () => {
    const groups = dropJosaPlusPredicateFromGroups([
      {
        type: 'single',
        clusters: [
          { key: '금리인상을보자', variants: ['금리인상을 보자', '금리인상을보자'] },
          { key: '금융시장', variants: ['금융 시장', '금융시장'] },
        ],
      },
    ]);
    expect(groups[0].clusters.map((c) => c.key)).toEqual(['금융시장']);
  });

  it('@을하다 계열은 통째로 뺀다', () => {
    const groups = dropJosaPlusPredicateFromGroups([
      {
        type: 'series',
        affix: '을하다',
        affixType: 'suffix',
        label: '@을하다',
        clusters: [
          { key: '역할을하다', variants: ['역할을하다', '역할을 하다'] },
        ],
      },
    ]);
    expect(groups).toEqual([]);
  });
});
