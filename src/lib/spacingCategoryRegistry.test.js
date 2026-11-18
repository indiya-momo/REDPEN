import { describe, expect, it } from 'vitest';
import {
  SPACING_CATEGORY_DEFS,
  countSpacingHitsOnPage,
  spacingHitsToGroups,
} from './spacingCategoryRegistry.js';

describe('spacingCategoryRegistry', () => {
  it('수사·세종 백로그 모듈이 모두 등록된다', () => {
    const ids = SPACING_CATEGORY_DEFS.map((d) => d.id);
    expect(ids).toEqual([
      'numeral',
      'man-eok-jo',
      'digit-unit',
      'adnominal-dep',
      'noun-pred',
      'rieul-kka',
      'n-ji',
      'n-ba',
      'han-beon',
      'daeum-nal',
      'official-aux',
      'place-affix',
    ]);
    for (const def of SPACING_CATEGORY_DEFS) {
      expect(typeof def.label).toBe('string');
      expect(def.label.length).toBeGreaterThan(0);
      expect(typeof def.tip).toBe('string');
      expect(typeof def.findHits).toBe('function');
    }
  });

  it('hits → groups → 페이지 건수', () => {
    const hits = [
      {
        pageNum: 1,
        index: 0,
        matchedText: '천 오백',
        suggestedText: '천오백',
        categoryId: 'numeral',
        label: '수사 띄어쓰기',
      },
      {
        pageNum: 2,
        index: 3,
        matchedText: '될수',
        suggestedText: '될 수',
        categoryId: 'adnominal-dep',
        label: '관형사형+의존명사',
      },
    ];
    const groups = spacingHitsToGroups(hits);
    expect(groups).toHaveLength(2);
    expect(groups[0].category).toBe('numeral');
    expect(groups[0].instances[0].pageNum).toBe(1);
    expect(countSpacingHitsOnPage(groups, 1)).toBe(1);
    expect(countSpacingHitsOnPage(groups, 2)).toBe(1);
    expect(countSpacingHitsOnPage(groups, 9)).toBe(0);
  });
});
