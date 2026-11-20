import { X } from 'lucide-react';
import {
  countStoredManualFindings,
  normalizeManualFindings,
  removeStoredManualFinding,
} from '../../lib/manuscriptWorkbench/persistManualFindings.js';

/**
 * 마이페이지 설정 — 프로젝트에 저장된 수정 리스트.
 * @param {{
 *   rows?: unknown,
 *   onChange?: (next: import('../../lib/manuscriptWorkbench/persistManualFindings.js').StoredManualFinding[]) => void,
 * }} props
 */
export default function ProjectHubManualListSection({
  rows,
  onChange,
}) {
  const findings = normalizeManualFindings(rows);
  const count = countStoredManualFindings(findings);

  return (
    <div className="project-hub-settings__group">
      <div className="project-hub-settings__card project-hub-settings__card--manual-list">
        <p className="project-hub-settings__row-label">
          수정 리스트
          {count > 0 ? (
            <span className="project-hub-settings__manual-count"> {count}</span>
          ) : null}
        </p>
        {count === 0 ? (
          <p className="project-hub-settings__row-desc">
            교정 화면에서 넣은 수정이 프로젝트에 저장되면 여기에 모입니다.
          </p>
        ) : (
          <ul className="project-hub-settings__manual-list">
            {findings.map((row) => {
              const key = `${row.pageNum}-${row.start}-${row.matchedText}`;
              const replaceLabel = row.replace ? row.replace : '(비움)';
              return (
                <li key={key} className="project-hub-settings__manual-item">
                  <div className="project-hub-settings__manual-body">
                    <p className="project-hub-settings__manual-pair">
                      <span>{row.matchedText}</span>
                      <span aria-hidden> → </span>
                      <span>{replaceLabel}</span>
                    </p>
                    <p className="project-hub-settings__manual-meta">
                      {row.pageNum}쪽
                      {row.tip ? ` · ${row.tip}` : ''}
                    </p>
                  </div>
                  {onChange ? (
                    <button
                      type="button"
                      className="project-hub-settings__manual-remove"
                      aria-label="이 수정 지우기"
                      onClick={() =>
                        onChange(removeStoredManualFinding(findings, row))
                      }
                    >
                      <X size={14} strokeWidth={2} aria-hidden />
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
