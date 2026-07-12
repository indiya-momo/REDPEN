import { useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * 둘러보기 가이드 — 앵커를 가리키며 탭하는 손
 * (패널 overflow:hidden 때문에 기본은 fixed 포털.
 *  dialog top layer 안에서는 usePortal=false 로 다이얼로그 자손에 그림)
 * @param {{
 *   active?: boolean,
 *   anchorSelector?: string,
 *   align?: 'end' | 'center' | 'label-gap',
 *   usePortal?: boolean,
 * }} props
 */
export default function GuideClickHand({
  active = false,
  anchorSelector = '[data-work-guide-criteria-run]',
  align = 'end',
  usePortal = true,
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
      /** 「기준 검수」글자 사이 — 손끝은 공백 쪽, 본문은 글자 아래 */
      if (align === 'label-gap') {
        setStyle({
          position: 'fixed',
          left: rect.left + rect.width / 2 - 14,
          top: rect.top + rect.height * 0.55,
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

  const node = (
    <span
      className={[
        'guide-click-hand',
        'guide-click-hand--fixed',
        align === 'label-gap' ? 'guide-click-hand--label-gap' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={style}
      aria-hidden
    >
      <span className="guide-click-hand__emoji">👆</span>
    </span>
  );

  if (!usePortal) return node;
  return createPortal(node, document.body);
}
