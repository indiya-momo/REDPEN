/**
 * 표기통일 잡음 — 1차 정적 리스트 매처 (Kiwi 런타임 불필요).
 *
 * 변경 전 체크 (`.cursor/rules/unify-noise-list.mdc`):
 * 1) `kiwi:harvest-noise-list`로 되는가? → 먼저 수확
 * 2) 새 하드코딩 리스트인가? → JSON/`--add` 우선
 * 3) 불가피 휴리스틱만 여기 (`source: manual-heuristic` 주석)
 *
 * @see src/data/unify-noise-list.json
 * @see src/lib/bonBojoMorphPatterns.js
 * @see project-docs/unify-kiwi-noise-filter-b-design-2026-08-04.md
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
import { isSpacedLeftJosaNoiseEojeol } from './unifyNoiseListLeftHeuristic.js';
import { isSpacedLeftAdnominalNoiseEojeol } from './unifyNoiseListAdnominalHeuristic.js';
import {
  isSpacedAdverbGeNoiseEojeol,
  isSpacedAdverbHiNoiseEojeol,
  isSpacedClosedConjunctionNoiseEojeol,
  isSpacedClosedVerbalNoiseEojeol,
  isSpacedDependentSuffixNoiseEojeol,
  isSpacedVerbalConnectiveNoiseEojeol,
  SPACED_ADVERB_GE_NOUN_EXCLUDE,
} from './unifyNoiseListLexicalHeuristic.js';
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
 * 띄움 어절 잡음 — 리스트 표면 + 조사·관형·접속·부사(-히/-게).
 * 왼쪽·오른쪽 동일 적용 ({@link shouldRejectByNoiseList}).
 * source: manual-heuristic (조사·관형·접속·-히/-게) + JSON/본보조 (표면).
 * @param {string} eojeol
 */
export function isSpacedLeftNoiseEojeol(eojeol) {
  const h = hangulOnlyNoise(eojeol);
  if (!h) return false;
  if (shouldRejectByNoiseListSurface(h)) return true;
  if (isSpacedLeftJosaNoiseEojeol(h)) return true;
  if (isSpacedLeftAdnominalNoiseEojeol(h)) return true;
  if (isSpacedClosedConjunctionNoiseEojeol(h)) return true;
  if (isSpacedClosedVerbalNoiseEojeol(h)) return true;
  if (isSpacedAdverbHiNoiseEojeol(h)) return true;
  if (isSpacedAdverbGeNoiseEojeol(h)) return true;
  if (isSpacedVerbalConnectiveNoiseEojeol(h)) return true;
  if (isSpacedDependentSuffixNoiseEojeol(h)) return true;
  return false;
}

/** @deprecated 이름만 왼쪽 — 실제로는 좌우 공통. {@link isSpacedLeftNoiseEojeol} */
export const isSpacedEojeolNoise = isSpacedLeftNoiseEojeol;

/**
 * 1차 정적 리스트·본보조만 (조사끼임 붙임키 휴리스틱 제외).
 * discover / 2차 패턴 — `캐나다정부`처럼 끝음절이 조사처럼 보이는 명사복합 오탐 방지.
 * `가게`는 본보조 꼬리(가+게)와 명사가 충돌 → -게 명사 제외 Set과 동일하게 본보조 단독 매칭 생략.
 * @param {string} eojeolOrKey
 */
export function shouldRejectByNoiseListSurface(eojeolOrKey) {
  if (shouldRejectNoiseListDataSurface(eojeolOrKey)) return true;
  const h = hangulOnlyNoise(eojeolOrKey);
  if (!h) return false;
  // source: manual-heuristic — verb-gada「가게」= 가+게 EC vs 명사 가게
  if (SPACED_ADVERB_GE_NOUN_EXCLUDE.has(h)) return false;
  return matchesBonBojoVerbalConnectiveHeuristic(h);
}

/**
 * 1차 리스트 — 어절/붙임 키가 잡음이면 true.
 * (위성·버킷용 — 조사끼임·이든 등 LeftHeuristic 포함)
 * @param {string} eojeolOrKey
 */
export function shouldRejectByNoiseListEojeol(eojeolOrKey) {
  if (shouldRejectByNoiseListSurface(eojeolOrKey)) return true;
  const h = hangulOnlyNoise(eojeolOrKey);
  if (!h) return false;
  // 붙임키 기업이든·캐나다에 — 띄움 칸과 동일 조사 휴리스틱
  if (isSpacedLeftJosaNoiseEojeol(h)) return true;
  if (isUnifyJosaGluedNoiseKey(h)) return true;
  return false;
}

/**
 * 1차 리스트 — 띄움 이형태(왼쪽·오른쪽·키)가 잡음이면 true.
 * 예외 어절·표면 꼬리·조사·관형 휴리스틱은 **모든 띄움 칸**에 동일 적용.
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
  for (const part of parts) {
    const h = hangulOnlyNoise(part);
    if (!h) continue;
    if (shouldRejectByNoiseListEojeol(h) || isSpacedLeftNoiseEojeol(h)) return true;
  }
  const key = hangulOnlyNoise(clusterKey) || hangulOnlyNoise(parts.join(''));
  if (key && shouldRejectByNoiseListSurface(key)) return true;
  return false;
}

/**
 * 1·2차 공통 잡음 경로 (discover · 패턴 mismatch).
 * - 띄움: {@link shouldRejectByNoiseList} (어절 휴리스틱 + 키 Surface)
 * - 붙임만: {@link shouldRejectByNoiseListSurface} (캐나다정부 ≠ 조사끼임)
 * @param {string} variant
 * @param {string} [clusterKey]
 * @returns {boolean} true면 제외
 */
export function shouldRejectUnifyCandidateNoise(variant, clusterKey = '') {
  const v = String(variant ?? '')
    .normalize('NFC')
    .trim();
  if (!v) return false;
  if (/\s/.test(v)) {
    return shouldRejectByNoiseList(v, clusterKey);
  }
  const key =
    hangulOnlyNoise(clusterKey) ||
    hangulOnlyNoise(v) ||
    String(clusterKey || v).replace(/\s+/g, '');
  return key ? shouldRejectByNoiseListSurface(key) : false;
}
