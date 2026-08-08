/**
 * 문서 내 앞잘림 조각 — DROP.
 *
 * ## Public API (공유 정책 진입점)
 * - {@link spacedVariantHitsDocSuffixOrphan} — 띄움 이형태 판정 (adjacentPairs 포함 완전판)
 * - {@link pruneUnifyIndexDocSuffixOrphans} — occurrence index에서 위 판정으로 정리
 * - {@link filterGroupsByDocSuffixOrphan} — **2차** 목록 필터 (page text∪layout 증인)
 * - {@link noteDocHangulEojeolForOrphan} / {@link noteAdjacentHangulPair} /
 *   {@link collectDocHangulEojeolsFromRawByKey} / {@link collectDocSuffixContextFromPageTexts}
 *
 * 1차 discover·위성 생성 핫패스에 붙이지 말 것.
 * 전역-only·어절-only 헬퍼는 export하지 않는다 (약식 진입점 금지).
 *
 * 1) 전역: 증인 W의 첫 1음절을 뺀 나머지가 F로 시작
 *    (`프로그램지출`.slice(1).startsWith(`로그램`)).
 *    증인 첫 음절이 생산적 한자어 접두면 제외 (`대기업`↛`기업`).
 *    띄움 후보에서는 **왼쪽 칸만** 전역 검사 (`노동 시장`의 시장 제외).
 * 2) 인접: 공백 앞 어절 P(길이 무관)+**왼쪽 조각** F 이음이 문서 어절과 같거나
 *    그 접두이면 F는 잘림 (`환매조`+`건부` → `환매조건부`).
 *    같은 줄 연속 토큰 + **이전 줄 마지막 ↔ 현재 줄 첫** (OCR 줄바꿈 앞잘림).
 *    짧은 앞조각(P 1~2음절)+F 인접은 긴 형태 증인 없이도 DROP
 *    (`서` `비스` / `서`\\n`비스` — 본문에 `서비스` 토큰이 없어도).
 *    짧은P·줄바꿈 인접의 P+F는 증인에 합류 (`서`+`비스`→`서비스`) → 전역 앞잘림도 동작.
 *    오른쪽 칸에는 적용하지 않음 (`서울`+`시장`이 `노동 시장`을 지우지 않게).
 *
 * 조사 strip은 증인(W) 쪽만 — needle(F)에는 적용하지 않음.
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
function spacedVariantHitsDocSuffixOrphanIndexed(
  spacedVariant,
  docHangulEojeols,
  headCutHits,
  adjacentByCurr,
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

  if (!adjacentByCurr) return false;
  if (left.length < DOC_SUFFIX_ORPHAN_MIN_FRAGMENT) return false;
  const prevs = adjacentByCurr.get(left);
  if (!prevs?.length) return false;
  for (const { prev: P } of prevs) {
    if (P.length < 1) continue;
    if (documentEojeolHasWordOrPrefix(docHangulEojeols, P + left)) return true;
    // 짧은 앞조각 OCR (서 비스 / 서\n비스) — 긴 형태 증인 없어도 DROP
    if (
      P.length <= 2 &&
      left.length >= DOC_SUFFIX_ORPHAN_MIN_FRAGMENT
    ) {
      return true;
    }
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
    docHangulEojeols,
    headCutHits,
    adjacentByCurr,
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
          witnesses,
          headCutHits,
          adjacentByCurr,
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
 * OCR로 쪼갠 인접을 이어 증인에 합류 (서+비스→서비스, 프+로그램→프로그램).
 * 긴 앞토큰 일반 인접은 넣지 않음 (대기업과+기업 → 기업 오탐 방지).
 * @param {Set<string>} witnesses
 * @param {{ prev: string, curr: string, crossLine?: boolean }[]} adjacentPairs
 */
function addJoinedAdjacentWitnesses(witnesses, adjacentPairs) {
  for (const pair of adjacentPairs ?? []) {
    const prev = hangulOnlyNoise(pair?.prev);
    const curr = hangulOnlyNoise(pair?.curr);
    if (!prev || !curr) continue;
    if (!pair?.crossLine && prev.length > 2) continue;
    noteDocHangulEojeolForOrphan(witnesses, prev + curr);
  }
}

/**
 * 2차용 — page.text ∪ textLayout에서 증인·인접쌍 수집 (1차 discover와 무관).
 * layout이 잘려도 text에 온전한 어절이 있으면 증인에 남는다.
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
  addJoinedAdjacentWitnesses(witnesses, adjacentPairs);
  return { witnesses, adjacentPairs };
}

/**
 * collect와 동일 결과 + 페이지마다 메인스레드 양보 (목록 표시 후 2차에서도 UI 동결 완화).
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
  addJoinedAdjacentWitnesses(witnesses, adjacentPairs);
  return { witnesses, adjacentPairs };
}

/**
 * 목록 그룹에서 DocSuffix 앞잘림 띄움 클러스터 제거 (2차 facade).
 * 충돌·위성 모두 — spaced variant가 orphan이면 항목 제외.
 * @param {import('./unifyCandidateGrouping.js').ClusterGroup[]} groups
 * @param {{ text?: string, textLayout?: string }[] | null | undefined} pageTexts
 * @param {{ yieldEvery?: number, yieldEveryPages?: number }} [opts]
 * @returns {Promise<{
 *   groups: import('./unifyCandidateGrouping.js').ClusterGroup[],
 *   applied: boolean,
 *   dropped: number,
 * }>}
 */
export async function filterGroupsByDocSuffixOrphan(
  groups,
  pageTexts,
  opts = {},
) {
  const { witnesses, adjacentPairs } =
    await collectDocSuffixContextFromPageTextsAsync(pageTexts, {
      yieldEveryPages: opts.yieldEveryPages ?? 1,
    });
  if (!witnesses.size) {
    return { groups: groups ?? [], applied: false, dropped: 0 };
  }
  const headCutHits = buildHeadCutFragmentIndex(witnesses);
  const adjacentByCurr = buildAdjacentPrevByCurr(adjacentPairs);
  // 인덱스 구축 직후에도 한 번 양보 — 대형 PDF에서 스피너 프레임
  await new Promise((r) => setTimeout(r, 0));

  const yieldEvery = opts.yieldEvery ?? 8;
  let dropped = 0;
  let ops = 0;
  /** @type {import('./unifyCandidateGrouping.js').ClusterGroup[]} */
  const nextGroups = [];

  for (const group of groups ?? []) {
    /** @type {typeof group.clusters} */
    const kept = [];
    for (const cluster of group.clusters ?? []) {
      ops += 1;
      if (ops % yieldEvery === 0) {
        await new Promise((r) => setTimeout(r, 0));
      }
      const spacedVariants = [
        ...(cluster.variants ?? []),
        ...Object.keys(cluster.counts ?? {}),
      ].filter((v) => /\s/.test(String(v)));
      const hit = spacedVariants.some((v) =>
        spacedVariantHitsDocSuffixOrphanIndexed(
          v,
          witnesses,
          headCutHits,
          adjacentByCurr,
        ),
      );
      if (hit) {
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
