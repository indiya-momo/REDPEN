import { formatConsistencyListLabel } from '../../lib/patternDisplayLabels.js';

/** @param {{ tailWord: string, bonBojoItemId?: string }} row */
export function consistencyEntryKey(row) {
  return row.bonBojoItemId || row.tailWord;
}

/** @param {{ tailWord: string, displayLabel?: string }} row */
export function consistencyEntryLabel(row) {
  return row.displayLabel?.trim() || formatConsistencyListLabel(row.tailWord);
}
