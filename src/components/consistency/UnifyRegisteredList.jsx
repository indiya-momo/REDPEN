import { consistencyEntryKey, consistencyEntryLabel } from './entryLabel.js';
import DismissButton from './DismissButton.jsx';

/**
 * @param {{
 *   entries: { tailWord: string, displayLabel?: string }[],
 *   pinnedTailWord: string | null,
 *   onPin: (tailWord: string) => void,
 *   onRemove: (tailWord: string) => void,
 * }} props
 */
export default function UnifyRegisteredList({
  entries,
  pinnedTailWord,
  onPin,
  onRemove,
}) {
  if (!entries.length) return null;

  return (
    <ul className="tail-list tail-list--unify">
      {entries.map((row) => {
        const label = consistencyEntryLabel(row);
        const isPinned = pinnedTailWord === row.tailWord;
        return (
          <li key={consistencyEntryKey(row)} className="registered-chip registered-chip--unify">
            <button
              type="button"
              className={`consistency-unify-pin-btn${isPinned ? ' consistency-unify-pin-btn--active' : ''}`}
              aria-label={
                isPinned
                  ? `${label} 통일형 고정 해제`
                  : `${label} 통일형으로 고정`
              }
              aria-pressed={isPinned}
              onClick={() => onPin(row.tailWord)}
            >
              📌
            </button>
            <span className="find registered-chip__text">{label}</span>
            <DismissButton label={label} onClick={() => onRemove(row.tailWord)} />
          </li>
        );
      })}
    </ul>
  );
}
