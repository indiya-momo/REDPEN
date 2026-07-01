import { describe, expect, it } from 'vitest';
import {
  listSpellingCriteriaEntries,
  planSpellingCriteriaToggle,
} from './projectHubSpellingCriteria.js';

describe('projectHubSpellingCriteria', () => {
  it('맞춤법 built-in·caution 항목 전체를 나열한다', () => {
    const entries = listSpellingCriteriaEntries({
      id: 'test',
      customRules: [],
    });
    expect(entries.length).toBeGreaterThan(50);
    expect(entries.some((row) => row.kind === 'built-in')).toBe(true);
    expect(entries.some((row) => row.kind === 'caution')).toBe(true);
  });

  it('built-in 토글은 builtInEnabled 패치로 반영한다', () => {
    const ruleSet = {
      id: 'test',
      customRules: [],
      builtInEnabled: {},
      cautionEnabled: {},
    };
    const row = listSpellingCriteriaEntries(ruleSet).find(
      (entry) => entry.kind === 'built-in',
    );
    expect(row).toBeTruthy();
    const plan = planSpellingCriteriaToggle(ruleSet, row, true);
    expect(plan.ok).toBe(true);
    expect(plan.patch.builtInEnabled?.[row.ruleKey]).toBe(true);
  });
});
