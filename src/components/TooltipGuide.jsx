import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { publicAssetUrl } from '../lib/publicAssetUrl.js';
import {
  dismissTooltipGuide,
  isTooltipGuideDismissed,
} from '../lib/tooltipGuideStorage.js';
import { isWorkGuideDebug, logWorkGuideDebug } from '../lib/workGuideDebug.js';

const DEFAULT_MOMO_IMAGE = publicAssetUrl('momo/bullon4.png');
const TOOLTIP_GAP = 16;

/**
 * @param {{
 *   selector: string,
 *   leftFromTargetLeft?: number,
 *   topFromTargetBottom?: number,
 *   topFromTargetTop?: number,
 * }} spec
 * @returns {import('react').CSSProperties | null}
 */
function fixedStyleFromAlignSpec(spec) {
  const target = document.querySelector(spec.selector);
  if (!target) return null;
  const rect = target.getBoundingClientRect();
  const useTop =
    spec.topFromTargetTop != null && Number.isFinite(spec.topFromTargetTop);
  return {
    left: rect.left + (spec.leftFromTargetLeft ?? 0),
    top: useTop
      ? rect.top + spec.topFromTargetTop
      : rect.bottom + (spec.topFromTargetBottom ?? 0),
    transform: 'none',
  };
}

/**
 * @param {{
 *   horizontal: { selector: string, leftFromTargetLeft?: number },
 *   vertical: {
 *     selector: string,
 *     topFromTargetBottom?: number,
 *     topFromTargetTop?: number,
 *   },
 * }} split
 */
function fixedStyleFromAlignSplit(split) {
  const hEl = document.querySelector(split.horizontal.selector);
  const vEl = document.querySelector(split.vertical.selector);
  if (!hEl || !vEl) return null;
  const hRect = hEl.getBoundingClientRect();
  const vRect = vEl.getBoundingClientRect();
  const useTop =
    split.vertical.topFromTargetTop != null &&
    Number.isFinite(split.vertical.topFromTargetTop);
  return {
    left: hRect.left + (split.horizontal.leftFromTargetLeft ?? 0),
    top: useTop
      ? vRect.top + split.vertical.topFromTargetTop
      : vRect.bottom + (split.vertical.topFromTargetBottom ?? 0),
    transform: 'none',
  };
}

/**
 * @param {{
 *   selector: string,
 *   leftFromTargetLeft?: number,
 *   topFromTargetBottom?: number,
 *   topFromTargetTop?: number,
 * } | null | undefined} alignToBubble
 * @param {readonly ({
 *   selector: string,
 *   leftFromTargetLeft?: number,
 *   topFromTargetBottom?: number,
 *   topFromTargetTop?: number,
 * } | {
 *   alignSplit: {
 *     horizontal: { selector: string, leftFromTargetLeft?: number },
 *     vertical: {
 *       selector: string,
 *       topFromTargetBottom?: number,
 *       topFromTargetTop?: number,
 *     },
 *   },
 * })[] | null | undefined} alignToBubbleChain
 */
function resolveAlignToStyle(alignToBubble, alignToBubbleChain) {
  const chain =
    alignToBubbleChain && alignToBubbleChain.length > 0
      ? alignToBubbleChain
      : alignToBubble
        ? [alignToBubble]
        : [];
  for (const spec of chain) {
    if ('alignSplit' in spec && spec.alignSplit) {
      const style = fixedStyleFromAlignSplit(spec.alignSplit);
      if (style) return { style, spec: spec.alignSplit };
      continue;
    }
    if ('selector' in spec && spec.selector) {
      const style = fixedStyleFromAlignSpec(spec);
      if (style) return { style, spec };
    }
  }
  return null;
}

function fixedTooltipPosition(rect, placement, offsetX, offsetY) {
  switch (placement) {
    case 'top':
      return {
        left: rect.left + offsetX,
        top: rect.top - TOOLTIP_GAP + offsetY,
        transform: 'translateY(-100%)',
      };
    case 'left':
      return {
        left: rect.left - TOOLTIP_GAP + offsetX,
        top: rect.top + rect.height / 2 + offsetY,
        transform: 'translate(-100%, -50%)',
      };
    case 'right':
      return {
        left: rect.right + TOOLTIP_GAP + offsetX,
        top: rect.top + rect.height / 2 + offsetY,
        transform: 'translateY(-50%)',
      };
    case 'bottom':
    default:
      return {
        left: rect.left + offsetX,
        top: rect.bottom + TOOLTIP_GAP + offsetY,
      };
  }
}

/**
 * @param {{
 *   storageKey: string,
 *   message?: import('react').ReactNode,
 *   title?: string,
 *   imageSrc?: string | null,
 *   imageAlt?: string,
 *   placement?: 'top' | 'bottom' | 'left' | 'right',
 *   bubbleType?: 'auto' | 'left' | 'right',
 *   offsetX?: number,
 *   offsetY?: number,
 *   onDismiss?: () => void,
 *   useFixedLayer?: boolean,
 *   alignToBubble?: {
 *     selector: string,
 *     leftFromTargetLeft?: number,
 *     topFromTargetBottom?: number,
 *     topFromTargetTop?: number,
 *   } | null,
 *   alignToBubbleChain?: readonly ({
 *     selector: string,
 *     leftFromTargetLeft?: number,
 *     topFromTargetBottom?: number,
 *     topFromTargetTop?: number,
 *   } | {
 *     alignSplit: {
 *       horizontal: { selector: string, leftFromTargetLeft?: number },
 *       vertical: {
 *         selector: string,
 *         topFromTargetBottom?: number,
 *         topFromTargetTop?: number,
 *       },
 *     },
 *   })[] | null,
 *   bubbleGuideStep?: string | number | null,
 *   pinned?: boolean,
 *   children: import('react').ReactElement,
 * }} props
 */
