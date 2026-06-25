import spellingRulesJson from '../data/spelling-rules.json';
import { MAX_RULES } from './ruleTypes.js';

/** @param {typeof spellingRulesJson} rows */
export function spellingRulesFingerprint(rows = spellingRulesJson) {
  let hash = 0;
  const payload = rows
    .map(
      (r) =>
        `${r.find}\0${r.replace}\0${r.tip ?? ''}\0${r.enabled === true ? 1 : 0}\0${
          r.countsInQuota === false ? 0 : 1
        }\0${r.visible === false ? 0 : 1}\0${r.dividerGroup ?? ''}\0${r.dividerLabel ?? ''}\0${r.overlayReplace ?? ''}`,
    )
    .join('\n');
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
    // "펼쳐지다" 같은 합성어 오탐 방지: 단어 시작에서만 매칭
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

/** 한도 제외(서비스·시트 참고) 맞춤법 규칙 */
export const BUILT_IN_GUIDE_RULES = BUILT_IN_RULES.filter(
  (r) => !countsTowardSpellingQuota(r),
);

/** UI 목록용 — visible=FALSE 행 제외 */
export const BUILT_IN_QUOTA_RULES_UI = BUILT_IN_QUOTA_RULES.filter(
  isBuiltInRuleVisible,
);

export const BUILT_IN_GUIDE_RULES_UI = BUILT_IN_GUIDE_RULES.filter(
  isBuiltInRuleVisible,
);

export const SPELLING_RULES_FP = spellingRulesFingerprint();

/**
 * 맞춤법 체크 초기값 — 시트·JSON `enabled`(TRUE/FALSE) 반영.
 * 규칙 제외(서비스)는 시트에서 TRUE면 기본 체크.
 */
export function builtInEnabledFromSheet() {
  return Object.fromEntries(
    BUILT_IN_RULES.map((r) => [r.find, r.enabled === true]),
  );
}

/**
 * 규칙 JSON(시트 동기화) 변경 시 enabled 열 기준으로 초기화.
 * 동일 fingerprint면 사용자가 바꾼 체크 상태는 유지.
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
    if (Object.prototype.hasOwnProperty.call(saved, r.find)) {
      merged[r.find] = saved[r.find] === true;
    }
  }
  return merged;
}

/** @param {Record<string, boolean>} builtInEnabled */
export function isBuiltInRuleEnabled(builtInEnabled, find) {
  return builtInEnabled[find] === true;
}

const tipLookup = new Map(
  spellingRulesJson.map((row) => [
    `${row.find}\0${row.replace}`,
    String(row.tip ?? '').trim(),
  ]),
);

/** @param {string} find @param {string} replace */
export function getBuiltInTip(find, replace) {
  return tipLookup.get(`${find}\0${replace}`) ?? '';
}

const overlayReplaceLookup = new Map(
  spellingRulesJson.flatMap((row) => {
    const text = String(row.overlayReplace ?? '').trim();
    if (!text) return [];
    return [[`${row.find}\0${row.replace}`, text]];
  }),
);

/** @param {string} find @param {string} replace */
export function getBuiltInOverlayReplace(find, replace) {
  return overlayReplaceLookup.get(`${find}\0${replace}`) ?? null;
}

export { MAX_RULES };
