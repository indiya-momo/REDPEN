import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import './event-reward-modal.css';

/**
 * 이벤트 선물 팝업 — 이미지·문구 슬롯 (에셋·지급은 추후 연결)
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   title?: string,
 *   message?: string,
 *   imageSrc?: string,
 *   imageAlt?: string,
 * }} props
 */
export default function EventRewardModal({
  open,
  onClose,
  title = '선물이 도착했어요',
  message = '이벤트 메시지가 여기에 표시됩니다.',
  imageSrc = '',
  imageAlt = '',
}) {
  const titleId = useId();
  const dialogRef = useRef(/** @type {HTMLDialogElement | null} */ (null));

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="event-reward-modal"
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClose={onClose}
    >
      <div className="event-reward-modal__panel">
        <header className="event-reward-modal__header">
          <h2 id={titleId} className="event-reward-modal__title">
            {title}
          </h2>
          <button
            type="button"
            className="btn-icon event-reward-modal__close"
            onClick={onClose}
            aria-label="닫기"
          >
            <X size={18} />
          </button>
        </header>

        <div className="event-reward-modal__visual" aria-hidden={!imageSrc}>
          {imageSrc ? (
            <img
              className="event-reward-modal__image"
              src={imageSrc}
              alt={imageAlt || title}
              decoding="async"
            />
          ) : (
            <div className="event-reward-modal__image-placeholder">
              <span>이벤트 이미지</span>
            </div>
          )}
        </div>

        <p className="event-reward-modal__message">{message}</p>

        <footer className="event-reward-modal__footer">
          <button type="button" className="btn-run event-reward-modal__confirm" onClick={onClose}>
            확인
          </button>
        </footer>
      </div>
    </dialog>
  );
}
