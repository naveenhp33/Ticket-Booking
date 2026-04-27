import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Search, 
  Filter, 
  Plus, 
  MoreVertical, 
  ChevronLeft, 
  ChevronRight,
  ArrowUpDown,
  Calendar,
  Clock,
  MoreHorizontal,
  Eye, 
  Trash2, 
  CheckSquare, 
  AlertCircle,
  ExternalLink,
  Mail,
  LayoutList,
  LayoutDashboard
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ticketService } from '../services/ticketService';
import { useSocket } from '../context/SocketContext';
import { useToast } from '../context/ToastContext';
import { Button, Input, Card, Badge } from '../ui';
import { motion, AnimatePresence } from 'framer-motion';

export default function TicketsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });
  
  const [filters, setFilters] = useState({
    status: searchParams.get('status') || '',
    priority: searchParams.get('priority') || '',
    category: searchParams.get('category') || '',
    search: searchParams.get('search') || '',
    office: searchParams.get('office') || '',
    myTickets: searchParams.get('myTickets') || ''
  });
  
  const [viewMode, setViewMode] = useState(localStorage.getItem('ticketViewMode') || 'list'); // 'list' or 'panel' (LI PA)
  
  const [activeMenu, setActiveMenu] = useState(null); // ticketId of open menu
  const toast = useToast();
  const { on } = useSocket();

  useEffect(() => {
    const offTicketCreated = on('ticket_created', (data) => {
      if (data.ticket && pagination.page === 1) {
        // Only prepend if we're on the first page
        setTickets(prev => {
          if (prev.some(t => t._id === (data.ticket._id || data.ticketId))) return prev;
          return [data.ticket, ...prev].slice(0, 10);
        });
        toast.info(`New Ticket: ${data.ticket.title || 'Support Request received'}`);
      }
    });

    const offStatusChanged = on('ticket_status_changed', (data) => {
      setTickets(prev => prev.map(t => 
        (t._id === data.ticketId || t._id === data.ticketId?.toString()) 
          ? { ...t, status: data.status, updatedAt: new Date().toISOString() }
          : t
      ));
    });

    const offAssignChanged = on('ticket_assignment_changed', (data) => {
      setTickets(prev => prev.map(t => 
        (t._id === data.ticketId || t._id === data.ticketId?.toString())
          ? { ...t, assignedTo: data.assignedTo, status: data.status || t.status, updatedAt: new Date().toISOString() }
          : t
      ));
    });

    const offPriorityChanged = on('ticket_priority_changed', (data) => {
      setTickets(prev => prev.map(t => 
        (t._id === data.ticketId || t._id === data.ticketId?.toString())
          ? { ...t, priority: data.priority, updatedAt: new Date().toISOString() }
          : t
      ));
    });

    return () => {
      offTicketCreated && offTicketCreated();
      offStatusChanged && offStatusChanged();
      offAssignChanged && offAssignChanged();
      offPriorityChanged && offPriorityChanged();
    };
  }, [on, pagination.page]);

  const fetchTickets = () => {
    setLoading(true);
    
    // Default to active statuses if in "My Queue" and no status filter is applied
    const activeStatuses = 'open,assigned,in_progress,almost_complete,reopened';
    const statusFilter = filters.status || (filters.myTickets === 'true' ? activeStatuses : '');

    const params = {
      page: searchParams.get('page') || 1,
      limit: 10,
      status: statusFilter,
      priority: filters.priority,
      category: filters.category,
      search: filters.search,
      office: filters.office,
      myTickets: filters.myTickets
    };

    ticketService.getAll(params)
      .then(res => {
        setTickets(res.data.tickets);
        setPagination({
          page: res.data.pagination?.page || 1,
          totalPages: res.data.pagination?.pages || 1
        });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    setFilters({
      status: searchParams.get('status') || '',
      priority: searchParams.get('priority') || '',
      category: searchParams.get('category') || '',
      search: searchParams.get('search') || '',
      office: searchParams.get('office') || '',
      myTickets: searchParams.get('myTickets') || ''
    });
  }, [searchParams]);

  useEffect(() => {
    fetchTickets();
  }, [filters]);

  const handleFilterChange = (key, value) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    
    // Update URL params
    const params = new URLSearchParams();
    Object.entries(newFilters).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });
    setSearchParams(params);
  };

  const handleAction = async (ticketId, action, e) => {
    e.stopPropagation();
    setActiveMenu(null);
    try {
      if (action === 'delete') {
        if (window.confirm('Are you sure you want to delete this ticket?')) {
          await ticketService.delete(ticketId);
          toast.success('Ticket deleted successfully');
          fetchTickets();
        }
      } else if (action === 'resolve') {
        await ticketService.updateStatus(ticketId, { status: 'resolved' });
        toast.success('Ticket marked as resolved');
        fetchTickets();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed');
    }
  };

  useEffect(() => {
    const handleClickOutside = () => setActiveMenu(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="page-layout"
    >
      <div className="flex-between mb-8">
        <div>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 800, letterSpacing: '-0.025em' }}>
            {filters.myTickets ? 'My Support Queue' : 'Support Tickets'}
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
            {filters.myTickets 
              ? `Working on ${tickets.length} active assignments.` 
              : 'Overview of all tickets across the organization.'}
          </p>
        </div>
      </div>

      <div style={{ 
        background: 'white', 
        padding: '16px 24px', 
        borderRadius: '20px', 
        border: '1px solid var(--border-light)', 
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '24px',
        marginBottom: '24px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flex: 1 }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
            <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
            <input 
              type="text" 
              placeholder="Search by ID, subject or content..." 
              style={{ 
                width: '100%', padding: '10px 16px 10px 42px', 
                borderRadius: '12px', border: '1px solid var(--border)', 
                background: 'var(--surface-alt)', fontSize: '0.9rem',
                fontWeight: 600, outline: 'none', transition: 'all 0.2s ease',
                boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)'
              }}
              value={filters.search}
              onChange={e => handleFilterChange('search', e.target.value)}
            />
          </div>

          <div style={{ height: '24px', width: '1px', background: 'var(--border-light)' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 900, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status</span>
              <select 
                style={{ 
                  padding: '6px 12px', borderRadius: '10px', border: '1px solid var(--border)', 
                  background: 'white', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer',
                  minWidth: '130px', outline: 'none'
                }}
                value={filters.status}
                onChange={e => handleFilterChange('status', e.target.value)}
              >
                <option value="">{filters.myTickets === 'true' ? 'All Active' : 'All Statuses'}</option>
                <option value="open">Open</option>
                <option value="assigned">Assigned</option>
                <option value="in_progress">Working on it</option>
                <option value="almost_complete">Almost done</option>
                <option value="resolved">Fixed</option>
                <option value="closed">Closed</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 900, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Priority</span>
              <select 
                style={{ 
                  padding: '6px 12px', borderRadius: '10px', border: '1px solid var(--border)', 
                  background: 'white', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer',
                  minWidth: '100px', outline: 'none'
                }}
                value={filters.priority}
                onChange={e => handleFilterChange('priority', e.target.value)}
              >
                <option value="">All</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
           <div className="view-mode-toggle flex-center" style={{ background: 'var(--surface-alt)', padding: '4px', borderRadius: '10px', border: '1px solid var(--border)' }}>
             <button 
               onClick={() => { setViewMode('list'); localStorage.setItem('ticketViewMode', 'list'); }}
               style={{ 
                 padding: '6px 10px', borderRadius: '6px', border: 'none', 
                 background: viewMode === 'list' ? 'white' : 'transparent',
                 boxShadow: viewMode === 'list' ? 'var(--shadow-sm)' : 'none',
                 color: viewMode === 'list' ? 'var(--primary)' : 'var(--text-dim)',
                 cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '0.75rem'
               }}
             >
               <LayoutList size={14} /> LI
             </button>
             <button 
               onClick={() => { setViewMode('panel'); localStorage.setItem('ticketViewMode', 'panel'); }}
               style={{ 
                 padding: '6px 10px', borderRadius: '6px', border: 'none', 
                 background: viewMode === 'panel' ? 'white' : 'transparent',
                 boxShadow: viewMode === 'panel' ? 'var(--shadow-sm)' : 'none',
                 color: viewMode === 'panel' ? 'var(--primary)' : 'var(--text-dim)',
                 cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '0.75rem'
               }}
             >
               <LayoutDashboard size={14} /> PA
             </button>
           </div>
           
           {user?.role === 'employee' && (
             <Button variant="primary" size="sm" style={{ fontWeight: 800, padding: '8px 20px', borderRadius: '12px' }} onClick={() => navigate('/tickets/new')} leftIcon={<Plus size={18} />}>New Ticket</Button>
           )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', overflowX: 'auto', paddingBottom: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'white', padding: '6px 12px', borderRadius: '10px', border: '1px solid var(--border)', minWidth: 'fit-content' }}>
           <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-dim)', textTransform: 'uppercase' }}>Office</span>
           <select 
             style={{ border: 'none', background: 'transparent', fontWeight: 700, fontSize: '0.85rem', outline: 'none', cursor: 'pointer' }}
             value={filters.office}
             onChange={e => handleFilterChange('office', e.target.value)}
           >
             <option value="">All Offices</option>
             <option value="GICC">GICC (VP-GICC)</option>
             <option value="Bangalore">Bangalore (VP-Bangalore)</option>
           </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'white', padding: '6px 12px', borderRadius: '10px', border: '1px solid var(--border)', minWidth: 'fit-content' }}>
           <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-dim)', textTransform: 'uppercase' }}>Category</span>
           <select 
             style={{ border: 'none', background: 'transparent', fontWeight: 700, fontSize: '0.85rem', outline: 'none', cursor: 'pointer' }}
             value={filters.category}
             onChange={e => handleFilterChange('category', e.target.value)}
           >
             <option value="">All Categories</option>
             {['IT', 'HR', 'Finance', 'Admin', 'Operations', 'Marketing', 'Sales', 'Legal'].map(c => <option key={c} value={c}>{c}</option>)}
           </select>
         </div>

         <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'white', padding: '6px 12px', borderRadius: '10px', border: '1px solid var(--border)', minWidth: 'fit-content' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-dim)', textTransform: 'uppercase' }}>Team</span>
            <select 
              style={{ border: 'none', background: 'transparent', fontWeight: 700, fontSize: '0.85rem', outline: 'none', cursor: 'pointer' }}
              value={filters.team || ''}
              onChange={e => handleFilterChange('team', e.target.value)}
            >
              <option value="">All Teams</option>
              <option value="1T">1T (First Touch)</option>
              <option value="2T">2T (Support)</option>
            </select>
         </div>
      </div>

      {viewMode === 'list' ? (
        <div className="table-container" style={{ border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%' }}>
          <thead>
            <tr>
              <th style={{ width: '120px' }}><div style={{ display:'flex', alignItems:'center', gap:'6px' }}>Ticket ID <ArrowUpDown size={11} /></div></th>
              <th>Subject &amp; Reporter</th>
              <th style={{ width: '110px' }}>Category</th>
              <th className="col-center" style={{ width: '100px' }}>Priority</th>
              <th className="col-center" style={{ width: '110px' }}>Status</th>
              <th style={{ width: '110px' }}>Last Activity</th>
              <th className="col-right" style={{ width: '50px' }}></th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence mode="popLayout">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}><td colSpan="7"><div style={{ height: '52px', background: 'var(--surface-alt)', width: '100%', borderRadius: '8px', margin: '4px 0', animation: 'pulse 1.5s infinite' }} /></td></tr>
                ))
              ) : tickets.length === 0 ? (
                <tr><td colSpan="7" style={{ textAlign: 'center', padding: 'var(--s-16)', color: 'var(--text-dim)' }}>
                  <div className="flex-col flex-center gap-2">
                    <Search size={48} opacity={0.2} />
                    <p>No tickets found matching your search criteria.</p>
                  </div>
                </td></tr>
              ) : tickets.map((t, idx) => (
                <motion.tr 
                  key={t._id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  onClick={() => navigate(`/tickets/${t._id}`)}
                  className="dashboard-row"
                >
                  <td style={{ overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                       <span className="ticket-id-tag">#{t.ticketId || t._id.slice(-6).toUpperCase()}</span>
                       {t.emailSource && <Mail size={14} style={{ color: 'var(--primary)', flexShrink: 0 }} title="From Email" />}
                    </div>
                  </td>
                  <td style={{ overflow: 'hidden' }}>
                    <div style={{ overflow: 'hidden' }}>
                      <div style={{ fontWeight: 700, color: 'var(--text-dark)', fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                         <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: 'var(--border)', fontSize: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0 }}>{t.createdBy?.name ? t.createdBy.name[0] : 'U'}</div>
                         <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.createdBy?.name || 'Unknown'} &bull; {new Date(t.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </td>
                  <td style={{ overflow: 'hidden' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, padding: '3px 8px', background: 'var(--surface-alt)', border: '1px solid var(--border)', borderRadius: '6px', display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                      {t.category || t.department}
                    </span>
                  </td>
                  <td className="col-center">
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '8px', background: t.priority === 'critical' ? '#FEF2F2' : t.priority === 'high' ? '#FFFBEB' : '#EFF6FF' }}>
                       <span className={`priority-indicator priority-${t.priority}`} style={{ width: '8px', height: '8px', flexShrink: 0 }} />
                       <span style={{ textTransform: 'capitalize', fontWeight: 700, fontSize: '0.8rem', color: t.priority === 'critical' ? '#991B1B' : t.priority === 'high' ? '#92400E' : '#1E40AF' }}>{t.priority}</span>
                    </div>
                  </td>
                  <td className="col-center">
                    <Badge variant={t.status === 'open' ? 'info' : t.status === 'resolved' ? 'success' : t.status === 'assigned' ? 'primary' : 'warning'}>
                      {t.status.replace('_', ' ')}
                    </Badge>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                      <Clock size={12} />{new Date(t.updatedAt).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="col-right">
                    <button 
                      className="row-action-btn"
                      style={{ marginLeft: 'auto' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenu(activeMenu === t._id ? null : t._id);
                      }}
                      title="Ticket Options"
                    >
                      <MoreHorizontal size={20} strokeWidth={2.2} />
                    </button>
                    
                    <AnimatePresence mode="wait">
                      {activeMenu === t._id && (
                        <motion.div 
                          key="dropdown"
                          initial={{ opacity: 0, scale: 0.95, y: -10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: -10 }}
                          className="dropdown-menu"
                          onClick={e => e.stopPropagation()}
                        >
                          <div className="menu-item" onClick={() => navigate(`/tickets/${t._id}`)}>
                            <Eye size={14} /> View Details
                          </div>
                          {['admin', 'support_agent'].includes(user?.role) && t.status !== 'resolved' && (
                            <div className="menu-item" onClick={(e) => handleAction(t._id, 'resolve', e)}>
                              <CheckSquare size={14} /> Mark Resolved
                            </div>
                          )}
                          {user?.role === 'admin' && (
                            <div className="menu-item danger" onClick={(e) => handleAction(t._id, 'delete', e)}>
                              <Trash2 size={14} /> Delete Ticket
                            </div>
                          )}
                          <div className="menu-divider" />
                          <div className="menu-item disabled" style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                             Updated {new Date(t.updatedAt).toLocaleDateString()}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
      </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
          <AnimatePresence mode="popLayout">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} style={{ height: '200px', background: 'var(--surface-alt)', borderRadius: '20px', animation: 'pulse 1.5s infinite' }} />
              ))
            ) : tickets.length === 0 ? (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px', color: 'var(--text-dim)' }}>No tickets found.</div>
            ) : tickets.map((t, idx) => (
              <motion.div 
                key={t._id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.03 }}
                onClick={() => navigate(`/tickets/${t._id}`)}
                style={{ 
                  background: 'white', padding: '24px', borderRadius: '20px', border: '1px solid var(--border-light)', 
                  cursor: 'pointer', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', boxShadow: 'var(--shadow-sm)',
                  display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative'
                }}
                onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-6px)'; e.currentTarget.style.boxShadow = 'var(--shadow-lg)'; e.currentTarget.style.borderColor = 'var(--primary-light)'; }}
                onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; e.currentTarget.style.borderColor = 'var(--border-light)'; }}
              >
                <div className="flex-between">
                  <span style={{ fontWeight: 900, color: 'var(--primary)', fontSize: '0.75rem', background: 'var(--primary-light)', padding: '6px 12px', borderRadius: '10px' }}>#{t.ticketId || t._id.slice(-6).toUpperCase()}</span>
                  <Badge variant={t.status === 'open' ? 'info' : t.status === 'resolved' ? 'success' : 'primary'}>
                    {t.status.replace('_', ' ')}
                  </Badge>
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-dark)', lineHeight: 1.3, marginBottom: '8px' }}>{t.title}</div>
                  <div className="flex-center gap-2" style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                    <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.7rem' }}>{t.createdBy?.name ? t.createdBy.name[0] : 'U'}</div>
                    <span style={{ fontWeight: 600 }}>{t.createdBy?.name || 'Unknown'}</span>
                    <span>•</span>
                    <span>{new Date(t.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex-between" style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid var(--border-light)' }}>
                  <div className="flex-center gap-2" style={{ padding: '6px 12px', borderRadius: '10px', background: t.priority === 'critical' ? '#FEF2F2' : '#F0F9FF' }}>
                    <span className={`priority-indicator priority-${t.priority}`} style={{ width: '8px', height: '8px' }} />
                    <span style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'capitalize', color: t.priority === 'critical' ? '#991B1B' : '#0369A1' }}>{t.priority}</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 900, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t.category}</div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Pagination Footer */}
        <div className="flex-between" style={{ padding: 'var(--s-4)', borderTop: '1px solid var(--border-light)', background: 'var(--surface-alt)' }}>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Showing page {pagination.page} of {pagination.totalPages}
          </div>
          <div className="flex-center gap-2">
            <Button 
              variant="outline" size="sm" 
              disabled={pagination.page === 1}
              onClick={() => handleFilterChange('page', pagination.page - 1)}
            >
              <ChevronLeft size={16} /> Previous
            </Button>
            <Button 
              variant="outline" size="sm"
              disabled={pagination.page === pagination.totalPages}
              onClick={() => handleFilterChange('page', pagination.page + 1)}
            >
              Next <ChevronRight size={16} />
            </Button>
          </div>
        </div>
      </div>

      <style>{`
        .ticket-row {
          cursor: pointer;
          transition: all 0.2s ease;
          border-bottom: 1px solid #F1F5F9;
        }
        .ticket-row:hover {
          background-color: #F8FAFC !important;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.02);
        }
        .ticket-id-tag {
          font-weight: 800;
          color: var(--primary);
          font-size: 0.8rem;
          background: var(--primary-light);
          padding: 6px 10px;
          border-radius: 8px;
        }
        .ticket-subject {
          font-weight: 700;
          color: var(--text-dark);
          font-size: 0.95rem;
          margin-bottom: 2px;
        }
        .ticket-reporter {
          font-size: 0.75rem;
          color: var(--text-dim);
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .ticket-dept {
          font-size: 0.85rem;
          color: #475569;
          font-weight: 500;
        }
        .priority-indicator {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }
        .ticket-updated {
          font-size: 0.85rem;
          color: #64748B;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .row-action-btn {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          color: #94A3B8;
          background: transparent;
          border: none;
          transition: all 0.2s;
        }
        .row-action-btn:hover {
          background: #F1F5F9;
          color: var(--text-dark);
        }
        .dropdown-menu {
          position: absolute;
          right: 48px;
          top: -10px;
          z-index: 100;
          min-width: 170px;
          background: white;
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 6px;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
          backdrop-filter: blur(10px);
        }
        .menu-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 14px;
          font-size: 0.825rem;
          font-weight: 600;
          color: var(--text-main);
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .menu-item:hover {
          background: var(--primary-light);
          color: var(--primary);
        }
        .menu-item.danger:hover {
          background: #FEF2F2;
          color: #DC2626;
        }
        .menu-divider {
          height: 1px;
          background: #F1F5F9;
          margin: 6px 8px;
        }
        .menu-item.disabled {
          cursor: default;
          pointer-events: none;
        }
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
      `}</style>
    </motion.div>
  );
}
