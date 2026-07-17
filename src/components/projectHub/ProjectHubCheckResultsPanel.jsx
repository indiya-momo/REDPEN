/**
 * 프로젝트 허브 — 저장된 검수 결과 목록·재다운로드.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  remainingRetentionDays,
} from '../../lib/checkResultSnapshot.js';
import { listCheckResultsCloud } from '../../lib/checkResultsCloud.js';
import { downloadCheckResultsAsZip } from '../../lib/downloadCheckResultsZip.js';
import {
  assertPaidCheckResultsOrAlert,
  isPaidUser,
} from '../../lib/paidPlanGate.js';
import { showAppAlert } from '../../lib/appDialog.js';

/**
 * @param {{
 *   uid: string,
 *   projectId: string,
 *   projectName?: string,
 *   embedded?: boolean,
 * }} props
 */
export default function ProjectHubCheckResultsPanel({
  uid,
  projectId,
  projectName = '',
  embedded = false,
}) {
  const [paid, setPaid] = useState(/** @type {boolean | null} */ (null));
  const [items, setItems] = useState(
    /** @type {Array<{ id: string } & Record<string, unknown>>} */ ([]),
  );
  const [loading, setLoading] = useState(true);
  const [zipBusy, setZipBusy] = useState(false);

  const refresh = useCallback(async () => {
    const id = String(uid ?? '').trim();
    const pid = String(projectId ?? '').trim();
    if (!id || !pid) {
      setPaid(false);
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const isPaid = await isPaidUser(id);
      setPaid(isPaid);
      if (!isPaid) {
        setItems([]);
        return;
      }
      try {
        const list = await listCheckResultsCloud({ uid: id, projectId: pid });
        setItems(list);
      } catch (listErr) {
        console.error('검수 결과 목록 로드 실패:', listErr);
        setItems([]);
      }
    } finally {
      setLoading(false);
    }
  }, [uid, projectId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // 검수 직후 허브로 오면 최신 스냅숏을 다시 읽는다
  useEffect(() => {
    const onFocus = () => {
      void refresh();
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refresh]);

  const handleZipDownload = async () => {
    if (loading || paid === null) {
      await showAppAlert('저장된 결과를 확인하는 중입니다. 잠시 후 다시 눌러 주세요.');
      return;
    }
    const id = String(uid ?? '').trim();
    if (!(await assertPaidCheckResultsOrAlert(id))) {
      setPaid(false);
      return;
    }
    setPaid(true);
    if (items.length === 0) {
      await showAppAlert(
        '저장된 검수 결과가 없습니다.\n작업대에서 「기준 검수」를 완료하면 여기에 보관됩니다.\n(기준만 등록·수정한 이력과는 다릅니다.)',
      );
      return;
    }

    setZipBusy(true);
    try {
      const safeName = String(projectName || '검수결과')
        .trim()
        .replace(/[\\/:*?"<>|]/g, '_')
        .slice(0, 40);
      const result = await downloadCheckResultsAsZip({
        items,
        zipFilename: `${safeName || '검수결과'}_검수결과`,
      });
      if (!result.ok) {
        await showAppAlert('다운로드할 결과를 만들 수 없습니다');
      }
    } catch (err) {
      console.error('검수 결과 zip 다운로드 실패:', err);
      await showAppAlert('다운로드에 실패했습니다');
    } finally {
      setZipBusy(false);
    }
  };

  const kindLabel = (kind) =>
    kind === 'consistency' ? '표기 통일' : '맞춤법';

  const formatWhen = (ms) => {
    const n = Number(ms);
    if (!Number.isFinite(n)) return '-';
    try {
      return new Date(n).toLocaleString('ko-KR', {
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '-';
    }
  };

  const statusDesc =
    loading || paid === null
      ? '저장된 결과를 확인하는 중…'
      : paid && items.length === 0
        ? '아직 저장된 검수 결과가 없습니다. 작업대에서 「기준 검수」를 완료해야 보관됩니다. (아래 작업 이력의 기준 등록과는 다릅니다.)'
        : null;

  const countLabel = loading || paid === null ? '…' : `${items.length}건`;

  const body = (
    <>
      <div className="project-hub-settings__row project-hub-settings__row--readonly project-hub-settings__row--check-results-head">
        <div className="project-hub-settings__row-text">
          <span className="project-hub-settings__row-label">저장된 검수 결과</span>
          <p className="project-hub-settings__row-desc">
            유료 회원은 검수 완료시 결과가 자동 저장되며 30일간 보관됩니다
          </p>
        </div>
        <div className="project-hub-check-results__download-box">
          <span className="project-hub-check-results__download-count">
            {countLabel}
          </span>
          <button
            type="button"
            className="project-hub-settings__secondary-btn project-hub-settings__secondary-btn--check-results"
            disabled={zipBusy}
            aria-busy={zipBusy || loading}
            onClick={() => void handleZipDownload()}
          >
            {zipBusy ? '받는 중…' : '검수 이력 다운받기'}
          </button>
        </div>
      </div>

      {statusDesc ? (
        <p className="project-hub-settings__row-desc">{statusDesc}</p>
      ) : null}

      {paid && !loading && items.length > 0 ? (
        <ul className="project-hub-check-results">
          {items.map((item) => {
            const days = remainingRetentionDays(Number(item.expiresAt));
            const count = Number(item.rowCount ?? item.rows?.length ?? 0);
            return (
              <li key={item.id} className="project-hub-check-results__item">
                <div className="project-hub-check-results__meta">
                  <span className="project-hub-check-results__kind">
                    {kindLabel(item.kind)}
                  </span>
                  <span className="project-hub-check-results__when">
                    {formatWhen(item.createdAt)}
                  </span>
                  <span className="project-hub-check-results__count">
                    {count}행
                  </span>
                  <span className="project-hub-check-results__days">
                    {days}일 남음
                  </span>
                  {item.truncated ? (
                    <span className="project-hub-check-results__badge">
                      일부만 저장됨
                    </span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </>
  );

  if (embedded) {
    return (
      <div className="project-hub-settings__check-results-embedded">{body}</div>
    );
  }

  return (
    <div className="project-hub-settings__card project-hub-settings__card--check-results">
      {body}
    </div>
  );
}
