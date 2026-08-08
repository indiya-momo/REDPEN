/**
 * 문서 내 앞잘림 조각 — 2차에서 복원·같은 단어 세트로 merge (목록 DROP 아님).
 *
 * ## Public API (공유 정책 진입점)
 * - {@link spacedVariantHitsDocSuffixOrphan} — 띄움 이형태 판정 (adjacentPairs 포함 완전판)
 * - {@link pruneUnifyIndexDocSuffixOrphans} — occurrence index에서 위 판정으로 정리
 * - {@link filterGroupsByDocSuffixOrphan} — **2차** 목록: head-cut은 복원+merge, 인접 orphan만 DROP
 * - {@link noteDocHangulEojeolForOrphan} / {@link noteAdjacentHangulPair} /
 *   {@link collectDocHangulEojeolsFromRawByKey} / {@link collectDocSuffixContextFromPageTexts}
 *
 * 1차 discover·위성 생성 핫패스에 붙이지 말 것. 1차 목록(띄어쓰기 이형태)은 수정하지 않음.
 * 전역-only·어절-only 헬퍼는 export하지 않는다 (약식 진입점 금지).
 *
 * 1) 전역(head-cut): **1·2차 목록**(계열 affix·rawByKey 포함) 증인 W로
 *    왼쪽 칸 F를 W로 복원 (`로그램`→`프로그램`) 후 동일 key 단어 세트로 merge.
 *    음절 꼬리 전개 금지. 생산적 한자어 접두 제외 (`대기업`↛`기업`).
 * 2) 인접: P+F 이음이 목록 증인에 있을 때만 항목 DROP (복원 키 애매).
 *    본문만으로 soft DROP 금지.
 *
 * 줄 위치(P)만 page text∪layout. 복원·DROP 증거는 1·2차 목록(±rawByKey).
 * source: manual-heuristic (문서 의존)
 */
import { hangulOnlyNoise } from './unifyNoiseListData.js';
import { UNIFY_TRAILING_JOSA } from './unifyHangulBasics.js';

/** 잘린 조각 최소 한글 음절 */
const DOC_SUFFIX_ORPHAN_MIN_FRAGMENT = 2;
/** 전역 앞잘림 접두 음절 수 (프|로그램) */
const DOC_SUFFIX_ORPHAN_PREFIX_LEN = 1;

/**
 * 전역 앞잘림 FP 억제 — 조각 예외 목록이 아님.
 * @type {ReadonlySet<string>}
 */
const DOC_GLOBAL_HEAD_CUT_PREFIX_BLOCK = Object.freeze(
  new Set([
    '대',
    '부',
    '총',
    '전',
    '신',
    '구',
    '반',
    '비',
    '재',
    '준',
    '소',
    '고',
    '저',
  ]),
);

/**
 * @param {string} hangul
 */
function stripTrailingJosaHangulNoise(hangul) {
  const h = hangulOnlyNoise(hangul);
  if (!h) return '';
  for (const josa of UNIFY_TRAILING_JOSA) {
    if (h.length > josa.length && h.endsWith(josa)) {
      return h.slice(0, -josa.length);
    }
  }
  return h;
}

/**
 * needle이 문서 어절과 같거나 그 접두(시작)이면 true.
 * 중간 substring만 겹치는 경우(제성장⊂경제성장)는 false.
 * @param {Iterable<string>} docHangulEojeols
 * @param {string} needle
 */
function documentEojeolHasWordOrPrefix(docHangulEojeols, needle) {
  const n = hangulOnlyNoise(needle);
  if (!n || n.length < 2 || !docHangulEojeols) return false;
  // Set이면 정확 일치부터 O(1) — 인접 경로(환매조건부)에서 대부분 여기서 끝남
  if (docHangulEojeols instanceof Set && docHangulEojeols.has(n)) return true;
  for (const raw of docHangulEojeols) {
    const W = hangulOnlyNoise(raw);
    if (W === n || W.startsWith(n)) return true;
    const stem = stripTrailingJosaHangulNoise(W);
    if (stem !== W && (stem === n || stem.startsWith(n))) return true;
  }
  return false;
}

