/**
 * 표기 통일 추천 — 문서 내 띄어쓰기 이형태만 (규범 판단 아님).
 *
 * 정책: project-docs/unify-candidate-spacing-redesign-2026-07-29.md
 * - 스캔은 page.textLayout 우선(음절 자간 가짜 공백 제외), 없으면 text
 * - **줄 단위만 스캔** — 줄바꿈으로 생긴 붙임/띄움 이형태는 전부 제외
 * - **쉼표(,)** 는 후보에서 제외. 기호만 스캔 시 제거. **끝 조사는 키·variant에서 제거**(붉은표시가/붉은표시를 → 붉은표시)
 * - **순수 숫자 토큰·어절 앞뒤 숫자**는 제거(각주·줄번호 174노동시장 / 175노동시장 → 노동시장).
 *   목차·쪽번호 세로선(`┃` 등)이 숫자와 한글 사이에 끼어도 동일 (`331┃케인즈` → `케인즈`).
 * - 띄움 variant: 각 덩어리 한글 2음절 이상(숫자·영문은 음절·면제 없음, 숫자만 탈락)
 * - 클러스터 키: 조사 제거 후 공백 제거 / 붙임+유효 띄움 동시
 * - 추천: 출현 수 최대 / 동률 시 붙임 — 내부 정책(규범 아님)
 * - 칩/Next 순: 시각 reading order `(page, column, -y, x)` — hit 집합은 유지
 * - **전체 발견(1차) 집계 = page.text visual 슬롯** (충돌은 rematerialize 후 totalCount).
 *   layout-only 합·옛 1019 계열로 되돌리지 않음. 칩·하이라이트·숫자 동일 층(B 고정).
 *
 * 추출: 한글·숫자 토큰 + 줄 안 연속 n-gram(원문 슬라이스, 토큰 수 상한) / 단일 토큰.
 * 성능: 스캔 중 highlightRange 스냅·전 키 finalize 금지 → 충돌 클러스터에만 후처리.
 */

/** 줄 안 n-gram 최대 토큰 수 (띄어쓰기 이형태는 보통 2~4어절) */
const UNIFY_MAX_NGRAM_TOKENS = 6;

import { findRefForTextIndex } from '../toc-body/lib/pdfHeadingExtract.js';
import {
  buildPageByNum,
  compareInstancesReadingOrder,
  sortInstancesReadingOrder,
} from './matchReadingOrder.js';
import { findPhraseInSpan, highlightRangeForSpelling } from './pdfHighlightRange.js';
import {
  findPhraseHitsInPdfItems,
  sortPhraseHitsReadingOrder,
} from './pdfItemPhraseFind.js';
import { isUnifyHangulMidWordSoftWrap } from './pdfPageText.js';
import {
  isSpellingKiwiBoundaryEnabled,
  isUnifyKiwiJosaEnabled,
  isUnifyKiwiNoiseFilterEnabled,
} from './featureFlags.js';
import { shouldSkipMatchByKiwiBoundary } from './kiwiMorph/boundaryGate.js';
import {
  isKiwiCopulaEndingSurface,
  isKiwiEnumerationSurface,
  isKiwiNounVerbalConnectiveSurface,
  shouldRejectUnifySatelliteSpacedByPos,
} from './kiwiMorph/unifyExclude.js';
import {
  isUnifyKiwiLocalAnalyzeReady,
  isUnifyKiwiNoiseMorphActive,
} from './kiwiMorph/noiseFilterGate.js';
import { stripTrailingJosaFromTokens } from './kiwiMorph/stripTrailingJosa.js';
import { analyzeLine } from './kiwiMorph/analyze.js';
import { isKiwiReady } from './kiwiMorph/runtime.js';
import { hangulSyllableCount } from './unifyHangulBasics.js';
import {
  isExcludedUnifyCandidateRaw,
  isValidSpacedUnifyVariant,
  normalizeUnifyScanText,
  normalizeUnifyVariant,
  prepareUnifyScanText,
  spacedPartIsBareJosa,
  stripTrailingJosaHeuristic,
  stripUnifyPeripheralDigits,
  stripUnifyPunctuationNoise,
} from './unifyCandidateNormalize.js';
import { shouldRejectUnifyCandidateNoise } from './unifyNoiseList.js';

export {
  hangulSyllableCount,
  UNIFY_SPACED_PART_MIN_HANGUL,
  UNIFY_TRAILING_JOSA,
} from './unifyHangulBasics.js';

export {
  isExcludedUnifyCandidateRaw,
  isValidSpacedUnifyVariant,
  normalizeUnifyScanText,
  normalizeUnifyVariant,
  prepareUnifyScanText,
  spacedPartIsBareJosa,
  splitUnifyScanLines,
  stripTrailingJosa,
  stripTrailingJosaHeuristic,
  stripTrailingUnifyAffixes,
  stripUnifyPeripheralDigits,
  stripUnifyPunctuationNoise,
  unifySpacingKey,
} from './unifyCandidateNormalize.js';

/** 찾기 UI — 이 ms 동안 sync 작업하면 이벤트 루프에 양보 (ops 횟수 양보는 대형 PDF에서 사실상 무한 대기) */
const UNIFY_FIND_YIELD_MS = 40;

/**
 * 출현 누적에서 Kiwi analyze가 필요할 때만 — 플래그 없이 ready만으로 전량 분석하지 않음.
 * (NOISE_FILTER DEV 기본 ON → wasm 웜업 후 찾기 무한 체감의 주원인)
 */
function shouldAnalyzeUnifyOccurrenceWithKiwi() {
  return (
    isUnifyKiwiJosaEnabled() ||
    isSpellingKiwiBoundaryEnabled() ||
    isUnifyKiwiNoiseMorphActive()
  );
}

/**
 * @typedef {{
 *   pageNum: number,
 *   index: number,
 *   matchedText: string,
 *   itemIndexes?: number[],
 *   x?: number,
 *   y?: number,
 *   column?: number,
 * }} UnifyVariantOccurrence
 */

/**
 * @typedef {{
 *   key: string,
 *   variants: string[],
 *   counts: Record<string, number>,
 *   occurrencesByVariant: Record<string, UnifyVariantOccurrence[]>,
 *   recommendedUnify: string,
 *   totalCount: number,
 *   kind?: 'conflict' | 'single-form',
 *   josaReview?: {
 *     stemKey: string,
 *     peerKeys: string[],
 *     status: 'review',
 *     slm?: { model: string; confidence: 'high' },
 *   },
 *   josaReviewCandidate?: {
 *     stemKey: string,
 *     stemSpaced: string,
 *     suffix: string,
 *     tier: 'high' | 'low' | 'risky',
 *     peerKeys: string[],
 *   },
 *   auxReview?: {
 *     stemKey: string,
 *     stemSpaced: string,
 *     itemId: string,
 *     displayLabel?: string,
 *     status: 'review',
 *   },
 *   predicateReview?: {
 *     status: 'needs_review',
 *     source?: string,
 *   },
 * }} UnifySpacingCluster
 */

const TOKEN_RE = /[\uAC00-\uD7A3\d]+/gu;

/**
 * @param {string} s
 * @returns {number}
 */
function spaceCount(s) {
  return (s.match(/\s/g) || []).length;
}

/**
 * 이형태 카드 줄 순서 — 횟수 ↓, 동률이면 첫 출현 읽기순(쪽·위에서 아래).
 * @param {{ variant: string, count: number }} a
 * @param {{ variant: string, count: number }} b
 * @param {Record<string, UnifyVariantOccurrence[]>} occurrencesByVariant
 * @param {Map<number, import('./pdfService.js').PageData> | null} [pageByNum]
 */
function compareVariantRowsForClusterList(
  a,
  b,
  occurrencesByVariant,
  pageByNum = null,
) {
  const countDiff = b.count - a.count;
  if (countDiff) return countDiff;
  const oa = (occurrencesByVariant[a.variant] ?? [])[0];
  const ob = (occurrencesByVariant[b.variant] ?? [])[0];
  if (!oa && !ob) return a.variant.localeCompare(b.variant, 'ko');
  if (!oa) return 1;
  if (!ob) return -1;
  if (pageByNum?.size) {
    const byReading = compareInstancesReadingOrder(
      {
        pageNum: oa.pageNum,
        index: oa.index,
        matchedText: oa.matchedText,
        ...(Array.isArray(oa.itemIndexes) ? { itemIndexes: oa.itemIndexes } : {}),
        ...(typeof oa.x === 'number' ? { x: oa.x } : {}),
        ...(typeof oa.y === 'number' ? { y: oa.y } : {}),
        ...(typeof oa.column === 'number' ? { column: oa.column } : {}),
      },
      {
        pageNum: ob.pageNum,
        index: ob.index,
        matchedText: ob.matchedText,
        ...(Array.isArray(ob.itemIndexes) ? { itemIndexes: ob.itemIndexes } : {}),
        ...(typeof ob.x === 'number' ? { x: ob.x } : {}),
        ...(typeof ob.y === 'number' ? { y: ob.y } : {}),
        ...(typeof ob.column === 'number' ? { column: ob.column } : {}),
      },
      pageByNum,
    );
    if (byReading) return byReading;
  } else {
    const pageDiff = (Number(oa.pageNum) || 0) - (Number(ob.pageNum) || 0);
    if (pageDiff) return pageDiff;
    const idxDiff = (Number(oa.index) || 0) - (Number(ob.index) || 0);
    if (idxDiff) return idxDiff;
  }
  return a.variant.localeCompare(b.variant, 'ko');
}

/**
 * 동률 시 붙임 우선 = 문서 일관성 MVP 내부 정책(규범·사전 등재와 무관).
 * @param {{ variant: string, count: number }[]} ranked
 * @returns {string}
 */
export function pickRecommendedUnify(ranked) {
  if (!ranked.length) return '';
  const top = ranked[0].count;
  const tied = ranked.filter((row) => row.count === top);
  const glued = tied.find((row) => !/\s/.test(row.variant));
  if (glued) return glued.variant;
  const bySpaces = [...tied].sort(
    (a, b) =>
      spaceCount(a.variant) - spaceCount(b.variant) ||
      a.variant.localeCompare(b.variant, 'ko'),
  );
  return bySpaces[0].variant;
}

/**
 * @typedef {{
 *   counts: Map<string, number>,
 *   occurrences: Map<string, UnifyVariantOccurrence[]>,
 * }} ClusterAcc
 */

/**
 * @param {Map<string, ClusterAcc>} byKey
 * @param {number} pageNum
 * @param {number} index
 * @param {string} rawMatched
 * @param {number} minHangul
 * @param {string[] | null} [visualLines] page.text soft-wrap 병합 줄 — 붙임 오탐 검증
 */
/**
 * resolveHighlightIndex 전에 싼 거절·정규화만. 통과 시 누적에 쓸 필드.
 * @param {string} rawMatched
 * @param {number} minHangul
 * @returns {{ variant: string, key: string, matchedText: string, withPunctStripped: string, punctTokens: import('./kiwiMorph/tokens.js').KiwiToken[] | null } | null}
 */
