import {
  normalizeConsistencyVariant,
} from './compoundPairRegister.js';
import {
  applyConsistencyUnifyPin,
  getConsistencyUnifyPinnedTailWord,
} from './consistencyUnifyRegister.js';
import { listConsistencyUnifyEntries } from './consistencyRuleLimit.js';
import { newId } from './ruleSetsStorage.js';

/** @typedef {{
 *   id: string,
 *   at: string,
 *   byUid?: string,
 * }} ConsistencyDecisionBase */

/** @typedef {ConsistencyDecisionBase & {
 *   kind: 'unify',
 *   pinned: string,
 *   variants: string[],
 * }} UnifyConsistencyDecision */

/** @typedef {ConsistencyDecisionBase & {
 *   kind: 'find',
 *   query: string,
 * }} FindConsistencyDecision */

/** @typedef {ConsistencyDecisionBase & {
 *   kind: 'commonString',
 *   pattern: string,
 * }} CommonStringConsistencyDecision */

/** @typedef {
 *   | UnifyConsistencyDecision
 *   | FindConsistencyDecision
 *   | CommonStringConsistencyDecision
 * } ConsistencyDecision */

/** @param {unknown} value */
function normalizeAt(value) {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed || Number.isNaN(Date.parse(trimmed))) return undefined;
  return trimmed;
}

/** @param {unknown} raw */
function normalizeUnifyDecision(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = typeof raw.id === 'string' ? raw.id.trim() : '';
  const at = normalizeAt(raw.at);
  const pinned = normalizeConsistencyVariant(
    typeof raw.pinned === 'string' ? raw.pinned : '',
  );
  if (!id || !at || !pinned) return null;

  /** @type {string[]} */
  const variants = [];
  const seen = new Set([pinned]);
  if (Array.isArray(raw.variants)) {
    for (const item of raw.variants) {
      const variant = normalizeConsistencyVariant(
        typeof item === 'string' ? item : '',
      );
      if (!variant || seen.has(variant)) continue;
      seen.add(variant);
      variants.push(variant);
    }
  }

  /** @type {UnifyConsistencyDecision} */
  const decision = {
    id,
    kind: 'unify',
    at,
    pinned,
    variants,
  };
  const byUid =
    typeof raw.byUid === 'string' ? raw.byUid.trim() : '';
  if (byUid) decision.byUid = byUid;
  return decision;
}

/**
 * @param {unknown} raw
 * @returns {FindConsistencyDecision | null}
 */
function normalizeFindDecision(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = typeof raw.id === 'string' ? raw.id.trim() : '';
  const at = normalizeAt(raw.at);
  const query = normalizeConsistencyVariant(
    typeof raw.query === 'string' ? raw.query : '',
  );
  if (!id || !at || !query) return null;
  /** @type {FindConsistencyDecision} */
  const decision = { id, kind: 'find', at, query };
  const byUid = typeof raw.byUid === 'string' ? raw.byUid.trim() : '';
  if (byUid) decision.byUid = byUid;
  return decision;
}

/**
 * @param {unknown} raw
 * @returns {CommonStringConsistencyDecision | null}
 */
function normalizeCommonStringDecision(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = typeof raw.id === 'string' ? raw.id.trim() : '';
  const at = normalizeAt(raw.at);
  const pattern = normalizeConsistencyVariant(
    typeof raw.pattern === 'string' ? raw.pattern : '',
  );
  if (!id || !at || !pattern) return null;
  /** @type {CommonStringConsistencyDecision} */
  const decision = { id, kind: 'commonString', at, pattern };
  const byUid = typeof raw.byUid === 'string' ? raw.byUid.trim() : '';
  if (byUid) decision.byUid = byUid;
  return decision;
}

/**
 * @param {unknown} decisions
 * @returns {ConsistencyDecision[]}
 */
export function normalizeConsistencyDecisions(decisions) {
  if (!Array.isArray(decisions)) return [];
  /** @type {ConsistencyDecision[]} */
  const out = [];
  for (const raw of decisions) {
    if (!raw || typeof raw !== 'object') continue;
    if (raw.kind === 'unify') {
      const normalized = normalizeUnifyDecision(raw);
      if (normalized) out.push(normalized);
      continue;
    }
    if (raw.kind === 'find') {
      const normalized = normalizeFindDecision(raw);
      if (normalized) out.push(normalized);
      continue;
    }
    if (raw.kind === 'commonString') {
      const normalized = normalizeCommonStringDecision(raw);
      if (normalized) out.push(normalized);
    }
  }
  return out;
}

