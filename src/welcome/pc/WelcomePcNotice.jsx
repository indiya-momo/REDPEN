/**
 * PC 대문 히어로 오른쪽 위 공지 알약.
 * 누르면 모모의 방 공지 게시판으로 이동한다. 공지가 없으면 그리지 않는다.
 */
import { getLatestNotice } from '../../lib/notices.js';

/**
 * @param {{ onOpen?: () => void }} props
 */
export default function WelcomePcNotice({ onOpen }) {
  const latest = getLatestNotice();
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
