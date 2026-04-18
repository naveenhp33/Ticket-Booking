const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const attachmentSchema = new mongoose.Schema({
  filename: String,
  originalName: String,
  mimetype: String,
  size: Number,
  path: String,
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  uploadedAt: { type: Date, default: Date.now }
}, { _id: true });

const statusHistorySchema = new mongoose.Schema({
  from: String,
  to: String,
  changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reason: String,
  timestamp: { type: Date, default: Date.now }
}, { _id: true });

const priorityAuditSchema = new mongoose.Schema({
  from: String,
  to: String,
  previousScore: Number,
  newScore: Number,
  changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reason: String, // 'auto-rule', 'manual', 'escalation', 'age-bonus'
  timestamp: { type: Date, default: Date.now }
}, { _id: true });

const slaSchema = new mongoose.Schema({
  deadline: Date,
  responseDeadline: Date,
  breached: { type: Boolean, default: false },
  responseBreached: { type: Boolean, default: false },
  breachedAt: Date,
  respondedAt: Date,
  resolvedAt: Date
}, { _id: false });

const ticketSchema = new mongoose.Schema({
  ticketId: {
    type: String,
    unique: true
  },

  // Core fields
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    maxlength: [5000, 'Description cannot exceed 5000 characters']
  },
  category: {
    type: String,
    required: true,
    enum: ['IT', 'HR', 'Finance', 'Admin', 'Operations', 'Marketing', 'Sales', 'Legal', 'Engineering', 'Other']
  },

  // Priority system
  priority: {
    type: String,
    enum: ['critical', 'high', 'medium', 'low'],
    default: 'low'
  },
  prioritySource: {
    type: String,
    enum: ['manual', 'auto', 'escalated'],
    default: 'auto'
  },
  priorityScore: { type: Number, default: 0 },

  // Scoring components (for transparency)
  scoreBreakdown: {
    impactScore: { type: Number, default: 0 },
    urgencyScore: { type: Number, default: 0 },
    slaRiskScore: { type: Number, default: 0 },
    roleModifier: { type: Number, default: 0 },
    queueBonus: { type: Number, default: 0 },
    knowledgeBonus: { type: Number, default: 0 }
  },

  // Status
  status: {
    type: String,
    enum: ['open', 'assigned', 'in_progress', 'pending_info', 'resolved', 'closed', 'reopened'],
    default: 'open'
  },

  // Impact & Urgency (employee input)
  impactScope: {
    type: String,
    enum: ['just_me', 'team', 'department', 'company'],
    default: 'just_me'
  },
  urgencyLevel: {
    type: String,
    enum: ['flexible', 'today', 'within_hour', 'right_now'],
    default: 'flexible'
  },

  // Device/context fields (for IT tickets)
  context: {
    deviceType: String,
    os: String,
    assetId: String,
    affectedSystem: String,
    issueStarted: {
      type: String,
      enum: ['just_now', 'within_hour', 'today', 'few_days']
    }
  },

  // People
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  assignedAt: Date,
  assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  autoAssigned: { type: Boolean, default: false },

  // Employee contact preference
  preferredContact: {
    type: String,
    enum: ['email', 'phone', 'slack', 'portal'],
    default: 'portal'
  },

  // SLA
  sla: slaSchema,

  // Attachments
  attachments: [attachmentSchema],

  // Tracking
  statusHistory: [statusHistorySchema],
  priorityAudit: [priorityAuditSchema],

  // Reopen tracking
  reopenCount: { type: Number, default: 0 },
  reopenReason: String,
  lastReopenedAt: Date,

  // Email source (if created from Gmail)
  emailSource: {
    messageId: String,
    from: String,
    receivedAt: Date,
    threadId: String
  },

  // Related tickets
  relatedTickets: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Ticket' }],

  // Resolution
  resolution: {
    notes: String,
    resolvedAt: Date,
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    knowledgeBaseRef: String
  },

  // Feedback
  feedback: {
    rating: { type: Number, min: 1, max: 5 },
    comment: String,
    submittedAt: Date
  },

  // Expected resolution (set by agent)
  estimatedResolutionTime: Date,

  // Duplicate detection
  duplicateOf: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', default: null },
  isDuplicate: { type: Boolean, default: false },

  // Internal notes (only agents/admins see)
  internalNotes: String,

  // Tags
  tags: [String],

  // View count
  viewCount: { type: Number, default: 0 },

  // Queue position (within same priority bucket)
  queuePosition: { type: Number, default: 0 }

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Auto-generate ticket ID
ticketSchema.pre('save', async function (next) {
  if (!this.ticketId) {
    try {
      // Find the ticket with the highest ticketId
      const lastTicket = await mongoose.model('Ticket')
        .findOne({ ticketId: /^TKT-/ })
        .sort({ ticketId: -1 })
        .collation({ locale: 'en', numericOrdering: true });
        
      let nextIdNumber = 1;
      if (lastTicket && lastTicket.ticketId) {
        const match = lastTicket.ticketId.match(/TKT-(\d+)/);
        if (match) {
          nextIdNumber = parseInt(match[1], 10) + 1;
        } else {
          const count = await mongoose.model('Ticket').countDocuments();
          nextIdNumber = count + 1;
        }
      } else {
         const count = await mongoose.model('Ticket').countDocuments();
         nextIdNumber = count + 1;
      }
      this.ticketId = `TKT-${String(nextIdNumber).padStart(5, '0')}`;
    } catch (err) {
      return next(err);
    }
  }
  next();
});

// Virtuals
ticketSchema.virtual('isOverdue').get(function () {
  if (!this.sla?.deadline) return false;
  if (['resolved', 'closed'].includes(this.status)) return false;
  return new Date() > new Date(this.sla.deadline);
});

ticketSchema.virtual('timeRemaining').get(function () {
  if (!this.sla?.deadline) return null;
  const remaining = new Date(this.sla.deadline) - new Date();
  return Math.max(0, remaining);
});

ticketSchema.virtual('commentCount', {
  ref: 'Comment',
  localField: '_id',
  foreignField: 'ticket',
  count: true
});

// Indexes
ticketSchema.index({ createdBy: 1, status: 1 });
ticketSchema.index({ assignedTo: 1, status: 1 });
ticketSchema.index({ priority: 1, priorityScore: -1 });
ticketSchema.index({ status: 1, category: 1 });
ticketSchema.index({ 'sla.deadline': 1 });
ticketSchema.index({ ticketId: 1 });
ticketSchema.index({ 'emailSource.messageId': 1 }, { sparse: true });
ticketSchema.index({ title: 'text', description: 'text', tags: 'text' });

ticketSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('Ticket', ticketSchema);
