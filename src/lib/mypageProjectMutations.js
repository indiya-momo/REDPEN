import {
  canAddCriteriaPreset,
  CRITERIA_PRESET_LIMIT_MESSAGE,
} from './criteriaPresetLimit.js';
import { planCriteriaPresetDelete } from './criteriaPresetDelete.js';
import { criteriaNameForSave } from './criteriaName.js';
import {
  defaultCautionEnabled,
} from './cautionRules.js';
import { builtInEnabledFromSheet } from './builtInRules.js';
import { normalizeRuleSet } from './ruleSetNormalize.js';
import {
  duplicateRuleSet,
  newId,
} from './ruleSetsStorage.js';

/** @returns {import('./ruleSetsStorage.js').RuleSet} */
export function createDefaultRuleSet() {
  return normalizeRuleSet({
    id: newId(),
    name: '',
    builtInEnabled: builtInEnabledFromSheet(),
    customRules: [],
    globalExcludePhrases: [],
    cautionEnabled: defaultCautionEnabled(),
  });
}

/**
 * @param {import('./ruleSetsStorage.js').RuleSet[]} sets
 * @param {string} setId
 * @param {string} rawName
 */
export function planRenameProject(sets, setId, rawName) {
  const name = criteriaNameForSave(rawName);
  if (!name) return { ok: false, reason: 'empty_name' };

  const index = sets.findIndex((set) => set.id === setId);
  if (index < 0) return { ok: false, reason: 'not_found' };

  const current = sets[index];
  if (!current.savedAt) return { ok: false, reason: 'not_saved' };

  const trimmedCurrent = (current.name || '').trim();
  if (trimmedCurrent === name) {
    return { ok: true, next: sets, label: name, unchanged: true };
  }

  const conflict = sets.find(
    (set) => set.id !== setId && (set.name || '').trim() === name,
  );
  if (conflict) return { ok: false, reason: 'duplicate_name' };

  const next = sets.map((set, i) =>
    i === index ? normalizeRuleSet({ ...set, name }) : set,
  );
  return { ok: true, next, label: name, unchanged: false };
}

/**
 * @param {import('./ruleSetsStorage.js').RuleSet[]} sets
 * @param {string} setId
 * @param {string} [uid]
 * @param {string} [email]
 */
export function planDuplicateProject(sets, setId, uid = '', email = '') {
  const source = sets.find((set) => set.id === setId);
  if (!source) return { ok: false, reason: 'not_found' };
  if (!source.savedAt) return { ok: false, reason: 'not_saved' };

  const copy = normalizeRuleSet({
    ...duplicateRuleSet(source),
    savedAt: new Date().toISOString(),
  });

  if (!canAddCriteriaPreset(sets, copy.name, uid, email)) {
    return {
      ok: false,
      reason: 'slot_limit',
      message: CRITERIA_PRESET_LIMIT_MESSAGE,
    };
  }

  return {
    ok: true,
    next: [...sets, copy],
    newSetId: copy.id,
    label: copy.name,
  };
}

/**
 * @param {import('./ruleSetsStorage.js').RuleSet[]} sets
 * @param {string | null} activeId
 * @param {string} setId
 */
export function planDeleteProject(sets, activeId, setId) {
  const plan = planCriteriaPresetDelete(sets, activeId ?? '', setId);
  if (!plan.ok) return plan;

  if (!plan.needsDefault) {
    return {
      ok: true,
      next: plan.next,
      nextActiveId: plan.nextActiveId,
      label: plan.label,
    };
  }

  const fresh = createDefaultRuleSet();
  return {
    ok: true,
    next: [fresh],
    nextActiveId: fresh.id,
    label: plan.label,
  };
}
