const mongoose = require('mongoose');
const Ticket = require('../models/Ticket.model');
require('dotenv').config();

const clean = async () => {
    await mongoose.connect(process.env.MONGO_URI);
    const result = await Ticket.deleteMany({ 
        title: { $in: ['Initial System Access Request', 'Critical: Database Schema Update Needed'] } 
    });
    console.log('Deleted initial tickets:', result.deletedCount);
    process.exit(0);
};

clean();
