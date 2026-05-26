import { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, MessageSquare } from 'lucide-react';
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
 *   builtInRuleCount?: number,
 *   builtInGuideRuleCount?: number,
 *   spacingRuleCount?: number,
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
  builtInRuleCount = 0,
  builtInGuideRuleCount = 0,
  spacingRuleCount = 0,
  consistencyRuleCount = 0,
}) {
  const canDelete = ruleSets.length > 1;
  const menuId = useId();
  const manageRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const [manageOpen, setManageOpen] = useState(false);

  const summaryText = formatRuleSetSummary({
    savedAt: ruleSetSavedAt,
    builtInRuleCount,
    spacingRuleCount,
    consistencyRuleCount,
  });
  const savedDateLabel = formatRuleSetSavedDate(ruleSetSavedAt);

  useEffect(() => {
    if (!manageOpen) return undefined;
    function close() {
      setManageOpen(false);
    }
    function onKeyDown(e) {
      if (e.key === 'Escape') close();
    }
    function onPointerDown(e) {
      const el = manageRef.current;
      if (el && !el.contains(/** @type {Node} */ (e.target))) close();
    }
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [manageOpen]);

  function runManageAction(action) {
    action();
    setManageOpen(false);
  }

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
          맞춤법 확인 <strong>{builtInRuleCount}</strong> · 규칙 제외{' '}
          <strong>{builtInGuideRuleCount}</strong> · 편집자 검토{' '}
          <strong>{spacingRuleCount}</strong> · 일관성{' '}
          <strong>{consistencyRuleCount}</strong>
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

        <div className="ruleset-panel__actions">
          <div className="ruleset-panel__manage" ref={manageRef}>
            <button
              type="button"
              className="btn-ghost ruleset-panel__manage-trigger"
              aria-expanded={manageOpen}
              aria-haspopup="menu"
              aria-controls={menuId}
              onClick={() => setManageOpen((open) => !open)}
            >
              세트 관리
              <ChevronDown
                size={14}
                aria-hidden
                className={
                  manageOpen ? 'ruleset-panel__chevron--open' : undefined
                }
              />
            </button>
            {manageOpen ? (
              <ul
                id={menuId}
                className="ruleset-panel__menu"
                role="menu"
                aria-label="규칙 세트 관리"
              >
                <li role="none">
                  <button
                    type="button"
                    className="ruleset-panel__menu-item"
                    role="menuitem"
                    onClick={() => runManageAction(onCreateSet)}
                  >
                    새 세트
                  </button>
                </li>
                <li role="none">
                  <button
                    type="button"
                    className="ruleset-panel__menu-item"
                    role="menuitem"
                    onClick={() => runManageAction(onDuplicateSet)}
                  >
                    복제
                  </button>
                </li>
                <li role="none">
                  <button
                    type="button"
                    className="ruleset-panel__menu-item ruleset-panel__menu-item--danger"
                    role="menuitem"
                    disabled={!canDelete}
                    title={
                      canDelete
                        ? '현재 규칙 세트 삭제'
                        : '마지막 세트는 삭제할 수 없습니다'
                    }
                    onClick={() => runManageAction(onDeleteSet)}
                  >
                    삭제
                  </button>
                </li>
              </ul>
            ) : null}
          </div>
          <button
            type="button"
            className="btn-primary ruleset-panel__save"
            onClick={onSave}
          >
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
      </div>
    </section>
  );
}
