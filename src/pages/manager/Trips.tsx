import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Lookups } from '../../lib/useLookups';
import SignedPhotos, { START_LABELS, TRIP_LABELS } from '../../components/SignedPhotos';
import type { PhotoMap } from '../../lib/storage';
import { downloadXlsx, type Cell } from '../../lib/excel';
import { useVehicleFilter } from '../../components/VehicleFilter';
import { Empty, Pager, Skeleton } from '../../components/ui';
import { dayAfter, dayStart, fetchAll, ymd } from '../../lib/dates';

interface TripRow {
  id: string; vehicle_id: string; driver_id: string; status: 'on_duty' | 'completed';
  start_time: string; end_time: string | null; start_odo: number; end_odo: number | null;
  start_level: number; end_level: number | null; km_driven: number | null;
  energy_consumed: number | null; energy_rate: number | null;
  pre_notes: string | null; post_notes: string | null; closed_by: string | null; has_damage: boolean; damage_notes: string | null;
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
  const vf = useVehicleFilter(lk, { statuses: [{ value: 'on_duty', label: 'Đang chạy' }, { value: 'completed', label: 'Hoàn tất' }], statusLabel: 'Trạng thái ca' });
  const [issueOnly, setIssueOnly] = useState(false);
  const [overOnly, setOverOnly] = useState(false);
  const [open, setOpen] = useState('');
  const [page, setPage] = useState(1);
  const PAGE = 50;

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

  const isOver = (t: TripRow) => { const v = lk.vehicle(t.vehicle_id); return t.energy_rate != null && v != null && t.energy_rate > v.std_rate * 1.15; };
  const list = rows.filter(t => vf.match(t.vehicle_id, t.driver_id, t.status) && (!issueOnly || t.has_damage) && (!overOnly || isOver(t)));

  // Về trang 1 khi đổi bộ lọc / khoảng ngày
  useEffect(() => { setPage(1); }, [rows, vf.active, issueOnly, overOnly, vf.key]);
  const pageRows = list.slice((page - 1) * PAGE, page * PAGE);
  const totalKm = list.reduce((s, t) => s + (t.km_driven ?? 0), 0);
  const totalMoney = list.reduce((s, t) => s + (fillOf.get(t.id)?.money ?? 0), 0);

  async function exportXlsx() {
    const unit = (id: string) => (lk.vehicle(id)?.energy_type === 'electric' ? 'kWh' : 'L');
    const detail: Cell[][] = [[
      'Ngày', 'Giờ nhận xe', 'Giờ trả xe', 'Biển số', 'Loại xe', 'Năng lượng', 'Tài xế', 'ODO đầu', 'ODO cuối', 'Quãng đường (km)',
      'Mức đầu (%)', 'Mức cuối (%)', 'Tiêu hao', 'Đơn vị', 'Định mức /100km', 'Thực tế /100km', 'Vượt định mức', 'Đã cấp (lít/kWh)', 'Tiền cấp (đ)', 'Trạng thái ca', 'Quản lý đóng ca', 'Sự cố', 'Mô tả sự cố',
    ]];
    const hm = (s: string | null) => (s ? new Date(s).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '');
    const sum = new Map<string, { plate: string; type: string; trips: number; km: number; used: number; qty: number; money: number; unit: string }>();
    [...list].reverse().forEach(t => {
      const v = lk.vehicle(t.vehicle_id); const f = fillOf.get(t.id);
      detail.push([
        new Date(t.start_time).toLocaleDateString('vi-VN'), hm(t.start_time), hm(t.end_time), lk.plate(t.vehicle_id), v?.type ?? '',
        v?.energy_type === 'electric' ? 'Điện' : v?.fuel_type ?? '', lk.person(t.driver_id), t.start_odo, t.end_odo, t.km_driven,
        t.start_level, t.end_level, t.energy_consumed, unit(t.vehicle_id), v?.std_rate ?? null, t.energy_rate, isOver(t) ? 'Có' : '',
        f?.qty ?? 0, f?.money ?? 0, t.status === 'completed' ? 'Hoàn tất' : 'Đang chạy', t.closed_by ? 'Có' : '', t.has_damage ? 'Có' : '', t.damage_notes,
      ]);
      const s = sum.get(t.vehicle_id) ?? { plate: lk.plate(t.vehicle_id), type: v?.type ?? '', trips: 0, km: 0, used: 0, qty: 0, money: 0, unit: unit(t.vehicle_id) };
      s.trips++; s.km += t.km_driven ?? 0; s.used += t.energy_consumed ?? 0; s.qty += f?.qty ?? 0; s.money += f?.money ?? 0; sum.set(t.vehicle_id, s);
    });
    const summary: Cell[][] = [['Biển số', 'Loại xe', 'Số ca', 'Tổng km', 'Tổng tiêu hao', 'Đơn vị', 'TB /100km', 'Tổng đã cấp', 'Tổng tiền cấp (đ)']];
    [...sum.values()].sort((a, b) => a.plate.localeCompare(b.plate)).forEach(s =>
      summary.push([s.plate, s.type, s.trips, s.km, Number(s.used.toFixed(1)), s.unit, s.km ? Number(((s.used / s.km) * 100).toFixed(1)) : null, Number(s.qty.toFixed(1)), Math.round(s.money)]));
    await downloadXlsx(`nhat-ky-ca_${from}_${to}.xlsx`, [
      { name: 'Chi tiết ca', rows: detail, widths: [11, 10, 10, 13, 26, 16, 20, 10, 10, 12, 10, 10, 10, 7, 12, 12, 11, 14, 13, 11, 14, 8, 30] },
      { name: 'Tổng hợp theo xe', rows: summary, widths: [13, 26, 8, 10, 12, 7, 10, 12, 16] },
    ]);
  }

