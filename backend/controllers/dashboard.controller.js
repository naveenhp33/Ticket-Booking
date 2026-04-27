const Ticket = require('../models/Ticket.model');
const User = require('../models/User.model');
const Comment = require('../models/Comment.model');
const ReassignRequest = require('../models/ReassignRequest.model');

// @desc    Employee dashboard stats
// @route   GET /api/dashboard/employee
// @access  Private (employee)
const getEmployeeDashboard = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const [statusCounts, priorityCounts, recentTickets, avgResolution, last7DaysTrend, pendingFeedback] = await Promise.all([
      Ticket.aggregate([
        { $match: { createdBy: userId } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      Ticket.aggregate([
        { $match: { createdBy: userId } },
        { $group: { _id: '$priority', count: { $sum: 1 } } }
      ]),
      Ticket.find({ createdBy: userId })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('ticketId title status priority createdAt sla')
        .lean(),
      Ticket.aggregate([
        { $match: { createdBy: userId, status: 'resolved', 'resolution.resolvedAt': { $exists: true } } },
        {
          $project: {
            resolutionTime: {
              $divide: [{ $subtract: ['$resolution.resolvedAt', '$createdAt'] }, 3600000]
            }
          }
        },
        { $group: { _id: null, avg: { $avg: '$resolutionTime' } } }
      ]),
      Ticket.aggregate([
        {
          $facet: {
            created: [
              { $match: { createdBy: userId, createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } },
              { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } }
            ],
            resolved: [
              { $match: { createdBy: userId, status: { $in: ['resolved', 'closed'] }, 'resolution.resolvedAt': { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } },
              { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$resolution.resolvedAt' } }, count: { $sum: 1 } } }
            ]
          }
        }
      ]),
      // Count resolved tickets without feedback (pending employee rating)
      Ticket.countDocuments({ createdBy: userId, status: 'resolved', 'feedback.rating': { $exists: false } })
    ]);

    const statusMap = {};
    statusCounts.forEach(s => { statusMap[s._id] = s.count; });

    const priorityMap = {};
    priorityCounts.forEach(p => { priorityMap[p._id] = p.count; });

    const total = Object.values(statusMap).reduce((a, b) => a + b, 0);

    res.json({
      success: true,
      stats: {
        total,
        open: statusMap.open || 0,
        assigned: statusMap.assigned || 0,
        in_progress: statusMap.in_progress || 0,
        resolved: (statusMap.resolved || 0) + (statusMap.closed || 0),
        closed: statusMap.closed || 0,
        reopened: statusMap.reopened || 0,
        pendingFeedback: pendingFeedback || 0,
        priorityBreakdown: priorityMap,
        avgResolutionHours: avgResolution[0]?.avg?.toFixed(1) || 0,
        last7DaysTrend: last7DaysTrend[0]
      },
      recentTickets
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Admin/Agent dashboard
// @route   GET /api/dashboard/admin
// @access  Private (admin/agent)
const getAdminDashboard = async (req, res, next) => {
  try {
    const isAgent = req.user.role === 'support_agent';
    const matchBase = isAgent ? { assignedTo: req.user._id } : {};

    const [
      statusCounts, priorityCounts, slaBreached,
      topAgents, categoryBreakdown, criticalTickets,
      last7DaysTrend, slaAlerts, totalUsers, avgResolution,
      pendingReassignRequests, pendingConfirmationTickets,
      shiftCounts, teamCounts
    ] = await Promise.all([
      Ticket.aggregate([
        { $match: matchBase },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      Ticket.aggregate([
        { $match: { ...matchBase, status: { $nin: ['closed', 'resolved'] } } },
        { $group: { _id: '$priority', count: { $sum: 1 } } }
      ]),
      Ticket.countDocuments({ ...matchBase, 'sla.breached': true, status: { $nin: ['closed', 'resolved'] } }),
      Ticket.aggregate([
        { $match: { status: 'resolved' } },
        { $group: { _id: '$assignedTo', resolved: { $sum: 1 }, avgScore: { $avg: '$feedback.rating' } } },
        { $sort: { resolved: -1 } },
        { $limit: 5 },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'agent' } },
        { $unwind: '$agent' },
        { $project: { name: '$agent.name', resolved: 1, avgScore: 1 } }
      ]),
      Ticket.aggregate([
        { $match: matchBase },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      Ticket.find({ ...matchBase, priority: 'critical', status: { $nin: ['resolved', 'closed'] } })
        .sort({ priorityScore: -1 })
        .limit(10)
        .populate('createdBy assignedTo', 'name email')
        .select('ticketId title status priority sla createdAt assignedTo')
        .lean(),
      Ticket.aggregate([
        {
          $facet: {
            created: [
              { $match: { ...matchBase, createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } },
              { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } }
            ],
            resolved: [
              { $match: { ...matchBase, status: { $in: ['resolved', 'closed'] }, 'resolution.resolvedAt': { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } },
              { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$resolution.resolvedAt' } }, count: { $sum: 1 } } }
            ]
          }
        }
      ]),
        Ticket.find({ ...matchBase, status: { $nin: ['resolved', 'closed'] } })
          .sort({ 'sla.deadline': 1 })
          .limit(5)
          .select('ticketId title sla status')
          .lean(),
        isAgent ? Promise.resolve(null) : User.countDocuments({ isActive: true }),
        Ticket.aggregate([
          { $match: { ...matchBase, status: { $in: ['resolved', 'closed'] }, 'resolution.resolvedAt': { $exists: true } } },
          {
            $project: {
              resolutionTime: {
                $divide: [{ $subtract: ['$resolution.resolvedAt', '$createdAt'] }, 3600000]
              }
            }
          },
          { $group: { _id: null, avg: { $avg: '$resolutionTime' } } }
        ]),
        isAgent ? Promise.resolve(0) : ReassignRequest.countDocuments({ status: 'pending' }),
        Ticket.find({ ...matchBase, status: 'pending_confirmation' })
        .limit(10)
        .populate('createdBy assignedTo', 'name')
        .select('ticketId title status category createdAt assignedTo resolution')
        .lean(),
      Ticket.aggregate([
        { $match: matchBase },
        { $group: { _id: '$shift', count: { $sum: 1 } } }
      ]),
      Ticket.aggregate([
        { $match: matchBase },
        { $group: { _id: '$team', count: { $sum: 1 } } }
      ])
    ]);

    const shiftStats = {};
    shiftCounts.forEach(s => { if (s._id) shiftStats[s._id] = s.count; });

    const teamBreakdown = {};
    teamCounts.forEach(t => { if (t._id) teamBreakdown[t._id] = t.count; });
  
      const statusMap = {};
      statusCounts.forEach(s => { statusMap[s._id] = s.count; });
  
      const priorityMap = {};
      priorityCounts.forEach(p => { priorityMap[p._id] = p.count; });
  
      res.json({
        success: true,
        stats: {
          total: Object.values(statusMap).reduce((a, b) => a + b, 0),
          open: statusMap.open || 0,
          assigned: statusMap.assigned || 0,
          in_progress: statusMap.in_progress || 0,
          pending_confirmation: statusMap.pending_confirmation || 0,
          resolved: (statusMap.resolved || 0) + (statusMap.closed || 0),
          closed: statusMap.closed || 0,
          slaBreached,
          totalUsers,
          priorityBreakdown: priorityMap,
          categoryBreakdown,
          topAgents,
          criticalTickets,
          last7DaysTrend: last7DaysTrend[0],
          slaAlerts,
          avgResolutionHours: avgResolution[0]?.avg?.toFixed(1) || 0,
          pendingReassignRequests,
          pendingConfirmationTickets,
          shiftStats,
          teamBreakdown
        }
      });
  } catch (err) {
    next(err);
  }
};

// @desc    Get agent workload summary (admin)
// @route   GET /api/dashboard/workload
// @access  Private (admin)
const getWorkload = async (req, res, next) => {
  try {
    const agents = await User.find({ role: 'support_agent', isActive: true }).select('name email currentWorkload expertise').lean();
    const agentIds = agents.map(a => a._id);

    const ticketCounts = await Ticket.aggregate([
      { $match: { assignedTo: { $in: agentIds }, status: { $nin: ['resolved', 'closed'] } } },
      { $group: { _id: '$assignedTo', active: { $sum: 1 }, critical: { $sum: { $cond: [{ $eq: ['$priority', 'critical'] }, 1, 0] } } } }
    ]);

    const countMap = {};
    ticketCounts.forEach(t => { countMap[t._id.toString()] = t; });

    const workload = agents.map(agent => ({
      ...agent,
      activeTickets: countMap[agent._id.toString()]?.active || 0,
      criticalTickets: countMap[agent._id.toString()]?.critical || 0
    }));

    res.json({ success: true, workload });
  } catch (err) {
    next(err);
  }
};

// @desc    Analytics data
// @route   GET /api/dashboard/analytics
// @access  Private (admin)
const getAnalytics = async (req, res, next) => {
  try {
    const [totalTickets, statusBreakdown, priorityBreakdown, categoryBreakdown, monthlyTrend] = await Promise.all([
      Ticket.countDocuments(),
      Ticket.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Ticket.aggregate([{ $group: { _id: '$priority', count: { $sum: 1 } } }]),
      Ticket.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      Ticket.aggregate([
        { $match: { createdAt: { $gte: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000) } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ])
    ]);
    res.json({ success: true, totalTickets, statusBreakdown, priorityBreakdown, categoryBreakdown, monthlyTrend });
  } catch (err) {
    next(err);
  }
};

// @desc    Reports data
// @route   GET /api/dashboard/reports
// @access  Private (admin)
const getReports = async (req, res, next) => {
  try {
    const [avgResolution, topCategories, slaCompliance, agentPerformance] = await Promise.all([
      Ticket.aggregate([
        { $match: { status: { $in: ['resolved', 'closed'] }, 'resolution.resolvedAt': { $exists: true } } },
        { $project: { hours: { $divide: [{ $subtract: ['$resolution.resolvedAt', '$createdAt'] }, 3600000] } } },
        { $group: { _id: null, avg: { $avg: '$hours' } } }
      ]),
      Ticket.aggregate([
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 }
      ]),
      Ticket.aggregate([
        { $group: { _id: null, total: { $sum: 1 }, breached: { $sum: { $cond: ['$sla.breached', 1, 0] } } } }
      ]),
      Ticket.aggregate([
        { $match: { assignedTo: { $ne: null }, status: { $in: ['resolved', 'closed'] } } },
        { $group: { _id: '$assignedTo', resolved: { $sum: 1 }, avgRating: { $avg: '$feedback.rating' } } },
        { $sort: { resolved: -1 } },
        { $limit: 10 },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'agent' } },
        { $unwind: '$agent' },
        { $project: { name: '$agent.name', email: '$agent.email', resolved: 1, avgRating: 1 } }
      ])
    ]);
    const slaRate = slaCompliance[0] ? ((slaCompliance[0].total - slaCompliance[0].breached) / slaCompliance[0].total * 100).toFixed(1) : 100;
    res.json({ success: true, avgResolutionHours: avgResolution[0]?.avg?.toFixed(1) || 0, topCategories, slaComplianceRate: slaRate, agentPerformance });
  } catch (err) {
    next(err);
  }
};

module.exports = { getEmployeeDashboard, getAdminDashboard, getWorkload, getAnalytics, getReports };
