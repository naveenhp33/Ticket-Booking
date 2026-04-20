/**
 * Sanitizes and detects priority based on keywords in title or message
 * @param {string} title 
 * @param {string} message 
 * @returns {string} priority (low, medium, high, critical)
 */
const detectPriority = (title = '', message = '') => {
  const content = (title + ' ' + message).toLowerCase();

  // CRITICAL KEYWORDS
  const critical = ['server down', 'outage', 'network failure', 'security breach', 'database down', 'fire', 'emergency', 'blackout'];
  if (critical.some(word => content.includes(word))) return 'critical';

  // HIGH KEYWORDS
  const high = ['os crashed', 'blue screen', 'bsod', 'crashed', 'display issue', 'vpn not working', 'urgent', 'blocked', 'cannot work'];
  if (high.some(word => content.includes(word))) return 'high';

  // LOW KEYWORDS
  const low = ['how to', 'question', 'new keyboard', 'replacement', 'software update', 'cosmetic', 'minor'];
  if (low.some(word => content.includes(word))) return 'low';

  // DEFAULT
  return 'medium';
};

module.exports = { detectPriority };
