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
import {
  buildFinalTxt,
  downloadTextFile,
  preparePdfTxtReview,
} from '../lib/pdfTxtExport.js';
import { showAppAlert } from '../lib/appDialog.js';
import TooltipGuide from './TooltipGuide.jsx';
import CriteriaHoverTip from './CriteriaHoverTip.jsx';
import PdfTxtLinebreakReviewModal from './PdfTxtLinebreakReviewModal.jsx';

/**
 * @param {{
 *   fileRef: React.RefObject<HTMLInputElement | null>,
 *   onOpenPicker: () => void,
 *   onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void,
 *   onLoadPdfFile: (file: File) => void | Promise<void>,
 *   onClearSession: () => void,
 *   onRunCheck?: () => void,
 *   showRunButton?: boolean,
 *   isProcessing: boolean,
 *   progressLabel: string | null,
 *   progress: { current: number; total: number; phase?: string } | null,
 *   pdf: import('pdfjs-dist').PDFDocumentProxy | null,
 *   pdfFileName: string | null,
 *   isDemoSample?: boolean,
 *   pdfByteLength: number | undefined,
 *   pageTextsLength: number,
 *   loadError: string | null,
 *   sessionHint: string | null,
 *   runLabel: string,
 *   showReady: boolean,
 *   isRestoring?: boolean,
 *   showUploadGuide?: boolean,
 *   uploadGuideStorageKey?: string,
 *   uploadGuidePinned?: boolean,
 *   uploadGuideMessage?: import('react').ReactNode,
 *   uploadGuideSpotlight?: boolean,
 *   uploadGuideShowConfirm?: boolean,
 *   onUploadGuideDismiss?: () => void,
 *   checkQuotaBlocked?: boolean,
 * }} props
 */
