import { useMemo } from 'react';
import { getBuiltInTip } from '../lib/builtInRules.js';
import { getConsistencyHighlightTip } from '../lib/consistencyHighlightTip.js';
import {
  findActiveGroup,
  groupKey,
  instancesMatch,
  isInstanceVisible,
} from '../lib/checkResultUtils.js';
import { getHighlightOverlayReplace } from '../lib/highlightOverlayReplace.js';
import {
  highlightRangeForCaution,
  highlightRangeForSpelling,
} from '../lib/pdfService.js';
/**
 * 맞춤법·표기 일관성 PDF 하이라이트 (목차는 useTocBodyHighlights)
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
  const activeGroupKey = activeGroup ? groupKey(activeGroup) : null;

  const pageHighlights = useMemo(() => {
    if (!currentPageData) return [];
    const onPage = [];
    /** @type {[import('../lib/checkResultUtils.js').ResultSource, import('../lib/ruleEngine.js').GroupedResult[]][]} */
    const sources =
      highlightTab === 'spelling'
        ? [['spelling', spellingResults]]
        : [['consistency', consistencyResults]];
    for (const [source, results] of sources) {
      for (const group of results) {
        const tipText =
          (group.tip || '').trim() ||
          (source === 'spelling' && group.category !== 'caution'
            ? getBuiltInTip(group.find, group.replace)
            : source === 'consistency'
              ? getConsistencyHighlightTip(group)
              : '');
        const isActiveGroup =
          activeGroupKey != null && groupKey(group) === activeGroupKey;
        for (const inst of group.instances) {
          if (inst.pageNum !== currentPage) continue;
          if (!isInstanceVisible(resultVisibility, source, group, inst)) continue;
          onPage.push({
            inst,
            tip: tipText,
            isActiveGroup,
            isCaution: group.category === 'caution',
          });
        }
      }
    }
    onPage.sort((a, b) => a.inst.index - b.inst.index);
    return onPage
      .map(({ inst, tip, isActiveGroup, isCaution }) => {
        const range = isCaution
          ? highlightRangeForCaution(currentPageData, inst)
          : highlightRangeForSpelling(currentPageData, inst);
        if (!range) return null;
        const primary = Boolean(
          isActiveGroup &&
            selectedInstance != null &&
            instancesMatch(inst, selectedInstance),
        );
        const overlayReplace = getHighlightOverlayReplace(inst);
        return {
          ...range,
          primary,
          id: `${inst.pageNum}-${inst.index}-${inst.find}`,
          tip,
          matchedText: inst.matchedText,
          ...(overlayReplace ? { overlayReplace } : {}),
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
    activeGroupKey,
  ]);

  const sortedFindings = useMemo(() => {
    const all = [];
    /** @type {[import('../lib/checkResultUtils.js').ResultSource, import('../lib/ruleEngine.js').GroupedResult[]][]} */
    const sources =
      highlightTab === 'spelling'
        ? [['spelling', spellingResults]]
        : [['consistency', consistencyResults]];
    for (const [source, results] of sources) {
      for (const group of results) {
        for (const inst of group.instances) {
          if (!isInstanceVisible(resultVisibility, source, group, inst)) continue;
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
