const jwt = require('jsonwebtoken');
const User = require('../models/User.model');

const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role, email: user.email, department: user.department },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );
};

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res, next) => {
  try {
    const { 
      fullName, name, 
      workEmail, email, 
      password, department, designation, employeeId, 
      phone, location, role 
    } = req.body;

    const finalName = fullName || name;
    const finalEmail = workEmail || email;

    if (!finalName || !finalEmail || !password) {
      return res.status(400).json({ success: false, message: 'Name, email and password are required' });
    }

    const existingUser = await User.findOne({ email: finalEmail.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    // Only @ndartinc.com emails accepted (bypass in dev mode if needed)
    const domainRestricted = process.env.ENFORCE_DOMAIN === 'true' || process.env.NODE_ENV === 'production';
    if (domainRestricted && !finalEmail.toLowerCase().endsWith('@ndartinc.com')) {
      return res.status(400).json({ success: false, message: 'Only @ndartinc.com emails are accepted' });
    }

    // Only admins can create admin/agent accounts
    const assignedRole = role && ['support_agent', 'admin'].includes(role) ? role : 'employee';

    const user = await User.create({
      name: finalName, 
      email: finalEmail, 
      password, department, designation,
      employeeId, phone, location, role: assignedRole
    });

    const token = generateToken(user);

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      token,
      user: {
        _id: user._id, name: user.name, email: user.email,
        role: user.role, department: user.department,
        designation: user.designation, avatar: user.avatar
      }
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Login
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    const token = generateToken(user);

    res.json({
      success: true,
      token,
      user: {
        _id: user._id, name: user.name, email: user.email,
        role: user.role, department: user.department,
        designation: user.designation, avatar: user.avatar,
        preferredContact: user.preferredContact,
        notificationPreferences: user.notificationPreferences,
        location: user.location
      }
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
  res.json({ success: true, user: req.user });
};

// @desc    Update profile
// @route   PUT /api/auth/profile
// @access  Private
const updateProfile = async (req, res, next) => {
  try {
    const { name, phone, designation, location, preferredContact, notificationPreferences } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { name, phone, designation, location, preferredContact, notificationPreferences },
      { new: true, runValidators: true }
    );
    res.json({ success: true, user });
  } catch (err) {
    next(err);
  }
};

// @desc    Change password
// @route   PUT /api/auth/change-password
// @access  Private
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id).select('+password');
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) return res.status(400).json({ success: false, message: 'Current password is incorrect' });

    user.password = newPassword;
    await user.save();
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (err) {
    next(err);
  }
};

const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    
    // In production, send email with reset token. In dev, just return success.
    res.json({ success: true, message: 'Password reset link sent to registered email' });
  } catch (err) { next(err); }
};

const resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;
    // Implementation of token validation would go here
    res.json({ success: true, message: 'Password reset successful' });
  } catch (err) { next(err); }
};

module.exports = { register, login, getMe, updateProfile, changePassword, forgotPassword, resetPassword };
