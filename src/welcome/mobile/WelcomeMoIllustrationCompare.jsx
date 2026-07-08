import { useEffect, useRef, useState } from 'react';
import revealManifest from './welcome-mo-reveal-regions.json';

const BASE = import.meta.env.BASE_URL;
const STAGGER_MS = revealManifest.staggerMs ?? 600;
const FINAL_PAUSE_MS = 100;

const highlightLayer = revealManifest.layers.find((layer) => layer.id === 'highlight');
const HIGHLIGHT_OVERLAY = highlightLayer
  ? `${BASE}${highlightLayer.src.replace(/^\//, '')}`
  : '';

/** @type {{ i: number, x: number, y: number, w: number, h: number }[]} */
const HIGHLIGHT_STEPS = (highlightLayer?.regions ?? []).map((region, index) => ({
  ...region,
  i: index,
}));

/** @param {{ x: number, y: number, w: number, h: number }} region */
function regionClipPath(region) {
  return `inset(${region.y}% ${100 - region.x - region.w}% ${100 - region.y - region.h}% ${region.x}%)`;
}

/**
 * @param {{ src: string, alt: string, afterSrc?: string }} props
 */
export function WelcomeMoIllustrationFigure({ src, alt, afterSrc }) {
  const wrapRef = useRef(null);
  const [inView, setInView] = useState(false);
  const [revealedCount, setRevealedCount] = useState(0);
  const [showFinalAfter, setShowFinalAfter] = useState(false);
  const twoPhase = Boolean(afterSrc && HIGHLIGHT_OVERLAY);

  useEffect(() => {
    if (!twoPhase || !wrapRef.current) return undefined;
    const node = wrapRef.current;

    const startReveal = () => setInView(true);

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          startReveal();
          observer.disconnect();
        }
      },
      { root: null, threshold: 0.1, rootMargin: '0px 0px 8% 0px' },
    );

    observer.observe(node);
    const rect = node.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      startReveal();
    }

    return () => observer.disconnect();
  }, [twoPhase]);

  useEffect(() => {
    if (!inView || !twoPhase) return undefined;

    setRevealedCount(0);
    setShowFinalAfter(false);

    const timers = HIGHLIGHT_STEPS.map((_, index) =>
      window.setTimeout(
        () => setRevealedCount((count) => Math.max(count, index + 1)),
        index * STAGGER_MS,
      ),
    );

    const finalDelay =
      HIGHLIGHT_STEPS.length * STAGGER_MS + FINAL_PAUSE_MS;
    timers.push(
      window.setTimeout(() => setShowFinalAfter(true), finalDelay),
    );

    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [inView, twoPhase]);

  const illusClass = [
    'welcome-mo__illus',
    twoPhase ? 'welcome-mo__illus--after' : '',
    showFinalAfter ? 'welcome-mo__illus--final-on' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div ref={wrapRef} className={illusClass}>
      <img
        className="welcome-mo__illus-img"
        src={src}
        alt={alt}
        width={revealManifest.size.width}
        height={revealManifest.size.height}
        loading="lazy"
        decoding="async"
      />
      {twoPhase ? (
        <>
          {HIGHLIGHT_STEPS.map((step) => (
            <div
              key={step.i}
              className={`welcome-mo__mark-reveal${step.i < revealedCount ? ' welcome-mo__mark-reveal--on' : ''}`}
              style={{ clipPath: regionClipPath(step) }}
              aria-hidden="true"
            >
              <img
                className="welcome-mo__illus-overlay-img"
                src={HIGHLIGHT_OVERLAY}
                alt=""
                width={revealManifest.size.width}
                height={revealManifest.size.height}
                loading="lazy"
                decoding="async"
              />
            </div>
          ))}
          <img
            className="welcome-mo__illus-final"
            src={afterSrc}
            alt=""
            width={revealManifest.size.width}
            height={revealManifest.size.height}
            loading="lazy"
            decoding="async"
            aria-hidden="true"
          />
        </>
      ) : null}
    </div>
  );
}
