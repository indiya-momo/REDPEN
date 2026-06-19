import { afterEach, describe, expect, it } from 'vitest';
import {
  ATTENDANCE_BADGE_DAYS,
  daysSinceJoin,
  grantBadgeIfNew,
  syncAttendanceBadge,
} from './badgeGrants.js';

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

describe('daysSinceJoin', () => {
  it('가입 당일은 1일', () => {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    expect(daysSinceJoin(today.getTime())).toBe(1);
  });
});

describe('syncAttendanceBadge', () => {
  it('16일 미만이면 지급하지 않는다', () => {
    stubLocalStorage();
    expect(syncAttendanceBadge('u1', ATTENDANCE_BADGE_DAYS - 1)).toBe(false);
  });

  it('16일 이상이면 slot-5를 지급한다', () => {
    stubLocalStorage();
    expect(syncAttendanceBadge('u1', ATTENDANCE_BADGE_DAYS)).toBe(true);
    expect(grantBadgeIfNew('u1', 'slot-5')).toBe(false);
  });
});
