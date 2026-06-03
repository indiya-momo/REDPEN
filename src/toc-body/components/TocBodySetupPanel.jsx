import { useEffect, useMemo, useRef, useState } from 'react';
import PrintedPageSetup from '../../components/PrintedPageSetup.jsx';
import PanelSectionRunButton from '../../components/PanelSectionRunButton.jsx';
import { formatSystemPageLabel } from '../../lib/printedPageDisplay.js';
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
  textareaRows = 10,
}) {
  const tocFileInputRef = useRef(/** @type {HTMLInputElement | null} */ (null));

  const sectionClass = embedded
    ? 'consistency-section-box consistency-toc-section'
    : 'toc-body-setup__section';
  const titleClass = embedded
    ? 'printed-page-setup__title consistency-panel-section-title'
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
  const runInHeader = embedded;
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
  const calibrationDoneClass = embedded
    ? 'consistency-toc-section__calibration-done'
    : 'toc-body-setup__calibration-done';
  const recalibrateBtnClass = embedded
    ? 'consistency-toc-section__recalibrate-btn'
    : 'toc-body-setup__recalibrate-btn';

  const [showCalibrationEditor, setShowCalibrationEditor] = useState(
    () => !printedPagesActive,
  );

  useEffect(() => {
    if (printedPagesActive) setShowCalibrationEditor(false);
  }, [printedPagesActive]);

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
          <PanelSectionRunButton
            label="검수"
            processingLabel="검수 중…"
            onClick={onRunCheck}
            disabled={!canRunCheck}
            isProcessing={isProcessing}
          />
        </div>
      ) : (
        <p id={headingId} className={titleClass}>
          목차 · 본문 일치 확인
        </p>
      )}
      {!hasPdf ? (
        <p className={runHintClass}>
          가운데에서 PDF를 업로드하면 맞춤법·목차 검사에 함께 사용됩니다.
        </p>
      ) : null}

      <p className={stepClass}>1. 인쇄 쪽 보정</p>
      {printedPagesActive && !showCalibrationEditor ? (
        <div className={calibrationDoneClass}>
          <p>
            현재 파일 <strong>{formatSystemPageLabel(currentSystemPage)}</strong>가
            원고 기준 <strong>{currentPrintedLabel}</strong>로 보정되었습니다.
          </p>
          <button
            type="button"
            className={recalibrateBtnClass}
            onClick={() => setShowCalibrationEditor(true)}
          >
            다시 보정
          </button>
        </div>
      ) : (
        <>
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
          {hasPdf && !printedPagesActive ? (
            <p className={tipClass}>
              맞춤법 확인 검사 결과에서 보정했거나, 위에서 보정하면 목차 검사에도 적용됩니다.
              {firstTocPage ? (
                <>
                  {' '}
                  목차 첫 쪽수가 <strong>{firstTocPage}</strong>이면 그쪽을 연 뒤{' '}
                  <strong>{firstTocPage}</strong>을 입력하세요.
                </>
              ) : null}
            </p>
          ) : null}
        </>
      )}

      <p className={stepClass}>2. 목차 입력</p>
      <p className={hintClass}>
        목차를 메모장(TXT) 파일로 업로드하고{' '}
        {embedded ? (
          <span className="consistency-toc-section__start-chip">검수</span>
        ) : (
          '검수'
        )}
        를 누르세요 (구분기호 &apos;┃&apos;등도 그대로 넣습니다)
      </p>
      <p
        className={`${hintClass}${
          embedded
            ? ' consistency-toc-section__page-range consistency-toc-section__page-range-row'
            : ''
        }`}
      >
        <span className="consistency-toc-section__page-range-text">
          목차 페이지 범위{' '}
          <input
            type="text"
            className={excludeInputClass}
            value={tocBodyExcludePages}
            onChange={(e) => onTocBodyExcludePagesChange(e.target.value)}
            placeholder="18-24"
            aria-label="목차 페이지 범위, 일치 확인에서 제외"
            autoComplete="off"
          />
          {' '}: 해당 범위는 일치 확인에서 제외됩니다
        </span>
        {embedded ? (
          <>
            <button
              type="button"
              className={fileBtnClass}
              onClick={() => tocFileInputRef.current?.click()}
            >
              메모장 업로드
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
          </>
        ) : null}
      </p>
      <div
        className={
          embedded ? 'consistency-toc-section__txt-upload-zone' : 'toc-body-setup__txt-upload-zone'
        }
      >
        {!embedded || tocBodyText.trim() ? (
          <div className={actionsClass}>
            {!embedded ? (
              <>
                <button
                  type="button"
                  className={fileBtnClass}
                  onClick={() => tocFileInputRef.current?.click()}
                >
                  메모장 업로드
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
              </>
            ) : null}
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
        ) : null}
        <textarea
          className={textareaClass}
          value={tocBodyText}
          onChange={(e) => onTocBodyTextChange(e.target.value)}
          placeholder={
            'TXT 바로 붙여놓기도 가능합니다\n\n1부 ┃빨간펜에서 개발까지\n  1장 편집자에게 어떤 일이 있었을까?\n  2장 경력이 무색한 크로스 교정 실험\n  3장 인내심의 충돌'
          }
          rows={textareaRows}
          aria-label="목차 항목 목록"
        />
      </div>
      {!runInHeader ? (
        <button
          type="button"
          className={runBtnClass}
          disabled={!canRunCheck}
          onClick={() => onRunCheck()}
        >
          {isProcessing ? '검수 중…' : '검수'}
        </button>
      ) : null}
      {!hasPdf ? (
        <p className={runHintClass}>가운데에서 PDF를 업로드한 뒤 검사할 수 있습니다.</p>
      ) : hasPdf && hasTocBodyEntries(tocBodyText) && !printedPagesActive ? (
        <p className={runHintClass}>
          맞춤법 확인에서 인쇄 쪽 보정을 하거나, 위에서 보정한 뒤 검수하세요.
        </p>
      ) : null}
    </section>
  );

  if (embedded) {
    return section;
  }

  return <div className="toc-body-setup">{section}</div>;
}
