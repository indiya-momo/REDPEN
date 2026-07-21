import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { FAQ_ITEMS } from '../lib/faqItems.js';

/**
 * 작업 화면·마이페이지 공통 FAQ 모달 (로그인 불필요).
 * @param {{ open: boolean, onClose: () => void }} props
 */
export default function FaqModal({ open, onClose }) {
  const titleId = useId();
  const dialogRef = useRef(/** @type {HTMLDialogElement | null} */ (null));
  const dragRef = useRef(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setOffset({ x: 0, y: 0 });
      dialog.showModal();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (!dragging) return undefined;
    const prev = document.body.style.userSelect;
    document.body.style.userSelect = 'none';
    return () => {
      document.body.style.userSelect = prev;
    };
  }, [dragging]);

  const onDragPointerDown = useCallback(
    (event) => {
      if (event.button !== 0) return;
      if (event.target.closest('button')) return;
      event.preventDefault();
      dragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originX: offset.x,
        originY: offset.y,
      };
      setDragging(true);
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [offset.x, offset.y],
  );

  const onDragPointerMove = useCallback((event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setOffset({
      x: drag.originX + (event.clientX - drag.startX),
      y: drag.originY + (event.clientY - drag.startY),
    });
  }, []);

  const endDrag = useCallback((event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDragging(false);
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* already released */
    }
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className={`faq-modal${dragging ? ' faq-modal--dragging' : ''}`}
      aria-labelledby={titleId}
      style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClose={onClose}
    >
      <div className="faq-modal__panel">
        <header
          className="faq-modal__header faq-modal__header--drag"
          onPointerDown={onDragPointerDown}
          onPointerMove={onDragPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <h2 id={titleId} className="faq-modal__title">
            FAQ
          </h2>
          <button
            type="button"
            className="btn-icon faq-modal__close"
            onClick={onClose}
            aria-label="닫기"
          >
            <X size={18} />
          </button>
        </header>
        <p className="faq-modal__lead">
          먼저 확인하시고 궁금한 점은 피드백으로 남겨주세요
        </p>
        <div className="faq-modal__list">
          {FAQ_ITEMS.map((item) => (
            <details key={item.id} className="faq-modal__item">
              <summary className="faq-modal__question">{item.question}</summary>
              <p className="faq-modal__answer">{item.answer}</p>
            </details>
          ))}
        </div>
        <footer className="faq-modal__footer">
          <button type="button" className="btn-ghost" onClick={onClose}>
            닫기
          </button>
        </footer>
      </div>
    </dialog>
  );
}
