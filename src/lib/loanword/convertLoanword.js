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
import { graphemeToArpabet } from './graphemeToArpabet.js';
import { ipaToTokens } from './ipaToTokens.js';
import { lookupYongrye } from './yongryeDictionary.js';

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
 * 발음 사전에 없으면 철자 기반 발음 추정(G2P)으로 폴백한다.
 * @param {string} word
 * @param {Record<string,string>} dictionary CMU 발음 사전 (word → ARPABET)
 * @returns {{word:string, found:boolean, estimated:boolean, results:Array}}
 */
export function convertWord(word, dictionary) {
  const key = String(word).trim().toLowerCase();
  if (!key) return { word: key, found: false, estimated: false, results: [] };

  const pronunciations = [];
  if (dictionary[key]) pronunciations.push(dictionary[key]);
  for (let n = 2; dictionary[`${key}(${n})`]; n += 1) {
    pronunciations.push(dictionary[`${key}(${n})`]);
  }

  if (pronunciations.length > 0) {
    return {
      word: key,
      found: true,
      estimated: false,
      results: pronunciations.map((p) => convertPronunciation(p, key)),
    };
  }

  // 사전 미등재 → 철자 기반 발음 추정 (결과는 반드시 "추정" 표시)
  const guessed = graphemeToArpabet(key);
  if (!guessed) return { word: key, found: false, estimated: false, results: [] };
  return {
    word: key,
    found: true,
    estimated: true,
    results: [convertPronunciation(guessed, key)],
  };
}

/**
 * 비동기 변환: 사전 미등재 단어는 외부 발음 추정기(eSpeak-NG 등)를 먼저
 * 시도하고, 없거나 실패하면 자체 철자 추정(convertWord의 폴백)을 쓴다.
 * @param {string} word
 * @param {Record<string,string>} dictionary CMU 발음 사전
 * @param {(w:string)=>Promise<string|null>} [ipaProvider] IPA 발음 추정기
 */
export async function convertWordAsync(word, dictionary, ipaProvider = null) {
  const sync = convertWord(word, dictionary);
  if (!sync.estimated || !ipaProvider) return sync; // 사전에 있으면 그대로
  const ipa = await Promise.resolve(ipaProvider(sync.word)).catch(() => null);
  if (!ipa) return sync;
  const { tokens, notes } = ipaToTokens(ipa, sync.word);
  if (tokens.length === 0) return sync;
  const { pieces, trace } = transcribe(tokens);
  return {
    word: sync.word,
    found: true,
    estimated: true,
    results: [{
      arpabet: ipa,
      ipa: tokensToIpaString(tokens),
      hangul: assemble(pieces),
      trace,
      notes: ['발음 추정: eSpeak-NG 음성 엔진 (영국식)', ...notes],
    }],
  };
}

/** 캐스케이드에서 단어 하나의 대표 표기를 고른다 (용례집 → 엔진) */
function pickWordRepresentation(part, engine, yongrye) {
  const official = yongrye ? lookupYongrye(part, yongrye) : [];
  let hangul = '?';
  let source = 'none'; // 'yongrye' | 'dict' | 'g2p' | 'none'
  let officialForms = [];

  if (official.length > 0) {
    const counts = new Map();
    for (const e of official) counts.set(e.h, (counts.get(e.h) ?? 0) + 1);
    officialForms = [...counts.keys()];
    hangul = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
    source = 'yongrye';
  } else if (engine.found) {
    hangul = engine.results[0].hangul;
    source = engine.estimated ? 'g2p' : 'dict';
  }
  return { word: part, hangul, source, officialForms, engine };
}

/**
 * 여러 단어(공백·하이픈 구분) → 단어별 변환 후 이어 붙임.
 * 제10항 2: 원어에서 띄어 쓴 말은 띄어 쓴 대로 적는다.
 *
 * 단어마다 3단 캐스케이드로 대표 표기를 정한다:
 *   ① 용례집 등재 표기(공식 심의)  ② 발음 사전+규정 엔진  ③ 철자 추정+규정 엔진
 * (kings club → 용례집의 킹스 + 클럽 = "킹스 클럽". 용례집에 없는 단어만
 *  규정 엔진 결과로 채운다.)
 *
 * @param {string} phrase
 * @param {Record<string,string>} dictionary CMU 발음 사전
 * @param {Record<string,Array>|null} [yongrye] 용례집 (없으면 규정 엔진만 사용)
 */
export function convertPhrase(phrase, dictionary, yongrye = null) {
  const parts = String(phrase).trim().split(/[\s-]+/).filter(Boolean);
  const words = parts.map((part) =>
    pickWordRepresentation(part, convertWord(part, dictionary), yongrye),
  );
  return {
    phrase: parts.join(' '),
    found: words.some((w) => w.source !== 'none'),
    estimated: words.some((w) => w.source === 'g2p'),
    hangul: words.map((w) => w.hangul).join(' '),
    words,
  };
}

/** convertPhrase의 비동기판 — 미등재 단어에 외부 발음 추정기를 사용 */
export async function convertPhraseAsync(phrase, dictionary, yongrye = null, ipaProvider = null) {
  const parts = String(phrase).trim().split(/[\s-]+/).filter(Boolean);
  const words = await Promise.all(
    parts.map(async (part) =>
      pickWordRepresentation(part, await convertWordAsync(part, dictionary, ipaProvider), yongrye),
    ),
  );
  return {
    phrase: parts.join(' '),
    found: words.some((w) => w.source !== 'none'),
    estimated: words.some((w) => w.source === 'g2p'),
    hangul: words.map((w) => w.hangul).join(' '),
    words,
  };
}
