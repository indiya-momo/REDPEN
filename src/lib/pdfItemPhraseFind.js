/**
 * PDF.js TextItem[]에서 구문 hit (문자 + item bbox).
 * visualText / itemRefs 조립·투영을 거치지 않는다.
 *
 * @see project-docs/reading-order-find-benchmark-2026-08-02.md (B)
 */

import { getPageSpreadLayout } from './matchReadingOrder.js';
import { detectPageColumns } from './pageColumnSplit.js';
import { isUnifyHangulMidWordSoftWrap } from './pdfPageText.js';

/**
 * @typedef {import('pdfjs-dist').TextItem} PdfTextItem
 *
 * @typedef {Object} PdfItemPhraseHit
 * @property {string} phrase
 * @property {number} itemIndex — 매칭 시작 item
 * @property {number[]} itemIndexes — 매칭에 참여한 item
 * @property {number} x
 * @property {number} y
 * @property {'in-item' | 'glyph-run' | 'soft-wrap' | 'line-run'} kind
 * @property {string} [run] — glyph-run / line-run 전체 문자열
 * @property {string} snippet
 */

const DEDUP_XY_TOL = 2;
const SAME_X_TOL = 1.25;
/** 같은 줄로 볼 y 허용 (PDF user unit) */
const SAME_LINE_Y_TOL = 3.5;
/** 어절 간격으로 끊을 최대 gap (fontSize 배수) — 이하면 붙여 읽기 */
const LINE_JOIN_GAP_EM = 0.45;

/** @param {string} s */
function glue(s) {
  return String(s ?? '').replace(/\s+/g, '');
}

/** @type {WeakMap<PdfTextItem[], string[]>} */
const fatCorpusCache = new WeakMap();

/** @type {WeakMap<PdfTextItem[], ReturnType<typeof collectGlyphRuns>>} */
const glyphRunsCache = new WeakMap();

/** @type {WeakMap<PdfTextItem[], Map<string, PdfItemPhraseHit[]>>} */
const phraseHitsCache = new WeakMap();

/**
 * @param {PdfTextItem[]} items
 * @returns {string[]}
 */
function fatCorpusGlued(items) {
  const cached = fatCorpusCache.get(items);
  if (cached) return cached;
  /** @type {string[]} */
  const out = [];
  for (const it of items) {
    const s = it?.str ?? '';
    if (s.length >= 4) out.push(glue(s));
  }
  fatCorpusCache.set(items, out);
  return out;
}

/**
 * 같은 x에 쌓인 1글자(또는 초단) 라벨을 y 내림차순으로 이어 붙인다.
 * @param {PdfTextItem[]} items
 * @returns {{ itemIndexes: number[], run: string, x: number, y: number }[]}
 */
function collectGlyphRuns(items) {
  const cached = glyphRunsCache.get(items);
  if (cached) return cached;
  /** @type {Map<string, number[]>} */
  const byX = new Map();
  for (let i = 0; i < items.length; i += 1) {
    const it = items[i];
    const s = it?.str ?? '';
    if (!s || /\s/.test(s)) continue;
    // 1글자만 — 다글자 단문을 넣으면 run 문자 수 ≠ itemIndexes 길이
    if (s.length !== 1) continue;
    const x = it.transform?.[4] ?? 0;
    const key = String(Math.round(x / SAME_X_TOL) * SAME_X_TOL);
    const list = byX.get(key) ?? [];
    list.push(i);
    byX.set(key, list);
  }

  /** @type {{ itemIndexes: number[], run: string, x: number, y: number }[]} */
  const runs = [];
  for (const indexes of byX.values()) {
    if (indexes.length < 2) continue;
    // 지도 라벨은 y 정렬보다 콘텐츠 스트림 순이 글자 순에 가깝다
    indexes.sort((a, b) => a - b);
    /** @type {number[][]} */
    const chunks = [];
    /** @type {number[]} */
    let cur = [];
    let lastIdx = null;
    for (const idx of indexes) {
      if (cur.length && lastIdx != null && idx - lastIdx > 4) {
        chunks.push(cur);
        cur = [];
      }
      cur.push(idx);
      lastIdx = idx;
    }
    if (cur.length) chunks.push(cur);

    for (const chunk of chunks) {
      if (chunk.length < 2) continue;
      const run = chunk.map((i) => items[i].str).join('');
      const x = items[chunk[0]].transform?.[4] ?? 0;
      const y =
        chunk.reduce((s, i) => s + (items[i].transform?.[5] ?? 0), 0) /
        chunk.length;
      runs.push({ itemIndexes: chunk, run, x, y });
    }
  }
  glyphRunsCache.set(items, runs);
  return runs;
}

