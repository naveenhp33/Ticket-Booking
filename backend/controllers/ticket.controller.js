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
const { sendTicketConfirmation, sendStatusUpdate, sendStatusChangeEmail, sendResolveEmail, sendAckEmail } = require('../services/email.service');
const { emitToUser, emitToRole, emitToTicket } = require('../config/socket');

// @desc    Create ticket
// @route   POST /api/tickets
// @access  Private
const createTicket = async (req, res, next) => {
  try {
    const {
      title, description, category, impactScope, urgencyLevel,
      preferredContact, context, relatedTickets, manualPriority,
      issueStarted, tags, office, shift, ticketType, source, workLocation
    } = req.body;

    // Validation for IT tickets
    if (category === 'IT' && (!context || !context.assetId)) {
      return res.status(400).json({ success: false, message: 'Asset ID is mandatory for IT tickets' });
    }

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
      ticketType,
      source: source || 'Portal',
      office,
      shift,
      workLocation,
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

    await ticket.populate('createdBy assignedTo', 'name email department avatar');

    // Real-time: notify admins/agents with the FULL ticket object
    const socketPayload = { 
        ticketId: ticket._id, 
        ticket: ticket, 
        title: ticket.title, 
        priority: ticket.priority 
    };
    emitToRole('admin', 'ticket_created', socketPayload);
    emitToRole('support_agent', 'ticket_created', socketPayload);

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
      // Logic: If myTickets is true, show ONLY my assigned tickets.
      // Otherwise, show my assignments OR unassigned items in my department.
      if (myTickets === 'true') {
        query.assignedTo = req.user._id;
      } else {
        query.$or = [
          { assignedTo: req.user._id },
          { assignedTo: null, category: req.user.department }
        ];
      }
    } else if (req.user.role === 'admin') {
      if (myTickets === 'true') {
        query.assignedTo = req.user._id;
      } else if (req.user.department !== 'Admin') {
        query.category = req.user.department;
      }
    }

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
      lean: true
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
      .populate('priorityAudit.changedBy', 'name email')
      .lean();

    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });

    // Access control: employees only see their own tickets
    if (req.user.role === 'employee' && ticket.createdBy._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Increment view count (Non-blocking for faster response)
    Ticket.findByIdAndUpdate(req.params.id, { $inc: { viewCount: 1 } }).exec().catch(err => console.error('View count update failed:', err.message));

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
    const validStatuses = ['open', 'assigned', 'in_progress', 'almost_complete', 'pending_info', 'on_hold', 'pending_hold', 'resolved', 'closed', 'reopened'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value' });
    }
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });

    // Only assigned agent or admin can change status
    if (req.user.role === 'support_agent' && ticket.assignedTo?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Only the assigned agent can update this ticket' });
    }

    // Hold Lock: If ticket is on hold, only the admin who approved it can change status
    if (ticket.status === 'on_hold' && ticket.hold.approvedBy?.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
       return res.status(403).json({ success: false, message: 'This ticket is on hold. Only the admin who approved the hold can change its status.' });
    }
    // Even for admins, if it's on hold, we should probably restrict it to the holder unless they are a super admin. 
    // But the requirement says "only that admin".
    if (ticket.status === 'on_hold' && ticket.hold.approvedBy?.toString() !== req.user._id.toString()) {
        return res.status(403).json({ success: false, message: 'Only the admin who put this ticket on hold can change its status.' });
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

    // AUTO-ACK: Send acknowledgment email when first status change occurs
    if (['in_progress', 'assigned', 'almost_complete'].includes(status) && !ticket.firstResponseAt) {
      ticket.firstResponseAt = new Date();
      // Ensure createdBy is populated for email
      const populated = await Ticket.findById(ticket._id).populate('createdBy', 'name email');
      if (populated.createdBy?.email) {
        sendAckEmail({ to: populated.createdBy.email, name: populated.createdBy.name, ticket: populated }).catch(() => {});
      }
    }

    await ticket.save();
    await ticket.populate('createdBy assignedTo', 'name email notificationPreferences');

    // Notify affected users
    const affectedUsers = [ticket.createdBy._id, ticket.assignedTo?._id].filter(Boolean);
    await notifyStatusChange(ticket, status, req.user, affectedUsers);

    // Email worker on every status change
    sendStatusChangeEmail({ to: ticket.createdBy.email, name: ticket.createdBy.name, ticket, newStatus: status }).catch(() => {});

    // Real-time
    emitToTicket(ticket._id.toString(), 'status_updated', {
      ticketId: ticket._id,
      status,
      changedBy: { name: req.user.name },
      timestamp: new Date(),
      firstResponseAt: ticket.firstResponseAt
    });

    // Broadcast to role rooms so list pages update in real-time
    const statusPayload = { ticketId: ticket._id, status, changedBy: { name: req.user.name } };
    emitToRole('admin', 'ticket_status_changed', statusPayload);
    emitToRole('support_agent', 'ticket_status_changed', statusPayload);
    // Also notify the ticket creator
    if (ticket.createdBy?._id) emitToUser(ticket.createdBy._id.toString(), 'ticket_status_changed', statusPayload);

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

    // AUTO-ACK: Send acknowledgment email when manually assigned
    if (!ticket.firstResponseAt) {
      ticket.firstResponseAt = new Date();
      const populated = await Ticket.findById(ticket._id).populate('createdBy', 'name email');
      if (populated.createdBy?.email) {
        sendAckEmail({ to: populated.createdBy.email, name: populated.createdBy.name, ticket: populated }).catch(() => {});
      }
    }
    await ticket.save();
    await incrementWorkload(agentId);
    await notifyTicketAssigned(ticket, agent, req.user);

    emitToTicket(ticket._id.toString(), 'ticket_assigned', {
      ticketId: ticket._id,
      assignedTo: { _id: agent._id, name: agent.name },
      firstResponseAt: ticket.firstResponseAt
    });

    // Broadcast to role rooms so list pages update in real-time
    const assignPayload = { ticketId: ticket._id, assignedTo: { _id: agent._id, name: agent.name }, status: ticket.status };
    emitToRole('admin', 'ticket_assignment_changed', assignPayload);
    emitToRole('support_agent', 'ticket_assignment_changed', assignPayload);

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

    // Send email to creator about reopening
    await ticket.populate('createdBy', 'name email');
    sendStatusChangeEmail({ to: ticket.createdBy.email, name: ticket.createdBy.name, ticket, newStatus: 'reopened' }).catch(() => {});

    emitToTicket(ticket._id.toString(), 'ticket_reopened', { ticketId: ticket._id, reason });

    // Broadcast to role rooms so list pages update in real-time
    const statusPayload = { ticketId: ticket._id, status: 'reopened', changedBy: { name: req.user.name } };
    emitToRole('admin', 'ticket_status_changed', statusPayload);
    emitToRole('support_agent', 'ticket_status_changed', statusPayload);

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

    // Broadcast status change to 'closed'
    const statusPayload = { ticketId: ticket._id, status: 'closed', changedBy: { name: req.user.name } };
    emitToRole('admin', 'ticket_status_changed', statusPayload);
    emitToRole('support_agent', 'ticket_status_changed', statusPayload);
    emitToTicket(ticket._id.toString(), 'status_updated', statusPayload);

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

    // Broadcast to role rooms so list pages update in real-time
    const priorityPayload = { ticketId: ticket._id, priority, changedBy: req.user.name };
    emitToRole('admin', 'ticket_priority_changed', priorityPayload);
    emitToRole('support_agent', 'ticket_priority_changed', priorityPayload);

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

// @desc    Update ticket priority and/or status (admin only)
// @route   PATCH /api/tickets/update-ticket/:id
// @access  Private (admin)
const updateTicket = async (req, res, next) => {
  try {
    const { priority, status } = req.body;
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });

    if (priority) ticket.priority = priority;

    if (status) {
      const oldStatus = ticket.status;
      ticket.status = status;
      ticket.statusHistory.push({ from: oldStatus, to: status, changedBy: req.user._id });

      if (['resolved', 'closed'].includes(status)) {
        ticket.updatedAt = new Date();
      }
    }

    await ticket.save();
    
    // Trigger email if status changed
    if (status) {
      await ticket.populate('createdBy', 'name email');
      if (ticket.createdBy?.email) {
        sendStatusChangeEmail({ to: ticket.createdBy.email, name: ticket.createdBy.name, ticket, newStatus: status }).catch(() => {});
      }
    }

    res.json({ success: true, message: 'Ticket updated', ticket });
  } catch (err) {
    next(err);
  }
};

