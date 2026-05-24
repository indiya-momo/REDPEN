import { useEffect, useRef, useState } from 'react';
import { publicAssetUrl } from '../lib/publicAssetUrl.js';

const MOMO_VIDEO = publicAssetUrl('momo/momo_front2.mp4');
const MOMO_POSTER = publicAssetUrl('momo/hero-open.png');

/**
 * @param {{ variant?: 'default' | 'gate' }} props
 */
export default function MomoHero({ variant = 'default' }) {
  const isGate = variant === 'gate';
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
    if (reduceMotion || usePoster) return;
    const video = videoRef.current;
    if (!video) return;
    video.play().catch(() => setUsePoster(true));
  }, [reduceMotion, usePoster]);

  const showPoster = reduceMotion || usePoster;

  return (
    <div className={`momo-hero${isGate ? ' momo-hero--gate' : ''}`}>
      <div className="momo-stage">
        {showPoster ? (
          <img className="momo-video" src={MOMO_POSTER} alt="모모" />
        ) : (
          <video
            ref={videoRef}
            className="momo-video"
            src={MOMO_VIDEO}
            poster={MOMO_POSTER}
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            onError={() => setUsePoster(true)}
            aria-label="모모"
          />
        )}
      </div>
      {isGate ? null : <p className="momo-caption">모모</p>}
    </div>
  );
}
