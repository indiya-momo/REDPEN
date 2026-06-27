import { useEffect, useId, useState } from 'react';
import {
  MAX_PROJECT_FORMAT_LABEL_LENGTH,
  MAX_PROJECT_PROOF_REVISION_LENGTH,
  normalizeProjectMemo,
  normalizeProjectTags,
} from '../lib/projectMeta.js';
import './project-hub-settings.css';

/** @typedef {'meta' | 'manuscript' | 'actions'} ProjectHubSettingsSection */

const NAV_ITEMS = [
  { id: 'meta', label: '프로젝트 편집' },
  { id: 'manuscript', label: '원고 정보' },
  { id: 'actions', label: '작업 이력' },
];

/**
 * @param {{
 *   card: import('../presentation/projectCardViewModel.js').ProjectCardViewModel,
 *   pdfFileName?: string,
 *   pdfPageCount?: number,
 *   lastWorkedAt?: string,
 *   saving?: boolean,
 *   onSave: (payload: {
 *     tags: string[],
 *     memo?: string,
 *     proofRevision?: string,
 *     formatLabel?: string,
 *   }) => void | Promise<void>,
 *   onStartWork?: () => void,
 *   onDuplicate?: () => void,
 *   onSharePreview?: () => void,
 * }} props
 */
export default function ProjectHubSettingsPanel({
  card,
  pdfFileName,
  pdfPageCount,
  lastWorkedAt,
  saving = false,
  onSave,
  onStartWork,
  onDuplicate,
  onSharePreview,
}) {
  const tagsInputId = useId();
  const proofRevisionInputId = useId();
  const formatLabelInputId = useId();
  const memoInputId = useId();

  const [activeSection, setActiveSection] =
    useState(/** @type {ProjectHubSettingsSection} */ ('meta'));
  const [tagsInput, setTagsInput] = useState('');
  const [memoInput, setMemoInput] = useState('');
  const [proofRevisionInput, setProofRevisionInput] = useState('');
  const [formatLabelInput, setFormatLabelInput] = useState('');

  useEffect(() => {
    setTagsInput(card.tags.join(', '));
    setMemoInput(card.memo ?? '');
    setProofRevisionInput(card.proofRevision ?? '');
    setFormatLabelInput(card.formatLabel ?? '');
  }, [card.id, card.tags, card.memo, card.proofRevision, card.formatLabel]);

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
      tags,
      memo,
      proofRevision: proofRevision || undefined,
      formatLabel: formatLabel || undefined,
    });
  }

  const manuscriptDate =
    lastWorkedAt && !Number.isNaN(Date.parse(lastWorkedAt))
      ? new Date(lastWorkedAt).toLocaleDateString('ko-KR', {
          timeZone: 'Asia/Seoul',
          year: '2-digit',
          month: 'numeric',
          day: 'numeric',
        })
      : null;

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
          <header className="project-hub-settings__header">
            <div>
              <h2 className="project-hub-settings__title">프로젝트 설정</h2>
              <p className="project-hub-settings__subtitle">
                《{card.title}》
                {card.isActive ? ' · 작업 중' : ''}
              </p>
            </div>
          </header>

          {activeSection === 'meta' ? (
            <form className="project-hub-settings__form" onSubmit={(e) => void handleSave(e)}>
              <div className="project-hub-settings__group">
                <div className="project-hub-settings__group-head">
                  <h3 className="project-hub-settings__group-title">프로젝트 편집</h3>
                  <p className="project-hub-settings__group-lead">
                    태그·교차·판형·메모를 저장합니다.
                  </p>
                </div>
                <div className="project-hub-settings__card">
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
                        판형
                      </label>
                      <p className="project-hub-settings__row-desc">
                        신국판 등 판형 이름
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

          {activeSection === 'manuscript' ? (
            <div className="project-hub-settings__group">
              <div className="project-hub-settings__group-head">
                <h3 className="project-hub-settings__group-title">원고</h3>
                <p className="project-hub-settings__group-lead">
                  마지막으로 연결한 PDF 정보입니다. 원고는 서버에 저장되지
                  않습니다.
                </p>
              </div>
              <div className="project-hub-settings__card">
                <div className="project-hub-settings__row project-hub-settings__row--readonly">
                  <div className="project-hub-settings__row-text">
                    <span className="project-hub-settings__row-label">파일</span>
                    <p className="project-hub-settings__row-desc">
                      검수 화면에서 연 PDF
                    </p>
                  </div>
                  <span className="project-hub-settings__value">
                    {pdfFileName || '—'}
                  </span>
                </div>
                <div className="project-hub-settings__row project-hub-settings__row--readonly">
                  <div className="project-hub-settings__row-text">
                    <span className="project-hub-settings__row-label">페이지</span>
                    <p className="project-hub-settings__row-desc">
                      시스템 페이지 수
                    </p>
                  </div>
                  <span className="project-hub-settings__value">
                    {typeof pdfPageCount === 'number' ? `${pdfPageCount}p` : '—'}
                  </span>
                </div>
                <div className="project-hub-settings__row project-hub-settings__row--readonly">
                  <div className="project-hub-settings__row-text">
                    <span className="project-hub-settings__row-label">
                      마지막 작업
                    </span>
                    <p className="project-hub-settings__row-desc">
                      검수·저장 시각
                    </p>
                  </div>
                  <span className="project-hub-settings__value">
                    {manuscriptDate || '—'}
                  </span>
                </div>
              </div>
            </div>
          ) : null}

          {activeSection === 'actions' ? (
            <div className="project-hub-settings__group">
              <div className="project-hub-settings__group-head">
                <h3 className="project-hub-settings__group-title">작업 이력</h3>
                <p className="project-hub-settings__group-lead">
                  검수 화면으로 전환하거나 프로젝트를 복제·공유합니다.
                </p>
              </div>
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
