/**
 * 표기 통일 추천 — 맞춤법 탭 외래어 표기와 같은 박스·버튼 크롬.
 * 문서 내 띄어쓰기 이형태만 (규범 검증 아님).
 * 결과 목록은 맞춤법 결과 리스트와 같은 아코디언(N항목 전체 발견).
 * 페이지 칩은 접히면 최대 3개 +「더 보기」.
 */
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import CriteriaHoverTip from '../CriteriaHoverTip.jsx';
import unifyFindPenSrc from '../../assets/momo/unify-find-pen.png';
import {
  buildUnifyCandidatePreviewGroups,
  discoverSpacingUnifyCandidatesAsync,
  enrichClustersWithItemHitsAsync,
  enrichClusterGroupsWithItemHits,
  enrichClusterGroupsWithItemHitsAsync,
  firstWrongUnifyInstance,
  instancesForUnifyVariant,
  prefetchUnifyKiwiSurfaces,
} from '../../lib/unifyCandidateDiscover.js';
import { groupSortAndFillSatellites, countUnifyListAccordionItems, sortClusterGroups } from '../../lib/unifyCandidateGrouping.js';
import { filterSeriesSatellitesByMorphPos } from '../../lib/unifyCandidateSatellites.js';
import { filterSeriesSatellitesByKiwiPhase2 } from '../../lib/unifyNoisePhase2.js';
import {
  buildPatternRulePreviewGroups,
  buildSecondaryGroupsFromCandidates,
  collectPatternRuleCandidates,
  collectPatternRulesFromRegistrations,
  formatPatternRuleConditionLabel,
  groupPatternConditionLabelsByDirection,
  isPrimaryUnifyComplete,
} from '../../lib/unifyPatternRule.js';
import { showAppAlert, showAppConfirm } from '../../lib/appDialog.js';
import { isGuestBrowseActive } from '../../lib/guestBrowsePolicy.js';
import { isUnifyPhase2PatternEnabled } from '../../lib/featureFlags.js';
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
import { createUnifyFindBench, snapshotUnifyFindDiag } from '../../lib/unifyFindBench.js';
import {
  applyStdictPosMarksToGroups,
  runStdictPosReviewOnClusterGroups,
} from '../../lib/unifyStdictPos.js';
import { buildSeriesMajoritySoftPreselect } from '../../lib/unifySeriesMajorityPreselect.js';
import {
  mergeUnifyChosenMaps,
  resolveGlobalChosenSpacing,
  resolveSeriesChosenSpacing,
  sumClusterSpacingFindings,
  variantForSpacing,
} from '../../lib/unifySeriesSpacingUi.js';
import {
  isUnifyJosaSlmReviewEnabled,
  isUnifyPredicateSlmReviewEnabled,
  isUnifyStdictPosReviewEnabled,
} from '../../lib/featureFlags.js';
import { formatSystemPageLabel } from '../../lib/printedPageDisplay.js';
import { assertBetaDailyCheckOrAlert } from '../../lib/betaDailyQuota.js';
import { confirmUnifyCandidateFindBeforeRun, alertUnifyCandidateFindAfterRun, alertUnifyCandidatePhase2AfterComplete } from '../../lib/consistencyCheckConfirm.js';
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
 *   withCheckbox?: boolean,
 *   dataWorkGuide?: string,
 *   tip?: string,
 * }} props
 */
function SeriesSpacingButtons({
  spacing,
  hintSpacing = null,
  onSelect,
  withCheckbox = false,
  dataWorkGuide,
  tip,
}) {
  const buttons = (
    <span
      className={[
        'unify-candidate-find__series-spacing-btns',
        withCheckbox && 'unify-candidate-find__series-spacing-btns--with-check',
      ]
        .filter(Boolean)
        .join(' ')}
      data-work-guide={dataWorkGuide || undefined}
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
        {withCheckbox ? (
          <span className="unify-candidate-find__series-spacing-btn-inner">
            <input
              type="checkbox"
              tabIndex={-1}
              checked={spacing === 'glued'}
              readOnly
              aria-hidden
            />
            <span>붙여쓰기</span>
          </span>
        ) : (
          '붙여쓰기'
        )}
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
        {withCheckbox ? (
          <span className="unify-candidate-find__series-spacing-btn-inner">
            <input
              type="checkbox"
              tabIndex={-1}
              checked={spacing === 'spaced'}
              readOnly
              aria-hidden
            />
            <span>띄어쓰기</span>
          </span>
        ) : (
          '띄어쓰기'
        )}
      </button>
    </span>
  );

  if (!tip) return buttons;
  return (
    <CriteriaHoverTip tip={tip} variant="wrap">
      {buttons}
    </CriteriaHoverTip>
  );
}

/** 보조용언 추정(검토 필요) — 목록엔 두되 기본은 PDF·완료 집계에서 제외 */
function isAuxReviewDeferredCluster(cluster) {
  return cluster?.auxReview?.status === 'review';
}

/**
 * 헤더·팝업·배지용 단일 집계 스냅샷.
 * 나중에 C(항상 1차)로 바꿀 때는 넘기는 groups만 1차 스냅샷으로 바꾸면 된다.
 * @param {import('../../lib/unifyCandidateGrouping.js').ClusterGroup[]} groups
 */
