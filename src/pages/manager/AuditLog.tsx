import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Lookups } from '../../lib/useLookups';
import { VEHICLE_STATUS } from '../../lib/types';
import { downloadXlsx, type Cell } from '../../lib/excel';
import { dayAfter, dayStart, fetchAll, ymd } from '../../lib/dates';

interface Row {
  id: number; at: string; actor_id: string | null; actor_name: string | null; action: string;
  table_name: string | null; record_id: string | null;
  row_data: Record<string, unknown> | null; changes: Record<string, { old: unknown; new: unknown }> | null;
}

const TABLE: Record<string, string> = {
  vehicles: 'Xe', trips: 'Ca vận hành', refuels: 'Phiếu nhiên liệu/điện', accidents: 'Tai nạn', profiles: 'Người dùng', app_settings: 'Cài đặt', auth: 'Phiên đăng nhập',
};
const ACTION: Record<string, string> = {
  insert: 'Thêm mới', update: 'Cập nhật', delete: 'Xóa', login: 'Đăng nhập', logout: 'Đăng xuất',
  create_user: 'Tạo tài khoản', change_username: 'Đổi tên đăng nhập', reset_password: 'Đổi mật khẩu', set_active: 'Đổi trạng thái làm việc',
};
const FIELD: Record<string, string> = {
  status: 'Trạng thái', odo: 'ODO', energy_level: 'Mức NL/pin (%)', driver_id: 'Tài xế', vehicle_id: 'Xe', plate: 'Biển số', type: 'Loại xe',
  energy_type: 'Năng lượng', capacity: 'Dung tích/pin', std_rate: 'Định mức', fuel_type: 'Loại nhiên liệu',
  start_odo: 'ODO đầu ca', end_odo: 'ODO cuối ca', start_level: 'Mức đầu ca (%)', end_level: 'Mức cuối ca (%)', end_time: 'Giờ trả xe',
  km_driven: 'Quãng đường (km)', energy_consumed: 'Tiêu hao', energy_rate: 'Tiêu hao /100km', has_damage: 'Có sự cố', damage_notes: 'Mô tả sự cố',
  quantity: 'Số lượng', unit_price: 'Đơn giá', total_amount: 'Thành tiền', manager_note: 'Ghi chú quản lý', station: 'Trạm',
  battery_before: 'Pin trước (%)', battery_after: 'Pin sau (%)', charge_minutes: 'Thời gian sạc (phút)', odo_at_refuel: 'ODO lúc cấp',
  full_name: 'Họ tên', phone: 'SĐT', license: 'Bằng lái', role: 'Quyền', active: 'Làm việc', email: 'Tên đăng nhập',
  value: 'Giá trị', location: 'Địa điểm', description: 'Mô tả', pre_notes: 'Ghi chú nhận xe', post_notes: 'Ghi chú cuối ca',
};
const IGNORE = new Set(['photos', 'photos_start', 'photos_end', 'photo_pump', 'photo_receipt', 'id', 'created_at', 'start_time', 'trip_id']);
const STATUS_BY_TABLE: Record<string, Record<string, string>> = {
  vehicles: VEHICLE_STATUS,
  trips: { on_duty: 'Đang chạy', completed: 'Hoàn tất' },
  refuels: { pending: 'Chờ duyệt', approved: 'Đã duyệt', rejected: 'Từ chối' },
  accidents: { new: 'Mới', handling: 'Đang xử lý', done: 'Đã xử lý' },
};

