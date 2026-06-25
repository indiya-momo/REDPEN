import { useEffect, useState } from 'react';
import {
  PDF_ZOOM_PERCENT_MAX,
  PDF_ZOOM_PERCENT_MIN,
} from '../lib/pdfService.js';

/**
 * @param {{
 *   zoomPercent: number,
 *   canZoomIn: boolean,
 *   canZoomOut: boolean,
 *   onZoomIn: () => void,
 *   onZoomOut: () => void,
 *   onZoomPercentChange: (percent: number) => void,
 * }} props
 */
export default function PdfZoomBar({
  zoomPercent,
  canZoomIn,
  canZoomOut,
  onZoomIn,
  onZoomOut,
  onZoomPercentChange,
}) {
  const [value, setValue] = useState(String(zoomPercent));

  useEffect(() => {
    setValue(String(zoomPercent));
  }, [zoomPercent]);

  function commit() {
    const trimmed = value.trim();
    if (!trimmed) {
      setValue(String(zoomPercent));
      return;
    }
    const parsed = Number.parseInt(trimmed, 10);
    if (
      !Number.isFinite(parsed) ||
      parsed < PDF_ZOOM_PERCENT_MIN ||
      parsed > PDF_ZOOM_PERCENT_MAX
    ) {
      setValue(String(zoomPercent));
      return;
    }
    onZoomPercentChange(parsed);
    setValue(String(parsed));
  }

  return (
    <div className="pdf-zoom-bar" role="toolbar" aria-label="PDF 확대/축소">
      <button
        type="button"
        className="pdf-zoom-bar__btn"
        onClick={onZoomOut}
        disabled={!canZoomOut}
        aria-label="축소"
      >
        <span className="pdf-zoom-bar__sign" aria-hidden="true">
          −
        </span>
      </button>
      <label className="pdf-zoom-bar__percent-wrap">
        <span className="sr-only">확대 배율(퍼센트)</span>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          className="pdf-zoom-bar__percent-input"
          value={value}
          onChange={(e) => {
            const next = e.target.value.replace(/\D/g, '');
            setValue(next);
          }}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commit();
            }
          }}
          aria-label={`확대 배율 ${PDF_ZOOM_PERCENT_MIN}–${PDF_ZOOM_PERCENT_MAX}`}
        />
        <span className="pdf-zoom-bar__percent-suffix" aria-hidden="true">
          %
        </span>
      </label>
      <button
        type="button"
        className="pdf-zoom-bar__btn"
        onClick={onZoomIn}
        disabled={!canZoomIn}
        aria-label="확대"
      >
        <span className="pdf-zoom-bar__sign" aria-hidden="true">
          +
        </span>
      </button>
    </div>
  );
}
