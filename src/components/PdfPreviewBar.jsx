import { useEffect, useState } from 'react';

/**
 * @param {{
 *   currentPage: number,
 *   numPages: number,
 *   onGoToPage: (page: number) => void,
 *   findingsOnPage?: number,
 *   thumbStripOpen?: boolean,
 *   onToggleThumbStrip?: () => void,
 *   printedPagesActive?: boolean,
 *   printedPagesCalibrated?: boolean,
 *   formatPageText?: (systemPage: number) => string,
 *   toSystemPageFromInput?: (raw: string) => number | null,
 * }} props
 */
export default function PdfPreviewBar({
  currentPage,
  numPages,
  onGoToPage,
  findingsOnPage = 0,
  thumbStripOpen = true,
  onToggleThumbStrip,
  printedPagesActive = false,
  printedPagesCalibrated = false,
  formatPageText = (n) => String(n),
  toSystemPageFromInput = () => null,
}) {
  const displayCurrent = formatPageText(currentPage);
  const displayTotal = formatPageText(numPages);

  const [value, setValue] = useState(displayCurrent);

  useEffect(() => {
    setValue(displayCurrent);
  }, [displayCurrent]);

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed) {
      setValue(displayCurrent);
      return;
    }

    if (printedPagesActive) {
      const systemPage = toSystemPageFromInput(trimmed);
      if (systemPage == null) {
        setValue(displayCurrent);
        return;
      }
      onGoToPage(systemPage);
      setValue(formatPageText(systemPage));
      return;
    }

    const parsed = Number.parseInt(trimmed, 10);
    if (!Number.isFinite(parsed)) {
      setValue(displayCurrent);
      return;
    }
    const page = Math.min(numPages, Math.max(1, parsed));
    onGoToPage(page);
    setValue(formatPageText(page));
  };

  return (
    <div className="pdf-preview-bar">
      <div className="pdf-preview-bar__nav-group">
        <button
          type="button"
          className="pdf-preview-bar__nav"
          disabled={currentPage <= 1}
          onClick={() => onGoToPage(currentPage - 1)}
          aria-label="이전 페이지"
        >
          ←
        </button>
        <form
          className="pdf-preview-bar__jump"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <label className="sr-only" htmlFor="pdf-page-jump-input">
            {printedPagesActive ? '현재 인쇄 쪽수' : '현재 페이지'}
          </label>
          <input
            id="pdf-page-jump-input"
            type={printedPagesActive ? 'text' : 'number'}
            inputMode="numeric"
            className={`pdf-preview-bar__input${
              printedPagesActive ? ' pdf-preview-bar__input--spread' : ''
            }`}
            min={printedPagesActive ? undefined : 1}
            max={printedPagesActive ? undefined : numPages}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={submit}
            aria-label={
              printedPagesActive ? '인쇄 쪽수 입력 (예: 6-7)' : `페이지 1–${numPages}`
            }
          />
          <span className="pdf-preview-bar__total">/ {displayTotal}</span>
        </form>
        <button
          type="button"
          className="pdf-preview-bar__nav"
          disabled={currentPage >= numPages}
          onClick={() => onGoToPage(currentPage + 1)}
          aria-label="다음 페이지"
        >
          →
        </button>
      </div>

      <div className="pdf-preview-bar__aside">
        {printedPagesCalibrated ? (
          <span className="pdf-preview-bar__mode" title="파일 기준 페이지">
            파일 {currentPage}P
          </span>
        ) : null}
        {findingsOnPage > 0 ? (
          <span className="pdf-preview-bar__findings">
            {findingsOnPage}곳 표시
          </span>
        ) : null}
        {onToggleThumbStrip && (
          <button
            type="button"
            className="pdf-preview-bar__toggle"
            onClick={onToggleThumbStrip}
            aria-expanded={thumbStripOpen}
            aria-controls="pdf-thumb-strip"
          >
            {thumbStripOpen ? '목록 숨기기' : '목록 보기'}
          </button>
        )}
      </div>
    </div>
  );
}
