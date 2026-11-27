/**
 * 한글 맞춤법 제2항 — 사전에 없는 명사+위치 명사 붙임은 띄어 쓴다.
 * 띄어쓰기 폴더 findHits만. ruleEngine·시트 핫패스에 붙이지 않는다.
 *
 * 범위는 위치 명사(위·아래·앞·뒤·안·밖·옆·속·밑)로 한정한다.
 * 붙여 쓴 전체가 표준국어대사전 표제어이면 침묵(눈앞·손위).
 * 앞말이 명사(의존명사·대명사 제외)이고 두 음절 이상일 때만 제안한다.
 * 색인이 없으면 내지 않는다(fail-closed).
 */

import {
  lookupStdictPosHits,
  stdictPosIndexBareKeyCount,
} from './stdictPosIndex.js';

export const UNLISTED_POS_NOUN_LABEL =
  '사전에 등재되지 않은 명사+명사 (맞춤법 제2항)';
export const UNLISTED_POS_NOUN_TIP =
  '한글 맞춤법 제2항: 사전에 없는 명사+위치 명사(위·아래·앞·뒤·안·밖·옆·속·밑)는 띄어 씀. 표준국어대사전 표제어(눈앞·손위·윗사람)는 잡지 않음.';

/** 긴 위치 명사 우선. */
const POS_NOUNS = Object.freeze(['아래', '위', '앞', '뒤', '안', '밖', '옆', '속', '밑']);

/**
 * 어절 끝 조사 하나. 긴 것 우선.
 * 이다·요·들·나처럼 어미·접사와 겹치는 것은 넣지 않는다.
 * @type {readonly string[]}
 */
const CASE_PARTICLES = Object.freeze(
  [
    '에서부터',
    '으로부터',
    '에게서는',
    '한테서는',
    '으로서',
    '으로써',
    '에서는',
    '에서도',
    '에서만',
    '으로는',
    '으로도',
    '에게서',
    '한테서',
    '까지도',
    '에서',
    '에도',
    '에만',
    '에게',
    '한테',
    '으로',
    '로서',
    '로써',
    '부터',
    '까지',
    '처럼',
    '만큼',
    '보다',
    '대로',
    '마저',
    '조차',
    '밖에',
    '마다',
    '이나',
    '이랑',
    '하고',
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
    '께',
    '로',
  ].sort((a, b) => b.length - a.length || a.localeCompare(b, 'ko')),
);

const HANGUL_RUN = /[\uAC00-\uD7A3]+/g;

/** 위치 명사 1음절 + 앞 명사 2음절. 「아래」는 2음절이라 더 길다. */
const MIN_STEM = 3;

/**
 * @param {string} bare
 * @returns {boolean}
 */
function isHeadword(bare) {
  return lookupStdictPosHits(bare).length > 0;
}

/**
 * 일반 명사·고유 명사. 의존명사·대명사만 있는 경우는 아니다.
 * @param {string} bare
 * @returns {boolean}
 */
function isCommonNoun(bare) {
  return lookupStdictPosHits(bare).some((hit) => {
    const pos = String(hit?.pos ?? '');
    return pos.includes('명사') && !pos.includes('의존') && !pos.includes('대명사');
  });
}

/**
 * @param {string} stem
 * @returns {string}
 */
function positionNounEnding(stem) {
  return POS_NOUNS.find((noun) => stem.endsWith(noun) && stem.length > noun.length) ?? '';
}

/**
 * @param {string} eojeol
 * @returns {{ matchedText: string, suggestedText: string } | 'registered' | null}
 */
function suggestPosNounSplit(eojeol) {
  const word = String(eojeol ?? '').normalize('NFC');
  if (word.length < MIN_STEM) return null;

  /** @type {string[]} */
  const particles = [''];
  for (const particle of CASE_PARTICLES) {
    if (word.length >= particle.length + MIN_STEM && word.endsWith(particle)) {
      particles.push(particle);
    }
  }
  // 긴 조사부터. 빈 조사(붙임 전체)는 맨 뒤.
  particles.sort((a, b) => b.length - a.length);

  for (const particle of particles) {
    const stem = particle ? word.slice(0, -particle.length) : word;
    const posNoun = positionNounEnding(stem);
    if (!posNoun) continue;
    if (isHeadword(stem)) return 'registered';
    const left = stem.slice(0, -posNoun.length);
    if (left.length < 2) continue;
    if (!isCommonNoun(left)) continue;
    const suggested = `${left} ${posNoun}${particle}`;
    if (suggested === word) continue;
    return { matchedText: word, suggestedText: suggested };
  }
  return null;
}

/**
 * @param {string} text
 * @returns {{ index: number, matchedText: string, suggestedText: string }[]}
 */
export function findUnlistedPosNounSpacingHits(text) {
  if (!text || stdictPosIndexBareKeyCount() === 0) return [];
  /** @type {{ index: number, matchedText: string, suggestedText: string }[]} */
  const hits = [];
  HANGUL_RUN.lastIndex = 0;
  let match;
  while ((match = HANGUL_RUN.exec(text)) !== null) {
    const decided = suggestPosNounSplit(match[0]);
    if (!decided || decided === 'registered') continue;
    hits.push({
      index: match.index,
      matchedText: decided.matchedText,
      suggestedText: decided.suggestedText,
    });
  }
  return hits;
}
