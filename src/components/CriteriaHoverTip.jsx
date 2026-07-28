import {
  cloneElement,
  isValidElement,
  useCallback,
  useId,
  useRef,
} from 'react';

const VIEWPORT_MARGIN = 8;
const TIP_GAP = 4;

/**
 * @param {HTMLElement} rootEl
 * @param {HTMLElement} bubbleEl
 * @param {'inline' | 'wrap' | 'block' | 'heading'} variant
 */
function placeBubble(rootEl, bubbleEl, variant) {
  const anchorEl =
    variant === 'heading'
      ? rootEl.closest(
          '.caution-checklist-summary-title, .builtin-spelling-summary-title, .loanword-check-summary-title',
        ) ?? rootEl
      : rootEl;

  bubbleEl.style.position = 'fixed';
  bubbleEl.style.right = 'auto';
  bubbleEl.style.bottom = 'auto';
  bubbleEl.style.transform = 'none';
  bubbleEl.style.maxWidth = `${window.innerWidth - VIEWPORT_MARGIN * 2}px`;
  bubbleEl.style.visibility = 'hidden';
  bubbleEl.style.opacity = '1';

  const anchorRect = anchorEl.getBoundingClientRect();
  let top = anchorRect.bottom + TIP_GAP;
  let left = anchorRect.right;

  bubbleEl.style.top = `${top}px`;
  bubbleEl.style.left = `${left}px`;

  let bubbleRect = bubbleEl.getBoundingClientRect();
  left = anchorRect.right - bubbleRect.width;

  if (left < VIEWPORT_MARGIN) left = VIEWPORT_MARGIN;
  if (left + bubbleRect.width > window.innerWidth - VIEWPORT_MARGIN) {
    left = window.innerWidth - VIEWPORT_MARGIN - bubbleRect.width;
  }

  if (top + bubbleRect.height > window.innerHeight - VIEWPORT_MARGIN) {
    top = anchorRect.top - bubbleRect.height - TIP_GAP;
  }
  if (top < VIEWPORT_MARGIN) top = VIEWPORT_MARGIN;

  bubbleEl.style.top = `${top}px`;
  bubbleEl.style.left = `${left}px`;
  bubbleEl.style.visibility = '';
  bubbleEl.style.opacity = '';
}

/**
 * @param {HTMLElement} bubbleEl
 */
function resetBubble(bubbleEl) {
  bubbleEl.style.position = '';
  bubbleEl.style.top = '';
  bubbleEl.style.left = '';
  bubbleEl.style.right = '';
  bubbleEl.style.bottom = '';
  bubbleEl.style.transform = '';
  bubbleEl.style.maxWidth = '';
  bubbleEl.style.visibility = '';
  bubbleEl.style.opacity = '';
}

/**
 * 기준 패널·아이콘 버튼 공통 호버 툴팁 (브라우저 title 대신 흰 말풍선).
 * @param {{
 *   tip?: string,
 *   children: import('react').ReactNode,
 *   className?: string,
 *   variant?: 'inline' | 'wrap' | 'block' | 'heading',
 * }} props
 */
export default function CriteriaHoverTip({
  tip,
  children,
  className = '',
  variant = 'wrap',
}) {
  const tipId = useId();
  const rootRef = useRef(/** @type {HTMLSpanElement | null} */ (null));
  const bubbleRef = useRef(/** @type {HTMLSpanElement | null} */ (null));

  const reposition = useCallback(() => {
    const rootEl = rootRef.current;
    const bubbleEl = bubbleRef.current;
    if (!rootEl || !bubbleEl) return;
    placeBubble(rootEl, bubbleEl, variant);
  }, [variant]);

  const handleShow = useCallback(() => {
    reposition();
  }, [reposition]);

  const handleHide = useCallback(() => {
    const bubbleEl = bubbleRef.current;
    if (bubbleEl) resetBubble(bubbleEl);
  }, []);

  const handleBlur = useCallback(
    (event) => {
      const rootEl = rootRef.current;
      if (!rootEl) return;
      const next = event.relatedTarget;
      if (next instanceof Node && rootEl.contains(next)) return;
      handleHide();
    },
    [handleHide],
  );

  if (!tip) return <>{children}</>;

  const rootClass = [
    'criteria-hover-tip',
    variant === 'wrap' ? 'criteria-hover-tip--wrap' : '',
    variant === 'block' ? 'criteria-hover-tip--wrap-block' : '',
    variant === 'heading' ? 'criteria-hover-tip--heading' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  let trigger = children;
  if (isValidElement(children)) {
    const childProps = { ...children.props };
    delete childProps.title;
    const prevDescribedBy = childProps['aria-describedby'];
    trigger = cloneElement(children, {
      ...childProps,
      'aria-describedby': prevDescribedBy
        ? `${prevDescribedBy} ${tipId}`
        : tipId,
    });
  }

  return (
    <span
      ref={rootRef}
      className={rootClass}
      onMouseEnter={handleShow}
      onMouseLeave={handleHide}
      onFocusCapture={handleShow}
      onBlur={handleBlur}
    >
      {trigger}
      <span
        id={tipId}
        ref={bubbleRef}
        className="criteria-hover-tip__bubble"
        role="tooltip"
      >
        {tip}
      </span>
    </span>
  );
}
