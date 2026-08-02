/**
 * 표기 통일 추천 — 맞춤법 탭 외래어 표기와 같은 박스·버튼 크롬.
 * 문서 내 띄어쓰기 이형태만 (규범 검증 아님).
 * 결과 목록은 맞춤법 결과 리스트와 같은 아코디언(N항목 전체 발견).
 * 페이지 칩은 접히면 최대 3개 +「더 보기」.
 */
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import CriteriaHoverTip from '../CriteriaHoverTip.jsx';
import {
  buildUnifyCandidatePreviewGroups,
  discoverSpacingUnifyCandidatesAsync,
  enrichClustersWithItemHits,
  enrichClusterGroupsWithItemHits,
  firstWrongUnifyInstance,
  instancesForUnifyVariant,
  prefetchUnifyKiwiSurfaces,
} from '../../lib/unifyCandidateDiscover.js';
import { groupSortAndFillSatellites, countUnifyListAccordionItems } from '../../lib/unifyCandidateGrouping.js';
import { filterSeriesSatellitesByMorphPos } from '../../lib/unifyCandidateSatellites.js';
import {
  buildPatternRulePreviewGroups,
  buildSecondaryGroupsFromCandidates,
  collectPatternRuleCandidates,
  collectPatternRulesFromRegistrations,
  formatPatternRuleConditionLabel,
  isPrimaryUnifyComplete,
} from '../../lib/unifyPatternRule.js';
import { showAppConfirm } from '../../lib/appDialog.js';
import { dropJosaPlusPredicateFromGroups } from '../../lib/unifyPredicateBucket.js';
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

/** 단일 카드 카테고리명 — 예: 골드만삭스-골드만 삭스 */
function formatUnifySingleClusterLabel(cluster) {
  const variants = cluster?.variants ?? [];
  if (!variants.length) return cluster?.key || '';
  return variants.join('-');
}

/**
 * 계열에서 표기 통일(또는 자동선택)된 붙임/띄움 방향.
 * @param {{ clusters?: { key?: string }[] }} group
 * @param {Map<string, string>} registeredVariants
 * @param {Map<string, string>} preSelected
 * @returns {'glued' | 'spaced' | null}
 */
function resolveSeriesChosenSpacing(group, registeredVariants, preSelected) {
  for (const c of group?.clusters ?? []) {
    const key = c?.key;
    if (!key) continue;
    const chosen = registeredVariants.get(key) ?? preSelected.get(key);
    if (chosen == null || chosen === '') continue;
    return /\s/.test(chosen) ? 'spaced' : 'glued';
  }
  return null;
}

/**
 * @param {{ variants?: string[] }} cluster
 * @param {'glued' | 'spaced'} spacing
 * @returns {string | undefined}
 */
function variantForSpacing(cluster, spacing) {
  return (cluster?.variants ?? []).find((v) =>
    spacing === 'glued' ? !/\s/.test(v) : /\s/.test(v),
  );
}

/**
 * @param {{ affix?: string, affixType?: string, label?: string }} group
 */
function formatSeriesCategoryLabelText(group) {
  const affix = String(group?.affix ?? '');
  if (group?.affixType === 'suffix') return group?.label || `@${affix}`;
  return group?.label || `${affix}@`;
}

/**
 * 계열 헤더 — 붙여쓰기 / 띄어쓰기 일괄 선택.
 * @param {{
 *   spacing: 'glued' | 'spaced' | null,
 *   hintSpacing?: 'glued' | 'spaced' | null,
 *   onSelect: (spacing: 'glued' | 'spaced') => void,
 * }} props
 */
