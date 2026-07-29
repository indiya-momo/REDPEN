/**
 * 띄어쓰기 이형태 클러스터 정규화.
 * - 문장부호 노이즈 제거
 * - 중첩 n-gram(개인 소득 ⊂ 개인 소득 등이)은 짧은 단위로 합침
 * - 1·2어절 공통 접두(접두/접미)를 공유하면 작은 단위로 합침
 * - 이미 있는 짧은 단위로 긴 키 흡수(가치평가에 → 가치평가)
 * - 끝 조사는 제거하지 않음(짧은 단위 흡수·공통 접두로 합침)
 */

import {
  hangulSyllableCount,
  pickRecommendedUnify,
  stripUnifyPunctuationNoise,
  UNIFY_SPACED_PART_MIN_HANGUL,
} from './unifyCandidateDiscover.js';

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
 * @param {string} a
 * @param {string} b
 */
function stringPrefix(a, b) {
  let i = 0;
  const n = Math.min(a.length, b.length);
  while (i < n && a[i] === b[i]) i += 1;
  return a.slice(0, i);
}

/**
 * 2어절 띄움 충돌만 — { first, second }
 * @param {UnifySpacingCluster} cluster
 * @returns {{ first: string, second: string } | null}
 */
function twoEojeolParts(cluster) {
  const spaced = spacedVariant(cluster);
  if (!spaced) return null;
  const parts = spaced.split(/\s+/).filter(Boolean);
  if (parts.length !== 2) return null;
  return { first: parts[0], second: parts[1] };
}

/**
 * @param {UnifySpacingCluster} cluster
 * @param {string} first
 * @param {string} second
 * @returns {UnifySpacingCluster}
 */
