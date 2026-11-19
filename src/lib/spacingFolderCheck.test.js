import { describe, expect, it } from 'vitest';
import {
  charRangesOverlap,
  collectSheetLoanwordRanges,
  dedupeSpacingModulesSequential,
  filterSpacingAgainstSheetAndLoanword,
  mergeSpacingFolderIntoSpellingResults,
} from './spacingFolderCheck.js';

describe('spacingFolderCheck', () => {
  it('charRangesOverlap detects partial overlap', () => {
    expect(charRangesOverlap(0, 5, 4, 8)).toBe(true);
    expect(charRangesOverlap(0, 5, 5, 8)).toBe(false);
  });

  it('collectSheetLoanwordRanges skips caution', () => {
    const ranges = collectSheetLoanwordRanges([
      {
        category: 'caution',
        instances: [{ pageNum: 1, index: 0, matchedText: '주의' }],
      },
      {
        category: 'loanword',
        instances: [{ pageNum: 1, index: 10, matchedText: '외래' }],
      },
      {
        category: 'spelling',
        instances: [{ pageNum: 2, index: 0, matchedText: '맞춤' }],
      },
    ]);
    expect(ranges).toEqual([
      { pageNum: 1, start: 10, end: 12 },
      { pageNum: 2, start: 0, end: 2 },
    ]);
  });

  it('filterSpacingAgainstSheetAndLoanword drops overlapping module hits', () => {
    const spacing = [
      {
        category: 'spacing:numberUnit',
        moduleId: 'digit-unit',
        label: '숫자·단위',
        instances: [
          { pageNum: 1, index: 0, matchedText: 'ABC' },
          { pageNum: 1, index: 10, matchedText: 'XYZ' },
        ],
      },
    ];
    const sheet = [
      {
        category: 'spelling',
        instances: [{ pageNum: 1, index: 1, matchedText: 'B' }],
      },
    ];
    const next = filterSpacingAgainstSheetAndLoanword(spacing, sheet);
    expect(next).toHaveLength(1);
    expect(next[0].instances).toEqual([
      { pageNum: 1, index: 10, matchedText: 'XYZ' },
    ]);
  });

  it('keeps module hit that only overlaps caution', () => {
    const spacing = [
      {
        category: 'spacing:placeAffix',
        moduleId: 'place-affix',
        instances: [{ pageNum: 1, index: 0, matchedText: '서울시' }],
      },
    ];
    const sheet = [
      {
        category: 'caution',
        instances: [{ pageNum: 1, index: 0, matchedText: '서울' }],
      },
    ];
    const next = filterSpacingAgainstSheetAndLoanword(spacing, sheet);
    expect(next[0].instances).toHaveLength(1);
  });

  it('drops module hit overlapping loanword', () => {
    const spacing = [
      {
        category: 'spacing:numberUnit',
        moduleId: 'digit-unit',
        instances: [{ pageNum: 1, index: 0, matchedText: '10kg' }],
      },
    ];
    const sheet = [
      {
        category: 'loanword',
        instances: [{ pageNum: 1, index: 2, matchedText: 'kg' }],
      },
    ];
    expect(filterSpacingAgainstSheetAndLoanword(spacing, sheet)).toEqual([]);
  });

  it('dedupe sequential: A∩B, B∩C, A∩C=∅ keeps A and C (synthetic)', () => {
    const enabled = {
      numberUnit: true,
      dependentRieulKka: true,
      placeAffix: false,
    };
    // numberUnit first module numeral, then dependent first adnominal-dep, then n-ji
    const groups = [
      {
        category: 'spacing:numberUnit',
        moduleId: 'numeral',
        label: 'A',
        instances: [{ pageNum: 1, index: 0, matchedText: 'AAAA' }],
      },
      {
        category: 'spacing:dependentRieulKka',
        moduleId: 'adnominal-dep',
        label: 'B',
        instances: [{ pageNum: 1, index: 2, matchedText: 'AABB' }],
      },
      {
        category: 'spacing:dependentRieulKka',
        moduleId: 'n-ji',
        label: 'C',
        instances: [{ pageNum: 1, index: 4, matchedText: 'BBCC' }],
      },
    ];
    const next = dedupeSpacingModulesSequential(groups, enabled);
    expect(next.map((g) => g.label)).toEqual(['A', 'C']);
  });

  it('sheet filter before module dedupe: A∩sheet, B∩A only → B remains', () => {
    const enabled = {
      numberUnit: true,
      dependentRieulKka: true,
      placeAffix: false,
    };
    const spacing = [
      {
        category: 'spacing:numberUnit',
        moduleId: 'numeral',
        label: 'A',
        instances: [{ pageNum: 1, index: 0, matchedText: 'AAAA' }],
      },
      {
        category: 'spacing:dependentRieulKka',
        moduleId: 'adnominal-dep',
        label: 'B',
        instances: [{ pageNum: 1, index: 2, matchedText: 'AABB' }],
      },
    ];
    const sheet = [
      {
        category: 'spelling',
        instances: [{ pageNum: 1, index: 0, matchedText: 'AA' }],
      },
    ];
    const afterSheet = filterSpacingAgainstSheetAndLoanword(spacing, sheet);
    const next = dedupeSpacingModulesSequential(afterSheet, enabled);
    expect(next.map((g) => g.label)).toEqual(['B']);
  });

  it('mergeSpacingFolderIntoSpellingResults returns [] when all off', () => {
    expect(
      mergeSpacingFolderIntoSpellingResults(
        [{ pageNum: 1, text: '할까보다' }],
        [],
        // nonAeoAux는 기본 켜짐이라 명시적으로 끈다
        { nonAeoAux: false },
      ),
    ).toEqual([]);
  });

  it('merge collects rieul-kka hit when dependent bundle on', () => {
    const groups = mergeSpacingFolderIntoSpellingResults(
      [{ pageNum: 1, text: '할까보다 내일' }],
      [],
      { dependentRieulKka: true },
    );
    expect(groups.length).toBeGreaterThan(0);
    expect(groups[0].category).toBe('spacing:dependentRieulKka');
    expect(groups[0].moduleId).toBe('rieul-kka');
    expect(groups[0].tip).toContain('띄어쓰기');
    expect(groups[0].instances[0].moduleId).toBe('rieul-kka');
  });
});
