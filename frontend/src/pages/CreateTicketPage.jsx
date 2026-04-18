import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Send, 
  Paperclip, 
  Info, 
  AlertTriangle,
  ChevronLeft,
  CheckCircle2
} from 'lucide-react';
import { ticketService } from '../services/ticketService';
import { useToast } from '../context/ToastContext';
import { Button, Input, Card } from '../ui';
import { motion } from 'framer-motion';

const DEPARTMENTS = ['IT', 'HR', 'Finance', 'Admin', 'Operations', 'Marketing', 'Sales', 'Legal'];
const PRIORITIES = [
  { value: 'low', label: 'Low', color: '#10B981', desc: 'Non-critical issues, styling, etc.' },
  { value: 'medium', label: 'Medium', color: '#4F46E5', desc: 'Standard functional issues.' },
  { value: 'high', label: 'High', color: '#F59E0B', desc: 'Urgent issues affecting workflow.' },
  { value: 'critical', label: 'Critical', color: '#EF4444', desc: 'System blockers needing immediate attention.' }
];

export default function CreateTicketPage() {
  const navigate = useNavigate();
  const toast = useToast();
  
  const [form, setForm] = useState({
    title: '',
    description: '',
    department: '',
    priority: 'medium',
    category: 'IT'
  });
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState([]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.description || !form.department) {
      return toast.error('Please fill required fields');
    }

    setLoading(true);
    const formData = new FormData();
    Object.entries(form).forEach(([k, v]) => formData.append(k, v));
    files.forEach(file => formData.append('attachments', file));

    try {
      await ticketService.create(formData);
      toast.success('Ticket submitted successfully');
      navigate('/tickets');
    } catch (err) {
      toast.error('Failed to create ticket');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="page-layout"
      style={{ maxWidth: '900px', margin: '0 auto' }}
    >
      <div className="flex-between mb-8" style={{ marginBottom: 'var(--s-8)' }}>
        <div className="flex-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}><ChevronLeft size={20} /></Button>
          <div>
            <h1 style={{ fontSize: '1.5rem' }}>Raise New Ticket</h1>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.875rem' }}>Describe your issue and we'll route it to the right team.</p>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 'var(--s-8)' }}>
        <form onSubmit={handleSubmit} className="flex-col gap-6">
          <Card>
            <div className="flex-col gap-6">
              <Input 
                label="Subject / Title" 
                placeholder="Briefly describe the issue..."
                value={form.title}
                onChange={e => setForm({...form, title: e.target.value})}
                required
              />

              <div className="input-group">
                <label className="input-label">Issue Details</label>
                <textarea 
                  className="input" 
                  style={{ height: '160px', paddingTop: '12px', resize: 'vertical' }}
                  placeholder="Provide as much detail as possible. What happened? What were you doing?"
                  value={form.description}
                  onChange={e => setForm({...form, description: e.target.value})}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--s-4)' }}>
                <div className="input-group">
                  <label className="input-label">Target Department</label>
                  <select 
                    className="input"
                    value={form.department}
                    onChange={e => {
                      const dept = e.target.value;
                      setForm({...form, department: dept, category: dept});
                    }}
                    required
                  >
                    <option value="">Select Department</option>
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>

                <div className="input-group">
                  <label className="input-label">Category</label>
                  <select 
                    className="input"
                    value={form.category}
                    onChange={e => setForm({...form, category: e.target.value})}
                  >
                    <option value="IT">IT</option>
                    <option value="HR">HR</option>
                    <option value="Finance">Finance</option>
                    <option value="Admin">Admin</option>
                    <option value="Operations">Operations</option>
                    <option value="Marketing">Marketing</option>
                    <option value="Sales">Sales</option>
                    <option value="Legal">Legal</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="input-group">
                <label className="input-label">Attachments</label>
                <div 
                  className="flex-center flex-col gap-2"
                  style={{ 
                    border: '2px dashed var(--border)', 
                    borderRadius: 'var(--r-md)', 
                    padding: 'var(--s-8)',
                    cursor: 'pointer',
                    background: 'var(--bg)'
                  }}
                  onClick={() => document.getElementById('file-upload').click()}
                >
                  <Paperclip size={24} color="var(--text-dim)" />
                  <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>Click to upload files</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>PDF, JPG, PNG (Max 5MB)</span>
                  <input 
                    id="file-upload" 
                    type="file" 
                    multiple 
                    style={{ display: 'none' }} 
                    onChange={e => setFiles([...files, ...Array.from(e.target.files)])}
                  />
                </div>
                {files.length > 0 && (
                  <div className="flex-col gap-2" style={{ marginTop: 'var(--s-4)' }}>
                    {files.map((file, idx) => (
                      <div key={idx} className="flex-between" style={{ padding: 'var(--s-2) var(--s-3)', background: 'var(--surface-alt)', borderRadius: 'var(--r-sm)', fontSize: '0.8rem' }}>
                        <span className="flex-center gap-2"><CheckCircle2 size={14} color="var(--success)" /> {file.name}</span>
                        <button type="button" onClick={() => setFiles(files.filter((_, i) => i !== idx))} style={{ color: 'var(--danger)', fontWeight: 700 }}>×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </Card>

          <div className="flex-center gap-4" style={{ justifyContent: 'flex-end', marginTop: 'var(--s-4)' }}>
            <Button variant="ghost" onClick={() => navigate(-1)}>Cancel</Button>
            <Button size="lg" type="submit" isLoading={loading} rightIcon={<Send size={18} />}>Submit Request</Button>
          </div>
        </form>

        <div className="flex-col gap-6">
          <Card title="Issue Priority">
            <div className="flex-col gap-4">
              {PRIORITIES.map(p => (
                <label 
                  key={p.value} 
                  className="flex-col gap-1" 
                  style={{ 
                    padding: 'var(--s-3)', 
                    border: `1px solid ${form.priority === p.value ? p.color : 'var(--border)'}`, 
                    borderRadius: 'var(--r-md)', 
                    cursor: 'pointer',
                    background: form.priority === p.value ? `${p.color}08` : 'transparent',
                    transition: 'var(--t-fast)'
                  }}
                >
                  <input 
                    type="radio" 
                    name="priority" 
                    value={p.value} 
                    checked={form.priority === p.value}
                    onChange={e => setForm({...form, priority: e.target.value})}
                    style={{ position: 'absolute', opacity: 0 }}
                  />
                  <div className="flex-center gap-2" style={{ fontWeight: 700, color: p.color }}>
                    <AlertTriangle size={14} /> {p.label}
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', lineHeight: 1.4 }}>{p.desc}</p>
                </label>
              ))}
            </div>
          </Card>

          <Card title="Support Tip" style={{ background: '#EEF2FF' }}>
            <div className="flex-center gap-3">
              <Info size={20} color="var(--primary)" />
              <p style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 600 }}>Attaching screenshots of the error helps our team resolve issues 40% faster.</p>
            </div>
          </Card>
        </div>
      </div>
    </motion.div>
  );
}
