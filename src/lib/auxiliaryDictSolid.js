/**
 * 본용언+보조용언 2차.
 * 합성 기본형이 추출본(`stdict-verb-forms.json`)에 있으면 띄운 발견은 붙여 쓰라고 표시한다.
 * 3음절 띄어쓰기 칸은 본용언 citation이 H(K∪H∖K)에 있을 때만 남긴다(로컬, API 없음).
 * 붙여쓰기 가능 칸에서는 추출본 띄움 필수 활용형(복합 본용언)을 빼고,
 * 단일어·mixed·미등재와 bon_allow 예외(깨뜨려 등)는 남긴다.
 * 키위는 긴 합성어 기본형을 만들 때만 쓴다. 1차 찾기(ruleEngine)는 건드리지 않는다.
 */

import {
  auxiliarySearchTailsFromBonBojoItem,
  bonBojoDisplayLabelForItem,
  bonBojoListItem,
  bonVerbAllowForItemId,
  getBonBojoGroups,
  BON_BOJO_LONG_COMPOUND_SPLIT_ID,
} from './bonBojoRules.js';
import { isBonVerbHeadOnAllowList } from './auxiliaryVerbMatchFilters.js';
import { analyzeLine } from './kiwiMorph/analyze.js';
import {
  citationHasCompoundHyphen,
  clearStdictVerbFormsCache,
  ensureStdictVerbFormsLoaded,
  hasCompoundHyphenIndex,
  isSpaceRequiredVerbForm,
  resolveSpaceRequiredLemma,
} from './stdictVerbForms.js';

const DICT_TIP = (lemma) => `표준국어대사전 「${lemma}」 등재`;

/** @deprecated 붙임표는 로컬 H. 카운터는 0으로 유지(호환). */
let sessionStdictCalls = 0;
let lastRunStdictCalls = 0;

export function auxiliaryDictSolidStdictCallCount() {
  return { lastRun: lastRunStdictCalls, session: sessionStdictCalls };
}

export function resetAuxiliaryDictSolidStdictCallCount() {
  sessionStdictCalls = 0;
  lastRunStdictCalls = 0;
}

/** @param {string} matchedText */
export function solidSurface(matchedText) {
  return String(matchedText ?? '').replace(/\s+/g, '');
}

/**
 * 사전에 등재된 합성어 발견.
 * - 띄어 쓴 표면 → 붙여 쓴 수정안 (`들어 온` + `들어온`)
 * - 이미 붙여 쓴 표면이 등재 표제어 (`auxDictSolid`)
 * @param {import('./ruleEngine.js').MatchInstance | null | undefined} inst
 */