function prepareUnifyOccurrenceCandidate(rawMatched, minHangul) {
  // 줄 단위 스캔만 하므로, 줄바꿈이 섞인 raw는 버림
  if (/\n/.test(String(rawMatched ?? ''))) return null;
  if (isExcludedUnifyCandidateRaw(rawMatched)) return null;
  // 가운데점 나열만 Kiwi — NOISE_FILTER morph 활성 시
  if (
    isUnifyKiwiNoiseMorphActive() &&
    /[·ㆍ]/.test(String(rawMatched ?? '')) &&
    (isKiwiEnumerationSurface(rawMatched) ||
      isKiwiEnumerationSurface(normalizeUnifyScanText(rawMatched)))
  ) {
    return null;
  }
  const matchedText = normalizeUnifyScanText(rawMatched);
  // 스캔: 기호·주변 숫자 제거 후 끝 조사 제거 → 같은 표기를 한 키로 묶음
  const withPunctStripped = stripUnifyPeripheralDigits(
    stripUnifyPunctuationNoise(normalizeUnifyVariant(matchedText)),
  );
  if (!withPunctStripped) return null;
  if (/\s/.test(withPunctStripped) && !isValidSpacedUnifyVariant(withPunctStripped)) {
    return null;
  }
  if (/\s/.test(withPunctStripped) && spacedPartIsBareJosa(withPunctStripped)) {
    return null;
  }
  // 끝 조사: JOSA/BOUNDARY/NOISE morph 활성일 때만 Kiwi (플래그 없이 ready만으로 전량 금지).
  // 동일 표면 analyze 1회로 strip·이다·동사화 게이트에 재사용.
  let variant = stripTrailingJosaHeuristic(withPunctStripped, minHangul);
  /** @type {import('./kiwiMorph/tokens.js').KiwiToken[] | null} */
  let punctTokens = null;
  if (shouldAnalyzeUnifyOccurrenceWithKiwi() && isKiwiReady()) {
    try {
      const analyzed = analyzeLine(withPunctStripped);
      if (analyzed?.tokens?.length) {
        punctTokens = analyzed.tokens;
        if (analyzed.surface1to1) {
          const kiwiStem = stripTrailingJosaFromTokens(
            withPunctStripped,
            punctTokens,
            minHangul,
          );
          if (kiwiStem != null) variant = kiwiStem;
        }
      }
    } catch {
      /* heuristic 유지 */
    }
  }
  if (!variant) return null;
  if (/\s/.test(variant) && !isValidSpacedUnifyVariant(variant)) return null;
  // 결국 시장·보통 시장 — 명사+명사/동사+동사 아니면 발견 단계에서도 제외
  if (
    isUnifyKiwiNoiseMorphActive() &&
    /\s/.test(variant) &&
    shouldRejectUnifySatelliteSpacedByPos(variant, undefined)
  ) {
    return null;
  }
  const key = variant.replace(/\s+/g, '');
  if (hangulSyllableCount(key) < minHangul) return null;
  // 1·2차 공통 잡음 경로
  if (shouldRejectUnifyCandidateNoise(variant, key)) return null;
  // 이다 종결·연결·명사+동사화 — 붙임형은 punctTokens 재사용, 키만 다를 때 추가 분석
  if (isUnifyKiwiNoiseMorphActive()) {
    const gluedPunct = withPunctStripped.replace(/\s+/g, '');
    const tokenOpts =
      punctTokens && key === gluedPunct ? { tokens: punctTokens } : {};
    if (isKiwiCopulaEndingSurface(key, tokenOpts)) return null;
    if (isKiwiNounVerbalConnectiveSurface(key, tokenOpts)) return null;
    if (
      !/\s/.test(withPunctStripped) &&
      gluedPunct !== key &&
      (isKiwiCopulaEndingSurface(gluedPunct, { tokens: punctTokens ?? undefined }) ||
        isKiwiNounVerbalConnectiveSurface(gluedPunct, {
          tokens: punctTokens ?? undefined,
        }))
    ) {
      return null;
    }
  }
  return { variant, key, matchedText, withPunctStripped, punctTokens };
}

/**
 * @param {Map<string, ClusterAcc>} byKey
 * @param {number} pageNum
 * @param {number} index
 * @param {{ variant: string, key: string, matchedText: string }} prepared
 */
function recordUnifyOccurrence(byKey, pageNum, index, prepared) {
  const { variant, key, matchedText } = prepared;
  let acc = byKey.get(key);
  if (!acc) {
    acc = { counts: new Map(), occurrences: new Map() };
    byKey.set(key, acc);
  }
  const list = acc.occurrences.get(variant) ?? [];
  // 붙임만 — 같은 쪽·같은 index 중복 금지 (띄움은 공백 정규화로 index가 겹칠 수 있음)
  if (
    !/\s/.test(variant) &&
    list.some(
      (o) =>
        Number(o.pageNum) === Number(pageNum) && Number(o.index) === Number(index),
    )
  ) {
    return;
  }
  acc.counts.set(variant, (acc.counts.get(variant) || 0) + 1);
  list.push({
    pageNum,
    index,
    matchedText: matchedText.length ? matchedText : variant,
  });
  acc.occurrences.set(variant, list);
}

/**
 * @param {Map<string, ClusterAcc>} byKey
 * @param {number} pageNum
 * @param {number} index
 * @param {string} rawMatched
 * @param {number} minHangul
 * @param {string[] | null} [visualLines]
 */
function addOccurrence(
  byKey,
  pageNum,
  index,
  rawMatched,
  minHangul,
  visualLines = null,
) {
  const prepared = prepareUnifyOccurrenceCandidate(rawMatched, minHangul);
  if (!prepared) return;
  // textLayout만 붙임으로 읽힌 경우: Visual(page.text)에 연속 붙임이 없으면 유령
  if (
    !/\s/.test(prepared.variant) &&
    visualLines &&
    !visualLinesCorroborateGlued(visualLines, prepared.variant)
  ) {
    return;
  }
  recordUnifyOccurrence(byKey, pageNum, index, prepared);
}

/**
 * Visual **원본 줄**(soft-wrap 병합 전)에 붙임형이 연속 부분문자열로 있는지.
 * soft-wrap 병합 줄로 입증하면 「명|지계곡」이 원문에 없는데도 붙임이 된다.
 * 「명지 계곡」만 있으면 「명지계곡」은 false — 공백 제거 검색 금지.
 * @param {string[]} visualLines
 * @param {string} glued
 */
export function visualLinesCorroborateGlued(visualLines, glued) {
  const g = String(glued ?? '');
  if (!g || /\s/.test(g)) return true;
  if (!visualLines?.length) return true;
  return visualLines.some((line) => String(line ?? '').includes(g));
}

/**
 * page.text → 줄바꿈만 나눈 Visual 줄 (붙임 입증용, soft-wrap 병합 없음).
 * @param {string} pageText
 * @returns {string[]}
 */
export function buildRawVisualLinesForUnify(pageText) {
  const source = String(pageText ?? '');
  if (!source) return [];
  return source
    .split(/\n/u)
    .map((line) => line.replace(/\s+$/u, ''))
    .filter((line) => line.length > 0);
}

/**
 * @deprecated 붙임 입증에는 {@link buildRawVisualLinesForUnify}를 쓴다.
 * soft-wrap 병합 줄은 「명|지계곡」유령 붙임을 만들 수 있다.
 * @param {string} pageText
 * @returns {string[]}
 */
export function buildVisualSoftWrapLinesForUnify(pageText) {
  const source = String(pageText ?? '');
  if (!source) return [];
  return mergeUnifyHangulSoftWrapScanLines(
    splitUnifyScanLinesWithAbs(source),
  ).map((row) => row.line);
}

/**
 * @param {string} text
 * @returns {{ text: string, index: number }[]}
 */
function extractTokensWithIndex(text) {
  return [...text.matchAll(TOKEN_RE)].map((m) => ({
    text: m[0],
    index: m.index ?? 0,
  }));
}

/**
 * 마지막 토큰 뒤 따라붙은 기호(> 등)까지 raw 구간에 포함 — 이후 strip으로 어간에 합침.
 * @param {string} line
 * @param {number} endExclusive
 */
function extendEndThroughTrailingPunct(line, endExclusive) {
  let end = endExclusive;
  while (end < line.length && /[^\uAC00-\uD7A3\d\s]/.test(line[end])) {
    end += 1;
  }
  return end;
}

/**
 * @param {string} line
 * @param {{ text: string, index: number }} first
 * @param {{ text: string, index: number }} last
 */
function sliceUnifyRaw(line, first, last) {
  const end = extendEndThroughTrailingPunct(
    line,
    last.index + last.text.length,
  );
  return line.slice(first.index, end);
}

/**
 * textLayout 오프셋 → page.text(visual) 오프셋.
 * 같은 itemIndex의 itemRefsLayout ↔ itemRefs로 투영 (자간 가짜 공백 길이 차이 보정).
 * @param {{ itemRefs?: import('./pdfPageText.js').TextItemRef[], itemRefsLayout?: import('./pdfPageText.js').TextItemRef[] }} page
 * @param {number} layoutIndex
 * @returns {number}
 */
/** @type {WeakMap<object, Map<number, import('./pdfPageText.js').TextItemRef>>} */
const visualRefByItemCache = new WeakMap();

/**
 * @param {{ itemRefs?: import('./pdfPageText.js').TextItemRef[] }} page
 */
function getVisualRefByItemIndex(page) {
  const visualRefs = page?.itemRefs;
  if (!visualRefs?.length) return null;
  let map = visualRefByItemCache.get(page);
  if (!map) {
    map = new Map();
    for (const r of visualRefs) {
      if (r && typeof r.itemIndex === 'number') map.set(r.itemIndex, r);
    }
    visualRefByItemCache.set(page, map);
  }
  return map;
}

export function mapLayoutIndexToVisualIndex(page, layoutIndex) {
  const prefer = Math.max(0, layoutIndex);
  const layoutRefs = page?.itemRefsLayout;
  const visualRefs = page?.itemRefs;
  if (!layoutRefs?.length || !visualRefs?.length) return prefer;

  const hit = findRefForTextIndex(layoutRefs, prefer);
  if (!hit) return prefer;

  const visualRef = getVisualRefByItemIndex(page)?.get(hit.itemIndex);
  if (!visualRef) return prefer;

  const layoutLen = Math.max(1, hit.end - hit.start);
  const visualLen = Math.max(0, visualRef.end - visualRef.start);
  const local = Math.max(0, prefer - hit.start);
  if (visualLen <= 0) return visualRef.start;
  if (layoutLen === visualLen) {
    return visualRef.start + Math.min(local, visualLen - 1);
  }
  const visualLocal = Math.min(
    Math.floor((local / layoutLen) * visualLen),
    visualLen - 1,
  );
  return visualRef.start + visualLocal;
}

/**
 * @param {UnifyVariantOccurrence[]} occs
 * @param {Map<number, import('./pdfService.js').PageData>} pageByNum
 * @returns {UnifyVariantOccurrence[]}
 */
export function sortUnifyOccurrencesReadingOrder(occs, pageByNum) {
  if (!occs?.length || !pageByNum?.size) return [...(occs ?? [])];
  return sortInstancesReadingOrder(
    occs.map((o) => ({
      pageNum: o.pageNum,
      index: o.index,
      matchedText: o.matchedText,
      find: o.matchedText,
      ...(Array.isArray(o.itemIndexes) ? { itemIndexes: o.itemIndexes } : {}),
      ...(typeof o.x === 'number' ? { x: o.x } : {}),
      ...(typeof o.y === 'number' ? { y: o.y } : {}),
      ...(typeof o.column === 'number' ? { column: o.column } : {}),
    })),
    pageByNum,
  ).map((o) => ({
    pageNum: o.pageNum,
    index: o.index,
    matchedText: o.matchedText,
    ...(Array.isArray(o.itemIndexes) ? { itemIndexes: o.itemIndexes } : {}),
    ...(typeof o.x === 'number' ? { x: o.x } : {}),
    ...(typeof o.y === 'number' ? { y: o.y } : {}),
    ...(typeof o.column === 'number' ? { column: o.column } : {}),
  }));
}

/**
 * page.text에서 variant 출현 시작 오프셋 전부 (연속 문자열 우선, 없으면 자간 공백 무시).
 * @param {string} highlightSource
 * @param {string} rawMatched
 * @returns {number[]}
 */
export function collectUnifyPhraseStarts(highlightSource, rawMatched) {
  const variant = normalizeUnifyVariant(rawMatched);
  if (!variant || !highlightSource) return [];
  /** @type {number[]} */
  const starts = [];
  let pos = 0;
  while (pos <= highlightSource.length - variant.length) {
    const idx = highlightSource.indexOf(variant, pos);
    if (idx < 0) break;
    starts.push(idx);
    pos = idx + 1;
  }

  // 붙임형은 soft(공백 무시) 슬롯 금지 — 띄움 위치를 붙임 출현으로 만들지 않음
  if (!/\s/.test(variant)) return starts;

  // 띄움: exact 외에 이중 공백 등 soft 출현도 슬롯에 포함
  const seen = new Set(starts);
  pos = 0;
  while (pos < highlightSource.length) {
    const hit = findPhraseInSpan(highlightSource.slice(pos), variant);
    if (!hit) break;
    const idx = pos + hit.start;
    if (!seen.has(idx)) {
      seen.add(idx);
      starts.push(idx);
    }
    pos = idx + 1;
  }
  starts.sort((a, b) => a - b);
  return starts;
}

