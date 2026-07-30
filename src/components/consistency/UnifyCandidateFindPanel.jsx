/**
 * 표기 통일 추천 — 맞춤법 탭 외래어 표기와 같은 박스·버튼 크롬.
 * 문서 내 띄어쓰기 이형태만 (규범 검증 아님).
 * 결과 목록은 맞춤법 결과 리스트와 같은 아코디언(전체 발견 / N기준).
 * 페이지 칩은 다수·소수 모두(접히면 최대 4개 + 더 보기).
 */
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  buildUnifyCandidatePreviewGroups,
  discoverSpacingUnifyCandidates,
  firstWrongUnifyInstance,
  instancesForUnifyVariant,
} from '../../lib/unifyCandidateDiscover.js';
import { groupSortAndFillSatellites } from '../../lib/unifyCandidateGrouping.js';
import {
  isUnifyPredicateCluster,
  looksLikePredicateKey,
} from '../../lib/unifyPredicateBucket.js';
import {
  mergeReviewedClustersIntoGroups,
  runJosaSlmReviewOnClusterGroups,
} from '../../lib/unifyJosaReviewSlm/index.js';
import {
  applyPredicateSlmDropsToGroups,
  runPredicateSlmReviewOnClusterGroups,
} from '../../lib/unifyPredicateReviewSlm/index.js';
import { stripDependentNounGenitiveFromGroups } from '../../lib/unifyDependentNounGenitive.js';
import { collectUnifyListTriage } from '../../lib/unifyListStemTriage.js';
import {
  applyStdictPosMarksToGroups,
  runStdictPosReviewOnClusterGroups,
} from '../../lib/unifyStdictPos.js';
import {
  isUnifyJosaSlmReviewEnabled,
  isUnifyPredicateSlmReviewEnabled,
  isUnifyStdictPosReviewEnabled,
} from '../../lib/featureFlags.js';
import { formatSystemPageLabel } from '../../lib/printedPageDisplay.js';
import { assertBetaDailyCheckOrAlert } from '../../lib/betaDailyQuota.js';
import { confirmUnifyCandidateFindBeforeRun, alertUnifyCandidateFindAfterRun } from '../../lib/consistencyCheckConfirm.js';
import ConsistencyHintExample from './ConsistencyHintExample.jsx';
import UnifySecondaryReviewPanel from './UnifySecondaryReviewPanel.jsx';
import ResultPageSummary from '../ResultPageSummary.jsx';
import DetailsChevron from '../DetailsChevron.jsx';

/**
 * @typedef {import('../../lib/unifyCandidateDiscover.js').UnifySpacingCluster} UnifySpacingCluster
 */

/**
 * @param {UnifySpacingCluster[]} clusters
 * @returns {number}
 */
function sumClusterFindings(clusters) {
  return clusters.reduce((sum, c) => sum + (c.totalCount || 0), 0);
}

/** 보조용언 추정(검토 필요) — 목록엔 두되 기본은 PDF·전체 발견에서 제외 */
function isAuxReviewDeferredCluster(cluster) {
  return cluster?.auxReview?.status === 'review';
}

/**
 * @param {{
 *   label: string,
 *   clusters: UnifySpacingCluster[],
 *   hiddenPdfKeys: Set<string>,
 *   onToggleAll: (clusters: UnifySpacingCluster[], nextVisible: boolean) => void,
 * }} props
 */
function UnifyCategorySelectAll({
  label,
  clusters,
  hiddenPdfKeys,
  onToggleAll,
}) {
  const ref = useRef(/** @type {HTMLInputElement | null} */ (null));
  const visibles = clusters.map((c) => !hiddenPdfKeys.has(c.key));
  const allChecked = visibles.length > 0 && visibles.every(Boolean);
  const noneChecked = visibles.every((v) => !v);

  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = !allChecked && !noneChecked;
    }
  }, [allChecked, noneChecked]);

  return (
    <label
      className="results-category__select-all"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <input
        ref={ref}
        type="checkbox"
        checked={allChecked}
        onChange={() => onToggleAll(clusters, !allChecked)}
        aria-label={`${label} PDF 표시`}
      />
    </label>
  );
}

/**
 * @param {{
 *   count: number,
 *   shownCount?: number,
 *   className?: string,
 * }} props
 */
