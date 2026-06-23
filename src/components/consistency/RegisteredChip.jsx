import DismissButton from './DismissButton.jsx';

/**
 * @param {{
 *   label: string,
 *   onRemove?: () => void,
 * }} props
 */
export default function RegisteredChip({ label, onRemove }) {
  return (
    <li className="registered-chip">
      <span className="find registered-chip__text">{label}</span>
      {onRemove ? <DismissButton label={label} onClick={onRemove} /> : null}
    </li>
  );
}
