// Đối chiếu kết quả AI đọc hóa đơn với phiếu sạc do tài xế nhập → danh sách cảnh báo ngắn cho quản lý.
export interface AiInfo {
  refuel_id: string; status: 'ok' | 'unreadable' | 'error'; station: string | null; amount: number | null; kwh: number | null;
  charged_ts: string | null; invoice_no: string | null; duration_min: number | null;
}
export interface RefuelLite { id: string; created_at: string; total_amount: number; quantity: number; energy_type: string }

const vnd = (n: number) => `${Math.round(n).toLocaleString('vi-VN')} đ`;
const when = (iso: string) => new Date(iso).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
const HOUR = 3600_000;

/** Khóa nhận diện cùng một phiên sạc: mã phiên nếu có, ngược lại bộ ba kWh + tiền + giờ. */
export function sessionKey(a?: AiInfo | null): string | null {
  if (!a || a.status !== 'ok') return null;
  if (a.invoice_no) return `inv:${a.invoice_no}`;
  if (a.kwh && a.amount) return `kv:${a.kwh}|${a.amount}|${a.charged_ts ?? ''}`;
  return null;
}

/** Số phiếu KHÁC dùng cùng phiên sạc (ảnh bị dùng lại) cho từng phiếu. */
export function duplicateCounts(items: { id: string; ai?: AiInfo | null }[]): Record<string, number> {
  const groups = new Map<string, string[]>();
  items.forEach(i => { const k = sessionKey(i.ai); if (k) groups.set(k, [...(groups.get(k) ?? []), i.id]); });
  const out: Record<string, number> = {};
  groups.forEach(ids => { if (ids.length > 1) ids.forEach(id => { out[id] = ids.length - 1; }); });
  return out;
}

/** Cảnh báo cho một phiếu sạc điện. dup = số phiếu khác trùng phiên sạc. */
export function aiFlags(r: RefuelLite, a: AiInfo | null | undefined, dup = 0): string[] {
  const f: string[] = [];
  if (!a || a.status !== 'ok') return f;                    // không đọc được → mặc định Sạc tại kho M12, không cảnh báo thêm
  const paid = Number(r.total_amount);
  if (a.amount && Number.isFinite(paid)) {
    if (paid > 0 && paid < 1000 && Math.abs(paid * 1000 - a.amount) / a.amount <= 0.05) f.push(`Nhập thiếu 000: ${vnd(paid)} (hóa đơn ${vnd(a.amount)})`);
    else if (Math.abs(paid - a.amount) / a.amount > 0.05) f.push(`Tiền nhập ${vnd(paid)} khác hóa đơn ${vnd(a.amount)}`);
  }
  if (a.kwh && r.quantity && Math.abs(r.quantity - a.kwh) / a.kwh > 0.05) f.push(`kWh nhập ${r.quantity} khác hóa đơn ${a.kwh}`);
  if (a.charged_ts) {
    const diff = Date.parse(r.created_at) - Date.parse(a.charged_ts);
    if (diff > 36 * HOUR) f.push(`Ảnh có vẻ cũ: giờ trên ảnh ${when(a.charged_ts)}, phiếu gửi ${when(r.created_at)}`);
    else if (diff < -3 * HOUR) f.push(`Giờ trên ảnh (${when(a.charged_ts)}) sau lúc gửi phiếu`);
  }
  if (dup > 0) f.push(`Trùng phiên sạc với ${dup} phiếu khác`);
  return f;
}
