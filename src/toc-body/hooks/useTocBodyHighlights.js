import { useMemo } from 'react';
import {
  findActiveGroup,
  groupContainsInstance,
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

  const pageHighlights = useMemo(() => {
    if (!currentPageData) return [];
    const onPage = [];
    for (const group of results) {
      const tipText = (group.tip || '').trim();
      for (const inst of group.instances) {
        if (inst.pageNum !== currentPage) continue;
        if (
          !isInstanceVisible(resultVisibility, TOC_BODY_RESULT_SOURCE, group, inst)
        ) {
          continue;
        }
        onPage.push({ inst, tip: tipText });
      }
    }
    onPage.sort((a, b) => a.inst.index - b.inst.index);
    return onPage
      .map(({ inst, tip }) => {
        const range = highlightRangeForInstance(currentPageData, inst);
        if (!range) return null;
        const primary = Boolean(
          activeGroup &&
            groupContainsInstance(activeGroup, inst) &&
            inst.pageNum === currentPage,
        );
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
    activeGroup,
  ]);

  return { pageHighlights };
}
