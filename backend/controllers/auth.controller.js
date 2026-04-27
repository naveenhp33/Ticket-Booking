const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User.model');
const { sendVerificationEmail, sendPasswordSetEmail, sendStatusChangeEmail, sendOtpEmail } = require('../services/email.service');

const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role, email: user.email, department: user.department },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );
};

// @desc    Step 1 — Employee submits only their company email
// @route   POST /api/auth/request-verification
// @access  Public
const requestVerification = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

    const normalizedEmail = email.toLowerCase().trim();

    if (!normalizedEmail.endsWith('@vdartinc.com') && !normalizedEmail.endsWith('@ndartinc.com')) {
      return res.status(400).json({ success: false, message: 'Only @vdartinc.com or @ndartinc.com emails are accepted' });
    }

    const existing = await User.findOne({ email: normalizedEmail }).select('+verificationToken +verificationTokenExpiry');

    // If already verified and active — tell them to just log in
    if (existing?.isVerified && existing?.isActive) {
      return res.status(400).json({ success: false, message: 'This email is already registered. Please log in.' });
    }

    // Generate a secure token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    if (existing) {
      // Resend verification — update token
      existing.verificationToken = hashedToken;
      existing.verificationTokenExpiry = expiry;
      await existing.save({ validateBeforeSave: false });
    } else {
      // Create a pending user record
      await User.create({
        email: normalizedEmail,
        verificationToken: hashedToken,
        verificationTokenExpiry: expiry,
        isVerified: false,
        isActive: false,
        createdByAdmin: false,
        name: '',
        role: 'employee'
      });
    }

    const verifyUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-email?token=${rawToken}&email=${normalizedEmail}`;
    try {
      await sendVerificationEmail({ to: normalizedEmail, verifyUrl });
    } catch (emailErr) {
      console.error('❌ sendVerificationEmail failed:', emailErr.message);
      return res.status(500).json({ success: false, message: 'Failed to send verification email. Please try again later.' });
    }

    res.json({ success: true, message: 'Verification link sent to your email. Please check your inbox.' });
  } catch (err) {
    next(err);
  }
};

// @desc    Step 2 — Employee clicks verification link
// @route   GET /api/auth/verify-email?token=xxx&email=xxx
// @access  Public
const verifyEmail = async (req, res, next) => {
  try {
    const { token, email } = req.query;
    if (!token || !email) {
      return res.status(400).json({ success: false, message: 'Invalid verification link' });
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({ email: email.toLowerCase() })
      .select('+verificationToken +verificationTokenExpiry');

    if (!user) return res.status(400).json({ success: false, message: 'User not found' });
    if (user.isVerified) return res.status(400).json({ success: false, message: 'Email already verified' });
    if (user.verificationToken !== hashedToken) {
      return res.status(400).json({ success: false, message: 'Invalid or expired verification link' });
    }
    if (user.verificationTokenExpiry < new Date()) {
      return res.status(400).json({ success: false, message: 'Verification link has expired. Please request a new one.' });
    }

    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpiry = undefined;
    await user.save({ validateBeforeSave: false });

    res.json({ success: true, message: 'Email verified! An admin will activate your account and share your login details.' });
  } catch (err) {
    next(err);
  }
};

// @desc    Step 1 of login — send OTP only to existing, active users
// @route   POST /api/auth/send-otp
// @access  Public
const sendOtp = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

    const normalizedEmail = email.toLowerCase().trim();
    if (!normalizedEmail.endsWith('@vdartinc.com')) {
      return res.status(400).json({ success: false, message: 'Only @vdartinc.com emails are accepted' });
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user || !user.isActive) {
      return res.status(404).json({ success: false, message: 'No active account found for this email. Please contact your Admin.' });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');
    user.otp = hashedOtp;
    user.otpExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
    await user.save({ validateBeforeSave: false });

    // ── DEV BACKDOOR (remove this block before production) ────────────────
    if (process.env.NODE_ENV === 'development' && normalizedEmail === 'admin@vdartinc.com') {
      return res.json({ success: true, devCode: otp, message: 'Dev mode: OTP returned directly.' });
    }
    // ── END DEV BACKDOOR ─────────────────────────────────────────────────

    try {
      await sendOtpEmail({ to: user.email, otp });
    } catch (emailErr) {
      console.error('❌ sendOtpEmail failed:', emailErr.message);
      return res.status(500).json({ success: false, message: 'Failed to send code. Please try again later.' });
    }

    res.json({ success: true, message: `A 6-digit code has been sent to ${user.email}` });
  } catch (err) {
    next(err);
  }
};

// @desc    Step 2 of login — verify OTP and return token
// @route   POST /api/auth/verify-otp
// @access  Public
const verifyOtp = async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email and code are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+otp +otpExpiry');

    if (!user || !user.otp) {
      return res.status(400).json({ success: false, message: 'No code was requested. Please request a new one.' });
    }
    if (user.otpExpiry < new Date()) {
      return res.status(400).json({ success: false, message: 'Your code has expired. Please request a new one.' });
    }

    const hashedOtp = crypto.createHash('sha256').update(otp.trim()).digest('hex');
    if (hashedOtp !== user.otp) {
      return res.status(400).json({ success: false, message: 'Incorrect code. Please try again.' });
    }

    // Clear OTP after successful use
    user.otp = undefined;
    user.otpExpiry = undefined;
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

// @desc    Login — only verified + active users
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    if (!user.isVerified) {
      return res.status(403).json({ success: false, message: 'Your email is not verified yet. Please check your inbox for the verification link.' });
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'Your account is not active yet. Please wait for admin to activate it.' });
    }

    if (!user.password) {
      return res.status(403).json({ success: false, message: 'Your password has not been set yet. Please contact admin.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
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

// @desc    Admin creates/activates a user — stores password silently (no email sent)
// @route   POST /api/auth/admin/create-user
// @access  Private (admin)
const adminCreateUser = async (req, res, next) => {
  try {
    const { email, name, role, department, designation, employeeId, password } = req.body;

    if (!email || !name) {
      return res.status(400).json({ success: false, message: 'Email and name are required' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    let user = await User.findOne({ email: normalizedEmail });

    if (user) {
      user.name        = name;
      user.role        = role        || 'employee';
      user.department  = department  || 'Other';
      user.designation = designation || '';
      user.employeeId  = employeeId  || user.employeeId;
      user.isActive    = true;
      user.isVerified  = true;
      user.createdByAdmin = true;
      if (password) user.password = password; // only update if provided
    } else {
      user = new User({
        email: normalizedEmail,
        name,
        role:        role        || 'employee',
        department:  department  || 'Other',
        designation: designation || '',
        employeeId,
        password:    password    || undefined,
        isVerified:  true,
        isActive:    true,
        createdByAdmin: true
      });
    }

    await user.save();

    // No email sent to employee — credentials are shared manually by Admin via ticket system
    res.status(201).json({
      success: true,
      message: 'User account created. Credentials stored securely — share manually if needed.',
      user: { _id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Admin resets a user's password — stored silently, no email sent
// @route   PUT /api/auth/admin/reset-password
// @access  Private (admin)
const adminResetPassword = async (req, res, next) => {
  try {
    const { userId, newPassword } = req.body;
    if (!userId || !newPassword) {
      return res.status(400).json({ success: false, message: 'User ID and new password are required' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    user.password = newPassword;
    await user.save();

    // No email sent — Admin shares credentials manually via ticket system
    res.json({ success: true, message: 'Password updated and stored securely. Share with the employee manually if needed.' });
  } catch (err) {
    next(err);
  }
};

module.exports = { requestVerification, verifyEmail, sendOtp, verifyOtp, login, getMe, adminCreateUser, adminResetPassword };
