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

  it('requireLeadingBoundary=true면 앞글자 붙은 오탐을 제외', () => {
    const pages = [{ pageNum: 1, text: '문장이 쳐지는 경우와 펼쳐지다 예시' }];
    const rules = [
      {
        find: '쳐지',
        replace: '처지',
        enabled: true,
        requireLeadingBoundary: true,
      },
    ];
    const { results, errors } = runRuleCheck(pages, rules);
    expect(errors).toEqual([]);
    const hits = results.flatMap((g) => g.instances.map((i) => i.matchedText));
    expect(hits).toContain('쳐지');
    expect(hits.length).toBe(1);
  });
});
