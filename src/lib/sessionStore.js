/**
 * 작업 세션 — DEV/로컬 F5 복원.
 * 1순위: IndexedDB 행에 pdfBlob (권한·OPFS 없이 F5 가능)
 * 보조: OPFS / Cache / 청크 / fileHandle
 */

const DB_NAME = 'pdf-proofread-session';
/** v4: 빈 v1 DB·스토어 누락 복구 + idb-blob 저장 */
const DB_VERSION = 4;
const STORE = 'session';
const SESSION_KEY = 'current';
const OPFS_PDF_NAME = 'current-session.pdf';
const CACHE_NAME = 'pdf-proofread-session-v1';
const CACHE_KEY = 'https://pdf-proofread.local/session.pdf';
const CHUNK_PREFIX = 'pdf-chunk-';
const CHUNK_SIZE = 512 * 1024;

/** 같은 탭·F5 힌트 (sessionStorage — 탭을 닫으면 비움) */
export const WORK_TAB_SESSION_KEY = 'pdf-proofread-work-tab';

/**
 * DEV 복원용 — 탭을 닫아도 localStorage에 남아 F5·재진입 시 main으로 복귀.
 * clearWorkSession / 대문 복귀에서만 지운다.
 */
export const WORK_RESUME_KEY = 'pdf-proofread-work-resume';

/**
 * 이전 PDF·검수 자동 복원.
 * - Vite DEV 또는 localhost / 127.0.0.1 (preview 포함)
 * - 배포 호스트에서는 복원하지 않음
 */
export function isWorkSessionRestoreEnabled() {
  if (import.meta.env.DEV === true) return true;
  try {
    const host = globalThis.location?.hostname ?? '';
    return host === 'localhost' || host === '127.0.0.1';
  } catch {
    return false;
  }
}

