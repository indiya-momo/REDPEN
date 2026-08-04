/**
 * 표기통일 잡음 — 1차 정적 리스트 매처 (Kiwi 런타임 불필요).
 *
 * @see src/data/unify-noise-list.json
 * @see src/lib/bonBojoMorphPatterns.js
 */
import {
  UNIFY_NOISE_BON_BOJO_REFS,
  UNIFY_NOISE_COPULA_TAILS,
  UNIFY_NOISE_DENY_EOJEOLS,
  UNIFY_NOISE_EXCEPTION_EOJEOLS,
  UNIFY_NOISE_HAGO_JC_TAILS,
  UNIFY_NOISE_LIST_META,
  UNIFY_NOISE_TAG_TEMPLATES,
  UNIFY_NOISE_VERBAL_TAILS,
  hangulOnlyNoise,
  hasUnifyNoiseDenyEojeol,
  matchesNoiseListMorphTail,
  shouldRejectNoiseListDataSurface,
} from './unifyNoiseListData.js';
import { matchesBonBojoVerbalConnectiveHeuristic } from './bonBojoMorphPatterns.js';
import { isUnifyJosaGluedNoiseKey } from './unifyPredicateBucket.js';

export {
  UNIFY_NOISE_BON_BOJO_REFS,
  UNIFY_NOISE_COPULA_TAILS,
  UNIFY_NOISE_DENY_EOJEOLS,
  UNIFY_NOISE_EXCEPTION_EOJEOLS,
  UNIFY_NOISE_HAGO_JC_TAILS,
  UNIFY_NOISE_LIST_META,
  UNIFY_NOISE_TAG_TEMPLATES,
  UNIFY_NOISE_VERBAL_TAILS,
  hasUnifyNoiseDenyEojeol,
  matchesNoiseListMorphTail,
};

/** @deprecated */
export const UNIFY_NON_NOUN_COMPOUND_EOJEOLS = UNIFY_NOISE_EXCEPTION_EOJEOLS;
/** @deprecated */
export const UNIFY_NOISE_DENYLIST_META = UNIFY_NOISE_LIST_META;
/** @deprecated */
export const UNIFY_NOISE_PATTERNS = UNIFY_NOISE_TAG_TEMPLATES;

/**
 * @param {string} spacedVariant
 */
export function spacedVariantHitsNoiseDenylist(spacedVariant) {
  const parts = String(spacedVariant ?? '')
    .normalize('NFC')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length < 2) return false;
  return parts.some((p) => hasUnifyNoiseDenyEojeol(p));
}

/**
 * 1차 리스트 — 어절/붙임 키가 잡음이면 true.
 * @param {string} eojeolOrKey
 */
export function shouldRejectByNoiseListEojeol(eojeolOrKey) {
  if (shouldRejectNoiseListDataSurface(eojeolOrKey)) return true;
  const h = hangulOnlyNoise(eojeolOrKey);
  if (!h) return false;
  if (matchesBonBojoVerbalConnectiveHeuristic(h)) return true;
  if (isUnifyJosaGluedNoiseKey(h)) return true;
  return false;
}

/**
 * 1차 리스트 — 띄움 이형태(왼쪽·키)가 잡음이면 true.
 * @param {string} spacedVariant
 * @param {string} [clusterKey]
 */
export function shouldRejectByNoiseList(spacedVariant, clusterKey = '') {
  if (spacedVariantHitsNoiseDenylist(spacedVariant)) return true;
  const parts = String(spacedVariant ?? '')
    .normalize('NFC')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length < 2) {
    const alone = hangulOnlyNoise(spacedVariant) || hangulOnlyNoise(clusterKey);
    return alone ? shouldRejectByNoiseListEojeol(alone) : false;
  }
  const left = hangulOnlyNoise(parts[0]);
  if (left && shouldRejectByNoiseListEojeol(left)) return true;
  const key = hangulOnlyNoise(clusterKey) || hangulOnlyNoise(parts.join(''));
  if (key && shouldRejectByNoiseListEojeol(key)) return true;
  return false;
}
