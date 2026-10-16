import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import Alert from '../components/Alert.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { dashboardPath } from '../components/SiteHeader.jsx';

export default function LoginPage() {
  const { user, authLoading, signIn } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!authLoading && user) return <Navigate to={dashboardPath(user.role)} replace />;

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const currentUser = await signIn({ email, password });
      const requestedPath = location.state?.from;
      navigate(requestedPath && requestedPath !== '/login' && requestedPath !== '/register' ? requestedPath : dashboardPath(currentUser.role), { replace: true });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="container auth-page">
      <div className="auth-card">
        <p className="eyebrow">WELCOME BACK</p>
        <h1>Sign in</h1>
        <p className="auth-intro">Use your patient, staff, or administrator account.</p>
        <Alert>{error}</Alert>
        <form className="form-stack" onSubmit={handleSubmit}>
          <label>Email address<input autoComplete="email" type="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <label>Password<input autoComplete="current-password" type="password" required maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} /></label>
          <button className="button button-primary button-wide" disabled={submitting}>{submitting ? 'Signing in…' : 'Sign in'}</button>
        </form>
        <p className="auth-switch">New to QueueSaathi? <Link to="/register">Create a patient account</Link></p>
      </div>
    </section>
  );
}
