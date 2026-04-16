const mongoose = require('mongoose');

const knowledgeBaseSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  content: { type: String, required: true },
  category: {
    type: String,
    enum: ['IT', 'HR', 'Finance', 'Admin', 'Operations', 'Marketing', 'Sales', 'Legal', 'Other'],
    required: true
  },
  tags: [String],
  keywords: [String], // For matching during ticket creation
  viewCount: { type: Number, default: 0 },
  helpfulCount: { type: Number, default: 0 },
  notHelpfulCount: { type: Number, default: 0 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isPublished: { type: Boolean, default: true }
}, {
  timestamps: true
});

knowledgeBaseSchema.index({ title: 'text', content: 'text', keywords: 'text', tags: 'text' });
knowledgeBaseSchema.index({ category: 1, isPublished: 1 });

module.exports = mongoose.model('KnowledgeBase', knowledgeBaseSchema);
