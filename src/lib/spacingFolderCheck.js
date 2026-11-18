/**
 * 맞춤법 「띄어쓰기」 폴더 — 모듈 hit 수집·시트/loanword 필터·모듈 순차 드롭.
 * @see docs/superpowers/specs/2026-11-19-spacing-folder-in-spelling-tab-design.md
 */

import { SPACING_CATEGORY_DEFS } from './spacingCategoryRegistry.js';
import {
  isAnySpacingFolderEnabled,
  listEnabledSpacingModuleRefs,
  normalizeSpacingFolderEnabled,
  spacingCategoryForBundle,
} from './spacingFolderBundles.js';

const SPACING_SOURCE_TIP = '띄어쓰기 · 앱 내장';

/**
 * @param {number} a0
 * @param {number} a1
 * @param {number} b0
 * @param {number} b1
 */
export function charRangesOverlap(a0, a1, b0, b1) {
  return a0 < b1 && b0 < a1;
}

/**
 * @param {{ pageNum?: number, index?: number, matchedText?: string }} inst
 */
function instanceEnd(inst) {
  const start = Number(inst?.index) || 0;
  const len = String(inst?.matchedText ?? '').length;
  return start + len;
}

/**
 * @param {import('./ruleEngine.js').RuleResultGroup[]} sheetGroups
 * @returns {{ pageNum: number, start: number, end: number }[]}
 */
export function collectSheetLoanwordRanges(sheetGroups) {
  /** @type {{ pageNum: number, start: number, end: number }[]} */
  const ranges = [];
  for (const group of sheetGroups ?? []) {
    if (group?.category === 'caution') continue;
    for (const inst of group?.instances ?? []) {
      const pageNum = Number(inst?.pageNum);
      const start = Number(inst?.index);
      if (!Number.isFinite(pageNum) || !Number.isFinite(start)) continue;
      const end = instanceEnd(inst);
      if (end <= start) continue;
      ranges.push({ pageNum, start, end });
    }
  }
  return ranges;
}

/**
 * @param {import('./pdfService.js').PageData[]} pageTexts
 * @param {Record<string, boolean> | null | undefined} spacingFolderEnabled
 * @returns {import('./ruleEngine.js').RuleResultGroup[]}
 */
export function collectSpacingFolderGroups(pageTexts, spacingFolderEnabled) {
  const enabled = normalizeSpacingFolderEnabled(spacingFolderEnabled);
  if (!isAnySpacingFolderEnabled(enabled)) return [];

  const defById = new Map(SPACING_CATEGORY_DEFS.map((d) => [d.id, d]));
  /** @type {import('./ruleEngine.js').RuleResultGroup[]} */
  const groups = [];

  for (const ref of listEnabledSpacingModuleRefs(enabled)) {
    const def = defById.get(ref.moduleId);
    if (!def?.findHits) continue;
    const category = spacingCategoryForBundle(ref.bundleId);

    for (const page of pageTexts ?? []) {
      const text = String(page?.text ?? '');
      if (!text) continue;
      const pageNum = Number(page?.pageNum);
      if (!Number.isFinite(pageNum)) continue;

      for (const hit of def.findHits(text) ?? []) {
        const matchedText = String(hit?.matchedText ?? '');
        const suggestedText = String(hit?.suggestedText ?? '');
        const index = Number(hit?.index);
        if (!matchedText || !Number.isFinite(index)) continue;

        const instance = {
          find: matchedText,
          replace: suggestedText,
          matchedText,
          suggestedText,
          pageNum,
          index,
          moduleId: ref.moduleId,
        };
        groups.push({
          find: matchedText,
          replace: suggestedText,
          label: def.label,
          category,
          tip: SPACING_SOURCE_TIP,
          moduleId: ref.moduleId,
          instances: [instance],
        });
      }
    }
  }

  return groups;
}

/**
 * 시트·built-in·loanword와 겹치는 모듈 hit 제거 (caution은 유지).
 * @param {import('./ruleEngine.js').RuleResultGroup[]} spacingGroups
 * @param {import('./ruleEngine.js').RuleResultGroup[]} sheetGroups
 */
