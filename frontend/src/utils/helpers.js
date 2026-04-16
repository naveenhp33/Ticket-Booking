import { formatDistanceToNow, format, differenceInHours, differenceInMinutes } from 'date-fns';

// Format relative time
export const timeAgo = (date) => {
  if (!date) return 'N/A';
  return formatDistanceToNow(new Date(date), { addSuffix: true });
};

// Format date
export const formatDate = (date, fmt = 'MMM d, yyyy') => {
  if (!date) return 'N/A';
  return format(new Date(date), fmt);
};

export const formatDateTime = (date) => {
  if (!date) return 'N/A';
  return format(new Date(date), 'MMM d, yyyy h:mm a');
};

// SLA countdown
export const getSLAStatus = (sla) => {
  if (!sla?.deadline) return null;
  if (sla.breached) return { status: 'breached', label: 'SLA Breached', className: 'sla-countdown--critical' };

  const now = new Date();
  const deadline = new Date(sla.deadline);
  const hoursLeft = differenceInHours(deadline, now);
  const minutesLeft = differenceInMinutes(deadline, now);

  if (minutesLeft <= 0) return { status: 'breached', label: 'SLA Breached', className: 'sla-countdown--critical' };
  if (hoursLeft < 1) return { status: 'critical', label: `${minutesLeft}m left`, className: 'sla-countdown--critical' };
  if (hoursLeft < 4) return { status: 'warning', label: `${hoursLeft}h left`, className: 'sla-countdown--warning' };
  if (hoursLeft < 24) return { status: 'ok', label: `${hoursLeft}h left`, className: 'sla-countdown--ok' };

  const daysLeft = Math.floor(hoursLeft / 24);
  return { status: 'ok', label: `${daysLeft}d left`, className: 'sla-countdown--ok' };
};

// Priority color class
export const getPriorityClass = (priority) => `badge badge--${priority}`;

// Status label
export const STATUS_LABELS = {
  open: 'Open',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  pending_info: 'Pending Info',
  resolved: 'Resolved',
  closed: 'Closed',
  reopened: 'Reopened'
};

export const PRIORITY_LABELS = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low'
};

// Get initials from name
export const getInitials = (name = '') => {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
};

// File size formatter
export const formatFileSize = (bytes) => {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

// File icon by mimetype
export const getFileIcon = (mimetype = '') => {
  if (mimetype.startsWith('image/')) return '🖼️';
  if (mimetype === 'application/pdf') return '📄';
  if (mimetype.includes('word')) return '📝';
  if (mimetype.includes('excel') || mimetype.includes('spreadsheet')) return '📊';
  if (mimetype.startsWith('video/')) return '🎥';
  if (mimetype === 'text/plain') return '📋';
  return '📎';
};

// Notification type icons
export const NOTIF_ICONS = {
  ticket_created: '🎫',
  ticket_assigned: '👤',
  ticket_status_changed: '🔄',
  ticket_comment: '💬',
  ticket_mention: '@ ',
  ticket_resolved: '✅',
  ticket_reopened: '🔁',
  sla_warning: '⚠️',
  sla_breached: '🚨',
  ticket_escalated: '🔺',
  feedback_requested: '⭐'
};

// Parse @mentions from comment text
export const parseMentions = (text) => {
  return text.replace(/@([\w.-]+)/g, '<span class="comment__mention">@$1</span>');
};

// Generate avatar background from name
const AVATAR_COLORS = [
  '#2563eb', '#7c3aed', '#db2777', '#dc2626',
  '#ea580c', '#d97706', '#16a34a', '#0891b2'
];
export const getAvatarColor = (name = '') => {
  const idx = name.charCodeAt(0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
};

// Category icons
export const CATEGORY_ICONS = {
  IT: '💻', HR: '👥', Finance: '💰', Admin: '🏢',
  Operations: '⚙️', Marketing: '📣', Sales: '📈',
  Legal: '⚖️', Other: '📌'
};
