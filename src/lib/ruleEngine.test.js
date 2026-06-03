import { describe, expect, it } from 'vitest';
import { buildAuxiliaryVerbFindRules } from './auxiliaryVerbPattern.js';
import { buildCompoundFindRules } from './compoundFindPattern.js';
import { buildPageText } from './pdfService.js';
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

  it('auxiliary-verb — 주택·지급은 어 주·어 지 오탐 없음', () => {
    const rules = [
      ...buildAuxiliaryVerbFindRules('어 주'),
      ...buildAuxiliaryVerbFindRules('어 지'),
    ];
    const page = {
      pageNum: 1,
      text: '묶어 주택담보증권 내어 지급하는 먹어 주고 늦어 지는',
      items: [],
      itemRefs: [],
    };
    const { results } = runRuleCheck([page], rules);
    const hits = results.flatMap((g) => g.instances.map((i) => i.matchedText));
    expect(hits.some((h) => /주택/.test(h))).toBe(false);
    expect(hits.some((h) => /지급/.test(h))).toBe(false);
    expect(hits.some((h) => /먹어\s+주/.test(h))).toBe(true);
    expect(hits.some((h) => /지는/.test(h))).toBe(true);
  });

  it('auxiliary-verb — textLayout에서 음절 가짜 공백(통해 보) 오탐 없음', () => {
    const items = [
      { str: '통해', transform: [10, 0, 0, 10, 0, 100], width: 22 },
      { str: '보장', transform: [10, 0, 0, 10, 22.6, 100], width: 22 },
    ];
    const { text, textLayout, itemRefs, itemRefsLayout } = buildPageText(items);
    const rules = buildAuxiliaryVerbFindRules('해 보');
    const page = {
      pageNum: 1,
      text,
      textLayout,
      items,
      itemRefs,
      itemRefsLayout,
    };
    const { results } = runRuleCheck([page], rules);
    expect(results[0]?.instances.length ?? 0).toBe(0);
  });

  it('auxiliary-verb — 대해 보상은 해 보 stem 오탐 없음', () => {
    const rules = buildAuxiliaryVerbFindRules('해 보');
    const page = {
      pageNum: 1,
      text: '대해 보상받기를 상상해 보자',
      items: [],
      itemRefs: [],
    };
    const { results } = runRuleCheck([page], rules);
    const hits = results.flatMap((g) => g.instances.map((i) => i.matchedText));
    expect(hits.some((h) => /대해\s+보/.test(h))).toBe(false);
    expect(hits.some((h) => /상상해\s+보/.test(h))).toBe(true);
  });

  it('auxiliary-verb — PDF 줄 검사에서 붙임(만들어내) 오탐 없음', () => {
    const rules = buildAuxiliaryVerbFindRules('어 내').map((r) => ({
      ...r,
      label: '(아/어) + 내다',
    }));
    const page = {
      pageNum: 1,
      text: '만들어내는 과정과 만들어 내는 방법',
      items: [],
      itemRefs: [],
    };
    const { results } = runRuleCheck([page], rules);
    const hits = results.flatMap((g) => g.instances.map((i) => i.matchedText));
    expect(hits.some((h) => /만들어내/.test(h))).toBe(false);
    expect(hits.some((h) => /만들어\s+내/.test(h))).toBe(true);
  });

  it('auxiliary-verb는 줄 단위로만 매칭해 소제목·본문 줄이 이어진 오탐을 막는다', () => {
    const rules = buildAuxiliaryVerbFindRules('여 준');
    const page = { pageNum: 1, text: '보여\n준다', items: [], itemRefs: [] };
    const split = runRuleCheck([page], rules);
    expect(split.results[0]?.instances.length ?? 0).toBe(0);

    const sameLine = runRuleCheck(
      [{ pageNum: 1, text: '이 책을 보여 준다고', items: [], itemRefs: [] }],
      rules,
    );
    expect(sameLine.results[0]?.instances.length ?? 0).toBeGreaterThan(0);
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
