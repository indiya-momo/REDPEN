import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, BookOpen, Volume2, VolumeX, X } from 'lucide-react';
import roomLibraryImg from '../assets/welcome/welcome_library2.png';
import { momoRoomStoryPages } from '../data/momoRoomStory.js';
import { publicAssetUrl } from '../lib/publicAssetUrl.js';

const GUESTBOOK_KEY = 'momo-room-guestbook-v1';
const GUESTBOOK_USER_KEY = 'momo-room-guestbook-user-id';
const GUESTBOOK_MAX_CHARS = 50;
const ROOM_EXIT_MS = 360;
const AMBIENT_MUTED_KEY = 'momo-room-ambient-muted';
const CANDLE_AMBIENT_VOLUME = 0.08;
const BOOK_GLOW_WAIT_MIN_MS = 15_000;
const BOOK_GLOW_WAIT_MAX_MS = 45_000;
const BOOK_GLOW_FIRST_MIN_MS = 6_000;
const BOOK_GLOW_FIRST_MAX_MS = 14_000;

function loadAmbientMuted() {
  try {
    return localStorage.getItem(AMBIENT_MUTED_KEY) === '1';
  } catch {
    return false;
  }
}

/** @returns {number} */
function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

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
  const [isClosing, setIsClosing] = useState(false);
  const [storyOpen, setStoryOpen] = useState(false);
  const [storyPage, setStoryPage] = useState(0);
  const [guestbookRows, setGuestbookRows] = useState(() => loadGuestbook());
  const [guestbookUserId] = useState(() => loadGuestbookUserId());
  const [guestName, setGuestName] = useState('');
  const [guestMessage, setGuestMessage] = useState('');
  const [guestbookNotice, setGuestbookNotice] = useState('');
  const [bookGlow, setBookGlow] = useState(null);
  const [ambientMuted, setAmbientMuted] = useState(() => loadAmbientMuted());
  const candleAudioRef = useRef(null);

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

  // 의자 위 작은 책 — 아주 가끔 금박처럼 은은하게 반짝
  useEffect(() => {
    if (storyOpen) {
      setBookGlow(null);
      return undefined;
    }

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) return undefined;

    /** @type {number[]} */
    const timers = [];
    let cancelled = false;

    const addTimer = (fn, ms) => {
      timers.push(window.setTimeout(fn, ms));
    };

    const scheduleCycle = (firstRun) => {
      if (cancelled) return;

      const waitMs = firstRun
        ? randomBetween(BOOK_GLOW_FIRST_MIN_MS, BOOK_GLOW_FIRST_MAX_MS)
        : randomBetween(BOOK_GLOW_WAIT_MIN_MS, BOOK_GLOW_WAIT_MAX_MS);

      addTimer(() => {
        if (cancelled) return;

        const strong = Math.random() < 0.3;
        const holdMs = strong
          ? randomBetween(2500, 4000)
          : randomBetween(1500, 3000);

        setBookGlow(strong ? 'warm' : 'soft');

        addTimer(() => {
          if (cancelled) return;
          setBookGlow(null);
          scheduleCycle(false);
        }, holdMs);
      }, waitMs);
    };

    scheduleCycle(true);

    return () => {
      cancelled = true;
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [storyOpen]);

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!candleAudioRef.current) {
      candleAudioRef.current = new Audio(publicAssetUrl('welcome/crackling-candle.mp3'));
      candleAudioRef.current.loop = true;
      candleAudioRef.current.preload = 'auto';
    }

    const audio = candleAudioRef.current;
    audio.volume = CANDLE_AMBIENT_VOLUME;

    const tryPlay = () => {
      if (ambientMuted || reducedMotion || document.hidden) return;
      audio.play().catch(() => {});
    };

    tryPlay();

    const onVisibilityChange = () => {
      if (document.hidden) {
        audio.pause();
        return;
      }
      tryPlay();
    };

    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      audio.pause();
      audio.currentTime = 0;
    };
  }, [ambientMuted]);

  const toggleAmbient = useCallback(() => {
    setAmbientMuted((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(AMBIENT_MUTED_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

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

  const handleCloseRoom = useCallback(() => {
    if (isClosing) return;
    setIsClosing(true);
    window.setTimeout(() => {
      onClose();
    }, ROOM_EXIT_MS);
  }, [isClosing, onClose]);

  return (
    <div className={`momo-room ${isClosing ? 'momo-room--closing' : ''}`}>
      <div className="momo-room__layout">
        <aside className="momo-room__side">
          <p className="momo-room__eyebrow">◆ 어서오세요 ◆</p>
          <div className="momo-room__title-row">
            <h1 className="momo-room__title">모모의 방</h1>
          </div>
          <p className="momo-room__lead">
            이곳은 모모와 집사의 비밀 공간입니다
          </p>

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

          <span className="momo-room__title-actions">
            <button
              type="button"
              className="momo-room__ambient-toggle"
              onClick={toggleAmbient}
              aria-label={ambientMuted ? '촛불 소리 켜기' : '촛불 소리 끄기'}
              title={ambientMuted ? '촛불 소리 켜기' : '촛불 소리 끄기'}
            >
              {ambientMuted ? (
                <VolumeX size={18} strokeWidth={2.2} aria-hidden />
              ) : (
                <Volume2 size={18} strokeWidth={2.2} aria-hidden />
              )}
            </button>
            <button
              type="button"
              className="momo-room__close"
              onClick={handleCloseRoom}
              aria-label="돌아가기"
              title="돌아가기"
            >
              <ArrowLeft size={20} strokeWidth={2.2} aria-hidden />
            </button>
          </span>
        </aside>

        <figure className="momo-room__scene">
          <img
            className="momo-room__scene-img"
            src={roomLibraryImg}
            alt="밤, 책상과 창가가 있는 모모의 교정방"
            decoding="async"
          />
          <span className="momo-room__cloud" aria-hidden />
          <img
            className="momo-room__scene-window"
            src={publicAssetUrl('welcome/welcome_library2_window_front.png')}
            alt=""
            aria-hidden
            decoding="async"
          />
          <span className="momo-room__light momo-room__light--candle" aria-hidden />
          <span className="momo-room__light momo-room__light--lantern" aria-hidden />
          <span
            className={`momo-room__book-glow${bookGlow ? ` momo-room__book-glow--${bookGlow}` : ''}`}
            aria-hidden
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
          aria-label="책장의 작은 책 — 이야기 읽기"
          title="작은 책"
        >
          <BookOpen size={20} strokeWidth={2.2} aria-hidden />
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
