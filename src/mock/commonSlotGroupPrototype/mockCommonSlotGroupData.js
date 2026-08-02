/**
 * DEV 목업 — 공통 항목 찾기 카드 안 표기별 분류
 * ?window=common-slot-group-mock
 */

/** @typedef {{ text: string, count: number, firstPage: number, pages: string[] }} MockSlotFillRow */

/** @type {{ pattern: string, total: number, flatPages: string[], rows: MockSlotFillRow[] }} */
export const MOCK_COMMON_SLOT_CARD = {
  pattern: '@시대',
  total: 32,
  // 지금: 페이지 순으로만 나열
  flatPages: [
    '2P 1/1',
    '3P 1/3',
    '3P 2/3',
    '3P 3/3',
    '5P 1/2',
    '5P 2/2',
    '7P 1/1',
    '8P 1/2',
    '8P 2/2',
    '10P 1/1',
    '11P 1/1',
    '12P 1/1',
    '14P 1/2',
    '14P 2/2',
    '＋ 18개 더 보기',
  ],
  // 제안: 표기별 묶음 · 건수↓ · 동일 시 첫 페이지↑
  rows: [
    {
      text: '조선시대',
      count: 12,
      firstPage: 3,
      pages: ['3P 1/3', '3P 2/3', '3P 3/3', '5P 1/2', '5P 2/2', '＋ 7개 더 보기'],
    },
    {
      text: '고려시대',
      count: 8,
      firstPage: 2,
      pages: ['2P 1/1', '8P 1/2', '8P 2/2', '12P 1/1', '＋ 4개 더 보기'],
    },
    {
      text: '조선 시대',
      count: 5,
      firstPage: 7,
      pages: ['7P 1/1', '14P 1/2', '14P 2/2', '18P 1/1', '22P 1/1'],
    },
    {
      text: '신라시대',
      count: 5,
      firstPage: 10,
      pages: ['10P 1/1', '11P 1/1', '19P 1/1', '21P 1/1', '25P 1/1'],
    },
    {
      text: '통일신라시대',
      count: 2,
      firstPage: 30,
      pages: ['30P 1/1', '31P 1/1'],
    },
  ],
};
