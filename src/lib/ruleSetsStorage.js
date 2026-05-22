const STORAGE_KEY = 'pdf-proofread-rule-sets';
const ACTIVE_KEY = 'pdf-proofread-active-set-id';

/**
 * @typedef {{ id: string, name: string, builtInEnabled: Record<string, boolean>, customRules: import('./builtInRules.js').Rule[] }} RuleSet
 */

/** @returns {RuleSet[]} */
export function loadRuleSets() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** @param {RuleSet[]} sets */
export function saveRuleSets(sets) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sets));
}

/** @returns {string | null} */
export function loadActiveSetId() {
  return localStorage.getItem(ACTIVE_KEY);
}

/** @param {string} id */
export function saveActiveSetId(id) {
  localStorage.setItem(ACTIVE_KEY, id);
}

/** @returns {string} */
export function newId() {
  return `set_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
