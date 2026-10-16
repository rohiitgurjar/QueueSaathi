import { useCallback, useEffect, useMemo, useState } from 'react';
import Alert from '../components/Alert.jsx';
import LoadingState from '../components/LoadingState.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { apiRequest } from '../services/api.js';

function tokenLabel(number) { return `T-${String(number).padStart(3, '0')}`; }

export default function StaffDashboard() {
  const { user } = useAuth();
  const assignedClinics = user.assignedClinics || [];
  const activeClinics = assignedClinics.filter((clinic) => clinic.active !== false);
  const [clinicId, setClinicId] = useState(activeClinics[0]?.id || '');
  const [queue, setQueue] = useState(null);
  const [loading, setLoading] = useState(Boolean(activeClinics.length));
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (activeClinics.length && !activeClinics.some((clinic) => clinic.id === clinicId)) setClinicId(activeClinics[0].id);
  }, [activeClinics, clinicId]);

  const loadQueue = useCallback(async () => {
    if (!clinicId) { setQueue(null); setLoading(false); return; }
    setLoading(true);
    setError('');
    try {
      const result = await apiRequest(`/clinics/${clinicId}/queue`);
      setQueue(result.queue);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [clinicId]);

  useEffect(() => { loadQueue(); }, [loadQueue]);

  const tokens = queue?.tokens || [];
  const currentToken = useMemo(() => tokens.find((token) => token.status === 'CALLED'), [tokens]);
  const waitingTokens = useMemo(() => tokens.filter((token) => token.status === 'WAITING'), [tokens]);
  const nextToken = waitingTokens[0];
  const stats = queue?.statistics || { waiting: 0, called: 0, served: 0, skipped: 0, cancelled: 0 };

  async function runAction(key, path, body, successMessage) {
    setBusy(key);
    setError('');
    setNotice('');
    try {
      await apiRequest(path, { method: 'POST', body });
      setNotice(successMessage);
      await loadQueue();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy('');
    }
  }

  function handleCallNext() {
    if (!clinicId || currentToken || !nextToken) return;
    runAction('call-next', `/clinics/${clinicId}/queue/call-next`, {}, `Called ${tokenLabel(nextToken.tokenNumber)}.`);
  }

  function handleServe(token) {
    if (!window.confirm(`Mark ${tokenLabel(token.tokenNumber)} as served?`)) return;
    runAction(`serve-${token._id}`, `/queue/${token._id}/serve`, {}, `${tokenLabel(token.tokenNumber)} marked served.`);
  }

  function handleSkip(token) {
    const reason = window.prompt(`Why are you skipping ${tokenLabel(token.tokenNumber)}?`);
    if (reason === null) return;
    if (reason.trim().length < 3) { setError('Enter a skip reason of at least 3 characters.'); return; }
    runAction(`skip-${token._id}`, `/queue/${token._id}/skip`, { reason: reason.trim() }, `${tokenLabel(token.tokenNumber)} skipped.`);
  }

  function handleCancel(token) {
    const reason = window.prompt(`Why are you cancelling ${tokenLabel(token.tokenNumber)}?`);
    if (reason === null) return;
    if (reason.trim().length < 3) { setError('Enter a cancellation reason of at least 3 characters.'); return; }
    runAction(`cancel-${token._id}`, `/queue/${token._id}/cancel`, { reason: reason.trim() }, `${tokenLabel(token.tokenNumber)} cancelled.`);
  }

  if (!activeClinics.length) {
    return <section className="container page-pad"><p className="eyebrow">STAFF SPACE</p><h1>Queue dashboard</h1><div className="empty-state"><h3>No active clinic assignments</h3><p>Ask an administrator to assign your staff account to an active clinic.</p></div></section>;
  }

  return (
    <section className="container page-pad dashboard-page">
      <div className="page-title-row">
        <div><p className="eyebrow">STAFF SPACE</p><h1>Queue dashboard</h1><p className="muted">Manage the sequential queue for your assigned clinic.</p></div>
        <label className="clinic-select">Clinic
          <select value={clinicId} onChange={(event) => setClinicId(event.target.value)}>
            {activeClinics.map((clinic) => <option key={clinic.id} value={clinic.id}>{clinic.name}</option>)}
          </select>
        </label>
      </div>
      {notice && <Alert variant="success" onDismiss={() => setNotice('')}>{notice}</Alert>}
      {error && <Alert>{error}</Alert>}
      {loading ? <LoadingState label="Loading today’s queue…" /> : queue && (
        <>
          <div className="stats-grid">
            <div className="stat-card"><span>Waiting</span><strong>{stats.waiting}</strong></div>
            <div className="stat-card"><span>Called</span><strong>{stats.called}</strong></div>
            <div className="stat-card"><span>Served today</span><strong>{stats.served}</strong></div>
            <div className="stat-card"><span>Skipped / cancelled</span><strong>{stats.skipped + stats.cancelled}</strong></div>
          </div>
          <div className="staff-action-grid">
            <article className="panel current-panel">
              <p className="eyebrow">CURRENT TOKEN</p>
              {currentToken ? <>
                <div className="token-number">{tokenLabel(currentToken.tokenNumber)}</div>
                <p className="muted">{currentToken.patient?.name || 'Patient'}</p>
                <StatusBadge status={currentToken.status} />
                <div className="button-row">
                  <button className="button button-primary" type="button" disabled={Boolean(busy)} onClick={() => handleServe(currentToken)}>{busy === `serve-${currentToken._id}` ? 'Saving…' : 'Mark served'}</button>
                  <button className="button button-secondary" type="button" disabled={Boolean(busy)} onClick={() => handleSkip(currentToken)}>Skip with reason</button>
                  <button className="text-button danger-text" type="button" disabled={Boolean(busy)} onClick={() => handleCancel(currentToken)}>Cancel with reason</button>
                </div>
              </> : <>
                <h2>No token is currently called</h2>
                <p className="muted">Call the next eligible patient to begin serving.</p>
                <button className="button button-primary" type="button" disabled={!nextToken || Boolean(busy)} title={!nextToken ? 'There are no waiting tokens.' : undefined} onClick={handleCallNext}>{busy === 'call-next' ? 'Calling…' : 'Call next token'}</button>
              </>}
            </article>
            <article className="panel next-panel">
              <p className="eyebrow">NEXT IN LINE</p>
              {nextToken ? <>
                <div className="token-number">{tokenLabel(nextToken.tokenNumber)}</div>
                <p>{nextToken.patient?.name || 'Patient'}</p>
                <span className="muted small">Joined {new Date(nextToken.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
                {!currentToken && <button className="text-button" type="button" disabled={Boolean(busy)} onClick={handleCallNext}>Call this token →</button>}
              </> : <p className="muted">No one is waiting.</p>}
            </article>
          </div>

          <div className="subsection-heading"><h2>Today’s tokens</h2><button className="text-button" type="button" onClick={loadQueue} disabled={loading}>Refresh list</button></div>
          <div className="queue-list">
            {tokens.length ? tokens.map((token) => (
              <div className="queue-row" key={token._id}>
                <strong className="queue-row-token">{tokenLabel(token.tokenNumber)}</strong>
                <div className="queue-row-name"><span>{token.patient?.name || 'Patient'}</span>{token.reason && <small>Reason: {token.reason}</small>}</div>
                <StatusBadge status={token.status} />
                <div className="queue-row-actions">
                  {['WAITING', 'CALLED'].includes(token.status) && <>
                    <button className="text-button" type="button" disabled={Boolean(busy)} onClick={() => handleSkip(token)}>Skip</button>
                    <button className="text-button danger-text" type="button" disabled={Boolean(busy)} onClick={() => handleCancel(token)}>Cancel</button>
                  </>}
                  {token.status === 'CALLED' && <button className="text-button" type="button" disabled={Boolean(busy)} onClick={() => handleServe(token)}>Serve</button>}
                </div>
              </div>
            )) : <p className="empty-list">No tokens for today yet.</p>}
          </div>
        </>
      )}
      <p className="small muted footer-hint">Skipped tokens become inactive and leave the line; they remain visible in today’s staff list with their recorded reason.</p>
    </section>
  );
}
