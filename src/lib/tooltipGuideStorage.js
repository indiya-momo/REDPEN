const PREFIX = 'pdf-proofread-tooltip-guide-';

function fullKey(storageKey) {
  return `${PREFIX}${storageKey}`;
}

/** @param {string} storageKey */
export function isTooltipGuideDismissed(storageKey) {
  try {
    return localStorage.getItem(fullKey(storageKey)) === '1';
  } catch {
    return false;
  }
}

/** @param {string} storageKey */
export function dismissTooltipGuide(storageKey) {
  try {
    localStorage.setItem(fullKey(storageKey), '1');
  } catch {
    /* ignore quota / private mode */
  }
}

/** @param {string} storageKey */
export function clearTooltipGuideDismissed(storageKey) {
  try {
    localStorage.removeItem(fullKey(storageKey));
  } catch {
    /* ignore */
  }
}
