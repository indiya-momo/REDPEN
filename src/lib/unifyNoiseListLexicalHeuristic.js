/**
 * 띄움 어절 — 닫힌 접속·닫힌 부사(태도)·부사 파생(-히/-게) 휴리스틱 (좌우 공통).
 * source: manual-heuristic — Kiwi: MAJ/접속·MAG.
 * -히/-게는 생산 패턴 → 끝음절 매칭. -게 명사(가게·집게)만 닫힌 제외.
 * 구(句)「뿐만 아니라」「다시 말해」는 어절 단위만 (아니라·다시는 접속 Set).
 * 짧은 형태(또·단·즉·그럼…)·닫힌 부사는 완전 일치만 — 관형사·대명사는 예외 JSON 유지.
 */
import { hangulOnlyNoise } from './unifyNoiseListData.js';

/**
 * 편집기 1차 예외 후보와 동일 계열 — 기능별 닫힌 접속·담화 표지.
 * (완전 일치, 띄움 좌우)
 */
const SPACED_CLOSED_CONJUNCTION_LIST = Object.freeze([
  // 순접·나열
  '그리고',
  '또',
  '또한',
  '아울러',
  '더불어',
  '게다가',
  // 역접·대조
  '그러나',
  '하지만',
  '그렇지만',
  '그런데',
  '반면',
  '반면에',
  '오히려',
  '도리어',
  // 인과
  '그래서',
  '그래야',
  '그래도',
  '그러므로',
  '따라서',
  '그러니까',
  '그러니',
  '왜냐하면',
  // 조건·가정
  '그러면',
  '그렇다면',
  '그럼',
  '설령',
  '설사',
  '가령',
  '아니면',
  // 전환
  '한편',
  '다음으로',
  '아무튼',
  '어쨌든',
  '여하튼',
  '하여튼',
  // 첨가·보충 (「뿐만 아니라」→ 뿐만; 아니라=예외 JSON)
  '더구나',
  '뿐만',
  '특히',
  '다만',
  '단',
  // 요약·결론 (「다시 말해」→ 다시=예외 MAG)
  '결국',
  '요컨대',
  '즉',
  '말하자면',
  // 시간·순서
  '이어서',
  '그다음',
  '이후',
  '먼저',
  '우선',
  // 담화·부사성 (예외 JSON에서 이관 — 완전일치)
  '역시',
  '이미',
  '바로',
  '만약',
  '물론',
  '함께',
  '직접',
  '계속',
  '다시',
  '그냥',
  '그저',
  '따로',
  '달리',
  '과연',
  '사실',
  '실제',
  '아니',
]);

/** @type {ReadonlySet<string>} */
export const SPACED_CLOSED_CONJUNCTIONS = Object.freeze(
  new Set(SPACED_CLOSED_CONJUNCTION_LIST),
);

/**
 * -게로 끝나지만 부사가 아닌 명사 (닫힌 제외).
 * `단계`·`세계` 등은 끝음절이 `계`라 본 휴리스틱에 안 걸림.
 * @type {ReadonlySet<string>}
 */
export const SPACED_ADVERB_GE_NOUN_EXCLUDE = Object.freeze(
  new Set(['가게', '집게']),
);

/**
 * @param {string} eojeol
 */
export function isSpacedClosedConjunctionNoiseEojeol(eojeol) {
  const h = hangulOnlyNoise(eojeol);
  return Boolean(h) && SPACED_CLOSED_CONJUNCTIONS.has(h);
}

/**
 * 붙임키 = (닫힌 접속·담화) + (한글 2음절+).
 * 예외 접두와 동일 — `그냥시장`·`물론기업`이 예외→접속 이관 후에도 DROP.
 * source: manual-heuristic
 * @param {string} eojeolOrKey
 */
