const Comment = require('../models/Comment.model');
const Ticket = require('../models/Ticket.model');
const User = require('../models/User.model');
const { notifyComment } = require('../services/notification.service');
const { emitToTicket } = require('../config/socket');

// @desc    Add comment
// @route   POST /api/comments/:ticketId
// @access  Private
const addComment = async (req, res, next) => {
  try {
    const { content, parentComment, isInternal, mentionedUserIds } = req.body;
    const ticket = await Ticket.findById(req.params.ticketId);
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });

    // Employees can't see/post internal comments
    if (isInternal && req.user.role === 'employee') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Employees can only comment on their own tickets
    if (req.user.role === 'employee' && ticket.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Parse mentions from content (@username)
    const mentionMatches = content.match(/@[\w.-]+/g) || [];
    let mentionedUsers = [];
    if (mentionMatches.length > 0) {
      const usernames = mentionMatches.map(m => m.slice(1));
      mentionedUsers = await User.find({ $or: [{ name: { $in: usernames } }, { email: { $in: usernames.map(u => u.toLowerCase()) } }] }).select('_id name');
    }

    // Also include explicitly passed IDs
    if (mentionedUserIds?.length) {
      const extraUsers = await User.find({ _id: { $in: mentionedUserIds } }).select('_id name');
      mentionedUsers = [...mentionedUsers, ...extraUsers];
    }

    const attachments = (req.files || []).map(f => ({
      filename: f.filename,
      originalName: f.originalname,
      mimetype: f.mimetype,
      size: f.size,
      path: f.path
    }));

    const comment = await Comment.create({
      ticket: ticket._id,
      author: req.user._id,
      content,
      parentComment: parentComment || null,
      mentions: mentionedUsers.map(u => u._id),
      attachments,
      isInternal: isInternal === true || isInternal === 'true'
    });

    await comment.populate('author', 'name email avatar role');
    if (mentionedUsers.length) await comment.populate('mentions', 'name email');

    // Notify
    await notifyComment(ticket, comment, req.user, mentionedUsers.map(u => u._id));

    // Real-time
    emitToTicket(ticket._id.toString(), 'new_comment', {
      comment,
      ticketId: ticket._id
    });

    res.status(201).json({ success: true, comment });
  } catch (err) {
    next(err);
  }
};

// @desc    Get comments for a ticket
// @route   GET /api/comments/:ticketId
// @access  Private
const getComments = async (req, res, next) => {
  try {
    const ticket = await Ticket.findById(req.params.ticketId);
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });

    if (req.user.role === 'employee' && ticket.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const query = { ticket: req.params.ticketId, parentComment: null, isDeleted: false };
    if (req.user.role === 'employee') query.isInternal = false;

    const comments = await Comment.find(query)
      .populate('author', 'name email avatar role department')
      .populate('mentions', 'name email')
      .populate({
        path: 'replies',
        match: { isDeleted: false, ...(req.user.role === 'employee' ? { isInternal: false } : {}) },
        populate: { path: 'author', select: 'name email avatar role' }
      })
      .sort({ createdAt: 1 });

    res.json({ success: true, comments });
  } catch (err) {
    next(err);
  }
};

// @desc    Edit comment
// @route   PUT /api/comments/:id
// @access  Private (author)
const editComment = async (req, res, next) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) return res.status(404).json({ success: false, message: 'Comment not found' });
    if (comment.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Can only edit your own comments' });
    }

    comment.content = req.body.content;
    comment.isEdited = true;
    comment.editedAt = new Date();
    await comment.save();
    await comment.populate('author', 'name email avatar role');

    res.json({ success: true, comment });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete comment (soft delete)
// @route   DELETE /api/comments/:id
// @access  Private (author or admin)
const deleteComment = async (req, res, next) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) return res.status(404).json({ success: false, message: 'Comment not found' });

    if (comment.author.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    comment.isDeleted = true;
    comment.content = '[This comment was deleted]';
    await comment.save();

    res.json({ success: true, message: 'Comment deleted' });
  } catch (err) {
    next(err);
  }
};

module.exports = { addComment, getComments, editComment, deleteComment };