/**
 * @param {{ at?: string, byUid?: string }} [meta]
 */
function decisionMeta(meta = {}) {
  const at = meta.at ?? new Date().toISOString();
  const byUid = String(meta.byUid ?? '').trim();
  return { at, byUid };
}

/**
 * @param {ConsistencyDecision[] | undefined} decisions
 * @param {string[]} queries
 * @param {{ at?: string, byUid?: string }} [meta]
 */
export function appendFindDecisions(decisions, queries, meta = {}) {
  const list = normalizeConsistencyDecisions(decisions);
  const { at, byUid } = decisionMeta(meta);
  /** @type {FindConsistencyDecision[]} */
  const added = [];
  const seen = new Set();
  for (const raw of queries ?? []) {
    const query = normalizeConsistencyVariant(raw);
    if (!query || seen.has(query)) continue;
    seen.add(query);
    /** @type {FindConsistencyDecision} */
    const decision = {
      id: newId().replace(/^set_/, 'dec_'),
      kind: 'find',
      at,
      query,
    };
    if (byUid) decision.byUid = byUid;
    added.push(decision);
  }
  return added.length ? [...list, ...added] : list;
}

/**
 * @param {ConsistencyDecision[] | undefined} decisions
 * @param {string} patternRaw
 * @param {{ at?: string, byUid?: string }} [meta]
 */
export function appendCommonStringDecision(decisions, patternRaw, meta = {}) {
  const pattern = normalizeConsistencyVariant(patternRaw);
  if (!pattern) return normalizeConsistencyDecisions(decisions);
  const list = normalizeConsistencyDecisions(decisions);
  const { at, byUid } = decisionMeta(meta);
  /** @type {CommonStringConsistencyDecision} */
  const decision = {
    id: newId().replace(/^set_/, 'dec_'),
    kind: 'commonString',
    at,
    pattern,
  };
  if (byUid) decision.byUid = byUid;
  return [...list, decision];
}

/**
 * 확정 대장만 정규화한다. 등록 규칙으로 가짜 확정 이력을 만들지 않는다.
 *
 * @param {unknown} decisions
 * @param {import('./ruleTypes.js').Rule[] | undefined} [_customRules]
 * @param {string | undefined} [_fallbackAt]
 * @returns {ConsistencyDecision[]}
 */
export function hydrateConsistencyDecisionsFromRules(
  decisions,
  _customRules,
  _fallbackAt,
) {
  return normalizeConsistencyDecisions(decisions);
}

/**
 * @param {import('./ruleTypes.js').Rule[]} customRules
 * @param {string} pinnedRaw
 * @param {{ at?: string, byUid?: string }} [meta]
 * @returns {UnifyConsistencyDecision}
 */
export function buildUnifyDecisionFromRules(
  customRules,
  pinnedRaw,
  meta = {},
) {
  const pinned = normalizeConsistencyVariant(pinnedRaw);
  const entries = listConsistencyUnifyEntries(customRules ?? []);
  /** @type {string[]} */
  const variants = [];
  const seen = new Set([pinned]);
  for (const entry of entries) {
    const tailWord = normalizeConsistencyVariant(entry.tailWord ?? '');
    if (!tailWord || seen.has(tailWord)) continue;
    seen.add(tailWord);
    variants.push(tailWord);
  }

  /** @type {UnifyConsistencyDecision} */
  const decision = {
    id: newId().replace(/^set_/, 'dec_'),
    kind: 'unify',
    at: meta.at ?? new Date().toISOString(),
    pinned,
    variants,
  };
  const byUid = String(meta.byUid ?? '').trim();
  if (byUid) decision.byUid = byUid;
  return decision;
}

/**
 * @param {ConsistencyDecision[] | undefined} decisions
 * @param {import('./ruleTypes.js').Rule[]} customRules
 * @param {string} pinnedRaw
 * @param {{ byUid?: string }} [meta]
 */
export function appendUnifyDecisionFromPin(
  decisions,
  customRules,
  pinnedRaw,
  meta = {},
) {
  const pinned = normalizeConsistencyVariant(pinnedRaw);
  if (!pinned) return normalizeConsistencyDecisions(decisions);

  const list = normalizeConsistencyDecisions(decisions);
  const decision = buildUnifyDecisionFromRules(customRules, pinned, meta);
  return [...list, decision];
}

