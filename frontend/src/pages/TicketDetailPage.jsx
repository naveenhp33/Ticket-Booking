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
  Send,
  Lock,
  Star,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useToast } from '../context/ToastContext';
import { ticketService, commentService, userService } from '../services/ticketService';
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

  const isAdmin = user?.role === 'admin';
  const isAgent = user?.role === 'support_agent';
  const isAssignedAgent = isAgent && ticket?.assignedTo?._id === user?._id;

  useEffect(() => {
    fetchTicket();
    fetchComments();
    if (isAdminOrAgent) {
      fetchAgents();
    }
    // Join the ticket's socket room for real-time updates
    if (id) joinTicket(id);
    return () => {
      if (id) leaveTicket(id);
    };
  }, [id, user]);

  // Real-time socket listeners for this ticket
  useEffect(() => {
    if (!on || !id) return;

    const offStatus = on('status_updated', (data) => {
      if (data.ticketId === id || data.ticketId === ticket?._id) {
        setTicket(prev => prev ? {
          ...prev,
          status: data.status,
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



  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="page-layout"
    >
      <div className="flex-between mb-8" style={{ marginBottom: 'var(--s-8)' }}>
        <div className="flex-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/tickets')}><ArrowLeft size={20} /></Button>
          <div className="flex-col">
            <div className="flex-center gap-2 mb-1">
              <span style={{ color: 'var(--text-dim)', fontWeight: 600, fontSize: '0.8rem' }}>#{ticket.ticketId || ticket._id.slice(-6).toUpperCase()}</span>
              <Badge variant={ticket.status === 'open' ? 'primary' : 'success'}>{ticket.status}</Badge>
            </div>
            <h1 style={{ fontSize: '1.5rem' }}>{ticket.title}</h1>
          </div>
        </div>
        <div className="flex-center gap-3">
          <Button variant="outline" leftIcon={<History size={18} />}>History</Button>
          {isAssignedAgent && ticket.status !== 'resolved' && (
            <Button 
                variant="outline" 
                leftIcon={<RefreshCw size={18} />}
                onClick={() => setIsReassignModalOpen(true)}
            >
                Request Reassignment
            </Button>
          )}
          {(isAdmin || (isAgent && isAssignedAgent)) && (
            <Button 
              leftIcon={<CheckCircle2 size={18} />} 
              onClick={handleResolve} 
              disabled={ticket.status === 'resolved'}
              isLoading={isResolving}
            >
              Resolve Ticket
            </Button>
          )}
        </div>
      </div>

      <div className="create-ticket-grid">
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
               <MessageSquare size={18} /> Discussion Thread
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
                       {comment.isInternal && <Badge variant="warning">Internal</Badge>}
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
                  {isInternal && <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--warning)', textTransform: 'uppercase', marginBottom: '8px' }}>Posting as Internal Note (Hidden from Customer)</div>}
                  <textarea 
                    className="input"
                    style={{ height: '80px', paddingTop: '12px', marginBottom: 'var(--s-4)', border: 'none', background: 'var(--bg)', borderRadius: 'var(--r-md)' }}
                    placeholder={isInternal ? "Write private agent note..." : "Write your message here..."}
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
                          {isInternal ? "Private Note On" : "Internal Note"}
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
                      {isInternal ? "Post Private Note" : "Reply"}
                    </Button>
                  </div>
                </form>
              </Card>
          </div>
        </div>

        {/* Sidebar Info */}
        <div className="flex-col gap-6">
          <Card title="Properties">
            <div className="flex-col gap-4">
              <div className="flex-between">
                <span style={{ fontSize: '0.875rem', color: 'var(--text-dim)' }}>Status</span>
                <Badge variant={ticket.status === 'open' ? 'primary' : 'success'}>{ticket.status}</Badge>
              </div>
              <div className="flex-between">
                <span style={{ fontSize: '0.875rem', color: 'var(--text-dim)' }}>Priority</span>
                <div className="flex-center gap-2">
                  <span className={`priority-dot priority-${ticket.priority}`} />
                  <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{ticket.priority}</span>
                </div>
              </div>
              <div className="flex-between">
                <span style={{ fontSize: '0.875rem', color: 'var(--text-dim)' }}>Department</span>
                <span style={{ fontWeight: 600 }}>{ticket.department}</span>
              </div>
              <div className="flex-between">
                <span style={{ fontSize: '0.875rem', color: 'var(--text-dim)' }}>Assignee</span>
                {isAdmin ? (
                  <select 
                    style={{ border: 'none', background: 'var(--bg)', fontSize: '0.875rem', fontWeight: 600, padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', maxWidth: '150px' }}
                    value={ticket.assignedTo?._id || ''}
                    onChange={(e) => handleAssign(e.target.value)}
                  >
                    <option value="">Unassigned</option>
                    {agents.map(a => (
                      <option key={a._id} value={a._id}>{a.name}</option>
                    ))}
                  </select>
                ) : ticket.assignedTo ? (
                   <div className="flex-center gap-2">
                      <div className="flex-center" style={{ width: '20px', height: '20px', background: getAvatarColor(ticket.assignedTo.name), borderRadius: '4px', color: 'white', fontSize: '0.5rem' }}>{getInitials(ticket.assignedTo.name)}</div>
                      <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{ticket.assignedTo.name}</span>
                   </div>
                ) : <span style={{ color: 'var(--text-dim)' }}>Unassigned</span>}
              </div>
            </div>
          </Card>

          <Card title="Timeline">
             <div className="flex-col gap-4">
                {/* Creation Event */}
                <div className="flex gap-3">
                   <div className="flex-col flex-center">
                     <div className="priority-dot" style={{ background: 'var(--primary)' }} />
                     {ticket.statusHistory?.length > 0 && <div style={{ flex: 1, width: '2px', background: 'var(--border-light)' }} />}
                   </div>
                   <div>
                      <div style={{ fontSize: '0.8rem', fontWeight: 700 }}>Ticket Created</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>{timeAgo(ticket.createdAt)}</div>
                   </div>
                </div>

                {/* History Events */}
                {ticket.statusHistory?.map((history, idx) => (
                  <div key={history._id || idx} className="flex gap-3">
                    <div className="flex-col flex-center">
                      <div className="priority-dot" style={{ background: history.to === 'resolved' ? 'var(--success)' : 'var(--warning)' }} />
                      {idx < ticket.statusHistory.length - 1 && <div style={{ flex: 1, width: '2px', background: 'var(--border-light)' }} />}
                    </div>
                    <div>
                      <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'capitalize' }}>
                        Status: {history.to?.replace('_', ' ')}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                        {history.changedBy?.name || 'System'} • {timeAgo(history.timestamp)}
                      </div>
                      {history.reason && <div style={{ fontSize: '0.7rem', marginTop: '2px', color: 'var(--text-muted)', fontStyle: 'italic' }}>"{history.reason}"</div>}
                    </div>
                  </div>
                ))}
             </div>
          </Card>

          <Card title="Customer Satisfaction" style={{ background: ticket.feedback?.rating ? '#F0FDF4' : 'white' }}>
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
                     Submit & Close Ticket
                   </Button>
                 </div>
               ) : (
                 <p style={{ fontSize: '0.875rem', color: 'var(--text-dim)' }}>
                   {ticket.status === 'resolved' 
                     ? "Creator can now provide feedback." 
                     : "Waiting for resolution feedback."}
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
            <div className="modal-header">
              <h3 className="card-title">Request Reassignment</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Tell your admin why this ticket should be moved to another agent.</p>
            </div>
            <div className="modal-body">
              <div className="input-group">
                <label className="input-label">Reason for Request (Mandatory)</label>
                <textarea 
                  className="input"
                  style={{ height: '120px', paddingTop: '12px' }}
                  placeholder="e.g., This issue requires specialized knowledge in Finance systems which I don't have access to."
                  value={reassignReason}
                  onChange={e => setReassignReason(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="modal-footer">
              <Button variant="ghost" onClick={() => setIsReassignModalOpen(false)}>Cancel</Button>
              <Button isLoading={submittingReassign} onClick={handleReassignRequest}>Send Request</Button>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