// @desc    Agent starts travel/work for on-site visit
// @route   POST /api/tickets/:id/start-onsite
// @access  Private (assigned agent)
const startOnSite = async (req, res, next) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });

    if (ticket.assignedTo?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Only the assigned agent can start on-site visit' });
    }

    const user = await User.findById(req.user._id);
    // Hard Rule: Only one active on-site allowed
    if (user.liveStatus === 'on_site' && user.onSiteTicket && user.onSiteTicket.toString() !== ticket._id.toString()) {
       // Check if the ticket referenced still exists and is not resolved
       const otherTicket = await Ticket.findById(user.onSiteTicket);
       if (otherTicket && !['resolved', 'closed'].includes(otherTicket.status)) {
         return res.status(400).json({ 
           success: false, 
           message: `You are already on-site for ticket ${otherTicket.ticketId}. Please resolve it before starting another on-site visit.` 
         });
       }
    }

    // Update User Status
    user.liveStatus = 'on_site';
    user.onSiteTicket = ticket._id;
    user.lastStatusUpdate = new Date();
    await user.save();

    // Update Ticket
    if (!ticket.onSiteVisit.requestedAt) {
      ticket.onSiteVisit.requestedAt = new Date();
    }
    
    // Also move status to in_progress if it isn't already
    if (ticket.status === 'assigned' || ticket.status === 'open') {
        const oldStatus = ticket.status;
        ticket.status = 'in_progress';
        ticket.statusHistory.push({ from: oldStatus, to: 'in_progress', changedBy: req.user._id, reason: 'Started on-site visit' });
    }
    await ticket.save();

    // Notify admins for live dashboard
    emitToRole('admin', 'agent_status_updated', {
      agentId: user._id,
      name: user.name,
      status: 'on_site',
      ticketId: ticket.ticketId,
      ticketDbId: ticket._id,
      timestamp: user.lastStatusUpdate
    });

    res.json({ success: true, message: 'On-site visit started. Live timer active on dashboard.', ticket });
  } catch (err) {
    next(err);
  }
};

