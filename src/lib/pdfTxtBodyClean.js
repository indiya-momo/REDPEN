/**
 * TXT 검수전용 — 쪽 텍스트에서 반복 머리말·바닥글·쪽수 줄을 걷어 낸다.
 * 찾기/하이라이트 핫패스와 무관.
 */

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
 * @param {import('pdfjs-dist').TextItem[]} items
 * @returns {{ text: string, y: number }[]}
 */
export function linesFromPdfItems(items) {
  /** @type {{ str: string, x: number, y: number, fontH: number, hasEOL?: boolean }[]} */
  const glyphs = [];
  for (const item of items ?? []) {
    if (!item || !('str' in item) || !item.str) continue;
    const t = item.transform;
    if (!Array.isArray(t) || t.length < 6) continue;
    const fontH = Math.hypot(t[2], t[3]) || Math.abs(t[3]) || 12;
    glyphs.push({
      str: item.str,
      x: t[4],
      y: t[5],
      fontH,
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
    const text = bucket.map((g) => g.str).join('').replace(/\s+$/u, '');
    if (text.trim()) {
      lines.push({ text: text.normalize('NFC'), y: bucketY });
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
 * @param {{ items?: import('pdfjs-dist').TextItem[], visualText?: string, text?: string, pageNum?: number }[]} pages
 * @returns {{ pageNum: number, lines: string[] }[]}
 */
export function cleanPageLinesForTxt(pages) {
  const list = pages ?? [];
  const pageLines = list.map((page, i) => {
    const fromItems = linesFromPdfItems(page.items ?? []);
    if (fromItems.length) {
      return {
        pageNum: page.pageNum ?? i + 1,
        lines: fromItems,
      };
    }
    const fallback = String(page.visualText ?? page.text ?? '')
      .normalize('NFC')
      .split(/\n/u)
      .map((text) => text.replace(/\s+$/u, ''))
      .filter((text) => text.trim().length > 0)
      .map((text, idx, arr) => ({
        text,
        y: arr.length - idx,
      }));
    return { pageNum: page.pageNum ?? i + 1, lines: fallback };
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
    if (!page.lines.length) {
      return { pageNum: page.pageNum, lines: /** @type {string[]} */ ([]) };
    }
    const { yMin, yMax } = yExtent(page.lines);
    const kept = page.lines
      .filter((line) => {
        const key = normalizeTxtLineKey(line.text);
        if (!key) return false;
        const band = bandOf(line.y, yMin, yMax);
        if (band !== 'mid' && chromeKeys.has(key)) return false;
        if (band !== 'mid' && isLikelyPageNumberLine(key)) return false;
        return true;
      })
      .map((line) => stripGluedPageNumber(line.text.normalize('NFC')))
      .filter((text) => text.length > 0);
    return { pageNum: page.pageNum, lines: kept };
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
