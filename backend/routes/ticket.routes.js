const express = require('express');
const router = express.Router();
const {
  createTicket, getTickets, getTicket, updateStatus,
  assignTicket, reopenTicket, submitFeedback,
  suggestPriority, findSimilarTickets, updatePriority, deleteTicket
} = require('../controllers/ticket.controller');
const {
  createReassignRequest, getReassignRequests, processReassignRequest
} = require('../controllers/reassign.controller');
const { protect, authorize } = require('../middleware/auth.middleware');
const upload = require('../middleware/upload.middleware');

router.get('/similar', protect, findSimilarTickets);
router.post('/suggest-priority', protect, suggestPriority);

router.route('/')
  .get(protect, getTickets)
  .post(protect, upload.array('attachments', 5), createTicket);

router.route('/:id')
  .get(protect, getTicket)
  .delete(protect, authorize('admin'), deleteTicket);

router.patch('/:id/status', protect, authorize('admin', 'support_agent'), updateStatus);
router.patch('/:id/assign', protect, authorize('admin', 'support_agent'), assignTicket);
router.patch('/:id/priority', protect, authorize('admin', 'support_agent'), updatePriority);
router.patch('/:id/reopen', protect, reopenTicket);
router.post('/:id/feedback', protect, submitFeedback);

// Reassignment Request Routes
router.post('/:id/reassign-request', protect, authorize('support_agent'), createReassignRequest);
router.get('/reassign/requests', protect, authorize('admin'), getReassignRequests);
router.patch('/reassign/requests/:requestId', protect, authorize('admin'), processReassignRequest);

module.exports = router;
