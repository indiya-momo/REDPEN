import { useCallback, useRef, useState } from 'react';
import { Upload, FileText, CheckCircle2, Play, RotateCcw } from 'lucide-react';
import pdfMomoIcon from '../assets/momo/pdf-momo.png';
import pdfFullIcon from '../assets/momo/pdf-full.png';
import { supportsFilePicker } from '../lib/sessionStore.js';
import { formatFileSizeMb } from '../lib/formatFileSize.js';

/**
 * @param {{
 *   fileRef: React.RefObject<HTMLInputElement | null>,
 *   onOpenPicker: () => void,
 *   onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void,
 *   onLoadPdfFile: (file: File) => void | Promise<void>,
 *   onReconnect: () => void,
 *   onClearSession: () => void,
 *   onRunCheck: () => void,
 *   isProcessing: boolean,
 *   progressLabel: string | null,
 *   progress: { current: number; total: number; phase?: string } | null,
 *   pdf: import('pdfjs-dist').PDFDocumentProxy | null,
 *   pdfFileName: string | null,
 *   pdfByteLength: number | undefined,
 *   pageTextsLength: number,
 *   fileHandleActive: boolean,
 *   loadError: string | null,
 *   sessionHint: string | null,
 *   runLabel: string,
 *   ruleHint: string,
 *   showReady: boolean,
 * }} props
 */
export default function PdfCenterStage({
  fileRef,
  onOpenPicker,
  onFileChange,
  onLoadPdfFile,
  onReconnect,
  onClearSession,
  onRunCheck,
  isProcessing,
  progressLabel,
  progress,
  pdf,
  pdfFileName,
  pdfByteLength,
  pageTextsLength,
  fileHandleActive,
  loadError,
  sessionHint,
  runLabel,
  ruleHint,
  showReady,
}) {
  const [dragOver, setDragOver] = useState(false);
  const dragDepth = useRef(0);

  const openPicker = useCallback(() => {
    if (supportsFilePicker()) onOpenPicker();
    else fileRef.current?.click();
  }, [fileRef, onOpenPicker]);

  const onDragEnter = useCallback((e) => {
    e.preventDefault();
    dragDepth.current += 1;
    if (e.dataTransfer?.types?.includes('Files')) setDragOver(true);
  }, []);

  const onDragLeave = useCallback((e) => {
    e.preventDefault();
    dragDepth.current -= 1;
    if (dragDepth.current <= 0) {
      dragDepth.current = 0;
      setDragOver(false);
    }
  }, []);

  const onDragOver = useCallback((e) => {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
  }, []);

  const onDrop = useCallback(
    (e) => {
      e.preventDefault();
      dragDepth.current = 0;
      setDragOver(false);
      const file = e.dataTransfer?.files?.[0];
      if (file) void onLoadPdfFile(file);
    },
    [onLoadPdfFile],
  );

  const sizeLabel = formatFileSizeMb(pdfByteLength);
  const extractBusy =
    isProcessing && progress?.phase === 'extract' && !pageTextsLength;
  const checkBusy = isProcessing && progress?.phase === 'check';
  const runDisabled =
    isProcessing || !pdf || !pageTextsLength || extractBusy;
  const momoSrc = showReady ? pdfFullIcon : pdfMomoIcon;

  return (
    <div
      className="pdf-center-stage"
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={onFileChange}
      />

      {sessionHint && (
        <p className="pdf-center-stage__session-hint">{sessionHint}</p>
      )}

      <div className="pdf-center-stage__stack">
        <div
          className={`pdf-center-stage__hero ${showReady ? 'pdf-center-stage__hero--ready' : 'pdf-center-stage__hero--idle'}`}
        >
          <img
            className={`pdf-center-stage__momo ${showReady ? '' : 'pdf-center-stage__momo--idle'}`}
            src={momoSrc}
            alt=""
            aria-hidden
            decoding="async"
          />
        </div>

        {!showReady ? (
          <>
            <div
              className={`pdf-dropzone ${dragOver ? 'pdf-dropzone--dragover' : ''}`}
            >
              <div className="pdf-dropzone__icon" aria-hidden>
                <FileText size={32} strokeWidth={1.35} />
              </div>
              <p className="pdf-dropzone__drag">PDF 파일을 드래그하거나</p>
              <button
                type="button"
                className="btn-upload pdf-dropzone__open"
                onClick={openPicker}
                disabled={isProcessing}
              >
                <Upload size={16} />
                {supportsFilePicker() ? 'PDF 열기' : 'PDF 업로드'}
              </button>
              {fileHandleActive && !pdf && (
                <button
                  type="button"
                  className="btn-upload-secondary pdf-dropzone__reconnect"
                  onClick={onReconnect}
                  disabled={isProcessing}
                >
                  PDF 다시 연결
                </button>
              )}
              <footer className="pdf-dropzone__footer">
                <p>신국판 300페이지 · 50MB 이하 권장</p>
                <p className="subtle">스캔 PDF는 미지원합니다</p>
              </footer>
            </div>
          </>
        ) : (
          <div className="pdf-ready-panel">
            <div className="pdf-ready-file">
              <span className="pdf-ready-file__icon" aria-hidden>
                <FileText size={24} strokeWidth={1.5} />
              </span>
              <div className="pdf-ready-file__meta">
                <p className="pdf-ready-file__name">{pdfFileName}</p>
                <p className="pdf-ready-file__detail">
                  {sizeLabel ?? '—'}
                  {extractBusy && ' · 텍스트 추출 중…'}
                </p>
              </div>
              <span
                className="pdf-ready-file__status"
                title={extractBusy ? '준비 중' : '업로드 완료'}
                aria-hidden
              >
                <CheckCircle2 size={24} strokeWidth={2} />
              </span>
            </div>

            <button
              type="button"
              className="btn-run pdf-ready-panel__run"
              onClick={onRunCheck}
              disabled={runDisabled}
            >
              <Play size={16} />
              {checkBusy ? '검사 중…' : runLabel}
            </button>

            <p className="pdf-ready-panel__stats">{ruleHint}</p>

            {isProcessing && progressLabel && (
              <div className="pdf-ready-panel__progress-wrap">
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${progress?.total ? (progress.current / progress.total) * 100 : 0}%`,
                    }}
                  />
                </div>
                <p className="hint pdf-ready-panel__progress-label">
                  {progressLabel}
                </p>
              </div>
            )}

            <div className="pdf-ready-panel__actions">
              <button
                type="button"
                className="link-btn"
                onClick={openPicker}
                disabled={isProcessing}
              >
                다른 PDF 선택
              </button>
              {pdf && (
                <button
                  type="button"
                  className="link-btn"
                  onClick={onClearSession}
                  disabled={isProcessing}
                >
                  <RotateCcw size={14} aria-hidden />
                  작업 지우기
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {loadError && (
        <p className="error-text pdf-center-stage__error">{loadError}</p>
      )}
    </div>
  );
}
