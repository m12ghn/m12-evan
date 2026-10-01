import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { Profile, Vehicle } from './types';

// Tra cứu xe & tài xế để hiển thị biển số / tên (quy mô nhỏ nên tải một lần)
export function useLookups() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [people, setPeople] = useState<Profile[]>([]);
  const reload = useCallback(async () => {
    const [v, p] = await Promise.all([
      supabase.from('vehicles').select('*').order('plate'),
      supabase.from('profiles').select('*').order('full_name'),
    ]);
    setVehicles((v.data as Vehicle[]) ?? []);
    setPeople((p.data as Profile[]) ?? []);
  }, []);
  useEffect(() => { reload(); }, [reload]);
  return {
    vehicles, people, reload,
    plate: (id: string) => vehicles.find(v => v.id === id)?.plate ?? '—',
    vehicle: (id: string) => vehicles.find(v => v.id === id),
    person: (id: string | null) => people.find(p => p.id === id)?.full_name ?? '—',
  };
}
export type Lookups = ReturnType<typeof useLookups>;