// @desc    Agent marks themselves as arrived on-site
// @route   POST /api/tickets/:id/arrive
// @access  Private (assigned agent)
const markArrived = async (req, res, next) => {
  try {
    const ticket = await Ticket.findById(req.params.id).populate('createdBy assignedTo');
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });

    if (ticket.assignedTo?._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Only the assigned agent can mark arrival' });
    }

    ticket.onSiteVisit.arrivedAt = new Date();
    // Start the timer if they forgot to click "Start"
    if (!ticket.onSiteVisit.requestedAt) ticket.onSiteVisit.requestedAt = new Date();
    
    // Arrival records: Agent is now at target location and available for work/resolutions
    const user = await User.findById(req.user._id);
    user.liveStatus = 'available';
    user.onSiteTicket = null;
    user.lastStatusUpdate = new Date();
    await user.save();
    
    emitToRole('admin', 'agent_status_updated', {
      agentId: user._id,
      name: user.name,
      status: 'available',
      ticketId: ticket.ticketId,
      ticketDbId: ticket._id,
      timestamp: user.lastStatusUpdate
    });

    // Location Verification (Hard Rule)
    if (ticket.createdBy?.location?.branch && req.user.location?.branch && 
        ticket.createdBy.location.branch !== req.user.location.branch) {
      ticket.onSiteVisit.locationVerified = false;
      emitToRole('admin', 'location_mismatch_alert', {
        ticketId: ticket.ticketId,
        agentName: req.user.name,
        agentBranch: req.user.location.branch,
        employeeBranch: ticket.createdBy.location.branch,
        timestamp: new Date()
      });
    } else {
      ticket.onSiteVisit.locationVerified = true;
    }

    await ticket.save();

    // Notify employee to confirm arrival
    createNotification({
      recipientId: ticket.createdBy._id,
      type: 'arrival_verification',
      title: 'Agent Arrived',
      message: `${req.user.name} has marked themselves as arrived for your ticket. Please confirm if they are with you.`,
      ticketId: ticket._id,
      triggeredById: req.user._id,
      link: `/tickets/${ticket._id}`
    });

    emitToTicket(ticket._id.toString(), 'agent_arrived', { 
      agentId: req.user._id, 
      name: req.user.name,
      arrivedAt: ticket.onSiteVisit.arrivedAt
    });

    res.json({ success: true, message: 'Arrival recorded. Waiting for employee confirmation.', ticket });
  } catch (err) {
    next(err);
  }
};

