import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Clock, 
  User, 
  Shield, 
  MessageSquare, 
  Calendar, 
  Paperclip, 
  CheckCircle2, 
  History, 
  MoreVertical,
  RefreshCw,
  BadgeCheck,
  Mail, 
  UserCheck, 
  Hammer, 
  Sparkles, 
  Trophy,
  Plus,
  Activity,
  ShieldCheck,
  Briefcase,
  Send,
  Lock,
  Star,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useToast } from '../context/ToastContext';
import { ticketService, commentService, userService, emailService } from '../services/ticketService';
import { timeAgo, formatDateTime, getInitials, getAvatarColor } from '../utils/helpers';
import { Button, Card, Badge, Input } from '../ui';
import { motion, AnimatePresence } from 'framer-motion';

export default function TicketDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { on, joinTicket, leaveTicket } = useSocket();
  const toast = useToast();
  const navigate = useNavigate();
  const isAdminOrAgent = ['admin', 'support_agent'].includes(user?.role);

  const [ticket, setTicket] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('comments');
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [rating, setRating] = useState(0);
  const [feedbackText, setFeedbackText] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [agents, setAgents] = useState([]);
  const [isReassignModalOpen, setIsReassignModalOpen] = useState(false);
  const [reassignReason, setReassignReason] = useState('');
  const [submittingReassign, setSubmittingReassign] = useState(false);
  const [isInternal, setIsInternal] = useState(false);
  const [ackSent, setAckSent] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [ackTimer, setAckTimer] = useState(null); // seconds remaining for 15-min ack
  const timerRef = useRef(null);

  const isAdmin = user?.role === 'admin';
  const isAgent = user?.role === 'support_agent';
  const isAssignedAgent = isAgent && ticket?.assignedTo?._id === user?._id;

  useEffect(() => {
    fetchTicket();
    fetchComments();
    if (isAdminOrAgent) fetchAgents();
    if (id) joinTicket(id);
    return () => {
      if (id) leaveTicket(id);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [id, user]);

  // 15-min ack countdown (admin only, open tickets)
  useEffect(() => {
    if (!ticket || !isAdmin) return;
    if (['resolved', 'closed'].includes(ticket.status)) return;
    if (ticket.firstResponseAt) { setAckSent(true); return; }

    const createdAt = new Date(ticket.createdAt).getTime();
    const ACK_LIMIT = 15 * 60; // 15 minutes

    const tick = () => setAckTimer(Math.max(0, ACK_LIMIT - Math.floor((Date.now() - createdAt) / 1000)));
    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => clearInterval(timerRef.current);
  }, [ticket?._id, ticket?.status, isAdmin]);


  // Real-time socket listeners for this ticket
  useEffect(() => {
    if (!on || !id) return;

    const offStatus = on('status_updated', (data) => {
      if (data.ticketId === id || data.ticketId === ticket?._id) {
        setTicket(prev => prev ? {
          ...prev,
          status: data.status,
          firstResponseAt: data.firstResponseAt || prev.firstResponseAt,
          statusHistory: [...(prev.statusHistory || []), {
            from: prev.status,
            to: data.status,
            changedBy: data.changedBy,
            timestamp: data.timestamp
          }]
        } : prev);
      }
    });

    const offAssigned = on('ticket_assigned', (data) => {
      if (data.ticketId === id || data.ticketId === ticket?._id) {
        setTicket(prev => prev ? {
          ...prev,
          assignedTo: data.assignedTo,
          firstResponseAt: data.firstResponseAt || prev.firstResponseAt,
          status: prev.status === 'open' ? 'assigned' : prev.status
        } : prev);
      }
    });

    const offComment = on('new_comment', (data) => {
      if (data.ticketId === id || data.ticketId === ticket?._id) {
        setComments(prev => {
          // Avoid duplicates
          if (prev.some(c => c._id === data.comment._id)) return prev;
          return [...prev, data.comment];
        });
      }
    });

    const offPriority = on('priority_updated', (data) => {
      if (data.ticketId === id || data.ticketId === ticket?._id) {
        setTicket(prev => prev ? {
          ...prev,
          priority: data.priority
        } : prev);
      }
    });

    const offReopened = on('ticket_reopened', (data) => {
      if (data.ticketId === id || data.ticketId === ticket?._id) {
        setTicket(prev => prev ? {
          ...prev,
          status: 'reopened',
          statusHistory: [...(prev.statusHistory || []), {
            from: prev.status,
            to: 'reopened',
            reason: data.reason,
            timestamp: new Date().toISOString()
          }]
        } : prev);
      }
    });

    return () => {
      offStatus && offStatus();
      offAssigned && offAssigned();
      offComment && offComment();
      offPriority && offPriority();
      offReopened && offReopened();
    };
  }, [on, id, ticket?._id]);

  const fetchAgents = async () => {
    try {
      const res = await userService.getAgents();
      setAgents(res.data.agents);
    } catch (err) {
      console.error('Error fetching agents:', err);
    }
  };

  const handleAssign = async (agentId) => {
    try {
      await ticketService.assign(id, agentId);
      toast.success('Ticket reassigned successfully!');
      fetchTicket();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reassign');
    }
  };

  const handleSubmitFeedback = async () => {
    if (!rating) return;
    setSubmittingFeedback(true);
    try {
      await ticketService.submitFeedback(id, { 
        rating, 
        comment: feedbackText 
      });
      toast.success('Thank you for your feedback!');
      fetchTicket();
    } catch (err) {
      toast.error('Failed to submit feedback');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const fetchTicket = async () => {
    try {
      const res = await ticketService.getOne(id);
      setTicket(res.data.ticket);
    } catch (err) {
      toast.error('Ticket not found');
      navigate('/tickets');
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async () => {
    try {
      const res = await commentService.getAll(id);
      setComments(res.data.comments || []);
    } catch {}
  };

  const handlePostComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    setSubmittingComment(true);
    try {
      const fd = new FormData();
      fd.append('content', commentText);
      fd.append('isInternal', isInternal);
      await commentService.add(id, fd);
      setCommentText('');
      setIsInternal(false);
      fetchComments();
    } catch (err) {
      toast.error('Failed to post comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  const [isResolving, setIsResolving] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const STATUS_OPTIONS = [
    { value: 'in_progress',     label: ' Working on it',  color: '#2563EB' },
    { value: 'almost_complete', label: ' Almost done',    color: '#7C3AED' },
    { value: 'resolved',        label: ' Fixed / Resolved', color: '#059669' },
  ];

  const handleStatusChange = async (newStatus) => {
    setUpdatingStatus(true);
    try {
      await ticketService.updateStatus(id, {
        status: newStatus,
        resolution: newStatus === 'resolved' ? { notes: 'Issue resolved by admin.' } : undefined
      });
      toast.success('Status updated — worker will be notified by email!');
      fetchTicket();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleResolve = async () => {
    setIsResolving(true);
    try {
      await ticketService.updateStatus(id, { 
        status: 'resolved',
        resolution: { notes: 'Issue has been addressed and resolved.' }
      });
      toast.success('Ticket resolved successfully!');
      fetchTicket();
    } catch (err) {
      toast.error('Failed to resolve ticket');
    } finally {
      setIsResolving(false);
    }
  };


  const handleSendEmail = async (type) => {
    setSendingEmail(true);
    try {
      await emailService.send({ ticketId: ticket._id, type });
      toast.success('"We received it" email sent to worker!');
      setAckSent(true);
      fetchTicket();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send email');
    } finally {
      setSendingEmail(false);
    }
  };

  const formatTime = (secs) => {
    if (secs === null) return '--:--';
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleReassignRequest = async () => {
    if (reassignReason.length < 10) {
      return toast.error('Please provide a reason (min 10 characters)');
    }
    setSubmittingReassign(true);
    try {
      await ticketService.createReassignRequest(id, { reason: reassignReason });
      toast.success('Reassignment request sent to admin');
      setIsReassignModalOpen(false);
      setReassignReason('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send request');
    } finally {
      setSubmittingReassign(false);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (!ticket) return null;

  const isTicketOpen = !['resolved', 'closed'].includes(ticket.status);
  const ackOverdue = ackTimer === 0 && !ackSent;

  // Status progress config for worker banner
  const STATUS_PROGRESS = [
    { value: 'open',             label: 'Received',        icon: <Mail size={16} /> },
    { value: 'assigned',         label: 'Assigned',        icon: <UserCheck size={16} /> },
    { value: 'in_progress',      label: 'Working on it',   icon: <Hammer size={16} /> },
    { value: 'almost_complete',  label: 'Almost done',     icon: <Sparkles size={16} /> },
    { value: 'resolved',         label: 'Fixed!',          icon: <Trophy size={16} /> },
  ];
  const currentStep = STATUS_PROGRESS.findIndex(s => s.value === ticket.status);
  const progressPct = currentStep < 0 ? 0 : Math.round((currentStep / (STATUS_PROGRESS.length - 1)) * 100);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="page-layout"
    >
      {/* Ack Banner — Admin only: 15-min reply deadline */}
      {isAdmin && isTicketOpen && ackTimer !== null && !ackSent && (
        <div style={{
          marginBottom: 'var(--s-6)', padding: '14px 20px', borderRadius: 'var(--r-md)',
          background: ackOverdue ? '#FEF2F2' : ackTimer < 300 ? '#FFFBEB' : '#F0FDF4',
          border: `1px solid ${ackOverdue ? '#FCA5A5' : ackTimer < 300 ? '#FCD34D' : '#86EFAC'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Clock size={20} color={ackOverdue ? '#DC2626' : ackTimer < 300 ? '#D97706' : '#16A34A'} />
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.875rem', color: ackOverdue ? '#DC2626' : ackTimer < 300 ? '#D97706' : '#15803D' }}>
                {ackOverdue
                  ? '⚠️ Reply overdue — worker has been waiting over 15 minutes!'
                  : ackTimer < 300
                  ? ' Less than 5 minutes left — send a reply soon!'
                  : ' Reply within 15 minutes to let the worker know you received their request'}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                Time to reply: <strong style={{ color: ackOverdue ? '#DC2626' : 'inherit', fontVariantNumeric: 'tabular-nums' }}>
                  {ackOverdue ? 'Overdue' : formatTime(ackTimer)}
                </strong>
                &nbsp;·&nbsp; Fixing the issue may take hours or days — that's okay.
              </div>
            </div>
          </div>
          <button
            onClick={() => handleSendEmail('ack')}
            disabled={sendingEmail}
            style={{
              padding: '8px 18px', borderRadius: '8px', border: 'none', cursor: 'pointer',
              background: ackOverdue ? '#DC2626' : '#2563EB', color: 'white',
              fontWeight: 700, fontSize: '0.82rem', opacity: sendingEmail ? 0.6 : 1,
              whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '8px'
            }}
          >
            <CheckCircle2 size={16} />
            {sendingEmail ? 'Sending...' : 'Send "We got your request" Email'}
          </button>
        </div>
      )}

      {ackSent && isAdmin && isTicketOpen && (
        <div style={{ marginBottom: 'var(--s-4)', padding: '10px 16px', borderRadius: 'var(--r-md)', background: '#F0FDF4', border: '1px solid #86EFAC', fontSize: '0.82rem', color: '#15803D', fontWeight: 600 }}>
           Reply sent — worker knows you received their request. Fix it whenever it's ready.
        </div>
      )}

      {/* Worker: live status progress bar (PREMIUM UPGRADE) */}
      {!isAdminOrAgent && (
        <Card style={{ marginBottom: 'var(--s-6)', padding: '24px 32px', border: '1px solid var(--border-light)', boxShadow: '0 4px 20px -5px rgba(0,0,0,0.05)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <div>
              <span style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-main)', display: 'block' }}>Real-time Request Journey</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Track every step of your support experience</span>
            </div>
            <div style={{ padding: '4px 12px', background: 'var(--bg)', borderRadius: '99px', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-dim)', border: '1px solid var(--border)' }}>
              {ticket.status.replace('_', ' ').toUpperCase()}
            </div>
          </div>

          <div style={{ position: 'relative', padding: '10px 0 20px 0' }}>
            {/* Background Track */}
            <div style={{ position: 'absolute', top: '26px', left: '20px', right: '20px', height: '4px', background: '#F1F5F9', borderRadius: '4px' }} />
            
            {/* Active Progress Track with Glow */}
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `calc(${progressPct}% - 40px)` }}
              transition={{ duration: 1, ease: "easeOut" }}
              style={{ 
                position: 'absolute', top: '26px', left: '20px', height: '4px', 
                background: 'linear-gradient(90deg, #3B82F6 0%, #2DD4BF 100%)', 
                borderRadius: '4px', zIndex: 1,
                boxShadow: '0 0 12px rgba(59, 130, 246, 0.5)'
              }} 
            />

            {/* Step Indicators */}
            <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative', zIndex: 2 }}>
              {STATUS_PROGRESS.map((s, i) => {
                const isCompleted = i < currentStep;
                const isActive = i === currentStep;
                const isFuture = i > currentStep;

                return (
                  <div key={s.value} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', width: '80px' }}>
                    <motion.div
                      whileHover={{ scale: 1.1 }}
                      style={{
                        width: '36px', height: '36px', borderRadius: '12px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: isActive ? 'white' : isCompleted ? '#3B82F6' : 'white',
                        color: isActive ? '#3B82F6' : isCompleted ? 'white' : '#94A3B8',
                        border: isActive ? '2px solid #3B82F6' : isCompleted ? 'none' : '1px solid #E2E8F0',
                        boxShadow: isActive ? '0 0 20px rgba(59, 130, 246, 0.25)' : 'none',
                        transition: 'all 0.3s ease'
                      }}
                    >
                      {isCompleted ? <BadgeCheck size={20} /> : s.icon}
                    </motion.div>
                    <span style={{ 
                      fontSize: '0.65rem', fontWeight: isActive ? 800 : 600, 
                      color: isActive ? 'var(--primary)' : isFuture ? 'var(--text-dim)' : 'var(--text-main)',
                      textAlign: 'center', whiteSpace: 'nowrap'
                    }}>
                      {s.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      )}

      {/* Ticket Command Center — Optimized State Controller */}
      {(isAdmin || isAgent) && isTicketOpen && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ 
            marginBottom: 'var(--s-10)', border: '1px solid var(--border-light)', 
            padding: '12px 16px', display: 'flex', alignItems: 'center', 
            justifyContent: 'space-between', gap: '20px',
            background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(20px)',
            boxShadow: '0 20px 40px -15px rgba(0,0,0,0.05)', borderRadius: '24px',
            position: 'relative', zIndex: 10
          }}
        >
          {/* Header Section */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', paddingLeft: '8px' }}>
             <div style={{ 
               width: '44px', height: '44px', background: 'var(--primary)', 
               borderRadius: '16px', display: 'flex', alignItems: 'center', 
               justifyContent: 'center', color: 'white', position: 'relative'
             }}>
               <Activity size={22} strokeWidth={2.5} />
               <div style={{ position: 'absolute', top: '-4px', right: '-4px', width: '12px', height: '12px', background: '#10B981', borderRadius: '50%', border: '2px solid white', animation: 'pulse 2s infinite' }} />
             </div>
             <div>
               <h4 style={{ fontWeight: 900, fontSize: '0.95rem', color: 'var(--text-main)', margin: 0, letterSpacing: '-0.01em' }}>Ticket Management</h4>
               <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', margin: 0, fontWeight: 600 }}>Update state & notify requester</p>
             </div>
          </div>

          {/* Segmented Control with Sliding Highlight */}
          <div style={{ 
            display: 'flex', background: '#F1F5F9', padding: '6px', 
            borderRadius: '18px', border: '1px solid var(--border)', position: 'relative', gap: '6px'
          }}>
            {STATUS_OPTIONS.map(opt => {
              const isActive = ticket.status === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => handleStatusChange(opt.value)}
                  disabled={updatingStatus || isActive}
                  style={{
                    padding: '10px 24px', borderRadius: '14px', border: 'none',
                    background: isActive ? 'white' : 'transparent',
                    color: isActive ? 'var(--text-main)' : 'var(--text-dim)',
                    fontWeight: 800, fontSize: '0.875rem', cursor: isActive ? 'default' : 'pointer',
                    boxShadow: isActive ? '0 10px 15px -3px rgba(0,0,0,0.04)' : 'none',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    display: 'flex', alignItems: 'center', gap: '10px',
                    position: 'relative', zIndex: 1
                  }}
                >
                  <div style={{ 
                    width: '8px', height: '8px', borderRadius: '50%', 
                    background: opt.color, boxShadow: isActive ? `0 0 8px ${opt.color}` : 'none' 
                  }} />
                  {opt.label.replace('Set ', '')}
                </button>
              );
            })}
          </div>

          {/* Extra Action */}
          <div style={{ paddingRight: '8px' }}>
             <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg)', padding: '8px 16px', borderRadius: '12px' }}>
                <Clock size={14} /> <span>Live for {timeAgo(ticket.updatedAt)}</span>
             </div>
          </div>

          <style>{`
            @keyframes pulse {
              0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
              70% { transform: scale(1); box-shadow: 0 0 0 10px rgba(16, 185, 129, 0); }
              100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
            }
          `}</style>
        </motion.div>
      )}

      <div className="flex-between" style={{ marginBottom: '40px', alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
          <button 
            onClick={() => navigate('/tickets')}
            style={{ 
              marginTop: '8px', width: '40px', height: '40px', borderRadius: '12px', 
              border: '1px solid var(--border)', background: 'white', 
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'var(--text-dim)', transition: 'all 0.2s'
            }}
            onMouseOver={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)'; }}
            onMouseOut={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-dim)'; }}
          >
            <ArrowLeft size={20} />
          </button>
          
          <div className="flex-col" style={{ gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ 
                fontSize: '0.72rem', fontWeight: 950, color: 'var(--text-dim)', 
                letterSpacing: '1.2px', background: 'var(--border-light)', 
                padding: '4px 10px', borderRadius: '6px', 
                border: '1px solid var(--border)', display: 'inline-flex',
                boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)'
              }}>
                #{ticket.ticketId || ticket._id.slice(-6).toUpperCase()}
              </span>
              <Badge variant={
                ticket.status === 'open' ? 'info' : 
                ticket.status === 'resolved' ? 'success' : 
                ticket.status === 'assigned' ? 'primary' : 
                'warning'
              } style={{ height: '24px', display: 'flex', alignItems: 'center' }}>
                {ticket.status.replace('_', ' ').toUpperCase()}
              </Badge>
            </div>
            <h1 style={{ fontSize: '2.5rem', fontWeight: 900, letterSpacing: '-0.04em', color: 'var(--text-main)', margin: 0, lineHeight: 0.9 }}>{ticket.title}</h1>
          </div>
        </div>

        <div className="flex-center gap-3">
          <Button variant="outline" size="sm" onClick={() => navigate('/tickets')} leftIcon={<History size={16} />}>History</Button>
          {(isAdmin || (isAgent && isAssignedAgent)) && (
            <Button 
              size="md"
              leftIcon={<CheckCircle2 size={20} />} 
              onClick={handleResolve} 
              disabled={ticket.status === 'resolved'}
              isLoading={isResolving}
              style={{ padding: '0 24px', borderRadius: '14px', fontWeight: 800, fontSize: '0.95rem', boxShadow: '0 8px 20px -6px rgba(30, 64, 175, 0.4)' }}
            >
              Resolve Ticket
            </Button>
          )}
        </div>
      </div>

      <div className="ticket-detail-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '32px', alignItems: 'start' }}>
        <div className="flex-col gap-6">
          {/* Main Content */}
          <Card>
            <div className="flex-between mb-4">
              <div className="flex-center gap-3">
                <div className="flex-center" style={{ width: '40px', height: '40px', background: getAvatarColor(ticket.createdBy?.name), borderRadius: 'var(--r-md)', color: 'white' }}>
                  {getInitials(ticket.createdBy?.name)}
                </div>
                <div>
                  <div style={{ fontWeight: 700 }}>{ticket.createdBy?.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{ticket.createdBy?.email}</div>
                </div>
              </div>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-dim)' }}>{formatDateTime(ticket.createdAt)}</div>
            </div>
            <div style={{ padding: 'var(--s-4) 0', borderTop: '1px solid var(--border-light)', lineHeight: 1.7 }}>
              {ticket.description}
            </div>
          </Card>

          {/* Resolution Insight */}
          {(ticket.status === 'resolved' || ticket.status === 'closed') && ticket.resolution && (
            <Card style={{ background: 'var(--success-light)', border: '1px solid var(--success)', padding: 'var(--s-6)' }}>
               <div className="flex-center gap-2 mb-3" style={{ color: 'var(--success-dark)', fontWeight: 800 }}>
                  <CheckCircle2 size={20} /> Resolution Details
               </div>
               <div style={{ fontSize: '0.95rem', color: 'var(--text-dark)', lineHeight: 1.6 }}>
                  {ticket.resolution.notes || "This issue has been successfully resolved."}
               </div>
               <div style={{ marginTop: '12px', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                  Resolved on {formatDateTime(ticket.resolution.resolvedAt || ticket.updatedAt)}
               </div>
            </Card>
          )}

          {/* Discussion */}
          <div className="flex-col gap-4">
             <div className="flex-center gap-2" style={{ fontWeight: 700, paddingLeft: 'var(--s-2)' }}>
               <MessageSquare size={18} /> Messages & Replies
             </div>

             <div className="flex-col gap-4">
               {comments.map(comment => (
                 <Card key={comment._id} style={{ padding: 'var(--s-4)', background: comment.isInternal ? '#FFFBEB' : 'white' }}>
                   <div className="flex-between mb-2">
                     <div className="flex-center gap-2">
                       <div className="flex-center" style={{ width: '24px', height: '24px', background: getAvatarColor(comment.author?.name), borderRadius: '4px', color: 'white', fontSize: '0.6rem' }}>
                         {getInitials(comment.author?.name)}
                       </div>
                       <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>{comment.author?.name}</span>
                       {comment.isInternal && <Badge variant="warning">Staff Only</Badge>}
                     </div>
                     <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{timeAgo(comment.createdAt)}</span>
                   </div>
                   <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{comment.content}</div>
                 </Card>
               ))}
             </div>

             {/* Comment Input */}
              <Card style={{ padding: 'var(--s-4)', border: isInternal ? '2px solid var(--warning)' : '1px solid var(--border)' }}>
                <form onSubmit={handlePostComment}>
                  {isInternal && <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--warning)', textTransform: 'uppercase', marginBottom: '8px' }}>Staff-Only Note (Worker cannot see this)</div>}
                  <textarea 
                    className="input"
                    style={{ height: '80px', paddingTop: '12px', marginBottom: 'var(--s-4)', border: 'none', background: 'var(--bg)', borderRadius: 'var(--r-md)' }}
                    placeholder={isInternal ? "Write a private note for staff only..." : "Write your reply here..."}
                    value={commentText}
                    onChange={e => setCommentText(e.target.value)}
                  />
                  <div className="flex-between">
                    <div className="flex-center gap-2">
                      <Button variant="ghost" size="sm" leftIcon={<Paperclip size={16} />}>Attach File</Button>
                      {isAdminOrAgent && (
                        <Button 
                          variant={isInternal ? "warning" : "ghost"} 
                          size="sm" 
                          leftIcon={<Lock size={16} />}
                          onClick={() => setIsInternal(!isInternal)}
                          type="button"
                        >
                          {isInternal ? 'Staff Note (On)' : 'Mark as Staff-Only'}
                        </Button>
                      )}
                    </div>
                    <Button 
                      size="sm" 
                      type="submit" 
                      variant={isInternal ? "warning" : "primary"}
                      isLoading={submittingComment} 
                      rightIcon={<Send size={14} />}
                    >
                      {isInternal ? "Post Staff Note" : "Send Reply"}
                    </Button>
                  </div>
                </form>
              </Card>
          </div>
        </div>

        {/* Sidebar Info */}
        <div className="flex-col gap-6">
          <Card style={{ border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-md)', borderRadius: '24px', overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-light)', background: 'var(--surface-alt)' }}>
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 900, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Shield size={18} color="var(--primary)" /> Ticket Properties
              </h3>
            </div>
            <div style={{ padding: '20px 24px' }} className="flex-col gap-5">
              
              {/* Row: Status */}
              <div className="flex-between">
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  <Activity size={14} /> Status
                </span>
                <Badge variant={
                  ticket.status === 'open' ? 'info' : 
                  ticket.status === 'resolved' ? 'success' : 
                  ticket.status === 'assigned' ? 'primary' : 
                  'warning'
                }>
                  {ticket.status.replace('_', ' ').toUpperCase()}
                </Badge>
              </div>

              {/* Row: Priority */}
              <div className="flex-between">
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  <ShieldCheck size={14} /> Intensity
                </span>
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    <div style={{ width: '40px', height: '6px', borderRadius: '4px', background: ticket.priority === 'low' ? 'var(--success)' : '#E2E8F0' }} />
                    <div style={{ width: '40px', height: '6px', borderRadius: '4px', background: (ticket.priority === 'medium' || ticket.priority === 'high' || ticket.priority === 'critical') ? (ticket.priority === 'medium' ? 'var(--primary)' : 'var(--warning)') : '#E2E8F0' }} />
                    <div style={{ width: '40px', height: '6px', borderRadius: '4px', background: (ticket.priority === 'high' || ticket.priority === 'critical') ? 'var(--danger)' : '#E2E8F0' }} />
                    <span style={{ marginLeft: '8px', fontWeight: 800, fontSize: '0.8rem', color: 'var(--text-main)', textTransform: 'capitalize' }}>{ticket.priority}</span>
                </div>
              </div>

              {/* Row: Department */}
              <div className="flex-between" style={{ padding: '12px 0', borderTop: '1px dashed var(--border)', borderBottom: '1px dashed var(--border)' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  <Briefcase size={14} /> Domain
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                   <div style={{ width: '24px', height: '24px', borderRadius: '6px', background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Lock size={12} />
                   </div>
                   <span style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.875rem' }}>{ticket.department}</span>
                </div>
              </div>

              {/* Row: Assignee */}
              <div className="flex-col gap-3">
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  <User size={14} /> Assigned Specialist
                </span>
                {isAdmin ? (
                  <div style={{ position: 'relative' }}>
                    <select 
                      style={{ 
                        width: '100%', appearance: 'none', border: '1px solid var(--border)', 
                        background: 'white', fontSize: '0.875rem', fontWeight: 700, 
                        padding: '12px 16px', borderRadius: '14px', cursor: 'pointer', 
                        boxShadow: 'var(--shadow-sm)', color: 'var(--text-main)' 
                      }}
                      value={ticket.assignedTo?._id || ''}
                      onChange={(e) => handleAssign(e.target.value)}
                    >
                      <option value="">Search to assign...</option>
                      {agents.map(a => (
                        <option key={a._id} value={a._id}>{a.name} ({a.currentWorkload} active)</option>
                      ))}
                    </select>
                    <div style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-dim)' }}>
                       <ChevronRight size={16} transform="rotate(90)" />
                    </div>
                  </div>
                ) : ticket.assignedTo ? (
                   <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'var(--bg)', borderRadius: '16px', border: '1px solid var(--border)' }}>
                      <div style={{ width: '36px', height: '36px', background: getAvatarColor(ticket.assignedTo.name), borderRadius: '12px', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.9rem' }}>
                        {getInitials(ticket.assignedTo.name)}
                      </div>
                      <div className="flex-col">
                        <span style={{ fontWeight: 800, fontSize: '0.875rem', color: 'var(--text-main)' }}>{ticket.assignedTo.name}</span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', fontWeight: 600 }}>Department Specialist</span>
                      </div>
                   </div>
                ) : (
                  <div style={{ padding: '16px', borderRadius: '16px', border: '2px dashed var(--border)', textAlign: 'center', background: 'var(--surface-alt)' }}>
                     <span style={{ color: 'var(--text-dim)', fontSize: '0.82rem', fontWeight: 700, fontStyle: 'italic' }}>Pending Assignment</span>
                  </div>
                )}
              </div>
            </div>
          </Card>

          <Card title="Activity Log">
             <div className="flex-col gap-6" style={{ position: 'relative', paddingLeft: '10px' }}>
                {/* Vertical Line Connector */}
                <div style={{ position: 'absolute', left: '19px', top: '24px', bottom: '24px', width: '2px', background: 'linear-gradient(to bottom, #E2E8F0, #F1F5F9)', borderRadius: '2px' }} />

                {/* Creation Event */}
                <div className="flex gap-4" style={{ position: 'relative', zIndex: 1 }}>
                   <div className="flex-center" style={{ width: '20px', height: '20px', background: 'white', borderRadius: '50%', border: '2px solid var(--primary)', color: 'var(--primary)', boxShadow: '0 0 0 4px white' }}>
                      <Plus size={10} strokeWidth={4} />
                   </div>
                   <div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '2px' }}>Ticket Initialized</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                         <Clock size={10} /> {timeAgo(ticket.createdAt)}
                      </div>
                   </div>
                </div>

                {/* History Events */}
                {ticket.statusHistory?.map((history, idx) => {
                  const isResolved = history.to === 'resolved' || history.to === 'closed';
                  return (
                    <div key={history._id || idx} className="flex gap-4" style={{ position: 'relative', zIndex: 1 }}>
                      <div className="flex-center" style={{ 
                        width: '20px', height: '20px', background: 'white', borderRadius: '50%', 
                        border: `2px solid ${isResolved ? 'var(--success)' : 'var(--warning)'}`, 
                        color: isResolved ? 'var(--success)' : 'var(--warning)',
                        boxShadow: '0 0 0 4px white'
                      }}>
                        {isResolved ? <CheckCircle2 size={10} strokeWidth={4} /> : <Activity size={10} strokeWidth={4} />}
                      </div>
                      <div>
                        <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '2px' }}>
                          Shifted to <span style={{ textTransform: 'uppercase', color: isResolved ? 'var(--success-dark)' : 'var(--warning-dark)' }}>{history.to?.replace('_', ' ')}</span>
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <User size={10} /> {history.changedBy?.name || 'Automated System'} • {timeAgo(history.timestamp)}
                        </div>
                      </div>
                    </div>
                  );
                })}
             </div>
          </Card>

          <Card title="How Was Your Experience?" style={{ background: ticket.feedback?.rating ? '#F0FDF4' : 'white' }}>
             {ticket.feedback?.rating ? (
               <div className="flex-col gap-2">
                  <div className="flex gap-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} size={16} fill={i < ticket.feedback.rating ? 'var(--warning)' : 'none'} color="var(--warning)" />
                    ))}
                  </div>
                  <p style={{ fontSize: '0.875rem', fontStyle: 'italic' }}>"{ticket.feedback.comment}"</p>
               </div>
             ) : (
               ticket.status === 'resolved' && (user?._id === ticket.createdBy?._id) ? (
                 <div className="flex-col gap-3">
                   <div className="flex gap-2">
                     {[1, 2, 3, 4, 5].map((star) => (
                       <button
                         key={star}
                         onClick={() => setRating(star)}
                         style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                       >
                         <Star 
                           size={24} 
                           fill={star <= rating ? 'var(--warning)' : 'none'} 
                           color="var(--warning)" 
                         />
                       </button>
                     ))}
                   </div>
                   <textarea
                     className="input"
                     placeholder="Tell us about your experience..."
                     value={feedbackText}
                     onChange={(e) => setFeedbackText(e.target.value)}
                     style={{ minHeight: '60px', padding: '8px', fontSize: '0.8rem' }}
                   />
                   <Button 
                     size="sm" 
                     onClick={handleSubmitFeedback}
                     disabled={!rating}
                     isLoading={submittingFeedback}
                   >
                     Submit Rating & Close
                   </Button>
                 </div>
               ) : (
                 <p style={{ fontSize: '0.875rem', color: 'var(--text-dim)' }}>
                   {ticket.status === 'resolved' 
                     ? "You can now rate how this was handled." 
                     : "You can rate this once it's fixed."}
                 </p>
               )
             )}
          </Card>
        </div>
      </div>

      {/* Reassignment Modal */}
      {isReassignModalOpen && (
        <div className="modal-overlay" onClick={() => setIsReassignModalOpen(false)}>
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="modal" 
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: '450px' }}
          >
             <h3 style={{ marginBottom: '16px' }}>Ask to Transfer Ticket</h3>
             <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)', marginBottom: '16px' }}>Please explain why this ticket should be transferred to another agent.</p>
             <textarea 
               className="input" 
               style={{ height: '100px', marginBottom: '20px' }}
               placeholder="Reason for transfer..."
               value={reassignReason}
               onChange={e => setReassignReason(e.target.value)}
             />
             <div className="flex-end gap-3">
                <Button variant="ghost" onClick={() => setIsReassignModalOpen(false)}>Cancel</Button>
                <Button onClick={handleReassignRequest} isLoading={submittingReassign}>Send Request</Button>
             </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
