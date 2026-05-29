import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  clearWorkSession,
  loadWorkSession,
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

    await clearWorkSession();
    await expect(loadWorkSession()).resolves.toBeNull();
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
