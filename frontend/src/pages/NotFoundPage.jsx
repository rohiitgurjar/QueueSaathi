import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return <section className="container empty-state page-pad"><p className="eyebrow">404</p><h1>Page not found</h1><p>That link may be out of date.</p><Link className="button button-primary" to="/">Browse clinics</Link></section>;
}
