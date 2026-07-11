import { useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * 둘러보기 가이드 — 앵커를 가리키며 탭하는 손
 * (패널 overflow:hidden 때문에 fixed 포털로 그림)
 * @param {{
 *   active?: boolean,
 *   anchorSelector?: string,
 *   align?: 'end' | 'center',
 * }} props
 */
export default function GuideClickHand({
  active = false,
  anchorSelector = '[data-work-guide-criteria-run]',
  align = 'end',
}) {
  const [style, setStyle] = useState(
    /** @type {import('react').CSSProperties | null} */ (null),
  );

  useLayoutEffect(() => {
    if (!active) {
      setStyle(null);
      return undefined;
    }
    const sync = () => {
      const el = document.querySelector(anchorSelector);
      if (!el) {
        setStyle(null);
        return;
      }
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        setStyle(null);
        return;
      }
      if (align === 'center') {
        setStyle({
          position: 'fixed',
          left: rect.left + rect.width / 2 - 14,
          top: rect.top + rect.height / 2 - 10,
          zIndex: 10020,
        });
        return;
      }
      setStyle({
        position: 'fixed',
        left: rect.right - 28,
        top: rect.bottom - 8,
        zIndex: 10020,
      });
    };
    sync();
    const rafId = requestAnimationFrame(sync);
    const intervalId = window.setInterval(sync, 250);
    window.addEventListener('resize', sync);
    window.addEventListener('scroll', sync, true);
    return () => {
      cancelAnimationFrame(rafId);
      window.clearInterval(intervalId);
      window.removeEventListener('resize', sync);
      window.removeEventListener('scroll', sync, true);
    };
  }, [active, anchorSelector, align]);

  if (!active || !style || typeof document === 'undefined') return null;

  return createPortal(
    <span
      className="guide-click-hand guide-click-hand--fixed"
      style={style}
      aria-hidden
    >
      <span className="guide-click-hand__emoji">👆</span>
    </span>,
    document.body,
  );
}
