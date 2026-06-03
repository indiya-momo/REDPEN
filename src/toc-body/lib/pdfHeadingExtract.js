/** @typedef {{
 *   id: string,
 *   pageNum: number,
 *   text: string,
 *   startIndex: number,
 *   fontSize: number,
 * }} PdfHeadingLine */

const HEADING_SIZE_RATIO = 1.28;
const HEADING_MIN_PT_ABOVE_BODY = 2;
const MIN_HEADING_CHARS = 2;
const MAX_HEADING_CHARS = 140;
const MAX_HEADINGS_PER_PAGE = 2;
const MERGE_X_TOLERANCE = 28;

/** 장·PART·CHAPTER 등 본문 제목에 가까운 줄만 (캡션·머리말 과다 추출 방지) */
const TITLE_LINE_PATTERN =
  /^(?:PART|CHAPTER|제\s*\d+\s*장|제\s*\d+\s*절|\d+\s*장|\d+\s*절|Ⅰ|Ⅱ|Ⅲ|Ⅳ|Ⅴ|Ⅵ|Ⅶ|Ⅷ|Ⅸ|Ⅹ|I{1,3}V?X?)\b|^[가-힣A-Za-z0-9][^.]{0,78}$/iu;

/**
 * @param {import('../../lib/pdfService.js').PageData['items'][number]} item
 */
export function getTextItemFontSize(item) {
  const t = item.transform;
  if (!t) return 10;
  return Math.max(
    Math.abs(t[0] ?? 0),
    Math.abs(t[3] ?? 0),
    Math.hypot(t[2] ?? 0, t[3] ?? 0),
  );
}

/**
 * @param {import('../../lib/pdfService.js').PageData} page
 */
export function buildPhysicalLines(page) {
  const items = (page.items ?? []).filter((it) => 'str' in it && it.str);
  /** @type {{ y: number, entries: { item: typeof items[number], itemIndex: number }[] }[]} */
  const lines = [];

  items.forEach((item, itemIndex) => {
    const y = item.transform?.[5] ?? 0;
    const lineH =
      Math.max(
        Math.hypot(item.transform?.[2] ?? 0, item.transform?.[3] ?? 0),
        8,
      ) * 0.55;
    let line = lines.find((l) => Math.abs(l.y - y) <= lineH);
    if (!line) {
      line = { y, entries: [] };
      lines.push(line);
    }
    line.entries.push({ item, itemIndex });
  });

  lines.sort((a, b) => b.y - a.y);

  /** @type {{
   *   pageNum: number,
   *   text: string,
   *   startIndex: number,
   *   maxFontSize: number,
   *   minX: number,
   *   y: number,
   * }[]} */
  const built = [];
  for (const line of lines) {
    line.entries.sort(
      (a, b) => (a.item.transform?.[4] ?? 0) - (b.item.transform?.[4] ?? 0),
    );
    let lineText = '';
    let maxFontSize = 0;
    let minX = Infinity;
    let startIndex = Infinity;
    for (const { item, itemIndex } of line.entries) {
      lineText += item.str;
      maxFontSize = Math.max(maxFontSize, getTextItemFontSize(item));
      minX = Math.min(minX, item.transform?.[4] ?? 0);
      const ref = page.itemRefs?.find((r) => r.itemIndex === itemIndex);
      if (ref) startIndex = Math.min(startIndex, ref.start);
    }
    const trimmed = lineText.trim();
    if (!trimmed) continue;
    const at = Number.isFinite(startIndex) ? startIndex : 0;
    built.push({
      pageNum: page.pageNum,
      text: trimmed,
      startIndex: at,
      maxFontSize,
      minX: Number.isFinite(minX) ? minX : 0,
      y: line.y,
    });
  }

  return built;
}

/**
 * 문서 전체 본문 포인트 — 하위 25% 분위(제목·캡션에 끌려 올라가지 않게)
 * @param {{ maxFontSize: number }[]} lines
 */
function estimateBodyFontSize(lines) {
  const sizes = lines
    .map((l) => l.maxFontSize)
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);
  if (!sizes.length) return 10;
  const idx = Math.floor(sizes.length * 0.25);
  return sizes[Math.min(idx, sizes.length - 1)];
}

/**
 * @param {string} text
 */
function isPlausibleHeadingText(text) {
  const t = text.trim();
  if (t.length < MIN_HEADING_CHARS || t.length > MAX_HEADING_CHARS) {
    return false;
  }
  if (/^\d{1,4}$/.test(t)) return false;
  if (/^\.{2,}$/.test(t)) return false;
  if (/^[,.;:!?…·•]+$/.test(t)) return false;
  if (!TITLE_LINE_PATTERN.test(t)) return false;
  return true;
}

/**
 * @param {number} fontSize
 * @param {number} bodyFontSize
 */
function passesHeadingSizeThreshold(fontSize, bodyFontSize) {
  return (
    fontSize >= bodyFontSize * HEADING_SIZE_RATIO &&
    fontSize >= bodyFontSize + HEADING_MIN_PT_ABOVE_BODY
  );
}

