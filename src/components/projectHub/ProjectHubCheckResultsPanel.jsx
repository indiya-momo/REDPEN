/**
 * 프로젝트 허브 — 저장된 검수 결과 목록·재다운로드.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  remainingRetentionDays,
} from '../../lib/checkResultSnapshot.js';
import { listCheckResultsCloud } from '../../lib/checkResultsCloud.js';
import { downloadCheckResultsAsZip } from '../../lib/downloadCheckResultsZip.js';
import { isPaidPlan } from '../../lib/userPlan.js';
import { loadUserProfileCloud } from '../../lib/userProfileCloud.js';
import { showAppAlert } from '../../lib/appDialog.js';

/**
 * @param {{
 *   uid: string,
 *   projectId: string,
 *   projectName?: string,
 * }} props
 */
export default function ProjectHubCheckResultsPanel({
  uid,
  projectId,
  projectName = '',
}) {
  const [paid, setPaid] = useState(/** @type {boolean | null} */ (null));
  const [items, setItems] = useState(
    /** @type {Array<{ id: string } & Record<string, unknown>>} */ ([]),
  );
  const [loading, setLoading] = useState(false);
  const [zipBusy, setZipBusy] = useState(false);

  const refresh = useCallback(async () => {
    const id = String(uid ?? '').trim();
    const pid = String(projectId ?? '').trim();
    if (!id || !pid) {
      setPaid(false);
      setItems([]);
      return;
    }
    setLoading(true);
    try {
      const profile = await loadUserProfileCloud(id);
      const isPaid = isPaidPlan(profile);
      setPaid(isPaid);
      if (!isPaid) {
        setItems([]);
        return;
      }
      const list = await listCheckResultsCloud({ uid: id, projectId: pid });
      setItems(list);
    } catch (err) {
      console.error('검수 결과 목록 로드 실패:', err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [uid, projectId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleZipDownload = async () => {
    if (paid === false) {
      await showAppAlert('유료회원 전용입니다');
      return;
    }
    if (!paid) return;
    if (items.length === 0) {
      await showAppAlert(
        '저장된 검수 결과가 없습니다.\n작업대에서 검수를 완료하면 여기에 보관됩니다.',
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

  return (
    <div className="project-hub-settings__card project-hub-settings__card--check-results">
      <div className="project-hub-settings__row project-hub-settings__row--readonly project-hub-settings__row--check-results-head">
        <div className="project-hub-settings__row-text">
          <span className="project-hub-settings__row-label">저장된 검수 결과</span>
          <p className="project-hub-settings__row-desc">
            유료 회원은 검수 완료 시 결과(발견 목록·요약)가 최대 30일 보관됩니다.
            원고 PDF는 서버에 올리지 않습니다.
          </p>
        </div>
        <button
          type="button"
          className="project-hub-settings__secondary-btn project-hub-settings__secondary-btn--check-results"
          disabled={zipBusy || paid === null || loading}
          onClick={() => void handleZipDownload()}
        >
          {zipBusy ? '받는 중…' : '검수 결과 다운받기'}
        </button>
      </div>

      {paid === false ? (
        <p className="project-hub-settings__row-desc">유료회원 전용입니다</p>
      ) : null}

      {paid && loading ? (
        <p className="project-hub-settings__row-desc">불러오는 중…</p>
      ) : null}

      {paid && !loading && items.length === 0 ? (
        <p className="project-hub-settings__row-desc">
          아직 저장된 검수 결과가 없습니다. 작업대에서 검수를 완료하면 여기에
          나타납니다.
        </p>
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
    </div>
  );
}
