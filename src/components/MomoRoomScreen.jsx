import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, BookOpen, X } from 'lucide-react';
import roomLibraryImg from '../assets/welcome/welcome_library2.png';
import { momoRoomStoryPages } from '../data/momoRoomStory.js';

const GUESTBOOK_KEY = 'momo-room-guestbook-v1';
const GUESTBOOK_USER_KEY = 'momo-room-guestbook-user-id';
const GUESTBOOK_MAX_CHARS = 50;

/** @returns {{ id: string, name: string, message: string, createdAt: string, authorId?: string }[]} */
function loadGuestbook() {
  try {
    const raw = localStorage.getItem(GUESTBOOK_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (row) =>
          row &&
          typeof row.id === 'string' &&
          typeof row.name === 'string' &&
          typeof row.message === 'string' &&
          typeof row.createdAt === 'string',
      )
      .slice(0, 40);
  } catch {
    return [];
  }
}

/** @param {{ id: string, name: string, message: string, createdAt: string }[]} rows */
function saveGuestbook(rows) {
  localStorage.setItem(GUESTBOOK_KEY, JSON.stringify(rows));
}

function loadGuestbookUserId() {
  try {
    const existing = localStorage.getItem(GUESTBOOK_USER_KEY);
    if (existing) return existing;
    const created = `guest-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem(GUESTBOOK_USER_KEY, created);
    return created;
  } catch {
    return `guest-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }
}

/**
 * @param {{ onClose: () => void }} props
 */
