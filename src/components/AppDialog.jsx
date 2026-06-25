import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import './app-dialog.css';

/**
 * @param {{
 *   open: boolean,
 *   title: string,
 *   message: string,
 *   mode?: 'alert' | 'confirm',
 *   confirmLabel?: string,
 *   cancelLabel?: string,
 *   onConfirm: () => void,
 *   onCancel?: () => void,
 *   onClose?: () => void,
 * }} props
 */
export default function AppDialog({
  open,
  title,
  message,
  mode = 'alert',
  confirmLabel = '확인',
  cancelLabel = '취소',
  onConfirm,
  onCancel,
  onClose,
}) {
  const titleId = useId();
  const dialogRef = useRef(/** @type {HTMLDialogElement | null} */ (null));
  const isConfirm = mode === 'confirm';

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const handleClose = onClose ?? onConfirm;

  return (
    <dialog
      ref={dialogRef}
      className="app-dialog"
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        if (isConfirm) {
          onCancel?.();
        } else {
          handleClose();
        }
      }}
      onClose={() => {
        if (!isConfirm) handleClose();
      }}
    >
      <div className="app-dialog__panel">
        <header className="app-dialog__header">
          <h2 id={titleId} className="app-dialog__title">
            {title}
          </h2>
          <button
            type="button"
            className="btn-icon app-dialog__close"
            onClick={() => {
              if (isConfirm) {
                onCancel?.();
              } else {
                handleClose();
              }
            }}
            aria-label="닫기"
          >
            <X size={18} />
          </button>
        </header>

        <p className="app-dialog__message">{message}</p>

        <footer
          className={`app-dialog__footer${isConfirm ? ' app-dialog__footer--confirm' : ''}`}
        >
          {isConfirm ? (
            <>
              <button
                type="button"
                className="app-dialog__cancel"
                onClick={() => onCancel?.()}
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                className="btn-run app-dialog__confirm"
                onClick={onConfirm}
              >
                {confirmLabel}
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn-run app-dialog__confirm"
              onClick={onConfirm}
            >
              {confirmLabel}
            </button>
          )}
        </footer>
      </div>
    </dialog>
  );
}