export default function TooltipGuide({
  storageKey,
  message,
  title,
  imageSrc = DEFAULT_MOMO_IMAGE,
  imageAlt = '모모',
  placement = 'bottom',
  bubbleType = 'auto',
  offsetX = 0,
  offsetY = 0,
  onDismiss,
  useFixedLayer = false,
  alignToBubble = null,
  alignToBubbleChain = null,
  bubbleGuideStep = null,
  pinned = false,
  children,
}) {
  const anchorRef = useRef(/** @type {HTMLSpanElement | null} */ (null));
  const [dismissed, setDismissed] = useState(() =>
    isTooltipGuideDismissed(storageKey),
  );
  const [fixedStyle, setFixedStyle] = useState(
    /** @type {import('react').CSSProperties | null} */ (null),
  );

  useEffect(() => {
    if (pinned) {
      setDismissed(false);
      return;
    }
    setDismissed(isTooltipGuideDismissed(storageKey));
  }, [storageKey, pinned]);

  const usePortalFixed = useFixedLayer;

  const syncFixedPosition = useCallback(() => {
    if (!usePortalFixed || dismissed) return;
    const aligned = resolveAlignToStyle(alignToBubble, alignToBubbleChain);
    if (aligned) {
      setFixedStyle(aligned.style);
      if (isWorkGuideDebug()) {
        logWorkGuideDebug('fixed-align-bubble', {
          storageKey,
          selector: aligned.spec.selector,
          fixedStyle: aligned.style,
        });
      }
      return;
    }
    const anchor = anchorRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const next = fixedTooltipPosition(rect, placement, offsetX, offsetY);
    setFixedStyle(next);
    if (isWorkGuideDebug()) {
      logWorkGuideDebug('fixed-anchor', {
        storageKey,
        placement,
        rect: {
          left: rect.left,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height,
        },
        fixedStyle: next,
      });
    }
  }, [
    usePortalFixed,
    dismissed,
    alignToBubble,
    alignToBubbleChain,
    placement,
    offsetX,
    offsetY,
    storageKey,
  ]);

  useLayoutEffect(() => {
    if (!usePortalFixed || dismissed) {
      setFixedStyle(null);
      return undefined;
    }
    syncFixedPosition();
    const rafId = requestAnimationFrame(() => syncFixedPosition());
    window.addEventListener('resize', syncFixedPosition);
    window.addEventListener('scroll', syncFixedPosition, true);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', syncFixedPosition);
      window.removeEventListener('scroll', syncFixedPosition, true);
    };
  }, [usePortalFixed, dismissed, syncFixedPosition]);

  const handleConfirm = useCallback(
    (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (dismissed) return;
      dismissTooltipGuide(storageKey);
      setDismissed(true);
      onDismiss?.();
    },
    [dismissed, storageKey, onDismiss],
  );

  const showMomo = imageSrc != null && imageSrc !== '';

  const bubbleClassName = [
    'tooltip-guide',
    `tooltip-guide--${placement}`,
    usePortalFixed ? 'tooltip-guide--fixed-layer' : '',
    bubbleType !== 'auto' ? `tooltip-guide--bubble-${bubbleType}` : '',
    !showMomo ? 'tooltip-guide--no-momo' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const bubbleStyle = usePortalFixed
    ? {
        position: 'fixed',
        zIndex: 10010,
        ...fixedStyle,
        visibility: fixedStyle ? 'visible' : 'hidden',
      }
    : {
        ...(offsetX !== 0 ? { '--tooltip-shift-x': `${offsetX}px` } : {}),
        ...(offsetY !== 0 ? { '--tooltip-shift-y': `${offsetY}px` } : {}),
      };

  const bubble = !dismissed ? (
    <div
      style={bubbleStyle}
      className={bubbleClassName}
      role="status"
      aria-live="polite"
      {...(bubbleGuideStep != null
        ? { 'data-work-guide-bubble': String(bubbleGuideStep) }
        : {})}
    >
      <div className="tooltip-guide__body">
        {showMomo ? (
          <div className="tooltip-guide__momo">
            <img
              src={imageSrc}
              alt={imageAlt}
              className="tooltip-guide__image"
            />
          </div>
        ) : null}
        <div className="tooltip-guide__content">
          {title ? <p className="tooltip-guide__title">{title}</p> : null}
          {message ? (
            <div className="tooltip-guide__message">{message}</div>
          ) : null}
        </div>
        <button
          type="button"
          className="tooltip-guide__confirm"
          onClick={handleConfirm}
        >
          확인
        </button>
      </div>
    </div>
  ) : null;

  return (
    <span className="tooltip-guide-anchor" ref={anchorRef}>
      {children}
      {usePortalFixed && bubble
        ? createPortal(bubble, document.body)
        : bubble}
    </span>
  );
}
