/**
 * 표기 통일 2-3 — 본조 stem 붙임·띄움 쌍이 원고에 둘 다 있는데
 * 1차 discover 클러스터가 없을 때만 시드 주입.
 * 1차 discover 스캔은 바꾸지 않는다.
 */

import { listBonBojoUnifyReviewStems } from './bonBojoRules.js';
import { matchBonBojoStemForCluster } from './unifyAuxReview.js';

export const BON_BOJO_SEED_KEY_PREFIX = 'bon-bojo-seed:';

/** 시드 상한 — 짧은 stem 폭주를 막음 */
export const MAX_BON_BOJO_SEED_CLUSTERS = 24;

/** @param {string} s */
function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 한글 음절 경계 — 부분 문자열(아주머니⊃아주) 오탐 억제.
 * @param {string} glued
 */
export function gluedStemBoundaryRegExp(glued) {
  const g = String(glued ?? '').trim().replace(/\s+/g, '');
  if (!g) return null;
  return new RegExp(
    `(?<![\\uAC00-\\uD7A3])${escapeRegExp(g)}(?![\\uAC00-\\uD7A3])`,
    'gu',
  );
}

/**
 * @param {string} spaced
 */
export function spacedStemBoundaryRegExp(spaced) {
  const raw = String(spaced ?? '').trim().replace(/\s+/g, ' ');
  if (!raw || !/\s/.test(raw)) return null;
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return null;
  return new RegExp(
    `(?<![\\uAC00-\\uD7A3])${parts.map(escapeRegExp).join('\\s+')}(?![\\uAC00-\\uD7A3])`,
    'gu',
  );
}

/**
 * @param {string} text
 * @param {RegExp | null} re
 * @param {number} pageNum
 * @returns {import('./unifyCandidateDiscover.js').UnifyVariantOccurrence[]}
 */
function collectMatches(text, re, pageNum) {
  if (!re) return [];
  re.lastIndex = 0;
  /** @type {import('./unifyCandidateDiscover.js').UnifyVariantOccurrence[]} */
  const out = [];
  for (const m of String(text ?? '').matchAll(re)) {
    const matchedText = String(m[0] ?? '');
    if (!matchedText) continue;
    out.push({
      pageNum,
      matchedText,
      itemIndexes: [],
    });
  }
  return out;
}

/**
 * @param {string} glued
 */
export function bonBojoSeedClusterKey(glued) {
  const g = String(glued ?? '').trim().replace(/\s+/g, '');
  return g ? `${BON_BOJO_SEED_KEY_PREFIX}${g}` : '';
}

/**
 * 기존 클러스터가 이 stem을 이미 다루면 시드하지 않음.
 * (포함 매칭 — 긴 표기에 auxReview가 있으면 짧은 stem 시드 생략)
 * @param {readonly import('./unifyCandidateDiscover.js').UnifySpacingCluster[]} clusters
 * @param {{ spaced: string, glued: string }} stem
 */
export function existingClusterCoversBonBojoStem(clusters, stem) {
  const glued = String(stem.glued ?? '').trim();
  const spaced = String(stem.spaced ?? '').trim();
  const seedKey = bonBojoSeedClusterKey(glued);
  for (const cluster of clusters ?? []) {
    const key = String(cluster?.key ?? '').trim();
    if (key && (key === glued || key === seedKey)) return true;
    const variants = cluster?.variants ?? [];
    const counts = cluster?.counts ?? {};
    for (const variant of variants) {
      if ((counts[variant] ?? 0) <= 0 && variant !== key) continue;
      const v = String(variant ?? '').trim();
      if (v === glued || v === spaced) return true;
    }
    const hit = matchBonBojoStemForCluster(cluster, [stem]);
    if (hit && hit.glued === glued) return true;
  }
  return false;
}

/**
 * @param {readonly { pageNum?: number, text?: string }[]} pageTexts
 * @param {{ spaced: string, glued: string }} stem
 */
