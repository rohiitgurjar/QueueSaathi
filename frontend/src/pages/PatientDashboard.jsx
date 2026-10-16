import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Alert from '../components/Alert.jsx';
import LoadingState from '../components/LoadingState.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { apiRequest } from '../services/api.js';

function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function tokenLabel(number) {
  return `T-${String(number).padStart(3, '0')}`;
}

export default function PatientDashboard() {
  const location = useLocation();
  const [activeTokens, setActiveTokens] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(location.state?.notice || '');
  const [busyTokenId, setBusyTokenId] = useState('');

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [activeResult, historyResult] = await Promise.all([
        apiRequest('/queue/my-active'),
        apiRequest('/queue/my-history'),
      ]);
      setActiveTokens(activeResult.tokens || []);
      setHistory(historyResult.tokens || []);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  const completedHistory = useMemo(() => history.filter((token) => !token.isActive), [history]);

  async function cancelToken(token) {
    if (!window.confirm(`Cancel ${tokenLabel(token.tokenNumber)} at ${token.clinic?.name}?`)) return;
    setBusyTokenId(String(token._id));
    setError('');
    try {
      await apiRequest(`/queue/${token._id}/cancel`, { method: 'POST', body: {} });
      setNotice(`${tokenLabel(token.tokenNumber)} was cancelled.`);
      await loadDashboard();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyTokenId('');
    }
  }

  return (
    <section className="container page-pad dashboard-page">
      <div className="page-title-row">
        <div><p className="eyebrow">PATIENT SPACE</p><h1>Your queue</h1><p className="muted">Follow active tokens and revisit recent visits.</p></div>
        <button className="button button-secondary" type="button" onClick={loadDashboard} disabled={loading}>Refresh</button>
      </div>
      {notice && <Alert variant="success" onDismiss={() => setNotice('')}>{notice}</Alert>}
      {error && <Alert>{error}</Alert>}
      {loading ? <LoadingState label="Loading your tokens…" /> : (
        <>
          <div className="subsection-heading"><h2>Active tokens</h2><span>{activeTokens.length}</span></div>
          {activeTokens.length ? (
            <div className="token-grid">
              {activeTokens.map((token) => (
                <article className="active-token-card" key={token._id}>
                  <div className="token-card-head"><StatusBadge status={token.status} />{token.clinic?.isDemo && <span className="demo-label">Demo clinic</span>}</div>
                  <h3>{token.clinic?.name || 'Clinic'}</h3>
                  <p className="muted small">{token.clinic?.address}</p>
                  <div className="token-number">{tokenLabel(token.tokenNumber)}</div>
                  <div className="token-stats">
                    <div><span>Queue position</span><strong>{token.status === 'CALLED' ? 'Now serving' : `#${token.queuePosition}`}</strong></div>
                    <div><span>Estimated wait</span><strong>{token.estimatedWaitMinutes === 0 ? 'Now' : `~${token.estimatedWaitMinutes} min`}</strong></div>
                  </div>
                  <p className="small muted">Estimate only · {token.isDemo ? 'sample activity' : 'actual wait may vary'}</p>
                  <div className="token-actions">
                    <Link className="text-link" to={`/clinics/${token.clinic?._id || token.clinic?.id}`}>Clinic details</Link>
                    {token.status === 'WAITING' && (
                      <button className="text-button danger-text" type="button" disabled={busyTokenId === String(token._id)} onClick={() => cancelToken(token)}>
                        {busyTokenId === String(token._id) ? 'Cancelling…' : 'Cancel token'}
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state"><h3>No active queue tokens</h3><p>Browse a clinic and join its queue when you’re ready.</p><Link className="button button-primary" to="/">Find a clinic</Link></div>
          )}

          <div className="subsection-heading history-heading"><h2>Recent history</h2><span>Last {completedHistory.length}</span></div>
          {completedHistory.length ? (
            <div className="history-list">
              {completedHistory.slice(0, 20).map((token) => (
                <div className="history-row" key={token._id}>
                  <div><strong>{token.clinic?.name || 'Clinic'}</strong><span>{tokenLabel(token.tokenNumber)} · {formatDate(token.createdAt)}</span></div>
                  <StatusBadge status={token.status} />
                </div>
              ))}
            </div>
          ) : <p className="muted small">Completed, skipped, and cancelled tokens will appear here.</p>}
        </>
      )}
    </section>
  );
}
