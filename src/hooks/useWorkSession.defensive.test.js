/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { createElement, useEffect, useRef } from 'react';
import { useWorkSession } from './useWorkSession.js';

vi.mock('../lib/sessionStore.js', () => ({
  loadWorkSession: vi.fn(),
  saveWorkSession: vi.fn(async () => ({ ok: true, mode: 'handle' })),
  clearWorkSession: vi.fn(async () => undefined),
  getStorageHint: vi.fn(async () => null),
}));

vi.mock('../lib/pdfService.js', () => ({
  loadPdfFromBuffer: vi.fn(),
  extractAllPagesText: vi.fn(),
}));

import {
  clearWorkSession,
  loadWorkSession,
} from '../lib/sessionStore.js';
import {
  extractAllPagesText,
  loadPdfFromBuffer,
} from '../lib/pdfService.js';

/** @returns {Promise<void>} */
function flushPromises() {
  return new Promise((resolve) => {
    queueMicrotask(() => resolve());
  });
}

function createPdfMock() {
  return {
    pdfBufferRef: { current: new ArrayBuffer(8) },
    fileHandleRef: { current: null },
    pdfFileName: 'restore.pdf',
    pageTexts: [],
    currentPage: 1,
    setPdf: vi.fn(),
    setPdfFileName: vi.fn(),
    setPdfByteLength: vi.fn(),
    setPageTexts: vi.fn(),
    setCurrentPage: vi.fn(),
    setIsProcessing: vi.fn(),
    setProgress: vi.fn(),
    setLoadError: vi.fn(),
    loadPdfFromFile: vi.fn(),
    resetPdfDocument: vi.fn(),
    clearFileHandle: vi.fn(),
    canPersist: false,
    fileRef: { current: null },
    pdf: null,
  };
}

function createRuleCheckMock() {
  return {
    spellingResults: [],
    consistencyResults: [],
    spellingSelected: null,
    consistencySelected: null,
    clearAllCheckState: vi.fn(),
  };
}

function createTocCheckMock() {
  return {
    results: [],
    selected: null,
    clearAllCheckState: vi.fn(),
  };
}

/**
 * @param {ReturnType<typeof createPdfMock>} pdf
 * @param {ReturnType<typeof createRuleCheckMock>} ruleCheck
 * @param {ReturnType<typeof createTocCheckMock>} [tocCheck]
 */
function renderWorkSessionHarness(pdf, ruleCheck, tocCheck = createTocCheckMock()) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const apiRef = { current: /** @type {ReturnType<typeof useWorkSession> | null} */ (null) };

  function Harness() {
    const api = useWorkSession(pdf, ruleCheck, tocCheck);
    apiRef.current = api;
    return null;
  }

  act(() => {
    root.render(createElement(Harness));
  });

  return {
    get api() {
      return apiRef.current;
    },
    unmount() {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('confirm', vi.fn(() => true));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useWorkSession defensive', () => {
  it('복원 중 언마운트 시 지연된 PDF 로드가 setPdf를 호출하지 않는다', async () => {
    /** @type {((value: { numPages: number }) => void) | undefined} */
    let resolvePdf;

    vi.mocked(loadWorkSession).mockResolvedValue({
      fileName: 'slow.pdf',
      pdfBuffer: new ArrayBuffer(16),
      groupedResults: [],
      consistencyGroupedResults: [],
      spellingRulesFingerprint: null,
      cautionRulesFingerprint: null,
      currentPage: 1,
      savedAt: Date.now(),
      pageTexts: [],
    });

    vi.mocked(loadPdfFromBuffer).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePdf = resolve;
        }),
    );

    vi.mocked(extractAllPagesText).mockResolvedValue([
      { pageNum: 1, text: 'hello' },
    ]);

    const pdf = createPdfMock();
    const ruleCheck = createRuleCheckMock();
    const harness = renderWorkSessionHarness(pdf, ruleCheck);

    await act(async () => {
      await flushPromises();
      await flushPromises();
    });

    harness.unmount();

    await act(async () => {
      resolvePdf?.({ numPages: 3 });
      await flushPromises();
      await flushPromises();
    });

    expect(pdf.setPdf).not.toHaveBeenCalled();
    expect(pdf.setPageTexts).not.toHaveBeenCalled();
  });

  it('복원 텍스트 추출 중 작업 종료 시 clearWorkSession과 reset이 호출된다', async () => {
    /** @type {((value: { pageNum: number, text: string }[]) => void) | undefined} */
    let resolveExtract;

    vi.mocked(loadWorkSession).mockResolvedValue({
      fileName: 'abort.pdf',
      pdfBuffer: new ArrayBuffer(16),
      groupedResults: [],
      consistencyGroupedResults: [],
      spellingRulesFingerprint: null,
      cautionRulesFingerprint: null,
      currentPage: 1,
      savedAt: Date.now(),
      pageTexts: [],
    });

    vi.mocked(loadPdfFromBuffer).mockResolvedValue({ numPages: 2 });
    vi.mocked(extractAllPagesText).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveExtract = resolve;
        }),
    );

    const pdf = createPdfMock();
    const ruleCheck = createRuleCheckMock();
    const harness = renderWorkSessionHarness(pdf, ruleCheck);

    await act(async () => {
      await flushPromises();
      await flushPromises();
    });

    await act(async () => {
      await harness.api?.handleEndWork();
    });

    expect(clearWorkSession).toHaveBeenCalled();
    expect(pdf.resetPdfDocument).toHaveBeenCalled();
    expect(ruleCheck.clearAllCheckState).toHaveBeenCalled();

    await act(async () => {
      resolveExtract?.([{ pageNum: 1, text: 'late' }]);
      await flushPromises();
    });

    expect(pdf.setPageTexts).not.toHaveBeenCalled();
  });

  it('loadWorkSession이 null이면 복원 없이 isRestoring만 종료한다', async () => {
    vi.mocked(loadWorkSession).mockResolvedValue(null);

    const pdf = createPdfMock();
    const ruleCheck = createRuleCheckMock();
    const harness = renderWorkSessionHarness(pdf, ruleCheck);

    await act(async () => {
      await flushPromises();
      await flushPromises();
    });

    expect(harness.api?.isRestoring).toBe(false);
    expect(loadPdfFromBuffer).not.toHaveBeenCalled();
    expect(pdf.setLoadError).not.toHaveBeenCalled();
  });
});
