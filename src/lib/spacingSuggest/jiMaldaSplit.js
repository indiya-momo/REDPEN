/**
 * `-지 말다` 붙여 쓴 어절만 split 후보로 본다.
 * 페이지 전문을 분석하지 않는다. Kiwi가 없거나 1:1이 깨지면 제안하지 않는다.
 * 12초 heuristic·서버 캐시 결과는 받지 않는다.
 */

import { analyzeLine } from '../kiwiMorph/analyze.js';
import { getKiwiInstance } from '../kiwiMorph/runtime.js';

/** 1:1이 남는 닫힌 끝. `지마`만 있는 표면은 넣지 않는다. */
const CLOSED_ENDINGS = ['마세요', '말자', '말라', '말고'];

/**
 * @param {string} text
 * @returns {string[]}
 */
export function collectJiMaldaCandidates(text) {
  /** @type {string[]} */
  const out = [];
  for (const part of String(text ?? '').split(/\s+/)) {
    const runs = part.match(/[가-힣]+/g);
    if (!runs) continue;
    for (const surface of runs) {
      if (!surface.includes('지')) continue;
      if (!CLOSED_ENDINGS.some((end) => surface.endsWith(end))) continue;
      out.push(surface);
    }
  }
  return out;
}

/**
 * @param {string} surface
 * @param {{ tokens?: { str: string, tag: string, position: number, length: number }[], surface1to1?: boolean } | null} analyzed
 * @returns {{ surface: string, suggestedText: string, insertAt: number, direction: 'split' } | null}
 */
export function decideJiMaldaSplit(surface, analyzed) {
  if (!analyzed || analyzed.surface1to1 !== true) return null;
  const tokens = analyzed.tokens ?? [];
  for (let i = 0; i < tokens.length - 1; i += 1) {
    const ji = tokens[i];
    const mal = tokens[i + 1];
    if (ji?.str !== '지' || ji?.tag !== 'EC') continue;
    if (mal?.str !== '말' || mal?.tag !== 'VX') continue;
    if (mal.position !== ji.position + ji.length) continue;
    const suggestedText = `${surface.slice(0, mal.position)} ${surface.slice(mal.position)}`;
    if (suggestedText === surface) return null;
    return {
      surface,
      suggestedText,
      insertAt: mal.position,
      direction: 'split',
    };
  }
  return null;
}

/**
 * @param {string} text
 * @param {{
 *   kiwi?: { ready?: () => boolean, analyze: Function } | null,
 *   includeSilent?: boolean,
 * }} [opts]
 * @returns {{
 *   suggestions: { surface: string, suggestedText: string, insertAt: number, direction: 'split' }[],
 *   skipped: number,
 *   considered: number,
 *   silent: string[],
 * }}
 */
export function suggestJiMaldaSplits(text, opts = {}) {
  const candidates = collectJiMaldaCandidates(text);
  /** @type {{ surface: string, suggestedText: string, insertAt: number, direction: 'split' }[]} */
  const suggestions = [];
  /** @type {string[]} */
  const silent = [];
  let skipped = 0;

  for (const surface of candidates) {
    const kiwi = opts.kiwi !== undefined ? opts.kiwi : getKiwiInstance();
    if (!kiwi?.ready?.()) {
      skipped += 1;
      continue;
    }
    const analyzed = analyzeLine(surface, { kiwi });
    if (!analyzed) {
      skipped += 1;
      continue;
    }
    const hit = decideJiMaldaSplit(surface, analyzed);
    if (hit) suggestions.push(hit);
    else if (opts.includeSilent) silent.push(surface);
  }

  return {
    suggestions,
    skipped,
    considered: candidates.length,
    silent,
  };
}
