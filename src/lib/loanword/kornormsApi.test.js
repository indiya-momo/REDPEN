import { describe, expect, it } from 'vitest';
import {
  mapKornormsItem,
  parseKornormsXmlResponse,
  parseRelateMarkList,
} from './kornormsApi.js';
import {
  classifyHangulMatch,
  hangulQueryVariants,
  lookupYongryeByHangul,
  normalizeLoanwordQuery,
  pickBestHangulTokenItem,
  queryHasHangul,
  queryLooksLatin,
  queryNeedsSourceLookup,
  scoreHangulTokenMatch,
  srcMatchesLatinQuery,
  srcMatchesSourceQuery,
  stripSrcReading,
} from './loanwordQuery.js';

describe('parseRelateMarkList', () => {
  it('오표기 (X) 표기를 벗긴다', () => {
    expect(parseRelateMarkList('캐어디건(X), 가디건(X)')).toEqual([
      '캐어디건',
      '가디건',
    ]);
  });

  it('빈 값·대시는 빈 배열', () => {
    expect(parseRelateMarkList('')).toEqual([]);
    expect(parseRelateMarkList('-')).toEqual([]);
  });
});

describe('mapKornormsItem', () => {
  it('응답 항목을 용례 형태로 매핑한다', () => {
    expect(
      mapKornormsItem({
        korean_mark: '카디건',
        srclang_mark: 'cardigan',
        foreign_gubun: '일반 용어',
        mean: '스웨터',
        guk_nm: '영국',
        lang_nm: '영어',
        relate_mark_e: '-',
        relate_mark_o: '가디건(X)',
      }),
    ).toEqual({
      h: '카디건',
      src: 'cardigan',
      c: '일반 용어',
      m: '스웨터',
      guk: '영국',
      lang: '영어',
      o: ['가디건'],
    });
  });
});

describe('parseKornormsXmlResponse', () => {
  it('xml items·오표기를 파싱한다', () => {
    const xml = `<?xml version="1.0"?><response>
      <totalCount>1</totalCount>
      <items>
        <korean_mark>카디건</korean_mark>
        <srclang_mark>cardigan</srclang_mark>
        <foreign_gubun>일반 용어</foreign_gubun>
        <mean>스웨터</mean>
        <guk_nm>영국</guk_nm>
        <lang_nm>영어</lang_nm>
        <relate_mark_e></relate_mark_e>
        <relate_mark_o>가디건(X),</relate_mark_o>
      </items>
      <resultCode>0</resultCode>
      <resultMsg>NORMAL SERVICE</resultMsg>
    </response>`;
    const parsed = parseKornormsXmlResponse(xml);
    expect(parsed.resultCode).toBe('0');
    expect(parsed.totalCount).toBe(1);
    expect(parsed.items[0]).toMatchObject({
      h: '카디건',
      src: 'cardigan',
      o: ['가디건'],
      guk: '영국',
      lang: '영어',
    });
  });
});

