import type { WordListGroup } from '../types';

export const LEGACY_LISTS_KEY = 'wordmaster_custom_lists_v1';
type Local = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export interface ListDatabase {
  get(): Promise<WordListGroup[] | undefined>;
  put(lists: WordListGroup[]): Promise<void>;
}

/**
 * A word list can hold a whole library book, and a few of them exceed localStorage's ~5M characters,
 * so lists live in IndexedDB. A localStorage copy is either from an earlier version or written while
 * IndexedDB failed; both are newer than the database, so loading moves it in. Without IndexedDB,
 * localStorage remains the store.
 */
export function createListStore(database: ListDatabase | null, local: Local) {
  let useDatabase = !!database;
  let saving: Promise<void> = Promise.resolve();
  const readLocal = (): WordListGroup[] | null => {
    const raw = local.getItem(LEGACY_LISTS_KEY);
    if (raw === null) return null;
    try { const value = JSON.parse(raw); return Array.isArray(value) ? value : null; }
    catch { return null; } // Keep an unreadable copy in place rather than deleting it.
  };
  return {
    async load(): Promise<WordListGroup[]> {
      if (!database) return readLocal() ?? [];
      try {
        const legacy = readLocal();
        if (legacy) {
          await database.put(legacy);
          local.removeItem(LEGACY_LISTS_KEY);
          return legacy;
        }
        return (await database.get()) ?? [];
      } catch (error) {
        console.error('词本数据库不可用，改用本地存储', error);
        useDatabase = false;
        return readLocal() ?? [];
      }
    },
    /** Saves run in order, so the last call wins. */
    save(lists: WordListGroup[]) {
      saving = saving.then(async () => {
        if (useDatabase && database) {
          try { await database.put(lists); return; }
          catch (error) { console.error('词本保存到数据库失败，改用本地存储', error); useDatabase = false; }
        }
        local.setItem(LEGACY_LISTS_KEY, JSON.stringify(lists));
      }).catch(error => console.error('词本保存失败', error));
      return saving;
    },
  };
}

export function openListDatabase(): ListDatabase | null {
  if (typeof indexedDB === 'undefined') return null;
  let opening: Promise<IDBDatabase> | null = null;
  const open = () => opening ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('wordmaster', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('kv');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }).catch(error => { opening = null; throw error; });
  const run = <T,>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>) =>
    open().then(db => new Promise<T>((resolve, reject) => {
      const transaction = db.transaction('kv', mode);
      const request = action(transaction.objectStore('kv'));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onerror = transaction.onabort = () => reject(transaction.error ?? request.error);
    }));
  return {
    get: () => run<WordListGroup[] | undefined>('readonly', store => store.get('customLists')),
    put: lists => run('readwrite', store => store.put(lists, 'customLists')).then(() => undefined),
  };
}
