import { describe, expect, it } from 'vitest';
import {
  HANGUL_ORTHOGRAPHY_ARTICLES,
  findHangulOrthographyArticle,
  groupHangulOrthographyTree,
  searchHangulOrthographyArticles,
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

  it('제43항 조문 용례는 해설서 띄어쓰기를 유지하고 해설을 섞지 않는다', () => {
    const art = findHangulOrthographyArticle('art-43');
    expect(art.ruleExamples).toEqual([
      '한 개 차 한 대 금 서 돈 소 한 마리',
      '옷 한 벌 열 살 조기 한 손 연필 한 자루',
      '버선 한 죽 집 한 채 신 두 켤레 북어 한 쾌',
    ]);
    expect(art.ruleExamples.join('')).not.toMatch(/의존 명사이든/);
    expect(art.commentary.quotes[0]).toBe(
      '단위를 나타내는 말은 의존 명사이든 자립 명사이든 하나의 단어로 인정되는 명사이므로 앞말과 띄어 써야 한다.',
    );
    expect(art.commentary.quotes.at(-1)).toBe(
      '10 명(원칙) / 10명(허용) 2 학년(원칙) / 2학년(허용)',
    );
  });

  it('제47항 해설 전문을 둔다', () => {
    const art = findHangulOrthographyArticle('art-47');
    expect(art.constructions).toBeUndefined();
    expect(art.commentary.quotes[0].startsWith('보조 용언도 하나의 단어이므로')).toBe(true);
    expect(art.commentary.quotes.at(-1)).toBe('되어 가는 듯하다. / 되어가는 듯하다.');
    expect(art.proviso.startsWith('다만,')).toBe(true);
  });

  it('조문 용례에 해설 문장을 섞지 않는다', () => {
    for (const art of HANGUL_ORTHOGRAPHY_ARTICLES) {
      const blob = (art.ruleExamples ?? []).join(' ');
      expect(blob).not.toMatch(/이 조항은 |혼동이 되는 말|1933년의|자립성이 없어 다른 말/);
    }
    const art44 = findHangulOrthographyArticle('art-44');
    expect(art44.ruleExamples).toEqual([
      '십이억 삼천사백오십육만 칠천팔백구십팔',
      '12억 3456만 7898',
    ]);
    const art45 = findHangulOrthographyArticle('art-45');
    expect(art45.ruleExamples.join('')).not.toMatch(/의존 명사로 다루어/);
    expect(art45.commentary.quotes[0].startsWith('①')).toBe(true);
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

  it('제46·47항 문장 용례는 마침표를 유지한다', () => {
    const art46 = findHangulOrthographyArticle('art-46');
    for (const ex of art46.ruleExamples) {
      expect(/[.!?…)]$/.test(ex)).toBe(true);
    }
    const art47 = findHangulOrthographyArticle('art-47');
    for (const ex of art47.ruleExamples) {
      expect(/[.!?…)]$/.test(ex) || /\/$/.test(ex)).toBe(true);
    }
  });

  it('검색은 이 페이지 조항만 찾고 번호·용례·해설을 본다', () => {
    expect(searchHangulOrthographyArticles('')).toEqual([]);
    expect(searchHangulOrthographyArticles('47').map((h) => h.article.number)).toEqual([47]);
    expect(searchHangulOrthographyArticles('제46항').map((h) => h.article.number)).toEqual([46]);
    expect(searchHangulOrthographyArticles('좀더 큰것').map((h) => h.article.number)).toEqual([46]);
    expect(searchHangulOrthographyArticles('본용언+-아').map((h) => h.article.number)).toEqual([47]);
    expect(searchHangulOrthographyArticles('외래어 표기법').map((h) => h.article.number)).toEqual([3]);
  });
});
