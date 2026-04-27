import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import api from '../services/api';
import { useToast } from '../context/ToastContext';

const PRIORITY_COLORS = { critical: '#EF4444', high: '#F59E0B', medium: '#4F46E5', low: '#10B981' };
const STATUS_COLORS   = { open: '#3B82F6', assigned: '#8B5CF6', in_progress: '#F59E0B', resolved: '#10B981', closed: '#6B7280', pending_confirmation: '#EC4899', reopened: '#EF4444' };

export default function AdminAnalytics() {
  const toast = useToast();
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard/analytics')
      .then(res => setData(res.data))
      .catch(() => toast.error('Failed to load analytics'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div className="spinner" style={{ width: '36px', height: '36px', borderWidth: '3px' }} />
    </div>
  );

  const total = data?.totalTickets || 0;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="page-layout">
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '1.875rem', fontWeight: 800 }}>
          <i className="fa-solid fa-chart-line" style={{ color: '#1F4E79', marginRight: '10px' }} />
          Analytics
        </h1>
        <p style={{ color: 'var(--text-dim)' }}>System-wide ticket trends and breakdowns.</p>
      </div>

      {/* KPI Cards */}
      <div className="dashboard-grid-4" style={{ marginBottom: '32px' }}>
        {[
          { label: 'Total Tickets', value: total, icon: 'fa-ticket', color: '#1F4E79' },
          { label: 'Open',     value: data?.statusBreakdown?.find(s => s._id === 'open')?.count || 0,     icon: 'fa-folder-open', color: '#3B82F6' },
          { label: 'Resolved', value: data?.statusBreakdown?.find(s => s._id === 'resolved')?.count || 0, icon: 'fa-circle-check', color: '#10B981' },
          { label: 'Critical',  value: data?.priorityBreakdown?.find(p => p._id === 'critical')?.count || 0, icon: 'fa-triangle-exclamation', color: '#EF4444' },
        ].map(card => (
          <div key={card.label} style={{ background: 'white', borderRadius: '16px', padding: '24px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase' }}>{card.label}</span>
              <i className={`fa-solid ${card.icon}`} style={{ color: card.color, fontSize: '1.1rem' }} />
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 900, color: card.color }}>{card.value}</div>
          </div>
        ))}
      </div>

      <div className="split-grid" style={{ marginBottom: '32px' }}>
        {/* Status Breakdown */}
        <div style={{ background: 'white', borderRadius: '16px', padding: '24px', border: '1px solid var(--border)' }}>
          <h3 style={{ fontWeight: 800, marginBottom: '20px', fontSize: '1rem' }}>
            <i className="fa-solid fa-chart-bar" style={{ color: '#1F4E79', marginRight: '8px' }} />
            Tickets by Status
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {(data?.statusBreakdown || []).map(s => {
              const pct = total ? ((s.count / total) * 100).toFixed(1) : 0;
              const color = STATUS_COLORS[s._id] || '#94A3B8';
              return (
                <div key={s._id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.85rem' }}>
                    <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{s._id.replace(/_/g, ' ')}</span>
                    <span style={{ fontWeight: 700, color }}>{s.count} <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}>({pct}%)</span></span>
                  </div>
                  <div style={{ height: '8px', background: 'var(--bg)', borderRadius: '99px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '99px', transition: 'width 0.6s ease' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Priority Breakdown */}
        <div style={{ background: 'white', borderRadius: '16px', padding: '24px', border: '1px solid var(--border)' }}>
          <h3 style={{ fontWeight: 800, marginBottom: '20px', fontSize: '1rem' }}>
            <i className="fa-solid fa-gauge-high" style={{ color: '#1F4E79', marginRight: '8px' }} />
            Tickets by Priority
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {(data?.priorityBreakdown || []).map(p => {
              const pct = total ? ((p.count / total) * 100).toFixed(1) : 0;
              const color = PRIORITY_COLORS[p._id] || '#94A3B8';
              return (
                <div key={p._id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.85rem' }}>
                    <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{p._id}</span>
                    <span style={{ fontWeight: 700, color }}>{p.count} <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}>({pct}%)</span></span>
                  </div>
                  <div style={{ height: '8px', background: 'var(--bg)', borderRadius: '99px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '99px', transition: 'width 0.6s ease' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Category Breakdown */}
      <div style={{ background: 'white', borderRadius: '16px', padding: '24px', border: '1px solid var(--border)' }}>
        <h3 style={{ fontWeight: 800, marginBottom: '20px', fontSize: '1rem' }}>
          <i className="fa-solid fa-layer-group" style={{ color: '#1F4E79', marginRight: '8px' }} />
          Tickets by Department / Category
        </h3>
        <div className="ent-table-wrap">
          <table className="ent-table">
            <thead>
              <tr>
                <th>Category</th>
                <th className="col-center" style={{ width: '120px' }}>Count</th>
                <th style={{ width: '60%' }}>Distribution</th>
              </tr>
            </thead>
            <tbody>
              {(data?.categoryBreakdown || []).map(c => {
                const pct = total ? ((c.count / total) * 100).toFixed(1) : 0;
                return (
                  <tr key={c._id}>
                    <td style={{ fontWeight: 600 }}>{c._id || 'Other'}</td>
                    <td className="col-center" style={{ fontWeight: 700, color: '#1F4E79' }}>{c.count}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ flex: 1, height: '8px', background: 'var(--bg)', borderRadius: '99px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: '#1F4E79', borderRadius: '99px' }} />
                        </div>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', width: '40px', textAlign: 'right' }}>{pct}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}
