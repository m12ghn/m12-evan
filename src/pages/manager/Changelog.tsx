import { useMemo, useState } from 'react';
import data from '../../changelog.json';

type Item = { type: string; scope: string; title: string; detail?: string; commit?: string };
const TYPE: Record<string, string> = { new: '✨ Tính năng mới', change: '🔧 Chỉnh sửa', fix: '🐞 Sửa lỗi', system: '⚙️ Hệ thống' };
const SCOPE: Record<string, string> = { driver: 'Tài xế', manager: 'Quản lý', all: 'Cả hai' };

export default function Changelog() {
  const [type, setType] = useState('');
  const [q, setQ] = useState('');
  const days = useMemo(() => (data as { date: string; items: Item[] }[])
    .map(d => ({ ...d, items: d.items.filter(i => (!type || i.type === type) && (!q || `${i.title} ${i.detail ?? ''}`.toLowerCase().includes(q.toLowerCase()))) }))
    .filter(d => d.items.length), [type, q]);
  const total = days.reduce((s, d) => s + d.items.length, 0);

  return (
    <div className="card">
      <div className="row" style={{ flexWrap: 'wrap', marginBottom: 12 }}>
        <input placeholder="Tìm trong nhật ký cập nhật…" value={q} onChange={e => setQ(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
        <button className={`btn ${type === '' ? '' : 'ghost'}`} onClick={() => setType('')}>Tất cả</button>
        {Object.entries(TYPE).map(([k, l]) => <button key={k} className={`btn ${type === k ? '' : 'ghost'}`} onClick={() => setType(k)}>{l}</button>)}
      </div>
      <p className="muted">{total} điều chỉnh trong {days.length} ngày</p>
      {days.map(d => (
        <div key={d.date} style={{ marginTop: 14 }}>
          <h4 className="day-head">
            {new Date(`${d.date}T00:00:00`).toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}
            <span className="muted"> — {d.items.length} điều chỉnh</span>
          </h4>
          <div className="stack">
            {d.items.map((i, n) => (
              <div key={n} className="change-item">
                <div className="row" style={{ flexWrap: 'wrap' }}>
                  <span className="chip">{TYPE[i.type]}</span>
                  <span className="chip inactive">{SCOPE[i.scope]}</span>
                  <b>{i.title}</b>
                  {i.commit && <code className="muted">{i.commit}</code>}
                </div>
                {i.detail && <p className="muted" style={{ margin: '4px 0 0' }}>{i.detail}</p>}
              </div>
            ))}
          </div>
        </div>
      ))}
      {days.length === 0 && <p className="muted">Không có mục nào khớp</p>}
    </div>
  );
}
