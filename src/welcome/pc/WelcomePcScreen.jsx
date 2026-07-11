/**
 * PC 대문(960px+): 서비스 설명, Google 로그인 CTA, 검수 시작.
 * 로그인 후 온보딩 미완료면 WelcomeProfileOnboarding, 완료면 onStart로 main.
 * App이 내려준 onGoogleSignIn/onStart/authSession만 사용 (모바일 분기 없음).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen } from 'lucide-react';
import AppVersionBadge from '../../components/AppVersionBadge.jsx';
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
import { publicAssetUrl } from '../../lib/publicAssetUrl.js';
import WelcomeProfileOnboarding from './WelcomeProfileOnboarding.jsx';
import './welcome-pc.css';

const WELCOME_PC_BEFORE = `${import.meta.env.BASE_URL}welcome/before_after22-crop1.png`;
const WELCOME_PC_AFTER = `${import.meta.env.BASE_URL}welcome/before_after22-crop2.png`;
const WELCOME_PC_PDF_FULL = `${import.meta.env.BASE_URL}welcome/pdf-full.png`;
const BA_BRIDGE_LABEL = '모모가 빨간펜을 들고 살펴봅니다';

/** 검수 전·후 ↔ 원 사이 빨간펜 (가로형 투명 PNG, width 기준) */
const BA_GAP_PEN = publicAssetUrl('momo/pen_transparent.png');

/** 브릿지 SVG — 흰 원(disc)만 */
const BA_BRIDGE_DISC_VIEWBOX = '0 0 100 100';
const BA_BRIDGE_CX = 50;
const BA_BRIDGE_CY = 50;
const BA_BRIDGE_R_DISC = 50;
const ENTER_MAIN_AFTER_GOOGLE_KEY = 'indiya-enter-main-after-google';

const SPARKLE_PATH = 'M12 0l2.4 9.6L24 12l-9.6 2.4L12 24l-2.4-9.6L0 12l9.6-2.4z';

