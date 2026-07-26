/**
 * DEV 목업 — 표기 통일 결과 flat 리스트 (통일형 우선·흰 카드)
 * ?window=consistency-results-mock
 */

/** @typedef {'unify' | 'literal' | 'common' | 'auxiliary'} ConsistencyResultKind */

/** @typedef {{
 *   id: string,
 *   kind: ConsistencyResultKind,
 *   badge: string,
 *   label: string,
 *   findings: number,
 *   pages: string[],
 *   emphasize?: boolean,
 * }} MockConsistencyResultCard */

/** @type {MockConsistencyResultCard[]} */
export const MOCK_CONSISTENCY_RESULT_CARDS = [
  {
    id: 'u1',
    kind: 'unify',
    badge: '표기 통일하기',
    label: '붉은표시 → 붉은 표시',
    findings: 14,
    pages: ['3P 1/2', '3P 2/2', '12P 1/1', '18P 1/3'],
    emphasize: true,
  },
  {
    id: 'u2',
    kind: 'unify',
    badge: '표기 통일하기',
    label: '세계경제 → 세계˅경제',
    findings: 7,
    pages: ['5P 1/1', '9P 2/2'],
    emphasize: true,
  },
  {
    id: 'u3',
    kind: 'unify',
    badge: '표기 통일하기',
    label: '인터넷망 → 인터넷˅망',
    findings: 4,
    pages: ['22P 1/1'],
    emphasize: true,
  },
  {
    id: 'l1',
    kind: 'literal',
    badge: '여러 항목 찾기',
    label: '바하',
    findings: 11,
    pages: ['2P 1/1', '8P 1/2', '8P 2/2', '14P 1/1'],
  },
  {
    id: 'l2',
    kind: 'literal',
    badge: '여러 항목 찾기',
    label: '되/돼',
    findings: 6,
    pages: ['1P 1/1', '6P 1/1'],
  },
  {
    id: 'c1',
    kind: 'common',
    badge: '공통 항목 찾기',
    label: '@정부',
    findings: 9,
    pages: ['4P 1/3', '4P 2/3', '4P 3/3', '11P 1/1', '＋ 2개 더 보기'],
  },
  {
    id: 'a1',
    kind: 'auxiliary',
    badge: '본용언+보조용언',
    label: '가다 + 보다',
    findings: 5,
    pages: ['7P 1/1', '16P 1/2'],
  },
  {
    id: 'a2',
    kind: 'auxiliary',
    badge: '본용언+보조용언',
    label: '하다 + 버리다',
    findings: 3,
    pages: ['10P 1/1'],
  },
];

export const MOCK_CONSISTENCY_TOTAL_FINDINGS =
  MOCK_CONSISTENCY_RESULT_CARDS.reduce((sum, c) => sum + c.findings, 0);
