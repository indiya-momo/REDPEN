import { findReplacesFingerprintPart } from './spellingFindReplaces.js';

/**
 * 맞춤법 규칙 지문 — 앱(SPELLING_RULES_FP)·sync-spelling·kiwi:expand-b1-finds가 같은 함수를 쓴다.
 * Node 스크립트에서도 import할 수 있게 JSON import 없이 순수 함수로 둔다.
 */

/** @param {Record<string, any>} row */
export function spellingRowFingerprintPart(row) {
  const finds =
    row.finds?.length >= 2 ? row.finds.join('\u0001') : '';
  return `${row.find}\0${row.replace}\0${row.tip ?? ''}\0${
    row.enabled === true ? 1 : 0
  }\0${row.countsInQuota === false ? 0 : 1}\0${
    row.visible === false ? 0 : 1
  }\0${row.dividerGroup ?? ''}\0${row.dividerLabel ?? ''}\0${
    row.overlayReplace ?? ''
  }\0${row.ruleId ?? ''}\0${finds}\0${row.displayLabel ?? ''}${findReplacesFingerprintPart(row)}`;
}

/** @param {Record<string, any>[]} rows */
export function computeSpellingRulesFingerprint(rows) {
  let hash = 0;
  const payload = rows.map(spellingRowFingerprintPart).join('\n');
  for (let i = 0; i < payload.length; i += 1) {
    hash = (Math.imul(31, hash) + payload.charCodeAt(i)) | 0;
  }
  return `${rows.length}:${hash}`;
}

/**
 * public/data/spelling-rules-meta.json 내용
 * @param {Record<string, any>[]} rows
 * @param {string} syncedAt 시트에서 마지막으로 싱크한 시각(ISO)
 */
export function buildSpellingRulesMeta(rows, syncedAt) {
  return {
    fingerprint: computeSpellingRulesFingerprint(rows),
    syncedAt,
    count: rows.length,
  };
}