/**
 * @param {ConsistencyDecision} decision
 * @param {string} rawVariant
 */
export function matchesUnifyDecisionVariant(decision, rawVariant) {
  if (decision.kind !== 'unify') return false;
  const norm = normalizeConsistencyVariant(rawVariant);
  if (!norm) return false;
  if (normalizeConsistencyVariant(decision.pinned) === norm) return true;
  return decision.variants.some(
    (variant) => normalizeConsistencyVariant(variant) === norm,
  );
}

/**
 * @param {ConsistencyDecision[] | undefined} decisions
 * @param {string} rawVariant
 * @returns {string | null}
 */
export function resolvePinnedForVariant(decisions, rawVariant) {
  const norm = normalizeConsistencyVariant(rawVariant);
  if (!norm) return null;

  const unify = normalizeConsistencyDecisions(decisions).filter(
    (decision) => decision.kind === 'unify',
  );

  /** @type {UnifyConsistencyDecision | null} */
  let best = null;
  for (const decision of unify) {
    if (!matchesUnifyDecisionVariant(decision, norm)) continue;
    if (!best || decision.at > best.at) best = decision;
  }

  return best ? normalizeConsistencyVariant(best.pinned) : null;
}

/**
 * @param {import('./ruleTypes.js').Rule[]} prevRules
 * @param {import('./ruleTypes.js').Rule[]} nextRules
 * @returns {string | null}
 */
export function detectUnifyPinApplied(prevRules, nextRules) {
  const prev = getConsistencyUnifyPinnedTailWord(prevRules ?? []);
  const next = getConsistencyUnifyPinnedTailWord(nextRules ?? []);
  if (!next || next === prev) return null;
  return next;
}

/**
 * 📌 직전 읽기 전용 경고 — 검수 엔진 미연동임을 분명히 한다.
 *
 * @param {ConsistencyDecision[] | undefined} decisions
 * @param {import('./ruleTypes.js').Rule[]} customRules
 * @param {string} targetTailWordRaw
 * @returns {string | null}
 */
export function formatUnifyPinLedgerWarning(
  decisions,
  customRules,
  targetTailWordRaw,
) {
  const target = normalizeConsistencyVariant(targetTailWordRaw);
  if (!target) return null;

  const currentPinned = getConsistencyUnifyPinnedTailWord(customRules ?? []);
  if (currentPinned === target) return null;

  const resolved = resolvePinnedForVariant(decisions, target);
  if (!resolved) return null;

  if (resolved === target) {
    return '이미 확정된 표기입니다. 과거 확정 기록과 일치하며, 지금 검수에 자동 반영되지는 않습니다.';
  }

  return `과거에 「${resolved}」(으)로 확정한 기록이 있습니다. 지금 검수에 자동 반영되지는 않습니다.`;
}

/**
 * 통일형 📌 적용 use case — 규칙 갱신 + (핀 지정 시) 대장 append.
 * UI는 이 결과만 persist한다.
 *
 * @param {import('./ruleTypes.js').Rule[]} customRules
 * @param {ConsistencyDecision[] | undefined} decisions
 * @param {string} targetTailWordRaw
 * @param {{ byUid?: string }} [meta]
 * @returns {{
 *   nextRules: import('./ruleTypes.js').Rule[],
 *   nextDecisions: ConsistencyDecision[],
 *   warning: string | null,
 *   pinnedApplied: string | null,
 * }}
 */
export function applyUnifyPinWithLedger(
  customRules,
  decisions,
  targetTailWordRaw,
  meta = {},
) {
  const warning = formatUnifyPinLedgerWarning(
    decisions,
    customRules,
    targetTailWordRaw,
  );
  const nextRules = applyConsistencyUnifyPin(customRules, targetTailWordRaw);
  const pinnedApplied = detectUnifyPinApplied(customRules, nextRules);
  const nextDecisions = pinnedApplied
    ? appendUnifyDecisionFromPin(decisions, nextRules, pinnedApplied, meta)
    : normalizeConsistencyDecisions(decisions);

  return {
    nextRules,
    nextDecisions,
    warning,
    pinnedApplied,
  };
}