/**
 * 붙임 출현 — visual에 연속 문자열이 prefer 근처에 있을 때만.
 * soft·페이지 먼 exact로 띄움 자리·다른 붙임에 스냅하지 않음.
 * @param {string} highlightSource
 * @param {string} gluedVariant
 * @param {number} preferNear
 * @param {number} [window]
 * @returns {number} 없으면 -1
 */
export function resolveGluedHighlightIndexNear(
  highlightSource,
  gluedVariant,
  preferNear = 0,
  window = 256,
) {
  const variant = normalizeUnifyVariant(gluedVariant);
  if (!variant || /\s/.test(variant) || !highlightSource) return -1;
  const prefer = Math.max(0, preferNear);
  if (highlightSource.slice(prefer, prefer + variant.length) === variant) {
    return prefer;
  }
  const win = Math.max(0, window);
  let best = -1;
  let bestDist = Infinity;
  const from = Math.max(0, prefer - win);
  const limit = Math.min(
    highlightSource.length,
    prefer + win + variant.length,
  );
  let pos = from;
  while (pos <= limit - variant.length) {
    const idx = highlightSource.indexOf(variant, pos);
    if (idx < 0 || idx > limit - variant.length) break;
    const dist = Math.abs(idx - prefer);
    if (dist < bestDist) {
      bestDist = dist;
      best = idx;
    }
    if (idx > prefer && dist > bestDist && best >= 0) break;
    pos = idx + 1;
  }
  if (best < 0) return -1;
  // prefer가 이 붙임 구간 안(매핑 오차 slack)이어야 함.
  // 같은 쪽 다른 붙임·띄움 자리에 soft/먼 exact로 스냅하는 것 금지.
  const slack = 8;
  if (prefer < best - slack || prefer >= best + variant.length + slack) {
    return -1;
  }
  return best;
}

function unifyOccsAreGluedForm(occs) {
  const sample = occs?.[0]?.matchedText;
  if (!sample) return false;
  return !/\s/.test(normalizeUnifyVariant(sample));
}

/**
 * visual/itemRefs가 깨진 페이지에서도 출현·순·하이라이트 기준을 item+bbox로 맞춤.
 * @param {UnifyVariantOccurrence[]} occs
 * @param {import('./pdfService.js').PageData | { pageNum?: number, text?: string, items?: import('pdfjs-dist').TextItem[] } | null | undefined} page
 * @returns {UnifyVariantOccurrence[] | null} 재배치 불가면 null
 */
export function rebaseUnifyOccurrencesFromItemHits(occs, page) {
  if (!occs?.length) return null;
  if (!page?.items?.length) return null;
  const pageNum =
    Number(page.pageNum) || Number(occs[0].pageNum) || occs[0].pageNum;
  const matchedText = occs[0].matchedText;
  const needle = normalizeUnifyVariant(matchedText);
  if (!needle) return null;

  const hits = sortPhraseHitsReadingOrder(
    findPhraseHitsInPdfItems(page.items, needle),
    page.items,
    pageNum,
  );
  // items는 있는데 hit 없음 = 텍스트 조립 유령(지도 1글자 글리프 등) → 칩에서 제거
  if (!hits.length) return [];

  // 정렬에 쓴 것과 같은 gutter로 column을 고정 (페이지 전체 midpoint 재계산 금지)
  const xs = hits.map((h) => h.x);
  const span = Math.max(...xs) - Math.min(...xs);
  const gutterX = span >= 120 ? (Math.min(...xs) + Math.max(...xs)) / 2 : null;

  // 출현 수만큼만 hit 배정 — item 전수 hit로 늘려 띄움 자리를 붙임 칩으로 복제하지 않음
  const used = new Set();
  /** @type {UnifyVariantOccurrence[]} */
  const out = [];
  for (const occ of occs) {
    let bestI = -1;
    let bestDist = Infinity;
    const occIndex = Number(occ.index);
    const textIndex =
      Number.isFinite(occIndex) && occIndex >= 0 && occIndex < 100000
        ? occIndex
        : -1;
    const textRef =
      textIndex >= 0 && page.itemRefs?.length
        ? findRefForTextIndex(page.itemRefs, textIndex)
        : null;
    const textItem =
      textRef && Number.isFinite(textRef.itemIndex)
        ? page.items?.[textRef.itemIndex]
        : null;
    const ox =
      typeof occ.x === 'number'
        ? occ.x
        : (textItem?.transform?.[4] ?? null);
    const oy =
      typeof occ.y === 'number'
        ? occ.y
        : (textItem?.transform?.[5] ?? null);
    for (let i = 0; i < hits.length; i += 1) {
      if (used.has(i)) continue;
      const h = hits[i];
      let dist;
      if (typeof ox === 'number' && typeof h.x === 'number') {
        dist = Math.hypot(h.x - ox, (h.y ?? 0) - (oy ?? 0));
      } else if (textRef && Number.isFinite(textRef.itemIndex)) {
        dist = Math.abs((h.itemIndex ?? 0) - textRef.itemIndex);
      } else {
        dist = Math.abs(
          h.itemIndex - Math.floor(occIndex / 100000 || 0),
        );
      }
      if (dist < bestDist) {
        bestDist = dist;
        bestI = i;
      }
    }
    if (bestI < 0) continue;
    used.add(bestI);
    const h = hits[bestI];
    out.push({
      pageNum,
      // visual text index를 유지 — synthetic으로 바꾸면 locus 단일화가 깨짐
      index: textIndex >= 0 ? textIndex : h.itemIndex * 100000 + bestI,
      matchedText,
      itemIndexes: h.itemIndexes,
      x: h.x,
      y: h.y,
      ...(gutterX != null
        ? { column: h.x >= gutterX ? 1 : 0 }
        : {}),
    });
  }
  return out;
}

/**
 * 같은 페이지·같은 표기에 칩이 여러 개일 때 index가 한 출현에 몰리지 않게 슬롯을 배정.
 * (7번 칩만 있고 분홍이 없는 전형: 오른 면 출현이 왼 면 index로 스냅됨)
 * @param {UnifyVariantOccurrence[]} occs
 * @param {{ pageNum?: number, text?: string, items?: import('pdfjs-dist').TextItem[] } | null | undefined} page
 * @returns {UnifyVariantOccurrence[]}
 */
export function assignUniqueUnifyHighlightIndices(occs, page) {
  if (!occs?.length) return [];
  // item+bbox 재배치는 인덱스 전체(수천 variant)에서 돌리면 메인 스레드가 멈춤.
  // → enrichOccurrencesWithItemHits / instances 경로에서만 수행.
  if (!page?.text) return [...occs];
  const source = prepareUnifyScanText(page.text);
  const slots = collectUnifyPhraseStarts(source, occs[0].matchedText);
  // visual에 슬롯이 없으면 유령 출현 유지 금지
  if (!slots.length) return [];

  const used = new Set();
  /** @type {UnifyVariantOccurrence[]} */
  const out = [];
  for (const occ of occs) {
    let best = -1;
    let bestDist = Infinity;
    for (const slot of slots) {
      if (used.has(slot)) continue;
      const dist = Math.abs(slot - Number(occ.index));
      if (dist < bestDist) {
        bestDist = dist;
        best = slot;
      }
    }
    // 슬롯 부족 시 남은 occ를 원본 index로 남기면 55P 이중 칩이 된다
    if (best < 0) continue;
    used.add(best);
    out.push({ ...occ, index: best });
  }
  return out;
}

/**
 * 칩·하이라이트용 — 맞춤법과 같은 Kiwi 경계 게이트.
 * 발견 스캔(raw 횟수)은 그대로 두고, enrich 직전(텍스트 index 유효할 때)만 적용.
 * @param {UnifyVariantOccurrence[]} occs
 * @param {{ text?: string } | null | undefined} page
 * @returns {UnifyVariantOccurrence[]}
 */
export function filterUnifyOccurrencesByKiwiBoundary(occs, page) {
  if (!occs?.length) return [];
  if (!isSpellingKiwiBoundaryEnabled() || !isKiwiReady()) {
    return [...occs];
  }
  const source = prepareUnifyScanText(page?.text ?? '');
  if (!source) return [...occs];

  return occs.filter((occ) => {
    const matched = String(occ.matchedText ?? '');
    if (!matched) return true;
    const index = Number(occ.index);
    if (
      !Number.isFinite(index) ||
      index < 0 ||
      index + matched.length > source.length ||
      source.slice(index, index + matched.length) !== matched
    ) {
      // rebase 후 합성 index 등 — 판정 불가면 현행 유지
      return true;
    }
    try {
      return !shouldSkipMatchByKiwiBoundary(matched, source, index);
    } catch {
      return true;
    }
  });
}

/**
 * 표시·하이라이트용 — 페이지별 item+bbox로 출현을 재배치 (클러스터 확정 후·소수 variant만).
 * @param {UnifyVariantOccurrence[]} occs
 * @param {Map<number, import('./pdfService.js').PageData>} pageByNum
 * @returns {UnifyVariantOccurrence[]}
 */
export function enrichOccurrencesWithItemHits(occs, pageByNum) {
  if (!occs?.length) return [];
  if (!pageByNum?.size) return [...occs];
  // 이미 item+bbox로 고정된 출현 — 재검색·Kiwi boundary 재적용 생략
  if (
    occs.every(
      (o) => Array.isArray(o.itemIndexes) && o.itemIndexes.length > 0,
    )
  ) {
    return sortUnifyOccurrencesReadingOrder([...occs], pageByNum);
  }

  /** @type {Map<number, UnifyVariantOccurrence[]>} */
  const byPage = new Map();
  for (const occ of occs) {
    const pageNum = Number(occ.pageNum);
    const list = byPage.get(pageNum) ?? [];
    list.push(occ);
    byPage.set(pageNum, list);
  }

  /** @type {UnifyVariantOccurrence[]} */
  const out = [];
  for (const pageNum of [...byPage.keys()].sort((a, b) => a - b)) {
    const page = pageByNum.get(pageNum);
    const list = filterUnifyOccurrencesByKiwiBoundary(
      byPage.get(pageNum) ?? [],
      page,
    );
    if (!list.length) continue;
    const rebased = rebaseUnifyOccurrencesFromItemHits(list, page);
    if (rebased !== null) {
      // item hit → bbox 고정.
      // 붙임 hit 0 = 텍스트 조립 유령(지도 1글자 글리프). visual 슬롯으로 되돌리지 않음.
      // 띄움 hit 0만 visual 복원 — 2차 N+N(주식시장\n경제)이 item find를 못 잡을 때.
      if (rebased.length > 0) out.push(...rebased);
      else if (!unifyOccsAreGluedForm(list)) {
        out.push(...assignUniqueUnifyHighlightIndices(list, page));
      }
      continue;
    }
    out.push(...assignUniqueUnifyHighlightIndices(list, page));
  }
  return sortUnifyOccurrencesReadingOrder(out, pageByNum);
}

/**
 * 클러스터 출현을 item+bbox로 한 번 고정 (칩·미리보기·하이라이트 동일 소스).
 * @param {UnifySpacingCluster[]} clusters
 * @param {import('./pdfService.js').PageData[]} pages
 * @returns {UnifySpacingCluster[]}
 */
export function enrichClustersWithItemHits(clusters, pages) {
  const pageByNum = buildPageByNum(pages ?? []);
  if (!pageByNum.size) return clusters ?? [];
  const enriched = (clusters ?? []).map((cluster) =>
    enrichOneClusterWithItemHits(cluster, pageByNum),
  );
  return enriched.filter(Boolean);
}

