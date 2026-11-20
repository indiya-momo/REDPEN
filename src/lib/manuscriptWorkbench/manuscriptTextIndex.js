/**
 * 원고 본문 검색 인덱스. pageTexts만 본다.
 * @param {string} text
 * @param {number} start
 * @param {number} end
 * @param {number} [radius]
 */
function snippetAround(text, start, end, radius = 18) {
  const from = Math.max(0, start - radius);
  const to = Math.min(text.length, end + radius);
  const head = from > 0 ? '…' : '';
  const tail = to < text.length ? '…' : '';
  return `${head}${text.slice(from, to)}${tail}`.replace(/\s+/g, ' ');
}

/**
 * @param {import('../pdfService.js').PageData[]} pageTexts
 * @param {string} query
 * @param {{ maxHits?: number }} [opts]
 * @returns {import('./types.js').TextHit[]}
 */
export function searchManuscriptText(pageTexts, query, opts = {}) {
  const needle = String(query ?? '');
  if (!needle) return [];
  const maxHits = Number.isFinite(opts.maxHits) ? opts.maxHits : 200;
  /** @type {import('./types.js').TextHit[]} */
  const hits = [];

  for (const page of pageTexts ?? []) {
    const text = String(page.visualText ?? page.text ?? '');
    if (!text) continue;
    let from = 0;
    while (from < text.length && hits.length < maxHits) {
      const at = text.indexOf(needle, from);
      if (at < 0) break;
      const end = at + needle.length;
      hits.push({
        pageNum: page.pageNum,
        start: at,
        end,
        matchedText: text.slice(at, end),
        snippet: snippetAround(text, at, end),
      });
      from = at + Math.max(needle.length, 1);
    }
    if (hits.length >= maxHits) break;
  }

  return hits;
}