  return (
    <div className="card">
      <div className="filters">
        <label>Từ ngày<input type="date" value={from} max={to} onChange={e => setFrom(e.target.value)} /></label>
        <label>Đến ngày<input type="date" value={to} min={from} onChange={e => setTo(e.target.value)} /></label>
      </div>
      <div style={{ height: 10 }} />
      {vf.ui}
      <div className="row" style={{ flexWrap: 'wrap', margin: '4px 0 12px' }}>
        <label className="row"><input type="checkbox" checked={issueOnly} onChange={e => setIssueOnly(e.target.checked)} /> Chỉ ca có sự cố</label>
        <label className="row"><input type="checkbox" checked={overOnly} onChange={e => setOverOnly(e.target.checked)} /> Chỉ ca vượt định mức</label>
        <span style={{ flex: 1 }} />
        <button className="btn" disabled={!list.length || loading} onClick={exportXlsx}>⬇️ Tải Excel ({list.length} ca)</button>
      </div>
      <p className="muted">{loading ? 'Đang tải…' : <>Hiển thị <b>{list.length}</b> ca · tổng <b>{totalKm.toLocaleString()} km</b> · tiền cấp nhiên liệu/điện <b>{Math.round(totalMoney).toLocaleString('vi-VN')} đ</b></>}</p>

      <div className="scroll">
        <table>
          <thead><tr><th>Thời gian</th><th>Xe</th><th>Tài xế</th><th className="num">ODO</th><th className="num">Quãng đường</th><th className="num">Tiêu hao</th><th>Tình trạng</th><th></th></tr></thead>
          <tbody>
            {pageRows.map(t => {
              const v = lk.vehicle(t.vehicle_id);
              const unit = v?.energy_type === 'electric' ? 'kWh' : 'L';
              const high = isOver(t);
              return (
                <Fragment key={t.id}>
                  <tr>
                    <td>{fmt(t.start_time)}{t.end_time ? ` → ${fmt(t.end_time)}` : ''}</td>
                    <td>{lk.plate(t.vehicle_id)}<br /><small className="muted">{v?.type}</small></td><td>{lk.person(t.driver_id)}</td>
                    <td className="num">{t.start_odo.toLocaleString('vi-VN')} → {t.end_odo?.toLocaleString('vi-VN') ?? '—'}</td>
                    <td className="num">{t.status === 'on_duty' ? <><span className="chip on_duty">Đang chạy</span>{Date.now() - Date.parse(t.start_time) > 12 * 3600_000 && <><br /><small className="error">⏰ Quá 12 giờ chưa trả xe</small></>}</> : `${t.km_driven?.toLocaleString('vi-VN') ?? '—'} km`}</td>
                    <td className={`num${high ? ' error' : ''}`}>{t.energy_rate != null ? `${t.energy_rate} ${unit}/100km${high ? ' ⚠️' : ''}` : '—'}</td>
                    <td>{t.closed_by && <><span className="chip">Quản lý đóng ca</span><br /></>}{t.has_damage ? <span className="chip maintenance">Có sự cố</span> : t.status === 'completed' ? '✓ Nguyên vẹn' : '—'}</td>
                    <td><button className="btn ghost" onClick={() => setOpen(open === t.id ? '' : t.id)}>{open === t.id ? 'Đóng' : 'Chi tiết'}</button></td>
                  </tr>
                  {open === t.id && (
                    <tr><td colSpan={8}>
                      {t.pre_notes && <p><b>Ghi chú nhận xe:</b> {t.pre_notes}</p>}
                      {t.post_notes && <p><b>Ghi chú cuối ca:</b> {t.post_notes}</p>}
                      {t.damage_notes && <p className="error"><b>Sự cố cuối ca:</b> {t.damage_notes}</p>}
                      <h4>Ảnh đầu ca</h4><SignedPhotos photos={t.photos_start} labels={START_LABELS} />
                      <h4>Ảnh cuối ca</h4><SignedPhotos photos={t.photos_end} labels={TRIP_LABELS} />
                    </td></tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
        {loading && <Skeleton rows={3} />}
        {!loading && list.length === 0 && <Empty>Không có ca nào khớp bộ lọc. Hãy đổi khoảng ngày hoặc bộ lọc, hoặc bấm ↺ Đặt lại bộ lọc.</Empty>}
      </div>
      <Pager page={page} size={PAGE} total={list.length} onPage={setPage} unit="ca" />
    </div>
  );
}