function UnifyFindingsCount({ count, shownCount = count, className = '' }) {
  const partial = shownCount < count;
  return (
    <span
      className={`result-findings-count-circle ${className}`.trim()}
      aria-label={
        partial ? `표시 ${shownCount}건 / 전체 ${count}건` : `${count}건`
      }
      title={partial ? `표시 ${shownCount}/${count}` : undefined}
    >
      {partial ? `${shownCount}/${count}` : shownCount}
    </span>
  );
}

/**
 * @param {{
 *   hasPdf?: boolean,
 *   pageTexts?: { pageNum?: number, text?: string }[],
 *   customRules: import('../../lib/ruleTypes.js').Rule[],
 *   onApplyRules: (
 *     next: import('../../lib/ruleTypes.js').Rule[],
 *     extra?: { consistencyDecisions?: import('../../lib/consistencyDecisions.js').ConsistencyDecision[] },
 *   ) => boolean,
 *   consistencyDecisions?: import('../../lib/consistencyDecisions.js').ConsistencyDecision[],
 *   decisionByUid?: string,
 *   authUid?: string,
 *   authEmail?: string,
 *   onBetaQuotaConsumed?: () => void,
 *   checkQuotaBlocked?: boolean,
 *   currentPage?: number,
 *   selectedInstance?: import('../../lib/ruleEngine.js').MatchInstance | null,
 *   onSelectInstance?: (inst: import('../../lib/ruleEngine.js').MatchInstance) => void,
 *   onPreviewGroupsChange?: (
 *     groups: import('../../lib/ruleEngine.js').GroupedResult[],
 *   ) => void,
 *   formatPageLabel?: (systemPage: number) => string,
 * }} props
 */
