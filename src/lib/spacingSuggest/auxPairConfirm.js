/**
 * 띄어 쓴 두 어절. 앞이 용언 `-아/-어`이고 뒤가 `VX`일 때만 본다.
 * 6단계 전에는 `confirm`만 낸다. 사전에 없는 기본형은 침묵(제47항).
 * 1:1이 깨지거나 Kiwi가 없으면 제안하지 않는다.
 */

import { analyzeLine } from '../kiwiMorph/analyze.js';
import { getKiwiInstance } from '../kiwiMorph/runtime.js';

const STEM = /^(VV|VA|VX|XSV)/;

/**
 * 한 줄 안의 이웃 어절. 앞 어절이 `아` 또는 `어`로 끝난다.
 * @param {string} text
 * @returns {{ left: string, right: string, line: string }[]}
 */
export function collectAuxPairs(text) {
  /** @type {{ left: string, right: string, line: string }[]} */
  const out = [];
  for (const line of String(text ?? '').split(/\n/)) {
    const eojeols = [];
    for (const part of line.split(/\s+/)) {
      const hangul = part.match(/[가-힣]+/g)?.join('') ?? '';
      if (hangul) eojeols.push(hangul);
    }
    for (let i = 0; i < eojeols.length - 1; i += 1) {
      const left = eojeols[i];
      const right = eojeols[i + 1];
      const end = left[left.length - 1];
      if (end !== '아' && end !== '어') continue;
      out.push({ left, right, line });
    }
  }
  return out;
}

/**
 * @param {{ left: string, right: string }} pair
 * @param {{ tokens?: { str: string, tag: string, position: number, length: number }[], surface1to1?: boolean } | null} analyzed
 * @returns {{ pair: string, lemma: string } | null}
 */
export function decideAuxPair(pair, analyzed) {
  if (!analyzed || analyzed.surface1to1 !== true) return null;
  const { left, right } = pair;
  const rightAt = left.length + 1;
  const tokens = analyzed.tokens ?? [];
  for (let i = 0; i < tokens.length - 1; i += 1) {
    const stem = tokens[i];
    const ec = tokens[i + 1];
    const vx = tokens[i + 2];
    if (!stem || !ec || !vx) continue;
    if (!STEM.test(stem.tag)) continue;
    if (ec.tag !== 'EC' || (ec.str !== '아' && ec.str !== '어')) continue;
    if (ec.position + ec.length !== left.length) continue;
    if (!String(vx.tag).startsWith('VX')) continue;
    if (vx.position !== rightAt) continue;
    if (!vx.str) continue;
    return {
      pair: `${left} ${right}`,
      lemma: `${left}${vx.str}다`,
    };
  }
  return null;
}

/**
 * @param {string} text
 * @param {{
 *   kiwi?: { ready?: () => boolean, analyze: Function } | null,
 *   isRegistered?: (lemma: string) => Promise<boolean | null>,
 *   includeDetail?: boolean,
 * }} [opts]
 */
export async function confirmAuxPairs(text, opts = {}) {
  const pairs = collectAuxPairs(text);
  /** @type {{ pair: string, lemma: string, direction: 'confirm' }[]} */
  const confirms = [];
  let skipped = 0;
  let notOneToOne = 0;
  let notAux = 0;
  /** @type {{ pair: string, lemma: string }[]} */
  const morph = [];

  for (const pair of pairs) {
    const kiwi = opts.kiwi !== undefined ? opts.kiwi : getKiwiInstance();
    if (!kiwi?.ready?.()) {
      skipped += 1;
      continue;
    }
    const analyzed = analyzeLine(`${pair.left} ${pair.right}`, { kiwi });
    if (!analyzed) {
      skipped += 1;
      continue;
    }
    if (analyzed.surface1to1 !== true) {
      notOneToOne += 1;
      continue;
    }
    const hit = decideAuxPair(pair, analyzed);
    if (!hit) {
      notAux += 1;
      continue;
    }
    morph.push(hit);
  }

  let unregistered = 0;
  const isRegistered = opts.isRegistered;
  /** @type {Map<string, boolean | null>} */
  const verdicts = new Map();
  for (const hit of morph) {
    if (!isRegistered) {
      skipped += 1;
      continue;
    }
    if (!verdicts.has(hit.lemma)) {
      verdicts.set(hit.lemma, await isRegistered(hit.lemma));
    }
    const yes = verdicts.get(hit.lemma);
    if (yes == null) {
      skipped += 1;
      continue;
    }
    if (!yes) {
      unregistered += 1;
      continue;
    }
    confirms.push({ ...hit, direction: 'confirm' });
  }

  return {
    confirms: opts.includeDetail ? confirms : confirms.map(() => ({ direction: 'confirm' })),
    skipped,
    considered: pairs.length,
    notOneToOne,
    notAux,
    unregistered,
    morph: morph.length,
    morphHits: opts.includeDetail ? morph : [],
  };
}
