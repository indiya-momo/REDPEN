/**
 * 표기통일 잡음 2차 — 목록 표시 후 후보 단위 비동기 필터.
 * - DocSuffix: OCR 앞잘림 orphan DROP (복원·merge 없음, Kiwi 무관, text∪layout)
 * - Kiwi POS: ready일 때만 (boot 시도 없음, 동기 전량 analyze 금지)
 *
 * 공유 진입: {@link runUnifyListPhase2Filters} — 패널은 여기만 호출.
 */
import {
  shouldRejectUnifySatelliteGlued,
  shouldRejectUnifySatelliteSpacedByPos,
} from './kiwiMorph/unifyExclude.js';
import { isUnifyKiwiNoisePhase2Available } from './kiwiMorph/noiseFilterGate.js';
import { filterGroupsByDocSuffixOrphan } from './unifyNoiseDocSuffixOrphan.js';
import { sortClusterGroups } from './unifyCandidateGrouping.js';

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

/**
 * 목록 표시 후 2차 필터 묶음 (DocSuffix → Kiwi). 서로 try 분리.
 * @param {import('./unifyCandidateGrouping.js').ClusterGroup[]} groups
 * @param {{ text?: string, textLayout?: string }[] | null | undefined} pageTexts
 * @param {{
 *   yieldEvery?: number,
 *   rawByKey?: Map<string, { counts?: Map<string, number> | Record<string, number> }> | null,
 * }} [opts]
 * @returns {Promise<{
 *   groups: import('./unifyCandidateGrouping.js').ClusterGroup[],
 *   docSuffix: { applied: boolean, dropped: number },
 *   kiwi: { applied: boolean, dropped: number },
 * }>}
 */
export async function runUnifyListPhase2Filters(groups, pageTexts, opts = {}) {
  let next = groups ?? [];
  /** @type {{ applied: boolean, dropped: number }} */
  let docSuffix = { applied: false, dropped: 0 };
  /** @type {{ applied: boolean, dropped: number }} */
  let kiwi = { applied: false, dropped: 0 };

  try {
    const suffix = await filterGroupsByDocSuffixOrphan(next, pageTexts, opts);
    docSuffix = {
      applied: suffix.applied,
      dropped: (suffix.remapped ?? 0) + (suffix.dropped ?? 0),
    };
    if (
      suffix.applied &&
      ((suffix.remapped ?? 0) > 0 || (suffix.dropped ?? 0) > 0)
    ) {
      next = sortClusterGroups(suffix.groups);
    }
  } catch (err) {
    if (import.meta.env?.DEV) {
      console.warn('[unify-doc-suffix] phase2 filter failed', err);
    }
  }

  try {
    const phase2 = await filterSeriesSatellitesByKiwiPhase2(next, opts);
    kiwi = { applied: phase2.applied, dropped: phase2.dropped };
    if (phase2.applied && phase2.dropped > 0) {
      next = sortClusterGroups(phase2.groups);
    }
  } catch (err) {
    if (import.meta.env?.DEV) {
      console.warn('[unify-kiwi-noise] phase2 filter failed', err);
    }
  }

  return { groups: next, docSuffix, kiwi };
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
