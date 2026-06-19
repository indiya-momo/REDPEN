import { afterEach, describe, expect, it } from 'vitest';

/** @type {Record<string, string>} */
const localStore = {};

afterEach(() => {
  for (const key of Object.keys(localStore)) delete localStore[key];
});

function stubLocalStorage() {
  globalThis.localStorage = {
    getItem: (key) => localStore[key] ?? null,
    setItem: (key, value) => {
      localStore[key] = String(value);
    },
    removeItem: (key) => {
      delete localStore[key];
    },
  };
}
import {
  BADGE_COLLECTION_TOTAL_LABEL,
  BADGE_GRID_COLUMNS,
  BADGE_GRID_EARNABLE_IDS,
  BADGE_GRID_ROWS,
  BADGE_SHOWCASE_SLOT_IDS,
  earnBadge,
  getBadgeCollectionStats,
  getUserBadgeCollection,
  isBadgeShowcaseUid,
  syncBadgeShowcase,
} from './userBadges.js';

describe('getUserBadgeCollection', () => {
  it('5열×3행 — 지정 칸만 이름, 나머지 ???', () => {
    expect(BADGE_GRID_COLUMNS).toBe(5);
    expect(BADGE_GRID_ROWS).toEqual([
      ['slot-1', 'slot-2', 'slot-3', '???', '???'],
      ['slot-4', '???', '???', '???', '???'],
      ['slot-5', '???', '???', '???', '???'],
    ]);

    const grid = getUserBadgeCollection('');
    expect(grid).toHaveLength(15);

    expect(grid[0]?.name).toBe('초판본 수집가');
    expect(grid[1]?.name).toBe('비밀 연구원');
    expect(grid[2]?.name).toBe('수석 검증관');
    expect(grid[3]?.name).toBe('???');
    expect(grid[4]?.name).toBe('???');

    expect(grid[0]?.imageSrc).toContain('welcome/badges-trim/1-1.png');
    expect(grid[0]?.showArt).toBe(true);
    expect(grid[1]?.imageSrc).toBeUndefined();
    expect(grid[1]?.showArt).toBe(false);
    expect(grid[2]?.imageSrc).toBeUndefined();
    expect(grid[2]?.showArt).toBe(false);
    expect(grid[5]?.name).toBe('매의 눈');
    expect(grid[5]?.imageSrc).toBeUndefined();
    expect(grid[5]?.showArt).toBe(false);
    expect(grid.slice(6, 10).every((badge) => badge?.name === '???')).toBe(true);

    expect(grid[10]?.name).toBe('국전지 마스터');
    expect(grid.slice(11, 15).every((badge) => badge?.name === '???')).toBe(
      true,
    );
  });
});

describe('getBadgeCollectionStats', () => {
  it('획득 수만 집계하고 분모는 ???', () => {
    expect(BADGE_GRID_EARNABLE_IDS).toEqual([
      'slot-1',
      'slot-2',
      'slot-3',
      'slot-4',
      'slot-5',
    ]);
    expect(getBadgeCollectionStats('')).toEqual({
      earnedCount: 0,
      totalLabel: BADGE_COLLECTION_TOTAL_LABEL,
    });

    stubLocalStorage();
    earnBadge('stats-user', 'slot-2');
    earnBadge('stats-user', 'slot-4');
    expect(getBadgeCollectionStats('stats-user')).toEqual({
      earnedCount: 2,
      totalLabel: BADGE_COLLECTION_TOTAL_LABEL,
    });
  });
});

describe('badge art visibility', () => {
  it('획득한 슬롯만 1-1 외 이미지를 노출한다', () => {
    stubLocalStorage();
    earnBadge('art-user', 'slot-3');

    const grid = getUserBadgeCollection('art-user');
    expect(grid[0]?.imageSrc).toContain('welcome/badges-trim/1-1.png');
    expect(grid[2]?.imageSrc).toContain('welcome/badges-trim/1-3.png');
    expect(grid[2]?.showArt).toBe(true);
    expect(grid[1]?.imageSrc).toBeUndefined();
    expect(grid[1]?.showArt).toBe(false);
  });
});

describe('syncBadgeShowcase', () => {
  const prevUids = import.meta.env.VITE_BETA_QUOTA_ADMIN_UIDS;

  afterEach(() => {
    import.meta.env.VITE_BETA_QUOTA_ADMIN_UIDS = prevUids;
  });

  it('쇼케이스 계정에 배지 4개를 부여한다', () => {
    stubLocalStorage();
    import.meta.env.VITE_BETA_QUOTA_ADMIN_UIDS = 'showcase-uid';

    expect(isBadgeShowcaseUid('showcase-uid')).toBe(true);
    expect(syncBadgeShowcase('showcase-uid')).toBe(true);
    expect(getBadgeCollectionStats('showcase-uid')).toEqual({
      earnedCount: BADGE_SHOWCASE_SLOT_IDS.length,
      totalLabel: BADGE_COLLECTION_TOTAL_LABEL,
    });

    const grid = getUserBadgeCollection('showcase-uid');
    expect(grid[0]?.imageSrc).toContain('1-1.png');
    expect(grid[1]?.imageSrc).toContain('1-2.png');
    expect(grid[2]?.imageSrc).toContain('1-3.png');
    expect(grid[5]?.imageSrc).toContain('2-1.png');
  });
});
