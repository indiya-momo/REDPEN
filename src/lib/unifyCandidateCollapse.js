/**
 * 같은 띄어쓰기 경계의 긴 n-gram을 affix 옆 한 칸까지만 남긴다.
 * - 경제@ → 「경제 ○○」 (앞말 + 다음 한 어절)
 * - @정부 → 「○○ 정부」 (이전 한 어절 + 뒷말)
 * - 3어절 이상 일반 충돌 → 앞 두 어절(또는 뒤 두 어절)로 자름
 */

import { pickRecommendedUnify, stripUnifyPunctuationNoise } from './unifyCandidateDiscover.js';

/**
 * @typedef {import('./unifyCandidateDiscover.js').UnifySpacingCluster} UnifySpacingCluster
 */

/**
 * @param {UnifySpacingCluster} cluster
 * @returns {string}
 */
function spacedVariant(cluster) {
  return cluster.variants.find((v) => /\s/.test(v)) || '';
}

/**
 * @param {UnifySpacingCluster} cluster
 * @returns {string}
 */
function gluedVariant(cluster) {
  return cluster.variants.find((v) => !/\s/.test(v)) || cluster.key;
}

/**
 * @param {UnifySpacingCluster} cluster
 * @param {string} coreSpaced
 * @param {string} coreGlued
 * @param {string} spaced
 * @param {string} glued
 * @returns {UnifySpacingCluster}
 */
function rebuildTrimmedCluster(cluster, coreSpaced, coreGlued, spaced, glued) {
  const ranked = [
    { variant: coreGlued, count: cluster.counts[glued] ?? 0 },
    { variant: coreSpaced, count: cluster.counts[spaced] ?? 0 },
  ].sort(
    (a, b) =>
      b.count - a.count ||
      (a.variant.match(/\s/g)?.length ?? 0) -
        (b.variant.match(/\s/g)?.length ?? 0) ||
      a.variant.localeCompare(b.variant, 'ko'),
  );

  return {
    ...cluster,
    key: coreGlued.replace(/\s+/g, ''),
    variants: ranked.map((row) => row.variant),
    counts: Object.fromEntries(ranked.map((row) => [row.variant, row.count])),
    occurrencesByVariant: {
      [coreGlued]: cluster.occurrencesByVariant[glued] ?? [],
      [coreSpaced]: cluster.occurrencesByVariant[spaced] ?? [],
    },
    recommendedUnify: pickRecommendedUnify(ranked),
    totalCount: ranked.reduce((sum, row) => sum + row.count, 0),
  };
}

/**
 * 경제@ / @정부 — affix 바로 옆 띄어쓰기 한 칸(어절 하나)까지만.
 * @param {UnifySpacingCluster} cluster
 * @param {string} affix
 * @param {'prefix' | 'suffix'} affixType
 * @returns {UnifySpacingCluster | null}
 */
export function trimClusterToAffixBoundary(cluster, affix, affixType) {
  const spaced = spacedVariant(cluster);
  const glued = gluedVariant(cluster);
  if (!spaced || !glued) return null;

  const parts = spaced.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return null;

  let coreSpaced;
  let coreGlued;
  if (affixType === 'prefix') {
    if (parts[0] !== affix) return null;
    coreSpaced = `${parts[0]} ${parts[1]}`;
    coreGlued = parts[0] + parts[1];
  } else {
    if (parts[parts.length - 1] !== affix) return null;
    coreSpaced = `${parts[parts.length - 2]} ${parts[parts.length - 1]}`;
    coreGlued = parts[parts.length - 2] + parts[parts.length - 1];
  }

  if (!glued.includes(coreGlued) && !glued.startsWith(coreGlued) && !glued.endsWith(coreGlued)) {
    // 붙임형이 해당 두 어절을 포함해야 함
    if (!cluster.key.includes(coreGlued.replace(/\s+/g, ''))) return null;
  }
  if (spaced === coreSpaced && glued === coreGlued) return cluster;
  if (!glued.includes(coreGlued) && cluster.key !== coreGlued.replace(/\s+/g, '')) {
    if (affixType === 'prefix' && !glued.startsWith(coreGlued)) return null;
    if (affixType === 'suffix' && !glued.endsWith(coreGlued)) return null;
  }

  return rebuildTrimmedCluster(cluster, coreSpaced, coreGlued, spaced, glued);
}

