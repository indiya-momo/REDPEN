import { describe, expect, it } from 'vitest';
import {
  formatNoticeDate,
  getLatestNotice,
  listNotices,
  normalizeNotices,
  parseNoticeBodyLinks,
  toNoticeTimeMs,
} from './notices.js';

describe('normalizeNotices / listNotices', () => {
  it('고정글을 먼저 두고, 같은 그룹에서는 최신순이다', () => {
    const list = listNotices([
      { id: 'old', title: '예전', createdAt: Date.parse('2026-01-01T00:00:00+09:00') },
      { id: 'new', title: '새 글', createdAt: Date.parse('2026-12-01T00:00:00+09:00') },
      {
        id: 'pin',
        title: '고정',
        createdAt: Date.parse('2026-02-01T00:00:00+09:00'),
        pinned: true,
      },
    ]);
    expect(list.map((n) => n.id)).toEqual(['pin', 'new', 'old']);
  });

  it('제목이 없는 항목은 뺀다', () => {
    const list = normalizeNotices([
      { id: 'ok', title: '있음', createdAt: 1 },
      { id: 'empty', title: '  ', createdAt: 2 },
      { id: 'missing', createdAt: 3 },
    ]);
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('ok');
  });

  it('빈 목록이면 빈 배열이다', () => {
    expect(normalizeNotices([])).toEqual([]);
    expect(normalizeNotices(null)).toEqual([]);
  });

  it('Firestore Timestamp 모양을 밀리초로 읽는다', () => {
    const ms = Date.parse('2026-12-01T00:00:00+09:00');
    const list = normalizeNotices([
      {
        id: 'ts',
        title: '타임스탬프',
        createdAt: { seconds: ms / 1000, nanoseconds: 0 },
        pinned: false,
      },
    ]);
    expect(list[0].createdAt).toBe(ms);
  });
});

describe('getLatestNotice', () => {
  it('고정글이 있어도 가장 최신 글을 돌려 준다', () => {
    const latest = getLatestNotice([
      {
        id: 'pin',
        title: '고정',
        createdAt: Date.parse('2026-02-01T00:00:00+09:00'),
        pinned: true,
      },
      {
        id: 'new',
        title: '새 글',
        createdAt: Date.parse('2026-12-01T00:00:00+09:00'),
      },
    ]);
    expect(latest?.id).toBe('new');
  });

  it('공지가 없으면 알약을 숨길 수 있게 null을 준다', () => {
    expect(getLatestNotice([])).toBeNull();
    expect(getLatestNotice(null)).toBeNull();
  });
});

describe('formatNoticeDate', () => {
  it('YYYY-MM-DD를 한글 날짜로 바꾼다', () => {
    expect(formatNoticeDate('2026-12-01')).toBe('2026년 12월 1일');
    expect(formatNoticeDate('2026-01-09')).toBe('2026년 1월 9일');
  });

  it('밀리초와 Timestamp를 한국 시간 날짜로 바꾼다', () => {
    const ms = Date.parse('2026-12-01T00:00:00+09:00');
    expect(formatNoticeDate(ms)).toBe('2026년 12월 1일');
    expect(formatNoticeDate({ seconds: ms / 1000, nanoseconds: 0 })).toBe(
      '2026년 12월 1일',
    );
  });

  it('형식이 아니면 그대로 둔다', () => {
    expect(formatNoticeDate('26/12/01')).toBe('26/12/01');
  });
});

describe('toNoticeTimeMs', () => {
  it('빈 값은 0이다', () => {
    expect(toNoticeTimeMs(null)).toBe(0);
    expect(toNoticeTimeMs('')).toBe(0);
  });
});

describe('parseNoticeBodyLinks', () => {
  it('마크다운 링크를 링크로 바꾼다', () => {
    expect(parseNoticeBodyLinks('[다운받기](https://example.com/file.zip)')).toEqual([
      {
        type: 'link',
        href: 'https://example.com/file.zip',
        text: '다운받기',
      },
    ]);
  });

  it('맨 http(s) 주소도 링크로 바꾼다', () => {
    expect(parseNoticeBodyLinks('여기 https://example.com 를 보세요')).toEqual([
      { type: 'text', value: '여기 ' },
      {
        type: 'link',
        href: 'https://example.com',
        text: 'https://example.com',
      },
      { type: 'text', value: ' 를 보세요' },
    ]);
  });

  it('javascript: 주소는 링크로 만들지 않는다', () => {
    expect(parseNoticeBodyLinks('[악](javascript:alert(1))')).toEqual([
      { type: 'text', value: '[악](javascript:alert(1))' },
    ]);
    expect(parseNoticeBodyLinks('javascript:alert(1)')).toEqual([
      { type: 'text', value: 'javascript:alert(1)' },
    ]);
  });

  it('줄바꿈을 유지한다', () => {
    expect(parseNoticeBodyLinks('첫 줄\n둘째 줄')).toEqual([
      { type: 'text', value: '첫 줄' },
      { type: 'break' },
      { type: 'text', value: '둘째 줄' },
    ]);
  });
});
