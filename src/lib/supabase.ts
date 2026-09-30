import { createClient } from '@supabase/supabase-js';

// Được nhúng lúc build từ vite.config.ts (SUPABASE_URL, SUPABASE_ANON_KEY)
const url = __SUPABASE_URL__;
const key = __SUPABASE_ANON_KEY__;

export const supabase = createClient(url || 'http://localhost', key || 'missing');
export const isConfigured = Boolean(url && key);
