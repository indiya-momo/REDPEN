import { useEffect, useId, useRef, useState } from 'react';
import PageMatchIcon from './PageMatchIcon.jsx';
import PrintedPageSetup from './PrintedPageSetup.jsx';
import CriteriaHoverTip from './CriteriaHoverTip.jsx';

/**
 * 원고창 하단 툴바 — 아이콘+「페이지 맞추기」 → 보정 팝업
 */
export default function PrintedPageMatchControl({
  guideSpotlight = false,
  ...setupProps
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const inputId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onPointer = (e) => {
      const el = rootRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onPointer, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onPointer, true);
    };
  }, [open]);

  useEffect(() => {
    if (guideSpotlight) setOpen(true);
  }, [guideSpotlight]);

  return (
    <div
      ref={rootRef}
      className={[
        'printed-page-match',
        open ? 'printed-page-match--open' : '',
        guideSpotlight ? 'work-guide-spotlight' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      data-work-guide="page-calibration"
    >
      <CriteriaHoverTip tip="파일 쪽과 원고에 찍힌 쪽수를 맞춥니다">
        <button
          type="button"
          className={`pdf-work-pane__aux-btn printed-page-match__trigger${
            open ? ' printed-page-match__trigger--open' : ''
          }${setupProps.active ? ' printed-page-match__trigger--active' : ''}`}
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-controls={open ? 'printed-page-match-popover' : undefined}
          onClick={() => setOpen((v) => !v)}
        >
          <PageMatchIcon size={22} className="printed-page-match__icon" />
          <span>페이지 맞추기</span>
        </button>
      </CriteriaHoverTip>

      {open ? (
        <div
          id="printed-page-match-popover"
          className="printed-page-match__popover"
          role="dialog"
          aria-label="페이지 맞추기"
        >
          <PrintedPageSetup
            {...setupProps}
            inputId={inputId}
            variant="popover"
            guideSpotlight={false}
          />
        </div>
      ) : null}
    </div>
  );
}
