import { useState, useEffect } from 'react';
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
import { motion, AnimatePresence } from 'framer-motion';
import { useDebounce } from '../hooks/useDebounce';

const DEPARTMENTS = ['IT', 'HR', 'Finance', 'Admin', 'Operations', 'Marketing', 'Sales', 'Legal'];
const SHIFTS = [
  { value: 'morning',   label: ' Morning Shift',   time: '9:00 AM – 1:00 PM' },
  { value: 'afternoon', label: ' Afternoon Shift', time: '2:00 PM – 6:00 PM' },
  { value: 'night',     label: ' Night Shift',     time: '6:00 PM – 6:00 AM' },
];
const PRIORITIES = [
  { value: 'low',      label: ' Low',      color: '#10B981', desc: 'Not urgent — can wait a few days.' },
  { value: 'medium',   label: ' Medium',   color: '#4F46E5', desc: 'Needs attention but not blocking work.' },
  { value: 'high',     label: ' High',     color: '#F59E0B', desc: 'Blocking my work — needs fixing today.' },
  { value: 'critical', label: ' Critical', color: '#EF4444', desc: 'Everything is stopped — fix this right now!' },
];

export default function CreateTicketPage() {
  const navigate = useNavigate();
  const toast = useToast();
  
  const [form, setForm] = useState({
    title: '',
    description: '',
    department: '',
    priority: 'medium',
    category: 'IT',
    teamName: '',
    shift: '',
    workLocation: ''
  });
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState([]);

  const [similarTickets, setSimilarTickets] = useState([]);
  const [isSearchingSimilar, setIsSearchingSimilar] = useState(false);
  const debouncedTitle = useDebounce(form.title, 600);

  useEffect(() => {
    if (debouncedTitle.trim().length > 4) {
      setIsSearchingSimilar(true);
      ticketService.findSimilar({ title: debouncedTitle, category: form.category })
        .then(res => {
          setSimilarTickets(res.data.tickets || []);
          setIsSearchingSimilar(false);
        })
        .catch(() => setIsSearchingSimilar(false));
    } else {
      setSimilarTickets([]);
    }
  }, [debouncedTitle, form.category]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.description || !form.department) {
      return toast.error('Please fill in all required fields');
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
      style={{ maxWidth: '960px', margin: '0 auto' }}
    >
      <div className="flex-between mb-8" style={{ marginBottom: 'var(--s-6)' }}>
        <div className="flex-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}><ChevronLeft size={20} /></Button>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Report a Problem</h1>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.875rem', marginTop: '2px' }}>Tell us what's wrong and we'll get the right team to help you.</p>
          </div>
        </div>
      </div>

      <div className="create-ticket-grid">
        <form onSubmit={handleSubmit} className="flex-col gap-6">
          <Card>
            <div className="flex-col" style={{ gap: 'var(--s-5)', padding: 'var(--s-2)' }}>
              <div className="flex-col gap-1">
                <Input 
                  label="What's the problem? (Short title)" 
                  placeholder="e.g. My laptop won't turn on, Can't access email..."
                  value={form.title}
                  onChange={e => setForm({...form, title: e.target.value})}
                  required
                />
                
                <AnimatePresence>
                  {similarTickets.length > 0 && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      style={{ 
                        marginTop: '8px', 
                        padding: '12px', 
                        background: '#FFFBEB', 
                        border: '1px solid #FDE68A', 
                        borderRadius: 'var(--r-md)',
                        fontSize: '0.85rem',
                        overflow: 'hidden'
                      }}
                    >
                      <div className="flex-center gap-2" style={{ color: '#D97706', fontWeight: 700, marginBottom: '12px' }}>
                        <AlertTriangle size={16} /> 
                        {similarTickets.length} similar ticket{similarTickets.length > 1 ? 's' : ''} found — are any of these your issue?
                      </div>
                      <div className="flex-col gap-2">
                        {similarTickets.map(t => (
                          <div 
                            key={t._id} 
                            onClick={() => window.open(`/tickets/${t._id}`, '_blank')}
                            style={{ 
                              padding: '8px 12px', 
                              background: '#fff', 
                              border: '1px solid #FDE68A', 
                              borderRadius: '6px', 
                              cursor: 'pointer',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              transition: 'all 0.2s'
                            }}
                            onMouseOver={e => { e.currentTarget.style.backgroundColor = '#FEF3C7'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                            onMouseOut={e => { e.currentTarget.style.backgroundColor = '#fff'; e.currentTarget.style.transform = 'translateY(0)'; }}
                          >
                            <span style={{ fontWeight: 600, color: 'var(--text-dark)' }}>{t.title}</span>
                            <span style={{ color: 'var(--text-dim)', textTransform: 'capitalize', fontSize: '0.75rem', fontWeight: 600 }}>{t.status.replace('_', ' ')}</span>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="input-group">
                <label className="input-label">Describe the problem in detail <span style={{ color: 'var(--danger)' }}>*</span></label>
                <textarea 
                  className="input" 
                  style={{ height: '140px' }}
                  placeholder="What happened? When did it start? What were you doing at the time?"
                  value={form.description}
                  onChange={e => setForm({...form, description: e.target.value})}
                  required
                />
              </div>

              <div className="form-grid-2">
                <div className="input-group">
                  <label className="input-label">Which team should handle this? <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <select 
                    className="input"
                    value={form.department}
                    onChange={e => {
                      const dept = e.target.value;
                      setForm({...form, department: dept, category: dept});
                    }}
                    required
                  >
                    <option value="">Select a team</option>
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>

                <div className="input-group">
                  <label className="input-label">Your Team Name</label>
                  <input
                    className="input"
                    placeholder="e.g. Sales North, Dev Team B"
                    value={form.teamName}
                    onChange={e => setForm({...form, teamName: e.target.value})}
                  />
                </div>
              </div>

              <div className="form-grid-2">
                <div className="input-group">
                  <label className="input-label">Your Work Shift</label>
                  <select
                    className="input"
                    value={form.shift}
                    onChange={e => setForm({...form, shift: e.target.value})}
                  >
                    <option value="">Select your shift</option>
                    {SHIFTS.map(s => (
                      <option key={s.value} value={s.value}>{s.label} ({s.time})</option>
                    ))}
                  </select>
                </div>

                <div className="input-group">
                  <label className="input-label">Where are you working from?</label>
                  <select
                    className="input"
                    value={form.workLocation}
                    onChange={e => setForm({...form, workLocation: e.target.value})}
                  >
                    <option value="">Select location</option>
                    <option value="office">🏢 Office</option>
                    <option value="remote">🏠 Working from Home (Remote)</option>
                  </select>
                </div>
              </div>

              <div className="input-group">
                <label className="input-label">Attach a screenshot or file <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}>(optional)</span></label>
                <div 
                  style={{ 
                    border: '2px dashed var(--border)', 
                    borderRadius: 'var(--r-md)', 
                    padding: 'var(--s-6)',
                    cursor: 'pointer',
                    background: 'var(--bg)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'border-color var(--t-fast)'
                  }}
                  onClick={() => document.getElementById('file-upload').click()}
                >
                  <Paperclip size={22} color="var(--text-dim)" />
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-main)' }}>Click to upload a file</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Screenshots, photos, PDFs (Max 5MB)</span>
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

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--s-3)', marginTop: 'var(--s-2)' }}>
            <Button variant="ghost" onClick={() => navigate(-1)}>Go Back</Button>
            <Button size="lg" type="submit" isLoading={loading} rightIcon={<Send size={18} />}>Send My Request</Button>
          </div>
        </form>

        <div className="flex-col gap-5">
          <Card title="How urgent is this?">
            <div className="flex-col" style={{ gap: 'var(--s-3)' }}>
              {PRIORITIES.map(p => (
                <label 
                  key={p.value}
                  style={{ 
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    padding: '10px 14px', 
                    border: `2px solid ${form.priority === p.value ? p.color : 'var(--border)'}`, 
                    borderRadius: 'var(--r-md)', 
                    cursor: 'pointer',
                    background: form.priority === p.value ? `${p.color}10` : 'var(--bg)',
                    transition: 'all var(--t-fast)'
                  }}
                >
                  <input 
                    type="radio" 
                    name="priority" 
                    value={p.value} 
                    checked={form.priority === p.value}
                    onChange={e => setForm({...form, priority: e.target.value})}
                    style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '0.9rem', color: form.priority === p.value ? p.color : 'var(--text-main)' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: p.color, flexShrink: 0, display: 'inline-block' }} />
                    {p.label}
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', lineHeight: 1.4, paddingLeft: '18px' }}>{p.desc}</p>
                </label>
              ))}
            </div>
          </Card>

          <Card title="💡 Quick Tip" style={{ background: '#EEF2FF' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <Info size={18} color="var(--primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
              <p style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 600, lineHeight: 1.5 }}>Adding a screenshot helps our team fix your problem much faster!</p>
            </div>
          </Card>
        </div>
      </div>
    </motion.div>
  );
}