function rebuildClusterToCorePair(cluster, first, second) {
  const coreSpaced = `${first} ${second}`;
  const coreGlued = `${first}${second}`;
  const oldGlued = gluedVariant(cluster);
  const oldSpaced = spacedVariant(cluster);
  const ranked = [
    { variant: coreGlued, count: cluster.counts[oldGlued] ?? 0 },
    { variant: coreSpaced, count: cluster.counts[oldSpaced] ?? 0 },
  ].sort(
    (a, b) =>
      b.count - a.count ||
      (a.variant.match(/\s/g)?.length ?? 0) -
        (b.variant.match(/\s/g)?.length ?? 0) ||
      a.variant.localeCompare(b.variant, 'ko'),
  );
  return {
    ...cluster,
    key: coreGlued,
    variants: ranked.map((row) => row.variant),
    counts: Object.fromEntries(ranked.map((row) => [row.variant, row.count])),
    occurrencesByVariant: {
      [coreGlued]: cluster.occurrencesByVariant[oldGlued] ?? [],
      [coreSpaced]: cluster.occurrencesByVariant[oldSpaced] ?? [],
    },
    recommendedUnify: pickRecommendedUnify(ranked),
    totalCount: ranked.reduce((sum, row) => sum + row.count, 0),
  };
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
 * 같은 고정 어절끼리, 맞은편 어절 공통 접두(≥2음절)면 작은 단위로 합친다.
 * @param {UnifySpacingCluster[]} clusters
 * @param {'first' | 'second'} pivot
 * @returns {UnifySpacingCluster[]}
 */
function collapseBySharedNeighborPrefix(clusters, pivot) {
  if (clusters.length < 2) return clusters;

  const partsOf = clusters.map(twoEojeolParts);
  /** @type {Map<string, number[]>} */
  const byPivot = new Map();
  for (let i = 0; i < clusters.length; i++) {
    const parts = partsOf[i];
    if (!parts) continue;
    const pivotKey = pivot === 'first' ? parts.first : parts.second;
    if (!byPivot.has(pivotKey)) byPivot.set(pivotKey, []);
    byPivot.get(pivotKey).push(i);
  }

  /** @type {Map<number, { first: string, second: string }>} */
  const coreByIndex = new Map();

  for (const indices of byPivot.values()) {
    if (indices.length < 2) continue;
    for (const i of indices) {
      const parts = partsOf[i];
      const moving = pivot === 'first' ? parts.second : parts.first;
      let best = '';
      for (const j of indices) {
        if (i === j) continue;
        const other = partsOf[j];
        const otherMoving = pivot === 'first' ? other.second : other.first;
        const prefix = stringPrefix(moving, otherMoving);
        if (hangulSyllableCount(prefix) < UNIFY_SPACED_PART_MIN_HANGUL) {
          continue;
        }
        if (prefix.length > best.length) best = prefix;
      }
      if (best && moving.length > best.length && moving.startsWith(best)) {
        coreByIndex.set(
          i,
          pivot === 'first'
            ? { first: parts.first, second: best }
            : { first: best, second: parts.second },
        );
      }
    }
  }

  if (coreByIndex.size === 0) return clusters;

  const next = clusters.map((cluster, i) => {
    const core = coreByIndex.get(i);
    if (!core) return cluster;
    return rebuildClusterToCorePair(cluster, core.first, core.second);
  });
  return mergeClustersByKey(next);
}

/**
 * 접두·접미·1·2어절 — 작은 단위 접두를 공유하면 그 기준으로 합친다.
 * 경제 회복력+회복세법 → 경제 회복 / (뒷말 동일 시 앞말 접두도 동일)
 * @param {UnifySpacingCluster[]} clusters
 * @returns {UnifySpacingCluster[]}
 */
export function collapseSharedSecondPrefixClusters(clusters) {
  const byFirst = collapseBySharedNeighborPrefix(clusters, 'first');
  return collapseBySharedNeighborPrefix(byFirst, 'second');
}

/**
 * 유효한 2어절 띄움(각 덩어리 ≥2음절)이 있는 짧은 단위인지.
 * @param {UnifySpacingCluster} cluster
 */
function hasValidShortSpacedUnit(cluster) {
  const spaced = spacedVariant(cluster);
  if (!spaced) return false;
  const parts = spaced.split(/\s+/).filter(Boolean);
  if (parts.length !== 2) return false;
  return parts.every(
    (p) => hangulSyllableCount(p) >= UNIFY_SPACED_PART_MIN_HANGUL,
  );
}

/**
 * 이미 있는 짧은 단위로 긴 키를 흡수.
 * 가치평가에 → 가치평가, 가치 평가도 → 가치 평가 (짧은 박스가 있을 때)
 * @param {UnifySpacingCluster[]} clusters
 * @returns {UnifySpacingCluster[]}
 */
export function collapseLongerIntoShorterUnits(clusters) {
  if (clusters.length < 2) return clusters;

  const list = clusters.map(cloneCluster);
  const removed = new Set();

  // 긴 것부터 — 짧은 목표를 고른 뒤 흡수
  const order = [...list.keys()].sort(
    (a, b) =>
      list[b].key.length - list[a].key.length ||
      list[a].key.localeCompare(list[b].key, 'ko'),
  );

  for (const li of order) {
    if (removed.has(li)) continue;
    const longer = list[li];
    let best = -1;
    for (let si = 0; si < list.length; si++) {
      if (si === li || removed.has(si)) continue;
      const shorter = list[si];
      if (longer.key.length <= shorter.key.length) continue;
      if (!longer.key.startsWith(shorter.key)) continue;
      if (!hasValidShortSpacedUnit(shorter)) continue;
      if (best < 0 || shorter.key.length > list[best].key.length) best = si;
    }
    if (best < 0) continue;
    mergeClusterInto(list[best], longer);
    removed.add(li);
  }

  return list.filter((_, i) => !removed.has(i));
}

/**
 * @param {UnifySpacingCluster[]} clusters
 * @returns {UnifySpacingCluster[]}
 */
export function normalizeSpacingClusters(clusters) {
  if (clusters.length === 0) return clusters;
  const cleaned = clusters.map(cleanClusterPunctuation);
  const nested = collapseNestedSpacingClusters(mergeClustersByKey(cleaned));
  const shared = collapseSharedSecondPrefixClusters(nested);
  return collapseLongerIntoShorterUnits(shared);
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
