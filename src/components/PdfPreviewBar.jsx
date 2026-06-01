import { useEffect, useState } from 'react';
import PdfThumbnailStrip from './PdfThumbnailStrip.jsx';

/**
 * @param {{
 *   currentPage: number,
 *   numPages: number,
 *   onGoToPage: (page: number) => void,
 *   pdf?: import('pdfjs-dist').PDFDocumentProxy | null,
 *   formatPageLabel?: (systemPage: number) => string,
 *   thumbStripOpen?: boolean,
 *   onToggleThumbStrip?: () => void,
 *   printedPagesEnabled?: boolean,
 *   printedPagesActive?: boolean,
 *   formatPageText?: (systemPage: number) => string,
 *   toSystemPageFromInput?: (raw: string) => number | null,
 * }} props
 */
export default function PdfPreviewBar({
  currentPage,
  numPages,
  onGoToPage,
  pdf = null,
  formatPageLabel = (n) => String(n),
  thumbStripOpen = true,
  onToggleThumbStrip,
  printedPagesEnabled = false,
  printedPagesActive = false,
  formatPageText = (n) => String(n),
  toSystemPageFromInput = () => null,
}) {
  const displayCurrent = formatPageText(currentPage);
  const displayTotal = formatPageText(numPages);
  const [value, setValue] = useState(displayCurrent);

  useEffect(() => {
    setValue(displayCurrent);
  }, [displayCurrent]);

  function submit() {
    const trimmed = value.trim();
    if (!trimmed) {
      setValue(displayCurrent);
      return;
    }

    if (printedPagesEnabled) {
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
  }

  return (
    <div className="pdf-preview-bar">
      <div className="pdf-preview-bar__pager">
        <div className="pdf-preview-bar__jump-row">
          <div className="pdf-preview-bar__jump-wing pdf-preview-bar__jump-wing--before">
            <button
              type="button"
              className="pdf-preview-bar__nav pdf-preview-bar__nav--prev"
              disabled={currentPage <= 1}
              onClick={() => onGoToPage(currentPage - 1)}
              aria-label="이전 페이지"
            >
              ◀
            </button>
            <form
              className="pdf-preview-bar__jump"
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
            >
              <label className="sr-only" htmlFor="pdf-page-jump-input">
                {printedPagesEnabled ? '현재 인쇄 쪽수' : '현재 페이지'}
              </label>
              <input
                id="pdf-page-jump-input"
                type={printedPagesEnabled ? 'text' : 'number'}
                inputMode="numeric"
                className={`pdf-preview-bar__input pdf-preview-bar__jump-input${
                  printedPagesEnabled ? ' pdf-preview-bar__input--spread' : ''
                }`}
                min={printedPagesEnabled ? undefined : 1}
                max={printedPagesEnabled ? undefined : numPages}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onBlur={submit}
                aria-label={
                  printedPagesEnabled
                    ? printedPagesActive
                      ? '인쇄 쪽수 입력 (예: 6-7)'
                      : '인쇄 쪽수 입력 (보정 전: 6-7 등으로 이동 가능)'
                    : `페이지 1–${numPages}`
                }
              />
            </form>
          </div>
          <span className="pdf-preview-bar__slash" aria-hidden="true">
            /
          </span>
          <div className="pdf-preview-bar__jump-wing pdf-preview-bar__jump-wing--after">
            <span className="pdf-preview-bar__total">{displayTotal}</span>
            <button
              type="button"
              className="pdf-preview-bar__nav pdf-preview-bar__nav--next"
              disabled={currentPage >= numPages}
              onClick={() => onGoToPage(currentPage + 1)}
              aria-label="다음 페이지"
            >
              ▶
            </button>
            <p className="pdf-preview-bar__jump-hint">
              *이동하려는 페이지 번호를 기입하고 엔터키를 누르면 이동합니다
            </p>
          </div>
        </div>

        {thumbStripOpen && pdf ? (
          <div className="pdf-preview-bar__strip-row">
            <div className="pdf-preview-bar__middle">
              <PdfThumbnailStrip
                pdf={pdf}
                currentPage={currentPage}
                onSelectPage={onGoToPage}
                formatPageLabel={formatPageLabel}
              />
            </div>

            <div className="pdf-preview-bar__nav-col pdf-preview-bar__nav-col--next">
              <p className="pdf-preview-bar__thumb-hint">
                *네모가 보일 경우 클릭하면 미리보기 이미지로 표시됩니다
              </p>
            </div>
          </div>
        ) : null}
      </div>

      <aside className="pdf-preview-bar__aside">
        {onToggleThumbStrip ? (
          <button
            type="button"
            className="pdf-preview-bar__toggle"
            onClick={onToggleThumbStrip}
            aria-expanded={thumbStripOpen}
            aria-controls="pdf-thumb-strip"
          >
            {thumbStripOpen ? '숨기기' : '미리보기'}
          </button>
        ) : null}
      </aside>
    </div>
  );
}
