import { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen } from 'lucide-react';
import AppVersionBadge from '../../components/AppVersionBadge.jsx';
import MomoHero from '../../components/MomoHero.jsx';
import TooltipGuide from '../../components/TooltipGuide.jsx';
import welcomeMomoFrame from '../../assets/welcome/welcome_momo_frame3.png';
import {
  getCurrentUserSession,
  mapFirebaseAuthError,
} from '../../lib/firebaseAuth.js';
import { publicAssetUrl } from '../../lib/publicAssetUrl.js';
import {
  getUserProfile,
  isOnboardingComplete,
} from '../../lib/userProfileStorage.js';
import WelcomeProfileOnboarding from './WelcomeProfileOnboarding.jsx';
import './welcome-pc.css';

const WELCOME_MOMO_FRAME = welcomeMomoFrame;
const MOMO_TOOLTIP = publicAssetUrl('momo/bullon4.png');
const ENTER_MAIN_AFTER_GOOGLE_KEY = 'indiya-enter-main-after-google';

/**
 * PC 대문 — welcome-pc 전용 (모바일과 마크업·CSS 공유 없음)
 * @param {{
 *   onStart: () => void,
 *   onOpenRoom: () => void,
 *   authSession: { uid: string, email?: string, displayName?: string } | null,
 *   authReady: boolean,
 *   authBootstrapError?: string,
 *   onGoogleSignIn: () => Promise<void>,
 *   onLogout: () => void,
 * }} props
 */
