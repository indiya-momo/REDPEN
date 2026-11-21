/**
 * 대문 공지. `src/data/notices.json`을 읽는다.
 * Google 시트 동기화(`npm run sync`) 대상이 아니므로 이 JSON은 덮어쓰이지 않는다.
 *
 * 항목 모양: { id, date, title, body }
 *  - id: 고유 문자열
 *  - date: YYYY-MM-DD (최신순 정렬에 사용)
 *  - title: 알약과 팝업에 보이는 제목
 *  - body: 팝업 본문
 */
import noticesJson from '../data/notices.json';

function asRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function asText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * @param {unknown} raw
 * @returns {{ id: string, date: string, title: string, body: string }[]}
 */
export function normalizeNotices(raw) {
  const rows = Array.isArray(raw) ? raw : [];
  /** @type {{ id: string, date: string, title: string, body: string }[]} */
  const notices = [];

  rows.forEach((row, index) => {
    const rec = asRecord(row);
    if (!rec) return;
    const title = asText(rec.title);
    if (!title) return;
    const date = asText(rec.date);
    const body = typeof rec.body === 'string' ? rec.body.trim() : '';
    const id = asText(rec.id) || `notice-${index}-${date || 'undated'}-${title}`;
    notices.push({ id, date, title, body });
  });

  notices.sort((a, b) => {
    if (a.date && b.date && a.date !== b.date) {
      return a.date < b.date ? 1 : -1;
    }
    if (a.date && !b.date) return -1;
    if (!a.date && b.date) return 1;
    if (a.id === b.id) return 0;
    return a.id < b.id ? 1 : -1;
  });

  return notices;
}

/**
 * @param {unknown} [raw]
 */
export function listNotices(raw = noticesJson) {
  return normalizeNotices(raw);
}

/**
 * @param {unknown} [raw]
 */
export function getLatestNotice(raw = noticesJson) {
  return listNotices(raw)[0] ?? null;
}

/**
 * @param {string} date
 * @returns {string}
 */
export function formatNoticeDate(date) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date ?? '').trim());
  if (!match) return String(date ?? '').trim();
  const year = match[1];
  const month = String(Number(match[2]));
  const day = String(Number(match[3]));
  return `${year}년 ${month}월 ${day}일`;
}
