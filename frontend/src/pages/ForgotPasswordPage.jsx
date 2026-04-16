import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, Send } from 'lucide-react';
import { Button, Input, Card } from '../components/ui';
import { motion } from 'framer-motion';
import api from '../services/api';
import { useToast } from '../context/ToastContext';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const toast = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
      toast.success('Reset link sent!');
    } catch (err) {
      toast.error('Failed to send link');
    } finally { setLoading(false); }
  };

  return (
    <div className="app-shell flex-center" style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
        <Card style={{ width: '400px', padding: 'var(--s-10)' }}>
          {!sent ? (
            <>
              <div style={{ textAlign: 'center', marginBottom: 'var(--s-8)' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Forgot Password?</h1>
                <p style={{ color: 'var(--text-dim)', fontSize: '0.875rem' }}>Enter your email and we'll send a link to reset your password.</p>
              </div>
              <form onSubmit={handleSubmit} className="flex-col gap-4">
                <Input 
                  label="Work Email" 
                  placeholder="name@vdartinc.com" 
                  value={email} 
                  onChange={e => setEmail(e.target.value)} 
                  leftIcon={<Mail size={18} />}
                />
                <Button type="submit" isLoading={loading} style={{ width: '100%' }} rightIcon={<Send size={18} />}>Send Reset Link</Button>
                <Link to="/login" className="flex-center gap-2" style={{ fontSize: '0.875rem', color: 'var(--text-dim)', marginTop: 'var(--s-4)' }}>
                  <ArrowLeft size={16} /> Back to Sign in
                </Link>
              </form>
            </>
          ) : (
            <div style={{ textAlign: 'center' }}>
               <div className="flex-center" style={{ width: '64px', height: '64px', background: 'var(--primary-light)', color: 'var(--primary)', borderRadius: '50%', margin: '0 auto var(--s-6)' }}>
                  <Mail size={32} />
               </div>
               <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: 'var(--s-2)' }}>Check your email</h2>
               <p style={{ color: 'var(--text-dim)', fontSize: '0.875rem', marginBottom: 'var(--s-8)' }}>We've sent a password reset link to <strong>{email}</strong>.</p>
               <Button variant="outline" style={{ width: '100%' }} onClick={() => setSent(false)}>Resend Link</Button>
               <Link to="/login" className="flex-center gap-2" style={{ fontSize: '0.875rem', color: 'var(--text-dim)', marginTop: 'var(--s-4)' }}>
                  <ArrowLeft size={16} /> Back to Sign in
               </Link>
            </div>
          )}
        </Card>
      </motion.div>
    </div>
  );
}
