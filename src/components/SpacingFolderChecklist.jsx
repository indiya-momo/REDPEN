import { useEffect, useMemo, useRef } from 'react';
import {
  listSpacingFolderBundles,
  normalizeSpacingFolderEnabled,
} from '../lib/spacingFolderBundles.js';
import DetailsChevron from './DetailsChevron.jsx';

/**
 * 맞춤법 탭 「띄어쓰기」 폴더 — 묶음 3개 on/off.
 * @param {{
 *   spacingFolderEnabled?: Record<string, boolean>,
 *   onSpacingFolderToggle: (bundleId: string) => void,
 *   onSpacingFolderSetAll: (enabled: boolean) => void,
 * }} props
 */
export default function SpacingFolderChecklist({
  spacingFolderEnabled,
  onSpacingFolderToggle,
  onSpacingFolderSetAll,
}) {
  const selectAllRef = useRef(/** @type {HTMLInputElement | null} */ (null));
  const bundles = useMemo(() => listSpacingFolderBundles(), []);
  const enabled = useMemo(
    () => normalizeSpacingFolderEnabled(spacingFolderEnabled),
    [spacingFolderEnabled],
  );
  const total = bundles.length;
  const activeCount = bundles.filter((b) => enabled[b.bundleId] === true).length;
  const allChecked = total > 0 && activeCount === total;
  const someChecked = activeCount > 0 && activeCount < total;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someChecked;
    }
  }, [someChecked]);

  return (
    <details className="spacing-folder-checklist-details caution-checklist-details" open>
      <summary className="spacing-folder-checklist-summary caution-checklist-summary panel-criteria-heading">
        <DetailsChevron />
        <label
          className="caution-checklist-select-all"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <input
            ref={selectAllRef}
            type="checkbox"
            checked={allChecked}
            onChange={() => onSpacingFolderSetAll(!allChecked)}
            aria-label="띄어쓰기 전체 선택"
          />
        </label>
        <span className="caution-checklist-summary-title">
          띄어쓰기
          <span className="panel-criteria-heading-meta">
            {`(${activeCount}/${total})`}
          </span>
          <span className="panel-criteria-heading-desc">
            앱 내장 검사 · 시트 규칙과 별개 · 일부 유형만
          </span>
        </span>
      </summary>
      <ul className="spacing-folder-checklist caution-checklist">
        {bundles.map((bundle) => {
          const tip = bundle.tipLines.join('\n');
          return (
            <li key={bundle.bundleId} className="spacing-folder-row">
              <label className="spacing-folder-chip caution-chip" title={tip}>
                <input
                  type="checkbox"
                  checked={enabled[bundle.bundleId] === true}
                  onChange={() => onSpacingFolderToggle(bundle.bundleId)}
                />
                <span className="caution-chip-label">{bundle.label}</span>
              </label>
            </li>
          );
        })}
      </ul>
    </details>
  );
}