describe('loanwordQuery helpers', () => {
  it('한글·라틴·원어 입력을 구분한다', () => {
    expect(queryHasHangul('가디건')).toBe(true);
    expect(queryLooksLatin('cardigan')).toBe(true);
    expect(queryLooksLatin('Stephen King')).toBe(true);
    expect(queryLooksLatin('가디건')).toBe(false);
    expect(queryNeedsSourceLookup('伊藤博文')).toBe(true);
    expect(queryNeedsSourceLookup('伊藤󠄁博󠄁文')).toBe(true);
    expect(queryNeedsSourceLookup('Москва')).toBe(true);
    expect(queryNeedsSourceLookup('Ελλάδα')).toBe(true);
    expect(queryLooksLatin('伊藤博文')).toBe(false);
    expect(queryNeedsSourceLookup('cardigan')).toBe(false);
  });

  it('이체자 선택자를 정규화한다', () => {
    expect(normalizeLoanwordQuery('伊藤󠄁博󠄁文')).toBe('伊藤博文');
    expect(stripSrcReading('伊藤博文(いとう ひろぶみ)')).toBe('伊藤博文');
  });

  it('가나 질의는 괄호 안 읽기·포함 검색 (손 마사요시 / いとう)', () => {
    expect(
      srcMatchesSourceQuery('孫正義(そん まさよし)', 'そん まさよし'),
    ).toBe(true);
    expect(srcMatchesSourceQuery('孫正義(そん まさよし)', '孫正義')).toBe(
      true,
    );
    expect(srcMatchesSourceQuery('伊東良孝(いとう よしたか)', 'いとう')).toBe(
      false,
    );
    expect(srcMatchesSourceQuery('齋藤實(さいとう まこと)', 'いとう')).toBe(
      false,
    );
    expect(srcMatchesSourceQuery('大東(だいとう)섬', 'いとう')).toBe(false);
    expect(srcMatchesSourceQuery('孫正義(そん まさよし)', 'いとう')).toBe(
      false,
    );
    expect(srcMatchesSourceQuery('いとう', 'いとう')).toBe(true);
  });

  it('라틴 원어 질의 매칭 (Merkel / Merkel, Angela)', () => {
    expect(srcMatchesLatinQuery('Merkel', 'Merkel')).toBe(true);
    expect(srcMatchesLatinQuery('DAVID', 'david')).toBe(true);
    expect(srcMatchesLatinQuery('Merkel, Angela', 'merkel')).toBe(false);
    expect(srcMatchesLatinQuery('david hill', 'david')).toBe(false);
    expect(srcMatchesLatinQuery('Merkel 소체', 'Merkel')).toBe(false);
    expect(srcMatchesLatinQuery('Weidmann, Jens', 'Merkel')).toBe(false);
  });

  it('매치 종류를 분류한다', () => {
    const items = [
      { h: '카디건', a: ['카디갠'], o: ['가디건'], src: 'cardigan' },
    ];
    expect(classifyHangulMatch('카디건', items)).toBe('exact');
    expect(classifyHangulMatch('카디갠', items)).toBe('alt');
    expect(classifyHangulMatch('가디건', items)).toBe('typo');
    expect(classifyHangulMatch('다른말', items)).toBe('other');
  });

  it('로컬 용례 한글·이표기 역검색(공백 무시)', () => {
    const yongrye = {
      solution: [
        { h: '솔루션', a: ['설루션'], c: '일반 용어', m: '해결책' },
      ],
      phrase: [{ h: '킹스 클럽', c: '일반 용어' }],
    };
    expect(lookupYongryeByHangul('설루션', yongrye)[0].h).toBe('솔루션');
    expect(lookupYongryeByHangul('킹스클럽', yongrye)[0].h).toBe('킹스 클럽');
    expect(lookupYongryeByHangul('없는말', yongrye)).toEqual([]);
  });

  it('한글 질의 변형', () => {
    expect(hangulQueryVariants('스티븐 킹')).toEqual(['스티븐 킹', '스티븐킹']);
  });

  it('단어별 매치 점수·선별', () => {
    expect(
      scoreHangulTokenMatch('스티븐', { h: '스티븐', src: 'Stephen' }),
    ).toBe(100);
    expect(
      scoreHangulTokenMatch('가디건', {
        h: '카디건',
        o: ['가디건'],
        src: 'cardigan',
      }),
    ).toBe(90);
    expect(
      pickBestHangulTokenItem('킹', [
        { h: '워킹', src: 'working' },
        { h: '킹', src: 'king' },
      ])?.h,
    ).toBe('킹');
    expect(
      pickBestHangulTokenItem('스티븐', [
        { h: '마이런, 스티븐 아이라', src: 'x' },
      ]),
    ).toBe(null);
    expect(
      pickBestHangulTokenItem(
        '스티븐',
        [{ h: '마이런, 스티븐 아이라', src: 'x' }],
        { minScore: 50 },
      ),
    ).toEqual({ h: '스티븐' });
  });

  it('구문 조합 시 오표기(킹→칭)로 단어를 바꾸지 않는다', () => {
    const pool = [
      { h: '칭', src: 'Qing[淸]', o: ['친', '췬', '킹', '큉'], m: '=칭하이 성.' },
      { h: '킹', src: 'King' },
      { h: '비더, 킹', src: 'Vidor, King' },
    ];
    // 단일 조회: 오표기 교정 허용 → 칭이 더 높을 수 있음
    expect(scoreHangulTokenMatch('킹', pool[0])).toBe(90);
    // 구문 조합: 오표기 무시 → 완전일치 킹
    expect(
      pickBestHangulTokenItem('킹', pool, { minScore: 50, allowTypo: false })?.h,
    ).toBe('킹');
    expect(
      pickBestHangulTokenItem('킹', pool, { minScore: 50, allowTypo: false })
        ?.src,
    ).toBe('King');
  });
});
