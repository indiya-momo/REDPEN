import { describe, expect, it } from 'vitest';
import {
  buildConsistencyExportModel,
  buildSpellingExportModel,
} from './exportResults.js';

const formatPageLabel = (n) => `${n}P`;
const alwaysVisible = () => true;
const allVisibleMode = () => 'visible';
const visibleCount = (_s, g) => g.instances.length;

function makeSpellingGroup({
  category = 'builtin',
  find = '되요',
  replace = '돼요',
  pageNum = 1,
  dividerGroup = 'g1',
  dividerLabel = '묶음A',
  tip = '설명',
} = {}) {
  return {
    category,
    find,
    replace,
    label: `${find} → ${replace}`,
    tip,
    dividerGroup,
    dividerLabel,
    instances: [
      {
        pageNum,
        matchedText: find,
        suggestedText: replace,
        start: 0,
        end: find.length,
      },
    ],
  };
}

describe('exportResults compose', () => {
  it('buildSpellingExportModel: caution 먼저, 행·요약 조판', () => {
    const caution = makeSpellingGroup({
      category: 'caution',
      find: '검토어',
      replace: '',
      pageNum: 2,
      dividerGroup: 'c1',
      dividerLabel: '-',
      tip: '편집자 팁',
    });
    const builtin = makeSpellingGroup({ pageNum: 1 });
    const model = buildSpellingExportModel({
      entries: [
        { group: builtin, source: 'spelling' },
        { group: caution, source: 'spelling' },
      ],
      formatPageLabel,
      isInstanceVisible: alwaysVisible,
      groupVisibilityMode: allVisibleMode,
      visibleInstanceCount: visibleCount,
      cautionCriteriaCount: 1,
      cautionFindingsCount: 1,
      builtinCriteriaCount: 1,
      builtinFindingsCount: 1,
      totalFindings: 2,
      filename: 'test.xlsx',
    });

    expect(model.kind).toBe('spelling');
    expect(model.filename).toBe('test.xlsx');
    expect(model.rows).toHaveLength(2);
    expect(model.rows[0].category).toBe('편집자 검토 필요');
    expect(model.rows[1].category).toBe('맞춤법 규칙');
    expect(model.rows[1].label).toBe('되요 → 돼요');
    expect(model.rows[1].groupLabel).toBe('묶음A');
    expect(model.rows[1].dividerGroupKey).toBe('g1');
    expect(model.rows[1].countText).toBe('1');
    expect(model.rows[1].pageRuns.some((r) => r.text.includes('1P'))).toBe(true);
    expect(model.summaryLine).toContain('2');
    expect(JSON.parse(JSON.stringify(model))).toEqual(model);
  });

  it('buildSpellingExportModel: hidden 그룹은 페이지 - 로 조판', () => {
    const group = makeSpellingGroup();
    const model = buildSpellingExportModel({
      entries: [{ group, source: 'spelling' }],
      formatPageLabel,
      isInstanceVisible: alwaysVisible,
      groupVisibilityMode: () => 'hidden',
      visibleInstanceCount: () => 0,
      cautionCriteriaCount: 0,
      cautionFindingsCount: 0,
      builtinCriteriaCount: 1,
      builtinFindingsCount: 1,
      totalFindings: 1,
    });
    expect(model.rows[0].pagesHidden).toBe(true);
    expect(model.rows[0].countText).toBe('0/1');
    expect(model.rows[0].pageRuns).toEqual([]);
  });

  it('buildConsistencyExportModel: 행·요약 조판', () => {
    const group = {
      patternKind: 'literal',
      label: '컴퓨터',
      find: '컴퓨터',
      tip: '통일',
      instances: [{ pageNum: 3, matchedText: '컴퓨터', start: 0, end: 3 }],
    };
    const model = buildConsistencyExportModel({
      entries: [{ group, source: 'consistency' }],
      formatPageLabel,
      isInstanceVisible: alwaysVisible,
      groupVisibilityMode: allVisibleMode,
      visibleInstanceCount: visibleCount,
      literalCriteriaCount: 1,
      literalFindingsCount: 1,
      commonStringCriteriaCount: 0,
      commonStringFindingsCount: 0,
      auxiliaryCriteriaCount: 0,
      auxiliaryFindingsCount: 0,
      totalFindings: 1,
    });
    expect(model.kind).toBe('consistency');
    expect(model.rows).toHaveLength(1);
    expect(model.rows[0].label).toBe('컴퓨터');
    expect(model.rows[0].pageRuns.some((r) => r.text.includes('3P'))).toBe(true);
    expect(JSON.parse(JSON.stringify(model))).toEqual(model);
  });

  it('buildConsistencyExportModel: 통일형 구분·설명을 채운다', () => {
    const pinned = {
      patternKind: 'compound-find',
      label: '조선시대',
      find: '조선시대',
      tip: '',
      instances: [{ pageNum: 1, matchedText: '조선시대', start: 0, end: 4 }],
    };
    const need = {
      patternKind: 'compound-find',
      label: '조선˅시대',
      find: '조선 시대',
      tip: '',
      instances: [{ pageNum: 2, matchedText: '조선 시대', start: 0, end: 5 }],
    };
    const customRules = [
      {
        id: 'u1',
        enabled: true,
        patternKind: 'compound-find',
        tailWord: '조선시대',
        consistencyUnifyEntry: true,
        consistencyUnifyPinned: true,
      },
      {
        id: 'u2',
        enabled: true,
        patternKind: 'compound-find',
        tailWord: '조선˅시대',
        consistencyUnifyEntry: true,
      },
    ];
    const model = buildConsistencyExportModel({
      entries: [
        { group: pinned, source: 'consistency' },
        { group: need, source: 'consistency' },
      ],
      formatPageLabel,
      isInstanceVisible: alwaysVisible,
      groupVisibilityMode: allVisibleMode,
      visibleInstanceCount: visibleCount,
      literalCriteriaCount: 0,
      literalFindingsCount: 0,
      unifyCriteriaCount: 2,
      unifyFindingsCount: 2,
      commonStringCriteriaCount: 0,
      commonStringFindingsCount: 0,
      auxiliaryCriteriaCount: 0,
      auxiliaryFindingsCount: 0,
      totalFindings: 2,
      customRules,
    });
    expect(model.rows[0].category).toBe('표기 통일하기');
    expect(model.rows[0].tip).toBe('통일형 📌');
    expect(model.rows[1].category).toBe('표기 통일하기');
    expect(model.rows[1].tip).toBe('통일 필요 항목');
  });

  it('buildConsistencyExportModel: 표기 통일 추천 시트를 붙인다', () => {
    const recommendGroup = {
      label: '조선 시대',
      find: '조선 시대',
      tip: '문서 내 다수형 「조선시대」와 띄어쓰기가 다른 표기',
      instances: [
        { pageNum: 2, matchedText: '조선 시대', start: 0, end: 5 },
        { pageNum: 5, matchedText: '조선 시대', start: 0, end: 5 },
      ],
    };
    const model = buildConsistencyExportModel({
      entries: [],
      recommendEntries: [{ group: recommendGroup, source: 'consistency' }],
      formatPageLabel,
      isInstanceVisible: alwaysVisible,
      groupVisibilityMode: allVisibleMode,
      visibleInstanceCount: visibleCount,
      literalCriteriaCount: 0,
      literalFindingsCount: 0,
      commonStringCriteriaCount: 0,
      commonStringFindingsCount: 0,
      auxiliaryCriteriaCount: 0,
      auxiliaryFindingsCount: 0,
      totalFindings: 0,
    });
    expect(model.rows).toHaveLength(0);
    expect(model.recommend?.sheetName).toBe('표기 통일 추천');
    expect(model.recommend?.summaryLine).toBe(
      '표기 통일 추천 1항목 전체 발견 2',
    );
    expect(model.recommend?.rows).toHaveLength(1);
    expect(model.recommend?.rows[0].category).toBe('표기 통일 추천');
    expect(model.recommend?.rows[0].label).toBe('조선 시대');
    expect(model.recommend?.rows[0].countText).toBe('2');
  });

  it('buildConsistencyExportModel: 등록 결과와 추천을 같이 담는다', () => {
    const registered = {
      patternKind: 'literal',
      label: '컴퓨터',
      find: '컴퓨터',
      tip: '',
      instances: [{ pageNum: 1, matchedText: '컴퓨터', start: 0, end: 3 }],
    };
    const recommendGroup = {
      label: '세계 경제',
      find: '세계 경제',
      tip: '문서 내 표기',
      instances: [{ pageNum: 3, matchedText: '세계 경제', start: 0, end: 5 }],
    };
    const model = buildConsistencyExportModel({
      entries: [{ group: registered, source: 'consistency' }],
      recommendEntries: [{ group: recommendGroup, source: 'consistency' }],
      formatPageLabel,
      isInstanceVisible: alwaysVisible,
      groupVisibilityMode: allVisibleMode,
      visibleInstanceCount: visibleCount,
      literalCriteriaCount: 1,
      literalFindingsCount: 1,
      commonStringCriteriaCount: 0,
      commonStringFindingsCount: 0,
      auxiliaryCriteriaCount: 0,
      auxiliaryFindingsCount: 0,
      totalFindings: 1,
    });
    expect(model.rows).toHaveLength(1);
    expect(model.recommend?.rows).toHaveLength(1);
  });

  it('buildConsistencyExportModel: 공통 항목은 채워진 표기별로 행을 나눈다', () => {
    const group = {
      patternKind: 'phrase-slot-find',
      label: '@정부',
      tailWord: '@정부',
      find: '…',
      tip: '',
      instances: [
        { pageNum: 10, matchedText: '지방정부', start: 0, end: 4 },
        { pageNum: 11, matchedText: '지방정부', start: 0, end: 4 },
        { pageNum: 3, matchedText: '주정부', start: 0, end: 3 },
        { pageNum: 5, matchedText: '지방정부', start: 0, end: 4 },
        { pageNum: 8, matchedText: '주정부', start: 0, end: 3 },
      ],
    };
    const model = buildConsistencyExportModel({
      entries: [{ group, source: 'consistency' }],
      formatPageLabel,
      isInstanceVisible: alwaysVisible,
      groupVisibilityMode: allVisibleMode,
      visibleInstanceCount: visibleCount,
      literalCriteriaCount: 0,
      literalFindingsCount: 0,
      commonStringCriteriaCount: 1,
      commonStringFindingsCount: 5,
      auxiliaryCriteriaCount: 0,
      auxiliaryFindingsCount: 0,
      totalFindings: 5,
    });
    expect(model.rows).toHaveLength(2);
    expect(model.rows[0].category).toBe('공통 항목 찾기');
    expect(model.rows[0].label).toBe('지방정부');
    expect(model.rows[0].countText).toBe('3');
    expect(model.rows[1].label).toBe('주정부');
    expect(model.rows[1].countText).toBe('2');
  });
});