export function isTabSessionActive() {
  try {
    return sessionStorage.getItem(WORK_TAB_SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

export function isWorkResumeAvailable() {
  try {
    return localStorage.getItem(WORK_RESUME_KEY) === '1';
  } catch {
    return false;
  }
}

export function markTabSessionActive() {
  try {
    sessionStorage.setItem(WORK_TAB_SESSION_KEY, '1');
  } catch {
    /* ignore */
  }
  try {
    localStorage.setItem(WORK_RESUME_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function clearTabSessionMarker() {
  try {
    sessionStorage.removeItem(WORK_TAB_SESSION_KEY);
  } catch {
    /* ignore */
  }
  try {
    localStorage.removeItem(WORK_RESUME_KEY);
  } catch {
    /* ignore */
  }
}

export function supportsFilePicker() {
  return typeof window.showOpenFilePicker === 'function';
}

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onblocked = () => {
      console.warn('작업 세션 IndexedDB 업그레이드가 다른 탭에 막혔습니다.');
    };
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const nextVersion = db.version + 1;
        db.close();
        const req2 = indexedDB.open(DB_NAME, nextVersion);
        req2.onerror = () => reject(req2.error);
        req2.onupgradeneeded = (e) => {
          const upgradeDb = e.target.result;
          if (!upgradeDb.objectStoreNames.contains(STORE)) {
            upgradeDb.createObjectStore(STORE, { keyPath: 'id' });
          }
        };
        req2.onsuccess = () => resolve(req2.result);
        return;
      }
      resolve(db);
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
 *   tocBodyGroupedResults?: unknown[],
 *   spellingRulesFingerprint?: string,
 *   cautionRulesFingerprint?: string,
 *   currentPage?: number,
 *   selectedInstance?: unknown,
 *   consistencySelectedInstance?: unknown,
 *   tocBodySelectedInstance?: unknown,
 *   spellingCheckDone?: boolean,
 *   consistencyCheckDone?: boolean,
 *   tocBodyCheckDone?: boolean,
 *   activeCheckSource?: 'spelling' | 'consistency',
 *   resultVisibility?: import('./checkResultUtils.js').ResultVisibilityState | null,
 *   tocBodyResultVisibility?: import('./checkResultUtils.js').ResultVisibilityState | null,
 * }} data
 */
export async function saveWorkSession(data) {
  if (!isWorkSessionRestoreEnabled()) {
    return { ok: true, mode: 'disabled' };
  }

  await requestPersistentStorage();

  try {
    const db = await openDb();

    if (!data.pdfBuffer?.byteLength && data.fileHandle) {
      await removeBlobStores(db);
      const payload = {
        id: SESSION_KEY,
        fileName: data.fileName,
        pdfStorage: 'handle',
        fileHandle: data.fileHandle,
        pageCount: data.pageTexts?.length ?? 0,
        groupedResults: trimResults(data.groupedResults),
        consistencyGroupedResults: trimResults(data.consistencyGroupedResults),
        tocBodyGroupedResults: trimResults(data.tocBodyGroupedResults),
        spellingRulesFingerprint: data.spellingRulesFingerprint ?? null,
        cautionRulesFingerprint: data.cautionRulesFingerprint ?? null,
        currentPage: data.currentPage ?? 1,
        selectedInstance: data.selectedInstance ?? null,
        consistencySelectedInstance: data.consistencySelectedInstance ?? null,
        tocBodySelectedInstance: data.tocBodySelectedInstance ?? null,
        spellingCheckDone: Boolean(data.spellingCheckDone),
        consistencyCheckDone: Boolean(data.consistencyCheckDone),
        tocBodyCheckDone: Boolean(data.tocBodyCheckDone),
        activeCheckSource: data.activeCheckSource ?? null,
        resultVisibility: data.resultVisibility ?? null,
        tocBodyResultVisibility: data.tocBodyResultVisibility ?? null,
        savedAt: Date.now(),
      };
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(payload);
      await txComplete(tx);
      db.close();
      markTabSessionActive();
      return { ok: true, mode: 'handle' };
    }

    if (!data.pdfBuffer?.byteLength) {
      db.close();
      return { ok: false, error: 'PDF 데이터가 없습니다.' };
    }

    const bytes = new Uint8Array(data.pdfBuffer);

    await removeBlobStores(db);

    // OPFS는 보조. Cursor 내장 브라우저 등에서는 쓴 뒤 다시 읽히지 않는 경우가 있어
    // 복원 본선은 IndexedDB Blob으로 둔다 (122MB 경주멍도 이 경로).
    try {
      await savePdfToOpfs(data.pdfBuffer);
    } catch {
      /* ignore */
    }

    let pdfBlob;
    try {
      pdfBlob = new Blob([bytes], { type: 'application/pdf' });
    } catch (e) {
      db.close();
      return {
        ok: false,
        error: e instanceof Error ? e.message : 'PDF Blob 저장 실패',
      };
    }

    const payload = {
      id: SESSION_KEY,
      fileName: data.fileName,
      pdfStorage: 'idb-blob',
      pdfBlob,
      pdfByteLength: bytes.byteLength,
      chunkCount: 0,
      ...(data.fileHandle ? { fileHandle: data.fileHandle } : {}),
      pageCount: data.pageTexts?.length ?? 0,
      groupedResults: trimResults(data.groupedResults),
      consistencyGroupedResults: trimResults(data.consistencyGroupedResults),
      tocBodyGroupedResults: trimResults(data.tocBodyGroupedResults),
      spellingRulesFingerprint: data.spellingRulesFingerprint ?? null,
      cautionRulesFingerprint: data.cautionRulesFingerprint ?? null,
      currentPage: data.currentPage ?? 1,
      selectedInstance: data.selectedInstance ?? null,
      consistencySelectedInstance: data.consistencySelectedInstance ?? null,
      tocBodySelectedInstance: data.tocBodySelectedInstance ?? null,
      spellingCheckDone: Boolean(data.spellingCheckDone),
      consistencyCheckDone: Boolean(data.consistencyCheckDone),
      tocBodyCheckDone: Boolean(data.tocBodyCheckDone),
      activeCheckSource: data.activeCheckSource ?? null,
      resultVisibility: data.resultVisibility ?? null,
      tocBodyResultVisibility: data.tocBodyResultVisibility ?? null,
      savedAt: Date.now(),
    };

    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(payload);
    await txComplete(tx);
    db.close();

    markTabSessionActive();
    return { ok: true, mode: 'idb-blob' };
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
  if (!isWorkSessionRestoreEnabled()) {
    return null;
  }

  // 예전: 탭 마커 없으면 clearWorkSession()까지 해서 IDB를 지웠다.
  // 다른 탭·마커 유실·F5 직후 레이스에서 저장본이 통째로 사라졌다.
  // DEV에서는 저장된 세션이 있으면 복원하고, 성공 시 마커를 다시 켠다.

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
      tocBodyGroupedResults: raw.tocBodyGroupedResults ?? [],
      spellingRulesFingerprint: raw.spellingRulesFingerprint ?? null,
      cautionRulesFingerprint: raw.cautionRulesFingerprint ?? null,
      currentPage: raw.currentPage ?? 1,
      selectedInstance: raw.selectedInstance ?? null,
      consistencySelectedInstance: raw.consistencySelectedInstance ?? null,
      tocBodySelectedInstance: raw.tocBodySelectedInstance ?? null,
      spellingCheckDone: Boolean(raw.spellingCheckDone),
      consistencyCheckDone: Boolean(raw.consistencyCheckDone),
      tocBodyCheckDone: Boolean(raw.tocBodyCheckDone),
      activeCheckSource: raw.activeCheckSource ?? null,
      resultVisibility: raw.resultVisibility ?? null,
      tocBodyResultVisibility: raw.tocBodyResultVisibility ?? null,
      savedAt: raw.savedAt,
      pageTexts: [],
    };

    let pdfBuffer = null;

    if (raw.pdfBlob instanceof Blob && raw.pdfBlob.size > 0) {
      pdfBuffer = await raw.pdfBlob.arrayBuffer();
    } else if (raw.pdfStorage === 'idb-blob' && raw.pdfBlob) {
      pdfBuffer = await new Blob([raw.pdfBlob]).arrayBuffer();
    }

    if (!pdfBuffer?.byteLength && raw.pdfStorage === 'handle' && raw.fileHandle) {
      const ok = await ensureFileReadPermission(raw.fileHandle);
      if (!ok) {
        db.close();
        markTabSessionActive();
        return { ...meta, needFilePermission: true, fileHandle: raw.fileHandle };
      }
      const file = await raw.fileHandle.getFile();
      db.close();
      markTabSessionActive();
      return {
        ...meta,
        fileName: file.name,
        pdfBuffer: await file.arrayBuffer(),
        fileHandle: raw.fileHandle,
      };
    }

    if (!pdfBuffer?.byteLength) {
      if (raw.pdfStorage === 'opfs') {
        pdfBuffer = await loadPdfFromOpfs();
      } else if (raw.pdfStorage === 'cache') {
        pdfBuffer = await loadPdfFromCache();
      } else if (raw.pdfStorage === 'chunks' && raw.chunkCount > 0) {
        pdfBuffer = await loadPdfChunks(db, raw.chunkCount);
      } else {
        // 저장 표기가 깨져도 보조 저장소에서 한 번 더 시도
        pdfBuffer =
          (await loadPdfFromOpfs()) ||
          (await loadPdfFromCache()) ||
          null;
      }
    }

    db.close();
    if (!pdfBuffer?.byteLength) return null;

    markTabSessionActive();
    return {
      ...meta,
      pdfBuffer,
      pdfByteLength: meta.pdfByteLength ?? pdfBuffer.byteLength,
      ...(raw.fileHandle ? { fileHandle: raw.fileHandle } : {}),
    };
  } catch (e) {
    console.error('작업 세션 불러오기 실패', e);
    return null;
  }
}

export async function clearWorkSession() {
  clearTabSessionMarker();
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
