/**
 * 표기 통일 추천 — 맞춤법 탭 외래어 표기와 같은 박스·버튼 크롬.
 * 문서 내 띄어쓰기 이형태만 (규범 검증 아님).
 * 결과 목록은 맞춤법 결과 리스트와 같은 아코디언(N항목 전체 발견).
 * 페이지 칩은 접히면 최대 3개 +「더 보기」.
 */
import { useState, useCallback, useMemo, useEffect, useRef, Fragment, startTransition } from 'react';
import CriteriaHoverTip from '../CriteriaHoverTip.jsx';
import unifyFindPenSrc from '../../assets/momo/unify-find-pen.png';
import {
  discoverSpacingUnifyCandidatesAsync,
  enrichClustersWithItemHitsAsync,
  firstWrongUnifyInstance,
  prefetchUnifyKiwiSurfaces,
} from '../../lib/unifyCandidateDiscover.js';
import {
  countUnifyListAccordionItems,
} from '../../lib/unifyCandidateGrouping.js';
import { filterSeriesSatellitesByNoiseList } from '../../lib/unifyCandidateSatellites.js';
import {
  assembleUnifyListBase,
  buildUnifyListGroups,
  finalizeUnifyListGroupsAsync,
} from '../../lib/unifyFindListPipeline.js';
import {
  buildSecondaryGroupsFromCandidates,
  collectPatternRuleCandidates,
  collectPrimaryFormsForPatternGroup,
  formatPatternRuleConditionLabel,
  formatPhase2CompliantAppliedLabel,
  formatPhase2InProgressBannerModel,
  formatPhase2SeriesCriterionModel,
  groupPatternConditionLabelsByDirection,
  isPrimaryUnifyComplete,
  PHASE2_COMPLIANT_FORMS_PREVIEW,
} from '../../lib/unifyPatternRule.js';
import { showAppAlert } from '../../lib/appDialog.js';
import { isGuestBrowseActive, guestBrowseAllowsUnifyPhase2Local } from '../../lib/guestBrowsePolicy.js';
import { isUnifyPhase2PatternEnabled } from '../../lib/featureFlags.js';
import { dropJosaPlusPredicateFromGroups } from '../../lib/unifyPredicateBucket.js';
import {
  mergeReviewedClustersIntoGroups,
  runJosaSlmReviewOnClusterGroups,
} from '../../lib/unifyJosaReviewSlm/index.js';
import { runPredicateSlmReviewOnClusterGroups } from '../../lib/unifyPredicateReviewSlm/index.js';
import { collectUnifyListTriage } from '../../lib/unifyListStemTriage.js';
import { createUnifyFindBench, snapshotUnifyFindDiag } from '../../lib/unifyFindBench.js';
import { runStdictPosReviewOnClusterGroups } from '../../lib/unifyStdictPos.js';
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
import { filterGroupsByDocSuffixOrphan } from '../../lib/unifyNoiseDocSuffixOrphan.js';
import ConsistencyHintExample from './ConsistencyHintExample.jsx';
import OrthoSpikeDevPanel from './OrthoSpikeDevPanel.jsx';
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
 * PDF 선택·쪽 이동 — defer는 selectInstance(deferPage) 한 층만.
 * @param {(inst: import('../../lib/ruleEngine.js').MatchInstance) => void} [onSelectInstance]
 * @param {import('../../lib/ruleEngine.js').MatchInstance | null | undefined} inst
 */
function jumpUnifyPdf(onSelectInstance, inst) {
  if (!onSelectInstance || !inst) return;
  onSelectInstance(inst);
}

/**
 * 목록 페인트 후 preview/jump/alert 직렬화용.
 * @returns {Promise<void>}
 */
function afterPaint() {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => resolve());
      });
      return;
    }
    setTimeout(resolve, 0);
  });
}

/**
 * 목록 첫 체크(첫 카드)의 첫 쪽 칩 — 찾기 직후 PDF 포커스용.
 * @param {import('../../lib/unifyCandidateGrouping.js').ClusterGroup[] | null | undefined} groups
 * @param {Map<string, string>} chosenByKey
 * @param {Set<string>} [hiddenKeys]
 * @returns {import('../../lib/ruleEngine.js').MatchInstance | null}
 */
function firstUnifyListChipInstance(groups, chosenByKey, hiddenKeys) {
  for (const group of groups ?? []) {
    for (const cluster of group.clusters ?? []) {
      if (hiddenKeys?.has(cluster.key)) continue;
      if ((cluster.totalCount ?? 0) <= 0) continue;
      const chosen =
        chosenByKey?.get(cluster.key) || cluster.recommendedUnify;
      for (const variant of cluster.variants ?? []) {
        const occs = resolveUnifyVariantOccurrences(cluster, variant);
        if (!occs.length) continue;
        const occ = occs[0];
        return {
          find: variant,
          replace: chosen,
          matchedText: occ.matchedText,
          suggestedText: chosen,
          pageNum: occ.pageNum,
          index: occ.index,
          ...(Array.isArray(occ.itemIndexes) && occ.itemIndexes.length
            ? { itemIndexes: occ.itemIndexes }
            : {}),
          ...(typeof occ.x === 'number' ? { x: occ.x } : {}),
          ...(typeof occ.y === 'number' ? { y: occ.y } : {}),
          ...(typeof occ.column === 'number' ? { column: occ.column } : {}),
        };
      }
      // variants 키가 비어도 출현만 있으면 첫 칸으로
      const pooled = resolveUnifyVariantOccurrences(cluster, '');
      if (pooled.length) {
        const occ = pooled[0];
        const variant =
          cluster.variants?.[0] ||
          String(occ.matchedText || cluster.key || '');
        return {
          find: variant,
          replace: chosen,
          matchedText: occ.matchedText,
          suggestedText: chosen,
          pageNum: occ.pageNum,
          index: occ.index,
          ...(Array.isArray(occ.itemIndexes) && occ.itemIndexes.length
            ? { itemIndexes: occ.itemIndexes }
            : {}),
          ...(typeof occ.x === 'number' ? { x: occ.x } : {}),
          ...(typeof occ.y === 'number' ? { y: occ.y } : {}),
          ...(typeof occ.column === 'number' ? { column: occ.column } : {}),
        };
      }
    }
  }
  return null;
}

