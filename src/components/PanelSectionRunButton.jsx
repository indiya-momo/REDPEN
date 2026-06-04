/**
 * @param {{
 *   onClick: () => void | Promise<void>,
 *   disabled?: boolean,
 *   isProcessing?: boolean,
 *   label?: string,
 *   processingLabel?: string,
 *   className?: string,
 *   title?: string,
 * }} props
 */
export default function PanelSectionRunButton({
  onClick,
  disabled = false,
  isProcessing = false,
  label = '시작',
  processingLabel = '검사 중…',
  className = '',
  title,
}) {
  return (
    <button
      type="button"
      className={`btn-add panel-section-run-btn ${className}`.trim()}
      disabled={disabled || isProcessing}
      title={title}
      onClick={() => onClick()}
    >
      {isProcessing ? processingLabel : label}
    </button>
  );
}
