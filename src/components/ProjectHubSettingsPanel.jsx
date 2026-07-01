import { useEffect, useId, useMemo, useState } from 'react';
import {
  MAX_PROJECT_FORMAT_LABEL_LENGTH,
  MAX_PROJECT_PROOF_REVISION_LENGTH,
  normalizeProjectMemo,
  normalizeProjectTags,
} from '../lib/projectMeta.js';
import { buildProjectCardPillarPreviews } from '../presentation/projectCardViewModel.js';
import ProjectHubCriteriaPanel from './projectHub/ProjectHubCriteriaPanel.jsx';
import './project-hub-settings.css';

/** @typedef {'meta' | 'manuscript' | 'actions'} ProjectHubSettingsSection */

const NAV_ITEMS = [
  { id: 'meta', label: '프로젝트 정보' },
  { id: 'manuscript', label: '프로젝트 편집' },
  { id: 'actions', label: '작업 이력' },
];

/**
 * @param {{
 *   card: import('../presentation/projectCardViewModel.js').ProjectCardViewModel,
 *   ruleSet?: import('../lib/ruleSetsStorage.js').RuleSet | null,
 *   pdfFileName?: string,
 *   pdfPageCount?: number,
 *   lastWorkedAt?: string,
 *   saving?: boolean,
 *   criteriaSaving?: boolean,
 *   onSave: (payload: {
 *     name?: string,
 *     tags: string[],
 *     memo?: string,
 *     proofRevision?: string,
 *     formatLabel?: string,
 *   }) => void | Promise<void>,
 *   onCustomRulesChange?: (
 *     rules: import('../lib/ruleTypes.js').Rule[],
 *   ) => void | Promise<void>,
 *   onStartWork?: () => void,
 *   onDuplicate?: () => void,
 *   onSharePreview?: () => void,
 * }} props
 */
