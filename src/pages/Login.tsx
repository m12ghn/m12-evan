import { useState, type FormEvent } from 'react';
import { supabase, isConfigured } from '../lib/supabase';

// Tài xế đăng nhập bằng MSNV; Supabase Auth cần email nên map MSNV -> <msnv>@fleetops.local
const toEmail = (a: string) => (a.includes('@') ? a.trim() : `${a.trim().toLowerCase()}@fleetops.local`);

export default function Login() {
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError('');
    const { error } = await supabase.auth.signInWithPassword({ email: toEmail(account), password });
    if (error) setError(error.message);
    setBusy(false);
  }

  return (
    <div className="login">
      <form className="card" onSubmit={onSubmit}>
        <img className="login-logo" src="/ghn-logo.png" alt="GHN" />
        <p className="slogan">YOUR LOADS. OUR ROADS.</p>
        <p className="muted center-text">FleetOps · Đăng nhập để tiếp tục</p>
        {!isConfigured && <p className="error">Chưa cấu hình SUPABASE_URL / SUPABASE_ANON_KEY</p>}
        <input placeholder="MSNV hoặc email" value={account} onChange={e => setAccount(e.target.value)} autoCapitalize="none" required />
        <input type="password" placeholder="Mật khẩu" value={password} onChange={e => setPassword(e.target.value)} required />
        {error && <p className="error">{error}</p>}
        <button className="btn" disabled={busy}>{busy ? 'Đang đăng nhập…' : 'Đăng nhập'}</button>
      </form>
    </div>
  );
}