export default function UnifyCandidateFindPanel({
  hasPdf = false,
  pageTexts = [],
  customRules,
  onApplyRules,
  consistencyDecisions = [],
  decisionByUid = '',
  authUid = '',
  authEmail = '',
  onBetaQuotaConsumed,
  checkQuotaBlocked = false,
  currentPage = 1,
  selectedInstance = null,
  onSelectInstance,
  onPreviewGroupsChange,
  formatPageLabel = formatSystemPageLabel,
}) {
  const [finding, setFinding] = useState(false);
  const [slmReviewing, setSlmReviewing] = useState(false);
  const [slmDroppedCount, setSlmDroppedCount] = useState(0);
  const [slmReviewedByKey, setSlmReviewedByKey] = useState(
    /** @type {Map<string, UnifySpacingCluster>} */ (new Map()),
  );
  const [predicateDropSeriesIds, setPredicateDropSeriesIds] = useState(
    /** @type {string[]} */ ([]),
  );
  const [predicateDropClusterKeys, setPredicateDropClusterKeys] = useState(
    /** @type {string[]} */ ([]),
  );
  const [predicateNeedsReviewByKey, setPredicateNeedsReviewByKey] = useState(
    /** @type {Map<string, { status: 'needs_review' }>} */ (new Map()),
  );
  const [stdictPredicateSeriesIds, setStdictPredicateSeriesIds] = useState(
    /** @type {string[]} */ ([]),
  );
  const [stdictPredicateClusterKeys, setStdictPredicateClusterKeys] = useState(
    /** @type {string[]} */ ([]),
  );
  const [ruleExcludedItems, setRuleExcludedItems] = useState(
    /** @type {{ id: string, label: string, reason?: string }[]} */ ([]),
  );
  const [secondaryReviewSummary, setSecondaryReviewSummary] = useState(
    /** @type {null | {
     *   josa?: { droppedCap?: number, ran?: boolean },
     *   predicate?: {
     *     reviewed: number,
     *     dropped: { id: string, label: string }[],
     *     kept: { id: string, label: string }[],
     *     needsReview: { id: string, label: string }[],
     *   },
     *   stdict?: {
     *     reviewed?: number,
     *     movedNounToPredicate?: { id: string, label: string, reason?: string }[],
     *   },
     * }} */ (null),
  );
  const [clusters, setClusters] = useState(
    /** @type {UnifySpacingCluster[]} */ ([]),
  );
  /** @type {[Map<string, import('../../lib/unifyCandidateDiscover.js').ClusterAcc> | null, Function]} */
  const [rawByKey, setRawByKey] = useState(
    /** @type {Map<string, import('../../lib/unifyCandidateDiscover.js').ClusterAcc> | null} */ (
      null
    ),
  );
  const [searched, setSearched] = useState(false);
  // key → 선택된 variant (즉시 등록됨)
  const [registeredVariants, setRegisteredVariants] = useState(
    /** @type {Map<string, string>} */ (new Map()),
  );
  // key → pre-select된 variant (같은 그룹 자동 선택, 아직 미등록)
  const [preSelected, setPreSelected] = useState(
    /** @type {Map<string, string>} */ (new Map()),
  );
  /** PDF 하이라이트에서 뺀 클러스터 key (기본은 모두 표시) */
  const [hiddenPdfKeys, setHiddenPdfKeys] = useState(
    /** @type {Set<string>} */ (new Set()),
  );

  /**
   * @param {UnifySpacingCluster[]} allClusters
   * @param {Map<string, import('../../lib/unifyCandidateDiscover.js').ClusterAcc> | null} raw
   * @param {Set<string>} hidden
   * @param {Map<string, UnifySpacingCluster>} [slmByKey]
   * @param {string[]} [dropSeriesIds]
   * @param {string[]} [dropClusterKeys]
   * @param {Map<string, true>} [needsReviewByKey]
   * @param {Map<string, string>} [registeredByKey]
   */
  const publishPreview = useCallback(
    (
      allClusters,
      raw,
      hidden,
      slmByKey = slmReviewedByKey,
      dropSeriesIds = predicateDropSeriesIds,
      dropClusterKeys = predicateDropClusterKeys,
      needsReviewByKey = predicateNeedsReviewByKey,
      registeredByKey = registeredVariants,
    ) => {
      if (!onPreviewGroupsChange) return;
      let nextGroups = raw
        ? groupSortAndFillSatellites(allClusters, raw)
        : [];
      nextGroups = stripDependentNounGenitiveFromGroups(nextGroups).groups;
      nextGroups = mergeReviewedClustersIntoGroups(nextGroups, slmByKey);
      nextGroups = applyPredicateSlmDropsToGroups(
        nextGroups,
        { seriesIds: dropSeriesIds, clusterKeys: dropClusterKeys },
        needsReviewByKey,
      );
      const previewClusters = nextGroups
        .flatMap((g) => g.clusters)
        .filter((c) => !hidden.has(c.key));
      onPreviewGroupsChange(
        buildUnifyCandidatePreviewGroups(previewClusters, {
          registeredByKey,
        }),
      );
    },
    [
      onPreviewGroupsChange,
      slmReviewedByKey,
      predicateDropSeriesIds,
      predicateDropClusterKeys,
      predicateNeedsReviewByKey,
      registeredVariants,
    ],
  );

  async function handleFind() {
    if (!hasPdf || !pageTexts.length) {
      alert('먼저 PDF를 업로드하세요.');
      return;
    }
    if (checkQuotaBlocked) {
      alert('지금은 검수를 진행할 수 없습니다. 로그인·검수권을 확인해 주세요.');
      return;
    }
    if (finding || slmReviewing) return;
    setFinding(true);
    try {
      if (!(await confirmUnifyCandidateFindBeforeRun(authUid, authEmail))) {
        return;
      }
      if (
        !(await assertBetaDailyCheckOrAlert(authUid, {
          authEmail,
          checkTab: 'consistency',
          onConsumed: onBetaQuotaConsumed,
          skipConsumedAlert: true,
        }))
      ) {
        return;
      }
      await new Promise((r) => setTimeout(r, 0));
      const result = discoverSpacingUnifyCandidates(pageTexts, { includeRaw: true });
      const next = result.clusters;
      let workingGroups = groupSortAndFillSatellites(next, result.rawByKey);
      const ruleStrip = stripDependentNounGenitiveFromGroups(workingGroups);
      workingGroups = ruleStrip.groups;
      const ruleExcluded = ruleStrip.dropped;
      /** @type {null | {
       *   reviewed?: number,
       *   movedNounToPredicate?: { id: string, label: string, reason?: string }[],
       * }} */
      let stdictSummary = null;
      /** @type {string[]} */
      let stdictSeriesIds = [];
      /** @type {string[]} */
      let stdictClusterKeys = [];
      /** @type {Map<string, UnifySpacingCluster>} */
      let slmByKey = new Map();
      let dropped = 0;
      let josaRan = false;
      /** @type {null | {
       *   ran?: boolean,
       *   droppedCap?: number,
       *   rulePromoted?: { id: string, label: string }[],
       *   slmConfirmed?: { id: string, label: string }[],
       *   slmCleared?: { id: string, label: string }[],
       *   capSkipped?: { id: string, label: string }[],
       * }} */
      let josaSummary = null;
      /** @type {string[]} */
      let dropSeriesIds = [];
      /** @type {string[]} */
      let dropClusterKeys = [];
      /** @type {Map<string, { status: 'needs_review' }>} */
      let needsReviewByKey = new Map();
      /** @type {null | {
       *   reviewed: number,
       *   dropped: { id: string, label: string }[],
       *   kept: { id: string, label: string }[],
       *   needsReview: { id: string, label: string }[],
       * }} */
      let predicateSummary = null;

      const needSlm =
        isUnifyJosaSlmReviewEnabled() || isUnifyPredicateSlmReviewEnabled();
      const needStdict = isUnifyStdictPosReviewEnabled();
      if (needSlm || needStdict) setSlmReviewing(true);
      try {
        if (needStdict) {
          const stdictResult = await runStdictPosReviewOnClusterGroups(
            workingGroups,
          );
          workingGroups = stdictResult.groups;
          stdictSeriesIds = stdictResult.marks.seriesIds;
          stdictClusterKeys = stdictResult.marks.clusterKeys;
          stdictSummary = stdictResult.summary;
        }

        if (isUnifyJosaSlmReviewEnabled()) {
          const { loadJosaSlmRunnerIfEnabled } = await import(
            '../../lib/unifyJosaReviewSlm/loadRunner.js'
          );
          const runnerOpts = await loadJosaSlmRunnerIfEnabled();
          const slmResult = await runJosaSlmReviewOnClusterGroups(
            workingGroups,
            { ...(runnerOpts ?? {}), pageTexts },
          );
          slmByKey = slmResult.reviewedByKey;
          dropped = slmResult.droppedCount;
          josaRan = true;
          josaSummary = slmResult.summary;
          workingGroups = mergeReviewedClustersIntoGroups(
            workingGroups,
            slmByKey,
          );
        }

        if (isUnifyPredicateSlmReviewEnabled()) {
          const { loadPredicateSlmRunnerIfEnabled } = await import(
            '../../lib/unifyPredicateReviewSlm/loadRunner.js'
          );
          const predRunner = await loadPredicateSlmRunnerIfEnabled();
          const predResult = await runPredicateSlmReviewOnClusterGroups(
            workingGroups,
            { ...(predRunner ?? {}) },
          );
          workingGroups = predResult.groups;
          dropSeriesIds = predResult.drop.seriesIds;
          dropClusterKeys = predResult.drop.clusterKeys;
          needsReviewByKey = predResult.needsReviewByClusterKey;
          predicateSummary = predResult.summary;
        }
      } finally {
        if (needSlm || needStdict) setSlmReviewing(false);
      }

      const triage = collectUnifyListTriage(workingGroups);

      const listClusters = workingGroups.flatMap((g) => g.clusters);
      // 보조용언 추정은 목록에만 두고, 체크·전체 발견·PDF는 사용자가 켤 때까지 제외
      const hidden = new Set(
        listClusters
          .filter(isAuxReviewDeferredCluster)
          .map((c) => c.key),
      );
      const countedClusters = listClusters.filter((c) => !hidden.has(c.key));

      setClusters(next);
      setRawByKey(result.rawByKey);
      setSlmReviewedByKey(slmByKey);
      setSlmDroppedCount(dropped);
      setPredicateDropSeriesIds(dropSeriesIds);
      setPredicateDropClusterKeys(dropClusterKeys);
      setPredicateNeedsReviewByKey(needsReviewByKey);
      setStdictPredicateSeriesIds(stdictSeriesIds);
      setStdictPredicateClusterKeys(stdictClusterKeys);
      setRuleExcludedItems(ruleExcluded);
      setSecondaryReviewSummary(
        josaSummary ||
          predicateSummary ||
          stdictSummary ||
          ruleExcluded.length ||
          triage.ambiguous.length ||
          triage.certainNoun.length
          ? {
              ...(ruleExcluded.length ? { ruleExcluded } : {}),
              triage: {
                certainNoun: triage.certainNoun,
                ambiguous: triage.ambiguous,
              },
              ...(josaSummary ? { josa: josaSummary } : {}),
              ...(predicateSummary ? { predicate: predicateSummary } : {}),
              ...(stdictSummary ? { stdict: stdictSummary } : {}),
              phase: stdictSummary ? 'rule_stdict' : 'rule_only',
            }
          : null,
      );
      setSearched(true);
      setRegisteredVariants(new Map());
      setPreSelected(new Map());
      setHiddenPdfKeys(hidden);
      publishPreview(
        next,
        result.rawByKey,
        hidden,
        slmByKey,
        dropSeriesIds,
        dropClusterKeys,
        needsReviewByKey,
        new Map(),
      );
      // 팝업 = 기본 체크된 항목만 (목록「전체 발견」과 동일)
      await alertUnifyCandidateFindAfterRun(countedClusters, {
        uid: authUid,
        email: authEmail,
      });
    } finally {
      setFinding(false);
    }
  }

  /**
   * @param {UnifySpacingCluster} cluster
   */
  function handleTogglePdfVisibility(cluster) {
    setHiddenPdfKeys((prev) => {
      const next = new Set(prev);
      if (next.has(cluster.key)) next.delete(cluster.key);
      else next.add(cluster.key);
      publishPreview(clusters, rawByKey, next);
      return next;
    });
  }

  /**
   * @param {UnifySpacingCluster[]} groupClusters
   * @param {boolean} nextVisible
   */
  function handleToggleCategoryPdf(groupClusters, nextVisible) {
    setHiddenPdfKeys((prev) => {
      const next = new Set(prev);
      for (const c of groupClusters) {
        if (nextVisible) next.delete(c.key);
        else next.add(c.key);
      }
      publishPreview(clusters, rawByKey, next);
      return next;
    });
  }

  const grouped = useMemo(() => {
    if (!rawByKey) return [];
    const base = groupSortAndFillSatellites(clusters, rawByKey);
    const stripped = stripDependentNounGenitiveFromGroups(base).groups;
    const withJosa = mergeReviewedClustersIntoGroups(
      stripped,
      slmReviewedByKey,
    );
    const withStdict = applyStdictPosMarksToGroups(withJosa, {
      seriesIds: stdictPredicateSeriesIds,
      clusterKeys: stdictPredicateClusterKeys,
    });
    return applyPredicateSlmDropsToGroups(
      withStdict,
      {
        seriesIds: predicateDropSeriesIds,
        clusterKeys: predicateDropClusterKeys,
      },
      predicateNeedsReviewByKey,
    );
  }, [
    clusters,
    rawByKey,
    slmReviewedByKey,
    stdictPredicateSeriesIds,
    stdictPredicateClusterKeys,
    predicateDropSeriesIds,
    predicateDropClusterKeys,
    predicateNeedsReviewByKey,
  ]);

  /** 목록에 실제로 보이는 클러스터만 (조사·어간 접미로 제외된 후) */
  const listClusters = useMemo(
    () => grouped.flatMap((g) => g.clusters),
    [grouped],
  );

  const busy = finding || slmReviewing;

  const totalFindings = useMemo(
    () => sumClusterFindings(listClusters),
    [listClusters],
  );
  const visibleFindings = useMemo(
    () =>
      sumClusterFindings(listClusters.filter((c) => !hiddenPdfKeys.has(c.key))),
    [listClusters, hiddenPdfKeys],
  );
  const defaultOpenId =
    grouped[0]?.type === 'series'
      ? `series-${grouped[0].affixType}-${grouped[0].affix}`
      : grouped[0]
        ? 'single'
        : '';

  /**
   * variant를 선택하여 즉시 등록.
   * @param {UnifySpacingCluster} cluster
   * @param {string} chosenVariant
   * @param {UnifySpacingCluster[]} [groupClusters] 같은 계열 그룹
   */
  const handleSelectVariant = useCallback(
    (cluster, chosenVariant, groupClusters) => {
      setRegisteredVariants((prev) => {
        const next = new Map(prev);
        next.set(cluster.key, chosenVariant);
        publishPreview(
          clusters,
          rawByKey,
          hiddenPdfKeys,
          slmReviewedByKey,
          predicateDropSeriesIds,
          predicateDropClusterKeys,
          predicateNeedsReviewByKey,
          next,
        );
        return next;
      });

      const firstWrong = firstWrongUnifyInstance(cluster, chosenVariant);
      if (firstWrong) onSelectInstance?.(firstWrong);

      // 그룹 첫 선택만 자동 선택. 이후 선택은 예외 — preselect를 덮어쓰지 않음.
      if (groupClusters && groupClusters.length > 1) {
        const isGlued = !/\s/.test(chosenVariant);
        setPreSelected((prev) => {
          const alreadySeeded = groupClusters.some((gc) => prev.has(gc.key));
          if (alreadySeeded) return prev;
          const next = new Map(prev);
          for (const gc of groupClusters) {
            if (gc.key === cluster.key) {
              // 기준 카드도 넣어 두면, 취소·반대 선택 시 예외 판별이 가능
              next.set(gc.key, chosenVariant);
              continue;
            }
            const sameDir = gc.variants.find((v) =>
              isGlued ? !/\s/.test(v) : /\s/.test(v),
            );
            if (sameDir) next.set(gc.key, sameDir);
          }
          return next;
        });
      }
    },
    [
      clusters,
      rawByKey,
      hiddenPdfKeys,
      slmReviewedByKey,
      predicateDropSeriesIds,
      predicateDropClusterKeys,
      predicateNeedsReviewByKey,
      publishPreview,
      onSelectInstance,
    ],
  );

  /**
   * 등록 취소 — 그룹 자동선택(preselect) 기준은 유지한다.
   * @param {UnifySpacingCluster} cluster
   */
  function handleCancelVariant(cluster) {
    setRegisteredVariants((prev) => {
      const next = new Map(prev);
      next.delete(cluster.key);
      publishPreview(
        clusters,
        rawByKey,
        hiddenPdfKeys,
        slmReviewedByKey,
        predicateDropSeriesIds,
        predicateDropClusterKeys,
        predicateNeedsReviewByKey,
        next,
      );
      return next;
    });
  }

  return (
    <div className="loanword-converter unify-candidate-find">
      <div className="loanword-converter__summary panel-criteria-heading">
        <span className="loanword-converter__summary-title">
          표기 통일 추천
          <span className="loanword-converter__free-badge">BEST</span>
          <span className="loanword-converter__free-badge loanword-converter__free-badge--yellow">
            V 0.7
          </span>
        </span>
      </div>

      <div className="unify-candidate-find__body">
        <div className="unify-candidate-find__intro-row">
          <p className="hint consistency-hint-block unify-candidate-find__hint">
            띄어쓰기가 다른 항목을 자동으로 찾아 제안합니다(줄바꿈 공백은 제외)
          </p>
          <button
            type="button"
            className="consistency-register-add-btn consistency-register-add-btn--label unify-candidate-find__submit"
            onClick={() => void handleFind()}
            disabled={busy || checkQuotaBlocked}
            aria-busy={busy}
          >
            {busy ? '·\u2009·\u2009·' : '찾기'}
          </button>
        </div>
        {slmReviewing ? (
          <p
            className="hint consistency-hint-block unify-candidate-find__slm-status"
            role="status"
            aria-live="polite"
          >
            2차 검토 중…
          </p>
        ) : null}
        <p className="hint consistency-hint-block unify-candidate-find__example">
          <ConsistencyHintExample>
            &apos;뉴욕 타임스&apos; 3회, &apos;뉴욕타임스&apos; 1회 → 다수형
            &apos;뉴욕 타임스&apos;
          </ConsistencyHintExample>
        </p>
      </div>

      {searched ? (
        <div
          className="unify-candidate-find__results"
          role="region"
          aria-label="표기 통일 추천"
        >
          {clusters.length === 0 ? (
            <p className="unify-candidate-find__empty">
              띄어쓰기만 다른 표기 후보를 찾지 못했습니다.
            </p>
          ) : (
            <section className="results-panel results-panel--consistency results-panel--unify-candidate">
              <div className="results-header results-header--total-only">
                <span className="results-header__total-findings results-findings-meta">
                  <span className="results-findings-meta__label">전체 발견</span>
                  <UnifyFindingsCount
                    count={visibleFindings}
                    shownCount={visibleFindings}
                    className="results-header__total-count"
                  />
                </span>
              </div>
              <div
                className="results-accordion"
                key={`unify-acc-${clusters.length}-${totalFindings}`}
              >
                <UnifySecondaryReviewPanel summary={secondaryReviewSummary} />
                {grouped.map((group) => {
                  const sectionId =
                    group.type === 'series'
                      ? `series-${group.affixType}-${group.affix}`
                      : group.type === 'predicate'
                        ? 'predicate'
                        : 'single';
                  const label =
                    group.type === 'series'
                      ? `[${group.label}]`
                      : group.type === 'predicate'
                        ? '용언'
                        : '단일 항목';
                  const findingsTotal = sumClusterFindings(group.clusters);
                  const visibleClusters = group.clusters.filter(
                    (c) => !hiddenPdfKeys.has(c.key),
                  );
                  const findingsShown = sumClusterFindings(visibleClusters);
                  const criteriaCount = visibleClusters.length;
                  const categoryMod =
                    group.type === 'series'
                      ? 'series'
                      : group.type === 'predicate'
                        ? 'predicate'
                        : 'single';

                  const clusterCards = group.clusters.map((cluster) => (
                    <ClusterCard
                      key={cluster.key}
                      cluster={cluster}
                      kindTag={
                        group.type === 'predicate' ||
                        (group.type === 'series' &&
                          looksLikePredicateKey(group.affix)) ||
                        isUnifyPredicateCluster(cluster)
                          ? '용언'
                          : '명사'
                      }
                      pdfVisible={!hiddenPdfKeys.has(cluster.key)}
                      onTogglePdfVisibility={handleTogglePdfVisibility}
                      registeredVariant={registeredVariants.get(cluster.key)}
                      preSelectedVariant={preSelected.get(cluster.key)}
                      groupClusters={
                        group.type === 'series' ? group.clusters : undefined
                      }
                      onSelectVariant={handleSelectVariant}
                      onCancelVariant={handleCancelVariant}
                      currentPage={currentPage}
                      selectedInstance={selectedInstance}
                      formatPageLabel={formatPageLabel}
                      onSelectInstance={onSelectInstance}
                    />
                  ));

                  // 단일·용언 — 「용언」헤더·체크박스 없이 카드만 바로 표시
                  if (group.type === 'single' || group.type === 'predicate') {
                    return (
                      <ul
                        key={sectionId}
                        className="results-list results-list--nested unify-candidate-find__list unify-candidate-find__list--flat-single"
                      >
                        {clusterCards}
                      </ul>
                    );
                  }

                  return (
                    <details
                      key={sectionId}
                      className={`results-category results-category--unify-${categoryMod}`}
                      defaultOpen={defaultOpenId === sectionId}
                    >
                      <summary className="results-category__summary panel-criteria-heading">
                        <DetailsChevron />
                        <UnifyCategorySelectAll
                          label={label}
                          clusters={group.clusters}
                          hiddenPdfKeys={hiddenPdfKeys}
                          onToggleAll={handleToggleCategoryPdf}
                        />
                        <span className="results-category__label">{label}</span>
                        <span className="results-category__meta results-findings-meta">
                          <span className="results-findings-meta__label">
                            <span className="results-category__criteria-num">
                              {criteriaCount}
                            </span>
                            <span className="results-category__criteria-unit">
                              기준
                            </span>
                          </span>
                          <UnifyFindingsCount
                            count={findingsTotal}
                            shownCount={findingsShown}
                            className="results-category__findings"
                          />
                        </span>
                      </summary>
                      <ul className="results-list results-list--nested unify-candidate-find__list">
                        {clusterCards}
                      </ul>
                    </details>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      ) : null}
    </div>
  );
}

/**
 * 개별 클러스터 카드 — variant별 "표기 통일" 버튼 포함.
 */
function ClusterCard({
  cluster,
  kindTag = '명사',
  pdfVisible,
  onTogglePdfVisibility,
  registeredVariant,
  preSelectedVariant,
  groupClusters,
  onSelectVariant,
  onCancelVariant,
  currentPage,
  selectedInstance,
  formatPageLabel,
  onSelectInstance,
}) {
  const isRegistered = !!registeredVariant;

  // 예외: pre-select 방향과 반대로 등록된 경우
  const isException = (() => {
    if (!isRegistered || !preSelectedVariant) return false;
    const preIsGlued = !/\s/.test(preSelectedVariant);
    const chosenIsGlued = !/\s/.test(registeredVariant);
    return preIsGlued !== chosenIsGlued;
  })();

  return (
    <li
      className={[
        'unify-candidate-find__card',
        !pdfVisible && 'unify-candidate-find__card--pdf-hidden',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="unify-candidate-find__card-head">
        <label
          className="result-visibility-toggle"
          title="PDF에 표시"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={pdfVisible}
            onChange={() => onTogglePdfVisibility(cluster)}
            aria-label={`총 ${cluster.totalCount}회 PDF 표시`}
          />
        </label>
        <div className="unify-candidate-find__card-head-main">
          <div className="unify-candidate-find__card-title-row">
            <span className="unify-candidate-find__total">
              총 {cluster.totalCount}회
            </span>
            {cluster.josaReview?.status === 'review' &&
            cluster.auxReview?.status !== 'review' ? (
              <span
                className="unify-candidate-find__josa-review"
                title={
                  cluster.josaReview.peerKeys?.length
                    ? `같은 어간 추정: ${cluster.josaReview.stemKey} · 연결 ${cluster.josaReview.peerKeys.join(', ')}`
                    : undefined
                }
              >
                조사 · 어간 추정, 검토 필요
              </span>
            ) : null}
            {cluster.auxReview?.status === 'review' ? (
              <span
                className="unify-candidate-find__aux-review"
                title={
                  cluster.auxReview.displayLabel
                    ? `본용언+보조용언 시트: ${cluster.auxReview.displayLabel} · ${cluster.auxReview.stemSpaced}`
                    : `본용언+보조용언 시트 stem: ${cluster.auxReview.stemSpaced}`
                }
              >
                본용언+ 보조용언 표기로 추정, 검토 필요
              </span>
            ) : null}
            {cluster.predicateReview?.status === 'needs_review' &&
            cluster.auxReview?.status !== 'review' ? (
              <span className="unify-candidate-find__predicate-review">
                용언 추정, 검토 필요
              </span>
            ) : null}
          </div>
        </div>
        <UnifyFindingsCount
          count={cluster.totalCount}
          shownCount={pdfVisible ? cluster.totalCount : 0}
          className="result-card-head__findings-count"
        />
      </div>
      <ul className="unify-candidate-find__variants">
        {cluster.variants.map((variant) => {
          const count = cluster.counts[variant] ?? 0;
          const isDerived = count === 0;
          const isChosen = registeredVariant === variant;
          const isPreSelected = !isRegistered && preSelectedVariant === variant;
          const instances = instancesForUnifyVariant(cluster, variant, {
            chosenVariant: registeredVariant ?? null,
          });

          return (
            <li
              key={variant}
              className={[
                'unify-candidate-find__variant-item',
                isDerived && 'unify-candidate-find__variant-item--derived',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <div className="unify-candidate-find__variant-row">
                <span className="unify-candidate-find__variant">
                  {`[${kindTag}] ${variant}`}
                </span>
                {count > 0 ? (
                  <span className="unify-candidate-find__count">
                    {count}회
                  </span>
                ) : null}
                {isException && isChosen ? (
                  <span className="unify-candidate-find__exception-badge">
                    표기 통일 예외
                  </span>
                ) : null}
                <button
                  type="button"
                  className={[
                    'unify-candidate-find__unify-btn',
                    isChosen && 'unify-candidate-find__unify-btn--chosen',
                    isPreSelected && 'unify-candidate-find__unify-btn--preselect',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() =>
                    isChosen
                      ? onCancelVariant(cluster)
                      : onSelectVariant(cluster, variant, groupClusters)
                  }
                >
                  표기 통일
                </button>
              </div>
              {instances.length > 0 ? (
                <ResultPageSummary
                  instances={instances}
                  currentPage={currentPage}
                  selectedInstance={selectedInstance}
                  formatPageLabel={formatPageLabel}
                  isInstanceVisible={() => true}
                  collapsedVisibleLimit={4}
                  onSelectPage={(pageNum) => {
                    const first = instances.find(
                      (inst) => inst.pageNum === pageNum,
                    );
                    if (first) onSelectInstance?.(first);
                  }}
                  onSelectInstance={onSelectInstance}
                />
              ) : null}
            </li>
          );
        })}
      </ul>
    </li>
  );
}
