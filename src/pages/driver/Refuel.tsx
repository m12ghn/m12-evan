import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { uploadPhotos } from '../../lib/storage';
import { energyLabels, refuelSlots, type Refuel as RefuelRow, type Trip, type Vehicle } from '../../lib/types';
import { useDraft } from '../../lib/draft';
import { notifyTelegram } from '../../lib/notify';
import { clampPercent, cleanDecimal, fmtThousands, onlyDigits } from '../../lib/numbers';
import PhotoInput from '../../components/PhotoInput';
import { kwhFromPercent, M12_FULL_KWH } from '../../lib/aiFlags';

const STATUS = { pending: '⏳ Chờ duyệt', approved: '✓ Đã duyệt', rejected: '❌ Từ chối' } as const;
const money = (n: number) => Math.round(n).toLocaleString('vi-VN') + ' đ';

export default function Refuel({ userId, trip, vehicle, onBack }: { userId: string; trip: Trip; vehicle: Vehicle; onBack: () => void }) {
  const electric = vehicle.energy_type === 'electric';
  const L = energyLabels(vehicle.energy_type);
  const slots = refuelSlots(vehicle.energy_type);
  const [list, setList] = useState<RefuelRow[]>([]);
  // dùng chung
  const [place, setPlace] = useState<'' | 'm12' | 'external'>('');   // nơi sạc (xe điện): bắt buộc chọn
  const [odo, setOdo] = useState(String(trip.start_odo));
  const [photos, setPhotos] = useState<Record<string, Blob>>({});
  // xăng/dầu
  const [qty, setQty] = useState('');
  const [price, setPrice] = useState('21500');
  const [station, setStation] = useState('');
  // xe điện
  const [batBefore, setBatBefore] = useState('');
  const [batAfter, setBatAfter] = useState('');
  const [kwh, setKwh] = useState('');
  const [minutes, setMinutes] = useState('');
  const [amount, setAmount] = useState(''); // chỉ chứa chữ số
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const rid = useRef(crypto.randomUUID()); // id cố định cho mỗi lần gửi → gửi lại không bị tạo trùng phiếu
  const [error, setError] = useState('');

  const draft = useDraft(`refuel:${trip.id}`, { place, odo, photos, qty, price, station, batBefore, batAfter, kwh, minutes, amount }, d => {
    if (d.place !== undefined) setPlace(d.place);
    if (d.odo !== undefined) setOdo(d.odo);
    if (d.photos) setPhotos(d.photos);
    if (d.qty !== undefined) setQty(d.qty);
    if (d.price !== undefined) setPrice(d.price);
    if (d.station !== undefined) setStation(d.station);
    if (d.batBefore !== undefined) setBatBefore(d.batBefore);
    if (d.batAfter !== undefined) setBatAfter(d.batAfter);
    if (d.kwh !== undefined) setKwh(d.kwh);
    if (d.minutes !== undefined) setMinutes(d.minutes);
    if (d.amount !== undefined) setAmount(d.amount);
  });

  const load = () => supabase.from('refuels').select('*').eq('trip_id', trip.id).order('created_at', { ascending: false })
    .then(({ data }) => setList((data as RefuelRow[]) ?? []));
  useEffect(() => { load(); }, []);

  const odoOk = odo !== '' && Number(odo) >= trip.start_odo;
  const isM12 = electric && place === 'm12';
  const kwhM12 = isM12 ? kwhFromPercent(Number(batBefore), Number(batAfter)) : null;   // 100% = 16,7 kWh
  // Sạc tại M12: ảnh trước/sau bắt buộc, ảnh trụ sạc/hóa đơn không bắt buộc; sạc ngoài: đủ 3 ảnh (có hóa đơn để AI đọc)
  const required = isM12 ? slots.filter(([k]) => k !== 'receipt') : slots;
  const photosOk = required.every(([k]) => photos[k]);
  const fuelTotal = (Number(qty) || 0) * (Number(price) || 0);
  const batOrderBad = batBefore !== '' && batAfter !== '' && Number(batAfter) < Number(batBefore);
  const valid = electric
    ? place !== '' && odoOk && batBefore !== '' && batAfter !== '' && !batOrderBad && Number(minutes) > 0 && photosOk
      && (isM12 ? (kwhM12 ?? 0) > 0 : Number(kwh) > 0 && Number(amount) > 0)
    : odoOk && Number(qty) > 0 && photosOk;

  async function submit() {
    setBusy(true); setError('');
    try {
      const paths = await uploadPhotos(userId, 'refuel', slots.filter(([k]) => photos[k]).map(([k]) => [k, photos[k]] as [string, Blob]), (d, t) => setProgress(`Đang tải ảnh ${d}/${t}…`));
      setProgress('Đang gửi…');
      const base = {
        id: rid.current, trip_id: trip.id, driver_id: userId, energy_type: vehicle.energy_type, fuel_type: vehicle.fuel_type,
        odo_at_refuel: Number(odo), photos: paths,
        photo_pump: paths.pump ?? null, photo_receipt: paths.receipt ?? null, // giữ tương thích dữ liệu cũ
      };
      const row: Record<string, unknown> = electric
        ? {
            ...base, charge_place: place,
            // Sạc tại M12: kWh tính theo % pin, không có tiền; sạc ngoài: nhập kWh + thành tiền theo hóa đơn
            quantity: isM12 ? kwhM12 : Number(kwh), total_amount: isM12 ? 0 : Number(amount), unit_price: isM12 ? 0 : Math.round(Number(amount) / Number(kwh)),
            battery_before: Number(batBefore), battery_after: Number(batAfter), charge_minutes: Number(minutes),
          }
        : { ...base, quantity: Number(qty), unit_price: Number(price), total_amount: Math.round(fuelTotal), station: station || null };
      const { error: e } = await supabase.from('refuels').insert(row);
      if (e && e.code !== '23505') throw e; // 23505 = phiếu này đã được ghi từ lần gửi trước
      notifyTelegram('refuel', rid.current);
      rid.current = crypto.randomUUID();
      setQty(''); setStation(''); setPlace(''); setBatBefore(''); setBatAfter(''); setKwh(''); setMinutes(''); setAmount(''); setPhotos({});
      await draft.clear();
      await load();
    } catch (e) { setError((e as Error).message); }
    setBusy(false);
  }

  return (
    <div className="card stack">
      <button className="btn ghost" onClick={onBack}>← Quay lại</button>
      <h3>{electric ? '⚡' : '⛽'} {L.fill} — {vehicle.plate}</h3>

      {electric ? (
        <>
          <div className="stack">
            <b>NƠI SẠC (bắt buộc chọn)</b>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <button type="button" className={`btn ${place === 'm12' ? '' : 'ghost'}`} onClick={() => setPlace('m12')}>🏭 Sạc tại kho M12</button>
              <button type="button" className={`btn ${place === 'external' ? '' : 'ghost'}`} onClick={() => setPlace('external')}>🔌 Sạc ngoài</button>
            </div>
            {place === '' && <p className="muted">Chọn nơi sạc để tiếp tục.</p>}
            {isM12 && <p className="muted">Sạc tại M12: nhập % pin trước/sau, hệ thống tự tính kWh (100% = {M12_FULL_KWH} kWh). Không cần nhập thành tiền.</p>}
            {place === 'external' && <p className="muted">Sạc ngoài: nhập kWh, thành tiền và chụp hóa đơn / lịch sử sạc để hệ thống đọc.</p>}
          </div>
          {place !== '' && <>
          <label>ĐỒNG HỒ ODO (km)<input inputMode="numeric" pattern="[0-9]*" value={odo} onChange={e => setOdo(onlyDigits(e.target.value))} /></label>
          {odo !== '' && !odoOk && <p className="error">ODO không được nhỏ hơn ODO đầu ca ({trip.start_odo.toLocaleString()} km)</p>}
          <label>PIN TRƯỚC KHI SẠC (%)<input inputMode="numeric" pattern="[0-9]*" placeholder="0 – 100" value={batBefore} onChange={e => setBatBefore(clampPercent(onlyDigits(e.target.value)))} /></label>
          <label>PIN SAU KHI SẠC (%)<input inputMode="numeric" pattern="[0-9]*" placeholder="0 – 100" value={batAfter} onChange={e => setBatAfter(clampPercent(onlyDigits(e.target.value)))} /></label>
          {batOrderBad && <p className="error">Pin sau khi sạc phải lớn hơn hoặc bằng pin trước khi sạc</p>}
          {isM12
            ? <p>KWH đã sạc (tự tính): <b>{kwhM12 != null ? `${kwhM12} kWh` : '—'}</b></p>
            : <label>KWH (ĐIỆN NĂNG) (kWh)<input inputMode="decimal" placeholder="ví dụ 12.5" value={kwh} onChange={e => setKwh(cleanDecimal(e.target.value))} /></label>}
          <label>THỜI GIAN SẠC (phút)<input inputMode="numeric" pattern="[0-9]*" value={minutes} onChange={e => setMinutes(onlyDigits(e.target.value))} /></label>
          {!isM12 && <label>THÀNH TIỀN (VND)<input inputMode="numeric" pattern="[0-9]*" placeholder="ví dụ 214,000" value={fmtThousands(amount)} onChange={e => setAmount(onlyDigits(e.target.value))} /></label>}
          </>}
        </>
      ) : (
        <>
          <label>ODO hiện tại (km)<input inputMode="numeric" pattern="[0-9]*" value={odo} onChange={e => setOdo(onlyDigits(e.target.value))} /></label>
          {odo !== '' && !odoOk && <p className="error">ODO không được nhỏ hơn ODO đầu ca ({trip.start_odo.toLocaleString()} km)</p>}
          <label>Số {L.unit}<input inputMode="decimal" value={qty} onChange={e => setQty(cleanDecimal(e.target.value))} /></label>
          <label>Đơn giá (đ/{L.unit})<input inputMode="numeric" pattern="[0-9]*" value={price} onChange={e => setPrice(onlyDigits(e.target.value))} /></label>
          <p>Thành tiền: <b>{money(fuelTotal)}</b></p>
          <input placeholder={L.station} value={station} onChange={e => setStation(e.target.value)} />
        </>
      )}

      {(!electric || place !== '') && <>
      <p className="muted">Ảnh bắt buộc ({required.length}): có thể chụp trực tiếp hoặc chọn ảnh có sẵn trong máy (ví dụ ảnh chụp màn hình).</p>
      <div className="photo-grid">
        {slots.map(([k, label]) => (
          <PhotoInput key={k} label={isM12 && k === 'receipt' ? `${label} (không bắt buộc)` : label} allowGallery value={photos[k] ?? null} onChange={b => setPhotos({ ...photos, [k]: b })} />
        ))}
      </div>
      </>}
      {error && <p className="error">{error}</p>}
      <button className="btn" disabled={!valid || busy} onClick={submit}>{busy ? progress || 'Đang gửi…' : 'Gửi phiếu chờ duyệt'}</button>

      <h3>Lịch sử trong ca ({list.length})</h3>
      {list.length === 0 && <p className="muted">Chưa có lần nào</p>}
      {list.map(r => (
        <div key={r.id} className="row between">
          <span>
            {r.energy_type === 'electric' ? '⚡' : '⛽'} {r.quantity} {energyLabels(r.energy_type).unit}
            {r.battery_before != null && ` · pin ${r.battery_before}→${r.battery_after}%`}
            {r.charge_minutes != null && ` · ${r.charge_minutes} phút`} · {money(r.total_amount)}
          </span>
          <span className="chip">{STATUS[r.status]}</span>
        </div>
      ))}
    </div>
  );
}
