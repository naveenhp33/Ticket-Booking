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
  Star
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
  const { on } = useSocket();
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

  useEffect(() => {
    fetchTicket();
    fetchComments();
    if (isAdminOrAgent) {
      fetchAgents();
    }
  }, [id, user]);

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
      await ticketService.updateStatus(id, { assignedTo: agentId });
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
      await commentService.add(id, fd);
      setCommentText('');
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
          {isAdminOrAgent && (
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 'var(--s-8)' }}>
        <div className="flex-col gap-6">
          {/* Main Content */}
          <Card>
            <div className="flex-between mb-4">
              <div className="flex-center gap-3">
                <div className="flex-center" style={{ width: '40px', height: '40px', background: getAvatarColor(ticket.requestedBy?.name), borderRadius: 'var(--r-md)', color: 'white' }}>
                  {getInitials(ticket.requestedBy?.name)}
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
             <Card style={{ padding: 'var(--s-4)' }}>
               <form onSubmit={handlePostComment}>
                 <textarea 
                   className="input"
                   style={{ height: '80px', paddingTop: '12px', marginBottom: 'var(--s-4)', border: 'none', background: 'var(--bg)', borderRadius: 'var(--r-md)' }}
                   placeholder="Write your message here..."
                   value={commentText}
                   onChange={e => setCommentText(e.target.value)}
                 />
                 <div className="flex-between">
                   <div className="flex-center gap-2">
                     <Button variant="ghost" size="sm" leftIcon={<Paperclip size={16} />}>Attach File</Button>
                     {isAdminOrAgent && <Button variant="ghost" size="sm" leftIcon={<Lock size={16} />}>Internal Note</Button>}
                   </div>
                   <Button size="sm" type="submit" isLoading={submittingComment} rightIcon={<Send size={14} />}>Reply</Button>
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
                {isAdminOrAgent ? (
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
                        Status: {history.to.replace('_', ' ')}
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
    </motion.div>
  );
}
