/**
 * TXT 검수전용 — 쪽 텍스트에서 반복 머리말·바닥글·쪽수 줄을 걷어 낸다.
 * 찾기/하이라이트 핫패스와 무관.
 */
import { splitSpreadColumns } from './spreadColumnSplit.js';
import {
  explainPageColumns,
  splitPageColumns,
} from './pageColumnSplit.js';

/** 상·하단 띠 (쪽 y 범위 대비, PDF y는 위로 큼) */
const BAND_RATIO = 0.12;
/** 반복 머리말로 볼 최소 쪽 비율 */
const REPEAT_RATIO = 0.4;
/** 반복 판정 최소 쪽 수 */
const REPEAT_MIN_PAGES = 2;

const PAGE_NUM_RE =
  /^(?:(?:쪽|p\.?|page)\s*)?[\d０-９]+(?:\s*(?:쪽|page))?$|^[ivxlcdmIVXLCDM]+$|^[—\-–·•]\s*[\d０-９]+\s*[—\-–·•]$/u;

/**
 * @param {string} text
 * @returns {string}
 */
export function normalizeTxtLineKey(text) {
  return String(text ?? '')
    .normalize('NFC')
    .replace(/\s+/gu, ' ')
    .trim();
}

/**
 * @param {string} text
 * @returns {boolean}
 */
export function isLikelyPageNumberLine(text) {
  const key = normalizeTxtLineKey(text);
  if (!key || key.length > 24) return false;
  return PAGE_NUM_RE.test(key);
}

