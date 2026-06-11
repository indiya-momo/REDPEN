import { useEffect, useRef } from 'react';

/**
 * @param {{
 *   mode: 'visible' | 'partial' | 'hidden',
 *   label: string,
 *   onToggle: () => void,
 * }} props
 */
export default function GroupVisibilityCheckbox({ mode, label, onToggle }) {
  const inputRef = useRef(/** @type {HTMLInputElement | null} */ (null));
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.indeterminate = mode === 'partial';
    }
  }, [mode]);

  return (
    <input
      ref={inputRef}
      type="checkbox"
      checked={mode !== 'hidden'}
      aria-label={`${label} PDF 표시`}
      onChange={onToggle}
    />
  );
}
