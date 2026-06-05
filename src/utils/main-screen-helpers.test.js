import { describe, expect, it } from 'vitest';
import {
  buildTabEntries,
  clampPageNumber,
  countTabTotalFindings,
  getCenterRunLabel,
  getSpellingTabLayoutClassName,
  isTabCheckDone,
  shouldShowPdfViewer,
  sortSpellingResultsForDisplay,
} from './main-screen-helpers.js';

describe('buildTabEntries', () => {
  it('맞춤법 탭 — 맞춤법 기준 뒤 검토필요 기준', () => {
    const entries = buildTabEntries(
      'spelling',
      [
        {
          category: 'caution',
          label: 'z',
          find: 'z',
          replace: 'z',
          instances: [{ pageNum: 1 }],
        },
        {
          category: 'spelling',
          label: 'b',
          find: 'b',
          replace: 'b',
          instances: [{ pageNum: 5 }],
        },
        {
          category: 'caution',
          label: 'y',
          find: 'y',
          replace: 'y',
          instances: [{ pageNum: 2 }],
        },
        {
          category: 'spelling',
          label: 'a',
          find: 'a',
          replace: 'a',
          instances: [{ pageNum: 3 }],
        },
      ],
      [],
    );
    expect(entries.map((e) => e.group.category)).toEqual([
      'spelling',
      'spelling',
      'caution',
      'caution',
    ]);
    expect(entries[0].group.label).toBe('a');
    expect(entries[2].group.label).toBe('z');
  });

  it('맞춤법 탭이면 spelling 결과만 묶는다', () => {
    const entries = buildTabEntries(
      'spelling',
      [{ find: 'a', replace: 'b', instances: [{ pageNum: 1 }] }],
      [{ find: 'c', replace: 'd', instances: [] }],
    );
    expect(entries).toHaveLength(1);
    expect(entries[0].source).toBe('spelling');
  });

  it('일관성 탭에서 toc-body 항목은 제외한다', () => {
    const entries = buildTabEntries('consistency', [], [
      {
        find: 't1',
        replace: '',
        patternKind: 'toc-body',
        label: '목차',
        instances: [],
      },
      {
        find: 't2',
        replace: '',
        patternKind: 'compound-find',
        label: '규칙',
        instances: [{}],
      },
    ]);
    expect(entries).toHaveLength(1);
    expect(entries[0].group.label).toBe('규칙');
  });
});

describe('countTabTotalFindings', () => {
  it('instances 길이를 합산한다', () => {
    const total = countTabTotalFindings([
      { group: { instances: [{}, {}] }, source: 'spelling' },
      { group: { instances: [{}] }, source: 'spelling' },
    ]);
    expect(total).toBe(3);
  });
});

describe('isTabCheckDone', () => {
  it('탭에 따라 완료 플래그를 고른다', () => {
    expect(isTabCheckDone('spelling', true, false)).toBe(true);
    expect(isTabCheckDone('consistency', false, true)).toBe(true);
  });
});

describe('getCenterRunLabel', () => {
  it('검사 중이면 검사 중…', () => {
    expect(getCenterRunLabel(true, { phase: 'check' })).toBe('검사 중…');
    expect(getCenterRunLabel(true, { phase: 'load' })).toBe('검수 실행');
  });
});

describe('clampPageNumber', () => {
  it('1..numPages 범위로 고정한다', () => {
    expect(clampPageNumber(0, 10)).toBe(1);
    expect(clampPageNumber(99, 10)).toBe(10);
    expect(clampPageNumber(5, 10)).toBe(5);
    expect(clampPageNumber(Number.NaN, 10)).toBe(1);
    expect(clampPageNumber(5, 0)).toBe(1);
  });
});

describe('shouldShowPdfViewer', () => {
  it('PDF가 있으면 맞춤법·일관성 탭 모두 뷰어를 연다', () => {
    expect(shouldShowPdfViewer(true)).toBe(true);
    expect(shouldShowPdfViewer(false)).toBe(false);
  });
});

describe('getSpellingTabLayoutClassName', () => {
  it('결과 유무에 따라 modifier를 붙인다', () => {
    expect(getSpellingTabLayoutClassName(true)).toContain('with-results');
    expect(getSpellingTabLayoutClassName(false)).toContain('rules-only');
  });
});
