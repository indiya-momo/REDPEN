import { describe, expect, it } from 'vitest';
import {
  formatNoticeDate,
  getLatestNotice,
  listNotices,
  normalizeNotices,
} from './notices.js';

describe('normalizeNotices', () => {
  it('날짜가 최신인 공지를 앞에 둔다', () => {
    const list = normalizeNotices([
      { id: 'old', date: '2026-01-01', title: '예전' },
      { id: 'new', date: '2026-12-01', title: '새 글' },
    ]);
    expect(list.map((n) => n.id)).toEqual(['new', 'old']);
  });

  it('제목이 없는 항목은 뺀다', () => {
    const list = normalizeNotices([
      { id: 'ok', date: '2026-12-01', title: '있음' },
      { id: 'empty', date: '2026-12-02', title: '  ' },
      { id: 'missing', date: '2026-12-03' },
    ]);
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('ok');
  });

  it('빈 목록이면 빈 배열이다', () => {
    expect(normalizeNotices([])).toEqual([]);
    expect(normalizeNotices(null)).toEqual([]);
  });
});

describe('listNotices / getLatestNotice', () => {
  it('시드 공지가 있고 최신 제목을 돌려 준다', () => {
    const list = listNotices();
    expect(list.length).toBeGreaterThan(0);
    expect(getLatestNotice()?.title).toBe(list[0].title);
    expect(getLatestNotice()?.title).toMatch(/표준국어대사전/);
  });

  it('공지가 없으면 알약을 숨길 수 있게 null을 준다', () => {
    expect(getLatestNotice([])).toBeNull();
  });
});

describe('formatNoticeDate', () => {
  it('YYYY-MM-DD를 한글 날짜로 바꾼다', () => {
    expect(formatNoticeDate('2026-12-01')).toBe('2026년 12월 1일');
    expect(formatNoticeDate('2026-01-09')).toBe('2026년 1월 9일');
  });

  it('형식이 아니면 그대로 둔다', () => {
    expect(formatNoticeDate('26/12/01')).toBe('26/12/01');
  });
});
