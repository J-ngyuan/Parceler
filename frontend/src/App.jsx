import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import ResidentDashboard from './pages/ResidentDashboard.jsx';
import DriverInterface from './pages/DriverInterface.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import { getUser } from './lib/auth.js';

function RequireRole({ roles, children }) {
  const user = getUser();
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

function HomeRedirect() {
  const user = getUser();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'ADMIN') return <Navigate to="/admin" replace />;
  if (user.role === 'DRIVER') return <Navigate to="/driver" replace />;
  return <Navigate to="/dashboard" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/dashboard"
          element={
            <RequireRole roles={['RESIDENT']}>
              <ResidentDashboard />
            </RequireRole>
          }
        />
        <Route
          path="/driver"
          element={
            <RequireRole roles={['DRIVER', 'ADMIN']}>
              <DriverInterface />
            </RequireRole>
          }
        />
        <Route
          path="/admin"
          element={
            <RequireRole roles={['ADMIN']}>
              <AdminDashboard />
            </RequireRole>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