/**
 * UI용 — 클러스터 단위로 양보하며 item enrich (finding ··· 동결 방지).
 * @param {UnifySpacingCluster[]} clusters
 * @param {import('./pdfService.js').PageData[]} pages
 * @param {{ yieldMs?: number }} [opts]
 * @returns {Promise<UnifySpacingCluster[]>}
 */
export async function enrichClustersWithItemHitsAsync(clusters, pages, opts = {}) {
  const yieldMs = opts.yieldMs ?? UNIFY_FIND_YIELD_MS;
  const pageByNum = buildPageByNum(pages ?? []);
  if (!pageByNum.size) return clusters ?? [];
  /** @type {UnifySpacingCluster[]} */
  const out = [];
  let lastYield = performance.now();
  for (const cluster of clusters ?? []) {
    const next = enrichOneClusterWithItemHits(cluster, pageByNum);
    if (next) out.push(next);
    if (yieldMs > 0 && performance.now() - lastYield >= yieldMs) {
      await new Promise((r) => setTimeout(r, 0));
      lastYield = performance.now();
    }
  }
  return out;
}

/**
 * page.text에서 variant가 start에 있으면 구간. 띄움은 공백 개수 차이(soft) 허용.
 * @param {string} source
 * @param {number} start
 * @param {string} variant
 * @returns {{ start: number, end: number } | null}
 */
function visualSpanAt(source, start, variant) {
  const v = normalizeUnifyVariant(variant);
  if (!source || !v || start < 0 || start >= source.length) return null;
  if (source.slice(start, start + v.length) === v) {
    return { start, end: start + v.length };
  }
  if (!/\s/.test(v)) return null;
  const hit = findPhraseInSpan(source.slice(start), v);
  if (!hit || hit.start !== 0) return null;
  const end = start + (hit.end ?? v.length);
  if (end <= start) return null;
  return { start, end };
}

/**
 * 충돌 클러스터 출현을 page.text 슬롯으로만 재구성 (layout/item 유령 제거).
 * 스캔은 textLayout을 쓰되, 칩·횟수·「전체 발견」속성은 visual만 인정 (집계 기준 B).
 * layout-only totalCount로 되돌리지 말 것.
 * @param {Record<string, UnifyVariantOccurrence[]>} occurrencesByVariant
 * @param {Record<string, number>} counts
 * @param {Map<number, { pageNum?: number, text?: string, items?: unknown[] }>} pageByNum
 * @returns {boolean} rematerialize 했으면 true
 */
export function rematerializeConflictOccurrencesFromPageText(
  occurrencesByVariant,
  counts,
  pageByNum,
) {
  const variants = Object.keys(occurrencesByVariant ?? {});
  const hasGlued = variants.some((v) => !/\s/.test(normalizeUnifyVariant(v)));
  const hasSpaced = variants.some((v) => /\s/.test(normalizeUnifyVariant(v)));
  if (!hasGlued || !hasSpaced) return false;

  const pageNums = new Set();
  for (const variant of variants) {
    for (const occ of occurrencesByVariant[variant] ?? []) {
      const n = Number(occ.pageNum) || 0;
      if (n) pageNums.add(n);
    }
  }
  if (!pageNums.size) return false;

  let anyText = false;
  for (const pageNum of pageNums) {
    if (prepareUnifyScanText(pageByNum?.get(pageNum)?.text ?? '')) {
      anyText = true;
      break;
    }
  }
  if (!anyText) return false;

  for (const variant of variants) {
    const v = normalizeUnifyVariant(variant);
    /** @type {UnifyVariantOccurrence[]} */
    const next = [];
    if (v) {
      for (const pageNum of [...pageNums].sort((a, b) => a - b)) {
        const source = prepareUnifyScanText(
          pageByNum?.get(pageNum)?.text ?? '',
        );
        if (!source) continue;
        for (const start of collectUnifyPhraseStarts(source, v)) {
          const span = visualSpanAt(source, start, v);
          if (!span) continue;
          next.push({
            pageNum,
            index: span.start,
            matchedText: v,
          });
        }
      }
    }
    occurrencesByVariant[variant] = next;
    counts[variant] = next.length;
  }

  dedupeConflictOccurrencesByVisualLocus(
    occurrencesByVariant,
    counts,
    pageByNum,
  );
  return true;
}

/**
 * 충돌 클러스터 — 한 highlight locus에는 page.text와 일치하는 이형태 하나만.
 * (item/xy 근접이 아니라 텍스트 구간 겹침 + visual slice 일치)
 * @param {Record<string, UnifyVariantOccurrence[]>} occurrencesByVariant
 * @param {Record<string, number>} counts
 * @param {Map<number, { pageNum?: number, text?: string, items?: unknown[] }>} pageByNum
 */
export function dedupeConflictOccurrencesByVisualLocus(
  occurrencesByVariant,
  counts,
  pageByNum,
) {
  const variants = Object.keys(occurrencesByVariant ?? {});
  const hasGlued = variants.some((v) => !/\s/.test(v));
  const hasSpaced = variants.some((v) => /\s/.test(v));
  if (!hasGlued || !hasSpaced) return;

  /** @type {{ variant: string, occ: UnifyVariantOccurrence, pageNum: number, start: number, end: number }[]} */
  const claims = [];

  for (const variant of variants) {
    const v = normalizeUnifyVariant(variant);
    if (!v) continue;
    const occs = occurrencesByVariant[variant] ?? [];
    if (!occs.length) continue;

    /** @type {Map<number, UnifyVariantOccurrence[]>} */
    const byPage = new Map();
    for (const occ of occs) {
      const pageNum = Number(occ.pageNum) || 0;
      if (!pageNum) continue;
      const list = byPage.get(pageNum) ?? [];
      list.push(occ);
      byPage.set(pageNum, list);
    }

    for (const [pageNum, pageOccs] of byPage) {
      const page = pageByNum?.get(pageNum);
      const source = prepareUnifyScanText(page?.text ?? '');
      if (!source) {
        for (const occ of pageOccs) {
          const start = Number(occ.index) || 0;
          claims.push({
            variant: v,
            occ,
            pageNum,
            start,
            end: start + v.length,
          });
        }
        continue;
      }

      const slots = collectUnifyPhraseStarts(source, v);
      if (!slots.length) continue;

      const ordered = sortUnifyOccurrencesReadingOrder(
        pageOccs,
        pageByNum instanceof Map ? pageByNum : new Map(),
      );
      const usedSlots = new Set();
      const synthetic = ordered.every((o) => Number(o.index) >= 100000);

      if (synthetic) {
        const n = Math.min(ordered.length, slots.length);
        for (let i = 0; i < n; i += 1) {
          const span = visualSpanAt(source, slots[i], v);
          if (!span) continue;
          claims.push({
            variant: v,
            occ: {
              ...ordered[i],
              index: span.start,
              matchedText: v,
            },
            pageNum,
            start: span.start,
            end: span.end,
          });
        }
        continue;
      }

      for (const occ of ordered) {
        const prefer = Number(occ.index);
        let best = -1;
        let bestDist = Infinity;
        for (const slot of slots) {
          if (usedSlots.has(slot)) continue;
          const dist = Math.abs(slot - prefer);
          if (dist < bestDist) {
            bestDist = dist;
            best = slot;
          }
        }
        if (best < 0) continue;
        const span = visualSpanAt(source, best, v);
        if (!span) continue;
        usedSlots.add(best);
        claims.push({
          variant: v,
          occ: { ...occ, index: span.start, matchedText: v },
          pageNum,
          start: span.start,
          end: span.end,
        });
      }
    }
  }

  /** @type {Map<number, typeof claims>} */
  const claimsByPage = new Map();
  for (const claim of claims) {
    const list = claimsByPage.get(claim.pageNum) ?? [];
    list.push(claim);
    claimsByPage.set(claim.pageNum, list);
  }

  /** @type {typeof claims} */
  const kept = [];

  for (const [pageNum, pageClaims] of claimsByPage) {
    const page = pageByNum?.get(pageNum);
    const source = prepareUnifyScanText(page?.text ?? '');
    const sorted = [...pageClaims].sort(
      (a, b) => a.start - b.start || a.end - b.end,
    );
    /** @type {typeof claims[]} */
    const groups = [];
    /** @type {typeof claims} */
    let cur = [];
    let curEnd = -1;
    for (const claim of sorted) {
      if (!cur.length || claim.start < curEnd) {
        cur.push(claim);
        curEnd = Math.max(curEnd, claim.end);
        continue;
      }
      groups.push(cur);
      cur = [claim];
      curEnd = claim.end;
    }
    if (cur.length) groups.push(cur);

    for (const group of groups) {
      const distinctVariants = new Set(group.map((c) => c.variant));
      if (distinctVariants.size === 1) {
        const seenStart = new Set();
        for (const claim of group) {
          if (seenStart.has(claim.start)) continue;
          seenStart.add(claim.start);
          kept.push(claim);
        }
        continue;
      }
      const unionStart = Math.min(...group.map((c) => c.start));
      const unionEnd = Math.max(...group.map((c) => c.end));
      const slice = source ? source.slice(unionStart, unionEnd) : '';
      const exact = slice ? group.find((c) => c.variant === slice) : null;
      if (exact) {
        kept.push(exact);
        continue;
      }
      const withSpace = /\s/.test(slice);
      const preferred = group.find((c) =>
        withSpace ? /\s/.test(c.variant) : !/\s/.test(c.variant),
      );
      if (preferred && visualSpanAt(source, preferred.start, preferred.variant)) {
        kept.push(preferred);
        continue;
      }
      const selfOk = group.find((c) =>
        visualSpanAt(source, c.start, c.variant),
      );
      if (selfOk) kept.push(selfOk);
    }
  }

  for (const variant of variants) {
    occurrencesByVariant[variant] = [];
    counts[variant] = 0;
  }
  for (const claim of kept) {
    const list = occurrencesByVariant[claim.variant] ?? [];
    list.push(claim.occ);
    occurrencesByVariant[claim.variant] = list;
  }
  for (const variant of Object.keys(occurrencesByVariant)) {
    counts[variant] = (occurrencesByVariant[variant] ?? []).length;
  }
}

/**
 * @param {UnifySpacingCluster} cluster
 * @param {Map<number, import('./pdfService.js').PageData>} pageByNum
 * @returns {UnifySpacingCluster | null}
 */
