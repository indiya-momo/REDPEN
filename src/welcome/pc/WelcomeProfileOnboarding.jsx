import { useEffect, useId, useState } from 'react';
import {
  createRandomNickname,
  saveUserProfile,
} from '../../lib/userProfileStorage.js';
import { publicAssetUrl } from '../../lib/publicAssetUrl.js';
import './profile-onboarding.css';

const NICKNAME_PRINT = publicAssetUrl('welcome/nickname_print.png');

/**
 * PDF 작업 영역(상단 바 아래) 1회 프로필 입력
 * @param {{
 *   uid: string,
 *   defaultNickname?: string,
 *   onComplete: () => void,
 * }} props
 */
export default function WelcomeProfileOnboarding({
  uid,
  defaultNickname = '',
  onComplete,
}) {
  const titleId = useId();
  const [nicknameInput, setNicknameInput] = useState(defaultNickname);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [onboardingError, setOnboardingError] = useState('');

  useEffect(() => {
    setNicknameInput(defaultNickname);
    setTermsAccepted(false);
    setPrivacyAccepted(false);
    setOnboardingError('');
  }, [uid, defaultNickname]);

  const canCompleteOnboarding = termsAccepted && privacyAccepted;

  function handleSubmit(event) {
    event.preventDefault();
    if (!uid) return;
    if (!termsAccepted || !privacyAccepted) {
      setOnboardingError('필수 약관에 동의해 주세요.');
      return;
    }
    const nickname = nicknameInput.trim() || createRandomNickname();
    saveUserProfile(uid, {
      nickname,
      termsAccepted,
      privacyAccepted,
      marketingOptIn: false,
    });
    setOnboardingError('');
    onComplete();
  }

  return (
    <div
      className="profile-onboarding-mount profile-onboarding-mount--open profile-onboarding-mount--pane"
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
            <label
              htmlFor="profile-onboarding-nickname"
              className="profile-onboarding__label"
            >
              닉네임
            </label>
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
          />
          <fieldset className="profile-onboarding__consents">
            <legend className="sr-only">약관 동의</legend>
            <label className="profile-onboarding__check">
              <input
                type="checkbox"
                checked={termsAccepted}
                aria-label="이용약관 동의 (필수)"
                onChange={(event) => {
                  setTermsAccepted(event.target.checked);
                  setOnboardingError('');
                }}
              />
            </label>
            <label className="profile-onboarding__check">
              <input
                type="checkbox"
                checked={privacyAccepted}
                aria-label="개인정보처리방침 동의 (필수)"
                onChange={(event) => {
                  setPrivacyAccepted(event.target.checked);
                  setOnboardingError('');
                }}
              />
            </label>
          </fieldset>
          {onboardingError ? (
            <p className="profile-onboarding__error" role="alert">
              {onboardingError}
            </p>
          ) : null}
          <div className="profile-onboarding__actions">
            <button
              type="submit"
              className="btn-primary profile-onboarding__submit"
              disabled={!canCompleteOnboarding}
            >
              시작하기
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
