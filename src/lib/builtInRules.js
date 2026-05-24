import spellingRulesJson from '../data/spelling-rules.json';
import { MAX_RULES } from './ruleTypes.js';

/** @param {typeof spellingRulesJson} rows */
export function spellingRulesFingerprint(rows = spellingRulesJson) {
  let hash = 0;
  const payload = rows
    .map((r) => `${r.find}\0${r.replace}\0${r.tip ?? ''}`)
    .join('\n');
  for (let i = 0; i < payload.length; i += 1) {
    hash = (Math.imul(31, hash) + payload.charCodeAt(i)) | 0;
  }
  return `${rows.length}:${hash}`;
}

/** @type {import('./ruleTypes.js').Rule[]} */
export const BUILT_IN_RULES = spellingRulesJson.map((row) => ({
  find: row.find,
  replace: row.replace,
  enabled: row.enabled === true,
  builtIn: true,
  tip: String(row.tip ?? '').trim(),
  memo: String(row.memo ?? '').trim(),
}));

export const SPELLING_RULES_FP = spellingRulesFingerprint();

/** 맞춤법 체크 초기값 — 주의 규칙과 같이 기본은 모두 꺼짐 */
export function builtInEnabledFromSheet() {
  return Object.fromEntries(BUILT_IN_RULES.map((r) => [r.find, false]));
}

/**
 * 규칙 JSON(시트 동기화) 변경 시 enabled를 기본(전부 off)으로 맞춤.
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

export { MAX_RULES };