export function matchesClosedConjunctionPlusNounPrefix(eojeolOrKey) {
  const h = hangulOnlyNoise(eojeolOrKey);
  if (h.length < 4) return false;
  const conjs = [...SPACED_CLOSED_CONJUNCTION_LIST].toSorted(
    (a, b) => b.length - a.length || a.localeCompare(b, 'ko'),
  );
  for (const conj of conjs) {
    if (conj.length < 2 || h.length <= conj.length) continue;
    if (!h.startsWith(conj)) continue;
    if (hangulOnlyNoise(h.slice(conj.length)).length >= 2) return true;
  }
  return false;
}

/**
 * 닫힌 부사 — 문장 연결·태도·시점 표지만 (완전 일치).
 * 관형사(모든·이런)·대명(우리·이번)·수량(일부)은 예외 JSON에 둔다.
 * source: manual-heuristic — Kiwi: MAG
 */
const SPACED_CLOSED_ADVERB_LIST = Object.freeze([
  // 태도·평가
  '주로',
  '정작',
  '이른바',
  '꽤나',
  // 문장 연결·결과
  '이로써',
  // 시점·지속 (명사복합 드묾)
  '앞서',
  '지금',
  '현재',
  '줄곧',
  '즉시',
]);

/** @type {ReadonlySet<string>} */
export const SPACED_CLOSED_ADVERBS = Object.freeze(
  new Set(SPACED_CLOSED_ADVERB_LIST),
);

/**
 * @param {string} eojeol
 */
export function isSpacedClosedAdverbNoiseEojeol(eojeol) {
  const h = hangulOnlyNoise(eojeol);
  return Boolean(h) && SPACED_CLOSED_ADVERBS.has(h);
}

/**
 * 붙임키 = (닫힌 부사) + (한글 2음절+). `주로시장`·`앞서시장`.
 * source: manual-heuristic
 * @param {string} eojeolOrKey
 */
export function matchesClosedAdverbPlusNounPrefix(eojeolOrKey) {
  const h = hangulOnlyNoise(eojeolOrKey);
  if (h.length < 4) return false;
  const advs = [...SPACED_CLOSED_ADVERB_LIST].toSorted(
    (a, b) => b.length - a.length || a.localeCompare(b, 'ko'),
  );
  for (const adv of advs) {
    if (adv.length < 2 || h.length <= adv.length) continue;
    if (!h.startsWith(adv)) continue;
    if (hangulOnlyNoise(h.slice(adv.length)).length >= 2) return true;
  }
  return false;
}

/**
 * 존재·부정 용언 종결 완전일치 (없다·있다·아니다 금융).
 * source: manual-heuristic — 생산 꼬리(-다)는 명사 오탐이 커서 닫힌 집합만.
 */
const SPACED_CLOSED_VERBAL_EOJEOL_LIST = Object.freeze([
  '없다',
  '있다',
  '아니다',
  '된다',
  '같다',
]);

/** @type {ReadonlySet<string>} */
export const SPACED_CLOSED_VERBAL_EOJEOLS = Object.freeze(
  new Set(SPACED_CLOSED_VERBAL_EOJEOL_LIST),
);

/**
 * @param {string} eojeol
 */
export function isSpacedClosedVerbalNoiseEojeol(eojeol) {
  const h = hangulOnlyNoise(eojeol);
  return Boolean(h) && SPACED_CLOSED_VERBAL_EOJEOLS.has(h);
}

/**
 * 부사 파생 -히 (꾸준히·신속히·간단히…).
 * 한글 2음절 이상 + 끝음절 히.
 * @param {string} eojeol
 */
export function isSpacedAdverbHiNoiseEojeol(eojeol) {
  const h = hangulOnlyNoise(eojeol);
  if (!h || h.length < 2) return false;
  return h.endsWith('히');
}

/**
 * 부사 파생 -게 (쉽게·빠르게…).
 * source: manual-heuristic — 한글 2음절 이상 + 끝음절 게.
 * 명사 가게·집게만 제외 (`단계`는 계).
 * @param {string} eojeol
 */
export function isSpacedAdverbGeNoiseEojeol(eojeol) {
  const h = hangulOnlyNoise(eojeol);
  if (!h || h.length < 2) return false;
  if (!h.endsWith('게')) return false;
  return !SPACED_ADVERB_GE_NOUN_EXCLUDE.has(h);
}

