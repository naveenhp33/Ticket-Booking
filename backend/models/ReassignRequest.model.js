const mongoose = require('mongoose');

const reassignRequestSchema = new mongoose.Schema({
  ticket: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ticket',
    required: true
  },
  requester: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  suggestedAgent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  reason: {
    type: String,
    required: [true, 'Reason for reassignment is required'],
    trim: true,
    minlength: [10, 'Reason must be at least 10 characters']
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  adminNote: {
    type: String,
    trim: true
  },
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  processedAt: Date
}, {
  timestamps: true
});

// Index for performance
reassignRequestSchema.index({ status: 1 });
reassignRequestSchema.index({ ticket: 1 });

module.exports = mongoose.model('ReassignRequest', reassignRequestSchema);
