import { useEffect, useState } from 'react';
import { CircleHelp, Eye, EyeOff } from 'lucide-react';
import CurrentPageStatus from './CurrentPageStatus.jsx';
import FaqModal from './FaqModal.jsx';
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
 *   pageStatus?: {
 *     currentPage: number,
 *     visibleOnCurrentPage: number,
 *     formatPageLabel?: (systemPage: number) => string,
 *     tone?: 'builtin' | 'caution' | 'consistency',
 *     mode?: 'criteria' | 'toc',
 *     printedPagesActive?: boolean,
 *   } | null,
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
  pageStatus = null,
}) {
  const displayCurrent = formatPageText(currentPage);
  const displayTotal = formatPageText(numPages);
  const [value, setValue] = useState(displayCurrent);
  const [faqOpen, setFaqOpen] = useState(false);

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
    <div
      className={`pdf-preview-bar${
        !thumbStripOpen ? ' pdf-preview-bar--chrome-only' : ''
      }`}
    >
      <div className="pdf-preview-bar__toolbar">
        <div className="pdf-preview-bar__status-col">
          <button
            type="button"
            className="pdf-work-pane__aux-btn pdf-preview-bar__faq-btn"
            onClick={() => setFaqOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={faqOpen}
          >
            <CircleHelp size={16} aria-hidden />
            FAQ
          </button>
          {pageStatus ? (
            <CurrentPageStatus
              {...pageStatus}
              className="current-page-status--in-preview-bar"
            />
          ) : null}
        </div>

        <div
          className="pdf-preview-bar__jump-row"
          role="navigation"
          aria-label="페이지 이동"
        >
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
              aria-label={
                printedPagesEnabled
                  ? printedPagesActive
                    ? '인쇄 쪽수 입력 (예: 6-7). 입력 후 엔터로 이동'
                    : '인쇄 쪽수 입력 (보정 전: 6-7 등으로 이동 가능). 입력 후 엔터로 이동'
                  : `페이지 1–${numPages}. 입력 후 엔터로 이동`
              }
            />
          </form>
          <span className="pdf-preview-bar__slash" aria-hidden="true">
            /
          </span>
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
        </div>

        <div className="pdf-preview-bar__actions-col">
          {onToggleThumbStrip ? (
            <button
              type="button"
              className={`pdf-work-pane__aux-btn pdf-preview-bar__toggle${
                thumbStripOpen ? ' pdf-preview-bar__toggle--open' : ''
              }`}
              onClick={onToggleThumbStrip}
              aria-expanded={thumbStripOpen}
              aria-controls="pdf-thumb-strip"
              aria-label={thumbStripOpen ? '미리보기 숨기기' : '미리보기 보기'}
            >
              {thumbStripOpen ? (
                <EyeOff size={16} aria-hidden />
              ) : (
                <Eye size={16} aria-hidden />
              )}
              {thumbStripOpen ? '숨기기' : '미리보기'}
            </button>
          ) : null}
        </div>
      </div>

      {pdf ? (
        <div
          className={`pdf-preview-bar__strip-shell${
            thumbStripOpen ? '' : ' pdf-preview-bar__strip-shell--collapsed'
          }`}
        >
          <PdfThumbnailStrip
            pdf={pdf}
            currentPage={currentPage}
            onSelectPage={onGoToPage}
            formatPageLabel={formatPageLabel}
            idle={!thumbStripOpen}
          />
        </div>
      ) : null}
      <FaqModal open={faqOpen} onClose={() => setFaqOpen(false)} />
    </div>
  );
}
