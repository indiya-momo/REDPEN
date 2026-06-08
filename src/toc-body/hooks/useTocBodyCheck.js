import { useCallback, useMemo, useState } from 'react';
import {
  defaultVisibilityForGroups,
  findActiveGroup,
  groupKey,
  isResultGroupVisible,
  resultVisibilityKey,
} from '../../lib/checkResultUtils.js';
import { trackCheckRun, trackResultViewed } from '../../lib/analytics.js';
import {
  hasTocBodyEntries,
  runTocBodyCheck,
} from '../lib/tocBodyCheck.js';
import { assertBetaDailyCheckOrAlert } from '../../lib/betaDailyQuota.js';

/** @type {'toc-body'} */
export const TOC_BODY_RESULT_SOURCE = 'toc-body';

/**
 * 목차 · 본문 일관성 검사 전용 상태 (규칙 엔진·useRuleCheck와 분리)
 * @param {{
 *   tocBodyText: string,
 *   tocBodyStartPage?: number | null,
 *   tocBodyExcludePages?: string,
 *   mapPrintPageToSystem?: (printPage: number) => number,
 *   mapSystemPageToPrint?: (systemPage: number) => number,
 *   printedPagesActive?: boolean,
 *   pageTexts: import('../../lib/pdfService.js').PageData[],
 *   currentPage: number,
 *   setCurrentPage: (page: number) => void,
 *   setIsProcessing: (v: boolean) => void,
 *   setProgress: (v: { current: number, total: number, phase: string } | null) => void,
 *   afterCheckRef: React.MutableRefObject<() => Promise<boolean>>,
 *   authUid?: string,
 *   authEmail?: string,
 *   onBetaQuotaConsumed?: () => void,
 * }} options
 */