// @desc    Employee confirms agent's arrival
// @route   POST /api/tickets/:id/confirm-arrival
// @access  Private (ticket creator)
const confirmArrival = async (req, res, next) => {
  try {
    const { confirmed } = req.body; // true or false
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });

    if (ticket.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Only the ticket creator can confirm arrival' });
    }

    ticket.onSiteVisit.arrivalConfirmedByEmployee = confirmed;
    
    // If disputed, notify admin
    if (!confirmed) {
      emitToRole('admin', 'arrival_disputed', {
        ticketId: ticket._id,
        ticketNumber: ticket.ticketId,
        agentId: ticket.assignedTo,
        employeeName: req.user.name
      });
    }

    await ticket.save();
    emitToTicket(ticket._id.toString(), 'arrival_confirmed', { confirmed, confirmedBy: req.user.name });

    res.json({ success: true, message: confirmed ? 'Arrival confirmed. Verified log started.' : 'Dispute recorded. Admin has been notified.', ticket });
  } catch (err) {
    next(err);
  }
};

// @desc    Agent marks work as resolved (Stage 1: Request Confirmation)
// @route   POST /api/tickets/:id/agent-resolve
// @access  Private (assigned agent)
const agentResolve = async (req, res, next) => {
  try {
    const { notes, type } = req.body;
    if (!notes) return res.status(400).json({ success: false, message: 'Resolution summary is required for accountability.' });
    if (!type) return res.status(400).json({ success: false, message: 'Resolution type is required.' });

    const ticket = await Ticket.findById(req.params.id).populate('createdBy');
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });

    if (ticket.assignedTo?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Only the assigned agent can mark as resolved' });
    }

    const oldStatus = ticket.status;
    ticket.status = 'pending_confirmation';
    ticket.resolution = { 
      notes, 
      type,
      pendingConfirmationAt: new Date(), 
      resolvedBy: req.user._id 
    };
    
    ticket.statusHistory.push({ 
      from: oldStatus, 
      to: 'pending_confirmation', 
      changedBy: req.user._id, 
      reason: 'Agent requested resolution confirmation' 
    });

    // Update agent visit status
    if (ticket.onSiteVisit.arrivedAt) {
      ticket.onSiteVisit.visitResolvedAt = new Date();
    }

    // Release agent's live status/lock so they can move to the next thing
    const agent = await User.findById(req.user._id);
    if (agent && agent.onSiteTicket?.toString() === ticket._id.toString()) {
      agent.liveStatus = 'available';
      agent.onSiteTicket = null;
      await agent.save();
    }
    
    await ticket.save();

    // Trigger employee sign-off notification
    createNotification({
      recipientId: ticket.createdBy._id,
      type: 'resolution_verification',
      title: 'Action Needed: Verify Fix',
      message: `${req.user.name} has marked your ticket ${ticket.ticketId} as resolved. Please verify if the issue is fixed.`,
      ticketId: ticket._id,
      triggeredById: req.user._id,
      link: `/tickets/${ticket._id}`,
      resolutionSummary: notes // Optional field for UI
    });
    
    // Notify employee via email to verify the fix
    if (ticket.createdBy?.email) {
      sendStatusChangeEmail({ 
        to: ticket.createdBy.email, 
        name: ticket.createdBy.name, 
        ticket, 
        newStatus: 'resolved' 
      }).catch(err => console.error('Failed to send verification request email:', err.message));
    }

    emitToTicket(ticket._id.toString(), 'agent_resolved_request', { notes, type });

    res.json({ success: true, message: 'Resolution request submitted. Awaiting employee confirmation.', ticket });
  } catch (err) {
    next(err);
  }
};

