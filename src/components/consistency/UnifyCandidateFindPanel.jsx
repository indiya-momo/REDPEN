/**
 * 표기 통일 추천 — 맞춤법 탭 외래어 표기와 같은 박스·버튼 크롬.
 * 문서 내 띄어쓰기 이형태만 (규범 검증 아님).
 * 소수형·1회 표기만 페이지 칩 → 원고 이동·하이라이트.
 *
 * v2: 계열 그룹핑 + variant별 즉시 등록 + 그룹 일괄 등록.
 * 결과 목록은 맞춤법 결과 리스트와 같은 아코디언(전체 발견 / N기준).
 */
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  buildUnifyCandidatePreviewGroups,
  discoverSpacingUnifyCandidates,
  instancesForUnifyVariant,
} from '../../lib/unifyCandidateDiscover.js';
import { groupSortAndFillSatellites } from '../../lib/unifyCandidateGrouping.js';
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
      {shownCount}
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
   */
  const publishPreview = useCallback(
    (allClusters, raw, hidden) => {
      if (!onPreviewGroupsChange) return;
      const grouped = raw
        ? groupSortAndFillSatellites(allClusters, raw)
        : [];
      const previewClusters = grouped
        .flatMap((g) => g.clusters)
        .filter((c) => !hidden.has(c.key));
      onPreviewGroupsChange(buildUnifyCandidatePreviewGroups(previewClusters));
    },
    [onPreviewGroupsChange],
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
    if (finding) return;
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
      setClusters(next);
      setRawByKey(result.rawByKey);
      setSearched(true);
      setRegisteredVariants(new Map());
      setPreSelected(new Map());
      const hidden = new Set();
      setHiddenPdfKeys(hidden);
      publishPreview(next, result.rawByKey, hidden);
      await alertUnifyCandidateFindAfterRun(next, {
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

  const grouped = useMemo(
    () => (rawByKey ? groupSortAndFillSatellites(clusters, rawByKey) : []),
    [clusters, rawByKey],
  );

  const totalFindings = useMemo(() => sumClusterFindings(clusters), [clusters]);
  const visibleFindings = useMemo(
    () =>
      sumClusterFindings(clusters.filter((c) => !hiddenPdfKeys.has(c.key))),
    [clusters, hiddenPdfKeys],
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
        return next;
      });

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
    [],
  );

  /**
   * 등록 취소 — 그룹 자동선택(preselect) 기준은 유지한다.
   * @param {UnifySpacingCluster} cluster
   */
  function handleCancelVariant(cluster) {
    setRegisteredVariants((prev) => {
      const next = new Map(prev);
      next.delete(cluster.key);
      return next;
    });
  }

  return (
    <div className="loanword-converter unify-candidate-find">
      <div className="loanword-converter__summary panel-criteria-heading">
        <span className="loanword-converter__summary-title">
          표기 통일 추천
          <span className="loanword-converter__free-badge">BEST</span>
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
            disabled={finding || checkQuotaBlocked}
            aria-busy={finding}
          >
            {finding ? '·\u2009·\u2009·' : '찾기'}
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
                  <span className="results-findings-meta__label">전체 발견</span>
                  <UnifyFindingsCount
                    count={totalFindings}
                    shownCount={visibleFindings}
                    className="results-header__total-count"
                  />
                </span>
              </div>
              <div
                className="results-accordion"
                key={`unify-acc-${clusters.length}-${totalFindings}`}
              >
                {grouped.map((group) => {
                  const sectionId =
                    group.type === 'series'
                      ? `series-${group.affixType}-${group.affix}`
                      : 'single';
                  const label =
                    group.type === 'series' ? group.label : '단일 항목';
                  const findingsTotal = sumClusterFindings(group.clusters);
                  const visibleClusters = group.clusters.filter(
                    (c) => !hiddenPdfKeys.has(c.key),
                  );
                  const findingsShown = sumClusterFindings(visibleClusters);
                  const criteriaCount = visibleClusters.length;

                  return (
                    <details
                      key={sectionId}
                      className={`results-category results-category--unify-${
                        group.type === 'series' ? 'series' : 'single'
                      }`}
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
                        {group.clusters.map((cluster) => (
                          <ClusterCard
                            key={cluster.key}
                            cluster={cluster}
                            pdfVisible={!hiddenPdfKeys.has(cluster.key)}
                            onTogglePdfVisibility={handleTogglePdfVisibility}
                            registeredVariant={registeredVariants.get(
                              cluster.key,
                            )}
                            preSelectedVariant={preSelected.get(cluster.key)}
                            groupClusters={
                              group.type === 'series'
                                ? group.clusters
                                : undefined
                            }
                            onSelectVariant={handleSelectVariant}
                            onCancelVariant={handleCancelVariant}
                            currentPage={currentPage}
                            selectedInstance={selectedInstance}
                            formatPageLabel={formatPageLabel}
                            onSelectInstance={onSelectInstance}
                          />
                        ))}
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
            {cluster.josaReview?.status === 'review' ? (
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
          </div>
          {cluster.seriesHint ? (
            <span className="unify-candidate-find__series-hint">
              {cluster.seriesHint.reason}
            </span>
          ) : null}
        </div>
      </div>
      <ul className="unify-candidate-find__variants">
        {cluster.variants.map((variant) => {
          const count = cluster.counts[variant] ?? 0;
          const isDerived = count === 0;
          const isChosen = registeredVariant === variant;
          const isPreSelected = !isRegistered && preSelectedVariant === variant;
          const instances = instancesForUnifyVariant(cluster, variant);

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
                  {variant}
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
