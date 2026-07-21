import { describe, expect, it } from 'vitest';
import {
  buildProjectCardDisplayTags,
  buildProjectCardPillarPreviews,
  buildProjectCardTabLabels,
  buildProjectTagFilterOptions,
  collectProjectTags,
  filterProjectsByTag,
  filterProjectsForLibrary,
  formatProjectCardEditionValues,
  formatProjectCardLastModifiedLabel,
  formatProjectCardMemoPreview,
  formatProjectCardMetaLine,
  normalizeProjectCardDotDate,
  formatProjectCardScheduleLines,
  formatProjectCardTitleLine,
} from './projectCardViewModel.js';

describe('projectCardViewModel helpers', () => {
  const sample = {
    id: 'a',
    title: '테스트',
    tags: ['문학', '1권'],
    headline: '요약',
    highlights: [],
    counts: {
      editorReview: 0,
      spelling: 0,
      find: 0,
      commonString: 0,
      auxiliary: 0,
    },
    savedDate: '6/1',
    isActive: false,
    lastWork: { date: '26.06.18', manuscriptPages: 100 },
    createdDate: '26.06.01',
    formatLabel: '2교',
    chipPreview: {
      spelling: [{ label: '테스트', active: true }],
      consistency: [{ label: 'A', active: true }, { label: 'B', active: false }],
      auxiliary: [],
    },
  };

  it('formatProjectCardTitleLine', () => {
    expect(formatProjectCardTitleLine(sample)).toBe(
      '[문학 · 1권] 《테스트》 기준',
    );
  });

  it('formatProjectCardLastModifiedLabel', () => {
    expect(formatProjectCardLastModifiedLabel(sample)).toBe('26.06.18 작업');
    expect(
      formatProjectCardLastModifiedLabel({
        ...sample,
        lastWork: undefined,
        savedDate: '26년 6월 22일',
      }),
    ).toBe('26.06.22 작업');
  });

  it('normalizeProjectCardDotDate', () => {
    expect(normalizeProjectCardDotDate('26.6.30')).toBe('26.06.30');
    expect(normalizeProjectCardDotDate('26년 6월 30일')).toBe('26.06.30');
    expect(normalizeProjectCardDotDate('26.06.18')).toBe('26.06.18');
  });

  it('buildProjectCardTabLabels / buildProjectCardDisplayTags', () => {
    expect(buildProjectCardTabLabels(sample)).toEqual(['문학', '1권']);
    expect(buildProjectCardDisplayTags(sample)).toEqual(['문학', '1권']);
    expect(
      buildProjectCardDisplayTags({
        ...sample,
        tags: ['a', 'b', 'c'],
      }),
    ).toEqual(['a', 'b', 'c']);
    expect(
      buildProjectCardTabLabels({
        ...sample,
        tags: [],
      }),
    ).toEqual([]);
  });

  it('formatProjectCardEditionValues', () => {
    expect(formatProjectCardEditionValues(sample)).toBe('2교');
    expect(
      formatProjectCardEditionValues({ ...sample, formatLabel: '신국판' }),
    ).toBe('신국판');
  });

  it('formatProjectCardMemoPreview', () => {
    expect(formatProjectCardMemoPreview({ ...sample, memo: '첫 줄\n둘째 줄' })).toBe(
      '첫 줄',
    );
    expect(formatProjectCardMemoPreview({ ...sample, memo: '  \n비어 있음' })).toBe(
      '',
    );
  });

  it('formatProjectCardScheduleLines', () => {
    expect(formatProjectCardScheduleLines(sample)).toEqual(['26.06.18 작업']);
    expect(
      formatProjectCardScheduleLines({ ...sample, lastWork: undefined }),
    ).toEqual([]);
  });

  it('formatProjectCardMetaLine', () => {
    expect(formatProjectCardMetaLine(sample)).toBe('원고 100p · 2교');
    expect(
      formatProjectCardMetaLine({ ...sample, formatLabel: '신국판' }),
    ).toBe('원고 100p · 신국판');
  });

  it('buildProjectCardPillarPreviews', () => {
    const previews = buildProjectCardPillarPreviews(sample);
    expect(previews).toHaveLength(3);
    expect(previews[0].chips).toHaveLength(1);
    expect(previews[1].chips).toHaveLength(1);
    expect(previews[1].hasMore).toBe(true);
    expect(previews[2].count).toBe(0);
  });

  it('collectProjectTags and filterProjectsByTag', () => {
    const cards = [
      sample,
      { ...sample, id: 'b', tags: ['실용서'] },
    ];
    expect(collectProjectTags(cards)).toEqual(['1권', '문학', '실용서']);
    expect(filterProjectsByTag(cards, '실용서')).toHaveLength(1);
    expect(filterProjectsByTag(cards, null)).toHaveLength(2);
  });

  it('buildProjectTagFilterOptions always lists presets then extra card tags', () => {
    expect(buildProjectTagFilterOptions([]).map((o) => o.label)).toEqual([
      '전체',
      '시리즈',
      '국내서',
      '외서',
      '문학',
      '비문학',
    ]);
    const options = buildProjectTagFilterOptions([
      sample,
      { ...sample, id: 'b', tags: ['시리즈 2/5', '경제경영'] },
    ]);
    expect(options.map((o) => o.label)).toEqual([
      '전체',
      '시리즈',
      '국내서',
      '외서',
      '문학',
      '비문학',
      '1권',
      '경제경영',
    ]);
    expect(options.find((o) => o.label === '시리즈')?.id).toBe('__series__');
  });

  it('buildProjectTagFilterOptions dedupes identical labels', () => {
    const base = { ...sample, tags: [] };
    const cards = [
      { ...base, id: 'a', tags: ['문학'] },
      { ...base, id: 'b', tags: ['문학', '시리즈 2/5'] },
      { ...base, id: 'c', tags: ['시리즈', '시리즈 3/5'] },
    ];
    expect(buildProjectTagFilterOptions(cards).map((o) => o.label)).toEqual([
      '전체',
      '시리즈',
      '국내서',
      '외서',
      '문학',
      '비문학',
    ]);
  });

  it('filterProjectsForLibrary handles series prefix', () => {
    const cards = [
      sample,
      { ...sample, id: 'b', tags: ['시리즈 2/5'] },
    ];
    expect(filterProjectsForLibrary(cards, '__series__')).toHaveLength(1);
  });
});
