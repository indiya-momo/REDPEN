/**
 * DEV 목업 — 작업 이력 탭 (맞춤법 2행 · 표기 통일 칩 · 본·보조 sparkline).
 * URL: http://127.0.0.1:5173/?window=work-history-mock
 */

/** @typedef {{
 *   find: number,
 *   unify: number,
 *   commonString: number,
 * }} MockConsistencyFindings */

/** @typedef {{
 *   editorReview: number,
 *   spelling: number,
 *   consistency: number,
 *   consistencyByType: MockConsistencyFindings,
 *   bonBojo: number,
 * }} MockSession */

/** @type {MockSession[]} */
export const MOCK_WORK_HISTORY_SESSIONS = [
  {
    editorReview: 18,
    spelling: 444,
    consistency: 68,
    consistencyByType: { find: 48, unify: 15, commonString: 5 },
    bonBojo: 14,
  },
  {
    editorReview: 14,
    spelling: 416,
    consistency: 58,
    consistencyByType: { find: 40, unify: 14, commonString: 4 },
    bonBojo: 11,
  },
  {
    editorReview: 12,
    spelling: 396,
    consistency: 54,
    consistencyByType: { find: 38, unify: 12, commonString: 4 },
    bonBojo: 9,
  },
];

/** @type {MockSession[]} */
export const MOCK_WORK_HISTORY_TWO_SESSIONS = [
  {
    editorReview: 14,
    spelling: 416,
    consistency: 58,
    consistencyByType: { find: 40, unify: 14, commonString: 4 },
    bonBojo: 11,
  },
  {
    editorReview: 12,
    spelling: 396,
    consistency: 54,
    consistencyByType: { find: 38, unify: 12, commonString: 4 },
    bonBojo: 9,
  },
];

/** @type {MockSession[]} */
export const MOCK_WORK_HISTORY_ONE_SESSION = [
  {
    editorReview: 12,
    spelling: 396,
    consistency: 54,
    consistencyByType: { find: 38, unify: 12, commonString: 4 },
    bonBojo: 9,
  },
];

/** @type {string[]} */
export const MOCK_CONSISTENCY_FIND = ['마한', '진한', '변한', '신라시대'];

/** @typedef {{ variants: string[], pinned: string }} MockUnifyEntry */

/** @type {MockUnifyEntry[]} */
export const MOCK_CONSISTENCY_UNIFY = [
  { variants: ['스트리트', 'STREET'], pinned: '스트릿' },
  { variants: ['COVID', 'Covid-19'], pinned: '코로나19' },
];

/** @type {string[]} */
export const MOCK_CONSISTENCY_COMMON_STRING = ['@시대'];

/** @type {string[]} */
export const MOCK_CONSISTENCY_EXCLUDE = ['소녀시대'];

/** @type {{ id: 'find' | 'unify' | 'commonString' | 'exclude', label: string }[]} */
export const MOCK_CONSISTENCY_GROUPS = [
  { id: 'find', label: '여러 개 찾기' },
  { id: 'unify', label: '통일형 만들기' },
  { id: 'commonString', label: '공통 항목 찾기' },
  { id: 'exclude', label: '검수 제외 항목' },
];

/** @type {{
 *   find: string[],
 *   unify: MockUnifyEntry[],
 *   commonString: string[],
 *   exclude: string[],
 * }} */
export const MOCK_CONSISTENCY_BY_GROUP = {
  find: MOCK_CONSISTENCY_FIND,
  unify: MOCK_CONSISTENCY_UNIFY,
  commonString: MOCK_CONSISTENCY_COMMON_STRING,
  exclude: MOCK_CONSISTENCY_EXCLUDE,
};

/** @type {{ key: 'editorReview' | 'spelling' | 'bonBojo', label: string, subLabel?: boolean }[]} */
export const MOCK_SPARKLINE_ROWS = [
  { key: 'editorReview', label: '편집자 검토', subLabel: true },
  { key: 'spelling', label: '맞춤법', subLabel: true },
  { key: 'bonBojo', label: '본·보조' },
];

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
