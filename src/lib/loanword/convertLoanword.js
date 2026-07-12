/**
 * 외래어 표기 변환 유스케이스 (파이프라인 총괄).
 *
 * 접수(철자) → 발음 찾기(사전) → 교정(정규화) → 조판(규칙 엔진) → 제본(음절 조합)
 *
 * 사전은 밖에서 주입받는다(의존성 역전). 어떤 사전을 쓰는지는
 * cmuDictionary.js(인프라)가 결정하고, 이 모듈은 변환 논리만 안다.
 */

import { arpabetToTokens, tokensToIpaString } from './arpabet.js';
import { transcribe } from './transcriptionRules.js';
import { assemble } from './hangulAssembler.js';

/**
 * 발음 기호 하나 → 한글 표기 + 근거.
 * @param {string} arpabet 예: "W IH1 L Y AH0 M Z"
 * @param {string} [word] 영어 철자 (철자 참고 조정에 사용)
 */
export function convertPronunciation(arpabet, word) {
  const { tokens, notes } = arpabetToTokens(arpabet, word);
  const { pieces, trace } = transcribe(tokens);
  return {
    arpabet,
    ipa: tokensToIpaString(tokens),
    hangul: assemble(pieces),
    trace,
    notes,
  };
}

/**
 * 영어 단어 → 한글 표기 후보(복수 발음이면 모두).
 * @param {string} word
 * @param {Record<string,string>} dictionary CMU 발음 사전 (word → ARPABET)
 */
export function convertWord(word, dictionary) {
  const key = String(word).trim().toLowerCase();
  if (!key) return { word: key, found: false, results: [] };

  const pronunciations = [];
  if (dictionary[key]) pronunciations.push(dictionary[key]);
  for (let n = 2; dictionary[`${key}(${n})`]; n += 1) {
    pronunciations.push(dictionary[`${key}(${n})`]);
  }

  return {
    word: key,
    found: pronunciations.length > 0,
    results: pronunciations.map((p) => convertPronunciation(p, key)),
  };
}