/**
 * 전역 앞잘림: W.slice(1).startsWith(F)인 F를 Set으로 미리 펼침 → 판정 O(1).
 * @param {Iterable<string>} witnesses
 * @returns {Set<string>}
 */
function buildHeadCutFragmentIndex(witnesses) {
  /** @type {Set<string>} */
  const hits = new Set();
  for (const raw of witnesses ?? []) {
    const W = hangulOnlyNoise(raw);
    if (
      !W ||
      W.length < DOC_SUFFIX_ORPHAN_MIN_FRAGMENT + DOC_SUFFIX_ORPHAN_PREFIX_LEN
    ) {
      continue;
    }
    const head = W.slice(0, DOC_SUFFIX_ORPHAN_PREFIX_LEN);
    if (DOC_GLOBAL_HEAD_CUT_PREFIX_BLOCK.has(head)) continue;
    const body = W.slice(DOC_SUFFIX_ORPHAN_PREFIX_LEN);
    for (
      let len = DOC_SUFFIX_ORPHAN_MIN_FRAGMENT;
      len <= body.length;
      len += 1
    ) {
      hits.add(body.slice(0, len));
    }
  }
  return hits;
}

/**
 * 조각 F → 복원 증인 W (로그램→프로그램).
 * 같은 F에 여러 W면 본문 정확 일치(W.slice(1)===F) 우선, 같으면 더 짧은 W.
 * @param {Iterable<string>} witnesses
 * @returns {Map<string, string>}
 */
function buildHeadCutRestoreMap(witnesses) {
  /** @type {Map<string, string>} */
  const map = new Map();
  for (const raw of witnesses ?? []) {
    const W = hangulOnlyNoise(raw);
    if (
      !W ||
      W.length < DOC_SUFFIX_ORPHAN_MIN_FRAGMENT + DOC_SUFFIX_ORPHAN_PREFIX_LEN
    ) {
      continue;
    }
    const head = W.slice(0, DOC_SUFFIX_ORPHAN_PREFIX_LEN);
    if (DOC_GLOBAL_HEAD_CUT_PREFIX_BLOCK.has(head)) continue;
    const body = W.slice(DOC_SUFFIX_ORPHAN_PREFIX_LEN);
    for (
      let len = DOC_SUFFIX_ORPHAN_MIN_FRAGMENT;
      len <= body.length;
      len += 1
    ) {
      const F = body.slice(0, len);
      const prev = map.get(F);
      if (!prev) {
        map.set(F, W);
        continue;
      }
      const prevExact = hangulOnlyNoise(prev).slice(DOC_SUFFIX_ORPHAN_PREFIX_LEN) === F;
      const newExact = body === F;
      if (newExact && !prevExact) map.set(F, W);
      else if (
        newExact === prevExact &&
        W.length < hangulOnlyNoise(prev).length
      ) {
        map.set(F, W);
      }
    }
  }
  return map;
}

/**
 * 인접쌍을 curr(왼쪽 칸) → { prev, crossLine }[] 로 묶어 전수 스캔을 피함.
 * @param {Iterable<{ prev: string, curr: string, crossLine?: boolean }> | null | undefined} adjacentPairs
 * @returns {Map<string, { prev: string, crossLine: boolean }[]> | null}
 */
function buildAdjacentPrevByCurr(adjacentPairs) {
  if (!adjacentPairs) return null;
  /** @type {Map<string, { prev: string, crossLine: boolean }[]>} */
  const byCurr = new Map();
  for (const pair of adjacentPairs) {
    const prev = hangulOnlyNoise(pair?.prev);
    const curr = hangulOnlyNoise(pair?.curr);
    if (!prev || !curr) continue;
    const crossLine = Boolean(pair?.crossLine);
    const list = byCurr.get(curr);
    if (list) {
      const existing = list.find((x) => x.prev === prev);
      if (existing) existing.crossLine = existing.crossLine || crossLine;
      else list.push({ prev, crossLine });
    } else {
      byCurr.set(curr, [{ prev, crossLine }]);
    }
  }
  return byCurr.size > 0 ? byCurr : null;
}

/**
 * @param {Set<string>} docHangulEojeols
 * @param {string} tokenHangulOrRaw
 */
