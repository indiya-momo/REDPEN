import { useEffect, useMemo, useRef, useState } from 'react';
import PrintedPageSetup from '../../components/PrintedPageSetup.jsx';
import PanelSectionRunButton from '../../components/PanelSectionRunButton.jsx';
import { formatSystemPageLabel } from '../../lib/printedPageDisplay.js';
import { hasTocBodyEntries, parseTocBodyEntries } from '../lib/tocBodyCheck.js';

/**
 * 일관성 패널에 embedded 되는 목차 · 본문 설정 (standalone 탭 UI는 사용하지 않음)
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
 *   checkQuotaBlocked?: boolean,
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
  textareaRows = 7,
}) {
  const tocFileInputRef = useRef(/** @type {HTMLInputElement | null} */ (null));

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
    hasPdf &&
    hasTocBodyEntries(tocBodyText) &&
    printedPagesActive &&
    !isProcessing &&
    !checkQuotaBlocked;

  const loadTocFile = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      onTocBodyTextChange(String(reader.result ?? ''));
    };
    reader.onerror = () => {
      alert('목차 파일을 읽지 못했습니다.');
    };
    reader.readAsText(file, 'utf-8');
  };

  return (
    <section
      className="consistency-section-box consistency-toc-section"
      aria-labelledby="consistency-toc-heading"
    >
      <div className="consistency-toc-section__header">
        <p
          id="consistency-toc-heading"
          className="printed-page-setup__title consistency-panel-section-title panel-criteria-heading"
        >
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

      {!hasPdf ? (
        <p className="hint consistency-toc-section__hint">
          가운데에서 PDF를 업로드하면 맞춤법·목차 검사에 함께 사용됩니다.
        </p>
      ) : null}

      <p className="consistency-toc-section__step-label">1. 파일 - 원고 페이지 맞추기</p>
      {printedPagesActive && !showCalibrationEditor ? (
        <div className="consistency-toc-section__calibration-done">
          <p>
            현재 파일 <strong>{formatSystemPageLabel(currentSystemPage)}</strong>가
            원고 기준{' '}
            <strong className="manuscript-page-label">{currentPrintedLabel}</strong>
            로 보정되었습니다.
          </p>
          <button
            type="button"
            className="consistency-toc-section__recalibrate-btn"
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
            <p className="hint consistency-toc-section__tip">
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

      <p className="consistency-toc-section__step-label">2. 목차 입력</p>
      <p className="hint consistency-toc-section__hint">
        목차를 메모장(TXT) 파일로 업로드하고{' '}
        <span className="consistency-toc-section__start-chip">검수</span>를 누르세요
        (구분기호 &apos;┃&apos;등도 그대로 넣습니다)
      </p>
      <p
        className={`hint consistency-toc-section__hint consistency-toc-section__page-range consistency-toc-section__page-range-row`}
      >
        <span className="consistency-toc-section__page-range-text">
          목차 페이지 범위{' '}
          <input
            type="text"
            className="consistency-toc-section__exclude-pages-input"
            value={tocBodyExcludePages}
            onChange={(e) => onTocBodyExcludePagesChange(e.target.value)}
            placeholder="예: 18-24"
            aria-label="인쇄 쪽 목차판 페이지 범위, 해당 구간만 일치 확인에서 제외"
            autoComplete="off"
          />
          {tocBodyExcludePages.trim() ? (
            <button
              type="button"
              className="consistency-toc-section__page-range-clear"
              onClick={() => onTocBodyExcludePagesChange('')}
            >
              지우기
            </button>
          ) : null}{' '}
          <span className="consistency-toc-section__page-range-hint">
            (인쇄 쪽 · 목차판만 제외, 앞쪽 본문은 검색)
          </span>
          : 해당 범위는 일치 확인에서 제외됩니다
        </span>
        <button
          type="button"
          className="consistency-toc-section__file-btn"
          onClick={() => tocFileInputRef.current?.click()}
        >
          메모장 업로드
        </button>
        <input
          ref={tocFileInputRef}
          type="file"
          accept=".txt,text/plain"
          className="consistency-toc-section__file-input"
          aria-hidden
          tabIndex={-1}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) loadTocFile(file);
          }}
        />
      </p>
      <div className="consistency-toc-section__txt-upload-zone">
        {tocBodyText.trim() ? (
          <div className="consistency-toc-section__actions">
            <button
              type="button"
              className="consistency-toc-section__clear-btn"
              onClick={() => onTocBodyTextChange('')}
            >
              목차 지우기
            </button>
          </div>
        ) : null}
        <textarea
          className="consistency-toc-section__textarea custom-scrollbar"
          value={tocBodyText}
          onChange={(e) => onTocBodyTextChange(e.target.value)}
          placeholder={
            'TXT 바로 붙여놓기도 가능합니다\n\n1부 ┃빨간펜에서 개발까지\n  1장 편집자에게 어떤 일이 있었을까?\n  2장 경력이 무색한 크로스 교정 실험\n  3장 인내심의 충돌'
          }
          rows={textareaRows}
          aria-label="목차 항목 목록"
        />
      </div>
      {hasPdf && hasTocBodyEntries(tocBodyText) && !printedPagesActive ? (
        <p className="hint consistency-toc-section__run-hint">
          맞춤법 확인에서 파일 - 원고 페이지 맞추기를 하거나, 위에서 맞춘 뒤 검수하세요.
        </p>
      ) : null}
    </section>
  );
}