export default function ProjectHubSettingsPanel({
  card,
  ruleSet = null,
  pdfFileName: _pdfFileName,
  pdfPageCount: _pdfPageCount,
  lastWorkedAt: _lastWorkedAt,
  saving = false,
  criteriaSaving = false,
  onSave,
  onCustomRulesChange,
  onStartWork,
  onDuplicate,
  onSharePreview,
}) {
  const tagsInputId = useId();
  const nameInputId = useId();
  const proofRevisionInputId = useId();
  const formatLabelInputId = useId();
  const memoInputId = useId();

  const [activeSection, setActiveSection] =
    useState(/** @type {ProjectHubSettingsSection} */ ('meta'));
  const [tagsInput, setTagsInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [memoInput, setMemoInput] = useState('');
  const [proofRevisionInput, setProofRevisionInput] = useState('');
  const [formatLabelInput, setFormatLabelInput] = useState('');

  useEffect(() => {
    setNameInput(card.title);
    setTagsInput(card.tags.join(', '));
    setMemoInput(card.memo ?? '');
    setProofRevisionInput(card.proofRevision ?? '');
    setFormatLabelInput(card.formatLabel ?? '');
  }, [card.id, card.title, card.tags, card.memo, card.proofRevision, card.formatLabel]);

  async function handleSave(event) {
    event.preventDefault();
    const tags = normalizeProjectTags(
      tagsInput
        .split(/[,，]/)
        .map((part) => part.trim())
        .filter(Boolean),
    );
    const memo = normalizeProjectMemo(memoInput);
    const proofRevision = proofRevisionInput
      .trim()
      .slice(0, MAX_PROJECT_PROOF_REVISION_LENGTH);
    const formatLabel = formatLabelInput
      .trim()
      .slice(0, MAX_PROJECT_FORMAT_LABEL_LENGTH);
    await onSave({
      name: nameInput.trim(),
      tags,
      memo,
      proofRevision: proofRevision || undefined,
      formatLabel: formatLabel || undefined,
    });
  }

  const pillarRows = useMemo(
    () => buildProjectCardPillarPreviews(card),
    [card],
  );

  return (
    <section
      className="project-hub-settings"
      aria-label={`${card.title} 프로젝트 설정`}
    >
      <div className="project-hub-settings__layout">
        <nav className="project-hub-settings__nav" aria-label="설정 구역">
          <ul className="project-hub-settings__nav-list">
            {NAV_ITEMS.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={`project-hub-settings__nav-btn${
                    activeSection === item.id
                      ? ' project-hub-settings__nav-btn--active'
                      : ''
                  }`}
                  onClick={() => setActiveSection(item.id)}
                >
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="project-hub-settings__main">
          {activeSection === 'meta' ? (
            <form className="project-hub-settings__form" onSubmit={(e) => void handleSave(e)}>
              <div className="project-hub-settings__group">
                <div className="project-hub-settings__card">
                  <div className="project-hub-settings__row">
                    <div className="project-hub-settings__row-text">
                      <label
                        className="project-hub-settings__row-label"
                        htmlFor={nameInputId}
                      >
                        이름
                      </label>
                      <p className="project-hub-settings__row-desc">
                        프로젝트 표시 이름
                      </p>
                    </div>
                    <input
                      id={nameInputId}
                      className="project-hub-settings__input project-hub-settings__input--wide"
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      placeholder="프로젝트 이름"
                      maxLength={60}
                      disabled={saving}
                      autoComplete="off"
                    />
                  </div>

                  <div className="project-hub-settings__row">
                    <div className="project-hub-settings__row-text">
                      <label
                        className="project-hub-settings__row-label"
                        htmlFor={tagsInputId}
                      >
                        태그
                      </label>
                      <p className="project-hub-settings__row-desc">
                        쉼표로 구분 · 최대 8개
                      </p>
                    </div>
                    <input
                      id={tagsInputId}
                      className="project-hub-settings__input project-hub-settings__input--wide"
                      value={tagsInput}
                      onChange={(e) => setTagsInput(e.target.value)}
                      placeholder="문학, 시리즈 2/5"
                      disabled={saving}
                      autoComplete="off"
                    />
                  </div>

                  <div className="project-hub-settings__row">
                    <div className="project-hub-settings__row-text">
                      <label
                        className="project-hub-settings__row-label"
                        htmlFor={proofRevisionInputId}
                      >
                        교차
                      </label>
                      <p className="project-hub-settings__row-desc">
                        교열·교차 차수 표기
                      </p>
                    </div>
                    <input
                      id={proofRevisionInputId}
                      className="project-hub-settings__input"
                      value={proofRevisionInput}
                      onChange={(e) => setProofRevisionInput(e.target.value)}
                      placeholder="3교"
                      disabled={saving}
                      autoComplete="off"
                    />
                  </div>

                  <div className="project-hub-settings__row">
                    <div className="project-hub-settings__row-text">
                      <label
                        className="project-hub-settings__row-label"
                        htmlFor={formatLabelInputId}
                      >
                        판형, 페이지
                      </label>
                      <p className="project-hub-settings__row-desc">
                        신국판 · 페이지 수 등
                      </p>
                    </div>
                    <input
                      id={formatLabelInputId}
                      className="project-hub-settings__input"
                      value={formatLabelInput}
                      onChange={(e) => setFormatLabelInput(e.target.value)}
                      placeholder="신국판"
                      disabled={saving}
                      autoComplete="off"
                    />
                  </div>

                  <div className="project-hub-settings__row project-hub-settings__row--stack">
                    <div className="project-hub-settings__row-text">
                      <label
                        className="project-hub-settings__row-label"
                        htmlFor={memoInputId}
                      >
                        메모
                      </label>
                      <p className="project-hub-settings__row-desc">
                        프로젝트에만 남는 메모
                      </p>
                    </div>
                    <textarea
                      id={memoInputId}
                      className="project-hub-settings__textarea"
                      value={memoInput}
                      onChange={(e) => setMemoInput(e.target.value)}
                      rows={3}
                      disabled={saving}
                    />
                  </div>
                </div>
              </div>

              <footer className="project-hub-settings__footer">
                <button
                  type="submit"
                  className="btn-run project-hub-settings__save"
                  disabled={saving}
                  aria-busy={saving}
                >
                  {saving ? '저장 중…' : '저장'}
                </button>
              </footer>
            </form>
          ) : null}

          {activeSection === 'manuscript' && ruleSet && onCustomRulesChange ? (
            <div className="project-hub-settings__group">
              <div className="project-hub-settings__card project-hub-settings__card--criteria">
                <ProjectHubCriteriaPanel
                  pillarRows={pillarRows}
                  ruleSet={ruleSet}
                  criteriaSaving={criteriaSaving}
                  onCustomRulesChange={onCustomRulesChange}
                  onStartWork={onStartWork}
                />
              </div>
            </div>
          ) : null}

          {activeSection === 'actions' ? (
            <div className="project-hub-settings__group">
              <div className="project-hub-settings__card project-hub-settings__card--actions">
                <button
                  type="button"
                  className="sheet-card__btn sheet-card__btn--primary sheet-card__btn--work"
                  onClick={onStartWork}
                >
                  이 프로젝트 작업하기
                </button>
                <button
                  type="button"
                  className="sheet-card__btn sheet-card__btn--secondary"
                  onClick={onDuplicate}
                >
                  복제
                </button>
                <button
                  type="button"
                  className="sheet-card__btn sheet-card__btn--secondary"
                  onClick={onSharePreview}
                >
                  공유
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