export function noteDocHangulEojeolForOrphan(docHangulEojeols, tokenHangulOrRaw) {
  if (!docHangulEojeols) return;
  const h = hangulOnlyNoise(tokenHangulOrRaw);
  if (h.length >= DOC_SUFFIX_ORPHAN_MIN_FRAGMENT) docHangulEojeols.add(h);
  const stem = stripTrailingJosaHangulNoise(h);
  if (stem.length >= DOC_SUFFIX_ORPHAN_MIN_FRAGMENT) docHangulEojeols.add(stem);
}

/**
 * @param {{ prev: string, curr: string, crossLine?: boolean }[]} adjacentPairs
 * @param {string} prevRaw
 * @param {string} currRaw
 * @param {{ crossLine?: boolean }} [opts]
 */
export function noteAdjacentHangulPair(adjacentPairs, prevRaw, currRaw, opts = {}) {
  if (!adjacentPairs) return;
  const prev = hangulOnlyNoise(prevRaw);
  const curr = hangulOnlyNoise(currRaw);
  if (!prev || !curr) return;
  adjacentPairs.push({
    prev,
    curr,
    ...(opts.crossLine ? { crossLine: true } : {}),
  });
}

/**
 * @param {string} spacedVariant
 * @param {Iterable<string> | null | undefined} docHangulEojeols
 * @param {Set<string>} headCutHits
 * @param {Map<string, { prev: string, crossLine: boolean }[]> | null} adjacentByCurr
 */
/**
 * @param {string} spacedVariant
 * @param {Set<string>} headCutHits
 * @param {Map<string, { prev: string }[]> | null} adjacentByCurr
 * @param {Iterable<string> | null | undefined} adjacentEvidence
 *   인접 DROP용 P+F 증거(전체 발견). null이면 인접 검사 생략.
 */
function spacedVariantHitsDocSuffixOrphanIndexed(
  spacedVariant,
  headCutHits,
  adjacentByCurr,
  adjacentEvidence,
) {
  const parts = String(spacedVariant ?? '')
    .normalize('NFC')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length < 2) return false;

  const left = hangulOnlyNoise(parts[0]);
  if (
    left.length >= DOC_SUFFIX_ORPHAN_MIN_FRAGMENT &&
    headCutHits.has(left)
  ) {
    return true;
  }

  if (!adjacentByCurr || !adjacentEvidence) return false;
  if (left.length < DOC_SUFFIX_ORPHAN_MIN_FRAGMENT) return false;
  const prevs = adjacentByCurr.get(left);
  if (!prevs?.length) return false;
  for (const { prev: P } of prevs) {
    if (P.length < 1) continue;
    // 전체 발견 증인에 P+F가 있을 때만 (본문-only soft DROP 금지)
    if (documentEojeolHasWordOrPrefix(adjacentEvidence, P + left)) return true;
  }
  return false;
}

/**
 * 띄움 이형태가 앞잘림이면 true (공유 정책 facade).
 * 전역·인접 모두 **왼쪽 칸만**. adjacentPairs 없으면 전역만.
 *
 * @param {string} spacedVariant
 * @param {Iterable<string> | null | undefined} docHangulEojeols
 * @param {Iterable<{ prev: string, curr: string }> | null | undefined} [adjacentPairs]
 */
export function spacedVariantHitsDocSuffixOrphan(
  spacedVariant,
  docHangulEojeols,
  adjacentPairs = null,
) {
  if (!docHangulEojeols) return false;
  const headCutHits = buildHeadCutFragmentIndex(docHangulEojeols);
  const adjacentByCurr = buildAdjacentPrevByCurr(adjacentPairs);
  return spacedVariantHitsDocSuffixOrphanIndexed(
    spacedVariant,
    headCutHits,
    adjacentByCurr,
    docHangulEojeols,
  );
}

/**
 * occurrence index에서 앞잘림 띄움 이형태를 제거 (공유 정책 facade).
 *
 * @param {Map<string, { counts: Map<string, number>, occurrences: Map<string, unknown[]> }>} byKey
 * @param {Iterable<string> | null | undefined} docHangulEojeols
 * @param {Iterable<{ prev: string, curr: string }> | null | undefined} [adjacentPairs]
 */
