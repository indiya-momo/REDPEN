/**
 * 작업 세션 — 우선순위:
 * 1) FileSystemFileHandle (PDF 복사 없음, 새로고침에 가장 안정)
 * 2) OPFS → Cache API → IndexedDB 청크
 */

const DB_NAME = 'pdf-proofread-session';
const DB_VERSION = 3;
const STORE = 'session';
const SESSION_KEY = 'current';
const OPFS_PDF_NAME = 'current-session.pdf';
const CACHE_NAME = 'pdf-proofread-session-v1';
const CACHE_KEY = 'https://pdf-proofread.local/session.pdf';
const CHUNK_PREFIX = 'pdf-chunk-';
const CHUNK_SIZE = 512 * 1024;

export function supportsFilePicker() {
  return typeof window.showOpenFilePicker === 'function';
}

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
  });
}

function txComplete(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function requestPersistentStorage() {
  try {
    if (navigator.storage?.persist) {
      await navigator.storage.persist();
    }
  } catch {
    /* ignore */
  }
}

export async function getStorageHint() {
  try {
    if (!navigator.storage?.estimate) return null;
    const { usage = 0, quota = 0 } = await navigator.storage.estimate();
    const freeMb = ((quota - usage) / (1024 * 1024)).toFixed(0);
    const quotaMb = (quota / (1024 * 1024)).toFixed(0);
    return `저장소 여유 약 ${freeMb}MB / ${quotaMb}MB`;
  } catch {
    return null;
  }
}

async function removeBlobStores(db) {
  await removePdfFromOpfs();
  await removePdfFromCache();
  if (db) await clearPdfChunks(db);
}

async function savePdfToOpfs(buffer) {
  const root = await navigator.storage.getDirectory();
  try {
    await root.removeEntry(OPFS_PDF_NAME);
  } catch {
    /* ignore */
  }
  const handle = await root.getFileHandle(OPFS_PDF_NAME, { create: true });
  const writable = await handle.createWritable();
  await writable.write(new Uint8Array(buffer));
  await writable.close();
}

async function loadPdfFromOpfs() {
  try {
    const root = await navigator.storage.getDirectory();
    const handle = await root.getFileHandle(OPFS_PDF_NAME);
    return handle.getFile().then((f) => f.arrayBuffer());
  } catch {
    return null;
  }
}

async function removePdfFromOpfs() {
  try {
    const root = await navigator.storage.getDirectory();
    await root.removeEntry(OPFS_PDF_NAME);
  } catch {
    /* ignore */
  }
}

async function savePdfToCache(buffer) {
  const cache = await caches.open(CACHE_NAME);
  await cache.put(
    CACHE_KEY,
    new Response(buffer, { headers: { 'Content-Type': 'application/pdf' } }),
  );
}

async function loadPdfFromCache() {
  try {
    const cache = await caches.open(CACHE_NAME);
    const res = await cache.match(CACHE_KEY);
    return res ? res.arrayBuffer() : null;
  } catch {
    return null;
  }
}

async function removePdfFromCache() {
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.delete(CACHE_KEY);
  } catch {
    /* ignore */
  }
}

async function clearPdfChunks(db) {
  const all = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAllKeys();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  for (const key of all) {
    if (typeof key === 'string' && key.startsWith(CHUNK_PREFIX)) {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(key);
      await txComplete(tx);
    }
  }
}

async function savePdfChunks(db, bytes) {
  await clearPdfChunks(db);
  const totalChunks = Math.ceil(bytes.length / CHUNK_SIZE);
  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const chunk = bytes.subarray(start, Math.min(start + CHUNK_SIZE, bytes.length));
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({ id: `${CHUNK_PREFIX}${i}`, chunk });
    await txComplete(tx);
  }
  return totalChunks;
}

async function loadPdfChunks(db, totalChunks) {
  const parts = [];
  for (let i = 0; i < totalChunks; i++) {
    const row = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(`${CHUNK_PREFIX}${i}`);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    if (!row?.chunk) return null;
    parts.push(row.chunk);
  }
  const totalLen = parts.reduce((n, p) => n + p.byteLength, 0);
  const out = new Uint8Array(totalLen);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.byteLength;
  }
  return out.buffer;
}

function trimResults(groupedResults) {
  try {
    const json = JSON.stringify(groupedResults ?? []);
    if (json.length < 800_000) return groupedResults ?? [];
    return [];
  } catch {
    return [];
  }
}

/**
 * @param {FileSystemFileHandle} handle
 */
async function ensureFileReadPermission(handle) {
  let perm = await handle.queryPermission({ mode: 'read' });
  if (perm === 'granted') return true;
  if (perm === 'denied') return false;
  perm = await handle.requestPermission({ mode: 'read' });
  return perm === 'granted';
}

/**
 * @param {{
 *   fileName: string,
 *   pdfBuffer?: ArrayBuffer,
 *   fileHandle?: FileSystemFileHandle | null,
 *   pageTexts?: { pageNum: number, text: string }[],
 *   groupedResults?: unknown[],
 *   consistencyGroupedResults?: unknown[],
 *   spellingRulesFingerprint?: string,
 *   currentPage?: number,
 *   selectedInstance?: unknown,
 *   consistencySelectedInstance?: unknown,
 * }} data
 */
