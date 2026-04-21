const User = require('../models/User.model');
const Ticket = require('../models/Ticket.model');
const { emitToRole } = require('../config/socket');

// @desc    Get all users (admin)
// @route   GET /api/users
// @access  Private (admin)
const getUsers = async (req, res, next) => {
  try {
    const { role, department, search, isActive = true } = req.query;
    const query = {};
    if (role) query.role = role;
    if (department) query.department = department;
    if (isActive !== undefined) query.isActive = isActive === 'true';
    if (search) query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } }
    ];

    const users = await User.find(query)
      .select('-password')
      .sort({ name: 1 })
      .lean();

    res.json({ success: true, users });
  } catch (err) {
    next(err);
  }
};

// @desc    Get agents (for assignment dropdown)
// @route   GET /api/users/agents
// @access  Private (admin/agent)
const getAgents = async (req, res, next) => {
  try {
    const { category } = req.query;
    const query = { role: 'support_agent', isActive: true };
    if (category) query.expertise = category;
    
    // If user is a department admin (not Super Admin), restrict agents to their department
    if (req.user.role === 'admin' && req.user.department !== 'Admin') {
      query.department = req.user.department;
    } else if (req.user.role === 'support_agent') {
      // Support agents also restricted to their own department/expertise for collaboration
      query.department = req.user.department;
    }

    const agents = await User.find(query)
      .select('name email department currentWorkload expertise avatar liveStatus onSiteTicket lastStatusUpdate')
      .populate('onSiteTicket', 'ticketId title status location onSiteVisit')
      .sort({ currentWorkload: 1 })
      .lean();

    res.json({ success: true, agents });
  } catch (err) {
    next(err);
  }
};

// @desc    Get single user
// @route   GET /api/users/:id
// @access  Private (admin)
const getUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, user });
  } catch (err) {
    next(err);
  }
};

// @desc    Update user (admin)
// @route   PUT /api/users/:id
// @access  Private (admin)
const updateUser = async (req, res, next) => {
  try {
    const { role, department, expertise, isActive, designation } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role, department, expertise, isActive, designation },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    // Real-time
    emitToRole('admin', 'user_updated', { user });

    res.json({ success: true, user });
  } catch (err) {
    next(err);
  }
};

// @desc    Get user stats
// @route   GET /api/users/:id/stats
// @access  Private
const getUserStats = async (req, res, next) => {
  try {
    const userId = req.params.id;
    if (req.user.role === 'employee' && req.user._id.toString() !== userId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const [raised, categoryBreakdown, monthlyTrend] = await Promise.all([
      Ticket.aggregate([
        { $match: { createdBy: userId } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      Ticket.aggregate([
        { $match: { createdBy: userId } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      Ticket.aggregate([
        {
          $match: {
            createdBy: userId,
            createdAt: { $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) }
          }
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ])
    ]);

    res.json({ success: true, raised, categoryBreakdown, monthlyTrend });
  } catch (err) {
    next(err);
  }
};

// @desc    Update agent live status
// @route   PUT /api/users/status
// @access  Private (agent/admin)
const updateLiveStatus = async (req, res, next) => {
  try {
    const { status, ticketId } = req.body;
    const userId = req.user._id;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    // Validation: Only one active on-site allowed
    if (status === 'on_site') {
      if (user.liveStatus === 'on_site' && user.onSiteTicket && user.onSiteTicket.toString() !== ticketId) {
        return res.status(400).json({ 
          success: false, 
          message: `You are already on-site for ticket ${user.onSiteTicket}. Please resolve it or handover before switching.` 
        });
      }
      user.onSiteTicket = ticketId;
    } else {
      // If moving away from on_site, clear the ticket Ref
      user.onSiteTicket = null;
    }

    user.liveStatus = status;
    user.lastStatusUpdate = new Date();
    await user.save();

    // Broadcast to admins for live view
    emitToRole('admin', 'agent_status_updated', {
      agentId: user._id,
      name: user.name,
      status: user.liveStatus,
      ticketId: user.onSiteTicket,
      timestamp: user.lastStatusUpdate
    });

    res.json({ success: true, status: user.liveStatus, onSiteTicket: user.onSiteTicket });
  } catch (err) {
    next(err);
  }
};

module.exports = { 
  getUsers, 
  getAgents, 
  getUser, 
  updateUser, 
  getUserStats,
  updateLiveStatus
};
