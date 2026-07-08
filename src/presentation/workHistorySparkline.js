/**
 * 작업 이력 sparkline — 순수 좌표 계산.
 */

export const WORK_HISTORY_SPARKLINE_WIDTH = 168;
export const WORK_HISTORY_SPARKLINE_HEIGHT = 32;

/**
 * @param {number[]} values
 * @param {number} width
 * @param {number} height
 */
export function buildSparklinePath(values, width, height) {
  if (!values.length) return '';
  if (values.length === 1) {
    const x = width / 2;
    const y = height / 2;
    return `M${x},${y}`;
  }
  const max = Math.max(...values, 1);
  const min = Math.min(...values);
  const range = max - min || max || 1;
  return values
    .map((value, index) => {
      const x = (width * index) / (values.length - 1);
      const normalized = (value - min) / range;
      const y = height - normalized * (height - 8) - 4;
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

/**
 * @param {number[]} values
 * @param {number} width
 * @param {number} height
 */
export function sparklinePoints(values, width, height) {
  if (!values.length) return [];
  if (values.length === 1) {
    return [{ x: width / 2, y: height / 2, value: values[0] }];
  }
  const max = Math.max(...values, 1);
  const min = Math.min(...values);
  const range = max - min || max || 1;
  return values.map((value, index) => {
    const x = (width * index) / (values.length - 1);
    const normalized = (value - min) / range;
    const y = height - normalized * (height - 8) - 4;
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
