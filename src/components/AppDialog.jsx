import { Fragment, useEffect, useId, useRef, useState } from 'react';
import { Copy, X } from 'lucide-react';
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
 *   copyableUrl?: string,
 *   mode?: 'alert' | 'confirm',
 *   confirmLabel?: string,
 *   cancelLabel?: string,
 *   onConfirm: () => void,
 *   onCancel?: () => void,
 *   onClose?: () => void,
 *   showGuideHand?: boolean,
 * }} props
 */
export default function AppDialog({
  open,
  title,
  message = '',
  messageNode,
  copyableUrl = '',
  mode = 'alert',
  confirmLabel = '확인',
  cancelLabel = '취소',
  onConfirm,
  onCancel,
  onClose,
  showGuideHand = false,
}) {
  const titleId = useId();
  const dialogRef = useRef(/** @type {HTMLDialogElement | null} */ (null));
  const isConfirm = mode === 'confirm';
  const [copyState, setCopyState] = useState(
    /** @type {'idle' | 'ok' | 'error'} */ ('idle'),
  );
  const url = String(copyableUrl ?? '').trim();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (!open) setCopyState('idle');
  }, [open]);

  const handleClose = onClose ?? onConfirm;
  /** 손 안내가 있으면 확인 버튼만으로 진행 (X·Esc로 건너뛰기 금지) */
  const requireConfirmClick = showGuideHand;

  const handleCopyUrl = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopyState('ok');
      window.setTimeout(() => setCopyState('idle'), 2000);
    } catch {
      setCopyState('error');
      window.setTimeout(() => setCopyState('idle'), 2500);
    }
  };

  const copyLabel =
    copyState === 'ok'
      ? '복사됨'
      : copyState === 'error'
        ? '실패'
        : '링크 복사';

  return (
    <dialog
      ref={dialogRef}
      className="app-dialog"
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        if (requireConfirmClick) return;
        if (isConfirm) {
          onCancel?.();
        } else {
          handleClose();
        }
      }}
      onClose={() => {
        if (requireConfirmClick) return;
        if (!isConfirm) handleClose();
      }}
    >
      <div className="app-dialog__panel">
        <header className="app-dialog__header">
          <h2 id={titleId} className="app-dialog__title">
            {title}
          </h2>
          {requireConfirmClick ? null : (
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
          )}
        </header>

        {messageNode ? (
          <div className="app-dialog__message app-dialog__message--rich">
            {messageNode}
          </div>
        ) : (
          <p className="app-dialog__message">{renderDialogMessage(message)}</p>
        )}

        {url ? (
          <div className="app-dialog__link-row">
            <code className="app-dialog__link-url" title={url}>
              {url}
            </code>
            <button
              type="button"
              className="app-dialog__link-copy"
              onClick={() => void handleCopyUrl()}
              aria-label={copyLabel}
              title={copyLabel}
            >
              <Copy size={16} strokeWidth={2} aria-hidden />
            </button>
          </div>
        ) : null}

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
              <span className="app-dialog__confirm-hand-wrap">
                <button
                  type="button"
                  className="btn-run app-dialog__confirm"
                  data-work-guide="app-dialog-confirm"
                  onClick={onConfirm}
                >
                  {confirmLabel}
                </button>
                {showGuideHand ? (
                  <span
                    className="guide-click-hand guide-click-hand--label-gap app-dialog__guide-hand"
                    aria-hidden
                  >
                    <span className="guide-click-hand__emoji">👆</span>
                  </span>
                ) : null}
              </span>
            </>
          ) : (
            <span className="app-dialog__confirm-hand-wrap">
              <button
                type="button"
                className="btn-run app-dialog__confirm"
                data-work-guide="app-dialog-confirm"
                onClick={onConfirm}
              >
                {confirmLabel}
              </button>
              {showGuideHand ? (
                <span
                  className="guide-click-hand guide-click-hand--label-gap app-dialog__guide-hand"
                  aria-hidden
                >
                  <span className="guide-click-hand__emoji">👆</span>
                </span>
              ) : null}
            </span>
          )}
        </footer>
      </div>
    </dialog>
  );
}
