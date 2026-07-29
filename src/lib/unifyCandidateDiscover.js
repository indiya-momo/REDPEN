/**
 * 표기 통일 추천 — 문서 내 띄어쓰기 이형태만 (규범 판단 아님).
 *
 * 정책: project-docs/unify-candidate-spacing-redesign-2026-07-29.md
 * - 스캔은 page.textLayout 우선(음절 자간 가짜 공백 제외), 없으면 text
 * - **줄 단위만 스캔** — 줄바꿈으로 생긴 붙임/띄움 이형태는 전부 제외
 * - variant: 연속 공백 → 1칸
 * - 띄움 variant: 각 덩어리 한글 2음절 이상(숫자·영문은 음절·면제 없음, 숫자만 탈락)
 * - 끝 조사(의·을 등)만 다르면 어간으로 합침 (경제왕국/경제왕국의 → 경제왕국)
 * - 클러스터 키: 공백 제거 / 붙임+유효 띄움 동시
 * - 추천: 출현 수 최대 / 동률 시 붙임 — 내부 정책(규범 아님)
 *
 * 추출: 한글·숫자 토큰 + 연속 2~4그램(원문 슬라이스) / 단일 토큰.
 */

/**
 * @typedef {{
 *   pageNum: number,
 *   index: number,
 *   matchedText: string,
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
 * }} UnifySpacingCluster
 */

const TOKEN_RE = /[\uAC00-\uD7A3\d]+/gu;
const MAX_NGRAM = 4;
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
  '이나',
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
  '로',
  '요',
  '께',
]);

/**
 * 마지막 어절 끝 조사만 제거. 어간이 한글 2음절 미만이면 유지.
 * @param {string} s
 * @param {number} [minStemHangul]
 * @returns {string}
 */
export function stripTrailingJosa(
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
    parts[parts.length - 1] = stemLast;
    return parts.join(' ');
  }
  return v;
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
 * 클러스터 키 — 조사 제거·NFC·공백 제거.
 * @param {string} s
 * @returns {string}
 */
export function unifySpacingKey(s) {
  return stripTrailingJosa(normalizeUnifyVariant(s)).replace(/\s+/g, '');
}

/**
 * @param {string} s
 * @returns {number}
 */
export function hangulSyllableCount(s) {
  return (s.match(/[\uAC00-\uD7A3]/g) || []).length;
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
 */
function addOccurrence(byKey, pageNum, index, rawMatched, minHangul) {
  // 줄 단위 스캔만 하므로, 줄바꿈이 섞인 raw는 버림
  if (/\n/.test(String(rawMatched ?? ''))) return;
  const matchedText = normalizeUnifyScanText(rawMatched);
  // 조사만 다른 표기(경제왕국/경제왕국의)는 어간으로 합침
  const variant = stripTrailingJosa(normalizeUnifyVariant(matchedText));
  if (!variant) return;
  if (/\s/.test(variant) && !isValidSpacedUnifyVariant(variant)) return;
  const key = variant.replace(/\s+/g, '');
  if (hangulSyllableCount(key) < minHangul) return;
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
 * 하이라이트용 — page.text 쪽 좌표를 우선 찾고, 없으면 스캔 인덱스.
 * @param {string} highlightSource prepareUnifyScanText(page.text)
 * @param {string} rawMatched
 * @param {number} scanIndex
 */
function resolveHighlightIndex(highlightSource, rawMatched, scanIndex) {
  const variant = normalizeUnifyVariant(rawMatched);
  if (!variant || !highlightSource) return scanIndex;
  const exact = highlightSource.indexOf(variant);
  if (exact >= 0) return exact;
  return scanIndex;
}

/**
 * @param {{ pageNum?: number, text?: string, textLayout?: string }[]} pageTexts
 * @param {{
 *   minHangulSyllables?: number,
 *   maxClusters?: number,
 * }} [opts]
 * @returns {UnifySpacingCluster[]}
 */
export function discoverSpacingUnifyCandidates(pageTexts, opts = {}) {
  const minHangul = opts.minHangulSyllables ?? 2;
  const maxClusters = opts.maxClusters ?? 50;

  /** @type {Map<string, ClusterAcc>} */
  const byKey = new Map();

  for (const page of pageTexts ?? []) {
    const pageNum = Number(page?.pageNum) || 0;
    // text는 음절 자간에도 공백을 넣을 수 있음(인플레이 션을 오탐).
    // textLayout은 넓은 어절 gap만 공백 — 의도 띄어쓰기 판별용.
    const sourceText =
      typeof page?.textLayout === 'string' && page.textLayout.length > 0
        ? page.textLayout
        : (page?.text ?? '');
    if (!sourceText || !pageNum) continue;
    const highlightSource = prepareUnifyScanText(page?.text ?? sourceText);
    // 줄마다 독립 스캔 — 줄바꿈으로 이어 붙이거나 띄운 이형태는 만들지 않음
    for (const line of splitUnifyScanLines(sourceText)) {
      const tokens = extractTokensWithIndex(line);
      for (let i = 0; i < tokens.length; i += 1) {
        addOccurrence(
          byKey,
          pageNum,
          resolveHighlightIndex(highlightSource, tokens[i].text, tokens[i].index),
          tokens[i].text,
          minHangul,
        );
        for (let n = 2; n <= MAX_NGRAM && i + n <= tokens.length; n += 1) {
          const first = tokens[i];
          const last = tokens[i + n - 1];
          const raw = line.slice(first.index, last.index + last.text.length);
          addOccurrence(
            byKey,
            pageNum,
            resolveHighlightIndex(highlightSource, raw, first.index),
            raw,
            minHangul,
          );
        }
      }
    }
  }

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
    });
  }

  clusters.sort((a, b) =>
    a.recommendedUnify.localeCompare(b.recommendedUnify, 'ko'),
  );
  return clusters.slice(0, maxClusters);
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
 * 소수 이형태만 MatchInstance 그룹으로 — PDF 하이라이트·페이지 칩용.
 * @param {UnifySpacingCluster[]} clusters
 * @returns {import('./ruleEngine.js').GroupedResult[]}
 */
export function buildUnifyCandidatePreviewGroups(clusters) {
  /** @type {import('./ruleEngine.js').GroupedResult[]} */
  const groups = [];
  for (const cluster of clusters ?? []) {
    const recommended = cluster.recommendedUnify;
    for (const variant of cluster.variants) {
      if (variant === recommended) continue;
      const occs = cluster.occurrencesByVariant?.[variant] ?? [];
      if (!occs.length) continue;
      groups.push({
        find: variant,
        replace: recommended,
        label: variant,
        category: 'consistency',
        tip: `문서 내 다수형 「${recommended}」와 띄어쓰기가 다른 표기`,
        instances: occs.map((occ) => ({
          find: variant,
          replace: recommended,
          matchedText: occ.matchedText,
          suggestedText: recommended,
          pageNum: occ.pageNum,
          index: occ.index,
        })),
      });
    }
  }
  return groups;
}

/**
 * @param {UnifySpacingCluster} cluster
 * @param {string} variant
 * @returns {import('./ruleEngine.js').MatchInstance[]}
 */
export function instancesForUnifyVariant(cluster, variant) {
  if (variant === cluster.recommendedUnify) return [];
  const occs = cluster.occurrencesByVariant?.[variant] ?? [];
  return occs.map((occ) => ({
    find: variant,
    replace: cluster.recommendedUnify,
    matchedText: occ.matchedText,
    suggestedText: cluster.recommendedUnify,
    pageNum: occ.pageNum,
    index: occ.index,
  }));
}
