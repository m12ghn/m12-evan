import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './lib/auth';
import Login from './pages/Login';
// Tách gói theo quyền: tài xế không phải tải mã trang quản lý (và ngược lại)
const ManagerHome = lazy(() => import('./pages/ManagerHome'));
const DriverHome = lazy(() => import('./pages/DriverHome'));

export default function App() {
  const { session, profile, loading, signOut } = useAuth();

  if (loading) return <div className="center">Đang tải…</div>;
  if (!session) return <Login />;
  if (!profile) return <div className="center">Không tìm thấy hồ sơ người dùng. Liên hệ quản trị.</div>;

  if (profile.active === false) {
    return (
      <div className="center stack" style={{ padding: 24, textAlign: 'center' }}>
        <p className="error"><b>Tài khoản đã ngừng hoạt động (đã nghỉ việc).</b></p>
        <p className="muted">Vui lòng liên hệ quản lý nếu cần đăng nhập lại.</p>
        <button className="btn" onClick={signOut}>Đăng xuất</button>
      </div>
    );
  }

  // Một link duy nhất: role quyết định trang hiển thị.
  return (
    <Suspense fallback={<div className="center">Đang tải…</div>}>
    <Routes>
      <Route path="/manager/*" element={profile.role === 'manager' ? <ManagerHome /> : <Navigate to="/" replace />} />
      <Route path="/driver/*" element={profile.role === 'driver' ? <DriverHome /> : <Navigate to="/" replace />} />
      <Route path="*" element={<Navigate to={profile.role === 'manager' ? '/manager' : '/driver'} replace />} />
    </Routes>
    </Suspense>
  );
}
