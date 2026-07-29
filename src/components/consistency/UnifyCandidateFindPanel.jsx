/**
 * 표기 통일 추천 — 맞춤법 탭 외래어 표기와 같은 박스·버튼 크롬.
 * 문서 내 띄어쓰기 이형태만 (규범 검증 아님).
 * 소수 이형태만 페이지 칩 → 원고 이동·하이라이트.
 *
 * v2: 계열 그룹핑 + variant별 즉시 등록 + 그룹 일괄 등록.
 */
import { useState, useCallback } from 'react';
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

/**
 * @typedef {import('../../lib/unifyCandidateDiscover.js').UnifySpacingCluster} UnifySpacingCluster
 */

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
      onPreviewGroupsChange?.(buildUnifyCandidatePreviewGroups(next));
      await alertUnifyCandidateFindAfterRun(next, {
        uid: authUid,
        email: authEmail,
      });
    } finally {
      setFinding(false);
    }
  }

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
            <div className="unify-candidate-find__grouped">
              {(rawByKey
                ? groupSortAndFillSatellites(clusters, rawByKey)
                : []
              ).map((group) => (
                <div
                  key={
                    group.type === 'series'
                      ? `series-${group.affix}`
                      : 'singles'
                  }
                  className={
                    group.type === 'series'
                      ? 'unify-candidate-find__series-group'
                      : 'unify-candidate-find__singles'
                  }
                >
                  {group.type === 'series' ? (
                    <div className="unify-candidate-find__group-header">
                      <span className="unify-candidate-find__group-label">
                        {group.label}
                      </span>
                      <span className="result-findings-count-circle unify-candidate-find__group-count">
                        {group.clusters.length}
                      </span>
                    </div>
                  ) : null}
                  <ul className="unify-candidate-find__list">
                    {group.clusters.map((cluster) => (
                      <ClusterCard
                        key={cluster.key}
                        cluster={cluster}
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
                    ))}
                  </ul>
                </div>
              ))}
            </div>
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
    <li className="unify-candidate-find__card">
      <div className="unify-candidate-find__card-head">
        <span className="unify-candidate-find__total">
          총 {cluster.totalCount}회
        </span>
        {cluster.seriesHint ? (
          <span className="unify-candidate-find__series-hint">
            {cluster.seriesHint.reason}
          </span>
        ) : null}
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
