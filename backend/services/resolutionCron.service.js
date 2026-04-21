const Ticket = require('../models/Ticket.model');
const User = require('../models/User.model');
const { decrementWorkload } = require('../controllers/user.controller');

/**
 * Periodically checks for tickets in 'pending_confirmation' state 
 * and auto-closes them after 24 hours if no employee response.
 */
const startResolutionCron = () => {
  console.log('🕒 Resolution Guardian: Monitoring pending closures...');
  
  // Run every 10 minutes
  setInterval(async () => {
    try {
      const TWENTY_FOUR_HOURS_AGO = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      const ticketsToAutoClose = await Ticket.find({
        status: 'pending_confirmation',
        'resolution.pendingConfirmationAt': { $lte: TWENTY_FOUR_HOURS_AGO }
      }).populate('assignedTo');

      if (ticketsToAutoClose.length === 0) return;

      console.log(`🧹 Resolution Guardian: Auto-closing ${ticketsToAutoClose.length} overdue tickets.`);

      for (const ticket of ticketsToAutoClose) {
        ticket.status = 'closed';
        ticket.resolution.resolvedAt = new Date();
        ticket.statusHistory.push({
          from: 'pending_confirmation',
          to: 'closed',
          changedBy: null, // System action
          reason: 'Auto-closed — no response from employee within 24 hours of resolution request.'
        });

        // Update workload and stats (conservative - don't count as confirmed fix for agent metrics)
        if (ticket.assignedTo) {
          await decrementWorkload(ticket.assignedTo._id);
          // Increment total resolved but don't count towards special "confirmed" metrics if separate
          await User.findByIdAndUpdate(ticket.assignedTo._id, { $inc: { 'stats.totalResolved': 1 } });
        }

        await ticket.save();
        console.log(`✅ Auto-closed ticket ${ticket.ticketId}`);
      }
    } catch (err) {
      console.error('❌ Resolution Guardian Error:', err.message);
    }
  }, 10 * 60 * 1000); // 10 minutes
};

module.exports = { startResolutionCron };
