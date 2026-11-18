/**
 * 한글 맞춤법 제44항 — 한글로 적은 수는 만(억·조) 단위로만 띄어 쓴다.
 * 같은 만 단위 묶음 안의 띄어쓰기만 붙임으로 제안한다.
 * 맞춤법 엔진·시트를 부르지 않는다.
 */

/** @typedef {'수사'} NumeralSpacingCategory */

export const NUMERAL_SPACING_CATEGORY = '수사';
export const NUMERAL_SPACING_LABEL = '수사 띄어쓰기';
export const NUMERAL_SPACING_TIP =
  '한글 맞춤법 제44항: 수는 만 단위로 띄어 씁니다.';

const DIGITS = new Set(['일', '이', '삼', '사', '오', '육', '칠', '팔', '구']);
const SMALL_UNITS = ['천', '백', '십'];
const BIG_RANK = { 만: 1, 억: 2, 조: 3 };
const SPACE = new Set([' ', '\u00A0', '\u3000']);

/**
 * @param {string} text
 * @param {number} index
 * @returns {{ rank: number, end: number } | null}
 */
function readChunk(text, index) {
  const len = text.length;
  let i = index;
  let saw = false;

  for (const unit of SMALL_UNITS) {
    const mark = i;
    if (i < len && DIGITS.has(text[i])) i += 1;
    if (i < len && text[i] === unit) {
      i += 1;
      saw = true;
    } else {
      i = mark;
    }
  }

  if (i < len && DIGITS.has(text[i])) {
    i += 1;
    saw = true;
  }

  let rank = 0;
  const big = BIG_RANK[text[i]];
  if (big) {
    i += 1;
    rank = big;
    saw = true;
  }

  if (!saw || i === index) return null;
  return { rank, end: i };
}

/** @param {string} token */
function parseChunk(token) {
  const chunk = readChunk(token, 0);
  if (!chunk || chunk.end !== token.length) return null;
  return chunk;
}

/** @param {string} text */
export function isWellFormedNumeral(text) {
  if (!text) return false;
  let i = 0;
  let lastRank = 4;
  while (i < text.length) {
    const chunk = readChunk(text, i);
    if (!chunk || chunk.rank >= lastRank) return false;
    lastRank = chunk.rank;
    i = chunk.end;
    if (chunk.rank === 0 && i < text.length) return false;
  }
  return i === text.length;
}

/** @param {string} ch */
function isHangulSyllable(ch) {
  return ch >= '가' && ch <= '힣';
}

/**
 * @param {string} text
 * @param {{ word: string, index: number, rank: number }[]} tokens
 * @returns {{ index: number, matchedText: string, suggestedText: string } | null}
 */
function evaluateRun(text, tokens) {
  if (tokens.length < 2) return null;
  if (tokens[0].word === '이') return null;

  const joined = tokens.map((token) => token.word).join('');
  if (!isWellFormedNumeral(joined)) return null;

  let suggested = tokens[0].word;
  let changed = false;
  for (let i = 1; i < tokens.length; i += 1) {
    const prev = tokens[i - 1];
    const curr = tokens[i];
    if (prev.rank > curr.rank) {
      suggested += ` ${curr.word}`;
    } else {
      suggested += curr.word;
      changed = true;
    }
  }
  if (!changed) return null;

  const index = tokens[0].index;
  const end =
    tokens[tokens.length - 1].index + tokens[tokens.length - 1].word.length;
  return {
    index,
    matchedText: text.slice(index, end),
    suggestedText: suggested,
  };
}

/**
 * @param {{ word: string, index: number, rank: number }[]} tokens
 * @param {string} text
 */
