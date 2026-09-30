import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Đọc SUPABASE_URL / SUPABASE_ANON_KEY (không cần tiền tố VITE_; vẫn nhận VITE_* cũ).
// Chỉ nhúng ĐÚNG 2 biến này vào bundle — mọi biến khác (vd service_role) không bao giờ lọt ra trình duyệt.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    define: {
      __SUPABASE_URL__: JSON.stringify(env.SUPABASE_URL ?? env.VITE_SUPABASE_URL ?? ''),
      __SUPABASE_ANON_KEY__: JSON.stringify(env.SUPABASE_ANON_KEY ?? env.VITE_SUPABASE_ANON_KEY ?? ''),
    },
  };
});
