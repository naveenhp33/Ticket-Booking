import { useState, useEffect } from 'react';
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
import { Button, Input, Card, Badge } from '../ui';
import { motion, AnimatePresence } from 'framer-motion';

export default function TicketsPage() {
  const navigate = useNavigate();
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
          page: res.data.page,
          totalPages: res.data.totalPages
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
      <div className="flex-between mb-8" style={{ marginBottom: 'var(--s-8)' }}>
        <div>
          <h1 style={{ fontSize: '1.875rem' }}>Support Tickets</h1>
          <p style={{ color: 'var(--text-muted)' }}>Manage and track all support requests in one place.</p>
        </div>
        <Button onClick={() => navigate('/tickets/new')} leftIcon={<Plus size={18} />}>
          New Ticket
        </Button>
      </div>

      <Card className="mb-6" style={{ padding: 'var(--s-4)', marginBottom: 'var(--s-6)' }}>
        <div className="flex-between gap-4">
          <div className="flex-1 flex-center gap-4">
            <div style={{ position: 'relative', width: '100%', maxWidth: '320px' }}>
              <Search size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-dim)' }} />
              <input 
                placeholder="Search by ID, subject..." 
                className="input" 
                style={{ paddingLeft: '40px' }}
                value={filters.search}
                onChange={e => handleFilterChange('search', e.target.value)}
              />
            </div>
            
            <select 
              className="input" 
              style={{ width: '160px' }}
              value={filters.status}
              onChange={e => handleFilterChange('status', e.target.value)}
            >
              <option value="">All Status</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>

            <select 
              className="input" 
              style={{ width: '160px' }}
              value={filters.priority}
              onChange={e => handleFilterChange('priority', e.target.value)}
            >
              <option value="">All Priority</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          <div className="flex-center gap-2">
             <Button variant="ghost" size="sm" leftIcon={<Filter size={16} />}>More Filters</Button>
          </div>
        </div>
      </Card>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th><div className="flex-center gap-2">Ticket ID <ArrowUpDown size={14} /></div></th>
              <th>Subject & Reporter</th>
              <th>Department</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Last Updated</th>
              <th style={{ width: '40px' }}></th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence mode="popLayout">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}><td colSpan="7"><div style={{ height: '48px', background: 'var(--surface-alt)', width: '100%', borderRadius: '4px', animation: 'pulse 1.5s infinite' }} /></td></tr>
                ))
              ) : tickets.length === 0 ? (
                <tr><td colSpan="7" style={{ textAlign: 'center', padding: 'var(--s-12)' }}>No tickets found matching your filters.</td></tr>
              ) : tickets.map((t, idx) => (
                <motion.tr 
                  key={t._id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  onClick={() => navigate(`/tickets/${t._id}`)}
                  style={{ cursor: 'pointer' }}
                >
                  <td style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '0.8rem' }}>#{t.ticketId || t._id.slice(-6).toUpperCase()}</td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{t.title}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>by {t.createdBy?.name}</div>
                  </td>
                  <td><div style={{ fontSize: '0.875rem' }}>{t.department}</div></td>
                  <td>
                    <div className="flex-center gap-2">
                       <span className={`priority-dot priority-${t.priority}`} />
                       <span style={{ textTransform: 'capitalize' }}>{t.priority}</span>
                    </div>
                  </td>
                  <td><Badge variant={t.status === 'open' ? 'primary' : t.status === 'resolved' ? 'success' : 'warning'}>{t.status.replace('_', ' ')}</Badge></td>
                  <td>
                    <div style={{ fontSize: '0.875rem' }} className="flex-center gap-2">
                      <Clock size={14} color="var(--text-dim)" />
                      {new Date(t.updatedAt).toLocaleDateString()}
                    </div>
                  </td>
                  <td><button className="flex-center" style={{ color: 'var(--text-dim)' }}><MoreVertical size={18} /></button></td>
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
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
      `}</style>
    </motion.div>
  );
}
