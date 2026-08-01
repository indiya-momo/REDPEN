/**
 * restored(복원 줄) 오프셋 → page.text(visual) 오프셋 어댑터.
 * soft-wrap `absIndex` + layout→visual 투영을 한곳에서 호출.
 *
 * 순환 import 방지: mapLayoutIndexToVisualIndex는 인자로 받거나 지연 import.
 */

/**
 * @param {{ itemRefs?: unknown[], itemRefsLayout?: unknown[] }} page
 * @param {number} restoredOffset — restoredLine 기준 코드유닛 오프셋
 * @param {{
 *   absIndex?: (i: number) => number,
 *   mapLayoutToVisual?: (page: unknown, layoutIndex: number) => number,
 * }} [bridge]
 * @returns {number} visual(page.text) 인덱스
 */
export function mapRestoredToVisual(page, restoredOffset, bridge = {}) {
  const raw = Math.max(0, Number(restoredOffset) || 0);
  const layoutOrPage =
    typeof bridge.absIndex === 'function' ? bridge.absIndex(raw) : raw;

  if (typeof bridge.mapLayoutToVisual === 'function') {
    return bridge.mapLayoutToVisual(page, layoutOrPage);
  }

  // 기본: layout refs 없으면 그대로 (호출측이 bridge를 주는 것이 정석)
  return layoutOrPage;
}
