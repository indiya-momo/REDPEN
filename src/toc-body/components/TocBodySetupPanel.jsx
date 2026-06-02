import { useMemo, useRef } from 'react';
import PrintedPageSetup from '../../components/PrintedPageSetup.jsx';
import { hasTocBodyEntries, parseTocBodyEntries } from '../lib/tocBodyCheck.js';

/**
 * @param {{
 *   tocBodyText: string,
 *   onTocBodyTextChange: (text: string) => void,
 *   tocBodyExcludePages?: string,
 *   onTocBodyExcludePagesChange?: (value: string) => void,
 *   printedPagesActive?: boolean,
 *   currentSystemPage?: number,
 *   currentPrintedLabel?: string,
 *   previewPrintedLabel?: string,
 *   spreadInput?: boolean,
 *   onSpreadInputChange?: (v: boolean) => void,
 *   firstPageSingle?: boolean,
 *   onFirstPageSingleChange?: (v: boolean) => void,
 *   onCalibrateFromInput?: (raw: string, isSpread: boolean) => void,
 *   onClearPrintedPageOffset?: () => void,
 *   onRunCheck: () => void | Promise<void>,
 *   hasPdf?: boolean,
 *   isProcessing?: boolean,
 *   embedded?: boolean,
 *   textareaRows?: number,
 * }} props
 */
