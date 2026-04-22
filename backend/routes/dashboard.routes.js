const express = require('express');
const router = express.Router();
const { getEmployeeDashboard, getAdminDashboard, getWorkload, getAnalytics, getReports } = require('../controllers/dashboard.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

router.get('/employee', protect, getEmployeeDashboard);
router.get('/admin', protect, authorize('admin', 'support_agent'), getAdminDashboard);
router.get('/workload', protect, authorize('admin'), getWorkload);
router.get('/analytics', protect, authorize('admin'), getAnalytics);
router.get('/reports', protect, authorize('admin'), getReports);

module.exports = router;
