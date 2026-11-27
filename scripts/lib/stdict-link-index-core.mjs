/**
 * 표준국어대사전 링크 색인 — 순수 로직(파일 읽기·쓰기 없음).
 *
 * 1) 규칙 행 → 결과 카드가 내는 고칠 말(교정형) 목록
 *    카드와 같은 함수(resolveSpellingVariant / resolveSpellingLabelPair)를 그대로 쓴다.
 * 2) 사전 표제어 → 색인 키 (숫자·'-' 제거, 띄어 쓴 구(^ 포함)는 제외)
 *
 * 출처: 국립국어원 표준국어대사전 (CC BY-SA 2.0 KR)
 */

import {
  hasSpellingFindReplaces,
  isSpellingCategoryLabelRule,
  normalizeFindReplaces,
  resolveSpellingLabelPair,
  resolveSpellingVariant,
} from '../../src/lib/spellingFindReplaces.js';

/** 링크를 붙일 규칙 묶음(시트 dividerLabel 접두) */
export const DICT_BUNDLE_PREFIX = '표준국어대사전 등재';

/**
 * 시트 행 → 카드 판정용 규칙 (src/lib/builtInRules.js builtInRuleFromRow와 같은 규칙)
 * @param {Record<string, any>} row
 */
export function ruleFromRow(row) {
  const finds =
    row.finds?.filter((f) => String(f ?? '').trim()).length >= 2
      ? row.finds.map((f) => String(f).trim())
      : undefined;
  const displayLabel = String(row.displayLabel ?? '').trim() || undefined;
  const findReplaces = finds ? normalizeFindReplaces(row.findReplaces, finds) : undefined;
  return {
    find: row.find,
    replace: row.replace,
    builtIn: true,
    ...(finds ? { finds } : {}),
    ...(findReplaces ? { findReplaces } : {}),
    ...(displayLabel ? { displayLabel } : {}),
  };
}

/** @param {Record<string, any>} row */
export function isDictBundleRow(row) {
  return String(row.dividerLabel ?? '').startsWith(DICT_BUNDLE_PREFIX);
}

/**
 * 규칙 한 행이 결과 카드에 낼 수 있는 (찾은 말 → 고칠 말) 쌍.
 * @param {Record<string, any>} row
 * @returns {{ find: string, replace: string }[]}
 */
export function cardPairsOfRow(row) {
  const rule = ruleFromRow(row);
  const forms = rule.finds ?? [String(rule.find ?? '').trim()].filter(Boolean);
  /** @type {{ find: string, replace: string }[]} */
  const out = [];
  for (const find of forms) {
    const viaVariant = hasSpellingFindReplaces(rule) ? resolveSpellingVariant(rule, find) : null;
    const viaLabel = !viaVariant && isSpellingCategoryLabelRule(rule)
      ? resolveSpellingLabelPair(rule, find)
      : null;
    const replace = viaVariant?.replace ?? viaLabel?.replace ?? String(rule.replace ?? '').trim();
    if (replace) out.push({ find, replace });
  }
  return out;
}

/**
 * 용언 활용형의 형태소 분석 결과 → 사전형(기본형) 후보.
 * 마지막 용언 어간 태그(VV·VA·XSV·XSA)까지 이어 붙이고 「다」를 붙인다.
 * 보조 용언(VX)은 본용언을 가리므로 제외한다. 예: 부끄러워하(VV)+었(EP) → 부끄러워하다.
 * @param {{ str: string, tag: string }[]} tokens
 * @returns {string | null}
 */
export function lemmaFromTokens(tokens) {
  const PREDICATE_TAGS = new Set(['VV', 'VA', 'XSV', 'XSA']);
  let end = -1;
  tokens.forEach((t, i) => {
    if (PREDICATE_TAGS.has(t.tag)) end = i;
  });
  if (end < 0) return null;
  return `${tokens.slice(0, end + 1).map((t) => t.str).join('')}다`;
}

/** 사전 품사가 용언인지(동사·형용사·보조 동사·보조 형용사). 「품사 없음」은 아니다. */
export function isPredicatePos(pos) {
  return /동사|형용사/.test(String(pos ?? ''));
}

/**
 * 용언 교정형을 사전에서 직접 찾는 단계. 앞에서부터, 용언 후보가 있는 첫 단계만 쓴다.
 * 형태소 분석은 이 단계가 모두 실패할 때만 쓴다.
 * 1. 교정형+다 (가닿 → 가닿다)
 * 2. 했/한/할은 끝 글자를 하로 바꿔 다 (외로워했 → 외로워하다). 된/될/됨은 되다 (오래된 → 오래되다)
 * 3. 교정형+하다 (그럴싸 → 그럴싸하다)
 * @param {string} surface
 * @returns {{ stage: 'direct' | 'ending' | 'hada', key: string, note: string }[]}
 */
