import { useEffect, useId, useRef } from 'react';
import { ExternalLink, X } from 'lucide-react';
import { openFeedbackFormView } from '../lib/feedbackConfig.js';

/**
 * 오픈베타 — Google Form으로 안내 (앱 내 짧은 제출 UI 없음)
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 * }} props
 */
export default function FeedbackModal({ open, onClose }) {
  const titleId = useId();
  const dialogRef = useRef(/** @type {HTMLDialogElement | null} */ (null));
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  function handleOpenForm() {
    openFeedbackFormView();
    onClose();
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
          오픈베타 동안 쓰신 소감을 <strong>Google Form</strong>으로 받고 있습니다.
          불편한 점·좋았던 점·버그·원하시는 기능을 편하게 적어 주세요.
        </p>

        <ul className="feedback-modal-list">
          <li>사용 맥락·만족도</li>
          <li>맞춤법·일관성 등 어디가 도움이 됐는지 / 막혔는지</li>
          <li>자유롭게 남기는 한마디</li>
          <li>화면 캡처·파일 첨부 (선택 — Google 로그인 필요할 수 있음)</li>
        </ul>

        <p className="hint feedback-modal-hint feedback-modal-privacy">
          원고·PDF 본문·검사 문구는 올리지 말아 주세요. 익명으로 받습니다.
        </p>

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
