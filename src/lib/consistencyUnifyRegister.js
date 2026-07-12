import { removeCompoundFind } from './compoundFindPattern.js';
import { normalizeConsistencyVariant } from './compoundPairRegister.js';
import { decodeSpacesVisible } from './spaceVisibleText.js';

const COMPOUND_KINDS = new Set([
  'compound-find',
  'compound-tail',
  'compound-spacing',
]);

/**
 * 결과 그룹에서 등록 문자열(tailWord)을 복원한다.
 * @param {import('./ruleEngine.js').GroupedResult | { tailWord?: string, label?: string, find?: string }} group
 */
export function resolveConsistencyGroupTailWord(group) {
  const direct = String(group?.tailWord ?? '').trim();
  if (direct) return normalizeConsistencyVariant(direct);

  const label = String(group?.label ?? '').trim();
  if (label) {
    const arrow = label.indexOf(' → ');
    const raw = arrow >= 0 ? label.slice(0, arrow).trim() : label;
    if (raw && !raw.startsWith('(?') && !raw.includes('$0')) {
      return normalizeConsistencyVariant(decodeSpacesVisible(raw));
    }
  }

  const find = String(group?.find ?? '').trim();
  if (find && !find.startsWith('(?') && !find.includes('\\s') && !find.includes('$')) {
    return normalizeConsistencyVariant(decodeSpacesVisible(find));
  }

  return '';
}

/**
 * @param {import('./ruleTypes.js').Rule[]} customRules
 * @param {string} [tailWord]
 */
export function isConsistencyUnifyTailWord(customRules, tailWord) {
  const tail = normalizeConsistencyVariant(tailWord);
  if (!tail) return false;
  return customRules.some((rule) => {
    if (!COMPOUND_KINDS.has(rule.patternKind ?? '')) return false;
    if (normalizeConsistencyVariant(rule.tailWord) !== tail) return false;
    return (
      rule.consistencyUnifyEntry === true ||
      rule.consistencyUnifyPinned === true
    );
  });
}

/**
 * @param {import('./ruleTypes.js').Rule[]} customRules
 * @param {import('./ruleEngine.js').GroupedResult | { tailWord?: string, label?: string, find?: string }} group
 */
export function isConsistencyUnifyResultGroup(customRules, group) {
  return isConsistencyUnifyTailWord(
    customRules,
    resolveConsistencyGroupTailWord(group),
  );
}

/**
 * @typedef {{ correction: string, unified: string }} ConsistencyUnifyMapping
 */

/**
 * @param {import('./ruleTypes.js').Rule[]} rules
 * @returns {ConsistencyUnifyMapping[]}
 */
export function listConsistencyUnifyMappings(rules) {
  /** @type {Map<string, string>} */
  const byCorrection = new Map();

  for (const rule of rules) {
    if (!COMPOUND_KINDS.has(rule.patternKind ?? '')) continue;
    const correction = rule.tailWord?.trim();
    const unified = String(rule.overlayReplace ?? '').trim();
    if (!correction || !unified) continue;
    byCorrection.set(correction, unified);
  }

  return [...byCorrection.entries()]
    .map(([correction, unified]) => ({ correction, unified }))
    .sort((a, b) => a.correction.localeCompare(b.correction, 'ko'));
}

/**
 * @param {import('./ruleTypes.js').Rule[]} rules
 * @param {string} correctionRaw
 * @param {string} unifiedRaw
 */
export function setConsistencyUnifyOverlay(rules, correctionRaw, unifiedRaw) {
  const correction = normalizeConsistencyVariant(correctionRaw);
  const unified = unifiedRaw.trim();
  if (!correction || !unified) return rules;

  return rules.map((rule) => {
    if (!COMPOUND_KINDS.has(rule.patternKind ?? '')) return rule;
    if (normalizeConsistencyVariant(rule.tailWord) !== correction) return rule;
    return { ...rule, overlayReplace: unified };
  });
}

