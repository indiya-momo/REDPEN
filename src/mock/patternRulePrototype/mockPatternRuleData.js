/**
 * DEV 목업 — patternRule 적용 위치 1·2안
 * ?window=pattern-rule-mock
 */

/** @type {{ from: string, to: string, count: number, pages: string[] }[]} */
export const MOCK_PATTERN_MISMATCHES = [
  {
    from: '캐나다 정부',
    to: '캐나다정부',
    count: 4,
    pages: ['88P', '120P', '156P', '210P'],
  },
  {
    from: '일본 정부',
    to: '일본정부',
    count: 3,
    pages: ['44P', '91P', '188P'],
  },
  {
    from: '영국 정부',
    to: '영국정부',
    count: 2,
    pages: ['67P', '203P'],
  },
];

export const MOCK_PATTERN_RULE = {
  template: '@정부',
  directionLabel: '붙임',
  confirmedFrom: '미국정부',
};
