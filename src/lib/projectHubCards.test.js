import { describe, expect, it } from 'vitest';
import {
  buildSortedProjectCards,
  projectCreatedAtMs,
} from './projectHubCards.js';

describe('projectCreatedAtMs', () => {
  it('id에 박힌 생성 시각을 쓴다', () => {
    expect(projectCreatedAtMs({ id: 'set_1783763577327_abc' })).toBe(
      1783763577327,
    );
  });

  it('id 형식이 아니면 savedAt으로 대체한다', () => {
    expect(
      projectCreatedAtMs({ id: 'legacy', savedAt: '2026-07-11T00:00:00.000Z' }),
    ).toBe(Date.parse('2026-07-11T00:00:00.000Z'));
  });

  it('id·savedAt 둘 다 없으면 0', () => {
    expect(projectCreatedAtMs({ id: 'legacy' })).toBe(0);
  });
});

describe('buildSortedProjectCards', () => {
  it('만든 순서(오래된 것 왼쪽)로 정렬한다', () => {
    const cards = buildSortedProjectCards(
      [
        { id: 'set_300_c', name: '복사2', savedAt: '2026-07-11T00:00:00.000Z' },
        { id: 'set_100_a', name: '원본', savedAt: '2026-07-11T00:00:00.000Z' },
        { id: 'set_200_b', name: '복사1', savedAt: '2026-07-11T00:00:00.000Z' },
      ],
      'set_100_a',
    );
    expect(cards.map((card) => card.id)).toEqual([
      'set_100_a',
      'set_200_b',
      'set_300_c',
    ]);
    expect(cards[0].isActive).toBe(true);
  });

  it('편집으로 savedAt이 바뀌어도 순서가 바뀌지 않는다 (회귀 방지)', () => {
    const before = buildSortedProjectCards(
      [
        { id: 'set_100_a', name: '원본', savedAt: '2026-07-11T00:00:00.000Z' },
        { id: 'set_200_b', name: '복사1', savedAt: '2026-07-11T00:00:00.000Z' },
      ],
      null,
    ).map((c) => c.id);

    // set_100_a 를 방금 저장해 savedAt 이 가장 최신이 된 상황
    const after = buildSortedProjectCards(
      [
        { id: 'set_100_a', name: '원본', savedAt: '2026-07-13T09:00:00.000Z' },
        { id: 'set_200_b', name: '복사1', savedAt: '2026-07-11T00:00:00.000Z' },
      ],
      null,
    ).map((c) => c.id);

    expect(after).toEqual(before);
    expect(after).toEqual(['set_100_a', 'set_200_b']);
  });
});
