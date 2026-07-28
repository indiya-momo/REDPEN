import CriteriaHoverTip from './CriteriaHoverTip.jsx';

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
  processingLabel = '검수 중…',
  className = '',
  title,
}) {
  const button = (
    <button
      type="button"
      className={`btn-add panel-section-run-btn ${className}`.trim()}
      disabled={disabled || isProcessing}
      onClick={() => onClick()}
    >
      {isProcessing ? processingLabel : label}
    </button>
  );

  if (!title) return button;

  return <CriteriaHoverTip tip={title}>{button}</CriteriaHoverTip>;
}