export default function PdfCenterStage({
  fileRef,
  onOpenPicker,
  onFileChange,
  onLoadPdfFile,
  onClearSession,
  onRunCheck = () => {},
  showRunButton = true,
  isProcessing,
  progressLabel,
  progress,
  pdf,
  pdfFileName,
  isDemoSample = false,
  pdfByteLength,
  pageTextsLength,
  loadError,
  sessionHint,
  runLabel,
  showReady,
  isRestoring = false,
  showUploadGuide = true,
  uploadGuideStorageKey = 'work-pre-upload-v1',
  uploadGuidePinned = false,
  uploadGuideMessage = '처음 할 일은 이거다냥',
  uploadGuideSpotlight = false,
  uploadGuideShowConfirm = false,
  onUploadGuideDismiss,
  checkQuotaBlocked = false,
}) {
  const [dragOver, setDragOver] = useState(false);
  const [txtConverting, setTxtConverting] = useState(false);
  const [txtReview, setTxtReview] = useState(
    /** @type {null | Awaited<ReturnType<typeof preparePdfTxtReview>>} */ (null),
  );
  const dragDepth = useRef(0);
  const txtFileRef = useRef(/** @type {HTMLInputElement | null} */ (null));

  const openPicker = useCallback(() => {
    onUploadGuideDismiss?.();
    if (supportsFilePicker()) onOpenPicker();
    else fileRef.current?.click();
  }, [fileRef, onOpenPicker, onUploadGuideDismiss]);

  const openTxtPicker = useCallback(() => {
    onUploadGuideDismiss?.();
    txtFileRef.current?.click();
  }, [onUploadGuideDismiss]);

  const closeTxtReview = useCallback(() => {
    setTxtReview(null);
  }, []);

  const onTxtFileChange = useCallback(async (e) => {
    const input = e.target;
    const file = input.files?.[0] ?? null;
    input.value = '';
    if (!file) return;
    setTxtConverting(true);
    try {
      const prepared = await preparePdfTxtReview(file);
      setTxtReview(prepared);
    } catch (err) {
      await showAppAlert(
        err instanceof Error ? err.message : 'TXT 변환에 실패했습니다.',
      );
    } finally {
      setTxtConverting(false);
    }
  }, []);

  const onTxtReviewConfirm = useCallback(
    (payload) => {
      if (!txtReview) {
        closeTxtReview();
        return;
      }
      const decisions = payload?.decisions ?? {};
      const autoParagraph = payload?.autoParagraph !== false;
      const text = buildFinalTxt(txtReview.cleanedPages, decisions, {
        autoParagraph,
      });
      downloadTextFile(text, txtReview.finalFilename);
      closeTxtReview();
    },
    [closeTxtReview, txtReview],
  );

  const onTxtDownloadDraft = useCallback(() => {
    if (!txtReview) return;
    downloadTextFile(txtReview.draftWithMarkers, txtReview.draftFilename);
  }, [txtReview]);

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
      <input
        ref={txtFileRef}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={onTxtFileChange}
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
          PDF파일인지 확인해주세요
        </p>
      )}

      <div className="pdf-center-stage__stack">
        {isRestoring && !showReady ? (
          <div className="pdf-center-stage__preupload" role="status" aria-live="polite">
            <p className="pdf-dropzone__drag">이전 PDF를 다시 여는 중…</p>
            {progressLabel ? (
              <p className="pdf-dropzone__limit">{progressLabel}</p>
            ) : (
              <p className="pdf-dropzone__limit">
                {pdfFileName ? pdfFileName : "저장된 원고"}
              </p>
            )}
          </div>
        ) : !showReady ? (
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
                <span className="pdf-center-stage__hero-tooltip-dot" />
              </span>
            </div>
            {showUploadGuide ? (
              <TooltipGuide
                storageKey={uploadGuideStorageKey}
                placement="left"
                bubbleType="left"
                useFixedLayer
                offsetX={12}
                offsetY={0}
                bubbleGuideStep="1b"
                pinned={uploadGuidePinned}
                showConfirm={uploadGuideShowConfirm}
                message={uploadGuideMessage}
                onDismiss={onUploadGuideDismiss}
              >
                <div
                  className={`pdf-dropzone${
                    dragOver ? ' pdf-dropzone--dragover' : ''
                  }${uploadGuideSpotlight ? ' work-guide-spotlight' : ''}`}
                  data-work-guide="pdf-dropzone"
                >
                  <div className="pdf-dropzone__icon" aria-hidden>
                    <FileText size={32} strokeWidth={1.35} />
                  </div>
                  <p className="pdf-dropzone__drag">인디자인 / 한글 PDF를 옮기거나</p>
                  <div className="pdf-dropzone__actions">
                    <button
                      type="button"
                      className="btn-upload pdf-dropzone__open"
                      data-work-guide="pdf-open"
                      onClick={openPicker}
                      disabled={isProcessing || txtConverting}
                    >
                      <Upload size={16} />
                      PDF 파일을 브라우저에 업로드
                    </button>
                    <button
                      type="button"
                      className="btn-upload-secondary pdf-dropzone__txt"
                      onClick={openTxtPicker}
                      disabled={isProcessing || txtConverting}
                      aria-label="PDF를 원고 TXT로 변환"
                    >
                      <FileText size={16} />
                      {txtConverting ? '변환 중…' : 'TXT 변환'}
                    </button>
                  </div>
                  <footer className="pdf-dropzone__footer">
                    <p className="pdf-dropzone__limit">
                      100MB 이하 권장 · 신국판 300페이지 내외
                    </p>
                    <p className="pdf-dropzone__txt-note">
                      문단 줄바꿈을 정리한 뒤 최종 TXT를 받습니다. 검수전 추출본도 받을 수 있습니다
                    </p>
                    <p className="pdf-dropzone__scan-note">
                      <span className="pdf-support-msg__scan">
                        스캔 PDF는 읽을 수 없어요ㅠ
                      </span>
                    </p>
                  </footer>
                </div>
              </TooltipGuide>
            ) : (
            <div
              className={`pdf-dropzone ${dragOver ? 'pdf-dropzone--dragover' : ''}${
                uploadGuideSpotlight ? ' work-guide-spotlight' : ''
              }`}
              data-work-guide="pdf-dropzone"
            >
            <div className="pdf-dropzone__icon" aria-hidden>
              <FileText size={32} strokeWidth={1.35} />
            </div>
            <p className="pdf-dropzone__drag">인디자인 / 한글 PDF를 옮기거나</p>
            <div className="pdf-dropzone__actions">
              <button
                type="button"
                className="btn-upload pdf-dropzone__open"
                data-work-guide="pdf-open"
                onClick={openPicker}
                disabled={isProcessing || txtConverting}
              >
                <Upload size={16} />
                PDF 파일을 브라우저에 업로드
              </button>
              <button
                type="button"
                className="btn-upload-secondary pdf-dropzone__txt"
                onClick={openTxtPicker}
                disabled={isProcessing || txtConverting}
                aria-label="PDF를 원고 TXT로 변환"
              >
                <FileText size={16} />
                {txtConverting ? '변환 중…' : 'TXT 변환'}
              </button>
            </div>
            <footer className="pdf-dropzone__footer">
              <p className="pdf-dropzone__limit">
                100MB 이하 권장 · 신국판 300페이지 내외
              </p>
              <p className="pdf-dropzone__txt-note">
                문단 줄바꿈을 정리한 뒤 최종 TXT를 받습니다. 검수전 추출본도 받을 수 있습니다
              </p>
              <p className="pdf-dropzone__scan-note">
                <span className="pdf-support-msg__scan">스캔 PDF는 읽을 수 없어요ㅠ</span>
              </p>
            </footer>
            </div>
            )}
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
                <p className="pdf-ready-file__name">
                  {pdfFileName}
                  {isDemoSample ? (
                    <span className="pdf-ready-file__demo-badge">데모</span>
                  ) : null}
                </p>
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
              <CriteriaHoverTip tip={extractBusy ? '준비 중' : '업로드 완료'}>
                <span className="pdf-ready-file__status" aria-hidden>
                  <CheckCircle2 size={24} strokeWidth={2} />
                </span>
              </CriteriaHoverTip>
            </div>

            {showRunButton ? (
              <button
                type="button"
                className="btn-run pdf-ready-panel__run"
                onClick={onRunCheck}
                disabled={runDisabled}
              >
                <Play size={16} />
                {checkBusy ? '검수 중…' : runLabel}
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

      <PdfTxtLinebreakReviewModal
        open={Boolean(txtReview)}
        sourceName={txtReview?.sourceName ?? ''}
        candidates={txtReview?.candidates ?? []}
        paragraphStats={txtReview?.paragraphStats}
        onCancel={closeTxtReview}
        onConfirm={onTxtReviewConfirm}
        onDownloadDraft={onTxtDownloadDraft}
      />
    </div>
  );
}
