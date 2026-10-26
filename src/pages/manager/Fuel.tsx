import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Lookups } from '../../lib/useLookups';
import { useVehicleFilter } from '../../components/VehicleFilter';
import SignedPhotos from '../../components/SignedPhotos';
import { refuelSlots } from '../../lib/types';
import { downloadCsv, downloadXlsx, type Cell } from '../../lib/excel';
import { dayAfter, dayStart, fetchAll, ymd } from '../../lib/dates';

interface Row {
  id: string; trip_id: string; driver_id: string; created_at: string; energy_type: 'fuel' | 'electric';
  fuel_type: string | null; odo_at_refuel: number; quantity: number; unit_price: number; total_amount: number;
  station: string | null; photo_pump: string | null; photo_receipt: string | null; photos: Record<string, string> | null;
  battery_before: number | null; battery_after: number | null; charge_minutes: number | null;
  status: 'pending' | 'approved' | 'rejected'; manager_note: string | null;
}
const money = (n: number) => Math.round(n).toLocaleString('vi-VN') + ' đ';
const STATUS = { pending: '⏳ Chờ duyệt', approved: '✓ Đã duyệt', rejected: '❌ Từ chối' } as const;

export default function Fuel({ lk, onChanged }: { lk: Lookups; onChanged: () => void }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [tripVehicle, setTripVehicle] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [exFrom, setExFrom] = useState(ymd(new Date(Date.now() - 29 * 86400_000)));
  const [exTo, setExTo] = useState(ymd(new Date()));
  const [exporting, setExporting] = useState(false);
  const vf = useVehicleFilter(lk, { statuses: (Object.keys(STATUS) as (keyof typeof STATUS)[]).map(k => ({ value: k, label: STATUS[k] })), defaultStatuses: ['pending'] });

  const load = useCallback(async () => {
    const { data: r } = await supabase.from('refuels').select('*').order('created_at', { ascending: false }).limit(200);
    const list = (r as Row[]) ?? [];
    setRows(list);
    // Chỉ tra cứu đúng các ca có phiếu (chia nhóm 100 để URL không quá dài)
    const ids = [...new Set(list.map(x => x.trip_id))];
    const map: Record<string, string> = {};
    for (let i = 0; i < ids.length; i += 100) {
      const { data: t } = await supabase.from('trips').select('id, vehicle_id').in('id', ids.slice(i, i + 100));
      (t ?? []).forEach(x => { map[x.id] = x.vehicle_id; });
    }
    setTripVehicle(map);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function decide(id: string, status: 'approved' | 'rejected') {
    setError('');
    const note = notes[id]?.trim();
    if (status === 'rejected' && !note) { setError('Nhập lý do khi từ chối'); return; }
    const { data, error: e } = await supabase.from('refuels').update({ status, manager_note: note || null }).eq('id', id).select();
    if (e || !data?.length) { setError(e?.message ?? 'Không cập nhật được phiếu'); return; }
    await load(); onChanged();
  }

  // Xuất các lượt sạc điện trong khoảng ngày (tải riêng, không bị giới hạn 200 phiếu của danh sách); áp dụng bộ lọc loại xe / biển số / tài xế
  async function exportCharges(kind: 'xlsx' | 'csv') {
    setExporting(true); setError('');
    try {
      const all = await fetchAll<Row>((a, b) => supabase.from('refuels').select('*').eq('energy_type', 'electric').neq('status', 'rejected')
        .gte('created_at', dayStart(exFrom)).lt('created_at', dayAfter(exTo)).order('created_at').range(a, b));
      const ids = [...new Set(all.map(x => x.trip_id))];
      const tv: Record<string, string> = {};
      for (let i = 0; i < ids.length; i += 100) {
        const { data: t } = await supabase.from('trips').select('id, vehicle_id').in('id', ids.slice(i, i + 100));
        (t ?? []).forEach(x => { tv[x.id] = x.vehicle_id; });
      }
      const data = all.filter(r => vf.match(tv[r.trip_id], r.driver_id));
      const out: Cell[][] = [['Ngày/giờ', 'Biển số xe', 'Tên tài xế', 'ODO hiện tại', '% pin trước khi sạc', '% pin sau khi sạc', 'Trạm sạc']];
      data.forEach(r => out.push([
        new Date(r.created_at).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }), lk.plate(tv[r.trip_id]), lk.person(r.driver_id),
        r.odo_at_refuel, r.battery_before, r.battery_after, r.station ?? '',
      ]));
      if (!data.length) { setError('Không có lượt sạc điện nào trong khoảng ngày và bộ lọc đã chọn'); return; }
      const name = `luot-sac-dien_${exFrom}_${exTo}`;
      if (kind === 'csv') downloadCsv(`${name}.csv`, out);
      else await downloadXlsx(`${name}.xlsx`, [{ name: 'Lượt sạc điện', rows: out, widths: [18, 13, 22, 13, 18, 18, 24] }]);
    } catch (e) { setError((e as Error).message); }
    setExporting(false);
  }

  const list = rows.filter(r => vf.match(tripVehicle[r.trip_id], r.driver_id, r.status));
  return (
    <div className="stack">
      {vf.ui}
      <div className="row" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label className="stack" style={{ fontSize: 12 }}>Xuất sạc điện từ<input type="date" value={exFrom} max={exTo} onChange={e => setExFrom(e.target.value)} /></label>
        <label className="stack" style={{ fontSize: 12 }}>đến<input type="date" value={exTo} min={exFrom} onChange={e => setExTo(e.target.value)} /></label>
        <button className="btn" disabled={exporting || !exFrom || !exTo || exFrom > exTo} onClick={() => exportCharges('xlsx')}>{exporting ? 'Đang xuất…' : '⬇️ Excel lượt sạc điện'}</button>
        <button className="btn ghost" disabled={exporting || !exFrom || !exTo || exFrom > exTo} onClick={() => exportCharges('csv')}>⬇️ CSV</button>
      </div>
      <p className="muted" style={{ margin: 0 }}>Hiển thị <b>{list.length}</b> / {rows.length} phiếu</p>
      {error && <p className="error">{error}</p>}
      {list.map(r => {
        const v = lk.vehicle(tripVehicle[r.trip_id]);
        const unit = r.energy_type === 'electric' ? 'kWh' : 'L';
        const over = v != null && r.quantity > v.capacity;
        return (
          <div className="card stack" key={r.id}>
            <div className="row between">
              <b>{r.energy_type === 'electric' ? '⚡' : '⛽'} {v?.plate ?? '—'} · {lk.person(r.driver_id)}</b>
              <span className="chip">{STATUS[r.status]}</span>
            </div>
            <p>
              {r.energy_type === 'electric' && r.battery_before != null ? (
                <>Pin <b>{r.battery_before}% → {r.battery_after}%</b> · <b>{r.quantity} kWh</b> · sạc <b>{r.charge_minutes} phút</b> · thành tiền <b>{money(r.total_amount)}</b></>
              ) : (
                <><b>{r.quantity} {unit}</b> × {r.unit_price.toLocaleString('vi-VN')} đ = <b>{money(r.total_amount)}</b></>
              )}
              {over && <span className="error"> ⚠️ Vượt dung tích bình/pin ({v!.capacity} {unit})</span>}
            </p>
            <p className="muted">{new Date(r.created_at).toLocaleString('vi-VN')} · ODO {r.odo_at_refuel.toLocaleString()} km · {r.station || 'Chưa ghi trạm'} · {r.fuel_type}</p>
            <SignedPhotos
              photos={r.photos ?? { pump: r.photo_pump ?? '', receipt: r.photo_receipt ?? '' }}
              labels={Object.fromEntries(refuelSlots(r.energy_type))} />
            {r.status === 'pending' ? (
              <div className="row" style={{ flexWrap: 'wrap' }}>
                <input placeholder="Ghi chú (bắt buộc nếu từ chối)" value={notes[r.id] ?? ''} onChange={e => setNotes({ ...notes, [r.id]: e.target.value })} style={{ flex: 1, minWidth: 200 }} />
                <button className="btn" onClick={() => decide(r.id, 'approved')}>✓ Duyệt</button>
                <button className="btn ghost" onClick={() => decide(r.id, 'rejected')}>Từ chối</button>
              </div>
            ) : r.manager_note && <p className="muted">Ghi chú: {r.manager_note}</p>}
          </div>
        );
      })}
      {list.length === 0 && <p className="muted">Không có phiếu nào</p>}
    </div>
  );
}
