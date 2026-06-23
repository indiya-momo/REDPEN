/** @typedef {{ id: string, label: string, pinned: boolean }} ConsistencyFindTerm */

/** @typedef {{ id: string, unified: string, correction: string }} ConsistencyUnifyMapping */

/** @type {ConsistencyFindTerm[]} */
export const MOCK_FIND_TERMS = [
  { id: 't1', label: '붉은 표시', pinned: true },
  { id: 't2', label: '붉은표시', pinned: true },
  { id: 't3', label: '빨간표시', pinned: true },
];

/** @type {ConsistencyUnifyMapping[]} */
export const MOCK_UNIFY_MAPPINGS = [
  { id: 'm1', unified: '붉은 표시', correction: '붉은표시' },
  { id: 'm2', unified: '붉은 표시', correction: '빨간표시' },
];

/** @type {string[]} */
export const MOCK_PHRASE_SLOTS = ['@시대'];

/** @type {string[]} */
export const MOCK_EXCLUDE_PHRASES = ['소녀시대'];
