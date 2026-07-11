/**
 * @param {{
 *   tip: string,
 *   matchedText?: string,
 *   left: number,
 *   top: number,
 *   onClose: () => void,
 *   confirmGuideAttr?: string,
 * }} props
 */
export default function PdfHighlightTipBubble({
  tip,
  matchedText = '',
  left,
  top,
  onClose,
  confirmGuideAttr,
}) {
  return (
    <div
      className="pdf-highlight-tip"
      style={{
        left: `${left}px`,
        top: `${top}px`,
      }}
      role="dialog"
      aria-label="검수 안내"
    >
      {matchedText ? (
        <p className="pdf-highlight-tip__match">{matchedText}</p>
      ) : null}
      <p className="pdf-highlight-tip__body">{tip}</p>
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
