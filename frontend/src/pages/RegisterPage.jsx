import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import { Button, Input } from '../ui';
import { motion } from 'framer-motion';
import { Mail, ArrowRight, CheckCircle2 } from 'lucide-react';
import api from '../services/api';

export default function RegisterPage() {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return toast.error('Please enter your work email');
    if (!email.toLowerCase().endsWith('@vdartinc.com')) {
      return toast.error('Only @vdartinc.com emails are accepted');
    }

    setLoading(true);
    try {
      await api.post('/auth/request-verification', { email });
      setSent(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send verification email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      {/* Branding */}
      <div className="auth-page__brand">
        <div className="auth-page__logo-fixed">
          <div className="flex-center" style={{ width: '32px', height: '32px', background: 'white', color: 'var(--primary)', borderRadius: 'var(--r-md)', fontWeight: 800 }}>V</div>
          VDesk
        </div>
        <div className="auth-page__brand-content">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="auth-page__tagline">Your IT support,<br />simplified.</h1>
            <p className="auth-page__tagline-sub">Enter your company email to get started. Your account will be set up by the admin.</p>
            <div className="auth-page__features-pills">
              <span className="feature-pill">Secure access</span>
              <span className="feature-pill">Admin managed</span>
              <span className="feature-pill">@vdartinc.com only</span>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Form */}
      <div className="auth-page__form-side">
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} style={{ width: '100%', maxWidth: '420px' }}>

          {sent ? (
            // Success state
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: '64px', height: '64px', background: '#DCFCE7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                <CheckCircle2 size={32} color="#059669" />
              </div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '12px' }}>Check your inbox!</h2>
              <p style={{ color: 'var(--text-dim)', marginBottom: '8px' }}>
                We sent a verification link to:
              </p>
              <p style={{ fontWeight: 700, color: 'var(--primary)', marginBottom: '24px' }}>{email}</p>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-dim)', marginBottom: '32px', lineHeight: 1.6 }}>
                Click the link in the email to verify your address. Once verified, the admin will activate your account and send your login details.
              </p>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                Didn't receive it?{' '}
                <button
                  onClick={() => setSent(false)}
                  style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem' }}
                >
                  Send again
                </button>
              </p>
            </div>
          ) : (
            // Email entry form
            <>
              <div style={{ marginBottom: 'var(--s-8)' }}>
                <h2 style={{ fontSize: '1.875rem', fontWeight: 800, marginBottom: 'var(--s-1)' }}>Get started</h2>
                <p style={{ color: 'var(--text-dim)' }}>Enter your company email to request access.</p>
              </div>

              <form onSubmit={handleSubmit} className="flex-col gap-6">
                <Input
                  label="Work Email"
                  placeholder="yourname@vdartinc.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  leftIcon={<Mail size={18} />}
                  type="email"
                  required
                />

                <div style={{ padding: '12px 16px', background: '#EFF6FF', borderRadius: 'var(--r-md)', fontSize: '0.82rem', color: '#1E40AF', lineHeight: 1.5 }}>
                  ℹ️ Only your email is needed. The admin will set your name, role, and password after verification.
                </div>

                <Button type="submit" isLoading={loading} style={{ width: '100%', height: '48px' }} rightIcon={<ArrowRight size={18} />}>
                  Send Verification Link
                </Button>
              </form>

              <p style={{ textAlign: 'center', marginTop: 'var(--s-8)', fontSize: '0.875rem', color: 'var(--text-dim)' }}>
                Already have an account?{' '}
                <Link to="/login" style={{ color: 'var(--text-main)', fontWeight: 700 }}>Sign in</Link>
              </p>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}
