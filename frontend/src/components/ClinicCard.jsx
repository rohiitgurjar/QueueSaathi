import { Link } from 'react-router-dom';

export default function ClinicCard({ clinic }) {
  const categoryName = clinic.category?.name || 'Clinic';
  return (
    <article className="clinic-card">
      <div className="clinic-card-top">
        <span className="category-label">{categoryName}</span>
        {clinic.isDemo && <span className="demo-label">Demo</span>}
      </div>
      <h2><Link to={`/clinics/${clinic._id}`}>{clinic.name}</Link></h2>
      <p className="clinic-description">{clinic.description}</p>
      <p className="clinic-address">{clinic.address}</p>
      <div className="clinic-queue-info">
        <span><strong>{clinic.queue?.waitingCount ?? 0}</strong> waiting</span>
        <span>~{clinic.queue?.estimatedWaitMinutes ?? 0} min estimate</span>
      </div>
      <div className="clinic-card-footer">
        <span>Avg. {clinic.averageServiceDurationMinutes} min / visit</span>
        <Link className="text-link" to={`/clinics/${clinic._id}`}>Details <span aria-hidden="true">→</span></Link>
      </div>
    </article>
  );
}
