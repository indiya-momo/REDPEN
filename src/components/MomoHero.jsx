import { useEffect, useState } from 'react';

const MOMO_VIDEO = '/momo/momo_front2.mp4';
const MOMO_POSTER = '/momo/hero-open.png';

export default function MomoHero() {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduceMotion(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  return (
    <div className="momo-hero">
      <div className="momo-stage">
        {reduceMotion ? (
          <img className="momo-video" src={MOMO_POSTER} alt="" />
        ) : (
          <video
            className="momo-video"
            src={MOMO_VIDEO}
            poster={MOMO_POSTER}
            autoPlay
            loop
            muted
            playsInline
            aria-label="모모"
          />
        )}
      </div>
      <p className="momo-caption">모모</p>
    </div>
  );
}
