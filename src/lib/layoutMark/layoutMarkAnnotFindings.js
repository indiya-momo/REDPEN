/**
 * LayoutMark → AnnotFinding (인디자인 Replace).
 * 문자 고침과 겹치면 조판 건 제외.
 */

import { composeAllLayoutMarkReplaces } from './layoutMarkReplace.js';
import { LAYOUT_MARK_LABELS, LAYOUT_MARK_SOURCE } from './layoutMarkTypes.js';

/**
 * @param {{ pageNum: number, start: number, end: number }} a
 * @param {{ pageNum: number, start: number, end: number }} b
 */
function rangesOverlap(a, b) {
  if (a.pageNum !== b.pageNum) return false;
  return a.start < b.end && b.start < a.end;
}

/**
 * @param {import('./layoutMarkTypes.js').LayoutMark[] | null | undefined} layoutMarks
 * @param {import('../pdfService.js').PageData[] | null | undefined} pageTexts
 * @returns {import('../pdfAnnotExport/collectAnnotFindings.js').AnnotFinding[]}
 */
export function layoutMarksToAnnotFindings(layoutMarks, pageTexts) {
  /** @type {Map<number, string>} */
  const textByPage = new Map();
  for (const p of pageTexts ?? []) {
    textByPage.set(Number(p.pageNum), String(p.text ?? p.visualText ?? ''));
  }

  /** @type {Map<number, import('./layoutMarkTypes.js').LayoutMark[]>} */
  const marksByPage = new Map();
  for (const m of layoutMarks ?? []) {
    if (!m || m.source !== LAYOUT_MARK_SOURCE) continue;
    if (m.kind === 'outdent') continue;
    const n = Number(m.pageNum);
    const arr = marksByPage.get(n) ?? [];
    arr.push(m);
    marksByPage.set(n, arr);
  }

  /** @type {import('../pdfAnnotExport/collectAnnotFindings.js').AnnotFinding[]} */
  const out = [];
  for (const [pageNum, marks] of marksByPage) {
    const text = textByPage.get(pageNum) ?? '';
    for (const c of composeAllLayoutMarkReplaces(marks, text)) {
      const labelBits = (c.kinds ?? [])
        .map((k) => LAYOUT_MARK_LABELS[k] ?? k)
        .join('+');
      out.push({
        pageNum: c.pageNum,
        source: 'spelling',
        style: 'strike',
        start: c.start,
        end: c.end,
        found: c.found,
        replacement: c.replacement,
        matchedText: c.found,
        label: '',
        contents: c.replacement,
        subject: labelBits ? `조판 ${labelBits}` : '조판',
        fromLayoutMark: true,
      });
    }
  }
  return out;
}

/**
 * @param {import('../pdfAnnotExport/collectAnnotFindings.js').AnnotFinding[]} layoutFindings
 * @param {import('../pdfAnnotExport/collectAnnotFindings.js').AnnotFinding[]} includedTextFindings
 * @returns {{ kept: typeof layoutFindings, excludedOverlap: number }}
 */
export function filterLayoutFindingsAgainstTextReplaces(
  layoutFindings,
  includedTextFindings,
) {
  const included = includedTextFindings ?? [];
  /** @type {typeof layoutFindings} */
  const kept = [];
  let excludedOverlap = 0;
  for (const f of layoutFindings ?? []) {
    if (included.some((k) => rangesOverlap(k, f))) {
      excludedOverlap += 1;
      continue;
    }
    kept.push(f);
  }
  return { kept, excludedOverlap };
}
