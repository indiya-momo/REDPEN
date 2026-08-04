/**
 * 표기통일 잡음 필터 회귀 코퍼스 (KEEP = 유지, DROP = 제외).
 *
 * 새 휴리스틱·수확 꼬리를 넣을 때 이 목록을 먼저 돌린다.
 * - KEEP 깨짐 → 캐나다⊃나다 등 명사복합 오탐
 * - DROP 깨짐 → 잡음이 다시 목록에 섞임
 * - 조사 가드(`붉`≠`붉+은`)는 LeftHeuristic 단위 테스트로 별도 고정
 *
 * @typedef {{ spaced: string, note?: string }} UnifyNoiseCorpusCase
 */

/** @type {readonly UnifyNoiseCorpusCase[]} */
export const UNIFY_NOISE_REGRESSION_KEEP = Object.freeze([
  { spaced: '캐나다 정부', note: '체언 내부 …나다 ≠ 용언 어미' },
  { spaced: '경리 업무', note: '명사+명사 유지' },
  { spaced: '주식 시장', note: '명사+명사 유지' },
  { spaced: '미국 정부', note: '명사+명사 유지' },
  { spaced: '직장 사람', note: '명사+명사(@사람) 유지' },
]);

/** @type {readonly UnifyNoiseCorpusCase[]} */
export const UNIFY_NOISE_REGRESSION_DROP = Object.freeze([
  { spaced: '대부분 공무원', note: '예외 어절(왼쪽)' },
  { spaced: '대부분의 사람', note: '예외 어절+의' },
  { spaced: '가족 모두', note: '예외 어절(오른쪽)' },
  { spaced: '가족 끼리', note: '의존명사' },
  { spaced: '결혼 직전', note: '시점 의존명사' },
  { spaced: '가정하고 공무원', note: '용언 연결' },
  { spaced: '가치있다고 시장', note: '수확 꼬리' },
  { spaced: '구성되며 시장', note: '수확 꼬리' },
  { spaced: '기록하여 결과', note: '하다 활용' },
  { spaced: '결혼 하고자', note: '명사+하다' },
  { spaced: '결혼 하려고', note: '명사+하다' },
  { spaced: '결혼 하였고', note: '명사+하다' },
  { spaced: '결혼 했어', note: '명사+하다' },
  { spaced: '내가 공무원', note: '짧은 체언+격조사' },
  { spaced: '등이 공무원', note: '등+이' },
  { spaced: '들어서 공무원', note: '용언 연결 어서' },
  { spaced: '보면 공무원', note: '본보조 보면' },
  // 관형형 어미 닫힌집합 — 명사 아님
  { spaced: '아는 사람', note: '관형형 -는' },
  { spaced: '못하는 사람', note: '관형형 -는' },
  { spaced: '사는 사람', note: '관형형 -는' },
  { spaced: '말하는 사람', note: '관형형 -는' },
  { spaced: '않는 사람', note: '관형형 -는' },
  { spaced: '않은 사람', note: '관형형 -은' },
  { spaced: '높은 사람', note: '관형형 -은' },
  { spaced: '붉은 표시', note: '관형형 -은 (명사 아님)' },
]);

/**
 * 리스트 휴리스틱 밖(가지+ㄴ·만하+ㄴ) — Kiwi 2차 POS로만 DROP.
 * @type {readonly UnifyNoiseCorpusCase[]}
 */
export const UNIFY_NOISE_REGRESSION_DROP_KIWI_ADNOMINAL = Object.freeze([
  { spaced: '가진 사람', note: '관형형 종성ㄴ(가진) — Kiwi POS' },
  { spaced: '만한 사람', note: '관형형 종성ㄴ(만한) — Kiwi POS' },
]);

/** 붙임·단독 표면 (띄움 쌍이 아닌 DROP) */
/** @type {readonly { surface: string, note?: string }[]} */
export const UNIFY_NOISE_REGRESSION_DROP_SURFACES = Object.freeze([
  { surface: '담당하던', note: '하던 꼬리' },
  { surface: '광고니까', note: '이다 연결' },
  { surface: '결혼하고자', note: '하고자' },
  { surface: '가족끼리', note: '예외 접미' },
  { surface: '결혼직전', note: '예외 접미' },
]);