export function useTocBodyCheck({
  tocBodyText,
  tocBodyStartPage = null,
  tocBodyExcludePages = '',
  mapPrintPageToSystem,
  mapSystemPageToPrint,
  printedPagesActive = false,
  pageTexts,
  currentPage,
  setCurrentPage,
  setIsProcessing,
  setProgress,
  afterCheckRef,
  authUid = '',
  authEmail = '',
  onBetaQuotaConsumed,
}) {
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [resultVisibility, setResultVisibility] = useState(
    /** @type {Record<string, boolean>} */ ({}),
  );
  const [checkDone, setCheckDone] = useState(false);

  const activeGroup = useMemo(
    () => findActiveGroup(results, selected),
    [results, selected],
  );

  const totalFindings = useMemo(
    () => results.reduce((n, g) => n + g.instances.length, 0),
    [results],
  );

  const clearAllCheckState = useCallback(() => {
    setResults([]);
    setSelected(null);
    setResultVisibility({});
    setCheckDone(false);
  }, []);

  const clearTocCheckState = useCallback(() => {
    setResults((groups) => {
      setResultVisibility((prev) => {
        const next = { ...prev };
        for (const group of groups) {
          delete next[resultVisibilityKey(TOC_BODY_RESULT_SOURCE, group)];
        }
        return next;
      });
      return [];
    });
    setSelected(null);
    setCheckDone(false);
  }, []);

  const runCheck = useCallback(async () => {
    if (!pageTexts.length) {
      alert('먼저 PDF를 업로드하세요.');
      return;
    }
    if (!hasTocBodyEntries(tocBodyText)) {
      alert('목차 항목을 입력하세요.');
      return;
    }
    if (!printedPagesActive) {
      alert(
        '파일 - 원고 페이지 맞추기가 필요합니다.\n\n맞춤법 확인 탭에서 맞췄거나, 일관성 탭 「목차 · 본문」에서 원고에 보이는 쪽 번호를 입력하고 보정을 누르세요.',
      );
      return;
    }

    if (
      !(await assertBetaDailyCheckOrAlert(authUid, {
        authEmail,
        checkTab: 'consistency',
        onConsumed: onBetaQuotaConsumed,
      }))
    ) {
      return;
    }

    setIsProcessing(true);
    setProgress({ current: 0, total: pageTexts.length, phase: 'check' });

    const groups = runTocBodyCheck(
      pageTexts,
      tocBodyText,
      tocBodyStartPage,
      tocBodyExcludePages,
      mapPrintPageToSystem,
      mapSystemPageToPrint,
    );
    setResults(groups);
    setCheckDone(groups.length > 0);
    setResultVisibility((prev) => ({
      ...prev,
      ...defaultVisibilityForGroups(groups, TOC_BODY_RESULT_SOURCE),
    }));

    const inst =
      groups.find((g) => g.instances.length > 0)?.instances[0] ?? null;
    setSelected(inst);

    const findingCount = groups.reduce((n, g) => n + g.instances.length, 0);
    await trackCheckRun(
      {
        scope: 'toc-body',
        findingCount,
        activeRuleCount: 0,
      },
      { uid: authUid, email: authEmail },
    );
    trackResultViewed({ scope: 'toc-body', findingCount });

    setCurrentPage(1);
    setIsProcessing(false);
    setProgress(null);
    await afterCheckRef.current?.();
  }, [
    pageTexts,
    tocBodyText,
    tocBodyStartPage,
    tocBodyExcludePages,
    mapPrintPageToSystem,
    mapSystemPageToPrint,
    printedPagesActive,
    setCurrentPage,
    setIsProcessing,
    setProgress,
    afterCheckRef,
    authUid,
    authEmail,
    onBetaQuotaConsumed,
  ]);

  const backToSetup = useCallback(() => {
    clearTocCheckState();
  }, [clearTocCheckState]);

  const goToPage = useCallback(
    (pageNum) => {
      setCurrentPage(pageNum);
      if (!selected) return;
      const group = findActiveGroup(results, selected);
      const onPage = group?.instances.filter((i) => i.pageNum === pageNum) ?? [];
      setSelected(onPage[0] ?? null);
    },
    [results, selected, setCurrentPage],
  );

  const selectGroup = useCallback(
    (group) => {
      const onPage = group.instances.filter((i) => i.pageNum === currentPage);
      const inst = onPage[0] ?? group.instances[0] ?? null;
      if (!inst) return;
      setSelected(inst);
      setCurrentPage(inst.pageNum);
    },
    [currentPage, setCurrentPage],
  );

  const selectPageInGroup = useCallback(
    (pageNum, instances) => {
      const onPage = instances.find((i) => i.pageNum === pageNum);
      if (onPage) {
        setSelected(onPage);
        setCurrentPage(onPage.pageNum);
      } else {
        goToPage(pageNum);
      }
    },
    [goToPage, setCurrentPage],
  );

  const isGroupVisible = useCallback(
    (group) =>
      isResultGroupVisible(resultVisibility, TOC_BODY_RESULT_SOURCE, group),
    [resultVisibility],
  );

  const toggleGroupVisibility = useCallback((group) => {
    const key = resultVisibilityKey(TOC_BODY_RESULT_SOURCE, group);
    setResultVisibility((prev) => ({
      ...prev,
      [key]: prev[key] === false,
    }));
  }, []);

  const isGroupSelected = useCallback(
    (group) =>
      activeGroup !== null && groupKey(activeGroup) === groupKey(group),
    [activeGroup],
  );

  const countVisibleOnPage = useCallback(
    (page) => {
      let n = 0;
      for (const group of results) {
        if (!isResultGroupVisible(resultVisibility, TOC_BODY_RESULT_SOURCE, group)) {
          continue;
        }
        n += group.instances.filter((i) => i.pageNum === page).length;
      }
      return n;
    },
    [results, resultVisibility],
  );

  const syncSelection = useCallback(() => {
    if (!checkDone) return;
    const inst = selected ?? results[0]?.instances[0] ?? null;
    setSelected(inst);
    if (inst) setCurrentPage(inst.pageNum);
  }, [checkDone, selected, results, setCurrentPage]);

  return {
    results,
    selected,
    activeGroup,
    resultVisibility,
    checkDone,
    totalFindings,
    clearAllCheckState,
    clearTocCheckState,
    runCheck,
    goToPage,
    selectGroup,
    selectPageInGroup,
    isGroupVisible,
    toggleGroupVisibility,
    isGroupSelected,
    countVisibleOnPage,
    syncSelection,
  };
}
