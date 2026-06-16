import { useMemo } from 'react';
import {
  findActiveGroup,
  groupKey,
  instancesMatch,
  isInstanceVisible,
} from '../../lib/checkResultUtils.js';
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
  const activeGroupKey = activeGroup ? groupKey(activeGroup) : null;

  const pageHighlights = useMemo(() => {
    if (!currentPageData) return [];
    const onPage = [];
    for (const group of results) {
      const tipText = (group.tip || '').trim();
      const isActiveGroup =
        activeGroupKey != null && groupKey(group) === activeGroupKey;
      for (const inst of group.instances) {
        if (inst.pageNum !== currentPage) continue;
        if (
          !isInstanceVisible(resultVisibility, TOC_BODY_RESULT_SOURCE, group, inst)
        ) {
          continue;
        }
        if (
          isActiveGroup &&
          selectedInstance &&
          !instancesMatch(inst, selectedInstance)
        ) {
          continue;
        }
        onPage.push({ inst, tip: tipText, isActiveGroup });
      }
    }
    onPage.sort((a, b) => a.inst.index - b.inst.index);
    return onPage
      .map(({ inst, tip, isActiveGroup }) => {
        const range = highlightRangeForInstance(currentPageData, inst);
        if (!range) return null;
        const primary = Boolean(
          isActiveGroup &&
            selectedInstance != null &&
            instancesMatch(inst, selectedInstance),
        );
        return {
          ...range,
          primary,
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
    activeGroupKey,
  ]);

  return { pageHighlights };
}
