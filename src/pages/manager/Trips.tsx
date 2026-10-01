import { Fragment, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Lookups } from '../../lib/useLookups';
import SignedPhotos, { TRIP_LABELS } from '../../components/SignedPhotos';
import type { PhotoMap } from '../../lib/storage';

interface TripRow {
  id: string; vehicle_id: string; driver_id: string; status: 'on_duty' | 'completed';
  start_time: string; end_time: string | null; start_odo: number; end_odo: number | null;
  start_level: number; end_level: number | null; km_driven: number | null;
  energy_consumed: number | null; energy_rate: number | null;
  pre_notes: string | null; has_damage: boolean; damage_notes: string | null;
  photos_start: PhotoMap | null; photos_end: PhotoMap | null;
}
const fmt = (s: string) => new Date(s).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });

export default function Trips({ lk }: { lk: Lookups }) {
  const [rows, setRows] = useState<TripRow[]>([]);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed' | 'issue'>('all');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState('');

  useEffect(() => {
    supabase.from('trips').select('*').order('start_time', { ascending: false }).limit(200)
      .then(({ data }) => setRows((data as TripRow[]) ?? []));
  }, []);

  const list = rows.filter(t =>
    (filter === 'all' || (filter === 'active' && t.status === 'on_duty') || (filter === 'completed' && t.status === 'completed') || (filter === 'issue' && t.has_damage)) &&
    (!q || `${lk.plate(t.vehicle_id)} ${lk.person(t.driver_id)}`.toLowerCase().includes(q.toLowerCase())));

  return (
    <div className="card">
      <div className="row" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
        <input placeholder="Tìm biển số / tài xế" value={q} onChange={e => setQ(e.target.value)} style={{ flex: 1, minWidth: 180 }} />
        <select value={filter} onChange={e => setFilter(e.target.value as typeof filter)}>
          <option value="all">Tất cả</option><option value="active">Đang chạy</option>
          <option value="completed">Đã hoàn tất</option><option value="issue">Có sự cố</option>
        </select>
      </div>
      <div className="scroll">
        <table>
          <thead><tr><th>Thời gian</th><th>Xe</th><th>Tài xế</th><th>ODO</th><th>Quãng đường</th><th>Tiêu hao</th><th>Tình trạng</th><th></th></tr></thead>
          <tbody>
            {list.map(t => {
              const v = lk.vehicle(t.vehicle_id);
              const unit = v?.energy_type === 'electric' ? 'kWh' : 'L';
              const high = t.energy_rate != null && v != null && t.energy_rate > v.std_rate * 1.15;
              return (
                <Fragment key={t.id}>
                  <tr>
                    <td>{fmt(t.start_time)}{t.end_time ? ` → ${fmt(t.end_time)}` : ''}</td>
                    <td>{lk.plate(t.vehicle_id)}</td><td>{lk.person(t.driver_id)}</td>
                    <td>{t.start_odo.toLocaleString()} → {t.end_odo?.toLocaleString() ?? '…'}</td>
                    <td>{t.status === 'on_duty' ? <span className="chip on_duty">Đang chạy</span> : `${t.km_driven?.toLocaleString()} km`}</td>
                    <td className={high ? 'error' : ''}>{t.energy_rate != null ? `${t.energy_rate} ${unit}/100km${high ? ' ⚠️ vượt định mức' : ''}` : '—'}</td>
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
            {list.length === 0 && <tr><td colSpan={8} className="muted">Chưa có ca nào</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