/**
 * 쪽 칩용 출현 — 표기 키에 없으면 클러스터 전체에서 모은다.
 * (이형태 없음·키 불일치·derived 0회 칸도 칩이 뜨게)
 * @param {import('../../lib/unifyCandidateDiscover.js').UnifySpacingCluster | null | undefined} cluster
 * @param {string} variant
 * @returns {import('../../lib/unifyCandidateDiscover.js').UnifyVariantOccurrence[]}
 */
function resolveUnifyVariantOccurrences(cluster, variant) {
  const byVar = cluster?.occurrencesByVariant ?? {};
  const direct = variant ? byVar[variant] : null;
  if (Array.isArray(direct) && direct.length) return direct;
  /** @type {import('../../lib/unifyCandidateDiscover.js').UnifyVariantOccurrence[]} */
  const pooled = [];
  const seen = new Set();
  for (const list of Object.values(byVar)) {
    if (!Array.isArray(list)) continue;
    for (const occ of list) {
      if (!occ) continue;
      const sig = `${occ.pageNum ?? ''}:${occ.index ?? ''}:${occ.matchedText ?? ''}`;
      if (seen.has(sig)) continue;
      seen.add(sig);
      pooled.push(occ);
    }
  }
  return pooled;
}

/**
 * 아코디언 펼침 시 카드를 나눠 마운트 — 첫 박스 열기 동결 완화.
 * @param {{
 *   clusters: import('../../lib/unifyCandidateDiscover.js').UnifySpacingCluster[],
 *   renderClusterCard: (cluster: import('../../lib/unifyCandidateDiscover.js').UnifySpacingCluster) => import('react').ReactNode,
 *   initialCount?: number,
 *   step?: number,
 * }} props
 */
