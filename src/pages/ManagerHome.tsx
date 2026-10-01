import { useCallback, useEffect, useState } from 'react';
import Shell from '../components/Shell';
import { supabase } from '../lib/supabase';
import { useLookups } from '../lib/useLookups';
import Fleet from './manager/Fleet';
import Trips from './manager/Trips';
import Fuel from './manager/Fuel';
import Settings from './manager/Settings';

type Tab = 'fleet' | 'trips' | 'fuel' | 'settings';

export default function ManagerHome() {
  const lk = useLookups();
  const [tab, setTab] = useState<Tab>('fleet');
  const [pending, setPending] = useState(0);

  const loadPending = useCallback(async () => {
    const { count } = await supabase.from('refuels').select('id', { count: 'exact', head: true }).eq('status', 'pending');
    setPending(count ?? 0);
  }, []);
  useEffect(() => { loadPending(); }, [loadPending]);

  const tabs: [Tab, string][] = [['fleet', '🚚 Đội xe'], ['trips', '📋 Nhật ký ca'], ['fuel', '⛽ Duyệt nhiên liệu/điện'], ['settings', '⚙️ Cài đặt']];
  return (
    <Shell title="Quản lý">
      <nav className="tabs">
        {tabs.map(([k, label]) => (
          <button key={k} className={tab === k ? 'active' : ''} onClick={() => { setTab(k); if (k === 'fleet') lk.reload(); }}>
            {label}{k === 'fuel' && pending > 0 && <span className="badge">{pending}</span>}
          </button>
        ))}
      </nav>
      {tab === 'fleet' && <Fleet lk={lk} />}
      {tab === 'trips' && <Trips lk={lk} />}
      {tab === 'fuel' && <Fuel lk={lk} onChanged={loadPending} />}
      {tab === 'settings' && <Settings lk={lk} />}
    </Shell>
  );
}
