const express = require('express');
const router = express.Router();
const { getUsers, getAgents, getUser, updateUser, getUserStats } = require('../controllers/user.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

router.get('/', protect, authorize('admin'), getUsers);
router.get('/agents', protect, authorize('admin', 'support_agent'), getAgents);
router.get('/:id/stats', protect, getUserStats);
router.route('/:id')
  .get(protect, authorize('admin'), getUser)
  .put(protect, authorize('admin'), updateUser);

module.exports = router;
