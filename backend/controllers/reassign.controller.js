const ReassignRequest = require('../models/ReassignRequest.model');
const Ticket = require('../models/Ticket.model');
const { emitToRole, emitToUser, emitToTicket } = require('../config/socket');
const { createNotification } = require('../services/notification.service');

// @desc    Create reassignment request
// @route   POST /api/tickets/:id/reassign-request
// @access  Private (Agent)
exports.createReassignRequest = async (req, res, next) => {
  try {
    const { reason, suggestedAgentId } = req.body;
    const ticket = await Ticket.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    // Check if requester is the assigned agent
    if (ticket.assignedTo && ticket.assignedTo.toString() !== req.user._id.toString()) {
       return res.status(403).json({ success: false, message: 'You can only request reassignment for tickets assigned to you' });
    }

    // Check if there's already a pending request for this ticket
    const existingPending = await ReassignRequest.findOne({ ticket: ticket._id, status: 'pending' });
    if (existingPending) {
      return res.status(400).json({ success: false, message: 'A reassignment request is already pending for this ticket' });
    }

    const request = await ReassignRequest.create({
      ticket: ticket._id,
      requester: req.user._id,
      suggestedAgent: suggestedAgentId || null,
      reason,
      status: 'pending'
    });

    await request.populate([
      { path: 'requester', select: 'name email' },
      { path: 'ticket', select: 'ticketId title' }
    ]);

    // Notify Admins
    emitToRole('admin', 'new_reassign_request', { 
      requestId: request._id,
      ticketId: ticket.ticketId,
      requester: req.user.name,
      reason 
    });

    res.status(201).json({ success: true, request });
  } catch (err) {
    next(err);
  }
};

// @desc    Get all reassignment requests
// @route   GET /api/tickets/reassign/requests
// @access  Private (Admin)
exports.getReassignRequests = async (req, res, next) => {
  try {
    const { status } = req.query;
    const query = status ? { status } : {};

    const requests = await ReassignRequest.find(query)
      .populate('ticket', 'ticketId title status priority')
      .populate('requester', 'name email department')
      .populate('suggestedAgent', 'name email')
      .sort({ createdAt: -1 });

    res.json({ success: true, requests });
  } catch (err) {
    next(err);
  }
};

// @desc    Process reassignment request (Approve/Reject)
// @route   PATCH /api/tickets/reassign/requests/:id
// @access  Private (Admin)
exports.processReassignRequest = async (req, res, next) => {
  try {
    const { action, adminNote, newAgentId } = req.body; // action: 'approve' or 'reject'
    const request = await ReassignRequest.findById(req.params.requestId).populate('ticket');

    if (!request) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Request already processed' });
    }

    if (action === 'approve') {
      request.status = 'approved';
      const ticket = await Ticket.findById(request.ticket._id);
      
      // If a new agent is provided, assign them. Otherwise keep it unassigned or let admin decide.
      // Usually approval means we move it to the suggested agent or unassign.
      const agentToAssign = newAgentId || request.suggestedAgent;
      
      if (agentToAssign) {
        ticket.assignedTo = agentToAssign;
        ticket.status = 'assigned';
        ticket.statusHistory.push({
          from: ticket.status,
          to: 'assigned',
          changedBy: req.user._id,
          reason: `Reassignment approved: ${request.reason}`
        });
        await ticket.save();
        
        // Notify the requester and the new agent
        emitToUser(request.requester.toString(), 'reassign_request_processed', {
          status: 'approved',
          ticketId: ticket.ticketId,
          adminNote
        });
      } else {
        // Just unassign if no target agent specified
        ticket.assignedTo = null;
        ticket.status = 'open';
        ticket.statusHistory.push({
          from: ticket.status,
          to: 'open',
          changedBy: req.user._id,
          reason: `Reassignment approved (unassigned): ${request.reason}`
        });
        await ticket.save();
      }
    } else {
      request.status = 'rejected';
    }

    request.adminNote = adminNote;
    request.processedBy = req.user._id;
    request.processedAt = new Date();
    await request.save();

    res.json({ success: true, message: `Request ${action}d successfully` });
  } catch (err) {
    next(err);
  }
};
