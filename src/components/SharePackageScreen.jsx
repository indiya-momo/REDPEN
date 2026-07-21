/**
 * ?share= 수신 — 기준·검수결과 열람(읽기 전용), 유료 적용.
 * 발신자 설정 패널은 건드리지 않고, 수신 전용 UI만 사용한다.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { showAppAlert } from '../lib/appDialog.js';
import { signInWithGoogle } from '../lib/firebaseAuth.js';
import { getSharePackageCloud } from '../lib/sharePackageCloud.js';
import {
  buildRuleSetFromSharePackage,
  planApplySharePackage,
} from '../lib/sharePackage.js';
import {
  loadRuleSets,
  saveActiveSetId,
  saveRuleSets,
} from '../lib/ruleSetsStorage.js';
import {
  isRuleSetsCloudEnabled,
  loadRuleSetsCloud,
  saveRuleSetsCloud,
} from '../lib/ruleSetsCloud.js';
import { ensureLocalPlanFromCloud } from '../lib/userProfileCloud.js';
import { isPaidPlan } from '../lib/userPlan.js';
import { markReturnToMainWorkspace } from '../lib/returnToWorkspace.js';
import { buildProjectCardViewModelFromRuleSet } from '../presentation/ruleSetProjectCard.js';
import {
  isConsistencyEntryEnabled,
  listConsistencyLiteralEntries,
} from '../lib/compoundPairRegister.js';
import {
  LITERAL_FIND_FEATURE_LABEL,
  UNIFY_FEATURE_LABEL,
  listConsistencyUnifyEntries,
} from '../lib/consistencyRuleLimit.js';
import { getConsistencyUnifyPinnedTailWord } from '../lib/consistencyUnifyRegister.js';
import { PROJECT_HUB_TOGGLE_CRITERIA } from '../lib/projectHubCriteriaSections.js';
import './share-package-screen.css';

/** @typedef {'meta' | 'spelling' | 'consistency' | 'auxiliary' | 'actions'} ShareReceiveSection */

const NAV_ITEMS = [
  { id: 'meta', label: '프로젝트 정보' },
  { id: 'spelling', label: '맞춤법', pillar: 'spelling' },
  { id: 'consistency', label: '표기 통일', pillar: 'consistency' },
  { id: 'auxiliary', label: '본용언 + 보조용언', pillar: 'auxiliary' },
  { id: 'actions', label: '작업 이력' },
];

/**
 * @param {{
 *   packageId: string,
 *   authUid?: string,
 *   authEmail?: string,
 *   authReady?: boolean,
 *   onApplied?: (newSetId: string) => void,
 * }} props
 */
