/**
 * PC 대문(600px+): 서비스 설명, Google 로그인 CTA, 검수 시작.
 * 로그인 후 온보딩 미완료면 WelcomeProfileOnboarding, 완료면 onStart로 main.
 * App이 내려준 onGoogleSignIn/onStart/authSession만 사용 (모바일 분기 없음).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen } from 'lucide-react';
import AppVersionBadge from '../../components/AppVersionBadge.jsx';
import CriteriaHoverTip from '../../components/CriteriaHoverTip.jsx';
import MomoHero from '../../components/MomoHero.jsx';
import welcomeMomoFramePc from '../../assets/welcome/welcome_momo_frame_pc.png';
import {
  getCurrentUserSession,
  mapFirebaseAuthError,
} from '../../lib/firebaseAuth.js';
import {
  getUserProfile,
  isOnboardingComplete,
} from '../../lib/userProfileStorage.js';
import { useUserProfileSync } from '../../hooks/useUserProfileSync.js';
import {
  clearSignupBonusLoginPending,
  consumeSignupBonusLoginNotice,
  markEnterMainAfterGoogle,
  markSignupBonusNoticePending,
} from '../../lib/signupBonusNotice.js';
import WelcomeProfileOnboarding from './WelcomeProfileOnboarding.jsx';
import { publicAssetUrl } from '../../lib/publicAssetUrl.js';
import './welcome-pc.css';

const WELCOME_PC_BEFORE = `${import.meta.env.BASE_URL}welcome/before1.png`;
const WELCOME_PC_AFTER = `${import.meta.env.BASE_URL}welcome/after1.png`;
const WELCOME_PC_PEN = publicAssetUrl('momo/pen_transparent.png');

const SPARKLE_PATH = 'M12 0l2.4 9.6L24 12l-9.6 2.4L12 24l-2.4-9.6L0 12l9.6-2.4z';
/** 방패 실루엣 — currentColor로 금색 적용 */
const SHIELD_PATH =
  'M12 2.2l7.2 2.4v6.1c0 4.6-3.1 8.7-7.2 10.1-4.1-1.4-7.2-5.5-7.2-10.1V4.6L12 2.2z';

function WelcomePcSparkle({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d={SPARKLE_PATH} />
    </svg>
  );
}

function WelcomePcShield({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d={SHIELD_PATH} />
    </svg>
  );
}

