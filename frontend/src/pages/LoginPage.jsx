import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, ArrowRight, ShieldCheck, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Button, Input } from '../ui';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';

export default function LoginPage() {
  const { loginWithToken } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [step, setStep]         = useState('email');
  const [email, setEmail]       = useState('');
  const [otp, setOtp]           = useState(['', '', '', '', '', '']);
  const [loading, setLoading]   = useState(false);
  const [resending, setResending] = useState(false);
  const [devCode, setDevCode]   = useState(null);
  const inputRefs = useRef([]);

  const handleSendOtp = async (e) => {
    e?.preventDefault();
    if (!email.trim()) return toast.error('Please enter your work email');
    if (!email.toLowerCase().endsWith('@vdartinc.com'))
      return toast.error('Only @vdartinc.com emails are accepted');

    setLoading(true);
    try {
      const res = await api.post('/auth/send-otp', { email });
      // ── DEV BACKDOOR: auto-fill OTP if returned directly ──
      if (res.data.devCode) {
        setDevCode(res.data.devCode);
        setOtp(res.data.devCode.toString().split(''));
      }
      // ── END DEV BACKDOOR ──
      toast.success('Code sent! Check your email inbox.');
      setStep('otp');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send code');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setOtp(['', '', '', '', '', '']);
    try {
      await api.post('/auth/send-otp', { email });
      toast.success('New code sent!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to resend');
    } finally {
      setResending(false);
    }
  };

  const handleOtpChange = (index, value) => {
    if (value && !/^\d$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
    if (value && index === 5) {
      const full = newOtp.join('');
      if (full.length === 6) handleVerifyOtp(full);
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0)
      inputRefs.current[index - 1]?.focus();
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setOtp(pasted.split(''));
      handleVerifyOtp(pasted);
    }
  };

  const handleVerifyOtp = async (code) => {
    const otpCode = code || otp.join('');
    if (otpCode.length !== 6) return toast.error('Please enter the full 6-digit code');

    setLoading(true);
    try {
      const res = await api.post('/auth/verify-otp', { email, otp: otpCode });
      loginWithToken(res.data.token, res.data.user);
      toast.success(`Welcome back, ${res.data.user.name || 'there'}!`);
      const role = res.data.user.role;
      navigate(['admin', 'support_agent'].includes(role) ? '/dashboard' : '/tickets');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Incorrect code. Please try again.');
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      {/* Branding Panel */}
      <div className="auth-page__brand">
        <div className="auth-page__logo-fixed">
          <div className="flex-center" style={{ width: '32px', height: '32px', background: 'white', color: 'var(--primary)', borderRadius: 'var(--r-md)', fontWeight: 800 }}>V</div>
          VDesk
        </div>
        <div className="auth-page__brand-content">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="auth-page__tagline">The support hub for<br />modern teams.</h1>
            <p className="auth-page__tagline-sub">Sign in with just your email — no password needed. We'll send you a secure code.</p>
            <div className="auth-page__features-pills">
              <span className="feature-pill">No password needed</span>
              <span className="feature-pill">Secure OTP login</span>
            </div>
          </motion.div>
        </div>
        <div style={{ position: 'absolute', bottom: '2rem', left: '2rem', fontSize: '0.75rem', opacity: 0.6, color: 'white' }}>
          © 2024 VDart Inc. Technical Support Division.
        </div>
      </div>

      {/* Form Panel */}
      <div className="auth-page__form-side">
        <AnimatePresence mode="wait">

          {/* Step 1 — Email */}
          {step === 'email' && (
            <motion.div
              key="email"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              style={{ width: '100%', maxWidth: '420px' }}
            >
              <div style={{ marginBottom: 'var(--s-8)' }}>
                <h2 style={{ fontSize: '1.875rem', fontWeight: 800, marginBottom: 'var(--s-1)' }}>Welcome back</h2>
                <p style={{ color: 'var(--text-dim)' }}>Enter your work email and we'll send you a sign-in code.</p>
              </div>

              <form onSubmit={handleSendOtp} className="flex-col gap-5">
                <Input
                  label="Work Email"
                  placeholder="yourname@vdartinc.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  leftIcon={<Mail size={18} />}
                  type="email"
                  required
                />
                <Button type="submit" isLoading={loading} style={{ width: '100%', height: '48px' }} rightIcon={<ArrowRight size={18} />}>
                  Send Sign-in Code
                </Button>
              </form>
            </motion.div>
          )}

          {/* Step 2 — OTP */}
          {step === 'otp' && (
            <motion.div
              key="otp"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              style={{ width: '100%', maxWidth: '420px' }}
            >
              <div style={{ marginBottom: 'var(--s-8)' }}>
                <div style={{ width: '52px', height: '52px', background: '#EFF6FF', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
                  <ShieldCheck size={26} color="var(--primary)" />
                </div>
                <h2 style={{ fontSize: '1.875rem', fontWeight: 800, marginBottom: '8px' }}>Check your email</h2>
                <p style={{ color: 'var(--text-dim)', lineHeight: 1.6 }}>
                  We sent a 6-digit code to<br />
                  <strong style={{ color: 'var(--text-main)' }}>{email}</strong>
                </p>
              </div>

              {/* DEV BACKDOOR BANNER — remove before production */}
              {devCode && (
                <div style={{
                  background: '#FFF8E1', border: '1.5px dashed #F59E0B',
                  borderRadius: '10px', padding: '12px 16px', marginBottom: '20px',
                  fontSize: '0.85rem', color: '#92400E'
                }}>
                  <strong>⚠️ Dev Mode:</strong> Use code{' '}
                  <code style={{ fontWeight: 900, fontSize: '1.1rem', letterSpacing: '4px', color: '#1F4E79' }}>
                    {devCode}
                  </code>
                  {' '}to login.
                  <button
                    onClick={() => { navigator.clipboard.writeText(devCode); toast.success('Copied!'); }}
                    style={{ marginLeft: '10px', background: '#1F4E79', color: 'white', border: 'none', borderRadius: '6px', padding: '3px 10px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700 }}
                  >
                    Copy
                  </button>
                </div>
              )}
              {/* END DEV BACKDOOR BANNER */}

              {/* 6-box OTP input */}
              <div style={{ display: 'flex', gap: '10px', marginBottom: '28px' }} onPaste={handleOtpPaste}>
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    ref={el => inputRefs.current[i] = el}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={e => handleOtpChange(i, e.target.value)}
                    onKeyDown={e => handleOtpKeyDown(i, e)}
                    autoFocus={i === 0}
                    style={{
                      width: '52px', height: '60px',
                      textAlign: 'center', fontSize: '1.5rem', fontWeight: 800,
                      border: `2px solid ${digit ? '#1F4E79' : 'var(--border)'}`,
                      borderRadius: '10px',
                      background: digit ? '#EFF6FF' : 'var(--bg)',
                      color: 'var(--text-main)', outline: 'none',
                      transition: 'all 0.15s', fontFamily: 'monospace'
                    }}
                    onFocus={e => e.target.style.borderColor = '#1F4E79'}
                    onBlur={e => e.target.style.borderColor = digit ? '#1F4E79' : 'var(--border)'}
                  />
                ))}
              </div>

              <Button
                onClick={() => handleVerifyOtp()}
                isLoading={loading}
                disabled={otp.join('').length !== 6}
                style={{ width: '100%', height: '48px', marginBottom: '20px' }}
                rightIcon={<ArrowRight size={18} />}
              >
                Verify & Sign In
              </Button>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                <button
                  onClick={() => { setStep('email'); setOtp(['', '', '', '', '', '']); setDevCode(null); }}
                  style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '0.875rem' }}
                >
                  ← Change email
                </button>
                <button
                  onClick={handleResend}
                  disabled={resending}
                  style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 700, cursor: 'pointer', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <RefreshCw size={14} /> {resending ? 'Sending...' : 'Resend code'}
                </button>
              </div>

              <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '20px', textAlign: 'center' }}>
                Code expires in 5 minutes. Check your spam folder if you don't see it.
              </p>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