/**
 * @param {typeof buildPhysicalLines extends (...args: any) => infer R ? R[number][] : never} lines
 * @param {number} bodyFontSize
 */
function mergeMultilineHeadings(lines, bodyFontSize) {
  if (!lines.length) return [];
  const lineGap = Math.max(bodyFontSize * 2.5, 20);
  /** @type {typeof lines} */
  const merged = [];
  let block = { ...lines[0], text: lines[0].text };

  for (let i = 1; i < lines.length; i++) {
    const prev = lines[i - 1];
    const cur = lines[i];
    const samePage = cur.pageNum === block.pageNum;
    const yClose = Math.abs(prev.y - cur.y) <= lineGap;
    const xClose = Math.abs(cur.minX - block.minX) <= MERGE_X_TOLERANCE;
    const combinedLen = block.text.length + 1 + cur.text.length;
    if (samePage && yClose && xClose && combinedLen <= MAX_HEADING_CHARS) {
      block = {
        ...block,
        text: `${block.text} ${cur.text}`.replace(/\s+/g, ' ').trim(),
        maxFontSize: Math.max(block.maxFontSize, cur.maxFontSize),
        y: block.y,
      };
      continue;
    }
    merged.push(block);
    block = { ...cur };
  }
  merged.push(block);
  return merged;
}

/**
 * PDF 본문에서 제목 후보 줄 추출 (엄격 — 페이지당 최대 2줄, 장 제목 패턴)
 * @param {import('../../lib/pdfService.js').PageData[]} pages
 * @returns {PdfHeadingLine[]}
 */
export function extractPdfHeadingLines(pages) {
  const physical = pages.flatMap((p) => buildPhysicalLines(p));
  if (!physical.length) return [];

  const bodyFontSize = estimateBodyFontSize(physical);

  /** @type {typeof physical} */
  const perPage = new Map();
  for (const line of physical) {
    if (!passesHeadingSizeThreshold(line.maxFontSize, bodyFontSize)) continue;
    if (!isPlausibleHeadingText(line.text)) continue;
    const list = perPage.get(line.pageNum) ?? [];
    list.push(line);
    perPage.set(line.pageNum, list);
  }

  /** @type {PdfHeadingLine[]} */
  const out = [];
  for (const pageNum of [...perPage.keys()].sort((a, b) => a - b)) {
    const raw = perPage.get(pageNum) ?? [];
    raw.sort((a, b) => b.maxFontSize - a.maxFontSize || b.y - a.y);
    const merged = mergeMultilineHeadings(raw.slice(0, 4), bodyFontSize);
    for (const row of merged.slice(0, MAX_HEADINGS_PER_PAGE)) {
      out.push({
        id: `${pageNum}:${row.startIndex}`,
        pageNum,
        text: row.text,
        startIndex: row.startIndex,
        fontSize: row.maxFontSize,
      });
    }
  }
  return out;
}

/**
 * @param {import('../../lib/pdfService.js').PageData} page
 * @param {number} index
 */
/**
 * @param {import('../../lib/pdfService.js').TextItemRef[]} refs
 * @param {number} index
 */
export function findRefForTextIndex(refs, index) {
  const direct = refs.find((r) => index >= r.start && index < r.end);
  if (direct) return direct;

  const after = refs.find((r) => r.start > index);
  const before = [...refs].reverse().find((r) => r.end <= index);
  if (before && after && after.start - before.end <= 6) {
    return index - before.end <= after.start - index ? before : after;
  }
  return before ?? after ?? null;
}

export function getLineContextAtTextIndex(page, index) {
  const refs = page.itemRefs ?? [];
  const items = page.items ?? [];
  if (!refs.length || !items.length) return null;

  const hit = findRefForTextIndex(refs, index);
  if (!hit) return null;

  const anchor = items[hit.itemIndex];
  const y = anchor?.transform?.[5] ?? 0;
  const lineH =
    Math.max(
      Math.hypot(anchor?.transform?.[2] ?? 0, anchor?.transform?.[3] ?? 0),
      8,
    ) * 0.55;

  /** @type {typeof refs} */
  let onLine = refs.filter((r) => {
    const it = items[r.itemIndex];
    if (!it) return false;
    const iy = it.transform?.[5] ?? 0;
    return Math.abs(iy - y) <= lineH;
  });
  if (!onLine.length) return null;

  const ySlack = lineH * 2.2;
  let minX = Infinity;
  let maxX = -Infinity;
  for (const r of onLine) {
    const it = items[r.itemIndex];
    if (!it?.transform) continue;
    const x0 = it.transform[4] ?? 0;
    const fs = getTextItemFontSize(it);
    const w = (it.width ?? 0) > 0 ? it.width : fs * (it.str?.length ?? 1) * 0.5;
    minX = Math.min(minX, x0);
    maxX = Math.max(maxX, x0 + w);
  }
  if (Number.isFinite(minX)) {
    const expanded = refs.filter((r) => {
      if (onLine.includes(r)) return false;
      const it = items[r.itemIndex];
      if (!it?.transform) return false;
      const iy = it.transform[5] ?? 0;
      if (Math.abs(iy - y) > ySlack) return false;
      const x0 = it.transform[4] ?? 0;
      const fs = getTextItemFontSize(it);
      const w = (it.width ?? 0) > 0 ? it.width : fs * (it.str?.length ?? 1) * 0.5;
      const x1 = x0 + w;
      return x1 >= minX - 24 && x0 <= maxX + 24;
    });
    if (expanded.length) onLine = [...onLine, ...expanded];
  }

  const lineStart = Math.min(...onLine.map((r) => r.start));
  const lineEnd = Math.max(...onLine.map((r) => r.end));
  let maxFont = 0;
  for (const r of onLine) {
    const it = items[r.itemIndex];
    if (it) maxFont = Math.max(maxFont, getTextItemFontSize(it));
  }

  return {
    lineStart,
    lineEnd,
    lineText: (page.text ?? '').slice(lineStart, lineEnd).replace(/\s+/g, ' ').trim(),
    maxFont,
    y,
  };
}

