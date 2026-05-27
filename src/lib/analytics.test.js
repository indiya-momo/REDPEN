import { describe, expect, it } from 'vitest';
import {
  bucketFileSizeMb,
  bucketFindingCount,
  bucketPageCount,
  bucketRuleCount,
} from './analytics.js';

describe('analytics buckets', () => {
  it('bucketPageCount', () => {
    expect(bucketPageCount(30)).toBe('1-50');
    expect(bucketPageCount(200)).toBe('151-300');
    expect(bucketPageCount(400)).toBe('301+');
  });

  it('bucketFileSizeMb', () => {
    expect(bucketFileSizeMb(5 * 1024 * 1024)).toBe('0-10');
    expect(bucketFileSizeMb(45 * 1024 * 1024)).toBe('30-50');
  });

  it('bucketRuleCount and bucketFindingCount', () => {
    expect(bucketRuleCount(0)).toBe('0');
    expect(bucketRuleCount(25)).toBe('11-30');
    expect(bucketFindingCount(0)).toBe('0');
    expect(bucketFindingCount(250)).toBe('101-500');
  });
});
