/**
 * 🚀 Final Master Seed Script
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User.model');
const Ticket = require('./models/Ticket.model');
const KnowledgeBase = require('./models/KnowledgeBase.model');

const seed = async () => {
  try {
    console.log('⏳ Syncing...');
    await mongoose.connect(process.env.MONGO_URI);
    
    await User.deleteMany({});
    await Ticket.deleteMany({});
    await KnowledgeBase.deleteMany({});

    // 1. SIMPLE TEST USER (As requested by user)
    const simpleUser = await User.create({
      name: 'Test Member', 
      email: 'user@vdartinc.com', 
      password: 'password', // Easy password
      role: 'employee', 
      department: 'IT', 
      employeeId: 'TEST-001'
    });

    // 2. ADMIN USER
    const admin = await User.create({
      name: 'System Admin', 
      email: 'admin@vdartinc.com', 
      password: 'password', 
      role: 'admin', 
      department: 'IT', 
      employeeId: 'ADM-001',
      expertise: ['IT', 'Engineering', 'Admin']
    });

    console.log('✅ Created easy test credentials: user@vdartinc.com / password');

    // 3. SAMPLE TICKETS (Sequential to avoid ID collision)
    const ticketData = [
      {
        title: 'Initial System Access Request',
        description: 'New user requiring access to the internal portal and documentation hub.',
        category: 'IT', priority: 'medium', status: 'open',
        createdBy: simpleUser._id,
        impactScope: 'just_me', urgencyLevel: 'today'
      },
      {
        title: 'Critical: Database Schema Update Needed',
        description: 'The production database requires an urgent update to include the new Engineering department enums.',
        category: 'Engineering', priority: 'critical', status: 'in_progress',
        createdBy: admin._id, assignedTo: admin._id,
        impactScope: 'company', urgencyLevel: 'right_now'
      }
    ];

    for (const t of ticketData) {
       await Ticket.create(t);
    }

    console.log('✨ Seeding complete.');
    process.exit(0);
  } catch (err) {
    console.error('❌ SEED FAIL:', err);
    process.exit(1);
  }
};

seed();
