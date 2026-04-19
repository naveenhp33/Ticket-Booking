import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Button, Input, Card } from '../ui';
import { motion } from 'framer-motion';
import { UserPlus, Mail, Lock, User, Hash, Briefcase, Building2, ShieldCheck, ArrowRight } from 'lucide-react';

export default function RegisterPage() {
  const { register } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState({ 
    fullName: '', 
    employeeId: '', 
    workEmail: '', 
    department: '', 
    designation: '', 
    password: '' 
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.fullName.trim()) return toast.error('Full name is required');
    if (!form.workEmail.includes('@') || !form.workEmail.includes('.')) return toast.error('Please enter a valid email address');
    if (!form.employeeId.trim()) return toast.error('Employee ID is required');
    if (!form.department) return toast.error('Please select a department');
    if (!form.designation.trim()) return toast.error('Designation is required');
    if (form.password.length < 8) return toast.error('Password must be at least 8 characters');

    setLoading(true);
    try {
      await register(form);
      toast.success('Account activated! Welcome aboard.');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally { setLoading(false); }
  };

  return (
    <div className="auth-page">
      {/* Left Column: Branding */}
      <div className="auth-page__brand">
        <div className="auth-page__logo-fixed">
          <div className="flex-center" style={{ width: '32px', height: '32px', background: 'white', color: 'var(--primary)', borderRadius: 'var(--r-md)', fontWeight: 800 }}>T</div>
          TicketDesk
        </div>
        
        <div className="auth-page__brand-content">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="auth-page__tagline">Empowering your support<br />workflow.</h1>
            <p className="auth-page__tagline-sub">Join thousands of VDartians who use TicketDesk to resolve IT hurdles efficiently and collaboratively.</p>
            
            <div className="auth-page__features-pills">
              <span className="feature-pill">Internal Knowledge Base</span>
              <span className="feature-pill">Real-time Dashboard</span>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Right Column: Multi-column Form */}
      <div className="auth-page__form-side">
        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} style={{ width: '100%', maxWidth: '520px' }}>
          <div style={{ marginBottom: 'var(--s-8)' }}>
            <h2 style={{ fontSize: '1.875rem', fontWeight: 800, marginBottom: 'var(--s-1)' }}>Create account</h2>
            <p style={{ color: 'var(--text-dim)' }}>Access the IT support ecosystem within seconds.</p>
          </div>

          <form onSubmit={handleSubmit} className="flex-col gap-5">
            <Input 
              label="Full Name" 
              placeholder="Enter your full name" 
              value={form.fullName} 
              onChange={e => setForm({...form, fullName: e.target.value})}
              leftIcon={<User size={18} />}
            />
            
            <div className="form-grid-2">
              <Input 
                label="Work Email" 
                placeholder="name@vdartinc.com" 
                value={form.workEmail} 
                onChange={e => setForm({...form, workEmail: e.target.value})}
                leftIcon={<Mail size={18} />}
              />
              <Input 
                label="Employee ID" 
                placeholder="VDT-000" 
                value={form.employeeId} 
                onChange={e => setForm({...form, employeeId: e.target.value})}
                leftIcon={<Hash size={18} />}
              />
            </div>

            <div className="form-grid-2">
               <div className="input-group">
                 <label className="input-label">Department</label>
                 <select className="input" value={form.department} onChange={e => setForm({...form, department: e.target.value})}>
                   <option value="">Select Dept</option>
                   {['IT', 'HR', 'Finance', 'Admin', 'Operations', 'Marketing'].map(d => <option key={d} value={d}>{d}</option>)}
                 </select>
               </div>
               <Input 
                label="Designation" 
                placeholder="e.g. Developer" 
                value={form.designation} 
                onChange={e => setForm({...form, designation: e.target.value})}
                leftIcon={<Briefcase size={18} />}
              />
            </div>

            <Input 
              label="Secure Password" 
              type="password" 
              placeholder="••••••••" 
              value={form.password} 
              onChange={e => setForm({...form, password: e.target.value})}
              leftIcon={<Lock size={18} />}
            />

            <Button type="submit" isLoading={loading} style={{ width: '100%', height: '48px', marginTop: 'var(--s-4)' }} rightIcon={<ArrowRight size={18} />}>
              Activate Member Account
            </Button>
          </form>

          <p style={{ textAlign: 'center', marginTop: 'var(--s-8)', fontSize: '0.875rem', color: 'var(--text-dim)' }}>
            Already registered? <Link to="/login" style={{ color: 'var(--text-main)', fontWeight: 700 }}>Sign in instead</Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