export function pruneUnifyIndexDocSuffixOrphans(
  byKey,
  docHangulEojeols,
  adjacentPairs = null,
) {
  if (!byKey || !docHangulEojeols) return;
  const witnesses =
    docHangulEojeols instanceof Set
      ? docHangulEojeols
      : new Set(docHangulEojeols);
  if (!witnesses.size) return;
  const headCutHits = buildHeadCutFragmentIndex(witnesses);
  const adjacentByCurr = buildAdjacentPrevByCurr(adjacentPairs);
  for (const [key, acc] of [...byKey.entries()]) {
    for (const variant of [...acc.counts.keys()]) {
      if (
        !spacedVariantHitsDocSuffixOrphanIndexed(
          variant,
          headCutHits,
          adjacentByCurr,
          witnesses,
        )
      ) {
        continue;
      }
      acc.counts.delete(variant);
      acc.occurrences.delete(variant);
    }
    if (acc.counts.size === 0) byKey.delete(key);
  }
}

/**
 * @param {Map<string, { counts: Map<string, number> }> | null | undefined} rawByKey
 * @returns {Set<string>}
 */
export function collectDocHangulEojeolsFromRawByKey(rawByKey) {
  /** @type {Set<string>} */
  const out = new Set();
  if (!rawByKey?.size) return out;
  for (const [key, acc] of rawByKey) {
    noteDocHangulEojeolForOrphan(out, key);
    const counts = acc?.counts;
    const variants =
      counts instanceof Map
        ? counts.keys()
        : counts && typeof counts === 'object'
          ? Object.keys(counts)
          : [];
    for (const variant of variants) {
      for (const part of String(variant).split(/\s+/).filter(Boolean)) {
        noteDocHangulEojeolForOrphan(out, part);
      }
    }
  }
  return out;
}

/** 페이지 텍스트에서 한글 어절만 */
const DOC_SUFFIX_HANGUL_TOKEN_RE = /[\uAC00-\uD7A3]+/gu;

/**
 * 한 페이지의 text∪layout을 증인·인접쌍에 반영.
 * @param {{ text?: string, textLayout?: string } | null | undefined} page
 * @param {Set<string>} witnesses
 * @param {{ prev: string, curr: string }[]} adjacentPairs
 */
function ingestDocSuffixPage(page, witnesses, adjacentPairs) {
  const layout = page?.textLayout != null ? String(page.textLayout) : '';
  const text = page?.text != null ? String(page.text) : '';
  /** @type {string[]} */
  const sources = [];
  if (layout) sources.push(layout);
  if (text && text !== layout) sources.push(text);
  else if (text && !layout) sources.push(text);
  for (const source of sources) {
    const prepared = source.normalize('NFC');
    /** @type {string | null} */
    let prevLineLast = null;
    for (const line of prepared.split(/\n+/)) {
      DOC_SUFFIX_HANGUL_TOKEN_RE.lastIndex = 0;
      const tokens = line.match(DOC_SUFFIX_HANGUL_TOKEN_RE) || [];
      if (tokens.length > 0 && prevLineLast) {
        // OCR 줄바꿈: 이전 줄 끝 + 현재 줄 첫 (서\n비스 → 서비스)
        noteAdjacentHangulPair(adjacentPairs, prevLineLast, tokens[0], {
          crossLine: true,
        });
      }
      for (let i = 0; i < tokens.length; i += 1) {
        noteDocHangulEojeolForOrphan(witnesses, tokens[i]);
        if (i > 0) {
          noteAdjacentHangulPair(adjacentPairs, tokens[i - 1], tokens[i]);
        }
      }
      if (tokens.length > 0) {
        prevLineLast = tokens[tokens.length - 1];
      }
    }
  }
}

/**
 * 전체 발견에서 DROP 증인 수집 — 목록 그룹(+계열 affix) · rawByKey.
 * 음절 꼬리 전개 금지 — 중간 조각(시경제 등)이 head-cut 증인이 되면 목록이 붕괴한다.
 * @param {import('./unifyCandidateGrouping.js').ClusterGroup[] | null | undefined} groups
 * @param {Map<string, { counts?: Map<string, number> | Record<string, number> }> | null | undefined} [rawByKey]
 * @returns {Set<string>}
 */
