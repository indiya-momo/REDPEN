import { BON_BOJO_REQUIRED_ITEM_IDS_LIST } from '../../lib/bonBojoRules.js';
import { consistencyEntryKey, consistencyEntryLabel } from './entryLabel.js';
import RegisteredChip from './RegisteredChip.jsx';

/**
 * @param {{
 *   row: { tailWord: string, displayLabel?: string, bonBojoItemId?: string },
 *   customRules: import('../../lib/ruleTypes.js').Rule[],
 *   isEnabled: (
 *     rules: import('../../lib/ruleTypes.js').Rule[],
 *     row: { tailWord: string, displayLabel?: string, bonBojoItemId?: string },
 *   ) => boolean,
 *   onToggle: (
 *     row: { tailWord: string, displayLabel?: string, bonBojoItemId?: string },
 *     enabled: boolean,
 *   ) => void,
 *   isRequired?: (row: { bonBojoItemId?: string }) => boolean,
 * }} props
 */
function AuxiliaryGridChip({
  row,
  customRules,
  isEnabled,
  onToggle,
  isRequired,
}) {
  const label = consistencyEntryLabel(row);
  return (
    <label className="auxiliary-chip">
      <input
        type="checkbox"
        checked={isEnabled(customRules, row)}
        onChange={(e) => onToggle(row, e.target.checked)}
      />
      <span className="find">{label}</span>
      {isRequired?.(row) ? (
        <span className="bon-bojo-required-badge">필수</span>
      ) : null}
    </label>
  );
}

/**
 * @param {{
 *   row: { tailWord: string, displayLabel?: string, bonBojoItemId?: string },
 *   customRules: import('../../lib/ruleTypes.js').Rule[],
 *   isEnabled: (
 *     rules: import('../../lib/ruleTypes.js').Rule[],
 *     row: { tailWord: string, displayLabel?: string, bonBojoItemId?: string },
 *   ) => boolean,
 *   onToggle: (
 *     row: { tailWord: string, displayLabel?: string, bonBojoItemId?: string },
 *     enabled: boolean,
 *   ) => void,
 *   isRequired?: (row: { bonBojoItemId?: string }) => boolean,
 * }} props
 */
function AuxiliaryGridItem(props) {
  const { row } = props;
  return (
    <li className="tail-grid-item">
      <AuxiliaryGridChip {...props} />
    </li>
  );
}

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
 *   variant?: 'chips' | 'auxiliary-grid',
 *   isRequired?: (row: { bonBojoItemId?: string }) => boolean,
 * }} props
 */
export default function RegisteredList({
  entries,
  customRules,
  isEnabled,
  onToggle,
  onRemove,
  variant = 'chips',
  isRequired,
}) {
  if (!entries.length) return null;

  if (variant === 'auxiliary-grid') {
    const required = isRequired ?? (() => false);
    const optionalEntries = entries.filter((row) => !required(row));
    const requiredEntries = entries
      .filter((row) => required(row))
      .sort((a, b) => {
        const ia = BON_BOJO_REQUIRED_ITEM_IDS_LIST.indexOf(
          a.bonBojoItemId ?? '',
        );
        const ib = BON_BOJO_REQUIRED_ITEM_IDS_LIST.indexOf(
          b.bonBojoItemId ?? '',
        );
        return ia - ib;
      });
    const itemProps = { customRules, isEnabled, onToggle, isRequired };

    return (
      <div className="auxiliary-checklist">
        {optionalEntries.length > 0 ? (
          <ul className="tail-list tail-list--grid tail-list--grid-3">
            {optionalEntries.map((row) => (
              <AuxiliaryGridItem key={consistencyEntryKey(row)} row={row} {...itemProps} />
            ))}
          </ul>
        ) : null}
        {requiredEntries.length > 0 ? (
          <ul
            className="tail-list tail-list--grid tail-list--grid-3 tail-list--grid-required"
            aria-label="필수 본용언+보조용언"
          >
            {requiredEntries.map((row) => (
              <AuxiliaryGridItem key={consistencyEntryKey(row)} row={row} {...itemProps} />
            ))}
          </ul>
        ) : null}
      </div>
    );
  }

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
