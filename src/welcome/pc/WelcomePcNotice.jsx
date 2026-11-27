/**
 * PC 대문 히어로 오른쪽 위 공지 알약.
 * Firestore에서 최신 공지를 읽어 모모의 방 게시판으로 보낸다.
 * 공지가 없거나 불러오지 못하면 그리지 않는다.
 */
import { useEffect, useState } from 'react';
import { fetchLatestNotice } from '../../lib/noticesCloud.js';

/**
 * @param {{ onOpen?: () => void }} props
 */
export default function WelcomePcNotice({ onOpen }) {
  const [latest, setLatest] = useState(/** @type {{ title: string } | null} */ (null));

  useEffect(() => {
    let cancelled = false;
    void fetchLatestNotice()
      .then((notice) => {
        if (!cancelled) setLatest(notice);
      })
      .catch(() => {
        if (!cancelled) setLatest(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!latest) return null;

  return (
    <div className="welcome-pc__notice">
      <button
        type="button"
        className="welcome-pc__notice-pill"
        onClick={() => onOpen?.()}
        aria-label={`공지. ${latest.title}. 모모의 방에서 자세히 보기`}
      >
        <span className="welcome-pc__notice-badge">공지</span>
        <span className="welcome-pc__notice-label">{latest.title}</span>
        <span className="welcome-pc__notice-more">자세히 ›</span>
      </button>
    </div>
  );
}
