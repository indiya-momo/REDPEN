import { describe, expect, it } from 'vitest';
import {
  buildPatternRulePreviewGroups,
  buildPrefixPatternRuleFromChoice,
  buildSecondaryGroupsFromCandidates,
  buildSuffixPatternRuleFromChoice,
  collectPatternRuleCandidates,
  dedupeMismatchesSuffixOverPrefix,
  findPatternMismatches,
  findSuffixPatternMismatches,
  formatPatternRuleConditionLabel,
  formatPatternSupportExplain,
  formatSuffixPatternRuleConfirmMessage,
  glueSpacedAffixMatch,
  glueSpacedPrefixMatch,
  isPatternRuleHeadBlacklisted,
  isPrimaryUnifyComplete,
  meetsPatternSupportThreshold,
  passesPatternRuleUnifyFilter,
  PATTERN_SCORE_WEIGHT_HEAD,
  scorePatternRuleCandidate,
  spaceGluedAffixMatch,
  spaceGluedPrefixMatch,
} from './unifyPatternRule.js';

describe('unifyPatternRule', () => {
  it('선택에서 접미 patternRule을 만든다', () => {
    const rule = buildSuffixPatternRuleFromChoice(
      {
        key: '미국정부',
        variants: ['미국정부', '미국 정부'],
      },
      '미국정부',
    );
    expect(rule).toMatchObject({
      template: '@정부',
      affix: '정부',
      affixType: 'suffix',
      direction: 'glued',
      confirmedFrom: '미국정부',
      confirmedKey: '미국정부',
    });
  });

  it('선택에서 접두 patternRule을 만든다', () => {
    const rule = buildPrefixPatternRuleFromChoice(
      {
        key: '미국정부',
        variants: ['미국정부', '미국 정부'],
      },
      '미국정부',
    );
    expect(rule).toMatchObject({
      template: '미국@',
      affix: '미국',
      affixType: 'prefix',
      direction: 'glued',
      confirmedFrom: '미국정부',
      confirmedKey: '미국정부',
    });
  });

  it('confirm 문구 형식', () => {
    expect(
      formatSuffixPatternRuleConfirmMessage({
        template: '@정부',
        affix: '정부',
        direction: 'glued',
        confirmedFrom: '미국정부',
      }),
    ).toBe(
      '@정부(○○정부 형태) 전체를 붙여 쓰는 쪽으로 통일할까요?\n기준: 미국정부',
    );
  });

  it('블랙리스트 앞말을 거른다', () => {
    expect(isPatternRuleHeadBlacklisted('여러')).toBe(true);
    expect(isPatternRuleHeadBlacklisted('캐나다')).toBe(false);
  });

  it('공유 필터: 조사만 어절·쉼표 제외', () => {
    expect(passesPatternRuleUnifyFilter('캐나다 정부')).toBe(true);
    expect(passesPatternRuleUnifyFilter('경기 에서')).toBe(false);
  });

  it('붙임/띄움 변환', () => {
    expect(glueSpacedAffixMatch('캐나다 정부', '정부')).toBe('캐나다정부');
    expect(spaceGluedAffixMatch('캐나다정부', '정부')).toBe('캐나다 정부');
    expect(glueSpacedPrefixMatch('미국 정부', '미국')).toBe('미국정부');
    expect(spaceGluedPrefixMatch('미국정부', '미국')).toBe('미국 정부');
  });

  it('편측 띄움만 있어도 붙임 규칙 어긋남을 찾는다', () => {
    const mismatches = findSuffixPatternMismatches(
      [
        {
          pageNum: 1,
          text: '미국 정부와 캐나다 정부가 합의했다. 여러 정부는 제외.',
        },
      ],
      {
        id: 'suffix:정부:glued',
        template: '@정부',
        affix: '정부',
        affixType: 'suffix',
        direction: 'glued',
        confirmedFrom: '미국정부',
        confirmedKey: '미국정부',
      },
    );
    const froms = mismatches.map((m) => m.from);
    expect(froms).toContain('캐나다 정부');
    expect(froms).not.toContain('미국 정부');
    expect(froms.some((f) => f.includes('여러'))).toBe(false);
  });

  it('접두 패턴 어긋남을 찾는다', () => {
    const mismatches = findPatternMismatches(
      [{ pageNum: 1, text: '미국 의회와 미국 정부가 있다.' }],
      {
        id: 'prefix:미국:glued',
        template: '미국@',
        affix: '미국',
        affixType: 'prefix',
        direction: 'glued',
        confirmedFrom: '미국정부',
        confirmedKey: '미국정부',
      },
    );
    const froms = mismatches.map((m) => m.from);
    expect(froms).toContain('미국 의회');
    expect(froms).not.toContain('미국 정부');
  });

  it('이중 key는 접미가 접두보다 우선', () => {
    const deduped = dedupeMismatchesSuffixOverPrefix([
      {
        key: '미국정부',
        from: '미국 정부',
        to: '미국정부',
        count: 1,
        instances: [],
        affixType: 'prefix',
        template: '미국@',
      },
      {
        key: '미국정부',
        from: '미국 정부',
        to: '미국정부',
        count: 2,
        instances: [],
        affixType: 'suffix',
        template: '@정부',
      },
    ]);
    expect(deduped).toHaveLength(1);
    expect(deduped[0].affixType).toBe('suffix');
    expect(deduped[0].count).toBe(2);
  });

  it('1차 완료 판정', () => {
    const grouped = [
      { clusters: [{ key: 'a' }, { key: 'b' }] },
      { clusters: [{ key: 'c' }] },
    ];
    expect(isPrimaryUnifyComplete(grouped, new Map())).toBe(false);
    expect(
      isPrimaryUnifyComplete(
        grouped,
        new Map([
          ['a', 'A'],
          ['b', 'B'],
          ['c', 'C'],
        ]),
      ),
    ).toBe(true);
  });

  it('등록에서 패턴 후보를 모은다(건수·예시·score)', () => {
    const candidates = collectPatternRuleCandidates(
      new Map([['미국정부', '미국정부']]),
      [
        {
          key: '미국정부',
          variants: ['미국정부', '미국 정부'],
          counts: {},
          occurrencesByVariant: {},
          recommendedUnify: '미국정부',
          totalCount: 1,
        },
      ],
      [
        {
          pageNum: 1,
          text: '캐나다 정부와 지방 정부가 있고 서울 정부도 있다. 미국 의회도 있다.',
        },
      ],
    );
    const suffix = candidates.find((c) => c.rule.template === '@정부');
    expect(suffix).toBeTruthy();
    expect(suffix.mismatchCount).toBeGreaterThanOrEqual(3);
    expect(suffix.support.uniqueHeads).toBeGreaterThanOrEqual(2);
    expect(suffix.score).toBe(
      scorePatternRuleCandidate(suffix.support, 0),
    );
    expect(suffix.exampleFroms.length).toBeGreaterThan(0);
    expect(suffix.exampleFroms.some((e) => e.includes('정부'))).toBe(true);
  });

  it('증거가 약한 한 쌍만으로는 패턴 후보를 만들지 않는다', () => {
    const candidates = collectPatternRuleCandidates(
      new Map([['경제성장', '경제성장']]),
      [
        {
          key: '경제성장',
          variants: ['경제성장', '경제 성장'],
          counts: {},
          occurrencesByVariant: {},
          recommendedUnify: '경제성장',
          totalCount: 1,
        },
      ],
      [{ pageNum: 1, text: '경제 성장이 둔화됐다.' }],
    );
    expect(candidates.find((c) => c.rule.template === '@성장')).toBeFalsy();
  });

  it('다 head면 @성장 후보와 score를 만든다', () => {
    const candidates = collectPatternRuleCandidates(
      new Map([['경제성장', '경제성장']]),
      [
        {
          key: '경제성장',
          variants: ['경제성장', '경제 성장'],
          counts: {},
          occurrencesByVariant: {},
          recommendedUnify: '경제성장',
          totalCount: 1,
        },
      ],
      [
        {
          pageNum: 1,
          text: '시장 성장과 산업 성장, 지역 성장이 이어졌다.',
        },
      ],
    );
    const growth = candidates.find((c) => c.rule.template === '@성장');
    expect(growth).toBeTruthy();
    expect(growth.support.uniqueHeads).toBeGreaterThanOrEqual(3);
    expect(growth.support.occurrenceCount).toBeGreaterThanOrEqual(3);
    expect(growth.score).toBeGreaterThanOrEqual(
      3 + PATTERN_SCORE_WEIGHT_HEAD * 3,
    );
  });

  it('score는 head 다양성이 높을수록 크다', () => {
    const weak = scorePatternRuleCandidate(
      { occurrenceCount: 34, uniqueHeads: 2, examples: [] },
      12,
    );
    const strong = scorePatternRuleCandidate(
      { occurrenceCount: 34, uniqueHeads: 9, examples: [] },
      0,
    );
    expect(strong).toBeGreaterThan(weak);
  });

  it('support 하한과 Explain 문구', () => {
    expect(
      meetsPatternSupportThreshold({
        occurrenceCount: 2,
        uniqueHeads: 2,
        examples: [],
      }),
    ).toBe(false);
    expect(
      meetsPatternSupportThreshold({
        occurrenceCount: 3,
        uniqueHeads: 2,
        examples: [],
      }),
    ).toBe(true);
    expect(
      formatPatternSupportExplain(
        {
          occurrenceCount: 27,
          uniqueHeads: 8,
          examples: ['경제성장', '산업성장', '지역성장'],
        },
        92,
      ),
    ).toContain('27회 발견');
  });

  it('패턴 Preview 그룹을 만든다', () => {
    const groups = buildPatternRulePreviewGroups([
      {
        key: '시장성장',
        from: '시장 성장',
        to: '시장성장',
        count: 1,
        instances: [
          { pageNum: 1, index: 0, matchedText: '시장 성장' },
        ],
      },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].find).toBe('시장 성장');
    expect(groups[0].replace).toBe('시장성장');
  });

  it('조건형 라벨은 template(방향)', () => {
    expect(
      formatPatternRuleConditionLabel({
        template: '청자@',
        direction: 'glued',
      }),
    ).toBe('청자@(붙여쓰기)');
    expect(
      formatPatternRuleConditionLabel({
        template: '백자@',
        direction: 'spaced',
      }),
    ).toBe('백자@(띄어쓰기)');
  });

  it('2차 그룹은 접두/접미 템플릿 헤더로 묶인다', () => {
    const groups = buildSecondaryGroupsFromCandidates(
      [
        {
          id: 'prefix:백자:glued',
          rule: {
            id: 'prefix:백자:glued',
            template: '백자@',
            affix: '백자',
            affixType: 'prefix',
            direction: 'glued',
            confirmedFrom: '백자청화',
            confirmedKey: '백자청화',
          },
          mismatchCount: 2,
          exampleFroms: ['백자 제기'],
          support: {
            occurrenceCount: 2,
            uniqueHeads: 2,
            examples: ['백자 제기', '백자 철화'],
          },
          score: 22,
          mismatches: [
            {
              key: '백자제기',
              from: '백자 제기',
              to: '백자제기',
              count: 1,
              instances: [],
              affixType: 'prefix',
              template: '백자@',
            },
            {
              key: '백자철화',
              from: '백자 철화',
              to: '백자철화',
              count: 1,
              instances: [],
              affixType: 'prefix',
              template: '백자@',
            },
          ],
        },
      ],
      ['prefix:백자:glued'],
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe('백자@');
    expect(groups[0].clusters).toHaveLength(2);
    expect(groups[0].supportExplain).toContain('2회 발견');
  });
});
