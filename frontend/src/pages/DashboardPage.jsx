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
import { useSocket } from '../context/SocketContext';
import { ticketService } from '../services/ticketService';
import { 
  BarChart, Bar, 
  XAxis, YAxis, 
  CartesianGrid, Tooltip, 
  ResponsiveContainer, PieChart, Pie, Cell,
  LineChart, Line
} from 'recharts';
import { motion } from 'framer-motion';
import { Button, Card, Badge } from '../ui';
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
  const { on } = useSocket();

  useEffect(() => {
    // Listen for real-time ticket creation
    const offTicketCreated = on('ticket_created', (data) => {
      // Refresh tickets if new one arrives
      if (data.ticket) {
        setRecentTickets(prev => [data.ticket, ...prev].slice(0, 6));
        setStats(prev => prev ? {
          ...prev,
          total: prev.total + 1,
          pending: prev.pending + 1
        } : prev);
      }
    });

    const offStatusChanged = on('ticket_status_changed', (data) => {
      // Update recent tickets list
      setRecentTickets(prev => prev.map(t =>
        (t._id === data.ticketId || t._id === data.ticketId?.toString())
          ? { ...t, status: data.status }
          : t
      ));
      // Update stats counters
      if (data.status === 'resolved') {
        setStats(prev => prev ? {
          ...prev,
          resolved: prev.resolved + 1,
          pending: Math.max(0, prev.pending - 1)
        } : prev);
      }
    });

    const offAssignChanged = on('ticket_assignment_changed', (data) => {
      setRecentTickets(prev => prev.map(t =>
        (t._id === data.ticketId || t._id === data.ticketId?.toString())
          ? { ...t, assignedTo: data.assignedTo, status: data.status || t.status }
          : t
      ));
    });

    const offPriorityChanged = on('ticket_priority_changed', (data) => {
      setRecentTickets(prev => prev.map(t =>
        (t._id === data.ticketId || t._id === data.ticketId?.toString())
          ? { ...t, priority: data.priority }
          : t
      ));
    });

    return () => {
      offTicketCreated && offTicketCreated();
      offStatusChanged && offStatusChanged();
      offAssignChanged && offAssignChanged();
      offPriorityChanged && offPriorityChanged();
    };
  }, [on]);

  useEffect(() => {
    // Logic to render different views based on role removed redirect
    const fetchDashboardData = async () => {
      try {
        const statsPromise = isAdminOrAgent 
          ? ticketService.getAdminStats() 
          : ticketService.getStats();

        const [statsRes, ticketsRes] = await Promise.all([
          statsPromise,
          ticketService.getAll({ limit: 6, myTickets: user?.role === 'support_agent' ? 'true' : undefined })
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

        const totalCreatedThisWeek = generatedChartData.reduce((acc, curr) => acc + curr.tickets, 0);
        const totalResolvedThisWeek = generatedChartData.reduce((acc, curr) => acc + curr.resolved, 0);

        setStats({
          total: s.total || 0,
          pending: (s.open || 0) + (s.assigned || 0) + (s.in_progress || 0),
          resolved: s.resolved || 0,
          avgResolutionTime: s.avgResolutionHours || 0,
          priorityBreakdown: s.priorityBreakdown || {},
          slaAlerts: s.slaAlerts || [],
          trendCreated: totalCreatedThisWeek,
          trendResolved: totalResolvedThisWeek
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

  // RENDER FOR EMPLOYEE
  if (!isAdminOrAgent) {
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="page-layout">
        <div className="flex-between mb-8" style={{ background: 'linear-gradient(135deg, #0EA5E9 0%, #2563EB 100%)', padding: 'var(--s-8)', borderRadius: 'var(--r-lg)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 10px 25px -5px rgba(14, 165, 233, 0.2)' }}>
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'white' }}>How can we help, {user?.name.split(' ')[0]}?</h1>
            <p style={{ opacity: 0.9 }}>Check the status of your requests or find answers in the knowledge base.</p>
          </div>
          <Button onClick={() => navigate('/tickets/new')} style={{ background: 'white', color: 'var(--primary)', fontWeight: 700 }}>New Support Ticket</Button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--s-6)', marginBottom: 'var(--s-8)' }}>
           <div className="premium-stat-card" style={{ border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
              <div className="flex-between">
                <div>
                  <p style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '8px' }}>Active Requests</p>
                  <h2 style={{ fontSize: '1.75rem', fontWeight: 800 }}>{stats?.total || 0}</h2>
                </div>
                <div className="stat-icon-wrapper" style={{ background: '#EEF2FF', color: 'var(--primary)', width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Ticket size={24} />
                </div>
              </div>
           </div>
           
           <div className="premium-stat-card" style={{ border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
              <div className="flex-between">
                <div>
                  <p style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '8px' }}>Action Needed</p>
                  <h2 style={{ fontSize: '1.75rem', fontWeight: 800 }}>{stats?.pendingFeedback || 0}</h2>
                </div>
                <div className="stat-icon-wrapper" style={{ background: '#FFFBEB', color: 'var(--warning)', width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Star size={24} />
                </div>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '8px' }}>Resolved tickets waiting for your feedback.</p>
           </div>

           <div className="premium-stat-card" style={{ border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
              <div className="flex-between">
                <div>
                  <p style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '8px' }}>Successfully Resolved</p>
                  <h2 style={{ fontSize: '1.75rem', fontWeight: 800 }}>{stats?.resolved || 0}</h2>
                </div>
                <div className="stat-icon-wrapper" style={{ background: '#ECFDF5', color: 'var(--success)', width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CheckCircle2 size={24} />
                </div>
              </div>
           </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 'var(--s-8)' }}>
           <div className="premium-card">
              <div className="flex-between mb-6">
                <h3 style={{ fontWeight: 800, fontSize: '1.1rem' }}>My Recent Tickets</h3>
                <Button variant="ghost" size="sm" onClick={() => navigate('/tickets')}>View History</Button>
              </div>
              <div className="premium-table-wrapper">
                <table className="premium-table">
                  <thead>
                    <tr>
                      <th>Subject</th>
                      <th>Last Updated</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentTickets.length > 0 ? recentTickets.map(t => (
                      <tr key={t._id} onClick={() => navigate(`/tickets/${t._id}`)} className="dashboard-row">
                        <td>
                          <div style={{ fontWeight: 700 }}>{t.title}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>ID: #{t.ticketId}</div>
                        </td>
                        <td style={{ fontSize: '0.85rem' }}>{new Date(t.updatedAt).toLocaleDateString()}</td>
                        <td><Badge variant={t.status === 'open' ? 'info' : t.status === 'resolved' ? 'success' : 'primary'}>{t.status}</Badge></td>
                      </tr>
                    )) : <tr><td colSpan="3" style={{ textAlign: 'center', padding: '40px' }}>No active tickets.</td></tr>}
                  </tbody>
                </table>
              </div>
           </div>

           <div className="flex-col gap-6">
              <div className="premium-card">
                 <h3 style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: '16px' }}>Need Help?</h3>
                 <div className="flex-col gap-4">
                    <div onClick={() => navigate('/knowledge')} style={{ cursor: 'pointer', padding: '12px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--bg)' }}>
                       <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '4px' }}>Browse Knowledge Base</div>
                       <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Find answers to common questions immediately.</p>
                    </div>
                    <div style={{ padding: '12px', borderRadius: '12px', background: '#F8FAFC' }}>
                       <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '4px' }}>Contact IT Helpdesk</div>
                       <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Mon - Fri, 9:00 AM - 6:00 PM</p>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      </motion.div>
    );
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', width: '100%' }}>
      <div className="button-spinner" style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent', width: '32px', height: '32px' }}></div>
    </div>
  );

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="page-layout"
    >
      {/* Hero Header */}
      <div className="flex-between mb-8" style={{ background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)', padding: 'var(--s-8)', borderRadius: 'var(--r-lg)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 10px 25px -5px rgba(79, 70, 229, 0.2)' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'white' }}>Welcome back, Team!</h1>
          <p style={{ opacity: 0.9 }}>Here’s your support performance overview for today.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="premium-btn" style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)', color: 'white' }}>Download Report</button>
        </div>
      </div>

      {/* KPI Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--s-6)', marginBottom: 'var(--s-8)' }}>
        <div className="premium-stat-card" style={{ border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
          <div className="flex-between">
            <div>
              <p style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '8px' }}>Total Tickets</p>
              <h2 style={{ fontSize: '1.75rem', fontWeight: 800 }}>{stats?.total || 0}</h2>
            </div>
            <div className="stat-icon-wrapper" style={{ background: '#EEF2FF', color: 'var(--primary)', width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Ticket size={24} />
            </div>
          </div>
          <div className="premium-stat-trend positive" style={{ marginTop: '16px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--success)', fontWeight: 600 }}>
            <ArrowUpRight size={14} /> <span>{stats?.trendCreated || 0} this week</span>
          </div>
        </div>

        <div className="premium-stat-card" style={{ border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
          <div className="flex-between">
            <div>
              <p style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '8px' }}>Pending</p>
              <h2 style={{ fontSize: '1.75rem', fontWeight: 800 }}>{stats?.pending || 0}</h2>
            </div>
            <div className="stat-icon-wrapper" style={{ background: '#FFFBEB', color: 'var(--warning)', width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Clock size={24} />
            </div>
          </div>
          <div className="premium-stat-trend" style={{ marginTop: '16px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-dim)', fontWeight: 600 }}>
            <Activity size={14} /> <span>Active queue</span>
          </div>
        </div>

        <div className="premium-stat-card" style={{ border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
          <div className="flex-between">
            <div>
              <p style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '8px' }}>Resolved</p>
              <h2 style={{ fontSize: '1.75rem', fontWeight: 800 }}>{stats?.resolved || 0}</h2>
            </div>
            <div className="stat-icon-wrapper" style={{ background: '#ECFDF5', color: 'var(--success)', width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle2 size={24} />
            </div>
          </div>
          <div className="premium-stat-trend positive" style={{ marginTop: '16px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--success)', fontWeight: 600 }}>
            <ArrowUpRight size={14} /> <span>{stats?.trendResolved || 0} this week</span>
          </div>
        </div>

        <div className="premium-stat-card" style={{ border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
          <div className="flex-between">
            <div>
              <p style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '8px' }}>Avg Resolution</p>
              <h2 style={{ fontSize: '1.75rem', fontWeight: 800 }}>{stats?.avgResolutionTime || 0}<span style={{ fontSize: '1rem', color: 'var(--muted)', fontWeight: 600 }}>h</span></h2>
            </div>
            <div className="stat-icon-wrapper" style={{ background: '#F8FAFC', color: 'var(--text-dim)', width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingUp size={24} />
            </div>
          </div>
          <div className="premium-stat-trend positive" style={{ marginTop: '16px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--primary)', fontWeight: 600 }}>
            <Activity size={14} /> <span>Lifetime avg</span>
          </div>
        </div>
      </div>

      {/* Analytics & Layout Grid */}
      <div className="premium-dashboard-grid">
        {/* Main Content Area */}
        <div className="flex-col" style={{ gap: '24px' }}>
          
          {/* Charts Section */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            <div className="premium-card">
              <div className="flex-between mb-6">
                <h3 style={{ fontWeight: 800, fontSize: '1.1rem' }}>Weekly Resolution Trend</h3>
                <Badge variant="success">Completed</Badge>
              </div>
              <div style={{ height: '240px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <defs>
                      <linearGradient id="resolvedGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--success)" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="var(--success)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 600, fill: '#94a3b8' }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 600, fill: '#94a3b8' }} dx={-10} />
                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontWeight: 600 }} />
                    <Line type="monotone" dataKey="resolved" stroke="var(--success)" strokeWidth={4} dot={{ r: 4, strokeWidth: 2, fill: 'white' }} activeDot={{ r: 6, strokeWidth: 0 }} animationDuration={1500} />
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
              <button className="premium-btn" style={{ padding: '6px 16px', fontSize: '0.8rem' }} onClick={() => navigate('/tickets')}>View All</button>
            </div>
            
            <div className="premium-table-wrapper">
              <table className="premium-table">
                <thead>
                  <tr>
                    <th>Ticket ID</th>
                    <th>Subject</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {recentTickets.map((t, idx) => (
                    <tr key={t._id} onClick={() => navigate(`/tickets/${t._id}`)} className="dashboard-row">
                      <td>
                        <span className="ticket-id-tag">#{t.ticketId || t._id.slice(-6).toUpperCase()}</span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 700, color: 'var(--text-dark)' }}>{t.title}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>by {t.createdBy?.name || 'Unknown'}</div>
                      </td>
                      <td>
                        <div className="flex-center gap-2">
                           <span className={`priority-indicator priority-${t.priority}`} />
                           <span style={{ textTransform: 'capitalize', fontWeight: 600, fontSize: '0.8rem' }}>{t.priority}</span>
                        </div>
                      </td>
                      <td>
                        <Badge variant={t.status === 'open' ? 'info' : t.status === 'resolved' ? 'success' : 'primary'}>
                          {t.status?.replace('_', ' ')}
                        </Badge>
                      </td>
                      <td style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>
                        {new Date(t.createdAt).toLocaleDateString()}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button className="row-action-btn"><MoreHorizontal size={16} /></button>
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
