import { useEffect, useMemo, useState } from 'react';
import Alert from '../components/Alert.jsx';
import CategoryFilters from '../components/CategoryFilters.jsx';
import ClinicCard from '../components/ClinicCard.jsx';
import LoadingState from '../components/LoadingState.jsx';
import { apiRequest } from '../services/api.js';

export default function DiscoverPage() {
  const [clinics, setClinics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('recommended');

  async function loadClinics() {
    setLoading(true);
    setError('');
    try {
      const result = await apiRequest('/clinics');
      setClinics(result.clinics || []);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadClinics(); }, []);

  const categories = useMemo(() => {
    const values = new Map();
    clinics.forEach((clinic) => {
      if (clinic.category?._id) values.set(String(clinic.category._id), clinic.category.name);
    });
    return [...values.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [clinics]);

  const visibleClinics = useMemo(() => {
    const term = searchTerm.trim().toLocaleLowerCase();
    const result = clinics.filter((clinic) => {
      const matchesCategory = selectedCategory === 'all' || String(clinic.category?._id) === selectedCategory;
      const content = [clinic.name, clinic.description, clinic.address, clinic.category?.name]
        .filter(Boolean).join(' ').toLocaleLowerCase();
      return matchesCategory && (!term || content.includes(term));
    });
    if (sortBy === 'wait') result.sort((a, b) => (a.queue?.estimatedWaitMinutes ?? 0) - (b.queue?.estimatedWaitMinutes ?? 0));
    if (sortBy === 'name') result.sort((a, b) => a.name.localeCompare(b.name));
    return result;
  }, [clinics, searchTerm, selectedCategory, sortBy]);

  function clearFilters() {
    setSearchTerm('');
    setSelectedCategory('all');
    setSortBy('recommended');
  }

  return (
    <>
      <section className="directory-hero">
        <div className="container hero-content">
          <p className="eyebrow">QUEUESAATHI · SMART QUEUE DEMO</p>
          <h1>Find care.<br /><span>Skip the guesswork.</span></h1>
          <p className="hero-lede">Discover clinics and laboratories, check the current queue, and join remotely when you’re ready.</p>
          <form className="search-form" role="search" onSubmit={(event) => event.preventDefault()}>
            <label className="visually-hidden" htmlFor="clinic-search">Search clinics by name, category, or address</label>
            <span className="search-mark" aria-hidden="true">⌕</span>
            <input
              id="clinic-search"
              type="search"
              placeholder="Search clinics, categories, or areas"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
            {searchTerm && <button className="text-button" type="button" onClick={() => setSearchTerm('')}>Clear</button>}
          </form>
          <p className="hero-note">Demo clinics use sample queue activity. Wait times are estimates, not real-time promises.</p>
        </div>
      </section>

      <section className="container directory-content" aria-labelledby="directory-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">SERVICE DIRECTORY</p>
            <h2 id="directory-heading">Clinics near you</h2>
          </div>
          <label className="sort-field">
            <span>Sort by</span>
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
              <option value="recommended">Recommended</option>
              <option value="wait">Shortest estimated wait</option>
              <option value="name">Name A–Z</option>
            </select>
          </label>
        </div>

        {!loading && clinics.some((clinic) => clinic.isDemo) && (
          <div className="notice"><strong>Demo data.</strong> Queue figures and clinic records marked Demo are examples for this portfolio project.</div>
        )}

        {!loading && clinics.length > 0 && (
          <CategoryFilters categories={categories} selectedCategory={selectedCategory} onSelect={setSelectedCategory} />
        )}

        {error && <Alert onDismiss={() => setError('')}>{error} <button className="inline-link" type="button" onClick={loadClinics}>Try again</button></Alert>}
        {loading && <LoadingState label="Loading clinics…" />}

        {!loading && !error && visibleClinics.length > 0 && (
          <>
            <div className="results-summary" aria-live="polite">{visibleClinics.length} {visibleClinics.length === 1 ? 'clinic' : 'clinics'}</div>
            <div className="clinic-grid">
              {visibleClinics.map((clinic) => <ClinicCard key={clinic._id} clinic={clinic} />)}
            </div>
          </>
        )}

        {!loading && !error && clinics.length > 0 && visibleClinics.length === 0 && (
          <div className="empty-state">
            <h3>No clinics match those filters.</h3>
            <p>Try another service, name, or category.</p>
            <button className="button button-secondary" type="button" onClick={clearFilters}>Clear filters</button>
          </div>
        )}

        {!loading && !error && clinics.length === 0 && (
          <div className="empty-state">
            <h3>No active clinics yet.</h3>
            <p>Run the demo seed script or ask an administrator to add a clinic.</p>
          </div>
        )}
      </section>
      <section className="container how-note-section">
        <p><strong>How the estimate works:</strong> QueueSaathi estimates time from eligible people ahead and the clinic’s configured average service duration. Actual service times can vary.</p>
      </section>
    </>
  );
}
