import { useMemo } from 'react';
import { getBuiltInTip } from '../lib/builtInRules.js';
import { findActiveGroup, instancesMatch, isResultGroupVisible } from '../lib/checkResultUtils.js';
import { highlightRangeForInstance } from '../lib/pdfService.js';

/**
 * @typedef {import('../lib/ruleEngine.js').GroupedResult} GroupedResult
 * @typedef {import('../lib/ruleEngine.js').MatchInstance} MatchInstance
 *
 * @typedef {Object} PageHighlight
 * @property {number} start
 * @property {number} end
 * @property {boolean} [primary]
 * @property {string} id
 * @property {string} tip
 * @property {string} matchedText
 */

/**
 * @param {{
 *   currentPage: number,
 *   currentPageData: import('../lib/pdfService.js').PageData | null,
 *   spellingResults: import('../lib/ruleEngine.js').GroupedResult[],
 *   consistencyResults: import('../lib/ruleEngine.js').GroupedResult[],
 *   resultVisibility: Record<string, boolean>,
 *   highlightTab: 'spelling' | 'consistency',
 *   activeSource: 'spelling' | 'consistency',
 *   selectedInstance: import('../lib/ruleEngine.js').MatchInstance | null,
 * }} options
 */
export function useHighlights({
  currentPage,
  currentPageData,
  spellingResults,
  consistencyResults,
  resultVisibility,
  highlightTab,
  activeSource,
  selectedInstance,
}) {
  const activeResults =
    activeSource === 'spelling' ? spellingResults : consistencyResults;
  const activeGroup = findActiveGroup(activeResults, selectedInstance);

  const pageHighlights = useMemo(() => {
    if (!currentPageData) return [];
    const onPage = [];
    const sources =
      highlightTab === 'spelling'
        ? [['spelling', spellingResults]]
        : [['consistency', consistencyResults]];
    for (const [source, results] of sources) {
      for (const group of results) {
        if (!isResultGroupVisible(resultVisibility, source, group)) continue;
        const tipText =
          (group.tip || '').trim() ||
          (source === 'spelling' && group.category !== 'caution'
            ? getBuiltInTip(group.find, group.replace)
            : '');
        for (const inst of group.instances) {
          if (inst.pageNum === currentPage) {
            onPage.push({ inst, tip: tipText });
          }
        }
      }
    }
    onPage.sort((a, b) => a.inst.index - b.inst.index);
    return onPage
      .map(({ inst, tip }) => {
        const range = highlightRangeForInstance(currentPageData, inst);
        if (!range) return null;
        const primary =
          selectedInstance && instancesMatch(inst, selectedInstance);
        return {
          ...range,
          primary: Boolean(primary),
          id: `${inst.pageNum}-${inst.index}-${inst.find}`,
          tip,
          matchedText: inst.matchedText,
        };
      })
      .filter(Boolean);
  }, [
    highlightTab,
    spellingResults,
    consistencyResults,
    resultVisibility,
    currentPage,
    currentPageData,
    selectedInstance,
  ]);

  const sortedFindings = useMemo(() => {
    const all = [];
    const sources =
      highlightTab === 'spelling'
        ? [['spelling', spellingResults]]
        : [['consistency', consistencyResults]];
    for (const [source, results] of sources) {
      for (const group of results) {
        if (!isResultGroupVisible(resultVisibility, source, group)) continue;
        for (const inst of group.instances) {
          all.push(inst);
        }
      }
    }
    return all.sort((a, b) => {
      if (a.pageNum !== b.pageNum) return a.pageNum - b.pageNum;
      return a.index - b.index;
    });
  }, [highlightTab, spellingResults, consistencyResults, resultVisibility]);

  const currentFindingIndex = useMemo(() => {
    if (!selectedInstance || !sortedFindings.length) return -1;
    return sortedFindings.findIndex((i) => instancesMatch(i, selectedInstance));
  }, [selectedInstance, sortedFindings]);

  return {
    activeGroup,
    pageHighlights,
    sortedFindings,
    currentFindingIndex,
  };
}
