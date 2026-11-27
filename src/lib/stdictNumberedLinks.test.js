import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  STDICT_NUMBERED_LINKS,
  stdictNumberedLinksFor,
  stdictNumberLabel,
} from './stdictNumberedLinks.js';

const realIndex = JSON.parse(
  readFileSync(new URL('../../public/data/stdict-link-index.json', import.meta.url), 'utf8'),
).entries;

describe('stdictNumberedLinksFor', () => {
  it('신소리는 01·02 번호별로 직결한다', () => {
    const list = stdictNumberedLinksFor('신소리', { 신소리: [209783, 453792] });
    expect(list.map((e) => [stdictNumberLabel(e.no), e.wordNo])).toEqual([
      ['01', 453792],
      ['02', 209783],
    ]);
  });

  it('5개 말의 번호별 링크 수가 설계안과 같다', () => {
    expect(
      Object.fromEntries(Object.entries(STDICT_NUMBERED_LINKS).map(([w, l]) => [w, l.length])),
    ).toEqual({ 신소리: 2, 애저녁: 2, 경제권: 2, 호박색: 2, 선소리: 3 });
    expect(STDICT_NUMBERED_LINKS.선소리.map((e) => e.wordNo)).toEqual([178008, 178010, 178012]);
  });

  it('색인이 없거나 번호가 빠져 있으면 쓰지 않는다', () => {
    expect(stdictNumberedLinksFor('신소리', null)).toBeNull();
    expect(stdictNumberedLinksFor('신소리', { 신소리: [453792] })).toBeNull();
  });

  it('번호별 직결 말이 아니면 null', () => {
    expect(stdictNumberedLinksFor('감색', { 감색: [3336] })).toBeNull();
  });

  it('실제 색인에 표의 번호가 모두 들어 있다', () => {
    for (const [word, list] of Object.entries(STDICT_NUMBERED_LINKS)) {
      for (const e of list) expect(realIndex[word], word).toContain(e.wordNo);
    }
  });
});
