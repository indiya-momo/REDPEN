import { describe, expect, it } from 'vitest';
import { buildCompoundFindRules } from './compoundFindPattern.js';
import { runRuleCheck, runRuleCheckAsync } from './ruleEngine.js';

describe('ruleEngine', () => {
  it('runRuleCheckAsync는 동기 runRuleCheck와 같은 결과', async () => {
    const pages = [
      { pageNum: 1, text: '조선시대입니다.' },
      { pageNum: 2, text: '고려 시대와 조선시대' },
    ];
    const rules = buildCompoundFindRules('조선시대');
    const sync = runRuleCheck(pages, rules);
    const asyncResult = await runRuleCheckAsync(pages, rules, {
      pagesPerChunk: 1,
    });
    expect(asyncResult.errors).toEqual(sync.errors);
    expect(asyncResult.results.length).toBe(sync.results.length);
    const syncFindings = sync.results.reduce(
      (n, g) => n + g.instances.length,
      0,
    );
    const asyncFindings = asyncResult.results.reduce(
      (n, g) => n + g.instances.length,
      0,
    );
    expect(asyncFindings).toBe(syncFindings);
  });
});
