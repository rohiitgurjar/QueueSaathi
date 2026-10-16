import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import Alert from '../components/Alert.jsx';
import LoadingState from '../components/LoadingState.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { apiRequest } from '../services/api.js';

export default function ClinicDetailsPage() {
  const { clinicId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [clinic, setClinic] = useState(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');

  async function loadClinic() {
    setLoading(true);
    setError('');
    try {
      const result = await apiRequest(`/clinics/${clinicId}`);
      setClinic(result.clinic);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadClinic(); }, [clinicId]);

  async function joinQueue() {
    if (!user) {
      navigate('/login', { state: { from: location.pathname } });
      return;
    }
    if (user.role !== 'patient') return;
    setJoining(true);
    setError('');
    try {
      await apiRequest(`/clinics/${clinicId}/queue`, { method: 'POST', body: {} });
      navigate('/patient', { state: { notice: `You joined the ${clinic.name} queue.` } });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setJoining(false);
    }
  }

  if (loading) return <div className="container page-pad"><LoadingState label="Loading clinic details…" /></div>;
  if (error && !clinic) return <div className="container page-pad"><Alert>{error}</Alert><Link className="text-link" to="/">← Back to clinics</Link></div>;
  if (!clinic) return null;

  return (
    <div className="container page-pad">
      <Link className="back-link" to="/">← All clinics</Link>
      <div className="detail-layout">
        <section className="detail-main">
          <div className="clinic-card-top">
            <span className="category-label">{clinic.category?.name}</span>
            {clinic.isDemo && <span className="demo-label">Demo listing</span>}
          </div>
          <h1>{clinic.name}</h1>
          <p className="detail-description">{clinic.description}</p>
          <dl className="clinic-facts">
            <div><dt>Address</dt><dd>{clinic.address}</dd></div>
            <div><dt>Opening hours</dt><dd>{clinic.openingHours}</dd></div>
            <div><dt>Average service time</dt><dd>About {clinic.averageServiceDurationMinutes} min per visit</dd></div>
          </dl>
          <div className="detail-disclaimer"><strong>Estimate, not a promise.</strong> Wait time is based on the number of eligible people ahead and the clinic’s average service duration. Delays can vary.</div>
        </section>

        <aside className="queue-card">
          <div className="queue-card-heading"><span>QUEUE STATUS</span><button className="text-button" type="button" onClick={loadClinic} disabled={loading}>Refresh</button></div>
          <div className="queue-number-row"><strong>{clinic.queue?.waitingCount ?? 0}</strong><span>people waiting</span></div>
          <div className="queue-divider" />
          <div className="queue-meta-row"><span>Currently called</span><strong>{clinic.queue?.currentTokenNumber ? `Token ${clinic.queue.currentTokenNumber}` : 'None'}</strong></div>
          <div className="queue-meta-row"><span>Estimated wait for new join</span><strong>~{clinic.queue?.estimatedWaitMinutes ?? 0} min</strong></div>
          {clinic.queue?.isEstimate && <p className="small muted">Calculated estimate · not live measurement</p>}
          {clinic.isDemo && <p className="demo-inline-note">This is sample queue activity.</p>}
          {error && <Alert>{error}</Alert>}
          {user?.role === 'patient' ? (
            <button className="button button-primary button-wide" type="button" onClick={joinQueue} disabled={joining || !clinic.active}>
              {joining ? 'Joining…' : 'Join this queue'}
            </button>
          ) : user ? (
            <p className="small muted">Patient accounts can join a queue. You are signed in as {user.role}.</p>
          ) : (
            <button className="button button-primary button-wide" type="button" onClick={joinQueue}>Sign in to join</button>
          )}
          <p className="small muted">A token is created only after you confirm by joining.</p>
        </aside>
      </div>
    </div>
  );
}
