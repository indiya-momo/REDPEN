/**
 * 본용언+보조용언 2차 — 합성 기본형이 표준국어대사전에 용언으로 있으면
 * 띄운 발견을 붙여 쓰라고 표시. 1차 찾기(ruleEngine)는 건드리지 않는다.
 */

import { bonBojoDisplayLabelForItem, bonBojoListItem } from './bonBojoRules.js';
import {
  fetchStdictExact,
  verdictFromStdictHits,
} from './unifyStdictPos.js';

const DICT_TIP = (lemma) =>
  `표준국어대사전 「${lemma}」 등재 — 붙여 씀`;

/** @type {Map<string, boolean>} */
const predicateCache = new Map();

/** @param {string} matchedText */
export function solidSurface(matchedText) {
  return String(matchedText ?? '').replace(/\s+/g, '');
}

/**
 * 사전에 등재돼 붙여 쓰기로 바뀐 발견. `들어 온` + `들어온`.
 * @param {import('./ruleEngine.js').MatchInstance | null | undefined} inst
 */
export function isAuxiliaryDictSolidInstance(inst) {
  const matched = String(inst?.matchedText ?? '').trim();
  const suggested = String(inst?.suggestedText ?? '').trim();
  return (
    Boolean(matched) &&
    Boolean(suggested) &&
    /\s/.test(matched) &&
    !/\s/.test(suggested) &&
    matched.replace(/\s+/g, '') === suggested
  );
}

/**
 * `들어 온 → 들어온 10P`
 * @param {import('./ruleEngine.js').MatchInstance | null | undefined} inst
 * @param {string} [pageText]
 */
export function auxiliarySolidHitLabel(inst, pageText = '') {
  if (!isAuxiliaryDictSolidInstance(inst)) return '';
  const body = `${String(inst.matchedText).trim()} → ${String(inst.suggestedText).trim()}`;
  const page = String(pageText ?? '').trim();
  return page ? `${body} ${page}` : body;
}

/**
 * 첫 어절의 한글만. `들어 온` → `들어`, `쉬어 가라고` → `쉬어`
 * @param {string} matchedText
 */
export function headEojeol(matchedText) {
  const first = String(matchedText ?? '').trim().split(/\s+/)[0] ?? '';
  return first.replace(/[^\uAC00-\uD7A3]/g, '');
}

/**
 * 시트 표시명 `(아/어) + 오다` 또는 label `오` → `오다`
 * @param {string} [itemId]
 * @param {string} [displayLabel]
 */
export function auxiliaryBaseForm(itemId, displayLabel) {
  const fromLabel = String(
    displayLabel || (itemId ? bonBojoDisplayLabelForItem(itemId) : '') || '',
  );
  const named = fromLabel.match(/\+\s*([\uAC00-\uD7A3]+다)\s*$/);
  if (named) return named[1];
  const primary = itemId ? bonBojoListItem(itemId)?.primaryTail || '' : '';
  if (primary.endsWith('다') && primary.length >= 2) return primary;
  if (/^[\uAC00-\uD7A3]+$/.test(primary)) return `${primary}다`;
  return '';
}

/**
 * `들어 온` + 오다 → `들어오다`
 * @param {string} matchedText
 * @param {string} [itemId]
 * @param {string} [displayLabel]
 */
export function compoundLemma(matchedText, itemId, displayLabel) {
  const head = headEojeol(matchedText);
  const aux = auxiliaryBaseForm(itemId, displayLabel);
  if (head.length < 2 || !aux) return '';
  return `${head}${aux}`;
}

export function clearAuxiliaryDictSolidCache() {
  predicateCache.clear();
}

/**
 * exact 히트 중 표제어가 lemma이고 품사가 용언이면 등재.
 * @param {string} lemma
 * @param {{ fetchImpl?: typeof fetch, timeoutMs?: number }} [opts]
 */
export async function isRegisteredPredicateLemma(lemma, opts = {}) {
  const q = String(lemma ?? '').trim();
  if (!q) return false;
  if (!opts.fetchImpl && predicateCache.has(q)) return predicateCache.get(q);

  const result = await fetchStdictExact(q, opts);
  if (result.error) return false;

  const exactPred = (result.hits ?? []).some((hit) => {
    const word = String(hit.word ?? '').replace(/[^\uAC00-\uD7A3]/g, '');
    return word === q && /동사|형용사|보조/.test(hit.pos || '');
  });
  const verdict = verdictFromStdictHits(result.hits ?? []);
  const yes =
    exactPred ||
    ((verdict === 'predicate' || verdict === 'mixed') &&
      (result.hits ?? []).some((hit) => {
        const word = String(hit.word ?? '').replace(/[^\uAC00-\uD7A3]/g, '');
        return word === q;
      }));

  if (!opts.fetchImpl) predicateCache.set(q, yes);
  return yes;
}

/**
 * @param {import('./ruleEngine.js').GroupedResult[]} groups
 * @param {{ fetchImpl?: typeof fetch, timeoutMs?: number }} [opts]
 */
export async function enrichAuxiliaryDictSolid(groups, opts = {}) {
  const list = groups ?? [];
  /** @type {{ groupIndex: number, instIndex: number, lemma: string, solid: string }[]} */
  const jobs = [];
  const lemmas = new Set();

  list.forEach((group, groupIndex) => {
    if (group?.patternKind !== 'auxiliary-verb') return;
    const itemId = group.bonBojoItemId;
    const displayLabel = group.groupDisplayLabel || group.label;
    (group.instances ?? []).forEach((inst, instIndex) => {
      const matched = String(inst?.matchedText ?? '');
      if (!/\s/.test(matched)) return;
      const lemma = compoundLemma(matched, itemId, displayLabel);
      const solid = solidSurface(matched);
      if (!lemma || !solid || solid === matched.trim()) return;
      jobs.push({ groupIndex, instIndex, lemma, solid });
      lemmas.add(lemma);
    });
  });

  if (!jobs.length) return list;

  /** @type {Map<string, boolean>} */
  const registered = new Map();
  for (const lemma of lemmas) {
    registered.set(lemma, await isRegisteredPredicateLemma(lemma, opts));
  }

  const hitLemmas = new Set(
    [...registered.entries()].filter(([, ok]) => ok).map(([lemma]) => lemma),
  );
  if (!hitLemmas.size) return list;

  return list.map((group, groupIndex) => {
    const mine = jobs.filter(
      (job) => job.groupIndex === groupIndex && hitLemmas.has(job.lemma),
    );
    if (!mine.length) return group;
    const instances = (group.instances ?? []).map((inst, instIndex) => {
      const job = mine.find((row) => row.instIndex === instIndex);
      if (!job) return inst;
      return { ...inst, suggestedText: job.solid };
    });
    const tips = [...new Set(mine.map((job) => DICT_TIP(job.lemma)))];
    const prev = String(group.tip ?? '').trim();
    const extra = tips.filter((tip) => !prev.includes(tip));
    const tip = extra.length
      ? prev
        ? `${prev}\n${extra.join('\n')}`
        : extra.join('\n')
      : prev;
    return { ...group, instances, tip };
  });
}
