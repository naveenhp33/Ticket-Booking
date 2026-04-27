const express = require('express');
const router = express.Router();
const { getUsers, getAgents, getUser, updateUser, getUserStats, bulkImportUsers, bulkDeleteUsers } = require('../controllers/user.controller');
const { protect, authorize } = require('../middleware/auth.middleware');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.get('/', protect, authorize('admin'), getUsers);
router.get('/agents', protect, authorize('admin', 'support_agent'), getAgents);
router.get('/:id/stats', protect, getUserStats);
router.put('/status', protect, authorize('admin'), require('../controllers/user.controller').updateLiveStatus);
router.post('/bulk-import', protect, authorize('admin'), upload.single('file'), bulkImportUsers);
router.delete('/bulk-delete', protect, authorize('admin'), bulkDeleteUsers);

router.route('/:id')
  .get(protect, authorize('admin'), getUser)
  .put(protect, authorize('admin'), updateUser);

module.exports = router;
