import { useEffect, useState } from 'react';
import {
  appendPageLabelSuffix,
  formatSystemPageLabel,
  stripPageLabelPrefix,
} from '../lib/printedPageDisplay.js';

/**
 * @param {{
 *   currentSystemPage: number,
 *   active: boolean,
 *   currentPrintedLabel: string,
 *   previewPrintedLabel?: string,
 *   spreadInput: boolean,
 *   onSpreadInputChange: (v: boolean) => void,
 *   firstPageSingle: boolean,
 *   onFirstPageSingleChange: (v: boolean) => void,
 *   onCalibrateFromInput: (raw: string, isSpread: boolean) => void,
 *   onClear: () => void,
 * }} props
 */
export default function PrintedPageSetup({
  currentSystemPage,
  active,
  currentPrintedLabel,
  previewPrintedLabel = '',
  spreadInput,
  onSpreadInputChange,
  firstPageSingle,
  onFirstPageSingleChange,
  onCalibrateFromInput,
  onClear,
}) {
  const [draft, setDraft] = useState('');

  const displayTarget =
    draft.trim() ||
    (active
      ? stripPageLabelPrefix(currentPrintedLabel)
      : previewPrintedLabel.trim()) ||
    '…';

  useEffect(() => {
    if (active) {
      setDraft(stripPageLabelPrefix(currentPrintedLabel));
    } else {
      setDraft('');
    }
  }, [active, currentPrintedLabel]);

  const submitCalibration = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    onCalibrateFromInput(trimmed, spreadInput);
  };

  const filePageLabel = formatSystemPageLabel(currentSystemPage);
  const manuscriptPageLabel = active
    ? currentPrintedLabel.trim() ||
      (displayTarget !== '…' ? appendPageLabelSuffix(displayTarget) : '…')
    : '';

  return (
    <section className="printed-page-setup" aria-label="인쇄 쪽수 보정">
      <p className="printed-page-setup__title">인쇄 쪽 보정</p>

      <div className="printed-page-setup__body">
        <p className="printed-page-setup__hint">
          {active ? (
            <>
              현재 파일 <strong>{filePageLabel}</strong>가 원고 기준{' '}
              <strong>{manuscriptPageLabel}</strong>로 보정되었습니다.
            </>
          ) : (
            <>
              현재 파일 기준은 <strong>{filePageLabel}</strong>입니다.
              <br />
              원고에서 보이는 쪽수(예: <strong>50-51</strong>)를 입력한 뒤{' '}
              <strong>보정</strong>을 누르세요.
            </>
          )}
        </p>
        <div className="printed-page-setup__row">
          <label className="sr-only" htmlFor="printed-page-input">
            PDF 표시 쪽수
          </label>
          <input
            id="printed-page-input"
            type="text"
            inputMode="numeric"
            className="printed-page-setup__input"
            placeholder={spreadInput ? '6-7' : '6'}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                submitCalibration();
              }
            }}
          />
          <label className="printed-page-setup__inline-opt">
            <input
              type="checkbox"
              checked={firstPageSingle}
              onChange={(e) => onFirstPageSingleChange(e.target.checked)}
            />
            <span>1P로 시작</span>
          </label>
          <label className="printed-page-setup__inline-opt">
            <input
              type="checkbox"
              checked={spreadInput}
              onChange={(e) => onSpreadInputChange(e.target.checked)}
            />
            <span>펼침면 구성(2P)</span>
          </label>
          <div className="printed-page-setup__actions">
            <button
              type="button"
              className="printed-page-setup__save"
              onClick={submitCalibration}
            >
              보정
            </button>
            <button
              type="button"
              className="printed-page-setup__reset"
              onClick={onClear}
              disabled={!active}
            >
              취소
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
