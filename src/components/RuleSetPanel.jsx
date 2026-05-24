import { MessageSquare } from 'lucide-react';
import TooltipGuide from './TooltipGuide.jsx';
import {
  formatRuleSetSavedDate,
  formatRuleSetSummary,
} from '../lib/ruleSetsStorage.js';

/**
 * @param {{
 *   ruleSets: { id: string, name: string }[],
 *   activeSetId: string,
 *   ruleSetName: string,
 *   onSelectSet: (id: string) => void,
 *   onRuleSetNameChange: (name: string) => void,
 *   onCreateSet: () => void,
 *   onDuplicateSet: () => void,
 *   onDeleteSet: () => void,
 *   onSave: () => void,
 *   onOpenFeedback?: () => void,
 *   ruleSetSavedAt?: string,
 *   spellingRuleCount?: number,
 *   consistencyRuleCount?: number,
 * }} props
 */
export default function RuleSetPanel({
  ruleSets,
  activeSetId,
  ruleSetName,
  ruleSetSavedAt,
  onSelectSet,
  onRuleSetNameChange,
  onCreateSet,
  onDuplicateSet,
  onDeleteSet,
  onSave,
  onOpenFeedback,
  spellingRuleCount = 0,
  consistencyRuleCount = 0,
}) {
  const canDelete = ruleSets.length > 1;
  const summaryText = formatRuleSetSummary({
    savedAt: ruleSetSavedAt,
    spellingRuleCount,
    consistencyRuleCount,
  });
  const savedDateLabel = formatRuleSetSavedDate(ruleSetSavedAt);

  return (
    <section className="ruleset-panel" aria-label="규칙 세트">
      <div className="ruleset-panel__line">
        <label className="ruleset-panel__label" htmlFor="ruleset-select">
          규칙 세트
        </label>
        <p className="ruleset-panel__summary" aria-live="polite" title={summaryText}>
          {savedDateLabel ? (
            <span className="ruleset-panel__summary-date">{savedDateLabel}</span>
          ) : null}
          {savedDateLabel ? ' ' : null}
          맞춤법 규칙 <strong>{spellingRuleCount}</strong>건 · 일관성 규칙{' '}
          <strong>{consistencyRuleCount}</strong>건
        </p>
        <select
          id="ruleset-select"
          className="field-input ruleset-panel__select"
          value={activeSetId}
          onChange={(e) => onSelectSet(e.target.value)}
          title="저장된 규칙 세트 선택"
        >
          {ruleSets.map((set) => (
            <option key={set.id} value={set.id}>
              {set.name.trim() || '이름 없음'}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="ruleset-name">
          제목
        </label>
        <input
          id="ruleset-name"
          type="text"
          className="field-input ruleset-panel__name"
          value={ruleSetName}
          onChange={(e) => onRuleSetNameChange(e.target.value)}
          placeholder="제목을 입력하세요"
        />
        <button
          type="button"
          className="btn-ghost ruleset-panel__action"
          onClick={onCreateSet}
        >
          새 세트
        </button>
        <button
          type="button"
          className="btn-ghost ruleset-panel__action"
          onClick={onDuplicateSet}
        >
          복제
        </button>
        <button
          type="button"
          className="btn-ghost ruleset-panel__action ruleset-panel__action--danger"
          onClick={onDeleteSet}
          disabled={!canDelete}
          title={canDelete ? '현재 규칙 세트 삭제' : '마지막 세트는 삭제할 수 없습니다'}
        >
          삭제
        </button>
        <button type="button" className="btn-primary ruleset-panel__save" onClick={onSave}>
          저장
        </button>
        {onOpenFeedback ? (
          <TooltipGuide
            storageKey="feedback-button"
            title="피드백"
            message="불편한 점이나 바라는 기능이 있으면 알려 주세요."
            placement="left"
          >
            <button
              type="button"
              className="ruleset-panel__feedback"
              onClick={onOpenFeedback}
            >
              <MessageSquare size={18} aria-hidden />
              피드백 보내기
            </button>
          </TooltipGuide>
        ) : null}
      </div>
    </section>
  );
}
