// Hạn GPLX: tính số ngày còn lại và mức cảnh báo; đọc ngày từ Excel (số serial, dd/mm/yyyy, yyyy-mm-dd).
export type LicenseState = 'none' | 'ok' | 'soon' | 'expired';
export const SOON_DAYS = 30;

export function daysLeft(expiry: string | null | undefined, today = new Date()): number | null {
  if (!expiry) return null;
  const d = new Date(`${expiry}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((d.getTime() - t0.getTime()) / 86400_000);
}
export function licenseState(expiry: string | null | undefined, today = new Date()): LicenseState {
  const n = daysLeft(expiry, today);
  return n == null ? 'none' : n < 0 ? 'expired' : n <= SOON_DAYS ? 'soon' : 'ok';
}

const ymd = (y: number, m: number, d: number) => {
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d ? `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` : null;
};
/** Trả về YYYY-MM-DD hoặc null nếu không đọc được. */
export function parseDate(v: unknown): string | null {
  if (v == null || v === '') return null;
  if (v instanceof Date) return ymd(v.getFullYear(), v.getMonth() + 1, v.getDate());
  if (typeof v === 'number') {   // số serial của Excel (ngày 1 = 01/01/1900, có tính lỗi năm nhuận 1900)
    if (v < 20000 || v > 80000) return null;
    const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(v) * 86400_000);
    return ymd(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) return ymd(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (m) return ymd(+m[3], +m[2], +m[1]);
  return null;
}
