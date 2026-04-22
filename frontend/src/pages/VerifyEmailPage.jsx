import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle2, XCircle, Loader } from 'lucide-react';
import api from '../services/api';

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('loading'); // loading | success | error
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    const email = searchParams.get('email');

    if (!token || !email) {
      setStatus('error');
      setMessage('Invalid verification link. Please request a new one.');
      return;
    }

    api.get(`/auth/verify-email?token=${token}&email=${encodeURIComponent(email)}`)
      .then(res => {
        setStatus('success');
        setMessage(res.data.message);
      })
      .catch(err => {
        setStatus('error');
        setMessage(err.response?.data?.message || 'Verification failed. The link may have expired.');
      });
  }, []);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: '24px' }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        style={{ background: 'white', borderRadius: 'var(--r-xl)', padding: '48px 40px', maxWidth: '440px', width: '100%', textAlign: 'center', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)' }}
      >
        {status === 'loading' && (
          <>
            <Loader size={48} color="var(--primary)" style={{ margin: '0 auto 24px', animation: 'spin 1s linear infinite' }} />
            <h2 style={{ fontWeight: 800, marginBottom: '8px' }}>Verifying your email...</h2>
            <p style={{ color: 'var(--text-dim)' }}>Please wait a moment.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div style={{ width: '72px', height: '72px', background: '#DCFCE7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
              <CheckCircle2 size={36} color="#059669" />
            </div>
            <h2 style={{ fontWeight: 800, marginBottom: '12px', color: '#059669' }}>Email Verified!</h2>
            <p style={{ color: 'var(--text-dim)', lineHeight: 1.6, marginBottom: '32px' }}>{message}</p>
            <div style={{ padding: '16px', background: '#F0FDF4', borderRadius: 'var(--r-md)', fontSize: '0.875rem', color: '#166534', marginBottom: '24px' }}>
              ✅ The admin will review your request and send your login credentials by email.
            </div>
            <Link to="/login" style={{ display: 'inline-block', background: 'var(--primary)', color: 'white', padding: '12px 28px', borderRadius: 'var(--r-md)', fontWeight: 700, textDecoration: 'none' }}>
              Go to Login
            </Link>
          </>
        )}

        {status === 'error' && (
          <>
            <div style={{ width: '72px', height: '72px', background: '#FEE2E2', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
              <XCircle size={36} color="#DC2626" />
            </div>
            <h2 style={{ fontWeight: 800, marginBottom: '12px', color: '#DC2626' }}>Verification Failed</h2>
            <p style={{ color: 'var(--text-dim)', lineHeight: 1.6, marginBottom: '32px' }}>{message}</p>
            <Link to="/register" style={{ display: 'inline-block', background: 'var(--primary)', color: 'white', padding: '12px 28px', borderRadius: 'var(--r-md)', fontWeight: 700, textDecoration: 'none' }}>
              Request New Link
            </Link>
          </>
        )}
      </motion.div>
    </div>
  );
}
