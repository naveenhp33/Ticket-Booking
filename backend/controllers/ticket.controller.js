const Ticket = require('../models/Ticket.model');
const User = require('../models/User.model');
const Comment = require('../models/Comment.model');
const {
  calculatePriorityScore,
  calculateSLADeadline,
  calculateResponseDeadline,
  suggestPriorityFromText,
  recalculateTicketScore
} = require('../services/priority.service');
const { autoAssignTicket, incrementWorkload, decrementWorkload } = require('../services/assignment.service');
const { notifyTicketAssigned, notifyStatusChange, createNotification } = require('../services/notification.service');
const { sendTicketConfirmation, sendStatusUpdate } = require('../services/email.service');
const { emitToUser, emitToRole, emitToTicket } = require('../config/socket');

// @desc    Create ticket
// @route   POST /api/tickets
// @access  Private
const createTicket = async (req, res, next) => {
  try {
    const {
      title, description, category, impactScope, urgencyLevel,
      preferredContact, context, relatedTickets, manualPriority,
      issueStarted, tags
    } = req.body;

    // Duplicate detection
    const duplicateCheck = await Ticket.findOne({
      createdBy: req.user._id,
      status: { $nin: ['resolved', 'closed'] },
      $text: { $search: title }
    }).select('ticketId title status');

    // Build attachments from uploaded files
    const attachments = (req.files || []).map(f => ({
      filename: f.filename,
      originalName: f.originalname,
      mimetype: f.mimetype,
      size: f.size,
      path: f.path,
      uploadedBy: req.user._id
    }));

    // Calculate priority score
    const scoring = calculatePriorityScore({
      impactScope: impactScope || 'just_me',
      urgencyLevel: urgencyLevel || 'flexible',
      role: req.user.role,
      title,
      description,
      createdAt: new Date()
    });

    // If manual priority specified by agent/admin, respect it but log audit
    const finalPriority = (manualPriority && ['admin', 'support_agent'].includes(req.user.role))
      ? manualPriority
      : scoring.priority;

    const prioritySource = manualPriority && ['admin', 'support_agent'].includes(req.user.role)
      ? 'manual' : 'auto';

    const slaDeadline = calculateSLADeadline(finalPriority);
    const responseDeadline = calculateResponseDeadline(finalPriority);

    const ticket = await Ticket.create({
      title: title.trim(),
      description: description.trim(),
      category,
      priority: finalPriority,
      priorityScore: scoring.finalScore,
      prioritySource,
      scoreBreakdown: scoring.breakdown,
      impactScope: impactScope || 'just_me',
      urgencyLevel: urgencyLevel || 'flexible',
      createdBy: req.user._id,
      preferredContact: preferredContact || req.user.preferredContact,
      context: { ...context, issueStarted },
      relatedTickets: relatedTickets || [],
      attachments,
      tags: tags || [],
      sla: { deadline: slaDeadline, responseDeadline }
    });

    // Auto-assign
    const agent = await autoAssignTicket(ticket);
    if (agent) {
      ticket.assignedTo = agent._id;
      ticket.assignedAt = new Date();
      ticket.assignedBy = null; // system
      ticket.autoAssigned = true;
      ticket.status = 'assigned';
      ticket.statusHistory.push({ from: 'open', to: 'assigned', reason: 'Auto-assigned by system' });
      await ticket.save();

      await incrementWorkload(agent._id);
      await notifyTicketAssigned(ticket, agent, req.user);
    } else {
      await ticket.save();
    }

    // Update user stats
    await User.findByIdAndUpdate(req.user._id, { $inc: { 'stats.totalRaised': 1 } });

    // Send confirmation email
    sendTicketConfirmation({ to: req.user.email, name: req.user.name, ticket }).catch(() => {});

    // Real-time: notify admins/agents
    emitToRole('admin', 'ticket_created', { ticketId: ticket._id, ticket: ticket.ticketId, title: ticket.title, priority: ticket.priority });
    emitToRole('support_agent', 'ticket_created', { ticketId: ticket._id, ticket: ticket.ticketId, title: ticket.title, priority: ticket.priority });

    await ticket.populate('createdBy assignedTo', 'name email department avatar');

    res.status(201).json({
      success: true,
      message: 'Ticket created successfully',
      ticket,
      duplicate: duplicateCheck ? { found: true, ticket: duplicateCheck } : { found: false }
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get tickets (with filtering, sorting, pagination)
// @route   GET /api/tickets
// @access  Private
const getTickets = async (req, res, next) => {
  try {
    const {
      status, priority, category, search,
      sortBy = 'priorityScore', sortOrder = 'desc',
      page = 1, limit = 20,
      assignedTo, createdBy, slaBreached,
      dateFrom, dateTo, myTickets
    } = req.query;

    const query = {};

    // Role-based filtering
    if (req.user.role === 'employee') {
      query.createdBy = req.user._id;
    } else if (req.user.role === 'support_agent') {
      if (myTickets === 'true') query.assignedTo = req.user._id;
      // agents see all tickets
    }
    // Admins see all

    // Filters
    if (status) query.status = { $in: status.split(',') };
    if (priority) query.priority = { $in: priority.split(',') };
    if (category) query.category = { $in: category.split(',') };
    if (assignedTo) query.assignedTo = assignedTo;
    if (createdBy && req.user.role !== 'employee') query.createdBy = createdBy;
    if (slaBreached === 'true') query['sla.breached'] = true;
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
      if (dateTo) query.createdAt.$lte = new Date(dateTo);
    }

    // Text search
    if (search) {
      query.$text = { $search: search };
    }

    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;
    // Secondary sort for stable ordering
    sort.createdAt = -1;

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort,
      populate: [
        { path: 'createdBy', select: 'name email department avatar' },
        { path: 'assignedTo', select: 'name email department avatar' }
      ],
      lean: false
    };

    const result = await Ticket.paginate(query, options);

    res.json({
      success: true,
      tickets: result.docs,
      pagination: {
        total: result.totalDocs,
        pages: result.totalPages,
        page: result.page,
        limit: result.limit,
        hasNext: result.hasNextPage,
        hasPrev: result.hasPrevPage
      }
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get single ticket
// @route   GET /api/tickets/:id
// @access  Private
const getTicket = async (req, res, next) => {
  try {
    const ticket = await Ticket.findById(req.params.id)
      .populate('createdBy', 'name email department designation avatar location preferredContact')
      .populate('assignedTo', 'name email department designation avatar')
      .populate('assignedBy', 'name email')
      .populate('relatedTickets', 'ticketId title status priority')
      .populate('duplicateOf', 'ticketId title status')
      .populate('statusHistory.changedBy', 'name email')
      .populate('priorityAudit.changedBy', 'name email');

    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });

    // Access control: employees only see their own tickets
    if (req.user.role === 'employee' && ticket.createdBy._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Increment view count
    await Ticket.findByIdAndUpdate(req.params.id, { $inc: { viewCount: 1 } });

    res.json({ success: true, ticket });
  } catch (err) {
    next(err);
  }
};

// @desc    Update ticket status
// @route   PATCH /api/tickets/:id/status
// @access  Private (agent/admin)
const updateStatus = async (req, res, next) => {
  try {
    const { status, reason, estimatedResolutionTime, resolution } = req.body;
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });

    // Only assigned agent or admin can change status
    if (req.user.role === 'support_agent' && ticket.assignedTo?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Only the assigned agent can update this ticket' });
    }

    const oldStatus = ticket.status;
    ticket.status = status;
    ticket.statusHistory.push({
      from: oldStatus,
      to: status,
      changedBy: req.user._id,
      reason: reason || ''
    });

    if (estimatedResolutionTime) ticket.estimatedResolutionTime = new Date(estimatedResolutionTime);

    if (status === 'resolved') {
      ticket.sla.resolvedAt = new Date();
      ticket.resolution = { notes: resolution?.notes, resolvedAt: new Date(), resolvedBy: req.user._id };
      if (ticket.assignedTo) await decrementWorkload(ticket.assignedTo);
      await User.findByIdAndUpdate(req.user._id, { $inc: { 'stats.totalResolved': 1 } });
    }

    if (status === 'in_progress') {
      ticket.sla.respondedAt = new Date();
    }

    await ticket.save();
    await ticket.populate('createdBy assignedTo', 'name email notificationPreferences');

    // Notify affected users
    const affectedUsers = [ticket.createdBy._id, ticket.assignedTo?._id].filter(Boolean);
    await notifyStatusChange(ticket, status, req.user, affectedUsers);

    // Email notification on resolve
    if (status === 'resolved') {
      sendStatusUpdate({ to: ticket.createdBy.email, name: ticket.createdBy.name, ticket, newStatus: status }).catch(() => {});
    }

    // Real-time
    emitToTicket(ticket._id.toString(), 'status_updated', {
      ticketId: ticket._id,
      status,
      changedBy: { name: req.user.name },
      timestamp: new Date()
    });

    res.json({ success: true, message: 'Status updated', ticket });
  } catch (err) {
    next(err);
  }
};

// @desc    Assign ticket
// @route   PATCH /api/tickets/:id/assign
// @access  Private (admin/agent)
const assignTicket = async (req, res, next) => {
  try {
    const { agentId } = req.body;
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });

    const agent = await User.findOne({ _id: agentId, role: { $in: ['support_agent', 'admin'] } });
    if (!agent) return res.status(404).json({ success: false, message: 'Agent not found' });

    // Decrement old agent workload
    if (ticket.assignedTo) await decrementWorkload(ticket.assignedTo);

    ticket.assignedTo = agentId;
    ticket.assignedAt = new Date();
    ticket.assignedBy = req.user._id;
    ticket.autoAssigned = false;
    if (ticket.status === 'open') {
      ticket.status = 'assigned';
      ticket.statusHistory.push({ from: 'open', to: 'assigned', changedBy: req.user._id, reason: 'Manual assignment' });
    }
    await ticket.save();
    await incrementWorkload(agentId);
    await notifyTicketAssigned(ticket, agent, req.user);

    emitToTicket(ticket._id.toString(), 'ticket_assigned', {
      ticketId: ticket._id,
      assignedTo: { _id: agent._id, name: agent.name }
    });

    res.json({ success: true, message: 'Ticket assigned', ticket });
  } catch (err) {
    next(err);
  }
};

// @desc    Reopen ticket
// @route   PATCH /api/tickets/:id/reopen
// @access  Private (creator)
const reopenTicket = async (req, res, next) => {
  try {
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ success: false, message: 'Reason is required to reopen' });

    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });

    if (!['resolved', 'closed'].includes(ticket.status)) {
      return res.status(400).json({ success: false, message: 'Only resolved or closed tickets can be reopened' });
    }

    if (req.user.role === 'employee' && ticket.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    ticket.status = 'reopened';
    ticket.reopenCount += 1;
    ticket.reopenReason = reason;
    ticket.lastReopenedAt = new Date();
    ticket.statusHistory.push({ from: 'resolved', to: 'reopened', changedBy: req.user._id, reason });

    // Reset SLA
    const slaDeadline = calculateSLADeadline(ticket.priority);
    ticket.sla.deadline = slaDeadline;
    ticket.sla.breached = false;
    ticket.sla.breachedAt = undefined;

    await ticket.save();

    // Notify assigned agent
    if (ticket.assignedTo) {
      await createNotification({
        recipientId: ticket.assignedTo,
        type: 'ticket_reopened',
        title: 'Ticket Reopened',
        message: `Ticket ${ticket.ticketId} has been reopened. Reason: ${reason}`,
        ticketId: ticket._id,
        triggeredById: req.user._id,
        link: `/tickets/${ticket._id}`
      });
    }

    emitToTicket(ticket._id.toString(), 'ticket_reopened', { ticketId: ticket._id, reason });

    res.json({ success: true, message: 'Ticket reopened', ticket });
  } catch (err) {
    next(err);
  }
};

