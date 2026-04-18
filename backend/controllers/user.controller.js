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
    const query = { role: { $in: ['support_agent', 'admin'] }, isActive: true };
    if (category) query.expertise = category;
    
    // If user is a department admin (not Super Admin), restrict agents to their department
    if (req.user.role === 'admin' && req.user.department !== 'Admin') {
      query.department = req.user.department;
    } else if (req.user.role === 'support_agent') {
      // Support agents also restricted to their own department/expertise for collaboration
      query.department = req.user.department;
    }

    const agents = await User.find(query)
      .select('name email department currentWorkload expertise avatar')
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

module.exports = { getUsers, getAgents, getUser, updateUser, getUserStats };
