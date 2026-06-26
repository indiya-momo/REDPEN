import { Fragment, useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import './app-dialog.css';

/** ≪프로젝트명≫ 구간을 고딕 강조로 렌더 */
function renderDialogMessage(message) {
  if (!message?.includes('≪')) return message;

  const parts = [];
  const re = /≪([^≫]+)≫/g;
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = re.exec(message)) !== null) {
    if (match.index > lastIndex) {
      parts.push(message.slice(lastIndex, match.index));
    }
    parts.push(
      <span key={key} className="app-dialog__project-name">
        ≪{match[1]}≫
      </span>,
    );
    key += 1;
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < message.length) {
    parts.push(message.slice(lastIndex));
  }

  if (parts.length === 0) return message;
  if (parts.length === 1) return parts[0];
  return parts.map((part, index) =>
    typeof part === 'string' ? (
      <Fragment key={`t-${index}`}>{part}</Fragment>
    ) : (
      part
    ),
  );
}

/**
 * @param {{
 *   open: boolean,
 *   title: string,
 *   message?: string,
 *   messageNode?: import('react').ReactNode,
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
  message = '',
  messageNode,
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

        {messageNode ? (
          <div className="app-dialog__message app-dialog__message--rich">
            {messageNode}
          </div>
        ) : (
          <p className="app-dialog__message">{renderDialogMessage(message)}</p>
        )}

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