/**
 * 글리프 런 hit: 이어진 글자가 본문(fat item)에 실제로 존재할 때만 채택.
 * → 「명지」+「산」처럼 페이지에 없는 접합 오탐 제거, 「명지」+「계」는 본문 「명지 계곡」으로 입증.
 *
 * @param {string} run
 * @param {string} needleGlued
 * @param {string[]} fatGlued
 */
export function isCorroboratedGlyphHit(run, needleGlued, fatGlued) {
  if (!needleGlued || !run.includes(needleGlued)) return false;
  const idx = run.indexOf(needleGlued);
  const after = run.slice(idx + needleGlued.length);
  const needleInFat = fatGlued.some((s) => s.includes(needleGlued));

  // 런이 needle로 끝 — 본문에 needle이 있을 때만 (단독 장식 글리프 억제)
  if (!after.length) return needleInFat;

  // 이중 드로잉 제목: 「명지계곡명지계곡」
  if (needleInFat && after.startsWith(needleGlued)) return true;

  // 「명지」+「계」→ 본문 「명지계곡」으로 입증. 「명지」+「산」은 본문에 없으면 거부.
  const continued = needleGlued + after[0];
  if (fatGlued.some((s) => s.includes(continued))) return true;

  const runGlued = glue(run);
  return fatGlued.some((s) => s.includes(runGlued));
}

/**
 * @param {string} str
 * @param {number} localStart
 * @param {number} localEnd
 */
function spanHasInternalSpace(str, localStart, localEnd) {
  return /\s/.test(String(str).slice(localStart, localEnd));
}

/**
 * 띄움 needle ↔ 매칭 구간에 공백 있음 / 붙임 needle ↔ 구간 공백 없음.
 * glue만 맞으면 붙임 제목을 띄움 칩으로 세는 오탐을 막는다.
 * @param {boolean} needleHasSpace
 * @param {boolean} matchHasSpace
 */
function spacingFidelityOk(needleHasSpace, matchHasSpace) {
  return needleHasSpace === matchHasSpace;
}

/**
 * 같은 줄(y)에서 x 순으로 이어 붙인 item 연쇄.
 * 큰 가로 간격이면 새 연쇄로 끊는다.
 * @param {PdfTextItem[]} items
 * @returns {{
 *   itemIndexes: number[],
 *   compact: string,
 *   charItemIndexes: number[],
 *   hasSpaceInRange: (start: number, endExclusive: number) => boolean,
 * }[]}
 */
