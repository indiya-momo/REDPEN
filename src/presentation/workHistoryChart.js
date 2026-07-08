/**
 * 검수 진행 이력 꺾은선 그래프 — 좌표 계산(순수 함수).
 * 그리기는 ProjectWorkHistoryChart.jsx가 담당한다.
 */

export const WORK_CHART_WIDTH = 560;
export const WORK_CHART_HEIGHT = 200;
const PAD_LEFT = 44;
const PAD_RIGHT = 16;
const PAD_TOP = 14;
const PAD_BOTTOM = 30;
const MAX_X_LABELS = 6;

/** @typedef {{ x: number, y: number, value: number, date: string }} WorkChartPoint */

/** @param {string} dateKey 'YYYY-MM-DD' → 'MM.DD' */
function shortDateLabel(dateKey) {
  return dateKey.slice(5).replace('-', '.');
}

/** 눈금 최대값 — 1·2·5×10ⁿ 단위로 올림 (최소 5) */
function niceCeil(value) {
  if (value <= 5) return 5;
  const exp = Math.floor(Math.log10(value));
  const base = 10 ** exp;
  for (const mult of [1, 2, 5, 10]) {
    if (value <= mult * base) return mult * base;
  }
  return 10 * base;
}

/**
 * @param {import('../lib/projectWorkHistory.js').WorkHistoryEntry[] | undefined} history
 * @returns {{
 *   width: number,
 *   height: number,
 *   plot: { left: number, right: number, top: number, bottom: number },
 *   yMax: number,
 *   yTicks: { y: number, label: string }[],
 *   xLabels: { x: number, label: string }[],
 *   series: { key: 'spelling' | 'consistency', points: WorkChartPoint[], path: string }[],
 * } | null} 표시할 항목이 없으면 null
 */
export function buildWorkHistoryChartModel(history) {
  const entries = Array.isArray(history) ? history : [];
  if (!entries.length) return null;

  const plot = {
    left: PAD_LEFT,
    right: WORK_CHART_WIDTH - PAD_RIGHT,
    top: PAD_TOP,
    bottom: WORK_CHART_HEIGHT - PAD_BOTTOM,
  };
  const plotWidth = plot.right - plot.left;
  const plotHeight = plot.bottom - plot.top;

  const allCounts = entries.flatMap((e) =>
    [e.spelling, e.consistency].filter((v) => typeof v === 'number'),
  );
  if (!allCounts.length) return null;
  const yMax = niceCeil(Math.max(...allCounts));

  /** @param {number} index */
  const xAt = (index) =>
    entries.length === 1
      ? plot.left + plotWidth / 2
      : plot.left + (plotWidth * index) / (entries.length - 1);
  /** @param {number} value */
  const yAt = (value) => plot.bottom - (plotHeight * value) / yMax;

  /** @param {'spelling' | 'consistency'} key */
  const buildSeries = (key) => {
    /** @type {WorkChartPoint[]} */
    const points = [];
    entries.forEach((entry, index) => {
      const value = entry[key];
      if (typeof value !== 'number') return;
      points.push({
        x: Math.round(xAt(index) * 10) / 10,
        y: Math.round(yAt(value) * 10) / 10,
        value,
        date: entry.date,
      });
    });
    const path = points
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`)
      .join(' ');
    return { key, points, path };
  };

  const series = [buildSeries('spelling'), buildSeries('consistency')].filter(
    (s) => s.points.length > 0,
  );
  if (!series.length) return null;

  const yTicks = [0, yMax / 2, yMax].map((value) => ({
    y: Math.round(yAt(value) * 10) / 10,
    label: String(Number.isInteger(value) ? value : Math.round(value)),
  }));

  const labelStep = Math.max(1, Math.ceil(entries.length / MAX_X_LABELS));
  const xLabels = entries
    .map((entry, index) => ({ entry, index }))
    .filter(
      ({ index }) =>
        index % labelStep === 0 || index === entries.length - 1,
    )
    .map(({ entry, index }) => ({
      x: Math.round(xAt(index) * 10) / 10,
      label: shortDateLabel(entry.date),
    }));

  return {
    width: WORK_CHART_WIDTH,
    height: WORK_CHART_HEIGHT,
    plot,
    yMax,
    yTicks,
    xLabels,
    series,
  };
}
