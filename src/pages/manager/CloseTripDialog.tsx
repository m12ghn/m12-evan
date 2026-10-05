import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { onlyDigits, clampPercent } from '../../lib/numbers';
import { VEHICLE_STATUS, type Vehicle } from '../../lib/types';

export interface OpenTrip { id: string; vehicle_id: string; driver_id: string; start_time: string; start_odo: number; start_level: number }

const REASONS = ['Tài xế quên trả xe', 'Tài xế nghỉ giữa ca / không liên lạc được', 'Xe hỏng hoặc gặp sự cố trên đường', 'Nhập nhầm ca'];
const AFTER = ['ready', 'maintenance', 'repair', 'inactive'] as const;

/** Quản lý đóng ca thay tài xế. Mọi kiểm tra và cập nhật chạy trọn gói trong database (manager_close_trip). */
export default function CloseTripDialog({ trip, vehicle, driverName, onClose, onDone }:
  { trip: OpenTrip; vehicle: Vehicle; driverName: string; onClose: () => void; onDone: () => void }) {
  const electric = vehicle.energy_type === 'electric';
  const [odo, setOdo] = useState(String(trip.start_odo));
  const [level, setLevel] = useState(String(trip.start_level));
  const [after, setAfter] = useState<(typeof AFTER)[number]>('ready');
  const [reason, setReason] = useState(REASONS[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const odoOk = odo !== '' && Number(odo) >= trip.start_odo;
  const valid = odoOk && level !== '' && reason.trim() !== '';
  const hours = Math.floor((Date.now() - Date.parse(trip.start_time)) / 3600_000);

  async function submit() {
    setBusy(true); setError('');
    const { error: e } = await supabase.rpc('manager_close_trip', {
      p_trip: trip.id, p_end_odo: Number(odo), p_end_level: Number(level), p_vehicle_status: after, p_reason: reason.trim(),
    });
    setBusy(false);
    if (e) { setError(e.message); return; }
    onDone();
  }

  return (
    <div className="sheet-backdrop modal" onClick={onClose}>
      <div className="sheet modal-box" onClick={e => e.stopPropagation()}>
        <h3>⏹ Kết thúc ca — {vehicle.plate}</h3>
        <p className="muted">
          Tài xế <b>{driverName}</b> nhận xe lúc {new Date(trip.start_time).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}
          {hours >= 1 && ` (đã ${hours} giờ)`}. ODO đầu ca {trip.start_odo.toLocaleString()} km, {electric ? 'pin' : 'nhiên liệu'} {trip.start_level}%.
        </p>
        <div className="stack">
          <label>ODO cuối ca (km) — không nhỏ hơn {trip.start_odo.toLocaleString()}
            <input inputMode="numeric" pattern="[0-9]*" value={odo} onChange={e => setOdo(onlyDigits(e.target.value))} /></label>
          {odo !== '' && !odoOk && <p className="error">ODO cuối ca không được nhỏ hơn ODO đầu ca</p>}
          <label>{electric ? 'Mức pin' : 'Mức nhiên liệu'} lúc kết thúc (%)
            <input inputMode="numeric" pattern="[0-9]*" value={level} onChange={e => setLevel(clampPercent(onlyDigits(e.target.value)))} /></label>
          <p className="muted">Nếu không biết số thực tế, giữ nguyên số đầu ca (quãng đường và tiêu hao của ca sẽ ghi 0).</p>
          <label>Tình trạng xe sau khi đóng ca
            <select value={after} onChange={e => setAfter(e.target.value as typeof after)}>
              {AFTER.map(k => <option key={k} value={k}>{VEHICLE_STATUS[k]}</option>)}
            </select></label>
          <label>Lý do đóng ca (bắt buộc)
            <select value={REASONS.includes(reason) ? reason : ''} onChange={e => setReason(e.target.value)}>
              {REASONS.map(r => <option key={r}>{r}</option>)}<option value="">Lý do khác…</option>
            </select></label>
          {!REASONS.includes(reason) && <textarea rows={2} placeholder="Nhập lý do" value={reason} onChange={e => setReason(e.target.value)} />}
        </div>
        <p className="muted">Ca được ghi nhận là do quản lý đóng (kèm lý do), xe được cập nhật và sẽ có tin "kết thúc ca" trên Telegram. Thao tác này không hoàn tác được.</p>
        {error && <p className="error">{error}</p>}
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn ghost" onClick={onClose} disabled={busy}>Hủy</button>
          <button className="btn" onClick={submit} disabled={!valid || busy}>{busy ? 'Đang đóng ca…' : 'Xác nhận kết thúc ca'}</button>
        </div>
      </div>
    </div>
  );
}
