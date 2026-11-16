// Gom nhật ký đổi trạng thái xe thành các "đợt" bảo trì / sửa chữa: ngày bắt đầu → ngày kết thúc (chưa có ngày kết thúc = xe chưa xử lý xong).
export type EpKind = 'maintenance' | 'repair';   // maintenance = BTBD (bảo trì bảo dưỡng), repair = Tai nạn (đang sửa chữa tai nạn)
export interface LogRow {
  id: string; vehicle_id: string; at: string; kind: string; status_from: string | null; status_to: string | null;
  description: string | null; performed_on: string | null; garage: string | null; cost: number | string; photos: string[];
}
export interface Episode {
  key: string; vehicle_id: string; kind: EpKind; start: string | null; end: string | null; open: boolean;
  items: LogRow[];      // các lần ghi tay (nội dung, chi phí, ảnh) thuộc đợt này
  cost: number;
}
const isM = (s: string | null | undefined): s is EpKind => s === 'maintenance' || s === 'repair';
const dayOf = (iso: string) => iso.slice(0, 10);

/** rows: mọi dòng nhật ký (mọi xe). currentStatus: trạng thái hiện tại của từng xe (để bắt xe đang bảo trì nhưng chưa có dòng nhật ký). */
export function buildEpisodes(rows: LogRow[], currentStatus: Record<string, string>): Episode[] {
  const byVehicle = new Map<string, LogRow[]>();
  rows.forEach(r => byVehicle.set(r.vehicle_id, [...(byVehicle.get(r.vehicle_id) ?? []), r]));
  Object.keys(currentStatus).forEach(v => { if (!byVehicle.has(v)) byVehicle.set(v, []); });   // xe chưa có dòng nhật ký nào vẫn được xét theo trạng thái hiện tại
  const eps: Episode[] = [];
  for (const [vid, list] of byVehicle) {
    const sorted = [...list].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
    let cur: Episode | null = null;
    const start = (kind: EpKind, at: string | null): Episode => ({ key: `${vid}:${at ?? 'x'}:${kind}`, vehicle_id: vid, kind, start: at, end: null, open: true, items: [], cost: 0 });
    const close = (e: Episode, at: string) => { e.end = at; e.open = false; eps.push(e); };
    for (const r of sorted) {
      if (!r.status_to) continue;                        // dòng ghi tay không đổi trạng thái: gắn vào đợt ở bước sau
      const to = r.status_to;
      if (cur) {
        if (!isM(to)) { close(cur, r.at); cur = null; }
        else if (to !== cur.kind) { close(cur, r.at); cur = start(to, r.at); }   // BTBD ↔ Tai nạn: đợt mới
      } else if (isM(to)) cur = start(to, r.at);
      else if (isM(r.status_from)) { const e = start(r.status_from, null); close(e, r.at); }   // chỉ thấy lúc ra: chưa rõ lúc vào
    }
    if (cur) eps.push(cur);
    // Xe đang bảo trì / sửa chữa nhưng nhật ký chưa có lúc vào: vẫn hiện (chưa rõ ngày bắt đầu)
    const st = currentStatus[vid];
    if (isM(st) && !eps.some(e => e.vehicle_id === vid && e.open)) eps.push(start(st, null));
  }
  // Gắn các lần ghi tay (nội dung / chi phí / ảnh) vào đợt có khoảng thời gian chứa ngày thực hiện
  rows.filter(r => !r.status_to || r.description).forEach(r => {
    if (!r.description) return;
    const d = r.performed_on ?? dayOf(r.at);
    const cand = eps.filter(e => e.vehicle_id === r.vehicle_id && (!e.start || dayOf(e.start) <= d) && (!e.end || d <= dayOf(e.end)))
      .sort((a, b) => Date.parse(b.start ?? '1970') - Date.parse(a.start ?? '1970'))[0];
    if (cand) { cand.items.push(r); cand.cost += Number(r.cost || 0); }
  });
  return eps.sort((a, b) => Date.parse(b.start ?? b.end ?? '1970') - Date.parse(a.start ?? a.end ?? '1970'));
}

export function daysBetween(startIso: string | null, endIso: string | null, now = new Date()): number | null {
  if (!startIso) return null;
  const end = endIso ? new Date(endIso) : now;
  return Math.max(0, Math.round((end.getTime() - new Date(startIso).getTime()) / 86400_000));
}
