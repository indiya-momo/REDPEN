import { buildRulesForAuxiliaryEntry } from './auxiliaryVerbRegister.js';
import { buildRulesForEntry, isLiteralConsistencyEntry } from './compoundPairRegister.js';
import { isAuxiliaryStem, isHaeBoPattern } from './compoundPatternCommon.js';
import { buildRulesForPhraseSlot, isPhraseSlotPattern } from './phraseSlotRegister.js';

const COMPOUND_KINDS = new Set([
  'compound-find',
  'compound-tail',
  'compound-spacing',
  'phrase-slot-find',
  'auxiliary-verb',
]);

/** 저장된 규칙 세트가 이 버전 미만이면 1회 재정리 */
export const COMPOUND_MIGRATE_VERSION = 10;

/** @param {string} tail */
function isBadTail(tail) {
  const t = tail.trim();
  if (!t) return true;
  if (/^단어/.test(t)) return true;
  if (t.includes('단어˅') || t.includes('단어박')) return true;
  return false;
}

/** @param {string} tail */
function classifyTail(tail) {
  if (isPhraseSlotPattern(tail)) return 'phrase-slot';
  if (isAuxiliaryStem(tail) || isHaeBoPattern(tail)) return 'auxiliary';
  const parts = tail.split(/\s+/).filter(Boolean);
  if (parts.length === 2 && isAuxiliaryStem(parts[1])) return 'auxiliary';
  return 'literal';
}

/**
 * @param {import('./ruleTypes.js').Rule[]} customRules
 */
export function removeBadCompoundRules(customRules) {
  if (!Array.isArray(customRules)) return [];
  return customRules.filter((r) => {
    if (!COMPOUND_KINDS.has(r.patternKind ?? '')) return true;
    const tw = r.tailWord?.trim();
    return tw && !isBadTail(tw);
  });
}

/**
 * @param {import('./ruleTypes.js').Rule[]} customRules
 */
export function rebuildCompoundRules(customRules) {
  if (!Array.isArray(customRules) || !customRules.length) {
    return customRules ?? [];
  }

  /** 본용언+보조용언은 ensureDefaultAuxiliaryVerbs가 시트 stems만 시드 */
  const withoutAuxiliary = customRules.filter(
    (r) => r.patternKind !== 'auxiliary-verb',
  );

  const others = withoutAuxiliary.filter(
    (r) => !COMPOUND_KINDS.has(r.patternKind ?? ''),
  );

  /** @type {Set<string>} */
  const tailWords = new Set();
  /** @type {Map<string, { enabled: boolean, excludePrefixes: string[] }>} */
  const meta = new Map();

  for (const r of withoutAuxiliary) {
    const raw = r.tailWord?.trim();
    if (!raw || isBadTail(raw) || !COMPOUND_KINDS.has(r.patternKind ?? '')) {
      continue;
    }
    tailWords.add(raw);
    if (!meta.has(raw)) {
      meta.set(raw, { enabled: true, excludePrefixes: [] });
    }
    const row = meta.get(raw);
    if (r.enabled === false) row.enabled = false;
    if (r.excludePrefixes?.length) {
      row.excludePrefixes = r.excludePrefixes;
    }
  }

  /** @type {import('./ruleTypes.js').Rule[]} */
  const rebuilt = [];

  for (const tail of [...tailWords].sort((a, b) => a.localeCompare(b, 'ko'))) {
    const { enabled, excludePrefixes } = meta.get(tail) ?? {
      enabled: true,
      excludePrefixes: [],
    };
    const kind = classifyTail(tail);
    /** @type {import('./ruleTypes.js').Rule[]} */
    let batch = [];
    if (kind === 'phrase-slot') {
      batch = buildRulesForPhraseSlot([], tail);
    } else if (kind === 'auxiliary') {
      batch = buildRulesForAuxiliaryEntry([], tail);
    } else {
      batch = buildRulesForEntry([], tail);
    }
    rebuilt.push(
      ...batch.map((rule) => ({
        ...rule,
        enabled,
        excludePrefixes,
      })),
    );
  }

  return [...others, ...rebuilt];
}

/**
 * @param {import('./ruleTypes.js').Rule[]} customRules
 * @param {number} [storedVersion]
 */
export function applyCompoundRuleMigrations(customRules, storedVersion = 0) {
  const version = storedVersion ?? 0;
  if (version < COMPOUND_MIGRATE_VERSION) {
    return {
      rules: rebuildCompoundRules(removeBadCompoundRules(customRules ?? [])),
      version: COMPOUND_MIGRATE_VERSION,
    };
  }
  return {
    rules: removeBadCompoundRules(customRules ?? []),
    version,
  };
}

/** @deprecated */
export function migrateCompoundRules(customRules) {
  return applyCompoundRuleMigrations(customRules, 0).rules;
}
