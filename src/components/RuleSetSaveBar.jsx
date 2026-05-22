/**
 * @param {{
 *   ruleSetName: string,
 *   onRuleSetNameChange: (v: string) => void,
 *   onSave: () => void,
 * }} props
 */
export default function RuleSetSaveBar({
  ruleSetName,
  onRuleSetNameChange,
  onSave,
}) {
  return (
    <div className="ruleset-save-bar" role="region" aria-label="규칙 세트 저장">
      <label className="field-label ruleset-save-bar__label">규칙 세트</label>
      <input
        type="text"
        className="field-input ruleset-save-bar__input"
        value={ruleSetName}
        onChange={(e) => onRuleSetNameChange(e.target.value)}
      />
      <button type="button" className="btn-primary ruleset-save-bar__btn" onClick={onSave}>
        저장
      </button>
      <span className="hint ruleset-save-bar__hint">
        일관성 규칙만 이 브라우저에 저장됩니다.
      </span>
    </div>
  );
}
