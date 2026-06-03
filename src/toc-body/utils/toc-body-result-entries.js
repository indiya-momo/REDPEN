/** @typedef {import('../lib/tocBodyCheck.js').TocBodyGroup} TocBodyGroup */
/** @typedef {{ kind: 'section', label: string } | { kind: 'entry', group: TocBodyGroup }} TocBodyTabEntry */

/**
 * 목차 · 본문 일관성 전용 결과 목록 (일치 → 누락 → 불일치 예상)
 * @param {TocBodyGroup[]} tocBodyResults
 * @returns {TocBodyTabEntry[]}
 */
export function buildTocBodyTabEntries(tocBodyResults) {
  /** @type {TocBodyTabEntry[]} */
  const entries = [];
  /** @type {[string, string][]} */
  const sections = [
    ['match', '일치'],
    ['missing', '누락'],
    ['mismatch', '불일치 예상'],
  ];
  for (const [status, heading] of sections) {
    const groups = tocBodyResults.filter((g) => g.tocStatus === status);
    if (!groups.length) continue;
    entries.push({ kind: 'section', label: heading });
    for (const group of groups) {
      entries.push({ kind: 'entry', group });
    }
  }
  return entries;
}

/**
 * @param {TocBodyTabEntry[]} entries
 */
export function countTocBodyTabFindings(entries) {
  return entries.reduce((n, entry) => {
    if (entry.kind === 'section') return n;
    return n + entry.group.instances.length;
  }, 0);
}
