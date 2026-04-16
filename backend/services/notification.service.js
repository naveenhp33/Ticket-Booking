const Notification = require('../models/Notification.model');
const { emitToUser, emitToRole } = require('../config/socket');
const emailService = require('./email.service');

const createNotification = async ({ recipientId, type, title, message, ticketId, triggeredById, link }) => {
  try {
    const notification = await Notification.create({
      recipient: recipientId,
      type,
      title,
      message,
      ticket: ticketId,
      triggeredBy: triggeredById,
      link
    });

    // Emit via Socket.io immediately
    emitToUser(recipientId.toString(), 'notification', {
      _id: notification._id,
      type,
      title,
      message,
      ticket: ticketId,
      link,
      createdAt: notification.createdAt
    });

    return notification;
  } catch (err) {
    console.error('Notification creation error:', err.message);
  }
};

// Notify when ticket is assigned
const notifyTicketAssigned = async (ticket, agent, assignedBy) => {
  // Notify the agent
  await createNotification({
    recipientId: agent._id,
    type: 'ticket_assigned',
    title: 'New Ticket Assigned',
    message: `Ticket ${ticket.ticketId}: "${ticket.title}" has been assigned to you.`,
    ticketId: ticket._id,
    triggeredById: assignedBy._id,
    link: `/tickets/${ticket._id}`
  });

  // Notify the ticket creator
  await createNotification({
    recipientId: ticket.createdBy,
    type: 'ticket_assigned',
    title: 'Your ticket has been assigned',
    message: `Ticket ${ticket.ticketId} is now being handled by ${agent.name}.`,
    ticketId: ticket._id,
    triggeredById: assignedBy._id,
    link: `/tickets/${ticket._id}`
  });
};

// Notify status change
const notifyStatusChange = async (ticket, newStatus, changedBy, affectedUsers) => {
  const statusLabels = {
    in_progress: 'In Progress',
    resolved: 'Resolved',
    closed: 'Closed',
    reopened: 'Reopened',
    pending_info: 'Pending Your Information'
  };

  for (const userId of affectedUsers) {
    if (userId.toString() === changedBy._id.toString()) continue;
    await createNotification({
      recipientId: userId,
      type: 'ticket_status_changed',
      title: `Ticket ${statusLabels[newStatus] || newStatus}`,
      message: `Ticket ${ticket.ticketId}: "${ticket.title}" status changed to ${statusLabels[newStatus] || newStatus}.`,
      ticketId: ticket._id,
      triggeredById: changedBy._id,
      link: `/tickets/${ticket._id}`
    });
  }
};

// Notify new comment
const notifyComment = async (ticket, comment, author, mentionedUsers) => {
  const notified = new Set();

  // Notify ticket owner
  if (ticket.createdBy.toString() !== author._id.toString()) {
    await createNotification({
      recipientId: ticket.createdBy,
      type: 'ticket_comment',
      title: 'New comment on your ticket',
      message: `${author.name} commented on ticket ${ticket.ticketId}.`,
      ticketId: ticket._id,
      triggeredById: author._id,
      link: `/tickets/${ticket._id}`
    });
    notified.add(ticket.createdBy.toString());
  }

  // Notify assignee
  if (ticket.assignedTo && ticket.assignedTo.toString() !== author._id.toString() && !notified.has(ticket.assignedTo.toString())) {
    await createNotification({
      recipientId: ticket.assignedTo,
      type: 'ticket_comment',
      title: 'New comment on assigned ticket',
      message: `${author.name} commented on ticket ${ticket.ticketId}.`,
      ticketId: ticket._id,
      triggeredById: author._id,
      link: `/tickets/${ticket._id}`
    });
    notified.add(ticket.assignedTo.toString());
  }

  // Notify mentioned users
  for (const userId of mentionedUsers) {
    if (!notified.has(userId.toString()) && userId.toString() !== author._id.toString()) {
      await createNotification({
        recipientId: userId,
        type: 'ticket_mention',
        title: 'You were mentioned in a ticket',
        message: `${author.name} mentioned you in ticket ${ticket.ticketId}.`,
        ticketId: ticket._id,
        triggeredById: author._id,
        link: `/tickets/${ticket._id}`
      });
      notified.add(userId.toString());
    }
  }
};

// SLA Warning
const notifySLAWarning = async (ticket) => {
  const users = [ticket.createdBy, ticket.assignedTo].filter(Boolean);
  for (const userId of users) {
    await createNotification({
      recipientId: userId,
      type: 'sla_warning',
      title: '⚠️ SLA Deadline Approaching',
      message: `Ticket ${ticket.ticketId} SLA deadline is approaching. Resolve before breach.`,
      ticketId: ticket._id,
      link: `/tickets/${ticket._id}`
    });
  }

  // Notify all admins
  emitToRole('admin', 'sla_warning', {
    ticketId: ticket._id,
    ticket: ticket.ticketId,
    title: ticket.title,
    deadline: ticket.sla?.deadline
  });
};

module.exports = {
  createNotification,
  notifyTicketAssigned,
  notifyStatusChange,
  notifyComment,
  notifySLAWarning
};
