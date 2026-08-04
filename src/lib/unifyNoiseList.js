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
  isSpacedLeftJosaNoiseEojeol,
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
  isSpacedLeftJosaNoiseEojeol,
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
 * 띄움 왼쪽 어절 잡음 — 조사 끼인 짧은 체언·용언 연결 (내가·들어서·등이·보면).
 * 붙임키 전체에 조사 휴리스틱을 쓰지 않고 왼쪽만 본다 (캐나다정부 오탐 방지).
 * @param {string} eojeol
 */
export function isSpacedLeftNoiseEojeol(eojeol) {
  const h = hangulOnlyNoise(eojeol);
  if (!h) return false;
  if (shouldRejectByNoiseListSurface(h)) return true;
  if (isSpacedLeftJosaNoiseEojeol(h)) return true;
  return false;
}

/**
 * 1차 정적 리스트·본보조만 (조사끼임 붙임키 휴리스틱 제외).
 * discover / 2차 패턴 — `캐나다정부`처럼 끝음절이 조사처럼 보이는 명사복합 오탐 방지.
 * @param {string} eojeolOrKey
 */
export function shouldRejectByNoiseListSurface(eojeolOrKey) {
  if (shouldRejectNoiseListDataSurface(eojeolOrKey)) return true;
  const h = hangulOnlyNoise(eojeolOrKey);
  if (!h) return false;
  return matchesBonBojoVerbalConnectiveHeuristic(h);
}

/**
 * 1차 리스트 — 어절/붙임 키가 잡음이면 true.
 * (위성·버킷용 — 조사끼임 휴리스틱 포함)
 * @param {string} eojeolOrKey
 */
export function shouldRejectByNoiseListEojeol(eojeolOrKey) {
  if (shouldRejectByNoiseListSurface(eojeolOrKey)) return true;
  const h = hangulOnlyNoise(eojeolOrKey);
  if (!h) return false;
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
  if (left && (shouldRejectByNoiseListEojeol(left) || isSpacedLeftNoiseEojeol(left))) {
    return true;
  }
  for (let i = 1; i < parts.length; i++) {
    const p = hangulOnlyNoise(parts[i]);
    if (p && shouldRejectByNoiseListSurface(p)) return true;
  }
  const key = hangulOnlyNoise(clusterKey) || hangulOnlyNoise(parts.join(''));
  if (key && shouldRejectByNoiseListSurface(key)) return true;
  return false;
}
