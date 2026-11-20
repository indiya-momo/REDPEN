import { useMemo } from 'react';
import { getBuiltInTip } from '../lib/builtInRules.js';
import { getConsistencyHighlightTip } from '../lib/consistencyHighlightTip.js';
import {
  findActiveGroup,
  instancesMatch,
  isInstanceVisible,
} from '../lib/checkResultUtils.js';
import { getHighlightOverlayReplace } from '../lib/highlightOverlayReplace.js';
import { applyHighlightOverlayLayers } from '../lib/highlightOverlayLayers.js';
import { coveredByManualFinding } from '../lib/manuscriptWorkbench/findingsSink.js';
import { MANUAL_CATEGORY } from '../lib/manuscriptWorkbench/types.js';
import { manualUserMemo } from '../lib/manuscriptWorkbench/textPartDiff.js';
import { isConsistencyUnifyTailWord } from '../lib/consistencyUnifyRegister.js';
import {
  pdfHighlightHasOutline,
  pdfHighlightPillarClass,
  resultBadgeTone,
  resultPillarTone,
} from '../lib/resultPillarTone.js';
import {
  buildPageByNum,
  compareInstancesReadingOrder,
} from '../lib/matchReadingOrder.js';
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
 *   customRules?: import('../lib/ruleTypes.js').Rule[],
 *   pageTexts?: import('../lib/pdfService.js').PageData[],
 *   manualGroups?: import('../lib/ruleEngine.js').GroupedResult[],
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
  customRules = [],
  pageTexts = [],
  manualGroups = [],
}) {
  const pageByNum = useMemo(() => buildPageByNum(pageTexts), [pageTexts]);
  const compareOnPage = useMemo(
    () => (a, b) => compareInstancesReadingOrder(a, b, pageByNum),
    [pageByNum],
  );
  const activeResults =
    activeSource === 'spelling' ? spellingResults : consistencyResults;
  const activeGroup = findActiveGroup(activeResults, selectedInstance);

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
        const groupTip =
          group.category === 'manual'
            ? manualUserMemo(group.tip)
            : (group.tip || '').trim() ||
              (source === 'spelling' &&
              group.category !== 'caution' &&
              group.category !== 'manuscript-search'
                ? getBuiltInTip(group.find, group.replace, group.spellingRuleId)
                : source === 'consistency'
                  ? getConsistencyHighlightTip(group, customRules)
                  : '');
        for (const inst of group.instances) {
          if (inst.pageNum !== currentPage) continue;
          if (
            group.category !== MANUAL_CATEGORY &&
            !inst.manual &&
            coveredByManualFinding(inst, manualGroups)
          ) {
            continue;
          }
          if (!isInstanceVisible(resultVisibility, source, group, inst)) continue;
          const tipText = String(inst.tip ?? '').trim() || groupTip;
          onPage.push({
            inst,
            tip: tipText,
            isCaution: group.category === 'caution',
            source,
            group,
          });
        }
      }
    }
    onPage.sort((a, b) => compareOnPage(a.inst, b.inst));
    const mapped = onPage
      .map(({ inst, tip, isCaution, source, group }) => {
        const hasItemIndexes =
          Array.isArray(inst.itemIndexes) && inst.itemIndexes.length > 0;
        const range = hasItemIndexes
          ? {
              start: inst.index,
              end:
                inst.index +
                Math.max(String(inst.matchedText ?? '').length, 1),
            }
          : isCaution
            ? highlightRangeForCaution(currentPageData, inst)
            : highlightRangeForSpelling(currentPageData, inst);
        if (!range) return null;
        const primary = Boolean(
          selectedInstance != null &&
            instancesMatch(inst, selectedInstance),
        );
        const overlayReplace =
          group.category === 'manuscript-search'
            ? null
            : getHighlightOverlayReplace(inst, {
                customRules,
                group,
              });
        const highlightedText = String(
          currentPageData.text ?? currentPageData.visualText ?? '',
        ).slice(range.start, range.end);
        const pillarTone = resultPillarTone(source, group);
        const badgeTone = resultBadgeTone(source, {
          category: group.category,
          patternKind: group.patternKind,
          isUnify:
            source === 'consistency' &&
            (isConsistencyUnifyTailWord(customRules, group.tailWord) ||
              Boolean(group.overlayReplace)),
        });
        const boxText =
          highlightedText ||
          String(inst.highlightText ?? '').trim() ||
          String(inst.matchedText ?? inst.find ?? '');
        return {
          ...range,
          primary,
          id: `${inst.pageNum}-${inst.index}-${inst.find}`,
          tip,
          // 말풍선·오버레이 기준은 하이라이트 상자 글자 (앞말+stem 전체 matchedText 아님)
          matchedText: boxText,
          ...(hasItemIndexes ? { itemIndexes: inst.itemIndexes } : {}),
          pillarTone,
          pillarClass: [
            pdfHighlightPillarClass(pillarTone),
            pdfHighlightHasOutline(badgeTone) ? 'pdf-highlight--outline' : '',
          ]
            .filter(Boolean)
            .join(' '),
          ...(overlayReplace ? { overlayReplace } : {}),
          // 쉼표 이중 후보(얇다, 가늘다) — 레이어 전개 실패해도 말풍선 선택용
          ...(group.category === 'caution' &&
          String(group.label ?? '').includes(',')
            ? { overlayChoiceSource: String(group.label).trim() }
            : {}),
          editPayload: {
            pageNum: inst.pageNum,
            index: inst.index,
            start: range.start,
            end: range.end,
            matchedText: boxText,
            find: String(inst.find ?? inst.matchedText ?? ''),
            suggestedText: String(
              inst.suggestedText ?? inst.replace ?? group.replace ?? '',
            ),
            replace: String(
              inst.suggestedText ?? inst.replace ?? group.replace ?? '',
            ),
            tip,
            category: group.category,
          },
        };
      })
      .filter(Boolean);
    return applyHighlightOverlayLayers(mapped);
  }, [
    highlightTab,
    spellingResults,
    consistencyResults,
    resultVisibility,
    currentPage,
    currentPageData,
    selectedInstance,
    customRules,
    compareOnPage,
    manualGroups,
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
          if (
            group.category !== MANUAL_CATEGORY &&
            !inst.manual &&
            coveredByManualFinding(inst, manualGroups)
          ) {
            continue;
          }
          if (!isInstanceVisible(resultVisibility, source, group, inst)) continue;
          all.push(inst);
        }
      }
    }
    return all.sort((a, b) => {
      if (a.pageNum !== b.pageNum) return a.pageNum - b.pageNum;
      return compareOnPage(a, b);
    });
  }, [
    highlightTab,
    spellingResults,
    consistencyResults,
    resultVisibility,
    compareOnPage,
    manualGroups,
  ]);

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
