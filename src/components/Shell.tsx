import type { ReactNode } from 'react';
import { useAuth } from '../lib/auth';

export default function Shell({ title, children }: { title: string; children: ReactNode }) {
  const { profile, signOut } = useAuth();
  return (
    <div className="shell">
      <header className="topbar">
        <b>🚚 FleetOps · {title}</b>
        <span>
          {profile?.full_name ?? 'Người dùng'} &nbsp;
          <button className="btn ghost" onClick={signOut}>Đăng xuất</button>
        </span>
      </header>
      <main className="content">{children}</main>
    </div>
  );
}
