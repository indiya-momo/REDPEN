import { useCallback, useEffect, useRef, useState } from 'react';
import { SPELLING_RULES_FP } from '../lib/builtInRules.js';
import { CAUTION_RULES_FP } from '../lib/cautionRules.js';
import {
  extractAllPagesText,
  loadPdfFromBuffer,
} from '../lib/pdfService.js';
import {
  clearWorkSession,
  getStorageHint,
  loadWorkSession,
  saveWorkSession,
} from '../lib/sessionStore.js';

/**
 * @param {ReturnType<import('./usePdfDocument.js').usePdfDocument>} pdf
 * @param {ReturnType<import('./useRuleCheck.js').useRuleCheck>} ruleCheck
 * @param {ReturnType<import('../toc-body/hooks/useTocBodyCheck.js').useTocBodyCheck>} tocCheck
 */
export function useWorkSession(pdf, ruleCheck, tocCheck) {
  const [sessionHint, setSessionHint] = useState(null);
  const [isRestoring, setIsRestoring] = useState(true);
  const restoreGenerationRef = useRef(0);

  const invalidateRestore = useCallback(() => {
    restoreGenerationRef.current += 1;
  }, []);

  const isRestoreStale = useCallback(
    (generation) => generation !== restoreGenerationRef.current,
    [],
  );

  const {
    pdfBufferRef,
    fileHandleRef,
    pdfFileName,
    pageTexts,
    currentPage,
    setPdf,
    setPdfFileName,
    setPdfByteLength,
    setPageTexts,
    setCurrentPage,
    setIsProcessing,
    setProgress,
    setLoadError,
    loadPdfFromFile,
    applyExtractValidation,
    resetPdfDocument,
    clearFileHandle,
    canPersist,
  } = pdf;

  const {
    spellingResults,
    consistencyResults,
    spellingSelected,
    consistencySelected,
    clearAllCheckState: clearRuleCheckState,
  } = ruleCheck;

  const { clearAllCheckState: clearTocCheckState } = tocCheck;

  const clearAllCheckState = useCallback(() => {
    clearRuleCheckState();
    clearTocCheckState();
  }, [clearRuleCheckState, clearTocCheckState]);

  /** 탭·창 이탈 시 복원 데이터 제거 (PDF worker 복원 오류 방지) */
  const discardWorkSessionOnLeave = useCallback(async () => {
    invalidateRestore();
    setIsRestoring(false);
    setIsProcessing(false);
    setProgress(null);
    await clearWorkSession();
    resetPdfDocument();
    clearAllCheckState();
    setSessionHint(null);
    setLoadError(null);
  }, [
    invalidateRestore,
    resetPdfDocument,
    clearAllCheckState,
    setIsProcessing,
    setProgress,
    setLoadError,
  ]);

  const persistSession = useCallback(async () => {
    if (!canPersist) return false;

    const result = await saveWorkSession({
      fileName: pdfFileName,
      fileHandle: fileHandleRef.current,
      pdfBuffer: fileHandleRef.current ? undefined : pdfBufferRef.current,
      pageTexts: pageTexts.map((p) => ({ pageNum: p.pageNum, text: p.text })),
      groupedResults: [],
      consistencyGroupedResults: [],
      tocBodyGroupedResults: [],
      spellingRulesFingerprint: SPELLING_RULES_FP,
      cautionRulesFingerprint: CAUTION_RULES_FP,
      currentPage,
      selectedInstance: null,
      consistencySelectedInstance: null,
      tocBodySelectedInstance: null,
    });

    if (result.ok) {
      setSessionHint(null);
    } else {
      setSessionHint('업로드 실패');
      const missingPdfData =
        typeof result.error === 'string' &&
        result.error.includes('PDF 데이터가 없습니다');
      if (missingPdfData) {
        setLoadError(null);
      } else {
        const storageHint = await getStorageHint();
        setLoadError(
          [result.error, storageHint].filter(Boolean).join(' · ') ||
            'Chrome/Edge에서 「PDF 열기」를 사용해 보세요.',
        );
      }
    }
    return result.ok;
  }, [
    canPersist,
    pdfFileName,
    pageTexts,
    currentPage,
    fileHandleRef,
    pdfBufferRef,
    setLoadError,
  ]);

  useEffect(() => {
    const generation = restoreGenerationRef.current;
    const mounted = { current: true };

    (async () => {
      const saved = await loadWorkSession();
      if (!mounted.current || isRestoreStale(generation)) return;
      if (!saved) {
        setIsRestoring(false);
        return;
      }

      if (saved.needFilePermission && saved.fileHandle) {
        clearAllCheckState();
        fileHandleRef.current = saved.fileHandle;
        setPdfFileName(saved.fileName);
        setPdfByteLength(saved.pdfByteLength ?? null);
        setSessionHint('이전 PDF — 아래 「PDF 다시 연결」을 누르세요');
        setLoadError(null);
        setIsRestoring(false);
        return;
      }

      setIsProcessing(true);
      setProgress({ current: 0, total: 1, phase: 'restore' });
      setSessionHint('이전 작업 복원 중…');
      clearAllCheckState();

      try {
        pdfBufferRef.current = saved.pdfBuffer;
        if (saved.fileHandle) fileHandleRef.current = saved.fileHandle;
        setPdfFileName(saved.fileName);
        setPdfByteLength(
          saved.pdfByteLength ?? saved.pdfBuffer?.byteLength ?? null,
        );
        const doc = await loadPdfFromBuffer(saved.pdfBuffer);
        if (!mounted.current || isRestoreStale(generation)) return;

        const page = Math.min(
          Math.max(1, saved.currentPage ?? 1),
          doc.numPages,
        );
        setCurrentPage(page);

        const pages = await extractAllPagesText(doc, (current, total) => {
          if (mounted.current && !isRestoreStale(generation)) {
            setProgress({ current, total, phase: 'restore' });
          }
        });
        if (!mounted.current || isRestoreStale(generation)) return;

        const applied = await applyExtractValidation(doc, pages, {
          sizeBytes: saved.pdfByteLength ?? saved.pdfBuffer?.byteLength ?? 0,
        });
        if (!mounted.current || isRestoreStale(generation)) return;
        if (!applied.ok) {
          setSessionHint(null);
          await clearWorkSession();
          return;
        }

        setSessionHint(
          `PDF 복원됨 · ${saved.fileName} (${new Date(saved.savedAt).toLocaleString('ko-KR')}) — 검사는 다시 실행하세요`,
        );
      } catch (err) {
        if (mounted.current && !isRestoreStale(generation)) {
          setLoadError(
            err instanceof Error ? err.message : '이전 작업 복원 실패',
          );
          setSessionHint(null);
        }
        await clearWorkSession();
      } finally {
        if (mounted.current && !isRestoreStale(generation)) {
          setIsProcessing(false);
          setProgress(null);
          setIsRestoring(false);
        }
      }
    })();

    return () => {
      mounted.current = false;
    };
  }, [
    clearAllCheckState,
    fileHandleRef,
    pdfBufferRef,
    setPdf,
    setPdfFileName,
    setPageTexts,
    setCurrentPage,
    setIsProcessing,
    setProgress,
    setLoadError,
    applyExtractValidation,
    isRestoreStale,
  ]);

  useEffect(() => {
    if (isRestoring || !pdfBufferRef.current || !pageTexts.length) return;

    const t = setTimeout(() => {
      persistSession();
    }, 300);

    const onHide = () => {
      if (canPersist) {
        void saveWorkSession({
          fileName: pdfFileName,
          fileHandle: fileHandleRef.current,
          pdfBuffer: fileHandleRef.current ? undefined : pdfBufferRef.current,
          groupedResults: [],
          consistencyGroupedResults: [],
          tocBodyGroupedResults: [],
          spellingRulesFingerprint: SPELLING_RULES_FP,
          cautionRulesFingerprint: CAUTION_RULES_FP,
          currentPage,
          selectedInstance: null,
          consistencySelectedInstance: null,
          tocBodySelectedInstance: null,
        });
      }
    };
    window.addEventListener('pagehide', onHide);

    return () => {
      clearTimeout(t);
      window.removeEventListener('pagehide', onHide);
    };
  }, [
    isRestoring,
    persistSession,
    canPersist,
    pdfFileName,
    pageTexts,
    currentPage,
    pdfBufferRef,
    fileHandleRef,
  ]);

  const openPdfWithPicker = useCallback(async () => {
    clearAllCheckState();
    clearFileHandle();
    invalidateRestore();

    try {
      const [handle] = await window.showOpenFilePicker({
        types: [
          {
            description: 'PDF',
            accept: { 'application/pdf': ['.pdf'] },
          },
        ],
        multiple: false,
      });
      fileHandleRef.current = handle;
      const file = await handle.getFile();
      await loadPdfFromFile(file);
      await persistSession();
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setLoadError(err instanceof Error ? err.message : 'PDF 열기 실패');
      resetPdfDocument();
    } finally {
      setIsProcessing(false);
      setProgress(null);
    }
  }, [
    clearAllCheckState,
    clearFileHandle,
    invalidateRestore,
    fileHandleRef,
    loadPdfFromFile,
    persistSession,
    resetPdfDocument,
    setIsProcessing,
    setProgress,
    setLoadError,
  ]);

  const reconnectPdfFile = useCallback(async () => {
    if (!fileHandleRef.current) {
      await openPdfWithPicker();
      return;
    }
    setLoadError(null);
    invalidateRestore();
    setIsProcessing(true);
    setProgress({ current: 0, total: 1, phase: 'restore' });
    try {
      const file = await fileHandleRef.current.getFile();
      await loadPdfFromFile(file);
      await persistSession();
      setSessionHint('파일 다시 연결됨');
    } catch (err) {
      setLoadError(
        err instanceof Error
          ? err.message
          : '파일 연결 실패 — PDF 열기로 다시 선택하세요',
      );
    } finally {
      setIsProcessing(false);
      setProgress(null);
    }
  }, [
    fileHandleRef,
    invalidateRestore,
    openPdfWithPicker,
    loadPdfFromFile,
    persistSession,
    setLoadError,
    setIsProcessing,
    setProgress,
  ]);

  const loadPdfFile = useCallback(
    async (file) => {
      if (!file) return;
      if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        setLoadError('PDF 파일만 업로드할 수 있습니다.');
        return;
      }

      clearAllCheckState();
      clearFileHandle();
      invalidateRestore();

      try {
        await loadPdfFromFile(file);
        await persistSession();
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : 'PDF 로드 실패');
        resetPdfDocument();
      } finally {
        setIsProcessing(false);
        setProgress(null);
      }
    },
    [
      clearAllCheckState,
      clearFileHandle,
      invalidateRestore,
      loadPdfFromFile,
      persistSession,
      resetPdfDocument,
      setIsProcessing,
      setProgress,
      setLoadError,
    ],
  );

  const handleFileChange = useCallback(
    async (e) => {
      const file = e.target.files?.[0];
      await loadPdfFile(file);
      if (pdf.fileRef.current) pdf.fileRef.current.value = '';
    },
    [loadPdfFile, pdf.fileRef],
  );

  const handleClearSession = useCallback(async () => {
    if (
      !confirm(
        '저장된 PDF와 검사 결과를 이 브라우저에서 삭제합니다. 계속할까요?',
      )
    ) {
      return;
    }
    await discardWorkSessionOnLeave();
  }, [discardWorkSessionOnLeave]);

  const handleEndWork = useCallback(async () => {
    if (
      !confirm(
        '현재 작업을 종료하고 업로드 대기 화면으로 돌아가시겠습니까?\nPDF는 삭제되며 작업 내용은 저장되지 않습니다',
      )
    ) {
      return;
    }
    await discardWorkSessionOnLeave();
  }, [discardWorkSessionOnLeave]);

  return {
    sessionHint,
    isRestoring,
    persistSession,
    openPdfWithPicker,
    reconnectPdfFile,
    loadPdfFile,
    handleFileChange,
    handleClearSession,
    handleEndWork,
  };
}