function ProgressiveClusterCards({
  clusters,
  renderClusterCard,
  initialCount = 8,
  step = 6,
  /** false면 initialCount까지만 (프리웜). true면 나머지 idle 마운트 */
  expandFully = true,
}) {
  const list = clusters ?? [];
  const listSig = `${list.length}:${list[0]?.key ?? ''}:${list[list.length - 1]?.key ?? ''}`;
  const [visibleCount, setVisibleCount] = useState(() =>
    Math.min(initialCount, list.length),
  );

  useEffect(() => {
    setVisibleCount(Math.min(initialCount, list.length));
  }, [listSig, initialCount, list.length]);

  useEffect(() => {
    if (!expandFully) return undefined;
    if (visibleCount >= list.length) return undefined;
    let cancelled = false;
    /** @type {number | null} */
    let idleId = null;
    /** @type {ReturnType<typeof setTimeout> | null} */
    let timeoutId = null;
    const bump = () => {
      if (cancelled) return;
      setVisibleCount((n) => Math.min(n + step, list.length));
    };
    if (typeof requestIdleCallback === 'function') {
      idleId = requestIdleCallback(bump, { timeout: 48 });
    } else {
      timeoutId = setTimeout(bump, 0);
    }
    return () => {
      cancelled = true;
      if (idleId != null && typeof cancelIdleCallback === 'function') {
        cancelIdleCallback(idleId);
      }
      if (timeoutId != null) clearTimeout(timeoutId);
    };
  }, [visibleCount, list.length, step, expandFully]);

  return (
    <ul className="results-list results-list--nested unify-candidate-find__list">
      {list.slice(0, visibleCount).map((cluster) => (
        <Fragment key={cluster.key}>{renderClusterCard(cluster)}</Fragment>
      ))}
    </ul>
  );
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

/**
 * 헤더·팝업·배지용 단일 집계 스냅샷.
 * 검토 필요(본+보조·용언)도 체크·발견 횟수에 포함한다 (1·2차 공통).
 * @param {import('../../lib/unifyCandidateGrouping.js').ClusterGroup[]} groups
 */
function summarizeUnifyListSnapshot(groups) {
  const listClusters = (groups ?? []).flatMap((g) => g.clusters ?? []);
  return {
    listClusters,
    countedClusters: listClusters,
    itemCount: countUnifyListAccordionItems(groups),
    findings: listClusters.reduce((n, c) => n + (c.totalCount ?? 0), 0),
    hiddenPdfKeys: new Set(),
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
 * 2차 계열 — 적용 단어 라벨(+더보기). 계열 박스 위에 상단 배너와 동일 스타일.
 * @param {{
 *   direction: 'glued' | 'spaced' | null | undefined,
 *   clusterCount: number,
 *   expanded: boolean,
 *   onToggleExpand: () => void,
 * }} props
 */
function Phase2CompliantFormsBanner({
  direction,
  clusterCount,
  expanded,
  onToggleExpand,
}) {
  if (
    !clusterCount ||
    (direction !== 'glued' && direction !== 'spaced')
  ) {
    return null;
  }
  const previewMax = PHASE2_COMPLIANT_FORMS_PREVIEW;
  const rest = clusterCount - previewMax;
  const dirLabel = formatPhase2CompliantAppliedLabel(direction);
  return (
    <div
      className="results-category__summary panel-criteria-heading unify-candidate-find__compliant-heading"
      role="presentation"
    >
      <span className="results-category__label">{dirLabel}</span>
      {!expanded && rest > 0 ? (
        <button
          type="button"
          className="unify-candidate-find__compliant-more"
          onClick={onToggleExpand}
        >
          +{rest}개 더 보기
        </button>
      ) : null}
      {expanded && clusterCount > previewMax ? (
        <button
          type="button"
          className="unify-candidate-find__compliant-more"
          onClick={onToggleExpand}
        >
          접기
        </button>
      ) : null}
    </div>
  );
}

/**
 * 2차 계열 — 이미 맞는 표를 어긋남과 같은 카드로 보여 주되 선택 불가.
 * @param {{
 *   direction: 'glued' | 'spaced' | null | undefined,
 *   clusters: import('../../lib/unifyCandidateDiscover.js').UnifySpacingCluster[],
 *   expanded: boolean,
 *   currentPage: number,
 *   selectedInstance: unknown,
 *   formatPageLabel: (pageNum: number, index?: number, total?: number) => string,
 *   pageTexts: unknown[],
 *   previewGroups?: unknown[],
 *   onSelectInstance?: (inst: import('../../lib/ruleEngine.js').MatchInstance) => void,
 * }} props
 */
function Phase2CompliantFormsSummary({
  direction,
  clusters,
  expanded,
  currentPage,
  selectedInstance,
  formatPageLabel,
  pageTexts,
  previewGroups,
  onSelectInstance,
}) {
  const list = (clusters ?? []).filter((c) => (c?.totalCount || 0) > 0);
  if (!list.length || (direction !== 'glued' && direction !== 'spaced')) {
    return null;
  }
  const previewMax = PHASE2_COMPLIANT_FORMS_PREVIEW;
  const shown = expanded ? list : list.slice(0, previewMax);
  const dirLabel = formatPhase2CompliantAppliedLabel(direction);
  const noop = () => {};

  return (
    <div className="unify-candidate-find__compliant-block">
      <div className="unify-candidate-find__compliant-list-wrap">
        <ul
          className="results-list results-list--nested unify-candidate-find__list unify-candidate-find__compliant-list"
          aria-label={dirLabel}
        >
          {shown.map((cluster) => (
            <ClusterCard
              key={`compliant-${cluster.key}`}
              cluster={cluster}
              pdfVisible
              onTogglePdfVisibility={noop}
              registeredVariant={null}
              preSelectedVariant={null}
              groupClusters={list}
              onSelectVariant={noop}
              onCancelVariant={noop}
              currentPage={currentPage}
              selectedInstance={selectedInstance}
              formatPageLabel={formatPageLabel}
              onSelectInstance={onSelectInstance}
              pageTexts={pageTexts}
              previewGroups={previewGroups}
            />
          ))}
        </ul>
      </div>
    </div>
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
 *   onListReady?: (payload: {
 *     clusters: UnifySpacingCluster[],
 *     chosenByKey: Map<string, string>,
 *     hiddenKeys: Set<string>,
 *     focusInst?: import('../../lib/ruleEngine.js').MatchInstance | null,
 *   }) => void,
 *   onChosenChange?: (chosenByKey: Map<string, string>) => void,
 *   onPreviewClear?: () => void,
 *   onPreviewHiddenChange?: (hiddenKeys: Set<string>) => void,
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
  onListReady,
  onChosenChange,
  onPreviewClear,
  onPreviewHiddenChange,
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

  /** 검색·phase 전환 시 아코디언 remount (펼침/스크롤 초기화) */
  const [listEpoch, setListEpoch] = useState(0);

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
  /** 2차 「1차 통일형(…) 적용 단어」요약 펼침 — groupKey = affixType:template */
  const [compliantFormsExpandedKeys, setCompliantFormsExpandedKeys] = useState(
    () => /** @type {Set<string>} */ (new Set()),
  );
  /** 아코디언 펼침 추적 — 쪽 칩·카드 마운트용 (details open은 네이티브) */
  const [openUnifySectionIds, setOpenUnifySectionIds] = useState(
    () => /** @type {Set<string>} */ (new Set()),
  );
  const handleUnifySectionToggle = useCallback((sectionId, open) => {
    // 네이티브 <details> 펼침 페인트를 막지 않음 — 칩·추가 카드는 transition으로
    startTransition(() => {
      setOpenUnifySectionIds((prev) => {
        const has = prev.has(sectionId);
        if (open === has) return prev;
        const next = new Set(prev);
        if (open) next.add(sectionId);
        else next.delete(sectionId);
        return next;
      });
    });
  }, []);
  const shouldMountUnifySection = useCallback(
    (sectionId) => openUnifySectionIds.has(sectionId),
    [openUnifySectionIds],
  );
  /** 2차 진입 직전 1차 선택 스냅샷 — soft 포함, 계열 기준 문구용 */
  const [phase2PrimaryChosen, setPhase2PrimaryChosen] = useState(
    () => /** @type {Map<string, string>} */ (new Map()),
  );
  const secondaryClusters = useMemo(
    () => secondaryGroups.flatMap((g) => g.clusters),
    [secondaryGroups],
  );
  const phase2InProgressBanner = useMemo(
    () => formatPhase2InProgressBannerModel(),
    [],
  );
  const phase2PromptedRef = useRef(false);
  /** 2차 진입 중 재클릭·빈 목록 effect 레이스 방지 */
  const phase2EnteringRef = useRef(false);
  const [phase2Entering, setPhase2Entering] = useState(false);
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
  const notifyChosenChange = useCallback(
    (registered, pre) => {
      onChosenChange?.(mergeUnifyChosenMaps(registered, pre));
    },
    [onChosenChange],
  );

  async function handleFind() {
    if (!hasPdf || !pageTexts.length) {
      await showAppAlert({
        title: '표기 통일 추천',
        message: '먼저 PDF를 업로드하세요.',
      });
      return;
    }
    if (isProcessing) {
      await showAppAlert({
        title: '표기 통일 추천',
        message: 'PDF 텍스트 추출이 끝날 때까지 기다려 주세요.',
      });
      return;
    }
    if (checkQuotaBlocked) {
      await showAppAlert({
        title: '표기 통일 추천',
        message:
          '지금은 검수를 진행할 수 없습니다. 로그인·검수권을 확인해 주세요.',
      });
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
      onPreviewClear?.();
      setOpenUnifySectionIds(new Set());
      setListEpoch((n) => n + 1);
      // 이전 목록·폴백(grouped←clusters)이 phase2 전에 다시 보이지 않게
      setSearched(false);
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
      let workingGroups;
      const ruleStrip = assembleUnifyListBase(next, result.rawByKey);
      workingGroups = ruleStrip.groups;
      const ruleExcluded = ruleStrip.ruleExcluded;
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
            workingGroups = filterSeriesSatellitesByNoiseList(workingGroups);
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
          // API 없이도 규칙 안전망(하다·보자 등) + 1차 noise-list
          // (stdict ON 경로·applyUnifyListReviewMarks와 동일 순서)
          workingGroups = dropJosaPlusPredicateFromGroups(workingGroups);
          workingGroups = filterSeriesSatellitesByNoiseList(workingGroups);
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

      // 목록(grouped)과 동일: item 재집계 → 1차 noise-list → 정렬
      // DocSuffix(OCR 앞잘림)는 1차 찾기에 붙이지 않음 → UI 2차 진입(enterPhase2)에서.
      workingGroups = await finalizeUnifyListGroupsAsync(
        workingGroups,
        pageTexts,
      );
      bench.mark('5_enrichGroups_sort');

      const snap = summarizeUnifyListSnapshot(workingGroups);
      const softPre = buildSeriesMajoritySoftPreselect(workingGroups);
      const kiwiDiagDone = await snapshotUnifyFindDiag();
      const morphInactive = Boolean(kiwiDiagDone.noiseFilterEnabled);
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
        morphFilterActive: false,
        morphFilterInactive: morphInactive,
        docSuffixDropped: 0,
        note: '1차 찾기=DocSuffix 없음 · 2차 진입 시 적용 · 완료 팝업 없음',
      });

      // 목록·marks를 한 번에 — 팝업 아래에서 숫자가 바뀌지 않게.
      // 「찾기를 진행했습니다」모달은 뜨지 않음(1019↔66 혼선·중복 안내 방지).
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
      setUnifyPhase('primary');
      setSecondaryGroups([]);
      setPhase2DoneLabels([]);
      setPhase2ResultSummary(null);
      setPhase2ConditionsExpanded(false);
      // soft로 1차 완료처럼 보여도 직후 「종료」팝업이 또 뜨지 않게
      phase2PromptedRef.current = true;
      setMorphFilterInactive(morphInactive);
      setFindListGroups(workingGroups);
      setHiddenPdfKeys(snap.hiddenPdfKeys);
      setRegisteredVariants(new Map());
      setPreSelected(softPre);
      setSearched(true);
      setFinding(false);

      await afterPaint();
      const focusInst = firstUnifyListChipInstance(
        workingGroups,
        softPre,
        snap.hiddenPdfKeys,
      );
      const listClustersReady = workingGroups.flatMap((g) => g.clusters);
      try {
        onListReady?.({
          clusters: listClustersReady,
          chosenByKey: mergeUnifyChosenMaps(new Map(), softPre),
          hiddenKeys: snap.hiddenPdfKeys,
          focusInst,
        });
      } catch (err) {
        if (import.meta.env.DEV) {
          console.warn('[unify-preview] onListReady failed', err);
        }
      }
      if (morphInactive && import.meta.env.DEV) {
        console.warn(
          '[unify-kiwi-noise] 1차 찾기 — DocSuffix/Kiwi 미적용 (목록=정적+noise-list)',
        );
      }
      // 팝업은 함수 내부 no-op. 게스트 결과→다운로드 가이드 해금만 수행.
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

  const grouped = useMemo(() => {
    if (findListGroups) return findListGroups;
    if (!rawByKey) return [];
    const t0 = performance.now();
    const out = buildUnifyListGroups(clusters, rawByKey, pageTexts, {
      slmReviewedByKey,
      stdictPredicateSeriesIds,
      stdictPredicateClusterKeys,
      predicateDropSeriesIds,
      predicateDropClusterKeys,
      predicateNeedsReviewByKey,
    });
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

  function handleTogglePdfVisibility(cluster) {
    const nextHidden = new Set(hiddenPdfKeys);
    if (nextHidden.has(cluster.key)) nextHidden.delete(cluster.key);
    else nextHidden.add(cluster.key);
    setHiddenPdfKeys(nextHidden);
    onPreviewHiddenChange?.(nextHidden);
  }

  /**
   * @param {UnifySpacingCluster[]} groupClusters
   * @param {boolean} nextVisible
   */
  function handleToggleCategoryPdf(groupClusters, nextVisible) {
    const nextHidden = new Set(hiddenPdfKeys);
    for (const c of groupClusters) {
      if (nextVisible) nextHidden.delete(c.key);
      else nextHidden.add(c.key);
    }
    setHiddenPdfKeys(nextHidden);
    onPreviewHiddenChange?.(nextHidden);
  }

  const busy = finding || slmReviewing || isProcessing;

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

      let nextPre = preSelected;
      if (
        unifyPhase === 'primary' &&
        groupClusters &&
        groupClusters.length > 1
      ) {
        const isGlued = !/\s/.test(chosenVariant);
        const alreadySeeded = groupClusters.some((gc) =>
          preSelected.has(gc.key),
        );
        if (!alreadySeeded) {
          nextPre = new Map(preSelected);
          for (const gc of groupClusters) {
            if (gc.key === cluster.key) {
              nextPre.set(gc.key, chosenVariant);
              continue;
            }
            const sameDir = gc.variants.find((v) =>
              isGlued ? !/\s/.test(v) : /\s/.test(v),
            );
            if (sameDir) nextPre.set(gc.key, sameDir);
          }
        }
      }

      setRegisteredVariants(nextRegistered);
      if (nextPre !== preSelected) setPreSelected(nextPre);
      notifyChosenChange(nextRegistered, nextPre);

      const firstWrong = firstWrongUnifyInstance(cluster, chosenVariant, {
        pages: pageTexts,
      });
      jumpUnifyPdf(onSelectInstance, firstWrong);
    },
    [
      onSelectInstance,
      registeredVariants,
      preSelected,
      unifyPhase,
      pageTexts,
      notifyChosenChange,
    ],
  );

  /** 2차 — 패턴 후보 전부로 바로 단어 세트 목록 (pattern_pick 생략) */
  const enterPhase2 = useCallback(async () => {
    if (!isUnifyPhase2PatternEnabled()) return;
    if (phase2EnteringRef.current) return;
    phase2EnteringRef.current = true;
    setPhase2Entering(true);
    try {
      const chosen = mergeUnifyChosenMaps(registeredVariants, preSelected);

      const candidates = collectPatternRuleCandidates(chosen, clusters, pageTexts);

      // 후보 없음 → 안내 후 1차 유지 (1차 목록·phase는 건드리지 않음)
      if (!candidates.length) {
        await showAppAlert({
          title: '2차 표기 통일',
          message:
            '확장할 표기 후보가 없습니다.\n1차에서 고른 계열에 더 찾을 어긋남·적용 표기가 없습니다.',
        });
        return;
      }

      const ids = new Set(candidates.map((c) => c.id));
      let nextGroups = buildSecondaryGroupsFromCandidates(candidates, ids);

      // 머리 잘림(DocSuffix): 2차 목록에서 복원·같은 단어 세트로 merge. 증인=1·2차 목록.
      try {
        const primaryGroups = findListGroups ?? [];
        const suffix = await filterGroupsByDocSuffixOrphan(
          nextGroups,
          pageTexts,
          {
            rawByKey,
            witnessGroups: [...primaryGroups, ...nextGroups],
          },
        );
        if (
          suffix.applied &&
          ((suffix.remapped ?? 0) > 0 || (suffix.dropped ?? 0) > 0)
        ) {
          nextGroups = suffix.groups;
        }
      } catch (err) {
        if (import.meta.env?.DEV) {
          console.warn('[unify-doc-suffix] phase2 list filter failed', err);
        }
      }

      const nextClusters = nextGroups.flatMap((g) => g.clusters ?? []);
      const compliantClusters = nextGroups.flatMap((g) =>
        (g.compliantForms ?? []).filter((c) => (c?.totalCount || 0) > 0),
      );
      // PDF 빨간 줄용 — 어긋남 + 이미 맞는 표기 모두 preview snapshot에 포함
      /** @type {Map<string, import('../../lib/unifyCandidateDiscover.js').UnifySpacingCluster>} */
      const previewByKey = new Map();
      for (const c of [...nextClusters, ...compliantClusters]) {
        if (!c?.key) continue;
        if (!previewByKey.has(c.key)) previewByKey.set(c.key, c);
      }
      const previewClusters = [...previewByKey.values()];
      if (!nextGroups.length || !previewClusters.length) {
        await showAppAlert({
          title: '2차 표기 통일',
          message:
            '확장할 표기 후보가 없습니다.\n1차에서 고른 계열에 더 찾을 어긋남·적용 표기가 없습니다.',
        });
        return;
      }

      const itemCount = countUnifyListAccordionItems(nextGroups);
      // 2차는 soft 미리찍기 없음 — 사용자가 직접 선택
      // 목록·phase를 한 번에 (빈 secondary_pairs 중간 상태 금지 → 팝업/칩 레이스 방지)
      setPhase2PrimaryChosen(new Map(chosen));
      setPreSelected(new Map());
      setPhase2DoneLabels([]);
      setPhase2ConditionsExpanded(false);
      setCompliantFormsExpandedKeys(new Set());
      setHiddenPdfKeys(new Set());
      setSecondaryGroups(nextGroups);
      setPhase2ResultSummary({
        itemCount,
        findings: sumClusterFindings(nextClusters),
      });
      setUnifyPhase('secondary_pairs');
      setOpenUnifySectionIds(new Set());
      setListEpoch((n) => n + 1);

      await afterPaint();
      onListReady?.({
        clusters: previewClusters,
        chosenByKey: mergeUnifyChosenMaps(registeredVariants, new Map()),
        hiddenKeys: new Set(),
        focusInst: firstUnifyListChipInstance(
          nextGroups.length
            ? nextGroups
            : [{ type: 'single', clusters: previewClusters }],
          mergeUnifyChosenMaps(registeredVariants, new Map()),
          new Set(),
        ),
      });

      // await 하면 모달이 requestIdleCallback(쪽 칩)을 막아「처음에 칩이 안 보임」.
      // 진입당 1회만, 목록·listReady 이후에 비차단으로.
      void alertUnifyCandidatePhase2AfterComplete({
        itemCount,
        clusters: nextClusters,
      });
    } finally {
      phase2EnteringRef.current = false;
      setPhase2Entering(false);
    }
  }, [
    registeredVariants,
    preSelected,
    clusters,
    pageTexts,
    rawByKey,
    findListGroups,
    onListReady,
  ]);

  /** 2차 후보 없음 등 — 팝업 없이 1차 목록으로만 복귀 */
  const finishSecondary = useCallback(() => {
    phase2EnteringRef.current = false;
    setPhase2Entering(false);
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
    setPhase2ConditionsExpanded(false);
    setPhase2PrimaryChosen(new Map());
    onListReady?.({
      clusters: listClusters,
      chosenByKey: mergeUnifyChosenMaps(registeredVariants, preSelected),
      hiddenKeys: new Set(),
      focusInst: null,
    });
  }, [
    secondaryGroups,
    registeredVariants,
    preSelected,
    listClusters,
    onListReady,
  ]);

  /** 「표기 통일 종료」— 확인·완료 팝업 없이 최초 UI로 */
  const endUnifyToInitialUi = useCallback(() => {
    setSearched(false);
    setFinding(false);
    setUnifyPhase('primary');
    setSecondaryGroups([]);
    setPhase2DoneLabels([]);
    setPhase2ResultSummary(null);
    setPhase2ConditionsExpanded(false);
    setCompliantFormsExpandedKeys(new Set());
    setPhase2PrimaryChosen(new Map());
    setHiddenPdfKeys(new Set());
    setClusters([]);
    setFindListGroups(null);
    setRawByKey(null);
    setRegisteredVariants(new Map());
    setPreSelected(new Map());
    setListEpoch((n) => n + 1);
    setOpenUnifySectionIds(new Set());
    phase2PromptedRef.current = false;
    phase2EnteringRef.current = false;
    setPhase2Entering(false);
    onPreviewClear?.();
  }, [onPreviewClear]);

  useEffect(() => {
    if (!primaryUnifyComplete) {
      phase2PromptedRef.current = false;
    }
  }, [primaryUnifyComplete]);

  const handlePhase2EntryClick = useCallback(async () => {
    if (!primaryUnifyComplete || !isUnifyPhase2PatternEnabled()) return;
    if (isGuestBrowseActive() && !guestBrowseAllowsUnifyPhase2Local()) return;
    if (phase2EnteringRef.current) return;
    await enterPhase2();
  }, [primaryUnifyComplete, enterPhase2]);

  /** 2차 목록 → 1차로 되돌림 (2차 선택·미리보기 폐기) */
  const returnToPrimaryFromPhase2 = useCallback(() => {
    phase2EnteringRef.current = false;
    const primaryKeys = new Set(listClusters.map((c) => c.key));
    const primaryReg = new Map();
    for (const [k, v] of registeredVariants) {
      if (primaryKeys.has(k)) primaryReg.set(k, v);
    }
    setRegisteredVariants(primaryReg);
    const soft = buildSeriesMajoritySoftPreselect(grouped);
    setPreSelected(soft);
    setSecondaryGroups([]);
    setPhase2DoneLabels([]);
    setPhase2ResultSummary(null);
    setPhase2ConditionsExpanded(false);
    setCompliantFormsExpandedKeys(new Set());
    setPhase2PrimaryChosen(new Map());
    setUnifyPhase('primary');
    setHiddenPdfKeys(new Set());
    onListReady?.({
      clusters: listClusters,
      chosenByKey: mergeUnifyChosenMaps(primaryReg, soft),
      hiddenKeys: new Set(),
      focusInst: null,
    });
  }, [
    listClusters,
    grouped,
    registeredVariants,
    onListReady,
  ]);

  const handleEndUnifyClick = useCallback(() => {
    if (isGuestBrowseActive() && !guestBrowseAllowsUnifyPhase2Local()) return;
    void endUnifyToInitialUi();
  }, [endUnifyToInitialUi]);

  /** 2차 계열 자체가 없을 때만 자동 종료 (진입 중 빈 목록 레이스는 제외) */
  useEffect(() => {
    if (!isUnifyPhase2PatternEnabled()) return;
    if (unifyPhase !== 'secondary_pairs') return;
    if (phase2EnteringRef.current) return;
    if (secondaryGroups.length > 0) return;
    finishSecondary();
  }, [unifyPhase, secondaryGroups, finishSecondary]);

  /**
   * 계열 헤더 붙여쓰기/띄어쓰기 — 같은 계열 전부 표기 통일.
   * 같은 방향 재클릭 시 계열 등록을 해제한다.
   * 선택은 즉시 반영. PDF는 chosenChanged→remap만 (publish/jump 없음).
   * @param {UnifySpacingCluster[]} groupClusters
   * @param {'glued' | 'spaced'} spacing
   * @param {'glued' | 'spaced' | null} currentSpacing
   */
  const handleSeriesSpacingSelect = useCallback(
    (groupClusters, spacing, currentSpacing) => {
      if (!groupClusters?.length) return;

      if (currentSpacing === spacing) {
        const next = new Map(registeredVariants);
        for (const gc of groupClusters) next.delete(gc.key);
        const nextPre = new Map(preSelected);
        for (const gc of groupClusters) nextPre.delete(gc.key);
        setRegisteredVariants(next);
        setPreSelected(nextPre);
        notifyChosenChange(next, nextPre);
        onSeriesSpacingGuideSelect?.();
        return;
      }

      const next = new Map(registeredVariants);
      const nextPre = new Map(preSelected);
      for (const gc of groupClusters) {
        const v = variantForSpacing(gc, spacing);
        if (!v) continue;
        next.set(gc.key, v);
        nextPre.set(gc.key, v);
      }
      setRegisteredVariants(next);
      setPreSelected(nextPre);
      notifyChosenChange(next, nextPre);
      onSeriesSpacingGuideSelect?.();
    },
    [
      onSeriesSpacingGuideSelect,
      registeredVariants,
      preSelected,
      notifyChosenChange,
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
    notifyChosenChange(nextReg, nextPre);
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
              <span className="consistency-hint-batang">경제˅학자</span>
              (띄어쓰기),{' '}
              <span className="consistency-hint-batang">경제학자</span>
              (붙여쓰기)
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

      {import.meta.env.DEV ? (
        <OrthoSpikeDevPanel
          hasPdf={hasPdf}
          pageTexts={pageTexts}
          isProcessing={isProcessing}
          currentPage={currentPage}
          formatPageLabel={formatPageLabel}
          onSelectInstance={onSelectInstance}
        />
      ) : null}

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
                        1차 표기 통일(띄어쓰기) : 추천 단어 세트 {listItemCount}{' '}
                        전체 발견
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
                          2차 표기 통일(확장) : 추천 단어 세트 {phase2HeaderItemCount}{' '}
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
                key={`unify-acc-${listEpoch}-${unifyPhase}`}
              >
                <div className="unify-candidate-find__phase-banner">
                  {unifyPhase === 'secondary_pairs' ? (
                    <div className="unify-candidate-find__phase-banner-title-block">
                      <p className="unify-candidate-find__phase-banner-title">
                        {phase2InProgressBanner.title}
                      </p>
                    </div>
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
                      <ul className="unify-candidate-find__phase-banner-line unify-candidate-find__phase-banner-line-list">
                        <li>띄어쓰기만 다른 표기를 찾습니다</li>
                        <li>80% 이상인 표기는 우선 선택됩니다</li>
                      </ul>
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
                          preSelected,
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
                        const compliantExpanded = compliantFormsExpandedKeys.has(
                          `${group.affixType}:${group.template}`,
                        );
                        const compliantList = (group.compliantForms ?? []).filter(
                          (c) => (c?.totalCount || 0) > 0,
                        );
                        const primaryCriterion =
                          formatPhase2SeriesCriterionModel(
                            group.direction,
                            collectPrimaryFormsForPatternGroup(
                              group,
                              clusters,
                              phase2PrimaryChosen.size > 0
                                ? phase2PrimaryChosen
                                : effectiveChosen,
                            ),
                          );
                        const toggleCompliantExpand = () => {
                          const k = `${group.affixType}:${group.template}`;
                          setCompliantFormsExpandedKeys((prev) => {
                            const next = new Set(prev);
                            if (next.has(k)) next.delete(k);
                            else next.add(k);
                            return next;
                          });
                        };
                        return (
                          <details
                            key={sectionId}
                            className="results-category results-category--unify-series"
                            onToggle={(e) =>
                              handleUnifySectionToggle(
                                sectionId,
                                e.currentTarget.open,
                              )
                            }
                          >
                            <summary className="results-category__summary panel-criteria-heading">
                              <CriteriaHoverTip tip="단어 세트 리스트 보기">
                                <DetailsChevron />
                              </CriteriaHoverTip>
                              <UnifyCategorySelectAll
                                label={seriesLabelText}
                                clusters={group.clusters}
                                hiddenPdfKeys={hiddenPdfKeys}
                                onToggleAll={handleToggleCategoryPdf}
                              />
                              <span className="unify-candidate-find__series-label-block">
                                <CriteriaHoverTip tip="단어 세트 리스트 보기">
                                  <span className="results-category__label">
                                    {seriesLabelText}
                                  </span>
                                </CriteriaHoverTip>
                                {primaryCriterion.text ? (
                                  <span className="unify-candidate-find__series-criterion">
                                    {primaryCriterion.text}
                                  </span>
                                ) : null}
                              </span>
                              <SeriesSpacingBreakdown
                                glued={spacingFindings.glued}
                                spaced={spacingFindings.spaced}
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
                            {openUnifySectionIds.has(sectionId) ? (
                              <>
                                {group.clusters.length === 0 ? (
                                  <ul className="results-list results-list--nested unify-candidate-find__list">
                                    <li className="unify-candidate-find__empty-row">
                                      <p className="unify-candidate-find__empty">
                                        ※ 더 고칠 표기가 없습니다
                                      </p>
                                    </li>
                                  </ul>
                                ) : (
                                  <ProgressiveClusterCards
                                    clusters={group.clusters}
                                    renderClusterCard={(cluster) => (
                                      <ClusterCard
                                        cluster={cluster}
                                        pdfVisible={
                                          !hiddenPdfKeys.has(cluster.key)
                                        }
                                        onTogglePdfVisibility={
                                          handleTogglePdfVisibility
                                        }
                                        registeredVariant={registeredVariants.get(
                                          cluster.key,
                                        )}
                                        preSelectedVariant={null}
                                        seriesDirection={
                                          seriesSpacing ?? group.direction
                                        }
                                        groupClusters={group.clusters}
                                        onSelectVariant={handleSelectVariant}
                                        onCancelVariant={handleCancelVariant}
                                        currentPage={currentPage}
                                        selectedInstance={selectedInstance}
                                        formatPageLabel={formatPageLabel}
                                        onSelectInstance={onSelectInstance}
                                        pageTexts={pageTexts}
                                      />
                                    )}
                                  />
                                )}
                                <Phase2CompliantFormsBanner
                                  direction={group.direction}
                                  clusterCount={compliantList.length}
                                  expanded={compliantExpanded}
                                  onToggleExpand={toggleCompliantExpand}
                                />
                                <Phase2CompliantFormsSummary
                                  direction={group.direction}
                                  clusters={group.compliantForms ?? []}
                                  expanded={compliantExpanded}
                                  currentPage={currentPage}
                                  selectedInstance={selectedInstance}
                                  formatPageLabel={formatPageLabel}
                                  pageTexts={pageTexts}
                                  onSelectInstance={onSelectInstance}
                                />
                              </>
                            ) : null}
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

                  const renderClusterCard = (cluster, pageChipsEnabled = true) => (
                    <ClusterCard
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
                      pageChipsEnabled={pageChipsEnabled}
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
                          onToggle={(e) =>
                            handleUnifySectionToggle(
                              `${sectionId}-${cluster.key}`,
                              e.currentTarget.open,
                            )
                          }
                        >
                          <summary className="results-category__summary panel-criteria-heading">
                            <CriteriaHoverTip tip="단어 세트 리스트 보기">
                              <DetailsChevron />
                            </CriteriaHoverTip>
                            <UnifyCategorySelectAll
                              label={itemLabel}
                              clusters={[cluster]}
                              hiddenPdfKeys={hiddenPdfKeys}
                              onToggleAll={handleToggleCategoryPdf}
                            />
                            <CriteriaHoverTip tip="단어 세트 리스트 보기">
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
                          {shouldMountUnifySection(
                            `${sectionId}-${cluster.key}`,
                          ) ? (
                            <ul className="results-list results-list--nested unify-candidate-find__list">
                              <Fragment key={cluster.key}>
                                {renderClusterCard(
                                  cluster,
                                  openUnifySectionIds.has(
                                    `${sectionId}-${cluster.key}`,
                                  ),
                                )}
                              </Fragment>
                            </ul>
                          ) : null}
                        </details>
                      );
                    });
                  }

                  return (
                    <details
                      key={sectionId}
                      className={`results-category results-category--unify-${categoryMod}`}
                      onToggle={(e) =>
                        handleUnifySectionToggle(
                          sectionId,
                          e.currentTarget.open,
                        )
                      }
                    >
                      <summary className="results-category__summary panel-criteria-heading">
                        <CriteriaHoverTip tip="단어 세트 리스트 보기">
                          <DetailsChevron />
                        </CriteriaHoverTip>
                        <UnifyCategorySelectAll
                          label={seriesLabelText}
                          clusters={group.clusters}
                          hiddenPdfKeys={hiddenPdfKeys}
                          onToggleAll={handleToggleCategoryPdf}
                        />
                        <CriteriaHoverTip tip="단어 세트 리스트 보기">
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
                      {shouldMountUnifySection(sectionId) ? (
                        <ProgressiveClusterCards
                          clusters={group.clusters}
                          expandFully={openUnifySectionIds.has(sectionId)}
                          renderClusterCard={(cluster) =>
                            renderClusterCard(
                              cluster,
                              openUnifySectionIds.has(sectionId),
                            )
                          }
                        />
                      ) : null}
                    </details>
                  );
                })
                  : null}

                {unifyPhase === 'primary' && phase2PatternEnabled ? (
                  <div className="unify-candidate-find__phase2-entry">
                    <CriteriaHoverTip
                      tip={
                        primaryUnifyComplete
                          ? '1차 선택을 반영해 2차로 진행'
                          : '모든 단어 세트를 선택한 뒤 누를 수 있습니다'
                      }
                    >
                      <button
                        type="button"
                        className="consistency-register-add-btn consistency-register-add-btn--label unify-candidate-find__submit"
                        disabled={!primaryUnifyComplete || phase2Entering}
                        onClick={() => {
                          void handlePhase2EntryClick();
                        }}
                      >
                        {phase2Entering ? '2차 진행 중…' : '2차 표기 통일'}
                      </button>
                    </CriteriaHoverTip>
                  </div>
                ) : null}

                {unifyPhase === 'secondary_pairs' ? (
                  <div className="unify-candidate-find__phase2-actions">
                    <CriteriaHoverTip tip="2차 목록을 닫고 1차로 돌아갑니다">
                      <button
                        type="button"
                        className="consistency-register-add-btn consistency-register-add-btn--label unify-candidate-find__submit"
                        onClick={returnToPrimaryFromPhase2}
                      >
                        1차 표기 통일로
                      </button>
                    </CriteriaHoverTip>
                    <CriteriaHoverTip tip="2차 선택을 반영하고 표기 통일을 마칩니다">
                      <button
                        type="button"
                        className="consistency-register-add-btn consistency-register-add-btn--label unify-candidate-find__submit"
                        onClick={handleEndUnifyClick}
                      >
                        표기 통일 종료
                      </button>
                    </CriteriaHoverTip>
                  </div>
                ) : null}
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
  /** 2차 계열 통일 방향 — preSelect 없을 때 예외 판정용 */
  seriesDirection = null,
  groupClusters,
  onSelectVariant,
  onCancelVariant,
  currentPage,
  selectedInstance,
  formatPageLabel,
  onSelectInstance,
  pageTexts: _pageTexts = [],
  previewGroups: _previewGroups = [],
  pageChipsEnabled = true,
}) {
  const isRegistered = !!registeredVariant;
  /** 쪽 칩·레이아웃 측정은 펼침 직후 프레임에 미룸 — 체크·통일 버튼이 먼저 보이게 */
  const [pageChipsReady, setPageChipsReady] = useState(false);
  /** variant별 쪽 칩「더 보기」— 접힌 동안 occ 전체 매핑 안 함 */
  const [chipExpandedByVariant, setChipExpandedByVariant] = useState(
    () => /** @type {Map<string, boolean>} */ (new Map()),
  );
  useEffect(() => {
    if (!pageChipsEnabled) {
      setPageChipsReady(false);
      setChipExpandedByVariant(new Map());
      return undefined;
    }
    setPageChipsReady(false);
    let cancelled = false;
    /** @type {ReturnType<typeof setTimeout> | null} */
    let timeoutId = null;
    const ready = () => {
      if (!cancelled) setPageChipsReady(true);
    };
    // 펼침 직후 바로 — idle이면 팝업·메인부하에 쪽 칩이 늦거나 안 보임
    timeoutId = setTimeout(ready, 0);
    return () => {
      cancelled = true;
      if (timeoutId != null) clearTimeout(timeoutId);
    };
  }, [cluster.key, pageChipsEnabled]);

  // 예외: 계열·soft 통일 방향과 반대로 등록된 경우
  const isException = (() => {
    if (!isRegistered) return false;
    const chosenIsGlued = !/\s/.test(registeredVariant);
    if (preSelectedVariant) {
      const preIsGlued = !/\s/.test(preSelectedVariant);
      return preIsGlued !== chosenIsGlued;
    }
    if (seriesDirection === 'glued' || seriesDirection === 'spaced') {
      return (seriesDirection === 'glued') !== chosenIsGlued;
    }
    return false;
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
          const occs = resolveUnifyVariantOccurrences(cluster, variant);
          const chipExpanded = chipExpandedByVariant.get(variant) === true;
          const CHIP_PREVIEW = 3;
          const srcOccs = !pageChipsReady
            ? []
            : chipExpanded
              ? occs
              : occs.slice(0, CHIP_PREVIEW);
          const instances = srcOccs.map((occ) => ({
            find: variant,
            replace,
            matchedText: occ.matchedText,
            suggestedText: replace,
            pageNum: occ.pageNum,
            index: occ.index,
            ...(Array.isArray(occ.itemIndexes) && occ.itemIndexes.length
              ? { itemIndexes: occ.itemIndexes }
              : {}),
            ...(typeof occ.x === 'number' ? { x: occ.x } : {}),
            ...(typeof occ.y === 'number' ? { y: occ.y } : {}),
          }));

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
                {isFirst && cluster.auxReview?.status === 'review' ? (
                  <span className="unify-candidate-find__aux-review">
                    본용언+ 보조용언 표기로 추정, 검토 필요
                  </span>
                ) : isFirst &&
                  cluster.predicateReview?.status === 'needs_review' ? (
                  <span className="unify-candidate-find__predicate-review">
                    용언 추정, 검토 필요
                  </span>
                ) : isFirst && cluster.josaReview?.status === 'review' ? (
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
              </div>
              {pageChipsReady && occs.length > 0 ? (
                <ResultPageSummary
                  instances={instances}
                  totalInstanceCount={occs.length}
                  currentPage={currentPage}
                  selectedInstance={selectedInstance}
                  formatPageLabel={formatPageLabel}
                  isInstanceVisible={() => true}
                  collapsedVisibleLimit={3}
                  onExpandedChange={(exp) => {
                    setChipExpandedByVariant((prev) => {
                      const next = new Map(prev);
                      if (exp) next.set(variant, true);
                      else next.delete(variant);
                      return next;
                    });
                  }}
                  onSelectPage={(pageNum) => {
                    const occ = occs.find((o) => o.pageNum === pageNum);
                    if (!occ) return;
                    // find = PDF에 있는 문자열(matchedText) — variant만 쓰면 빨간 줄이 안 맞음
                    const findText = occ.matchedText || variant;
                    jumpUnifyPdf(onSelectInstance, {
                      find: findText,
                      replace,
                      matchedText: findText,
                      suggestedText: replace,
                      pageNum: occ.pageNum,
                      index: occ.index,
                      ...(Array.isArray(occ.itemIndexes) &&
                      occ.itemIndexes.length
                        ? { itemIndexes: occ.itemIndexes }
                        : {}),
                      ...(typeof occ.x === 'number' ? { x: occ.x } : {}),
                      ...(typeof occ.y === 'number' ? { y: occ.y } : {}),
                      ...(typeof occ.column === 'number'
                        ? { column: occ.column }
                        : {}),
                    });
                  }}
                  onSelectInstance={(inst) =>
                    jumpUnifyPdf(onSelectInstance, {
                      ...inst,
                      find: inst.matchedText || inst.find || variant,
                      matchedText: inst.matchedText || inst.find || variant,
                    })
                  }
                />
              ) : null}
            </li>
          );
        })}
      </ul>
    </li>
  );
}
