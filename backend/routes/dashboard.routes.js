const express = require('express');
const router = express.Router();
const { getEmployeeDashboard, getAdminDashboard, getWorkload } = require('../controllers/dashboard.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

router.get('/employee', protect, getEmployeeDashboard);
router.get('/admin', protect, authorize('admin', 'support_agent'), getAdminDashboard);
router.get('/workload', protect, authorize('admin'), getWorkload);

module.exports = router;
