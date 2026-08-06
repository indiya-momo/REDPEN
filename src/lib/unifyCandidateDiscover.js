/**
 * 표기 통일 추천 — 문서 내 띄어쓰기 이형태만 (규범 판단 아님).
 *
 * 정책: project-docs/unify-candidate-spacing-redesign-2026-07-29.md
 * - 스캔은 page.textLayout 우선(음절 자간 가짜 공백 제외), 없으면 text
 * - **줄 단위만 스캔** — 줄바꿈으로 생긴 붙임/띄움 이형태는 전부 제외
 * - **쉼표(,)** 는 후보에서 제외. 기호만 스캔 시 제거. **끝 조사는 키·variant에서 제거**(붉은표시가/붉은표시를 → 붉은표시)
 * - **순수 숫자 토큰·어절 앞뒤 숫자**는 제거(각주·줄번호 174노동시장 / 175노동시장 → 노동시장)
 * - 띄움 variant: 각 덩어리 한글 2음절 이상(숫자·영문은 음절·면제 없음, 숫자만 탈락)
 * - 클러스터 키: 조사 제거 후 공백 제거 / 붙임+유효 띄움 동시
 * - 추천: 출현 수 최대 / 동률 시 붙임 — 내부 정책(규범 아님)
 * - 칩/Next 순: 시각 reading order `(page, column, -y, x)` — hit 집합은 유지
 *
 * 추출: 한글·숫자 토큰 + 줄 안 연속 n-gram(원문 슬라이스, 토큰 수 상한) / 단일 토큰.
 * 성능: 스캔 중 highlightRange 스냅·전 키 finalize 금지 → 충돌 클러스터에만 후처리.
 */

/** 줄 안 n-gram 최대 토큰 수 (띄어쓰기 이형태는 보통 2~4어절) */
const UNIFY_MAX_NGRAM_TOKENS = 6;

