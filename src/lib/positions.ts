import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';

export type Pos = { lat: number; lon: number; speed: number; t: number };
export const normPlate = (p: string) => p.toUpperCase().replace(/_C$/, '').replace(/[^A-Z0-9]/g, '');
const REFRESH_MS = 5 * 60_000;

// Vị trí GPS mới nhất theo biển số, tự làm mới mỗi 5 phút (chỉ khi tab đang hiển thị)
export function useVehiclePositions() {
  const [pos, setPos] = useState<Record<string, Pos>>({});
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      const r = await fetch('/api/vehicle-positions', { method: 'POST', headers: { Authorization: `Bearer ${data.session?.access_token ?? ''}` } });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? `Lỗi ${r.status}`);
      setPos(j.positions ?? {}); setUpdatedAt(Date.now()); setError('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Lỗi không rõ'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(() => { if (document.visibilityState === 'visible') load(); }, REFRESH_MS);
    const onVis = () => { if (document.visibilityState === 'visible' && (!updatedAt || Date.now() - updatedAt > REFRESH_MS)) load(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVis); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  return { pos, updatedAt, error, loading, reload: load };
}

export function ageText(t: number) {
  const m = Math.max(0, Math.round((Date.now() - t) / 60_000));
  return m < 60 ? `${m} phút trước` : m < 1440 ? `${Math.floor(m / 60)} giờ trước` : `${Math.floor(m / 1440)} ngày trước`;
}
