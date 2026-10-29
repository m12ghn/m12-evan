import { useState } from 'react';
import { getTheme, setTheme, type Theme } from '../lib/theme';

const NEXT: Record<Theme, Theme> = { auto: 'light', light: 'dark', dark: 'auto' };
const LABEL: Record<Theme, string> = { auto: '🌓 Tự động', light: '☀️ Sáng', dark: '🌙 Tối' };

export default function ThemeToggle() {
  const [t, setT] = useState<Theme>(getTheme());
  return <button className="btn ghost theme-btn" title="Đổi giao diện sáng / tối" onClick={() => { const n = NEXT[t]; setTheme(n); setT(n); }}>{LABEL[t]}</button>;
}