/**
 * @param {import('./ruleTypes.js').Rule[]} rules
 * @param {string} correctionRaw
 */
export function clearConsistencyUnifyOverlay(rules, correctionRaw) {
  const correction = normalizeConsistencyVariant(correctionRaw);
  if (!correction) return rules;

  return rules.map((rule) => {
    if (!COMPOUND_KINDS.has(rule.patternKind ?? '')) return rule;
    if (normalizeConsistencyVariant(rule.tailWord) !== correction) return rule;
    const next = { ...rule };
    delete next.overlayReplace;
    return next;
  });
}

/**
 * @param {import('./ruleTypes.js').Rule[]} customRules
 * @param {import('./ruleEngine.js').GroupedResult} group
 * @returns {string | null}
 */
export function getConsistencyUnifyOverlayForGroup(customRules, group) {
  const tail = resolveConsistencyGroupTailWord(group);
  if (!tail) return null;
  if (!isConsistencyUnifyTailWord(customRules, tail)) return null;

  const pinned = getConsistencyUnifyPinnedTailWord(customRules);
  // 확정형(📌) 본문은 원고에 오버레이를 띄우지 않는다
  if (pinned && pinned === tail) return null;
  if (pinned) return `→ ${pinned} 📌`;

  for (const rule of customRules) {
    if (!COMPOUND_KINDS.has(rule.patternKind ?? '')) continue;
    if (normalizeConsistencyVariant(rule.tailWord) !== tail) continue;
    const text = String(rule.overlayReplace ?? '').trim();
    if (text) return text;
  }
  return null;
}

/**
 * @param {import('./ruleTypes.js').Rule[]} rules
 * @returns {string | null}
 */
export function getConsistencyUnifyPinnedTailWord(rules) {
  for (const rule of rules) {
    if (!rule.consistencyUnifyPinned) continue;
    const tailWord = normalizeConsistencyVariant(rule.tailWord);
    if (tailWord) return tailWord;
  }
  return null;
}

/**
 * @param {import('./ruleTypes.js').Rule[]} rules
 */
export function clearConsistencyUnifyPinState(rules) {
  return rules.map((rule) => {
    if (!rule.consistencyUnifyEntry) return rule;
    const next = { ...rule };
    delete next.consistencyUnifyPinned;
    delete next.overlayReplace;
    return next;
  });
}

/**
 * 통일형 📌 1개만 — 같은 항목 재클릭 시 해제
 *
 * @param {import('./ruleTypes.js').Rule[]} rules
 * @param {string} targetTailWordRaw
 */
export function applyConsistencyUnifyPin(rules, targetTailWordRaw) {
  const target = normalizeConsistencyVariant(targetTailWordRaw);
  if (!target) return rules;

  const current = getConsistencyUnifyPinnedTailWord(rules);
  if (current === target) {
    return clearConsistencyUnifyPinState(rules);
  }

  return rules.map((rule) => {
    if (!rule.consistencyUnifyEntry) return rule;
    const tailWord = normalizeConsistencyVariant(rule.tailWord);
    if (!tailWord) return rule;

    if (tailWord === target) {
      const next = { ...rule, consistencyUnifyPinned: true };
      delete next.overlayReplace;
      return next;
    }

    return {
      ...rule,
      consistencyUnifyPinned: false,
      overlayReplace: target,
    };
  });
}

/**
 * @param {import('./ruleTypes.js').Rule[]} rules
 * @param {string} tailWordRaw
 */
export function removeConsistencyUnifyEntry(rules, tailWordRaw) {
  const tailWord = normalizeConsistencyVariant(tailWordRaw);
  if (!tailWord) return rules;

  const pinnedBefore = getConsistencyUnifyPinnedTailWord(rules);
  let next = removeCompoundFind(rules, tailWord);

  if (pinnedBefore === tailWord) {
    next = clearConsistencyUnifyPinState(next);
  }

  return next;
}
