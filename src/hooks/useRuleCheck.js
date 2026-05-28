import { useCallback, useMemo, useState } from 'react';
import { buildCautionCheckRules } from '../lib/cautionRules.js';
import { BUILT_IN_RULES, isBuiltInRuleEnabled } from '../lib/builtInRules.js';
import {
  defaultVisibilityForGroups,
  findActiveGroup,
  groupKey,
  isResultGroupVisible,
  resultVisibilityKey,
} from '../lib/checkResultUtils.js';
import {
  trackCheckRun,
  trackResultViewed,
} from '../lib/analytics.js';
import {
  countActiveRules,
  isOverMaxRules,
  maxRulesExceededMessage,
} from '../lib/activeRuleCount.js';
import { runRuleCheckAsync } from '../lib/ruleEngine.js';

/**
 * @param {{
 *   builtInEnabled: Record<string, boolean>,
 *   cautionEnabled: Record<string, boolean>,
 *   customRules: import('../lib/ruleTypes.js').Rule[],
 *   globalExcludePhrases: string[],
 *   pageTexts: import('../lib/pdfService.js').PageData[],
 *   currentPage: number,
 *   setCurrentPage: (page: number) => void,
 *   setIsProcessing: (v: boolean) => void,
 *   setProgress: (v: { current: number, total: number, phase: string } | null) => void,
 *   afterCheckRef: React.MutableRefObject<() => Promise<boolean>>,
 * }} options
 */
