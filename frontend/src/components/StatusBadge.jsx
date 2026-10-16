const statusLabels = {
  WAITING: 'Waiting', CALLED: 'Called', SERVED: 'Served', SKIPPED: 'Skipped', CANCELLED: 'Cancelled',
};

export default function StatusBadge({ status }) {
  return <span className={`status-badge status-${String(status).toLowerCase()}`}>{statusLabels[status] || status}</span>;
}
