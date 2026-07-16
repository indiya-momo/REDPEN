import spellingRulesJson from '../data/spelling-rules.json';
import { MAX_RULES } from './ruleTypes.js';
import { isLoanwordSpellingRule } from './loanwordCheckRules.js';
import {
  buildSpellingCheckRuleFromBuiltIn,
  builtInEnabledKey,
  hasSpellingFindVariants,
} from './spellingRuleEntry.js';

function spellingRowFingerprintPart(row) {
  const finds =
    row.finds?.length >= 2 ? row.finds.join('\u0001') : '';
  return `${row.find}\0${row.replace}\0${row.tip ?? ''}\0${
    row.enabled === true ? 1 : 0
  }\0${row.countsInQuota === false ? 0 : 1}\0${
    row.visible === false ? 0 : 1
  }\0${row.dividerGroup ?? ''}\0${row.dividerLabel ?? ''}\0${
    row.overlayReplace ?? ''
  }\0${row.ruleId ?? ''}\0${finds}\0${row.displayLabel ?? ''}`;
}

/** @param {typeof spellingRulesJson} rows */
export function spellingRulesFingerprint(rows = spellingRulesJson) {
  let hash = 0;
  const payload = rows.map(spellingRowFingerprintPart).join('\n');
  for (let i = 0; i < payload.length; i += 1) {
    hash = (Math.imul(31, hash) + payload.charCodeAt(i)) | 0;
  }
  return `${rows.length}:${hash}`;
}

/** @param {import('./ruleTypes.js').Rule} rule */
export function countsTowardSpellingQuota(rule) {
  return rule.countsInQuota !== false;
}

/** @param {typeof spellingRulesJson[number]} row */
function builtInRuleFromRow(row) {
  const fromSheet = row.countsInQuota !== false;
  const finds =
    row.finds?.filter((f) => String(f ?? '').trim()).length >= 2
      ? row.finds.map((f) => String(f).trim())
      : undefined;
  const ruleId = String(row.ruleId ?? '').trim() || undefined;
  const displayLabel = String(row.displayLabel ?? '').trim() || undefined;

  return {
    find: row.find,
    replace: row.replace,
    enabled: row.enabled === true,
    builtIn: true,
    tip: String(row.tip ?? '').trim(),
    memo: String(row.memo ?? '').trim(),
    countsInQuota: fromSheet,
    visible: row.visible !== false,
    dividerGroup: String(row.dividerGroup ?? '').trim() || undefined,
    ...(row.dividerLabel
      ? { dividerLabel: String(row.dividerLabel).trim() }
      : {}),
    ...(row.overlayReplace
      ? { overlayReplace: String(row.overlayReplace).trim() }
      : {}),
    ...(ruleId ? { ruleId } : {}),
    ...(finds ? { finds } : {}),
    ...(displayLabel ? { displayLabel } : {}),
    ...(row.find === '쳐지' ? { requireLeadingBoundary: true } : {}),
  };
}

/** @param {import('./ruleTypes.js').Rule} rule */
export function isBuiltInRuleVisible(rule) {
  return rule.visible !== false;
}

/** @type {import('./ruleTypes.js').Rule[]} */
export const BUILT_IN_RULES = spellingRulesJson.map(builtInRuleFromRow);

export const BUILT_IN_QUOTA_RULES = BUILT_IN_RULES.filter(countsTowardSpellingQuota);

export const BUILT_IN_GUIDE_RULES = BUILT_IN_RULES.filter(
  (r) => !countsTowardSpellingQuota(r),
);

export const BUILT_IN_QUOTA_RULES_UI = BUILT_IN_QUOTA_RULES.filter(
  isBuiltInRuleVisible,
);

export const BUILT_IN_GUIDE_RULES_UI = BUILT_IN_GUIDE_RULES.filter(
  isBuiltInRuleVisible,
);

/** 외래어 표기법 구분 — 묶음 이름이 "외래어 표기법(…)"인 내장 규칙 */
export const LOANWORD_QUOTA_RULES = BUILT_IN_QUOTA_RULES.filter(
  isLoanwordSpellingRule,
);

