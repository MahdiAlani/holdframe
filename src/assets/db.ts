export type StoreName = 'projects' | 'assets';

const STORES: readonly StoreName[] = ['projects', 'assets'];
let database: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  database ??= new Promise((resolve, reject) => {
    const request = indexedDB.open('holdframe', 1);
    request.onupgradeneeded = () => {
      for (const name of STORES) {
        if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return database;
}

async function run<T>(store: StoreName, mode: IDBTransactionMode, op: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const request = op(tx.objectStore(store));
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export function idbGet<T>(store: StoreName, key: string): Promise<T | undefined> {
  return run(store, 'readonly', (s) => s.get(key) as IDBRequest<T | undefined>);
}

export async function idbPut(store: StoreName, key: string, value: unknown): Promise<void> {
  await run(store, 'readwrite', (s) => s.put(value, key));
}
