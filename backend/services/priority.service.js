/**
 * Smart Priority Scoring Service
 * FinalScore = (Impact × 5) + (Urgency × 4) + (SLARisk × 6) + RoleModifier + min(QueueBonus, 20) + KnowledgeBonus
 */

// Knowledge-based keyword rules
const KEYWORD_RULES = [
  { keywords: ['server down', 'server crash', 'outage', 'production down', 'system failure'], bonus: 10, reason: 'Critical infrastructure keyword' },
  { keywords: ['payment issue', 'payment failed', 'payroll', 'salary', 'financial loss'], bonus: 8, reason: 'Financial impact keyword' },
  { keywords: ['data breach', 'security', 'hack', 'unauthorized', 'data loss'], bonus: 10, reason: 'Security risk keyword' },
  { keywords: ['cannot login', 'locked out', 'access denied', 'vpn down', 'network down'], bonus: 7, reason: 'Access/connectivity keyword' },
  { keywords: ['client meeting', 'client demo', 'presentation', 'deadline'], bonus: 6, reason: 'Business deadline keyword' },
  { keywords: ['entire team', 'everyone affected', 'all users', 'department wide'], bonus: 8, reason: 'Wide impact keyword' },
  { keywords: ['database', 'db down', 'backup failed', 'data corruption'], bonus: 9, reason: 'Data risk keyword' },
  { keywords: ['printer', 'mouse', 'keyboard', 'monitor', 'cosmetic'], bonus: -3, reason: 'Low priority peripheral keyword' }
];

// Impact weights
const IMPACT_WEIGHTS = {
  just_me: 1,
  team: 2,
  department: 3,
  company: 5
};

// Urgency weights
const URGENCY_WEIGHTS = {
  flexible: 1,
  today: 2,
  within_hour: 4,
  right_now: 5
};

// Role modifiers (some companies weight senior roles higher)
const ROLE_MODIFIERS = {
  admin: 5,
  support_agent: 3,
  employee: 0
};

// SLA thresholds (hours)
const SLA_HOURS = {
  critical: 1,
  high: 4,
  medium: 24,
  low: 72
};

/**
 * Calculate SLA deadline based on priority
 */
const calculateSLADeadline = (priority) => {
  const hours = SLA_HOURS[priority] || 72;
  const deadline = new Date();
  deadline.setHours(deadline.getHours() + hours);
  return deadline;
};

/**
 * Calculate response deadline (25% of resolution time)
 */
const calculateResponseDeadline = (priority) => {
  const hours = Math.max(1, Math.floor((SLA_HOURS[priority] || 72) * 0.25));
  const deadline = new Date();
  deadline.setHours(deadline.getHours() + hours);
  return deadline;
};

/**
 * Calculate SLA risk score based on time remaining vs deadline
 */
const calculateSLARisk = (slaDeadline) => {
  if (!slaDeadline) return 1;
  const now = new Date();
  const deadline = new Date(slaDeadline);
  const totalTime = deadline - now;
  const hoursRemaining = totalTime / (1000 * 60 * 60);

  if (hoursRemaining <= 0) return 5; // Already breached
  if (hoursRemaining <= 1) return 4;
  if (hoursRemaining <= 4) return 3;
  if (hoursRemaining <= 24) return 2;
  return 1;
};

/**
 * Detect keywords in text and return bonuses
 */
const analyzeKeywords = (text) => {
  const lowerText = (text || '').toLowerCase();
  let totalBonus = 0;
  const matchedRules = [];

  for (const rule of KEYWORD_RULES) {
    const matched = rule.keywords.some(kw => lowerText.includes(kw));
    if (matched) {
      totalBonus += rule.bonus;
      matchedRules.push(rule.reason);
    }
  }

  return { bonus: totalBonus, reasons: matchedRules };
};

/**
 * Determine priority label from score
 */
const scoreToLabel = (score) => {
  if (score >= 60) return 'critical';
  if (score >= 35) return 'high';
  if (score >= 15) return 'medium';
  return 'low';
};

/**
 * Main scoring function
 */
const calculatePriorityScore = ({ impactScope, urgencyLevel, role, slaDeadline, queuePosition, title, description, createdAt }) => {
  const impact = IMPACT_WEIGHTS[impactScope] || 1;
  const urgency = URGENCY_WEIGHTS[urgencyLevel] || 1;
  const slaRisk = calculateSLARisk(slaDeadline);
  const roleModifier = ROLE_MODIFIERS[role] || 0;

  // Queue bonus: older tickets in queue get bumped (max 20)
  const ageHours = createdAt ? (Date.now() - new Date(createdAt)) / (1000 * 60 * 60) : 0;
  const queueBonus = Math.min(Math.floor(ageHours * 0.5) + (queuePosition ? Math.max(0, 10 - queuePosition) : 0), 20);

  // Knowledge/keyword bonus
  const fullText = `${title || ''} ${description || ''}`;
  const { bonus: knowledgeBonus, reasons: matchedKeywords } = analyzeKeywords(fullText);

  const finalScore = (impact * 5) + (urgency * 4) + (slaRisk * 6) + roleModifier + queueBonus + knowledgeBonus;

  return {
    finalScore,
    priority: scoreToLabel(finalScore),
    breakdown: {
      impactScore: impact * 5,
      urgencyScore: urgency * 4,
      slaRiskScore: slaRisk * 6,
      roleModifier,
      queueBonus,
      knowledgeBonus
    },
    matchedKeywords
  };
};

/**
 * Detect priority suggestion from ticket text alone (for form UI suggestion)
 */
const suggestPriorityFromText = (title, description) => {
  const fullText = `${title} ${description}`.toLowerCase();
  const { bonus, reasons } = analyzeKeywords(fullText);

  let suggestedPriority = 'low';
  if (bonus >= 15) suggestedPriority = 'critical';
  else if (bonus >= 8) suggestedPriority = 'high';
  else if (bonus >= 4) suggestedPriority = 'medium';

  return { suggestedPriority, reasons };
};

/**
 * Recalculate and update a ticket's priority score
 */
const recalculateTicketScore = async (ticket, user) => {
  const slaDeadline = ticket.sla?.deadline;

  const result = calculatePriorityScore({
    impactScope: ticket.impactScope,
    urgencyLevel: ticket.urgencyLevel,
    role: user?.role || 'employee',
    slaDeadline,
    queuePosition: ticket.queuePosition,
    title: ticket.title,
    description: ticket.description,
    createdAt: ticket.createdAt
  });

  return result;
};

module.exports = {
  calculatePriorityScore,
  calculateSLADeadline,
  calculateResponseDeadline,
  suggestPriorityFromText,
  recalculateTicketScore,
  scoreToLabel,
  SLA_HOURS
};
