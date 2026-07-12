import { normalizeConsistencyDecisions } from '../lib/consistencyDecisions.js';
import { formatConsistencyListLabel } from '../lib/patternDisplayLabels.js';

/**
 * @typedef {{
 *   id: string,
 *   kind: 'unify',
 *   at: string,
 *   atLabel: string,
 *   pinned: string,
 *   variants: string[],
 * }} WorkHistoryUnifyLedgerItem
 */

/**
 * @typedef {{
 *   id: string,
 *   kind: 'find',
 *   at: string,
 *   atLabel: string,
 *   query: string,
 * }} WorkHistoryFindLedgerItem
 */

/**
 * @typedef {{
 *   id: string,
 *   kind: 'commonString',
 *   at: string,
 *   atLabel: string,
 *   pattern: string,
 * }} WorkHistoryCommonStringLedgerItem
 */

/** @typedef {
 *   | WorkHistoryUnifyLedgerItem
 *   | WorkHistoryFindLedgerItem
 *   | WorkHistoryCommonStringLedgerItem
 * } WorkHistoryDecisionLedgerItem
 */

/**
 * @param {string} iso
 */
export function formatDecisionAtLabel(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear() % 100;
  const pad2 = (n) => String(n).padStart(2, '0');
  return `${y}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/**
 * 작업 이력 탭용 확정 대장 DTO (최신 우선 · find/unify/commonString).
 *
 * @param {import('../lib/consistencyDecisions.js').ConsistencyDecision[] | undefined} decisions
 * @returns {WorkHistoryDecisionLedgerItem[]}
 */
export function buildWorkHistoryDecisionLedger(decisions) {
  return normalizeConsistencyDecisions(decisions)
    .slice()
    .sort((a, b) => b.at.localeCompare(a.at))
    .map((decision) => {
      const atLabel = formatDecisionAtLabel(decision.at);
      if (decision.kind === 'unify') {
        return {
          id: decision.id,
          kind: 'unify',
          at: decision.at,
          atLabel,
          pinned: formatConsistencyListLabel(decision.pinned),
          variants: decision.variants.map((variant) =>
            formatConsistencyListLabel(variant),
          ),
        };
      }
      if (decision.kind === 'find') {
        return {
          id: decision.id,
          kind: 'find',
          at: decision.at,
          atLabel,
          query: formatConsistencyListLabel(decision.query),
        };
      }
      return {
        id: decision.id,
        kind: 'commonString',
        at: decision.at,
        atLabel,
        pattern: formatConsistencyListLabel(decision.pattern),
      };
    });
}