export default function WelcomePcScreen({
  onStart,
  onOpenRoom,
  authSession,
  authReady,
  authBootstrapError = '',
  onGoogleSignIn,
  onLogout,
}) {
  const [authError, setAuthError] = useState('');
  const [authPending, setAuthPending] = useState(false);
  const [profileRev, setProfileRev] = useState(0);
  const enterMainAfterLoginRef = useRef(false);

  const session = authSession ?? getCurrentUserSession();
  const uid = session?.uid ?? '';
  const loggedIn = Boolean(uid);
  const needsWelcomeMessage =
    loggedIn && authReady && !isOnboardingComplete(uid);

  useEffect(() => {
    if (authBootstrapError) setAuthError(authBootstrapError);
  }, [authBootstrapError]);

  useEffect(() => {
    if (!authReady || !uid) return;
    const pending =
      enterMainAfterLoginRef.current ||
      sessionStorage.getItem(ENTER_MAIN_AFTER_GOOGLE_KEY) === '1';
    if (!pending) return;
    if (!isOnboardingComplete(uid)) {
      enterMainAfterLoginRef.current = false;
      sessionStorage.removeItem(ENTER_MAIN_AFTER_GOOGLE_KEY);
      return;
    }
    enterMainAfterLoginRef.current = false;
    sessionStorage.removeItem(ENTER_MAIN_AFTER_GOOGLE_KEY);
    onStart();
  }, [authReady, uid, onStart]);

  const signedInName = useMemo(() => {
    if (!session?.uid) return '';
    const profile = getUserProfile(session.uid);
    const nickname = profile?.nickname?.trim();
    return (
      nickname ||
      session.displayName?.trim() ||
      session.email?.trim() ||
      '회원'
    );
  }, [session, profileRev]);

  async function handleGoogleAuth() {
    if (loggedIn) {
      if (isOnboardingComplete(uid)) onStart();
      return;
    }
    setAuthPending(true);
    setAuthError('');
    enterMainAfterLoginRef.current = true;
    sessionStorage.setItem(ENTER_MAIN_AFTER_GOOGLE_KEY, '1');
    try {
      await onGoogleSignIn();
      if (getCurrentUserSession()?.uid && authReady) {
        enterMainAfterLoginRef.current = false;
        sessionStorage.removeItem(ENTER_MAIN_AFTER_GOOGLE_KEY);
        if (isOnboardingComplete(getCurrentUserSession().uid)) onStart();
      }
    } catch (error) {
      enterMainAfterLoginRef.current = false;
      sessionStorage.removeItem(ENTER_MAIN_AFTER_GOOGLE_KEY);
      setAuthError(mapFirebaseAuthError(error));
    } finally {
      setAuthPending(false);
    }
  }

  return (
    <div className="welcome-pc">
      <div className="welcome-pc__layout">
        <div className="welcome-pc__copy">
          <header className="welcome-pc__header">
            <p className="welcome-pc__eyebrow">텍스트 PDF 검수 서비스</p>
            <h1>
              <span className="welcome-pc__title-main">인디야</span>
              <br />
              <span className="welcome-pc__title-sub">검수냥 모모 이야기</span>
            </h1>
            <p className="welcome-pc__lead">
              <span className="welcome-pc__lead-line">
                맞춤법·표기 일관성을 찾는{' '}
                <strong>텍스트 PDF 검수 서비스</strong>입니다
              </span>
              <span className="welcome-pc__lead-line">
                원고와 검사 결과는{' '}
                <span className="welcome-pc__lead-emphasis">
                  서버에 저장하지 않고, 이 브라우저 안에서만 처리
                </span>
                합니다
              </span>
            </p>
          </header>
          <div className="welcome-pc__editor-note-anchor" aria-hidden>
            <TooltipGuide
              storageKey="welcome-editor-note"
              placement="right"
              offsetX={-292}
              offsetY={0}
              imageSrc={MOMO_TOOLTIP}
              imageAlt="모모"
              message="현직 편집자가 만들었다냥"
            >
              <span className="welcome-pc__editor-note-dot" />
            </TooltipGuide>
          </div>

          <div className="welcome-pc__panels">
            <section className="welcome-pc__panel welcome-pc__panel--do">
              <h2>하는 일</h2>
              <ul>
                <li>설정된 기준에 따라 PDF 스캔</li>
                <li>발견 위치를 목록 + 하이라이트로 표시</li>
              </ul>
            </section>
            <section className="welcome-pc__panel welcome-pc__panel--dont">
              <h2>하지 않는 일</h2>
              <ul>
                <li>원고 자동 수정 · AI 문장 추천</li>
                <li>검사 결과 서버 저장</li>
              </ul>
            </section>
          </div>

          <div className="welcome-pc__steps" aria-label="시작 방법">
            <article className="welcome-pc__step">
              <h3 className="welcome-pc__step-title">
                <span className="welcome-pc__step-num">1 </span> 원고 PDF 열기
              </h3>
              <p>
                텍스트 PDF 파일을 선택합니다
                <br />
                (스캔 PDF는 작업이 불가합니다)
              </p>
            </article>
            <article className="welcome-pc__step">
              <h3 className="welcome-pc__step-title">
                <span className="welcome-pc__step-num">2 </span> 적용 기준 선택
              </h3>
              <p>
                맞춤법·띄어쓰기·일관성 탭에서
                <br />
                적용하려는 기준을 선택합니다
              </p>
            </article>
            <article className="welcome-pc__step">
              <h3 className="welcome-pc__step-title">
                <span className="welcome-pc__step-num">3 </span> 검사 실행 및 확인
              </h3>
              <p>
                검사 실행 버튼을 누른 뒤
                <br />
                기준이 적용된 결과를 확인합니다
              </p>
            </article>
          </div>

          {loggedIn ? (
            <section className="welcome-pc__auth" aria-label="회원가입 및 로그인">
              <div className="welcome-pc__auth-signed">
                <p className="welcome-pc__auth-signed-text">
                  <span className="welcome-pc__auth-nickname">{signedInName}</span>
                  <span className="welcome-pc__auth-honorific">님이</span>
                  <span className="welcome-pc__auth-message">
                    모모와 원고를 검수 중입니다
                  </span>
                </p>
                <button
                  type="button"
                  className="welcome-pc__auth-ghost"
                  onClick={onLogout}
                >
                  로그아웃
                </button>
              </div>
            </section>
          ) : null}

          <div className="welcome-pc__bottom-notes">
            <div className="welcome-pc__bottom-meta">
              <AppVersionBadge dateOnly />
              <button
                type="button"
                className="welcome-pc__room-entry"
                onClick={onOpenRoom}
                aria-label="모모의 방"
                title="모모의 방"
              >
                <BookOpen size={16} strokeWidth={1.6} aria-hidden />
              </button>
            </div>
          </div>
        </div>

        <aside className="welcome-pc__stage">
          {needsWelcomeMessage ? (
            <WelcomeProfileOnboarding
              uid={uid}
              defaultNickname={session?.displayName ?? ''}
              surface="welcome-pc"
              onComplete={() => setProfileRev((n) => n + 1)}
            />
          ) : (
            <div className="welcome-pc__stage-stack">
              <div className="welcome-pc__portrait">
                <div className="welcome-pc__portrait-media">
                  <MomoHero variant="gate" />
                </div>
                <img
                  className="welcome-pc__portrait-frame"
                  src={WELCOME_MOMO_FRAME}
                  alt=""
                  aria-hidden
                  decoding="async"
                />
              </div>
              <div className="welcome-pc__stage-cta">
                {!authReady ? (
                  <button
                    type="button"
                    className="btn-welcome-primary welcome-pc__start"
                    disabled
                  >
                    로그인 확인 중…
                  </button>
                ) : loggedIn ? (
                  <button
                    type="button"
                    className="btn-welcome-primary welcome-pc__start"
                    onClick={onStart}
                  >
                    검수하기
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn-welcome-primary welcome-pc__start welcome-pc__auth-submit"
                    onClick={handleGoogleAuth}
                    disabled={authPending}
                  >
                    {authPending
                      ? 'Google 로그인 연결 중…'
                      : '구글 회원가입 · 로그인'}
                  </button>
                )}
                {authError && !loggedIn ? (
                  <p
                    className="welcome-pc__auth-error welcome-pc__auth-error--stage"
                    role="alert"
                  >
                    {authError}
                  </p>
                ) : null}
                <p className="welcome-pc__beta-note welcome-pc__steps-note--stage">
                  오픈베타: 첫 검수는 무료,
                  <br />
                  이후 회원당 하루 1회 전 기능 검수
                </p>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
