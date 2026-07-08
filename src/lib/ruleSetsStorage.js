export const RULE_SETS_STORAGE_KEY = 'pdf-proofread-rule-sets';
export const RULE_SETS_ACTIVE_KEY = 'pdf-proofread-active-set-id';
/** 같은 탭 내 메인·마이페이지 동기화용 (storage 이벤트는 다른 탭만 발생) */
export const RULE_SETS_LOCAL_SYNC_EVENT = 'pdf-proofread-rule-sets-local-updated';

/**
 * @param {string | undefined} uid
 */
export function notifyRuleSetsLocalUpdated(uid) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(RULE_SETS_LOCAL_SYNC_EVENT, {
      detail: { uid: String(uid ?? '').trim() },
    }),
  );
}

const LEGACY_RULE_SETS_KEY = RULE_SETS_STORAGE_KEY;
const LEGACY_ACTIVE_KEY = RULE_SETS_ACTIVE_KEY;

/**
 * @param {string | undefined} uid
 */
export function ruleSetsStorageKey(uid) {
  const id = String(uid ?? '').trim();
  if (!id) return LEGACY_RULE_SETS_KEY;
  return `${RULE_SETS_STORAGE_KEY}:${id}`;
}

/**
 * @param {string | undefined} uid
 */
export function ruleSetsActiveStorageKey(uid) {
  const id = String(uid ?? '').trim();
  if (!id) return LEGACY_ACTIVE_KEY;
  return `${RULE_SETS_ACTIVE_KEY}:${id}`;
}

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
 *   tags?: string[],
 *   memo?: string,
 *   metaUpdatedAt?: string,
 *   projectContext?: import('./projectMeta.js').ProjectContext,
 *   workHistory?: import('./projectWorkHistory.js').WorkHistoryEntry[],
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

/** @param {string} key */
function readRuleSetsFromKey(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((set) => ({ ...(set ?? {}) }));
  } catch {
    return [];
  }
}

/**
 * 로그인 전 공용(legacy) 키 → uid별 키로 1회 이전
 * @param {string} uid
 */
export function migrateLegacyRuleSetsToUid(uid) {
  const id = String(uid ?? '').trim();
  if (!id) return [];

  const scopedKey = ruleSetsStorageKey(id);
  const existing = readRuleSetsFromKey(scopedKey);
  if (existing.length) return existing;

  const legacy = readRuleSetsFromKey(LEGACY_RULE_SETS_KEY);
  if (!legacy.length) return [];

  saveRuleSets(legacy, id);
  const legacyActive = localStorage.getItem(LEGACY_ACTIVE_KEY);
  if (legacyActive) {
    saveActiveSetId(legacyActive, id);
  }
  return legacy.map((set) => ({ ...set }));
}

/**
 * @param {string | undefined} [uid]
 * @returns {RuleSet[]}
 */
export function loadRuleSets(uid) {
  const id = String(uid ?? '').trim();
  if (id) {
    const scoped = readRuleSetsFromKey(ruleSetsStorageKey(id));
    if (scoped.length) return scoped;
    return migrateLegacyRuleSetsToUid(id);
  }
  return readRuleSetsFromKey(LEGACY_RULE_SETS_KEY);
}

/**
 * @param {RuleSet[]} sets
 * @param {string | undefined} [uid]
 */
export function saveRuleSets(sets, uid) {
  localStorage.setItem(ruleSetsStorageKey(uid), JSON.stringify(sets));
  notifyRuleSetsLocalUpdated(uid);
}

/**
 * @param {string | undefined} [uid]
 * @returns {string | null}
 */
export function loadActiveSetId(uid) {
  return localStorage.getItem(ruleSetsActiveStorageKey(uid));
}

/**
 * @param {string} id
 * @param {string | undefined} [uid]
 */
export function saveActiveSetId(id, uid) {
  localStorage.setItem(ruleSetsActiveStorageKey(uid), id);
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
    tags: structuredClone(source.tags ?? []),
    memo: source.memo,
    projectContext: source.projectContext
      ? structuredClone(source.projectContext)
      : undefined,
  };
}
