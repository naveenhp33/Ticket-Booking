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
  Activity,
  Star,
  Users,
  Shield
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { ticketService, userService } from '../services/ticketService';
import { 
  BarChart, Bar, 
  XAxis, YAxis, 
  CartesianGrid, Tooltip, 
  ResponsiveContainer, PieChart, Pie, Cell,
  LineChart, Line
} from 'recharts';
import { motion } from 'framer-motion';
import { Button, Card, Badge } from '../ui';
import { timeAgo } from '../utils/helpers';
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
  const [agents, setAgents] = useState([]);
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

    const offAgentStatus = on('agent_status_updated', (data) => {
      setAgents(prev => prev.map(a => 
        (a._id === data.agentId || a._id === data.agentId?.toString())
          ? { ...a, liveStatus: data.status, lastStatusUpdate: data.timestamp, onSiteTicket: data.ticketDbId ? { ticketId: data.ticketId, _id: data.ticketDbId } : null }
          : a
      ));
    });

    return () => {
      offTicketCreated && offTicketCreated();
      offStatusChanged && offStatusChanged();
      offAssignChanged && offAssignChanged();
      offPriorityChanged && offPriorityChanged();
      offAgentStatus && offAgentStatus();
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
          pendingFeedback: s.pendingFeedback || 0,
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

    const fetchAgents = async () => {
      try {
        const res = await userService.getAgents();
        setAgents(res.data.agents);
      } catch {}
    };

    fetchDashboardData();
    if (isAdminOrAgent) fetchAgents();
  }, [isAdminOrAgent]);

  const priorityData = stats?.priorityBreakdown ? Object.entries(stats.priorityBreakdown).map(([k, v]) => ({ name: k, value: v })) : [
    { name: 'Critical', value: 2 },
    { name: 'High', value: 8 },
    { name: 'Medium', value: 15 },
    { name: 'Low', value: 6 },
  ];

  // RENDER FOR EMPLOYEE
  if (!isAdminOrAgent) {
    if (loading) return (<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', width: '100%', padding: '80px' }}><div className={"button-spinner"} style={{ width: '32px', height: '32px', borderColor: 'var(--primary)', borderTopColor: 'transparent' }} /></div>);
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="page-layout">
        <div className="flex-between mb-8" style={{ background: 'linear-gradient(135deg, #1E40AF 0%, #0F172A 100%)', padding: 'var(--s-8)', borderRadius: 'var(--r-xl)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 10px 30px -10px rgba(30, 64, 175, 0.4)' }}>
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'white' }}>How can we help, {user?.name.split(' ')[0]}?</h1>
            <p style={{ opacity: 0.9 }}>Check the status of your requests or find answers in the knowledge base.</p>
          </div>
          <Button onClick={() => navigate('/tickets/new')} style={{ background: 'white', color: 'var(--text-main)', fontWeight: 700, borderRadius: 'var(--r-md)' }}>New Support Ticket</Button>
        </div>

        <div className="dashboard-grid" style={{ marginBottom: 'var(--s-8)' }}>
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

        <div className="create-ticket-grid">
           <Card style={{ border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-md)', borderRadius: '24px', overflow: 'hidden' }}>
              <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white' }}>
                <div>
                   <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>Recent Intelligence</h2>
                   <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-dim)', fontWeight: 600 }}>Real-time stream of incoming and active requests</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => navigate('/tickets')} style={{ fontWeight: 800 }}>View All <ArrowUpRight size={16} /> </Button>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', background: 'var(--surface-alt)' }}>
                      <th style={{ fontSize: '0.75rem', fontWeight: 900, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Requester</th>
                      <th style={{ fontSize: '0.75rem', fontWeight: 900, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Information</th>
                      <th style={{ fontSize: '0.75rem', fontWeight: 900, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Status</th>
                      <th style={{ fontSize: '0.75rem', fontWeight: 900, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Priority</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentTickets.length > 0 ? recentTickets.map((t, idx) => {
                      const creatorName = t.createdBy?.name || 'System';
                      return (
                        <tr 
                          key={t._id} 
                          onClick={() => navigate(`/tickets/${t._id}`)} 
                          className="premium-table-row"
                          style={{ 
                            borderBottom: '1px solid var(--border-light)', cursor: 'pointer',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          <td>
                             <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--bg)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', fontWeight: 900, border: '1px solid var(--border)' }}>
                                   {creatorName[0]}
                                </div>
                                <div className="flex-col">
                                   <span style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-main)' }}>{creatorName}</span>
                                   <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontWeight: 600 }}>{new Date(t.createdAt).toLocaleDateString()}</span>
                                </div>
                             </div>
                          </td>
                          <td>
                             <div className="flex-col">
                                <span style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.95rem' }}>{t.title}</span>
                                <span style={{ fontSize: '0.72rem', color: 'var(--muted)', fontWeight: 800, letterSpacing: '0.5px' }}>#{t.ticketId}</span>
                             </div>
                          </td>
                          <td>
                             <Badge variant={
                               t.status === 'open' ? 'info' : 
                               t.status === 'resolved' ? 'success' : 
                               t.status === 'assigned' ? 'primary' : 
                               'warning'
                             }>
                               {t.status?.replace('_', ' ')}
                             </Badge>
                          </td>
                          <td>
                             <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: PRIORITY_COLORS[t.priority.toLowerCase()], boxShadow: `0 0 10px ${PRIORITY_COLORS[t.priority.toLowerCase()]}` }} />
                                <span style={{ fontWeight: 700, fontSize: '0.85rem', textTransform: 'capitalize' }}>{t.priority}</span>
                             </div>
                          </td>
                        </tr>
                      );
                    }) : (
                      <tr>
                        <td colSpan="4" style={{ textAlign: 'center', padding: '100px' }}>
                           <div className="flex-col items-center gap-4">
                              <Ticket size={48} style={{ color: 'var(--border)', marginBottom: '16px' }} />
                              <p style={{ fontWeight: 800, color: 'var(--text-dim)' }}>Zero items in reach.</p>
                           </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

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
      <div className="flex-between mb-8 dashboard-hero" style={{ background: 'linear-gradient(135deg, #1E3A8A 0%, #020617 100%)', padding: 'var(--s-8)', borderRadius: 'var(--r-xl)', color: 'white', border: '1px solid rgba(255,255,255,0.05)', boxShadow: '0 10px 30px -10px rgba(30, 58, 138, 0.5)' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'white' }}>
            {user?.role === 'support_agent' ? `Ready for work, ${user?.name.split(' ')[0]}?` : 'Welcome back, Team!'}
          </h1>
          <p style={{ opacity: 0.85 }}>
            {user?.role === 'support_agent' ? 'Here is a summary of your assigned tasks and performance today.' : 'Here’s your support performance overview for today.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="premium-btn" style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', backdropFilter: 'blur(10px)' }}>Download Report</button>
        </div>
      </div>

      {/* KPI Stat Cards */}
      <div className="dashboard-grid-4" style={{ marginBottom: 'var(--s-8)' }}>
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
      
      {/* Admin Quick Action: Reassignment Requests */}
      {user?.role === 'admin' && stats?.pendingReassignRequests > 0 && (
         <div 
          onClick={() => navigate('/tickets')} 
          style={{ 
            marginBottom: 'var(--s-8)', padding: '16px 20px', borderRadius: 'var(--r-lg)', 
            background: '#FFFBEB', border: '2px dashed var(--warning)', 
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '16px' 
          }}
         >
            <div style={{ background: 'white', color: 'var(--warning)', width: '40px', height: '40px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--warning)' }}>
               <Shield size={20} />
            </div>
            <div style={{ flex: 1 }}>
               <div style={{ fontWeight: 800, color: '#92400e' }}>{stats.pendingReassignRequests} Ticket Reassignment Requests Pending</div>
               <div style={{ fontSize: '0.82rem', color: '#b45309' }}>Agents are asking to transfer their workload. Action required from Admin.</div>
            </div>
            <Button size="sm" variant="warning">View Requests</Button>
         </div>
      )}

      {/* Pending Confirmation Dashboard Section — The Watchtower */}
      {user?.role === 'admin' && stats?.pendingConfirmationTickets?.length > 0 && (
         <Card style={{ 
           marginBottom: 'var(--s-8)', padding: 0, borderRadius: '24px', 
           overflow: 'hidden', border: '1px solid #FEF3C7', background: '#FFFBEB',
           boxShadow: '0 10px 15px -3px rgba(217, 119, 6, 0.05)'
         }}>
            <div style={{ padding: '20px 32px', borderBottom: '1px solid #FDE68A', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ padding: '8px', background: 'white', borderRadius: '10px', color: '#D97706', border: '1px solid #FDE68A' }}>
                     <Clock size={20} />
                  </div>
                  <div>
                     <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: '#92400E', letterSpacing: '-0.01em' }}>PENDING CONFIRMATION ({stats.pending_confirmation})</h2>
                     <p style={{ margin: 0, fontSize: '0.75rem', color: '#B45309', fontWeight: 600 }}>Tickets awaiting employee sign-off</p>
                  </div>
               </div>
            </div>
            <div style={{ padding: '8px' }}>
               {stats.pendingConfirmationTickets.map(t => (
                  <div 
                    key={t._id} 
                    onClick={() => navigate(`/tickets/${t._id}`)}
                    style={{ 
                      padding: '12px 24px', borderRadius: '16px', cursor: 'pointer', 
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      transition: 'all 0.2s'
                    }}
                    onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.7)'}
                    onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                  >
                     <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 900, color: '#92400E', background: 'white', padding: '4px 8px', borderRadius: '6px' }}>#{t.ticketId}</span>
                        <div>
                           <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#451A03' }}>{t.title}</div>
                           <div style={{ fontSize: '0.7rem', color: '#B45309', fontWeight: 600 }}>
                              {t.assignedTo?.name} <span style={{ opacity: 0.6 }}>→</span> {t.createdBy?.name} • Waiting {timeAgo(t.resolution?.pendingConfirmationAt)}
                           </div>
                        </div>
                     </div>
                     <Badge style={{ background: '#FEF3C7', color: '#92400E', border: '1px solid #FDE68A', fontSize: '0.65rem' }}>
                        Verifying...
                     </Badge>
                  </div>
               ))}
            </div>
         </Card>
      )}

      {/* Analytics & Layout Grid */}
      <div className="premium-dashboard-grid">
        {/* Main Content Area */}
        <div className="flex-col" style={{ gap: '24px' }}>
          
          {/* Charts Section */}
          <div className="split-grid">
            <div className="premium-card">
              <div className="flex-between mb-6">
                <h3 style={{ fontWeight: 800, fontSize: '1.1rem' }}>Weekly Resolution Trend</h3>
                <Badge variant="success">Completed</Badge>
              </div>
              <div className="chart-container-md" style={{ height: '240px' }}>
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
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
              <div className="chart-container-md" style={{ height: '260px' }}>
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
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
                    <th className="hide-mobile">Priority</th>
                    <th>Status</th>
                    <th className="hide-tablet hide-mobile">Date</th>
                    <th className="hide-mobile"></th>
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
                      <td className="hide-mobile">
                        <div className="flex-center gap-2">
                           <span className={`priority-indicator priority-${t.priority}`} />
                           <span style={{ textTransform: 'capitalize', fontWeight: 600, fontSize: '0.8rem' }}>{t.priority}</span>
                        </div>
                      </td>
                      <td>
                        <Badge variant={
                          t.status === 'open' ? 'info' : 
                          t.status === 'resolved' ? 'success' : 
                          t.status === 'assigned' ? 'primary' : 
                          'warning'
                        }>
                          {t.status?.replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="hide-tablet hide-mobile" style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>
                        {new Date(t.createdAt).toLocaleDateString()}
                      </td>
                      <td className="hide-mobile" style={{ textAlign: 'right' }}>
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
            <div style={{ height: '200px' }} className="chart-container-pie">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
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

          {/* Shift & Team Intelligence (New Section) */}
          {user?.role === 'admin' && (
            <div className="premium-card">
              <div className="premium-card-header">
                <h3 className="premium-card-title">Shift & Team Intelligence</h3>
              </div>
              <div className="dashboard-grid-3" style={{ gap: '16px', marginTop: '16px' }}>
                <div style={{ background: 'var(--surface-alt)', padding: '16px', borderRadius: '16px', border: '1px solid var(--border)' }}>
                  <p style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '8px' }}>1T Team (First Touch)</p>
                  <div style={{ fontSize: '1.5rem', fontWeight: 900 }}>{stats?.teamBreakdown?.['1T'] || 0}</div>
                  <p style={{ fontSize: '0.65rem', color: 'var(--text-dim)', marginTop: '4px' }}>Active incidents</p>
                </div>
                <div style={{ background: 'var(--surface-alt)', padding: '16px', borderRadius: '16px', border: '1px solid var(--border)' }}>
                  <p style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '8px' }}>2T Team (Support)</p>
                  <div style={{ fontSize: '1.5rem', fontWeight: 900 }}>{stats?.teamBreakdown?.['2T'] || 0}</div>
                  <p style={{ fontSize: '0.65rem', color: 'var(--text-dim)', marginTop: '4px' }}>Level 2 support</p>
                </div>
              </div>
              
              <div style={{ marginTop: '24px' }}>
                <p style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '12px' }}>Current Shift Performance</p>
                <div className="flex-col gap-3">
                  {['morning', 'mid', 'night'].map(shift => (
                    <div key={shift} className="flex-between" style={{ padding: '8px 12px', background: 'var(--bg)', borderRadius: '10px' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'capitalize' }}>{shift} Shift</span>
                      <span style={{ fontWeight: 800, color: 'var(--primary)' }}>{stats?.shiftStats?.[shift] || 0} Tickets</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

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

          {/* Live Agent Workload Board — accountability gap bridged */}
          {user?.role === 'admin' && (
            <Card style={{ 
              marginBottom: 0, borderRadius: '24px', border: '1px solid var(--border)', 
              boxShadow: 'var(--shadow-lg)', padding: 0, overflow: 'hidden' 
            }}>
              <div style={{ padding: '24px', borderBottom: '1px solid var(--border)', background: 'var(--surface-alt)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Users size={20} color="var(--primary)" />
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 900 }}>Live Agent Workload</h3>
                </div>
              </div>
              <div style={{ padding: '8px' }}>
                {agents.map(agent => (
                  <div key={agent._id} style={{ 
                    padding: '16px', borderRadius: '16px', borderBottom: '1px solid var(--bg)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ position: 'relative' }}>
                        <div style={{ width: '40px', height: '40px', background: '#F1F5F9', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.9rem' }}>
                          {agent.name[0]}
                        </div>
                        <div style={{ 
                          position: 'absolute', bottom: '-2px', right: '-2px', width: '12px', height: '12px', 
                          borderRadius: '50%', border: '2px solid white',
                          background: ({ available: '#10B981', on_site: '#3B82F6', remote: '#F59E0B', unavailable: '#EF4444' })[agent.liveStatus || 'available']
                        }} />
                      </div>
                      <div>
                        <div style={{ fontSize: '0.875rem', fontWeight: 800, color: 'var(--text-main)' }}>{agent.name}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', fontWeight: 600 }}>
                          {(agent.liveStatus || 'available').replace('_', ' ').toUpperCase()} 
                          {agent.onSiteTicket && ` • #${agent.onSiteTicket.ticketId}`}
                        </div>
                      </div>
                    </div>
                    <div>
                      {agent.liveStatus === 'on_site' ? (
                        <div style={{ textAlign: 'right' }}>
                          <Badge variant="primary" style={{ fontSize: '0.65rem' }}>Active On-Site</Badge>
                          <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                            {agent.onSiteTicket?.onSiteVisit?.arrivalConfirmedByEmployee ? '✅ Verified' : '⏳ Unverified'}
                          </div>
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-dim)' }}>
                          {agent.currentWorkload} active
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ padding: '16px', background: 'var(--bg)', textAlign: 'center' }}>
                 <Button variant="ghost" size="sm" onClick={() => navigate('/admin/users')} style={{ fontSize: '0.75rem' }}>Manage All Personnel</Button>
              </div>
            </Card>
          )}

        </div>
      </div>
    </motion.div>
  );
}
