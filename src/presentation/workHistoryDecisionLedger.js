import { normalizeConsistencyDecisions } from '../lib/consistencyDecisions.js';
import { formatConsistencyListLabel } from '../lib/patternDisplayLabels.js';

/**
 * @typedef {{
 *   id: string,
 *   at: string,
 *   atLabel: string,
 *   pinned: string,
 *   variants: string[],
 * }} WorkHistoryDecisionLedgerItem
 */

/**
 * @param {string} iso
 */
function formatDecisionAtLabel(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear() % 100;
  return `${y}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

/**
 * 작업 이력 탭용 확정 대장 DTO (최신 우선).
 *
 * @param {import('../lib/consistencyDecisions.js').ConsistencyDecision[] | undefined} decisions
 * @returns {WorkHistoryDecisionLedgerItem[]}
 */
export function buildWorkHistoryDecisionLedger(decisions) {
  return normalizeConsistencyDecisions(decisions)
    .filter((decision) => decision.kind === 'unify')
    .slice()
    .sort((a, b) => b.at.localeCompare(a.at))
    .map((decision) => ({
      id: decision.id,
      at: decision.at,
      atLabel: formatDecisionAtLabel(decision.at),
      pinned: formatConsistencyListLabel(decision.pinned),
      variants: decision.variants.map((variant) =>
        formatConsistencyListLabel(variant),
      ),
    }));
}
