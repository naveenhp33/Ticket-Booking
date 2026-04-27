import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Smartphone, Mail, Lock, ArrowRight, ChevronLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Button, Input } from '../ui';
import { motion } from 'framer-motion';

export default function MobileLoginPage() {
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(form.email, form.password);
      toast.success('Mobile Access Granted');
      navigate('/dashboard');
    } catch (err) {
      toast.error('Mobile authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      style={{ 
        minHeight: '100vh', 
        background: '#0F172A', 
        color: 'white',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <button 
        onClick={() => navigate('/login')}
        style={{ background: 'none', border: 'none', color: 'white', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '40px', padding: 0 }}
      >
        <ChevronLeft size={20} /> Back
      </button>

      <div style={{ textAlign: 'center', marginBottom: '48px' }}>
        <div style={{ 
          width: '64px', height: '64px', background: 'rgba(255,255,255,0.1)', 
          borderRadius: '20px', display: 'flex', alignItems: 'center', 
          justifyContent: 'center', margin: '0 auto 16px',
          border: '1px solid rgba(255,255,255,0.2)'
        }}>
          <Smartphone size={32} color="var(--primary-light)" />
        </div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 900, marginBottom: '8px' }}>TBS Mobile</h1>
        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem' }}>Secure Mobile Portal Access</p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div className="input-group">
          <label style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Corporate Email</label>
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.4)' }}>
              <Mail size={18} />
            </div>
            <input 
              type="email" 
              className="input" 
              placeholder="name@ndartinc.com"
              style={{ 
                width: '100%', padding: '16px 16px 16px 48px', 
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', 
                borderRadius: '16px', color: 'white', outline: 'none'
              }}
              value={form.email}
              onChange={e => setForm({...form, email: e.target.value})}
            />
          </div>
        </div>

        <div className="input-group">
          <label style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Access Key</label>
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.4)' }}>
              <Lock size={18} />
            </div>
            <input 
              type="password" 
              className="input" 
              placeholder="••••••••"
              style={{ 
                width: '100%', padding: '16px 16px 16px 48px', 
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', 
                borderRadius: '16px', color: 'white', outline: 'none'
              }}
              value={form.password}
              onChange={e => setForm({...form, password: e.target.value})}
            />
          </div>
        </div>

        <Button 
          type="submit" 
          isLoading={loading}
          style={{ 
            height: '56px', borderRadius: '16px', background: 'var(--primary)', 
            marginTop: '20px', fontWeight: 900, fontSize: '1rem' 
          }}
          rightIcon={<ArrowRight size={20} />}
        >
          Verify & Sign In
        </Button>
      </form>

      <div style={{ marginTop: 'auto', textAlign: 'center', padding: '24px 0', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <p style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>
          DEVICE AUTHORIZATION REQUIRED <br />
          SECURED BY NDART INC SECURITY
        </p>
      </div>
    </motion.div>
  );
}