/**
 * @param {import('../../lib/pdfService.js').PageData} page
 */
function estimateBodyFontFromPage(page) {
  const sizes = (page.items ?? [])
    .map((it) => getTextItemFontSize(it))
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);
  if (!sizes.length) return 10;
  const idx = Math.floor(sizes.length * 0.25);
  return sizes[Math.min(idx, sizes.length - 1)];
}

/**
 * @param {string} lineText
 * @param {string} matchedText
 */
export function isStandaloneTitleOnLine(lineText, matchedText) {
  const line = lineText.replace(/\s+/g, ' ').trim();
  const m = matchedText.replace(/\s+/g, ' ').trim();
  if (!line || !m) return false;
  if (line === m) return true;
  if (!line.startsWith(m)) return false;
  const rest = line.slice(m.length).trim();
  if (!rest) return true;
  return rest.length <= 3 && /^[.:：)·\s]*$/u.test(rest);
}

/**
 * 같은 문자열이 소제목 줄·본문 첫 문장에 둘 다 있을 때 큰 글씨·단독 줄을 우선
 * @param {import('../../lib/pdfService.js').PageData[]} pages
 * @param {RegExp} re
 * @param {number} [maxCount]
 * @returns {import('../../lib/ruleEngine.js').MatchInstance[]}
 */
/**
 * @param {{
 *   inst: import('../../lib/ruleEngine.js').MatchInstance,
 *   standalone: boolean,
 *   ratio: number,
 *   y: number,
 * }[]} candidates
 */
function sortTitleLineCandidates(candidates) {
  candidates.sort((a, b) => {
    if (a.standalone !== b.standalone) return a.standalone ? -1 : 1;
    if (b.ratio !== a.ratio) return b.ratio - a.ratio;
    if (b.y !== a.y) return b.y - a.y;
    return a.inst.index - b.inst.index;
  });
}

/**
 * @param {import('../../lib/pdfService.js').PageData[]} pages
 * @param {RegExp} re
 */
export function collectTitleLineCandidates(pages, re) {
  /** @type {{
   *   inst: import('../../lib/ruleEngine.js').MatchInstance,
   *   standalone: boolean,
   *   ratio: number,
   *   y: number,
   * }[]} */
  const candidates = [];

  for (const page of pages) {
    if (!page.itemRefs?.length) continue;
    const bodyFont = estimateBodyFontFromPage(page);
    const lines = buildPhysicalLines(page);

    for (const line of lines) {
      const regex = new RegExp(re.source, re.flags);
      let match;
      while ((match = regex.exec(line.text)) !== null) {
        if (!match[0]) {
          regex.lastIndex += 1;
          continue;
        }
        const ratio = line.maxFontSize / Math.max(bodyFont, 1);
        candidates.push({
          inst: {
            find: `toc-body:${match[0]}`,
            replace: match[0],
            matchedText: match[0],
            suggestedText: match[0],
            pageNum: page.pageNum,
            index: line.startIndex + match.index,
          },
          standalone: isStandaloneTitleOnLine(line.text, match[0]),
          ratio,
          y: line.y,
        });
      }
    }
  }

  sortTitleLineCandidates(candidates);
  return candidates;
}

/**
 * 같은 문자열이 소제목 줄·본문 첫 문장에 둘 다 있을 때 큰 글씨·단독 줄을 우선 (펼침면 전체 비교)
 * @param {import('../../lib/pdfService.js').PageData[]} pages
 * @param {RegExp} re
 * @param {number} [maxCount]
 * @returns {import('../../lib/ruleEngine.js').MatchInstance[]}
 */
export function findTitleInstancesPreferProminentLine(pages, re, maxCount = 1) {
  const limit = Math.max(1, maxCount);
  const ranked = collectTitleLineCandidates(pages, re);
  return ranked.slice(0, limit).map((row) => row.inst);
}