/** 본문에 붙은 쪽수(2~3자리) — `68입력 필요`, `66경상북도` */
const GLUED_PAGE_LEAD_RE = /^[0-9０-９]{2,3}(?=[가-힣A-Za-z「『“"'(])/u;
const GLUED_PAGE_TAIL_RE = /(?<=[가-힣A-Za-z」』”"')])[0-9０-９]{2,3}$/u;

/**
 * 같은 줄에 붙은 쪽수 숫자만 걷어 낸다. `2-08`·한 자리·네 자리(연도)는 건드리지 않는다.
 * @param {string} text
 * @returns {string}
 */
export function stripGluedPageNumber(text) {
  let s = String(text ?? '').normalize('NFC').trim();
  if (!s) return '';
  s = s.replace(GLUED_PAGE_LEAD_RE, '');
  s = s.replace(GLUED_PAGE_TAIL_RE, '');
  return s.trim();
}

/**
 * item transform y로 줄 묶기 (위→아래).
 * 펼침면·페이지 내 2단이면 단을 나눈 뒤 왼쪽을 다 읽고 오른쪽을 붙인다.
 * @param {import('pdfjs-dist').TextItem[]} items
 * @returns {{ text: string, y: number }[]}
 */
export function linesFromPdfItems(items) {
  const source = items ?? [];
  const spread = splitSpreadColumns(source);
  if (spread) {
    return [
      ...linesFromPdfItemsInColumn(spread.left.map((row) => row.item), 0),
      ...linesFromPdfItemsInColumn(spread.right.map((row) => row.item), 1),
    ];
  }
  const columns = splitPageColumns(source);
  if (columns) {
    return [
      ...linesFromPdfItemsInColumn(columns.left.map((row) => row.item), 0),
      ...linesFromPdfItemsInColumn(columns.right.map((row) => row.item), 1),
    ];
  }
  return linesFromPdfItemsInColumn(source, 0);
}

/**
 * 한 단(또는 단일 열) 안에서만 y 내림차순·같은 줄은 x 오름차순으로 줄을 만든다.
 * @param {import('pdfjs-dist').TextItem[]} items
 * @param {number} [col]
 * @returns {{ text: string, y: number, x: number, endX: number, fontH: number, col: number, trailSpace: boolean }[]}
 */
function linesFromPdfItemsInColumn(items, col = 0) {
  /** @type {{ str: string, x: number, y: number, fontH: number, width: number, hasEOL?: boolean }[]} */
  const glyphs = [];
  for (const item of items ?? []) {
    if (!item || !('str' in item) || !item.str) continue;
    const t = item.transform;
    if (!Array.isArray(t) || t.length < 6) continue;
    const fontH = Math.hypot(t[2], t[3]) || Math.abs(t[3]) || 12;
    const estimate = Math.max(item.str.length, 1) * fontH;
    const reported = Number(item.width);
    const width =
      Number.isFinite(reported) && reported > 0 && reported <= estimate * 1.75
        ? reported
        : estimate;
    glyphs.push({
      str: item.str,
      x: t[4],
      y: t[5],
      fontH,
      width,
      hasEOL: Boolean(item.hasEOL),
    });
  }
  if (!glyphs.length) return [];

  glyphs.sort((a, b) => b.y - a.y || a.x - b.x);

  /** @type {{ text: string, y: number }[]} */
  const lines = [];
  /** @type {typeof glyphs} */
  let bucket = [];
  let bucketY = 0;
  let bucketFont = 12;

  const flush = () => {
    if (!bucket.length) return;
    bucket.sort((a, b) => a.x - b.x);
    // Same-y: wide gutters always split; tight table cells (wide chunks + modest gap) also split.
    const gutterMin = Math.max(bucketFont * 1.35, 14);
    const cellGapMin = Math.max(bucketFont * 0.45, 3.5);
    const cellMinW = bucketFont * 2.5;
    /** @type {(typeof glyphs)[]} */
    const runs = [];
    /** @type {typeof glyphs} */
    let run = [];
    let runEnd = -Infinity;
    let runWidth = 0;
    for (const g of bucket) {
      const gap = g.x - runEnd;
      if (run.length) {
        const prevSubstantial =
          runWidth >= cellMinW && run.map((x) => x.str).join('').trim().length >= 2;
        const nextSubstantial =
          g.width >= cellMinW && String(g.str).trim().length >= 2;
        const split =
          gap >= gutterMin ||
          (gap >= cellGapMin && prevSubstantial && nextSubstantial);
        if (split) {
          runs.push(run);
          run = [];
          runWidth = 0;
        }
      }
      run.push(g);
      runEnd = g.x + g.width;
      if (run.length === 1) runWidth = g.width;
      else runWidth = runEnd - run[0].x;
    }
    if (run.length) runs.push(run);

    for (const part of runs) {
      const raw = part.map((g) => g.str).join('');
      const trailSpace =
        /[\t \u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]$/u.test(raw);
      const text = raw.replace(
        /[\t \u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]+$/u,
        '',
      );
      if (!text.trim()) continue;
      let x = Infinity;
      let endX = -Infinity;
      let fontH = 0;
      for (const g of part) {
        if (g.x < x) x = g.x;
        const right = g.x + g.width;
        if (right > endX) endX = right;
        if (g.fontH > fontH) fontH = g.fontH;
      }
      lines.push({
        text: text.normalize('NFC'),
        y: bucketY,
        x,
        endX,
        fontH: fontH || bucketFont,
        col,
        trailSpace,
      });
    }
    bucket = [];
  };

  for (const g of glyphs) {
    if (!bucket.length) {
      bucket = [g];
      bucketY = g.y;
      bucketFont = g.fontH;
      if (g.hasEOL) flush();
      continue;
    }
    const dy = Math.abs(g.y - bucketY);
    const thresh = Math.max(bucketFont, g.fontH) * 0.45;
    if (dy > thresh) {
      flush();
      bucket = [g];
      bucketY = g.y;
      bucketFont = g.fontH;
    } else {
      bucket.push(g);
      bucketY = (bucketY * (bucket.length - 1) + g.y) / bucket.length;
      bucketFont = Math.max(bucketFont, g.fontH);
    }
    if (g.hasEOL) flush();
  }
  flush();
  return lines;
}

/**
 * @param {{ text: string, y: number }[]} lines
 * @returns {{ yMin: number, yMax: number }}
 */
function yExtent(lines) {
  let yMin = Infinity;
  let yMax = -Infinity;
  for (const line of lines) {
    if (line.y < yMin) yMin = line.y;
    if (line.y > yMax) yMax = line.y;
  }
  if (!Number.isFinite(yMin) || !Number.isFinite(yMax) || yMax <= yMin) {
    return { yMin: 0, yMax: 1 };
  }
  return { yMin, yMax };
}

/**
 * @param {number} y
 * @param {number} yMin
 * @param {number} yMax
 * @returns {'top' | 'bottom' | 'mid'}
 */
function bandOf(y, yMin, yMax) {
  const span = yMax - yMin || 1;
  const topCut = yMax - span * BAND_RATIO;
  const botCut = yMin + span * BAND_RATIO;
  if (y >= topCut) return 'top';
  if (y <= botCut) return 'bottom';
  return 'mid';
}

/**
 * 시각 기준 본문 첫·끝 줄 인덱스 (측정 정답이 아니라 쪽 넘김 신뢰용).
 * @param {{ y?: number, col?: number }[]} lineLayout
 * @param {'single' | 'two'} kind
 * @returns {{ bodyHeadIndex: number, bodyTailIndex: number }}
 */
export function bodyBoundaryIndices(lineLayout, kind = 'single') {
  const layouts = lineLayout ?? [];
  if (!layouts.length) return { bodyHeadIndex: 0, bodyTailIndex: -1 };

  if (kind === 'two') {
    let head = -1;
    let headY = -Infinity;
    let tail = -1;
    let tailY = Infinity;
    for (let i = 0; i < layouts.length; i += 1) {
      const col = layouts[i]?.col ?? 0;
      const y = layouts[i]?.y;
      if (!Number.isFinite(y)) continue;
      if (col === 0 && y >= headY) {
        headY = y;
        head = i;
      }
      if (col === 1 && y <= tailY) {
        tailY = y;
        tail = i;
      }
    }
    if (head < 0) head = 0;
    if (tail < 0) tail = layouts.length - 1;
    return { bodyHeadIndex: head, bodyTailIndex: tail };
  }

  let head = 0;
  let tail = 0;
  let headY = -Infinity;
  let tailY = Infinity;
  for (let i = 0; i < layouts.length; i += 1) {
    const y = layouts[i]?.y;
    if (!Number.isFinite(y)) continue;
    if (y >= headY) {
      headY = y;
      head = i;
    }
    if (y <= tailY) {
      tailY = y;
      tail = i;
    }
  }
  return { bodyHeadIndex: head, bodyTailIndex: tail };
}

/**
 * @param {{ items?: import('pdfjs-dist').TextItem[], visualText?: string, text?: string, pageNum?: number }[]} pages
 * @returns {{
 *   pageNum: number,
 *   lines: string[],
 *   lineLayout: { x?: number, y?: number, endX?: number, fontH?: number, col?: number, trailSpace?: boolean }[],
 *   column?: import('./pageColumnSplit.js').ColumnDecision,
 *   bodyHeadIndex?: number,
 *   bodyTailIndex?: number,
 * }[]}
 */
export function cleanPageLinesForTxt(pages) {
  const list = pages ?? [];
  const pageLines = list.map((page, i) => {
    const items = page.items ?? [];
    const column = items.length
      ? explainPageColumns(items)
      : {
          kind: /** @type {'single'} */ ('single'),
          reason: /** @type {'no-gap'} */ ('no-gap'),
          margin: /** @type {'clear'} */ ('clear'),
          deferred: false,
        };
    const fromItems = linesFromPdfItems(items);
    if (fromItems.length) {
      return {
        pageNum: page.pageNum ?? i + 1,
        lines: fromItems,
        column,
      };
    }
    const fallback = String(page.visualText ?? page.text ?? '')
      .normalize('NFC')
      .split(/\n/u)
      .map((raw) => {
        const trailSpace = /[\t \u00A0\u3000]$/u.test(raw);
        const text = raw.replace(/\s+$/u, '');
        return { text, trailSpace };
      })
      .filter((line) => line.text.trim().length > 0)
      .map((line, idx, arr) => {
        const fontH = 12;
        const x = 0;
        const endX = Math.max(line.text.length, 1) * fontH * 0.55;
        return {
          text: line.text,
          y: arr.length - idx,
          x,
          endX,
          fontH,
          col: 0,
          trailSpace: line.trailSpace,
        };
      });
    return { pageNum: page.pageNum ?? i + 1, lines: fallback, column };
  });

  /** @type {Map<string, number>} */
  const bandKeyCounts = new Map();
  for (const page of pageLines) {
    if (!page.lines.length) continue;
    const { yMin, yMax } = yExtent(page.lines);
    /** @type {Set<string>} */
    const seen = new Set();
    for (const line of page.lines) {
      const band = bandOf(line.y, yMin, yMax);
      if (band === 'mid') continue;
      const key = normalizeTxtLineKey(line.text);
      if (!key || key.length > 80) continue;
      if (seen.has(key)) continue;
      seen.add(key);
      bandKeyCounts.set(key, (bandKeyCounts.get(key) ?? 0) + 1);
    }
  }

  const pageCount = Math.max(pageLines.length, 1);
  const repeatNeed = Math.max(
    REPEAT_MIN_PAGES,
    Math.ceil(pageCount * REPEAT_RATIO),
  );
  /** @type {Set<string>} */
  const chromeKeys = new Set();
  for (const [key, count] of bandKeyCounts) {
    if (count >= repeatNeed) chromeKeys.add(key);
  }

  return pageLines.map((page) => {
    const column = page.column ?? {
      kind: /** @type {'single'} */ ('single'),
      reason: /** @type {'no-gap'} */ ('no-gap'),
      margin: /** @type {'clear'} */ ('clear'),
      deferred: false,
    };
    if (!page.lines.length) {
      return {
        pageNum: page.pageNum,
        lines: /** @type {string[]} */ ([]),
        lineLayout: [],
        column,
        bodyHeadIndex: 0,
        bodyTailIndex: -1,
      };
    }
    const { yMin, yMax } = yExtent(page.lines);
    /** @type {string[]} */
    const kept = [];
    /** @type {{ x?: number, y?: number, endX?: number, fontH?: number, col?: number, trailSpace?: boolean }[]} */
    const lineLayout = [];
    for (const line of page.lines) {
      const key = normalizeTxtLineKey(line.text);
      if (!key) continue;
      const band = bandOf(line.y, yMin, yMax);
      if (band !== 'mid' && chromeKeys.has(key)) continue;
      if (band !== 'mid' && isLikelyPageNumberLine(key)) continue;
      const text = stripGluedPageNumber(line.text.normalize('NFC'));
      if (!text) continue;
      kept.push(text);
      lineLayout.push({
        x: line.x,
        y: line.y,
        endX: line.endX,
        fontH: line.fontH,
        col: line.col ?? 0,
        trailSpace: Boolean(line.trailSpace),
      });
    }
    const { bodyHeadIndex, bodyTailIndex } = bodyBoundaryIndices(
      lineLayout,
      column.kind === 'two' ? 'two' : 'single',
    );
    return {
      pageNum: page.pageNum,
      lines: kept,
      lineLayout,
      column,
      bodyHeadIndex,
      bodyTailIndex,
    };
  });
}

/**
 * @param {{ items?: import('pdfjs-dist').TextItem[], visualText?: string, text?: string, pageNum?: number }[]} pages
 * @returns {{ pageNum: number, text: string }[]}
 */
export function cleanPagesForTxt(pages) {
  return cleanPageLinesForTxt(pages).map((page) => ({
    pageNum: page.pageNum,
    text: page.lines.join('\n').replace(/\s+$/u, ''),
  }));
}