export async function saveWorkSession(data) {
  await requestPersistentStorage();

  try {
    const db = await openDb();

    if (data.fileHandle) {
      await removeBlobStores(db);
      const payload = {
        id: SESSION_KEY,
        fileName: data.fileName,
        pdfStorage: 'handle',
        fileHandle: data.fileHandle,
        pageCount: data.pageTexts?.length ?? 0,
        groupedResults: trimResults(data.groupedResults),
        consistencyGroupedResults: trimResults(data.consistencyGroupedResults),
        spellingRulesFingerprint: data.spellingRulesFingerprint ?? null,
        currentPage: data.currentPage ?? 1,
        selectedInstance: data.selectedInstance ?? null,
        consistencySelectedInstance: data.consistencySelectedInstance ?? null,
        savedAt: Date.now(),
      };
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(payload);
      await txComplete(tx);
      db.close();
      return { ok: true, mode: 'handle' };
    }

    if (!data.pdfBuffer?.byteLength) {
      db.close();
      return { ok: false, error: 'PDF 데이터가 없습니다.' };
    }

    const bytes = new Uint8Array(data.pdfBuffer);
    const sizeMb = (bytes.byteLength / (1024 * 1024)).toFixed(1);

    await removeBlobStores(db);

    let pdfStorage = '';
    let chunkCount = 0;
    const errors = [];

    if (typeof navigator.storage?.getDirectory === 'function') {
      try {
        await savePdfToOpfs(data.pdfBuffer);
        pdfStorage = 'opfs';
      } catch (e) {
        errors.push(`OPFS: ${e instanceof Error ? e.message : e}`);
      }
    }

    if (!pdfStorage) {
      try {
        await savePdfToCache(data.pdfBuffer);
        pdfStorage = 'cache';
      } catch (e) {
        errors.push(`Cache: ${e instanceof Error ? e.message : e}`);
      }
    }

    if (!pdfStorage) {
      try {
        chunkCount = await savePdfChunks(db, bytes);
        pdfStorage = 'chunks';
      } catch (e) {
        const hint = await getStorageHint();
        db.close();
        return {
          ok: false,
          error: `PDF 저장 실패 (${sizeMb}MB). Chrome/Edge에서 「PDF 열기」를 사용해 보세요. ${hint ?? ''} ${errors.join('; ')}`,
        };
      }
    }

    const payload = {
      id: SESSION_KEY,
      fileName: data.fileName,
      pdfStorage,
      pdfByteLength: bytes.byteLength,
      chunkCount,
      pageCount: data.pageTexts?.length ?? 0,
      groupedResults: trimResults(data.groupedResults),
      consistencyGroupedResults: trimResults(data.consistencyGroupedResults),
      spellingRulesFingerprint: data.spellingRulesFingerprint ?? null,
      currentPage: data.currentPage ?? 1,
      selectedInstance: data.selectedInstance ?? null,
      consistencySelectedInstance: data.consistencySelectedInstance ?? null,
      savedAt: Date.now(),
    };

    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(payload);
    await txComplete(tx);
    db.close();

    return { ok: true, mode: pdfStorage };
  } catch (e) {
    console.error('작업 세션 저장 실패', e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : '저장 오류',
    };
  }
}

/** @returns {Promise<object | null>} */
export async function loadWorkSession() {
  try {
    const db = await openDb();
    const raw = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(SESSION_KEY);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });

    if (!raw?.fileName) {
      db.close();
      return null;
    }

    const meta = {
      fileName: raw.fileName,
      pdfByteLength: raw.pdfByteLength ?? null,
      groupedResults: raw.groupedResults ?? [],
      consistencyGroupedResults: raw.consistencyGroupedResults ?? [],
      spellingRulesFingerprint: raw.spellingRulesFingerprint ?? null,
      currentPage: raw.currentPage ?? 1,
      selectedInstance: raw.selectedInstance ?? null,
      consistencySelectedInstance: raw.consistencySelectedInstance ?? null,
      savedAt: raw.savedAt,
      pageTexts: [],
    };

    if (raw.pdfStorage === 'handle' && raw.fileHandle) {
      const ok = await ensureFileReadPermission(raw.fileHandle);
      if (!ok) {
        db.close();
        return { ...meta, needFilePermission: true, fileHandle: raw.fileHandle };
      }
      const file = await raw.fileHandle.getFile();
      db.close();
      return {
        ...meta,
        fileName: file.name,
        pdfBuffer: await file.arrayBuffer(),
        fileHandle: raw.fileHandle,
      };
    }

    let pdfBuffer = null;
    if (raw.pdfStorage === 'opfs') {
      pdfBuffer = await loadPdfFromOpfs();
    } else if (raw.pdfStorage === 'cache') {
      pdfBuffer = await loadPdfFromCache();
    } else if (raw.pdfStorage === 'chunks' && raw.chunkCount > 0) {
      pdfBuffer = await loadPdfChunks(db, raw.chunkCount);
    }

    db.close();
    if (!pdfBuffer?.byteLength) return null;

    return {
      ...meta,
      pdfBuffer,
      pdfByteLength: meta.pdfByteLength ?? pdfBuffer.byteLength,
    };
  } catch (e) {
    console.error('작업 세션 불러오기 실패', e);
    return null;
  }
}

export async function clearWorkSession() {
  try {
    const db = await openDb();
    await removeBlobStores(db);
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(SESSION_KEY);
    await txComplete(tx);
    db.close();
  } catch (e) {
    console.warn('작업 세션 삭제 실패', e);
  }
}