export function useRuleCheck({
  builtInEnabled,
  cautionEnabled,
  customRules,
  globalExcludePhrases,
  pageTexts,
  currentPage,
  setCurrentPage,
  setIsProcessing,
  setProgress,
  afterCheckRef,
}) {
  const [spellingResults, setSpellingResults] = useState([]);
  const [consistencyResults, setConsistencyResults] = useState([]);
  const [spellingSelected, setSpellingSelected] = useState(null);
  const [consistencySelected, setConsistencySelected] = useState(null);
  const [activeSource, setActiveSource] = useState(
    /** @type {'spelling' | 'consistency'} */ ('spelling'),
  );
  const [resultVisibility, setResultVisibility] = useState(
    /** @type {Record<string, boolean>} */ ({}),
  );
  const [spellingCheckDone, setSpellingCheckDone] = useState(false);
  const [consistencyCheckDone, setConsistencyCheckDone] = useState(false);

  const selectedInstance =
    activeSource === 'spelling' ? spellingSelected : consistencySelected;
  const activeResults =
    activeSource === 'spelling' ? spellingResults : consistencyResults;
  const checkDone = spellingCheckDone || consistencyCheckDone;

  const spellingActiveRules = useMemo(() => {
    const builtIn = BUILT_IN_RULES.filter((r) =>
      isBuiltInRuleEnabled(builtInEnabled, r.find),
    ).map((r) => ({
      ...r,
      enabled: true,
      category: 'spelling',
    }));
    const caution = buildCautionCheckRules(cautionEnabled).map((r) => ({
      ...r,
      enabled: true,
    }));
    return [...builtIn, ...caution];
  }, [builtInEnabled, cautionEnabled]);

  const consistencyActiveRules = useMemo(
    () =>
      customRules
        .filter((r) => r.enabled && r.patternKind !== 'auxiliary-verb')
        .map((r) => ({
          ...r,
          category:
            r.patternKind === 'compound-find' ||
            r.patternKind === 'compound-tail' ||
            r.patternKind === 'compound-spacing' ||
            r.patternKind === 'phrase-slot-find' ||
            r.patternKind === 'auxiliary-verb'
              ? 'consistency'
              : 'custom',
        })),
    [customRules],
  );

  const clearAllCheckState = useCallback(() => {
    setSpellingResults([]);
    setConsistencyResults([]);
    setSpellingSelected(null);
    setConsistencySelected(null);
    setActiveSource('spelling');
    setResultVisibility({});
    setSpellingCheckDone(false);
    setConsistencyCheckDone(false);
  }, []);

  const applyRestoredCheckState = useCallback(
    ({ spelling, consistency }) => {
      setSpellingResults(spelling);
      setConsistencyResults(consistency);
      setSpellingCheckDone(spelling.length > 0);
      setConsistencyCheckDone(consistency.length > 0);
      setResultVisibility({
        ...defaultVisibilityForGroups(spelling, 'spelling'),
        ...defaultVisibilityForGroups(consistency, 'consistency'),
      });
    },
    [],
  );

  const setRestoredSelection = useCallback((saved) => {
    const spelling = saved.groupedResults ?? [];
    const consistency = saved.consistencyGroupedResults ?? [];
    setSpellingSelected(spelling.length ? saved.selectedInstance ?? null : null);
    setConsistencySelected(
      consistency.length ? saved.consistencySelectedInstance ?? null : null,
    );
    if (spelling.length && saved.selectedInstance) {
      setActiveSource('spelling');
    } else if (consistency.length && saved.consistencySelectedInstance) {
      setActiveSource('consistency');
    }
  }, []);

  const runCheckScope = useCallback(
    async (scope) => {
      if (!pageTexts.length) {
        alert('먼저 PDF를 업로드하세요.');
        return;
      }

      const runSpelling = scope === 'spelling';
      const runConsistency = scope === 'consistency';

      if (runSpelling && spellingActiveRules.length === 0) {
        alert('맞춤법 확인을 진행할 기준을 등록해주세요');
        return;
      }
      if (runConsistency && consistencyActiveRules.length === 0) {
        alert('일관성 확인을 진행할 기준을 등록해주세요');
        return;
      }

      const activeTotal = countActiveRules({
        builtInEnabled,
        cautionEnabled,
        customRules,
      });
      if (isOverMaxRules(activeTotal)) {
        alert(maxRulesExceededMessage(activeTotal));
        return;
      }

      setIsProcessing(true);
      setProgress({ current: 0, total: pageTexts.length, phase: 'check' });

      const reportCheckProgress = (current, total) => {
        setProgress({ current, total, phase: 'check' });
      };

      const allErrors = [];
      /** @type {Record<string, boolean>} */
      let visibility = { ...resultVisibility };
      /** @type {import('../lib/ruleEngine.js').MatchInstance | null} */
      let first = null;
      /** @type {import('../lib/ruleEngine.js').RuleResultGroup[]} */
      let scopeResults = [];

      if (runSpelling) {
        const { results: grouped, errors } = await runRuleCheckAsync(
          pageTexts,
          spellingActiveRules,
          {
            globalExcludePhrases,
            onProgress: reportCheckProgress,
          },
        );
        allErrors.push(...errors);
        scopeResults = grouped;
        setSpellingResults(grouped);
        setSpellingCheckDone(true);
        visibility = {
          ...visibility,
          ...defaultVisibilityForGroups(grouped, 'spelling'),
        };
        const inst = grouped[0]?.instances[0] ?? null;
        if (inst) {
          first = inst;
          setSpellingSelected(inst);
        } else {
          setSpellingSelected(null);
        }
      }

      if (runConsistency) {
        const { results: grouped, errors } = await runRuleCheckAsync(
          pageTexts,
          consistencyActiveRules,
          {
            globalExcludePhrases,
            onProgress: reportCheckProgress,
          },
        );
        allErrors.push(...errors);
        scopeResults = grouped;
        setConsistencyResults(grouped);
        setConsistencyCheckDone(true);
        visibility = {
          ...visibility,
          ...defaultVisibilityForGroups(grouped, 'consistency'),
        };
        const inst = grouped[0]?.instances[0] ?? null;
        if (inst) {
          first = inst;
          setConsistencySelected(inst);
        } else {
          setConsistencySelected(null);
        }
      }

      setResultVisibility(visibility);

      if (allErrors.length) {
        alert(allErrors.join('\n'));
      }

      if (first) {
        setActiveSource(scope);
      }
      const findingCount = scopeResults.reduce(
        (n, g) => n + g.instances.length,
        0,
      );
      trackCheckRun({
        scope,
        findingCount,
        activeRuleCount: activeTotal,
      });
      trackResultViewed({ scope, findingCount });
      setCurrentPage(1);
      setIsProcessing(false);
      setProgress(null);
      await afterCheckRef.current?.();
    },
    [
      pageTexts,
      builtInEnabled,
      cautionEnabled,
      customRules,
      spellingActiveRules,
      consistencyActiveRules,
      globalExcludePhrases,
      resultVisibility,
      setCurrentPage,
      setIsProcessing,
      setProgress,
      afterCheckRef,
    ],
  );

  const runSpellingCheck = useCallback(
    () => runCheckScope('spelling'),
    [runCheckScope],
  );

  const runConsistencyCheck = useCallback(
    () => runCheckScope('consistency'),
    [runCheckScope],
  );

  const backToConsistencySetup = useCallback(() => {
    setConsistencyCheckDone(false);
  }, []);

  const selectInstance = useCallback(
    (inst, source = activeSource) => {
      setActiveSource(source);
      if (source === 'spelling') {
        setSpellingSelected(inst);
      } else {
        setConsistencySelected(inst);
      }
      setCurrentPage(inst.pageNum);
    },
    [activeSource, setCurrentPage],
  );

  const goToPage = useCallback(
    (pageNum) => {
      setCurrentPage(pageNum);
      if (!selectedInstance) return;

      const group = findActiveGroup(activeResults, selectedInstance);
      const onPage = group?.instances.filter((i) => i.pageNum === pageNum) ?? [];
      const next = onPage[0] ?? null;
      if (activeSource === 'spelling') {
        setSpellingSelected(next);
      } else {
        setConsistencySelected(next);
      }
    },
    [activeSource, activeResults, selectedInstance, setCurrentPage],
  );

  const selectPageInGroup = useCallback(
    (pageNum, instances, source) => {
      const onPage = instances.find((i) => i.pageNum === pageNum);
      if (onPage) selectInstance(onPage, source);
      else goToPage(pageNum);
    },
    [selectInstance, goToPage],
  );

  const selectGroup = useCallback(
    (group, source) => {
      const onPage = group.instances.filter((i) => i.pageNum === currentPage);
      const inst = onPage[0] ?? group.instances[0] ?? null;
      if (!inst) return;
      selectInstance(inst, source);
    },
    [currentPage, selectInstance],
  );

  const isSameGroupAsSelected = useCallback(
    (group, source) => {
      if (!selectedInstance || activeSource !== source) return false;
      const results =
        source === 'spelling' ? spellingResults : consistencyResults;
      const active = findActiveGroup(results, selectedInstance);
      return active !== null && groupKey(active) === groupKey(group);
    },
    [activeSource, spellingResults, consistencyResults, selectedInstance],
  );

  const toggleResultVisibility = useCallback((source, group) => {
    const key = resultVisibilityKey(source, group);
    setResultVisibility((prev) => ({
      ...prev,
      [key]: prev[key] === false,
    }));
  }, []);

  const isGroupVisible = useCallback(
    (source, group) => isResultGroupVisible(resultVisibility, source, group),
    [resultVisibility],
  );

  const spellingActiveGroup = useMemo(
    () => findActiveGroup(spellingResults, spellingSelected),
    [spellingResults, spellingSelected],
  );
  const consistencyActiveGroup = useMemo(
    () => findActiveGroup(consistencyResults, consistencySelected),
    [consistencyResults, consistencySelected],
  );
  const activeGroup =
    activeSource === 'spelling' ? spellingActiveGroup : consistencyActiveGroup;

  const spellingTotalFindings = spellingResults.reduce(
    (n, g) => n + g.instances.length,
    0,
  );
  const consistencyTotalFindings = consistencyResults.reduce(
    (n, g) => n + g.instances.length,
    0,
  );
  const combinedTotalFindings =
    spellingTotalFindings + consistencyTotalFindings;
  const combinedRuleCount =
    spellingResults.length + consistencyResults.length;

  const hasBuiltInActive =
    BUILT_IN_RULES.some((r) => isBuiltInRuleEnabled(builtInEnabled, r.find)) ||
    buildCautionCheckRules(cautionEnabled).length > 0;
  const hasConsistencyRulesActive = consistencyActiveRules.length > 0;

  const countVisibleOnPage = useCallback(
    (page, source) => {
      let n = 0;
      if (source !== 'consistency') {
        for (const group of spellingResults) {
          if (!isResultGroupVisible(resultVisibility, 'spelling', group)) continue;
          n += group.instances.filter((i) => i.pageNum === page).length;
        }
      }
      if (source !== 'spelling') {
        for (const group of consistencyResults) {
          if (!isResultGroupVisible(resultVisibility, 'consistency', group))
            continue;
          n += group.instances.filter((i) => i.pageNum === page).length;
        }
      }
      return n;
    },
    [spellingResults, consistencyResults, resultVisibility],
  );

  const syncSelectionForTab = useCallback(
    (tab) => {
      if (tab === 'spelling') {
        setActiveSource('spelling');
        const inst =
          spellingSelected ?? spellingResults[0]?.instances[0] ?? null;
        setSpellingSelected(inst);
        if (inst) setCurrentPage(inst.pageNum);
      } else {
        setActiveSource('consistency');
        const inst =
          consistencySelected ?? consistencyResults[0]?.instances[0] ?? null;
        setConsistencySelected(inst);
        if (inst) setCurrentPage(inst.pageNum);
      }
    },
    [
      spellingSelected,
      consistencySelected,
      spellingResults,
      consistencyResults,
      setCurrentPage,
    ],
  );

  const getActiveOnPage = useCallback(
    (page) => {
      if (!activeGroup || !isResultGroupVisible(resultVisibility, activeSource, activeGroup)) {
        return 0;
      }
      return activeGroup.instances.filter((i) => i.pageNum === page).length;
    },
    [activeGroup, activeSource, resultVisibility],
  );

  return {
    spellingResults,
    consistencyResults,
    spellingSelected,
    consistencySelected,
    activeSource,
    activeGroup,
    resultVisibility,
    spellingCheckDone,
    consistencyCheckDone,
    selectedInstance,
    checkDone,
    spellingActiveRules,
    consistencyActiveRules,
    clearAllCheckState,
    applyRestoredCheckState,
    setRestoredSelection,
    runSpellingCheck,
    runConsistencyCheck,
    backToConsistencySetup,
    selectInstance,
    goToPage,
    selectPageInGroup,
    selectGroup,
    isSameGroupAsSelected,
    toggleResultVisibility,
    isGroupVisible,
    spellingActiveGroup,
    consistencyActiveGroup,
    spellingTotalFindings,
    consistencyTotalFindings,
    combinedTotalFindings,
    combinedRuleCount,
    hasBuiltInActive,
    hasConsistencyRulesActive,
    countVisibleOnPage,
    syncSelectionForTab,
    getActiveOnPage,
    builtinFindings: spellingResults
      .filter((g) => g.category === 'spelling')
      .reduce((n, g) => n + g.instances.length, 0),
    spacingFindings: spellingResults
      .filter((g) => g.category === 'caution')
      .reduce((n, g) => n + g.instances.length, 0),
    spellingFindings: spellingResults.reduce(
      (n, g) => n + g.instances.length,
      0,
    ),
    consistencyFindings: consistencyResults.reduce(
      (n, g) => n + g.instances.length,
      0,
    ),
  };
}
