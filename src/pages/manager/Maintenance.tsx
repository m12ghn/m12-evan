import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { uploadPhotos } from '../../lib/storage';
import { useAuth } from '../../lib/auth';
import { downloadXlsx, type Cell } from '../../lib/excel';
import { dayAfter, dayStart, fetchAll, ymd } from '../../lib/dates';
import { VEHICLE_STATUS, type VehicleStatus } from '../../lib/types';
import type { Lookups } from '../../lib/useLookups';
import SignedPhotos from '../../components/SignedPhotos';
import PhotoList from '../../components/PhotoList';
import { useVehicleFilter } from '../../components/VehicleFilter';
import { Empty, Pager, Skeleton } from '../../components/ui';
import { buildEpisodes, daysBetween, type Episode } from '../../lib/episodes';

type Kind = 'service' | 'repair' | 'accident_repair' | 'inspection' | 'other' | 'status';
interface Row {
  id: string; vehicle_id: string; at: string; source: 'manual' | 'auto' | 'audit'; kind: Kind;
  status_from: string | null; status_to: string | null; description: string | null; performed_on: string | null;
  odo: number | null; garage: string | null; cost: number; photos: string[]; created_by_name: string | null;
}
const KIND: Record<Kind, string> = {
  service: 'Bảo dưỡng định kỳ', repair: 'Sửa chữa', accident_repair: 'Sửa chữa tai nạn', inspection: 'Kiểm định / đăng kiểm', other: 'Khác', status: 'Đổi trạng thái xe',
};
const SOURCE = { manual: '', auto: 'Tự động', audit: 'Từ nhật ký cũ' } as const;
const stText = (s: string | null) => (s ? VEHICLE_STATUS[s as VehicleStatus] ?? s : '—');
const fmt = (s: string) => new Date(s).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
const day = (s: string | null) => (s ? s.split('-').reverse().join('/') : '—');
const money = (n: number) => (n > 0 ? `${Math.round(n).toLocaleString('vi-VN')} đ` : '—');
const PAGE = 50;
const EP_LABEL = { maintenance: 'BTBD (bảo trì bảo dưỡng)', repair: 'Tai nạn (sửa chữa)' } as const;
const dayTime = (s: string | null) => (s ? new Date(s).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : null);
const EMPTY_FORM = { vehicle: '', kind: 'service' as Exclude<Kind, 'status'>, description: '', performed_on: ymd(new Date()), odo: '', garage: '', cost: '', status: '' };

