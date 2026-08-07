import { describe, expect, it } from 'vitest';
import {
  buildPatternRulePreviewGroups,
  buildPrefixPatternRuleFromChoice,
  buildSecondaryGroupsFromCandidates,
  buildSuffixPatternRuleFromChoice,
  collectPatternRuleCandidates,
  collectPatternRulesFromRegistrations,
  collectPrimaryFormsForPatternGroup,
  isUnifyPatternSeedEligibleCluster,
  dedupeMismatchesSuffixOverPrefix,
  findPatternCompliantForms,
  findPatternMismatches,
  findSuffixPatternMismatches,
  formatPatternRuleConditionLabel,
  formatPhase2CompliantAppliedLabel,
  formatPhase2CompliantFormsLine,
  formatPhase2InProgressBannerModel,
  formatPhase2InProgressBannerTitle,
  formatPhase2InProgressSegment,
  formatPhase2PrimaryFormsLine,
  formatPhase2SeriesCriterionLine,
  groupPatternConditionLabelsByDirection,
  formatPatternSupportExplain,
  formatSuffixPatternRuleConfirmMessage,
  glueSpacedAffixMatch,
  glueSpacedPrefixMatch,
  isPatternRuleHeadBlacklisted,
  isPrimaryUnifyComplete,
  meetsPatternSupportThreshold,
  passesPatternRuleUnifyFilter,
  shouldRejectPatternMismatchByNoiseAndCompound,
  PATTERN_SCORE_WEIGHT_HEAD,
  PHASE2_COMPLIANT_FORMS_PREVIEW,
  PHASE2_PRIMARY_FORMS_MAX,
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
    expect(isPatternRuleHeadBlacklisted('다른')).toBe(true);
    expect(isPatternRuleHeadBlacklisted('하는')).toBe(true);
    expect(isPatternRuleHeadBlacklisted('있는')).toBe(true);
    expect(isPatternRuleHeadBlacklisted('가난한')).toBe(true);
    expect(isPatternRuleHeadBlacklisted('캐나다')).toBe(false);
    expect(isPatternRuleHeadBlacklisted('나라의')).toBe(true);
    expect(isPatternRuleHeadBlacklisted('무역이나')).toBe(true);
    expect(isPatternRuleHeadBlacklisted('더해')).toBe(true);
    expect(isPatternRuleHeadBlacklisted('미친')).toBe(true);
    expect(isPatternRuleHeadBlacklisted('바로')).toBe(true);
    expect(isPatternRuleHeadBlacklisted('빠진')).toBe(true);
    expect(isPatternRuleHeadBlacklisted('방식의')).toBe(true);
    expect(isPatternRuleHeadBlacklisted('재빨리')).toBe(true);
    expect(isPatternRuleHeadBlacklisted('조카의')).toBe(true);
    expect(isPatternRuleHeadBlacklisted('직접적인')).toBe(true);
    expect(isPatternRuleHeadBlacklisted('최악의')).toBe(true);
    expect(isPatternRuleHeadBlacklisted('나라라면')).toBe(true);
    expect(isPatternRuleHeadBlacklisted('낮았고')).toBe(true);
    expect(isPatternRuleHeadBlacklisted('년짜리')).toBe(true);
    expect(isPatternRuleHeadBlacklisted('달러만이')).toBe(true);
    expect(isPatternRuleHeadBlacklisted('실제로')).toBe(true);
    expect(isPatternRuleHeadBlacklisted('걸쳐')).toBe(true);
    expect(isPatternRuleHeadBlacklisted('현재의')).toBe(true);
    expect(isPatternRuleHeadBlacklisted('주식시장이')).toBe(true);
    expect(isPatternRuleHeadBlacklisted('부문도')).toBe(true);
    expect(isPatternRuleHeadBlacklisted('호황과')).toBe(true);
    expect(isPatternRuleHeadBlacklisted('거의')).toBe(true);
    expect(isPatternRuleHeadBlacklisted('이미')).toBe(true);
    expect(isPatternRuleHeadBlacklisted('되자')).toBe(true);
    expect(isPatternRuleHeadBlacklisted('드러난')).toBe(true);
    expect(isPatternRuleHeadBlacklisted('일어난')).toBe(true);
    expect(isPatternRuleHeadBlacklisted('사실')).toBe(true);
    expect(isPatternRuleHeadBlacklisted('시장심리가')).toBe(true);
    expect(isPatternRuleHeadBlacklisted('작금의')).toBe(true);
    expect(isPatternRuleHeadBlacklisted('마치')).toBe(true);
    expect(isPatternRuleHeadBlacklisted('빠른')).toBe(true);
    expect(isPatternRuleHeadBlacklisted('빠져도')).toBe(true);
    expect(isPatternRuleHeadBlacklisted('속도로')).toBe(true);
    expect(isPatternRuleHeadBlacklisted('전국적인')).toBe(true);
    expect(isPatternRuleHeadBlacklisted('갖가지')).toBe(true);
    expect(isPatternRuleHeadBlacklisted('오르면서')).toBe(true);
    expect(isPatternRuleHeadBlacklisted('않았다')).toBe(true);
    expect(isPatternRuleHeadBlacklisted('달랐다')).toBe(true);
    expect(isPatternRuleHeadBlacklisted('쪼개어')).toBe(true);
    expect(isPatternRuleHeadBlacklisted('터지자')).toBe(true);
    expect(isPatternRuleHeadBlacklisted('해보자')).toBe(true);
    expect(isPatternRuleHeadBlacklisted('휩싸인')).toBe(true);
    expect(isPatternRuleHeadBlacklisted('설령')).toBe(true);
    expect(isPatternRuleHeadBlacklisted('아니다')).toBe(true);
    expect(isPatternRuleHeadBlacklisted('안겨주었다')).toBe(true);
    expect(isPatternRuleHeadBlacklisted('이들')).toBe(true);
    expect(isPatternRuleHeadBlacklisted('없다')).toBe(true);
    expect(isPatternRuleHeadBlacklisted('휩쓴')).toBe(true);
    expect(isPatternRuleHeadBlacklisted('깨뜨렸다')).toBe(true);
    expect(isPatternRuleHeadBlacklisted('달리')).toBe(true);
    expect(isPatternRuleHeadBlacklisted('아니면')).toBe(true);
    expect(isPatternRuleHeadBlacklisted('나왔다')).toBe(true);
    expect(isPatternRuleHeadBlacklisted('오로지')).toBe(true);
    expect(isPatternRuleHeadBlacklisted('좀먹고')).toBe(true);
    expect(isPatternRuleHeadBlacklisted('사고')).toBe(false);
    expect(isPatternRuleHeadBlacklisted('투자')).toBe(false);
    expect(isPatternRuleHeadBlacklisted('국제')).toBe(false);
  });

  it('공유 필터: 조사만 어절·쉼표·잡음 리스트 제외', () => {
    expect(passesPatternRuleUnifyFilter('캐나다 정부')).toBe(true);
    expect(passesPatternRuleUnifyFilter('경기 에서')).toBe(false);
    expect(passesPatternRuleUnifyFilter('대부분 공무원')).toBe(false);
    expect(passesPatternRuleUnifyFilter('가정하고 공무원')).toBe(false);
    expect(passesPatternRuleUnifyFilter('가족 모두')).toBe(false);
    expect(passesPatternRuleUnifyFilter('결혼 직전')).toBe(false);
    expect(passesPatternRuleUnifyFilter('담당하던')).toBe(false);
    expect(passesPatternRuleUnifyFilter('광고니까')).toBe(false);
  });

  it('잡음·관형 head는 @사람 패턴 mismatch에서 빠진다', () => {
    const mismatches = findPatternMismatches(
      [
        {
          pageNum: 1,
          text:
            '직장 사람과 다른 사람과 하는 사람과 있는 사람과 가난한 사람이 있다.',
        },
      ],
      {
        id: 'suffix:사람:spaced',
        template: '@사람',
        affix: '사람',
        affixType: 'suffix',
        direction: 'spaced',
        confirmedFrom: '직장 사람',
        confirmedKey: '직장사람',
      },
    );
    const froms = mismatches.map((m) => m.from);
    expect(froms.some((f) => f.includes('다른'))).toBe(false);
    expect(froms.some((f) => f.includes('하는'))).toBe(false);
    expect(froms.some((f) => f.includes('있는'))).toBe(false);
    expect(froms.some((f) => f.includes('가난한'))).toBe(false);
  });

  it('shouldRejectPatternMismatchByNoiseAndCompound — 리스트 잡음', () => {
    expect(
      shouldRejectPatternMismatchByNoiseAndCompound(
        '대부분 공무원',
        '대부분공무원',
        '대부분공무원',
      ),
    ).toBe(true);
    expect(
      shouldRejectPatternMismatchByNoiseAndCompound(
        '경리 업무',
        '경리업무',
        '경리업무',
      ),
    ).toBe(false);
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

  it('@무늬 붙임 규칙에서 관형·형용사 앞말(오려낸·섬세한·아름다운)은 제외', () => {
    const mismatches = findSuffixPatternMismatches(
      [
        {
          pageNum: 1,
          text:
            '오려낸 무늬와 섬세한 무늬, 아름다운 무늬. 넝쿨 무늬는 명사.',
        },
      ],
      {
        id: 'suffix:무늬:glued',
        template: '@무늬',
        affix: '무늬',
        affixType: 'suffix',
        direction: 'glued',
        confirmedFrom: '두꺼비무늬',
        confirmedKey: '두꺼비무늬',
      },
    );
    const froms = mismatches.map((m) => m.from);
    expect(froms).toContain('넝쿨 무늬');
    expect(froms).not.toContain('오려낸 무늬');
    expect(froms).not.toContain('섬세한 무늬');
    expect(froms).not.toContain('아름다운 무늬');
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
    expect(
      isPrimaryUnifyComplete(
        grouped,
        new Map([['a', 'A']]),
        new Map([
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

  it('전부 붙여쓰기라 mismatch가 없어도 적용 표기가 충분하면 2차 후보가 된다', () => {
    const candidates = collectPatternRuleCandidates(
      new Map([['두꺼비무늬', '두꺼비무늬']]),
      [
        {
          key: '두꺼비무늬',
          variants: ['두꺼비무늬', '두꺼비 무늬'],
          counts: { 두꺼비무늬: 3 },
          occurrencesByVariant: {},
          recommendedUnify: '두꺼비무늬',
          totalCount: 3,
        },
      ],
      [
        {
          pageNum: 1,
          text:
            '넝쿨무늬 넝쿨무늬 넝쿨무늬. 얼굴무늬 얼굴무늬. 산수무늬. 연꽃무늬.',
        },
      ],
    );
    const suffix = candidates.find((c) => c.rule.template === '@무늬');
    expect(suffix).toBeTruthy();
    expect(suffix.mismatches).toHaveLength(0);
    expect(suffix.compliantForms.length).toBeGreaterThanOrEqual(3);
    expect(suffix.support.uniqueHeads).toBeGreaterThanOrEqual(2);
    const groups = buildSecondaryGroupsFromCandidates(candidates, [
      suffix.id,
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].clusters).toHaveLength(0);
    expect(groups[0].compliantForms.length).toBeGreaterThanOrEqual(3);
    expect(groups[0].direction).toBe('glued');
  });

  it('본+보조·용언 검토도 @시드에 포함하고, soft 확정 명사도 시드한다', () => {
    expect(
      isUnifyPatternSeedEligibleCluster({
        key: '해보',
        auxReview: { status: 'review' },
      }),
    ).toBe(true);
    expect(
      isUnifyPatternSeedEligibleCluster({
        key: '알아내고',
        predicateReview: { status: 'needs_review' },
      }),
    ).toBe(true);
    expect(
      isUnifyPatternSeedEligibleCluster({
        key: '미국정부',
        variants: ['미국정부', '미국 정부'],
      }),
    ).toBe(true);
    expect(isUnifyPatternSeedEligibleCluster({})).toBe(false);

    const rules = collectPatternRulesFromRegistrations(
      new Map([
        ['미국정부', '미국정부'],
        ['살펴보다', '살펴보다'],
        ['알아내고', '알아내고'],
      ]),
      [
        {
          key: '미국정부',
          variants: ['미국정부', '미국 정부'],
        },
        {
          key: '살펴보다',
          variants: ['살펴보다', '살펴 보다'],
          auxReview: { status: 'review' },
        },
        {
          key: '알아내고',
          variants: ['알아내고', '알아 내고'],
          predicateReview: { status: 'needs_review' },
        },
      ],
    );
    expect(rules.some((r) => r.confirmedKey === '미국정부')).toBe(true);
    expect(rules.some((r) => r.confirmedKey === '살펴보다')).toBe(true);
    expect(rules.some((r) => r.confirmedKey === '알아내고')).toBe(true);
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

  it('조건형 라벨을 붙여쓰기·띄어쓰기로 묶는다', () => {
    expect(
      groupPatternConditionLabelsByDirection([
        '@강사(붙여쓰기)',
        '@경쟁(붙여쓰기)',
        '백자@(띄어쓰기)',
      ]),
    ).toEqual({
      glued: ['@강사', '@경쟁'],
      spaced: ['백자@'],
    });
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
    expect(groups[0].supportExplain).toBeUndefined();
  });

  it('2차 진행 배너·적용 라벨 문구', () => {
    expect(
      formatPhase2InProgressSegment(
        '@무늬',
        [
          '오려낸무늬',
          '그려진 무늬',
          '섬세한무늬',
          '꽃무늬',
          '다섯번째무늬',
        ],
        'glued',
      ),
    ).toBe(
      '@무늬(붙여쓰기)  → 오려낸무늬 · 그려진 무늬 · 섬세한무늬 · 꽃무늬',
    );
    expect(
      formatPhase2SeriesCriterionLine('glued', ['국제금융', '부실투자']),
    ).toBe('1차 통일형: 국제금융 · 부실투자(붙여쓰기)');
    expect(
      formatPhase2InProgressBannerModel([
        {
          template: '@무늬',
          direction: 'glued',
          forms: ['두꺼비무늬'],
        },
      ]),
    ).toEqual({
      title: '2차 표기 통일 기준(1차 표기 통일형)',
      lines: [],
    });
    expect(
      formatPhase2InProgressBannerTitle([
        {
          template: '@무늬',
          direction: 'glued',
          forms: ['두꺼비무늬'],
        },
      ]),
    ).toBe('2차 표기 통일 기준(1차 표기 통일형)');
    expect(formatPhase2CompliantAppliedLabel('glued')).toBe(
      '1차 통일형(붙여쓰기) 적용 단어',
    );
    expect(formatPhase2CompliantAppliedLabel('spaced')).toBe(
      '1차 통일형(띄어쓰기) 적용 단어',
    );
    expect(PHASE2_PRIMARY_FORMS_MAX).toBe(4);
    expect(
      formatPhase2PrimaryFormsLine('@무늬', ['두꺼비무늬'], 'glued'),
    ).toBe(
      '2차 표기 통일 기준(1차 표기 통일형)\n@무늬(붙여쓰기)  → 두꺼비무늬',
    );
    expect(
      collectPrimaryFormsForPatternGroup(
        { affixType: 'suffix', affix: '무늬', template: '@무늬' },
        [
          { key: '오려낸무늬', totalCount: 5 },
          { key: '두꺼비무늬', totalCount: 4 },
          { key: '그려진무늬', totalCount: 3 },
          { key: '다른것', totalCount: 9 },
        ],
        new Map([
          ['오려낸무늬', '오려낸무늬'],
          ['두꺼비무늬', '두꺼비 무늬'],
          ['그려진무늬', '그려진 무늬'],
          ['다른것', '다른것'],
        ]),
      ),
    ).toEqual(['오려낸무늬', '두꺼비 무늬', '그려진 무늬']);
  });

  it('이미 맞는 표기(붙임)를 출현 순으로 모으고 요약은 상위 3', () => {
    const rule = {
      id: 'suffix:무늬:glued',
      template: '@무늬',
      affix: '무늬',
      affixType: 'suffix',
      direction: 'glued',
      confirmedFrom: '두꺼비무늬',
      confirmedKey: '두꺼비무늬',
    };
    const forms = findPatternCompliantForms(
      [
        {
          pageNum: 1,
          text:
            '넝쿨무늬 넝쿨무늬 넝쿨무늬. 얼굴무늬 얼굴무늬. 산수무늬. ' +
            '연꽃무늬. 국화무늬. 오려낸 무늬 그려진 무늬는 어긋남.',
        },
      ],
      rule,
    );
    expect(forms.slice(0, 3).map((c) => `${c.key}:${c.totalCount}`)).toEqual([
      '넝쿨무늬:3',
      '얼굴무늬:2',
      '국화무늬:1',
    ]);
    expect(forms[0].counts['넝쿨무늬']).toBe(3);
    expect(forms[0].counts['넝쿨 무늬']).toBe(0);
    expect(forms[0].variants).toEqual(['넝쿨무늬', '넝쿨 무늬']);
    expect(PHASE2_COMPLIANT_FORMS_PREVIEW).toBe(3);
    expect(formatPhase2CompliantFormsLine('glued', forms)).toBe(
      '1차 통일형이 적용된 단어 · 넝쿨무늬 3 · 얼굴무늬 2 · 국화무늬 1',
    );
    expect(
      formatPhase2CompliantFormsLine('glued', forms, { expanded: true }),
    ).toContain('연꽃무늬 1');
  });

  it('@개혁 잡음(과·적인)은 mismatch·compliant 모두 제외', () => {
    const pages = [
      {
        pageNum: 1,
        text: '안정과 개혁이 필요하다. 근본적인 개혁, 급진적인 개혁도 있다. 구조 개혁은 유지.',
      },
    ];
    const spacedRule = {
      id: 'suffix:개혁:spaced',
      template: '@개혁',
      affix: '개혁',
      affixType: 'suffix',
      direction: 'spaced',
      confirmedFrom: '구조 개혁',
      confirmedKey: '구조개혁',
    };
    const gluedRule = {
      ...spacedRule,
      id: 'suffix:개혁:glued',
      direction: 'glued',
      confirmedFrom: '구조개혁',
    };
    const compliant = findPatternCompliantForms(pages, spacedRule);
    const mismatches = findPatternMismatches(pages, gluedRule);
    const keys = [
      ...compliant.map((c) => c.key),
      ...mismatches.map((m) => m.key),
    ];
    expect(keys.some((k) => k.includes('안정과') || k.includes('적인'))).toBe(
      false,
    );
    expect(keys).toContain('구조개혁');
  });
});
