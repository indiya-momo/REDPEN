import { describe, expect, it } from 'vitest';
import { buildAuxiliaryVerbFindRules } from './auxiliaryVerbPattern.js';
import { buildCompoundFindRules } from './compoundFindPattern.js';
import { ensureDefaultAuxiliaryVerbs } from './defaultAuxiliaryVerbs.js';
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

  it('runRuleCheckAsync — 컴파일 실패 오류는 규칙당 한 번만', async () => {
    const pages = Array.from({ length: 5 }, (_, i) => ({
      pageNum: i + 1,
      text: '본문',
    }));
    const rules = [{ find: '(?', replace: 'x', enabled: true, pattern: 'regex' }];
    const { errors } = await runRuleCheckAsync(pages, rules, { pagesPerChunk: 1 });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/규칙 문법 오류/);
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

  it('auxiliary-verb — 음절 자간 공백(통해 보)은 관형어 필터로 오탐 없음', () => {
    const items = [
      { str: '통해', transform: [10, 0, 0, 10, 0, 100], width: 22 },
      { str: '보장', transform: [10, 0, 0, 10, 22.6, 100], width: 22 },
    ];
    const { text, itemRefs } = buildPageText(items);
    const rules = buildAuxiliaryVerbFindRules('해 보');
    const { results } = runRuleCheck(
      [{ pageNum: 1, text, items, itemRefs }],
      rules,
    );
    expect(results[0]?.instances.length ?? 0).toBe(0);
  });

  it('auxiliary-verb — 3음절 …해 앞말(상상해)은 제외, 1음절 해 왔은 포함', () => {
    const items = [
      { str: '상상해', transform: [10, 0, 0, 10, 0, 100], width: 22 },
      { str: '왔다', transform: [10, 0, 0, 10, 22.6, 100], width: 22 },
    ];
    const { text, itemRefs } = buildPageText(items);
    const rules = buildAuxiliaryVerbFindRules('해 왔').map((r) => ({
      ...r,
      bonBojoItemId: 'verb-oda',
    }));
    const { results } = runRuleCheck(
      [{ pageNum: 99, text, items, itemRefs }],
      rules,
    );
    const hits = results.flatMap((g) => g.instances.map((i) => i.matchedText));
    expect(hits.some((h) => /상상해\s+왔/.test(h))).toBe(false);

    const shortResults = runRuleCheck(
      [{ pageNum: 2, text: '해 왔다', items: [], itemRefs: [] }],
      buildAuxiliaryVerbFindRules('해 왔'),
    );
    expect(shortResults.results[0]?.instances.length ?? 0).toBeGreaterThan(0);
  });

  it('auxiliary-verb — NBSP 띄움도 해 왔 stem', () => {
    const page = {
      pageNum: 99,
      text: '역할을\u00A0해\u00A0왔다.\n',
      items: [],
      itemRefs: [],
    };
    const rules = buildAuxiliaryVerbFindRules('해 왔').map((r) => ({
      ...r,
      enabled: true,
      bonBojoItemId: 'verb-oda',
    }));
    const { results } = runRuleCheck([page], rules);
    expect(results[0]?.instances.length ?? 0).toBeGreaterThan(0);
  });

  it('auxiliary-verb — 달려 왔다(려 왔 stem)', () => {
    const page = {
      pageNum: 380,
      text: '그는 달려 왔다.\n',
      items: [],
      itemRefs: [],
    };
    const ryoWat = ensureDefaultAuxiliaryVerbs([])
      .filter(
        (r) =>
          r.patternKind === 'auxiliary-verb' &&
          r.bonBojoItemId === 'verb-oda' &&
          r.tailWord === '려 왔',
      )
      .map((r) => ({ ...r, enabled: true }));
    const { results } = runRuleCheck([page], ryoWat);
    const hits = results.flatMap((g) => g.instances.map((i) => i.matchedText));
    expect(hits.some((h) => /달려\s+왔/.test(h))).toBe(true);
  });

  it('auxiliary-verb — 역할을 해 왔다(일관성 문자열 찾기와 동일 문장)', () => {
    const page = {
      pageNum: 99,
      text: '역할을 해 왔다.\n',
      items: [],
      itemRefs: [],
    };
    const haeWat = ensureDefaultAuxiliaryVerbs([])
      .filter(
        (r) =>
          r.patternKind === 'auxiliary-verb' &&
          r.tailWord === '해 왔',
      )
      .map((r) => ({ ...r, enabled: true }));
    const literal = buildCompoundFindRules('역할을 해 왔다').map((r) => ({
      ...r,
      enabled: true,
    }));
    const aux = runRuleCheck([page], haeWat);
    const lit = runRuleCheck([page], literal);
    expect(lit.results[0]?.instances.length ?? 0).toBeGreaterThan(0);
    expect(aux.results[0]?.instances.length ?? 0).toBeGreaterThan(0);
    expect(aux.results[0]?.instances[0]?.matchedText).toMatch(/해\s+왔/);
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
    expect(hits.some((h) => /상상해\s+보/.test(h))).toBe(false);
  });

  it('auxiliary-verb — PDF 줄 검사에서 붙임(만들어내) 오탐 없음', () => {
    const rules = buildAuxiliaryVerbFindRules('어 내').map((r) => ({
      ...r,
      label: '본(-아/어) + 내다',
      bonBojoItemId: 'verb-naeda',
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

  it('통일형 붙임 표기는 앞글자 붙은 부분일치를 제외', () => {
    const rules = buildCompoundFindRules('신라시대').map((r) => ({
      ...r,
      enabled: true,
      consistencyUnifyEntry: true,
    }));
    const { results, errors } = runRuleCheck(
      [
        {
          pageNum: 1,
          text: '신라시대, 통일신라시대, 신라 시대 이야기',
          items: [],
          itemRefs: [],
        },
      ],
      rules,
    );
    expect(errors).toEqual([]);
    const hits = results.flatMap((g) => g.instances.map((i) => i.matchedText));
    expect(hits).toEqual(['신라시대']);
  });

  it('부분·전체 표기가 겹치면 전체(긴 매칭)만 남긴다', () => {
    const pages = [
      {
        pageNum: 135,
        text: '맥도날드에 갔다가 맥도날드를 또 보고 맥도날드에서 나왔다.',
        items: [],
        itemRefs: [],
      },
    ];
    const rules = [
      {
        find: '맥도날드',
        replace: '맥도널드',
        enabled: true,
        builtIn: true,
        category: 'spelling',
      },
      {
        find: '도날드',
        replace: '도널드',
        enabled: true,
        builtIn: true,
        category: 'spelling',
      },
    ];
    const { results, errors } = runRuleCheck(pages, rules);
    expect(errors).toEqual([]);
    const byFind = Object.fromEntries(
      results.map((g) => [g.find, g.instances.length]),
    );
    expect(byFind['맥도날드']).toBe(3);
    expect(byFind['도날드']).toBeUndefined();
    const total = results.reduce((n, g) => n + g.instances.length, 0);
    expect(total).toBe(3);
  });

  it('겹치지 않는 부분 표기는 그대로 남긴다', () => {
    const pages = [
      {
        pageNum: 1,
        text: '도날드가 맥도날드에 갔다.',
        items: [],
        itemRefs: [],
      },
    ];
    const rules = [
      {
        find: '맥도날드',
        replace: '맥도널드',
        enabled: true,
        builtIn: true,
        category: 'spelling',
      },
      {
        find: '도날드',
        replace: '도널드',
        enabled: true,
        builtIn: true,
        category: 'spelling',
      },
    ];
    const { results } = runRuleCheck(pages, rules);
    const byFind = Object.fromEntries(
      results.map((g) => [g.find, g.instances.length]),
    );
    expect(byFind['도날드']).toBe(1);
    expect(byFind['맥도날드']).toBe(1);
  });
});
