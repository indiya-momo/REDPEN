import { useCallback, useEffect, useRef, useState } from 'react';

const BA_AUTO_SPEED_RATIO = 0.3;
const AUTO_INTERVAL_MS = 3000 / BA_AUTO_SPEED_RATIO;
const RESUME_DELAY_MS = 800 / BA_AUTO_SPEED_RATIO;
/** CSS --welcome-ba-interactive-swipe-ms 과 맞춤 (700ms / 0.3) */
const SWIPE_MS = 700 / BA_AUTO_SPEED_RATIO;

/** @param {{
 *   beforeSrc: string,
 *   afterSrc: string,
 *   beforeAlt: string,
 *   afterAlt: string,
 * }} props
 */
export default function WelcomePcBaInteractive({
  beforeSrc,
  afterSrc,
  beforeAlt,
  afterAlt,
}) {
  /** 0: 검수 전, 1: 검수 후, 2: 검수 전(루프용 복제) — 항상 왼쪽으로만 진행 */
  const [slideIndex, setSlideIndex] = useState(0);
  const [transitionOn, setTransitionOn] = useState(true);
  const [autoPaused, setAutoPaused] = useState(false);
  const resumeTimerRef = useRef(null);
  const snapTimerRef = useRef(null);
  const reducedMotionRef = useRef(false);
  const slidingRef = useRef(false);

  useEffect(() => {
    reducedMotionRef.current = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
  }, []);

  const clearResumeTimer = useCallback(() => {
    if (resumeTimerRef.current) {
      window.clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = null;
    }
  }, []);

  const clearSnapTimer = useCallback(() => {
    if (snapTimerRef.current) {
      window.clearTimeout(snapTimerRef.current);
      snapTimerRef.current = null;
    }
  }, []);

  const advance = useCallback(() => {
    if (slidingRef.current) return;
    if (reducedMotionRef.current) {
      setSlideIndex((value) => (value === 0 ? 1 : 0));
      return;
    }
    slidingRef.current = true;
    setTransitionOn(true);
    setSlideIndex((value) => (value >= 1 ? 2 : 1));
  }, []);

  useEffect(() => {
    if (slideIndex !== 2) {
      if (slideIndex === 0 || slideIndex === 1) {
        slidingRef.current = false;
      }
      return undefined;
    }

    clearSnapTimer();
    snapTimerRef.current = window.setTimeout(() => {
      setTransitionOn(false);
      setSlideIndex(0);
      snapTimerRef.current = null;
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          setTransitionOn(true);
          slidingRef.current = false;
        });
      });
    }, SWIPE_MS);

    return () => clearSnapTimer();
  }, [slideIndex, clearSnapTimer]);

  useEffect(() => {
    if (autoPaused || reducedMotionRef.current) return undefined;
    const id = window.setInterval(() => {
      advance();
    }, AUTO_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [autoPaused, advance]);

  useEffect(
    () => () => {
      clearResumeTimer();
      clearSnapTimer();
    },
    [clearResumeTimer, clearSnapTimer],
  );

  function handleClick() {
    if (!autoPaused) {
      setAutoPaused(true);
      return;
    }
    advance();
  }

  function handleMouseEnter() {
    clearResumeTimer();
  }

  function handleMouseLeave() {
    if (!autoPaused) return;
    clearResumeTimer();
    resumeTimerRef.current = window.setTimeout(() => {
      setAutoPaused(false);
      resumeTimerRef.current = null;
    }, RESUME_DELAY_MS);
  }

  function handleKeyDown(event) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    handleClick();
  }

  const showingAfter = slideIndex === 1;
  const frameClassName = [
    'welcome-pc__ba-interactive',
    showingAfter ? 'welcome-pc__ba-interactive--after' : 'welcome-pc__ba-interactive--before',
    autoPaused ? 'welcome-pc__ba-interactive--paused' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const trackClassName = [
    'welcome-pc__ba-interactive-track',
    transitionOn ? '' : 'welcome-pc__ba-interactive-track--no-transition',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={frameClassName}
      role="button"
      tabIndex={0}
      aria-label="검수 전·후 예시. 클릭하면 자동 전환을 멈추고, 다시 클릭하면 검수 전·후를 바꿉니다."
      aria-pressed={autoPaused}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onKeyDown={handleKeyDown}
    >
      <div className="welcome-pc__ba-interactive-card">
        <figure className="welcome-pc__ba-interactive-frame">
          <div
            className={trackClassName}
            style={{ transform: `translate3d(-${slideIndex * (100 / 3)}%, 0, 0)` }}
          >
            <img
              className="welcome-pc__ba-interactive-slide"
              src={beforeSrc}
              width={833}
              height={600}
              alt={beforeAlt}
              loading="lazy"
              decoding="async"
              draggable={false}
            />
            <img
              className="welcome-pc__ba-interactive-slide"
              src={afterSrc}
              width={833}
              height={600}
              alt={afterAlt}
              loading="lazy"
              decoding="async"
              draggable={false}
            />
            <img
              className="welcome-pc__ba-interactive-slide"
              src={beforeSrc}
              width={833}
              height={600}
              alt=""
              aria-hidden="true"
              loading="lazy"
              decoding="async"
              draggable={false}
            />
          </div>
        </figure>
      </div>
    </div>
  );
}
