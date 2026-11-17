/**
 * 표기 통일 — bon-bojo 시트 stems와 맞는 띄어쓰기 후보에 「보조용언 추정」검토 표시.
 * 자동 merge 없음.
 */

import { listBonBojoUnifyReviewStems } from './bonBojoRules.js';

/**
 * 긴 stem 우선(어 낸 > 어 내). 전체 표기뿐 아니라 「만들어 내는」처럼 stem이 중간에 끼는 경우도 잡는다.
 * @returns {{ spaced: string, glued: string, itemId: string, displayLabel?: string }[]}
 */
function listStemsLongestFirst() {
  return listBonBojoUnifyReviewStems().toSorted(
    (a, b) => b.glued.length - a.glued.length || a.glued.localeCompare(b.glued),
  );
}

/**
 * @param {string} variant
 * @param {{ spaced: string, glued: string }} stem
 */
function variantContainsBonBojoStem(variant, stem) {
  const raw = String(variant ?? '').trim();
  if (!raw) return false;
  const spaced = raw.replace(/\s+/g, ' ');
  if (spaced.includes(stem.spaced)) return true;
  const glued = spaced.replace(/\s+/g, '');
  return Boolean(stem.glued) && glued.includes(stem.glued);
}

/**
 * @param {import('./unifyCandidateDiscover.js').UnifySpacingCluster} cluster
 * @param {{ spaced: string, glued: string, itemId: string, displayLabel?: string }[]} [stems]
 * @returns {{ spaced: string, glued: string, itemId: string, displayLabel?: string } | null}
 */
export function matchBonBojoStemForCluster(
  cluster,
  stems = listStemsLongestFirst(),
) {
  const variants = cluster?.variants ?? [];
  const counts = cluster?.counts ?? {};
  const candidates = [];
  for (const variant of variants) {
    if ((counts[variant] ?? 0) <= 0 && variant !== cluster.key) continue;
    candidates.push(variant);
  }
  const key = String(cluster?.key ?? '').trim();
  if (key && !candidates.includes(key)) candidates.push(key);

  for (const stem of stems) {
    for (const variant of candidates) {
      if (variantContainsBonBojoStem(variant, stem)) return stem;
    }
  }
  return null;
}

/**
 * @param {import('./unifyCandidateDiscover.js').UnifySpacingCluster[]} clusters
 * @returns {import('./unifyCandidateDiscover.js').UnifySpacingCluster[]}
 */
/** @param {{ displayLabel?: string, stemSpaced?: string, stemKey?: string } | null | undefined} auxReview */
export function formatAuxiliaryReviewShortLabel(auxReview) {
  const label = auxReview?.displayLabel?.trim();
  return label || '(아/어) + 보조용언';
}

/**
 * @param {{ displayLabel?: string, stemSpaced?: string, stemKey?: string } | null | undefined} auxReview
 */
export function formatAuxiliaryReviewBadge(auxReview) {
  const label = formatAuxiliaryReviewShortLabel(auxReview);
  return `${label} · 붙임/띄움 짝`;
}

/**
 * @param {{ displayLabel?: string, stemSpaced?: string, stemKey?: string } | null | undefined} auxReview
 */
export function formatAuxiliaryReviewTip(auxReview) {
  const label = formatAuxiliaryReviewShortLabel(auxReview);
  const spaced = auxReview?.stemSpaced?.trim();
  const glued = auxReview?.stemKey?.trim();
  const lines = [`본조 시트: ${label}`];
  if (spaced) lines.push(`띄움 stem: ${spaced}`);
  if (glued) lines.push(`붙임 stem: ${glued}`);
  lines.push(
    '원고에 붙임·띄움이 함께 있으면 여기서 통일하고, 맞춤법 제안은 본용언+보조용언 검사와 같이 보세요.',
  );
  return lines.join('\n');
}

export function attachAuxiliaryReviewHints(clusters) {
  if (!clusters?.length) return clusters;
  const stems = listStemsLongestFirst();
  if (stems.length === 0) return clusters;

  return clusters.map((cluster) => {
    const hit = matchBonBojoStemForCluster(cluster, stems);
    if (!hit) {
      if (cluster.auxReview) {
        const { auxReview: _drop, ...rest } = cluster;
        return rest;
      }
      return cluster;
    }
    return {
      ...cluster,
      auxReview: {
        stemKey: hit.glued,
        stemSpaced: hit.spaced,
        itemId: hit.itemId,
        displayLabel: hit.displayLabel,
        status: /** @type {const} */ ('review'),
      },
    };
  });
}
