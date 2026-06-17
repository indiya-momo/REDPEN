/**
 * PC 대문(960px+): 서비스 설명, Google 로그인 CTA, 검수 시작.
 * 로그인 후 온보딩 미완료면 WelcomeProfileOnboarding, 완료면 onStart로 main.
 * App이 내려준 onGoogleSignIn/onStart/authSession만 사용 (모바일 분기 없음).
 */
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
import { useUserProfileSync } from '../../hooks/useUserProfileSync.js';
import WelcomeProfileOnboarding from './WelcomeProfileOnboarding.jsx';
import './welcome-pc.css';

const MOMO_TOOLTIP = publicAssetUrl('momo/bullon4.png');
const WELCOME_PC_BEFORE = `${import.meta.env.BASE_URL}welcome/m_before.png`;
const WELCOME_PC_AFTER = `${import.meta.env.BASE_URL}welcome/m_after3.png`;
const ENTER_MAIN_AFTER_GOOGLE_KEY = 'indiya-enter-main-after-google';

/** @param {{
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
  const enterMainAfterLoginRef = useRef(false);

  const session = authSession ?? getCurrentUserSession();
  const uid = session?.uid ?? '';
  const loggedIn = Boolean(uid);
  const { profileRev, bumpProfileRev, onboardingComplete } =
    useUserProfileSync(uid);
  const needsWelcomeMessage = loggedIn && authReady && !onboardingComplete;

  function handleStart() {
    if (loggedIn && uid && !isOnboardingComplete(uid)) return;
    onStart();
  }

  useEffect(() => {
    if (authBootstrapError) setAuthError(authBootstrapError);
  }, [authBootstrapError]);

  useEffect(() => {
    if (!authReady || !uid) return;
    const pending =
      enterMainAfterLoginRef.current ||
      sessionStorage.getItem(ENTER_MAIN_AFTER_GOOGLE_KEY) === '1';
    if (!pending) return;
    if (!onboardingComplete) {
      enterMainAfterLoginRef.current = false;
      sessionStorage.removeItem(ENTER_MAIN_AFTER_GOOGLE_KEY);
      return;
    }
    enterMainAfterLoginRef.current = false;
    sessionStorage.removeItem(ENTER_MAIN_AFTER_GOOGLE_KEY);
    handleStart();
  }, [authReady, uid, onboardingComplete, onStart]);

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
      handleStart();
      return;
    }
    setAuthPending(true);
    setAuthError('');
    enterMainAfterLoginRef.current = true;
    sessionStorage.setItem(ENTER_MAIN_AFTER_GOOGLE_KEY, '1');
    try {
      await onGoogleSignIn();
      const uidAfterSignIn = getCurrentUserSession()?.uid;
      if (uidAfterSignIn) {
        enterMainAfterLoginRef.current = false;
        sessionStorage.removeItem(ENTER_MAIN_AFTER_GOOGLE_KEY);
        if (isOnboardingComplete(uidAfterSignIn)) {
          handleStart();
        }
      }
    } catch (error) {
      enterMainAfterLoginRef.current = false;
      sessionStorage.removeItem(ENTER_MAIN_AFTER_GOOGLE_KEY);
      setAuthError(mapFirebaseAuthError(error));
    } finally {
      setAuthPending(false);
    }
  }

  const layoutClassName = [
    'welcome-pc__layout',
    needsWelcomeMessage
      ? 'welcome-pc__layout--onboarding'
      : loggedIn
        ? 'welcome-pc__layout--signed-in'
        : 'welcome-pc__layout--guest',
  ].join(' ');

  const isGuestLanding = !needsWelcomeMessage && !loggedIn;

  const headerBlock = (
    <header className="welcome-pc__header">
      <p className="welcome-pc__eyebrow">텍스트 PDF 검수 서비스</p>
      <h1 className="welcome-pc__title-row">
        <span className="welcome-pc__title-main">인디야</span>
        <span className="welcome-pc__title-sub">검수냥 모모 이야기</span>
      </h1>
      {isGuestLanding ? (
        <p className="welcome-pc__lead welcome-pc__lead--guest">
          <span className="welcome-pc__lead-line">
            <strong className="welcome-pc__lead-do">
              맞춤법·일관성 검수 결과를 표시
            </strong>
            하며,{' '}
            <span className="welcome-pc__lead-dont">AI 자동 수정은 하지 않습니다</span>
          </span>
          <span className="welcome-pc__lead-line">
            원고와 검사 결과는{' '}
            <strong className="welcome-pc__lead-do">이 브라우저 안에서만 처리</strong>
            하며,{' '}
            <span className="welcome-pc__lead-dont">서버에 저장하지 않습니다</span>
          </span>
        </p>
      ) : (
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
      )}
      <div className="welcome-pc__editor-note-anchor" aria-hidden>
        <TooltipGuide
          storageKey="welcome-editor-note"
          placement="right"
          offsetX={-352}
          offsetY={-30}
          imageSrc={MOMO_TOOLTIP}
          imageAlt="모모"
          message="현직 편집자가 만들었다냥"
        >
          <span className="welcome-pc__editor-note-dot" />
        </TooltipGuide>
      </div>
    </header>
  );

  const portraitBlock = (
    <div className="welcome-pc__portrait">
      <div className="welcome-pc__portrait-media">
        <MomoHero variant="gate" />
      </div>
      <img
        className="welcome-pc__portrait-frame"
        src={welcomeMomoFrame}
        alt=""
        aria-hidden
        decoding="async"
      />
    </div>
  );

  const guestAuthButton = (
    <div className="welcome-pc__cta-bar-action">
      {!authReady ? (
        <button
          type="button"
          className="btn-welcome-primary welcome-pc__start welcome-pc__auth-submit"
          disabled
        >
          <span className="welcome-pc__auth-submit-label">로그인 확인 중…</span>
        </button>
      ) : (
        <button
          type="button"
          className="btn-welcome-primary welcome-pc__start welcome-pc__auth-submit"
          onClick={handleGoogleAuth}
          disabled={authPending}
        >
          <span className="welcome-pc__auth-submit-label">
            {authPending ? '구글 로그인 연결 중…' : '구글로 시작하기'}
          </span>
          {!authPending ? (
            <span className="welcome-pc__auth-submit-hint">
              크롬 브라우저 사용을 권장합니다
            </span>
          ) : null}
        </button>
      )}
    </div>
  );

  const guestPerfBlock = (
    <div className="welcome-pc__cta-group welcome-pc__cta-group--in-top">
      <div className="welcome-pc__cta-bar welcome-pc__cta-bar--top">
        <div className="welcome-pc__cta-bar-copy">
          <div className="welcome-pc__perf-headline-row">
            <p className="welcome-pc__perf-headline">
              신국판 <strong>300페이지</strong>, <strong>2.4초</strong>에 검수합니다
            </p>
          </div>
          <ul className="welcome-pc__perf-specs">
            <li className="welcome-pc__perf-pill">
              <strong className="welcome-pc__perf-pill-num">80개+</strong>
              <span className="welcome-pc__perf-pill-meta">
                <span className="welcome-pc__perf-pill-cat">맞춤법</span>
                <span className="welcome-pc__perf-pill-sep" aria-hidden="true">
                  ·
                </span>
                <span className="welcome-pc__perf-pill-desc">오류 탐지</span>
              </span>
            </li>
            <li className="welcome-pc__perf-pill">
              <strong className="welcome-pc__perf-pill-num">20개+</strong>
              <span className="welcome-pc__perf-pill-meta">
                <span className="welcome-pc__perf-pill-cat">문체</span>
                <span className="welcome-pc__perf-pill-sep" aria-hidden="true">
                  ·
                </span>
                <span className="welcome-pc__perf-pill-desc">일관성 검수</span>
              </span>
            </li>
          </ul>
          <p className="welcome-pc__cta-beta-note">
            무료 오픈베타 · 회원은 매일 사용 가능
          </p>
          {authError && authReady ? (
            <p className="welcome-pc__auth-error welcome-pc__auth-error--bar" role="alert">
              {authError}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );

  return (
    <div className="welcome-pc">
      <div className={layoutClassName}>
        {isGuestLanding ? (
          <div className="welcome-pc__top-band">
            {headerBlock}
            {guestPerfBlock}
          </div>
        ) : (
          headerBlock
        )}

        {needsWelcomeMessage ? (
          <aside className="welcome-pc__hero-aside welcome-pc__hero-aside--onboarding">
            <WelcomeProfileOnboarding
              uid={uid}
              defaultNickname={session?.displayName ?? ''}
              surface="welcome-pc"
              onComplete={() => {
                bumpProfileRev();
                handleStart();
              }}
            />
          </aside>
        ) : isGuestLanding ? (
          <div className="welcome-pc__hero-aside welcome-pc__hero-aside--guest-rail">
            {portraitBlock}
            {guestAuthButton}
          </div>
        ) : (
          <div className="welcome-pc__hero-aside">{portraitBlock}</div>
        )}

        {/* 2단: 비포/애프터(좌) — 비로그인은 우측 패널 없음 */}
        <section className="welcome-pc__showcase" aria-label="검수 예시">
          <div className="welcome-pc__compare-wrap">
            <div className="welcome-pc__compare">
              <figure className="welcome-pc__compare-figure">
                <figcaption className="welcome-pc__compare-label">검수 전</figcaption>
                <img
                  className="welcome-pc__compare-img"
                  src={WELCOME_PC_BEFORE}
                  alt="검수 전 — 원고 본문 예시"
                  width={700}
                  height={475}
                  loading="lazy"
                  decoding="async"
                />
              </figure>
              <div className="welcome-pc__compare-bridge" aria-hidden="true">
                <div className="welcome-pc__compare-chevrons">
                  <span className="welcome-pc__compare-chevron" />
                  <span className="welcome-pc__compare-chevron" />
                  <span className="welcome-pc__compare-chevron" />
                </div>
              </div>
              <figure className="welcome-pc__compare-figure">
                <figcaption className="welcome-pc__compare-label">검수 후</figcaption>
                <img
                  className="welcome-pc__compare-img"
                  src={WELCOME_PC_AFTER}
                  alt="검수 후 — 맞춤법·일관성 표시 예시"
                  width={700}
                  height={475}
                  loading="lazy"
                  decoding="async"
                />
              </figure>
            </div>
            <p className="welcome-pc__showcase-caption">
              실제 검수 화면 예시 · 자동 수정이 아니라 발견 위치 표시 · 텍스트 PDF만 가능
            </p>
          </div>
        </section>

        {!needsWelcomeMessage && loggedIn ? (
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
        ) : null}

        {/* 로그인: 하단 검수하기 CTA 유지 */}
        {!needsWelcomeMessage && loggedIn ? (
          <div className="welcome-pc__cta">
            <div className="welcome-pc__stage-cta">
              {!authReady ? (
                <button
                  type="button"
                  className="btn-welcome-primary welcome-pc__start"
                  disabled
                >
                  로그인 확인 중…
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-welcome-primary welcome-pc__start"
                  onClick={handleStart}
                >
                  검수하기
                </button>
              )}
            </div>
          </div>
        ) : null}

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
          <p className="welcome-pc__footer-line">
            <span className="welcome-pc__footer-part">
              오픈베타 기간 동안 사용자의 이용 데이터를 익명으로 수집합니다.
            </span>
            <span className="welcome-pc__footer-sep" aria-hidden="true">
              |
            </span>
            <span className="welcome-pc__footer-part">
              원고는 서버에 저장되지 않으며 수집한 이용 데이터는 기능 향상을 위해
              사용됩니다.
            </span>
            <span className="welcome-pc__footer-sep" aria-hidden="true">
              |
            </span>
            <span className="welcome-pc__footer-meta">
              <AppVersionBadge dateOnly />
              <button
                type="button"
                className="welcome-pc__room-entry"
                onClick={onOpenRoom}
                aria-label="모모의 방"
                title="모모의 방"
              >
                <BookOpen size={24} strokeWidth={1.6} aria-hidden />
              </button>
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
