import { describe, expect, it } from 'vitest';
import {
  collectProjectTags,
  filterProjectsByTag,
  formatProjectCardMetaLine,
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
    lastWork: { date: '6/18', manuscriptPages: 100 },
  };

  it('formatProjectCardTitleLine', () => {
    expect(formatProjectCardTitleLine(sample)).toBe(
      '[문학 · 1권] 《테스트》 기준',
    );
  });

  it('formatProjectCardMetaLine', () => {
    expect(formatProjectCardMetaLine(sample)).toContain('100p');
    expect(formatProjectCardMetaLine(sample)).toContain('6/18');
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
});
