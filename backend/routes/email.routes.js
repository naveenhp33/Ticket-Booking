// email.routes.js
const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth.middleware');
const { pollEmails } = require('../services/emailPoller.service');
const { sendAckEmail, sendResolveEmail } = require('../services/email.service');
const Ticket = require('../models/Ticket.model');
const User = require('../models/User.model');

router.post('/poll', protect, authorize('admin'), async (req, res) => {
  try {
    await pollEmails();
    res.json({ success: true, message: 'Email poll triggered' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @desc    Send ack or resolve email for a ticket
// @route   POST /api/email/send-email
// @access  Private (admin)
router.post('/send-email', protect, authorize('admin'), async (req, res) => {
  try {
    const { ticketId, type } = req.body;
    if (!ticketId || !['ack', 'resolve'].includes(type)) {
      return res.status(400).json({ success: false, message: 'ticketId and type (ack|resolve) are required' });
    }

    const ticket = await Ticket.findById(ticketId).populate('createdBy', 'name email');
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });

    const { name, email } = ticket.createdBy;

    if (type === 'ack') {
      ticket.firstResponseAt = new Date();
      await ticket.save({ validateBeforeSave: false });
      await sendAckEmail({ to: email, name, ticket });
    } else {
      await sendResolveEmail({ to: email, name, ticket });
    }

    res.json({ success: true, message: `${type === 'ack' ? 'Acknowledgement' : 'Resolution'} email sent` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
