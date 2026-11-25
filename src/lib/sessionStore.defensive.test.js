import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  clearWorkSession,
  isTabSessionActive,
  isWorkSessionRestoreEnabled,
  loadWorkSession,
  markTabSessionActive,
  saveWorkSession,
} from './sessionStore.js';
import {
  installSessionTestGlobals,
  seedSessionRow,
  uninstallSessionTestGlobals,
} from './sessionTestMocks.js';

beforeEach(() => {
  installSessionTestGlobals();
});

afterEach(() => {
  uninstallSessionTestGlobals();
});

describe('sessionStore defensive', () => {
  it('DEV에서만 작업 복원이 켜진다', () => {
    expect(isWorkSessionRestoreEnabled()).toBe(true);
  });

  it('PROD(DEV=false)에서는 마커·IDB가 있어도 복원하지 않는다', async () => {
    const prev = import.meta.env.DEV;
    import.meta.env.DEV = false;
    try {
      expect(isWorkSessionRestoreEnabled()).toBe(false);
      await seedSessionRow({
        id: 'current',
        fileName: 'prod-no-restore.pdf',
        pdfStorage: 'opfs',
        groupedResults: [],
      });
      markTabSessionActive();
      await expect(loadWorkSession()).resolves.toBeNull();
      const saved = await saveWorkSession({
        fileName: 'x.pdf',
        pdfBuffer: new ArrayBuffer(8),
        pageTexts: [],
      });
      expect(saved).toEqual({ ok: true, mode: 'disabled' });
    } finally {
      import.meta.env.DEV = prev;
    }
  });

  it('fileName이 없는 오염 레코드는 null을 반환한다', async () => {
    await seedSessionRow({
      id: 'current',
      pdfStorage: 'handle',
      groupedResults: [],
    });

    await expect(loadWorkSession()).resolves.toBeNull();
  });

  it('청크 메타만 있고 실제 청크가 없으면 null을 반환한다', async () => {
    await seedSessionRow({
      id: 'current',
      fileName: 'broken-chunks.pdf',
      pdfStorage: 'chunks',
      chunkCount: 3,
      groupedResults: [],
      consistencyGroupedResults: [],
    });

    await expect(loadWorkSession()).resolves.toBeNull();
  });

  it('OPFS 저장 표시만 있고 바이트가 없으면 null을 반환한다', async () => {
    await seedSessionRow({
      id: 'current',
      fileName: 'missing-opfs.pdf',
      pdfStorage: 'opfs',
      groupedResults: [],
      consistencyGroupedResults: [],
    });

    await expect(loadWorkSession()).resolves.toBeNull();
  });

  it('groupedResults 타입이 깨져도 PDF handle 경로는 메타를 반환한다', async () => {
    const fileHandle = {
      queryPermission: async () => 'granted',
      requestPermission: async () => 'granted',
      getFile: async () => ({
        name: 'typed-wrong.pdf',
        arrayBuffer: async () => new ArrayBuffer(4),
      }),
    };

    await seedSessionRow({
      id: 'current',
      fileName: 'typed-wrong.pdf',
      pdfStorage: 'handle',
      fileHandle,
      groupedResults: 'not-an-array',
      consistencyGroupedResults: null,
      currentPage: 2,
    });
    markTabSessionActive();

    const loaded = await loadWorkSession();
    expect(loaded).not.toBeNull();
    expect(loaded?.fileName).toBe('typed-wrong.pdf');
    expect(loaded?.currentPage).toBe(2);
    expect(loaded?.groupedResults).toBe('not-an-array');
  });

  it('handle getFile 실패 시 null을 반환하고 크래시하지 않는다', async () => {
    const fileHandle = {
      queryPermission: async () => 'granted',
      requestPermission: async () => 'granted',
      getFile: async () => {
        throw new Error('file missing');
      },
    };

    await seedSessionRow({
      id: 'current',
      fileName: 'throws.pdf',
      pdfStorage: 'handle',
      fileHandle,
      groupedResults: [],
    });

    await expect(loadWorkSession()).resolves.toBeNull();
  });

  it('clearWorkSession 후 오염 레코드도 제거된다', async () => {
    await seedSessionRow({
      id: 'current',
      fileName: 'gone.pdf',
      pdfStorage: 'opfs',
    });
    markTabSessionActive();

    await clearWorkSession();
    await expect(loadWorkSession()).resolves.toBeNull();
  });

  it('탭 마커가 없어도 IndexedDB에 PDF가 있으면 복원하고 마커를 다시 켠다', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]).buffer;
    await saveWorkSession({
      fileName: 'keep-on-f5.pdf',
      pdfBuffer: bytes,
      pageTexts: [{ pageNum: 1, text: '가' }],
    });
    // F5·다른 탭에서 sessionStorage 마커만 비운 상황
    try {
      sessionStorage.removeItem('pdf-proofread-work-tab');
    } catch {
      /* ignore */
    }

    const loaded = await loadWorkSession();
    expect(loaded).not.toBeNull();
    expect(loaded?.fileName).toBe('keep-on-f5.pdf');
    expect(isTabSessionActive()).toBe(true);
  });

  it('fileHandle이 있어도 pdfBuffer가 있으면 바이트로 저장해 F5에 권한 없이 복원된다', async () => {
    const bytes = new Uint8Array([9, 8, 7, 6]).buffer;
    const fileHandle = {
      queryPermission: async () => 'denied',
      requestPermission: async () => 'denied',
      getFile: async () => {
        throw new Error('should not use handle');
      },
    };

    const saved = await saveWorkSession({
      fileName: 'buffer-wins.pdf',
      fileHandle,
      pdfBuffer: bytes,
      pageTexts: [{ pageNum: 1, text: '나' }],
    });
    expect(saved.ok).toBe(true);
    expect(saved.mode).toBe('idb-blob');

    const loaded = await loadWorkSession();
    expect(loaded).not.toBeNull();
    expect(loaded?.fileName).toBe('buffer-wins.pdf');
    expect(loaded?.needFilePermission).toBeFalsy();
    expect(loaded?.pdfBuffer?.byteLength).toBe(4);
  });

  it('saveWorkSession은 PDF 없이 ok:false를 반환한다', async () => {
    const result = await saveWorkSession({
      fileName: 'empty.pdf',
      pageTexts: [],
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/PDF 데이터/);
  });
});
