import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import api from '../services/api';
import { useToast } from '../context/ToastContext';

export default function AdminReports() {
  const toast = useToast();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard/reports')
      .then(res => setData(res.data))
      .catch(() => toast.error('Failed to load reports'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div className="spinner" style={{ width: '36px', height: '36px', borderWidth: '3px' }} />
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="page-layout">
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '1.875rem', fontWeight: 800 }}>
          <i className="fa-solid fa-chart-bar" style={{ color: '#1F4E79', marginRight: '10px' }} />
          Reports
        </h1>
        <p style={{ color: 'var(--text-dim)' }}>Performance metrics and resolution summaries.</p>
      </div>

      {/* KPI Cards */}
      <div className="dashboard-grid" style={{ marginBottom: '32px' }}>
        {[
          { label: 'Avg Resolution Time', value: `${data?.avgResolutionHours || 0} hrs`, icon: 'fa-clock', color: '#1F4E79' },
          { label: 'SLA Compliance Rate', value: `${data?.slaComplianceRate || 100}%`,   icon: 'fa-shield-halved', color: '#10B981' },
          { label: 'Top Issue Type',       value: data?.topCategories?.[0]?._id || '—',   icon: 'fa-tag', color: '#F59E0B' },
        ].map(card => (
          <div key={card.label} style={{ background: 'white', borderRadius: '16px', padding: '24px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase' }}>{card.label}</span>
              <i className={`fa-solid ${card.icon}`} style={{ color: card.color, fontSize: '1.1rem' }} />
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 900, color: card.color }}>{card.value}</div>
          </div>
        ))}
      </div>

      <div className="split-grid" style={{ marginBottom: '32px' }}>
        {/* Top Issue Categories */}
        <div style={{ background: 'white', borderRadius: '16px', padding: '24px', border: '1px solid var(--border)' }}>
          <h3 style={{ fontWeight: 800, marginBottom: '20px', fontSize: '1rem' }}>
            <i className="fa-solid fa-fire" style={{ color: '#F59E0B', marginRight: '8px' }} />
            Top Issue Categories
          </h3>
          <div className="ent-table-wrap">
            <table className="ent-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th className="col-center" style={{ width: '100px' }}>Tickets</th>
                </tr>
              </thead>
              <tbody>
                {(data?.topCategories || []).map((c, i) => (
                  <tr key={c._id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ width: '22px', height: '22px', background: '#1F4E79', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 800, flexShrink: 0 }}>{i + 1}</span>
                        {c._id || 'Other'}
                      </div>
                    </td>
                    <td className="col-center" style={{ fontWeight: 700, color: '#1F4E79' }}>{c.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* SLA Summary */}
        <div style={{ background: 'white', borderRadius: '16px', padding: '24px', border: '1px solid var(--border)' }}>
          <h3 style={{ fontWeight: 800, marginBottom: '20px', fontSize: '1rem' }}>
            <i className="fa-solid fa-shield-halved" style={{ color: '#10B981', marginRight: '8px' }} />
            SLA Performance
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ textAlign: 'center', padding: '24px', background: 'var(--bg)', borderRadius: '12px' }}>
              <div style={{ fontSize: '3rem', fontWeight: 900, color: parseFloat(data?.slaComplianceRate) >= 80 ? '#10B981' : '#EF4444' }}>
                {data?.slaComplianceRate || 100}%
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-dim)', marginTop: '4px' }}>SLA Compliance Rate</div>
            </div>
            <div style={{ padding: '16px', background: '#EFF6FF', borderRadius: '10px', fontSize: '0.85rem', color: '#1E40AF', lineHeight: 1.6 }}>
              <i className="fa-solid fa-circle-info" style={{ marginRight: '6px' }} />
              Average resolution time is <strong>{data?.avgResolutionHours || 0} hours</strong>. Tickets resolved within SLA deadline count toward compliance.
            </div>
          </div>
        </div>
      </div>

      {/* Agent Performance Table */}
      <div style={{ background: 'white', borderRadius: '16px', padding: '24px', border: '1px solid var(--border)' }}>
        <h3 style={{ fontWeight: 800, marginBottom: '20px', fontSize: '1rem' }}>
          <i className="fa-solid fa-ranking-star" style={{ color: '#1F4E79', marginRight: '8px' }} />
          Agent Performance
        </h3>
        <div className="ent-table-wrap">
          <table className="ent-table">
            <thead>
              <tr>
                <th>Agent</th>
                <th style={{ width: '200px' }}>Email</th>
                <th className="col-center" style={{ width: '120px' }}>Tickets Resolved</th>
                <th className="col-center" style={{ width: '120px' }}>Avg Rating</th>
              </tr>
            </thead>
            <tbody>
              {(data?.agentPerformance || []).length === 0 ? (
                <tr><td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '32px' }}>No resolved tickets yet.</td></tr>
              ) : (data?.agentPerformance || []).map((a, i) => (
                <tr key={a._id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ width: '22px', height: '22px', background: i === 0 ? '#F59E0B' : 'var(--bg)', color: i === 0 ? 'white' : 'var(--text-dim)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 800, flexShrink: 0 }}>{i + 1}</span>
                      <span style={{ fontWeight: 700 }}>{a.name}</span>
                    </div>
                  </td>
                  <td style={{ color: 'var(--text-dim)', fontSize: '0.82rem' }}>{a.email}</td>
                  <td className="col-center" style={{ fontWeight: 700, color: '#1F4E79' }}>{a.resolved}</td>
                  <td className="col-center">
                    {a.avgRating ? (
                      <span style={{ color: '#F59E0B', fontWeight: 700 }}>
                        <i className="fa-solid fa-star" style={{ marginRight: '4px' }} />
                        {a.avgRating.toFixed(1)}
                      </span>
                    ) : <span style={{ color: 'var(--text-dim)' }}>—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}