// @desc    Agent withdraws resolution request
// @route   POST /api/tickets/:id/withdraw-resolve
// @access  Private (assigned agent)
const withdrawResolve = async (req, res, next) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });

    if (ticket.assignedTo?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Only the assigned agent can withdraw resolution request' });
    }

    if (ticket.status !== 'pending_confirmation') {
      return res.status(400).json({ success: false, message: 'Ticket is not in pending confirmation state.' });
    }

    ticket.status = 'in_progress';
    ticket.statusHistory.push({ 
      from: 'pending_confirmation', 
      to: 'in_progress', 
      changedBy: req.user._id, 
      reason: 'Agent withdrew resolution request' 
    });
    
    // Clear the pending request data partially
    ticket.resolution.pendingConfirmationAt = null;
    
    await ticket.save();
    emitToTicket(ticket._id.toString(), 'resolve_withdrawn', { by: req.user.name });

    res.json({ success: true, message: 'Resolution request withdrawn. Ticket is back in-progress.', ticket });
  } catch (err) {
    next(err);
  }
};

// @desc    Employee responds to resolution request (Stage 2: Confirm or Reject)
// @route   POST /api/tickets/:id/confirm-fix
// @access  Private (ticket creator)
const confirmFix = async (req, res, next) => {
  try {
    const { fixed, rating, comment, reason } = req.body; // fixed: true/false
    const ticket = await Ticket.findById(req.params.id).populate('assignedTo');
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });

    if (ticket.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Only the ticket creator can verify resolution' });
    }

    if (fixed) {
      // 4A: Employee Confirms Fixed
      ticket.status = 'closed';
      ticket.resolution.resolvedAt = new Date();
      ticket.onSiteVisit.completionConfirmedByEmployee = true;
      ticket.statusHistory.push({ from: 'pending_confirmation', to: 'closed', changedBy: req.user._id, reason: 'Employee confirmed fix' });
      
      // Save feedback
      ticket.feedback = {
        rating: rating || 5,
        comment: comment || '',
        submittedAt: new Date()
      };

      // Update stats and workload
      if (ticket.assignedTo) {
        const agentId = ticket.assignedTo._id;
        await decrementWorkload(agentId);
        
        // Update agent metrics & release on-site status
        const agent = await User.findById(agentId);
        if (agent) {
          const totalResolved = (agent.stats?.totalResolved || 0) + 1;
          const currentAvgRating = agent.stats?.avgRating || 0;
          const newAvgRating = ((currentAvgRating * (totalResolved - 1)) + (rating || 5)) / totalResolved;
          
          agent.stats = {
            ...agent.stats,
            totalResolved,
            avgRating: parseFloat(newAvgRating.toFixed(1))
          };

          // If they were on-site for this specific ticket, set them free
          if (agent.liveStatus === 'on_site' && agent.onSiteTicket?.toString() === ticket._id.toString()) {
            agent.liveStatus = 'available';
            agent.onSiteTicket = null;
          }
          
          await agent.save();
        }
      }

      // Notify final resolution via email (celebratory)
      await ticket.populate('createdBy', 'name email');
      if (ticket.createdBy?.email) {
        sendResolveEmail({ 
          to: ticket.createdBy.email, 
          name: ticket.createdBy.name, 
          ticket 
        }).catch(err => console.error('Failed to send final resolution email:', err.message));
      }
    } else {
      // 4B: Employee Rejects Fix
      ticket.status = 'reopened';
      ticket.onSiteVisit.completionConfirmedByEmployee = false;
      ticket.reopenCount = (ticket.reopenCount || 0) + 1;
      ticket.reopenReason = reason || 'Still having problem';
      ticket.lastReopenedAt = new Date();
      ticket.statusHistory.push({ from: 'pending_confirmation', to: 'reopened', changedBy: req.user._id, reason: `Fix rejected: ${reason}` });
      
      // Clear pending resolution request to allow new one later
      ticket.resolution.pendingConfirmationAt = null;

      // Notify Agent
      if (ticket.assignedTo) {
        createNotification({
          recipientId: ticket.assignedTo._id,
          type: 'resolution_rejected',
          title: 'Resolution Rejected',
          message: `Ticket ${ticket.ticketId} was rejected by the employee. Reason: ${reason}`,
          ticketId: ticket._id,
          triggeredById: req.user._id,
          link: `/tickets/${ticket._id}`
        });
      }

      // Alert Admin
      emitToRole('admin', 'fix_disputed', { 
        ticketId: ticket.ticketId, 
        agent: ticket.assignedTo?.name,
        reason: reason
      });
    }

    await ticket.save();

    // If fully closed or reopened, we should handle the agent's live status
    if (ticket.assignedTo) {
      const user = await User.findById(ticket.assignedTo._id);
      if (user && user.onSiteTicket?.toString() === ticket._id.toString()) {
        // Only mark available if fixed. If reopened, stay on_site? 
        // User says: "Ticket re-enters agent's queue". 
        // If they were on-site, they might still be there or might have left.
        // For simplicity, we clear on-site ticket on closure. 
        // If rejected, agent is still assigned but not necessarily physically on-site anymore according to the system state.
        if (fixed) {
           user.liveStatus = 'available';
           user.onSiteTicket = null;
           user.lastStatusUpdate = new Date();
           await user.save();

           emitToRole('admin', 'agent_status_updated', {
             agentId: user._id,
             name: user.name,
             status: 'available',
             timestamp: user.lastStatusUpdate
           });
        }
      }
    }

    emitToTicket(ticket._id.toString(), 'fix_verified', { fixed, rating, comment, reason, confirmedBy: req.user.name });

    res.json({ success: true, message: fixed ? 'Ticket successfully resolved and verified.' : 'Ticket reopened. Admin has been notified of the dispute.', ticket });
  } catch (err) {
    next(err);
  }
};

