import { useState, useEffect } from 'react';
import { 
  Ticket, 
  Clock, 
  CheckCircle2, 
  TrendingUp,
  MoreHorizontal,
  ArrowUpRight,
  ArrowDownRight,
  AlertCircle,
  Activity
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ticketService } from '../services/ticketService';
import { 
  BarChart, Bar, 
  XAxis, YAxis, 
  CartesianGrid, Tooltip, 
  ResponsiveContainer, PieChart, Pie, Cell,
  LineChart, Line
} from 'recharts';
import { motion } from 'framer-motion';
import '../styles/dashboard-premium.css';

const PRIORITY_COLORS = {
  critical: 'var(--danger)',
  high: 'var(--warning)',
  medium: 'var(--primary)',
  low: 'var(--success)'
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdminOrAgent = ['admin', 'support_agent'].includes(user?.role);
  const [stats, setStats] = useState(null);
  const [recentTickets, setRecentTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState([]);

  useEffect(() => {
    if (user && !isAdminOrAgent) {
      navigate('/tickets');
      return;
    }
    const fetchDashboardData = async () => {
      try {
        const statsPromise = isAdminOrAgent 
          ? ticketService.getAdminStats() 
          : ticketService.getStats();

        const [statsRes, ticketsRes] = await Promise.all([
          statsPromise,
          ticketService.getAll({ limit: 6 })
        ]);

        const s = statsRes.data.stats;
        
        // Process Chart Data (Last 7 Days)
        const trend = s.last7DaysTrend || { created: [], resolved: [] };
        const generatedChartData = Array.from({ length: 7 }).map((_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - (6 - i));
          const dateStr = d.toISOString().split('T')[0];
          const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
          
          const createdItem = trend.created?.find(item => item._id === dateStr);
          const resolvedItem = trend.resolved?.find(item => item._id === dateStr);
          
          return {
            name: dayName,
            tickets: createdItem?.count || 0,
            resolved: resolvedItem?.count || 0
          };
        });
        setChartData(generatedChartData);

        setStats({
          total: s.total || 0,
          pending: (s.open || 0) + (s.assigned || 0) + (s.in_progress || 0),
          resolved: s.resolved || 0,
          avgResolutionTime: s.avgResolutionHours || 0,
          priorityBreakdown: s.priorityBreakdown || {},
          slaAlerts: s.slaAlerts || []
        });
        setRecentTickets(ticketsRes.data.tickets);
        setLoading(false);
      } catch (err) {
        console.error(err);
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [isAdminOrAgent]);

  const priorityData = stats?.priorityBreakdown ? Object.entries(stats.priorityBreakdown).map(([k, v]) => ({ name: k, value: v })) : [
    { name: 'Critical', value: 2 },
    { name: 'High', value: 8 },
    { name: 'Medium', value: 15 },
    { name: 'Low', value: 6 },
  ];

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', width: '100%' }}>
      <div className="button-spinner" style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent', width: '32px', height: '32px' }}></div>
    </div>
  );

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="premium-page-content"
    >
      {/* Hero Header */}
      <div className="premium-hero">
        <div>
          <h1>Welcome back, Team!</h1>
          <p>Here’s your support performance overview today.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="premium-btn-outline premium-btn">Download Report</button>
        </div>
      </div>

      {/* KPI Stat Cards */}
      <div className="premium-stats-grid">
        <div className="premium-stat-card">
          <div className="flex-between">
            <div>
              <p className="premium-stat-label">Total Tickets</p>
              <h2 className="premium-stat-value">{stats?.total || 0}</h2>
            </div>
            <div className="stat-icon-wrapper" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>
              <Ticket size={24} />
            </div>
          </div>
          <div className="premium-stat-trend positive">
            <ArrowUpRight size={16} /> <span>12% vs last week</span>
          </div>
        </div>

        <div className="premium-stat-card">
          <div className="flex-between">
            <div>
              <p className="premium-stat-label">Pending</p>
              <h2 className="premium-stat-value">{stats?.pending || 0}</h2>
            </div>
            <div className="stat-icon-wrapper" style={{ background: '#fef3c7', color: 'var(--warning)' }}>
              <Clock size={24} />
            </div>
          </div>
          <div className="premium-stat-trend negative">
            <ArrowUpRight size={16} /> <span>4% vs last week</span>
          </div>
        </div>

        <div className="premium-stat-card">
          <div className="flex-between">
            <div>
              <p className="premium-stat-label">Resolved</p>
              <h2 className="premium-stat-value">{stats?.resolved || 0}</h2>
            </div>
            <div className="stat-icon-wrapper" style={{ background: '#d1fae5', color: 'var(--success)' }}>
              <CheckCircle2 size={24} />
            </div>
          </div>
          <div className="premium-stat-trend positive">
            <ArrowUpRight size={16} /> <span>18% vs last week</span>
          </div>
        </div>

        <div className="premium-stat-card">
          <div className="flex-between">
            <div>
              <p className="premium-stat-label">Avg Resolution</p>
              <h2 className="premium-stat-value">{stats?.avgResolutionTime || 0}<span style={{ fontSize: '1rem', color: 'var(--muted)', fontWeight: 600 }}>h</span></h2>
            </div>
            <div className="stat-icon-wrapper" style={{ background: '#f1f5f9', color: 'var(--muted)' }}>
              <TrendingUp size={24} />
            </div>
          </div>
          <div className="premium-stat-trend positive">
            <ArrowDownRight size={16} /> <span>2h faster vs last week</span>
          </div>
        </div>
      </div>

      {/* Analytics & Layout Grid */}
      <div className="premium-dashboard-grid">
        {/* Main Content Area */}
        <div className="flex-col" style={{ gap: '24px' }}>
          
          {/* Charts Section */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            <div className="premium-card" style={{ marginBottom: 0 }}>
              <div className="premium-card-header">
                <h3 className="premium-card-title">Weekly Resolution Trend</h3>
              </div>
              <div style={{ height: '260px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--muted)' }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--muted)' }} dx={-10} />
                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: 'var(--shadow-card)' }} />
                    <Line type="monotone" dataKey="resolved" stroke="var(--success)" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="premium-card" style={{ marginBottom: 0 }}>
              <div className="premium-card-header">
                <h3 className="premium-card-title">Ticket Volume</h3>
              </div>
              <div style={{ height: '260px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--muted)' }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--muted)' }} dx={-10} />
                    <Tooltip cursor={{ fill: 'var(--bg)' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: 'var(--shadow-card)' }} />
                    <Bar dataKey="tickets" fill="var(--primary)" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Recent Tickets Table */}
          <div className="premium-card">
            <div className="premium-card-header">
              <h3 className="premium-card-title">Recent Tickets</h3>
              <button className="premium-btn-outline premium-btn" style={{ padding: '6px 16px', fontSize: '0.8rem' }} onClick={() => navigate('/tickets')}>View All</button>
            </div>
            
            <div className="premium-table-wrapper">
              <table className="premium-table">
                <thead>
                  <tr>
                    <th>Ticket ID</th>
                    <th>Subject</th>
                    <th>Requester</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {recentTickets.map(t => (
                    <tr key={t._id} onClick={() => navigate(`/tickets/${t._id}`)} style={{ cursor: 'pointer' }}>
                      <td style={{ fontFamily: 'monospace', color: 'var(--muted)', fontWeight: 600 }}>
                        #{t.ticketId || t._id.slice(-6)}
                      </td>
                      <td style={{ fontWeight: 600 }}>{t.title}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700 }}>
                            {t.createdBy?.name?.charAt(0) || 'U'}
                          </div>
                          <span>{t.createdBy?.name || 'Unknown User'}</span>
                        </div>
                      </td>
                      <td>
                        <span className={`priority-${t.priority?.toLowerCase() || 'low'}`}>
                          • {t.priority || 'Low'}
                        </span>
                      </td>
                      <td>
                        <span className={`premium-badge badge-${t.status || 'open'}`}>
                          {t.status || 'Open'}
                        </span>
                      </td>
                      <td style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
                        {new Date(t.createdAt).toLocaleDateString()}
                      </td>
                      <td style={{ textAlign: 'right', color: 'var(--muted)' }}>
                        <MoreHorizontal size={18} />
                      </td>
                    </tr>
                  ))}
                  {recentTickets.length === 0 && (
                     <tr><td colSpan="7" style={{ textAlign: 'center', padding: '32px', color: 'var(--muted)' }}>No recent tickets available.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="flex-col" style={{ gap: '24px' }}>
          
          <div className="premium-card" style={{ marginBottom: 0 }}>
            <div className="premium-card-header">
              <h3 className="premium-card-title">Priority Breakdown</h3>
            </div>
            <div style={{ height: '200px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={priorityData}
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {priorityData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PRIORITY_COLORS[entry.name.toLowerCase()] || 'var(--primary)'} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: 'var(--shadow)' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
              {priorityData.map((p, i) => (
                <div key={i} className="flex-between">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: PRIORITY_COLORS[p.name.toLowerCase()] || 'var(--primary)' }} />
                    <span style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>{p.name}</span>
                  </div>
                  <span style={{ fontWeight: 600, color: 'var(--text)' }}>{p.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="premium-card" style={{ marginBottom: 0 }}>
            <div className="premium-card-header">
              <h3 className="premium-card-title">SLA Alerts</h3>
            </div>
            {stats?.slaAlerts?.length > 0 ? stats.slaAlerts.map(alert => (
              <div 
                key={alert._id} 
                className="premium-activity-item" 
                style={{ cursor: 'pointer' }}
                onClick={() => navigate(`/tickets/${alert._id}`)}
              >
                <div 
                  className="activity-icon" 
                  style={{ 
                    background: alert.sla?.breached ? '#fef2f2' : '#fffbeb', 
                    color: alert.sla?.breached ? 'var(--danger)' : 'var(--warning)' 
                  }}
                >
                  {alert.sla?.breached ? <AlertCircle size={16} /> : <Clock size={16} />}
                </div>
                <div className="activity-content">
                  <p><b>#{alert.ticketId}</b> {alert.sla?.breached ? 'SLA Breached' : 'Nearing Deadline'}</p>
                  <span style={{ display: 'block', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {alert.title}
                  </span>
                </div>
              </div>
            )) : (
              <p style={{ fontSize: '0.875rem', color: 'var(--muted)', textAlign: 'center', padding: '20px' }}>No pending SLA alerts.</p>
            )}
          </div>

          <div className="premium-card" style={{ marginBottom: 0 }}>
            <div className="premium-card-header">
              <h3 className="premium-card-title">Team Status</h3>
            </div>
            <div className="premium-activity-item">
              <div className="activity-icon" style={{ background: 'var(--success)', color: 'white', border: '2px solid white' }}>
                <Activity size={14} />
              </div>
              <div className="activity-content" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <p style={{ fontWeight: 600, margin: 0 }}>All systems operational</p>
                <span>Updated just now</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </motion.div>
  );
}
