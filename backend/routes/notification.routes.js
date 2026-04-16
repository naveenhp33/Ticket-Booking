// notification.routes.js
const express = require('express');
const router = express.Router();
const { getNotifications, markAsRead, deleteNotification } = require('../controllers/notification.controller');
const { protect } = require('../middleware/auth.middleware');

router.get('/', protect, getNotifications);
router.patch('/read', protect, markAsRead);
router.delete('/:id', protect, deleteNotification);

module.exports = router;