function enrichOneClusterWithItemHits(cluster, pageByNum) {
  /** @type {Record<string, UnifyVariantOccurrence[]>} */
  const occurrencesByVariant = {};
  /** @type {Record<string, number>} */
  const counts = {};
  for (const variant of cluster.variants ?? []) {
    occurrencesByVariant[variant] = [
      ...(cluster.occurrencesByVariant?.[variant] ?? []),
    ];
    counts[variant] = occurrencesByVariant[variant].length;
  }

  // 충돌: 칩·횟수 = page.text 슬롯만 (layout/item 유령 제거)
  rematerializeConflictOccurrencesFromPageText(
    occurrencesByVariant,
    counts,
    pageByNum,
  );

  let gluedAfterVisual = 0;
  for (const variant of cluster.variants ?? []) {
    const n = counts[variant] ?? 0;
    if (n > 0 && !/\s/.test(variant)) gluedAfterVisual += n;
  }

  for (const variant of cluster.variants ?? []) {
    const occs = occurrencesByVariant[variant] ?? [];
    if (!occs.length) {
      counts[variant] = 0;
      continue;
    }
    // rematerialize 직후엔 itemIndexes 없음 → rebase가 visual index 기준으로 붙음
    const next = enrichOccurrencesWithItemHits(occs, pageByNum);
    occurrencesByVariant[variant] = next;
    counts[variant] = next.length;
  }
  // item 경로가 텍스트 없는 페이지에서만 쓰인 경우 대비
  dedupeConflictOccurrencesByVisualLocus(
    occurrencesByVariant,
    counts,
    pageByNum,
  );
  const positive = (cluster.variants ?? []).filter(
    (v) => (counts[v] ?? 0) > 0,
  );
  if (!positive.length) {
    return null;
  }
  // rematerialize가 Visual 조립 붙임(명지계곡)을 슬롯으로 남긴 뒤
  // item hit 0으로 빠진 경우 — 1차 충돌이 아님. 2차 derived(원래 0회)는 유지.
  if (
    gluedAfterVisual > 0 &&
    !positive.some((v) => !/\s/.test(v))
  ) {
    return null;
  }
  for (const variant of Object.keys(occurrencesByVariant)) {
    occurrencesByVariant[variant] = sortUnifyOccurrencesReadingOrder(
      occurrencesByVariant[variant] ?? [],
      pageByNum,
    );
  }
  const ranked = (cluster.variants ?? [])
    .map((variant) => ({ variant, count: counts[variant] ?? 0 }))
    .sort((a, b) =>
      compareVariantRowsForClusterList(
        a,
        b,
        occurrencesByVariant,
        pageByNum,
      ),
    );
  const positiveRanked = ranked.filter((row) => row.count > 0);
  const hasGlued = positive.some((v) => !/\s/.test(v));
  const hasSpaced = positive.some((v) => /\s/.test(v));
  // 2차 패턴 mismatch(분위기 경제→분위기경제)처럼 문서에 한쪽만 있어도
  // variants에 붙임·띄움 쌍이 있으면 conflict 유지 (single-form 강등 금지).
  const pairInVariants =
    (cluster.variants ?? []).some((v) => /\s/.test(String(v))) &&
    (cluster.variants ?? []).some((v) => !/\s/.test(String(v)));
  const keepConflictPair = cluster.kind === 'conflict' && pairInVariants;
  const keepAsSingleForm =
    !keepConflictPair &&
    (cluster.kind === 'single-form' || !hasGlued || !hasSpaced);
  const recommendRanked = [...positiveRanked].sort(
    (a, b) =>
      b.count - a.count ||
      spaceCount(a.variant) - spaceCount(b.variant) ||
      a.variant.localeCompare(b.variant, 'ko'),
  );
  const preservedRecommend = String(cluster.recommendedUnify ?? '').trim();
  return {
    ...cluster,
    ...(keepAsSingleForm ? { kind: /** @type {const} */ ('single-form') } : {}),
    ...(keepConflictPair ? { kind: /** @type {const} */ ('conflict') } : {}),
    variants: ranked.map((row) => row.variant),
    counts: Object.fromEntries(ranked.map((row) => [row.variant, row.count])),
    occurrencesByVariant: Object.fromEntries(
      ranked.map((row) => [row.variant, occurrencesByVariant[row.variant] ?? []]),
    ),
    recommendedUnify:
      keepConflictPair && preservedRecommend
        ? preservedRecommend
        : pickRecommendedUnify(recommendRanked),
    totalCount: positiveRanked.reduce((sum, row) => sum + row.count, 0),
  };
}

/**
 * 계열 위성 포함 그룹 전체 클러스터를 item hit으로 재집계 (횟수·칩 동기화).
 * @param {import('./unifyCandidateGrouping.js').ClusterGroup[]} groups
 * @param {import('./pdfService.js').PageData[]} pages
 * @returns {import('./unifyCandidateGrouping.js').ClusterGroup[]}
 */
export function enrichClusterGroupsWithItemHits(groups, pages) {
  if (!pages?.length) return groups ?? [];
  return (groups ?? [])
    .map((group) => ({
      ...group,
      clusters: enrichClustersWithItemHits(group.clusters ?? [], pages),
    }))
    .filter((group) => (group.clusters?.length ?? 0) > 0);
}

/**
 * UI용 — 그룹별 enrich + 양보.
 * @param {import('./unifyCandidateGrouping.js').ClusterGroup[]} groups
 * @param {import('./pdfService.js').PageData[]} pages
 * @param {{ yieldMs?: number }} [opts]
 */
export async function enrichClusterGroupsWithItemHitsAsync(
  groups,
  pages,
  opts = {},
) {
  if (!pages?.length) return groups ?? [];
  const yieldMs = opts.yieldMs ?? UNIFY_FIND_YIELD_MS;
  /** @type {import('./unifyCandidateGrouping.js').ClusterGroup[]} */
  const out = [];
  let lastYield = performance.now();
  for (const group of groups ?? []) {
    const clusters = await enrichClustersWithItemHitsAsync(
      group.clusters ?? [],
      pages,
      { yieldMs },
    );
    if (clusters.length > 0) {
      out.push({ ...group, clusters });
    }
    if (yieldMs > 0 && performance.now() - lastYield >= yieldMs) {
      await new Promise((r) => setTimeout(r, 0));
      lastYield = performance.now();
    }
  }
  return out;
}

/**
 * @param {UnifyVariantOccurrence[]} occs
 * @param {Map<number, import('./pdfService.js').PageData>} pageByNum
 * @param {Map<number, { pageNum?: number, text?: string }>} pageTextByNum
 * @returns {UnifyVariantOccurrence[]}
 */
function finalizeUnifyOccurrenceList(occs, pageByNum, pageTextByNum) {
  /** @type {Map<number, UnifyVariantOccurrence[]>} */
  const byPage = new Map();
  for (const occ of occs) {
    const list = byPage.get(occ.pageNum) ?? [];
    list.push(occ);
    byPage.set(occ.pageNum, list);
  }
  /** @type {UnifyVariantOccurrence[]} */
  const out = [];
  for (const pageNum of [...byPage.keys()].sort((a, b) => a - b)) {
    const page = pageByNum.get(pageNum) ?? pageTextByNum.get(pageNum);
    const assigned = assignUniqueUnifyHighlightIndices(
      byPage.get(pageNum) ?? [],
      page,
    );
    out.push(...sortUnifyOccurrencesReadingOrder(assigned, pageByNum));
  }
  return out;
}

/**
 * 하이라이트용 — page.text에서 needle의 **preferNear에 가장 가까운** 출현.
 * (indexOf 첫 출현만 쓰면 같은 페이지 2/2 하이라이트가 1/2로만 간다)
 * @param {string} highlightSource prepareUnifyScanText(page.text)
 * @param {string} rawMatched
 * @param {number} preferNear 스캔 소스 기준 절대 오프셋(가급적)
 */
export function resolveHighlightIndex(
  highlightSource,
  rawMatched,
  preferNear = 0,
) {
  const variant = normalizeUnifyVariant(rawMatched);
  if (!variant || !highlightSource) return Math.max(0, preferNear);
  const prefer = Math.max(0, preferNear);
  if (highlightSource.slice(prefer, prefer + variant.length) === variant) {
    return prefer;
  }

  /** prefer 근처만 먼저 — 전 페이지 indexOf/자간탐색 비용 회피 */
  const WINDOW = 2048;
  const findNearestExact = (from, to) => {
    let best = -1;
    let bestDist = Infinity;
    let pos = Math.max(0, from);
    const limit = Math.min(highlightSource.length, to);
    while (pos <= limit - variant.length) {
      const idx = highlightSource.indexOf(variant, pos);
      if (idx < 0 || idx > limit - variant.length) break;
      const dist = Math.abs(idx - prefer);
      if (dist < bestDist) {
        bestDist = dist;
        best = idx;
      }
      // prefer보다 훨씬 멀어지면 중단 (이미 가까운 쪽을 지남)
      if (idx > prefer && dist > bestDist && best >= 0) break;
      pos = idx + 1;
    }
    return best;
  };

  const nearExact = findNearestExact(prefer - WINDOW, prefer + WINDOW + variant.length);
  if (nearExact >= 0) return nearExact;

  const farExact = findNearestExact(0, highlightSource.length);
  if (farExact >= 0) return farExact;

  // page.text에 자간 가짜 공백이 있으면 연속 부분문자열이 없음 → 공백 무시 탐색
  // 전 위치에서 slice+find 반복은 O(n²) — prefer 창 → 전체 1패스만
  const findNearestSoft = (from, to) => {
    let best = -1;
    let bestDist = Infinity;
    let pos = Math.max(0, from);
    const limit = Math.min(highlightSource.length, to);
    while (pos < limit) {
      const hit = findPhraseInSpan(highlightSource.slice(pos, limit), variant);
      if (!hit) break;
      const idx = pos + hit.start;
      const dist = Math.abs(idx - prefer);
      if (dist < bestDist) {
        bestDist = dist;
        best = idx;
      }
      const step = Math.max(1, (hit.end ?? hit.start + 1) - hit.start);
      pos = idx + step;
    }
    return best;
  };

  const nearSoft = findNearestSoft(prefer - WINDOW, prefer + WINDOW + variant.length * 4);
  if (nearSoft >= 0) return nearSoft;

  const farSoft = findNearestSoft(0, highlightSource.length);
  return farSoft >= 0 ? farSoft : prefer;
}

/**
 * resolveHighlightIndex 결과를 page.text·하이라이트 가능 오프셋으로 고정.
 * (자간 공백·layout 투영 오차로 index만 있고 분홍 박스가 안 나오는 경우 방지)
 * @param {{ pageNum?: number, text?: string, items?: unknown[], itemRefs?: unknown[] }} page
 * @param {string} highlightSource
 * @param {string} rawMatched
 * @param {number} preferNear
 */
export function resolveAndSnapUnifyHighlightIndex(
  page,
  highlightSource,
  rawMatched,
  preferNear = 0,
) {
  const resolved = resolveHighlightIndex(
    highlightSource,
    rawMatched,
    preferNear,
  );
  const variant = normalizeUnifyVariant(rawMatched);
  const pageNum = Number(page?.pageNum) || 0;
  if (!variant || !page?.text || !pageNum) return resolved;
  const range = highlightRangeForSpelling(
    {
      pageNum,
      text: page.text,
      items: page.items,
      itemRefs: page.itemRefs,
    },
    {
      pageNum,
      index: resolved,
      matchedText: variant,
    },
  );
  return range ? range.start : resolved;
}

/**
 * 줄 단위 스캔 + 토큰 인덱스 → 페이지 절대 오프셋 매핑.
 * splitUnifyScanLines와 동일하게 공백 압축·trim.
 * @param {string} pageText
 * @returns {{ line: string, absIndex: (i: number) => number }[]}
 */
function splitUnifyScanLinesWithAbs(pageText) {
  const prepared = prepareUnifyScanText(pageText);
  /** @type {{ line: string, absIndex: (i: number) => number }[]} */
  const out = [];
  const re = /[^\n]+/g;
  let m;
  while ((m = re.exec(prepared)) !== null) {
    const raw = m[0];
    const lineStart = m.index ?? 0;
    /** @type {number[]} */
    const map = [];
    let line = '';
    let i = 0;
    while (i < raw.length && (raw[i] === ' ' || raw[i] === '\t')) i += 1;
    let lastSpace = false;
    for (; i < raw.length; i += 1) {
      const ch = raw[i];
      if (ch === ' ' || ch === '\t') {
        if (lastSpace) continue;
        line += ' ';
        map.push(lineStart + i);
        lastSpace = true;
        continue;
      }
      line += ch;
      map.push(lineStart + i);
      lastSpace = false;
    }
    while (line.endsWith(' ')) {
      line = line.slice(0, -1);
      map.pop();
    }
    if (!line) continue;
    out.push({
      line,
      absIndex: (idx) => {
        if (!map.length) return lineStart;
        const clamped = Math.min(Math.max(0, idx), map.length - 1);
        return map[clamped] ?? lineStart;
      },
    });
  }
  return mergeUnifyHangulSoftWrapScanLines(out);
}

/**
 * 줄끝·줄머리 한글 음절이 맞닿은 soft-wrap만 스캔용으로 이음.
 * 어절 경계(수도|있다 등)는 붙이지 않음. 단어 중간 갈라짐(명|지 계곡)만 이음.
 * @param {{ line: string, absIndex: (i: number) => number }[]} lines
 */
export function mergeUnifyHangulSoftWrapScanLines(lines) {
  if (!lines?.length) return [];
  /** @type {{ line: string, absIndex: (i: number) => number }[]} */
  const out = [];
  let cur = lines[0];
  for (let i = 1; i < lines.length; i += 1) {
    const next = lines[i];
    const a = cur.line;
    const b = next.line;
    if (isUnifyHangulMidWordSoftWrap(a, b)) {
      const aLen = a.length;
      const aAbs = cur.absIndex;
      const bAbs = next.absIndex;
      cur = {
        line: a + b,
        absIndex: (idx) => {
          if (idx < aLen) return aAbs(idx);
          return bAbs(idx - aLen);
        },
      };
      continue;
    }
    out.push(cur);
    cur = next;
  }
  out.push(cur);
  return out;
}

