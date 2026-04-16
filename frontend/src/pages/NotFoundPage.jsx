import { useNavigate } from 'react-router-dom';

export default function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)' }}>
      <div className="empty-state">
        <div style={{ fontSize: 72 }}>🎫</div>
        <div className="empty-state__title" style={{ fontSize: 'var(--text-3xl)' }}>404</div>
        <div className="empty-state__desc" style={{ fontSize: 'var(--text-md)' }}>
          This page doesn't exist or you don't have access to it.
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-5)' }}>
          <button className="btn btn--primary" onClick={() => navigate('/dashboard')}>Go to Dashboard</button>
          <button className="btn btn--secondary" onClick={() => navigate(-1)}>Go Back</button>
        </div>
      </div>
    </div>
  );
}
