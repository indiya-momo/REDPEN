/**
 * Shared IndexedDB + storage mocks for session tests.
 */
import { vi } from 'vitest';

/** @type {Record<string, string>} */
export const localStore = {};

/** @type {Map<string, Map<string, Map<string, unknown>>>} */
export const idbRegistry = new Map();

function makeTransaction(store) {
  const tx = {
    oncomplete: null,
    onerror: null,
    objectStore: () => ({
      put(value) {
        const req = {};
        queueMicrotask(() => {
          store.set(String(value.id), value);
          req.onsuccess?.({ target: req });
          queueMicrotask(() => tx.oncomplete?.());
        });
        return req;
      },
      get(key) {
        const req = { result: store.get(String(key)) };
        queueMicrotask(() => req.onsuccess?.({ target: req }));
        return req;
      },
      delete(key) {
        const req = {};
        queueMicrotask(() => {
          store.delete(String(key));
          req.onsuccess?.({ target: req });
          queueMicrotask(() => tx.oncomplete?.());
        });
        return req;
      },
      getAllKeys() {
        const req = { result: [...store.keys()] };
        queueMicrotask(() => req.onsuccess?.({ target: req }));
        return req;
      },
    }),
  };
  return tx;
}

function createDbInterface(stores) {
  return {
    objectStoreNames: { contains: (n) => stores.has(n) },
    createObjectStore: (name) => {
      stores.set(name, new Map());
    },
    transaction: (storeName) => makeTransaction(stores.get(storeName)),
    close: () => {},
  };
}

export function createFakeIndexedDB() {
  return {
    open(name) {
      const req = {};
      queueMicrotask(() => {
        let entry = idbRegistry.get(name);
        if (!entry) {
          const stores = new Map();
          const db = createDbInterface(stores);
          entry = { stores, db };
          idbRegistry.set(name, entry);
          req.onupgradeneeded?.({ target: { result: db } });
          if (!stores.has('session')) {
            db.createObjectStore('session');
          }
        }
        req.result = entry.db;
        req.onsuccess?.({ target: req });
      });
      return req;
    },
  };
}

/** @param {Record<string, unknown>} row */
export async function seedSessionRow(row) {
  const idb = createFakeIndexedDB();
  const openReq = idb.open('pdf-proofread-session');
  await new Promise((resolve) => {
    openReq.onsuccess = () => resolve(undefined);
  });
  const db = openReq.result;
  const tx = db.transaction('session', 'readwrite');
  const putReq = tx.objectStore('session').put(row);
  await new Promise((resolve) => {
    putReq.onsuccess = () => resolve(undefined);
    tx.oncomplete = () => resolve(undefined);
  });
  db.close();
}

export function installSessionTestGlobals() {
  for (const key of Object.keys(localStore)) delete localStore[key];
  idbRegistry.clear();

  vi.stubGlobal('localStorage', {
    getItem: (key) => localStore[key] ?? null,
    setItem: (key, value) => {
      localStore[key] = String(value);
    },
    removeItem: (key) => {
      delete localStore[key];
    },
  });

  vi.stubGlobal('indexedDB', createFakeIndexedDB());
  vi.stubGlobal('navigator', {
    storage: {
      persist: async () => true,
      getDirectory: async () => {
        throw new Error('OPFS unavailable in test');
      },
    },
  });
}

export function uninstallSessionTestGlobals() {
  vi.unstubAllGlobals();
}