/**
 * 한 페이지분 토큰·n-gram을 byKey에 누적 (스냅·finalize 없음). sync — 테스트·동기 discover용.
 * @param {Map<string, ClusterAcc>} byKey
 * @param {{ pageNum?: number, text?: string, textLayout?: string }} page
 * @param {number} minHangul
 */
function accumulateUnifyPageOccurrences(byKey, page, minHangul) {
  const pageNum = Number(page?.pageNum) || 0;
  const sourceText =
    typeof page?.textLayout === 'string' && page.textLayout.length > 0
      ? page.textLayout
      : (page?.text ?? '');
  if (!sourceText || !pageNum) return;
  const highlightSource = prepareUnifyScanText(page?.text ?? sourceText);
  const visualLines = buildRawVisualLinesForUnify(page?.text ?? '');
  const visualBlob = visualLines.join('\n');
  /** @type {Map<string, boolean>} */
  const gluedOkCache = new Map();
  /** @type {Map<string, ReturnType<typeof prepareUnifyOccurrenceCandidate>>} */
  const prepareCache = new Map();
  const usingLayout =
    typeof page?.textLayout === 'string' &&
    page.textLayout.length > 0 &&
    page.textLayout !== (page?.text ?? '');

  /**
   * @param {string} glued
   */
  const corroborateGlued = (glued) => {
    const hit = gluedOkCache.get(glued);
    if (hit !== undefined) return hit;
    const ok = visualBlob.includes(glued);
    gluedOkCache.set(glued, ok);
    return ok;
  };

  /**
   * @param {string} raw
   * @param {number} preferNear
   */
  const tryAdd = (raw, preferNear) => {
    let prepared = prepareCache.get(raw);
    if (prepared === undefined) {
      prepared = prepareUnifyOccurrenceCandidate(raw, minHangul);
      prepareCache.set(raw, prepared);
    }
    if (!prepared) return;
    const isGlued = !/\s/.test(prepared.variant);
    if (isGlued && visualLines.length > 0 && !corroborateGlued(prepared.variant)) {
      return;
    }
    const index = isGlued
      ? resolveGluedHighlightIndexNear(
          highlightSource,
          prepared.variant,
          preferNear,
        )
      : resolveHighlightIndex(highlightSource, raw, preferNear);
    if (isGlued && index < 0) return;
    recordUnifyOccurrence(byKey, pageNum, index, prepared);
  };

  for (const { line, absIndex } of splitUnifyScanLinesWithAbs(sourceText)) {
    const tokens = extractTokensWithIndex(line);
    for (let i = 0; i < tokens.length; i += 1) {
      const tokenRaw = sliceUnifyRaw(line, tokens[i], tokens[i]);
      const preferNear = usingLayout
        ? mapLayoutIndexToVisualIndex(page, absIndex(tokens[i].index))
        : absIndex(tokens[i].index);
      tryAdd(tokenRaw, preferNear);
      const maxN = Math.min(UNIFY_MAX_NGRAM_TOKENS, tokens.length - i);
      for (let n = 2; n <= maxN; n += 1) {
        const last = tokens[i + n - 1];
        const raw = sliceUnifyRaw(line, tokens[i], last);
        // n-gram 시작 오프셋 = 첫 토큰과 동일 — layout 매핑 재계산 불필요
        tryAdd(raw, preferNear);
      }
    }
  }
}

/**
 * UI용 — yieldMs마다 양보하며 한 페이지 누적.
 * @param {Map<string, ClusterAcc>} byKey
 * @param {{ pageNum?: number, text?: string, textLayout?: string }} page
 * @param {number} minHangul
 * @param {number} [yieldMs]
 * @param {{ last: number, sinceCheck: number }} [yieldState] 전체 스캔 공유
 */
async function accumulateUnifyPageOccurrencesAsync(
  byKey,
  page,
  minHangul,
  yieldMs = UNIFY_FIND_YIELD_MS,
  yieldState = null,
) {
  const pageNum = Number(page?.pageNum) || 0;
  const sourceText =
    typeof page?.textLayout === 'string' && page.textLayout.length > 0
      ? page.textLayout
      : (page?.text ?? '');
  if (!sourceText || !pageNum) return;
  const highlightSource = prepareUnifyScanText(page?.text ?? sourceText);
  const visualLines = buildRawVisualLinesForUnify(page?.text ?? '');
  const visualBlob = visualLines.join('\n');
  /** @type {Map<string, boolean>} */
  const gluedOkCache = new Map();
  /** @type {Map<string, ReturnType<typeof prepareUnifyOccurrenceCandidate>>} */
  const prepareCache = new Map();
  const usingLayout =
    typeof page?.textLayout === 'string' &&
    page.textLayout.length > 0 &&
    page.textLayout !== (page?.text ?? '');

  const state = yieldState ?? {
    last: performance.now(),
    sinceCheck: 0,
  };
  const YIELD_CHECK_EVERY = 64;
  const maybeYield = async () => {
    if (!(yieldMs > 0)) return;
    state.sinceCheck += 1;
    if (state.sinceCheck < YIELD_CHECK_EVERY) return;
    state.sinceCheck = 0;
    if (performance.now() - state.last < yieldMs) return;
    await new Promise((r) => setTimeout(r, 0));
    state.last = performance.now();
  };

  /**
   * @param {string} glued
   */
  const corroborateGlued = (glued) => {
    const hit = gluedOkCache.get(glued);
    if (hit !== undefined) return hit;
    const ok = visualBlob.includes(glued);
    gluedOkCache.set(glued, ok);
    return ok;
  };

  /**
   * @param {string} raw
   * @param {number} preferNear
   */
  const tryAdd = (raw, preferNear) => {
    let prepared = prepareCache.get(raw);
    if (prepared === undefined) {
      prepared = prepareUnifyOccurrenceCandidate(raw, minHangul);
      prepareCache.set(raw, prepared);
    }
    if (!prepared) return;
    const isGlued = !/\s/.test(prepared.variant);
    if (isGlued && visualLines.length > 0 && !corroborateGlued(prepared.variant)) {
      return;
    }
    const index = isGlued
      ? resolveGluedHighlightIndexNear(
          highlightSource,
          prepared.variant,
          preferNear,
        )
      : resolveHighlightIndex(highlightSource, raw, preferNear);
    if (isGlued && index < 0) return;
    recordUnifyOccurrence(byKey, pageNum, index, prepared);
  };

  for (const { line, absIndex } of splitUnifyScanLinesWithAbs(sourceText)) {
    const tokens = extractTokensWithIndex(line);
    for (let i = 0; i < tokens.length; i += 1) {
      const tokenRaw = sliceUnifyRaw(line, tokens[i], tokens[i]);
      const preferNear = usingLayout
        ? mapLayoutIndexToVisualIndex(page, absIndex(tokens[i].index))
        : absIndex(tokens[i].index);
      tryAdd(tokenRaw, preferNear);
      await maybeYield();
      const maxN = Math.min(UNIFY_MAX_NGRAM_TOKENS, tokens.length - i);
      for (let n = 2; n <= maxN; n += 1) {
        const raw = sliceUnifyRaw(line, tokens[i], tokens[i + n - 1]);
        tryAdd(raw, preferNear);
        await maybeYield();
      }
    }
  }
}

/**
 * 붙임+띄움 충돌 키의 occurrence만 슬롯 배정·정렬 (전체 raw 키 finalize 금지).
 * @param {Map<string, ClusterAcc>} byKey
 * @param {{ pageNum?: number, text?: string, textLayout?: string, items?: unknown[] }[]} pageTexts
 */
function finalizeConflictOccurrencesOnly(byKey, pageTexts) {
  const pageByNum = buildPageByNum(pageTexts ?? []);
  for (const acc of byKey.values()) {
    const variants = [...acc.counts.keys()];
    const hasGlued = variants.some((v) => !/\s/.test(v));
    const hasSpaced = variants.some((v) => /\s/.test(v));
    if (!hasGlued || !hasSpaced) continue;
    for (const [variant, list] of acc.occurrences) {
      const snapped = snapUnifyOccurrenceIndices(list, pageByNum);
      acc.occurrences.set(variant, snapped);
    }
    /** @type {Record<string, UnifyVariantOccurrence[]>} */
    const occurrencesByVariant = {};
    /** @type {Record<string, number>} */
    const counts = {};
    for (const variant of variants) {
      occurrencesByVariant[variant] = acc.occurrences.get(variant) ?? [];
      counts[variant] = occurrencesByVariant[variant].length;
    }
    rematerializeConflictOccurrencesFromPageText(
      occurrencesByVariant,
      counts,
      pageByNum,
    );
    dedupeConflictOccurrencesByVisualLocus(
      occurrencesByVariant,
      counts,
      pageByNum,
    );
    for (const variant of variants) {
      const list = occurrencesByVariant[variant] ?? [];
      acc.occurrences.set(variant, list);
      if (list.length) acc.counts.set(variant, list.length);
      else acc.counts.delete(variant);
    }
  }
}

/**
 * 충돌 variant occurrence index를 highlightRange로 한 번만 고정.
 * @param {UnifyVariantOccurrence[]} occs
 * @param {Map<number, import('./pdfService.js').PageData>} pageByNum
 * @returns {UnifyVariantOccurrence[]}
 */
function snapUnifyOccurrenceIndices(occs, pageByNum) {
  if (!occs?.length) return [];
  /** @type {UnifyVariantOccurrence[]} */
  const out = [];
  for (const occ of occs) {
    const page = pageByNum.get(Number(occ.pageNum));
    if (!page?.text) {
      out.push(occ);
      continue;
    }
    const source = prepareUnifyScanText(page.text);
    const variant = normalizeUnifyVariant(occ.matchedText);
    if (!variant) {
      out.push(occ);
      continue;
    }
    if (!/\s/.test(variant)) {
      const gluedIdx = resolveGluedHighlightIndexNear(
        source,
        variant,
        occ.index,
      );
      if (gluedIdx < 0) continue;
      out.push(gluedIdx === occ.index ? occ : { ...occ, index: gluedIdx });
      continue;
    }
    const snapped = resolveAndSnapUnifyHighlightIndex(
      page,
      source,
      occ.matchedText,
      occ.index,
    );
    out.push(snapped === occ.index ? occ : { ...occ, index: snapped });
  }
  return out;
}

/**
 * @param {{ pageNum?: number, text?: string, textLayout?: string }[]} pageTexts
 * @param {{ minHangulSyllables?: number }} [opts]
 * @returns {Map<string, ClusterAcc>}
 */
export function buildUnifyOccurrenceIndex(pageTexts, opts = {}) {
  const minHangul = opts.minHangulSyllables ?? 2;
  /** @type {Map<string, ClusterAcc>} */
  const byKey = new Map();

  for (const page of pageTexts ?? []) {
    accumulateUnifyPageOccurrences(byKey, page, minHangul);
  }

  finalizeConflictOccurrencesOnly(byKey, pageTexts ?? []);
  return byKey;
}

/**
 * 시나리오 C prefetch용 — addOccurrence와 같은 전처리 표면형 수집.
 * @param {{ pageNum?: number, text?: string, textLayout?: string }[]} pageTexts
 * @returns {string[]}
 */
