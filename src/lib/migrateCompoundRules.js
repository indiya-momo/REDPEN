import {
  buildCompoundSpacingRules,
} from './compoundSpacingPattern.js';
import {
  buildCompoundTailRules,
} from './compoundTailPattern.js';

const COMPOUND_KINDS = new Set(['compound-tail', 'compound-spacing']);

/** 저장된 규칙 세트가 이 버전 미만이면 1회 재정리 */
export const COMPOUND_MIGRATE_VERSION = 3;

/** @param {string} tail */
function isBadTail(tail) {
  const t = tail.trim();
  if (!t) return true;
  if (/^단어/.test(t)) return true;
  if (t.includes('단어˅') || t.includes('단어박')) return true;
  return false;
}

/**
 * 깨진 tailWord 규칙만 제거 (재빌드 없음)
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
 * tailWord 기준으로 붙임·띄움 규칙 find/label 재생성 (enabled·excludePrefixes 유지)
 * @param {import('./ruleTypes.js').Rule[]} customRules
 * @returns {import('./ruleTypes.js').Rule[]}
 */
export function rebuildCompoundRules(customRules) {
  if (!Array.isArray(customRules) || !customRules.length) {
    return customRules ?? [];
  }

  const others = customRules.filter(
    (r) => !COMPOUND_KINDS.has(r.patternKind ?? ''),
  );

  /** @type {Map<string, boolean>} */
  const tailEnabled = new Map();
  /** @type {Map<string, string[]>} */
  const tailExclude = new Map();
  /** @type {Map<string, boolean>} */
  const spacingEnabled = new Map();

  for (const r of customRules) {
    const raw = r.tailWord?.trim();
    if (!raw || isBadTail(raw)) continue;

    if (r.patternKind === 'compound-tail') {
      tailEnabled.set(raw, r.enabled !== false);
      if (r.excludePrefixes?.length) {
        tailExclude.set(raw, r.excludePrefixes);
      }
    }
    if (r.patternKind === 'compound-spacing') {
      spacingEnabled.set(raw, r.enabled !== false);
    }
  }

  /** @type {import('./ruleTypes.js').Rule[]} */
  const rebuilt = [];

  for (const [tail, enabled] of tailEnabled) {
    rebuilt.push(
      ...buildCompoundTailRules(tail, {
        excludePrefixes: tailExclude.get(tail) ?? [],
      }).map((rule) => ({ ...rule, enabled })),
    );
  }

  for (const [tail, enabled] of spacingEnabled) {
    rebuilt.push(
      ...buildCompoundSpacingRules(tail).map((rule) => ({ ...rule, enabled })),
    );
  }

  return [...others, ...rebuilt];
}

/**
 * @param {import('./ruleTypes.js').Rule[]} customRules
 * @param {number} [storedVersion]
 * @returns {{ rules: import('./ruleTypes.js').Rule[], version: number }}
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

/** @deprecated applyCompoundRuleMigrations 사용 */
export function migrateCompoundRules(customRules) {
  return applyCompoundRuleMigrations(customRules, 0).rules;
}
