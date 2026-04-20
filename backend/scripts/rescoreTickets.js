const mongoose = require('mongoose');
const Ticket = require('../models/Ticket.model');
const User = require('../models/User.model');
const { recalculateTicketScore } = require('../services/priority.service');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const tickets = await Ticket.find({ status: { $ne: 'resolved' } });
  console.log(`🔄 Re-scoring ${tickets.length} active tickets...`);
  
  let updated = 0;
  for (const t of tickets) {
    const u = await User.findById(t.createdBy);
    const result = await recalculateTicketScore(t, u);
    
    if (result.priority !== t.priority) {
      console.log(`📍 Ticket ${t.ticketId}: ${t.priority} -> ${result.priority} (${t.title})`);
      t.priority = result.priority;
      t.priorityScore = result.finalScore;
      t.scoreBreakdown = result.breakdown;
      await t.save();
      updated++;
    }
  }
  
  console.log(`✅ Finished! Updated ${updated} tickets.`);
  process.exit();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
