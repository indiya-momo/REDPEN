import { useEffect, useRef, useState } from 'react';
import { publicAssetUrl } from '../../lib/publicAssetUrl.js';

/** PC `momo-gate.mp4`와 분리 — 모바일 대문 전용 경량 영상 */
const GATE_VIDEO = publicAssetUrl('momo/momo-gate-mobile.mp4');
const GATE_POSTER = publicAssetUrl('momo/hero-open.png');

/**
 * 모바일 웰컴 액자 영상 — PC MomoHero와 분리 (preload·에셋 경량화)
 */
export default function WelcomeMoMomoHero() {
  const videoRef = useRef(/** @type {HTMLVideoElement | null} */ (null));
  const [reduceMotion, setReduceMotion] = useState(false);
  const [usePoster, setUsePoster] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduceMotion(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (reduceMotion || usePoster) return undefined;

    const video = videoRef.current;
    if (!video) return undefined;

    const startLoad = () => {
      if (video.readyState >= HTMLMediaElement.HAVE_METADATA) return;
      video.preload = 'auto';
      video.load();
    };

    const useIdle = typeof requestIdleCallback === 'function';
    const idleId = useIdle
      ? requestIdleCallback(startLoad, { timeout: 1200 })
      : window.setTimeout(startLoad, 400);

    const playWhenReady = () => {
      try {
        const playResult = video.play();
        if (playResult && typeof playResult.catch === 'function') {
          playResult.catch(() => setUsePoster(true));
        }
      } catch {
        setUsePoster(true);
      }
    };

    video.addEventListener('canplay', playWhenReady, { once: true });

    return () => {
      if (useIdle) {
        cancelIdleCallback(idleId);
      } else {
        window.clearTimeout(idleId);
      }
      video.removeEventListener('canplay', playWhenReady);
    };
  }, [reduceMotion, usePoster]);

  const showPoster = reduceMotion || usePoster;

  return (
    <div className="momo-hero momo-hero--gate welcome-mo-momo-hero">
      <div className="momo-stage">
        {showPoster ? (
          <img className="momo-video" src={GATE_POSTER} alt="모모" />
        ) : (
          <video
            ref={videoRef}
            className="momo-video"
            src={GATE_VIDEO}
            poster={GATE_POSTER}
            autoPlay
            loop
            muted
            playsInline
            preload="none"
            onError={() => setUsePoster(true)}
            aria-label="모모"
          />
        )}
      </div>
    </div>
  );
}
