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
});