export default function MomoRoomScreen({ onClose }) {
  const [storyOpen, setStoryOpen] = useState(false);
  const [storyPage, setStoryPage] = useState(0);
  const [guestbookRows, setGuestbookRows] = useState(() => loadGuestbook());
  const [guestbookUserId] = useState(() => loadGuestbookUserId());
  const [guestName, setGuestName] = useState('');
  const [guestMessage, setGuestMessage] = useState('');
  const [guestbookNotice, setGuestbookNotice] = useState('');

  const page = momoRoomStoryPages[storyPage];
  const isLastPage = storyPage >= momoRoomStoryPages.length - 1;

  const openStory = useCallback(() => {
    setStoryPage(0);
    setStoryOpen(true);
  }, []);

  const closeStory = useCallback(() => {
    setStoryOpen(false);
    setStoryPage(0);
  }, []);

  const goNextPage = useCallback(() => {
    if (isLastPage) {
      closeStory();
      return;
    }
    setStoryPage((p) => p + 1);
  }, [closeStory, isLastPage]);

  useEffect(() => {
    if (!storyOpen) return undefined;

    const onKeyDown = (e) => {
      if (e.key === 'Escape') closeStory();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [storyOpen, closeStory]);

  useEffect(() => {
    saveGuestbook(guestbookRows);
  }, [guestbookRows]);

  // 레거시 데이터(작성자 ID 없음)는 현재 브라우저 사용자 소유로 보정
  // -> 기존에 본인이 남긴 글에도 삭제 버튼이 보이도록 함
  useEffect(() => {
    setGuestbookRows((prev) => {
      let changed = false;
      const next = prev.map((row) => {
        if (row.authorId) return row;
        changed = true;
        return { ...row, authorId: guestbookUserId };
      });
      return changed ? next : prev;
    });
  }, [guestbookUserId]);

  const submitGuestbook = useCallback(() => {
    const name = guestName.trim();
    const message = guestMessage.trim();
    if (!name || !message) {
      setGuestbookNotice('이름과 방명록을 모두 입력해 주세요.');
      return;
    }
    if (message.length > GUESTBOOK_MAX_CHARS) {
      setGuestbookNotice(`방명록은 ${GUESTBOOK_MAX_CHARS}자까지만 입력할 수 있어요.`);
      return;
    }
    const exists = guestbookRows.some((row) => row.name === name);
    if (exists) {
      setGuestbookNotice('1인당 1회만 작성할 수 있어요.');
      return;
    }
    setGuestbookRows((prev) => [
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name,
        message,
        createdAt: new Date().toISOString(),
        authorId: guestbookUserId,
      },
      ...prev,
    ]);
    setGuestName('');
    setGuestMessage('');
    setGuestbookNotice('방명록이 등록되었습니다.');
  }, [guestName, guestMessage, guestbookRows, guestbookUserId]);

  const removeGuestbookRow = useCallback((id) => {
    setGuestbookRows((prev) => prev.filter((row) => row.id !== id));
  }, []);

  return (
    <div className="momo-room">
      <div className="momo-room__layout">
        <aside className="momo-room__side">
          <div className="momo-room__side-top">
            <p className="momo-room__eyebrow">◆ 어서오세요 ◆</p>
            <div className="momo-room__title-row">
              <h1 className="momo-room__title">모모의 방</h1>
              <span className="momo-room__title-actions">
                <button
                  type="button"
                  className="momo-room__close"
                  onClick={onClose}
                  aria-label="돌아가기"
                  title="돌아가기"
                >
                  <ArrowLeft size={18} strokeWidth={2.2} aria-hidden />
                </button>
              </span>
            </div>
            <p className="momo-room__lead">
              이곳은 모모와 집사가 문장을 살펴보는 비밀스러운 공간입니다
            </p>
          </div>

          <section className="momo-room__guestbook" aria-label="방명록">
            <div className="momo-room__guestbook-head">
              <p className="momo-room__guestbook-title">방명록</p>
            </div>
            <div className="momo-room__guestbook-form">
              <input
                type="text"
                className="momo-room__guestbook-name"
                placeholder="이름"
                value={guestName}
                maxLength={20}
                onChange={(e) => setGuestName(e.target.value)}
              />
              <textarea
                className="momo-room__guestbook-input"
                placeholder="50자까지 가능합니다"
                value={guestMessage}
                maxLength={GUESTBOOK_MAX_CHARS}
                onChange={(e) => setGuestMessage(e.target.value)}
              />
              <div className="momo-room__guestbook-actions">
                <span className="momo-room__guestbook-count">
                  {guestMessage.trim().length}/{GUESTBOOK_MAX_CHARS}
                </span>
                <button
                  type="button"
                  className="momo-room__guestbook-submit"
                  onClick={submitGuestbook}
                >
                  남기기
                </button>
              </div>
            </div>
            {guestbookNotice ? (
              <p className="momo-room__guestbook-notice">{guestbookNotice}</p>
            ) : null}
            <ul className="momo-room__guestbook-list">
              {guestbookRows.map((row) => (
                <li key={row.id} className="momo-room__guestbook-item">
                  <p className="momo-room__guestbook-item-name">{row.name}</p>
                  <p className="momo-room__guestbook-item-message">{row.message}</p>
                  {row.authorId === guestbookUserId ? (
                    <button
                      type="button"
                      className="momo-room__guestbook-delete"
                      onClick={() => removeGuestbookRow(row.id)}
                      aria-label="내 글 삭제"
                      title="내 글 삭제"
                    >
                      <X size={12} strokeWidth={2.4} aria-hidden />
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>

          <div className="momo-room__journal" aria-label="오늘의 기록">
            <p className="momo-room__journal-label">오늘의 기록</p>
            <blockquote className="momo-room__journal-quote">
              개발은 편집을 100번 쪼개서 하는 일 같아요....
              <footer>-모모 집사-</footer>
            </blockquote>
          </div>
        </aside>

        <figure className="momo-room__scene">
          <img
            className="momo-room__scene-img"
            src={roomLibraryImg}
            alt="밤, 책상과 창가가 있는 모모의 교정방"
            decoding="async"
          />
          <button
            type="button"
            className="momo-room__book-hotspot"
            onClick={openStory}
            aria-label="책장의 작은 책 — 이야기 읽기"
            title="작은 책"
          />
        </figure>

        <button
          type="button"
          className="momo-room__book-fallback"
          onClick={openStory}
        >
          <BookOpen size={16} aria-hidden />
          책장의 작은 책
        </button>
      </div>

      {storyOpen && page && (
        <div
          className="momo-room__book-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="momo-room-book-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeStory();
          }}
        >
          <div className="momo-room__book-panel">
            <p id="momo-room-book-title" className="momo-room__book-page-label">
              {storyPage + 1}
            </p>
            <div className="momo-room__book-body">
              {page.body.map((line, idx) =>
                line ? <p key={`${idx}-${line}`}>{line}</p> : <p key={idx} />,
              )}
              {page.epilogue && (
                <p className="momo-room__book-epilogue">{page.epilogue}</p>
              )}
            </div>
            <button
              type="button"
              className="momo-room__book-next"
              onClick={goNextPage}
            >
              {isLastPage ? '방으로' : '→ 다음 장'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
