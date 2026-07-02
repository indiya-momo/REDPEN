import { useEffect, useId, useRef, useState } from 'react';
import { X } from 'lucide-react';
import {
  MAX_PROJECT_FORMAT_LABEL_LENGTH,
  MAX_PROJECT_PROOF_REVISION_LENGTH,
  mergeProjectContext,
  normalizeProjectMemo,
  normalizeProjectTags,
} from '../lib/projectMeta.js';
import './project-meta-edit-modal.css';

/**
 * @param {{
 *   open: boolean,
 *   projectTitle: string,
 *   initialTags?: string[],
 *   initialMemo?: string,
 *   initialProofRevision?: string,
 *   initialFormatLabel?: string,
 *   onClose: () => void,
 *   onSave: (payload: {
 *     tags: string[],
 *     memo?: string,
 *     proofRevision?: string,
 *     formatLabel?: string,
 *   }) => void | Promise<void>,
 *   saving?: boolean,
 * }} props
 */
export default function ProjectMetaEditModal({
  open,
  projectTitle,
  initialTags = [],
  initialMemo = '',
  initialProofRevision = '',
  initialFormatLabel = '',
  onClose,
  onSave,
  saving = false,
}) {
  const titleId = useId();
  const tagsInputId = useId();
  const memoInputId = useId();
  const proofRevisionInputId = useId();
  const formatLabelInputId = useId();
  const dialogRef = useRef(/** @type {HTMLDialogElement | null} */ (null));
  const [tagsInput, setTagsInput] = useState('');
  const [memoInput, setMemoInput] = useState('');
  const [proofRevisionInput, setProofRevisionInput] = useState('');
  const [formatLabelInput, setFormatLabelInput] = useState('');

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return undefined;
    try {
      if (open && !dialog.open) dialog.showModal();
      else if (!open && dialog.open) dialog.close();
    } catch (e) {
      console.warn('project meta dialog sync failed', e);
    }
    return () => {
      try {
        if (dialog.open) dialog.close();
      } catch {
        /* unmount */
      }
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setTagsInput(initialTags.join(', '));
    setMemoInput(initialMemo ?? '');
    setProofRevisionInput(initialProofRevision ?? '');
    setFormatLabelInput(initialFormatLabel ?? '');
  }, [open, initialTags, initialMemo, initialProofRevision, initialFormatLabel]);

  async function handleSubmit(event) {
    event.preventDefault();
    const tags = normalizeProjectTags(
      tagsInput
        .split(/[,，]/)
        .map((part) => part.trim())
        .filter(Boolean),
    );
    const memo = normalizeProjectMemo(memoInput);
    const proofRevision = proofRevisionInput.trim().slice(
      0,
      MAX_PROJECT_PROOF_REVISION_LENGTH,
    );
    const formatLabel = formatLabelInput.trim().slice(
      0,
      MAX_PROJECT_FORMAT_LABEL_LENGTH,
    );
    await onSave({
      tags,
      memo,
      proofRevision: proofRevision || undefined,
      formatLabel: formatLabel || undefined,
    });
  }

  const label = (projectTitle || '프로젝트').trim() || '프로젝트';

  return (
    <dialog
      ref={dialogRef}
      className="project-meta-edit-modal"
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        if (!saving) onClose();
      }}
      onClose={() => {
        if (!saving) onClose();
      }}
    >
      <form className="project-meta-edit-modal__panel" onSubmit={(e) => void handleSubmit(e)}>
        <header className="project-meta-edit-modal__header">
          <h2 id={titleId} className="project-meta-edit-modal__title">
            태그·메모
          </h2>
          <button
            type="button"
            className="btn-icon project-meta-edit-modal__close"
            onClick={onClose}
            disabled={saving}
            aria-label="닫기"
          >
            <X size={18} />
          </button>
        </header>

        <p className="project-meta-edit-modal__lead">
          《{label}》 프로젝트 분류·메모
        </p>

        <label className="project-meta-edit-modal__field" htmlFor={tagsInputId}>
          <span className="project-meta-edit-modal__label">태그</span>
          <input
            id={tagsInputId}
            className="project-meta-edit-modal__input"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="문학, 시리즈 2/5"
            disabled={saving}
            autoComplete="off"
          />
          <span className="project-meta-edit-modal__hint">쉼표로 구분 · 최대 3개</span>
        </label>

        <div className="project-meta-edit-modal__row">
          <label
            className="project-meta-edit-modal__field project-meta-edit-modal__field--half"
            htmlFor={proofRevisionInputId}
          >
            <span className="project-meta-edit-modal__label">교정교열</span>
            <input
              id={proofRevisionInputId}
              className="project-meta-edit-modal__input"
              value={proofRevisionInput}
              onChange={(e) => setProofRevisionInput(e.target.value)}
              placeholder="3교"
              disabled={saving}
              autoComplete="off"
            />
          </label>

          <label
            className="project-meta-edit-modal__field project-meta-edit-modal__field--half"
            htmlFor={formatLabelInputId}
          >
            <span className="project-meta-edit-modal__label">판형</span>
            <input
              id={formatLabelInputId}
              className="project-meta-edit-modal__input"
              value={formatLabelInput}
              onChange={(e) => setFormatLabelInput(e.target.value)}
              placeholder="신국판"
              disabled={saving}
              autoComplete="off"
            />
          </label>
        </div>

        <label className="project-meta-edit-modal__field" htmlFor={memoInputId}>
          <span className="project-meta-edit-modal__label">메모</span>
          <textarea
            id={memoInputId}
            className="project-meta-edit-modal__textarea"
            value={memoInput}
            onChange={(e) => setMemoInput(e.target.value)}
            rows={3}
            disabled={saving}
          />
        </label>

        <footer className="project-meta-edit-modal__footer">
          <button
            type="button"
            className="btn-secondary project-meta-edit-modal__cancel"
            onClick={onClose}
            disabled={saving}
          >
            취소
          </button>
          <button
            type="submit"
            className="btn-run project-meta-edit-modal__save"
            disabled={saving}
            aria-busy={saving}
          >
            {saving ? '저장 중…' : '저장'}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
