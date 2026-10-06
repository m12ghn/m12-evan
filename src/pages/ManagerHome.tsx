import { useCallback, useEffect, useState } from 'react';
import Shell from '../components/Shell';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { useLookups } from '../lib/useLookups';
import Fleet from './manager/Fleet';
import Trips from './manager/Trips';
import Fuel from './manager/Fuel';
import Settings from './manager/Settings';
import Accidents from './manager/Accidents';
import AuditLog from './manager/AuditLog';
import Changelog from './manager/Changelog';

type Tab = 'fleet' | 'trips' | 'fuel' | 'accidents' | 'audit' | 'changelog' | 'settings';

export default function ManagerHome() {
  const lk = useLookups();
  const isDev = useAuth().profile?.role === 'dev';
  const [tab, setTab] = useState<Tab>('fleet');
  const [pending, setPending] = useState(0);
  const [accNew, setAccNew] = useState(0);

  const loadPending = useCallback(async () => {
    const { count } = await supabase.from('refuels').select('id', { count: 'exact', head: true }).eq('status', 'pending');
    setPending(count ?? 0);
    const a = await supabase.from('accidents').select('id', { count: 'exact', head: true }).eq('status', 'new');
    setAccNew(a.count ?? 0);
  }, []);
  useEffect(() => { loadPending(); }, [loadPending]);

  const tabs: [Tab, string][] = [['fleet', '🚚 Đội xe'], ['trips', '📋 Nhật ký ca'], ['fuel', '⛽ Duyệt nhiên liệu/điện'], ['accidents', '🚨 Tai nạn'], ['audit', '🧾 Nhật ký'], ...(isDev ? [['changelog', '📝 Cập nhật'] as [Tab, string]] : []), ['settings', '⚙️ Cài đặt']];
  return (
    <Shell title={isDev ? 'Dev' : 'Quản lý'}>
      <nav className="tabs">
        {tabs.map(([k, label]) => (
          <button key={k} className={tab === k ? 'active' : ''} onClick={() => { setTab(k); if (k === 'fleet') lk.reload(); }}>
            {label}{k === 'fuel' && pending > 0 && <span className="badge">{pending}</span>}
            {k === 'accidents' && accNew > 0 && <span className="badge">{accNew}</span>}
          </button>
        ))}
      </nav>
      {tab === 'fleet' && <Fleet lk={lk} />}
      {tab === 'trips' && <Trips lk={lk} />}
      {tab === 'fuel' && <Fuel lk={lk} onChanged={loadPending} />}
      {tab === 'accidents' && <Accidents lk={lk} onChanged={loadPending} />}
      {tab === 'audit' && <AuditLog lk={lk} />}
      {tab === 'changelog' && isDev && <Changelog />}
      {tab === 'settings' && <Settings lk={lk} isDev={isDev} />}
    </Shell>
  );
}
