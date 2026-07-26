import { useState } from 'react';
import FaqModal from './FaqModal.jsx';
import { publicAssetUrl } from '../lib/publicAssetUrl.js';

const FAQ_PAW_ICON = publicAssetUrl('momo/faq-paw.png', { cacheBust: true });

/**
 * 원고 영역 오른쪽 아래 — 자주 묻는 질문 원형 버튼.
 * @param {{ className?: string }} [props]
 */
export default function FaqFabButton({ className = '' }) {
  const [faqOpen, setFaqOpen] = useState(false);
  const rootClass = ['pdf-faq-fab', className].filter(Boolean).join(' ');

  return (
    <>
      <button
        type="button"
        className={rootClass}
        onClick={() => setFaqOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={faqOpen}
        aria-label="자주 묻는 질문과 답변"
        title="자주 묻는 질문과 답변"
      >
        <img
          src={FAQ_PAW_ICON}
          alt=""
          width={42}
          height={42}
          draggable={false}
        />
      </button>
      <FaqModal open={faqOpen} onClose={() => setFaqOpen(false)} />
    </>
  );
}
