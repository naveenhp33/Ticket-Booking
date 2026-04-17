import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, ShieldCheck, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Button, Input, Card } from '../ui';
import { motion } from 'framer-motion';

export default function LoginPage() {
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) return toast.error('Please fill in all fields');

    setLoading(true);
    try {
      const res = await login(form.email, form.password);
      toast.success('Welcome back to TicketDesk');
      
      const role = res.role; // Assuming login returns user data with role
      if (['admin', 'support_agent'].includes(role)) {
        navigate('/dashboard');
      } else {
        navigate('/tickets');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      {/* Branding Panel */}
      <div className="auth-page__brand">
        <div className="auth-page__logo-fixed">
          <div className="flex-center" style={{ width: '32px', height: '32px', background: 'white', color: 'var(--primary)', borderRadius: 'var(--r-md)', fontWeight: 800 }}>T</div>
          TicketDesk
        </div>
        
        <div className="auth-page__brand-content">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="auth-page__tagline">The support hub for<br />modern teams.</h1>
            <p className="auth-page__tagline-sub">Streamline your IT requests and track resolutions in real-time with our premium management platform.</p>
            
            <div className="auth-page__features-pills">
               <span className="feature-pill">Real-time collaboration</span>
               <span className="feature-pill">Smart routing</span>
            </div>
          </motion.div>
        </div>
        
        <div style={{ position: 'absolute', bottom: '2rem', left: '2rem', fontSize: '0.75rem', opacity: 0.6, color: 'white' }}>
          &copy; 2024 VDart Inc. Technical Support Division.
        </div>
      </div>

      {/* Login Form Panel */}
      <div className="auth-page__form-side">
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
          <Card style={{ width: '100%', maxWidth: '420px', border: 'none', boxShadow: 'none', background: 'transparent' }}>
            <div style={{ marginBottom: 'var(--s-10)' }}>
              <h2 style={{ fontSize: '1.875rem', fontWeight: 800, marginBottom: 'var(--s-1)' }}>Welcome back</h2>
              <p style={{ color: 'var(--text-dim)' }}>Sign in to manage your support tickets.</p>
            </div>

            <form onSubmit={handleSubmit} className="flex-col gap-6">
              <Input 
                label="Work Email" 
                placeholder="name@vdartinc.com" 
                value={form.email} 
                onChange={e => setForm({...form, email: e.target.value})}
                leftIcon={<Mail size={18} />}
              />
              
              <div className="flex-col gap-1">
                <Input 
                  label="Password" 
                  type={showPassword ? 'text' : 'password'} 
                  placeholder="••••••••" 
                  value={form.password} 
                  onChange={e => setForm({...form, password: e.target.value})}
                  leftIcon={<Lock size={18} />}
                />
                <div style={{ textAlign: 'right' }}>
                  <Link to="/forgot-password" style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--primary)' }}>Forgot password?</Link>
                </div>
              </div>

              <Button type="submit" isLoading={loading} style={{ width: '100%' }} rightIcon={<ArrowRight size={18} />}>
                Continue to Dashboard
              </Button>

              <div style={{ textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-dim)', marginTop: 'var(--s-4)' }}>
                Need a new account? <Link to="/register" style={{ fontWeight: 700, color: 'var(--text-main)', borderBottom: '2px solid var(--primary-faint)' }}>Create one here</Link>
              </div>
            </form>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