function collectSameLineItemChains(items) {
  /** @type {{ idx: number, x: number, y: number, fs: number, str: string, right: number }[]} */
  const rows = [];
  for (let i = 0; i < items.length; i += 1) {
    const it = items[i];
    const str = it?.str ?? '';
    if (!str) continue;
    const fs = Math.abs(it.transform?.[0] ?? it.height ?? 10) || 10;
    const x = it.transform?.[4] ?? 0;
    const width = typeof it.width === 'number' ? it.width : fs * str.length * 0.55;
    rows.push({
      idx: i,
      x,
      y: it.transform?.[5] ?? 0,
      fs,
      str,
      right: x + width,
    });
  }
  if (!rows.length) return [];

  rows.sort((a, b) => b.y - a.y || a.x - b.x || a.idx - b.idx);

  /** @type {typeof rows[]} */
  const lines = [];
  /** @type {typeof rows} */
  let line = [];
  let lineY = /** @type {number | null} */ (null);
  for (const row of rows) {
    if (lineY == null || Math.abs(row.y - lineY) <= SAME_LINE_Y_TOL) {
      line.push(row);
      lineY =
        lineY == null
          ? row.y
          : (lineY * (line.length - 1) + row.y) / line.length;
      continue;
    }
    lines.push(line);
    line = [row];
    lineY = row.y;
  }
  if (line.length) lines.push(line);

  /** @type {ReturnType<typeof collectSameLineItemChains>} */
  const chains = [];

  /**
   * @param {typeof rows} chunk
   */
  const pushChain = (chunk) => {
    if (chunk.length < 2) return;
    /** @type {number[]} */
    const itemIndexes = [];
    /** @type {number[]} */
    const charItemIndexes = [];
    let compact = '';
    for (const row of chunk) {
      itemIndexes.push(row.idx);
      for (let k = 0; k < row.str.length; k += 1) {
        if (/\s/.test(row.str[k])) continue;
        charItemIndexes.push(row.idx);
        compact += row.str[k];
      }
    }
    if (compact.length < 2) return;
    chains.push({
      itemIndexes,
      compact,
      charItemIndexes,
      hasSpaceInRange(start, endExclusive) {
        if (endExclusive - start <= 1) return false;
        for (let p = start + 1; p < endExclusive; p += 1) {
          const a = charItemIndexes[p - 1];
          const b = charItemIndexes[p];
          if (a == null || b == null || a === b) continue;
          const left = items[a];
          const right = items[b];
          const ls = left?.str ?? '';
          const rs = right?.str ?? '';
          if (/\s$/.test(ls) || /^\s/.test(rs)) return true;
          const lfs = Math.abs(left?.transform?.[0] ?? 10) || 10;
          const lx =
            (left?.transform?.[4] ?? 0) +
            (typeof left?.width === 'number' ? left.width : lfs);
          const rx = right?.transform?.[4] ?? 0;
          if (rx - lx > lfs * LINE_JOIN_GAP_EM) return true;
        }
        return false;
      },
    });
  };

  for (const band of lines) {
    band.sort((a, b) => a.x - b.x || a.idx - b.idx);
    /** @type {typeof rows} */
    let chunk = [];
    for (const row of band) {
      if (chunk.length) {
        const prev = chunk[chunk.length - 1];
        const gap = row.x - prev.right;
        const dx = row.x - prev.x;
        const em = Math.max(prev.fs, row.fs);
        // 세로 스택(지도 글리프): x가 거의 같으면 가로 연쇄에 넣지 않음
        if (Math.abs(dx) < em * 0.35) {
          pushChain(chunk);
          chunk = [];
        } else if (gap > em * 2.5) {
          // 어절·블록 사이 큰 간격은 연쇄 분리
          pushChain(chunk);
          chunk = [];
        }
      }
      chunk.push(row);
    }
    pushChain(chunk);
  }
  return chains;
}

/**
 * @param {PdfTextItem[]} items
 * @param {string} phrase
 * @returns {PdfItemPhraseHit[]}
 */
