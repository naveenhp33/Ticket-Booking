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
  Clock
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ticketService } from '../services/ticketService';
import { useSocket } from '../context/SocketContext';
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
    search: searchParams.get('search') || '',
    myTickets: searchParams.get('myTickets') || ''
  });
  
  const { on } = useSocket();

  useEffect(() => {
    const offTicketCreated = on('ticket_created', (data) => {
      if (data.ticket && pagination.page === 1) {
        // Only prepend if we're on the first page
        setTickets(prev => [data.ticket, ...prev].slice(0, 10));
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
    const params = {
      page: searchParams.get('page') || 1,
      limit: 10,
      status: filters.status,
      priority: filters.priority,
      search: filters.search,
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
    fetchTickets();
  }, [searchParams, filters.myTickets]);

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

      <div className="flex-between gap-4 mb-8" style={{ background: 'white', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div className="flex-center gap-4 flex-1">
          <div style={{ position: 'relative', width: '100%', maxWidth: '300px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
            <input 
              placeholder="Filter results..." 
              className="input" 
              style={{ paddingLeft: '36px', background: 'var(--bg)', border: '1px solid transparent', height: '36px', fontSize: '0.85rem' }}
              value={filters.search}
              onChange={e => handleFilterChange('search', e.target.value)}
            />
          </div>
          
          <div className="flex-center gap-2">
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase' }}>Status</span>
            <select 
              className="input" 
              style={{ width: '110px', height: '32px', fontSize: '0.8rem', background: 'var(--bg)', border: '1px solid transparent', padding: '0 8px' }}
              value={filters.status}
              onChange={e => handleFilterChange('status', e.target.value)}
            >
              <option value="">All</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
          </div>

          <div className="flex-center gap-2">
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase' }}>Priority</span>
            <select 
              className="input" 
              style={{ width: '110px', height: '32px', fontSize: '0.8rem', background: 'var(--bg)', border: '1px solid transparent', padding: '0 8px' }}
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

        <div className="flex-center gap-2">
            <Button variant="ghost" size="sm" style={{ height: '32px', minWidth: 'unset' }} leftIcon={<Filter size={14} />}>Filters</Button>
            {user?.role === 'employee' && (
              <Button variant="outline" size="sm" style={{ height: '32px', minWidth: 'unset' }} onClick={() => navigate('/tickets/new')} leftIcon={<Plus size={14} />}>New</Button>
            )}
        </div>
      </div>

      <div className="table-container" style={{ border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <table style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead>
            <tr style={{ background: '#F8FAFC' }}>
              <th style={{ padding: '16px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>
                <div className="flex-center gap-2">Ticket ID <ArrowUpDown size={12} /></div>
              </th>
              <th style={{ padding: '16px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>Subject & Reporter</th>
              <th style={{ padding: '16px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>Category</th>
              <th style={{ padding: '16px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>Priority</th>
              <th style={{ padding: '16px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>Status</th>
              <th style={{ padding: '16px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>Last Activity</th>
              <th style={{ width: '40px', borderBottom: '1px solid var(--border)' }}></th>
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
                  <td style={{ padding: '16px' }}>
                    <span className="ticket-id-tag">#{t.ticketId || t._id.slice(-6).toUpperCase()}</span>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <div className="flex-col gap-1">
                      <div style={{ fontWeight: 700, color: 'var(--text-dark)', fontSize: '0.95rem' }}>{t.title}</div>
                      <div className="flex-center gap-2" style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                         <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: 'var(--border)', fontSize: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{t.createdBy?.name ? t.createdBy.name[0] : 'U'}</div>
                         {t.createdBy?.name || 'Unknown'} • {new Date(t.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, padding: '4px 10px', background: 'var(--surface-alt)', border: '1px solid var(--border)', borderRadius: '6px', display: 'inline-block', color: 'var(--text-main)' }}>
                      {t.category || t.department}
                    </div>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <div className="flex-center gap-2" style={{ padding: '6px 12px', borderRadius: '8px', background: t.priority === 'critical' ? '#FEF2F2' : t.priority === 'high' ? '#FFFBEB' : '#EFF6FF', width: 'fit-content' }}>
                       <span className={`priority-indicator priority-${t.priority}`} style={{ width: '8px', height: '8px' }} />
                       <span style={{ textTransform: 'capitalize', fontWeight: 700, fontSize: '0.85rem', color: t.priority === 'critical' ? '#991B1B' : t.priority === 'high' ? '#92400E' : '#1E40AF' }}>{t.priority}</span>
                    </div>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <Badge variant={
                      t.status === 'open' ? 'info' : 
                      t.status === 'resolved' ? 'success' : 
                      t.status === 'assigned' ? 'primary' : 
                      'warning'
                    }>
                      {t.status.replace('_', ' ')}
                    </Badge>
                  </td>
                  <td>
                    <div className="ticket-updated">
                      <Clock size={12} />
                      {new Date(t.updatedAt).toLocaleDateString()}
                    </div>
                  </td>
                  <td><button className="row-action-btn"><MoreVertical size={16} /></button></td>
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>

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
          borderRadius: 8px;
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
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
      `}</style>
    </motion.div>
  );
}
