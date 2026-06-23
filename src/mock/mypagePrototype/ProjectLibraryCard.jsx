import { useCallback, useId, useState } from 'react';
import {
  formatProjectCardMetaLine,
  formatProjectCardTitleLine,
} from '../../presentation/projectCardViewModel.js';

/**
 * @param {{
 *   card: import('../../presentation/projectCardViewModel.js').ProjectCardViewModel,
 *   expanded: boolean,
 *   readOnly?: boolean,
 *   onToggleExpand: () => void,
 *   onRename: (title: string) => void,
 *   onUpdateMeta: (patch: { memo?: string, tags?: string[] }) => void,
 *   onStartWork: () => void,
 *   onDuplicate: () => void,
 *   onSharePreview: () => void,
 * }} props
 */
export default function ProjectLibraryCard({
  card,
  expanded,
  readOnly = false,
  onToggleExpand,
  onRename,
  onUpdateMeta,
  onStartWork,
  onDuplicate,
  onSharePreview,
}) {
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(card.title);
  const [metaOpen, setMetaOpen] = useState(false);
  const [memoDraft, setMemoDraft] = useState(card.memo ?? '');
  const [tagsDraft, setTagsDraft] = useState(card.tags.join(', '));
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

  const commitMeta = useCallback(() => {
    const tags = tagsDraft
      .split(/[,，]/)
      .map((t) => t.trim())
      .filter(Boolean);
    onUpdateMeta({ memo: memoDraft.trim(), tags });
    setMetaOpen(false);
  }, [memoDraft, onUpdateMeta, tagsDraft]);

  return (
    <article
      className={`mypage-proto__card${card.isActive ? ' mypage-proto__card--active' : ''}${expanded ? ' mypage-proto__card--expanded' : ''}${readOnly ? ' mypage-proto__card--readonly' : ''}`}
    >
      <div className="mypage-proto__card-badges">
        {card.tags.map((tag) => (
          <span key={tag} className="mypage-proto__tag">
            {tag}
          </span>
        ))}
        {card.isActive ? (
          <span className="mypage__project-active-badge">작업 중</span>
        ) : null}
        {card.dirty ? (
          <span className="mypage-proto__dirty-badge">변경됨</span>
        ) : null}
      </div>

      <div className="mypage-proto__card-head">
        {editingName && !readOnly ? (
          <label className="mypage-proto__name-edit" htmlFor={nameInputId}>
            <span className="visually-hidden">프로젝트 이름</span>
            <input
              id={nameInputId}
              className="mypage-proto__name-input"
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
        ) : (
          <h2 className="mypage-proto__card-title">
            {formatProjectCardTitleLine(card)}
          </h2>
        )}
      </div>

      <p className="mypage-proto__headline">{card.headline}</p>
      <p className="mypage-proto__meta">{formatProjectCardMetaLine(card)}</p>

      {card.memo && !metaOpen ? (
        <p className="mypage-proto__memo-preview">{card.memo}</p>
      ) : null}

      {expanded ? (
        <dl className="mypage-proto__highlights">
          {card.highlights.map((row) => (
            <div key={row.category} className="mypage-proto__highlight-row">
              <dt className="mypage__project-spec-label">{row.category}</dt>
              <dd className="mypage__project-spec-value">
                {row.label}
                {row.count > 0 ? ` (${row.count}건)` : ''}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      {metaOpen && !readOnly ? (
        <div className="mypage-proto__meta-panel">
          <label className="mypage-proto__field">
            <span className="mypage-proto__field-label">메모</span>
            <textarea
              className="mypage-proto__textarea"
              rows={2}
              value={memoDraft}
              onChange={(e) => setMemoDraft(e.target.value)}
            />
          </label>
          <label className="mypage-proto__field">
            <span className="mypage-proto__field-label">태그 (쉼표 구분)</span>
            <input
              className="mypage-proto__text-input"
              value={tagsDraft}
              onChange={(e) => setTagsDraft(e.target.value)}
            />
          </label>
          <div className="mypage-proto__meta-actions">
            <button
              type="button"
              className="mypage-proto__btn mypage-proto__btn--primary"
              onClick={commitMeta}
            >
              적용
            </button>
            <button
              type="button"
              className="mypage-proto__btn"
              onClick={() => setMetaOpen(false)}
            >
              취소
            </button>
          </div>
        </div>
      ) : null}

      {!readOnly ? (
        <div className="mypage-proto__actions">
          <button
            type="button"
            className="mypage-proto__btn"
            onClick={() => {
              setNameDraft(card.title);
              setEditingName(true);
            }}
          >
            이름 변경
          </button>
          <button
            type="button"
            className="mypage-proto__btn"
            onClick={() => {
              setMemoDraft(card.memo ?? '');
              setTagsDraft(card.tags.join(', '));
              setMetaOpen((v) => !v);
            }}
          >
            메모·태그
          </button>
          <button
            type="button"
            className="mypage-proto__btn mypage-proto__btn--primary"
            onClick={onStartWork}
          >
            이 기준으로 작업
          </button>
        </div>
      ) : null}

      {!readOnly ? (
        <div className="mypage-proto__actions mypage-proto__actions--secondary">
          <button
            type="button"
            className="mypage-proto__btn mypage-proto__btn--ghost"
            onClick={onToggleExpand}
            aria-expanded={expanded}
          >
            {expanded ? '접기' : '자세히'}
          </button>
          <button
            type="button"
            className="mypage-proto__btn mypage-proto__btn--ghost"
            onClick={onDuplicate}
          >
            복제
          </button>
          <button
            type="button"
            className="mypage-proto__btn mypage-proto__btn--ghost"
            onClick={onSharePreview}
          >
            공유 미리보기
          </button>
        </div>
      ) : null}
    </article>
  );
}