export function findPhraseHitsInPdfItems(items, phrase) {
  const needle = String(phrase ?? '');
  const needleGlued = glue(needle);
  if (!needleGlued || !items?.length) return [];
  const needleHasSpace = /\s/.test(needle);

  let pageCache = phraseHitsCache.get(items);
  if (!pageCache) {
    pageCache = new Map();
    phraseHitsCache.set(items, pageCache);
  }
  // 띄움/붙임이 같은 glue여도 hit 집합이 다름 → needle 원문 키
  const cachedHits = pageCache.get(needle);
  if (cachedHits) return cachedHits.map((h) => ({ ...h }));

  const fatGlued = fatCorpusGlued(items);
  /** @type {PdfItemPhraseHit[]} */
  const hits = [];

  // 1) 단일 item.str 내부 (공백 무시 매칭 + 띄움/붙임 충실도)
  for (let i = 0; i < items.length; i += 1) {
    const it = items[i];
    const str = it?.str ?? '';
    if (!str) continue;
    /** @type {number[]} */
    const map = [];
    let compact = '';
    for (let c = 0; c < str.length; c += 1) {
      if (/\s/.test(str[c])) continue;
      map.push(c);
      compact += str[c];
    }
    let pos = 0;
    while (pos <= compact.length - needleGlued.length) {
      const at = compact.indexOf(needleGlued, pos);
      if (at < 0) break;
      const localStart = map[at] ?? 0;
      const localEnd = (map[at + needleGlued.length - 1] ?? localStart) + 1;
      const matchHasSpace = spanHasInternalSpace(str, localStart, localEnd);
      if (!spacingFidelityOk(needleHasSpace, matchHasSpace)) {
        pos = at + 1;
        continue;
      }
      const x = it.transform?.[4] ?? 0;
      const y = it.transform?.[5] ?? 0;
      hits.push({
        phrase: needle,
        itemIndex: i,
        itemIndexes: [i],
        x: Number(x.toFixed(2)),
        y: Number(y.toFixed(2)),
        kind: 'in-item',
        snippet: str.slice(
          Math.max(0, localStart - 8),
          localStart + needle.length + 12,
        ),
      });
      pos = at + 1;
    }
  }

  // 2) 지도형 글리프 런 — 공백 없음 → 붙임 needle만.
  // 3음절 이상 화합물(명지계곡)은 본문 fat를 glue하면 띄움 본문으로
  // 지도 세로 글자 런이 '붙임 1회'로 둔다 → 짧은 표기(≤2)만 글리프 허용.
  if (!needleHasSpace && needleGlued.length <= 2) {
    for (const runInfo of collectGlyphRuns(items)) {
      if (!isCorroboratedGlyphHit(runInfo.run, needleGlued, fatGlued)) continue;
      let from = 0;
      while (from <= runInfo.run.length - needleGlued.length) {
        const at = runInfo.run.indexOf(needleGlued, from);
        if (at < 0) break;
        const startItem = runInfo.itemIndexes[at];
        const endItem =
          runInfo.itemIndexes[at + needleGlued.length - 1] ?? startItem;
        if (startItem == null || endItem == null) {
          from = at + 1;
          continue;
        }
        const used = [];
        for (let k = at; k < at + needleGlued.length; k += 1) {
          const ii = runInfo.itemIndexes[k];
          if (ii == null) continue;
          used.push(ii);
        }
        if (used.length !== needleGlued.length) {
          from = at + 1;
          continue;
        }
        const x0 = items[startItem].transform?.[4] ?? runInfo.x;
        const y0 = items[startItem].transform?.[5] ?? runInfo.y;
        const x1 = items[endItem].transform?.[4] ?? x0;
        const y1 = items[endItem].transform?.[5] ?? y0;
        hits.push({
          phrase: needle,
          itemIndex: startItem,
          itemIndexes: used,
          x: Number((((x0 + x1) / 2)).toFixed(2)),
          y: Number((((y0 + y1) / 2)).toFixed(2)),
          kind: 'glyph-run',
          run: runInfo.run,
          snippet: runInfo.run,
        });
        from = at + 1;
      }
    }
  }

  // 3) 같은 줄·작은 간격 item 연쇄 (차트 라벨 「경제」「침체」등).
  //    soft-wrap(1음절 어미)과 세로 글리프 런이 못 잡는 가로 분할을 보완.
  for (const chain of collectSameLineItemChains(items)) {
    if (chain.itemIndexes.length < 2) continue;
    if (chain.compact.length < needleGlued.length) continue;
    let pos = 0;
    while (pos <= chain.compact.length - needleGlued.length) {
      const at = chain.compact.indexOf(needleGlued, pos);
      if (at < 0) break;
      const end = at + needleGlued.length;
      const matchHasSpace = chain.hasSpaceInRange(at, end);
      if (!spacingFidelityOk(needleHasSpace, matchHasSpace)) {
        pos = at + 1;
        continue;
      }
      /** @type {number[]} */
      const used = [];
      for (let k = at; k < end; k += 1) {
        const ii = chain.charItemIndexes[k];
        if (ii == null) continue;
        if (used[used.length - 1] !== ii) used.push(ii);
      }
      if (!used.length) {
        pos = at + 1;
        continue;
      }
      const startItem = used[0];
      const endItem = used[used.length - 1];
      const x0 = items[startItem].transform?.[4] ?? 0;
      const y0 = items[startItem].transform?.[5] ?? 0;
      const x1 = items[endItem].transform?.[4] ?? x0;
      const y1 = items[endItem].transform?.[5] ?? y0;
      hits.push({
        phrase: needle,
        itemIndex: startItem,
        itemIndexes: used,
        x: Number((((x0 + x1) / 2)).toFixed(2)),
        y: Number((((y0 + y1) / 2)).toFixed(2)),
        kind: 'line-run',
        run: chain.compact,
        snippet: chain.compact.slice(
          Math.max(0, at - 4),
          Math.min(chain.compact.length, end + 8),
        ),
      });
      pos = at + 1;
    }
  }

  // 4) soft-wrap: 단어가 item 두 개에 갈라진 경우
  for (let i = 0; i < items.length - 1; i += 1) {
    const a = items[i];
    const b = items[i + 1];
    const sa = a?.str ?? '';
    const sb = b?.str ?? '';
    if (!sa || !sb) continue;
    const aTrim = sa.replace(/\s+$/u, '');
    const bTrim = sb.replace(/^\s+/u, '');
    if (!aTrim || !bTrim) continue;
    if (!isUnifyHangulMidWordSoftWrap(aTrim, bTrim)) continue;
    if (aTrim.length < 4) continue;

    /** @type {number[]} */
    const map = [];
    let compact = '';
    for (let c = 0; c < sa.length; c += 1) {
      if (/\s/.test(sa[c])) continue;
      map.push(c);
      compact += sa[c];
    }
    const aGluedLen = compact.length;
    for (let c = 0; c < sb.length; c += 1) {
      if (/\s/.test(sb[c])) continue;
      map.push(sa.length + c);
      compact += sb[c];
    }
    let pos = 0;
    while (pos <= compact.length - needleGlued.length) {
      const at = compact.indexOf(needleGlued, pos);
      if (at < 0) break;
      if (at < aGluedLen && at + needleGlued.length <= aGluedLen) {
        pos = at + 1;
        continue;
      }
      if (at >= aGluedLen) {
        pos = at + 1;
        continue;
      }
      const matchHasSpace = softWrapMatchHasInternalSpace(
        sa,
        sb,
        map,
        at,
        needleGlued.length,
        aGluedLen,
      );
      if (!spacingFidelityOk(needleHasSpace, matchHasSpace)) {
        pos = at + 1;
        continue;
      }

      const x0 = a.transform?.[4] ?? 0;
      const y0 = a.transform?.[5] ?? 0;
      const x1 = b.transform?.[4] ?? x0;
      const y1 = b.transform?.[5] ?? y0;
      hits.push({
        phrase: needle,
        itemIndex: i,
        itemIndexes: [i, i + 1],
        x: Number((((x0 + x1) / 2)).toFixed(2)),
        y: Number((((y0 + y1) / 2)).toFixed(2)),
        kind: 'soft-wrap',
        snippet: (aTrim.slice(-12) + bTrim.slice(0, 20)).slice(0, 40),
      });
      pos = at + 1;
    }
  }

  const deduped = dedupePhraseHits(hits);
  pageCache.set(needle, deduped);
  return deduped;
}

