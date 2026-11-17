import { useEffect, useRef } from 'react';
import {
  isAuxiliaryVerbBundleEnabled,
  isAuxiliaryVerbBundlePartial,
  listAuxiliaryVerbBundles,
} from '../../lib/auxiliaryVerbRegister.js';

/**
 * 본조 마스터 체크 3줄 — 각 줄이 묶음 itemId 규칙 전체 on/off
 *
 * @param {{
 *   customRules: import('../../lib/ruleTypes.js').Rule[],
 *   onToggle: (bundleId: string, enabled: boolean) => void,
 *   disabled?: boolean,
 * }} props
 */
export default function AuxiliaryVerbBundleChecklist({
  customRules,
  onToggle,
  disabled = false,
}) {
  const bundles = listAuxiliaryVerbBundles();
  return (
    <div className="auxiliary-checklist auxiliary-checklist--bundles">
      <ul className="tail-list auxiliary-bundle-list" aria-label="본용언+보조용언">
        {bundles.map((bundle) => (
          <AuxiliaryBundleRow
            key={bundle.bundleId}
            bundle={bundle}
            customRules={customRules}
            onToggle={onToggle}
            disabled={disabled}
          />
        ))}
      </ul>
    </div>
  );
}

/**
 * @param {{
 *   bundle: { bundleId: string, label: string },
 *   customRules: import('../../lib/ruleTypes.js').Rule[],
 *   onToggle: (bundleId: string, enabled: boolean) => void,
 *   disabled?: boolean,
 * }} props
 */
function AuxiliaryBundleRow({ bundle, customRules, onToggle, disabled }) {
  const inputRef = useRef(/** @type {HTMLInputElement | null} */ (null));
  const checked = isAuxiliaryVerbBundleEnabled(customRules, bundle.bundleId);
  const partial = isAuxiliaryVerbBundlePartial(customRules, bundle.bundleId);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.indeterminate = partial;
    }
  }, [partial, checked]);

  return (
    <li className="auxiliary-bundle-row">
      <label className="auxiliary-chip auxiliary-chip--bundle">
        <input
          ref={inputRef}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onToggle(bundle.bundleId, e.target.checked)}
        />
        <span className="find">{bundle.label}</span>
      </label>
    </li>
  );
}