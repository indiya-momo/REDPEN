/**
 * 표기 통일 추천 — 맞춤법 탭 외래어 표기와 같은 박스·버튼 크롬.
 * 문서 내 띄어쓰기 이형태만 (규범 검증 아님).
 * 소수 이형태만 페이지 칩 → 원고 이동·하이라이트.
 */
import { useState } from 'react';
import {
  buildUnifyCandidatePreviewGroups,
  discoverSpacingUnifyCandidates,
  formatUnifyClusterRegisterInput,
  instancesForUnifyVariant,
} from '../../lib/unifyCandidateDiscover.js';
import { registerConsistencyUnifyBatch } from '../../lib/consistencyLiteralRegister.js';
import { applyUnifyPinWithLedger } from '../../lib/consistencyDecisions.js';
import { MAX_CONSISTENCY_UNIFY_SLOTS } from '../../lib/consistencyRuleLimit.js';
import { formatSystemPageLabel } from '../../lib/printedPageDisplay.js';
import { assertBetaDailyCheckOrAlert } from '../../lib/betaDailyQuota.js';
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
  const [searched, setSearched] = useState(false);
  const [addedKeys, setAddedKeys] = useState(() => new Set());

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
      if (
        !(await assertBetaDailyCheckOrAlert(authUid, {
          authEmail,
          checkTab: 'consistency',
          onConsumed: onBetaQuotaConsumed,
        }))
      ) {
        return;
      }
      await new Promise((r) => setTimeout(r, 0));
      const next = discoverSpacingUnifyCandidates(pageTexts);
      setClusters(next);
      setSearched(true);
      setAddedKeys(new Set());
      onPreviewGroupsChange?.(buildUnifyCandidatePreviewGroups(next));
    } finally {
      setFinding(false);
    }
  }

  /**
   * @param {UnifySpacingCluster} cluster
   */
  function handleAddToUnify(cluster) {
    const input = formatUnifyClusterRegisterInput(
      cluster,
      MAX_CONSISTENCY_UNIFY_SLOTS,
    );
    const ok = registerConsistencyUnifyBatch(input, customRules, (next) => {
      const pinned = applyUnifyPinWithLedger(
        next,
        consistencyDecisions,
        cluster.recommendedUnify,
        { byUid: decisionByUid },
      );
      return onApplyRules(pinned.nextRules, {
        consistencyDecisions: pinned.nextDecisions,
      });
    });
    if (ok) {
      setAddedKeys((prev) => new Set(prev).add(cluster.key));
    }
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
        <p className="hint consistency-hint-block unify-candidate-find__hint">
          띄어쓰기가 다른 항목을 자동으로 찾아 표기 통일을 제안합니다(줄바꿈 공백은 제외)
          <br />
          <ConsistencyHintExample>
            &apos;뉴욕 타임스&apos; 3회, &apos;뉴욕타임스&apos; 1회 → 다수형
            &apos;뉴욕 타임스&apos;
          </ConsistencyHintExample>
        </p>
        <div className="loanword-converter__field unify-candidate-find__field">
          <button
            type="button"
            className="loanword-converter__submit unify-candidate-find__submit"
            onClick={() => void handleFind()}
            disabled={finding || checkQuotaBlocked}
            aria-busy={finding}
          >
            {finding ? '찾는 중…' : '찾기'}
          </button>
        </div>
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
            <ul className="unify-candidate-find__list">
              {clusters.map((cluster) => {
                const added = addedKeys.has(cluster.key);
                return (
                  <li key={cluster.key} className="unify-candidate-find__card">
                    <div className="unify-candidate-find__card-head">
                      <p className="unify-candidate-find__recommend">
                        <span className="unify-candidate-find__recommend-label">
                          다수형
                        </span>
                        <strong>{cluster.recommendedUnify}</strong>
                        <span className="unify-candidate-find__total">
                          (총 {cluster.totalCount}회)
                        </span>
                      </p>
                      <button
                        type="button"
                        className="unify-candidate-find__add"
                        disabled={added}
                        onClick={() => handleAddToUnify(cluster)}
                      >
                        {added ? '넣음' : '표기 통일하기 등록'}
                      </button>
                    </div>
                    <ul className="unify-candidate-find__variants">
                      {cluster.variants.map((variant) => {
                        const isMinority =
                          variant !== cluster.recommendedUnify;
                        const instances = isMinority
                          ? instancesForUnifyVariant(cluster, variant)
                          : [];
                        return (
                          <li key={variant}>
                            <div className="unify-candidate-find__variant-row">
                              <span className="unify-candidate-find__variant">
                                {variant}
                              </span>
                              <span className="unify-candidate-find__count">
                                {cluster.counts[variant]}회
                              </span>
                            </div>
                            {isMinority && instances.length > 0 ? (
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
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