function SeriesSpacingButtons({ spacing, hintSpacing = null, onSelect }) {
  return (
    <span
      className="unify-candidate-find__series-spacing-btns"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className={[
          'unify-candidate-find__series-spacing-btn',
          spacing === 'glued' &&
            'unify-candidate-find__series-spacing-btn--chosen',
          !spacing &&
            hintSpacing === 'glued' &&
            'unify-candidate-find__series-spacing-btn--hint',
        ]
          .filter(Boolean)
          .join(' ')}
        aria-pressed={spacing === 'glued'}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onSelect('glued');
        }}
      >
        붙여쓰기
      </button>
      <button
        type="button"
        className={[
          'unify-candidate-find__series-spacing-btn',
          spacing === 'spaced' &&
            'unify-candidate-find__series-spacing-btn--chosen',
          !spacing &&
            hintSpacing === 'spaced' &&
            'unify-candidate-find__series-spacing-btn--hint',
        ]
          .filter(Boolean)
          .join(' ')}
        aria-pressed={spacing === 'spaced'}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onSelect('spaced');
        }}
      >
        띄어쓰기
      </button>
    </span>
  );
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
    <CriteriaHoverTip
      tip={partial ? `표시 ${shownCount}/${count}` : undefined}
      variant="wrap"
    >
      <span
        className={`result-findings-count-circle ${className}`.trim()}
        aria-label={
          partial ? `표시 ${shownCount}건 / 전체 ${count}건` : `${count}건`
        }
      >
        {partial ? `${shownCount}/${count}` : shownCount}
      </span>
    </CriteriaHoverTip>
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

  // PDF 준비되면 찾기 전에 Kiwi 표면 prefetch (서버 모드) — 클릭 직후 대기 완화
  useEffect(() => {
    if (!hasPdf || !pageTexts?.length) return;
    let cancelled = false;
    void prefetchUnifyKiwiSurfaces(pageTexts).then(() => {
      if (cancelled) return;
    });
    return () => {
      cancelled = true;
    };
  }, [hasPdf, pageTexts]);

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
     *     ran?: boolean,
     *     reviewed?: number,
     *     movedNounToPredicate?: { id: string, label: string, reason?: string }[],
     *     confirmedNoun?: { id: string, label: string, reason?: string }[],
     *     confirmedPredicate?: { id: string, label: string, reason?: string }[],
     *     missing?: { id: string, label: string, reason?: string }[],
     *     error?: string,
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
  /** @type {['primary' | 'secondary_pairs', Function]} */
  const [unifyPhase, setUnifyPhase] = useState(
    /** @type {'primary' | 'secondary_pairs'} */ ('primary'),
  );
  const [secondaryGroups, setSecondaryGroups] = useState(
    /** @type {{
     *   type: 'series',
     *   affixType: 'prefix' | 'suffix',
     *   affix: string,
     *   label: string,
     *   template: string,
     *   clusters: UnifySpacingCluster[],
     * }[]} */ ([]),
  );
  /** 2차 진행 중 — 1차에서 확정된 조건형 라벨 */
  const [phase2ConditionLabels, setPhase2ConditionLabels] = useState(
    /** @type {string[]} */ ([]),
  );
  /** 2차 완료 후 — 2차에서 고른 조건형 라벨 */
  const [phase2DoneLabels, setPhase2DoneLabels] = useState(
    /** @type {string[]} */ ([]),
  );
  const secondaryClusters = useMemo(
    () => secondaryGroups.flatMap((g) => g.clusters),
    [secondaryGroups],
  );
  const phase2PromptedRef = useRef(false);
  const phase2CompletePromptedRef = useRef(false);
  /** PDF 하이라이트에서 뺀 클러스터 key (기본은 모두 표시) */
  const [hiddenPdfKeys, setHiddenPdfKeys] = useState(
    /** @type {Set<string>} */ (new Set()),
  );
  /** 칩·하이라이트 동일 소스 (publishPreview가 갱신) */
  const [publishedPreviewGroups, setPublishedPreviewGroups] = useState(
    /** @type {import('../../lib/ruleEngine.js').GroupedResult[]} */ ([]),
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
   * @param {UnifySpacingCluster[] | null} [overrideClusters] 2차-B 전용 목록
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
      overrideClusters = null,
    ) => {
      /** @type {import('../../lib/ruleEngine.js').GroupedResult[]} */
      let groups = [];
      if (overrideClusters) {
        groups = buildUnifyCandidatePreviewGroups(
          overrideClusters.filter((c) => !hidden.has(c.key)),
          { registeredByKey, pages: pageTexts },
        );
      } else {
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
        groups = buildUnifyCandidatePreviewGroups(previewClusters, {
          registeredByKey,
          pages: pageTexts,
        });
      }
      setPublishedPreviewGroups(groups);
      onPreviewGroupsChange?.(groups);
      return groups;
    },
    [
      onPreviewGroupsChange,
      pageTexts,
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
      // 페이지마다 양보 — 동기 discover/enrich 전량 실행은 '응답 없음'을 유발함
      const result = await discoverSpacingUnifyCandidatesAsync(pageTexts, {
        includeRaw: true,
      });
      // item 근거 없는 유령 출현(지도 글리프→붙임) 제거 후 목록·칩 동기화
      const next = enrichClustersWithItemHits(
        result.clusters ?? [],
        pageTexts,
      );
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
          try {
            const stdictResult = await runStdictPosReviewOnClusterGroups(
              workingGroups,
            );
            workingGroups = stdictResult.groups;
            stdictSeriesIds = stdictResult.marks.seriesIds;
            stdictClusterKeys = stdictResult.marks.clusterKeys;
            // 사전에서 용언으로 확정된 키 + 조사 구조면 @+조사+용언으로 제외
            workingGroups = dropJosaPlusPredicateFromGroups(workingGroups, {
              stdictPredicateKeys: stdictClusterKeys,
            });
            // stdict가 dictPos를 붙인 뒤 — 이형태 없는 위성만 동종 복합 검증
            workingGroups = filterSeriesSatellitesByMorphPos(workingGroups);
            stdictSummary = {
              ...stdictResult.summary,
              ran: true,
            };
          } catch (err) {
            stdictSummary = {
              ran: true,
              reviewed: 0,
              movedNounToPredicate: [],
              error: err instanceof Error ? err.message : String(err),
            };
          }
        } else {
          // API 없이도 규칙 안전망(하다·보자 등)으로 한 번 더
          workingGroups = dropJosaPlusPredicateFromGroups(workingGroups);
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

      // 목록(grouped)과 동일: item 근거로 재집계 후 횟수·팝업 집계
      workingGroups = enrichClusterGroupsWithItemHits(
        workingGroups,
        pageTexts,
      );
      // enrich가 conflict→single-form으로 바꾼 뒤 동종 복합 재검증
      workingGroups = filterSeriesSatellitesByMorphPos(workingGroups);

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
      setUnifyPhase('primary');
      setSecondaryGroups([]);
      setPhase2ConditionLabels([]);
      setPhase2DoneLabels([]);
      phase2PromptedRef.current = false;
      phase2CompletePromptedRef.current = false;
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
      // 팝업 항목 수 = 목록 아코디언 행, 횟수 = 기본 체크된 클러스터
      await alertUnifyCandidateFindAfterRun(countedClusters, {
        uid: authUid,
        email: authEmail,
        itemCount: countUnifyListAccordionItems(workingGroups),
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
    const withMorphSat = filterSeriesSatellitesByMorphPos(withStdict);
    const withoutJosaPred = dropJosaPlusPredicateFromGroups(withMorphSat, {
      stdictPredicateKeys: stdictPredicateClusterKeys,
    });
    const afterPredicate = applyPredicateSlmDropsToGroups(
      withoutJosaPred,
      {
        seriesIds: predicateDropSeriesIds,
        clusterKeys: predicateDropClusterKeys,
      },
      predicateNeedsReviewByKey,
    );
    // 위성은 raw 횟수라 item 없는 유령·이중 드로잉이 남음 → 목록 직전에 재집계
    // enrich 후 single-form으로 바뀐 항목에 morph 재적용
    return filterSeriesSatellitesByMorphPos(
      enrichClusterGroupsWithItemHits(afterPredicate, pageTexts),
    );
  }, [
    clusters,
    rawByKey,
    pageTexts,
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
  /** 목록 아코디언 행 수 (단일·용언=클러스터, 계열=그룹 1) */
  const listItemCount = useMemo(
    () => countUnifyListAccordionItems(grouped),
    [grouped],
  );
  const defaultOpenId =
    grouped[0]?.type === 'series'
      ? `series-${grouped[0].affixType}-${grouped[0].affix}`
      : grouped[0]
        ? 'single'
        : '';

  /**
   * variant를 선택하여 즉시 등록 (1차 또는 2차-B).
   * @param {UnifySpacingCluster} cluster
   * @param {string} chosenVariant
   * @param {UnifySpacingCluster[]} [groupClusters] 같은 계열 그룹
   */
  const handleSelectVariant = useCallback(
    (cluster, chosenVariant, groupClusters) => {
      const nextRegistered = new Map(registeredVariants);
      nextRegistered.set(cluster.key, chosenVariant);
      setRegisteredVariants(nextRegistered);

      const previewGroups =
        unifyPhase === 'secondary_pairs'
          ? publishPreview(
              clusters,
              rawByKey,
              hiddenPdfKeys,
              slmReviewedByKey,
              predicateDropSeriesIds,
              predicateDropClusterKeys,
              predicateNeedsReviewByKey,
              nextRegistered,
              secondaryClusters,
            )
          : publishPreview(
              clusters,
              rawByKey,
              hiddenPdfKeys,
              slmReviewedByKey,
              predicateDropSeriesIds,
              predicateDropClusterKeys,
              predicateNeedsReviewByKey,
              nextRegistered,
            );

      // publish와 동일한 인스턴스를 선택해야 primary 빨간줄이 맞음
      const firstWrong =
        (previewGroups ?? []).find(
          (g) =>
            g.replace === chosenVariant &&
            g.find !== chosenVariant &&
            g.instances?.length,
        )?.instances?.[0] ??
        firstWrongUnifyInstance(cluster, chosenVariant, {
          pages: pageTexts,
        });
      if (firstWrong) onSelectInstance?.(firstWrong);

      if (
        unifyPhase === 'primary' &&
        groupClusters &&
        groupClusters.length > 1
      ) {
        const isGlued = !/\s/.test(chosenVariant);
        setPreSelected((prev) => {
          const alreadySeeded = groupClusters.some((gc) => prev.has(gc.key));
          if (alreadySeeded) return prev;
          const next = new Map(prev);
          for (const gc of groupClusters) {
            if (gc.key === cluster.key) {
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
      registeredVariants,
      unifyPhase,
      secondaryClusters,
      pageTexts,
    ],
  );

  /** 2차 — 패턴 후보(증거·score)를 모아 계열 목록 + 패턴 Preview로 진입 */
  const enterPhase2 = useCallback(() => {
    const rules = collectPatternRulesFromRegistrations(
      registeredVariants,
      clusters,
    );
    const labels = rules
      .map((r) => formatPatternRuleConditionLabel(r))
      .filter(Boolean);
    setPhase2ConditionLabels(labels);

    const candidates = collectPatternRuleCandidates(
      registeredVariants,
      clusters,
      pageTexts,
    );
    const ids = candidates.map((c) => c.id);
    const nextGroups = buildSecondaryGroupsFromCandidates(candidates, ids);
    const nextClusters = nextGroups.flatMap((g) => g.clusters);
    setSecondaryGroups(nextGroups);
    setPhase2DoneLabels([]);
    setUnifyPhase('secondary_pairs');
    phase2CompletePromptedRef.current = false;

    const previewMismatches = candidates.flatMap((c) => c.mismatches ?? []);
    if (onPreviewGroupsChange && previewMismatches.length) {
      onPreviewGroupsChange(buildPatternRulePreviewGroups(previewMismatches));
    } else {
      publishPreview(
        clusters,
        rawByKey,
        hiddenPdfKeys,
        slmReviewedByKey,
        predicateDropSeriesIds,
        predicateDropClusterKeys,
        predicateNeedsReviewByKey,
        registeredVariants,
        nextClusters,
      );
    }
  }, [
    registeredVariants,
    clusters,
    pageTexts,
    publishPreview,
    rawByKey,
    hiddenPdfKeys,
    slmReviewedByKey,
    predicateDropSeriesIds,
    predicateDropClusterKeys,
    predicateNeedsReviewByKey,
    onPreviewGroupsChange,
  ]);

  const finishSecondary = useCallback(() => {
    const doneLabels = [];
    for (const group of secondaryGroups) {
      let direction = null;
      for (const c of group.clusters ?? []) {
        const chosen = registeredVariants.get(c.key);
        if (chosen == null || chosen === '') continue;
        direction = /\s/.test(chosen) ? 'spaced' : 'glued';
        break;
      }
      if (!direction) continue;
      const label = formatPatternRuleConditionLabel({
        template: group.template || group.label,
        direction,
      });
      if (label) doneLabels.push(label);
    }
    setPhase2DoneLabels(doneLabels);
    setUnifyPhase('primary');
    setSecondaryGroups([]);
    setPhase2ConditionLabels([]);
    publishPreview(
      clusters,
      rawByKey,
      hiddenPdfKeys,
      slmReviewedByKey,
      predicateDropSeriesIds,
      predicateDropClusterKeys,
      predicateNeedsReviewByKey,
      registeredVariants,
    );
  }, [
    secondaryGroups,
    clusters,
    rawByKey,
    hiddenPdfKeys,
    slmReviewedByKey,
    predicateDropSeriesIds,
    predicateDropClusterKeys,
    predicateNeedsReviewByKey,
    registeredVariants,
    publishPreview,
  ]);

  useEffect(() => {
    if (unifyPhase !== 'primary') return;
    if (!searched || phase2PromptedRef.current) return;
    if (!isPrimaryUnifyComplete(grouped, registeredVariants)) return;
    phase2PromptedRef.current = true;
    void (async () => {
      const ok = await showAppConfirm({
        title: '표기 통일 추천',
        message: '2차 표기 통일을 진행합니다',
        confirmLabel: '네',
        cancelLabel: '아니오',
      });
      if (ok) enterPhase2();
    })();
  }, [
    unifyPhase,
    searched,
    grouped,
    registeredVariants,
    enterPhase2,
  ]);

  useEffect(() => {
    if (unifyPhase !== 'secondary_pairs') return;
    if (!secondaryClusters.length) {
      finishSecondary();
      return;
    }
    const allChosen = secondaryClusters.every((c) =>
      registeredVariants.has(c.key),
    );
    if (!allChosen) {
      phase2CompletePromptedRef.current = false;
      return;
    }
    if (phase2CompletePromptedRef.current) return;
    phase2CompletePromptedRef.current = true;
    void (async () => {
      const ok = await showAppConfirm({
        title: '표기 통일 추천',
        message: '2차 표기 통일을 완료하시겠습니까?',
        confirmLabel: '예',
        cancelLabel: '아니오',
      });
      if (ok) finishSecondary();
    })();
  }, [
    unifyPhase,
    secondaryClusters,
    registeredVariants,
    finishSecondary,
  ]);

  /**
   * 계열 헤더 붙여쓰기/띄어쓰기 — 같은 계열 전부 표기 통일.
   * 같은 방향 재클릭 시 계열 등록을 해제한다.
   * @param {UnifySpacingCluster[]} groupClusters
   * @param {'glued' | 'spaced'} spacing
   * @param {'glued' | 'spaced' | null} currentSpacing
   */
  const handleSeriesSpacingSelect = useCallback(
    (groupClusters, spacing, currentSpacing) => {
      if (!groupClusters?.length) return;
      const previewOverride =
        unifyPhase === 'secondary_pairs' ? secondaryClusters : null;

      if (currentSpacing === spacing) {
        setRegisteredVariants((prev) => {
          const next = new Map(prev);
          for (const gc of groupClusters) next.delete(gc.key);
          publishPreview(
            clusters,
            rawByKey,
            hiddenPdfKeys,
            slmReviewedByKey,
            predicateDropSeriesIds,
            predicateDropClusterKeys,
            predicateNeedsReviewByKey,
            next,
            previewOverride,
          );
          return next;
        });
        setPreSelected((prev) => {
          const next = new Map(prev);
          for (const gc of groupClusters) next.delete(gc.key);
          return next;
        });
        return;
      }

      setRegisteredVariants((prev) => {
        const next = new Map(prev);
        for (const gc of groupClusters) {
          const v = variantForSpacing(gc, spacing);
          if (v) next.set(gc.key, v);
        }
        publishPreview(
          clusters,
          rawByKey,
          hiddenPdfKeys,
          slmReviewedByKey,
          predicateDropSeriesIds,
          predicateDropClusterKeys,
          predicateNeedsReviewByKey,
          next,
          previewOverride,
        );
        return next;
      });
      setPreSelected((prev) => {
        const next = new Map(prev);
        for (const gc of groupClusters) {
          const v = variantForSpacing(gc, spacing);
          if (v) next.set(gc.key, v);
        }
        return next;
      });

      for (const gc of groupClusters) {
        const v = variantForSpacing(gc, spacing);
        if (!v) continue;
        const firstWrong = firstWrongUnifyInstance(gc, v, {
          pages: pageTexts,
        });
        if (firstWrong) {
          onSelectInstance?.(firstWrong);
          break;
        }
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
      unifyPhase,
      secondaryClusters,
    ],
  );

  /**
   * 등록·자동선택 취소 — 선택 대기 모드.
   * 계열에 남은 등록이 없으면 그룹 자동선택도 전부 해제한다.
   * @param {UnifySpacingCluster} cluster
   * @param {UnifySpacingCluster[]} [groupClusters]
   */
  function handleCancelVariant(cluster, groupClusters) {
    const siblings =
      groupClusters?.length > 0 ? groupClusters : [cluster];

    setRegisteredVariants((prev) => {
      const nextReg = new Map(prev);
      nextReg.delete(cluster.key);
      const anyRegisteredLeft = siblings.some((gc) => nextReg.has(gc.key));

      setPreSelected((prevPre) => {
        const nextPre = new Map(prevPre);
        nextPre.delete(cluster.key);
        if (!anyRegisteredLeft) {
          for (const gc of siblings) nextPre.delete(gc.key);
        }
        return nextPre;
      });

      publishPreview(
        clusters,
        rawByKey,
        hiddenPdfKeys,
        slmReviewedByKey,
        predicateDropSeriesIds,
        predicateDropClusterKeys,
        predicateNeedsReviewByKey,
        nextReg,
        unifyPhase === 'secondary_pairs' ? secondaryClusters : null,
      );
      return nextReg;
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
                  <span className="results-findings-meta__label">
                    {listItemCount}항목 전체 발견
                  </span>
                  <span className="unify-candidate-find__badge-slot">
                    <UnifyFindingsCount
                      count={visibleFindings}
                      shownCount={visibleFindings}
                      className="results-header__total-count"
                    />
                  </span>
                </span>
              </div>
              <div
                className="results-accordion"
                key={`unify-acc-${clusters.length}-${totalFindings}-${unifyPhase}`}
              >
                <div className="unify-candidate-find__phase-banner">
                  {unifyPhase === 'secondary_pairs' ? (
                    <>
                      <p className="unify-candidate-find__phase-banner-title">
                        2차 표기 통일 중
                      </p>
                      <p className="unify-candidate-find__phase-banner-conditions">
                        1차 표기 통일 선택
                        {phase2ConditionLabels.length > 0
                          ? ` : ${phase2ConditionLabels.join(' · ')}`
                          : ''}
                      </p>
                    </>
                  ) : phase2DoneLabels.length > 0 ? (
                    <p className="unify-candidate-find__phase-banner-conditions">
                      2차 표기 통일 선택 : {phase2DoneLabels.join(' · ')}
                    </p>
                  ) : (
                    <p className="unify-candidate-find__phase-banner-line">
                      1차 표기 통일을 완료하면 2차 표기 통일이 진행됩니다
                    </p>
                  )}
                </div>

                {unifyPhase === 'secondary_pairs' ? (
                  <div className="unify-candidate-find__secondary-pairs">
                    {secondaryGroups.length === 0 ? (
                      <p className="unify-candidate-find__empty">
                        확장할 표기 후보가 없습니다.
                      </p>
                    ) : (
                      secondaryGroups.map((group) => {
                        const seriesLabelText = formatSeriesCategoryLabelText(
                          group,
                        );
                        const seriesSpacing = resolveSeriesChosenSpacing(
                          group,
                          registeredVariants,
                          new Map(),
                        );
                        const findingsTotal = sumClusterFindings(
                          group.clusters,
                        );
                        const visibleClusters = group.clusters.filter(
                          (c) => !hiddenPdfKeys.has(c.key),
                        );
                        const findingsShown =
                          sumClusterFindings(visibleClusters);
                        const sectionId = `phase2-series-${group.affixType}-${group.affix}`;
                        const isFirst = group === secondaryGroups[0];
                        return (
                          <details
                            key={sectionId}
                            className="results-category results-category--unify-series"
                            defaultOpen={isFirst}
                          >
                            <summary className="results-category__summary panel-criteria-heading">
                              <DetailsChevron />
                              <UnifyCategorySelectAll
                                label={seriesLabelText}
                                clusters={group.clusters}
                                hiddenPdfKeys={hiddenPdfKeys}
                                onToggleAll={handleToggleCategoryPdf}
                              />
                              <span className="results-category__label">
                                {seriesLabelText}
                              </span>
                              <span className="unify-candidate-find__summary-trail">
                                <SeriesSpacingButtons
                                  spacing={seriesSpacing}
                                  hintSpacing={
                                    group.direction === 'glued' ||
                                    group.direction === 'spaced'
                                      ? group.direction
                                      : null
                                  }
                                  onSelect={(spacing) =>
                                    handleSeriesSpacingSelect(
                                      group.clusters,
                                      spacing,
                                      seriesSpacing,
                                    )
                                  }
                                />
                                <span className="unify-candidate-find__badge-slot">
                                  <UnifyFindingsCount
                                    count={findingsTotal}
                                    shownCount={findingsShown}
                                    className="results-category__findings"
                                  />
                                </span>
                              </span>
                            </summary>
                            {group.supportExplain ? (
                              <p className="unify-candidate-find__pattern-explain">
                                {group.supportExplain}
                              </p>
                            ) : null}
                            <ul className="results-list results-list--nested unify-candidate-find__list">
                              {group.clusters.map((cluster) => (
                                <ClusterCard
                                  key={cluster.key}
                                  cluster={cluster}
                                  pdfVisible={!hiddenPdfKeys.has(cluster.key)}
                                  onTogglePdfVisibility={
                                    handleTogglePdfVisibility
                                  }
                                  registeredVariant={registeredVariants.get(
                                    cluster.key,
                                  )}
                                  preSelectedVariant={undefined}
                                  groupClusters={group.clusters}
                                  onSelectVariant={handleSelectVariant}
                                  onCancelVariant={handleCancelVariant}
                                  currentPage={currentPage}
                                  selectedInstance={selectedInstance}
                                  formatPageLabel={formatPageLabel}
                                  onSelectInstance={onSelectInstance}
                                  pageTexts={pageTexts}
                                  previewGroups={publishedPreviewGroups}
                                />
                              ))}
                            </ul>
                          </details>
                        );
                      })
                    )}
                  </div>
                ) : null}

                {unifyPhase === 'primary'
                  ? grouped.map((group) => {
                  const sectionId =
                    group.type === 'series'
                      ? `series-${group.affixType}-${group.affix}`
                      : group.type === 'predicate'
                        ? 'predicate'
                        : 'single';
                  const label =
                    group.type === 'series'
                      ? group.label
                      : group.type === 'predicate'
                        ? '용언'
                        : '단일 항목';
                  const seriesSpacing =
                    group.type === 'series'
                      ? resolveSeriesChosenSpacing(
                          group,
                          registeredVariants,
                          preSelected,
                        )
                      : null;
                  const seriesLabelText =
                    group.type === 'series'
                      ? formatSeriesCategoryLabelText(group)
                      : label;
                  const findingsTotal = sumClusterFindings(group.clusters);
                  const visibleClusters = group.clusters.filter(
                    (c) => !hiddenPdfKeys.has(c.key),
                  );
                  const findingsShown = sumClusterFindings(visibleClusters);
                  const categoryMod =
                    group.type === 'series'
                      ? 'series'
                      : group.type === 'predicate'
                        ? 'predicate'
                        : 'single';

                  const renderClusterCard = (cluster) => (
                    <ClusterCard
                      key={cluster.key}
                      cluster={cluster}
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
                      pageTexts={pageTexts}
                      previewGroups={publishedPreviewGroups}
                    />
                  );

                  // 단일·용언 — 항목마다 계열과 같은 체크박스 헤더 (골드만삭스-골드만 삭스)
                  if (group.type === 'single' || group.type === 'predicate') {
                    return group.clusters.map((cluster) => {
                      const itemLabel = formatUnifySingleClusterLabel(cluster);
                      const itemFindings = cluster.totalCount || 0;
                      const itemShown = hiddenPdfKeys.has(cluster.key)
                        ? 0
                        : itemFindings;
                      const itemSpacing = resolveSeriesChosenSpacing(
                        { clusters: [cluster] },
                        registeredVariants,
                        preSelected,
                      );
                      return (
                        <details
                          key={`${sectionId}-${cluster.key}`}
                          className={`results-category results-category--unify-${categoryMod}`}
                          defaultOpen={defaultOpenId === sectionId}
                        >
                          <summary className="results-category__summary panel-criteria-heading">
                            <DetailsChevron />
                            <UnifyCategorySelectAll
                              label={itemLabel}
                              clusters={[cluster]}
                              hiddenPdfKeys={hiddenPdfKeys}
                              onToggleAll={handleToggleCategoryPdf}
                            />
                            <span className="results-category__label">
                              {itemLabel}
                            </span>
                            <span className="unify-candidate-find__summary-trail">
                              <SeriesSpacingButtons
                                spacing={itemSpacing}
                                onSelect={(spacing) =>
                                  handleSeriesSpacingSelect(
                                    [cluster],
                                    spacing,
                                    itemSpacing,
                                  )
                                }
                              />
                              <span className="unify-candidate-find__badge-slot">
                                <UnifyFindingsCount
                                  count={itemFindings}
                                  shownCount={itemShown}
                                  className="results-category__findings"
                                />
                              </span>
                            </span>
                          </summary>
                          <ul className="results-list results-list--nested unify-candidate-find__list">
                            {renderClusterCard(cluster)}
                          </ul>
                        </details>
                      );
                    });
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
                          label={seriesLabelText}
                          clusters={group.clusters}
                          hiddenPdfKeys={hiddenPdfKeys}
                          onToggleAll={handleToggleCategoryPdf}
                        />
                        <span className="results-category__label">
                          {seriesLabelText}
                        </span>
                        <span className="unify-candidate-find__summary-trail">
                          <SeriesSpacingButtons
                            spacing={seriesSpacing}
                            onSelect={(spacing) =>
                              handleSeriesSpacingSelect(
                                group.clusters,
                                spacing,
                                seriesSpacing,
                              )
                            }
                          />
                          <span className="unify-candidate-find__badge-slot">
                            <UnifyFindingsCount
                              count={findingsTotal}
                              shownCount={findingsShown}
                              className="results-category__findings"
                            />
                          </span>
                        </span>
                      </summary>
                      <ul className="results-list results-list--nested unify-candidate-find__list">
                        {group.clusters.map((cluster) =>
                          renderClusterCard(cluster),
                        )}
                      </ul>
                    </details>
                  );
                })
                  : null}
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
  pageTexts = [],
  previewGroups = [],
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
      <ul className="unify-candidate-find__variants">
        {cluster.variants.map((variant, variantIndex) => {
          const count = cluster.counts[variant] ?? 0;
          const isDerived = count === 0;
          const isChosen = registeredVariant === variant;
          const isPreSelected = !isRegistered && preSelectedVariant === variant;
          const isFirst = variantIndex === 0;
          const replace = registeredVariant || cluster.recommendedUnify;
          const previewGroup = previewGroups.find(
            (g) => g.find === variant && g.replace === replace,
          );
          const instances =
            previewGroup?.instances?.length > 0
              ? previewGroup.instances
              : instancesForUnifyVariant(cluster, variant, {
                  chosenVariant: registeredVariant ?? null,
                  pages: pageTexts,
                });

          return (
            <li
              key={variant}
              className={[
                'unify-candidate-find__variant-item',
                isFirst && 'unify-candidate-find__variant-item--first',
                isDerived && 'unify-candidate-find__variant-item--derived',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <div className="unify-candidate-find__variant-row">
                {isFirst ? (
                  <CriteriaHoverTip tip="PDF에 표시">
                    <label
                      className="result-visibility-toggle"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={pdfVisible}
                        onChange={() => onTogglePdfVisibility(cluster)}
                        aria-label={`${cluster.totalCount}회 표기 후보 PDF 표시`}
                      />
                    </label>
                  </CriteriaHoverTip>
                ) : (
                  <span
                    className="unify-candidate-find__checkbox-spacer"
                    aria-hidden
                  />
                )}
                <span className="unify-candidate-find__variant">
                  {variant}
                </span>
                <span className="unify-candidate-find__count">
                  {count}회
                </span>
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
                    isChosen || isPreSelected
                      ? onCancelVariant(cluster, groupClusters)
                      : onSelectVariant(cluster, variant, groupClusters)
                  }
                >
                  이 표기로 📌통일
                </button>
                {isException && isChosen ? (
                  <span className="unify-candidate-find__exception-badge">
                    예외
                  </span>
                ) : null}
                {isFirst &&
                cluster.josaReview?.status === 'review' &&
                cluster.auxReview?.status !== 'review' ? (
                  <CriteriaHoverTip
                    tip={
                      cluster.josaReview.peerKeys?.length
                        ? `같은 어간 추정: ${cluster.josaReview.stemKey} · 연결 ${cluster.josaReview.peerKeys.join(', ')}`
                        : undefined
                    }
                  >
                    <span className="unify-candidate-find__josa-review">
                      조사 · 어간 추정, 검토 필요
                    </span>
                  </CriteriaHoverTip>
                ) : null}
                {isFirst && cluster.auxReview?.status === 'review' ? (
                  <span className="unify-candidate-find__aux-review">
                    본용언+ 보조용언 표기로 추정, 검토 필요
                  </span>
                ) : null}
                {isFirst &&
                cluster.predicateReview?.status === 'needs_review' &&
                cluster.auxReview?.status !== 'review' ? (
                  <span className="unify-candidate-find__predicate-review">
                    용언 추정, 검토 필요
                  </span>
                ) : null}
              </div>
              {instances.length > 0 ? (
                <ResultPageSummary
                  instances={instances}
                  currentPage={currentPage}
                  selectedInstance={selectedInstance}
                  formatPageLabel={formatPageLabel}
                  isInstanceVisible={() => true}
                  collapsedVisibleLimit={3}
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
