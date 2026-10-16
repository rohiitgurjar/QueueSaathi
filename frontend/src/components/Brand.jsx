import { Link } from 'react-router-dom';

export default function Brand() {
  return (
    <Link className="brand" to="/" aria-label="QueueSaathi home">
      <span className="brand-mark" aria-hidden="true">Q</span>
      <span>QueueSaathi</span>
    </Link>
  );
}
