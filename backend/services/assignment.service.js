const User = require('../models/User.model');

/**
 * Auto-assign ticket to the most suitable agent
 * Strategy: Category match + lowest current workload (round robin within tied agents)
 */
const autoAssignTicket = async (ticket) => {
  try {
    // Priority 1: support_agents with matching expertise and lowest workload
    let agents = await User.find({
      role: 'support_agent',
      expertise: ticket.category,
      isActive: true,
      currentWorkload: { $gte: 0 }
    }).sort({ currentWorkload: 1 });

    // Priority 2: any support_agent in matching department
    if (!agents || agents.length === 0) {
      agents = await User.find({
        role: 'support_agent',
        department: ticket.category,
        isActive: true,
        currentWorkload: { $gte: 0 }
      }).sort({ currentWorkload: 1 });
    }

    // Priority 3: admin in matching department
    if (!agents || agents.length === 0) {
      agents = await User.find({
        role: 'admin',
        department: ticket.category,
        isActive: true,
        currentWorkload: { $gte: 0 }
      }).sort({ currentWorkload: 1 });
    }

    // Priority 4: any support_agent
    if (!agents || agents.length === 0) {
      agents = await User.find({
        role: 'support_agent',
        isActive: true,
        currentWorkload: { $gte: 0 }
      }).sort({ currentWorkload: 1 });
    }

    if (!agents || agents.length === 0) return null;

    // Among agents with equal workload, round robin
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
  // Never go below 0
  await User.findByIdAndUpdate(agentId, [{ $set: { currentWorkload: { $max: [0, { $subtract: ['$currentWorkload', 1] }] } } }]);
};

module.exports = { autoAssignTicket, incrementWorkload, decrementWorkload };
