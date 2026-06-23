import { useCallback, useId, useMemo, useState } from 'react';
import { formatProjectCardMetaLine, formatProjectCardScheduleLines } from '../../presentation/projectCardViewModel.js';

/** @type {readonly { key: string, label: string, match: (category: string) => boolean }[]} */
const PILLARS = [
  {
    key: 'spelling',
    label: '맞춤법',
    match: (c) => c.includes('맞춤법'),
  },
  {
    key: 'consistency',
    label: '일관성',
    match: (c) => c.includes('일관성'),
  },
  {
    key: 'auxiliary',
    label: '본·보조',
    match: (c) => c.includes('본용언') || c.includes('보조'),
  },
];

/**
 * @param {import('../../presentation/projectCardViewModel.js').ProjectCardViewModel} card
 * @param {string} key
 */
function pillarCount(card, key) {
  if (key === 'spelling') {
    return card.counts.editorReview + card.counts.spelling;
  }
  if (key === 'consistency') {
    return card.counts.find + card.counts.commonString;
  }
  return card.counts.auxiliary;
}

/**
 * @param {import('../../presentation/projectCardViewModel.js').ProjectCardViewModel} card
 * @param {(category: string) => boolean} match
 */
function pillarHighlight(card, match) {
  return card.highlights.find((row) => match(row.category));
}

/**
 * @param {{
 *   card: import('../../presentation/projectCardViewModel.js').ProjectCardViewModel,
 *   readOnly?: boolean,
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
  onRename,
  onUpdateMeta: _onUpdateMeta,
  onStartWork,
  onDuplicate,
  onSharePreview,
}) {
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(card.title);
  const [openSections, setOpenSections] = useState(
    () => new Set(readOnly ? PILLARS.map((p) => p.key) : []),
  );
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

  const toggleSection = useCallback((key) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const anyOpen = openSections.size > 0;

  const sectionRows = useMemo(
    () =>
      PILLARS.map((pillar) => ({
        ...pillar,
        count: pillarCount(card, pillar.key),
        highlight: pillarHighlight(card, pillar.match),
      })),
    [card],
  );

  const scheduleLines = formatProjectCardScheduleLines(card);

  return (
    <article
      className={`sheet-card${card.isActive ? ' sheet-card--active' : ''}${readOnly ? ' sheet-card--readonly' : ''}${card.dirty ? ' sheet-card--dirty' : ''}${anyOpen ? ' sheet-card--open' : ''}`}
    >
      {card.tags.length > 0 ? (
        <div className="sheet-card__tabs" aria-label="분류">
          {card.tags.map((tag, index) => (
            <span
              key={tag}
              className={`sheet-card__tab${index === 0 ? ' sheet-card__tab--lead' : ''}`}
            >
              {tag}
            </span>
          ))}
        </div>
      ) : null}

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

        <div className="sheet-card__sections" aria-label="표기 기준 구역">
          {sectionRows.map((section) => {
            const isOpen = openSections.has(section.key);
            const detail = section.highlight;
            return (
              <section
                key={section.key}
                className={`sheet-card__section sheet-card__section--${section.key}${isOpen ? ' is-open' : ''}`}
              >
                <button
                  type="button"
                  className="sheet-card__section-toggle"
                  aria-expanded={isOpen}
                  onClick={() => toggleSection(section.key)}
                >
                  <span className="sheet-card__section-chevron" aria-hidden />
                  <span className="sheet-card__section-label">{section.label}</span>
                  <span className="sheet-card__section-count">{section.count}</span>
                </button>
                {isOpen ? (
                  <div className="sheet-card__section-body">
                    <p className="sheet-card__section-detail">
                      {detail?.label ?? '등록된 기준이 없습니다.'}
                      {detail && detail.count > 0 ? ` · ${detail.count}건` : ''}
                    </p>
                    {!readOnly ? (
                      <button
                        type="button"
                        className="sheet-card__section-edit"
                        onClick={onStartWork}
                      >
                        작업대에서 편집
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>

        <p className="sheet-card__meta">{formatProjectCardMetaLine(card)}</p>

        <p className="sheet-card__headline">{card.headline}</p>

        {!readOnly ? (
          <footer className="sheet-card__footer">
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
          </footer>
        ) : null}
      </div>
    </article>
  );
}
