const mongoose = require('mongoose');
require('dotenv').config();
const Ticket = require('./models/User.model'); // Wait, check model name
const TicketModel = require('./models/Ticket.model');
const User = require('./models/User.model');

async function checkTickets() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB');

    const totalTickets = await TicketModel.countDocuments();
    console.log(`Total tickets in DB: ${totalTickets}`);

    const tickets = await TicketModel.find().populate('createdBy', 'name email role').populate('assignedTo', 'name email');
    
    tickets.forEach(t => {
      console.log(`- [${t.ticketId}] "${t.title}" | Created by: ${t.createdBy?.email} (${t.createdBy?.role}) | Status: ${t.status}`);
    });

    const admins = await User.find({ role: 'admin' });
    console.log(`Total admins: ${admins.length}`);
    admins.forEach(a => console.log(`- Admin: ${a.email}`));

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkTickets();