export function collectFindingsHangulWitnesses(groups, rawByKey = null) {
  /** @type {Set<string>} */
  const out = new Set();
  for (const group of groups ?? []) {
    // @서비스 계열 — 멤버 key만 보면 affix「서비스」가 빠져 비스를 못 지움
    if (group?.type === 'series' && group.affix) {
      noteDocHangulEojeolForOrphan(out, String(group.affix));
    }
    for (const cluster of group.clusters ?? []) {
      const key = String(cluster?.key ?? '');
      noteDocHangulEojeolForOrphan(out, key);
      noteDocHangulEojeolForOrphan(out, key.replace(/\s+/g, ''));
      const variants = [
        ...(cluster.variants ?? []),
        ...Object.keys(cluster.counts ?? {}),
      ];
      for (const v of variants) {
        const s = String(v ?? '');
        noteDocHangulEojeolForOrphan(out, s);
        noteDocHangulEojeolForOrphan(out, s.replace(/\s+/g, ''));
        for (const part of s.split(/\s+/).filter(Boolean)) {
          noteDocHangulEojeolForOrphan(out, part);
        }
      }
    }
  }
  if (rawByKey?.size) {
    for (const h of collectDocHangulEojeolsFromRawByKey(rawByKey)) {
      noteDocHangulEojeolForOrphan(out, h);
    }
  }
  return out;
}

/**
 * 2차용 — page.text ∪ textLayout에서 **인접쌍만** 수집 (줄 위치용).
 * DROP 증거 증인은 {@link collectFindingsHangulWitnesses}.
 * @param {{ text?: string, textLayout?: string }[] | null | undefined} pageTexts
 * @returns {{ witnesses: Set<string>, adjacentPairs: { prev: string, curr: string, crossLine?: boolean }[] }}
 */
export function collectDocSuffixContextFromPageTexts(pageTexts) {
  /** @type {Set<string>} */
  const witnesses = new Set();
  /** @type {{ prev: string, curr: string, crossLine?: boolean }[]} */
  const adjacentPairs = [];
  for (const page of pageTexts ?? []) {
    ingestDocSuffixPage(page, witnesses, adjacentPairs);
  }
  return { witnesses, adjacentPairs };
}

/**
 * collect와 동일 결과 + 페이지마다 메인스레드 양보.
 * @param {{ text?: string, textLayout?: string }[] | null | undefined} pageTexts
 * @param {{ yieldEveryPages?: number }} [opts]
 * @returns {Promise<{ witnesses: Set<string>, adjacentPairs: { prev: string, curr: string, crossLine?: boolean }[] }>}
 */
export async function collectDocSuffixContextFromPageTextsAsync(
  pageTexts,
  opts = {},
) {
  const yieldEveryPages = opts.yieldEveryPages ?? 1;
  /** @type {Set<string>} */
  const witnesses = new Set();
  /** @type {{ prev: string, curr: string, crossLine?: boolean }[]} */
  const adjacentPairs = [];
  const pages = pageTexts ?? [];
  for (let i = 0; i < pages.length; i += 1) {
    ingestDocSuffixPage(pages[i], witnesses, adjacentPairs);
    if (yieldEveryPages > 0 && (i + 1) % yieldEveryPages === 0) {
      await new Promise((r) => setTimeout(r, 0));
    }
  }
  return { witnesses, adjacentPairs };
}

/**
 * @param {object} cluster
 * @returns {Record<string, number>}
 */
function clusterCountsObject(cluster) {
  const counts = cluster?.counts ?? {};
  if (counts instanceof Map) return Object.fromEntries(counts);
  return { ...counts };
}

/**
 * head-cut 복원 — 성공 시 새 클러스터, 아니면 null.
 * counts·occurrencesByVariant 키를 같이 옮겨 쪽 칩이 비지 않게 한다.
 * @param {object} cluster
 * @param {Map<string, string>} restoreMap
 * @returns {object | null}
 */
