import {
  toggleAuxiliaryVerbEntry,
  listAuxiliaryVerbEntries,
} from '../../lib/auxiliaryVerbRegister.js';
import {
  BUILT_IN_QUOTA_RULES,
  builtInEnabledFromSheet,
  builtInEnabledKey,
  SPELLING_RULES_FP,
} from '../../lib/builtInRules.js';
import {
  CAUTION_RULES,
  CAUTION_RULES_FP,
  CAUTION_ENABLED_POLICY_VERSION,
  defaultCautionEnabled,
} from '../../lib/cautionRules.js';
import { BON_BOJO_RULES_FP } from '../../lib/bonBojoRules.js';
import {
  buildRulesForEntry,
  toggleConsistencyEntry,
} from '../../lib/compoundPairRegister.js';
import {
  buildRulesForPhraseSlot,
  togglePhraseSlotEntry,
} from '../../lib/phraseSlotRegister.js';
import { mergeProjectContext } from '../../lib/projectMeta.js';
import { planProjectCriteriaUpdate } from '../../lib/projectCriteriaUpdate.js';
import { planRenameProject } from '../../lib/mypageProjectMutations.js';
import { normalizeRuleSet } from '../../lib/ruleSetNormalize.js';
import {
  duplicateRuleSet,
  newId,
} from '../../lib/ruleSetsStorage.js';
import { buildSortedProjectCards } from '../../lib/projectHubCards.js';

/**
 * @param {number} activeCount
 */
function pickBuiltInEnabled(activeCount) {
  const map = builtInEnabledFromSheet();
  for (const rule of BUILT_IN_QUOTA_RULES) {
    map[builtInEnabledKey(rule)] = false;
  }
  for (let i = 0; i < activeCount && i < BUILT_IN_QUOTA_RULES.length; i += 1) {
    map[builtInEnabledKey(BUILT_IN_QUOTA_RULES[i])] = true;
  }
  return map;
}

/**
 * @param {number} activeCount
 */
function pickCautionEnabled(activeCount) {
  const map = defaultCautionEnabled();
  for (const rule of CAUTION_RULES) {
    map[rule.id] = false;
  }
  for (let i = 0; i < activeCount && i < CAUTION_RULES.length; i += 1) {
    map[CAUTION_RULES[i].id] = true;
  }
  return map;
}

/**
 * @param {{
 *   consistencyFind?: string[],
 *   phraseSlots?: string[],
 * }} spec
 */
function buildNonAuxCustomRules(spec) {
  let rules = [];

  for (const tailWord of spec.consistencyFind ?? []) {
    rules = [...rules, ...buildRulesForEntry(rules, tailWord)];
    rules = toggleConsistencyEntry(rules, tailWord, true);
  }

  for (const pattern of spec.phraseSlots ?? []) {
    const batch = buildRulesForPhraseSlot(rules, pattern);
    if (!batch.length) continue;
    rules = [...rules, ...batch];
    rules = togglePhraseSlotEntry(rules, pattern, true);
  }

  return rules;
}

/**
 * @param {import('../../lib/ruleSetsStorage.js').RuleSet} ruleSet
 * @param {string[]} itemIds
 */
function applyAuxiliaryItemSelection(ruleSet, itemIds) {
  const enabled = new Set(itemIds);
  let rules = ruleSet.customRules ?? [];

  for (const entry of listAuxiliaryVerbEntries(rules)) {
    if (!entry.bonBojoItemId) continue;
    rules = toggleAuxiliaryVerbEntry(
      rules,
      entry,
      enabled.has(entry.bonBojoItemId),
    );
  }

  return { ...ruleSet, customRules: rules };
}

/**
 * @param {import('../../lib/ruleSetsStorage.js').RuleSet} base
 * @param {{
 *   auxiliaryItemIds?: string[],
 *   consistencyFind?: string[],
 *   phraseSlots?: string[],
 * }} spec
 * @returns {import('../../lib/ruleSetsStorage.js').RuleSet}
 */
function buildMockRuleSet(base, spec = {}) {
  let set = normalizeRuleSet({
    ...base,
    savedAt: base.savedAt ?? new Date().toISOString(),
    globalExcludePhrases: base.globalExcludePhrases ?? [],
    spellingRulesFingerprint: SPELLING_RULES_FP,
    cautionRulesFingerprint: CAUTION_RULES_FP,
    cautionEnabledPolicyVersion: CAUTION_ENABLED_POLICY_VERSION,
    bonBojoRulesFingerprint: BON_BOJO_RULES_FP,
    customRules: buildNonAuxCustomRules(spec),
  });

  if (spec.auxiliaryItemIds !== undefined) {
    set = applyAuxiliaryItemSelection(set, spec.auxiliaryItemIds);
  }

  return set;
}

