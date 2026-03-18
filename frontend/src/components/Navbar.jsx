import { Link, useNavigate } from 'react-router-dom';
import { getUser, clearSession } from '../lib/auth.js';

export default function Navbar() {
  const user = getUser();
  const navigate = useNavigate();

  function logout() {
    clearSession();
    navigate('/login');
  }

  return (
    <nav className="bg-indigo-700 text-white px-6 py-3 flex items-center justify-between shadow">
      <Link to="/" className="text-xl font-bold tracking-tight">
        Parceler
      </Link>
      <div className="flex items-center gap-4 text-sm">
        {user && (
          <>
            <span className="opacity-75">{user.name} ({user.role})</span>
            {user.role === 'ADMIN' && (
              <>
                <Link to="/admin" className="hover:underline">Admin</Link>
                <Link to="/driver" className="hover:underline">Log Parcel</Link>
              </>
            )}
            {user.role === 'DRIVER' && (
              <Link to="/driver" className="hover:underline">Log Parcel</Link>
            )}
            {user.role === 'RESIDENT' && (
              <Link to="/dashboard" className="hover:underline">My Parcels</Link>
            )}
            <button onClick={logout} className="bg-white text-indigo-700 px-3 py-1 rounded hover:bg-indigo-50 font-medium">
              Logout
            </button>
          </>
        )}
      </div>
    </nav>
  );
}
