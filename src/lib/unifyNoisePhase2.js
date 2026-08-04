/**
 * 표기통일 잡음 2차 — 목록 표시 후, Kiwi ready일 때만 후보 단위 비동기 필터.
 * boot 시도 없음. 동기 전량 analyze 금지.
 */
import {
  shouldRejectUnifySatelliteGlued,
  shouldRejectUnifySatelliteSpacedByPos,
} from './kiwiMorph/unifyExclude.js';
import { isUnifyKiwiNoisePhase2Available } from './kiwiMorph/noiseFilterGate.js';

const YIELD_EVERY = 8;

/**
 * @param {import('./unifyCandidateGrouping.js').ClusterGroup[]} groups
 * @param {{ yieldEvery?: number }} [opts]
 * @returns {Promise<{
 *   groups: import('./unifyCandidateGrouping.js').ClusterGroup[],
 *   applied: boolean,
 *   dropped: number,
 * }>}
 */
export async function filterSeriesSatellitesByKiwiPhase2(groups, opts = {}) {
  if (!isUnifyKiwiNoisePhase2Available()) {
    return { groups: groups ?? [], applied: false, dropped: 0 };
  }
  const yieldEvery = opts.yieldEvery ?? YIELD_EVERY;
  let dropped = 0;
  let ops = 0;
  /** @type {import('./unifyCandidateGrouping.js').ClusterGroup[]} */
  const nextGroups = [];

  for (const group of groups ?? []) {
    const dictPos = group.type === 'series' ? group.dictPos : undefined;
    /** @type {typeof group.clusters} */
    const kept = [];
    for (const cluster of group.clusters ?? []) {
      ops += 1;
      if (ops % yieldEvery === 0) {
        await new Promise((r) => setTimeout(r, 0));
      }
      if (isRealConflictCounts(cluster)) {
        kept.push(cluster);
        continue;
      }
      const spaced =
        cluster.variants?.find((v) => /\s/.test(String(v))) ??
        Object.keys(cluster.counts ?? {}).find((v) => /\s/.test(v)) ??
        '';
      const glued = String(cluster.key ?? '').replace(/\s+/g, '');
      let reject = false;
      try {
        if (spaced && /\s/.test(spaced)) {
          reject = shouldRejectUnifySatelliteSpacedByPos(spaced, dictPos);
        }
        if (!reject && glued) {
          reject = shouldRejectUnifySatelliteGlued(glued);
        }
      } catch {
        reject = false;
      }
      if (reject) {
        dropped += 1;
        continue;
      }
      kept.push(cluster);
    }
    if (kept.length === 0) continue;
    if (kept.length === (group.clusters ?? []).length) {
      nextGroups.push(group);
    } else {
      nextGroups.push({ ...group, clusters: kept });
    }
  }

  return { groups: nextGroups, applied: true, dropped };
}

/** @param {{ counts?: Record<string, number>, kind?: string }} cluster */
function isRealConflictCounts(cluster) {
  if (cluster.kind === 'conflict') return true;
  if (cluster.kind === 'single-form') return false;
  let glued = 0;
  let spaced = 0;
  for (const [variant, count] of Object.entries(cluster.counts ?? {})) {
    if (count <= 0) continue;
    if (/\s/.test(variant)) spaced += count;
    else glued += count;
  }
  return glued > 0 && spaced > 0;
}
