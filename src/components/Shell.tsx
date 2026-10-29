import type { ReactNode } from 'react';
import { useAuth } from '../lib/auth';
import ThemeToggle from './ThemeToggle';

export default function Shell({ title, mobile, children }: { title: string; mobile?: boolean; children: ReactNode }) {
  const { profile, signOut } = useAuth();
  return (
    <div className="shell">
      <header className="topbar">
        <span className="brand"><img className="logo-pill" src="/ghn-logo.png" alt="GHN" /><b>FleetOps · {title}</b></span>
        <span>
          {profile?.full_name ?? 'Người dùng'} &nbsp;
          <ThemeToggle /> &nbsp;
          <button className="btn ghost" onClick={signOut}>Đăng xuất</button>
        </span>
      </header>
      <main className={`content${mobile ? " mobile" : ""}`}>{children}</main>
      <footer className="foot">FleetOps v{__APP_VERSION__}</footer>
    </div>
  );
}
