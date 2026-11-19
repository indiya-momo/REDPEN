import { useEffect, useMemo, useRef, useState } from 'react';
import {
  listSpacingFolderBundles,
  normalizeSpacingFolderEnabled,
} from '../lib/spacingFolderBundles.js';
import DetailsChevron from './DetailsChevron.jsx';

/**
 * 맞춤법 탭 「띄어쓰기」 폴더 — 묶음 on/off.
 * 행 마크업은 BuiltinSpellingPanel 규칙 행과 같다(체크박스 · 이름 · 찾을 말 → 바꿀 말 · 클릭 팁).
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
  const [openTipId, setOpenTipId] = useState(/** @type {string | null} */ (null));
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
      <ul className="rule-list builtin-rule-list spacing-folder-checklist caution-checklist">
        <li>
          <div className="builtin-rule-group builtin-rule-group--cols-1">
            {bundles.map((bundle) => {
              const tipOpen = openTipId === bundle.bundleId;
              const toggleTip = () =>
                setOpenTipId((prev) => (prev === bundle.bundleId ? null : bundle.bundleId));
              return (
                <div key={bundle.bundleId} className="builtin-rule-entry-wrap">
                  <div className="builtin-rule-entry">
                    <div className="builtin-rule-row-wrap builtin-rule-item">
                      <div className="rule-row builtin-rule-row">
                        <input
                          type="checkbox"
                          checked={enabled[bundle.bundleId] === true}
                          onChange={() => onSpacingFolderToggle(bundle.bundleId)}
                          aria-label={bundle.label}
                        />
                        <div className="rule-text builtin-rule-text">
                          <span
                            className={`builtin-rule-label caution-inline-tip-trigger${tipOpen ? ' caution-inline-tip-trigger--open' : ''}`}
                            role="button"
                            tabIndex={0}
                            onClick={toggleTip}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                toggleTip();
                              }
                            }}
                            aria-expanded={tipOpen}
                          >
                            <span className="spacing-folder-label">{bundle.label}</span>
                            {bundle.example ? (
                              <span className="spacing-folder-example">
                                <span className="find">{bundle.example.find}</span>
                                <span className="arrow">→</span>
                                <span className="replace">{bundle.example.replace}</span>
                              </span>
                            ) : null}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  {tipOpen ? (
                    <div className="builtin-rule-tip-inline">{bundle.tipLines.join('\n')}</div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </li>
      </ul>
    </details>
  );
}
