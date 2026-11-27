/**
 * 모모의 방 공지. Firestore `notices` 문서를 정규화·정렬한다.
 * 쓰기는 Callable(관리자)만 하고, 이 모듈은 읽기용 데이터 모양만 다룬다.
 *
 * 항목 모양: { id, title, body, createdAt, updatedAt, createdByUid, pinned }
 *  - createdAt / updatedAt: 밀리초(Asia/Seoul 표시용)
 */

function asRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function asText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Firestore Timestamp · Date · 숫자 · YYYY-MM-DD 를 밀리초로 바꾼다.
 * @param {unknown} value
 * @returns {number}
 */
export function toNoticeTimeMs(value) {
  if (value == null || value === '') return 0;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const parsed = Date.parse(`${trimmed}T00:00:00+09:00`);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    const parsed = Date.parse(trimmed);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isFinite(ms) ? ms : 0;
  }
  if (typeof value.toMillis === 'function') {
    const ms = value.toMillis();
    return typeof ms === 'number' && Number.isFinite(ms) ? ms : 0;
  }
  if (typeof value.seconds === 'number') {
    return value.seconds * 1000 + Math.floor((value.nanoseconds || 0) / 1e6);
  }
  return 0;
}

/**
 * @param {unknown} raw
 * @returns {{
 *   id: string,
 *   title: string,
 *   body: string,
 *   createdAt: number,
 *   updatedAt: number,
 *   createdByUid: string,
 *   pinned: boolean,
 * }[]}
 */
export function normalizeNotices(raw) {
  const rows = Array.isArray(raw) ? raw : [];
  /** @type {{ id: string, title: string, body: string, createdAt: number, updatedAt: number, createdByUid: string, pinned: boolean }[]} */
  const notices = [];

  rows.forEach((row, index) => {
    const rec = asRecord(row);
    if (!rec) return;
    const title = asText(rec.title);
    if (!title) return;
    const body = typeof rec.body === 'string' ? rec.body.trim() : '';
    const createdAt = toNoticeTimeMs(rec.createdAt) || toNoticeTimeMs(rec.date);
    const updatedAt = toNoticeTimeMs(rec.updatedAt) || createdAt;
    const createdByUid = asText(rec.createdByUid);
    const pinned = rec.pinned === true;
    const id = asText(rec.id) || `notice-${index}-${createdAt || 'undated'}-${title}`;
    notices.push({
      id,
      title,
      body,
      createdAt,
      updatedAt,
      createdByUid,
      pinned,
    });
  });

  return notices;
}

/**
 * 게시판용: 고정글 먼저, 그다음 최신순.
 * @param {ReturnType<typeof normalizeNotices>} notices
 */
export function sortNoticesForBoard(notices) {
  return [...notices].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if (a.createdAt !== b.createdAt) return b.createdAt - a.createdAt;
    if (a.id === b.id) return 0;
    return a.id < b.id ? 1 : -1;
  });
}

/**
 * @param {unknown} raw
 */
export function listNotices(raw) {
  return sortNoticesForBoard(normalizeNotices(raw));
}

/**
 * 대문 알약용: 고정 여부와 관계없이 가장 최신 글.
 * @param {unknown} raw
 */
export function getLatestNotice(raw) {
  const notices = normalizeNotices(raw);
  if (notices.length === 0) return null;
  return [...notices].sort((a, b) => {
    if (a.createdAt !== b.createdAt) return b.createdAt - a.createdAt;
    if (a.id === b.id) return 0;
    return a.id < b.id ? 1 : -1;
  })[0];
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function formatNoticeDate(value) {
  const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? '').trim());
  if (ymd) {
    const year = ymd[1];
    const month = String(Number(ymd[2]));
    const day = String(Number(ymd[3]));
    return `${year}년 ${month}월 ${day}일`;
  }
  const ms = toNoticeTimeMs(value);
  if (!ms) return String(value ?? '').trim();
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    }).formatToParts(new Date(ms));
    const pick = (type) => parts.find((part) => part.type === type)?.value ?? '';
    const year = pick('year');
    const month = pick('month');
    const day = pick('day');
    if (!year || !month || !day) return String(value ?? '').trim();
    return `${year}년 ${month}월 ${day}일`;
  } catch {
    return String(value ?? '').trim();
  }
}

/**
 * 공지 본문 링크. `[텍스트](https://...)` 와 맨 http(s) 주소만 링크로 본다.
 * javascript: 등 http/https 가 아닌 주소는 일반 글자로 둔다.
 *
 * @param {unknown} raw
 * @returns {Array<
 *   | { type: 'text', value: string }
 *   | { type: 'link', href: string, text: string }
 *   | { type: 'break' }
 * >}
 */
export function parseNoticeBodyLinks(raw) {
  const text = typeof raw === 'string' ? raw : '';
  if (!text) return [];

  /** @type {ReturnType<typeof parseNoticeBodyLinks>} */
  const parts = [];
  let buffer = '';

  const flush = () => {
    if (!buffer) return;
    parts.push({ type: 'text', value: buffer });
    buffer = '';
  };

  let index = 0;
  while (index < text.length) {
    const ch = text[index];
    if (ch === '\r') {
      flush();
      parts.push({ type: 'break' });
      index += text[index + 1] === '\n' ? 2 : 1;
      continue;
    }
    if (ch === '\n') {
      flush();
      parts.push({ type: 'break' });
      index += 1;
      continue;
    }

    if (ch === '[') {
      const md = /^\[([^\]]+)\]\(([^)]+)\)/.exec(text.slice(index));
      if (md) {
        const href = toSafeHttpUrl(md[2]);
        if (href) {
          flush();
          parts.push({ type: 'link', href, text: md[1] });
          index += md[0].length;
          continue;
        }
      }
    }

    const bare = takeBareHttpUrl(text, index);
    if (bare) {
      flush();
      parts.push({ type: 'link', href: bare.href, text: bare.text });
      index += bare.length;
      continue;
    }

    buffer += ch;
    index += 1;
  }

  flush();
  return parts;
}

/**
 * @param {unknown} raw
 * @returns {string | null}
 */
function toSafeHttpUrl(raw) {
  const href = typeof raw === 'string' ? raw.trim() : '';
  if (!href || /\s/.test(href)) return null;
  try {
    const url = new URL(href);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return href;
  } catch {
    return null;
  }
}

/**
 * @param {string} text
 * @param {number} start
 * @returns {{ href: string, text: string, length: number } | null}
 */
function takeBareHttpUrl(text, start) {
  const slice = text.slice(start);
  const match = /^(https?:\/\/[^\s<>\[\]{}]+)/i.exec(slice);
  if (!match) return null;
  const trimmed = match[1].replace(/[.,;:!?]+$/, '');
  const href = toSafeHttpUrl(trimmed);
  if (!href) return null;
  return { href, text: trimmed, length: trimmed.length };
}