export function isAuxiliaryDictSolidInstance(inst) {
  if (inst?.auxDictSolid) return true;
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
 * 이미 붙여 쓴·사전 등재만 (`auxDictSolid`).
 * 띄움→붙임 제안(spaced solid)은 포함하지 않는다 — 접힌 「합성어」칸용.
 * @param {import('./ruleEngine.js').MatchInstance | null | undefined} inst
 */
export function isAuxiliaryGluedDictSolidInstance(inst) {
  return Boolean(inst?.auxDictSolid);
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
  // 한 글자 본용언도 본다(해 보다→해보다, 커 지다→커지다). 사전에 있을 때만 쓰인다.
  if (head.length < 1 || !aux) return '';
  return `${head}${aux}`;
}

/**
 * 시트 원본 항목(stems 포함). listItem에는 stems가 없다.
 * @param {string} [itemId]
 */
function sheetItemById(itemId) {
  const id = String(itemId ?? '').trim();
  if (!id) return null;
  for (const group of getBonBojoGroups()) {
    for (const item of group.items ?? []) {
      if (item.id === id) return item;
    }
  }
  return null;
}

/**
 * 시트 stem 뒤절. `아 가` → `가`. 긴 onset부터.
 * @param {string} [itemId]
 */
function stemOnsetsForItem(itemId) {
  const item = sheetItemById(itemId);
  if (!item) return [];
  /** @type {Set<string>} */
  const onsets = new Set();
  for (const tail of auxiliarySearchTailsFromBonBojoItem(item)) {
    const parts = String(tail ?? '')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (parts.length === 2 && parts[1]) onsets.add(parts[1]);
  }
  return [...onsets].sort(
    (a, b) => b.length - a.length || a.localeCompare(b, 'ko'),
  );
}

/**
 * 붙여 쓴 표면 → 사전 질의. `쉬어가라고` + 가다 → `쉬어가다`.
 * @param {string} matchedText
 * @param {string} [itemId]
 * @param {string} [displayLabel]
 */
export function gluedCompoundLemma(matchedText, itemId, displayLabel) {
  const solid = String(matchedText ?? '').replace(/[^\uAC00-\uD7A3]/g, '');
  const aux = auxiliaryBaseForm(itemId, displayLabel);
  if (solid.length < 3 || !aux) return '';
  for (const onset of stemOnsetsForItem(itemId)) {
    if (!onset) continue;
    // i=1: 한 글자 본용언(해보다·커졌다). 사전 표제어일 때만 결과가 쓰인다.
    for (let i = 1; i <= solid.length - onset.length; i += 1) {
      if (solid.startsWith(onset, i)) {
        return `${solid.slice(0, i)}${aux}`;
      }
    }
  }
  return '';
}

/** @type {[string, string][] | null} */
let auxOnsetBases = null;

/** 시트 stem의 보조 토큰 → `주다` 같은 기본형. 토큰이 두 기본형에 겹치면 뺀다. */
function auxOnsetBaseList() {
  if (auxOnsetBases) return auxOnsetBases;
  /** @type {Map<string, Set<string>>} */
  const byOnset = new Map();
  for (const group of getBonBojoGroups()) {
    for (const item of group.items) {
      if (item.id === BON_BOJO_LONG_COMPOUND_SPLIT_ID) continue;
      const base = auxiliaryBaseForm(item.id, item.displayLabel);
      if (!base) continue;
      for (const tail of auxiliarySearchTailsFromBonBojoItem(item)) {
        const parts = tail.trim().split(/\s+/).filter(Boolean);
        if (parts.length !== 2 || !parts[1]) continue;
        const onset = parts[1];
        if (!byOnset.has(onset)) byOnset.set(onset, new Set());
        byOnset.get(onset).add(base);
      }
    }
  }
  auxOnsetBases = [...byOnset.entries()]
    .filter(([, bases]) => bases.size === 1)
    .map(([onset, bases]) => [onset, [...bases][0]])
    .sort(
      (a, b) => b[0].length - a[0].length || a[0].localeCompare(b[0], 'ko'),
    );
  return auxOnsetBases;
}

/**
 * 띄어쓰기 제안 `어루만져 주세요` → 사전 표제어 `어루만져주다`.
 * @param {string} suggestedText
 */
export function longCompoundSplitLemma(suggestedText) {
  const parts = String(suggestedText ?? '').trim().split(/\s+/);
  if (parts.length < 2) return '';
  const head = parts[0].replace(/[^\uAC00-\uD7A3]/g, '');
  const tail = parts.slice(1).join('').replace(/[^\uAC00-\uD7A3]/g, '');
  if (head.length < 3 || !tail) return '';
  const hit = auxOnsetBaseList().find(([onset]) => tail.startsWith(onset));
  if (!hit) return '';
  return `${head}${hit[1]}`;
}

const CITATION_STEM = /^(NNG|NNP|XR|XPN|XSN|MAG|VV|VA|VX|XSV|XSA)(-|$)/;

/**
 * 활용형 분석에서 사전 기본형을 만든다. `어루만지/VV` → `어루만지다`.
 * 어미·선어말어미는 빼며, 분석이 없으면 빈 문자열이다.
 * @param {{ str?: string, tag?: string }[] | null | undefined} tokens
 */
export function bonVerbCitation(tokens) {
  if (!Array.isArray(tokens) || tokens.length === 0) return '';
  const parts = [];
  for (const token of tokens) {
    if (!CITATION_STEM.test(String(token?.tag ?? ''))) continue;
    const piece = String(token?.str ?? '').replace(/[^\uAC00-\uD7A3]/g, '');
    if (piece) parts.push(piece);
  }
  if (!parts.length) return '';
  const stem = parts.join('');
  return stem.endsWith('다') ? stem : `${stem}다`;
}

/**
 * 표제어 글자가 질의와 같고 `-`가 있으며 품사가 용언이면 합성·파생.
 * `^`만 있는 표제어는 해당하지 않는다.
 * @param {{ word?: string, pos?: string }[] | null | undefined} headwords
 * @param {string} citation
 */
export function headwordHasCompoundHyphen(headwords, citation) {
  const q = String(citation ?? '').trim();
  if (!q || !Array.isArray(headwords)) return false;
  return headwords.some((hit) => {
    const raw = String(hit?.word ?? '').trim();
    const plain = raw.replace(/[-^]/g, '');
    return (
      plain === q &&
      raw.includes('-') &&
      /동사|형용사|보조/.test(String(hit?.pos ?? ''))
    );
  });
}

/** @param {string} suggestedText */
function splitHead(suggestedText) {
  const head = String(suggestedText ?? '').trim().split(/\s+/)[0] ?? '';
  return head.replace(/[^\uAC00-\uD7A3]/g, '');
}

/**
 * 긴 합성어 띄어쓰기 제안에서 사전 질의용 기본형(citation)을 만든다.
 * API·로컬 게이트 측정이 같은 앞단을 쓰도록 루프에서 분리한다.
 * @param {{ suggestedText?: string }} row
 * @param {typeof analyzeLine} analyze
 */
export function citationOfSplitRow(row, analyze) {
  const head = splitHead(row?.suggestedText);
  let tokens = null;
  if (head) {
    try {
      tokens = analyze(head)?.tokens ?? null;
    } catch {
      tokens = null;
    }
  }
  return bonVerbCitation(tokens);
}

export function clearAuxiliaryDictSolidCache() {
  clearStdictVerbFormsCache();
}

/**
 * 추출본 기본형 키, 또는 활용형 표면→유일 기본형으로 등재.
 * @param {string} lemma
 * @param {{ verbForms?: object, fetchImpl?: typeof fetch, dataUrl?: string, surface?: string }} [opts]
 */
export async function isRegisteredPredicateLemma(lemma, opts = {}) {
  await ensureStdictVerbFormsLoaded(opts);
  return Boolean(resolveSpaceRequiredLemma(lemma, opts.surface));
}


/**
 * 붙여쓰기 가능 칸에서 본용언 활용형. 띄운 제안·표면의 첫 어절, 없으면 보조 onset으로 자른다.
 * @param {import('./ruleEngine.js').MatchInstance | null | undefined} inst
 * @param {string} [itemId]
 */
export function bonVerbHeadFromAuxInstance(inst, itemId = '') {
  const suggested = String(inst?.suggestedText ?? '').trim();
  if (/\s/.test(suggested)) return headEojeol(suggested);
  const matched = String(inst?.matchedText ?? '').trim();
  if (/\s/.test(matched)) return headEojeol(matched);
  const solid = matched.replace(/[^\uAC00-\uD7A3]/g, '');
  if (!solid) return '';
  for (const onset of stemOnsetsForItem(itemId)) {
    if (!onset) continue;
    for (let i = 2; i <= solid.length - onset.length; i += 1) {
      if (solid.startsWith(onset, i)) return solid.slice(0, i);
    }
  }
  return '';
}

/**
 * 추출본에 있는 3음절+ 복합 본용언은 띄움 필수 칸으로 보내고,
 * 단일어·mixed·미등재와 bon_allow 예외는 붙여쓰기 가능 칸에 남긴다.
 * @param {import('./ruleEngine.js').GroupedResult[]} groups
 */
export function pruneCompoundHeadsFromGlueOptional(groups) {
  return (groups ?? []).map((group) => {
    if (group?.patternKind !== 'auxiliary-verb') return group;
    if (group.auxSplitLongCompound || group.auxNonAeoSpace) return group;
    const allow = bonVerbAllowForItemId(group.bonBojoItemId);
    const instances = (group.instances ?? []).filter((inst) => {
      const head = bonVerbHeadFromAuxInstance(inst, group.bonBojoItemId);
      if (!head) return true;
      if (isBonVerbHeadOnAllowList(head, '', allow)) return true;
      return !isSpaceRequiredVerbForm(head);
    });
    return { ...group, instances };
  });
}

/**
 * @param {import('./ruleEngine.js').GroupedResult[]} groups
 * @param {{ fetchImpl?: typeof fetch, timeoutMs?: number, analyze?: typeof analyzeLine, verbForms?: object, dataUrl?: string }} [opts]
 */
export async function enrichAuxiliaryDictSolid(groups, opts = {}) {
  const list = groups ?? [];
  await ensureStdictVerbFormsLoaded(opts);
  /** @type {{ groupIndex: number, instIndex: number, lemma: string, kind: 'solid' | 'glued-solid' | 'registered' | 'plain', solid?: string, surface?: string, ok?: boolean }[]} */
  const jobs = [];
  /** @type {{ groupIndex: number, instIndex: number, suggestedText: string }[]} */
  const pendingSplit = [];
  const analyze = opts.analyze ?? analyzeLine;

  list.forEach((group, groupIndex) => {
    if (group?.patternKind !== 'auxiliary-verb') return;
    if (group.auxSplitLongCompound) {
      (group.instances ?? []).forEach((inst, instIndex) => {
        pendingSplit.push({
          groupIndex,
          instIndex,
          suggestedText: String(inst?.suggestedText ?? ''),
        });
      });
      return;
    }
    const itemId = group.bonBojoItemId;
    const displayLabel = group.groupDisplayLabel || group.label;
    (group.instances ?? []).forEach((inst, instIndex) => {
      const matched = String(inst?.matchedText ?? '');
      if (/\s/.test(matched)) {
        const lemma = compoundLemma(matched, itemId, displayLabel);
        const solid = solidSurface(matched);
        if (!solid || solid === matched.trim()) return;
        jobs.push({
          groupIndex,
          instIndex,
          lemma: lemma || '',
          kind: 'solid',
          solid,
          surface: solid,
        });
        return;
      }
      const surface = matched.replace(/[^\uAC00-\uD7A3]/g, '');
      const lemma = gluedCompoundLemma(matched, itemId, displayLabel);
      if (!lemma && !surface) return;
      jobs.push({
        groupIndex,
        instIndex,
        lemma: lemma || '',
        kind: 'glued-solid',
        surface,
      });
    });
  });

  if (pendingSplit.length && !hasCompoundHyphenIndex()) {
    console.warn(
      '[auxiliaryDictSolid] 붙임표 인덱스 없음 — 긴 합성어 칸을 닫습니다',
    );
  }
  for (const row of pendingSplit) {
    const citation = citationOfSplitRow(row, analyze);
    if (!citation || !citationHasCompoundHyphen(citation)) {
      jobs.push({ ...row, lemma: '', kind: 'plain' });
      continue;
    }
    const lemma = longCompoundSplitLemma(row.suggestedText);
    if (!lemma) continue;
    jobs.push({ ...row, lemma, kind: 'registered', surface: lemma });
  }

  if (!jobs.length) {
    lastRunStdictCalls = 0;
    return pruneCompoundHeadsFromGlueOptional(list);
  }

  for (const job of jobs) {
    if (job.kind === 'plain') continue;
    const resolved = resolveSpaceRequiredLemma(job.lemma, job.surface || '');
    if (resolved) {
      job.lemma = resolved;
      job.ok = true;
    }
  }
  lastRunStdictCalls = 0;

  const hasHit = jobs.some((job) => job.ok);
  const hasPlain = jobs.some((job) => job.kind === 'plain');
  const next =
    !jobs.length || (!hasHit && !hasPlain)
      ? list
      : list.flatMap((group, groupIndex) => {
    const plainIndexes = new Set(
      jobs
        .filter((job) => job.kind === 'plain' && job.groupIndex === groupIndex)
        .map((job) => job.instIndex),
    );
    const registeredHits = jobs.filter(
      (job) => job.groupIndex === groupIndex && job.kind !== 'plain' && job.ok,
    );
    if (!plainIndexes.size && !registeredHits.length) return [group];
    const instances = (group.instances ?? [])
      .map((inst, instIndex) => {
        if (plainIndexes.has(instIndex)) return null;
        const job = registeredHits.find((row) => row.instIndex === instIndex);
        if (!job) return inst;
        if (job.kind === 'registered') return null;
        if (job.kind === 'glued-solid') {
          return {
            ...inst,
            auxDictSolid: true,
            tip: DICT_TIP(job.lemma),
          };
        }
        return {
          ...inst,
          suggestedText: job.solid,
          tip: DICT_TIP(job.lemma),
        };
      })
      .filter(Boolean);
    if (group.auxSplitLongCompound && instances.length === 0) return [];
    return [{ ...group, instances }];
  });
  return pruneCompoundHeadsFromGlueOptional(next);
}
