// Giao diện sáng / tối / theo hệ thống. Lưu lựa chọn ở trình duyệt (có thể bị chặn → bỏ qua lỗi).
export type Theme = 'auto' | 'light' | 'dark';
const KEY = 'fleetops-theme';
export function getTheme(): Theme {
  try { const v = localStorage.getItem(KEY); return v === 'light' || v === 'dark' ? v : 'auto'; } catch { return 'auto'; }
}
export function applyTheme(t: Theme) {
  if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t);
}
export function setTheme(t: Theme) {
  try { if (t === 'auto') localStorage.removeItem(KEY); else localStorage.setItem(KEY, t); } catch { /* bỏ qua */ }
  applyTheme(t);
}
