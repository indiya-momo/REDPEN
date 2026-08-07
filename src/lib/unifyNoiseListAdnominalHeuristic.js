/**
 * 띄움 왼쪽 용언 관형형 휴리스틱.
 * source: manual-heuristic — 무한 어간 × 닫힌 관형 어미(는/던/은/된/진/한/낸).
 * harvest로 어간을 다 넣을 수 없고, Kiwi 2차 ready 전 fail-open 창을 메운다.
 *
 * `은`도 관형형(붉은·않은·높은) — 명사 아님 → 후보에서 DROP.
 * `된`(과열된·관련된) — 되다 관형형. 수확 어간 무한 → 닫힌 어미에 포함.
 * `진`(만들어진·깨어진) — 지다 관형형. `사진`·`지진` 오탐 방지를 위해 어간 한글 ≥2.
 * `한`(섬세한·아름다운→한) — 하다 관형형. `대한`·`북한`(어간 1) 제외 → 어간 ≥2.
 *   어간≥2여도 지명·체언 `남북한`은 닫힌 제외(5토큰 합성 남북한경제협력사업 KEEP).
 * `운`(아름다운·새로운) — 답다/롭다 관형형. 어간 ≥2 (`기운` 등 어간1 제외).
 * `낸`(오려낸·알아낸) — 내다 관형형. 어간 ≥2.
 * `난`(드러난·일어난·나타난) — 나다 관형형. 어간 ≥2 (`재난` 어간1 제외).
 * `인`(휩싸인·쌓인…) — 히다/이다 관형. 어간 ≥2 (`개인`·`요인` 어간1 제외).
 * `쓴`(휩쓴·가로쓴…) — 쓸다 관형. 어간 ≥1.
 * `린`(굶주린·시달린) — ㄹ 불규칙 관형. 어간 ≥2 (`어린` 어간1·예외).
 * `른`(게으른·배부른) — 르+ㄴ. 어간 ≥2.
 * `온`(살아온·들어온) — 오다 관형. 어간 ≥2.
 * `픈`(배고픈) — 프+ㄴ. 어간 ≥2 (`바쁜` 어간1·예외).
 * `싼`(헐싼…) — 싸+ㄴ. 어간 ≥2 (`비싼` 어간1·예외).
 * `적인`(직접적인·효과적인) — 적+관형 인. 어간 ≥1 (`적인` 단독 제외는 길이).
 * `스런`(고통스런…) — 스럽다 준말 관형. 어간 ≥1 (`스러운`은 verbalTails).
 * 조사 오탐(`붉`+`은`) 가드는 {@link ./unifyNoiseListLeftHeuristic.js}가 별도로 담당.
 * `가진`·`만한`(종성 ㄴ만)은 시민·북한과 겹쳐 여기 밖 → verbalTails·예외 수확.
 * `-적` 맨꼬리 일반화 금지 — `약탈적`·닫힌 표면만 verbalTails 수확.
 */
import { hangulOnlyNoise } from './unifyNoiseListData.js';

/** 긴 것 우선 */
const ADNOMINAL_TAILS = Object.freeze([
  '적인',
  '스런',
  '던',
  '는',
  '은',
  '된',
  '진',
  '한',
  '운',
  '낸',
  '난',
  '인',
  '쓴',
  '린',
  '른',
  '온',
  '픈',
  '싼',
]);

/** 어간 최소 음절 — 짧은 체언 오탐 방지 */
const ADNOMINAL_TAIL_MIN_STEM = Object.freeze({
  진: 2,
  한: 2,
  운: 2,
  낸: 2,
  난: 2,
  인: 2,
  린: 2,
  른: 2,
  온: 2,
  픈: 2,
  싼: 2,
  쓴: 1,
  적인: 1,
  스런: 1,
});

/**
 * -한 관형 오탐 — 지명·체언 (남북+한 ≠ 하다 관형).
 * @type {ReadonlySet<string>}
 */
const SPACED_ADNOMINAL_HAN_NOUN_EXCLUDE = Object.freeze(
  new Set(['남북한']),
);

/**
 * @param {string} eojeol
 * @returns {boolean}
 */
export function isSpacedLeftAdnominalNoiseEojeol(eojeol) {
  const h = hangulOnlyNoise(eojeol);
  if (!h || h.length < 2) return false;
  if (SPACED_ADNOMINAL_HAN_NOUN_EXCLUDE.has(h)) return false;

  for (const tail of ADNOMINAL_TAILS) {
    if (!h.endsWith(tail)) continue;
    const stem = h.slice(0, -tail.length);
    const stemLen = hangulOnlyNoise(stem).length;
    const minStem = ADNOMINAL_TAIL_MIN_STEM[tail] ?? 1;
    if (stemLen >= minStem) return true;
  }

  return false;
}