function WelcomePcSparkle({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d={SPARKLE_PATH} />
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
      : 'welcome-pc__layout--guest',
  ].join(' ');

  const isHeroLanding = !needsWelcomeMessage;
  const showSignedInLanding = loggedIn && isHeroLanding;

  const headerBlock = (
    <header className="welcome-pc__header">
      <div className="welcome-pc__brand-block">
        <h1 className="welcome-pc__brand-row">
          <span className="welcome-pc__title-main">인디야</span>
          <span className="welcome-pc__title-sub">검수냥 모모 이야기</span>
        </h1>
        {!needsWelcomeMessage ? (
          <div className="welcome-pc__desc">
            <p className="welcome-pc__desc-line">
              <span className="welcome-pc__desc-icon welcome-pc__desc-icon--ok" aria-hidden>
                ✓
              </span>
              선택한 맞춤법 · 표기 통일 기준에 따라 PDF 원고를 검수합니다
            </p>
            <p className="welcome-pc__desc-line">
              <span className="welcome-pc__desc-icon welcome-pc__desc-icon--no" aria-hidden>
                🚫
              </span>
              AI 자동 수정은 하지 않으며,{' '}
              <span className="welcome-pc__desc-emphasis">원고는 서버에 저장되지 않습니다</span>
            </p>
          </div>
        ) : null}
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
            {authPending ? '구글 로그인 연결 중…' : '구글로 시작하기'}
          </button>
          <button
            type="button"
            className="btn-welcome-primary welcome-pc__start welcome-pc__auth-submit welcome-pc__auth-submit--single welcome-pc__auth-browse--single"
            onClick={() => onBrowse?.()}
            disabled={!onBrowse || authPending}
          >
            먼저 둘러보기
          </button>
        </>
      )}
    </div>
  );

  const perfBetaBlock = (
    <div className="welcome-pc__perf-beta welcome-pc__perf-beta--guest">
      <span className="welcome-pc__perf-badge-beta">오픈베타 중</span>
      <span className="welcome-pc__perf-quota">
        둘러보기로 먼저 화면을 익히고, 회원은 매일 검수 무료(크롬 권장)
      </span>
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

  const heroStatusBlock = showSignedInLanding ? signedInStatusBlock : perfBetaBlock;

  const perfBlock = (
    <div className="welcome-pc__cta-group welcome-pc__cta-group--in-top">
      <div className="welcome-pc__perf-ribbon">
        <p className="welcome-pc__perf-l1">
          <span className="welcome-pc__perf-l1-num" aria-hidden>
            ❶
          </span>
          맞춤법
          <span className="welcome-pc__perf-l1-num" aria-hidden>
            ❷
          </span>
          표기 통일
          <span className="welcome-pc__perf-l1-num" aria-hidden>
            ❸
          </span>
          보조용언+본용언 표기
        </p>

        <p className="welcome-pc__perf-l2">
          <span className="welcome-pc__perf-anc welcome-pc__perf-anc--left">
            <WelcomePcSparkle className="welcome-pc__perf-spk welcome-pc__perf-spk--big" />
            신국판
          </span>
          {' '}300페이지 PDF 검수에 단{' '}
          <span className="welcome-pc__perf-l2__gold">3초</span>
          <span className="welcome-pc__perf-anc welcome-pc__perf-anc--right">
            !
            <WelcomePcSparkle className="welcome-pc__perf-spk welcome-pc__perf-spk--big" />
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

  const foldCapText =
    '사용자의 이해를 돕고자 재구성한 장면으로 맞춤법과 표기 통일 검수는 각각 진행합니다';

  const landingPageBlock = (
    <div className="welcome-pc__landing">
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
          {headerBlock}
          {perfBlock}
          <div className="welcome-pc__guest-cta-match">
            {heroStatusBlock}
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
        <aside className="welcome-pc__hero-right" aria-label="검수냥 모모">
          <p className="welcome-pc__guest-hero-bubble">현직 편집자가 만들었다냥🐾</p>
          <div className="welcome-pc__guest-portrait-wrap">{portraitBlock}</div>
        </aside>
      </section>

    </div>

      <div className="welcome-pc__ba-showcase-bleed">
      <div className="welcome-pc__ba-showcase">
        <section className="welcome-pc__ba" aria-label="검수 전·후 예시">
        <div className="welcome-pc__ba-split">
          <figure className="welcome-pc__ba-pane welcome-pc__ba-pane--before">
            <img
              className="welcome-pc__ba-img"
              src={WELCOME_PC_BEFORE}
              width={986}
              height={709}
              alt="검수 전 예시 — 원고"
              loading="lazy"
              decoding="async"
            />
          </figure>
          <div className="welcome-pc__ba-bridge" aria-label={BA_BRIDGE_LABEL}>
            <div className="welcome-pc__ba-bridge-mid">
              <div className="welcome-pc__ba-bridge-momo-wrap">
                <svg
                  className="welcome-pc__ba-bridge-disc"
                  viewBox={BA_BRIDGE_DISC_VIEWBOX}
                  aria-hidden="true"
                  focusable="false"
                >
                  <circle
                    className="welcome-pc__ba-bridge-disc-fill"
                    cx={BA_BRIDGE_CX}
                    cy={BA_BRIDGE_CY}
                    r={BA_BRIDGE_R_DISC}
                  />
                </svg>
                <img
                  className="welcome-pc__ba-bridge-img"
                  src={WELCOME_PC_PDF_FULL}
                  width={142}
                  height={142}
                  alt=""
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <p className="welcome-pc__ba-bridge-caption">{BA_BRIDGE_LABEL}</p>
            </div>
          </div>
          <figure className="welcome-pc__ba-pane welcome-pc__ba-pane--after">
            <img
              className="welcome-pc__ba-img"
              src={WELCOME_PC_AFTER}
              width={1028}
              height={713}
              alt="검수 후 예시 — 맞춤법·표기 통일·본용언+보조용언 표기 하이라이트"
              loading="lazy"
              decoding="async"
            />
          </figure>
          <div className="welcome-pc__ba-gaps" aria-hidden="true">
            <div className="welcome-pc__ba-gap welcome-pc__ba-gap--before">
              <img
                className="welcome-pc__ba-gap-illus"
                src={BA_GAP_PEN}
                alt=""
                loading="lazy"
                decoding="async"
              />
            </div>
            <div className="welcome-pc__ba-gap welcome-pc__ba-gap--after">
              <img
                className="welcome-pc__ba-gap-illus welcome-pc__ba-gap-illus--flip"
                src={BA_GAP_PEN}
                alt=""
                loading="lazy"
                decoding="async"
              />
            </div>
          </div>
        </div>
        </section>

        <p className="welcome-pc__fold-cap">{foldCapText}</p>
      </div>
      </div>
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

        <div className="welcome-pc__bottom-notes">
          <p className="welcome-pc__footer-line">
            <span className="welcome-pc__footer-part">
              오픈베타 기간 동안 기능 향상을 위해 사용자의 이용 데이터를 익명으로 수집합니다
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
