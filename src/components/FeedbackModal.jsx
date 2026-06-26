import { useEffect, useId, useRef } from 'react';
import { ExternalLink, X } from 'lucide-react';
import { openFeedbackFormView } from '../lib/feedbackConfig.js';

/**
 * 오픈베타 — Google Form으로 안내 (앱 내 짧은 제출 UI 없음)
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   onOpenForm?: () => void | Promise<void>,
 * }} props
 */
export default function FeedbackModal({ open, onClose, onOpenForm }) {
  const titleId = useId();
  const dialogRef = useRef(/** @type {HTMLDialogElement | null} */ (null));
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  function handleOpenForm() {
    void (async () => {
      await onOpenForm?.();
      if (!onOpenForm) {
        openFeedbackFormView();
      }
      onClose();
    })();
  }

  return (
    <dialog
      ref={dialogRef}
      className="feedback-modal"
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClose={onClose}
    >
      <div className="feedback-modal-panel">
        <header className="feedback-modal-header">
          <h2 id={titleId} className="feedback-modal-title">
            피드백 남기기
          </h2>
          <button
            type="button"
            className="btn-icon feedback-modal-close"
            onClick={onClose}
            aria-label="닫기"
          >
            <X size={18} />
          </button>
        </header>

        <p className="feedback-modal-lead">
          불편한 점·좋았던 점·버그·원하시는 기능을 편하게 적어 주시면 오늘
          맞춤법·표기 통일 각 2회까지 검수할 수 있습니다
        </p>

        <ul className="feedback-modal-list">
          <li>사용 만족도</li>
          <li>무엇이 도움이 됐는지 / 막혔는지</li>
          <li>자유롭게 남기는 한마디</li>
        </ul>

        <footer className="feedback-modal-footer feedback-modal-footer--primary">
          <button type="button" className="btn-ghost" onClick={onClose}>
            닫기
          </button>
          <button
            type="button"
            className="btn-run feedback-modal-submit feedback-modal-submit--wide"
            onClick={handleOpenForm}
          >
            <ExternalLink size={16} aria-hidden />
            Google Form에서 작성하기 (약 3분)
          </button>
        </footer>
      </div>
    </dialog>
  );
}