function collectUnifyKiwiPrefetchSurfaces(pageTexts) {
  /** @type {Set<string>} */
  const eojeols = new Set();
  /** @type {Set<string>} */
  const ngrams = new Set();
  for (const page of pageTexts ?? []) {
    const sourceText =
      typeof page?.textLayout === 'string' && page.textLayout.length > 0
        ? page.textLayout
        : (page?.text ?? '');
    if (!sourceText) continue;
    for (const { line } of splitUnifyScanLinesWithAbs(sourceText)) {
      const tokens = extractTokensWithIndex(line);
      for (let i = 0; i < tokens.length; i += 1) {
        const tokenRaw = sliceUnifyRaw(line, tokens[i], tokens[i]);
        const one = stripUnifyPeripheralDigits(
          stripUnifyPunctuationNoise(normalizeUnifyVariant(tokenRaw)),
        );
        if (one) {
          eojeols.add(one);
          const hangul = one.replace(/[^\uAC00-\uD7A3]/gu, '');
          if (hangul) eojeols.add(hangul);
        }
        const maxN = Math.min(UNIFY_MAX_NGRAM_TOKENS, tokens.length - i);
        for (let n = 2; n <= maxN; n += 1) {
          const raw = sliceUnifyRaw(line, tokens[i], tokens[i + n - 1]);
          const prep = stripUnifyPeripheralDigits(
            stripUnifyPunctuationNoise(normalizeUnifyVariant(raw)),
          );
          if (!prep) continue;
          ngrams.add(prep);
          for (const part of prep.split(/\s+/).filter(Boolean)) {
            eojeols.add(part);
            const hangul = part.replace(/[^\uAC00-\uD7A3]/gu, '');
            if (hangul) eojeols.add(hangul);
          }
        }
      }
    }
  }
  // 어절 단독을 앞에 — 위성 POS·명사동사화 게이트가 캐시 미스 나지 않게
  return [...eojeols, ...ngrams].slice(0, 1200);
}

/**
 * 페이지마다 이벤트 루프에 양보 — 메인 스레드 '응답 없음' 방지.
 * 시나리오 C: Kiwi 서버 모드면 표면형 prefetch 후 누적.
 * @param {{ pageNum?: number, text?: string, textLayout?: string }[]} pageTexts
 * @param {{ minHangulSyllables?: number }} [opts]
 * @returns {Promise<{ byKey: Map<string, ClusterAcc>, morphFilterActive: boolean }>}
 */
export async function buildUnifyOccurrenceIndexAsync(pageTexts, opts = {}) {
  const minHangul = opts.minHangulSyllables ?? 2;
  /** @type {Map<string, ClusterAcc>} */
  const byKey = new Map();
  const pages = pageTexts ?? [];

  // 오픈베타: 찾기에서 Kiwi boot/대기·동기 morph 생략 (웜업돼 있어도 전량 analyze 동결 방지).
  // BOUNDARY prefetch만 필요할 때 boot (서버 배치).
  try {
    if (isSpellingKiwiBoundaryEnabled()) {
      const { shouldBootKiwi, bootKiwiIfNeeded } = await import(
        './kiwiMorph/bootLocal.js'
      );
      if (shouldBootKiwi()) {
        await bootKiwiIfNeeded({ maxWaitMs: 2_500 });
        const { isKiwiServerMode, setKiwiServerMode } = await import(
          './kiwiMorph/runtime.js'
        );
        if (isKiwiServerMode()) {
          const { prefetchKiwiAnalyze } = await import(
            './kiwiMorph/serverRunner.js'
          );
          const stored = await prefetchKiwiAnalyze(
            collectUnifyKiwiPrefetchSurfaces(pages),
            { maxMs: 10_000, timeoutMs: 6_000 },
          );
          if (stored === 0 && import.meta.env.DEV) {
            setKiwiServerMode(false);
          }
        }
      }
    }
  } catch {
    /* heuristic */
  }

  // 1차 = 정적 리스트만. 동기 Kiwi morph 없음.
  const yieldState = { last: performance.now(), sinceCheck: 0 };
  for (let i = 0; i < pages.length; i += 1) {
    await accumulateUnifyPageOccurrencesAsync(
      byKey,
      pages[i],
      minHangul,
      UNIFY_FIND_YIELD_MS,
      yieldState,
    );
  }
  finalizeConflictOccurrencesOnly(byKey, pages);
  // morphFilterActive: 2차 가능 여부(이미 ready). 1차 스캔은 항상 리스트.
  const morphFilterActive =
    isUnifyKiwiNoiseFilterEnabled() && isUnifyKiwiLocalAnalyzeReady();
  return { byKey, morphFilterActive };
}

/**
 * 표기통일 찾기 전·PDF 준비 후 — Kiwi 표면 prefetch만 (클릭 대기 완화).
 * @param {{ pageNum?: number, text?: string, textLayout?: string }[]} pageTexts
 * @returns {Promise<number>} stored count
 */
export async function prefetchUnifyKiwiSurfaces(pageTexts) {
  try {
    if (!isSpellingKiwiBoundaryEnabled()) return 0;
    const { shouldBootKiwi, bootKiwiIfNeeded } = await import(
      './kiwiMorph/bootLocal.js'
    );
    if (!shouldBootKiwi()) return 0;
    // PDF 준비 백그라운드 — UI 클릭과 무관하지만 wasm에 무기한 묶이지 않음
    await bootKiwiIfNeeded({ maxWaitMs: 12_000 });
    const { isKiwiServerMode } = await import('./kiwiMorph/runtime.js');
    if (!isKiwiServerMode()) return 0;
    const { prefetchKiwiAnalyze } = await import(
      './kiwiMorph/serverRunner.js'
    );
    return await prefetchKiwiAnalyze(
      collectUnifyKiwiPrefetchSurfaces(pageTexts ?? []),
      { maxMs: 15_000, timeoutMs: 6_000 },
    );
  } catch {
    return 0;
  }
}

/**
 * @param {Map<string, ClusterAcc>} byKey
 * @param {{ maxClusters?: number }} [opts]
 * @returns {UnifySpacingCluster[]}
 */
export function buildSpacingConflictClustersFromIndex(byKey, opts = {}) {
  const maxClusters = opts.maxClusters ?? 50;

  /** @type {UnifySpacingCluster[]} */
  const clusters = [];
  for (const [key, acc] of byKey) {
    if (acc.counts.size < 2) continue;
    const variants = [...acc.counts.keys()];
    const hasGlued = variants.some((v) => !/\s/.test(v));
    const hasSpaced = variants.some((v) => /\s/.test(v));
    if (!hasGlued || !hasSpaced) continue;

    const occurrencesByVariant = {};
    for (const [variant, list] of acc.occurrences) {
      occurrencesByVariant[variant] = list;
    }
    const ranked = [...acc.counts.entries()]
      .map(([variant, count]) => ({ variant, count }))
      .sort((a, b) =>
        compareVariantRowsForClusterList(a, b, occurrencesByVariant, null),
      );
    const recommendedUnify = pickRecommendedUnify(
      [...ranked].sort(
        (a, b) =>
          b.count - a.count ||
          spaceCount(a.variant) - spaceCount(b.variant) ||
          a.variant.localeCompare(b.variant, 'ko'),
      ),
    );
    const totalCount = ranked.reduce((sum, row) => sum + row.count, 0);
    clusters.push({
      key,
      variants: ranked.map((row) => row.variant),
      counts: Object.fromEntries(ranked.map((row) => [row.variant, row.count])),
      occurrencesByVariant,
      recommendedUnify,
      totalCount,
      kind: /** @type {const} */ ('conflict'),
    });
  }

  clusters.sort((a, b) =>
    a.recommendedUnify.localeCompare(b.recommendedUnify, 'ko'),
  );
  const trimmed = clusters.slice(0, maxClusters);

  return trimmed;
}

/**
 * @param {{ pageNum?: number, text?: string, textLayout?: string }[]} pageTexts
 * @param {{
 *   minHangulSyllables?: number,
 *   maxClusters?: number,
 *   includeRaw?: boolean,
 * }} [opts]
 * @returns {UnifySpacingCluster[] | { clusters: UnifySpacingCluster[], rawByKey: Map<string, ClusterAcc> }}
 */
export function discoverSpacingUnifyCandidates(pageTexts, opts = {}) {
  const byKey = buildUnifyOccurrenceIndex(pageTexts, opts);
  const clusters = buildSpacingConflictClustersFromIndex(byKey, opts);
  if (opts.includeRaw) {
    return { clusters, rawByKey: byKey };
  }
  return clusters;
}

/**
 * UI용 — 페이지 단위 양보 후 충돌 클러스터 생성.
 * @param {{ pageNum?: number, text?: string, textLayout?: string }[]} pageTexts
 * @param {{
 *   minHangulSyllables?: number,
 *   maxClusters?: number,
 *   includeRaw?: boolean,
 * }} [opts]
 * @returns {Promise<
 *   | UnifySpacingCluster[]
 *   | {
 *       clusters: UnifySpacingCluster[],
 *       rawByKey: Map<string, ClusterAcc>,
 *       morphFilterActive: boolean,
 *     }
 * >}
 */
export async function discoverSpacingUnifyCandidatesAsync(pageTexts, opts = {}) {
  const { byKey, morphFilterActive } = await buildUnifyOccurrenceIndexAsync(
    pageTexts,
    opts,
  );
  const clusters = buildSpacingConflictClustersFromIndex(byKey, opts);
  if (opts.includeRaw) {
    return { clusters, rawByKey: byKey, morphFilterActive };
  }
  return clusters;
}

/**
 * 통일하기 등록용 입력 문자열 (최대 slotLimit개, 추천형 우선).
 * @param {UnifySpacingCluster} cluster
 * @param {number} [slotLimit]
 * @returns {string}
 */
export function formatUnifyClusterRegisterInput(cluster, slotLimit = 3) {
  const limit = Math.max(1, slotLimit);
  const preferred = cluster.recommendedUnify;
  const rest = cluster.variants.filter((v) => v !== preferred);
  return [preferred, ...rest].slice(0, limit).join(',');
}

/**
 * 표기 통일 추천 — 사용자 선택 표기 기준 PDF 위 오버레이.
 * 붙임 선택 → `→조선^시대` (띄움 경계를 ^로)
 * 띄움 선택 → `→조선∨시대` (공백을 ∨로)
 * @param {string} chosenVariant
 * @param {{ variants?: string[] } | null} [cluster]
 * @returns {string | null}
 */
export function formatUnifySpacingDecisionOverlay(chosenVariant, cluster) {
  const chosen = String(chosenVariant ?? '').trim();
  if (!chosen) return null;
  if (/\s/.test(chosen)) {
    return `→${chosen.replace(/\s+/g, '∨')}`;
  }
  const spaced = (cluster?.variants ?? []).find((v) => /\s/.test(String(v)));
  if (spaced) {
    return `→${String(spaced).trim().replace(/\s+/g, '^')}`;
  }
  return `→${chosen}`;
}

/**
 * 소수형·1회 표기 — 레거시 필터(페이지 칩은 다수·소수 모두 표시).
 * @param {UnifySpacingCluster} cluster
 * @param {string} variant
 */
export function shouldShowUnifyVariantPages(cluster, variant) {
  const count = cluster.counts?.[variant] ?? 0;
  if (count <= 0) return false;
  if (count === 1) return true;
  return variant !== cluster.recommendedUnify;
}

/**
 * @param {UnifyVariantOccurrence[]} occs
 * @param {string} variant
 * @param {string} replace
 * @param {Map<number, import('./pdfService.js').PageData>} pageByNum
 * @returns {import('./ruleEngine.js').MatchInstance[]}
 */
function instancesFromOccs(occs, variant, replace, pageByNum) {
  const alreadyEnriched =
    occs.length > 0 &&
    occs.every(
      (o) => Array.isArray(o.itemIndexes) && o.itemIndexes.length > 0,
    );
  const enriched = alreadyEnriched
    ? occs
    : enrichOccurrencesWithItemHits(occs, pageByNum);
  const instances = enriched.map((occ) => ({
    find: variant,
    replace,
    matchedText: occ.matchedText,
    suggestedText: replace,
    pageNum: occ.pageNum,
    index: occ.index,
    ...(Array.isArray(occ.itemIndexes) && occ.itemIndexes.length
      ? { itemIndexes: occ.itemIndexes }
      : {}),
    ...(typeof occ.x === 'number' ? { x: occ.x } : {}),
    ...(typeof occ.y === 'number' ? { y: occ.y } : {}),
    ...(typeof occ.column === 'number' ? { column: occ.column } : {}),
  }));
  return pageByNum.size
    ? sortInstancesReadingOrder(instances, pageByNum)
    : instances;
}

