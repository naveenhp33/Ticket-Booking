// email.routes.js
const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth.middleware');
const { pollEmails } = require('../services/emailPoller.service');

router.post('/poll', protect, authorize('admin'), async (req, res) => {
  try {
    await pollEmails();
    res.json({ success: true, message: 'Email poll triggered' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