/** @type {import('../../lib/ruleSetsStorage.js').RuleSet[]} */
export const MOCK_PROJECT_RULE_SETS = [
  buildMockRuleSet(
    {
      id: 'proj-1',
      name: '검수냥 모모 이야기2',
      tags: ['문학', '시리즈 2/5'],
      memo: '띄어쓰기·외래어 표기 강화. 1권과 「그러나」 통일.',
      savedAt: '2026-06-15T09:00:00.000Z',
      builtInEnabled: pickBuiltInEnabled(12),
      cautionEnabled: pickCautionEnabled(3),
      projectContext: {
        lastWorkedAt: '2026-06-20T12:00:00.000Z',
        pdfPageCount: 312,
        proofRevision: '3교',
        formatLabel: '신국판',
      },
    },
    {
      auxiliaryItemIds: [
        'verb-hada',
        'verb-jida',
        'verb-notda',
        'verb-duda',
        'verb-boda1',
        'verb-gada',
        'verb-oda',
        'verb-itta',
      ],
      consistencyFind: ['그러나', '한번', '붉은표시', '빨간표시'],
      phraseSlots: ['@시대'],
    },
  ),
  buildMockRuleSet(
    {
      id: 'proj-3',
      name: '에세이 시리즈 1권',
      tags: ['문학'],
      savedAt: '2026-05-20T09:00:00.000Z',
      builtInEnabled: pickBuiltInEnabled(5),
      cautionEnabled: pickCautionEnabled(1),
      projectContext: {
        lastWorkedAt: '2026-06-01T12:00:00.000Z',
        pdfPageCount: 198,
        proofRevision: '2교',
      },
    },
    {
      auxiliaryItemIds: ['verb-hada', 'verb-jida', 'verb-itta'],
      consistencyFind: ['그러나', '그런데'],
      phraseSlots: [],
    },
  ),
];

/** 목업 시드 버전 — 바뀌면 sessionStorage 초기화 키도 맞춘다 */
export const MOCK_PROJECT_SEED_VERSION = 'phrase-slot-1';

/**
 * @param {import('../../lib/ruleSetsStorage.js').RuleSet[]} projects
 * @param {{ activeId?: string | null, dirtyIds?: Set<string> }} [options]
 */
export function buildMockProjectCards(projects, options = {}) {
  const { activeId = null, dirtyIds = new Set() } = options;
  return buildSortedProjectCards(projects, activeId).map((card) =>
    dirtyIds.has(card.id) ? { ...card, dirty: true } : card,
  );
}

/**
 * @param {import('../../lib/ruleSetsStorage.js').RuleSet[]} projects
 * @param {string} sourceId
 */
export function duplicateMockProject(projects, sourceId) {
  const source = projects.find((set) => set.id === sourceId);
  if (!source) return projects;
  const copy = normalizeRuleSet({
    ...duplicateRuleSet(source),
    id: newId(),
    savedAt: new Date().toISOString(),
  });
  return [...projects, copy];
}

/**
 * @param {import('../../lib/ruleSetsStorage.js').RuleSet[]} projects
 * @param {string} id
 * @param {{
 *   name?: string,
 *   tags?: string[],
 *   memo?: string,
 *   proofRevision?: string,
 *   formatLabel?: string,
 * }} patch
 */
export function applyMockProjectMeta(projects, id, patch) {
  let next = projects;
  if (patch.name !== undefined) {
    const plan = planRenameProject(next, id, patch.name);
    if (!plan.ok) return next;
    next = plan.next;
  }

  return next.map((set) => {
    if (set.id !== id) return set;
    const projectContext =
      patch.proofRevision !== undefined || patch.formatLabel !== undefined
        ? mergeProjectContext(set.projectContext, {
            ...(patch.proofRevision !== undefined
              ? { proofRevision: patch.proofRevision }
              : {}),
            ...(patch.formatLabel !== undefined
              ? { formatLabel: patch.formatLabel }
              : {}),
          })
        : set.projectContext;

    return normalizeRuleSet({
      ...set,
      ...(patch.tags !== undefined ? { tags: patch.tags } : {}),
      ...(patch.memo !== undefined ? { memo: patch.memo } : {}),
      ...(projectContext !== undefined ? { projectContext } : {}),
    });
  });
}

/**
 * @param {import('../../lib/ruleSetsStorage.js').RuleSet[]} projects
 * @param {string} id
 * @param {{
 *   customRules?: import('../../lib/ruleTypes.js').Rule[],
 *   builtInEnabled?: Record<string, boolean>,
 *   cautionEnabled?: Record<string, boolean>,
 * }} patch
 */
export function applyMockProjectCriteria(projects, id, patch) {
  const current = projects.find((set) => set.id === id);
  if (!current) return projects;

  const plan = planProjectCriteriaUpdate(current, patch);
  if (!plan.ok) return projects;

  return projects.map((set) =>
    set.id === id
      ? normalizeRuleSet({ ...set, ...plan.patch })
      : set,
  );
}
