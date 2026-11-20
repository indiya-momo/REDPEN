import { addManualFindingToGroups } from './findingsSink.js';
import { MANUAL_SOURCE } from './types.js';

/** 프로젝트 한 건에 두는 수정 리스트 상한. */
export const MAX_MANUAL_FINDINGS = 500;

/**
 * @typedef {{
 *   pageNum: number,
 *   start: number,
 *   end: number,
 *   matchedText: string,
 *   replace: string,
 *   tip?: string,
 *   source?: 'manual',
 * }} StoredManualFinding
 */

/**
 * @param {unknown} raw
 * @returns {StoredManualFinding[]}
 */
export function normalizeManualFindings(raw) {
  if (!Array.isArray(raw)) return [];
  /** @type {StoredManualFinding[]} */
  const out = [];
  const seen = new Set();
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const matchedText = String(
      /** @type {{ matchedText?: unknown }} */ (row).matchedText ?? '',
    );
    if (!matchedText) continue;
    const pageNum = Number(/** @type {{ pageNum?: unknown }} */ (row).pageNum);
    const start = Number(/** @type {{ start?: unknown }} */ (row).start);
    if (!Number.isFinite(pageNum) || !Number.isFinite(start)) continue;
    const endRaw = Number(/** @type {{ end?: unknown }} */ (row).end);
    const end =
      Number.isFinite(endRaw) && endRaw > start
        ? Math.floor(endRaw)
        : Math.floor(start) + matchedText.length;
    const replace = String(
      /** @type {{ replace?: unknown }} */ (row).replace ?? '',
    );
    const tip = String(/** @type {{ tip?: unknown }} */ (row).tip ?? '').trim();
    const key = `${Math.floor(pageNum)}\0${Math.floor(start)}\0${matchedText}`;
    if (seen.has(key)) continue;
    seen.add(key);
    /** @type {StoredManualFinding} */
    const next = {
      pageNum: Math.floor(pageNum),
      start: Math.floor(start),
      end,
      matchedText,
      replace,
      source: MANUAL_SOURCE,
    };
    if (tip) next.tip = tip;
    out.push(next);
    if (out.length >= MAX_MANUAL_FINDINGS) break;
  }
  return out;
}

/**
 * @param {import('../ruleEngine.js').GroupedResult[] | null | undefined} groups
 * @returns {StoredManualFinding[]}
 */
export function serializeManualGroups(groups) {
  /** @type {StoredManualFinding[]} */
  const rows = [];
  for (const group of groups ?? []) {
    for (const inst of group.instances ?? []) {
      const matchedText = String(inst.matchedText ?? inst.find ?? '');
      if (!matchedText) continue;
      const pageNum = Number(inst.pageNum);
      const start = Number(inst.index);
      if (!Number.isFinite(pageNum) || !Number.isFinite(start)) continue;
      const replace = String(
        inst.suggestedText ?? inst.replace ?? group.replace ?? '',
      );
      const tip = String(inst.tip ?? group.tip ?? '').trim();
      /** @type {StoredManualFinding} */
      const row = {
        pageNum: Math.floor(pageNum),
        start: Math.floor(start),
        end: Math.floor(start) + matchedText.length,
        matchedText,
        replace,
        source: MANUAL_SOURCE,
      };
      if (tip) row.tip = tip;
      rows.push(row);
      if (rows.length >= MAX_MANUAL_FINDINGS) return rows;
    }
  }
  return rows;
}

/**
 * @param {unknown} raw
 * @returns {import('../ruleEngine.js').GroupedResult[]}
 */
export function hydrateManualGroups(raw) {
  let groups = [];
  for (const manual of normalizeManualFindings(raw)) {
    groups = addManualFindingToGroups(groups, manual);
  }
  return groups;
}

/** @param {unknown} raw */
export function countStoredManualFindings(raw) {
  return normalizeManualFindings(raw).length;
}

/**
 * @param {unknown} raw
 * @param {{ pageNum?: number, start?: number, index?: number } | null | undefined} target
 */
export function removeStoredManualFinding(raw, target) {
  const pageNum = Number(target?.pageNum);
  const start = Number(target?.start ?? target?.index);
  if (!Number.isFinite(pageNum) || !Number.isFinite(start)) {
    return normalizeManualFindings(raw);
  }
  return normalizeManualFindings(raw).filter(
    (row) => !(row.pageNum === pageNum && row.start === start),
  );
}

/**
 * @param {unknown} a
 * @param {unknown} b
 */
export function manualFindingsEqual(a, b) {
  return (
    JSON.stringify(normalizeManualFindings(a)) ===
    JSON.stringify(normalizeManualFindings(b))
  );
}
