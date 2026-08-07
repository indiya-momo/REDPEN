/**
 * 띄움 짧은 체언+조사 휴리스틱 (좌우 공통).
 * source: manual-heuristic — 수확(꼬리 JSON)만으로는 내가·등이 형태를 못 닫음.
 * 관형형(붉은) 오탐 방지를 위해 은/는은 대명사 어간만.
 *
 * 처소·여격(에/에서/에게): Kiwi 프로브상 N*+JKB (앞에·곳에서·금융에·캐나다에).
 * 선택·열거(이든)·양보(라도/이라도): JC 계열 — 어간 길이 무제한.
 * 관형격(의)·접속(와/과)·선택(나): 어간 2음절 이상 (아시아의·규제와; 거의·사과 1음절 제외).
 * 선택(이나)·조건(라면/이라면)·한정(만이): 라면은 어간≥2(신라면 제외), 이라면·만이는 무제한·≥2.
 * 격조사(이/가/을/를)·보조사(도/만): 어간 길이 무제한 (내가·주식시장이·부문도).
 * 수단·방향(으로): 무제한. 로(모음어간): 어간 ≥2 (속도로; 경로·자료 1음절 제외).
 *
 * discover가 unifyNoiseList.js를 import하면 순환이 나서 분리.
 */
import {
  hangulOnlyNoise,
  UNIFY_NOISE_EXCEPTION_EOJEOLS,
} from './unifyNoiseListData.js';

const SPACED_LEFT_SHORT_JOSA = Object.freeze(
  [
    '에서',
    '에게',
    '으로',
    '이라면',
    '이라도',
    '이나',
    '이든',
    '든',
    '만이',
    '라면',
    '라도',
    '은',
    '는',
    '이',
    '가',
    '을',
    '를',
    '의',
    '에',
    '와',
    '과',
    '도',
    '만',
    '나',
    '로',
  ].toSorted((a, b) => b.length - a.length || a.localeCompare(b, 'ko')),
);
/** 처소·여격·선택·양보·조건·격조사·보조사(도/만)·으로 — 어간 길이 무제한 */
const SPACED_LEFT_UNLIMITED_STEM_JOSA = new Set([
  '에',
  '에서',
  '에게',
  '으로',
  '이든',
  '이라면',
  '이라도',
  '이나',
  '라도',
  '만이',
  '이',
  '가',
  '을',
  '를',
  '도',
  '만',
]);
/** 관형격·접속·선택(나)·조건(라면)·로·든(모음어간 이든) — 어간 2음절 이상 */
const SPACED_LEFT_MIN2_STEM_JOSA = new Set([
  '의',
  '와',
  '과',
  '나',
  '라면',
  '로',
  '든',
]);
const SPACED_LEFT_TOPIC_JOSA = new Set(['은', '는']);
const SPACED_LEFT_PRONOUN_STEMS = new Set(['나', '너', '저', '그', '이']);

/**
 * @param {string} eojeol
 */
export function isSpacedLeftJosaNoiseEojeol(eojeol) {
  const h = hangulOnlyNoise(eojeol);
  if (!h) return false;
  // 띄움 칸 단독 조사·접속 (기업 이든)
  if (
    h === '이든' ||
    h === '라도' ||
    h === '이라도' ||
    h === '이나' ||
    h === '이라면' ||
    h === '라면' ||
    h === '만이'
  ) {
    return true;
  }
  for (const josa of SPACED_LEFT_SHORT_JOSA) {
    if (!h.endsWith(josa) || h.length <= josa.length) continue;
    const stem = h.slice(0, -josa.length);
    const n = hangulOnlyNoise(stem).length;
    if (n < 1) continue;
    // 대부분+의 — 예외 어절은 길이 제한 없이
    if (UNIFY_NOISE_EXCEPTION_EOJEOLS.has(stem)) return true;
    // 처소·여격·격조사·도/만·으로·이든·라도 — 음절 수와 무관
    if (SPACED_LEFT_UNLIMITED_STEM_JOSA.has(josa)) return true;
    // 의·와·과·로 — 2음절 이상 (거의·사과·경로 1음절 어간 오탐 방지)
    if (SPACED_LEFT_MIN2_STEM_JOSA.has(josa) && n >= 2) return true;
    if (n > 2) continue;
    if (
      SPACED_LEFT_TOPIC_JOSA.has(josa) &&
      n === 1 &&
      SPACED_LEFT_PRONOUN_STEMS.has(stem)
    ) {
      return true;
    }
  }
  return false;
}
