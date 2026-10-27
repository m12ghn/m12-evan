import { supabase } from './supabase';
import { BUCKET } from './storage';

export interface ZipItem { name: string; path: string }   // name: tên file trong ZIP, path: đường dẫn trong Storage

const ascii = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '');
export const safeName = (...parts: (string | number | null | undefined)[]) => parts.filter(p => p !== '' && p != null).map(p => ascii(String(p))).join('_');

/** Tải các ảnh từ Storage (3 ảnh cùng lúc) rồi nén thành các file ZIP (mỗi file tối đa perZip ảnh để không quá nặng). */
export async function downloadPhotoZips(
  base: string, items: ZipItem[], index: string[][], onProgress: (done: number, total: number, part: number) => void, perZip = 120,
): Promise<{ saved: number; missing: string[] }> {
  const { default: JSZip } = await import('jszip');
  const missing: string[] = [];
  let saved = 0, done = 0;
  const parts = Math.max(1, Math.ceil(items.length / perZip));
  for (let p = 0; p < parts; p++) {
    const chunk = items.slice(p * perZip, (p + 1) * perZip);
    const zip = new JSZip();
    let next = 0;
    const worker = async () => {
      while (next < chunk.length) {
        const it = chunk[next++];
        const { data, error } = await supabase.storage.from(BUCKET).download(it.path);
        if (error || !data) missing.push(it.name); else { zip.file(it.name, data); saved++; }
        onProgress(++done, items.length, p + 1);
      }
    };
    await Promise.all(Array.from({ length: Math.min(3, chunk.length) }, worker));
    if (p === 0) {   // danh mục: mỗi dòng một lượt sạc + tên file ảnh
      zip.file('danh-muc.csv', '﻿' + index.map(r => r.map(c => /[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c).join(',')).join('\r\n'));
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = parts > 1 ? `${base}_phan${p + 1}-${parts}.zip` : `${base}.zip`; a.click();
    await new Promise(r => setTimeout(r, 800));
    URL.revokeObjectURL(a.href);
  }
  return { saved, missing };
}
