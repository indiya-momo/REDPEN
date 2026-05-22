/**
 * @param {import('./pdfService.js').PageData} pageData
 * @param {number} matchStart
 * @param {number} matchEnd
 * @param {number} [maxLineGap=2.8]
 */
export function isMatchSpatiallyCoherent(pageData, matchStart, matchEnd, maxLineGap = 2.8) {
  const refs = pageData.itemRefs?.filter(
    (ref) => ref.end > matchStart && ref.start < matchEnd,
  );
  if (!refs?.length) return true;

  const ys = [];
  const heights = [];

  for (const ref of refs) {
    const item = pageData.items[ref.itemIndex];
    if (!item?.transform) continue;
    ys.push(item.transform[5]);
    heights.push(
      Math.max(Math.hypot(item.transform[2], item.transform[3]), 8),
    );
  }

  if (!ys.length) return true;

  const span = Math.max(...ys) - Math.min(...ys);
  const avgH = heights.reduce((a, b) => a + b, 0) / heights.length;
  return span <= avgH * maxLineGap;
}