export default function Maintenance({ lk }: { lk: Lookups }) {
  const { session } = useAuth();
  const uid = session?.user.id ?? '';
  const today = new Date();
  const [from, setFrom] = useState(ymd(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 89)));
  const [to, setTo] = useState(ymd(today));
  const [rows, setRows] = useState<Row[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState<'episodes' | 'log'>('episodes');
  const [epKind, setEpKind] = useState('');        // '', maintenance, repair
  const [epState, setEpState] = useState('');      // '', open, done
  const [open, setOpen] = useState('');
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState(EMPTY_FORM);
  const [photos, setPhotos] = useState<Blob[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const vf = useVehicleFilter(lk, {
    statuses: (Object.keys(KIND) as Kind[]).map(k => ({ value: k, label: KIND[k] })), statusLabel: 'Loại', hideDriver: true, hideStatus: view === 'episodes',
  });

  const load = useCallback(async () => {
    setLoaded(false);
    // Tải toàn bộ nhật ký (ít dòng) để ghép đúng các đợt bắt đầu → kết thúc; khoảng ngày chỉ dùng để lọc khi hiển thị
    const r = await fetchAll<Row>((a, b) => supabase.from('vehicle_maintenance').select('*').order('at', { ascending: false }).range(a, b));
    setRows(r); setLoaded(true);
  }, []);
  useEffect(() => { load(); }, [load]);

  const inRange = (iso: string) => iso >= dayStart(from) && iso < dayAfter(to);
  const list = rows.filter(r => inRange(r.at) && vf.match(r.vehicle_id, null, r.kind));
  // Các đợt: BTBD / Tai nạn, ngày bắt đầu → ngày kết thúc (chưa có ngày kết thúc = xe chưa xử lý xong)
  const currentStatus = useMemo(() => Object.fromEntries(lk.vehicles.map(v => [v.id, v.status])), [lk.vehicles]);
  const allEps = useMemo(() => buildEpisodes(rows, currentStatus), [rows, currentStatus]);
  const eps = allEps.filter(e => vf.match(e.vehicle_id, null, undefined, true)
    && (!epKind || e.kind === epKind) && (!epState || (epState === 'open') === e.open)
    // trong khoảng ngày: đợt giao với khoảng đã chọn; đợt chưa xong luôn hiện
    && (e.open || !e.start || !e.end || (e.start < dayAfter(to) && e.end >= dayStart(from))));
  const epPage = eps.slice((page - 1) * PAGE, page * PAGE);
  const epCost = eps.reduce((s, e) => s + e.cost, 0);
  const epOpen = eps.filter(e => e.open).length;
  useEffect(() => { setPage(1); }, [rows, vf.key, view, epKind, epState, from, to]);
  const pageRows = list.slice((page - 1) * PAGE, page * PAGE);
  const total = list.reduce((s, r) => s + Number(r.cost || 0), 0);
  const inShop = lk.vehicles.filter(v => v.status === 'maintenance' || v.status === 'repair');

  const pickVehicle = (id: string) => setF({ ...f, vehicle: id, odo: lk.vehicle(id) ? String(lk.vehicle(id)!.odo) : '' });

  async function save() {
    setBusy(true); setError(''); setMsg('');
    try {
      const up = await uploadPhotos(uid, 'maintenance', photos.map((b, i) => [i, b] as [number, Blob]));
      const { error: e } = await supabase.rpc('add_maintenance_log', {
        p_vehicle: f.vehicle, p_kind: f.kind, p_description: f.description, p_performed_on: f.performed_on || null,
        p_odo: f.odo === '' ? null : Number(f.odo), p_garage: f.garage || null, p_cost: f.cost === '' ? 0 : Number(f.cost),
        p_photos: photos.map((_, i) => up[i]), p_accident: null, p_vehicle_status: f.status || null,
      });
      if (e) throw e;
      setF(EMPTY_FORM); setPhotos([]); setAdding(false); setMsg('Đã ghi nhật ký bảo trì'); lk.reload(); await load();
    } catch (e) { setError((e as Error).message); }
    setBusy(false);
  }

  async function exportEpisodes() {
    const out: Cell[][] = [['Biển số', 'Loại xe', 'Nội dung', 'Ngày bắt đầu', 'Ngày kết thúc', 'Tình trạng', 'Số ngày', 'Chi phí (đ)', 'Chi tiết']];
    eps.forEach(e => out.push([
      lk.plate(e.vehicle_id), lk.vehicle(e.vehicle_id)?.type ?? '', EP_LABEL[e.kind], dayTime(e.start) ?? 'Chưa rõ', dayTime(e.end) ?? '',
      e.open ? 'Chưa xử lý xong' : 'Đã xử lý xong', daysBetween(e.start, e.end), Math.round(e.cost),
      e.items.map(it => `${day(it.performed_on)}: ${it.description}${it.garage ? ` (${it.garage})` : ''}${Number(it.cost) > 0 ? ` - ${money(Number(it.cost))}` : ''}`).join(' | '),
    ]));
    await downloadXlsx(`bao-tri-theo-dot_${from}_${to}.xlsx`, [{ name: 'Theo đợt', rows: out, widths: [13, 24, 26, 14, 14, 18, 10, 14, 80] }]);
  }

  async function exportXlsx() {
    const out: Cell[][] = [['Thời gian ghi', 'Ngày thực hiện', 'Biển số', 'Loại xe', 'Loại', 'Nội dung', 'Trạng thái trước', 'Trạng thái sau', 'ODO', 'Nơi thực hiện', 'Chi phí (đ)', 'Người ghi', 'Nguồn']];
    [...list].reverse().forEach(r => out.push([
      fmt(r.at), day(r.performed_on), lk.plate(r.vehicle_id), lk.vehicle(r.vehicle_id)?.type ?? '', KIND[r.kind], r.description ?? '',
      r.status_from ? stText(r.status_from) : '', r.status_to ? stText(r.status_to) : '', r.odo, r.garage ?? '', Math.round(Number(r.cost || 0)), r.created_by_name ?? '',
      r.source === 'manual' ? 'Quản lý ghi' : SOURCE[r.source],
    ]));
    await downloadXlsx(`nhat-ky-bao-tri_${from}_${to}.xlsx`, [{ name: 'Bảo trì', rows: out, widths: [18, 14, 13, 24, 22, 50, 20, 20, 10, 26, 14, 22, 14] }]);
  }

  return (
    <div className="stack">
      <div className="kpis">
        <div className="card"><b>{view === 'episodes' ? eps.length : list.length}</b><span>{view === 'episodes' ? 'Đợt BTBD / Tai nạn' : 'Dòng nhật ký trong kỳ'}</span></div>
        <div className="card"><b>{Math.round(view === 'episodes' ? epCost : total).toLocaleString('vi-VN')}</b><span>Tổng chi phí đã ghi (đ)</span></div>
        <div className={`card${inShop.length ? ' warn' : ''}`}><b>{inShop.length}</b><span>Xe chưa xử lý xong{inShop.length ? `: ${inShop.slice(0, 4).map(v => v.plate).join(', ')}${inShop.length > 4 ? '…' : ''}` : ''}</span></div>
      </div>

      <div className="card stack">
        <div className="row between" style={{ flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0 }}>Nhật ký bảo trì / bảo dưỡng / sửa chữa</h3>
          <button className="btn" onClick={() => { setAdding(!adding); setError(''); setMsg(''); }}>{adding ? 'Đóng' : '+ Ghi nhật ký bảo trì'}</button>
        </div>
        {msg && <p style={{ color: 'var(--success)' }}>{msg}</p>}
        {adding && (
          <div className="stack" style={{ background: 'var(--bg)', padding: 12, borderRadius: 12 }}>
            <div className="form-grid">
              <label>Xe<select value={f.vehicle} onChange={e => pickVehicle(e.target.value)}><option value="">— Chọn xe —</option>{lk.vehicles.map(v => <option key={v.id} value={v.id}>{v.plate} · {v.type}</option>)}</select></label>
              <label>Loại<select value={f.kind} onChange={e => setF({ ...f, kind: e.target.value as typeof f.kind })}>{(Object.keys(KIND) as Kind[]).filter(k => k !== 'status').map(k => <option key={k} value={k}>{KIND[k]}</option>)}</select></label>
              <label>Ngày thực hiện<input type="date" value={f.performed_on} onChange={e => setF({ ...f, performed_on: e.target.value })} /></label>
              <label>ODO (km)<input inputMode="numeric" value={f.odo} onChange={e => setF({ ...f, odo: e.target.value.replace(/\D/g, '') })} /></label>
              <label>Nơi thực hiện (garage / xưởng)<input value={f.garage} onChange={e => setF({ ...f, garage: e.target.value })} /></label>
              <label>Chi phí (đ)<input inputMode="numeric" value={f.cost ? Number(f.cost).toLocaleString('vi-VN') : ''} onChange={e => setF({ ...f, cost: e.target.value.replace(/\D/g, '') })} /></label>
              <label>Trạng thái xe sau khi ghi<select value={f.status} onChange={e => setF({ ...f, status: e.target.value })}>
                <option value="">Không đổi</option>{(['maintenance', 'repair', 'ready', 'inactive'] as const).map(k => <option key={k} value={k}>{VEHICLE_STATUS[k]}</option>)}</select></label>
            </div>
            <label className="stack">Nội dung bảo trì / sửa chữa (bắt buộc)<textarea rows={3} placeholder="vd. Thay dầu máy, kiểm tra phanh, thay má phanh trước…" value={f.description} onChange={e => setF({ ...f, description: e.target.value })} /></label>
            <PhotoList photos={photos} onChange={setPhotos} addLabel="Thêm ảnh (hóa đơn, hiện trạng…)" />
            {error && <p className="error">{error}</p>}
            <div className="row"><button className="btn" disabled={busy || !f.vehicle || !f.description.trim()} onClick={save}>{busy ? 'Đang lưu…' : 'Lưu nhật ký'}</button></div>
          </div>
        )}
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <button className={`btn ${view === 'episodes' ? '' : 'ghost'}`} onClick={() => setView('episodes')}>📅 Theo đợt (bắt đầu → kết thúc)</button>
          <button className={`btn ${view === 'log' ? '' : 'ghost'}`} onClick={() => setView('log')}>🧾 Nhật ký chi tiết</button>
        </div>
        <div className="filters">
          <label>Từ ngày<input type="date" value={from} max={to} onChange={e => setFrom(e.target.value)} /></label>
          <label>Đến ngày<input type="date" value={to} min={from} onChange={e => setTo(e.target.value)} /></label>
          {view === 'episodes' && <>
            <label>Nội dung<select value={epKind} onChange={e => setEpKind(e.target.value)}><option value="">Tất cả</option><option value="maintenance">BTBD (bảo trì bảo dưỡng)</option><option value="repair">Tai nạn (sửa chữa)</option></select></label>
            <label>Tình trạng<select value={epState} onChange={e => setEpState(e.target.value)}><option value="">Tất cả</option><option value="open">Chưa xử lý xong</option><option value="done">Đã xử lý xong</option></select></label>
          </>}
        </div>
        {vf.ui}
        <div className="row between" style={{ flexWrap: 'wrap' }}>
          <p className="muted" style={{ margin: 0 }}>{view === 'episodes'
            ? <>Hiển thị <b>{eps.length}</b> đợt · <b>{epOpen}</b> chưa xử lý xong (đợt chưa xong luôn hiện, bất kể khoảng ngày)</>
            : <>Hiển thị <b>{list.length}</b> / {rows.length} dòng trong khoảng ngày đã chọn</>}</p>
          <button className="btn ghost" disabled={view === 'episodes' ? !eps.length : !list.length} onClick={view === 'episodes' ? exportEpisodes : exportXlsx}>⬇️ Tải Excel ({view === 'episodes' ? eps.length : list.length} dòng)</button>
        </div>

        {view === 'episodes' && (
          <div className="scroll">
            <table>
              <thead><tr><th>Xe</th><th>Nội dung</th><th>Ngày bắt đầu</th><th>Ngày kết thúc</th><th className="num">Số ngày</th><th className="num">Chi phí</th><th>Chi tiết</th></tr></thead>
              <tbody>
                {epPage.map((e: Episode) => (
                  <Fragment key={e.key}>
                    <tr>
                      <td><b>{lk.plate(e.vehicle_id)}</b><br /><small className="muted">{lk.vehicle(e.vehicle_id)?.type}</small></td>
                      <td><span className={`chip ${e.kind === 'repair' ? 'repair' : 'maintenance'}`}>{EP_LABEL[e.kind]}</span></td>
                      <td>{e.start ? <>{dayTime(e.start)}<br /><small className="muted">{new Date(e.start).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</small></> : <span className="muted">Chưa rõ</span>}</td>
                      <td>{e.end ? <>{dayTime(e.end)}<br /><small className="muted">{new Date(e.end).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</small></> : <span className="chip on_duty" style={{ background: 'var(--warn-soft)', color: 'var(--warning)' }}>⏳ Chưa xử lý xong</span>}</td>
                      <td className="num">{daysBetween(e.start, e.end) ?? '—'}</td>
                      <td className="num">{money(e.cost)}</td>
                      <td>{e.items.length ? <button className="btn ghost" onClick={() => setOpen(open === e.key ? '' : e.key)}>{e.items.length} lần ghi</button> : <span className="muted">—</span>}</td>
                    </tr>
                    {open === e.key && (
                      <tr><td colSpan={7}>
                        <div className="stack">
                          {e.items.map(it => (
                            <div key={it.id} style={{ borderLeft: '3px solid var(--teal)', paddingLeft: 10 }}>
                              <small className="muted"><b>{day(it.performed_on)}</b> · {KIND[it.kind as Kind] ?? it.kind}{it.garage ? ` · ${it.garage}` : ''}{Number(it.cost) > 0 ? ` · ${money(Number(it.cost))}` : ''}</small>
                              <div style={{ whiteSpace: 'pre-wrap' }}>{it.description}</div>
                              {it.photos.length > 0 && <SignedPhotos photos={Object.fromEntries(it.photos.map((p, i) => [`p${i}`, p]))} labels={Object.fromEntries(it.photos.map((_, i) => [`p${i}`, `Ảnh ${i + 1}`]))} />}
                            </div>
                          ))}
                        </div>
                      </td></tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
            {!loaded && <Skeleton rows={3} />}
            {loaded && eps.length === 0 && <Empty>Chưa có đợt bảo trì / sửa chữa nào khớp bộ lọc. Hãy đổi khoảng ngày hoặc bộ lọc. Mỗi lần xe vào/ra trạng thái Bảo dưỡng hoặc Sửa chữa tai nạn sẽ tự thành một đợt.</Empty>}
          </div>
        )}
        <Pager page={page} size={PAGE} total={view === 'episodes' ? eps.length : 0} onPage={setPage} unit="đợt" />

        {view === 'log' && <>
        <div className="scroll">
          <table>
            <thead><tr><th>Thời gian ghi</th><th>Xe</th><th>Loại</th><th>Nội dung</th><th className="num">ODO</th><th>Nơi thực hiện</th><th className="num">Chi phí</th><th>Người ghi</th><th></th></tr></thead>
            <tbody>
              {pageRows.map(r => (
                <Fragment key={r.id}>
                  <tr>
                    <td>{fmt(r.at)}{r.performed_on && r.kind !== 'status' && <><br /><small className="muted">Thực hiện {day(r.performed_on)}</small></>}</td>
                    <td>{lk.plate(r.vehicle_id)}<br /><small className="muted">{lk.vehicle(r.vehicle_id)?.type}</small></td>
                    <td>{KIND[r.kind]}{r.source !== 'manual' && <><br /><span className="chip inactive">{SOURCE[r.source]}</span></>}</td>
                    <td>
                      {r.status_to && <span className={`chip ${r.status_to === 'repair' ? 'repair' : r.status_to === 'maintenance' ? 'maintenance' : ''}`}>{stText(r.status_from)} → {stText(r.status_to)}</span>}
                      {r.description && <div style={{ whiteSpace: 'pre-wrap' }}>{r.description}</div>}
                    </td>
                    <td className="num">{r.odo != null ? r.odo.toLocaleString('vi-VN') : '—'}</td>
                    <td>{r.garage || '—'}</td>
                    <td className="num">{money(Number(r.cost || 0))}</td>
                    <td>{r.created_by_name || '—'}</td>
                    <td>{r.photos.length > 0 && <button className="btn ghost" onClick={() => setOpen(open === r.id ? '' : r.id)}>Ảnh ({r.photos.length})</button>}</td>
                  </tr>
                  {open === r.id && (
                    <tr><td colSpan={9}><SignedPhotos photos={Object.fromEntries(r.photos.map((p, i) => [`p${i}`, p]))} labels={Object.fromEntries(r.photos.map((_, i) => [`p${i}`, `Ảnh ${i + 1}`]))} /></td></tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
          {!loaded && <Skeleton rows={3} />}
          {loaded && list.length === 0 && <Empty>Chưa có dòng nhật ký nào trong khoảng ngày và bộ lọc này. Hãy đổi khoảng ngày, hoặc bấm “+ Ghi nhật ký bảo trì” để thêm. Từ nay mỗi lần xe vào/ra trạng thái Bảo dưỡng hoặc Sửa chữa sẽ tự được ghi.</Empty>}
        </div>
        <Pager page={page} size={PAGE} total={list.length} onPage={setPage} unit="dòng" />
        </>}
      </div>
    </div>
  );
}
