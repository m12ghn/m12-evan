// Cảnh báo bảo dưỡng định kỳ (BTBD): so ODO hiện tại của xe trong app với mốc "Km BD định kỳ tiếp theo".
export const SOON_KM = 1000;    // còn ≤ 1000 km: sắp đến kỳ
export const URGENT_KM = 300;   // còn ≤ 300 km: đến kỳ, cần đặt lịch ngay
export type ServiceState = 'none' | 'ok' | 'soon' | 'urgent' | 'over';
export const SERVICE_LABEL: Record<ServiceState, string> = {
  none: 'Chưa có mốc BD', ok: 'Chưa đến kỳ BD', soon: 'Sắp đến kỳ BD', urgent: 'Đến kỳ BD', over: 'Quá hạn BD',
};

export const normPlate = (s: unknown) => String(s ?? '').replace(/[^0-9A-Za-z]/g, '').toUpperCase();
/** "442.000", "442000", " 1.609 ", "-108" → số nguyên; rỗng / không đọc được → null */
export function parseKm(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v) : null;
  const s = String(v ?? '').trim();
  if (!/\d/.test(s)) return null;
  const n = Number(s.replace(/[^\d-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

export const serviceLeft = (v: { odo: number; service_next_km?: number | null }): number | null =>
  v.service_next_km != null ? v.service_next_km - v.odo : null;

export function serviceState(left: number | null): ServiceState {
  if (left == null) return 'none';
  return left <= 0 ? 'over' : left <= URGENT_KM ? 'urgent' : left <= SOON_KM ? 'soon' : 'ok';
}
