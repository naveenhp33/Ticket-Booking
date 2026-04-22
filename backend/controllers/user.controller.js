const User = require('../models/User.model');
const Ticket = require('../models/Ticket.model');
const { emitToRole } = require('../config/socket');

// @desc    Get all users (admin)
// @route   GET /api/users
// @access  Private (admin)
const getUsers = async (req, res, next) => {
  try {
    const { role, department, search, isActive, page = 1, limit = 20 } = req.query;
    const query = {};
    if (role) query.role = role;
    if (department) query.department = department;
    if (isActive !== undefined) query.isActive = isActive === 'true';
    if (search) query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } }
    ];

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [users, total] = await Promise.all([
      User.find(query).select('-password').sort({ name: 1 }).skip(skip).limit(parseInt(limit)).lean(),
      User.countDocuments(query)
    ]);

    res.json({ success: true, users, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
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

// @desc    Bulk import users from CSV
// @route   POST /api/users/bulk-import
// @access  Private (admin)
const bulkImportUsers = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'CSV file is required' });

    const csv = require('csv-parser');
    const { Readable } = require('stream');
    const rows = [];

    await new Promise((resolve, reject) => {
      Readable.from(req.file.buffer)
        .pipe(csv())
        .on('data', row => rows.push(row))
        .on('end', resolve)
        .on('error', reject);
    });

    const valid = [];
    const errors = [];
    const emailRegex = /^[^\s@]+@vdartinc\.com$/i;

    for (const row of rows) {
      const email       = (row.email       || '').toLowerCase().trim();
      const name        = (row.name        || '').trim();
      const role        = (row.role        || 'employee').trim();
      const employeeId  = (row.id          || row.employee_id || row.employeeId || '').trim();
      const teamName    = (row.team        || row.teamName    || '').trim();
      const shift       = (row.shift       || '').trim();
      const designation = (row.designation || row.position   || '').trim();
      const experience  = (row.experience  || '').trim();
      const department  = (row.department  || 'Other').trim();

      if (!emailRegex.test(email)) { errors.push(`Invalid email: ${email}`); continue; }
      if (!name) { errors.push(`Missing name for ${email}`); continue; }

      const doc = { email, name, role, isVerified: true, isActive: true, createdByAdmin: true };
      if (employeeId)  doc.employeeId  = employeeId;
      if (designation) doc.designation = designation;
      if (department)  doc.department  = department;
      if (teamName)    doc.teamName    = teamName;
      if (shift)       doc.shift       = shift;
      if (experience)  doc.experience  = experience;

      valid.push(doc);
    }

    if (!valid.length) return res.status(400).json({ success: false, message: 'No valid rows found', errors });

    const ops = valid.map(({ email, ...fields }) => ({
      updateOne: {
        filter: { email },
        update: {
          $setOnInsert: { email },
          $set: fields
        },
        upsert: true
      }
    }));

    const result = await User.bulkWrite(ops);
    const imported = result.upsertedCount;
    const updated  = result.modifiedCount;

    res.json({ success: true, imported, updated, skipped: valid.length - imported - updated, errors });
  } catch (err) {
    next(err);
  }
};

// @desc    Bulk delete users
// @route   DELETE /api/users/bulk-delete
// @access  Private (admin)
const bulkDeleteUsers = async (req, res, next) => {
  try {
    const { userIds } = req.body;
    if (!Array.isArray(userIds) || !userIds.length)
      return res.status(400).json({ success: false, message: 'No user IDs provided' });

    // Safety: prevent admin from deleting their own account
    if (userIds.includes(req.user._id.toString()))
      return res.status(400).json({ success: false, message: 'You cannot delete your own account' });

    const result = await User.deleteMany({ _id: { $in: userIds } });
    res.json({ success: true, deleted: result.deletedCount });
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
  updateLiveStatus,
  bulkImportUsers,
  bulkDeleteUsers
};