function remapClusterByHeadCut(cluster, restoreMap) {
  if (!restoreMap?.size) return null;

  /**
   * @param {string} variant
   * @returns {{ next: string, changed: boolean }}
   */
  function remapVariantKey(variant) {
    const s = String(variant ?? '');
    if (/\s/.test(s)) {
      const parts = s
        .normalize('NFC')
        .trim()
        .split(/\s+/)
        .filter(Boolean);
      if (parts.length >= 2) {
        const left = hangulOnlyNoise(parts[0]);
        const W = restoreMap.get(left);
        if (W && W !== left) {
          return { next: [W, ...parts.slice(1)].join(' '), changed: true };
        }
      }
      return { next: s, changed: false };
    }
    const h = hangulOnlyNoise(s);
    let bestF = '';
    let bestW = '';
    for (const [F, W] of restoreMap) {
      if (h.startsWith(F) && F.length >= bestF.length) {
        bestF = F;
        bestW = W;
      }
    }
    if (bestW && bestF && bestW !== bestF) {
      return { next: bestW + h.slice(bestF.length), changed: true };
    }
    return { next: h || s, changed: false };
  }

  const counts = clusterCountsObject(cluster);
  /** @type {Record<string, number>} */
  const nextCounts = {};
  let changed = false;

  for (const [variant, count] of Object.entries(counts)) {
    if (count <= 0) continue;
    const { next, changed: ch } = remapVariantKey(variant);
    if (ch) changed = true;
    nextCounts[next] = (nextCounts[next] || 0) + count;
  }

  if (!changed) return null;

  /** @type {Record<string, unknown[]>} */
  const nextOcc = {};
  const prevOcc = cluster.occurrencesByVariant || {};
  for (const [variant, list] of Object.entries(prevOcc)) {
    const { next } = remapVariantKey(variant);
    nextOcc[next] = [...(nextOcc[next] || []), ...(list || [])];
  }

  const gluedKeys = Object.keys(nextCounts).filter((v) => !/\s/.test(v));
  const spacedKeys = Object.keys(nextCounts).filter((v) => /\s/.test(v));
  const gluedKey =
    gluedKeys.sort((a, b) => b.length - a.length)[0] ||
    hangulOnlyNoise((spacedKeys[0] || '').replace(/\s+/g, ''));
  if (!gluedKey) return null;

  const totalCount = Object.values(nextCounts).reduce((a, b) => a + b, 0);
  return {
    ...cluster,
    key: gluedKey,
    counts: nextCounts,
    variants: Object.keys(nextCounts),
    totalCount,
    kind: cluster.kind || 'conflict',
    ...(Object.keys(nextOcc).length
      ? { occurrencesByVariant: nextOcc }
      : {}),
  };
}

/**
 * @param {object} target
 * @param {object} source
 */
function mergeRemappedClusterInto(target, source) {
  const counts = clusterCountsObject(target);
  for (const [v, n] of Object.entries(clusterCountsObject(source))) {
    counts[v] = (counts[v] || 0) + n;
  }
  target.counts = counts;
  target.variants = [
    ...new Set([
      ...(target.variants ?? []),
      ...(source.variants ?? []),
      ...Object.keys(counts),
    ]),
  ];
  target.totalCount = Object.values(counts).reduce((a, b) => a + b, 0);
  const tOcc = target.occurrencesByVariant;
  const sOcc = source.occurrencesByVariant;
  if (tOcc || sOcc) {
    /** @type {Record<string, unknown[]>} */
    const occ = { ...(tOcc || {}) };
    for (const [v, list] of Object.entries(sOcc || {})) {
      occ[v] = [...(occ[v] || []), ...(list || [])];
    }
    target.occurrencesByVariant = occ;
  }
}