// @desc    Agent requests hold for a ticket
// @route   POST /api/tickets/:id/request-hold
// @access  Private (assigned agent)
const requestHold = async (req, res, next) => {
  try {
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ success: false, message: 'Reason for hold is required' });

    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });

    if (ticket.assignedTo?.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only the assigned agent can request hold' });
    }

    // Check if this admin already has a ticket on hold (if that's the rule)
    // "Only one admin can hold a ticket at a time" -> interpreted as "An admin can only hold one ticket"
    if (req.user.role === 'admin') {
        const existingHold = await Ticket.findOne({ 'hold.approvedBy': req.user._id, status: 'on_hold' });
        if (existingHold) {
            return res.status(400).json({ success: false, message: `You already have ticket ${existingHold.ticketId} on hold. You can only hold one ticket at a time.` });
        }
    }

    const oldStatus = ticket.status;
    ticket.status = 'pending_hold';
    ticket.hold = {
      isHoldRequested: true,
      reason,
      requestedBy: req.user._id,
      requestedAt: new Date()
    };

    ticket.statusHistory.push({
      from: oldStatus,
      to: 'pending_hold',
      changedBy: req.user._id,
      reason: `Hold requested: ${reason}`
    });

    await ticket.save();

    // Notify admins for approval
    emitToRole('admin', 'hold_requested', {
      ticketId: ticket.ticketId,
      agentName: req.user.name,
      reason
    });

    res.json({ success: true, message: 'Hold request submitted for team approval.', ticket });
  } catch (err) {
    next(err);
  }
};