function hitsInTokenRun(text, tokens) {
  /** @type {{ index: number, matchedText: string, suggestedText: string }[]} */
  const hits = [];
  let i = 0;
  while (i < tokens.length) {
    /** @type {{ index: number, matchedText: string, suggestedText: string } | null} */
    let chosen = null;
    let chosenEnd = i;
    for (let end = tokens.length; end >= i + 2; end -= 1) {
      const hit = evaluateRun(text, tokens.slice(i, end));
      if (hit) {
        chosen = hit;
        chosenEnd = end;
        break;
      }
    }
    if (chosen) {
      hits.push(chosen);
      i = chosenEnd;
    } else {
      i += 1;
    }
  }
  return hits;
}

/**
 * @param {string} text
 * @returns {{ index: number, matchedText: string, suggestedText: string }[]}
 */
export function findNumeralSpacingHits(text) {
  if (!text) return [];
  /** @type {{ index: number, matchedText: string, suggestedText: string }[]} */
  const hits = [];
  const len = text.length;
  let i = 0;

  while (i < len) {
    if (!isHangulSyllable(text[i]) || (i > 0 && isHangulSyllable(text[i - 1]))) {
      i += 1;
      continue;
    }

    /** @type {{ word: string, index: number, rank: number }[]} */
    const tokens = [];
    let j = i;
    while (j < len && isHangulSyllable(text[j])) {
      const wordStart = j;
      while (j < len && isHangulSyllable(text[j])) j += 1;
      const word = text.slice(wordStart, j);
      const chunk = parseChunk(word);
      if (!chunk) {
        if (tokens.length === 0) i = j;
        break;
      }
      tokens.push({ word, index: wordStart, rank: chunk.rank });
      if (j < len && SPACE.has(text[j]) && j + 1 < len && isHangulSyllable(text[j + 1])) {
        j += 1;
        continue;
      }
      break;
    }

    if (tokens.length >= 2) {
      hits.push(...hitsInTokenRun(text, tokens));
      const last = tokens[tokens.length - 1];
      const next = last.index + last.word.length;
      i = next > i ? next : i + 1;
    } else if (tokens.length === 1) {
      i = tokens[0].index + tokens[0].word.length;
    } else if (i < len && isHangulSyllable(text[i]) && (i === 0 || !isHangulSyllable(text[i - 1]))) {
      i += 1;
    }
  }

  return hits;
}

/**
 * @param {{ pageNum: number, text?: string }[]} pages
 * @returns {{ pageNum: number, index: number, matchedText: string, suggestedText: string }[]}
 */
export function findNumeralSpacingInPages(pages) {
  /** @type {{ pageNum: number, index: number, matchedText: string, suggestedText: string }[]} */
  const hits = [];
  for (const page of pages ?? []) {
    const text = String(page?.text ?? '');
    if (!text) continue;
    for (const hit of findNumeralSpacingHits(text)) {
      hits.push({ pageNum: page.pageNum, ...hit });
    }
  }
  return hits;
}

/**
 * 기존 하이라이트가 읽는 결과 그룹. category만 수사로 구분한다.
 * @param {{ pageNum: number, index: number, matchedText: string, suggestedText: string }[]} hits
 * @returns {import('./ruleEngine.js').GroupedResult[]}
 */
export function numeralSpacingGroups(hits) {
  return (hits ?? []).map((hit) => {
    const instance = {
      find: hit.matchedText,
      replace: hit.suggestedText,
      matchedText: hit.matchedText,
      suggestedText: hit.suggestedText,
      pageNum: hit.pageNum,
      index: hit.index,
    };
    return {
      find: hit.matchedText,
      replace: hit.suggestedText,
      label: NUMERAL_SPACING_LABEL,
      category: NUMERAL_SPACING_CATEGORY,
      tip: NUMERAL_SPACING_TIP,
      instances: [instance],
    };
  });
}

/**
 * @param {import('./ruleEngine.js').GroupedResult[]} groups
 * @param {number} pageNum
 */
export function countNumeralSpacingOnPage(groups, pageNum) {
  let count = 0;
  for (const group of groups ?? []) {
    for (const inst of group.instances ?? []) {
      if (inst.pageNum === pageNum) count += 1;
    }
  }
  return count;
}
