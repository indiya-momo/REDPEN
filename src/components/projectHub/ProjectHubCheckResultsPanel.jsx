/**
 * 프로젝트 허브 — 저장된 검수 결과 목록·재다운로드.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  downloadConsistencyExportModel,
  downloadSpellingExportModel,
} from '../../lib/exportResults.js';
import {
  exportModelFromSnapshot,
  remainingRetentionDays,
} from '../../lib/checkResultSnapshot.js';
import { listCheckResultsCloud } from '../../lib/checkResultsCloud.js';
import { isPaidPlan } from '../../lib/userPlan.js';
import { loadUserProfileCloud } from '../../lib/userProfileCloud.js';
import { showAppAlert } from '../../lib/appDialog.js';

/**
 * @param {{
 *   uid: string,
 *   projectId: string,
 * }} props
 */
export default function ProjectHubCheckResultsPanel({ uid, projectId }) {
  const [paid, setPaid] = useState(/** @type {boolean | null} */ (null));
  const [items, setItems] = useState(
    /** @type {Array<{ id: string } & Record<string, unknown>>} */ ([]),
  );
  const [loading, setLoading] = useState(false);
  const [downloadingId, setDownloadingId] = useState(
    /** @type {string | null} */ (null),
  );

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

  const handleDownloadClick = async (item) => {
    if (paid === false) {
      await showAppAlert('유료회원 전용입니다');
      return;
    }
    if (!paid) return;
    const model = exportModelFromSnapshot({
      kind: item.kind === 'consistency' ? 'consistency' : 'spelling',
      sheetName: typeof item.sheetName === 'string' ? item.sheetName : undefined,
      filename: typeof item.filename === 'string' ? item.filename : undefined,
      summaryLine:
        typeof item.summaryLine === 'string' ? item.summaryLine : '',
      summary:
        item.summary && typeof item.summary === 'object' ? item.summary : {},
      rows: Array.isArray(item.rows) ? item.rows : [],
    });
    if (!model) {
      await showAppAlert('저장된 결과를 열 수 없습니다');
      return;
    }
    setDownloadingId(String(item.id));
    try {
      if (model.kind === 'spelling') {
        await downloadSpellingExportModel(model);
      } else {
        await downloadConsistencyExportModel(model);
      }
    } catch (err) {
      console.error('검수 결과 다운로드 실패:', err);
      await showAppAlert('다운로드에 실패했습니다');
    } finally {
      setDownloadingId(null);
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
      <div className="project-hub-settings__row project-hub-settings__row--readonly">
        <div className="project-hub-settings__row-text">
          <span className="project-hub-settings__row-label">저장된 검수 결과</span>
          <p className="project-hub-settings__row-desc">
            유료 회원은 검수 완료 시 결과(발견 목록·요약)가 최대 30일 보관됩니다.
            원고 PDF는 서버에 올리지 않습니다.
          </p>
        </div>
      </div>

      {paid === false ? (
        <div className="project-hub-settings__row project-hub-settings__row--readonly">
          <p className="project-hub-settings__row-desc">유료회원 전용입니다</p>
          <button
            type="button"
            className="project-hub-settings__secondary-btn"
            onClick={() => void showAppAlert('유료회원 전용입니다')}
          >
            결과 다운로드
          </button>
        </div>
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
                <button
                  type="button"
                  className="project-hub-settings__secondary-btn"
                  disabled={downloadingId === item.id}
                  onClick={() => void handleDownloadClick(item)}
                >
                  {downloadingId === item.id ? '받는 중…' : '엑셀 다운로드'}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
