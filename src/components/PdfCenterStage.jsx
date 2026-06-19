import { useCallback, useEffect, useRef, useState } from 'react';
import { Upload, FileText, CheckCircle2, Play, RotateCcw } from 'lucide-react';
import pdfMomoIcon from '../assets/momo/pdf-momo.png';
import pdfFullIcon from '../assets/momo/pdf-full.png';
import { supportsFilePicker } from '../lib/sessionStore.js';
import { formatFileSizeMb } from '../lib/formatFileSize.js';
import {
  isPdfSizeOverMax,
  isPdfSizeOverWarn,
  PDF_SIZE_MAX_MESSAGE,
} from '../lib/pdfSizeLimits.js';
import TooltipGuide from './TooltipGuide.jsx';

/**
 * @param {{
 *   fileRef: React.RefObject<HTMLInputElement | null>,
 *   onOpenPicker: () => void,
 *   onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void,
 *   onLoadPdfFile: (file: File) => void | Promise<void>,
 *   onReconnect: () => void,
 *   onClearSession: () => void,
 *   onRunCheck?: () => void,
 *   showRunButton?: boolean,
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
 *   showReady: boolean,
 *   showUploadGuide?: boolean,
 *   uploadGuideStorageKey?: string,
 *   uploadGuidePinned?: boolean,
 *   onUploadGuideDismiss?: () => void,
 *   checkQuotaBlocked?: boolean,
 * }} props
 */
