import { describe, expect, it } from 'vitest';
import { isPaidPlan, normalizeUserPlan } from './userPlan.js';

describe('userPlan', () => {
  it('normalizeUserPlan: paid만 paid, 나머지 free', () => {
    expect(normalizeUserPlan('paid')).toBe('paid');
    expect(normalizeUserPlan('free')).toBe('free');
    expect(normalizeUserPlan(undefined)).toBe('free');
    expect(normalizeUserPlan(null)).toBe('free');
    expect(normalizeUserPlan('pro')).toBe('free');
  });

  it('isPaidPlan', () => {
    expect(isPaidPlan({ plan: 'paid' })).toBe(true);
    expect(isPaidPlan({ plan: 'free' })).toBe(false);
    expect(isPaidPlan({})).toBe(false);
    expect(isPaidPlan(null)).toBe(false);
  });
});