// @desc    Submit feedback/rating
// @route   POST /api/tickets/:id/feedback
// @access  Private (creator only)
const submitFeedback = async (req, res, next) => {
  try {
    const { rating, comment } = req.body;
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5' });
    }

    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });

    if (ticket.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Only the ticket creator can submit feedback' });
    }

    if (!['resolved', 'closed'].includes(ticket.status)) {
      return res.status(400).json({ success: false, message: 'Can only rate resolved tickets' });
    }

    ticket.feedback = { rating, comment, submittedAt: new Date() };
    ticket.status = 'closed';
    ticket.statusHistory.push({ from: ticket.status, to: 'closed', changedBy: req.user._id, reason: 'Closed after feedback' });
    await ticket.save();

    res.json({ success: true, message: 'Feedback submitted. Thank you!', ticket });
  } catch (err) {
    next(err);
  }
};

// @desc    Get priority suggestion
// @route   POST /api/tickets/suggest-priority
// @access  Private
const suggestPriority = async (req, res, next) => {
  try {
    const { title, description } = req.body;
    const suggestion = suggestPriorityFromText(title, description);
    res.json({ success: true, ...suggestion });
  } catch (err) {
    next(err);
  }
};

// @desc    Search similar tickets (duplicate detection)
// @route   GET /api/tickets/similar
// @access  Private
const findSimilarTickets = async (req, res, next) => {
  try {
    const { title, category } = req.query;
    if (!title) return res.json({ success: true, tickets: [] });

    const tickets = await Ticket.find({
      $text: { $search: title },
      category,
      status: { $nin: ['closed'] }
    })
      .select('ticketId title status priority createdAt')
      .limit(5)
      .lean();

    res.json({ success: true, tickets });
  } catch (err) {
    next(err);
  }
};

