import { describe, expect, it } from 'vitest';
import {
  UNIFY_LOW_RISK_JOSA,
  UNIFY_HIGH_RISK_JOSA,
  matchLongestLowRiskJosa,
  matchLongestReviewStemSuffix,
  stripReviewStemSuffix,
  attachJosaReviewHints,
} from './unifyJosaReview.js';

describe('UNIFY_LOW_RISK_JOSA', () => {
  it('길이 내림차순으로 정렬되어 있다', () => {
    for (let i = 1; i < UNIFY_LOW_RISK_JOSA.length; i++) {
      expect(UNIFY_LOW_RISK_JOSA[i - 1].length).toBeGreaterThanOrEqual(
        UNIFY_LOW_RISK_JOSA[i].length,
      );
    }
  });

  it('고위험 단음절은 저위험 목록에 없다', () => {
    for (const j of UNIFY_HIGH_RISK_JOSA) {
      expect(UNIFY_LOW_RISK_JOSA).not.toContain(j);
    }
  });
});

describe('matchLongestReviewStemSuffix', () => {
  it('체계에서는 → 에서는 우선', () => {
    expect(matchLongestReviewStemSuffix('체계에서는')).toEqual({
      stemLast: '체계',
      suffix: '에서는',
      bare: false,
    });
  });

  it('역학은 → 은', () => {
    expect(matchLongestReviewStemSuffix('역학은')).toEqual({
      stemLast: '역학',
      suffix: '은',
      bare: false,
    });
  });

  it('단독 어절 은·적', () => {
    expect(matchLongestReviewStemSuffix('은')).toEqual({
      stemLast: '',
      suffix: '은',
      bare: true,
    });
    expect(matchLongestReviewStemSuffix('적')).toEqual({
      stemLast: '',
      suffix: '적',
      bare: true,
    });
  });

  it('가치평가에서 가·이 과잉 제거를 막는다', () => {
    expect(matchLongestReviewStemSuffix('가치평가')).toBeNull();
  });
});

describe('stripReviewStemSuffix', () => {
  it('역학 은 → 역학 (단독 조사 어절)', () => {
    expect(stripReviewStemSuffix('역학 은')).toBe('역학');
  });

  it('역학은 → 역학', () => {
    expect(stripReviewStemSuffix('역학은')).toBe('역학');
  });

  it('역학 적 → 역학', () => {
    expect(stripReviewStemSuffix('역학 적')).toBe('역학');
  });

  it('역학적 → 역학', () => {
    expect(stripReviewStemSuffix('역학적')).toBe('역학');
  });

  it('경제 정책에서 → 경제 정책', () => {
    expect(stripReviewStemSuffix('경제 정책에서')).toBe('경제 정책');
  });
});

describe('matchLongestLowRiskJosa', () => {
  it('저위험만 매칭(고위험 은은 여기선 null)', () => {
    expect(matchLongestLowRiskJosa('경제정책은')).toBeNull();
    expect(matchLongestLowRiskJosa('체계에서는')?.josa).toBe('에서는');
  });
});

describe('attachJosaReviewHints', () => {
  it('같은 어간·저위험 조사만 다르면 peer로 연결하고 횟수는 합치지 않는다', () => {
    const a = {
      key: '경제정책에서',
      variants: ['경제정책에서', '경제 정책에서'],
      counts: { 경제정책에서: 1, '경제 정책에서': 1 },
      occurrencesByVariant: {},
      recommendedUnify: '경제정책에서',
      totalCount: 2,
      kind: 'conflict',
    };
    const b = {
      key: '경제정책으로',
      variants: ['경제정책으로', '경제 정책으로'],
      counts: { 경제정책으로: 1, '경제 정책으로': 2 },
      occurrencesByVariant: {},
      recommendedUnify: '경제 정책으로',
      totalCount: 3,
      kind: 'conflict',
    };
    const out = attachJosaReviewHints([a, b]);
    expect(out[0].totalCount).toBe(2);
    expect(out[1].totalCount).toBe(3);
    expect(out[0].josaReview?.stemKey).toBe('경제정책');
    expect(out[0].josaReview?.peerKeys).toEqual(['경제정책으로']);
  });

  it('역학은·을·의·적을 역학 어간으로 검토 연결한다', () => {
    const mk = (key, spaced, glued) => ({
      key,
      variants: [spaced, glued],
      counts: { [spaced]: 1, [glued]: 1 },
      occurrencesByVariant: {},
      recommendedUnify: glued,
      totalCount: 2,
      kind: 'conflict',
    });
    const out = attachJosaReviewHints([
      mk('역학은', '역학 은', '역학은'),
      mk('역학을', '역학 을', '역학을'),
      mk('역학의', '역학 의', '역학의'),
      mk('역학적', '역학 적', '역학적'),
    ]);
    for (const c of out) {
      expect(c.josaReview?.stemKey).toBe('역학');
      expect(c.josaReview?.status).toBe('review');
      expect(c.josaReview?.peerKeys.length).toBe(3);
      expect(c.totalCount).toBe(2);
    }
    expect(out[0].key).toBe('역학은');
  });
});
