import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { uploadPhoto } from '../../lib/storage';
import { energyLabels, type Refuel as RefuelRow, type Trip, type Vehicle } from '../../lib/types';
import { useDraft } from '../../lib/draft';
import PhotoInput from '../../components/PhotoInput';

const STATUS = { pending: '⏳ Chờ duyệt', approved: '✓ Đã duyệt', rejected: '❌ Từ chối' } as const;
const money = (n: number) => Math.round(n).toLocaleString('vi-VN') + ' đ';

export default function Refuel({ userId, trip, vehicle, onBack }: { userId: string; trip: Trip; vehicle: Vehicle; onBack: () => void }) {
  const L = energyLabels(vehicle.energy_type);
  const [list, setList] = useState<RefuelRow[]>([]);
  const [odo, setOdo] = useState(String(trip.start_odo));
  const [qty, setQty] = useState('');
  const [price, setPrice] = useState(vehicle.energy_type === 'electric' ? '4000' : '21500');
  const [station, setStation] = useState('');
  const [pump, setPump] = useState<Blob | null>(null);
  const [receipt, setReceipt] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const draft = useDraft(`refuel:${trip.id}`, { odo, qty, price, station, pump, receipt }, d => {
    if (d.odo !== undefined) setOdo(d.odo);
    if (d.qty !== undefined) setQty(d.qty);
    if (d.price !== undefined) setPrice(d.price);
    if (d.station !== undefined) setStation(d.station);
    if (d.pump !== undefined) setPump(d.pump);
    if (d.receipt !== undefined) setReceipt(d.receipt);
  });

  const load = () => supabase.from('refuels').select('*').eq('trip_id', trip.id).order('created_at', { ascending: false })
    .then(({ data }) => setList((data as RefuelRow[]) ?? []));
  useEffect(() => { load(); }, []);

  const total = (Number(qty) || 0) * (Number(price) || 0);
  const valid = Number(qty) > 0 && Number(odo) >= trip.start_odo && pump && receipt;

  async function submit() {
    setBusy(true); setError('');
    try {
      const photo_pump = await uploadPhoto(userId, 'refuel', pump!);
      const photo_receipt = await uploadPhoto(userId, 'refuel', receipt!);
      const { error: e } = await supabase.from('refuels').insert({
        trip_id: trip.id, driver_id: userId, energy_type: vehicle.energy_type, fuel_type: vehicle.fuel_type,
        odo_at_refuel: Number(odo), quantity: Number(qty), unit_price: Number(price),
        station: station || null, photo_pump, photo_receipt,
      });
      if (e) throw e;
      setQty(''); setPump(null); setReceipt(null); setStation('');
      await draft.clear();
      await load();
    } catch (e) { setError((e as Error).message); }
    setBusy(false);
  }

  return (
    <div className="card stack">
      <button className="btn ghost" onClick={onBack}>← Quay lại</button>
      <h3>{vehicle.energy_type === 'electric' ? '⚡' : '⛽'} {L.fill} — {vehicle.plate}</h3>
      <label>ODO hiện tại (km)<input type="number" inputMode="numeric" value={odo} onChange={e => setOdo(e.target.value)} /></label>
      <label>Số {L.unit}<input type="number" inputMode="decimal" value={qty} onChange={e => setQty(e.target.value)} /></label>
      <label>Đơn giá (đ/{L.unit})<input type="number" inputMode="numeric" value={price} onChange={e => setPrice(e.target.value)} /></label>
      <p>Thành tiền: <b>{money(total)}</b></p>
      <input placeholder={L.station} value={station} onChange={e => setStation(e.target.value)} />
      <div className="photo-grid">
        <PhotoInput label={L.pump} value={pump} onChange={setPump} />
        <PhotoInput label="Hóa đơn / phiếu thu" value={receipt} onChange={setReceipt} />
      </div>
      {error && <p className="error">{error}</p>}
      <button className="btn" disabled={!valid || busy} onClick={submit}>{busy ? 'Đang gửi…' : 'Gửi phiếu chờ duyệt'}</button>

      <h3>Lịch sử trong ca ({list.length})</h3>
      {list.length === 0 && <p className="muted">Chưa có lần nào</p>}
      {list.map(r => (
        <div key={r.id} className="row between">
          <span>{r.energy_type === 'electric' ? '⚡' : '⛽'} {r.quantity} {energyLabels(r.energy_type).unit} · {money(r.total_amount)}</span>
          <span className="chip">{STATUS[r.status]}</span>
        </div>
      ))}
    </div>
  );
}