export default function AuditLog({ lk }: { lk: Lookups }) {
  const today = ymd(new Date());
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [actor, setActor] = useState('');
  const [table, setTable] = useState('');
  const [action, setAction] = useState('');
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const r = await fetchAll<Row>((a, b) => supabase.from('audit_log').select('*')
        .gte('at', dayStart(from)).lt('at', dayAfter(to)).order('at', { ascending: false }).range(a, b));
      setRows(r);
    } catch (e) { setError((e as Error).message); }
    setLoading(false);
  }, [from, to]);
  useEffect(() => { if (from && to && from <= to) load(); }, [load, from, to]);

  const val = (t: string | null, f: string, v: unknown): string => {
    if (v === null || v === undefined || v === '') return '—';
    if (f === 'status' && t && STATUS_BY_TABLE[t]) return STATUS_BY_TABLE[t][String(v)] ?? String(v);
    if (f === 'driver_id') return lk.person(String(v));
    if (f === 'vehicle_id') return lk.plate(String(v));
    if (f === 'role') return v === 'dev' ? 'Dev' : v === 'manager' ? 'Quản lý' : 'Tài xế';
    if (f === 'active') return v ? 'Còn làm' : 'Đã nghỉ';
    if (f === 'has_damage') return v ? 'Có' : 'Không';
    if (f === 'energy_type') return v === 'electric' ? 'Điện' : 'Xăng/Dầu';
    if (f === 'end_time') return new Date(String(v)).toLocaleString('vi-VN');
    if (f === 'email') return String(v).replace('@fleetops.local', '');
    if (typeof v === 'number') return v.toLocaleString('vi-VN');
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
  };

  const target = (r: Row): string => {
    const d = r.row_data ?? {};
    switch (r.table_name) {
      case 'vehicles': return String(d.plate ?? '');
      case 'trips': return `${lk.plate(String(d.vehicle_id ?? ''))} · ${lk.person(String(d.driver_id ?? ''))}`;
      case 'refuels': return `${lk.person(String(d.driver_id ?? ''))} · ${d.energy_type === 'electric' ? 'Điện' : 'Nhiên liệu'}`;
      case 'accidents': return `${lk.person(String(d.driver_id ?? ''))} · ${String(d.location ?? '')}`;
      case 'profiles': return String(d.full_name ?? '') || val(null, 'email', d.email);
      case 'app_settings': return String(d.key ?? '');
      default: return '';
    }
  };

  const detail = (r: Row): string => {
    const d = r.row_data ?? {};
    if (r.action === 'update' && r.changes) {
      const parts = Object.entries(r.changes).filter(([k]) => !IGNORE.has(k)).map(([k, c]) => `${FIELD[k] ?? k}: ${val(r.table_name, k, c.old)} → ${val(r.table_name, k, c.new)}`);
      const photos = Object.keys(r.changes).some(k => k.startsWith('photos') || k.startsWith('photo_'));
      return [...parts, ...(photos ? ['(cập nhật ảnh)'] : [])].join(' · ');
    }
    switch (r.action) {
      case 'insert':
        if (r.table_name === 'vehicles') return `${d.type ?? ''} · ${d.energy_type === 'electric' ? 'Điện' : 'Xăng/Dầu'}`;
        if (r.table_name === 'trips') return `Nhận xe, ODO đầu ca ${val(null, 'odo', d.start_odo)}`;
        if (r.table_name === 'refuels') return `${val(null, 'q', d.quantity)} ${d.energy_type === 'electric' ? 'kWh' : 'L'} · ${val(null, 'm', d.total_amount)} đ`;
        if (r.table_name === 'accidents') return String(d.description ?? '');
        return '';
      case 'delete': return 'Đã xóa dữ liệu';
      case 'create_user': return `Quyền: ${val(null, 'role', d.role)}`;
      case 'change_username': return r.changes?.email ? `${val(null, 'email', r.changes.email.old)} → ${val(null, 'email', r.changes.email.new)}` : '';
      case 'reset_password': return '(mật khẩu không được ghi lại)';
      case 'set_active': return r.changes?.active ? `${val(null, 'active', r.changes.active.old)} → ${val(null, 'active', r.changes.active.new)}` : '';
      default: return '';
    }
  };

  const list = useMemo(() => rows.filter(r =>
    (!actor || (actor === '__sys' ? !r.actor_id : r.actor_id === actor))
    && (!table || r.table_name === table) && (!action || r.action === action)
    && (!q || `${r.actor_name ?? ''} ${target(r)} ${detail(r)}`.toLowerCase().includes(q.toLowerCase()))),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [rows, actor, table, action, q, lk.vehicles, lk.people]);

  const days = useMemo(() => {
    const m = new Map<string, Row[]>();
    list.forEach(r => { const k = ymd(new Date(r.at)); (m.get(k) ?? m.set(k, []).get(k)!).push(r); });
    return [...m.entries()];
  }, [list]);

  const preset = (n: number) => { const d = new Date(); d.setDate(d.getDate() - (n - 1)); setFrom(ymd(d)); setTo(today); };
  const time = (s: string) => new Date(s).toLocaleTimeString('vi-VN');

  async function exportXlsx() {
    const rowsX: Cell[][] = [['Ngày', 'Giờ', 'Người thực hiện', 'Hành động', 'Đối tượng', 'Định danh', 'Chi tiết']];
    [...list].reverse().forEach(r => rowsX.push([
      new Date(r.at).toLocaleDateString('vi-VN'), time(r.at), r.actor_name ?? 'Hệ thống', ACTION[r.action] ?? r.action,
      TABLE[r.table_name ?? ''] ?? '', target(r), detail(r),
    ]));
    await downloadXlsx(`nhat-ky-thao-tac_${from}_${to}.xlsx`, [{ name: 'Nhật ký', rows: rowsX, widths: [11, 10, 20, 22, 22, 28, 80] }]);
  }

  return (
    <div className="card">
      <div className="filters">
        <label>Từ ngày<input type="date" value={from} max={to} onChange={e => setFrom(e.target.value)} /></label>
        <label>Đến ngày<input type="date" value={to} min={from} onChange={e => setTo(e.target.value)} /></label>
        <label>Người thực hiện<select value={actor} onChange={e => setActor(e.target.value)}>
          <option value="">Tất cả</option><option value="__sys">Hệ thống / SQL Editor</option>
          {lk.people.map(p => <option key={p.id} value={p.id}>{p.full_name ?? p.email}</option>)}</select></label>
        <label>Đối tượng<select value={table} onChange={e => setTable(e.target.value)}>
          <option value="">Tất cả</option>{Object.entries(TABLE).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <label>Hành động<select value={action} onChange={e => setAction(e.target.value)}>
          <option value="">Tất cả</option>{Object.entries(ACTION).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <label>Tìm kiếm<input placeholder="Tên, biển số, nội dung…" value={q} onChange={e => setQ(e.target.value)} /></label>
      </div>
      <div className="row" style={{ flexWrap: 'wrap', margin: '12px 0' }}>
        <button className="btn ghost" onClick={() => preset(1)}>Hôm nay</button>
        <button className="btn ghost" onClick={() => preset(7)}>7 ngày</button>
        <button className="btn ghost" onClick={() => preset(30)}>30 ngày</button>
        <span style={{ flex: 1 }} />
        <button className="btn ghost" onClick={load}>↻ Làm mới</button>
        <button className="btn" disabled={!list.length || loading} onClick={exportXlsx}>⬇️ Tải Excel ({list.length})</button>
      </div>
      {error && <p className="error">{error} {/audit_log/.test(error) && '— Đã chạy migration-006 chưa?'}</p>}
      <p className="muted">{loading ? 'Đang tải…' : `${list.length} thao tác trong ${days.length} ngày`}</p>

      {days.map(([day, items]) => (
        <div key={day} style={{ marginTop: 14 }}>
          <h4 className="day-head">
            {new Date(`${day}T00:00:00`).toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}
            <span className="muted"> — {items.length} thao tác · {new Set(items.map(i => i.actor_name ?? 'Hệ thống')).size} người</span>
          </h4>
          <div className="scroll"><table>
            <thead><tr><th>Giờ</th><th>Người thực hiện</th><th>Hành động</th><th>Đối tượng</th><th>Chi tiết</th></tr></thead>
            <tbody>
              {items.map(r => (
                <tr key={r.id}>
                  <td>{time(r.at)}</td><td>{r.actor_name ?? <span className="muted">Hệ thống</span>}</td>
                  <td><span className={`chip ${r.action === 'delete' ? 'repair' : r.action === 'update' ? 'maintenance' : ''}`}>{ACTION[r.action] ?? r.action}</span></td>
                  <td>{TABLE[r.table_name ?? ''] ?? ''}{target(r) && <><br /><small className="muted">{target(r)}</small></>}</td>
                  <td>{detail(r)}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      ))}
      {!loading && days.length === 0 && !error && <p className="muted">Không có thao tác nào trong khoảng ngày đã chọn</p>}
    </div>
  );
}
