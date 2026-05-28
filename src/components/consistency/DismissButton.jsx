import { X } from 'lucide-react';

/** @param {{ label: string, onClick: () => void }} props */
export default function DismissButton({ label, onClick }) {
  return (
    <button
      type="button"
      className="btn-icon btn-icon--dismiss"
      onClick={onClick}
      aria-label={`${label} 제거`}
    >
      <X size={14} strokeWidth={2.25} aria-hidden />
    </button>
  );
}
