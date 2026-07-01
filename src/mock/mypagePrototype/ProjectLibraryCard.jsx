import { useCallback, useId, useMemo, useState } from 'react';
import {
  buildProjectCardPillarPreviews,
  buildProjectCardTabLabels,
  formatProjectCardCompactDateLine,
  formatProjectCardMetaLine,
} from '../../presentation/projectCardViewModel.js';

/**
 * @param {{
 *   card: import('../../presentation/projectCardViewModel.js').ProjectCardViewModel,
 *   readOnly?: boolean,
 *   showStartWork?: boolean,
 *   compact?: boolean,
 *   selected?: boolean,
 *   onSelect?: () => void,
 *   onEditMeta?: () => void,
 *   nameEditable?: boolean,
 *   onRename?: (title: string) => void,
 *   onUpdateMeta?: (patch: { memo?: string, tags?: string[] }) => void,
 *   onStartWork?: () => void,
 *   onDuplicate?: () => void,
 *   onSharePreview?: () => void,
 * }} props
 */
export default function ProjectLibraryCard({
  card,
  readOnly = false,
  showStartWork = false,
  compact = false,
  selected = false,
  onSelect,
  onEditMeta,
  nameEditable,
  onRename,
  onUpdateMeta: _onUpdateMeta = () => {},
  onStartWork = () => {},
  onDuplicate = () => {},
  onSharePreview = () => {},
}) {
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(card.title);
  const nameInputId = useId();

  const allowNameEdit =
    !readOnly && (nameEditable ?? Boolean(onRename)) && Boolean(onRename);

  const commitName = useCallback(() => {
    if (!onRename) return;
    const trimmed = nameDraft.trim();
    if (trimmed && trimmed !== card.title) {
      onRename(trimmed);
    } else {
      setNameDraft(card.title);
    }
    setEditingName(false);
  }, [card.title, nameDraft, onRename]);

  const pillarRows = useMemo(
    () => buildProjectCardPillarPreviews(card),
    [card],
  );

  const tabLabels = useMemo(
    () => buildProjectCardTabLabels(card),
    [card],
  );

  const showWorkButton = !compact && (showStartWork || !readOnly);
  const compactDateLine = formatProjectCardCompactDateLine(card);

  if (compact) {
    return (
      <article
        className={`sheet-card sheet-card--compact sheet-card--folder${card.isActive ? ' sheet-card--active' : ''}${selected ? ' sheet-card--selected' : ''}${readOnly ? ' sheet-card--readonly' : ''}`}
        onClick={onSelect}
        onKeyDown={
          onSelect
            ? (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onSelect();
                }
              }
            : undefined
        }
        role={onSelect ? 'button' : undefined}
        tabIndex={onSelect ? 0 : undefined}
        aria-pressed={onSelect ? selected : undefined}
        aria-label={`${card.title}${compactDateLine ? `, ${compactDateLine}` : ''}`}
      >
        <div className="sheet-card__body sheet-card__body--folder">
          <p className="sheet-card__folder-title">《{card.title}》</p>
          {compactDateLine ? (
            <p className="sheet-card__folder-date">{compactDateLine}</p>
          ) : null}
        </div>
      </article>
    );
  }

  return (
    <article
      className={`sheet-card${card.isActive ? ' sheet-card--active' : ''}${selected ? ' sheet-card--selected' : ''}${readOnly ? ' sheet-card--readonly' : ''}${card.dirty ? ' sheet-card--dirty' : ''}`}
      onClick={onSelect}
      onKeyDown={
        onSelect
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onSelect();
              }
            }
          : undefined
      }
      role={onSelect ? 'button' : undefined}
      tabIndex={onSelect ? 0 : undefined}
      aria-pressed={onSelect ? selected : undefined}
    >
      <div className="sheet-card__tabs" aria-label="분류">
        {tabLabels.map((tag, index) => (
          <span
            key={`${tag}-${index}`}
            className={`sheet-card__tab${index === 0 ? ' sheet-card__tab--lead' : ''}`}
          >
            {tag}
          </span>
        ))}
      </div>

      <div className="sheet-card__body">
        <div className="sheet-card__head">
          {editingName && allowNameEdit ? (
            <label className="sheet-card__name-edit" htmlFor={nameInputId}>
              <span className="visually-hidden">프로젝트 이름</span>
              <input
                id={nameInputId}
                className="sheet-card__name-input sheet-card__name-input--active"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onBlur={commitName}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitName();
                  if (e.key === 'Escape') {
                    setNameDraft(card.title);
                    setEditingName(false);
                  }
                }}
                onClick={(event) => event.stopPropagation()}
                autoFocus
              />
            </label>
          ) : allowNameEdit ? (
            <button
              type="button"
              className="sheet-card__title-field"
              onClick={(event) => {
                event.stopPropagation();
                setNameDraft(card.title);
                setEditingName(true);
              }}
              aria-label={`프로젝트 이름 수정: ${card.title}`}
            >
              《{card.title}》
            </button>
          ) : (
            <h2 className="sheet-card__title">《{card.title}》</h2>
          )}

        </div>

        <p className="sheet-card__meta">{formatProjectCardMetaLine(card)}</p>

        <div className="sheet-card__sections" aria-label="표기 기준 구역">
          {pillarRows.map((section) => (
            <section
              key={section.key}
              className={`sheet-card__section sheet-card__section--${section.key} sheet-card__section--summary`}
            >
              <p className="sheet-card__pillar-summary">
                <span className="sheet-card__section-label">{section.label}</span>{' '}
                <span
                  className="sheet-card__section-count"
                  aria-label={`${section.label} ${section.count}건`}
                >
                  {section.count}
                </span>
              </p>
            </section>
          ))}
        </div>

        {showWorkButton ? (
          <footer className="sheet-card__footer">
            <button
              type="button"
              className="sheet-card__btn sheet-card__btn--primary sheet-card__btn--work"
              onClick={(event) => {
                event.stopPropagation();
                onStartWork();
              }}
            >
              이 프로젝트 작업하기
            </button>
            {!readOnly ? (
              <>
                <button
                  type="button"
                  className="sheet-card__btn sheet-card__btn--secondary"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDuplicate();
                  }}
                >
                  복제
                </button>
                <button
                  type="button"
                  className="sheet-card__btn sheet-card__btn--secondary"
                  onClick={(event) => {
                    event.stopPropagation();
                    onSharePreview();
                  }}
                >
                  공유
                </button>
              </>
            ) : null}
            {onEditMeta ? (
              <button
                type="button"
                className="sheet-card__btn sheet-card__btn--secondary"
                onClick={(event) => {
                  event.stopPropagation();
                  onEditMeta();
                }}
              >
                태그·메모
              </button>
            ) : null}
          </footer>
        ) : null}
      </div>
    </article>
  );
}
