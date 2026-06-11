/**
 * 맞춤법·일관성 탭 검수 오케스트레이션: 규칙 집계 → ruleEngine → 결과·가시성.
 * 실행 전 로그인·베타 일일 한도(assertBetaDailyCheckOrAlert)·규칙 개수 상한 검사.
 * trackCheckRun/trackResultViewed로 PostHog에 검수·결과 열람 기록.
 */
import { useCallback, useMemo, useState } from 'react';
import { buildCautionCheckRules } from '../lib/cautionRules.js';
import { sortSpellingResultsForDisplay } from '../utils/main-screen-helpers.js';
import { BUILT_IN_RULES, isBuiltInRuleEnabled } from '../lib/builtInRules.js';
import {
  clearVisibilityForGroup,
  clearVisibilityForSource,
  countVisibleInstances,
  emptyResultVisibilityState,
  findActiveGroup,
  getGroupVisibilityMode,
  groupKey,
  isInstanceVisible,
  isResultGroupVisible,
  finalizeConsistencyCheckResults,
  normalizeResultVisibilityState,
  pruneResultVisibility,
  toggleGroupVisibilityState,
  toggleInstanceVisibilityState,
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
import {
  consistencyGroupScope,
  filterCustomRulesByConsistencyScope,
} from '../lib/consistencyCheckScopes.js';
import { ensureDefaultAuxiliaryVerbs } from '../lib/defaultAuxiliaryVerbs.js';
import { assertBetaDailyCheckOrAlert } from '../lib/betaDailyQuota.js';
import {
  alertConsistencyCheckAfterRun,
  confirmConsistencyCheckBeforeRun,
} from '../lib/consistencyCheckConfirm.js';
import {
  alertSpellingCheckAfterRun,
  confirmSpellingCheckBeforeRun,
} from '../lib/spellingCheckConfirm.js';

/** @param {{
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
 *   authUid?: string,
 *   authEmail?: string,
 *   onBetaQuotaConsumed?: () => void,
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
  authUid = '',
  authEmail = '',
  onBetaQuotaConsumed,
}) {
  const [spellingResults, setSpellingResults] = useState([]);
  const [consistencyResults, setConsistencyResults] = useState([]);
  const [spellingSelected, setSpellingSelected] = useState(null);
  const [consistencySelected, setConsistencySelected] = useState(null);
  const [activeSource, setActiveSource] = useState(
    /** @type {'spelling' | 'consistency'} */ ('spelling'),
  );
  const [resultVisibility, setResultVisibility] = useState(
    emptyResultVisibilityState,
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

  const resolvedCustomRules = useMemo(
    () => ensureDefaultAuxiliaryVerbs(customRules),
    [customRules],
  );

  const consistencyActiveRules = useMemo(
    () =>
      resolvedCustomRules
        .filter((r) => r.enabled)
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
    [resolvedCustomRules],
  );

  const restoreFromSession = useCallback(
    /**
     * @param {{
     *   spellingResults?: import('../lib/ruleEngine.js').GroupedResult[],
     *   consistencyResults?: import('../lib/ruleEngine.js').GroupedResult[],
     *   resultVisibility?: import('../lib/checkResultUtils.js').ResultVisibilityState,
     *   spellingSelected?: import('../lib/ruleEngine.js').MatchInstance | null,
     *   consistencySelected?: import('../lib/ruleEngine.js').MatchInstance | null,
     *   spellingCheckDone?: boolean,
     *   consistencyCheckDone?: boolean,
     *   activeSource?: 'spelling' | 'consistency',
     * }} payload
     */
    (payload) => {
      const spelling = payload.spellingResults ?? [];
      const consistency = payload.consistencyResults ?? [];
      setSpellingResults(spelling);
      setConsistencyResults(consistency);
      setSpellingCheckDone(Boolean(payload.spellingCheckDone));
      setConsistencyCheckDone(Boolean(payload.consistencyCheckDone));
      setSpellingSelected(payload.spellingSelected ?? null);
      setConsistencySelected(payload.consistencySelected ?? null);
      setActiveSource(payload.activeSource === 'consistency' ? 'consistency' : 'spelling');
      setResultVisibility(
        pruneResultVisibility(
          normalizeResultVisibilityState(payload.resultVisibility),
          spelling,
          consistency,
        ),
      );
    },
    [],
  );

  const clearAllCheckState = useCallback(() => {
    setSpellingResults([]);
    setConsistencyResults([]);
    setSpellingSelected(null);
    setConsistencySelected(null);
    setActiveSource('spelling');
    setResultVisibility(emptyResultVisibilityState());
    setSpellingCheckDone(false);
    setConsistencyCheckDone(false);
  }, []);

  /** 맞춤법 검사 결과만 비움 */
  const clearSpellingCheckState = useCallback(() => {
    setSpellingResults((groups) => {
      setResultVisibility((prev) => {
        let next = normalizeResultVisibilityState(prev);
        for (const group of groups) {
          next = clearVisibilityForGroup(next, 'spelling', group);
        }
        return next;
      });
      return [];
    });
    setSpellingSelected(null);
    setSpellingCheckDone(false);
    setActiveSource((src) => (src === 'spelling' ? 'consistency' : src));
  }, []);

  /** 표기 일관성 검사 결과만 비움 (목차 검사와 분리) */
  const clearConsistencyCheckState = useCallback(() => {
    setConsistencyResults((groups) => {
      setResultVisibility((prev) => {
        let next = normalizeResultVisibilityState(prev);
        for (const group of groups) {
          next = clearVisibilityForGroup(next, 'consistency', group);
        }
        return next;
      });
      return [];
    });
    setConsistencySelected(null);
    setConsistencyCheckDone(false);
    setActiveSource((src) => (src === 'consistency' ? 'spelling' : src));
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
        alert(
          '일관성 찾기·본용언+보조용언 표기에서 검사할 항목을 등록·선택하세요.',
        );
        return;
      }

      const activeTotal = countActiveRules({
        builtInEnabled,
        cautionEnabled,
        resolvedCustomRules,
      });
      if (isOverMaxRules(activeTotal)) {
        alert(maxRulesExceededMessage(activeTotal));
        return;
      }

      if (runSpelling) {
        if (
          !(await confirmSpellingCheckBeforeRun(authUid, authEmail, {
            builtInEnabled,
            cautionEnabled,
          }))
        ) {
          return;
        }
      }

      if (runConsistency) {
        if (
          !(await confirmConsistencyCheckBeforeRun(
            authUid,
            authEmail,
            resolvedCustomRules,
          ))
        ) {
          return;
        }
      }

      if (
        !(await assertBetaDailyCheckOrAlert(authUid, {
          authEmail,
          checkTab: scope,
          onConsumed: onBetaQuotaConsumed,
          skipConsumedAlert: runSpelling || runConsistency,
        }))
      ) {
        return;
      }

      setIsProcessing(true);
      setProgress({ current: 0, total: pageTexts.length, phase: 'check' });

      const reportCheckProgress = (current, total) => {
        setProgress({ current, total, phase: 'check' });
      };

      const allErrors = [];
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
        scopeResults = sortSpellingResultsForDisplay(grouped);
        setSpellingResults(scopeResults);
        setSpellingCheckDone(true);
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
        const withZeroRows = finalizeConsistencyCheckResults(
          grouped,
          consistencyActiveRules,
        );
        scopeResults = withZeroRows;
        setConsistencyResults(withZeroRows);
        setConsistencyCheckDone(withZeroRows.length > 0);
        const inst =
          withZeroRows.find((g) => g.instances.length > 0)?.instances[0] ?? null;
        if (inst) {
          first = inst;
          setConsistencySelected(inst);
        } else {
          setConsistencySelected(null);
        }
      }

      setResultVisibility((prev) => {
        let next = normalizeResultVisibilityState(prev);
        if (runSpelling) next = clearVisibilityForSource(next, 'spelling');
        if (runConsistency) next = clearVisibilityForSource(next, 'consistency');
        return next;
      });

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
      await trackCheckRun(
        {
          scope,
          findingCount,
          activeRuleCount: activeTotal,
        },
        { uid: authUid, email: authEmail },
      );
      trackResultViewed({ scope, findingCount });
      setCurrentPage(1);
      setIsProcessing(false);
      setProgress(null);
      if (runSpelling) {
        alertSpellingCheckAfterRun(scopeResults, findingCount);
      }
      if (runConsistency) {
        alertConsistencyCheckAfterRun(scopeResults, findingCount);
      }
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

  const runConsistencyScopeCheck = useCallback(
    async (subset) => {
      if (!pageTexts.length) {
        alert('먼저 PDF를 업로드하세요.');
        return;
      }

      const rules = filterCustomRulesByConsistencyScope(
        consistencyActiveRules,
        subset,
      );
      if (!rules.length) {
        alert(
          subset === 'auxiliary'
            ? '본용언+보조용언 표기에서 검사할 항목을 선택하세요.'
            : '일관성 찾기에서 검사할 항목을 등록·선택하세요.',
        );
        return;
      }

      const activeTotal = countActiveRules({
        builtInEnabled,
        cautionEnabled,
        resolvedCustomRules,
      });
      if (isOverMaxRules(activeTotal)) {
        alert(maxRulesExceededMessage(activeTotal));
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

      const { results: grouped, errors } = await runRuleCheckAsync(
        pageTexts,
        rules,
        {
          globalExcludePhrases,
          onProgress: (current, total) => {
            setProgress({ current, total, phase: 'check' });
          },
        },
      );

      const withZeroRows = finalizeConsistencyCheckResults(grouped, rules);

      setConsistencyResults((prev) => {
        const kept = prev.filter((g) => consistencyGroupScope(g) !== subset);
        return finalizeConsistencyCheckResults([...kept, ...withZeroRows], rules);
      });
      setConsistencyCheckDone(true);
      setResultVisibility((prev) => {
        let next = normalizeResultVisibilityState(prev);
        for (const row of withZeroRows) {
          next = clearVisibilityForGroup(next, 'consistency', row);
        }
        return next;
      });

      const inst =
        withZeroRows.find((g) => g.instances.length > 0)?.instances[0] ?? null;
      if (inst) {
        setActiveSource('consistency');
        setConsistencySelected(inst);
      }

      if (errors.length) {
        alert(errors.join('\n'));
      }

      const findingCount = withZeroRows.reduce(
        (n, g) => n + g.instances.length,
        0,
      );
      await trackCheckRun(
        {
          scope: subset === 'auxiliary' ? 'consistency-aux' : 'consistency-literal',
          findingCount,
          activeRuleCount: rules.length,
        },
        { uid: authUid, email: authEmail },
      );
      trackResultViewed({ scope: 'consistency', findingCount });

      setCurrentPage(inst?.pageNum ?? 1);
      setIsProcessing(false);
      setProgress(null);
      await afterCheckRef.current?.();
    },
    [
      pageTexts,
      builtInEnabled,
      cautionEnabled,
        resolvedCustomRules,
        consistencyActiveRules,
      globalExcludePhrases,
      setCurrentPage,
      setIsProcessing,
      setProgress,
      afterCheckRef,
      authUid,
      authEmail,
      onBetaQuotaConsumed,
    ],
  );

  const runConsistencyLiteralCheck = useCallback(
    () => runConsistencyScopeCheck('literal-slot'),
    [runConsistencyScopeCheck],
  );

  const runConsistencyAuxiliaryCheck = useCallback(
    () => runConsistencyScopeCheck('auxiliary'),
    [runConsistencyScopeCheck],
  );

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
    setResultVisibility((prev) =>
      toggleGroupVisibilityState(normalizeResultVisibilityState(prev), source, group),
    );
  }, []);

  const toggleInstanceVisibility = useCallback((source, group, inst) => {
    setResultVisibility((prev) =>
      toggleInstanceVisibilityState(
        normalizeResultVisibilityState(prev),
        source,
        group,
        inst,
      ),
    );
  }, []);

  const isGroupVisible = useCallback(
    (source, group) => isResultGroupVisible(resultVisibility, source, group),
    [resultVisibility],
  );

  const checkInstanceVisible = useCallback(
    (source, group, inst) =>
      isInstanceVisible(resultVisibility, source, group, inst),
    [resultVisibility],
  );

  const groupVisibilityMode = useCallback(
    (source, group) => getGroupVisibilityMode(resultVisibility, source, group),
    [resultVisibility],
  );

  const visibleInstanceCount = useCallback(
    (source, group) => countVisibleInstances(resultVisibility, source, group),
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
    (page, tab) => {
      let n = 0;
      if (tab === 'spelling') {
        for (const group of spellingResults) {
          for (const inst of group.instances) {
            if (inst.pageNum !== page) continue;
            if (!isInstanceVisible(resultVisibility, 'spelling', group, inst)) {
              continue;
            }
            n += 1;
          }
        }
        return n;
      }
      for (const group of consistencyResults) {
        for (const inst of group.instances) {
          if (inst.pageNum !== page) continue;
          if (!isInstanceVisible(resultVisibility, 'consistency', group, inst)) {
            continue;
          }
          n += 1;
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
        return;
      }
      setActiveSource('consistency');
      if (!consistencyCheckDone) return;
      const inst =
        consistencySelected ?? consistencyResults[0]?.instances[0] ?? null;
      setConsistencySelected(inst);
      if (inst) setCurrentPage(inst.pageNum);
    },
    [
      spellingSelected,
      consistencySelected,
      spellingResults,
      consistencyResults,
      consistencyCheckDone,
      setCurrentPage,
    ],
  );

  const getActiveOnPage = useCallback(
    (page) => {
      if (!activeGroup) return 0;
      return activeGroup.instances.filter(
        (i) =>
          i.pageNum === page &&
          isInstanceVisible(resultVisibility, activeSource, activeGroup, i),
      ).length;
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
    restoreFromSession,
    clearSpellingCheckState,
    clearConsistencyCheckState,
    runSpellingCheck,
    runConsistencyCheck,
    runConsistencyLiteralCheck,
    runConsistencyAuxiliaryCheck,
    selectInstance,
    goToPage,
    selectPageInGroup,
    selectGroup,
    isSameGroupAsSelected,
    toggleResultVisibility,
    toggleInstanceVisibility,
    isGroupVisible,
    isInstanceVisible: checkInstanceVisible,
    groupVisibilityMode,
    visibleInstanceCount,
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
    consistencyFindings: consistencyTotalFindings,
  };
}
