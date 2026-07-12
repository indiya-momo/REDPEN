import { describe, expect, it } from 'vitest';
import {
  buildCriteriaCheckpoint,
  isRuleSetCriteriaDirty,
} from './criteriaCheckpoint.js';

describe('criteriaCheckpoint', () => {
  it('동일 기준이면 dirty가 아니다', () => {
    const set = {
      savedAt: '2026-07-12T00:00:00.000Z',
      builtInEnabled: { a: true },
      cautionEnabled: {},
      customRules: [{ tailWord: '그러나', enabled: true }],
      globalExcludePhrases: [],
      consistencyDecisions: [],
    };
    const withCp = {
      ...set,
      criteriaCheckpoint: buildCriteriaCheckpoint(set),
    };
    expect(isRuleSetCriteriaDirty(withCp)).toBe(false);
  });

  it('규칙이 바뀌면 dirty', () => {
    const saved = {
      savedAt: '2026-07-12T00:00:00.000Z',
      builtInEnabled: {},
      cautionEnabled: {},
      customRules: [{ tailWord: '가', enabled: true }],
      globalExcludePhrases: [],
    };
    const set = {
      ...saved,
      criteriaCheckpoint: buildCriteriaCheckpoint(saved),
      customRules: [{ tailWord: '나', enabled: true }],
    };
    expect(isRuleSetCriteriaDirty(set)).toBe(true);
  });

  it('checkpoint 없으면 dirty 아님(구 데이터)', () => {
    expect(
      isRuleSetCriteriaDirty({
        savedAt: '2026-07-12T00:00:00.000Z',
        customRules: [],
      }),
    ).toBe(false);
  });
});
