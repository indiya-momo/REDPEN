/**
 * ?share= 수신 — 기준·검수결과 열람, 작업대 적용.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { showAppAlert } from '../lib/appDialog.js';
import { remainingRetentionDays } from '../lib/checkResultSnapshot.js';
import { downloadCheckResultsAsZip } from '../lib/downloadCheckResultsZip.js';
import { signInWithGoogle } from '../lib/firebaseAuth.js';
import { buildCheckResultsZipBasename } from '../lib/proofreadExportFilename.js';
import { getSharePackageCloud } from '../lib/sharePackageCloud.js';
import { planApplySharePackage } from '../lib/sharePackage.js';
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
import { markReturnToMainWorkspace } from '../lib/returnToWorkspace.js';
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
  const [zipBusy, setZipBusy] = useState(false);

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

  const checkResults = useMemo(() => {
    const rows = Array.isArray(pkg?.checkResults) ? pkg.checkResults : [];
    return rows.map((row, index) => ({
      id: String(row.id ?? `share-result-${index}`),
      ...row,
    }));
  }, [pkg]);

  const ledger = useMemo(() => {
    const decisions = pkg?.criteria?.consistencyDecisions;
    return Array.isArray(decisions)
      ? decisions.filter((d) => d && d.kind === 'unify')
      : [];
  }, [pkg]);

  const handleZip = async () => {
    if (checkResults.length === 0) {
      await showAppAlert('포함된 검수 결과가 없습니다.');
      return;
    }
    setZipBusy(true);
    try {
      const title = String(pkg?.sourceName ?? pkg?.meta?.title ?? '공유').trim();
      const result = await downloadCheckResultsAsZip({
        items: checkResults,
        zipFilename: buildCheckResultsZipBasename(title || '공유'),
      });
      if (!result.ok) {
        await showAppAlert('다운로드할 결과를 만들 수 없습니다');
      }
    } catch (err) {
      console.error('공유 검수 결과 zip 실패:', err);
      await showAppAlert('다운로드에 실패했습니다');
    } finally {
      setZipBusy(false);
    }
  };

  const handleApply = useCallback(async () => {
    if (!pkg) return;
    if (!authReady) {
      await showAppAlert('로그인 상태를 확인하는 중입니다. 잠시 후 다시 눌러 주세요.');
      return;
    }
    if (!authUid) {
      await showAppAlert({
        title: '로그인이 필요합니다',
        message: '받은 기준으로 검수하려면 Google 로그인이 필요합니다.',
      });
      try {
        await signInWithGoogle();
      } catch (err) {
        console.error('공유 적용 로그인 실패:', err);
      }
      return;
    }

    setApplyBusy(true);
    try {
      const plan = await ensureLocalPlanFromCloud(authUid);
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
  const tags = Array.isArray(pkg?.meta?.tags) ? pkg.meta.tags : [];

  return (
    <div className="share-package-screen">
      <header className="share-package-screen__head">
        <p className="share-package-screen__eyebrow">공유 패키지</p>
        <h1 className="share-package-screen__title">
          {loading ? '불러오는 중…' : title ? `《${title}》` : '공유 기준'}
        </h1>
        <p className="share-package-screen__note">
          원고 PDF는 포함되지 않습니다. 기준·확정 대장·검수 결과만 전달됩니다.
          같은 기준으로 자기 PDF를 검수해 크로스 교정에 쓸 수 있습니다.
        </p>
      </header>

      {loading ? (
        <p role="status">공유 패키지를 확인하는 중…</p>
      ) : error ? (
        <p className="share-package-screen__error" role="alert">
          {error}
        </p>
      ) : pkg ? (
        <>
          {tags.length > 0 ? (
            <p className="share-package-screen__tags">
              {tags.map((tag) => (
                <span key={tag} className="share-package-screen__tag">
                  {tag}
                </span>
              ))}
            </p>
          ) : null}

          {pkg.meta?.memo ? (
            <p className="share-package-screen__memo">{String(pkg.meta.memo)}</p>
          ) : null}

          <section className="share-package-screen__block" aria-label="확정 대장">
            <h2>확정 대장</h2>
            {ledger.length === 0 ? (
              <p className="share-package-screen__empty">아직 확정 기록이 없습니다.</p>
            ) : (
              <ul className="share-package-screen__ledger">
                {ledger.map((item, index) => (
                  <li key={String(item.id ?? index)}>
                    <span className="share-package-screen__ledger-pin">
                      {String(item.pinned ?? '')}
                      {Array.isArray(item.variants) && item.variants.length
                        ? ` ← ${item.variants.join(' · ')}`
                        : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="share-package-screen__block" aria-label="검수 결과">
            <div className="share-package-screen__block-head">
              <h2>검수 결과</h2>
              <button
                type="button"
                className="share-package-screen__btn share-package-screen__btn--secondary"
                disabled={zipBusy || checkResults.length === 0}
                onClick={() => void handleZip()}
              >
                {zipBusy ? '받는 중…' : '검수 이력 다운받기'}
              </button>
            </div>
            {checkResults.length === 0 ? (
              <p className="share-package-screen__empty">포함된 검수 결과가 없습니다.</p>
            ) : (
              <ul className="share-package-screen__results">
                {checkResults.map((item) => {
                  const kind =
                    item.kind === 'consistency' ? '표기 통일' : '맞춤법';
                  const days = remainingRetentionDays(Number(item.expiresAt));
                  const when = Number(item.createdAt);
                  let whenLabel = '-';
                  if (Number.isFinite(when)) {
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
                  return (
                    <li key={item.id}>
                      <strong>{kind}</strong>
                      <span>
                        {whenLabel} · {days}일 남음
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <footer className="share-package-screen__foot">
            <button
              type="button"
              className="share-package-screen__btn share-package-screen__btn--primary"
              disabled={applyBusy}
              onClick={() => void handleApply()}
            >
              {applyBusy
                ? '적용 중…'
                : '이 기준으로 내 작업대에서 검수하기'}
            </button>
          </footer>
        </>
      ) : null}
    </div>
  );
}