/** 맞춤법 규칙 구분 — 외래어 표기법 묶음을 뺀 나머지 내장 규칙 */
export const SPELLING_QUOTA_RULES = BUILT_IN_QUOTA_RULES.filter(
  (r) => !isLoanwordSpellingRule(r),
);

export const LOANWORD_QUOTA_RULES_UI = LOANWORD_QUOTA_RULES.filter(
  isBuiltInRuleVisible,
);

export const SPELLING_QUOTA_RULES_UI = SPELLING_QUOTA_RULES.filter(
  isBuiltInRuleVisible,
);

export const SPELLING_RULES_FP = spellingRulesFingerprint();

export { builtInEnabledKey, buildSpellingCheckRuleFromBuiltIn, hasSpellingFindVariants };

export function builtInEnabledFromSheet() {
  return Object.fromEntries(
    BUILT_IN_RULES.map((r) => [builtInEnabledKey(r), r.enabled === true]),
  );
}

/**
 * @param {Record<string, boolean>} [saved]
 * @param {string | null | undefined} [savedFingerprint]
 */
export function migrateBuiltInEnabled(saved = {}, savedFingerprint = null) {
  const defaults = builtInEnabledFromSheet();
  if (savedFingerprint !== SPELLING_RULES_FP) {
    return defaults;
  }
  const merged = { ...defaults };
  for (const r of BUILT_IN_RULES) {
    const key = builtInEnabledKey(r);
    if (Object.prototype.hasOwnProperty.call(saved, key)) {
      merged[key] = saved[key] === true;
      continue;
    }
    if (hasSpellingFindVariants(r)) {
      const legacyOn = (r.finds ?? []).some((f) => saved[f] === true);
      if (legacyOn) merged[key] = true;
      continue;
    }
    if (Object.prototype.hasOwnProperty.call(saved, r.find)) {
      merged[r.find] = saved[r.find] === true;
    }
  }
  return merged;
}

/**
 * @param {Record<string, boolean>} builtInEnabled
 * @param {import('./ruleTypes.js').Rule | string} ruleOrKey
 */
export function isBuiltInRuleEnabled(builtInEnabled, ruleOrKey) {
  const key =
    typeof ruleOrKey === 'string'
      ? ruleOrKey
      : builtInEnabledKey(/** @type {import('./ruleTypes.js').Rule} */ (ruleOrKey));
  return builtInEnabled[key] === true;
}

const tipLookup = new Map(
  spellingRulesJson.map((row) => [
    `${row.find}\0${row.replace}`,
    String(row.tip ?? '').trim(),
  ]),
);

const tipByRuleId = new Map(
  spellingRulesJson.flatMap((row) => {
    const id = String(row.ruleId ?? '').trim();
    const tip = String(row.tip ?? '').trim();
    if (!id || !tip) return [];
    return [[id, tip]];
  }),
);

/** @param {string} find @param {string} replace @param {string} [spellingRuleId] */
export function getBuiltInTip(find, replace, spellingRuleId) {
  const id = String(spellingRuleId ?? '').trim();
  if (id && tipByRuleId.has(id)) return tipByRuleId.get(id) ?? '';
  return tipLookup.get(`${find}\0${replace}`) ?? '';
}

const overlayReplaceLookup = new Map(
  spellingRulesJson.flatMap((row) => {
    const text = String(row.overlayReplace ?? '').trim();
    if (!text) return [];
    return [[`${row.find}\0${row.replace}`, text]];
  }),
);

const overlayByRuleId = new Map(
  spellingRulesJson.flatMap((row) => {
    const id = String(row.ruleId ?? '').trim();
    const text = String(row.overlayReplace ?? '').trim();
    if (!id || !text) return [];
    return [[id, text]];
  }),
);

/** @param {string} find @param {string} replace @param {string} [spellingRuleId] */
export function getBuiltInOverlayReplace(find, replace, spellingRuleId) {
  const id = String(spellingRuleId ?? '').trim();
  if (id && overlayByRuleId.has(id)) return overlayByRuleId.get(id) ?? null;
  return overlayReplaceLookup.get(`${find}\0${replace}`) ?? null;
}

export { MAX_RULES };
