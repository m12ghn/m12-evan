// Đọc mốc bảo dưỡng định kỳ (BTBD) từ Google Sheet (xuất CSV) và đối chiếu với xe trong app. File bắt đầu bằng "_" nên Vercel không coi là endpoint.

/** CSV (RFC 4180): có ngoặc kép, dấu phẩy và xuống dòng trong ô. Giữ nguyên chuỗi (không tự đổi "440.391" thành số). */
export function parseCsv(text) {
  const rows = []; let row = [], cell = '', q = false;
  const s = String(text ?? '').replace(/^﻿/, '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && s[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

export const plain = t => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().replace(/\s+/g, ' ').trim();
export const normPlate = s => String(s ?? '').replace(/[^0-9A-Za-z]/g, '').toUpperCase();
/** "442.000", "442000", "-108" → số nguyên; rỗng / lỗi (#N/A) → null */
export function parseKm(v) {
  const s = String(v ?? '').trim();
  if (!/\d/.test(s)) return null;
  const n = Number(s.replace(/[^\d-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

/** Tìm dòng tiêu đề (trong 15 dòng đầu) có "Biển số" và "Km BD định kì tiếp theo". */
export function findColumns(rows) {
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const hs = rows[i].map(plain);
    const plate = hs.findIndex(h => h === 'bien so');
    const next = hs.findIndex(h => /dinh k[iy] tiep theo/.test(h));
    if (plate >= 0 && next >= 0) {
      return { header: i, plate, next, left: hs.findIndex(h => /km bd con lai|^con lai/.test(h)), notice: hs.findIndex(h => /^thong bao/.test(h)) };
    }
  }
  return null;
}

/** rows (CSV) + xe trong app → danh sách cập nhật + thống kê. */
export function buildUpdates(rows, vehicles) {
  const cols = findColumns(rows);
  if (!cols) return { error: 'Không thấy cột "Biển số" và "Km BD định kì tiếp theo" trong sheet. Kiểm tra lại đường dẫn / sheet (phải là sheet Data BTBD).' };
  const byPlate = new Map(vehicles.map(v => [normPlate(v.plate), v]));
  const updates = []; const unmatched = []; const seen = new Set(); let withMark = 0;
  for (const r of rows.slice(cols.header + 1)) {
    const key = normPlate(r[cols.plate]);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const next = parseKm(r[cols.next]);
    if (next == null || next <= 0) continue;
    withMark++;
    const v = byPlate.get(key);
    if (!v) { unmatched.push(String(r[cols.plate]).trim()); continue; }
    const left = cols.left >= 0 ? parseKm(r[cols.left]) : null;
    const notice = cols.notice >= 0 ? (String(r[cols.notice] ?? '').trim() || null) : null;
    const changed = v.service_next_km !== next;
    updates.push({ id: v.id, plate: v.plate, patch: { service_next_km: next, service_sheet_left_km: left, service_sheet_notice: notice }, changed });
  }
  return { updates, unmatched, withMark, sheetRows: rows.length - cols.header - 1 };
}