/**
 * soft-wrap 매칭 구간(원문)에 내부 공백이 있는지.
 * @param {string} sa
 * @param {string} sb
 * @param {number[]} map compact→원문 오프셋(sa 길이 기준 sb는 sa.length+c)
 * @param {number} at
 * @param {number} needleLen
 * @param {number} aGluedLen
 */
function softWrapMatchHasInternalSpace(sa, sb, map, at, needleLen, aGluedLen) {
  const end = at + needleLen;
  if (at < aGluedLen) {
    const aStart = map[at];
    const aLast = map[Math.min(end, aGluedLen) - 1];
    if (
      aStart != null &&
      aLast != null &&
      spanHasInternalSpace(sa, aStart, aLast + 1)
    ) {
      return true;
    }
  }
  if (end > aGluedLen) {
    const bFirst = map[Math.max(at, aGluedLen)];
    const bLast = map[end - 1];
    if (bFirst != null && bLast != null) {
      const bStart = bFirst - sa.length;
      const bEnd = bLast - sa.length + 1;
      if (spanHasInternalSpace(sb, bStart, bEnd)) return true;
    }
  }
  return false;
}

/** @param {string} ch */
function isHangulSyllableChar(ch) {
  return typeof ch === 'string' && ch.length > 0 && ch >= '\uAC00' && ch <= '\uD7A3';
}

