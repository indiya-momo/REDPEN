import {
  canAddCriteriaPreset,
  formatCriteriaPresetLimitMessage,
  getMaxCriteriaPresets,
} from './criteriaPresetLimit.js';
import { planCriteriaPresetDelete } from './criteriaPresetDelete.js';
import { criteriaNameForSave } from './criteriaName.js';
import {
  defaultCautionEnabled,
} from './cautionRules.js';
import { builtInEnabledFromSheet } from './builtInRules.js';
import { normalizeRuleSet } from './ruleSetNormalize.js';
import { buildCriteriaCheckpoint } from './criteriaCheckpoint.js';
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
 * 원본 이름 뒤의 `(숫자)`를 떼어 기준 이름을 얻는다. 예: `원고(2)` → `원고`
 * @param {string} name
 */
function stripDuplicateSuffix(name) {
  return String(name ?? '')
    .trim()
    .replace(/\s*\(\d+\)\s*$/, '')
    .trim();
}

/**
 * 복사본 이름을 `원본(1)`, 이미 있으면 `원본(2)`… 로 정한다.
 * @param {import('./ruleSetsStorage.js').RuleSet[]} sets
 * @param {string} sourceName
 */
export function nextDuplicateName(sets, sourceName) {
  const base = stripDuplicateSuffix(sourceName) || '규칙 세트';
  const used = new Set(
    (sets ?? []).map((set) => String(set.name ?? '').trim()),
  );
  let index = 1;
  while (used.has(`${base}(${index})`)) index += 1;
  return `${base}(${index})`;
}

/**
 * 복사본을 목록 맨 끝(가장 오래된 위치)에 두기 위한 정렬용 savedAt.
 * 카드의 "작업일" 배지는 projectContext.lastWorkedAt를 쓰므로 영향 없음.
 * @param {import('./ruleSetsStorage.js').RuleSet[]} sets
 */
function savedAtForListEnd(sets) {
  const times = (sets ?? [])
    .map((set) => Date.parse(set.savedAt ?? ''))
    .filter((ms) => !Number.isNaN(ms));
  if (!times.length) return new Date().toISOString();
  return new Date(Math.min(...times) - 1000).toISOString();
}

/**
 * @param {import('./ruleSetsStorage.js').RuleSet[]} sets
 * @param {string} setId
 * @param {string} [uid]
 * @param {string} [email]
 * @param {unknown} [plan] 유료 슬롯 판정용 — 없으면 localStorage
 */
export function planDuplicateProject(sets, setId, uid = '', email = '', plan) {
  const source = sets.find((set) => set.id === setId);
  if (!source) return { ok: false, reason: 'not_found' };
  if (!source.savedAt) return { ok: false, reason: 'not_saved' };

  const duped = duplicateRuleSet(source);
  const duplicatedAt = new Date().toISOString();
  const copy = normalizeRuleSet({
    ...duped,
    name: nextDuplicateName(sets, source.name),
    // 정렬(목록 맨 끝)용 — 화면 "작업일" 배지와는 별개
    savedAt: savedAtForListEnd(sets),
    // 복제도 하나의 작업 → "작업일" 배지는 복제한 시각으로 표시
    projectContext: {
      ...(duped.projectContext ?? {}),
      lastWorkedAt: duplicatedAt,
    },
  });
  const copyWithCheckpoint = normalizeRuleSet({
    ...copy,
    criteriaCheckpoint: buildCriteriaCheckpoint(copy),
  });

  if (!canAddCriteriaPreset(sets, copyWithCheckpoint.name, uid, email, plan)) {
    const maxSlots = getMaxCriteriaPresets(uid, email, plan);
    return {
      ok: false,
      reason: 'slot_limit',
      message: formatCriteriaPresetLimitMessage(maxSlots),
    };
  }

  return {
    ok: true,
    next: [...sets, copyWithCheckpoint],
    newSetId: copyWithCheckpoint.id,
    label: copyWithCheckpoint.name,
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
