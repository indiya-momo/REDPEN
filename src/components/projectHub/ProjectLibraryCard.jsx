import { useCallback, useId, useMemo, useState } from 'react';
import {
  buildProjectCardDisplayTags,
  buildProjectCardPillarPreviews,
  formatProjectCardCompactDateLine,
  formatProjectCardEditionValues,
  formatProjectCardLastModifiedLabel,
} from '../../presentation/projectCardViewModel.js';

/**
 * @param {{ title: string, className?: string, titleAttr?: string }} props
 */
function SheetCardBookTitle({ title }) {
  const trimmed = title.trim();
  return (
    <span className="sheet-card__title-line">
      <span className="sheet-card__title-glyph" aria-hidden>
        《
      </span>
      <span className="sheet-card__title-text">{trimmed}</span>
      <span className="sheet-card__title-glyph" aria-hidden>
        》
      </span>
    </span>
  );
}

/**
 * @param {{
 *   card: import('../../presentation/projectCardViewModel.js').ProjectCardViewModel,
 *   readOnly?: boolean,
 *   showStartWork?: boolean,
 *   compact?: boolean,
 *   selected?: boolean,
 *   onSelect?: () => void,
 *   nameEditable?: boolean,
 *   onRename?: (title: string) => void,
 *   onStartWork?: () => void,
 *   onDuplicate?: () => void,
 *   onDelete?: () => void,
 *   onSharePreview?: () => void,
 *   onCreateShareLink?: () => void,
 * }} props
 */
export default function ProjectLibraryCard({
  card,
  readOnly = false,
  showStartWork = false,
  compact = false,
  selected = false,
  onSelect,
  nameEditable,
  onRename,
  onStartWork = () => {},
  onDuplicate = () => {},
  onDelete,
  onSharePreview = () => {},
  onCreateShareLink,
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
  const displayTags = useMemo(
    () => buildProjectCardDisplayTags(card),
    [card],
  );

  const lastModifiedLabel = formatProjectCardLastModifiedLabel(card);
  const editionValues = formatProjectCardEditionValues(card);

  const showWorkButton = !compact && (showStartWork || !readOnly);
  const compactDateLine = formatProjectCardCompactDateLine(card);

  const titleBlock = editingName && allowNameEdit ? (
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
      title={`《${card.title}》`}
    >
      <SheetCardBookTitle title={card.title} />
    </button>
  ) : (
    <h2 className="sheet-card__title" title={`《${card.title}》`}>
      <SheetCardBookTitle title={card.title} />
    </h2>
  );

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
          <p className="sheet-card__folder-title" title={`《${card.title}》`}>
            <SheetCardBookTitle title={card.title} />
          </p>
          {compactDateLine ? (
            <p className="sheet-card__folder-date">{compactDateLine}</p>
          ) : null}
        </div>
      </article>
    );
  }

  return (
    <article
      className={`sheet-card${card.isActive ? ' sheet-card--active' : ''}${selected ? ' sheet-card--selected' : ''}${readOnly ? ' sheet-card--readonly' : ''}`}
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
      <div className="sheet-card__tabs" aria-hidden={displayTags.length === 0}>
        {displayTags.length > 0 ? (
          displayTags.map((tag, index) => (
            <span
              key={`${tag}-${index}`}
              className={`sheet-card__tab sheet-card__tab--tag${index === 0 ? ' sheet-card__tab--lead' : ''}`}
            >
              {tag}
            </span>
          ))
        ) : (
          <span className="sheet-card__tab sheet-card__tab--tag sheet-card__tab--lead sheet-card__tab--ghost" />
        )}
      </div>

      <div className="sheet-card__body">
        <div className="sheet-card__head">
          <div className="sheet-card__title-block">
            <div className="sheet-card__title-main">{titleBlock}</div>
            <div className="sheet-card__meta-stack">
              <span className="sheet-card__date-chip">{lastModifiedLabel}</span>
              <p
                className={`sheet-card__edition-line${editionValues ? '' : ' sheet-card__edition-line--ghost'}`}
                aria-hidden={editionValues ? undefined : true}
              >
                {editionValues || '\u00a0'}
              </p>
            </div>
          </div>
        </div>

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
                {onDelete ? (
                  <button
                    type="button"
                    className="sheet-card__btn sheet-card__btn--secondary"
                    onClick={(event) => {
                      event.stopPropagation();
                      onDelete();
                    }}
                  >
                    삭제
                  </button>
                ) : null}
                <button
                  type="button"
                  className="sheet-card__btn sheet-card__btn--secondary"
                  onClick={(event) => {
                    event.stopPropagation();
                    onSharePreview();
                  }}
                >
                  미리보기
                </button>
                {onCreateShareLink ? (
                  <button
                    type="button"
                    className="sheet-card__btn sheet-card__btn--secondary"
                    onClick={(event) => {
                      event.stopPropagation();
                      onCreateShareLink();
                    }}
                  >
                    공유 링크
                  </button>
                ) : null}
              </>
            ) : null}
          </footer>
        ) : null}
      </div>
    </article>
  );
}
