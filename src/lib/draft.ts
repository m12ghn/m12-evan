import { useEffect, useRef, useState } from 'react';

// Lưu nháp vào IndexedDB (giữ được cả ảnh Blob). Android Chrome hay tải lại trang khi mở camera
// (thiếu RAM) → không có nháp thì tài xế mất hết dữ liệu đang nhập.
const DB = 'fleetops-drafts', STORE = 'drafts';

function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((res, rej) => {
    const r = fn(db.transaction(STORE, mode).objectStore(STORE));
    r.onsuccess = () => { db.close(); res(r.result); };
    r.onerror = () => { db.close(); rej(r.error); };
  });
}
const safe = async <T,>(p: () => Promise<T>): Promise<T | undefined> => { try { return await p(); } catch { return undefined; } };

export const loadDraft = <T,>(key: string) => safe(() => tx<T | undefined>('readonly', s => s.get(key)));
export const saveDraft = (key: string, v: unknown) => safe(() => tx('readwrite', s => s.put(v, key)));
export const clearDraft = (key: string) => safe(() => tx('readwrite', s => s.delete(key)));

// Khôi phục nháp khi mở màn hình, rồi tự lưu mỗi khi giá trị đổi.
export function useDraft<T extends Record<string, unknown>>(key: string, value: T, restore: (d: Partial<T>) => void) {
  const [ready, setReady] = useState(false);
  const last = useRef<T | null>(null);
  useEffect(() => {
    let alive = true;
    loadDraft<T>(key).then(d => { if (alive) { if (d) restore(d); setReady(true); } });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => {
    if (!ready) return;
    const prev = last.current;
    if (prev && Object.keys(value).every(k => Object.is(prev[k], value[k]))) return;
    last.current = value;
    saveDraft(key, value);
  });
  return { ready, clear: () => clearDraft(key) };
}