// @desc    Admin approves hold
// @route   POST /api/tickets/:id/approve-hold
// @access  Private (admin)
const approveHold = async (req, res, next) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });

    if (ticket.status !== 'pending_hold') {
      return res.status(400).json({ success: false, message: 'Ticket is not in pending_hold state' });
    }

    const oldStatus = ticket.status;
    ticket.status = 'on_hold';
    ticket.hold.approvedBy = req.user._id;
    ticket.hold.approvedAt = new Date();

    ticket.statusHistory.push({
      from: oldStatus,
      to: 'on_hold',
      changedBy: req.user._id,
      reason: 'Hold approved by team'
    });

    await ticket.save();

    // Ensure we release agent status if they were on_site
    const agent = await User.findById(ticket.assignedTo);
    if (agent && agent.liveStatus === 'on_site') {
        agent.liveStatus = 'available';
        agent.onSiteTicket = null;
        await agent.save();
    }

    emitToTicket(ticket._id.toString(), 'hold_approved', { approvedBy: req.user.name });
    emitToRole('support_agent', 'hold_approved', { ticketId: ticket.ticketId, approvedBy: req.user.name });

    res.json({ success: true, message: 'Hold request approved.', ticket });
  } catch (err) {
    next(err);
  }
};

// @desc    Admin rejects hold
// @route   POST /api/tickets/:id/reject-hold
// @access  Private (admin)
const rejectHold = async (req, res, next) => {
  try {
    const { denialReason } = req.body;
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });

    if (ticket.status !== 'pending_hold') {
      return res.status(400).json({ success: false, message: 'Ticket is not in pending_hold state' });
    }

    const oldStatus = ticket.status;
    ticket.status = 'in_progress';
    ticket.hold.isHoldRequested = false;
    ticket.hold.deniedBy = req.user._id;
    ticket.hold.deniedAt = new Date();
    ticket.hold.denialReason = denialReason;

    ticket.statusHistory.push({
      from: oldStatus,
      to: 'in_progress',
      changedBy: req.user._id,
      reason: `Hold rejected: ${denialReason || 'No reason provided'}`
    });

    await ticket.save();

    emitToTicket(ticket._id.toString(), 'hold_rejected', { deniedBy: req.user.name, reason: denialReason });

    res.json({ success: true, message: 'Hold request rejected. Ticket is back in progress.', ticket });
  } catch (err) {
    next(err);
  }
};

// @desc    Resume ticket from hold
// @route   POST /api/tickets/:id/resume
// @access  Private (agent/admin)
const resumeTicket = async (req, res, next) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });

    if (ticket.status !== 'on_hold') {
      return res.status(400).json({ success: false, message: 'Ticket is not on hold' });
    }

    // Only the admin who approved it can resume
    if (ticket.hold.approvedBy?.toString() !== req.user._id.toString()) {
        return res.status(403).json({ success: false, message: 'Only the admin who put this ticket on hold can resume it.' });
    }

    const oldStatus = ticket.status;
    ticket.status = 'in_progress';
    ticket.hold.isHoldRequested = false;

    ticket.statusHistory.push({
      from: oldStatus,
      to: 'in_progress',
      changedBy: req.user._id,
      reason: 'Ticket resumed from hold'
    });

    await ticket.save();

    emitToTicket(ticket._id.toString(), 'ticket_resumed', { resumedBy: req.user.name });

    res.json({ success: true, message: 'Ticket resumed successfully.', ticket });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createTicket, getTickets, getTicket, updateStatus,
  assignTicket, reopenTicket, submitFeedback,
  suggestPriority, findSimilarTickets, updatePriority, deleteTicket, updateTicket,
  markArrived, confirmArrival, agentResolve, confirmFix,
  startOnSite, withdrawResolve,
  requestHold, approveHold, rejectHold, resumeTicket
};