export default function PdfCenterStage({
  fileRef,
  onOpenPicker,
  onFileChange,
  onLoadPdfFile,
  onReconnect,
  onClearSession,
  onRunCheck = () => {},
  showRunButton = true,
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
  showReady,
  showUploadGuide = true,
  uploadGuideStorageKey = 'pdf-upload-first-step',
  uploadGuidePinned = false,
  onUploadGuideDismiss,
  checkQuotaBlocked = false,
}) {
  const [dragOver, setDragOver] = useState(false);
  const dragDepth = useRef(0);

  const openPicker = useCallback(() => {
    onUploadGuideDismiss?.();
    if (supportsFilePicker()) onOpenPicker();
    else fileRef.current?.click();
  }, [fileRef, onOpenPicker, onUploadGuideDismiss]);

  useEffect(() => {
    if (showReady) onUploadGuideDismiss?.();
  }, [showReady, onUploadGuideDismiss]);

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
  const isSizeBlocked = isPdfSizeOverMax(pdfByteLength);
  const isSizeOverRecommended = isPdfSizeOverWarn(pdfByteLength);
  const extractBusy =
    isProcessing && progress?.phase === 'extract' && !pageTextsLength;
  const checkBusy = isProcessing && progress?.phase === 'check';
  const runDisabled =
    isProcessing ||
    !pdf ||
    !pageTextsLength ||
    extractBusy ||
    Boolean(loadError) ||
    checkQuotaBlocked;
  const scanPdfDetected =
    typeof loadError === 'string' &&
    loadError.includes('스캔 PDF는 문자를 읽을 수 없습니다');
  const uploadFailed = Boolean(loadError) && !showReady;
  const uploadFailedHint = sessionHint === '업로드 실패';
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
        <p
          className={`pdf-center-stage__session-hint ${uploadFailedHint ? 'pdf-center-stage__session-hint--upload-fail' : ''}`}
        >
          {sessionHint}
        </p>
      )}
      {uploadFailed && (
        <p className="pdf-center-stage__upload-fail">
          텍스트 선택이 가능한
          <br />
          인디자인 PDF인지 확인해 주세요
        </p>
      )}

      <div className="pdf-center-stage__stack">
        {!showReady ? (
          <div className="pdf-center-stage__preupload">
            <div className="pdf-center-stage__hero pdf-center-stage__hero--idle">
              <img
                className="pdf-center-stage__momo pdf-center-stage__momo--idle"
                src={momoSrc}
                alt=""
                aria-hidden
                decoding="async"
              />
              <span className="pdf-center-stage__hero-tooltip-anchor" aria-hidden>
                {showUploadGuide ? (
                  <TooltipGuide
                    storageKey={uploadGuideStorageKey}
                    placement="left"
                    bubbleType="left"
                    offsetX={60}
                    offsetY={-50}
                    imageSrc={null}
                    pinned={uploadGuidePinned}
                    showConfirm={false}
                    message="처음 할 일은 이거다냥"
                    onDismiss={onUploadGuideDismiss}
                  >
                    <span className="pdf-center-stage__hero-tooltip-dot" />
                  </TooltipGuide>
                ) : (
                  <span className="pdf-center-stage__hero-tooltip-dot" />
                )}
              </span>
            </div>
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
              <p className="pdf-dropzone__limit">
                <strong>100MB 이하</strong>
                <span className="pdf-dropzone__limit-detail">
                  (50MB 이하 권장 · 신국판 300페이지 내외)
                </span>
              </p>
              <p className="pdf-dropzone__scan-note">
                <span className="pdf-support-msg__scan">스캔 PDF는 읽을 수 없어요ㅠ</span>
              </p>
            </footer>
            </div>
          </div>
        ) : (
          <>
            <div className="pdf-center-stage__hero pdf-center-stage__hero--ready">
              <img
                className="pdf-center-stage__momo"
                src={momoSrc}
                alt=""
                aria-hidden
                decoding="async"
              />
            </div>
          <div className="pdf-ready-panel">
            <div className="pdf-ready-file">
              <span className="pdf-ready-file__icon" aria-hidden>
                <FileText size={24} strokeWidth={1.5} />
              </span>
              <div className="pdf-ready-file__meta">
                <p className="pdf-ready-file__name">{pdfFileName}</p>
                <p className="pdf-ready-file__detail">
                  {isSizeBlocked ? (
                    <>
                      파일: {sizeLabel ?? '—'}
                      <span className="pdf-ready-file__size-warn pdf-ready-file__size-warn--blocked">
                        (100MB 초과 · 검수 불가)
                      </span>
                    </>
                  ) : isSizeOverRecommended ? (
                    <>
                      파일: {sizeLabel ?? '—'}
                      <span className="pdf-ready-file__size-warn">
                        (50MB 초과 · 검수 가능, 느리거나 불안정할 수 있음)
                      </span>
                    </>
                  ) : (
                    <>
                      {sizeLabel ?? '—'}
                      {extractBusy && ' · 텍스트 추출 중…'}
                    </>
                  )}
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

            {showRunButton ? (
              <button
                type="button"
                className="btn-run pdf-ready-panel__run"
                onClick={onRunCheck}
                disabled={runDisabled}
              >
                <Play size={16} />
                {checkBusy ? '검사 중…' : runLabel}
              </button>
            ) : null}

            {isSizeBlocked && (
              <p className="error-text pdf-ready-panel__size-block">
                {PDF_SIZE_MAX_MESSAGE}
              </p>
            )}

            {isSizeOverRecommended && (
              <div className="pdf-ready-panel__size-warn-actions">
                <p className="hint pdf-ready-panel__size-warn-hint">
                  용량이 큽니다. 가능하면 PDF를 나누어 작업하는 것을 권장합니다.
                </p>
                <a
                  className="link-btn"
                  href="https://www.ilovepdf.com/ko/split_pdf#split,range"
                  target="_blank"
                  rel="noreferrer"
                >
                  PDF 나누기
                </a>
              </div>
            )}

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
          </>
        )}
      </div>

      {loadError && (
        <p className="error-text pdf-center-stage__error">{loadError}</p>
      )}
      {scanPdfDetected && (
        <p className="hint pdf-center-stage__scan-hint">
          스캔 PDF는 용량이 커질 수 있습니다. 텍스트 PDF 권장
        </p>
      )}
    </div>
  );
}
