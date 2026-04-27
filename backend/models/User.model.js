const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters'],
    default: ''
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please enter a valid email address']
  },
  password: {
    type: String,
    minlength: [8, 'Password must be at least 8 characters'],
    select: false
  },
  role: {
    type: String,
    enum: ['employee', 'support_agent', 'admin'],
    default: 'employee'
  },
  department: {
    type: String,
    enum: ['IT', 'HR', 'Finance', 'Admin', 'Operations', 'Marketing', 'Sales', 'Legal', 'Engineering', 'Other'],
    default: 'Other'
  },
  isGuest: { type: Boolean, default: false },
  isVerified: { type: Boolean, default: false },
  createdByAdmin: { type: Boolean, default: false },
  verificationToken: { type: String, select: false },
  verificationTokenExpiry: { type: Date, select: false },
  otp: { type: String, select: false },
  otpExpiry: { type: Date, select: false },
  designation: { type: String, trim: true },
  employeeId: { type: String, unique: true, sparse: true },
  phone: { type: String, trim: true },
  location: {
    floor: String,
    branch: String,
    city: String
  },
  avatar: { type: String, default: null },
  preferredContact: {
    type: String,
    enum: ['email', 'phone', 'slack', 'portal'],
    default: 'email'
  },
  // For support agents — which categories they handle
  expertise: [{ type: String, enum: ['IT', 'HR', 'Finance', 'Admin', 'Operations', 'Marketing', 'Sales', 'Legal', 'Engineering'] }],
  currentWorkload: { type: Number, default: 0 }, // active assigned tickets
  isActive: { type: Boolean, default: false }, // inactive until admin activates
  lastLogin: { type: Date },
  notificationPreferences: {
    email: { type: Boolean, default: true },
    inApp: { type: Boolean, default: true },
    onAssign: { type: Boolean, default: true },
    onStatusChange: { type: Boolean, default: true },
    onComment: { type: Boolean, default: true }
  },
  stats: {
    totalRaised: { type: Number, default: 0 },
    totalResolved: { type: Number, default: 0 },
    avgResolutionTime: { type: Number, default: 0 } // in hours
  },
  // Real-time Status System
  liveStatus: {
    type: String,
    enum: ['available', 'on_site', 'remote', 'unavailable'],
    default: 'available'
  },
  onSiteTicket: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', default: null },
  lastStatusUpdate: { type: Date, default: Date.now }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Hash password before save
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Virtual: full location
userSchema.virtual('fullLocation').get(function () {
  const { floor, branch, city } = this.location || {};
  return [floor, branch, city].filter(Boolean).join(', ');
});

userSchema.index({ email: 1 });
userSchema.index({ role: 1, department: 1 });

// Relocated from fix-agents.js: Ensure baseline expertise for IT admins and normalized workload
userSchema.pre('save', function(next) {
  // Normalize workload
  if (this.currentWorkload < 0) this.currentWorkload = 0;

  // Ensure IT admins have matching expertise by default
  if (this.role === 'admin' && this.department === 'IT' && (!this.expertise || this.expertise.length === 0)) {
    this.expertise = ['IT'];
  }
  next();
});

module.exports = mongoose.model('User', userSchema);
