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
