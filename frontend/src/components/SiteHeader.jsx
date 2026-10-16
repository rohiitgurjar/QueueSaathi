import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import Brand from './Brand.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export function dashboardPath(role) {
  if (role === 'admin') return '/admin';
  if (role === 'staff') return '/staff';
  return '/patient';
}

export default function SiteHeader() {
  const { user, authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const [signOutError, setSignOutError] = useState('');

  async function handleSignOut() {
    setSignOutError('');
    try {
      await signOut();
      navigate('/');
    } catch (error) {
      setSignOutError(error.message);
    }
  }

  return (
    <header className="site-header">
      <div className="container header-inner">
        <Brand />
        <nav className="header-nav" aria-label="Main navigation">
          <NavLink to="/" end>Clinics</NavLink>
          {user && <Link to={dashboardPath(user.role)}>Dashboard</Link>}
        </nav>
        <div className="header-actions">
          {authLoading ? <span className="muted small">Checking session…</span> : user ? (
            <>
              <span className="header-user">{user.name}</span>
              <button className="button button-quiet" type="button" onClick={handleSignOut}>Sign out</button>
            </>
          ) : (
            <>
              <Link className="button button-quiet" to="/login">Sign in</Link>
              <Link className="button button-primary" to="/register">Create account</Link>
            </>
          )}
        </div>
      </div>
      {signOutError && <div className="header-error" role="alert">{signOutError}</div>}
    </header>
  );
}
