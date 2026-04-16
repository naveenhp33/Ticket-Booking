const User = require('../models/User.model');

/**
 * Auto-assign ticket to the most suitable agent
 * Strategy: Category match + lowest current workload (round robin within tied agents)
 */
const autoAssignTicket = async (ticket) => {
  try {
    // Find agents who handle this category, sorted by workload
    let agents = await User.find({
      role: 'support_agent',
      expertise: ticket.category,
      isActive: true
    }).sort({ currentWorkload: 1 });

    // Fallback: any agent
    if (!agents || agents.length === 0) {
      agents = await User.find({ role: 'support_agent', isActive: true }).sort({ currentWorkload: 1 });
    }

    if (!agents || agents.length === 0) return null;

    // Among agents with equal workload, round robin using ticket's age
    const minWorkload = agents[0].currentWorkload;
    const tiedAgents = agents.filter(a => a.currentWorkload === minWorkload);
    const selectedAgent = tiedAgents[Date.now() % tiedAgents.length];

    return selectedAgent;
  } catch (err) {
    console.error('Auto-assign error:', err.message);
    return null;
  }
};

/**
 * Increment agent workload
 */
const incrementWorkload = async (agentId) => {
  await User.findByIdAndUpdate(agentId, { $inc: { currentWorkload: 1 } });
};

/**
 * Decrement agent workload (when ticket resolved/closed)
 */
const decrementWorkload = async (agentId) => {
  await User.findByIdAndUpdate(agentId, { $inc: { currentWorkload: -1 } });
};

module.exports = { autoAssignTicket, incrementWorkload, decrementWorkload };
