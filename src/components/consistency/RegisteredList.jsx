import { consistencyEntryKey, consistencyEntryLabel } from './entryLabel.js';
import RegisteredChip from './RegisteredChip.jsx';

/**
 * @param {{
 *   entries: { tailWord: string, displayLabel?: string, bonBojoItemId?: string }[],
 *   customRules: import('../../lib/ruleTypes.js').Rule[],
 *   isEnabled: (
 *     rules: import('../../lib/ruleTypes.js').Rule[],
 *     row: { tailWord: string, displayLabel?: string, bonBojoItemId?: string },
 *   ) => boolean,
 *   onToggle: (
 *     row: { tailWord: string, displayLabel?: string, bonBojoItemId?: string },
 *     enabled: boolean,
 *   ) => void,
 *   onRemove?: (tw: string) => void,
 * }} props
 */
export default function RegisteredList({
  entries,
  onRemove,
}) {
  if (!entries.length) return null;

  return (
    <ul className="tail-list">
      {entries.map((row) => {
        const label = consistencyEntryLabel(row);
        return (
          <RegisteredChip
            key={consistencyEntryKey(row)}
            label={label}
            onRemove={onRemove ? () => onRemove(row.tailWord) : undefined}
          />
        );
      })}
    </ul>
  );
}