import { describe, expect, it } from 'vitest';
import { buildSortedProjectCards } from './projectHubCards.js';

describe('buildSortedProjectCards', () => {
  it('savedAt 내림차순으로 카드 VM을 만든다', () => {
    const cards = buildSortedProjectCards(
      [
        { id: 'old', name: '구', savedAt: '2026-01-01T00:00:00.000Z' },
        { id: 'new', name: '신', savedAt: '2026-06-20T00:00:00.000Z' },
      ],
      'new',
    );
    expect(cards.map((card) => card.id)).toEqual(['new', 'old']);
    expect(cards[0].isActive).toBe(true);
    expect(cards[1].isActive).toBe(false);
  });
});
