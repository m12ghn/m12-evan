import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Lookups } from '../../lib/useLookups';
import SignedPhotos, { TRIP_LABELS } from '../../components/SignedPhotos';
import type { PhotoMap } from '../../lib/storage';
import { downloadXlsx, type Cell } from '../../lib/excel';
import { dayAfter, dayStart, fetchAll, ymd } from '../../lib/dates';

interface TripRow {
  id: string; vehicle_id: string; driver_id: string; status: 'on_duty' | 'completed';
  start_time: string; end_time: string | null; start_odo: number; end_odo: number | null;
  start_level: number; end_level: number | null; km_driven: number | null;
  energy_consumed: number | null; energy_rate: number | null;
  pre_notes: string | null; has_damage: boolean; damage_notes: string | null;
  photos_start: PhotoMap | null; photos_end: PhotoMap | null;
}
interface Fill { trip_id: string; quantity: number; total_amount: number }

const fmt = (s: string) => new Date(s).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });

export default function Trips({ lk }: { lk: Lookups }) {
  const today = new Date();
  const [from, setFrom] = useState(ymd(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29)));
  const [to, setTo] = useState(ymd(today));
  const [rows, setRows] = useState<TripRow[]>([]);
  const [fills, setFills] = useState<Fill[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'all' | 'on_duty' | 'completed'>('all');
  const [energy, setEnergy] = useState<'all' | 'fuel' | 'electric'>('all');
  const [vtype, setVtype] = useState('');
  const [driver, setDriver] = useState('');
  const [issueOnly, setIssueOnly] = useState(false);
  const [overOnly, setOverOnly] = useState(false);
  const [open, setOpen] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const t = await fetchAll<TripRow>((a, b) => supabase.from('trips').select('*')
      .gte('start_time', dayStart(from)).lt('start_time', dayAfter(to)).order('start_time', { ascending: false }).range(a, b));
    const ids = new Set(t.map(x => x.id));
    const r = await fetchAll<Fill>((a, b) => supabase.from('refuels').select('trip_id, quantity, total_amount')
      .neq('status', 'rejected').gte('created_at', dayStart(from)).range(a, b));
    setRows(t); setFills(r.filter(x => ids.has(x.trip_id))); setLoading(false);
  }, [from, to]);
  useEffect(() => { if (from && to && from <= to) load(); }, [load, from, to]);

  const fillOf = useMemo(() => {
    const m = new Map<string, { qty: number; money: number }>();
    fills.forEach(f => { const c = m.get(f.trip_id) ?? { qty: 0, money: 0 }; c.qty += Number(f.quantity); c.money += Number(f.total_amount); m.set(f.trip_id, c); });
    return m;
  }, [fills]);

  const vehicleTypes = useMemo(() => [...new Set(lk.vehicles.map(v => v.type).filter(Boolean))].sort() as string[], [lk.vehicles]);
  const drivers = useMemo(() => lk.people.filter(p => rows.some(r => r.driver_id === p.id)), [lk.people, rows]);

  const isOver = (t: TripRow) => { const v = lk.vehicle(t.vehicle_id); return t.energy_rate != null && v != null && t.energy_rate > v.std_rate * 1.15; };
  const list = rows.filter(t => {
    const v = lk.vehicle(t.vehicle_id);
    return (status === 'all' || t.status === status)
      && (energy === 'all' || v?.energy_type === energy)
      && (!vtype || v?.type === vtype)
      && (!driver || t.driver_id === driver)
      && (!issueOnly || t.has_damage) && (!overOnly || isOver(t))
      && (!q || `${lk.plate(t.vehicle_id)} ${lk.person(t.driver_id)}`.toLowerCase().includes(q.toLowerCase()));
  });

  const totalKm = list.reduce((s, t) => s + (t.km_driven ?? 0), 0);
  const totalMoney = list.reduce((s, t) => s + (fillOf.get(t.id)?.money ?? 0), 0);

  async function exportXlsx() {
    const unit = (id: string) => (lk.vehicle(id)?.energy_type === 'electric' ? 'kWh' : 'L');
    const detail: Cell[][] = [[
      'Ngày', 'Giờ nhận xe', 'Giờ trả xe', 'Biển số', 'Loại xe', 'Năng lượng', 'Tài xế', 'ODO đầu', 'ODO cuối', 'Quãng đường (km)',
      'Mức đầu (%)', 'Mức cuối (%)', 'Tiêu hao', 'Đơn vị', 'Định mức /100km', 'Thực tế /100km', 'Vượt định mức', 'Đã cấp (lít/kWh)', 'Tiền cấp (đ)', 'Trạng thái ca', 'Sự cố', 'Mô tả sự cố',
    ]];
    const hm = (s: string | null) => (s ? new Date(s).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '');
    const sum = new Map<string, { plate: string; type: string; trips: number; km: number; used: number; qty: number; money: number; unit: string }>();
    [...list].reverse().forEach(t => {
      const v = lk.vehicle(t.vehicle_id); const f = fillOf.get(t.id);
      detail.push([
        new Date(t.start_time).toLocaleDateString('vi-VN'), hm(t.start_time), hm(t.end_time), lk.plate(t.vehicle_id), v?.type ?? '',
        v?.energy_type === 'electric' ? 'Điện' : v?.fuel_type ?? '', lk.person(t.driver_id), t.start_odo, t.end_odo, t.km_driven,
        t.start_level, t.end_level, t.energy_consumed, unit(t.vehicle_id), v?.std_rate ?? null, t.energy_rate, isOver(t) ? 'Có' : '',
        f?.qty ?? 0, f?.money ?? 0, t.status === 'completed' ? 'Hoàn tất' : 'Đang chạy', t.has_damage ? 'Có' : '', t.damage_notes,
      ]);
      const s = sum.get(t.vehicle_id) ?? { plate: lk.plate(t.vehicle_id), type: v?.type ?? '', trips: 0, km: 0, used: 0, qty: 0, money: 0, unit: unit(t.vehicle_id) };
      s.trips++; s.km += t.km_driven ?? 0; s.used += t.energy_consumed ?? 0; s.qty += f?.qty ?? 0; s.money += f?.money ?? 0; sum.set(t.vehicle_id, s);
    });
    const summary: Cell[][] = [['Biển số', 'Loại xe', 'Số ca', 'Tổng km', 'Tổng tiêu hao', 'Đơn vị', 'TB /100km', 'Tổng đã cấp', 'Tổng tiền cấp (đ)']];
    [...sum.values()].sort((a, b) => a.plate.localeCompare(b.plate)).forEach(s =>
      summary.push([s.plate, s.type, s.trips, s.km, Number(s.used.toFixed(1)), s.unit, s.km ? Number(((s.used / s.km) * 100).toFixed(1)) : null, Number(s.qty.toFixed(1)), Math.round(s.money)]));
    await downloadXlsx(`nhat-ky-ca_${from}_${to}.xlsx`, [
      { name: 'Chi tiết ca', rows: detail, widths: [11, 10, 10, 13, 26, 16, 20, 10, 10, 12, 10, 10, 10, 7, 12, 12, 11, 14, 13, 11, 8, 30] },
      { name: 'Tổng hợp theo xe', rows: summary, widths: [13, 26, 8, 10, 12, 7, 10, 12, 16] },
    ]);
  }

  return (
    <div className="card">
      <div className="filters">
        <label>Từ ngày<input type="date" value={from} max={to} onChange={e => setFrom(e.target.value)} /></label>
        <label>Đến ngày<input type="date" value={to} min={from} onChange={e => setTo(e.target.value)} /></label>
        <label>Tìm kiếm<input placeholder="Biển số / tài xế" value={q} onChange={e => setQ(e.target.value)} /></label>
        <label>Loại xe<select value={vtype} onChange={e => setVtype(e.target.value)}><option value="">Tất cả</option>{vehicleTypes.map(t => <option key={t}>{t}</option>)}</select></label>
        <label>Năng lượng<select value={energy} onChange={e => setEnergy(e.target.value as typeof energy)}><option value="all">Tất cả</option><option value="fuel">Xăng / Dầu</option><option value="electric">Điện</option></select></label>
        <label>Tài xế<select value={driver} onChange={e => setDriver(e.target.value)}><option value="">Tất cả</option>{drivers.map(p => <option key={p.id} value={p.id}>{p.full_name ?? p.email}</option>)}</select></label>
        <label>Trạng thái ca<select value={status} onChange={e => setStatus(e.target.value as typeof status)}><option value="all">Tất cả</option><option value="on_duty">Đang chạy</option><option value="completed">Hoàn tất</option></select></label>
      </div>
      <div className="row" style={{ flexWrap: 'wrap', margin: '12px 0' }}>
        <label className="row"><input type="checkbox" checked={issueOnly} onChange={e => setIssueOnly(e.target.checked)} /> Chỉ ca có sự cố</label>
        <label className="row"><input type="checkbox" checked={overOnly} onChange={e => setOverOnly(e.target.checked)} /> Chỉ ca vượt định mức</label>
        <span style={{ flex: 1 }} />
        <button className="btn" disabled={!list.length || loading} onClick={exportXlsx}>⬇️ Tải Excel ({list.length} ca)</button>
      </div>
      <p className="muted">{loading ? 'Đang tải…' : <>Hiển thị <b>{list.length}</b> ca · tổng <b>{totalKm.toLocaleString()} km</b> · tiền cấp nhiên liệu/điện <b>{Math.round(totalMoney).toLocaleString('vi-VN')} đ</b></>}</p>

      <div className="scroll">
        <table>
          <thead><tr><th>Thời gian</th><th>Xe</th><th>Tài xế</th><th>ODO</th><th>Quãng đường</th><th>Tiêu hao</th><th>Tình trạng</th><th></th></tr></thead>
          <tbody>
            {list.map(t => {
              const v = lk.vehicle(t.vehicle_id);
              const unit = v?.energy_type === 'electric' ? 'kWh' : 'L';
              const high = isOver(t);
              return (
                <Fragment key={t.id}>
                  <tr>
                    <td>{fmt(t.start_time)}{t.end_time ? ` → ${fmt(t.end_time)}` : ''}</td>
                    <td>{lk.plate(t.vehicle_id)}<br /><small className="muted">{v?.type}</small></td><td>{lk.person(t.driver_id)}</td>
                    <td>{t.start_odo.toLocaleString()} → {t.end_odo?.toLocaleString() ?? '…'}</td>
                    <td>{t.status === 'on_duty' ? <><span className="chip on_duty">Đang chạy</span>{Date.now() - Date.parse(t.start_time) > 12 * 3600_000 && <><br /><small className="error">⏰ Quá 12 giờ chưa trả xe</small></>}</> : `${t.km_driven?.toLocaleString()} km`}</td>
                    <td className={high ? 'error' : ''}>{t.energy_rate != null ? `${t.energy_rate} ${unit}/100km${high ? ' ⚠️' : ''}` : '—'}</td>
                    <td>{t.has_damage ? <span className="chip maintenance">Có sự cố</span> : t.status === 'completed' ? '✓ Nguyên vẹn' : '—'}</td>
                    <td><button className="btn ghost" onClick={() => setOpen(open === t.id ? '' : t.id)}>{open === t.id ? 'Đóng' : 'Chi tiết'}</button></td>
                  </tr>
                  {open === t.id && (
                    <tr><td colSpan={8}>
                      {t.pre_notes && <p><b>Ghi chú nhận xe:</b> {t.pre_notes}</p>}
                      {t.damage_notes && <p className="error"><b>Sự cố cuối ca:</b> {t.damage_notes}</p>}
                      <h4>Ảnh đầu ca</h4><SignedPhotos photos={t.photos_start} labels={TRIP_LABELS} />
                      <h4>Ảnh cuối ca</h4><SignedPhotos photos={t.photos_end} labels={TRIP_LABELS} />
                    </td></tr>
                  )}
                </Fragment>
              );
            })}
            {!loading && list.length === 0 && <tr><td colSpan={8} className="muted">Không có ca nào khớp bộ lọc</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
