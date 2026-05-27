import { useCallback, useMemo, useRef, useState } from 'react';
import { trackPdfOpened } from '../lib/analytics.js';
import {
  extractAllPagesText,
  loadPdfFromBuffer,
} from '../lib/pdfService.js';

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

  const loadPdfFromFile = useCallback(async (file) => {
    setLoadError(null);
    setPdfFileName(file.name);
    setPdfByteLength(file.size);

    const buffer = await file.arrayBuffer();
    pdfBufferRef.current = buffer;
    const doc = await loadPdfFromBuffer(buffer);
    setPdf(doc);
    setCurrentPage(1);
    setIsProcessing(true);
    setProgress({ current: 0, total: doc.numPages, phase: 'extract' });

    const pages = await extractAllPagesText(doc, (current, total) => {
      setProgress({ current, total, phase: 'extract' });
    });

    setPageTexts(pages);
    const textExtracted = pages.some((p) => p.text.trim());
    if (!textExtracted) {
      setLoadError(
        '스캔 PDF는 문자를 읽을 수 없습니다. 인디자인으로 만든 텍스트 PDF를 준비해 주세요.',
      );
    }
    trackPdfOpened({
      pageCount: doc.numPages,
      sizeBytes: file.size,
      textExtracted,
    });
    return doc;
  }, []);

  const resetPdfDocument = useCallback(() => {
    pdfBufferRef.current = null;
    fileHandleRef.current = null;
    setPdf(null);
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
    resetPdfDocument,
    clearFileHandle,
    progressLabel,
    currentPageData,
    canPersist,
    fileHandleActive: Boolean(fileHandleRef.current),
  };
}
