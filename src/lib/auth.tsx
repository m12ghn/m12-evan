import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { Profile } from './types';

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthState>({
  session: null, profile: null, loading: true, signOut: async () => {},
});

export const useAuth = () => useContext(Ctx);

// Bắt đăng nhập lại sau N ngày kể từ lần đăng nhập gần nhất (Supabase tự gia hạn phiên nên phải tự giới hạn)
const MAX_SESSION_DAYS = 3;
const expired = (s: Session | null) =>
  Boolean(s?.user.last_sign_in_at) && Date.now() - Date.parse(s!.user.last_sign_in_at!) > MAX_SESSION_DAYS * 86400_000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (expired(data.session)) { supabase.auth.signOut(); return; }
      setSession(data.session);
      if (!data.session) setLoading(false);
    });
    // Kiểm tra lại khi mở lại tab và mỗi 10 phút (cho trường hợp để app mở lâu)
    const check = () => supabase.auth.getSession().then(({ data }) => { if (expired(data.session)) supabase.auth.signOut(); });
    const timer = setInterval(check, 10 * 60 * 1000);
    document.addEventListener('visibilitychange', check);
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (!s) { setProfile(null); setLoading(false); }
    });
    return () => { sub.subscription.unsubscribe(); clearInterval(timer); document.removeEventListener('visibilitychange', check); };
  }, []);

  useEffect(() => {
    if (!session) return;
    setLoading(true);
    supabase.from('profiles').select('*').eq('id', session.user.id).single()
      .then(({ data }) => { setProfile(data as Profile | null); setLoading(false); });
  }, [session]);

  return (
    <Ctx.Provider value={{ session, profile, loading, signOut: async () => { await supabase.auth.signOut(); } }}>
      {children}
    </Ctx.Provider>
  );
}
