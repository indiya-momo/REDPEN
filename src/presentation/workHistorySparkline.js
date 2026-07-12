/**
 * 작업 이력 sparkline — 순수 좌표 계산.
 */

export const WORK_HISTORY_SPARKLINE_WIDTH = 168;
/** 노란 숫자 원형이 들어가도록 높이 확보 */
export const WORK_HISTORY_SPARKLINE_HEIGHT = 56;
/** 원형·선이 잘리지 않도록 상하 여백(px, viewBox 기준) */
export const WORK_HISTORY_SPARKLINE_PAD = 14;

/**
 * @param {number[]} values
 * @param {number} width
 * @param {number} height
 * @param {number} [pad]
 */
export function buildSparklinePath(
  values,
  width,
  height,
  pad = WORK_HISTORY_SPARKLINE_PAD,
) {
  const points = sparklinePoints(values, width, height, pad);
  if (!points.length) return '';
  return points
    .map((point, index) => {
      const x = point.x.toFixed(1);
      const y = point.y.toFixed(1);
      return `${index === 0 ? 'M' : 'L'}${x},${y}`;
    })
    .join(' ');
}

/**
 * 0건 = 아래, max = 위. (세션 간 상대 min-max가 아니라 절대 건수 반영)
 * @param {number[]} values
 * @param {number} width
 * @param {number} height
 * @param {number} [pad]
 */
export function sparklinePoints(
  values,
  width,
  height,
  pad = WORK_HISTORY_SPARKLINE_PAD,
) {
  if (!values.length) return [];
  const max = Math.max(...values, 1);
  const usable = Math.max(height - pad * 2, 1);
  if (values.length === 1) {
    const y = height - pad - (values[0] / max) * usable;
    return [{ x: width / 2, y, value: values[0] }];
  }
  return values.map((value, index) => {
    const x = (width * index) / (values.length - 1);
    const y = height - pad - (value / max) * usable;
    return { x, y, value };
  });
}

/**
 * @param {import('../lib/projectWorkHistory.js').WorkHistoryEntry[]} sessions
 */
export function hasSpellingSplitHistory(sessions) {
  return sessions.some((entry) => typeof entry.editorReview === 'number');
}

/**
 * @param {import('../lib/projectWorkHistory.js').WorkHistoryEntry[]} sessions
 */
export function hasConsistencyTypeHistory(sessions) {
  return sessions.some(
    (entry) =>
      typeof entry.consistencyFind === 'number' ||
      typeof entry.consistencyUnify === 'number' ||
      typeof entry.consistencyCommonString === 'number',
  );
}

/**
 * @param {import('../lib/projectWorkHistory.js').WorkHistoryEntry | undefined} entry
 */
export function latestConsistencyFindings(entry) {
  if (!entry) {
    return { find: 0, unify: 0, commonString: 0 };
  }
  if (
    typeof entry.consistencyFind === 'number' ||
    typeof entry.consistencyUnify === 'number' ||
    typeof entry.consistencyCommonString === 'number'
  ) {
    return {
      find: entry.consistencyFind ?? 0,
      unify: entry.consistencyUnify ?? 0,
      commonString: entry.consistencyCommonString ?? 0,
    };
  }
  return {
    find: entry.consistency ?? 0,
    unify: 0,
    commonString: 0,
  };
}
