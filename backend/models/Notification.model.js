const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: [
      'ticket_created',
      'ticket_assigned',
      'ticket_status_changed',
      'ticket_comment',
      'ticket_mention',
      'ticket_resolved',
      'ticket_reopened',
      'sla_warning',
      'sla_breached',
      'ticket_escalated',
      'feedback_requested'
    ],
    required: true
  },
  title: { type: String, required: true },
  message: { type: String, required: true },
  ticket: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket' },
  triggeredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isRead: { type: Boolean, default: false },
  readAt: Date,
  link: String // Frontend route
}, {
  timestamps: true
});

notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