function summarizeUnifyListSnapshot(groups) {
  const listClusters = (groups ?? []).flatMap((g) => g.clusters ?? []);
  const countedClusters = listClusters.filter(
    (c) => !isAuxReviewDeferredCluster(c),
  );
  return {
    listClusters,
    countedClusters,
    itemCount: countUnifyListAccordionItems(groups),
    findings: countedClusters.reduce(
      (n, c) => n + (c.totalCount ?? 0),
      0,
    ),
    hiddenPdfKeys: new Set(
      listClusters.filter(isAuxReviewDeferredCluster).map((c) => c.key),
    ),
  };
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

const UNIFY_FIND_LOADING_TEXT = '표기 통일 후보를 찾고 있습니다';

/**
 * 찾기 중 — 문구를 한 글자씩 쓴 뒤 펜 아이콘 1→2→3 반복.
 */
function UnifyFindLoadingStatus() {
  const [charCount, setCharCount] = useState(0);
  const [penCount, setPenCount] = useState(0);

  useEffect(() => {
    const textLen = UNIFY_FIND_LOADING_TEXT.length;
    let chars = 0;
    let penTimer = 0;
    const typeTimer = window.setInterval(() => {
      chars += 1;
      setCharCount(chars);
      if (chars < textLen) return;
      window.clearInterval(typeTimer);
      let pens = 0;
      penTimer = window.setInterval(() => {
        pens = pens >= 3 ? 0 : pens + 1;
        setPenCount(pens);
      }, 600);
    }, 100);
    return () => {
      window.clearInterval(typeTimer);
      window.clearInterval(penTimer);
    };
  }, []);

  return (
    <div
      className="unify-candidate-find__loading"
      role="status"
      aria-live="polite"
      aria-label={UNIFY_FIND_LOADING_TEXT}
    >
      <span className="unify-candidate-find__loading-text">
        {UNIFY_FIND_LOADING_TEXT.slice(0, charCount)}
      </span>
      {penCount > 0 ? (
        <span className="unify-candidate-find__loading-pens" aria-hidden>
          {Array.from({ length: penCount }, (_, i) => (
            <img
              key={i}
              className="unify-candidate-find__loading-pen"
              src={unifyFindPenSrc}
              alt=""
              draggable={false}
            />
          ))}
        </span>
      ) : null}
    </div>
  );
}

/**
 * 계열 헤더 — 붙임·띄움 출현 횟수 (작은 금색 원).
 * 선택이 끝난 쪽 원에는 검정 테두리.
 * @param {{
 *   glued: number,
 *   spaced: number,
 *   chosenSpacing?: 'glued' | 'spaced' | null,
 * }} props
 */
function SeriesSpacingBreakdown({ glued, spaced, chosenSpacing = null }) {
  return (
    <span
      className="unify-candidate-find__spacing-breakdown"
      aria-label={`붙임 ${glued}건, 띄움 ${spaced}건`}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <span className="unify-candidate-find__spacing-breakdown-part">
        붙임{' '}
        <span
          className={[
            'result-findings-count-circle',
            'unify-candidate-find__spacing-count-circle',
            chosenSpacing === 'glued' &&
              'unify-candidate-find__spacing-count-circle--chosen',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {glued}
        </span>
      </span>
      <span className="unify-candidate-find__spacing-breakdown-part">
        띄움{' '}
        <span
          className={[
            'result-findings-count-circle',
            'unify-candidate-find__spacing-count-circle',
            chosenSpacing === 'spaced' &&
              'unify-candidate-find__spacing-count-circle--chosen',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {spaced}
        </span>
      </span>
    </span>
  );
}

/**
 * 1차 선택 조건 — 방향별로 한 줄 요약 (+더보기).
 * @param {{
 *   labels: string[],
 *   expanded: boolean,
 *   onToggleExpand: () => void,
 *   heading?: string,
 * }} props
 */
function Phase2ConditionSummary({
  labels,
  expanded,
  onToggleExpand,
  heading = '',
}) {
  const { glued, spaced } = groupPatternConditionLabelsByDirection(labels);
  if (!glued.length && !spaced.length) {
    return heading ? (
      <p className="unify-candidate-find__phase-banner-conditions">{heading}</p>
    ) : null;
  }

  if (expanded) {
    return (
      <div className="unify-candidate-find__phase-banner-conditions-block">
        {heading ? (
          <p className="unify-candidate-find__phase-banner-conditions">
            {heading}
          </p>
        ) : null}
        <p className="unify-candidate-find__phase-banner-conditions">
          {labels.join(' · ')}{' '}
          <button
            type="button"
            className="unify-candidate-find__phase-more"
            onClick={onToggleExpand}
          >
            접기
          </button>
        </p>
      </div>
    );
  }

  /**
   * @param {'붙여쓰기' | '띄어쓰기'} dirLabel
   * @param {string[]} templates
   */
  const renderLine = (dirLabel, templates) => {
    if (!templates.length) return null;
    const head = templates[0];
    const rest = templates.length - 1;
    return (
      <p
        key={dirLabel}
        className="unify-candidate-find__phase-banner-conditions"
      >
        {dirLabel} {head}
        {rest > 0 ? ` 외 ${rest} 항목` : null}
        {rest > 0 ? (
          <>
            {' '}
            <button
              type="button"
              className="unify-candidate-find__phase-more"
              onClick={onToggleExpand}
            >
              +더보기
            </button>
          </>
        ) : null}
      </p>
    );
  };

  return (
    <div className="unify-candidate-find__phase-banner-conditions-block">
      {heading ? (
        <p className="unify-candidate-find__phase-banner-conditions unify-candidate-find__phase-banner-conditions--heading">
          {heading}
        </p>
      ) : null}
      {renderLine('붙여쓰기', glued)}
      {renderLine('띄어쓰기', spaced)}
    </div>
  );
}

/**
 * @param {{
 *   hasPdf?: boolean,
 *   pageTexts?: { pageNum?: number, text?: string }[],
 *   isProcessing?: boolean,
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
 *   onPrimaryCompleteChange?: (complete: boolean) => void,
 *   formatPageLabel?: (systemPage: number) => string,
 *   guideSpotlight?: boolean,
 *   onFindButtonClick?: () => void,
 *   seriesSpacingGuideAttr?: string,
 *   onSeriesSpacingGuideSelect?: () => void,
 * }} props
 */
export default function UnifyCandidateFindPanel({
  hasPdf = false,
  pageTexts = [],
  isProcessing = false,
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
  onPrimaryCompleteChange,
  formatPageLabel = formatSystemPageLabel,
  guideSpotlight = false,
  onFindButtonClick,
  seriesSpacingGuideAttr,
  onSeriesSpacingGuideSelect,
}) {
  const [finding, setFinding] = useState(false);
  const [slmReviewing, setSlmReviewing] = useState(false);
  /** confirm·Firestore 대기 중에도 중복 클릭 방지 (finding UI와 분리) */
  const findInFlightRef = useRef(false);

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
  /** 2차 추천·발견 요약 (진행 중·완료 후 헤더용) */
  const [phase2ResultSummary, setPhase2ResultSummary] = useState(
    /** @type {{ itemCount: number, findings: number } | null} */ (null),
  );
  const [phase2ConditionsExpanded, setPhase2ConditionsExpanded] =
    useState(false);
  const secondaryClusters = useMemo(
    () => secondaryGroups.flatMap((g) => g.clusters),
    [secondaryGroups],
  );
  const phase2PromptedRef = useRef(false);
  const phase2CompletePromptedRef = useRef(false);
  /** handleFind → 다음 listMemo enrich 1회 계측 */
  const findBenchRef = useRef(
    /** @type {ReturnType<typeof createUnifyFindBench> | null} */ (null),
  );
  /** PDF 하이라이트에서 뺀 클러스터 key (기본은 표시=체크) */
  const [hiddenPdfKeys, setHiddenPdfKeys] = useState(
    /** @type {Set<string>} */ (new Set()),
  );
  /**
   * 찾기 직후 이미 만든 목록 그룹 — useMemo가 group+enrich를 다시 돌리지 않게.
   * 새 찾기 시작 시 null.
   */
  const [findListGroups, setFindListGroups] = useState(
    /** @type {import('../../lib/unifyCandidateGrouping.js').ClusterGroup[] | null} */ (
      null
    ),
  );
  /** NOISE_FILTER ON인데 Kiwi 미ready — 형태소 필터 미적용 배지 */
  const [morphFilterInactive, setMorphFilterInactive] = useState(false);
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
    if (isProcessing) {
      alert('PDF 텍스트 추출이 끝날 때까지 기다려 주세요.');
      return;
    }
    if (checkQuotaBlocked) {
      alert('지금은 검수를 진행할 수 없습니다. 로그인·검수권을 확인해 주세요.');
      return;
    }
    if (finding || slmReviewing || findInFlightRef.current) return;
    findInFlightRef.current = true;
    try {
      // confirm·검수권 조회 전에는 ··· 표시하지 않음 (Firestore 지연·대화상자 대기가 무한 로딩처럼 보임)
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
      setFinding(true);
      await new Promise((r) => setTimeout(r, 0));
      setMorphFilterInactive(false);
      setFindListGroups(null);
      const kiwiDiagBefore = await snapshotUnifyFindDiag();
      const bench = createUnifyFindBench({
        pages: pageTexts.length,
        slmJosa: isUnifyJosaSlmReviewEnabled(),
        slmPred: isUnifyPredicateSlmReviewEnabled(),
        stdict: isUnifyStdictPosReviewEnabled(),
        ...kiwiDiagBefore,
      });
      findBenchRef.current = bench;
      // 페이지마다 양보 — 동기 discover/enrich 전량 실행은 '응답 없음'을 유발함
      const result = await discoverSpacingUnifyCandidatesAsync(pageTexts, {
        includeRaw: true,
      });
      bench.mark('1_discover');
      const kiwiDiagAfterDiscover = await snapshotUnifyFindDiag();
      // item 근거 없는 유령 출현(지도 글리프→붙임) 제거 후 목록·칩 동기화
      const next = await enrichClustersWithItemHitsAsync(
        result.clusters ?? [],
        pageTexts,
      );
      bench.mark('2_enrichClusters');
      const kiwiDiagAfterEnrich1 = await snapshotUnifyFindDiag();
      let workingGroups = groupSortAndFillSatellites(next, result.rawByKey);
      const ruleStrip = stripDependentNounGenitiveFromGroups(workingGroups);
      workingGroups = ruleStrip.groups;
      const ruleExcluded = ruleStrip.dropped;
      bench.mark('3_groupStrip');
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
      bench.mark('4_review_slm_stdict');

      const triage = collectUnifyListTriage(workingGroups);

      // 목록(grouped)과 동일: item 근거로 재집계 후 횟수·팝업 집계
      workingGroups = await enrichClusterGroupsWithItemHitsAsync(
        workingGroups,
        pageTexts,
      );
      // enrich가 conflict→single-form으로 바꾼 뒤 동종 복합 재검증
      workingGroups = filterSeriesSatellitesByMorphPos(workingGroups);
      // 위성 제거·item 재집계로 횟수가 바뀌므로 발견 횟수 순 재정렬
      workingGroups = sortClusterGroups(workingGroups);
      bench.mark('5_enrichGroups_sort');

      // 목록을 먼저 보여 준 뒤, Kiwi가 이미 ready일 때만 2차(후보·양보)
      // 팝업·헤더·배지 숫자는 2차 반영 후 최종 스냅샷 하나로만 센다 (A).
      const prePhase2Snap = summarizeUnifyListSnapshot(workingGroups);
      setFindListGroups(workingGroups);
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
      // soft = preSelected만 (발견 수는 확정 등록 후에만 「남은 발견」으로 줄어듦)
      const softEarly = buildSeriesMajoritySoftPreselect(workingGroups);
      setRegisteredVariants(new Map());
      setPreSelected(softEarly);
      setUnifyPhase('primary');
      setSecondaryGroups([]);
      setPhase2ConditionLabels([]);
      setPhase2DoneLabels([]);
      setPhase2ResultSummary(null);
      setPhase2ConditionsExpanded(false);
      phase2PromptedRef.current = false;
      phase2CompletePromptedRef.current = false;
      setHiddenPdfKeys(prePhase2Snap.hiddenPdfKeys);
      publishPreview(
        next,
        result.rawByKey,
        prePhase2Snap.hiddenPdfKeys,
        slmByKey,
        dropSeriesIds,
        dropClusterKeys,
        needsReviewByKey,
        softEarly,
        prePhase2Snap.listClusters,
      );
      bench.mark('6_publishPreview_override');
      setFinding(false);
      let phase2Applied = false;
      try {
        const phase2 = await filterSeriesSatellitesByKiwiPhase2(workingGroups);
        phase2Applied = phase2.applied;
        if (phase2.applied && phase2.dropped > 0) {
          workingGroups = sortClusterGroups(phase2.groups);
        }
      } catch {
        phase2Applied = false;
      }

      const snap = summarizeUnifyListSnapshot(workingGroups);
      // 계열만 soft 미리 찍기 → preSelected만 (registered 아님)
      const softPre = buildSeriesMajoritySoftPreselect(workingGroups);
      setFindListGroups(workingGroups);
      setHiddenPdfKeys(snap.hiddenPdfKeys);
      setRegisteredVariants(new Map());
      setPreSelected(softPre);
      publishPreview(
        next,
        result.rawByKey,
        snap.hiddenPdfKeys,
        slmByKey,
        dropSeriesIds,
        dropClusterKeys,
        needsReviewByKey,
        softPre,
        snap.listClusters,
      );

      const kiwiDiagDone = await snapshotUnifyFindDiag();
      // 2차 미적용(Kiwi 미ready·OFF)일 때만 배지
      const morphInactive =
        Boolean(kiwiDiagDone.noiseFilterEnabled) && !phase2Applied;
      setMorphFilterInactive(morphInactive);
      if (morphInactive && import.meta.env.DEV) {
        console.warn(
          '[unify-kiwi-noise] 1차 리스트만 — Kiwi 2차 미적용 (ready 아님·boot 안 함)',
        );
      }
      const zeroOccClusters = snap.listClusters.filter(
        (c) => (c.totalCount ?? 0) === 0,
      ).length;
      bench.done({
        clusters: next.length,
        listClusters: snap.listClusters.length,
        countedClusters: snap.countedClusters.length,
        listItemCount: snap.itemCount,
        occTotal: snap.findings,
        zeroOccClusters,
        kiwiBefore: kiwiDiagBefore,
        kiwiAfterDiscover: kiwiDiagAfterDiscover,
        kiwiAfterEnrich1: kiwiDiagAfterEnrich1,
        kiwiDone: kiwiDiagDone,
        morphFilterActive: phase2Applied,
        morphFilterInactive: morphInactive,
        note: '1차=정적 리스트 · 2차=ready일 때만 후보 Kiwi · 집계=최종 스냅샷',
      });
      await alertUnifyCandidateFindAfterRun(snap.countedClusters, {
        uid: authUid,
        email: authEmail,
        itemCount: snap.itemCount,
        morphFilterInactive: morphInactive,
      });
    } finally {
      setFinding(false);
      findInFlightRef.current = false;
    }
  }

  function handleTogglePdfVisibility(cluster) {
    const next = new Set(hiddenPdfKeys);
    if (next.has(cluster.key)) next.delete(cluster.key);
    else next.add(cluster.key);
    setHiddenPdfKeys(next);
    const override = findListGroups?.flatMap((g) => g.clusters) ?? null;
    publishPreview(
      clusters,
      rawByKey,
      next,
      slmReviewedByKey,
      predicateDropSeriesIds,
      predicateDropClusterKeys,
      predicateNeedsReviewByKey,
      effectiveChosen,
      override,
    );
  }

  /**
   * @param {UnifySpacingCluster[]} groupClusters
   * @param {boolean} nextVisible
   */
  function handleToggleCategoryPdf(groupClusters, nextVisible) {
    const next = new Set(hiddenPdfKeys);
    for (const c of groupClusters) {
      if (nextVisible) next.delete(c.key);
      else next.add(c.key);
    }
    setHiddenPdfKeys(next);
    const override = findListGroups?.flatMap((g) => g.clusters) ?? null;
    publishPreview(
      clusters,
      rawByKey,
      next,
      slmReviewedByKey,
      predicateDropSeriesIds,
      predicateDropClusterKeys,
      predicateNeedsReviewByKey,
      effectiveChosen,
      override,
    );
  }

  const grouped = useMemo(() => {
    if (findListGroups) return findListGroups;
    if (!rawByKey) return [];
    const t0 = performance.now();
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
    // enrich 후 single-form으로 바뀐 항목에 morph 재적용 → 횟수 반영해 재정렬
    const out = sortClusterGroups(
      filterSeriesSatellitesByMorphPos(
        enrichClusterGroupsWithItemHits(afterPredicate, pageTexts),
      ),
    );
    findBenchRef.current?.maybeLogListMemo(performance.now() - t0);
    return out;
  }, [
    findListGroups,
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

  /** soft + 확정 병합 — PDF·2차·완료 판정 공통 */
  const effectiveChosen = useMemo(
    () => mergeUnifyChosenMaps(registeredVariants, preSelected),
    [registeredVariants, preSelected],
  );

  const busy = finding || slmReviewing || isProcessing;

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
  const primaryUnifyComplete = useMemo(
    () =>
      searched &&
      listClusters.length > 0 &&
      isPrimaryUnifyComplete(grouped, registeredVariants, preSelected),
    [searched, listClusters.length, grouped, registeredVariants, preSelected],
  );

  useEffect(() => {
    onPrimaryCompleteChange?.(primaryUnifyComplete);
  }, [primaryUnifyComplete, onPrimaryCompleteChange]);

  useEffect(
    () => () => {
      onPrimaryCompleteChange?.(false);
    },
    [onPrimaryCompleteChange],
  );

  const phase2LiveItemCount = useMemo(
    () => countUnifyListAccordionItems(secondaryGroups),
    [secondaryGroups],
  );
  const phase2LiveFindings = useMemo(
    () => sumClusterFindings(secondaryClusters),
    [secondaryClusters],
  );
  const phase2HeaderItemCount =
    unifyPhase === 'secondary_pairs'
      ? phase2LiveItemCount
      : (phase2ResultSummary?.itemCount ?? 0);
  const phase2HeaderFindings =
    unifyPhase === 'secondary_pairs'
      ? phase2LiveFindings
      : (phase2ResultSummary?.findings ?? 0);
  const phase2PatternEnabled = isUnifyPhase2PatternEnabled();
  const showPhase2Header =
    phase2PatternEnabled &&
    (unifyPhase === 'secondary_pairs' || phase2ResultSummary != null);

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
      const previewChosen = mergeUnifyChosenMaps(nextRegistered, preSelected);

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
              previewChosen,
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
              previewChosen,
              findListGroups?.flatMap((g) => g.clusters) ?? listClusters,
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
      preSelected,
      unifyPhase,
      secondaryClusters,
      pageTexts,
      findListGroups,
      listClusters,
    ],
  );

  /** 2차 — 패턴 후보(증거·score)를 모아 계열 목록 + 패턴 Preview로 진입 */
  const enterPhase2 = useCallback(() => {
    if (!isUnifyPhase2PatternEnabled()) return;
    const chosen = mergeUnifyChosenMaps(registeredVariants, preSelected);
    const rules = collectPatternRulesFromRegistrations(chosen, clusters);
    const labels = rules
      .map((r) => formatPatternRuleConditionLabel(r))
      .filter(Boolean);
    setPhase2ConditionLabels(labels);

    const candidates = collectPatternRuleCandidates(chosen, clusters, pageTexts);
    const ids = candidates.map((c) => c.id);
    const nextGroups = buildSecondaryGroupsFromCandidates(candidates, ids);
    const nextClusters = nextGroups.flatMap((g) => g.clusters);
    setSecondaryGroups(nextGroups);
    setPhase2DoneLabels([]);
    setPhase2ConditionsExpanded(false);
    setPhase2ResultSummary({
      itemCount: countUnifyListAccordionItems(nextGroups),
      findings: sumClusterFindings(nextClusters),
    });
    // 2차도 PDF 표시 기본 체크 (숨김 없음)
    setHiddenPdfKeys(new Set());
    setUnifyPhase('secondary_pairs');
    phase2CompletePromptedRef.current = false;

    const previewMismatches = candidates.flatMap((c) => c.mismatches ?? []);
    if (onPreviewGroupsChange && previewMismatches.length) {
      onPreviewGroupsChange(buildPatternRulePreviewGroups(previewMismatches));
    } else {
      publishPreview(
        clusters,
        rawByKey,
        new Set(),
        slmReviewedByKey,
        predicateDropSeriesIds,
        predicateDropClusterKeys,
        predicateNeedsReviewByKey,
        chosen,
        nextClusters,
      );
    }
  }, [
    registeredVariants,
    preSelected,
    clusters,
    pageTexts,
    publishPreview,
    rawByKey,
    slmReviewedByKey,
    predicateDropSeriesIds,
    predicateDropClusterKeys,
    predicateNeedsReviewByKey,
    onPreviewGroupsChange,
  ]);

  const finishSecondary = useCallback(async () => {
    const countedClusters = [...secondaryClusters];
    const itemCount =
      countUnifyListAccordionItems(secondaryGroups) || countedClusters.length;
    const doneLabels = [];
    for (const group of secondaryGroups) {
      const direction = resolveSeriesChosenSpacing(
        group,
        registeredVariants,
        preSelected,
      );
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
    setPhase2ConditionsExpanded(false);
    publishPreview(
      clusters,
      rawByKey,
      hiddenPdfKeys,
      slmReviewedByKey,
      predicateDropSeriesIds,
      predicateDropClusterKeys,
      predicateNeedsReviewByKey,
      mergeUnifyChosenMaps(registeredVariants, preSelected),
      findListGroups?.flatMap((g) => g.clusters) ?? null,
    );
    if (countedClusters.length > 0 || itemCount > 0) {
      await alertUnifyCandidatePhase2AfterComplete({
        itemCount: itemCount > 0 ? itemCount : countedClusters.length,
        clusters: countedClusters,
      });
    }
  }, [
    secondaryGroups,
    secondaryClusters,
    clusters,
    rawByKey,
    hiddenPdfKeys,
    slmReviewedByKey,
    predicateDropSeriesIds,
    predicateDropClusterKeys,
    predicateNeedsReviewByKey,
    registeredVariants,
    preSelected,
    publishPreview,
    findListGroups,
  ]);

  useEffect(() => {
    if (unifyPhase !== 'primary') return;
    if (!searched || phase2PromptedRef.current) return;
    if (!isPrimaryUnifyComplete(grouped, registeredVariants, preSelected)) return;
    phase2PromptedRef.current = true;
    // 미리 둘러보기 — 완료/2차 팝업 생략
    if (isGuestBrowseActive()) return;
    void (async () => {
      // 배포·브라우저: 2차 대신 1차 종료 안내
      if (!isUnifyPhase2PatternEnabled()) {
        await showAppAlert({
          title: '표기 통일 추천',
          message:
            '표기 통일 추천이 종료되었습니다.\n검수 결과 다운로드로 받을 수 있습니다.',
        });
        return;
      }
      const ok = await showAppConfirm({
        title: '표기 통일 추천(2차)',
        message:
          '1차 표기 통일의 내용을 적용하여\n2차 표기 통일을 진행합니다',
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
    preSelected,
    enterPhase2,
  ]);

  useEffect(() => {
    if (!isUnifyPhase2PatternEnabled()) return;
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
        title: '표기 통일 추천(2차)',
        message: '2차 표기 통일을 완료하시겠습니까?',
        confirmLabel: '예',
        cancelLabel: '아니오',
      });
      if (ok) await finishSecondary();
      else phase2CompletePromptedRef.current = false;
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
        unifyPhase === 'secondary_pairs'
          ? secondaryClusters
          : (findListGroups?.flatMap((g) => g.clusters) ?? listClusters);

      if (currentSpacing === spacing) {
        const next = new Map(registeredVariants);
        for (const gc of groupClusters) next.delete(gc.key);
        const nextPre = new Map(preSelected);
        for (const gc of groupClusters) nextPre.delete(gc.key);
        setRegisteredVariants(next);
        setPreSelected(nextPre);
        publishPreview(
          clusters,
          rawByKey,
          hiddenPdfKeys,
          slmReviewedByKey,
          predicateDropSeriesIds,
          predicateDropClusterKeys,
          predicateNeedsReviewByKey,
          mergeUnifyChosenMaps(next, nextPre),
          previewOverride,
        );
        return;
      }

      const next = new Map(registeredVariants);
      const nextPre = new Map(preSelected);
      for (const gc of groupClusters) {
        const v = variantForSpacing(gc, spacing);
        if (v) {
          next.set(gc.key, v);
          nextPre.set(gc.key, v);
        }
      }
      setRegisteredVariants(next);
      setPreSelected(nextPre);
      publishPreview(
        clusters,
        rawByKey,
        hiddenPdfKeys,
        slmReviewedByKey,
        predicateDropSeriesIds,
        predicateDropClusterKeys,
        predicateNeedsReviewByKey,
        mergeUnifyChosenMaps(next, nextPre),
        previewOverride,
      );
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
      onSeriesSpacingGuideSelect?.();
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
      onSeriesSpacingGuideSelect,
      unifyPhase,
      secondaryClusters,
      findListGroups,
      listClusters,
      pageTexts,
      registeredVariants,
      preSelected,
    ],
  );

  /** 1차 목록 전체 — soft 미리찍기 제외, 확정 등록만 반영 */
  const globalListSpacing = useMemo(
    () =>
      resolveGlobalChosenSpacing(listClusters, registeredVariants, new Map()),
    [listClusters, registeredVariants],
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

    const nextReg = new Map(registeredVariants);
    nextReg.delete(cluster.key);
    const anyRegisteredLeft = siblings.some((gc) => nextReg.has(gc.key));

    const nextPre = new Map(preSelected);
    nextPre.delete(cluster.key);
    if (!anyRegisteredLeft) {
      for (const gc of siblings) nextPre.delete(gc.key);
    }
    setRegisteredVariants(nextReg);
    setPreSelected(nextPre);

    publishPreview(
      clusters,
      rawByKey,
      hiddenPdfKeys,
      slmReviewedByKey,
      predicateDropSeriesIds,
      predicateDropClusterKeys,
      predicateNeedsReviewByKey,
      mergeUnifyChosenMaps(nextReg, nextPre),
      unifyPhase === 'secondary_pairs'
        ? secondaryClusters
        : (findListGroups?.flatMap((g) => g.clusters) ?? null),
    );
  }

  return (
    <div
      className={[
        'loanword-converter unify-candidate-find',
        guideSpotlight ? 'work-guide-spotlight' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
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
            표기 통일이 필요한 단어를 자동으로 찾아 제안합니다
            <br />
            <ConsistencyHintExample>
              <span className="consistency-hint-batang">
                경제˅학자(띄어쓰기), 경제학자(붙여쓰기)
              </span>
              {' → '}
              📌표기 통일 제안
            </ConsistencyHintExample>
          </p>
          <button
            type="button"
            className="consistency-register-add-btn consistency-register-add-btn--label unify-candidate-find__submit"
            data-work-guide="unify-find"
            onClick={() => {
              onFindButtonClick?.();
              void handleFind();
            }}
            disabled={busy || checkQuotaBlocked}
            aria-busy={busy}
          >
            {busy ? '·\u2009·\u2009·' : '찾기'}
          </button>
        </div>
        {finding ? <UnifyFindLoadingStatus /> : null}
      </div>

      {searched && !finding ? (
        <div
          className="unify-candidate-find__results"
          role="region"
          aria-label="1차 표기 통일"
        >
          {clusters.length === 0 ? (
            <p className="unify-candidate-find__empty">
              띄어쓰기만 다른 표기 후보를 찾지 못했습니다.
            </p>
          ) : (
            <section className="results-panel results-panel--consistency results-panel--unify-candidate">
              <div className="results-header results-header--total-only">
                <div className="unify-candidate-find__findings-stack">
                  <div className="unify-candidate-find__findings-row">
                    <span className="results-header__total-findings results-findings-meta">
                      <span className="results-findings-meta__label">
                        1차 표기 통일 : 추천 이형태쌍 {listItemCount} 전체 발견
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
                  {showPhase2Header ? (
                    <div className="unify-candidate-find__findings-row">
                      <span className="results-header__total-findings results-findings-meta">
                        <span className="results-findings-meta__label">
                          2차 표기 통일 : 추천 이형태쌍 {phase2HeaderItemCount}{' '}
                          전체 발견
                        </span>
                        <span className="unify-candidate-find__badge-slot">
                          <UnifyFindingsCount
                            count={phase2HeaderFindings}
                            shownCount={phase2HeaderFindings}
                            className="results-header__total-count"
                          />
                        </span>
                      </span>
                    </div>
                  ) : null}
                </div>
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
                      <Phase2ConditionSummary
                        labels={phase2ConditionLabels}
                        expanded={phase2ConditionsExpanded}
                        onToggleExpand={() =>
                          setPhase2ConditionsExpanded((v) => !v)
                        }
                      />
                    </>
                  ) : phase2DoneLabels.length > 0 ? (
                    <Phase2ConditionSummary
                      labels={phase2DoneLabels}
                      expanded={phase2ConditionsExpanded}
                      onToggleExpand={() =>
                        setPhase2ConditionsExpanded((v) => !v)
                      }
                      heading="2차 표기 통일 선택"
                    />
                  ) : (
                    <div className="unify-candidate-find__phase-banner-line-row">
                      <p className="unify-candidate-find__phase-banner-line">
                        띄어쓰기 이형태를 기준으로 제안한 표기 통일입니다
                      </p>
                      {listClusters.length > 0 ? (
                        <SeriesSpacingButtons
                          withCheckbox
                          tip="전체 단어 붙여쓰기/띄어쓰기 선택"
                          spacing={globalListSpacing}
                          onSelect={(spacing) =>
                            handleSeriesSpacingSelect(
                              listClusters,
                              spacing,
                              globalListSpacing,
                            )
                          }
                        />
                      ) : null}
                    </div>
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
                        const spacingFindings = sumClusterSpacingFindings(
                          group.clusters,
                          {
                            registeredVariants,
                            hiddenPdfKeys,
                            seriesSpacing,
                          },
                        );
                        const sectionId = `phase2-series-${group.affixType}-${group.affix}`;
                        return (
                          <details
                            key={sectionId}
                            className="results-category results-category--unify-series"
                          >
                            <summary className="results-category__summary panel-criteria-heading">
                              <CriteriaHoverTip tip="이형태쌍 리스트 보기">
                                <DetailsChevron />
                              </CriteriaHoverTip>
                              <UnifyCategorySelectAll
                                label={seriesLabelText}
                                clusters={group.clusters}
                                hiddenPdfKeys={hiddenPdfKeys}
                                onToggleAll={handleToggleCategoryPdf}
                              />
                              <CriteriaHoverTip tip="이형태쌍 리스트 보기">
                                <span className="results-category__label">
                                  {seriesLabelText}
                                </span>
                              </CriteriaHoverTip>
                              <SeriesSpacingBreakdown
                                glued={spacingFindings.glued}
                                spaced={spacingFindings.spaced}
                                chosenSpacing={seriesSpacing}
                              />
                              <span className="unify-candidate-find__summary-trail">
                                <SeriesSpacingButtons
                                  spacing={seriesSpacing}
                                  tip="단어별 붙여쓰기/띄어쓰기 선택"
                                  hintSpacing={
                                    group.direction === 'glued' ||
                                    group.direction === 'spaced'
                                      ? group.direction
                                      : null
                                  }
                                  dataWorkGuide={seriesSpacingGuideAttr}
                                  onSelect={(spacing) =>
                                    handleSeriesSpacingSelect(
                                      group.clusters,
                                      spacing,
                                      seriesSpacing,
                                    )
                                  }
                                />
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
                      const itemSpacingFindings = sumClusterSpacingFindings(
                        [cluster],
                        {
                          registeredVariants,
                          hiddenPdfKeys,
                        },
                      );
                      const itemSpacing = resolveSeriesChosenSpacing(
                        { clusters: [cluster] },
                        registeredVariants,
                        preSelected,
                      );
                      return (
                        <details
                          key={`${sectionId}-${cluster.key}`}
                          className={`results-category results-category--unify-${categoryMod}`}
                        >
                          <summary className="results-category__summary panel-criteria-heading">
                            <CriteriaHoverTip tip="이형태쌍 리스트 보기">
                              <DetailsChevron />
                            </CriteriaHoverTip>
                            <UnifyCategorySelectAll
                              label={itemLabel}
                              clusters={[cluster]}
                              hiddenPdfKeys={hiddenPdfKeys}
                              onToggleAll={handleToggleCategoryPdf}
                            />
                            <CriteriaHoverTip tip="이형태쌍 리스트 보기">
                              <span className="results-category__label">
                                {itemLabel}
                              </span>
                            </CriteriaHoverTip>
                            <SeriesSpacingBreakdown
                              glued={itemSpacingFindings.glued}
                              spaced={itemSpacingFindings.spaced}
                              chosenSpacing={itemSpacing}
                            />
                            <span className="unify-candidate-find__summary-trail">
                              <SeriesSpacingButtons
                                spacing={itemSpacing}
                                tip="단어별 붙여쓰기/띄어쓰기 선택"
                                dataWorkGuide={seriesSpacingGuideAttr}
                                onSelect={(spacing) =>
                                  handleSeriesSpacingSelect(
                                    [cluster],
                                    spacing,
                                    itemSpacing,
                                  )
                                }
                              />
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
                    >
                      <summary className="results-category__summary panel-criteria-heading">
                        <CriteriaHoverTip tip="이형태쌍 리스트 보기">
                          <DetailsChevron />
                        </CriteriaHoverTip>
                        <UnifyCategorySelectAll
                          label={seriesLabelText}
                          clusters={group.clusters}
                          hiddenPdfKeys={hiddenPdfKeys}
                          onToggleAll={handleToggleCategoryPdf}
                        />
                        <CriteriaHoverTip tip="이형태쌍 리스트 보기">
                          <span className="results-category__label">
                            {seriesLabelText}
                          </span>
                        </CriteriaHoverTip>
                        <SeriesSpacingBreakdown
                          {...sumClusterSpacingFindings(group.clusters, {
                            registeredVariants,
                            hiddenPdfKeys,
                            seriesSpacing,
                          })}
                          chosenSpacing={seriesSpacing}
                        />
                        <span className="unify-candidate-find__summary-trail">
                          <SeriesSpacingButtons
                            spacing={seriesSpacing}
                            tip="단어별 붙여쓰기/띄어쓰기 선택"
                            dataWorkGuide={seriesSpacingGuideAttr}
                            onSelect={(spacing) =>
                              handleSeriesSpacingSelect(
                                group.clusters,
                                spacing,
                                seriesSpacing,
                              )
                            }
                          />
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
                <CriteriaHoverTip tip="단어별 붙여쓰기/띄어쓰기 선택">
                  <button
                    type="button"
                    className={[
                      'unify-candidate-find__unify-btn',
                      isChosen && 'unify-candidate-find__unify-btn--chosen',
                      isPreSelected &&
                        'unify-candidate-find__unify-btn--preselect',
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
                </CriteriaHoverTip>
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
