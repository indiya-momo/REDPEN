import { describe, expect, it } from 'vitest';
import {
  HANGUL_ORTHOGRAPHY_ARTICLES,
  findHangulOrthographyArticle,
  groupHangulOrthographyTree,
} from './hangulOrthographyArticles.js';

describe('hangulOrthographyArticles', () => {
  it('제1–57항이 빠짐없이 들어 있다', () => {
    expect(HANGUL_ORTHOGRAPHY_ARTICLES.map((a) => a.number)).toEqual(
      Array.from({ length: 57 }, (_, i) => i + 1),
    );
    for (const art of HANGUL_ORTHOGRAPHY_ARTICLES) {
      expect(art.text.length).toBeGreaterThan(8);
      expect(art.text.includes(' ')).toBe(true);
    }
  });

  it('제46항 조문 용례는 마침표를 붙인다', () => {
    const art = findHangulOrthographyArticle('art-46');
    expect(art.ruleExamples).toEqual(['좀더 큰것.', '이말 저말.', '한잎 두잎.']);
  });

  it('제47항 구성 분류는 인용과 나눈다', () => {
    const art = findHangulOrthographyArticle('art-47');
    expect(art.constructions).toEqual([
      '본용언+-아/-어+보조 용언',
      '관형사형+보조 용언(의존 명사+-하다/싶다)',
    ]);
    expect(art.commentary?.quotes).toBeUndefined();
    expect(art.proviso.startsWith('다만,')).toBe(true);
  });

  it('해설 인용은 조항당 두 문장 이하다', () => {
    for (const art of HANGUL_ORTHOGRAPHY_ARTICLES) {
      expect((art.commentary?.quotes ?? []).length).toBeLessThanOrEqual(2);
    }
  });

  it('목차는 본문 장·절로 묶인다', () => {
    const tree = groupHangulOrthographyTree();
    expect(tree[0].chapter).toBe('제1장 총칙');
    expect(tree[0].sections[0].articles.map((a) => a.number)).toEqual([1, 2, 3]);
    const spacing = tree.find((c) => c.chapter === '제5장 띄어쓰기');
    expect(spacing.sections.map((s) => s.section)).toEqual([
      '제1절 조사',
      '제2절 의존 명사, 단위를 나타내는 명사 및 열거하는 말 등',
      '제3절 보조 용언',
      '제4절 고유 명사 및 전문 용어',
    ]);
  });

  it('조문 용례 끝에는 마침표를 붙인다', () => {
    for (const art of HANGUL_ORTHOGRAPHY_ARTICLES) {
      for (const ex of art.ruleExamples ?? []) {
        expect(/[.!?…)]$/.test(ex) || /\/$/.test(ex)).toBe(true);
      }
    }
  });
});
