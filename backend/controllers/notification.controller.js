const Notification = require('../models/Notification.model');

// @desc    Get user notifications
// @route   GET /api/notifications
// @access  Private
const getNotifications = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, unreadOnly } = req.query;
    const query = { recipient: req.user._id };
    if (unreadOnly === 'true') query.isRead = false;

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .populate('triggeredBy', 'name avatar')
      .populate('ticket', 'ticketId title')
      .lean();

    const unreadCount = await Notification.countDocuments({ recipient: req.user._id, isRead: false });

    res.json({ success: true, notifications, unreadCount });
  } catch (err) {
    next(err);
  }
};

// @desc    Mark notification(s) as read
// @route   PATCH /api/notifications/read
// @access  Private
const markAsRead = async (req, res, next) => {
  try {
    const { ids, all } = req.body;
    const query = { recipient: req.user._id };
    if (!all && ids?.length) query._id = { $in: ids };

    await Notification.updateMany(query, { isRead: true, readAt: new Date() });
    res.json({ success: true, message: 'Notifications marked as read' });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete notification
// @route   DELETE /api/notifications/:id
// @access  Private
const deleteNotification = async (req, res, next) => {
  try {
    await Notification.findOneAndDelete({ _id: req.params.id, recipient: req.user._id });
    res.json({ success: true, message: 'Notification deleted' });
  } catch (err) {
    next(err);
  }
};

module.exports = { getNotifications, markAsRead, deleteNotification };