export function collectBonBojoStemPairInDocument(pageTexts, stem) {
  const spacedRe = spacedStemBoundaryRegExp(stem.spaced);
  const gluedRe = gluedStemBoundaryRegExp(stem.glued);
  /** @type {import('./unifyCandidateDiscover.js').UnifyVariantOccurrence[]} */
  const spacedOccs = [];
  /** @type {import('./unifyCandidateDiscover.js').UnifyVariantOccurrence[]} */
  const gluedOccs = [];
  for (const page of pageTexts ?? []) {
    const text = String(page?.text ?? '');
    if (!text) continue;
    const pageNum = Number(page?.pageNum) || 1;
    spacedOccs.push(...collectMatches(text, spacedRe, pageNum));
    gluedOccs.push(...collectMatches(text, gluedRe, pageNum));
  }
  return {
    spaced: stem.spaced,
    glued: stem.glued,
    spacedOccs,
    gluedOccs,
    spacedCount: spacedOccs.length,
    gluedCount: gluedOccs.length,
  };
}

/**
 * @param {{
 *   spaced: string,
 *   glued: string,
 *   itemId: string,
 *   displayLabel?: string,
 *   spacedOccs: import('./unifyCandidateDiscover.js').UnifyVariantOccurrence[],
 *   gluedOccs: import('./unifyCandidateDiscover.js').UnifyVariantOccurrence[],
 * }} pair
 * @returns {import('./unifyCandidateDiscover.js').UnifySpacingCluster | null}
 */
export function buildBonBojoSeedCluster(pair) {
  const spaced = String(pair.spaced ?? '').trim();
  const glued = String(pair.glued ?? '').trim();
  if (!spaced || !glued) return null;
  const spacedCount = pair.spacedOccs?.length ?? 0;
  const gluedCount = pair.gluedOccs?.length ?? 0;
  if (spacedCount <= 0 || gluedCount <= 0) return null;

  const key = bonBojoSeedClusterKey(glued);
  if (!key) return null;

  const recommendedUnify =
    spacedCount >= gluedCount ? spaced : glued;

  return {
    key,
    variants: [glued, spaced],
    counts: {
      [glued]: gluedCount,
      [spaced]: spacedCount,
    },
    occurrencesByVariant: {
      [glued]: [...(pair.gluedOccs ?? [])],
      [spaced]: [...(pair.spacedOccs ?? [])],
    },
    recommendedUnify,
    totalCount: gluedCount + spacedCount,
    kind: /** @type {const} */ ('conflict'),
    auxReview: {
      stemKey: glued,
      stemSpaced: spaced,
      itemId: pair.itemId,
      displayLabel: pair.displayLabel,
      status: /** @type {const} */ ('review'),
    },
  };
}

/**
 * discover·enrich 이후 클러스터 배열에만 붙인다 (1차 비용 불변).
 * @param {readonly import('./unifyCandidateDiscover.js').UnifySpacingCluster[]} clusters
 * @param {readonly { pageNum?: number, text?: string }[]} pageTexts
 * @param {{ maxSeeds?: number }} [opts]
 * @returns {import('./unifyCandidateDiscover.js').UnifySpacingCluster[]}
 */
export function seedBonBojoStemClustersIntoList(
  clusters,
  pageTexts,
  opts = {},
) {
  const base = [...(clusters ?? [])];
  if (!pageTexts?.length) return base;

  const maxSeeds = opts.maxSeeds ?? MAX_BON_BOJO_SEED_CLUSTERS;
  const stems = listBonBojoUnifyReviewStems().toSorted(
    (a, b) =>
      b.glued.length - a.glued.length || a.glued.localeCompare(b.glued, 'ko'),
  );

  /** @type {Set<string>} */
  const seededGlued = new Set();
  /** @type {import('./unifyCandidateDiscover.js').UnifySpacingCluster[]} */
  const seeds = [];

  for (const stem of stems) {
    if (seeds.length >= maxSeeds) break;
    const glued = stem.glued;
    if (!glued || seededGlued.has(glued)) continue;
    if (existingClusterCoversBonBojoStem(base, stem)) continue;
    if (existingClusterCoversBonBojoStem(seeds, stem)) continue;

    const pair = collectBonBojoStemPairInDocument(pageTexts, stem);
    if (pair.spacedCount <= 0 || pair.gluedCount <= 0) continue;

    const cluster = buildBonBojoSeedCluster({
      ...pair,
      itemId: stem.itemId,
      displayLabel: stem.displayLabel,
    });
    if (!cluster) continue;
    seededGlued.add(glued);
    seeds.push(cluster);
  }

  if (!seeds.length) return base;
  return [...base, ...seeds];
}
