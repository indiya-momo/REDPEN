import { useCallback, useMemo, useRef, useState } from 'react';
import { trackPdfOpened } from '../lib/analytics.js';
import {
  extractAllPagesText,
  loadPdfFromBuffer,
} from '../lib/pdfService.js';
import {
  getPdfProducerHints,
  validatePublishablePdf,
} from '../lib/pdfPublishGate.js';

/**
 * PDF 로드·텍스트 추출·현재 페이지
 */
export function usePdfDocument() {
  const fileRef = useRef(null);
  const pdfBufferRef = useRef(null);
  /** @type {React.MutableRefObject<FileSystemFileHandle | null>} */
  const fileHandleRef = useRef(null);

  const [pdf, setPdf] = useState(null);
  const [pdfFileName, setPdfFileName] = useState(null);
  const [pdfByteLength, setPdfByteLength] = useState(null);
  const [pageTexts, setPageTexts] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(null);
  const [loadError, setLoadError] = useState(null);
  /** @type {[string[] | null, React.Dispatch<React.SetStateAction<string[] | null>>]} */
  const [loadAdvisory, setLoadAdvisory] = useState(null);

  /**
   * 추출 완료 후 게이트·advisory 반영. restore 경로와 loadPdfFromFile 공용.
   * @param {import('pdfjs-dist').PDFDocumentProxy} doc
   * @param {import('../lib/pdfService.js').PageData[]} pages
   */
  const applyExtractValidation = useCallback(async (doc, pages) => {
    const producerHints = await getPdfProducerHints(doc);
    const validation = validatePublishablePdf({ producerHints, pages });
    if (!validation.ok) {
      setLoadError(validation.message ?? null);
      setLoadAdvisory(null);
      setPdf(null);
      setPageTexts([]);
      return { ok: false, validation, producerHints };
    }
    setLoadError(null);
    setPdf(doc);
    setPageTexts(pages);
    setLoadAdvisory(validation.advisory?.lines ?? null);
    return { ok: true, validation, producerHints };
  }, []);

  const loadPdfFromFile = useCallback(async (file) => {
    setLoadError(null);
    setLoadAdvisory(null);
    setPdfFileName(file.name);
    setPdfByteLength(file.size);
    setPdf(null);
    setPageTexts([]);
    setCurrentPage(1);

    const buffer = await file.arrayBuffer();
    pdfBufferRef.current = buffer;
    const doc = await loadPdfFromBuffer(buffer);
    setIsProcessing(true);
    setProgress({ current: 0, total: doc.numPages, phase: 'extract' });

    const pages = await extractAllPagesText(doc, (current, total) => {
      setProgress({ current, total, phase: 'extract' });
    });

    const { ok, validation } = await applyExtractValidation(doc, pages);
    trackPdfOpened({
      pageCount: doc.numPages,
      sizeBytes: file.size,
      textExtracted: ok,
      publishGate: validation.reason,
    });
    return ok ? doc : null;
  }, [applyExtractValidation]);

  const resetPdfDocument = useCallback(() => {
    pdfBufferRef.current = null;
    fileHandleRef.current = null;
    setPdf(null);
    setPdfFileName(null);
    setPdfByteLength(null);
    setPageTexts([]);
    setCurrentPage(1);
    setLoadError(null);
    setLoadAdvisory(null);
  }, []);

  const clearFileHandle = useCallback(() => {
    fileHandleRef.current = null;
  }, []);

  const progressLabel = useMemo(() => {
    if (progress?.phase === 'restore') {
      return `복원 중 ${progress.current} / ${progress.total}`;
    }
    if (progress?.phase === 'extract') {
      return `텍스트 추출 ${progress.current} / ${progress.total}`;
    }
    if (progress?.phase === 'check') {
      return `검사 중 ${progress.current} / ${progress.total}페이지`;
    }
    return null;
  }, [progress]);

  const currentPageData =
    pageTexts.find((p) => p.pageNum === currentPage) ?? null;

  const canPersist =
    Boolean(pdfFileName) &&
    pageTexts.length > 0 &&
    Boolean(fileHandleRef.current || pdfBufferRef.current);

  return {
    fileRef,
    pdfBufferRef,
    fileHandleRef,
    pdf,
    pdfFileName,
    pdfByteLength,
    setPdfByteLength,
    pageTexts,
    currentPage,
    setCurrentPage,
    isProcessing,
    setIsProcessing,
    progress,
    setProgress,
    loadError,
    setLoadError,
    loadAdvisory,
    setLoadAdvisory,
    setPdf,
    setPdfFileName,
    setPageTexts,
    loadPdfFromFile,
    applyExtractValidation,
    resetPdfDocument,
    clearFileHandle,
    progressLabel,
    currentPageData,
    canPersist,
    fileHandleActive: Boolean(fileHandleRef.current),
  };
}