/**
 * @param {PdfItemPhraseHit[]} hits
 * @returns {PdfItemPhraseHit[]}
 */
export function dedupePhraseHits(hits) {
  /** @type {PdfItemPhraseHit[]} */
  const out = [];
  for (const h of hits) {
    const dup = out.find(
      (o) =>
        Math.abs(o.x - h.x) <= DEDUP_XY_TOL &&
        Math.abs(o.y - h.y) <= DEDUP_XY_TOL &&
        o.phrase === h.phrase,
    );
    if (dup) {
      // in-item 우선, 아니면 더 긴 snippet 유지
      if (dup.kind !== 'in-item' && h.kind === 'in-item') {
        out[out.indexOf(dup)] = h;
      }
      continue;
    }
    out.push(h);
  }
  return out;
}

/**
 * 페이지 내 2단(pageColumnSplit) 우선, 없으면 펼침면 gutter, 둘 다 없으면 전역 −y,x.
 * @param {PdfItemPhraseHit[]} hits
 * @param {PdfTextItem[]} items
 * @param {number} [pageNum]
 * @returns {PdfItemPhraseHit[]}
 */
export function sortPhraseHitsReadingOrder(hits, items, pageNum = 1) {
  const pageCols = detectPageColumns(items);
  const pageData = { pageNum, items, text: '', itemRefs: [] };
  const spread = getPageSpreadLayout(pageData);
  let gutterX = pageCols?.gutterX
    ?? (spread.isSpread ? spread.gutterX : null);

  // 페이지 단 탐지가 실패해도, hit x가 넓게 갈리면 중앙을 임시 gutter로 쓴다
  if (gutterX == null && hits.length >= 3) {
    const xs = hits.map((h) => h.x).sort((a, b) => a - b);
    const span = xs[xs.length - 1] - xs[0];
    if (span >= 120) {
      gutterX = (xs[0] + xs[xs.length - 1]) / 2;
    }
  }
  const useColumns = gutterX != null && Number.isFinite(gutterX);

  return [...hits].sort((a, b) => {
    if (useColumns) {
      const colA = a.x >= /** @type {number} */ (gutterX) ? 1 : 0;
      const colB = b.x >= /** @type {number} */ (gutterX) ? 1 : 0;
      if (colA !== colB) return colA - colB;
    }
    if (Math.abs(a.y - b.y) > 2) return b.y - a.y;
    // 같은 줄 밴드: x보다 콘텐츠 스트림(itemIndex)이 문장 순에 더 가깝다
    if (a.itemIndex !== b.itemIndex) return a.itemIndex - b.itemIndex;
    return a.x - b.x;
  });
}
