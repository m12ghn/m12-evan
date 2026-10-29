import type { ReactNode } from 'react';

/** Khung xương khi đang tải (thay cho màn hình trống) */
export function Skeleton({ rows = 3 }: { rows?: number }) {
  return <div aria-busy="true" aria-label="Đang tải">{Array.from({ length: rows }, (_, i) => <div className="skel" key={i} />)}</div>;
}

/** Trạng thái rỗng: nói rõ vì sao rỗng và gợi ý bước tiếp theo */
export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

/** Điểm sáng / Điểm cần lưu ý, sinh từ dữ liệu */
export function Highlights({ good, warn }: { good: string[]; warn: string[] }) {
  return (
    <div className="hl">
      <div className="good"><h4>✓ Điểm sáng</h4>{good.length ? <ul>{good.map(g => <li key={g}>{g}</li>)}</ul> : <span className="muted">Chưa có điểm nổi bật</span>}</div>
      <div className="bad"><h4>⚠ Điểm cần lưu ý</h4>{warn.length ? <ul>{warn.map(w => <li key={w}>{w}</li>)}</ul> : <span className="muted">Không có cảnh báo</span>}</div>
    </div>
  );
}

/** Phân trang: Trước / Sau, "Trang x / y · tổng" */
export function Pager({ page, size, total, onPage, unit = 'dòng' }: { page: number; size: number; total: number; onPage: (p: number) => void; unit?: string }) {
  const pages = Math.max(1, Math.ceil(total / size));
  if (total <= size) return null;
  return (
    <div className="pager">
      <button className="btn ghost" disabled={page <= 1} onClick={() => onPage(page - 1)}>← Trước</button>
      <span className="muted">Trang {page} / {pages} · {total.toLocaleString('vi-VN')} {unit}</span>
      <button className="btn ghost" disabled={page >= pages} onClick={() => onPage(page + 1)}>Sau →</button>
    </div>
  );
}