export default function SharePackageScreen({
  packageId,
  authUid = '',
  authEmail = '',
  authReady = true,
  onApplied,
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(/** @type {string | null} */ (null));
  const [pkg, setPkg] = useState(/** @type {Record<string, unknown> | null} */ (null));
  const [applyBusy, setApplyBusy] = useState(false);
  const [userPlan, setUserPlan] = useState(/** @type {'free' | 'paid' | null} */ (null));
  const [section, setSection] = useState(/** @type {ShareReceiveSection} */ ('meta'));

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      const result = await getSharePackageCloud(packageId);
      if (cancelled) return;
      if (!result.ok) {
        const msg =
          result.reason === 'expired'
            ? '이 공유 링크는 만료되었습니다.'
            : result.reason === 'not_found'
              ? '공유 패키지를 찾을 수 없습니다.'
              : '공유 패키지를 불러오지 못했습니다.';
        setError(msg);
        setPkg(null);
        setLoading(false);
        return;
      }
      setPkg(result.package);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [packageId]);

  useEffect(() => {
    if (!authUid) {
      setUserPlan(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const plan = await ensureLocalPlanFromCloud(authUid);
      if (!cancelled) setUserPlan(plan);
    })();
    return () => {
      cancelled = true;
    };
  }, [authUid]);

  const ruleSet = useMemo(
    () => (pkg ? buildRuleSetFromSharePackage(pkg) : null),
    [pkg],
  );

  const card = useMemo(
    () => (ruleSet ? buildProjectCardViewModelFromRuleSet(ruleSet) : null),
    [ruleSet],
  );

  const shareCheckResults = useMemo(() => {
    return Array.isArray(pkg?.checkResults) ? pkg.checkResults : [];
  }, [pkg]);

  const consistencyGroups = useMemo(() => {
    const customRules = ruleSet?.customRules ?? [];
    const pinnedTailWord = getConsistencyUnifyPinnedTailWord(customRules);
    return [
      {
        label: LITERAL_FIND_FEATURE_LABEL,
        chips: listConsistencyLiteralEntries(customRules).map((entry) => ({
          label: entry.tailWord,
          active: isConsistencyEntryEnabled(customRules, entry.tailWord),
          pinned: false,
        })),
      },
      {
        label: UNIFY_FEATURE_LABEL,
        chips: listConsistencyUnifyEntries(customRules).map((entry) => ({
          label: entry.tailWord,
          active: isConsistencyEntryEnabled(customRules, entry.tailWord),
          pinned: pinnedTailWord === entry.tailWord,
        })),
      },
    ];
  }, [ruleSet]);

  const auxiliaryEntries = useMemo(() => {
    const cfg = PROJECT_HUB_TOGGLE_CRITERIA.auxiliary;
    const customRules = ruleSet?.customRules ?? [];
    return cfg.listEntries(customRules).map((row) => ({
      label: row.displayLabel || row.tailWord,
      active: cfg.isEnabled(customRules, row),
    }));
  }, [ruleSet]);

  const canApply = Boolean(authUid) && isPaidPlan({ plan: userPlan ?? 'free' });

  const requireLoginForApply = async () => {
    if (!authReady) {
      await showAppAlert('로그인 상태를 확인하는 중입니다. 잠시 후 다시 눌러 주세요.');
      return false;
    }
    if (authUid) return true;
    await showAppAlert({
      title: '로그인이 필요합니다',
      message:
        '공유 링크가 있는 사용자는 프로젝트 정보를 볼 수 있습니다. 인디야 유료회원은 프로젝트를 적용하여 작업할 수 있습니다.',
    });
    try {
      await signInWithGoogle();
    } catch (err) {
      console.error('공유 화면 로그인 실패:', err);
    }
    return false;
  };

  const handleApply = useCallback(async () => {
    if (!pkg) return;
    if (!(await requireLoginForApply())) return;

    setApplyBusy(true);
    try {
      const plan = await ensureLocalPlanFromCloud(authUid);
      if (!isPaidPlan({ plan })) {
        await showAppAlert(
          '인디야 유료회원만 프로젝트를 적용하여 작업할 수 있습니다.',
        );
        return;
      }

      let sets = loadRuleSets(authUid);
      if (isRuleSetsCloudEnabled()) {
        try {
          const cloud = await loadRuleSetsCloud(authUid);
          if (cloud?.ruleSets?.length) {
            sets = cloud.ruleSets;
          }
        } catch (err) {
          console.error('공유 적용 전 클라우드 로드 실패:', err);
        }
      }

      const planned = planApplySharePackage(
        pkg,
        sets,
        authUid,
        authEmail,
        plan,
      );
      if (!planned.ok) {
        await showAppAlert(
          planned.message ||
            (planned.reason === 'expired'
              ? '이 공유 링크는 만료되었습니다.'
              : '기준을 적용할 수 없습니다.'),
        );
        return;
      }

      saveRuleSets(planned.next, authUid);
      saveActiveSetId(planned.newSetId, authUid);
      if (isRuleSetsCloudEnabled()) {
        try {
          await saveRuleSetsCloud(authUid, planned.next, planned.newSetId);
        } catch (err) {
          console.error('공유 적용 클라우드 저장 실패:', err);
        }
      }

      markReturnToMainWorkspace();
      if (onApplied) {
        onApplied(planned.newSetId);
      } else {
        const url = new URL(window.location.href);
        url.searchParams.delete('share');
        window.location.assign(url.pathname + url.search);
      }
    } finally {
      setApplyBusy(false);
    }
  }, [pkg, authReady, authUid, authEmail, onApplied]);

  const title = String(pkg?.meta?.title ?? pkg?.sourceName ?? '').trim();

  return (
    <div className="share-package-screen">
      <header className="share-package-screen__head">
        <p className="share-package-screen__eyebrow">공유 패키지</p>
        <h1 className="share-package-screen__title">
          {loading ? '불러오는 중…' : title ? `《${title}》` : '공유 기준'}
        </h1>
        <p className="share-package-screen__note">
          공유 링크가 있는 사용자는 프로젝트 정보를 볼 수 있습니다. 인디야
          유료회원은 프로젝트를 적용하여 작업할 수 있습니다. 원고 PDF는
          포함되지 않습니다.
        </p>
      </header>

      {loading ? (
        <p role="status">공유 패키지를 확인하는 중…</p>
      ) : error ? (
        <p className="share-package-screen__error" role="alert">
          {error}
        </p>
      ) : pkg && card && ruleSet ? (
        <>
          <div className="share-receive">
            <nav className="share-receive__nav" aria-label="공유 구역">
              <ul className="share-receive__nav-list">
                {NAV_ITEMS.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={[
                        'share-receive__nav-btn',
                        section === item.id ? 'share-receive__nav-btn--active' : '',
                        item.pillar
                          ? `share-receive__nav-btn--${item.pillar}`
                          : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      onClick={() => setSection(/** @type {ShareReceiveSection} */ (item.id))}
                    >
                      {item.label}
                    </button>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="share-receive__main">
              {section === 'meta' ? (
                <div className="share-receive__card">
                  <ReadRow label="제목" desc="프로젝트 제목" value={card.title} />
                  <ReadRow
                    label="태그"
                    desc="쉼표로 구분 · 최대 3개"
                    value={(card.tags ?? []).join(', ') || '—'}
                  />
                  <ReadRow
                    label="그 외 정보"
                    desc="예: 신국판, 3교"
                    value={card.formatLabel || '—'}
                  />
                  <ReadRow label="메모" value={card.memo || '—'} multiline />
                </div>
              ) : null}

              {section === 'spelling' ? (
                <div className="share-receive__card">
                  <p className="share-receive__lead">
                    공유 패키지에 포함된 맞춤법 기준 요약입니다
                  </p>
                  <div className="share-receive__stats">
                    <span>
                      편집자 검토 필요{' '}
                      <strong>{card.counts?.editorReview ?? 0}건</strong>
                    </span>
                    <span>
                      맞춤법 규칙 <strong>{card.counts?.spelling ?? 0}건</strong>
                    </span>
                  </div>
                  {card.pillarMemos?.spelling ? (
                    <ReadRow
                      label="메모"
                      value={card.pillarMemos.spelling}
                      multiline
                    />
                  ) : null}
                </div>
              ) : null}

              {section === 'consistency' ? (
                <div className="share-receive__card">
                  <p className="share-receive__lead">
                    공유 패키지에 포함된 표기 통일 기준입니다
                  </p>
                  {consistencyGroups.map((group) => (
                    <div key={group.label} className="share-receive__group">
                      <span className="share-receive__group-label">
                        {group.label}
                      </span>
                      {group.chips.length ? (
                        <div className="share-receive__chips">
                          {group.chips.map((chip, index) => (
                            <span
                              key={`${chip.label}-${index}`}
                              className={[
                                'share-receive__chip',
                                chip.active ? '' : 'share-receive__chip--off',
                                chip.pinned ? 'share-receive__chip--pinned' : '',
                              ]
                                .filter(Boolean)
                                .join(' ')}
                            >
                              {chip.label}
                              {chip.pinned ? ' 📌' : ''}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="share-receive__empty">—</span>
                      )}
                    </div>
                  ))}
                  {card.pillarMemos?.consistency ? (
                    <ReadRow
                      label="메모"
                      value={card.pillarMemos.consistency}
                      multiline
                    />
                  ) : null}
                </div>
              ) : null}

              {section === 'auxiliary' ? (
                <div className="share-receive__card">
                  <p className="share-receive__lead">
                    공유 패키지에 포함된 본용언·보조용언 기준입니다
                  </p>
                  {auxiliaryEntries.length ? (
                    <div className="share-receive__chips">
                      {auxiliaryEntries.map((entry) => (
                        <span
                          key={entry.label}
                          className={[
                            'share-receive__chip',
                            entry.active ? '' : 'share-receive__chip--off',
                          ]
                            .filter(Boolean)
                            .join(' ')}
                        >
                          {entry.label}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="share-receive__empty">—</span>
                  )}
                  {card.pillarMemos?.auxiliary ? (
                    <ReadRow
                      label="메모"
                      value={card.pillarMemos.auxiliary}
                      multiline
                    />
                  ) : null}
                </div>
              ) : null}

              {section === 'actions' ? (
                <div className="share-receive__card">
                  <p className="share-receive__lead">
                    공유 패키지에 담긴 검수 결과 목록입니다. 다운로드는 제공하지
                    않습니다.
                  </p>
                  {shareCheckResults.length ? (
                    <ul className="share-receive__results">
                      {shareCheckResults.map((item, index) => {
                        const kind =
                          item.kind === 'consistency' ? '표기 통일' : '맞춤법';
                        const when = Number(item.createdAt);
                        let whenLabel = '-';
                        if (Number.isFinite(when) && when > 0) {
                          try {
                            whenLabel = new Date(when).toLocaleString('ko-KR', {
                              month: 'numeric',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            });
                          } catch {
                            whenLabel = '-';
                          }
                        }
                        const rowCount = Number(
                          item.rowCount ??
                            (Array.isArray(item.rows) ? item.rows.length : 0),
                        );
                        return (
                          <li key={String(item.id ?? `r-${index}`)}>
                            <strong>{kind}</strong>
                            <span>
                              {whenLabel}
                              {Number.isFinite(rowCount) && rowCount > 0
                                ? ` · ${rowCount}건`
                                : ''}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="share-receive__empty">
                      포함된 검수 결과가 없습니다.
                    </p>
                  )}
                </div>
              ) : null}
            </div>
          </div>

          <footer className="share-package-screen__foot">
            <button
              type="button"
              className="share-package-screen__btn share-package-screen__btn--primary"
              disabled={applyBusy}
              onClick={() => void handleApply()}
            >
              {applyBusy
                ? '적용 중…'
                : canApply
                  ? '이 기준으로 내 작업대에서 검수하기'
                  : authUid
                    ? '유료회원만 적용할 수 있습니다'
                    : '로그인 후 기준 적용하기'}
            </button>
          </footer>
        </>
      ) : null}
    </div>
  );
}

/**
 * @param {{ label: string, desc?: string, value: string, multiline?: boolean }} props
 */
function ReadRow({ label, desc, value, multiline = false }) {
  return (
    <div className="share-receive__row">
      <div className="share-receive__row-text">
        <span className="share-receive__row-label">{label}</span>
        {desc ? <p className="share-receive__row-desc">{desc}</p> : null}
      </div>
      {multiline ? (
        <p className="share-receive__value share-receive__value--memo">{value}</p>
      ) : (
        <p className="share-receive__value">{value}</p>
      )}
    </div>
  );
}