/** 용언 연결·종결 꼬리 (낮았고·오르면서·않았다·터지자·않는다·없으면·떠들어댔다…) */
const SPACED_VERBAL_CONNECTIVE_TAILS = Object.freeze(
  [
    '았고',
    '었고',
    '였고',
    '으면서',
    '면서',
    '으면',
    '으며',
    '았다',
    '었다',
    '였다',
    '렸다',
    '랐다',
    '왔다',
    '댔다',
    '는다',
    '든다',
    '겠다',
    '는데',
    '을까',
    '일까',
    '면',
    '며',
    '고',
    '자',
  ].toSorted((a, b) => b.length - a.length),
);

/** 꼬리별 최소 어간 — `자`·`고`·`면`·`며`는 투자·사고·화면·며느리 등 명사 오탐 방지 */
const SPACED_VERBAL_CONNECTIVE_MIN_STEM = Object.freeze({
  자: 2,
  고: 2,
  면: 2,
  며: 2,
});

/**
 * 용언 연결·종결형 꼬리 (낮았고 투자·않았다 투자·터지자 투자).
 * source: manual-heuristic
 * @param {string} eojeol
 */
export function isSpacedVerbalConnectiveNoiseEojeol(eojeol) {
  const h = hangulOnlyNoise(eojeol);
  if (!h || h.length < 2) return false;
  for (const tail of SPACED_VERBAL_CONNECTIVE_TAILS) {
    if (!h.endsWith(tail)) continue;
    // OCR·단독 어미 조각(는다·었고) — 완전일치도 DROP
    if (h.length === tail.length) return true;
    const stemLen = hangulOnlyNoise(h.slice(0, -tail.length)).length;
    const minStem = SPACED_VERBAL_CONNECTIVE_MIN_STEM[tail] ?? 1;
    if (stemLen >= minStem) return true;
  }
  return false;
}

/**
 * 의존 접미 짜리 (년짜리·만원짜리).
 * source: manual-heuristic
 * @param {string} eojeol
 */
export function isSpacedDependentSuffixNoiseEojeol(eojeol) {
  const h = hangulOnlyNoise(eojeol);
  if (!h || !h.endsWith('짜리')) return false;
  return hangulOnlyNoise(h.slice(0, -2)).length >= 1;
}

/**
 * 서수 접미 -째 (첫째·일곱째·스물한째·며칠째…).
 * source: manual-heuristic — Kiwi: NR | NR+XSN(째) | MM+XSN(째).
 * 생산적이라 예외 JSON 나열 대신 끝음절 매칭. 시트/`--add`로 보완·KEEP 가능.
 * @param {string} eojeol
 */
export function isSpacedOrdinalNoiseEojeol(eojeol) {
  const h = hangulOnlyNoise(eojeol);
  if (!h || h.length < 2) return false;
  if (!h.endsWith('째')) return false;
  return hangulOnlyNoise(h.slice(0, -1)).length >= 1;
}

/**
 * 용언 연결·종결 + 닫힌 용언(있다·없다…) — Surface/어절 공통.
 * @param {string} eojeol
 */
export function isSpacedVerbalLikeNoiseEojeol(eojeol) {
  return (
    isSpacedVerbalConnectiveNoiseEojeol(eojeol) ||
    isSpacedClosedVerbalNoiseEojeol(eojeol)
  );
}

/**
 * 붙임키 = (용언 연결·닫힌 용언 왼쪽) + (한글 2음절+ 오른쪽).
 * JSON verbalTail 이관용 — `떨어뜨리고시장`·`가치있다고시장`.
 * @param {string} eojeolOrKey
 */
export function matchesVerbalLikePlusNounInfix(eojeolOrKey) {
  const h = hangulOnlyNoise(eojeolOrKey);
  if (h.length < 4) return false;
  for (let split = 2; split <= h.length - 2; split += 1) {
    const left = h.slice(0, split);
    const right = h.slice(split);
    if (right.length < 2) continue;
    if (isSpacedVerbalLikeNoiseEojeol(left)) return true;
  }
  return false;
}
