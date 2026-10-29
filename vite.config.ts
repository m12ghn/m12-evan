import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';

// Đọc SUPABASE_URL / SUPABASE_ANON_KEY (không cần tiền tố VITE_; vẫn nhận VITE_* cũ).
// Chỉ nhúng ĐÚNG 2 biến này vào bundle — mọi biến khác (vd service_role) không bao giờ lọt ra trình duyệt.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const log = JSON.parse(fs.readFileSync('src/changelog.json', 'utf8'));
  return {
    plugins: [react()],
    define: {
      __APP_VERSION__: JSON.stringify(`${pkg.version} · cập nhật ${String(log[0]?.date ?? '').split('-').reverse().join('/')}`),
      __SUPABASE_URL__: JSON.stringify(env.SUPABASE_URL ?? env.VITE_SUPABASE_URL ?? ''),
      __SUPABASE_ANON_KEY__: JSON.stringify(env.SUPABASE_ANON_KEY ?? env.VITE_SUPABASE_ANON_KEY ?? ''),
    },
  };
});
