export default function Alert({ children, variant = 'error', onDismiss }) {
  if (!children) return null;
  return (
    <div className={`alert alert-${variant}`} role={variant === 'error' ? 'alert' : 'status'}>
      <span>{children}</span>
      {onDismiss && <button type="button" onClick={onDismiss} aria-label="Dismiss message">×</button>}
    </div>
  );
}
