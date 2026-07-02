import { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
  MAX_PROJECT_FORMAT_LABEL_LENGTH,
  MAX_PROJECT_PROOF_REVISION_LENGTH,
  normalizeProjectMemo,
  normalizeProjectTags,
} from '../lib/projectMeta.js';
import ProjectHubCriteriaPanel from './projectHub/ProjectHubCriteriaPanel.jsx';
import './project-hub-settings.css';

/** @typedef {'meta' | 'spelling' | 'consistency' | 'auxiliary' | 'actions'} ProjectHubSettingsSection */

const NAV_ITEMS = [
  { id: 'meta', label: '프로젝트 정보' },
  { id: 'spelling', label: '맞춤법', pillarKey: 'spelling' },
  { id: 'consistency', label: '표기 통일', pillarKey: 'consistency' },
  { id: 'auxiliary', label: '본용언 + 보조용언', pillarKey: 'auxiliary' },
  { id: 'actions', label: '작업 이력' },
];

const CRITERIA_SECTIONS = new Set(['spelling', 'consistency', 'auxiliary']);
const META_AUTOSAVE_MS = 400;

/** @param {import('../presentation/projectCardViewModel.js').ProjectCardViewModel} card */
function buildCardMetaSyncKey(card) {
  return [
    card.title,
    card.tags.join('\u0001'),
    card.memo ?? '',
    card.proofRevision ?? '',
    card.formatLabel ?? '',
  ].join('\u0002');
}

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
 *   }, cardId?: string) => void | Promise<{ ok?: boolean } | void>,
 *   onCriteriaChange?: (
 *     patch: {
 *       customRules?: import('../lib/ruleTypes.js').Rule[],
 *       builtInEnabled?: Record<string, boolean>,
 *       cautionEnabled?: Record<string, boolean>,
 *     },
 *   ) => void | Promise<void>,
 *   onStartWork?: () => void,
 *   onDuplicate?: () => void,
 *   onDelete?: () => void,
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
  onCriteriaChange,
  onStartWork,
  onDuplicate,
  onDelete,
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

  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;
  const activeSectionRef = useRef(activeSection);
  activeSectionRef.current = activeSection;
  const skipMetaAutosaveRef = useRef(true);
  const metaDirtyRef = useRef(false);
  const metaInputRef = useRef({
    nameInput,
    tagsInput,
    memoInput,
    proofRevisionInput,
    formatLabelInput,
  });
  metaInputRef.current = {
    nameInput,
    tagsInput,
    memoInput,
    proofRevisionInput,
    formatLabelInput,
  };

  const markMetaDirty = useCallback(() => {
    metaDirtyRef.current = true;
  }, []);

  const buildMetaPayloadFromRef = useCallback(() => {
    const {
      nameInput: name,
      tagsInput: tagsRaw,
      memoInput: memoRaw,
      proofRevisionInput: proofRevisionRaw,
      formatLabelInput: formatLabelRaw,
    } = metaInputRef.current;
    const tags = normalizeProjectTags(
      tagsRaw
        .split(/[,，]/)
        .map((part) => part.trim())
        .filter(Boolean),
    );
    const memo = normalizeProjectMemo(memoRaw);
    const proofRevision = proofRevisionRaw
      .trim()
      .slice(0, MAX_PROJECT_PROOF_REVISION_LENGTH);
    const formatLabel = formatLabelRaw
      .trim()
      .slice(0, MAX_PROJECT_FORMAT_LABEL_LENGTH);
    return {
      name: name.trim(),
      tags,
      memo,
      proofRevision: proofRevision || undefined,
      formatLabel: formatLabel || undefined,
    };
  }, []);

  const syncFormFromCard = useCallback((sourceCard) => {
    setNameInput(sourceCard.title);
    setTagsInput(sourceCard.tags.join(', '));
    setMemoInput(sourceCard.memo ?? '');
    setProofRevisionInput(sourceCard.proofRevision ?? '');
    setFormatLabelInput(sourceCard.formatLabel ?? '');
  }, []);

  const flushMetaSave = useCallback(async (forCardId) => {
    if (!metaDirtyRef.current) return true;
    try {
      const result = await onSaveRef.current(
        buildMetaPayloadFromRef(),
        forCardId,
      );
      if (result && typeof result === 'object' && result.ok === false) {
        metaDirtyRef.current = true;
        return false;
      }
      metaDirtyRef.current = false;
      return true;
    } catch {
      metaDirtyRef.current = true;
      return false;
    }
  }, [buildMetaPayloadFromRef]);

  const flushMetaSaveRef = useRef(flushMetaSave);
  flushMetaSaveRef.current = flushMetaSave;

  const prevCardIdRef = useRef(card.id);
  const cardMetaSyncKey = buildCardMetaSyncKey(card);

  useEffect(() => {
    const cardSwitched = prevCardIdRef.current !== card.id;
    prevCardIdRef.current = card.id;
    if (cardSwitched) {
      metaDirtyRef.current = false;
    }
    if (cardSwitched || !metaDirtyRef.current) {
      syncFormFromCard(card);
      skipMetaAutosaveRef.current = true;
    }
  }, [card, card.id, cardMetaSyncKey, syncFormFromCard]);

  useEffect(() => {
    const saveForCardId = card.id;
    return () => {
      void flushMetaSaveRef.current(saveForCardId);
    };
  }, [card.id]);

  useEffect(() => {
    if (activeSection !== 'meta') return undefined;

    if (skipMetaAutosaveRef.current) {
      skipMetaAutosaveRef.current = false;
      return () => {
        if (activeSectionRef.current !== 'meta') {
          void flushMetaSaveRef.current(card.id);
        }
      };
    }

    const saveForCardId = card.id;
    const timer = setTimeout(() => {
      void flushMetaSaveRef.current(saveForCardId);
    }, META_AUTOSAVE_MS);

    return () => {
      clearTimeout(timer);
      if (activeSectionRef.current !== 'meta') {
        void flushMetaSaveRef.current(saveForCardId);
      }
    };
  }, [
    activeSection,
    card.id,
    nameInput,
    tagsInput,
    memoInput,
    proofRevisionInput,
    formatLabelInput,
  ]);

  const showCriteriaPanel =
    CRITERIA_SECTIONS.has(activeSection) && ruleSet && onCriteriaChange;

  return (
    <section
      className="project-hub-settings"
      aria-label={`${card.title} 프로젝트 설정`}
    >
      <div className="project-hub-settings__layout">
        <nav className="project-hub-settings__nav" aria-label="설정 구역">
          <ul className="project-hub-settings__nav-list">
            {NAV_ITEMS.map((item) => {
              const isActive = activeSection === item.id;
              const pillarKey =
                'pillarKey' in item ? item.pillarKey : undefined;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className={[
                      'project-hub-settings__nav-btn',
                      isActive ? 'project-hub-settings__nav-btn--active' : '',
                      pillarKey
                        ? `project-hub-settings__nav-btn--${pillarKey}`
                        : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => setActiveSection(item.id)}
                  >
                    {item.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="project-hub-settings__main">
          {activeSection === 'meta' ? (
            <div className="project-hub-settings__form">
              <div className="project-hub-settings__group">
                <div className="project-hub-settings__card">
                  <div className="project-hub-settings__row">
                    <div className="project-hub-settings__row-text">
                      <label
                        className="project-hub-settings__row-label"
                        htmlFor={nameInputId}
                      >
                        제목
                      </label>
                      <p className="project-hub-settings__row-desc">
                        프로젝트 제목
                      </p>
                    </div>
                    <input
                      id={nameInputId}
                      className="project-hub-settings__input project-hub-settings__input--wide"
                      value={nameInput}
                      onChange={(e) => {
                        markMetaDirty();
                        setNameInput(e.target.value);
                      }}
                      placeholder="프로젝트 제목"
                      maxLength={60}
                      aria-busy={saving}
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
                        쉼표로 구분 · 최대 3개
                      </p>
                    </div>
                    <input
                      id={tagsInputId}
                      className="project-hub-settings__input project-hub-settings__input--wide"
                      value={tagsInput}
                      onChange={(e) => {
                        markMetaDirty();
                        setTagsInput(e.target.value);
                      }}
                      placeholder="문학, 시리즈 2/5"
                      aria-busy={saving}
                      autoComplete="off"
                    />
                  </div>

                  <div className="project-hub-settings__row">
                    <div className="project-hub-settings__row-text">
                      <label
                        className="project-hub-settings__row-label"
                        htmlFor={proofRevisionInputId}
                      >
                        교정교열
                      </label>
                      <p className="project-hub-settings__row-desc">
                        예: 3교
                      </p>
                    </div>
                    <input
                      id={proofRevisionInputId}
                      className="project-hub-settings__input"
                      value={proofRevisionInput}
                      onChange={(e) => {
                        markMetaDirty();
                        setProofRevisionInput(e.target.value);
                      }}
                      placeholder="3교"
                      aria-busy={saving}
                      autoComplete="off"
                    />
                  </div>

                  <div className="project-hub-settings__row">
                    <div className="project-hub-settings__row-text">
                      <label
                        className="project-hub-settings__row-label"
                        htmlFor={formatLabelInputId}
                      >
                        판형
                      </label>
                      <p className="project-hub-settings__row-desc">
                        예: 신국판
                      </p>
                    </div>
                    <input
                      id={formatLabelInputId}
                      className="project-hub-settings__input"
                      value={formatLabelInput}
                      onChange={(e) => {
                        markMetaDirty();
                        setFormatLabelInput(e.target.value);
                      }}
                      placeholder="신국판"
                      aria-busy={saving}
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
                      onChange={(e) => {
                        markMetaDirty();
                        setMemoInput(e.target.value);
                      }}
                      rows={3}
                      aria-busy={saving}
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {showCriteriaPanel ? (
            <div className="project-hub-settings__group">
              <div className="project-hub-settings__card project-hub-settings__card--criteria">
                <ProjectHubCriteriaPanel
                  section={activeSection}
                  ruleSet={ruleSet}
                  criteriaSaving={criteriaSaving}
                  onCriteriaChange={onCriteriaChange}
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
                {onDelete ? (
                  <button
                    type="button"
                    className="sheet-card__btn sheet-card__btn--secondary"
                    onClick={onDelete}
                  >
                    삭제
                  </button>
                ) : null}
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
