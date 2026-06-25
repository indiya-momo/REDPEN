import { describe, expect, it } from 'vitest';
import {
  MAX_PROJECT_TAGS,
  buildProjectContextSnapshot,
  buildProjectContextWorkPatch,
  mergeProjectContext,
  normalizeProjectContext,
  normalizeProjectMemo,
  normalizeProjectTags,
} from './projectMeta.js';

describe('normalizeProjectTags', () => {
  it('공백·중복·상한을 정리한다', () => {
    const tags = normalizeProjectTags([
      ' 문학 ',
      '문학',
      '시리즈 2/5',
      '',
      'a'.repeat(30),
    ]);
    expect(tags).toEqual(['문학', '시리즈 2/5']);
  });

  it('비배열은 빈 배열이다', () => {
    expect(normalizeProjectTags(null)).toEqual([]);
    expect(normalizeProjectTags('문학')).toEqual([]);
  });

  it(`최대 ${MAX_PROJECT_TAGS}개까지 허용한다`, () => {
    const tags = normalizeProjectTags(
      Array.from({ length: 12 }, (_, i) => `tag-${i}`),
    );
    expect(tags).toHaveLength(MAX_PROJECT_TAGS);
  });
});

describe('normalizeProjectMemo', () => {
  it('trim 후 길이를 제한한다', () => {
    expect(normalizeProjectMemo('  메모  ')).toBe('메모');
    expect(normalizeProjectMemo('   ')).toBeUndefined();
    expect(normalizeProjectMemo(undefined)).toBeUndefined();
  });
});

describe('normalizeProjectContext', () => {
  it('유효한 PDF·작업 메타만 통과한다', () => {
    expect(
      normalizeProjectContext({
        pdfFileName: ' 원고.pdf ',
        pdfPageCount: 120.4,
        pdfSizeBytes: -1,
        lastWorkedAt: '2026-06-22T12:00:00.000Z',
        lastSpellingFindingCount: 3.9,
        noise: true,
      }),
    ).toEqual({
      pdfFileName: '원고.pdf',
      pdfPageCount: 120,
      lastWorkedAt: '2026-06-22T12:00:00.000Z',
      lastSpellingFindingCount: 3,
      pdfLinked: true,
    });
  });

  it('교차·판형을 정규화한다', () => {
    expect(
      normalizeProjectContext({
        proofRevision: ' 3교 ',
        formatLabel: ' 신국판 ',
      }),
    ).toEqual({
      proofRevision: '3교',
      formatLabel: '신국판',
    });
  });

  it('buildProjectContextSnapshot은 PDF가 있을 때만 만든다', () => {
    expect(
      buildProjectContextSnapshot({
        pdfFileName: '원고.pdf',
        pdfPageCount: 42,
        pdfSizeBytes: 1024,
        lastSpellingFindingCount: 5,
      }),
    ).toMatchObject({
      pdfFileName: '원고.pdf',
      pdfPageCount: 42,
      pdfSizeBytes: 1024,
      lastSpellingFindingCount: 5,
      pdfLinked: true,
    });
    expect(buildProjectContextSnapshot({ pdfFileName: '', pdfPageCount: 0 })).toBeUndefined();
  });

  it('buildProjectContextWorkPatch는 PDF 없을 때 검수 건수만 반환한다', () => {
    expect(
      buildProjectContextWorkPatch({
        spellingCheckDone: true,
        spellingFindingCount: 4,
      }),
    ).toEqual({ lastSpellingFindingCount: 4 });
  });

  it('mergeProjectContext는 기존 교차·판형을 유지한다', () => {
    expect(
      mergeProjectContext(
        { proofRevision: '2교', formatLabel: '신국판' },
        { pdfPageCount: 10, pdfFileName: 'a.pdf' },
      ),
    ).toEqual({
      proofRevision: '2교',
      formatLabel: '신국판',
      pdfPageCount: 10,
      pdfFileName: 'a.pdf',
      pdfLinked: true,
    });
  });

  it('빈 객체는 undefined다', () => {
    expect(normalizeProjectContext({})).toBeUndefined();
    expect(normalizeProjectContext(null)).toBeUndefined();
  });
});
