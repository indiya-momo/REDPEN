import { useLayoutEffect, useRef } from 'react';

export const PDF_HIGHLIGHT_TIP_EDIT_HINT =
  '상자를 클릭하면 내용을 수정할 수 있습니다';

const TIP_PAD = 8;

/**
 * 말풍선을 뷰어 화면 안으로 민다. 위가 모자라면 상자 아래, 좌우는 가장자리 안쪽.
 * @param {HTMLElement} el
 */
function placePdfHighlightTip(el) {
  const stage = el.closest('.pdf-canvas-stage');
  const viewer = el.closest('.pdf-viewer');
  const content = el.closest('.pdf-work-pane__content');
  const stageBox = stage?.getBoundingClientRect();
  const viewerBox = viewer?.getBoundingClientRect();
  const contentBox = content?.getBoundingClientRect();
  const boundLeft = Math.max(
    stageBox?.left ?? 0,
    viewerBox?.left ?? 0,
    contentBox?.left ?? 0,
    0,
  );
  const boundTop = Math.max(
    stageBox?.top ?? 0,
    viewerBox?.top ?? 0,
    contentBox?.top ?? 0,
    0,
  );
  const boundRight = Math.min(
    stageBox?.right ?? Number.POSITIVE_INFINITY,
    viewerBox?.right ?? Number.POSITIVE_INFINITY,
    contentBox?.right ?? Number.POSITIVE_INFINITY,
    window.innerWidth,
  );
  const boundBottom = Math.min(
    stageBox?.bottom ?? Number.POSITIVE_INFINITY,
    viewerBox?.bottom ?? Number.POSITIVE_INFINITY,
    contentBox?.bottom ?? Number.POSITIVE_INFINITY,
    window.innerHeight,
  );
  const availW = boundRight - boundLeft;
  if (availW > TIP_PAD * 2) {
    el.style.maxWidth = `${Math.min(22 * 16, availW - TIP_PAD * 2)}px`;
  }

  el.classList.remove('pdf-highlight-tip--below');
  el.style.setProperty('--pdf-tip-nudge-x', '0px');
  el.style.setProperty('--pdf-tip-nudge-y', '0px');

  const box = el.getBoundingClientRect();
  let nudgeX = 0;
  if (box.left < boundLeft + TIP_PAD) {
    nudgeX += boundLeft + TIP_PAD - box.left;
  }
  if (box.right + nudgeX > boundRight - TIP_PAD) {
    nudgeX += boundRight - TIP_PAD - (box.right + nudgeX);
  }
  el.style.setProperty('--pdf-tip-nudge-x', `${nudgeX}px`);

  if (box.top < boundTop + TIP_PAD) {
    el.classList.add('pdf-highlight-tip--below');
  }

  const placed = el.getBoundingClientRect();
  let nudgeY = 0;
  if (placed.top < boundTop + TIP_PAD) {
    nudgeY += boundTop + TIP_PAD - placed.top;
  }
  if (placed.bottom + nudgeY > boundBottom - TIP_PAD) {
    nudgeY += boundBottom - TIP_PAD - (placed.bottom + nudgeY);
  }
  el.style.setProperty('--pdf-tip-nudge-y', `${nudgeY}px`);
}

/**
 * @param {{
 *   tip: string,
 *   matchedText?: string,
 *   left: number,
 *   top: number,
 *   onClose: () => void,
 *   confirmGuideAttr?: string,
 *   choices?: { id: string, label: string }[],
 *   onPickChoice?: (id: string) => void,
 *   onEdit?: () => void,
 * }} props
 */
export default function PdfHighlightTipBubble({
  tip,
  matchedText = '',
  left,
  top,
  onClose,
  confirmGuideAttr,
  choices = [],
  onPickChoice,
  onEdit,
}) {
  const ref = useRef(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    placePdfHighlightTip(el);
  }, [left, top, tip, matchedText, choices.length]);

  return (
    <div
      ref={ref}
      className="pdf-highlight-tip"
      style={{
        left: `${left}px`,
        top: `${top}px`,
      }}
      role="dialog"
      aria-label="검수 안내"
    >
      {onEdit ? (
        <button
          type="button"
          className="pdf-highlight-tip__box"
          onPointerDown={(event) => {
            if (event.button != null && event.button !== 0) return;
            event.preventDefault();
            event.stopPropagation();
            onEdit(matchedText || '');
          }}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          aria-label={
            matchedText ? `${matchedText} 수정` : '내용 수정'
          }
        >
          {matchedText || '내용 수정'}
        </button>
      ) : matchedText ? (
        <p className="pdf-highlight-tip__match">{matchedText}</p>
      ) : null}
      {tip ? <p className="pdf-highlight-tip__body">{tip}</p> : null}
      {choices.length > 1 ? (
        <div className="pdf-highlight-tip__choices">
          <span className="pdf-highlight-tip__choices-arrow" aria-hidden>
            →
          </span>
          {choices.map((choice) => (
            <button
              key={choice.id}
              type="button"
              className="pdf-highlight-tip__choice"
              onClick={() => onPickChoice?.(choice.id)}
            >
              {choice.label}
            </button>
          ))}
        </div>
      ) : null}
      {onEdit ? (
        <p className="pdf-highlight-tip__hint">{PDF_HIGHLIGHT_TIP_EDIT_HINT}</p>
      ) : null}
      <button
        type="button"
        className="pdf-highlight-tip__close"
        data-work-guide={confirmGuideAttr || undefined}
        onClick={onClose}
        aria-label="확인"
      >
        확인
      </button>
    </div>
  );
}
