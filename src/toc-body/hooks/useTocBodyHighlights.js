import { useMemo } from 'react';
import { findActiveGroup, instancesMatch, isResultGroupVisible } from '../../lib/checkResultUtils.js';
import { highlightRangeForInstance } from '../../lib/pdfService.js';
import { TOC_BODY_RESULT_SOURCE } from './useTocBodyCheck.js';

/**
 * 목차 · 본문 검사 PDF 하이라이트 (useHighlights와 분리)
 * @param {{
 *   currentPage: number,
 *   currentPageData: import('../../lib/pdfService.js').PageData | null,
 *   results: import('../lib/tocBodyCheck.js').TocBodyGroup[],
 *   resultVisibility: Record<string, boolean>,
 *   selectedInstance: import('../../lib/ruleEngine.js').MatchInstance | null,
 * }} options
 */
export function useTocBodyHighlights({
  currentPage,
  currentPageData,
  results,
  resultVisibility,
  selectedInstance,
}) {
  const activeGroup = findActiveGroup(results, selectedInstance);

  const pageHighlights = useMemo(() => {
    if (!currentPageData) return [];
    const onPage = [];
    for (const group of results) {
      if (!isResultGroupVisible(resultVisibility, TOC_BODY_RESULT_SOURCE, group)) {
        continue;
      }
      const tipText = (group.tip || '').trim();
      for (const inst of group.instances) {
        if (inst.pageNum === currentPage) {
          onPage.push({ inst, tip: tipText });
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
    results,
    resultVisibility,
    currentPage,
    currentPageData,
    selectedInstance,
  ]);

  const sortedFindings = useMemo(() => {
    const all = [];
    for (const group of results) {
      if (!isResultGroupVisible(resultVisibility, TOC_BODY_RESULT_SOURCE, group)) {
        continue;
      }
      for (const inst of group.instances) {
        all.push(inst);
      }
    }
    return all.sort((a, b) => {
      if (a.pageNum !== b.pageNum) return a.pageNum - b.pageNum;
      return a.index - b.index;
    });
  }, [results, resultVisibility]);

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
