import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  STDICT_MAIN_URL,
  stdictLinkFor,
  stdictSearchUrl,
  stdictViewUrl,
} from './stdictLinks.js';
import { STANDARD_KOREAN_DICT_URL } from './koreanNormsLinks.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INDEX_PATH = path.resolve(__dirname, '../../public/data/stdict-link-index.json');

const fakeIndex = {
  가닿다: [1848],
  도중: [413053, 87940, 87941],
};

describe('주소 형식', () => {
  it('직결 화면 주소는 wordNo와 searchKeywordTo=3을 붙인다', () => {
    expect(stdictViewUrl(1848)).toBe(
      'https://kdict.korean.go.kr/standard/search/searchView.do?wordNo=1848&searchKeywordTo=3',
    );
  });

  it('검색 주소는 고칠 말을 UTF-8 퍼센트 인코딩한다', () => {
    expect(stdictSearchUrl('도중')).toBe(
      'https://kdict.korean.go.kr/standard/search/searchResult.do?pageSize=10&searchKeyword=%EB%8F%84%EC%A4%91',
    );
  });

  it('사전 첫 화면 주소는 새 주소다', () => {
    expect(STDICT_MAIN_URL).toBe('https://kdict.korean.go.kr/standard/main/main.do');
  });

  it('편집자 검토 필요 제목 링크도 같은 새 첫 화면 주소를 쓴다', () => {
    expect(STANDARD_KOREAN_DICT_URL).toBe(STDICT_MAIN_URL);
  });
});

describe('stdictLinkFor — 세 경우', () => {
  it('후보 1개면 직결', () => {
    const r = stdictLinkFor('가닿다', fakeIndex);
    expect(r.kind).toBe('direct');
    expect(r.url).toBe(stdictViewUrl(1848));
    expect(r.codes).toEqual([1848]);
  });

  it('후보 여러 개면 검색', () => {
    const r = stdictLinkFor('도중', fakeIndex);
    expect(r.kind).toBe('search');
    expect(r.url).toBe(stdictSearchUrl('도중'));
    expect(r.codes).toEqual([413053, 87940, 87941]);
  });

  it('색인에 없으면 링크 없음', () => {
    expect(stdictLinkFor('말끝에', fakeIndex)).toEqual({ kind: 'none' });
  });

  it('색인이 없거나 빈 값이어도 링크 없음', () => {
    expect(stdictLinkFor('가닿다', null)).toEqual({ kind: 'none' });
    expect(stdictLinkFor('가닿다', undefined)).toEqual({ kind: 'none' });
    expect(stdictLinkFor('가닿다', { 가닿다: [] })).toEqual({ kind: 'none' });
  });

  it('fallback=search 이면 색인에 없어도 검색 화면으로 보낸다', () => {
    const r = stdictLinkFor('대로', fakeIndex, { fallback: 'search' });
    expect(r.kind).toBe('search');
    expect(r.url).toBe(stdictSearchUrl('대로'));
  });

  it('fallback=search 여도 후보 1개면 직결을 쓴다', () => {
    const r = stdictLinkFor('가닿다', fakeIndex, { fallback: 'search' });
    expect(r.kind).toBe('direct');
    expect(r.url).toBe(stdictViewUrl(1848));
  });

  it('wordNo가 있으면 검색어와 상관없이 그 항으로 직결한다', () => {
    const r = stdictLinkFor('조사', fakeIndex, { fallback: 'search', wordNo: 78254 });
    expect(r).toEqual({
      kind: 'direct',
      url: stdictViewUrl(78254),
      codes: [78254],
    });
  });
});

describe('실제 색인 파일 대조', () => {
  const index = JSON.parse(readFileSync(INDEX_PATH, 'utf8')).entries;

  it('항목 수가 보고와 같다 (1,006)', () => {
    expect(Object.keys(index)).toHaveLength(1006);
  });

  it('확인 단어가 보고한 코드로 간다', () => {
    expect(stdictLinkFor('가닿', index)).toEqual({
      kind: 'direct',
      url: stdictViewUrl(1848),
      codes: [1848],
    });
    expect(stdictLinkFor('맞닿', index).codes).toEqual([112711]);
    expect(stdictLinkFor('외로워했', index).codes).toEqual([534021]);
    expect(stdictLinkFor('참고삼', index).codes).toEqual([487509]);
    expect(stdictLinkFor('그럴싸', index).codes).toEqual([44725]);
  });

  it('도중은 길을 가는 중간(도중04)으로 직결한다', () => {
    const r = stdictLinkFor('도중', index);
    expect(r).toEqual({
      kind: 'direct',
      url: stdictViewUrl(413054),
      codes: [413054],
    });
  });

  it('이편은 지시 대명사로 직결한다', () => {
    const r = stdictLinkFor('이편', index);
    expect(r.kind).toBe('direct');
    expect(r.codes).toEqual([469628]);
  });

  it('감색은 감의 빛깔로 직결한다', () => {
    const r = stdictLinkFor('감색', index);
    expect(r.kind).toBe('direct');
    expect(r.codes).toEqual([3336]);
  });

  it('^끝 규칙의 말끝에 등 6개는 링크 없음', () => {
    for (const w of ['말끝에', '말끝을', '말끝마다', '말끝이', '뒤끝 없', '뒤끝이 없']) {
      expect(stdictLinkFor(w, index)).toEqual({ kind: 'none' });
    }
  });
});
