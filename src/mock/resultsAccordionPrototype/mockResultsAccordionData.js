/**
 * DEV 목업 — 검수 결과 카테고리 accordion
 * ?window=results-mock
 */

/** @typedef {{ id: string, title: string, tip: string, pages: string[] }} MockResultCard */

/** @type {MockResultCard[]} */
export const MOCK_CAUTION_CARDS = [
  {
    id: 'c1',
    title: '같이(조사 또는 부사)',
    tip: '조사는 앞말에 붙여 쓰고, 부사는 띄어 쓴다.',
    pages: ['2P 1/2', '2P 2/2', '4P 1/4', '7P 1/3'],
  },
  {
    id: 'c2',
    title: '대로',
    tip: '의존 명사는 띄어 쓰고, 조사는 붙여 쓴다.',
    pages: ['3P 1/1', '11P 1/2'],
  },
  {
    id: 'c3',
    title: '뿐',
    tip: '보조사 ‘뿐’은 앞말에 붙여 쓴다.',
    pages: ['5P 1/1', '9P 2/2', '15P 1/1'],
  },
];

export const MOCK_CATEGORIES = [
  {
    id: 'caution',
    label: '편집자 검토 필요',
    shortBadge: '편',
    criteriaCount: 20,
    findingsCount: 1181,
    defaultOpen: true,
    cards: MOCK_CAUTION_CARDS,
  },
  {
    id: 'spelling',
    label: '맞춤법 규칙',
    shortBadge: '맞',
    criteriaCount: 29,
    findingsCount: 537,
    defaultOpen: false,
    cards: [
      {
        id: 's1',
        title: '되/돼',
        tip: '‘되어’는 ‘돼’로 줄여 쓸 수 있다.',
        pages: ['1P 1/1', '8P 1/2'],
      },
    ],
  },
  {
    id: 'loanword',
    label: '외래어 표기법',
    shortBadge: '외',
    criteriaCount: 9,
    findingsCount: 33,
    defaultOpen: false,
    cards: [
      {
        id: 'l1',
        title: 'coffee → 커피',
        tip: '국립국어원 외래어 표기법 용례.',
        pages: ['12P 1/1'],
      },
    ],
  },
];

export const MOCK_TOTAL_FINDINGS = 1751;
