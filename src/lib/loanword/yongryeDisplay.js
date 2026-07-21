/**
 * 용례 공식 등재 결과 — 같은 한글 표기끼리 묶어 표시용으로 만든다.
 */

/**
 * @param {string | undefined} guk 국명
 * @param {string | undefined} lang 언어명
 * @returns {string}
 */
export function formatYongryeLocale(guk, lang) {
  const parts = [guk, lang]
    .map((v) => String(v ?? '').trim())
    .filter(Boolean);
  return parts.join(' / ');
}

/**
 * @param {{ m?: string, guk?: string, lang?: string }} line
 * @returns {string}
 */
export function formatYongryeMeaningLine(line) {
  const meaning = String(line?.m ?? '').trim();
  const locale = formatYongryeLocale(line?.guk, line?.lang);
  if (!meaning && !locale) return '';
  if (!locale) return `-${meaning}`;
  if (!meaning) return `-${locale}`;
  return `-${meaning}, ${locale}`;
}

/**
 * 같은 표기를 한 카드로 묶는다 (동명이인 → 1장 + 의미 목록).
 * @param {Array<{
 *   h: string,
 *   c?: string,
 *   m?: string,
 *   a?: string[],
 *   o?: string[],
 *   src?: string,
 *   guk?: string,
 *   lang?: string,
 * }>} entries
 * @returns {Array<{
 *   h: string,
 *   cats: string[],
 *   lines: Array<{ m: string, guk?: string, lang?: string, c?: string }>,
 *   alts: string[],
 *   typos: string[],
 *   srcs: string[],
 *   count: number,
 * }>}
 */
export function groupOfficialYongrye(entries) {
  /** @type {ReturnType<typeof groupOfficialYongrye>} */
  const grouped = [];
  for (const entry of entries ?? []) {
    const h = String(entry?.h ?? '').trim();
    if (!h) continue;
    let g = grouped.find((x) => x.h === h);
    if (!g) {
      g = {
        h,
        cats: [],
        lines: [],
        alts: [],
        typos: [],
        srcs: [],
        count: 0,
      };
      grouped.push(g);
    }
    g.count += 1;
    if (entry.c && !g.cats.includes(entry.c)) g.cats.push(entry.c);
    const meaning = String(entry.m ?? '').trim();
    const guk = String(entry.guk ?? '').trim();
    const lang = String(entry.lang ?? '').trim();
    if (meaning || guk || lang) {
      g.lines.push({
        m: meaning,
        ...(guk ? { guk } : {}),
        ...(lang ? { lang } : {}),
        ...(entry.c ? { c: entry.c } : {}),
      });
    }
    for (const alt of entry.a ?? []) {
      if (alt && !g.alts.includes(alt)) g.alts.push(alt);
    }
    for (const typo of entry.o ?? []) {
      if (typo && !g.typos.includes(typo)) g.typos.push(typo);
    }
    if (entry.src && !g.srcs.includes(entry.src)) g.srcs.push(entry.src);
  }
  return grouped;
}