/**
 * 어절 3개 이상이면 앞 두 어절(또는 뒤 두 어절)로 자른다.
 * @param {UnifySpacingCluster} cluster
 * @returns {UnifySpacingCluster}
 */
export function trimClusterToCoreSpacingPair(cluster) {
  const spaced = spacedVariant(cluster);
  const glued = gluedVariant(cluster);
  if (!spaced || !glued) return cluster;

  const parts = spaced.split(/\s+/).filter(Boolean);
  if (parts.length <= 2) return cluster;

  const headSpaced = `${parts[0]} ${parts[1]}`;
  const headGlued = parts[0] + parts[1];
  const tailSpaced = `${parts[parts.length - 2]} ${parts[parts.length - 1]}`;
  const tailGlued = parts[parts.length - 2] + parts[parts.length - 1];

  if (glued.startsWith(headGlued) && cluster.key.startsWith(headGlued)) {
    return rebuildTrimmedCluster(cluster, headSpaced, headGlued, spaced, glued);
  }
  if (glued.endsWith(tailGlued) && cluster.key.endsWith(tailGlued)) {
    return rebuildTrimmedCluster(cluster, tailSpaced, tailGlued, spaced, glued);
  }
  // 기본: 앞 두 어절
  return rebuildTrimmedCluster(cluster, headSpaced, headGlued, spaced, glued);
}

/**
 * @param {UnifySpacingCluster} cluster
 * @returns {UnifySpacingCluster}
 */
function cloneCluster(cluster) {
  return {
    ...cluster,
    variants: [...cluster.variants],
    counts: { ...cluster.counts },
    occurrencesByVariant: { ...cluster.occurrencesByVariant },
  };
}

/**
 * @param {UnifySpacingCluster[]} clusters
 * @returns {UnifySpacingCluster[]}
 */
function mergeClustersByKey(clusters) {
  /** @type {Map<string, UnifySpacingCluster>} */
  const byKey = new Map();
  for (const cluster of clusters) {
    const existing = byKey.get(cluster.key);
    if (!existing) {
      byKey.set(cluster.key, cloneCluster(cluster));
      continue;
    }
    mergeClusterInto(existing, cluster);
  }
  return [...byKey.values()];
}

/**
 * @param {UnifySpacingCluster} shorter
 * @param {UnifySpacingCluster} longer
 */
export function isNestedSpacingCluster(shorter, longer) {
  if (longer.key.length <= shorter.key.length) return false;
  if (!longer.key.startsWith(shorter.key)) return false;

  const sSpaced = spacedVariant(shorter);
  const lSpaced = spacedVariant(longer);
  if (!sSpaced || !lSpaced) return false;

  const sParts = sSpaced.split(/\s+/);
  const lParts = lSpaced.split(/\s+/);
  if (sParts.length < 2) return false;
  if (sParts[0] !== lParts[0]) return false;
  if (lParts.length <= sParts.length) return false;
  return lParts[1] === sParts[1];
}

/**
 * @param {UnifySpacingCluster} target
 * @param {UnifySpacingCluster} source
 */
