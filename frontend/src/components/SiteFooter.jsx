import Brand from './Brand.jsx';

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container footer-inner">
        <Brand />
        <span>Portfolio demo · Queue figures are estimates, not live measurements.</span>
      </div>
    </footer>
  );
}
