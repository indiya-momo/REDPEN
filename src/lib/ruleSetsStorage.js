const STORAGE_KEY = 'pdf-proofread-rule-sets';
const ACTIVE_KEY = 'pdf-proofread-active-set-id';

/**
 * @typedef {{
 *   id: string,
 *   name: string,
 *   builtInEnabled: Record<string, boolean>,
 *   cautionEnabled: Record<string, boolean>,
 *   customRules: import('./ruleTypes.js').Rule[],
 *   globalExcludePhrases?: string[],
 *   spellingRulesFingerprint?: string,
 *   cautionRulesFingerprint?: string,
 *   cautionEnabledPolicyVersion?: number,
 *   compoundMigrateVersion?: number,
 *   savedAt?: string,
 * }} RuleSet
 */

/**
 * @param {string | undefined} iso
 */
export function formatRuleSetSavedDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear() % 100;
  return `${y}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

/**
 * @param {{
 *   savedAt?: string,
 *   builtInRuleCount: number,
 *   builtInGuideRuleCount?: number,
 *   spacingRuleCount: number,
 *   consistencyRuleCount: number,
 * }} input
 */
export function formatRuleSetSummary({
  savedAt,
  builtInRuleCount,
  builtInGuideRuleCount = 0,
  spacingRuleCount,
  consistencyRuleCount,
}) {
  const date = formatRuleSetSavedDate(savedAt);
  const counts = `맞춤법 확인 ${builtInRuleCount} · 규칙 제외 ${builtInGuideRuleCount} · 편집자 검토 ${spacingRuleCount} · 일관성 ${consistencyRuleCount}`;
  return date ? `${date} ${counts}` : counts;
}

/** @returns {RuleSet[]} */
export function loadRuleSets() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((set) => ({ ...(set ?? {}) }));
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

/**
 * @param {RuleSet} source
 * @returns {Omit<RuleSet, 'id'> & { id: string }}
 */
export function duplicateRuleSet(source) {
  const baseName = (source.name || '규칙 세트').trim() || '규칙 세트';
  return {
    id: newId(),
    name: `${baseName} (복사)`,
    builtInEnabled: structuredClone(source.builtInEnabled ?? {}),
    cautionEnabled: structuredClone(source.cautionEnabled ?? {}),
    customRules: structuredClone(source.customRules ?? []),
    globalExcludePhrases: [...(source.globalExcludePhrases ?? [])],
    cautionRulesFingerprint: source.cautionRulesFingerprint,
    cautionEnabledPolicyVersion: source.cautionEnabledPolicyVersion,
    compoundMigrateVersion: source.compoundMigrateVersion,
    spellingRulesFingerprint: source.spellingRulesFingerprint,
    savedAt: source.savedAt,
  };
}
