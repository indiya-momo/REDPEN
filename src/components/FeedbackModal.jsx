import { useEffect, useId, useRef, useState } from 'react';
import { ExternalLink, X } from 'lucide-react';
import {
  FEEDBACK_TYPES,
  formatFeedbackDraft,
  getFeedbackFormViewUrl,
  isFeedbackFormConfigured,
  isFeedbackFormLinked,
  openFeedbackFormView,
  submitFeedback,
} from '../lib/feedbackConfig.js';

/**
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 * }} props
 */
export default function FeedbackModal({ open, onClose }) {
  const titleId = useId();
  const dialogRef = useRef(/** @type {HTMLDialogElement | null} */ (null));
  const [type, setType] = useState(/** @type {import('../lib/feedbackConfig.js').FeedbackType} */ ('bug'));
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState('');

  const formReady = isFeedbackFormConfigured();
  const formViewUrl = getFeedbackFormViewUrl();
  const formLinked = isFeedbackFormLinked();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      setNotice('');
    }
    if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  function handleClose() {
    if (sending) return;
    onClose();
  }

  function handleOpenForm() {
    openFeedbackFormView();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmed = message.trim();
    if (!trimmed) {
      setNotice('내용을 입력해 주세요.');
      return;
    }

    if (!formReady && formViewUrl) {
      try {
        await navigator.clipboard.writeText(
          formatFeedbackDraft({ type, message: trimmed }),
        );
        setNotice('내용을 클립보드에 복사했습니다. Google Form에 붙여 넣어 주세요.');
      } catch {
        setNotice('Google Form을 엽니다. 내용을 직접 입력해 주세요.');
      }
      openFeedbackFormView();
      return;
    }

    setSending(true);
    setNotice('');

    const result = await submitFeedback({ type, message: trimmed });
    setSending(false);

    if (result.ok) {
      setMessage('');
      setType('bug');
      setNotice(
        'Form으로 전송 요청했습니다. Google Form 「응답」에 방금 내용이 보이는지 확인해 주세요.',
      );
      window.setTimeout(() => {
        onClose();
        setNotice('');
      }, 900);
      return;
    }

    if (result.reason === 'not_configured') {
      try {
        await navigator.clipboard.writeText(
          formatFeedbackDraft({ type, message: trimmed }),
        );
        setNotice(
          'Google Form 주소가 아직 없어 내용을 클립보드에 복사했습니다. Form 연결 후 「보내기」로 바로 제출됩니다.',
        );
      } catch {
        setNotice(
          'Google Form이 아직 설정되지 않았습니다. .env에 Form URL을 넣은 뒤 다시 시도해 주세요.',
        );
      }
      return;
    }

    setNotice(
      result.error
        ? `보내지 못했습니다. (${result.error})`
        : '보내지 못했습니다. 네트워크를 확인해 주세요.',
    );
  }

  return (
    <dialog
      ref={dialogRef}
      className="feedback-modal"
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        handleClose();
      }}
      onClose={handleClose}
    >
      <form className="feedback-modal-panel" onSubmit={handleSubmit}>
        <header className="feedback-modal-header">
          <h2 id={titleId} className="feedback-modal-title">
            피드백 보내기
          </h2>
          <button
            type="button"
            className="btn-icon feedback-modal-close"
            onClick={handleClose}
            aria-label="닫기"
            disabled={sending}
          >
            <X size={18} />
          </button>
        </header>

        {!formLinked ? (
          <p className="hint feedback-modal-hint">
            Google Form 연결 전입니다. 보내기를 누르면 내용이 클립보드에 복사됩니다.
          </p>
        ) : formReady ? (
          <p className="hint feedback-modal-hint">
            전송 후 Google Form 「응답」에 내용이 들어왔는지 확인해 주세요. (브라우저
            제한으로 앱에서는 수신 여부를 확인할 수 없습니다.)
          </p>
        ) : (
          <p className="hint feedback-modal-hint">
            보내기를 누르면 Google Form이 열립니다. 내용은 클립보드에 복사됩니다.
          </p>
        )}

        <fieldset className="feedback-type-field">
          <legend className="field-label">분류</legend>
          <div className="feedback-type-options">
            {FEEDBACK_TYPES.map((item) => (
              <label key={item.id} className="feedback-type-option">
                <input
                  type="radio"
                  name="feedback-type"
                  value={item.id}
                  checked={type === item.id}
                  onChange={() => setType(item.id)}
                  disabled={sending}
                />
                <span>{item.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <label className="field-label" htmlFor="feedback-message">
            내용
          </label>
          <textarea
            id="feedback-message"
            className="field-input feedback-modal-textarea"
            rows={6}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="어떤 문제인지, 또는 바라는 점을 적어 주세요."
            disabled={sending}
            required
          />
        </div>

        {notice ? (
          <p className="feedback-modal-notice" role="status">
            {notice}
          </p>
        ) : null}

        <footer className="feedback-modal-footer">
          {formViewUrl ? (
            <button
              type="button"
              className="btn-ghost feedback-modal-open-form"
              onClick={handleOpenForm}
              disabled={sending}
            >
              <ExternalLink size={16} aria-hidden />
              Google Form에서 작성
            </button>
          ) : null}
          <button
            type="button"
            className="btn-ghost"
            onClick={handleClose}
            disabled={sending}
          >
            취소
          </button>
          <button type="submit" className="btn-run feedback-modal-submit" disabled={sending}>
            {sending
              ? '보내는 중…'
              : formReady
                ? '보내기'
                : formViewUrl
                  ? 'Form 열기'
                  : '보내기'}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