export function filterSpacingAgainstSheetAndLoanword(
  spacingGroups,
  sheetGroups,
) {
  const ranges = collectSheetLoanwordRanges(sheetGroups);
  if (!ranges.length) return spacingGroups ?? [];

  /** @type {import('./ruleEngine.js').RuleResultGroup[]} */
  const out = [];
  for (const group of spacingGroups ?? []) {
    const instances = (group.instances ?? []).filter((inst) => {
      const pageNum = Number(inst?.pageNum);
      const start = Number(inst?.index);
      if (!Number.isFinite(pageNum) || !Number.isFinite(start)) return false;
      const end = instanceEnd(inst);
      return !ranges.some(
        (r) =>
          r.pageNum === pageNum &&
          charRangesOverlap(start, end, r.start, r.end),
      );
    });
    if (!instances.length) continue;
    out.push({ ...group, instances });
  }
  return out;
}

/**
 * 남은 모듈 hit를 묶음·모듈 순서로 순차 드롭 (앞선 hit 유지).
 * @param {import('./ruleEngine.js').RuleResultGroup[]} spacingGroups
 * @param {Record<string, boolean> | null | undefined} spacingFolderEnabled
 */
export function dedupeSpacingModulesSequential(
  spacingGroups,
  spacingFolderEnabled,
) {
  const order = listEnabledSpacingModuleRefs(spacingFolderEnabled);
  const rank = new Map(
    order.map((ref, i) => [`${ref.bundleId}:${ref.moduleId}`, i]),
  );

  /** @type {{ group: import('./ruleEngine.js').RuleResultGroup, inst: object, rank: number }[]} */
  const flat = [];
  for (const group of spacingGroups ?? []) {
    const moduleId = String(group?.moduleId ?? '');
    const category = String(group?.category ?? '');
    const bundleId = category.startsWith('spacing:')
      ? category.slice('spacing:'.length)
      : '';
    const key = `${bundleId}:${moduleId}`;
    const r = rank.has(key) ? rank.get(key) : Number.MAX_SAFE_INTEGER;
    for (const inst of group?.instances ?? []) {
      flat.push({ group, inst, rank: /** @type {number} */ (r) });
    }
  }

  flat.sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    const ap = Number(a.inst.pageNum) || 0;
    const bp = Number(b.inst.pageNum) || 0;
    if (ap !== bp) return ap - bp;
    return (Number(a.inst.index) || 0) - (Number(b.inst.index) || 0);
  });

  /** @type {{ pageNum: number, start: number, end: number }[]} */
  const keptRanges = [];
  /** @type {Map<import('./ruleEngine.js').RuleResultGroup, object[]>} */
  const keptByGroup = new Map();

  for (const row of flat) {
    const pageNum = Number(row.inst.pageNum);
    const start = Number(row.inst.index);
    if (!Number.isFinite(pageNum) || !Number.isFinite(start)) continue;
    const end = instanceEnd(row.inst);
    const overlaps = keptRanges.some(
      (r) =>
        r.pageNum === pageNum &&
        charRangesOverlap(start, end, r.start, r.end),
    );
    if (overlaps) continue;
    keptRanges.push({ pageNum, start, end });
    const list = keptByGroup.get(row.group) ?? [];
    list.push(row.inst);
    keptByGroup.set(row.group, list);
  }

  /** @type {import('./ruleEngine.js').RuleResultGroup[]} */
  const out = [];
  for (const group of spacingGroups ?? []) {
    const instances = keptByGroup.get(group);
    if (!instances?.length) continue;
    out.push({ ...group, instances });
  }
  return out;
}

/**
 * 시트 결과 이후 모듈 병합 파이프라인.
 * 순서: 수집 → 시트·loanword 필터 → 모듈 순차.
 * @param {import('./pdfService.js').PageData[]} pageTexts
 * @param {import('./ruleEngine.js').RuleResultGroup[]} sheetGroups
 * @param {Record<string, boolean> | null | undefined} spacingFolderEnabled
 */
export function mergeSpacingFolderIntoSpellingResults(
  pageTexts,
  sheetGroups,
  spacingFolderEnabled,
) {
  const enabled = normalizeSpacingFolderEnabled(spacingFolderEnabled);
  if (!isAnySpacingFolderEnabled(enabled)) return [];

  const collected = collectSpacingFolderGroups(pageTexts, enabled);
  const afterSheet = filterSpacingAgainstSheetAndLoanword(
    collected,
    sheetGroups,
  );
  return dedupeSpacingModulesSequential(afterSheet, enabled);
}