// @desc    Update priority manually (admin/agent)
// @route   PATCH /api/tickets/:id/priority
// @access  Private (admin/agent)
const updatePriority = async (req, res, next) => {
  try {
    const { priority, reason } = req.body;
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });

    const oldPriority = ticket.priority;
    ticket.priorityAudit.push({
      from: oldPriority,
      to: priority,
      previousScore: ticket.priorityScore,
      newScore: ticket.priorityScore,
      changedBy: req.user._id,
      reason: reason || 'Manual override'
    });

    ticket.priority = priority;
    ticket.prioritySource = 'manual';

    // Recalculate SLA deadline
    const slaDeadline = calculateSLADeadline(priority);
    ticket.sla.deadline = slaDeadline;

    await ticket.save();

    emitToTicket(ticket._id.toString(), 'priority_updated', { ticketId: ticket._id, priority, changedBy: req.user.name });

    res.json({ success: true, message: 'Priority updated', ticket });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete ticket (admin only)
// @route   DELETE /api/tickets/:id
// @access  Private (admin)
const deleteTicket = async (req, res, next) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });
    if (ticket.assignedTo) await decrementWorkload(ticket.assignedTo);
    await Comment.deleteMany({ ticket: ticket._id });
    await ticket.deleteOne();
    res.json({ success: true, message: 'Ticket deleted' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createTicket, getTickets, getTicket, updateStatus,
  assignTicket, reopenTicket, submitFeedback,
  suggestPriority, findSimilarTickets, updatePriority, deleteTicket
};