function mergeClusterInto(target, source) {
  const tGlued = gluedVariant(target);
  const tSpaced = spacedVariant(target);
  const sGlued = gluedVariant(source);
  const sSpaced = spacedVariant(source);

  if (sGlued && tGlued) {
    target.counts[tGlued] =
      (target.counts[tGlued] || 0) + (source.counts[sGlued] || 0);
    if (source.occurrencesByVariant[sGlued]?.length) {
      target.occurrencesByVariant[tGlued] = [
        ...(target.occurrencesByVariant[tGlued] || []),
        ...source.occurrencesByVariant[sGlued],
      ];
    }
  }

  if (sSpaced && tSpaced) {
    target.counts[tSpaced] =
      (target.counts[tSpaced] || 0) + (source.counts[sSpaced] || 0);
    if (source.occurrencesByVariant[sSpaced]?.length) {
      target.occurrencesByVariant[tSpaced] = [
        ...(target.occurrencesByVariant[tSpaced] || []),
        ...source.occurrencesByVariant[sSpaced],
      ];
    }
  }

  target.totalCount = Object.values(target.counts).reduce(
    (sum, n) => sum + n,
    0,
  );
  const ranked = Object.entries(target.counts)
    .map(([variant, count]) => ({ variant, count }))
    .sort(
      (a, b) =>
        b.count - a.count ||
        (a.variant.match(/\s/g)?.length ?? 0) -
          (b.variant.match(/\s/g)?.length ?? 0) ||
        a.variant.localeCompare(b.variant, 'ko'),
    );
  target.recommendedUnify = pickRecommendedUnify(ranked);
  target.variants = ranked.map((row) => row.variant);
}

/**
 * @param {UnifySpacingCluster} cluster
 * @returns {UnifySpacingCluster}
 */
function cleanClusterPunctuation(cluster) {
  const cleanedVariants = cluster.variants.map((v) =>
    stripUnifyPunctuationNoise(v),
  );
  const cleanedKey = stripUnifyPunctuationNoise(cluster.key).replace(
    /\s+/g,
    '',
  );
  if (
    cleanedKey === cluster.key &&
    cleanedVariants.every((v, i) => v === cluster.variants[i])
  ) {
    return cluster;
  }

  /** @type {Record<string, number>} */
  const counts = {};
  /** @type {Record<string, import('./unifyCandidateDiscover.js').UnifyVariantOccurrence[]>} */
  const occurrencesByVariant = {};
  for (let i = 0; i < cluster.variants.length; i++) {
    const raw = cluster.variants[i];
    const cleaned = cleanedVariants[i] || stripUnifyPunctuationNoise(raw);
    if (!cleaned) continue;
    counts[cleaned] = (counts[cleaned] || 0) + (cluster.counts[raw] ?? 0);
    occurrencesByVariant[cleaned] = [
      ...(occurrencesByVariant[cleaned] || []),
      ...(cluster.occurrencesByVariant[raw] || []),
    ];
  }
  const ranked = Object.entries(counts)
    .map(([variant, count]) => ({ variant, count }))
    .sort(
      (a, b) =>
        b.count - a.count ||
        (a.variant.match(/\s/g)?.length ?? 0) -
          (b.variant.match(/\s/g)?.length ?? 0) ||
        a.variant.localeCompare(b.variant, 'ko'),
    );
  return {
    ...cluster,
    key: cleanedKey || cluster.key,
    variants: ranked.map((row) => row.variant),
    counts: Object.fromEntries(ranked.map((row) => [row.variant, row.count])),
    occurrencesByVariant,
    recommendedUnify: pickRecommendedUnify(ranked),
    totalCount: ranked.reduce((sum, row) => sum + row.count, 0),
  };
}

/**
 * @param {UnifySpacingCluster[]} clusters
 * @returns {UnifySpacingCluster[]}
 */
export function normalizeSpacingClusters(clusters) {
  if (clusters.length === 0) return clusters;
  const trimmed = clusters
    .map(trimClusterToCoreSpacingPair)
    .map(cleanClusterPunctuation);
  return collapseNestedSpacingClusters(mergeClustersByKey(trimmed));
}

/**
 * @param {UnifySpacingCluster[]} clusters
 * @returns {UnifySpacingCluster[]}
 */
export function collapseNestedSpacingClusters(clusters) {
  if (clusters.length < 2) return clusters;

  const list = [...clusters].sort(
    (a, b) => a.key.length - b.key.length || a.key.localeCompare(b.key, 'ko'),
  );
  const removed = new Set();

  for (let i = 0; i < list.length; i++) {
    if (removed.has(i)) continue;
    for (let j = i + 1; j < list.length; j++) {
      if (removed.has(j)) continue;
      if (isNestedSpacingCluster(list[i], list[j])) {
        mergeClusterInto(list[i], list[j]);
        removed.add(j);
      }
    }
  }

  return list.filter((_, i) => !removed.has(i));
}