export function directLemmaStages(surface) {
  /** @type {{ stage: 'direct' | 'ending' | 'hada', key: string, note: string }[]} */
  const stages = [{ stage: 'direct', key: `${surface}다`, note: '+다' }];
  const last = surface.slice(-1);
  if (last === '했' || last === '한' || last === '할') {
    stages.push({ stage: 'ending', key: `${surface.slice(0, -1)}하다`, note: `${last}→하다` });
  } else if (last === '된' || last === '될' || last === '됨') {
    stages.push({ stage: 'ending', key: `${surface.slice(0, -1)}되다`, note: `${last}→되다` });
  }
  stages.push({ stage: 'hada', key: `${surface}하다`, note: '+하다' });
  const seen = new Set();
  return stages.filter((s) => (seen.has(s.key) ? false : seen.add(s.key)));
}

/**
 * 사전형이 교정형과 앞부분을 공유하는지(오분석 점검용). 앞 두 글자가 다르면 false.
 * @param {string} surface
 * @param {string} lemma
 */
export function sharesLeadingChars(surface, lemma) {
  const n = Math.min(2, surface.length, lemma.length);
  return surface.slice(0, n) === lemma.slice(0, n);
}

/**
 * 사전 표제어 → 색인 키. 숫자(동음이의 번호)와 '-'(음절 구분)를 뺀다.
 * '^'(띄어 쓰는 구)·공백이 남으면 단어가 아니므로 null.
 * @param {string} word
 * @returns {string | null}
 */
export function dictHeadwordKey(word) {
  const key = String(word ?? '').normalize('NFC').replace(/[\d-]/g, '');
  if (!key || /[\s^]/.test(key)) return null;
  return key;
}

/**
 * 동음이의가 여러 개일 때, 그 띄어쓰기 규칙 묶음에 맞는 표제어 하나.
 * 검색으로 여러 뜻을 보여 주지 않고 이 번호로 직결한다.
 * (표준국어대사전 2026-11-06 target_code)
 */
export const NOUN_DIRECT_WORD_NO = {
  경제권: 21152, // 경제-권01 경제 활동 범위. 경제^
  도중: 413054, // 도중04 길을 가는 중간. ^중
  암중: 221831, // 암중02 어두운 속. ^중
  이편: 469628, // 이-편01 지시 대명사. 이 편
  감색: 3336, // 감-색01 감의 빛깔. ^색
  곤색: 27388, // 곤-색01 → 감색02. ^색
  대자색: 81276, // 대자-색01 대자석 빛. ^색
  무색: 122583, // 무색02 아무 빛깔이 없음. ^색
  물색: 124765, // 물-색01 물의 빛깔. ^색
  재색: 477354, // 재-색01 재의 빛깔. ^색
  통색: 347663, // 통-색01 한 색깔이 걸치는 인쇄. ^색
  호박색: 517489, // 호박-색01 늙은 호박 빛. ^색
  겹소리: 17574, // 겹-소리01 처음과 끝이 다른 소리. ^소리
  선소리: 178008, // 선-소리01 이치에 맞지 않은 서툰 말. ^소리
  신소리: 453792, // 신-소리01 신을 끌 때 나는 소리. ^소리
  우렛소리: 464908, // 우렛-소리01 천둥. ^소리
  큰소리: 496819, // 큰-소리01 야단치는 소리. ^소리
  홀소리: 374715, // 홀-소리01 모음. ^소리
  애저녁: 225694, // 애저녁02 → 초저녁. ^저녁
};

/**
 * 명사·대명사 후보 목록에서 직결할 target_code[].
 * 고른 번호가 후보에 있으면 그것만, 없으면 후보 전부를 그대로 둔다.
 * @param {string} surface
 * @param {{ code: number }[] | number[] | undefined} found
 * @returns {number[]}
 */
export function pickNounCodes(surface, found) {
  const codes = [
    ...new Set(
      (found ?? []).map((h) => (typeof h === 'number' ? h : h.code)).filter(Number.isFinite),
    ),
  ].sort((a, b) => a - b);
  const pick = NOUN_DIRECT_WORD_NO[surface];
  if (pick != null && codes.includes(pick)) return [pick];
  return codes;
}