export default function TocBodySetupPanel({
  tocBodyText,
  onTocBodyTextChange,
  tocBodyExcludePages = '',
  onTocBodyExcludePagesChange = () => {},
  printedPagesActive = false,
  currentSystemPage = 1,
  currentPrintedLabel = '',
  previewPrintedLabel = '',
  spreadInput = false,
  onSpreadInputChange = () => {},
  firstPageSingle = true,
  onFirstPageSingleChange = () => {},
  onCalibrateFromInput = () => {},
  onClearPrintedPageOffset = () => {},
  onRunCheck,
  hasPdf = false,
  isProcessing = false,
  embedded = false,
  textareaRows = 8,
}) {
  const tocFileInputRef = useRef(/** @type {HTMLInputElement | null} */ (null));

  const sectionClass = embedded
    ? 'consistency-section-box consistency-toc-section'
    : 'toc-body-setup__section';
  const titleClass = embedded
    ? 'field-label consistency-toc-section__title'
    : 'field-label toc-body-setup__title';
  const hintClass = embedded
    ? 'hint consistency-toc-section__hint'
    : 'hint toc-body-setup__hint';
  const tipClass = embedded
    ? 'hint consistency-toc-section__tip'
    : 'hint toc-body-setup__tip';
  const actionsClass = embedded
    ? 'consistency-toc-section__actions'
    : 'toc-body-setup__actions';
  const fileBtnClass = embedded
    ? 'consistency-toc-section__file-btn'
    : 'toc-body-setup__file-btn';
  const clearBtnClass = embedded
    ? 'consistency-toc-section__clear-btn'
    : 'toc-body-setup__clear-btn';
  const fileInputClass = embedded
    ? 'consistency-toc-section__file-input'
    : 'toc-body-setup__file-input';
  const textareaClass = embedded
    ? 'consistency-toc-section__textarea custom-scrollbar'
    : 'toc-body-setup__textarea custom-scrollbar';
  const runBtnClass = embedded
    ? 'btn-add consistency-toc-section__run-btn'
    : 'btn-add toc-body-setup__run-btn';
  const runHintClass = embedded
    ? 'hint consistency-toc-section__run-hint'
    : 'hint toc-body-setup__run-hint';
  const excludeRowClass = embedded
    ? 'consistency-toc-section__exclude-pages'
    : 'toc-body-setup__exclude-pages';
  const excludeInputClass = embedded
    ? 'consistency-toc-section__exclude-pages-input'
    : 'toc-body-setup__exclude-pages-input';
  const headingId = embedded ? 'consistency-toc-heading' : 'toc-body-setup-heading';
  const stepClass = embedded
    ? 'consistency-toc-section__step-label'
    : 'toc-body-setup__step-label';

  const firstTocPage = useMemo(() => {
    const entry = parseTocBodyEntries(tocBodyText).find((e) => e.tocPage);
    return entry?.tocPage ?? null;
  }, [tocBodyText]);

  const canRunCheck =
    hasPdf && hasTocBodyEntries(tocBodyText) && printedPagesActive && !isProcessing;

  const section = (
    <section
      className={sectionClass}
      aria-labelledby={headingId}
    >
      {embedded ? (
        <div className="consistency-toc-section__header">
          <p id={headingId} className={titleClass}>
            목차 · 본문 일치 확인
          </p>
        </div>
      ) : (
        <p id={headingId} className={titleClass}>
          목차 · 본문 일치 확인
        </p>
      )}
      <p className={stepClass}>1. 인쇄 쪽 보정 (먼저 1회)</p>
      <PrintedPageSetup
        currentSystemPage={currentSystemPage}
        active={printedPagesActive}
        currentPrintedLabel={currentPrintedLabel}
        previewPrintedLabel={previewPrintedLabel}
        spreadInput={spreadInput}
        onSpreadInputChange={onSpreadInputChange}
        firstPageSingle={firstPageSingle}
        onFirstPageSingleChange={onFirstPageSingleChange}
        onCalibrateFromInput={onCalibrateFromInput}
        onClear={onClearPrintedPageOffset}
      />
      {hasPdf && firstTocPage && !printedPagesActive ? (
        <p className={tipClass}>
          목차 첫 쪽수가 <strong>{firstTocPage}</strong>이면, PDF에서 그쪽을 연 뒤 위 입력란에{' '}
          <strong>{firstTocPage}</strong>을 넣고 <strong>보정</strong>을 누르세요.
        </p>
      ) : null}

      <p className={stepClass}>2. 목차 입력</p>
      <p className={hintClass}>
        목차를 메모장(TXT)파일로 업로드한 뒤 시작 버튼을 누르세요.
      </p>
      <p className={tipClass}>
        구분기호 (예:<strong>┃</strong>)는 삭제하지 말고 넣어 주세요.
      </p>
      <label className={excludeRowClass}>
        <span>목차 PDF 페이지 (인쇄 쪽, 검색 제외)</span>
        <input
          type="text"
          className={excludeInputClass}
          value={tocBodyExcludePages}
          onChange={(e) => onTocBodyExcludePagesChange(e.target.value)}
          placeholder="18-22"
          aria-label="PDF 목차 페이지 범위, 검색에서 제외"
          autoComplete="off"
        />
      </label>
      <p className={tipClass}>
        목차에 인쇄된 PDF 구간(예: <strong>18-22</strong>)은 일치 확인에서 제외됩니다. 보정한
        인쇄 쪽 번호와 같게 입력하세요.
      </p>
      <div className={actionsClass}>
        <button
          type="button"
          className={fileBtnClass}
          onClick={() => tocFileInputRef.current?.click()}
        >
          메모장(TXT)파일 업로드
        </button>
        <input
          ref={tocFileInputRef}
          type="file"
          accept=".txt,text/plain"
          className={fileInputClass}
          aria-hidden
          tabIndex={-1}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
              onTocBodyTextChange(String(reader.result ?? ''));
            };
            reader.onerror = () => {
              alert('목차 파일을 읽지 못했습니다.');
            };
            reader.readAsText(file, 'utf-8');
          }}
        />
        {tocBodyText.trim() ? (
          <button
            type="button"
            className={clearBtnClass}
            onClick={() => onTocBodyTextChange('')}
          >
            목차 지우기
          </button>
        ) : null}
      </div>
      <textarea
        className={textareaClass}
        value={tocBodyText}
        onChange={(e) => onTocBodyTextChange(e.target.value)}
        placeholder={'제1장 서론\n제2장 본론\n…'}
        rows={textareaRows}
        aria-label="목차 항목 목록"
      />
      <button
        type="button"
        className={runBtnClass}
        disabled={!canRunCheck}
        onClick={() => onRunCheck()}
      >
        {isProcessing ? '검사 중…' : '시작'}
      </button>
      {!hasPdf ? (
        <p className={runHintClass}>PDF를 업로드한 뒤 검사할 수 있습니다.</p>
      ) : hasPdf && hasTocBodyEntries(tocBodyText) && !printedPagesActive ? (
        <p className={runHintClass}>시작 전에 위에서 인쇄 쪽 보정을 먼저 해 주세요.</p>
      ) : null}
    </section>
  );

  if (embedded) {
    return section;
  }

  return <div className="toc-body-setup">{section}</div>;
}
