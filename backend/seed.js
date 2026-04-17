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

    // 2. SUPER ADMIN (System Access)
    await User.create({
      name: 'System Admin', 
      email: 'admin@vdartinc.com', 
      password: 'password', 
      role: 'admin', 
      department: 'Admin', 
      employeeId: 'SYS-001'
    });

    // 3. IT DEPARTMENT ADMIN
    const itAdmin = await User.create({
      name: 'IT Admin',
      email: 'itadmin@vdartinc.com',
      password: 'password',
      role: 'admin',
      department: 'IT',
      employeeId: 'ADM-IT-001'
    });

    // 4. IT SUPPORT TEAM (Reporting to IT Admin & System Admin)
    const itSupportEmails = [
      { name: 'Naveen Kumar', email: 'naveen@vdartinc.com' },
      { name: 'Thara ', email: 'thara@vdartinc.com' },
      { name: 'Krish', email: 'krish@vdartinc.com' }
    ];

    for (let i = 0; i < itSupportEmails.length; i++) {
      await User.create({
        name: itSupportEmails[i].name,
        email: itSupportEmails[i].email,
        password: 'password',
        role: 'support_agent',
        department: 'IT',
        employeeId: `SUP-IT-00${i + 1}`,
        expertise: ['IT']
      });
    }

    console.log('✅ Created 1 Super Admin, 1 IT Admin & 3 Custom IT Support Agents.');

    // 5. SAMPLE TICKETS
    const sysAdmin = await User.findOne({ email: 'admin@vdartinc.com' });

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
        category: 'IT', priority: 'critical', status: 'in_progress',
        createdBy: itAdmin._id, assignedTo: sysAdmin._id,
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
