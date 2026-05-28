import DismissButton from './DismissButton.jsx';

/**
 * @param {{
 *   label: string,
 *   checked?: boolean,
 *   onToggle?: (enabled: boolean) => void,
 *   onRemove?: () => void,
 * }} props
 */
export default function RegisteredChip({ label, checked, onToggle, onRemove }) {
  const withCheckbox = onToggle != null && checked != null;

  return (
    <li className="registered-chip">
      {withCheckbox ? (
        <label className="registered-chip__label">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => onToggle(e.target.checked)}
          />
          <span className="find">{label}</span>
        </label>
      ) : (
        <span className="find registered-chip__text">{label}</span>
      )}
      {onRemove ? <DismissButton label={label} onClick={onRemove} /> : null}
    </li>
  );
}
