import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import Alert from '../components/Alert.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function RegisterPage() {
  const { user, authLoading, signUp } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!authLoading && user) return <Navigate to="/patient" replace />;

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await signUp({ name, email, password });
      navigate('/patient', { replace: true });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="container auth-page">
      <div className="auth-card">
        <p className="eyebrow">PATIENT ACCOUNT</p>
        <h1>Create account</h1>
        <p className="auth-intro">Public sign-up creates patient accounts only. Staff and admin accounts are assigned by an administrator.</p>
        <Alert>{error}</Alert>
        <form className="form-stack" onSubmit={handleSubmit}>
          <label>Full name<input autoComplete="name" type="text" required minLength={2} maxLength={80} value={name} onChange={(event) => setName(event.target.value)} /></label>
          <label>Email address<input autoComplete="email" type="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <label>Password<input autoComplete="new-password" type="password" required minLength={8} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} /><span className="field-hint">Use at least 8 characters.</span></label>
          <button className="button button-primary button-wide" disabled={submitting}>{submitting ? 'Creating account…' : 'Create patient account'}</button>
        </form>
        <p className="auth-switch">Already registered? <Link to="/login">Sign in</Link></p>
      </div>
    </section>
  );
}