/** @param {{
 *   onStart: () => void,
 *   onBrowse?: () => void,
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
  onBrowse,
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

  // 리다이렉트 복귀 안내는 App에서 처리. 팝업 로그인·대문 잔류 시만 여기서 보완.
  useEffect(() => {
    if (!authReady || !uid || !onboardingComplete) {
      if (uid && !onboardingComplete && enterMainAfterLoginRef.current) {
        enterMainAfterLoginRef.current = false;
      }
      return;
    }
    if (!enterMainAfterLoginRef.current) return;

    let cancelled = false;
    void (async () => {
      enterMainAfterLoginRef.current = false;
      await consumeSignupBonusLoginNotice(uid);
      if (!cancelled) handleStart();
    })();

    return () => {
      cancelled = true;
    };
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
    markEnterMainAfterGoogle();
    markSignupBonusNoticePending();
    try {
      await onGoogleSignIn();
      // 팝업 로그인만 여기까지 옴. 리다이렉트는 페이지가 떠났다가 App effect로 복귀.
      const uidAfterSignIn = getCurrentUserSession()?.uid;
      if (uidAfterSignIn && isOnboardingComplete(uidAfterSignIn)) {
        enterMainAfterLoginRef.current = false;
        await consumeSignupBonusLoginNotice(uidAfterSignIn);
        handleStart();
      }
    } catch (error) {
      enterMainAfterLoginRef.current = false;
      clearSignupBonusLoginPending();
      setAuthError(mapFirebaseAuthError(error));
    } finally {
      setAuthPending(false);
    }
  }

  const layoutClassName = [
    'welcome-pc__layout',
    needsWelcomeMessage
      ? 'welcome-pc__layout--onboarding'
      : 'welcome-pc__layout--guest',
  ].join(' ');

  const isHeroLanding = !needsWelcomeMessage;
  const showSignedInLanding = loggedIn && isHeroLanding;

  const noAiSticker = (
    <span
      className="welcome-pc__cta-no-ai"
      tabIndex={0}
      role="img"
      aria-label="AI로 문장을 고치거나 학습하지 않음"
    >
      <span className="welcome-pc__cta-no-ai-disc" aria-hidden="true">
        <svg viewBox="0 0 64 64" focusable="false" width="64" height="64">
          <circle
            cx="32"
            cy="32"
            r="26"
            fill="none"
            stroke="#c62828"
            strokeWidth="5"
          />
          <text
            x="32"
            y="40"
            textAnchor="middle"
            fontFamily="Pretendard, sans-serif"
            fontSize="32.4"
            fontWeight="900"
            fill="#f5efe3"
            letterSpacing="0.5"
          >
            AI
          </text>
        </svg>
        <img
          className="welcome-pc__cta-no-ai-pen"
          src={WELCOME_PC_PEN}
          alt=""
          decoding="async"
          draggable={false}
        />
      </span>
      <span className="welcome-pc__cta-no-ai-tip" role="tooltip">
        AI로 문장을 고치거나 학습하지 않음
      </span>
    </span>
  );

  const descBlock = (
    <div className="welcome-pc__desc-row">
      <div className="welcome-pc__desc">
        <p className="welcome-pc__desc-line">
          <span
            className="welcome-pc__desc-icon welcome-pc__desc-icon--ok symbol-gold"
            aria-hidden
          >
            ✓
          </span>
          인터넷 브라우저에서 작동하는 인디자인 PDF 검수 프로그램입니다
        </p>
        <p className="welcome-pc__desc-line">
          <span
            className="welcome-pc__desc-icon welcome-pc__desc-icon--no symbol-gold"
            aria-hidden
          >
            <WelcomePcShield className="welcome-pc__desc-shield" />
          </span>
          <span className="welcome-pc__desc-emphasis">
            원고는 서버에 업로드되지 않으며, 검수 후 브라우저에서 삭제됩니다
          </span>
        </p>
      </div>
      {noAiSticker}
    </div>
  );

  const headerBlock = (
    <header className="welcome-pc__header">
      <div className="welcome-pc__brand-block">
        <h1 className="welcome-pc__brand-row">
          <span className="welcome-pc__title-main">인디야</span>
          <span className="welcome-pc__title-sub">편집자가 만든 출판 검수 서비스</span>
        </h1>
        {!needsWelcomeMessage ? descBlock : null}
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
        src={welcomeMomoFramePc}
        alt=""
        aria-hidden
        decoding="async"
      />
    </div>
  );

  const landingHeaderBlock = (
    <header className="welcome-pc__header welcome-pc__header--landing">
      <div className="welcome-pc__brand-block">
        <div className="welcome-pc__hero-portrait-slot" aria-label="검수냥 모모">
          <div className="welcome-pc__guest-portrait-wrap">{portraitBlock}</div>
        </div>
        {descBlock}
      </div>
    </header>
  );

  const guestAuthButton = (
    <div className="welcome-pc__cta-bar-action welcome-pc__cta-bar-action--pair">
      {!authReady ? (
        <button
          type="button"
          className="btn-welcome-primary welcome-pc__start welcome-pc__auth-submit welcome-pc__auth-submit--single"
          disabled
        >
          로그인 확인 중…
        </button>
      ) : (
        <>
          <button
            type="button"
            className="btn-welcome-primary welcome-pc__start welcome-pc__auth-submit welcome-pc__auth-submit--single"
            onClick={handleGoogleAuth}
            disabled={authPending}
          >
            {authPending ? '시작하는 중…' : '인디야 시작하기'}
          </button>
          <span className="welcome-pc__auth-browse-wrap">
            <button
              type="button"
              className="btn-welcome-primary welcome-pc__start welcome-pc__auth-submit welcome-pc__auth-submit--single welcome-pc__auth-browse--single"
              onClick={() => onBrowse?.()}
              disabled={!onBrowse || authPending}
            >
              먼저 둘러보기
            </button>
            <span className="welcome-pc__cta-browser-note">
              Chrome, Edge 브라우저 권장
            </span>
          </span>
        </>
      )}
    </div>
  );

  const signedInStatusBlock = (
    <div className="welcome-pc__perf-beta welcome-pc__perf-beta--signed-in">
      <span className="welcome-pc__perf-badge-beta">로그인 중</span>
      <span className="welcome-pc__perf-quota welcome-pc__perf-quota--signed-in">
        <span className="welcome-pc__auth-nickname">{signedInName}</span>
        님이 모모와 작업 중입니다
      </span>
    </div>
  );

  const perfBlock = (
    <div className="welcome-pc__cta-group welcome-pc__cta-group--in-top">
      <div className="welcome-pc__perf-ribbon">
        <p className="welcome-pc__perf-l1">
          기계적인 부담을 줄여, 문장에 깊이를 더하도록
        </p>

        <p className="welcome-pc__perf-l2">
          <span className="welcome-pc__perf-l2-center">
            <span className="welcome-pc__perf-anc welcome-pc__perf-anc--left">
              <WelcomePcSparkle className="welcome-pc__perf-spk welcome-pc__perf-spk--big" />
            </span>
            맞춤법 · 외래어 · 표기 통일 검수를{' '}
            <span className="welcome-pc__perf-l2__end">
              3분 만에!
              <span className="welcome-pc__perf-l2-note">(300페이지 기준)</span>
            </span>
            <span className="welcome-pc__perf-anc welcome-pc__perf-anc--right">
              <WelcomePcSparkle className="welcome-pc__perf-spk welcome-pc__perf-spk--big" />
            </span>
          </span>
        </p>
      </div>
    </div>
  );

  const signedInStartButton = (
    <div className="welcome-pc__cta-bar-action welcome-pc__cta-bar-action--pair">
      {!authReady ? (
        <button
          type="button"
          className="btn-welcome-primary welcome-pc__start welcome-pc__auth-submit welcome-pc__auth-submit--single"
          disabled
        >
          로그인 확인 중…
        </button>
      ) : (
        <>
          <button
            type="button"
            className="btn-welcome-primary welcome-pc__start welcome-pc__auth-submit welcome-pc__auth-submit--single"
            onClick={handleStart}
          >
            계속하기
          </button>
          <button
            type="button"
            className="btn-welcome-primary welcome-pc__start welcome-pc__auth-submit welcome-pc__auth-submit--single welcome-pc__auth-logout--single"
            onClick={() => void onLogout()}
          >
            로그아웃
          </button>
        </>
      )}
    </div>
  );

  const heroCtaButton = showSignedInLanding ? signedInStartButton : guestAuthButton;

  const landingRef = useRef(null);

  useEffect(() => {
    if (!isHeroLanding) return;
    const band = landingRef.current?.closest('.welcome-pc__top-band');
    if (band instanceof HTMLElement) {
      band.scrollTop = 0;
    }
  }, [isHeroLanding]);

  const foldCapText = '이해를 돕고자 재구성한 장면입니다';

  const footerBlock = (
    <div className="welcome-pc__bottom-notes">
      <p className="welcome-pc__footer-line">
        <span className="welcome-pc__footer-part">{foldCapText}</span>
        <span className="welcome-pc__footer-sep" aria-hidden="true">
          |
        </span>
        <span className="welcome-pc__footer-part">
          오픈베타 기간 기능 향상을 위해 이용 데이터를 익명으로 수집합니다
        </span>
        <span className="welcome-pc__footer-sep" aria-hidden="true">
          |
        </span>
        <span className="welcome-pc__footer-meta">
          <AppVersionBadge dateOnly />
          <CriteriaHoverTip tip="모모의 방">
            <button
              type="button"
              className="welcome-pc__room-entry"
              onClick={onOpenRoom}
              aria-label="모모의 방"
            >
              <BookOpen size={24} strokeWidth={1.6} aria-hidden />
            </button>
          </CriteriaHoverTip>
        </span>
      </p>
    </div>
  );

  const landingPageBlock = (
    <div className="welcome-pc__landing" ref={landingRef}>
    <div
      className={[
        'welcome-pc__page',
        showSignedInLanding ? 'welcome-pc__page--signed-in' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <section className="welcome-pc__hero" aria-label="서비스 소개">
        <div className="welcome-pc__hero-left">
          {landingHeaderBlock}
          {perfBlock}
          <div className="welcome-pc__guest-cta-match">
            {showSignedInLanding ? signedInStatusBlock : null}
            <div
              className="welcome-pc__hero-cta"
              aria-label={showSignedInLanding ? '검수 계속' : '시작하기'}
            >
              {heroCtaButton}
              {authError && authReady && !showSignedInLanding ? (
                <p className="welcome-pc__auth-error welcome-pc__auth-error--bar" role="alert">
                  {authError}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </section>

    </div>

      <div className="welcome-pc__ba-showcase-bleed">
      <div className="welcome-pc__ba-showcase">
        <section className="welcome-pc__ba" aria-label="검수 전·후 예시">
          <div className="welcome-pc__ba-stage">
            <div className="welcome-pc__ba-split">
              <figure className="welcome-pc__ba-pane welcome-pc__ba-pane--before">
                <img
                  className="welcome-pc__ba-img"
                  src={WELCOME_PC_BEFORE}
                  width={833}
                  height={600}
                  alt="검수 전 예시 — 원고"
                  loading="lazy"
                  decoding="async"
                />
              </figure>
              <figure className="welcome-pc__ba-pane welcome-pc__ba-pane--after">
                <img
                  className="welcome-pc__ba-img"
                  src={WELCOME_PC_AFTER}
                  width={833}
                  height={600}
                  alt="검수 후 예시 — 맞춤법·표기 통일·본용언+보조용언 표기 하이라이트"
                  loading="lazy"
                  decoding="async"
                />
              </figure>
            </div>
          </div>
        </section>
      </div>
      </div>
      {footerBlock}
    </div>
  );

  const stageRailClassName = [
    'welcome-pc__stage-rail',
    'welcome-pc__stage-rail--onboarding',
  ].join(' ');

  return (
    <div className="welcome-pc">
      <div className={layoutClassName}>
        <div
          className={[
            'welcome-pc__top-band',
            needsWelcomeMessage ? 'welcome-pc__top-band--onboarding' : '',
            isHeroLanding ? 'welcome-pc__top-band--guest-vertical' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {!isHeroLanding ? headerBlock : null}
          {isHeroLanding ? landingPageBlock : null}
        </div>

        {needsWelcomeMessage ? (
          <div className="welcome-pc__stage">
            <aside className={stageRailClassName}>
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
          </div>
        ) : null}

        {!isHeroLanding ? footerBlock : null}
      </div>
    </div>
  );
}
