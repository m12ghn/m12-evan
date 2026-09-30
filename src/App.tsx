import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './lib/auth';
import Login from './pages/Login';
import ManagerHome from './pages/ManagerHome';
import DriverHome from './pages/DriverHome';

export default function App() {
  const { session, profile, loading } = useAuth();

  if (loading) return <div className="center">Đang tải…</div>;
  if (!session) return <Login />;
  if (!profile) return <div className="center">Không tìm thấy hồ sơ người dùng. Liên hệ quản trị.</div>;

  // Một link duy nhất: role quyết định trang hiển thị.
  return (
    <Routes>
      <Route path="/manager/*" element={profile.role === 'manager' ? <ManagerHome /> : <Navigate to="/" replace />} />
      <Route path="/driver/*" element={profile.role === 'driver' ? <DriverHome /> : <Navigate to="/" replace />} />
      <Route path="*" element={<Navigate to={profile.role === 'manager' ? '/manager' : '/driver'} replace />} />
    </Routes>
  );
}
