import { useCallback, useEffect, useState } from 'react';
import { BookOpen, X } from 'lucide-react';
import roomLibraryImg from '../assets/welcome/welcome_library2.png';
import { momoRoomStoryPages } from '../data/momoRoomStory.js';

/**
 * @param {{ onClose: () => void }} props
 */
export default function MomoRoomScreen({ onClose }) {
  const [storyOpen, setStoryOpen] = useState(false);
  const [storyPage, setStoryPage] = useState(0);

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

  return (
    <div className="momo-room">
      <button
        type="button"
        className="momo-room__close"
        onClick={onClose}
        aria-label="닫기"
      >
        <X size={20} strokeWidth={2} aria-hidden />
      </button>

      <div className="momo-room__layout">
        <aside className="momo-room__side">
          <div className="momo-room__side-top">
            <p className="momo-room__eyebrow">◆ 어서오세요 ◆</p>
            <h1 className="momo-room__title">모모의 방</h1>
            <p className="momo-room__lead">
              이곳은 모모와 집사가 문장을 살펴보는 비밀스러운 공간입니다
            </p>
          </div>

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
