/**
 * 최초 1회 닉네임 입력 (대문 또는 작업창 surface).
 * userProfileStorage + cloud 저장 후 onComplete.
 * 베타 마이페이지·인사말에 쓰이는 표시 이름의 출처.
 */
import { useEffect, useId, useState } from 'react';
import {
  createRandomNickname,
  saveUserProfile,
} from '../../lib/userProfileStorage.js';
import { saveUserProfileCloud } from '../../lib/userProfileCloud.js';
import { publicAssetUrl } from '../../lib/publicAssetUrl.js';
import './profile-onboarding.css';

const NICKNAME_PRINT = publicAssetUrl('welcome/nickname_print.png');

/** @param {{
 *   uid: string,
 *   defaultNickname?: string,
 *   onComplete: () => void,
 *   surface?: 'work-pane' | 'welcome-pc',
 * }} props
 */
export default function WelcomeProfileOnboarding({
  uid,
  defaultNickname = '',
  onComplete,
  surface = 'work-pane',
}) {
  const titleId = useId();
  const [nicknameInput, setNicknameInput] = useState(defaultNickname);

  useEffect(() => {
    setNicknameInput(defaultNickname);
  }, [uid, defaultNickname]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!uid) return;
    const nickname = nicknameInput.trim() || createRandomNickname();
    const saved = saveUserProfile(uid, {
      nickname,
      termsAccepted: false,
      privacyAccepted: false,
      marketingOptIn: false,
    });
    if (!saved) return;
    void saveUserProfileCloud(uid, saved).catch(() => {
      /* localStorage 저장은 완료 — 클라우드는 다음 로그인 때 재시도 */
    });
    onComplete();
  }

  const mountClass =
    surface === 'welcome-pc'
      ? 'profile-onboarding-mount--welcome-pc'
      : 'profile-onboarding-mount--pane';

  return (
    <div
      className={`profile-onboarding-mount profile-onboarding-mount--open ${mountClass}`}
      role="presentation"
    >
      <div
        className="profile-onboarding-host"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <form className="profile-onboarding__panel" onSubmit={handleSubmit}>
          <div className="profile-onboarding__intro">
            <header className="profile-onboarding__header">
              <h2 id={titleId}>환영합니다</h2>
              <img
                className="profile-onboarding__print"
                src={NICKNAME_PRINT}
                alt=""
                decoding="async"
              />
            </header>
            <p className="profile-onboarding__lead">
              인디야에서 사용하실 닉네임을 입력해주세요
            </p>
          </div>
          <input
            id="profile-onboarding-nickname"
            type="text"
            className="profile-onboarding__input"
            value={nicknameInput}
            onChange={(event) => setNicknameInput(event.target.value)}
            placeholder="닉네임을 입력해 주세요"
            maxLength={40}
            autoFocus
            aria-label="닉네임"
          />
          <div className="profile-onboarding__actions">
            <button
              type="submit"
              className="btn-primary profile-onboarding__submit"
            >
              시작하기
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