import { findRefForTextIndex } from '../toc-body/lib/pdfHeadingExtract.js';
import {
  buildPageByNum,
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
import {
  stripTrailingJosaFromTokens,
  stripTrailingJosaKiwi,
} from './kiwiMorph/stripTrailingJosa.js';
import { analyzeLine } from './kiwiMorph/analyze.js';
import { isKiwiReady } from './kiwiMorph/runtime.js';
import {
  shouldRejectNoiseListDataSurface,
} from './unifyNoiseListData.js';
import { isSpacedLeftJosaNoiseEojeol } from './unifyNoiseListLeftHeuristic.js';
import { isSpacedLeftAdnominalNoiseEojeol } from './unifyNoiseListAdnominalHeuristic.js';
import {
  isSpacedAdverbHiNoiseEojeol,
  isSpacedClosedConjunctionNoiseEojeol,
} from './unifyNoiseListLexicalHeuristic.js';

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
/** 띄움 덩어리 최소 한글 음절 */
export const UNIFY_SPACED_PART_MIN_HANGUL = 2;

/**
 * 어절 끝 조사·보조사 (긴 것 우선). 경제왕국/경제왕국의 → 경제왕국.
 * @type {readonly string[]}
 */
export const UNIFY_TRAILING_JOSA = Object.freeze([
  '에서부터',
  '에게서',
  '으로부터',
  '으로서',
  '으로써',
  '에서는',
  '에서도',
  '에서',
  '에도',
  '에게',
  '한테',
  '으로',
  '로서',
  '로써',
  '부터',
  '까지',
  '처럼',
  '만큼',
  '보다',
  '대로',
  '이라고',
  '이라서',
  '이라면',
  '이라도',
  '입니다',
  '입니까',
  '이었다',
  '이나',
  '이란',
  '이라',
  '이기',
  '이다',
  '인지',
  '은',
  '는',
  '이',
  '가',
  '을',
  '를',
  '의',
  '에',
  '와',
  '과',
  '도',
  '만',
  '나',
  '란',
  '로',
  '요',
  '께',
  '들',
]);

/** @type {ReadonlySet<string>} */
const UNIFY_TRAILING_JOSA_SET = new Set(UNIFY_TRAILING_JOSA);

/** 인용부호 — 어절 중간에 끼어도 제거 (경제왕국’이기 → 경제왕국이기) */
const UNIFY_QUOTE_CHARS_RE = /[''`´‘’“”„«»「」『』]/gu;

/**
 * 마지막 어절 끝 조사만 제거 (heuristic). 어간이 한글 2음절 미만이면 유지.
 * @param {string} s
 * @param {number} [minStemHangul]
 * @returns {string}
 */
export function stripTrailingJosaHeuristic(
  s,
  minStemHangul = UNIFY_SPACED_PART_MIN_HANGUL,
) {
  const v = normalizeUnifyVariant(s);
  if (!v) return v;
  const parts = v.split(/\s+/).filter(Boolean);
  if (!parts.length) return v;
  const last = parts[parts.length - 1];
  for (const josa of UNIFY_TRAILING_JOSA) {
    if (!last.endsWith(josa) || last.length <= josa.length) continue;
    const stemLast = last.slice(0, -josa.length);
    if (hangulSyllableCount(stemLast) < minStemHangul) continue;
    // 가·이: 4음절 어절에서는 어간 끝 음절과 구분 불가(가치평가→가치평). 건너뜀.
    if (
      (josa === '가' || josa === '이') &&
      hangulSyllableCount(last) === 4
    ) {
      continue;
    }
    parts[parts.length - 1] = stemLast;
    return parts.join(' ');
  }
  return v;
}

/**
 * 마지막 어절 끝 조사만 제거.
 * `VITE_UNIFY_KIWI_JOSA=true` 이고 Kiwi 로드됨 → morph 경계, 실패 시 heuristic.
 * @param {string} s
 * @param {number} [minStemHangul]
 * @returns {string}
 */
export function stripTrailingJosa(
  s,
  minStemHangul = UNIFY_SPACED_PART_MIN_HANGUL,
) {
  if (isUnifyKiwiJosaEnabled() && isKiwiReady()) {
    try {
      const kiwiStem = stripTrailingJosaKiwi(s, minStemHangul);
      if (kiwiStem != null) return kiwiStem;
    } catch {
      /* heuristic */
    }
  }
  return stripTrailingJosaHeuristic(s, minStemHangul);
}

/**
 * NFC만 (줄바꿈은 splitUnifyScanLines에서 끊음 — 이어 붙이거나 띄움으로 바꾸지 않음).
 * @param {string} s
 * @returns {string}
 */
export function prepareUnifyScanText(s) {
  return String(s ?? '').normalize('NFC');
}

/**
 * 시각 줄마다 잘라 스캔. 줄 경계를 넘는 n-gram/접합 없음 → 줄바꿈 이형태 제외.
 * @param {string} pageText
 * @returns {string[]}
 */
export function splitUnifyScanLines(pageText) {
  return prepareUnifyScanText(pageText)
    .split(/\n+/)
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .filter((line) => line.length > 0);
}

/**
 * @param {string} s
 * @returns {string}
 */
export function normalizeUnifyScanText(s) {
  return prepareUnifyScanText(s);
}

/**
 * 표기 variant — NFC + 연속 공백을 한 칸으로 (줄바꿈이 있으면 공백으로만 정규화하되,
 * 스캔은 줄 단위라 보통 줄바꿈이 없음).
 * @param {string} s
 * @returns {string}
 */
export function normalizeUnifyVariant(s) {
  return normalizeUnifyScanText(s)
    .replace(/\n+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * 클러스터 키 — 기호 제거·NFC·공백 제거(조사는 떼지 않음).
 * @param {string} s
 * @returns {string}
 */
export function unifySpacingKey(s) {
  return stripUnifyPunctuationNoise(normalizeUnifyVariant(s)).replace(/\s+/g, '');
}

/**
 * @param {string} s
 * @returns {number}
 */
export function hangulSyllableCount(s) {
  const str = String(s ?? '');
  let n = 0;
  for (let i = 0; i < str.length; i += 1) {
    const c = str.charCodeAt(i);
    if (c >= 0xac00 && c <= 0xd7a3) n += 1;
  }
  return n;
}

/**
 * 띄움 variant 유효 — 각 덩어리 한글 ≥2음절 (숫자만·1음절 부정부사 등 탈락).
 * @param {string} variant
 * @returns {boolean}
 */
export function isValidSpacedUnifyVariant(variant) {
  const v = normalizeUnifyVariant(variant);
  if (!/\s/.test(v)) return false;
  const parts = v.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return false;
  return parts.every(
    (part) => hangulSyllableCount(part) >= UNIFY_SPACED_PART_MIN_HANGUL,
  );
}

/**
 * 쉼표 나열(개인, 은행), 또는 띄움 덩어리가 조사만인 경우(경기 에서)는 제외.
 * 한글 사이에 끼인 문장부호(경제다!라)도 제외.
 * 끝에만 붙은 쉼표·기호는 제외 대상이 아님.
 * @param {string} rawMatched
 */
export function isExcludedUnifyCandidateRaw(rawMatched) {
  const matchedText = normalizeUnifyScanText(rawMatched);
  // 경제다!라 · 경제학·철학 — 한글 사이 기호(가운데점·감탄 등), 공백 허용
  if (
    /[\uAC00-\uD7A3]\s*[^\uAC00-\uD7A3\d\s]+\s*[\uAC00-\uD7A3]/u.test(
      matchedText,
    )
  ) {
    return true;
  }
  const withoutTrailingPunct = matchedText
    .replace(/[^\uAC00-\uD7A3\d\s]+$/gu, '')
    .trim();
  if (withoutTrailingPunct.includes(',')) return true;
  const normalized = normalizeUnifyVariant(withoutTrailingPunct);
  if (!normalized) return true;
  if (/\s/.test(normalized) && spacedPartIsBareJosa(normalized)) return true;
  return false;
}

/**
 * 띄움 어절 중 하나가 조사만으로 이뤄진 경우 (경기 에서).
 * @param {string} variant
 */
export function spacedPartIsBareJosa(variant) {
  const parts = normalizeUnifyVariant(variant).split(/\s+/).filter(Boolean);
  return parts.some((part) => UNIFY_TRAILING_JOSA_SET.has(part));
}

/**
 * 기호·문장부호 제거 — 인용부호는 어절 중간도 제거, 그 외는 앞뒤만.
 * 뉴욕타임스> / 경제왕국’이기 → 뉴욕타임스 / 경제왕국이기
 * @param {string} s
 */
export function stripUnifyPunctuationNoise(s) {
  return normalizeUnifyVariant(s)
    .split(/\s+/)
    .map((part) =>
      part
        .replace(UNIFY_QUOTE_CHARS_RE, '')
        .replace(/^[^\uAC00-\uD7A3\d]+|[^\uAC00-\uD7A3\d]+$/gu, ''),
    )
    .filter(Boolean)
    .join(' ');
}

/**
 * 각주·줄번호 등 주변 숫자 제거.
 * - 순수 숫자 어절은 앞·뒤에서 제거 (174 노동 시장 → 노동 시장)
 * - 한글과 붙은 앞·뒤 숫자는 남은 한글이 2음절 이상일 때만 제거
 *   (174노동시장 → 노동시장, 2024년 → 유지, 코로나19 → 코로나)
 * @param {string} s
 */
export function stripUnifyPeripheralDigits(s) {
  let parts = normalizeUnifyVariant(s).split(/\s+/).filter(Boolean);
  while (parts.length && /^\d+$/.test(parts[0])) parts = parts.slice(1);
  while (parts.length && /^\d+$/.test(parts[parts.length - 1])) {
    parts = parts.slice(0, -1);
  }
  parts = parts.map((part) => {
    const lead = part.match(/^(\d+)([\uAC00-\uD7A3].*)$/u);
    if (lead && hangulSyllableCount(lead[2]) >= UNIFY_SPACED_PART_MIN_HANGUL) {
      return lead[2];
    }
    const trail = part.match(/^([\uAC00-\uD7A3].*?)(\d+)$/u);
    if (
      trail &&
      hangulSyllableCount(trail[1]) >= UNIFY_SPACED_PART_MIN_HANGUL
    ) {
      return trail[1];
    }
    return part;
  });
  return parts.filter(Boolean).join(' ');
}

/**
 * 끝 조사·접미(기) 제거 후 표기 통일 어간.
 * 경기 침체에서 → 경기 침체, 경기침체기 → 경기침체
 * @param {string} s
 * @param {number} [minStemHangul]
 */
export function stripTrailingUnifyAffixes(
  s,
  minStemHangul = UNIFY_SPACED_PART_MIN_HANGUL,
) {
  let v = stripUnifyPunctuationNoise(s);
  if (!v) return v;
  v = stripTrailingJosa(v, minStemHangul);
  if (!v) return v;
  const parts = v.split(/\s+/).filter(Boolean);
  if (!parts.length) return v;
  let last = parts[parts.length - 1];
  if (last.endsWith('기') && last.length > 1) {
    const stemLast = last.slice(0, -1);
    const lastHangul = hangulSyllableCount(last);
    const stemHangul = hangulSyllableCount(stemLast);
    // 띄움 마지막 어절: 침체기(3)→침체(2) 만. 금융위기(4)는 유지.
    // 붙임 전체: 경기침체기→경기침체 (남은 어간 4음절 이상)
    const shouldStrip =
      parts.length >= 2
        ? lastHangul === 3 && stemHangul === 2
        : stemHangul >= 4;
    if (shouldStrip) {
      last = stemLast;
      parts[parts.length - 1] = last;
      v = parts.join(' ');
      v = stripTrailingJosa(v, minStemHangul);
    }
  }
  return v;
}

/**
 * @param {string} s
 * @returns {number}
 */
function spaceCount(s) {
  return (s.match(/\s/g) || []).length;
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
  // 1차 잡음 — 붙임키 + 띄움 좌우(예외·꼬리·조사·관형·접속·-히). unifyNoiseList 순환 import 금지.
  if (shouldRejectNoiseListDataSurface(key)) return null;
  if (/\s/.test(variant)) {
    const parts = variant.trim().split(/\s+/).filter(Boolean);
    for (const part of parts) {
      if (shouldRejectNoiseListDataSurface(part)) return null;
      if (isSpacedLeftJosaNoiseEojeol(part)) return null;
      if (isSpacedLeftAdnominalNoiseEojeol(part)) return null;
      if (isSpacedClosedConjunctionNoiseEojeol(part)) return null;
      if (isSpacedAdverbHiNoiseEojeol(part)) return null;
    }
  }
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
  acc.counts.set(variant, (acc.counts.get(variant) || 0) + 1);
  const list = acc.occurrences.get(variant) ?? [];
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
  if (starts.length) return starts;

  pos = 0;
  while (pos < highlightSource.length) {
    const hit = findPhraseInSpan(highlightSource.slice(pos), variant);
    if (!hit) break;
    const idx = pos + hit.start;
    starts.push(idx);
    pos = idx + 1;
  }
  return starts;
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

  return hits.map((h, i) => ({
    pageNum,
    index: h.itemIndex * 100000 + i,
    matchedText,
    itemIndexes: h.itemIndexes,
    x: h.x,
    y: h.y,
    ...(gutterX != null
      ? { column: h.x >= gutterX ? 1 : 0 }
      : {}),
  }));
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
  if (!slots.length) return [...occs];

  const used = new Set();
  return occs.map((occ) => {
    let best = -1;
    let bestDist = Infinity;
    for (const slot of slots) {
      if (used.has(slot)) continue;
      const dist = Math.abs(slot - occ.index);
      if (dist < bestDist) {
        bestDist = dist;
        best = slot;
      }
    }
    if (best < 0) return { ...occ };
    used.add(best);
    return { ...occ, index: best };
  });
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
      out.push(...rebased);
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
    const occs = cluster.occurrencesByVariant?.[variant] ?? [];
    if (!occs.length) {
      occurrencesByVariant[variant] = [];
      counts[variant] = 0;
      continue;
    }
    const next = enrichOccurrencesWithItemHits(occs, pageByNum);
    occurrencesByVariant[variant] = next;
    counts[variant] = next.length;
  }
  const positive = (cluster.variants ?? []).filter(
    (v) => (counts[v] ?? 0) > 0,
  );
  if (!positive.length) {
    return null;
  }
  const ranked = (cluster.variants ?? [])
    .map((variant) => ({ variant, count: counts[variant] ?? 0 }))
    .sort(
      (a, b) =>
        b.count - a.count ||
        spaceCount(a.variant) - spaceCount(b.variant) ||
        a.variant.localeCompare(b.variant, 'ko'),
    );
  const positiveRanked = ranked.filter((row) => row.count > 0);
  const hasGlued = positive.some((v) => !/\s/.test(v));
  const hasSpaced = positive.some((v) => /\s/.test(v));
  const keepAsSingleForm =
    cluster.kind === 'single-form' || !hasGlued || !hasSpaced;
  return {
    ...cluster,
    ...(keepAsSingleForm ? { kind: /** @type {const} */ ('single-form') } : {}),
    variants: ranked.map((row) => row.variant),
    counts: Object.fromEntries(ranked.map((row) => [row.variant, row.count])),
    occurrencesByVariant: Object.fromEntries(
      ranked.map((row) => [row.variant, occurrencesByVariant[row.variant] ?? []]),
    ),
    recommendedUnify: pickRecommendedUnify(positiveRanked),
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
    if (
      !/\s/.test(prepared.variant) &&
      visualLines.length > 0 &&
      !corroborateGlued(prepared.variant)
    ) {
      return;
    }
    const index = resolveHighlightIndex(highlightSource, raw, preferNear);
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
    if (
      !/\s/.test(prepared.variant) &&
      visualLines.length > 0 &&
      !corroborateGlued(prepared.variant)
    ) {
      return;
    }
    const index = resolveHighlightIndex(highlightSource, raw, preferNear);
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
  /** @type {Map<number, { pageNum?: number, text?: string }>} */
  const pageTextByNum = new Map();
  for (const page of pageTexts ?? []) {
    const n = Number(page?.pageNum) || 0;
    if (n) pageTextByNum.set(n, page);
  }
  for (const acc of byKey.values()) {
    const variants = [...acc.counts.keys()];
    const hasGlued = variants.some((v) => !/\s/.test(v));
    const hasSpaced = variants.some((v) => /\s/.test(v));
    if (!hasGlued || !hasSpaced) continue;
    for (const [variant, list] of acc.occurrences) {
      const snapped = snapUnifyOccurrenceIndices(list, pageByNum);
      acc.occurrences.set(
        variant,
        finalizeUnifyOccurrenceList(snapped, pageByNum, pageTextByNum),
      );
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
  return occs.map((occ) => {
    const page = pageByNum.get(Number(occ.pageNum));
    if (!page?.text) return occ;
    const source = prepareUnifyScanText(page.text);
    const snapped = resolveAndSnapUnifyHighlightIndex(
      page,
      source,
      occ.matchedText,
      occ.index,
    );
    return snapped === occ.index ? occ : { ...occ, index: snapped };
  });
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

    const ranked = [...acc.counts.entries()]
      .map(([variant, count]) => ({ variant, count }))
      .sort(
        (a, b) =>
          b.count - a.count ||
          spaceCount(a.variant) - spaceCount(b.variant) ||
          a.variant.localeCompare(b.variant, 'ko'),
      );
    const recommendedUnify = pickRecommendedUnify(ranked);
    const totalCount = ranked.reduce((sum, row) => sum + row.count, 0);
    /** @type {Record<string, UnifyVariantOccurrence[]>} */
    const occurrencesByVariant = {};
    for (const [variant, list] of acc.occurrences) {
      occurrencesByVariant[variant] = list;
    }
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
 * 소수형·1회만이 아니라, 출현 있는 표기 전부의 MatchInstance 그룹 —
 * PDF 하이라이트·페이지 칩용.
 * 표기 통일 선택 시: 틀린 표기(+ overlay)와 통일형(칩·하이라이트) 모두 포함.
 * @param {UnifySpacingCluster[]} clusters
 * @param {{
 *   registeredByKey?: Map<string, string> | null,
 *   pages?: import('./pdfService.js').PageData[],
 * }} [options]
 * @returns {import('./ruleEngine.js').GroupedResult[]}
 */
export function buildUnifyCandidatePreviewGroups(clusters, options = {}) {
  const registeredByKey = options.registeredByKey ?? null;
  const pages = options.pages ?? [];
  // enrichOccurrences가 itemIndexes 있으면 no-op — 이미 enrich된 목록 재사용
  const enrichedClusters = enrichClustersWithItemHits(clusters ?? [], pages);
  const pageByNum = buildPageByNum(pages);
  /** @type {import('./ruleEngine.js').GroupedResult[]} */
  const groups = [];
  for (const cluster of enrichedClusters) {
    const chosen = registeredByKey?.get(cluster.key);
    if (chosen) {
      const overlay = formatUnifySpacingDecisionOverlay(chosen, cluster);
      for (const variant of cluster.variants) {
        const occs = cluster.occurrencesByVariant?.[variant] ?? [];
        if (!occs.length) continue;
        const isChosen = variant === chosen;
        groups.push({
          find: variant,
          replace: chosen,
          label: variant,
          category: 'consistency',
          patternKind: 'compound-spacing',
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
      const occs = cluster.occurrencesByVariant?.[variant] ?? [];
      if (!occs.length) continue;
      groups.push({
        find: variant,
        replace: recommended,
        label: variant,
        category: 'consistency',
        patternKind: 'compound-spacing',
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
 * @param {UnifySpacingCluster} cluster
 * @param {string} chosenVariant
 * @param {{ pages?: import('./pdfService.js').PageData[] }} [opts]
 * @returns {import('./ruleEngine.js').MatchInstance | null}
 */
export function firstWrongUnifyInstance(cluster, chosenVariant, opts = {}) {
  for (const variant of cluster.variants ?? []) {
    if (variant === chosenVariant) continue;
    const insts = instancesForUnifyVariant(cluster, variant, {
      chosenVariant,
      pages: opts.pages,
    });
    if (insts.length) return insts[0];
  }
  return null;
}
