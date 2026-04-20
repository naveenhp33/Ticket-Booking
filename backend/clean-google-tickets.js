const mongoose = require('mongoose');
require('dotenv').config();
const Ticket = require('./models/Ticket.model');

async function cleanGoogleTickets() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const result = await Ticket.deleteMany({
      $or: [
        { title: { $regex: /google/i } },
        { 'emailSource.from': { $regex: /google\.com/i } }
      ]
    });

    console.log(`Successfully deleted ${result.deletedCount} Google-related tickets.`);
    process.exit(0);
  } catch (err) {
    console.error('Error cleaning tickets:', err.message);
    process.exit(1);
  }
}

cleanGoogleTickets();
