/**
 * ?share= 수신 — 기준·검수결과 열람(읽기 전용), 유료 적용.
 * 발신 미리보기와 동일한 SharePackageReadPanel을 사용한다.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { showAppAlert } from '../lib/appDialog.js';
import { signInWithGoogle } from '../lib/firebaseAuth.js';
import { getSharePackageCloud } from '../lib/sharePackageCloud.js';
import {
  buildRuleSetFromSharePackage,
  planApplySharePackage,
  formatShareIssuedLabel,
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
import SharePackageReadPanel from './SharePackageReadPanel.jsx';
import './share-package-screen.css';

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
              ? '공유 프로젝트를 찾을 수 없습니다.'
              : '공유 프로젝트를 불러오지 못했습니다.';
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
        '공유 링크가 있는 사용자는 프로젝트 정보를 볼 수 있으며\n인디야 유료회원은 프로젝트를 적용하여 작업할 수 있습니다.',
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
  const issuedLabel = formatShareIssuedLabel(pkg?.createdAt);

  return (
    <div className="share-package-screen">
      <header className="share-package-screen__head">
        <p className="share-package-screen__eyebrow">
          <span className="share-package-screen__eyebrow-label">공유 프로젝트</span>
          {issuedLabel ? (
            <span className="share-package-screen__eyebrow-when">{issuedLabel}</span>
          ) : null}
        </p>
        <h1 className="share-package-screen__title">
          {loading ? '불러오는 중…' : title ? `《${title}》` : '공유 기준'}
        </h1>
        <p className="share-package-screen__note">
          공유 링크가 있는 사용자는 프로젝트 정보를 볼 수 있으며
          <br />
          인디야 유료회원은 프로젝트를 적용하여 작업할 수 있습니다
        </p>
      </header>

      {loading ? (
        <p role="status">공유 프로젝트를 확인하는 중…</p>
      ) : error ? (
        <p className="share-package-screen__error" role="alert">
          {error}
        </p>
      ) : pkg && card && ruleSet ? (
        <>
          <SharePackageReadPanel
            card={card}
            ruleSet={ruleSet}
            checkResults={shareCheckResults}
          />

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
