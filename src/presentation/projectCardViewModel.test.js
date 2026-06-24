import { describe, expect, it } from 'vitest';
import {
  buildProjectCardPillarPreviews,
  buildProjectTagFilterOptions,
  collectProjectTags,
  filterProjectsByTag,
  filterProjectsForLibrary,
  formatProjectCardMetaLine,
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
    proofRevision: '2교',
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

  it('formatProjectCardScheduleLines', () => {
    expect(formatProjectCardScheduleLines(sample)).toEqual([
      '26.06.01 생성',
      '26.06.18 작업',
    ]);
  });

  it('formatProjectCardMetaLine', () => {
    expect(formatProjectCardMetaLine(sample)).toBe('원고 100p · 2교');
    expect(
      formatProjectCardMetaLine({ ...sample, formatLabel: '신국판' }),
    ).toBe('원고 100p · 2교 · 신국판');
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

  it('buildProjectTagFilterOptions always includes standard filters', () => {
    const options = buildProjectTagFilterOptions([]);
    expect(options[0]).toEqual({ id: null, label: '전체' });
    expect(options.map((o) => o.label)).toContain('문학');
    expect(options.map((o) => o.label)).toContain('시리즈');
  });

  it('filterProjectsForLibrary handles series prefix', () => {
    const cards = [
      sample,
      { ...sample, id: 'b', tags: ['시리즈 2/5'] },
    ];
    expect(filterProjectsForLibrary(cards, '__series__')).toHaveLength(1);
    expect(filterProjectsForLibrary(cards, '시리즈')).toHaveLength(1);
  });
});