/**
 * @param {UnifySpacingCluster} cluster
 * @param {number} pageNum
 */
function clusterHasOccurrenceOnPage(cluster, pageNum) {
  for (const variant of cluster.variants ?? []) {
    const occs = cluster.occurrencesByVariant?.[variant] ?? [];
    for (const o of occs) {
      if (o.pageNum === pageNum) return true;
    }
  }
  return false;
}

/**
 * preview용 — 지정 쪽 출현만 item enrich (문서 전 occ 동기 enrich 금지).
 * @param {UnifySpacingCluster[]} clusters
 * @param {import('./pdfService.js').PageData[]} pages
 * @param {number} pageNum
 * @returns {UnifySpacingCluster[]}
 */
function enrichClustersWithItemHitsForPage(clusters, pages, pageNum) {
  const pageByNum = buildPageByNum(pages ?? []);
  if (!pageByNum.size) return clusters ?? [];
  return (clusters ?? []).map((cluster) => {
    /** @type {Record<string, UnifyVariantOccurrence[]>} */
    const nextByVariant = { ...(cluster.occurrencesByVariant ?? {}) };
    for (const variant of cluster.variants ?? []) {
      const occs = nextByVariant[variant] ?? [];
      if (!occs.length) continue;
      const onPage = [];
      const other = [];
      for (const o of occs) {
        if (o.pageNum === pageNum) onPage.push(o);
        else other.push(o);
      }
      if (!onPage.length) continue;
      const enrichedPage = enrichOccurrencesWithItemHits(onPage, pageByNum);
      nextByVariant[variant] = other.length
        ? other.concat(enrichedPage)
        : enrichedPage;
    }
    return {
      ...cluster,
      occurrencesByVariant: nextByVariant,
    };
  });
}

/**
 * @param {UnifyVariantOccurrence[]} occs
 * @param {number | null} pageNum
 */
function previewOccsAlreadyHaveItemHits(occs, pageNum) {
  const scoped =
    pageNum == null ? occs : occs.filter((o) => o.pageNum === pageNum);
  return (
    scoped.length === 0 ||
    scoped.every(
      (o) => Array.isArray(o.itemIndexes) && o.itemIndexes.length > 0,
    )
  );
}

/**
 * 소수형·1회만이 아니라, 출현 있는 표기 전부의 MatchInstance 그룹 —
 * PDF 하이라이트·페이지 칩용.
 * 표기 통일 선택 시: 틀린 표기(+ overlay)와 통일형(칩·하이라이트) 모두 포함.
 * @param {UnifySpacingCluster[]} clusters
 * @param {{
 *   registeredByKey?: Map<string, string> | null,
 *   pages?: import('./pdfService.js').PageData[],
 *   pageNum?: number | null,
 * }} [options] pageNum이 있으면 그 쪽 출현이 있는 클러스터·출현만 MatchInstance로 만든다.
 * @returns {import('./ruleEngine.js').GroupedResult[]}
 */
export function buildUnifyCandidatePreviewGroups(clusters, options = {}) {
  const registeredByKey = options.registeredByKey ?? null;
  const pages = options.pages ?? [];
  const pageNum =
    options.pageNum != null && Number(options.pageNum) > 0
      ? Number(options.pageNum)
      : null;
  // 쪽 지정 시 — 그 쪽 출현 없는 클러스터는 enrich·루프에서 제외
  const list =
    pageNum == null
      ? (clusters ?? [])
      : (clusters ?? []).filter((c) => clusterHasOccurrenceOnPage(c, pageNum));
  // pageNum이면 **그 쪽 occ만** itemIndexes 검사 — 다른 쪽 미enrich로 전량 sync enrich 금지
  const alreadyEnriched =
    list.length > 0 &&
    list.every((c) =>
      (c.variants ?? []).every((variant) =>
        previewOccsAlreadyHaveItemHits(
          c.occurrencesByVariant?.[variant] ?? [],
          pageNum,
        ),
      ),
    );
  const enrichedClusters = alreadyEnriched
    ? list
    : pageNum != null
      ? enrichClustersWithItemHitsForPage(list, pages, pageNum)
      : enrichClustersWithItemHits(list, pages);
  const pageByNum = buildPageByNum(pages);
  /** @type {import('./ruleEngine.js').GroupedResult[]} */
  const groups = [];
  for (const cluster of enrichedClusters) {
    const chosen = registeredByKey?.get(cluster.key);
    if (chosen) {
      const overlay = formatUnifySpacingDecisionOverlay(chosen, cluster);
      for (const variant of cluster.variants) {
        let occs = cluster.occurrencesByVariant?.[variant] ?? [];
        if (pageNum != null) {
          occs = occs.filter((o) => o.pageNum === pageNum);
        }
        if (!occs.length) continue;
        const isChosen = variant === chosen;
        groups.push({
          find: variant,
          replace: chosen,
          label: variant,
          category: 'consistency',
          patternKind: 'compound-spacing',
          unifyClusterKey: cluster.key,
          tip: isChosen
            ? `문서 내 「${variant}」 표기 (통일형)`
            : `「${chosen}」으로 통일`,
          ...(!isChosen && overlay ? { overlayReplace: overlay } : {}),
          instances: instancesFromOccs(occs, variant, chosen, pageByNum),
        });
      }
      continue;
    }

    const recommended = cluster.recommendedUnify;
    for (const variant of cluster.variants) {
      let occs = cluster.occurrencesByVariant?.[variant] ?? [];
      if (pageNum != null) {
        occs = occs.filter((o) => o.pageNum === pageNum);
      }
      if (!occs.length) continue;
      groups.push({
        find: variant,
        replace: recommended,
        label: variant,
        category: 'consistency',
        patternKind: 'compound-spacing',
        unifyClusterKey: cluster.key,
        tip:
          variant === recommended
            ? `문서 내 「${variant}」 표기`
            : `문서 내 다수형 「${recommended}」와 띄어쓰기가 다른 표기`,
        instances: instancesFromOccs(occs, variant, recommended, pageByNum),
      });
    }
  }
  return groups;
}

/**
 * 선택(표기)만 기존 preview 그룹에 반영. instances 배열·객체는 재사용한다.
 * 전체 붙여쓰기 등 선택이 바뀔 때마다 occurrence 전량 재생성하지 않기 위함.
 *
 * @param {import('./ruleEngine.js').GroupedResult[]} groups
 * @param {Map<string, string> | null | undefined} registeredByKey
 * @param {UnifySpacingCluster[]} [clusters]
 * @param {{ onlyPageNum?: number }} [opts] 지정 시 해당 페이지 출현이 있는 그룹만 패치
 * @returns {import('./ruleEngine.js').GroupedResult[]}
 */
export function applyUnifyCandidatePreviewChoices(
  groups,
  registeredByKey,
  clusters = [],
  opts = {},
) {
  if (!groups?.length) return groups ?? [];
  const clusterByKey = new Map((clusters ?? []).map((c) => [c.key, c]));
  const onlyPage =
    opts.onlyPageNum != null ? Number(opts.onlyPageNum) : null;
  let any = false;
  for (const g of groups) {
    const key = g.unifyClusterKey;
    if (!key) continue;
    const cluster = clusterByKey.get(key);
    if (!cluster) continue;
    if (
      onlyPage != null &&
      !(g.instances ?? []).some((i) => i.pageNum === onlyPage)
    ) {
      continue;
    }

    const explicit = registeredByKey?.has(key)
      ? String(registeredByKey.get(key) ?? '').trim()
      : '';
    const recommended = String(cluster.recommendedUnify ?? '').trim();
    const chosen = explicit || recommended;
    if (!chosen) continue;

    const isChosenVariant = g.find === chosen;
    /** @type {string} */
    let tip;
    /** @type {string | undefined} */
    let overlayReplace;
    if (explicit) {
      tip = isChosenVariant
        ? `문서 내 「${g.find}」 표기 (통일형)`
        : `「${chosen}」으로 통일`;
      if (!isChosenVariant) {
        const overlay = formatUnifySpacingDecisionOverlay(chosen, cluster);
        if (overlay) overlayReplace = overlay;
      }
    } else {
      tip =
        g.find === recommended
          ? `문서 내 「${g.find}」 표기`
          : `문서 내 다수형 「${recommended}」와 띄어쓰기가 다른 표기`;
    }

    const prevOverlay = g.overlayReplace ?? undefined;
    if (
      g.replace === chosen &&
      g.tip === tip &&
      prevOverlay === overlayReplace
    ) {
      continue;
    }

    any = true;
    g.replace = chosen;
    g.tip = tip;
    if (overlayReplace) g.overlayReplace = overlayReplace;
    else delete g.overlayReplace;
    for (const inst of g.instances ?? []) {
      if (onlyPage != null && inst.pageNum !== onlyPage) continue;
      inst.replace = chosen;
      inst.suggestedText = chosen;
    }
  }
  return any ? groups.slice() : groups;
}

/**
 * PDF 하이라이트용 — 현재 페이지 출현만 남긴 얕은 복사.
 * 패널 칩용 전체 그룹은 그대로 두고, MainScreen에는 이것만 넘긴다.
 *
 * @param {import('./ruleEngine.js').GroupedResult[]} groups
 * @param {number} pageNum
 * @returns {import('./ruleEngine.js').GroupedResult[]}
 */
export function sliceUnifyPreviewGroupsToPage(groups, pageNum) {
  const page = Number(pageNum) || 0;
  if (!groups?.length || page <= 0) return [];
  /** @type {import('./ruleEngine.js').GroupedResult[]} */
  const out = [];
  for (const g of groups) {
    const instances = (g.instances ?? []).filter((i) => i.pageNum === page);
    if (!instances.length) continue;
    out.push(instances === g.instances ? g : { ...g, instances });
  }
  return out;
}

/**
 * @param {UnifySpacingCluster} cluster
 * @param {string} variant
 * @param {{
 *   chosenVariant?: string | null,
 *   pages?: import('./pdfService.js').PageData[],
 * }} [opts]
 * @returns {import('./ruleEngine.js').MatchInstance[]}
 */
export function instancesForUnifyVariant(cluster, variant, opts = {}) {
  const chosen = opts.chosenVariant ?? null;
  const occs = cluster.occurrencesByVariant?.[variant] ?? [];
  if (!occs.length) return [];
  const replace = chosen || cluster.recommendedUnify;
  return instancesFromOccs(
    occs,
    variant,
    replace,
    buildPageByNum(opts.pages ?? []),
  );
}

/**
 * 표기 통일 선택 직후 PDF primary용 — 틀린 표기 첫 인스턴스.
 * 전체 occurrence를 만들지 않고 첫 출현만 반환 (일괄 선택 동결 방지).
 * @param {UnifySpacingCluster} cluster
 * @param {string} chosenVariant
 * @param {{ pages?: import('./pdfService.js').PageData[] }} [opts]
 * @returns {import('./ruleEngine.js').MatchInstance | null}
 */
export function firstWrongUnifyInstance(cluster, chosenVariant, opts = {}) {
  void opts;
  for (const variant of cluster.variants ?? []) {
    if (variant === chosenVariant) continue;
    const occs = cluster.occurrencesByVariant?.[variant] ?? [];
    if (!occs.length) continue;
    // enrich 후 reading-order 정렬된 출현의 첫 건 (전체 instances 생성 금지)
    const firstOcc = occs[0];
    const replace = chosenVariant || cluster.recommendedUnify;
    return {
      find: variant,
      replace,
      matchedText: firstOcc.matchedText,
      suggestedText: replace,
      pageNum: firstOcc.pageNum,
      index: firstOcc.index,
      ...(Array.isArray(firstOcc.itemIndexes) && firstOcc.itemIndexes.length
        ? { itemIndexes: firstOcc.itemIndexes }
        : {}),
      ...(typeof firstOcc.x === 'number' ? { x: firstOcc.x } : {}),
      ...(typeof firstOcc.y === 'number' ? { y: firstOcc.y } : {}),
      ...(typeof firstOcc.column === 'number'
        ? { column: firstOcc.column }
        : {}),
    };
  }
  return null;
}
