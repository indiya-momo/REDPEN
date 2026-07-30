import { describe, expect, it } from 'vitest';
import {
  isUnifyPredicateCluster,
  looksLikePredicateKey,
} from './unifyPredicateBucket.js';

describe('looksLikePredicateKey', () => {
  it('용언 활용형 끝 음절을 잡는다', () => {
    expect(looksLikePredicateKey('돌아가')).toBe(true);
    expect(looksLikePredicateKey('만들어')).toBe(true);
    expect(looksLikePredicateKey('보여')).toBe(true);
    expect(looksLikePredicateKey('생각해')).toBe(true);
    expect(looksLikePredicateKey('싶어')).toBe(true);
  });

  it('명사 위주 표기는 제외한다', () => {
    expect(looksLikePredicateKey('물가')).toBe(false);
    expect(looksLikePredicateKey('생활')).toBe(false);
    expect(looksLikePredicateKey('세계')).toBe(false);
    expect(looksLikePredicateKey('신용')).toBe(false);
    expect(looksLikePredicateKey('이전')).toBe(false);
    expect(looksLikePredicateKey('언어')).toBe(false);
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
