import { useEffect, useRef, useState } from 'react';

export interface Opt { value: string; label: string }

// Ô lọc: gõ để tìm trong danh sách + chọn nhiều giá trị (hiện dạng thẻ nhỏ). Không chọn gì = tất cả.
export default function MultiSelect({ label, options, value, onChange, placeholder = 'Tất cả' }: {
  label: string; options: Opt[]; value: string[]; onChange: (v: string[]) => void; placeholder?: string;
}) {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) { setOpen(false); setText(''); } };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').toLowerCase();
  const shown = options.filter(o => !text || norm(o.label).includes(norm(text)));
  const toggle = (v: string) => onChange(value.includes(v) ? value.filter(x => x !== v) : [...value, v]);
  const labelOf = (v: string) => options.find(o => o.value === v)?.label ?? v;

  return (
    <div className="ms" ref={box}>
      <span className="ms-label">{label}</span>
      <div className={`ms-box${open ? ' open' : ''}`} onClick={() => { setOpen(true); input.current?.focus(); }}>
        {value.map(v => (
          <span className="ms-chip" key={v}>{labelOf(v)}
            <button type="button" aria-label="Bỏ chọn" onClick={e => { e.stopPropagation(); toggle(v); }}>×</button></span>
        ))}
        <input ref={input} value={text} placeholder={value.length ? '' : placeholder}
          onChange={e => { setText(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={e => {
            if (e.key === 'Backspace' && !text && value.length) onChange(value.slice(0, -1));
            if (e.key === 'Enter') { e.preventDefault(); if (shown[0]) { toggle(shown[0].value); setText(''); } }
            if (e.key === 'Escape') { setOpen(false); setText(''); }
          }} />
      </div>
      {open && (
        <ul className="ms-list">
          {shown.map(o => (
            <li key={o.value} className={value.includes(o.value) ? 'on' : ''} onMouseDown={e => { e.preventDefault(); toggle(o.value); setText(''); input.current?.focus(); }}>
              <span>{value.includes(o.value) ? '☑' : '☐'}</span> {o.label}
            </li>
          ))}
          {shown.length === 0 && <li className="none">Không có kết quả</li>}
        </ul>
      )}
    </div>
  );
}
