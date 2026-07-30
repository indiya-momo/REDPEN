import { describe, expect, it } from 'vitest';
import {
  UNIFY_LOW_RISK_JOSA,
  UNIFY_AMBIGUOUS_JOSA_SUFFIXES,
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

  it('애매한 단음절 조사는 저위험 목록에 없다', () => {
    for (const j of UNIFY_AMBIGUOUS_JOSA_SUFFIXES) {
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

  it('가량·쯤·뿐·같이 등 추가 조사를 인식한다', () => {
    expect(matchLongestReviewStemSuffix('열명가량')).toEqual({
      stemLast: '열명',
      suffix: '가량',
      bare: false,
    });
    expect(matchLongestReviewStemSuffix('백명쯤')).toEqual({
      stemLast: '백명',
      suffix: '쯤',
      bare: false,
    });
    expect(matchLongestReviewStemSuffix('생각뿐')).toEqual({
      stemLast: '생각',
      suffix: '뿐',
      bare: false,
    });
    expect(matchLongestReviewStemSuffix('구름같이')).toEqual({
      stemLast: '구름',
      suffix: '같이',
      bare: false,
    });
    expect(matchLongestReviewStemSuffix('두세가지')).toEqual({
      stemLast: '두세',
      suffix: '가지',
      bare: false,
    });
    expect(matchLongestReviewStemSuffix('어느정도')).toEqual({
      stemLast: '어느',
      suffix: '정도',
      bare: false,
    });
    expect(matchLongestReviewStemSuffix('상처투성이')).toEqual({
      stemLast: '상처',
      suffix: '투성이',
      bare: false,
    });
    expect(matchLongestReviewStemSuffix('말은커녕')).toEqual({
      stemLast: '말은',
      suffix: '커녕',
      bare: false,
    });
  });

  it('이나·이다·보다는·에를 인식한다', () => {
    expect(matchLongestReviewStemSuffix('사과이나')).toEqual({
      stemLast: '사과',
      suffix: '이나',
      bare: false,
    });
    expect(matchLongestReviewStemSuffix('사실이다')).toEqual({
      stemLast: '사실',
      suffix: '이다',
      bare: false,
    });
    expect(matchLongestReviewStemSuffix('사과보다는')).toEqual({
      stemLast: '사과',
      suffix: '보다는',
      bare: false,
    });
    expect(matchLongestReviewStemSuffix('학교에')).toEqual({
      stemLast: '학교',
      suffix: '에',
      bare: false,
    });
  });

  it('안·밖·와·과·성을 인식한다', () => {
    expect(matchLongestReviewStemSuffix('건물안')).toEqual({
      stemLast: '건물',
      suffix: '안',
      bare: false,
    });
    expect(matchLongestReviewStemSuffix('건물밖')).toEqual({
      stemLast: '건물',
      suffix: '밖',
      bare: false,
    });
    expect(matchLongestReviewStemSuffix('친구와')).toEqual({
      stemLast: '친구',
      suffix: '와',
      bare: false,
    });
    expect(matchLongestReviewStemSuffix('사과과')).toEqual({
      stemLast: '사과',
      suffix: '과',
      bare: false,
    });
    expect(matchLongestReviewStemSuffix('경제성')).toEqual({
      stemLast: '경제',
      suffix: '성',
      bare: false,
    });
  });

  it('되다 활용·적으로·들·인을 인식한다', () => {
    expect(matchLongestReviewStemSuffix('결정되어')).toEqual({
      stemLast: '결정',
      suffix: '되어',
      bare: false,
    });
    expect(matchLongestReviewStemSuffix('결정되며')).toEqual({
      stemLast: '결정',
      suffix: '되며',
      bare: false,
    });
    expect(matchLongestReviewStemSuffix('결정되므로')).toEqual({
      stemLast: '결정',
      suffix: '되므로',
      bare: false,
    });
    expect(matchLongestReviewStemSuffix('결정되지')).toEqual({
      stemLast: '결정',
      suffix: '되지',
      bare: false,
    });
    expect(matchLongestReviewStemSuffix('결정됨')).toEqual({
      stemLast: '결정',
      suffix: '됨',
      bare: false,
    });
    expect(matchLongestReviewStemSuffix('결정되었')).toEqual({
      stemLast: '결정',
      suffix: '되었',
      bare: false,
    });
    expect(matchLongestReviewStemSuffix('결정됐')).toEqual({
      stemLast: '결정',
      suffix: '됐',
      bare: false,
    });
    expect(matchLongestReviewStemSuffix('결정된')).toEqual({
      stemLast: '결정',
      suffix: '된',
      bare: false,
    });
    expect(matchLongestReviewStemSuffix('경제적으로')).toEqual({
      stemLast: '경제',
      suffix: '적으로',
      bare: false,
    });
    expect(matchLongestReviewStemSuffix('사람들')).toEqual({
      stemLast: '사람',
      suffix: '들',
      bare: false,
    });
    expect(matchLongestReviewStemSuffix('사람인')).toEqual({
      stemLast: '사람',
      suffix: '인',
      bare: false,
    });
  });

  it('나·다·로·별·하 계열·라고도·인지를 인식한다', () => {
    expect(matchLongestReviewStemSuffix('사과나')).toEqual({
      stemLast: '사과',
      suffix: '나',
      bare: false,
    });
    expect(matchLongestReviewStemSuffix('사과다')).toEqual({
      stemLast: '사과',
      suffix: '다',
      bare: false,
    });
    expect(matchLongestReviewStemSuffix('학교로')).toEqual({
      stemLast: '학교',
      suffix: '로',
      bare: false,
    });
    expect(matchLongestReviewStemSuffix('종류별')).toEqual({
      stemLast: '종류',
      suffix: '별',
      bare: false,
    });
    expect(matchLongestReviewStemSuffix('결정하')).toEqual({
      stemLast: '결정',
      suffix: '하',
      bare: false,
    });
    expect(matchLongestReviewStemSuffix('결정하며')).toEqual({
      stemLast: '결정',
      suffix: '하며',
      bare: false,
    });
    expect(matchLongestReviewStemSuffix('결정할')).toEqual({
      stemLast: '결정',
      suffix: '할',
      bare: false,
    });
    expect(matchLongestReviewStemSuffix('결정해도')).toEqual({
      stemLast: '결정',
      suffix: '해도',
      bare: false,
    });
    expect(matchLongestReviewStemSuffix('사과라고도')).toEqual({
      stemLast: '사과',
      suffix: '라고도',
      bare: false,
    });
    expect(matchLongestReviewStemSuffix('사실인지')).toEqual({
      stemLast: '사실',
      suffix: '인지',
      bare: false,
    });
  });

  it('하는·사이·같은·역시·또한·으를 인식한다', () => {
    expect(matchLongestReviewStemSuffix('결정하는')).toEqual({
      stemLast: '결정',
      suffix: '하는',
      bare: false,
    });
    expect(matchLongestReviewStemSuffix('사람사이')).toEqual({
      stemLast: '사람',
      suffix: '사이',
      bare: false,
    });
    expect(matchLongestReviewStemSuffix('사과같은')).toEqual({
      stemLast: '사과',
      suffix: '같은',
      bare: false,
    });
    expect(matchLongestReviewStemSuffix('사실역시')).toEqual({
      stemLast: '사실',
      suffix: '역시',
      bare: false,
    });
    expect(matchLongestReviewStemSuffix('사실또한')).toEqual({
      stemLast: '사실',
      suffix: '또한',
      bare: false,
    });
    expect(matchLongestReviewStemSuffix('학교으')).toEqual({
      stemLast: '학교',
      suffix: '으',
      bare: false,
    });
  });

  it('대비·질·된다·하고·하기가·해서·한·하다·하지를 인식한다', () => {
    expect(matchLongestReviewStemSuffix('부채대비')).toEqual({
      stemLast: '부채',
      suffix: '대비',
      bare: false,
    });
    expect(matchLongestReviewStemSuffix('경제질')).toEqual({
      stemLast: '경제',
      suffix: '질',
      bare: false,
    });
    expect(matchLongestReviewStemSuffix('결정된다')).toEqual({
      stemLast: '결정',
      suffix: '된다',
      bare: false,
    });
    expect(matchLongestReviewStemSuffix('결정하고')).toEqual({
      stemLast: '결정',
      suffix: '하고',
      bare: false,
    });
    expect(matchLongestReviewStemSuffix('결정하기가')).toEqual({
      stemLast: '결정',
      suffix: '하기가',
      bare: false,
    });
    expect(matchLongestReviewStemSuffix('결정해서')).toEqual({
      stemLast: '결정',
      suffix: '해서',
      bare: false,
    });
    expect(matchLongestReviewStemSuffix('결정한')).toEqual({
      stemLast: '결정',
      suffix: '한',
      bare: false,
    });
    expect(matchLongestReviewStemSuffix('결정하다')).toEqual({
      stemLast: '결정',
      suffix: '하다',
      bare: false,
    });
    expect(matchLongestReviewStemSuffix('결정하지')).toEqual({
      stemLast: '결정',
      suffix: '하지',
      bare: false,
    });
  });

  it('에도·면·야·주는·주던·주려는·준·외·이외를 인식한다', () => {
    expect(matchLongestReviewStemSuffix('학교에도')).toEqual({
      stemLast: '학교',
      suffix: '에도',
      bare: false,
    });
    expect(matchLongestReviewStemSuffix('결정면')).toEqual({
      stemLast: '결정',
      suffix: '면',
      bare: false,
    });
    expect(matchLongestReviewStemSuffix('사실야')).toEqual({
      stemLast: '사실',
      suffix: '야',
      bare: false,
    });
    expect(matchLongestReviewStemSuffix('도움주는')).toEqual({
      stemLast: '도움',
      suffix: '주는',
      bare: false,
    });
    expect(matchLongestReviewStemSuffix('도움주던')).toEqual({
      stemLast: '도움',
      suffix: '주던',
      bare: false,
    });
    expect(matchLongestReviewStemSuffix('도움주려는')).toEqual({
      stemLast: '도움',
      suffix: '주려는',
      bare: false,
    });
    expect(matchLongestReviewStemSuffix('도움준')).toEqual({
      stemLast: '도움',
      suffix: '준',
      bare: false,
    });
    expect(matchLongestReviewStemSuffix('학교외')).toEqual({
      stemLast: '학교',
      suffix: '외',
      bare: false,
    });
    expect(matchLongestReviewStemSuffix('학교이외')).toEqual({
      stemLast: '학교',
      suffix: '이외',
      bare: false,
    });
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

  it('지속 되었는가·지속적이고·지속 해', () => {
    expect(stripReviewStemSuffix('지속되었는가')).toBe('지속되었는');
    expect(stripReviewStemSuffix('지속 적이고')).toBe('지속');
    expect(stripReviewStemSuffix('지속적이고')).toBe('지속');
    expect(stripReviewStemSuffix('지속 해')).toBe('지속');
    expect(stripReviewStemSuffix('지속해')).toBe('지속');
  });

  it('활동 이며·활동 하도록', () => {
    expect(stripReviewStemSuffix('활동이며')).toBe('활동');
    expect(stripReviewStemSuffix('활동 이며')).toBe('활동');
    expect(stripReviewStemSuffix('활동하도록')).toBe('활동');
    expect(stripReviewStemSuffix('활동 하도록')).toBe('활동');
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

  it('같은 어간 peer가 없어도 접미가 떨어지면 검토 라벨을 붙인다', () => {
    const mk = (key, spaced, glued) => ({
      key,
      variants: [glued, spaced],
      counts: { [glued]: 1, [spaced]: 1 },
      occurrencesByVariant: {},
      recommendedUnify: glued,
      totalCount: 2,
      kind: 'conflict',
    });
    const out = attachJosaReviewHints([
      mk('지속되었는가', '지속 되었는가', '지속되었는가'),
      mk('지속적이고', '지속 적이고', '지속적이고'),
      mk('지속해', '지속 해', '지속해'),
    ]);
    for (const c of out) {
      expect(c.josaReview?.status).toBe('review');
    }
    expect(out[0].josaReview?.stemKey).toBe('지속되었는');
    expect(out[0].josaReview?.peerKeys).toEqual([]);
    expect(out[1].josaReview?.stemKey).toBe('지속');
    expect(out[2].josaReview?.stemKey).toBe('지속');
    expect(out[1].josaReview?.peerKeys).toEqual(['지속해']);
    expect(out[2].josaReview?.peerKeys).toEqual(['지속적이고']);
  });

  it('활동 이며·활동 하도록도 단독 검토 라벨', () => {
    const mk = (key, spaced, glued) => ({
      key,
      variants: [glued, spaced],
      counts: { [glued]: 1, [spaced]: 1 },
      occurrencesByVariant: {},
      recommendedUnify: glued,
      totalCount: 2,
      kind: 'conflict',
    });
    const out = attachJosaReviewHints([
      mk('활동이며', '활동 이며', '활동이며'),
      mk('활동하도록', '활동 하도록', '활동하도록'),
    ]);
    expect(out[0].josaReview?.stemKey).toBe('활동');
    expect(out[1].josaReview?.stemKey).toBe('활동');
  });
});
