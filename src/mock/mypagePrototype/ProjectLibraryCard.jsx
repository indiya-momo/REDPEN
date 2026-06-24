import { useCallback, useId, useMemo, useState } from 'react';
import {
  buildProjectCardPillarPreviews,
  formatProjectCardMetaLine,
  formatProjectCardScheduleLines,
} from '../../presentation/projectCardViewModel.js';

/**
 * @param {{
 *   card: import('../../presentation/projectCardViewModel.js').ProjectCardViewModel,
 *   readOnly?: boolean,
 *   showStartWork?: boolean,
 *   onRename: (title: string) => void,
 *   onUpdateMeta: (patch: { memo?: string, tags?: string[] }) => void,
 *   onStartWork: () => void,
 *   onDuplicate: () => void,
 *   onSharePreview: () => void,
 * }} props
 */
export default function ProjectLibraryCard({
  card,
  readOnly = false,
  showStartWork = false,
  onRename,
  onUpdateMeta: _onUpdateMeta,
  onStartWork,
  onDuplicate,
  onSharePreview,
}) {
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(card.title);
  const nameInputId = useId();

  const commitName = useCallback(() => {
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

  const scheduleLines = formatProjectCardScheduleLines(card);

  const tabLabels = useMemo(() => {
    if (card.tags.length > 0) return card.tags;
    if (card.savedDate) return [card.savedDate];
    return ['프로젝트'];
  }, [card.tags, card.savedDate]);

  const showWorkButton = showStartWork || !readOnly;

  return (
    <article
      className={`sheet-card${card.isActive ? ' sheet-card--active' : ''}${readOnly ? ' sheet-card--readonly' : ''}${card.dirty ? ' sheet-card--dirty' : ''}`}
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
          {editingName && !readOnly ? (
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
                autoFocus
              />
            </label>
          ) : readOnly ? (
            <h2 className="sheet-card__title">《{card.title}》</h2>
          ) : (
            <button
              type="button"
              className="sheet-card__title-field"
              onClick={() => {
                setNameDraft(card.title);
                setEditingName(true);
              }}
              aria-label={`프로젝트 이름 수정: ${card.title}`}
            >
              《{card.title}》
            </button>
          )}

          {scheduleLines.length > 0 ? (
            <div className="sheet-card__schedule">
              {scheduleLines.map((line) => (
                <span key={line} className="sheet-card__schedule-line">
                  {line}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <p className="sheet-card__meta">{formatProjectCardMetaLine(card)}</p>

        <p className="sheet-card__headline">{card.headline}</p>

        <div className="sheet-card__sections" aria-label="표기 기준 구역">
          {pillarRows.map((section) => (
            <section
              key={section.key}
              className={`sheet-card__section sheet-card__section--${section.key}`}
            >
              <div className="sheet-card__section-head">
                <span className="sheet-card__section-label">{section.label}</span>
              </div>
              <div className="sheet-card__section-row">
                {section.chips.length > 0 ? (
                  <div className="sheet-card__chips" aria-label={`${section.label} 미리보기`}>
                    {section.chips.map((chip) => (
                      <span
                        key={chip.label}
                        className={`sheet-card__chip${chip.active === false ? ' sheet-card__chip--off' : ''}`}
                      >
                        {chip.label}
                      </span>
                    ))}
                    {section.hasMore ? (
                      <span className="sheet-card__chip-more" aria-hidden>
                        …
                      </span>
                    ) : null}
                  </div>
                ) : (
                  <div className="sheet-card__chips sheet-card__chips--empty" aria-hidden />
                )}
                <span
                  className="sheet-card__section-count"
                  aria-label={`${section.label} ${section.count}건`}
                >
                  {section.count}
                </span>
              </div>
            </section>
          ))}
        </div>

        {showWorkButton ? (
          <footer className="sheet-card__footer">
            <button
              type="button"
              className="sheet-card__btn sheet-card__btn--primary sheet-card__btn--work"
              onClick={onStartWork}
            >
              이 프로젝트 작업하기
            </button>
            {!readOnly ? (
              <>
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
              </>
            ) : null}
          </footer>
        ) : null}
      </div>
    </article>
  );
}
