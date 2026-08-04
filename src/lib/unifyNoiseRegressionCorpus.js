/**
 * 표기통일 잡음 필터 회귀 코퍼스 (KEEP = 유지, DROP = 제외).
 *
 * 새 휴리스틱·수확 꼬리를 넣을 때 이 목록을 먼저 돌린다.
 * - KEEP 깨짐 → 캐나다⊃나다 / 붉은⊃붉+은 같은 오탐 회귀
 * - DROP 깨짐 → 잡음이 다시 목록에 섞임
 *
 * @typedef {{ spaced: string, note?: string }} UnifyNoiseCorpusCase
 */

/** @type {readonly UnifyNoiseCorpusCase[]} */
export const UNIFY_NOISE_REGRESSION_KEEP = Object.freeze([
  { spaced: '캐나다 정부', note: '체언 내부 …나다 ≠ 용언 어미' },
  { spaced: '붉은 표시', note: '관형형 붉은 ≠ 체언+보조사 은' },
  { spaced: '경리 업무', note: '명사+명사 유지' },
  { spaced: '주식 시장', note: '명사+명사 유지' },
  { spaced: '미국 정부', note: '명사+명사 유지' },
]);

/** @type {readonly UnifyNoiseCorpusCase[]} */
export const UNIFY_NOISE_REGRESSION_DROP = Object.freeze([
  { spaced: '대부분 공무원', note: '예외 어절(왼쪽)' },
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