/**
 * 목록 그룹 — head-cut은 복원 후 같은 key로 merge, 인접 orphan만 DROP.
 * 증인은 기본적으로 필터 대상 groups+rawByKey.
 * 2차에서는 `witnessGroups`에 1차·2차 목록을 합쳐 넘긴다 (1차 목록 자체는 수정하지 않음).
 * @param {import('./unifyCandidateGrouping.js').ClusterGroup[]} groups
 * @param {{ text?: string, textLayout?: string }[] | null | undefined} pageTexts
 * @param {{
 *   yieldEvery?: number,
 *   yieldEveryPages?: number,
 *   rawByKey?: Map<string, { counts?: Map<string, number> | Record<string, number> }> | null,
 *   witnessGroups?: import('./unifyCandidateGrouping.js').ClusterGroup[] | null,
 * }} [opts]
 * @returns {Promise<{
 *   groups: import('./unifyCandidateGrouping.js').ClusterGroup[],
 *   applied: boolean,
 *   remapped: number,
 *   dropped: number,
 * }>}
 */
export async function filterGroupsByDocSuffixOrphan(
  groups,
  pageTexts,
  opts = {},
) {
  const findingsWitnesses = collectFindingsHangulWitnesses(
    opts.witnessGroups ?? groups,
    opts.rawByKey ?? null,
  );
  const { adjacentPairs } = await collectDocSuffixContextFromPageTextsAsync(
    pageTexts,
    {
      yieldEveryPages: opts.yieldEveryPages ?? 1,
    },
  );
  if (!findingsWitnesses.size) {
    return {
      groups: groups ?? [],
      applied: false,
      remapped: 0,
      dropped: 0,
    };
  }
  const restoreMap = buildHeadCutRestoreMap(findingsWitnesses);
  const headCutHits = buildHeadCutFragmentIndex(findingsWitnesses);
  const adjacentByCurr = buildAdjacentPrevByCurr(adjacentPairs);
  await new Promise((r) => setTimeout(r, 0));

  const yieldEvery = opts.yieldEvery ?? 8;
  let remapped = 0;
  let dropped = 0;
  let ops = 0;
  /** @type {import('./unifyCandidateGrouping.js').ClusterGroup[]} */
  const nextGroups = [];

  for (const group of groups ?? []) {
    /** @type {Map<string, object>} */
    const byKey = new Map();
    let groupChanged = false;
    for (const cluster of group.clusters ?? []) {
      ops += 1;
      if (ops % yieldEvery === 0) {
        await new Promise((r) => setTimeout(r, 0));
      }

      const restored = remapClusterByHeadCut(cluster, restoreMap);
      if (restored) {
        remapped += 1;
        groupChanged = true;
        const existing = byKey.get(restored.key);
        if (existing) mergeRemappedClusterInto(existing, restored);
        else byKey.set(restored.key, restored);
        continue;
      }

      const spacedVariants = [
        ...(cluster.variants ?? []),
        ...Object.keys(clusterCountsObject(cluster)),
      ].filter((v) => /\s/.test(String(v)));
      const adjacentHit = spacedVariants.some((v) => {
        const parts = String(v)
          .normalize('NFC')
          .trim()
          .split(/\s+/)
          .filter(Boolean);
        if (parts.length < 2) return false;
        const left = hangulOnlyNoise(parts[0]);
        // head-cut으로 복원 가능한 조각은 위에서 처리됨 — 여기선 인접만
        if (restoreMap.has(left)) return false;
        return spacedVariantHitsDocSuffixOrphanIndexed(
          v,
          headCutHits,
          adjacentByCurr,
          findingsWitnesses,
        );
      });
      if (adjacentHit) {
        dropped += 1;
        groupChanged = true;
        continue;
      }

      const key = hangulOnlyNoise(String(cluster.key ?? '').replace(/\s+/g, ''));
      const normalized = {
        ...cluster,
        key: key || String(cluster.key ?? ''),
        counts: clusterCountsObject(cluster),
      };
      const existing = byKey.get(normalized.key);
      if (existing) {
        groupChanged = true;
        mergeRemappedClusterInto(existing, normalized);
      } else byKey.set(normalized.key, normalized);
    }

    const clusters = [...byKey.values()];
    if (clusters.length === 0) continue;
    if (!groupChanged && clusters.length === (group.clusters ?? []).length) {
      nextGroups.push(group);
    } else {
      nextGroups.push({ ...group, clusters });
    }
  }

  return {
    groups: nextGroups,
    applied: true,
    remapped,
    dropped,
  };
}
