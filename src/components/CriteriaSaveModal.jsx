import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import './criteria-save-modal.css';

/**
 * 프로젝트(기준) 저장 완료 안내
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   projectName: string,
 * }} props
 */
export default function CriteriaSaveModal({ open, onClose, projectName }) {
  const titleId = useId();
  const dialogRef = useRef(/** @type {HTMLDialogElement | null} */ (null));

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const label = (projectName || '프로젝트').trim() || '프로젝트';

  return (
    <dialog
      ref={dialogRef}
      className="criteria-save-modal"
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClose={onClose}
    >
      <div className="criteria-save-modal__panel">
        <header className="criteria-save-modal__header">
          <h2 id={titleId} className="criteria-save-modal__title">
            저장 완료
          </h2>
          <button
            type="button"
            className="btn-icon criteria-save-modal__close"
            onClick={onClose}
            aria-label="닫기"
          >
            <X size={18} />
          </button>
        </header>

        <p className="criteria-save-modal__message">
          「{label}」 프로젝트가 저장되었습니다.
        </p>

        <footer className="criteria-save-modal__footer">
          <button
            type="button"
            className="btn-run criteria-save-modal__confirm"
            onClick={onClose}
          >
            확인
          </button>
        </footer>
      </div>
    </dialog>
  );
}
