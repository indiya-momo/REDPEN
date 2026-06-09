/**
 * PDF 파일/버퍼 로드, 페이지 텍스트 추출, 현재 페이지·진행률 상태.
 * 출판 가능 PDF 게이트(pdfPublishGate) 통과 후에만 본문 사용.
 * 최초 유효 오픈 시 trackPdfOpened 1회.
 */
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

/** @param {import('pdfjs-dist').PDFDocumentProxy | null | undefined} doc */
function destroyPdfDocument(doc) {
  if (doc && typeof doc.destroy === 'function') {
    void doc.destroy();
  }
}

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

  /**
   * 추출 완료 후 게이트 반영. restore·업로드 공용 — 여기서 pdf_opened 1회.
   * @param {import('pdfjs-dist').PDFDocumentProxy} doc
   * @param {import('../lib/pdfService.js').PageData[]} pages
   * @param {{ sizeBytes?: number }} [meta]
   */
  const applyExtractValidation = useCallback(async (doc, pages, meta = {}) => {
    const producerHints = await getPdfProducerHints(doc);
    const validation = validatePublishablePdf({ producerHints, pages });
    const ok = validation.ok;
    trackPdfOpened({
      pageCount: doc.numPages,
      sizeBytes: meta.sizeBytes ?? 0,
      textExtracted: ok,
    });
    if (!ok) {
      setLoadError(validation.message ?? null);
      setPdf((prev) => {
        destroyPdfDocument(prev);
        return null;
      });
      setPageTexts([]);
      return { ok: false, validation, producerHints };
    }
    setLoadError(null);
    setPdf((prev) => {
      destroyPdfDocument(prev);
      return doc;
    });
    setPageTexts(pages);
    return { ok: true, validation, producerHints };
  }, []);

  const loadPdfFromFile = useCallback(async (file) => {
    setLoadError(null);
    setPdfFileName(file.name);
    setPdfByteLength(file.size);
    setPdf((prev) => {
      destroyPdfDocument(prev);
      return null;
    });
    setPageTexts([]);
    setCurrentPage(1);

    const buffer = await file.arrayBuffer();
    pdfBufferRef.current = buffer;
    const doc = await loadPdfFromBuffer(buffer);
    setIsProcessing(true);
    setProgress({ current: 0, total: doc.numPages, phase: 'extract' });

    try {
      const pages = await extractAllPagesText(doc, (current, total) => {
        setProgress({ current, total, phase: 'extract' });
      });

      const { ok } = await applyExtractValidation(doc, pages, {
        sizeBytes: file.size,
      });
      return ok ? doc : null;
    } finally {
      setIsProcessing(false);
      setProgress(null);
    }
  }, [applyExtractValidation]);

  const resetPdfDocument = useCallback(() => {
    pdfBufferRef.current = null;
    fileHandleRef.current = null;
    setPdf((prev) => {
      destroyPdfDocument(prev);
      return null;
    });
    setPdfFileName(null);
    setPdfByteLength(null);
    setPageTexts([]);
    setCurrentPage(1);
    setLoadError(null);
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
